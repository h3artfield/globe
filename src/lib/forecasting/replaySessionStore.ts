import { randomBytes } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import type { CreateReplaySessionRequest, ReplaySession } from "@/types/forecasting";
import { pathExists, readJsonFile, repoPath, writeJsonFile } from "@/lib/pipeline/io";
import { createReplaySessionFromTemplate } from "@/lib/forecasting/createReplaySession";

const SESSIONS_DIR = repoPath("data", "forecasting", "sessions");

function sessionFilePath(sessionId: string): string {
  return path.join(SESSIONS_DIR, sessionId, "session.v1.json");
}

export function createSessionId(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = randomBytes(3).toString("hex");
  return `replay_${stamp}_${suffix}`;
}

export async function saveReplaySession(session: ReplaySession): Promise<void> {
  await writeJsonFile(sessionFilePath(session.session_id), session);
}

export async function loadReplaySession(sessionId: string): Promise<ReplaySession | null> {
  const filePath = sessionFilePath(sessionId);
  if (!(await pathExists(filePath))) {
    return null;
  }
  return readJsonFile<ReplaySession>(filePath).then((session) => ({
    ...session,
    locked_at: session.locked_at ?? null,
    scorecard_id: session.scorecard_id ?? null,
    judge_audit_id: session.judge_audit_id ?? null,
    postmortem_id: session.postmortem_id ?? null,
    agent_id: session.agent_id ?? null,
    agent_name: session.agent_name ?? null,
    agent_type: session.agent_type ?? null,
    forecast_rationale: session.forecast_rationale ?? session.user_forecast?.rationale ?? "",
    key_signals: session.key_signals ?? [],
    assumptions: session.assumptions ?? [],
    uncertainty_notes: session.uncertainty_notes ?? "",
    requested_sources: session.requested_sources ?? [],
    source_request_ids: session.source_request_ids ?? [],
    postmortem_rule_ids: session.postmortem_rule_ids ?? [],
    user_forecast: {
      ...session.user_forecast,
      confidence:
        session.user_forecast.confidence === "low" ||
        session.user_forecast.confidence === "medium" ||
        session.user_forecast.confidence === "high"
          ? session.user_forecast.confidence
          : null,
    },
  }));
}

export async function listReplaySessions(): Promise<ReplaySession[]> {
  let entries: string[] = [];
  try {
    entries = await readdir(SESSIONS_DIR, { withFileTypes: true }).then((items) =>
      items.filter((item) => item.isDirectory()).map((item) => item.name),
    );
  } catch {
    return [];
  }

  const sessions: ReplaySession[] = [];
  for (const sessionId of entries) {
    const session = await loadReplaySession(sessionId);
    if (session) {
      sessions.push(session);
    }
  }

  return sessions.sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export async function createReplaySession(input: CreateReplaySessionRequest): Promise<ReplaySession> {
  const session = await createReplaySessionFromTemplate(input);
  await saveReplaySession(session);
  return session;
}
