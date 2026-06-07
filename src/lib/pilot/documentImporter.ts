import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { RagChunk } from "@/types/pipeline";
import { buildRelationshipId, normalizeCountryCode } from "@/lib/globe/countryIdMap";
import { pathExists, readJsonLinesFile, repoPath, writeJsonLinesFile } from "@/lib/pipeline/io";

const SUPPORTED = new Set([".txt", ".md", ".html", ".htm", ".csv", ".json", ".pdf"]);

async function extractText(filePath: string): Promise<string> {
  const extension = path.extname(filePath).toLowerCase();
  const raw = await readFile(filePath, extension === ".pdf" ? undefined : "utf8");
  const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : raw;
  if (extension === ".html" || extension === ".htm") return text.replace(/<[^>]+>/g, " ");
  if (extension === ".json") return JSON.stringify(JSON.parse(text), null, 2);
  return text;
}

function chunkText(text: string, size = 1200): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  for (let index = 0; index < normalized.length; index += size) chunks.push(normalized.slice(index, index + size));
  return chunks;
}

async function importFiles(input: {
  scopeId: string;
  sourceDir: string;
  chunksPath: string;
  relationship: boolean;
}): Promise<number> {
  const files = (await readdir(input.sourceDir).catch(() => []))
    .filter((file) => SUPPORTED.has(path.extname(file).toLowerCase()))
    .sort();
  const existing = (await pathExists(input.chunksPath)) ? await readJsonLinesFile<RagChunk>(input.chunksPath) : [];
  const importedChunks: RagChunk[] = [];

  for (const file of files) {
    const filePath = path.join(input.sourceDir, file);
    const textChunks = chunkText(await extractText(filePath));
    textChunks.forEach((text, index) => {
      const chunkId = `${input.scopeId}-manual_doc-${path.basename(file).replace(/[^a-zA-Z0-9]+/g, "_")}-${index + 1}`;
      importedChunks.push({
        chunk_id: chunkId,
        country_code: input.relationship ? null : input.scopeId,
        relationship_id: input.relationship ? input.scopeId : null,
        module: "manual_source_documents",
        text,
        tags: input.relationship ? ["relationship-manual-source"] : ["country-manual-source"],
        source_ids: [`manual_doc:${file}`],
        source_family: "manual_note",
        authority_rank: "manual",
        can_override_official_data: false,
        retrieval_priority: 6,
        metric_ids: [],
        claim_type: "fact",
        year_range: null,
        freshness: "unknown",
        confidence: "unknown",
        review_status: "human_review_pending",
      });
    });
  }

  const filtered = existing.filter((chunk) => !chunk.chunk_id.includes("-manual_doc-"));
  await writeJsonLinesFile(input.chunksPath, [...filtered, ...importedChunks]);
  return importedChunks.length;
}

export async function importCountryDocuments(countryCodeInput: string): Promise<number> {
  const countryCode = normalizeCountryCode(countryCodeInput);
  return importFiles({
    scopeId: countryCode,
    sourceDir: repoPath("data", "manual_sources", "countries", countryCode),
    chunksPath: repoPath("data", "rag", "countries", countryCode, "chunks.jsonl"),
    relationship: false,
  });
}

export async function importRelationshipDocuments(relationshipIdInput: string): Promise<number> {
  const [a, b] = relationshipIdInput.split("_");
  const relationshipId = buildRelationshipId(a, b);
  return importFiles({
    scopeId: relationshipId,
    sourceDir: repoPath("data", "manual_sources", "relationships", relationshipId),
    chunksPath: repoPath("data", "rag", "relationships", relationshipId, "chunks.jsonl"),
    relationship: true,
  });
}
