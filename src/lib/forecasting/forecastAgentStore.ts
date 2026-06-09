import { randomBytes } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import type { CreateForecastAgentRequest, ForecastAgentProfile } from "@/types/forecasting";
import { pathExists, readJsonFile, repoPath, writeJsonFile } from "@/lib/pipeline/io";

const AGENTS_DIR = repoPath("data", "forecasting", "agents");

function profilePath(agentId: string): string {
  return path.join(AGENTS_DIR, agentId, "profile.v1.json");
}

export function createAgentId(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = randomBytes(3).toString("hex");
  return `agent_${stamp}_${suffix}`;
}

export async function saveForecastAgent(profile: ForecastAgentProfile): Promise<void> {
  await writeJsonFile(profilePath(profile.agent_id), profile);
}

export async function loadForecastAgent(agentId: string): Promise<ForecastAgentProfile | null> {
  const filePath = profilePath(agentId);
  if (!(await pathExists(filePath))) {
    return null;
  }
  return readJsonFile<ForecastAgentProfile>(filePath);
}

export async function listForecastAgents(): Promise<ForecastAgentProfile[]> {
  let entries: string[] = [];
  try {
    entries = await readdir(AGENTS_DIR, { withFileTypes: true }).then((items) =>
      items.filter((item) => item.isDirectory()).map((item) => item.name),
    );
  } catch {
    return [];
  }

  const agents: ForecastAgentProfile[] = [];
  for (const agentId of entries) {
    const agent = await loadForecastAgent(agentId);
    if (agent) {
      agents.push(agent);
    }
  }
  return agents.sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export async function createForecastAgent(
  input: CreateForecastAgentRequest,
): Promise<ForecastAgentProfile> {
  const createdAt = new Date().toISOString();
  const profile: ForecastAgentProfile = {
    agent_id: createAgentId(),
    name: input.name.trim(),
    type: input.type,
    created_at: createdAt,
    description: input.description?.trim() ?? "",
    default_source_preferences: input.default_source_preferences ?? [],
    calibration_summary: "",
    strengths: [],
    weaknesses: [],
    next_time_rules: [],
    active: true,
  };
  await saveForecastAgent(profile);
  return profile;
}

export function agentRulesPath(agentId: string): string {
  return path.join(AGENTS_DIR, agentId, "next_time_rules.v1.jsonl");
}
