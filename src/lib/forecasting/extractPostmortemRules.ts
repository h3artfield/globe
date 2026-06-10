import { appendFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { ReplayNextTimeRule, ReplayPostmortem, ReplaySession } from "@/types/forecasting";
import { agentRulesPath } from "@/lib/forecasting/forecastAgentStore";
import { pathExists, repoPath } from "@/lib/pipeline/io";

const GLOBAL_RULES_PATH = repoPath("data", "forecasting", "judges", "rules.v1.jsonl");

export function stableRuleId(sessionId: string, ruleText: string): string {
  const hash = createHash("sha256")
    .update(`${sessionId}:${ruleText}`)
    .digest("hex")
    .slice(0, 12);
  return `rule_${hash}`;
}

async function loadExistingRuleIds(session: ReplaySession): Promise<Set<string>> {
  const ids = new Set(session.postmortem_rule_ids);
  const paths = [GLOBAL_RULES_PATH];
  if (session.agent_id) {
    paths.push(agentRulesPath(session.agent_id));
  }
  for (const filePath of paths) {
    if (!(await pathExists(filePath))) {
      continue;
    }
    const content = await readFile(filePath, "utf8");
    for (const line of content.split("\n")) {
      if (!line.trim()) {
        continue;
      }
      try {
        const rule = JSON.parse(line) as ReplayNextTimeRule;
        if (rule.session_id === session.session_id) {
          ids.add(rule.rule_id);
        }
      } catch {
        // skip malformed lines
      }
    }
  }
  return ids;
}

function sourceFamilyFromTemplate(templateId: string, allowedSourceIds: string[]): string {
  if (allowedSourceIds.length === 1) {
    return allowedSourceIds[0] ?? templateId;
  }
  return allowedSourceIds.join("+") || templateId;
}

function mistakeTypeFromPostmortem(postmortem: ReplayPostmortem): string {
  if (postmortem.what_went_wrong.some((item) => item.includes("direction"))) {
    return "direction_error";
  }
  if (postmortem.missed_signals.some((item) => item.includes("Missing"))) {
    return "missing_evidence";
  }
  if (postmortem.source_limitations.length > 0) {
    return "source_limitation";
  }
  return "calibration";
}

function templateSpecificRules(session: ReplaySession): string[] {
  const rules: string[] = [];
  if (session.template_id === "unodc_homicide_rate_direction") {
    rules.push(
      "When homicide baseline data is missing, request UNODC country-year data before locking.",
    );
  }
  if (session.template_id === "trade_bilateral_level") {
    rules.push(
      "For bilateral trade questions, compare at least two prior years, not only the baseline year.",
    );
  }
  if (session.template_id === "wvs_social_trust_direction") {
    rules.push(
      "If resolution depends on WVS wave timing, flag low confidence unless wave-year alignment exists.",
    );
  }
  return rules;
}

export async function extractPostmortemRules(
  session: ReplaySession,
  postmortem: ReplayPostmortem,
): Promise<ReplayNextTimeRule[]> {
  const agentId = session.agent_id ?? "unassigned";
  const sourceFamily = sourceFamilyFromTemplate(session.template_id, session.allowed_source_ids);
  const mistakeType = mistakeTypeFromPostmortem(postmortem);
  const createdAt = new Date().toISOString();

  const ruleTexts = [
    ...new Set([...postmortem.next_time_rules, ...templateSpecificRules(session)]),
  ];

  const existingRuleIds = await loadExistingRuleIds(session);
  const rules: ReplayNextTimeRule[] = [];

  for (const ruleText of ruleTexts) {
    const ruleId = stableRuleId(session.session_id, ruleText);
    if (existingRuleIds.has(ruleId)) {
      continue;
    }
    rules.push({
      rule_id: ruleId,
      agent_id: agentId,
      session_id: session.session_id,
      template_id: session.template_id,
      source_family: sourceFamily,
      mistake_type: mistakeType,
      rule_text: ruleText,
      created_at: createdAt,
    });
  }

  for (const rule of rules) {
    const line = `${JSON.stringify(rule)}\n`;
    await appendFile(GLOBAL_RULES_PATH, line, { encoding: "utf8" });
    if (session.agent_id) {
      await appendFile(agentRulesPath(session.agent_id), line, { encoding: "utf8" });
    }
  }

  return rules;
}
