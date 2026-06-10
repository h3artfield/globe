import type {
  ForecastAgentRun,
  ForecastAgentStrategy,
  ReplayEvidenceSnapshot,
  ReplayForecastConfidence,
  ReplaySession,
} from "@/types/forecasting";
import { createAgentRunId, saveAgentRun } from "@/lib/forecasting/agentRunStore";
import { resolveAgentStrategy } from "@/lib/forecasting/agentStrategyStore";
import { getReplayEvidenceSnapshot } from "@/lib/forecasting/buildReplayEvidenceSnapshot";
import { loadForecastAgent } from "@/lib/forecasting/forecastAgentStore";
import { loadReplaySession } from "@/lib/forecasting/replaySessionStore";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";
import { createSessionSourceRequest } from "@/lib/forecasting/sessionSourceRequests";
import { listSourceRequestsForSession } from "@/lib/forecasting/sourceRequestStore";
import {
  buildAgentSourceRequestCriteria,
  findReusableAgentSourceRequest,
} from "@/lib/forecasting/sourceRequestDedupe";
import {
  validateConfidence,
  validateProbability,
} from "@/lib/forecasting/replaySessionValidation";

function clampProbability(value: number): number {
  return Math.max(1, Math.min(99, Math.round(value)));
}

function parseNumericValue(summary: string): number | null {
  const match = /^([\d.]+)/.exec(summary.trim());
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function metricRecordsFromSnapshot(snapshot: ReplayEvidenceSnapshot | null, metricId: string) {
  if (!snapshot) {
    return [];
  }
  return snapshot.included_records
    .filter((record) => record.label.includes(metricId))
    .map((record) => ({
      year: record.year,
      value: parseNumericValue(record.value_summary),
      label: record.label,
    }))
    .filter((record) => record.year !== null && record.value !== null)
    .sort((left, right) => (left.year ?? 0) - (right.year ?? 0));
}

function evidenceScore(
  session: ReplaySession,
  snapshot: ReplayEvidenceSnapshot | null,
  strategy: ForecastAgentStrategy,
): {
  recordCount: number;
  missingSources: string[];
  needsSources: boolean;
  warnings: string[];
} {
  const recordCount = snapshot?.included_records.length ?? 0;
  const missingSources =
    snapshot && snapshot.missing_sources.length > 0
      ? snapshot.missing_sources
      : recordCount === 0
        ? [...session.allowed_source_ids]
        : [];
  const warnings: string[] = [];
  if (snapshot?.limitations) {
    warnings.push(snapshot.limitations.slice(0, 240));
  }
  if (snapshot?.excluded_future_records_count) {
    warnings.push(
      `${snapshot.excluded_future_records_count} future record(s) excluded at snapshot cutoff ${session.forecast_year}.`,
    );
  }

  const lowRecords = recordCount < strategy.evidence_threshold;
  const hasMissing = missingSources.length > 0;
  const needsSources =
    (lowRecords && strategy.risk_style !== "aggressive") ||
    (hasMissing && strategy.source_gap_sensitivity >= 0.5) ||
    (hasMissing && lowRecords && strategy.source_gap_sensitivity >= 0.2);

  return { recordCount, missingSources, needsSources, warnings };
}

function draftForecastFromEvidence(
  session: ReplaySession,
  snapshot: ReplayEvidenceSnapshot | null,
  strategy: ForecastAgentStrategy,
): {
  probability: number;
  confidence: ReplayForecastConfidence;
  rationale: string;
  key_signals: string[];
  assumptions: string[];
  uncertainty_notes: string;
  recommended_action: ForecastAgentRun["recommended_action"];
} {
  const spec = session.resolution_spec;
  let probability = 50;
  const keySignals: string[] = [];
  const assumptions: string[] = [
    `Only evidence at or before ${session.forecast_year} is used.`,
    "Local deterministic strategy; no external model calls.",
  ];
  const uncertaintyNotes: string[] = [];

  if (spec.kind === "metric_compare_years") {
    const rows = metricRecordsFromSnapshot(snapshot, spec.metric_id);
    if (rows.length >= 2) {
      const baselineYear = session.forecast_year;
      const baseline = rows.filter((row) => (row.year ?? 0) <= baselineYear).at(-1);
      const earliest = rows[0];
      if (baseline && earliest && baseline.value !== null && earliest.value !== null) {
        const delta = baseline.value - earliest.value;
        const direction = delta > 0 ? "upward" : delta < 0 ? "downward" : "flat";
        keySignals.push(
          `${spec.metric_id} moved ${direction} from ${earliest.year} (${earliest.value}) to ${baseline.year} (${baseline.value}).`,
        );
        const move =
          strategy.risk_style === "aggressive" ? 18 : strategy.risk_style === "balanced" ? 12 : 8;
        if (delta > 0) {
          probability = 50 + move;
        } else if (delta < 0) {
          probability = 50 - move;
        }
      }
    } else if (rows.length === 1) {
      keySignals.push(`Single ${spec.metric_id} observation available before cutoff.`);
      probability = strategy.risk_style === "aggressive" ? 58 : 52;
      uncertaintyNotes.push("Only one metric observation available; direction inference is weak.");
    } else {
      uncertaintyNotes.push("No metric rows found in evidence snapshot.");
      probability = 50;
    }
  } else {
    keySignals.push(`Template ${session.template_id} uses non-metric resolution logic.`);
    if (snapshot?.news_evidence_records?.length) {
      for (const record of snapshot.news_evidence_records.slice(0, 3)) {
        keySignals.push(`News (${record.outlet}): ${record.title}`);
      }
      probability =
        strategy.risk_style === "aggressive"
          ? 55
          : strategy.risk_style === "balanced"
            ? 52
            : 50;
    } else {
      probability = 50;
    }
  }

  probability -= Math.round(strategy.uncertainty_penalty * 100 * (snapshot ? 0 : 1));
  if ((snapshot?.included_records.length ?? 0) < strategy.evidence_threshold) {
    uncertaintyNotes.push(
      `Evidence count ${snapshot?.included_records.length ?? 0} is below strategy threshold ${strategy.evidence_threshold}.`,
    );
    probability = strategy.risk_style === "aggressive" ? probability : 50;
  }

  const confidence =
    (snapshot?.included_records.length ?? 0) >= strategy.evidence_threshold
      ? snapshot?.confidence ?? "medium"
      : strategy.risk_style === "aggressive"
        ? "low"
        : "low";

  const rationale = [
    `Strategy ${strategy.name} reviewed ${snapshot?.included_records.length ?? 0} evidence record(s) for: ${session.question_text}`,
    keySignals[0] ?? "No strong directional signal detected in available evidence.",
    uncertaintyNotes[0] ?? "Uncertainty remains due to sparse or incomplete local coverage.",
  ].join(" ");

  return {
    probability: clampProbability(probability),
    confidence,
    rationale,
    key_signals: keySignals,
    assumptions,
    uncertainty_notes: uncertaintyNotes.join(" "),
    recommended_action:
      confidence === "low" && strategy.risk_style === "cautious" ? "human_review" : "lock",
  };
}

export async function runForecastAgent(
  sessionId: string,
  strategyId: string,
  agentIdInput?: string,
): Promise<ForecastAgentRun> {
  const session = await loadReplaySession(sessionId);
  if (!session) {
    throw new ReplaySessionValidationError(`Session not found: ${sessionId}`);
  }
  if (session.status !== "draft") {
    throw new ReplaySessionValidationError(
      `Agent run is only allowed on draft sessions (status=${session.status})`,
    );
  }

  const agentId = agentIdInput ?? session.agent_id;
  if (!agentId) {
    throw new ReplaySessionValidationError("Session has no assigned agent_id.");
  }

  const agent = await loadForecastAgent(agentId);
  if (!agent) {
    throw new ReplaySessionValidationError(`Agent not found: ${agentId}`);
  }

  const strategy = await resolveAgentStrategy(agentId, strategyId);
  if (!strategy || !strategy.active) {
    throw new ReplaySessionValidationError(`Strategy not found or inactive: ${strategyId}`);
  }

  const snapshot = await getReplayEvidenceSnapshot(sessionId);
  const evaluation = evidenceScore(session, snapshot, strategy);
  const existingRequests = await listSourceRequestsForSession(sessionId);
  const sourceRequestIdsCreated: string[] = [];
  const sourceRequestIdsReused: string[] = [];

  if (evaluation.needsSources) {
    const missing = evaluation.missingSources.length
      ? evaluation.missingSources
      : session.allowed_source_ids;
    const requestType = "dataset_refresh" as const;
    for (const sourceId of missing) {
      const input = {
        request_type: requestType,
        requested_source_id: sourceId,
        reason: `Agent strategy ${strategy.strategy_id} detected insufficient local evidence before forecast lock.`,
        priority: strategy.risk_style === "cautious" ? ("high" as const) : ("medium" as const),
      };
      const criteria = buildAgentSourceRequestCriteria(
        sessionId,
        agentId,
        input,
        session.forecast_year,
      );
      const reusable = findReusableAgentSourceRequest(existingRequests, criteria);
      if (reusable) {
        sourceRequestIdsReused.push(reusable.source_request_id);
        continue;
      }
      const created = await createSessionSourceRequest(sessionId, input);
      sourceRequestIdsCreated.push(created.source_request_id);
      existingRequests.push(created);
    }

    const linkedCount = sourceRequestIdsCreated.length + sourceRequestIdsReused.length;
    const run: ForecastAgentRun = {
      agent_run_id: createAgentRunId(),
      session_id: sessionId,
      agent_id: agentId,
      strategy_id: strategy.strategy_id,
      created_at: new Date().toISOString(),
      status: "needs_sources",
      evidence_snapshot_id: snapshot?.evidence_snapshot_id ?? null,
      source_request_ids_created: sourceRequestIdsCreated,
      source_request_ids_reused: sourceRequestIdsReused,
      probability: null,
      confidence: null,
      rationale: `Evidence insufficient (${evaluation.recordCount} records; threshold ${strategy.evidence_threshold}). Linked ${linkedCount} source request(s) (${sourceRequestIdsCreated.length} created, ${sourceRequestIdsReused.length} reused).`,
      key_signals: evaluation.warnings,
      assumptions: ["Agent will not lock until evidence gaps are addressed."],
      uncertainty_notes: "Forecast withheld pending source fulfillment and evidence regeneration.",
      recommended_action: "request_sources",
      warnings: evaluation.warnings,
      errors: [],
    };
    await saveAgentRun(run);
    return run;
  }

  const draft = draftForecastFromEvidence(session, snapshot, strategy);
  const run: ForecastAgentRun = {
    agent_run_id: createAgentRunId(),
    session_id: sessionId,
    agent_id: agentId,
    strategy_id: strategy.strategy_id,
    created_at: new Date().toISOString(),
    status: "completed",
    evidence_snapshot_id: snapshot?.evidence_snapshot_id ?? null,
    source_request_ids_created: sourceRequestIdsCreated,
    source_request_ids_reused: sourceRequestIdsReused,
    probability: draft.probability,
    confidence: draft.confidence,
    rationale: draft.rationale,
    key_signals: draft.key_signals,
    assumptions: draft.assumptions,
    uncertainty_notes: draft.uncertainty_notes,
    recommended_action: draft.recommended_action,
    warnings: evaluation.warnings,
    errors: [],
  };
  await saveAgentRun(run);
  return run;
}

export async function applyAgentRunToSession(
  sessionId: string,
  agentRunId: string,
  agentId: string,
): Promise<ReplaySession> {
  const { loadAgentRun } = await import("@/lib/forecasting/agentRunStore");
  const { saveReplaySession } = await import("@/lib/forecasting/replaySessionStore");
  const session = await loadReplaySession(sessionId);
  if (!session) {
    throw new ReplaySessionValidationError(`Session not found: ${sessionId}`);
  }
  if (session.status !== "draft") {
    throw new ReplaySessionValidationError(`Cannot apply agent run to non-draft session.`);
  }

  const run = await loadAgentRun(agentId, agentRunId);
  if (!run || run.session_id !== sessionId) {
    throw new ReplaySessionValidationError(`Agent run not found: ${agentRunId}`);
  }
  if (run.status !== "completed" || run.probability === null) {
    throw new ReplaySessionValidationError(
      `Agent run is not a completed forecast draft (status=${run.status}).`,
    );
  }

  const probability = validateProbability(run.probability, true);
  const confidence = validateConfidence(run.confidence);

  const updated: ReplaySession = {
    ...session,
    user_forecast: {
      probability,
      confidence,
      rationale: run.rationale,
    },
    forecast_rationale: run.rationale,
    key_signals: run.key_signals,
    assumptions: run.assumptions,
    uncertainty_notes: run.uncertainty_notes,
    audit_trail: [
      ...session.audit_trail,
      {
        at: new Date().toISOString(),
        action: "agent_run_applied",
        details: `${run.agent_run_id}:${run.strategy_id}:p=${run.probability}`,
      },
    ],
  };
  await saveReplaySession(updated);
  return updated;
}
