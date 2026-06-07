import type { CountryModule, RelationshipModule } from "@/types/pipeline";
import type { EnhancedSourceRequest, ModuleSourceGap, SourceGapReport, SourcePack, SourceRequirementsFile } from "@/types/pilot";
import { buildRelationshipId, normalizeCountryCode } from "@/lib/globe/countryIdMap";
import { pathExists, readJsonFile, repoPath, writeJsonFile } from "@/lib/pipeline/io";

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function recommendationFor(module: string, missingTypes: string[]): string {
  if (module === "leader_dossiers") return "Add current official biographies, congressional/executive records, and major profile sources.";
  if (module.includes("event") || module.includes("news")) return "Add verified event timelines from official statements, major news timelines, and institutional reports.";
  if (module.includes("allies")) return "Add treaty texts, defense agreements, basing records, UN voting, and diplomatic statements.";
  if (module.includes("adversar") || module.includes("threat")) return "Add sanctions records, defense strategy documents, official threat statements, and public opinion sources.";
  return `Add missing source types: ${missingTypes.join(", ") || "source-backed evidence"}.`;
}

async function loadCountryModule(countryCode: string, moduleName: string): Promise<CountryModule | null> {
  const file = repoPath("data", "rag", "countries", countryCode, `${moduleName}.v1.json`);
  return (await pathExists(file)) ? readJsonFile<CountryModule>(file) : null;
}

async function loadRelationshipModule(relationshipId: string, moduleName: string): Promise<RelationshipModule | null> {
  const file = repoPath("data", "rag", "relationships", relationshipId, `${moduleName}.v1.json`);
  return (await pathExists(file)) ? readJsonFile<RelationshipModule>(file) : null;
}

export async function buildCountrySourceGapReport(countryCodeInput: string): Promise<SourceGapReport> {
  const countryCode = normalizeCountryCode(countryCodeInput);
  const requirements = await readJsonFile<SourceRequirementsFile>(repoPath("data", "source_requirements", "countries", `${countryCode}.source_requirements.v1.json`));
  const sourcePack = await readJsonFile<SourcePack>(repoPath("data", "source_packs", "countries", `${countryCode}.source_pack.v1.json`));
  const gaps: ModuleSourceGap[] = [];
  for (const requirement of requirements.modules) {
    const countryModule = await loadCountryModule(countryCode, requirement.module);
    const sources = sourcePack.sources.filter((source) => source.covers_modules.includes(requirement.module));
    const sourceTypes = new Set(sources.map((source) => source.source_type));
    const claimTypes = new Set<string>((countryModule?.claims ?? []).map((claim) => claim.claim_type));
    const missingSourceTypes = requirement.required_source_types.filter((type) => !sourceTypes.has(type));
    const missingClaimTypes = requirement.required_claim_types.filter((type) => !claimTypes.has(type));
    const sourceScore = clamp(sources.length / requirement.minimum_sources);
    const typeScore = requirement.required_source_types.length === 0 ? 1 : clamp((requirement.required_source_types.length - missingSourceTypes.length) / requirement.required_source_types.length);
    const claimScore = clamp((countryModule?.claims.length ?? 0) / requirement.minimum_claim_count);
    const metricScore = requirement.minimum_metric_count === 0 ? 1 : clamp((countryModule?.metrics.length ?? 0) / requirement.minimum_metric_count);
    const readiness = Number(((sourceScore + typeScore + claimScore + metricScore) / 4).toFixed(2));
    gaps.push({
      module: requirement.module,
      readiness,
      sources_available: sources.length,
      sources_required: requirement.minimum_sources,
      missing_source_types: missingSourceTypes,
      missing_claim_types: missingClaimTypes,
      recommendation: recommendationFor(requirement.module, missingSourceTypes),
    });
  }
  const report: SourceGapReport = {
    target_id: countryCode,
    target_type: "country",
    overall_source_readiness: Number((gaps.reduce((sum, gap) => sum + gap.readiness, 0) / Math.max(1, gaps.length)).toFixed(2)),
    modules: gaps,
  };
  await writeJsonFile(repoPath("data", "reports", "source_gaps", "countries", `${countryCode}.source_gaps.v1.json`), report);
  return report;
}

export async function buildRelationshipSourceGapReport(relationshipIdInput: string): Promise<SourceGapReport> {
  const [a, b] = relationshipIdInput.split("_");
  const relationshipId = buildRelationshipId(a, b);
  const requirements = await readJsonFile<SourceRequirementsFile>(repoPath("data", "source_requirements", "relationships", `${relationshipId}.source_requirements.v1.json`));
  const sourcePack = await readJsonFile<SourcePack>(repoPath("data", "source_packs", "relationships", `${relationshipId}.source_pack.v1.json`));
  const gaps: ModuleSourceGap[] = [];
  for (const requirement of requirements.modules) {
    const relationshipModule = await loadRelationshipModule(relationshipId, requirement.module);
    const sources = sourcePack.sources.filter((source) => source.covers_modules.includes(requirement.module));
    const sourceTypes = new Set(sources.map((source) => source.source_type));
    const claimTypes = new Set<string>((relationshipModule?.claims ?? []).map((claim) => claim.claim_type));
    const missingSourceTypes = requirement.required_source_types.filter((type) => !sourceTypes.has(type));
    const missingClaimTypes = requirement.required_claim_types.filter((type) => !claimTypes.has(type));
    const readiness = Number(((clamp(sources.length / requirement.minimum_sources) + clamp((requirement.required_source_types.length - missingSourceTypes.length) / requirement.required_source_types.length) + clamp((relationshipModule?.claims.length ?? 0) / requirement.minimum_claim_count)) / 3).toFixed(2));
    gaps.push({
      module: requirement.module,
      readiness,
      sources_available: sources.length,
      sources_required: requirement.minimum_sources,
      missing_source_types: missingSourceTypes,
      missing_claim_types: missingClaimTypes,
      recommendation: recommendationFor(requirement.module, missingSourceTypes),
    });
  }
  const report: SourceGapReport = {
    target_id: relationshipId,
    target_type: "relationship",
    overall_source_readiness: Number((gaps.reduce((sum, gap) => sum + gap.readiness, 0) / Math.max(1, gaps.length)).toFixed(2)),
    modules: gaps,
  };
  await writeJsonFile(repoPath("data", "reports", "source_gaps", "relationships", `${relationshipId}.source_gaps.v1.json`), report);
  return report;
}

export function sourceRequestsFromGaps(report: SourceGapReport): EnhancedSourceRequest[] {
  return report.modules
    .filter((gap) => gap.readiness < 0.75)
    .map((gap, index) => ({
      request_id: `${report.target_id}-${gap.module}-${String(index + 1).padStart(3, "0")}`,
      country_code: report.target_type === "country" ? report.target_id : undefined,
      relationship_id: report.target_type === "relationship" ? report.target_id : undefined,
      module: gap.module,
      priority: gap.readiness < 0.35 ? "high" : "medium",
      missing_questions: [`What source-backed evidence is missing for ${gap.module}?`],
      missing_source_types: gap.missing_source_types,
      suggested_source_types: gap.missing_source_types.length ? gap.missing_source_types : ["official_primary", "major_news", "academic"],
      suggested_search_queries: report.target_type === "relationship"
        ? [
            `${report.target_id} ${gap.module} official statements timeline`,
            "GERD dispute Egypt Ethiopia African Union negotiations timeline",
            "Egypt Ethiopia Nile dam red lines official statements",
          ]
        : [
            `${report.target_id} ${gap.module} official source`,
            `${report.target_id} ${gap.module} major news profile`,
            `${report.target_id} ${gap.module} think tank report`,
          ],
      suggested_document_types: ["official statement", "institutional report", "major news timeline", "academic paper"],
      why_it_matters: gap.recommendation,
      status: "open",
    }));
}
