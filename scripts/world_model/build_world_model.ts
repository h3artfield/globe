import { buildRelationshipId } from "@/lib/globe/countryIdMap";
import { MVP_COUNTRIES, MVP_RELATIONSHIP_PAIRS } from "@/lib/pipeline/constants";
import { buildCountryChunk, buildRelationshipChunk } from "@/lib/pipeline/chunks";
import { readJsonLinesFile, repoPath, writeJsonFile, writeJsonLinesFile, pathExists } from "@/lib/pipeline/io";
import { buildReviewQueueItem, loadCountryReviewQueue } from "@/lib/pipeline/reviewQueue";
import {
  buildEmptyRelationshipGraph,
  emptyCountryWorldModule,
  emptyRelationshipWorldModule,
  WORLD_MODEL_COUNTRY_MODULES,
  WORLD_MODEL_RELATIONSHIP_MODULES,
} from "@/lib/worldModel/defaults";
import type { RagChunk, ReviewQueueItem } from "@/types/pipeline";

function countryEventTimeline(countryCode: string) {
  return {
    country_code: countryCode,
    version: "1.0",
    last_updated: new Date().toISOString().slice(0, 10),
    events: [],
    coverage: {
      status: "pending_review",
      warning: "No verified national event source has been ingested yet.",
    },
  };
}

function topEvents(countryCode: string) {
  return {
    country_code: countryCode,
    period: "2006-2026",
    years: Array.from({ length: 21 }, (_, index) => ({
      year: 2006 + index,
      domestic_events: [],
      foreign_policy_events: [],
      economic_events: [],
      security_events: [],
      cultural_social_events: [],
    })),
    coverage: {
      status: "pending_review",
      warning: "Top events are not generated until verified event/news data is available.",
    },
  };
}

function yearlySummaries(countryCode: string) {
  return {
    country_code: countryCode,
    period: "2006-2026",
    years: Array.from({ length: 21 }, (_, index) => ({
      year: 2006 + index,
      summary: "",
      top_events: [],
      dominant_themes: [],
      regime_impact: "",
      economic_impact: "",
      social_impact: "",
      foreign_policy_impact: "",
    })),
  };
}

function countryWorldModulePayload(countryCode: string, moduleName: string) {
  const base = emptyCountryWorldModule(countryCode, moduleName);

  if (moduleName === "allies_and_partners") {
    return {
      ...base,
      formal_alliances: [],
      security_partners: [],
      economic_partners: [],
      patron_client_relationships: [],
      military_base_relationships: [],
      intelligence_partners: [],
      diplomatic_supporters: [],
      trade_dependency_partners: [],
      top_allies_ranked: [],
    };
  }

  if (moduleName === "adversaries_and_rivals") {
    return {
      ...base,
      declared_adversaries: [],
      strategic_rivals: [],
      military_opponents: [],
      sanctions_targets: [],
      historical_enemies: [],
      proxy_conflict_opponents: [],
      border_dispute_opponents: [],
      public_opinion_adversaries: [],
      regime_narrative_enemies: [],
      top_adversaries_ranked: [],
    };
  }

  return base;
}

function relationshipEvents(relationshipId: string) {
  return {
    relationship_id: relationshipId,
    countries: relationshipId.split("_"),
    version: "1.0",
    last_updated: new Date().toISOString().slice(0, 10),
    events: [],
    coverage: {
      status: "pending_review",
      warning: "No verified relationship event source has been ingested yet.",
    },
  };
}

async function appendCountryChunks(countryCode: string, chunks: RagChunk[]) {
  const chunksPath = repoPath("data", "rag", "countries", countryCode, "chunks.jsonl");
  const existing = (await pathExists(chunksPath)) ? await readJsonLinesFile<RagChunk>(chunksPath) : [];
  const filtered = existing.filter(
    (chunk) => !WORLD_MODEL_COUNTRY_MODULES.includes(chunk.module as (typeof WORLD_MODEL_COUNTRY_MODULES)[number]),
  );
  await writeJsonLinesFile(chunksPath, [...filtered, ...chunks]);
}

async function appendRelationshipChunks(relationshipId: string, chunks: RagChunk[]) {
  const chunksPath = repoPath("data", "rag", "relationships", relationshipId, "chunks.jsonl");
  const existing = (await pathExists(chunksPath)) ? await readJsonLinesFile<RagChunk>(chunksPath) : [];
  const filtered = existing.filter(
    (chunk) =>
      !WORLD_MODEL_RELATIONSHIP_MODULES.includes(
        chunk.module as (typeof WORLD_MODEL_RELATIONSHIP_MODULES)[number],
      ),
  );
  await writeJsonLinesFile(chunksPath, [...filtered, ...chunks]);
}

async function main() {
  for (const countryCode of MVP_COUNTRIES) {
    const eventDirectory = repoPath("data", "world_model", "events", "countries", countryCode);
    await writeJsonFile(`${eventDirectory}/national_event_timeline.v1.json`, countryEventTimeline(countryCode));
    await writeJsonFile(`${eventDirectory}/top_events_20_years.v1.json`, topEvents(countryCode));
    await writeJsonFile(`${eventDirectory}/yearly_event_summaries.v1.json`, yearlySummaries(countryCode));

    const countryDirectory = repoPath("data", "rag", "countries", countryCode);
    const chunks: RagChunk[] = [];
    const reviewItems: ReviewQueueItem[] = await loadCountryReviewQueue(countryCode);

    for (const [index, moduleName] of WORLD_MODEL_COUNTRY_MODULES.entries()) {
      const countryModule = countryWorldModulePayload(countryCode, moduleName);
      await writeJsonFile(`${countryDirectory}/${moduleName}.v1.json`, countryModule);
      chunks.push(buildCountryChunk(countryModule, 900 + index));
      reviewItems.push(buildReviewQueueItem(countryCode, moduleName, 900 + index));
    }

    const wikipediaBaseline = {
      ...emptyCountryWorldModule(countryCode, "wikipedia_baseline"),
      page_title: "",
      page_url: "",
      revision_id: null,
      retrieved_at: null,
      license: "CC BY-SA",
      attribution: "Wikipedia contributors",
      source_family: "wikipedia",
      claim_type: "baseline_summary",
      authority_rank: "secondary_tertiary",
      can_override_official_data: false,
      sections: {},
      source_ids: ["wikipedia"],
    };
    const wikipediaReferences = {
      ...emptyCountryWorldModule(countryCode, "wikipedia_references"),
      page_title: "",
      page_url: "",
      revision_id: null,
      retrieved_at: null,
      cited_external_references: [],
      important_linked_pages: [],
      source_ids: ["wikipedia"],
    };
    await writeJsonFile(`${countryDirectory}/wikipedia_baseline.v1.json`, wikipediaBaseline);
    await writeJsonFile(`${countryDirectory}/wikipedia_references.v1.json`, wikipediaReferences);
    chunks.push({
      ...buildCountryChunk(wikipediaBaseline, 980),
      tags: ["country-wikipedia-baseline"],
      claim_type: "baseline_summary",
      source_ids: ["wikipedia"],
      source_family: "wikipedia",
      authority_rank: "secondary_tertiary",
      can_override_official_data: false,
      retrieval_priority: 5,
    });
    chunks.push(buildCountryChunk(wikipediaReferences, 981));

    await writeJsonFile(repoPath("data", "review_queue", "countries", `${countryCode}.json`), {
      country_code: countryCode,
      generated_at: new Date().toISOString(),
      items: reviewItems,
    });
    await appendCountryChunks(countryCode, chunks);
  }

  for (const pair of MVP_RELATIONSHIP_PAIRS) {
    const relationshipId = buildRelationshipId(pair[0], pair[1]);
    const eventDirectory = repoPath("data", "world_model", "events", "relationships", relationshipId);
    await writeJsonFile(`${eventDirectory}/relationship_event_timeline.v1.json`, relationshipEvents(relationshipId));
    await writeJsonFile(`${eventDirectory}/top_relationship_events_20_years.v1.json`, relationshipEvents(relationshipId));

    const relationshipDirectory = repoPath("data", "rag", "relationships", relationshipId);
    const chunks = [];
    for (const [index, moduleName] of WORLD_MODEL_RELATIONSHIP_MODULES.entries()) {
      const relationshipModule = emptyRelationshipWorldModule(relationshipId, moduleName);
      await writeJsonFile(`${relationshipDirectory}/${moduleName}.v1.json`, relationshipModule);
      chunks.push(buildRelationshipChunk(relationshipModule, 900 + index));
    }
    await appendRelationshipChunks(relationshipId, chunks);
  }

  const graph = buildEmptyRelationshipGraph();
  const graphNames = [
    "country_relationship_graph",
    "alliance_graph",
    "adversary_graph",
    "trade_dependency_graph",
    "military_dependency_graph",
    "sanctions_graph",
    "conflict_graph",
  ];
  for (const graphName of graphNames) {
    await writeJsonFile(repoPath("data", "world_model", "graphs", `${graphName}.v1.json`), graph);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
