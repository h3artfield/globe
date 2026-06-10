import { randomBytes } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import type { ForecastAgentRun } from "@/types/forecasting";
import { pathExists, readJsonFile, repoPath, writeJsonFile } from "@/lib/pipeline/io";

const AGENTS_DIR = repoPath("data", "forecasting", "agents");

function runsDir(agentId: string): string {
  return path.join(AGENTS_DIR, agentId, "runs");
}

function runPath(agentId: string, agentRunId: string): string {
  return path.join(runsDir(agentId), `${agentRunId}.v1.json`);
}

export function createAgentRunId(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = randomBytes(3).toString("hex");
  return `agent_run_${stamp}_${suffix}`;
}

export async function saveAgentRun(run: ForecastAgentRun): Promise<void> {
  await writeJsonFile(runPath(run.agent_id, run.agent_run_id), run);
}

export async function loadAgentRun(
  agentId: string,
  agentRunId: string,
): Promise<ForecastAgentRun | null> {
  const filePath = runPath(agentId, agentRunId);
  if (!(await pathExists(filePath))) {
    return null;
  }
  return readJsonFile<ForecastAgentRun>(filePath);
}

export async function listAgentRunsForSession(sessionId: string): Promise<ForecastAgentRun[]> {
  let agentDirs: string[] = [];
  try {
    agentDirs = await readdir(AGENTS_DIR, { withFileTypes: true }).then((items) =>
      items.filter((item) => item.isDirectory()).map((item) => item.name),
    );
  } catch {
    return [];
  }

  const runs: ForecastAgentRun[] = [];
  for (const agentId of agentDirs) {
    const agentRuns = await listAgentRuns(agentId);
    runs.push(...agentRuns.filter((run) => run.session_id === sessionId));
  }
  return runs.sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export async function listAgentRuns(agentId: string): Promise<ForecastAgentRun[]> {
  const directory = runsDir(agentId);
  let files: string[] = [];
  try {
    files = await readdir(directory);
  } catch {
    return [];
  }

  const runs: ForecastAgentRun[] = [];
  for (const fileName of files) {
    if (!fileName.endsWith(".v1.json")) {
      continue;
    }
    const agentRunId = fileName.replace(/\.v1\.json$/, "");
    const run = await loadAgentRun(agentId, agentRunId);
    if (run) {
      runs.push(run);
    }
  }
  return runs.sort((left, right) => right.created_at.localeCompare(left.created_at));
}
