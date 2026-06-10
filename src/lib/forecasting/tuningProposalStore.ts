import path from "node:path";
import { randomBytes } from "node:crypto";
import type { ForecastStrategyTuningProposal } from "@/types/forecasting";
import { pathExists, readJsonFile, repoPath, writeJsonFile } from "@/lib/pipeline/io";

function proposalPath(agentId: string, proposalId: string): string {
  return path.join(
    repoPath("data", "forecasting", "agents", agentId, "tuning_proposals"),
    `${proposalId}.v1.json`,
  );
}

export function createTuningProposalId(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = randomBytes(3).toString("hex");
  return `tuning_proposal_${stamp}_${suffix}`;
}

export async function saveTuningProposal(
  proposal: ForecastStrategyTuningProposal,
): Promise<void> {
  await writeJsonFile(proposalPath(proposal.agent_id, proposal.proposal_id), proposal);
}

export async function loadTuningProposal(
  agentId: string,
  proposalId: string,
): Promise<ForecastStrategyTuningProposal | null> {
  const filePath = proposalPath(agentId, proposalId);
  if (!(await pathExists(filePath))) {
    return null;
  }
  return readJsonFile<ForecastStrategyTuningProposal>(filePath);
}

export async function listTuningProposalsForTournament(
  tournamentId: string,
): Promise<ForecastStrategyTuningProposal[]> {
  const { readdir } = await import("node:fs/promises");
  const agentsDir = repoPath("data", "forecasting", "agents");
  let agentDirs: string[] = [];
  try {
    agentDirs = await readdir(agentsDir, { withFileTypes: true }).then((items) =>
      items.filter((item) => item.isDirectory()).map((item) => item.name),
    );
  } catch {
    return [];
  }

  const proposals: ForecastStrategyTuningProposal[] = [];
  for (const agentId of agentDirs) {
    const proposalsDir = path.join(agentsDir, agentId, "tuning_proposals");
    let files: string[] = [];
    try {
      files = await readdir(proposalsDir);
    } catch {
      continue;
    }
    for (const fileName of files) {
      if (!fileName.endsWith(".v1.json")) {
        continue;
      }
      const proposalId = fileName.replace(/\.v1\.json$/, "");
      const proposal = await loadTuningProposal(agentId, proposalId);
      if (proposal && proposal.tournament_id === tournamentId) {
        proposals.push(proposal);
      }
    }
  }
  return proposals.sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export async function listTuningProposalsForAgent(
  agentId: string,
): Promise<ForecastStrategyTuningProposal[]> {
  const { readdir } = await import("node:fs/promises");
  const proposalsDir = path.join(
    repoPath("data", "forecasting", "agents", agentId, "tuning_proposals"),
  );
  let files: string[] = [];
  try {
    files = await readdir(proposalsDir);
  } catch {
    return [];
  }
  const proposals: ForecastStrategyTuningProposal[] = [];
  for (const fileName of files) {
    if (!fileName.endsWith(".v1.json")) {
      continue;
    }
    const proposalId = fileName.replace(/\.v1\.json$/, "");
    const proposal = await loadTuningProposal(agentId, proposalId);
    if (proposal) {
      proposals.push(proposal);
    }
  }
  return proposals.sort((left, right) => right.created_at.localeCompare(left.created_at));
}
