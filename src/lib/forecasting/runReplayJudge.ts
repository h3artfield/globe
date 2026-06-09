import type {
  ReplayEvidenceSnapshot,
  ReplayJudgeAudit,
  ReplayJudgeCheck,
  ReplayResolution,
  ReplayScorecard,
  ReplaySession,
} from "@/types/forecasting";
import { loadReplayEvidenceSnapshot } from "@/lib/forecasting/replayEvidenceSnapshotStore";
import { loadReplayResolution } from "@/lib/forecasting/replayResolutionStore";
import {
  createJudgeAuditId,
  saveReplayJudgeAudit,
} from "@/lib/forecasting/replayJudgeAuditStore";
import { loadReplayScorecard } from "@/lib/forecasting/replayScorecardStore";
import { loadReplaySession, saveReplaySession } from "@/lib/forecasting/replaySessionStore";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";

function appendAudit(session: ReplaySession, action: string, details?: string): ReplaySession {
  return {
    ...session,
    audit_trail: [
      ...session.audit_trail,
      { at: new Date().toISOString(), action, details },
    ],
  };
}

function countFutureLeakage(snapshot: ReplayEvidenceSnapshot, asOfYear: number): number {
  return snapshot.included_records.filter((record) => {
    if (record.year != null && record.year > asOfYear) {
      return true;
    }
    if (record.date) {
      return Number(record.date.slice(0, 4)) > asOfYear;
    }
    return false;
  }).length;
}

function buildLeakageCheck(
  snapshot: ReplayEvidenceSnapshot | null,
  asOfYear: number,
): ReplayJudgeCheck {
  if (!snapshot) {
    return {
      name: "leakage_check",
      status: "fail",
      message: "Missing evidence snapshot.",
    };
  }

  const futureInIncluded = countFutureLeakage(snapshot, asOfYear);
  if (futureInIncluded > 0) {
    return {
      name: "leakage_check",
      status: "fail",
      message: `${futureInIncluded} included record(s) appear to be after as_of year ${asOfYear}.`,
    };
  }

  if (snapshot.excluded_future_records_count > 0 && futureInIncluded === 0) {
    return {
      name: "leakage_check",
      status: "pass",
      message: `${snapshot.excluded_future_records_count} future record(s) were excluded from evidence.`,
    };
  }

  return {
    name: "leakage_check",
    status: "pass",
    message: "No future leakage detected in included evidence records.",
  };
}

function buildSourceCheck(snapshot: ReplayEvidenceSnapshot | null): ReplayJudgeCheck {
  if (!snapshot) {
    return {
      name: "source_check",
      status: "fail",
      message: "Missing evidence snapshot.",
    };
  }

  if (snapshot.missing_sources.length > 0) {
    return {
      name: "source_check",
      status: "warning",
      message: `Missing sources: ${snapshot.missing_sources.join(", ")}.`,
    };
  }

  if (snapshot.included_records.length === 0) {
    return {
      name: "source_check",
      status: "warning",
      message: "Evidence snapshot contains no included records.",
    };
  }

  return {
    name: "source_check",
    status: "pass",
    message: `${snapshot.included_records.length} evidence record(s) from allowed sources.`,
  };
}

function buildResolutionCheck(resolution: ReplayResolution | null): ReplayJudgeCheck {
  if (!resolution) {
    return {
      name: "resolution_check",
      status: "fail",
      message: "Missing resolution.",
    };
  }

  if (resolution.outcome === "missing_evidence") {
    return {
      name: "resolution_check",
      status: "warning",
      message: "Resolution outcome is missing_evidence.",
    };
  }

  if (resolution.confidence === "low") {
    return {
      name: "resolution_check",
      status: "warning",
      message: "Resolution confidence is low.",
    };
  }

  return {
    name: "resolution_check",
    status: "pass",
    message: `Resolution outcome=${resolution.outcome}; confidence=${resolution.confidence}.`,
  };
}

function buildScoringCheck(
  session: ReplaySession,
  scorecard: ReplayScorecard | null,
): ReplayJudgeCheck {
  if (session.status !== "resolved") {
    return {
      name: "scoring_check",
      status: "warning",
      message: "Session is not resolved yet.",
    };
  }

  if (!scorecard) {
    return {
      name: "scoring_check",
      status: "warning",
      message: "Missing scorecard for resolved session.",
    };
  }

  if (scorecard.brier_score === null) {
    return {
      name: "scoring_check",
      status: "warning",
      message: "Scorecard exists but Brier score is null (non-binary outcome).",
    };
  }

  return {
    name: "scoring_check",
    status: "pass",
    message: `Scorecard present; Brier=${scorecard.brier_score.toFixed(4)}.`,
  };
}

function buildTimingCheck(
  snapshot: ReplayEvidenceSnapshot | null,
  resolution: ReplayResolution | null,
): ReplayJudgeCheck {
  if (!snapshot || !resolution) {
    return {
      name: "timing_check",
      status: "pass",
      message: "Timing check skipped (missing snapshot or resolution).",
    };
  }

  if (snapshot.created_at > resolution.created_at) {
    return {
      name: "timing_check",
      status: "warning",
      message: "Evidence snapshot was created after resolution; review for suspicious ordering.",
    };
  }

  return {
    name: "timing_check",
    status: "pass",
    message: "Evidence snapshot predates resolution.",
  };
}

export async function runReplayJudge(sessionId: string): Promise<ReplayJudgeAudit> {
  const session = await loadReplaySession(sessionId);
  if (!session) {
    throw new ReplaySessionValidationError(`Session not found: ${sessionId}`);
  }

  const [snapshot, resolution, scorecard] = await Promise.all([
    loadReplayEvidenceSnapshot(sessionId),
    loadReplayResolution(sessionId),
    loadReplayScorecard(sessionId),
  ]);

  const leakageCheck = buildLeakageCheck(snapshot, session.forecast_year);
  const sourceCheck = buildSourceCheck(snapshot);
  const resolutionCheck = buildResolutionCheck(resolution);
  const scoringCheck = buildScoringCheck(session, scorecard);
  const timingCheck = buildTimingCheck(snapshot, resolution);

  const checks = [leakageCheck, sourceCheck, resolutionCheck, scoringCheck, timingCheck];
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const check of checks) {
    if (check.status === "warning") {
      warnings.push(check.message);
    }
    if (check.status === "fail") {
      errors.push(check.message);
    }
  }

  let overallStatus: ReplayJudgeAudit["overall_status"] = "pass";
  if (errors.length > 0) {
    overallStatus = "fail";
  } else if (warnings.length > 0) {
    overallStatus = "warning";
  }

  const audit: ReplayJudgeAudit = {
    judge_audit_id: createJudgeAuditId(),
    session_id: session.session_id,
    created_at: new Date().toISOString(),
    checks,
    leakage_check: leakageCheck,
    source_check: sourceCheck,
    resolution_check: resolutionCheck,
    scoring_check: scoringCheck,
    warnings,
    errors,
    overall_status: overallStatus,
  };

  await saveReplayJudgeAudit(audit);

  const updated = appendAudit(
    { ...session, judge_audit_id: audit.judge_audit_id },
    "judge_audit_run",
    `overall_status=${overallStatus}; warnings=${warnings.length}; errors=${errors.length}`,
  );
  await saveReplaySession(updated);

  return audit;
}

export async function getReplayJudgeAudit(sessionId: string): Promise<ReplayJudgeAudit | null> {
  const { loadReplayJudgeAudit } = await import("@/lib/forecasting/replayJudgeAuditStore");
  return loadReplayJudgeAudit(sessionId);
}
