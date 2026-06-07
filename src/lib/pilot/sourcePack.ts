import type { CountryModule, RelationshipModule } from "@/types/pipeline";
import type { SourcePack, SourcePackSource } from "@/types/pilot";
import { buildRelationshipId, normalizeCountryCode } from "@/lib/globe/countryIdMap";
import { pathExists, readJsonFile, readJsonLinesFile, repoPath, writeJsonFile } from "@/lib/pipeline/io";
import { COUNTRY_MODULES, RELATIONSHIP_MODULES } from "@/lib/pipeline/constants";
import type { RagChunk } from "@/types/pipeline";

function sourceType(sourceId: string): SourcePackSource["source_type"] {
  if (sourceId === "wikipedia") return "wikipedia";
  if (sourceId.includes("world_bank") || sourceId.startsWith("un_") || sourceId === "vdem" || sourceId === "wipo") return "international_dataset";
  if (sourceId.includes("manual")) return "manual_note";
  return "unknown" as SourcePackSource["source_type"];
}

function authorityRank(sourceId: string): string {
  if (sourceType(sourceId) === "international_dataset") return "international_dataset";
  if (sourceId === "wikipedia") return "wikipedia";
  return "manual";
}

export async function createCountrySourcePack(countryCodeInput: string): Promise<SourcePack> {
  const countryCode = normalizeCountryCode(countryCodeInput);
  const sources = new Map<string, SourcePackSource>();

  for (const moduleName of COUNTRY_MODULES) {
    const filePath = repoPath("data", "rag", "countries", countryCode, `${moduleName}.v1.json`);
    if (!(await pathExists(filePath))) continue;
    const countryModule = await readJsonFile<CountryModule>(filePath);
    for (const sourceId of countryModule.source_ids) {
      const existing = sources.get(sourceId);
      const covers = Array.from(new Set([...(existing?.covers_modules ?? []), moduleName])).sort();
      sources.set(sourceId, {
        source_id: sourceId,
        source_type: sourceType(sourceId),
        title: sourceId,
        publisher: sourceId,
        url: countryModule.metrics.find((metric) => metric.source_id === sourceId)?.source_url ?? "",
        retrieved_at: countryModule.metrics.find((metric) => metric.source_id === sourceId)?.retrieved_at ?? new Date().toISOString(),
        file_path: countryModule.metrics.find((metric) => metric.source_id === sourceId)?.raw_file_path ?? `/data/rag/countries/${countryCode}/${moduleName}.v1.json`,
        covers_modules: covers,
        authority_rank: authorityRank(sourceId),
        notes: "",
      });
    }
  }
  const chunksPath = repoPath("data", "rag", "countries", countryCode, "chunks.jsonl");
  if (await pathExists(chunksPath)) {
    for (const chunk of await readJsonLinesFile<RagChunk>(chunksPath)) {
      for (const sourceId of chunk.source_ids) {
        const existing = sources.get(sourceId);
        sources.set(sourceId, {
          source_id: sourceId,
          source_type: (chunk.source_family as SourcePackSource["source_type"]) || sourceType(sourceId),
          title: sourceId,
          publisher: sourceId.split(":")[0],
          url: "",
          retrieved_at: new Date().toISOString(),
          file_path: `/data/rag/countries/${countryCode}/chunks.jsonl#${chunk.chunk_id}`,
          covers_modules: Array.from(new Set([...(existing?.covers_modules ?? []), chunk.module])).sort(),
          authority_rank: chunk.authority_rank || authorityRank(sourceId),
          notes: "Chunk-level source record.",
        });
      }
    }
  }

  const pack: SourcePack = {
    source_pack_id: `${countryCode}-source-pack-v1`,
    country_code: countryCode,
    relationship_id: null,
    last_updated: new Date().toISOString().slice(0, 10),
    sources: Array.from(sources.values()).sort((a, b) => a.source_id.localeCompare(b.source_id)),
  };
  await writeJsonFile(repoPath("data", "source_packs", "countries", `${countryCode}.source_pack.v1.json`), pack);
  return pack;
}

export async function createRelationshipSourcePack(relationshipIdInput: string): Promise<SourcePack> {
  const [a, b] = relationshipIdInput.split("_");
  const relationshipId = buildRelationshipId(a, b);
  const sources = new Map<string, SourcePackSource>();
  for (const moduleName of RELATIONSHIP_MODULES) {
    const filePath = repoPath("data", "rag", "relationships", relationshipId, `${moduleName}.v1.json`);
    if (!(await pathExists(filePath))) continue;
    const relationshipModule = await readJsonFile<RelationshipModule>(filePath);
    for (const sourceId of relationshipModule.source_ids) {
      const existing = sources.get(sourceId);
      sources.set(sourceId, {
        source_id: sourceId,
        source_type: sourceType(sourceId),
        title: sourceId,
        publisher: sourceId,
        url: "",
        retrieved_at: new Date().toISOString(),
        file_path: `/data/rag/relationships/${relationshipId}/${moduleName}.v1.json`,
        covers_modules: Array.from(new Set([...(existing?.covers_modules ?? []), moduleName])).sort(),
        authority_rank: authorityRank(sourceId),
        notes: "",
      });
    }
  }
  const chunksPath = repoPath("data", "rag", "relationships", relationshipId, "chunks.jsonl");
  if (await pathExists(chunksPath)) {
    for (const chunk of await readJsonLinesFile<RagChunk>(chunksPath)) {
      for (const sourceId of chunk.source_ids) {
        const existing = sources.get(sourceId);
        sources.set(sourceId, {
          source_id: sourceId,
          source_type: (chunk.source_family as SourcePackSource["source_type"]) || sourceType(sourceId),
          title: sourceId,
          publisher: sourceId.split(":")[0],
          url: "",
          retrieved_at: new Date().toISOString(),
          file_path: `/data/rag/relationships/${relationshipId}/chunks.jsonl#${chunk.chunk_id}`,
          covers_modules: Array.from(new Set([...(existing?.covers_modules ?? []), chunk.module])).sort(),
          authority_rank: chunk.authority_rank || authorityRank(sourceId),
          notes: "Chunk-level source record.",
        });
      }
    }
  }
  const pack: SourcePack = {
    source_pack_id: `${relationshipId}-source-pack-v1`,
    relationship_id: relationshipId,
    last_updated: new Date().toISOString().slice(0, 10),
    sources: Array.from(sources.values()).sort((a, b) => a.source_id.localeCompare(b.source_id)),
  };
  await writeJsonFile(repoPath("data", "source_packs", "relationships", `${relationshipId}.source_pack.v1.json`), pack);
  return pack;
}

export function validateSourcePack(pack: SourcePack): string[] {
  const errors: string[] = [];
  if (!pack.source_pack_id) errors.push("source_pack_id missing");
  for (const source of pack.sources) {
    if (!source.source_id) errors.push("source_id missing");
    if (!source.file_path) errors.push(`${source.source_id}: file_path missing`);
  }
  return errors;
}
