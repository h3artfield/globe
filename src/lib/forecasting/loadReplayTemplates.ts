import { readdir } from "node:fs/promises";
import path from "node:path";
import type { ReplayTemplate } from "@/types/forecasting";
import { readJsonFile, repoPath } from "@/lib/pipeline/io";

const REPLAY_TEMPLATES_DIR = repoPath("data", "forecasting", "templates", "replay");

export async function loadReplayTemplates(): Promise<ReplayTemplate[]> {
  const fileNames = await listReplayTemplateFiles();
  const templates: ReplayTemplate[] = [];

  for (const fileName of fileNames) {
    const template = await readJsonFile<ReplayTemplate>(path.join(REPLAY_TEMPLATES_DIR, fileName));
    templates.push(template);
  }

  return templates.sort((left, right) => left.template_id.localeCompare(right.template_id));
}

async function listReplayTemplateFiles(): Promise<string[]> {
  try {
    const entries = await readdir(REPLAY_TEMPLATES_DIR, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

export async function loadReplayTemplate(templateId: string): Promise<ReplayTemplate | null> {
  const templates = await loadReplayTemplates();
  return templates.find((template) => template.template_id === templateId) ?? null;
}
