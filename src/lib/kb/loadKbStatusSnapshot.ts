import { listDirectories, pathExists, readJsonFile, repoPath } from "@/lib/pipeline/io";

const STATIC_FALLBACK = {
  countriesTracked: 12,
  relationshipsTracked: 8,
  averageCountryReadiness: 0.22,
  averageRelationshipReadiness: 0.12,
  queueItemsNeeded: 84,
  sharedDatasetsNeeded: 4,
  topCountries: [
    { id: "USA", readiness: 0.38 },
    { id: "CHN", readiness: 0.38 },
  ],
  topRelationships: [
    { id: "IND_PAK", readiness: 0.19 },
    { id: "RUS_TUR", readiness: 0.19 },
    { id: "RUS_UKR", readiness: 0.19 },
  ],
  lowestRelationships: [{ id: "IRN_SAU", readiness: 0 }],
  batch1ImportedCount: 10,
  batch1TotalCount: 11,
};

type MatrixSummary = {
  countries_tracked: number;
  relationships_tracked: number;
  average_country_readiness: number;
  average_relationship_readiness: number;
  queue_items_needed: number;
  shared_datasets_needed: number;
};

type MatrixTarget = {
  readiness_score: number;
};

type CompletionMatrix = {
  generated_at?: string;
  summary: MatrixSummary;
  countries: Record<string, MatrixTarget>;
  relationships: Record<string, MatrixTarget>;
};

type QueueItem = {
  queue_id: string;
  shared_source_id?: string;
  collection_status: string;
  source_title?: string;
};

type CompletionQueue = {
  items: QueueItem[];
};

type BatchManifest = {
  collection_pipeline?: {
    implemented_transformers?: string[];
    collection_blocked?: Record<string, string>;
  };
  recommended_download_order?: Array<{
    order: number;
    queue_id: string;
    rationale: string;
  }>;
};

export type KbStatusSnapshot = {
  loadedFromDisk: boolean;
  generatedAt?: string;
  summary: {
    countriesTracked: number;
    relationshipsTracked: number;
    averageCountryReadiness: number;
    averageRelationshipReadiness: number;
    queueItemsNeeded: number;
    sharedDatasetsNeeded: number;
  };
  topCountries: Array<{ id: string; readiness: number }>;
  topRelationships: Array<{ id: string; readiness: number }>;
  lowestRelationships: Array<{ id: string; readiness: number }>;
  batch1: {
    importedCount: number;
    totalCount: number;
    blockedSources: Array<{ id: string; reason: string }>;
    implementedTransformers: string[];
  };
  sharedQueue: Array<{
    queueId: string;
    sharedSourceId?: string;
    status: string;
    title?: string;
  }>;
  nextCollectionPriorities: Array<{
    queueId: string;
    rationale: string;
  }>;
  ragArtifactCounts: {
    countryDirs: number;
    relationshipDirs: number;
  };
};

function sortByReadinessDesc(entries: Array<[string, MatrixTarget]>): Array<{ id: string; readiness: number }> {
  return entries
    .map(([id, target]) => ({ id, readiness: target.readiness_score }))
    .sort((left, right) => right.readiness - left.readiness);
}

function sortByReadinessAsc(entries: Array<[string, MatrixTarget]>): Array<{ id: string; readiness: number }> {
  return entries
    .map(([id, target]) => ({ id, readiness: target.readiness_score }))
    .sort((left, right) => left.readiness - right.readiness);
}

export async function loadKbStatusSnapshot(): Promise<KbStatusSnapshot> {
  const matrixPath = repoPath("data/reports/kb_completion_matrix.v1.json");
  const queuePath = repoPath("data/source_requests/kb_completion_queue.v1.json");
  const manifestPath = repoPath("data/source_requests/batch_1_shared_datasets_manifest.v1.json");

  const [hasMatrix, hasQueue, hasManifest, countryDirs, relationshipDirs] = await Promise.all([
    pathExists(matrixPath),
    pathExists(queuePath),
    pathExists(manifestPath),
    listDirectories(repoPath("data/rag/countries")),
    listDirectories(repoPath("data/rag/relationships")),
  ]);

  const loadedFromDisk = hasMatrix || hasQueue || hasManifest;

  let generatedAt: string | undefined;
  let summary = {
    countriesTracked: STATIC_FALLBACK.countriesTracked,
    relationshipsTracked: STATIC_FALLBACK.relationshipsTracked,
    averageCountryReadiness: STATIC_FALLBACK.averageCountryReadiness,
    averageRelationshipReadiness: STATIC_FALLBACK.averageRelationshipReadiness,
    queueItemsNeeded: STATIC_FALLBACK.queueItemsNeeded,
    sharedDatasetsNeeded: STATIC_FALLBACK.sharedDatasetsNeeded,
  };
  let topCountries = STATIC_FALLBACK.topCountries;
  let topRelationships = STATIC_FALLBACK.topRelationships;
  let lowestRelationships = STATIC_FALLBACK.lowestRelationships;

  if (hasMatrix) {
    const matrix = await readJsonFile<CompletionMatrix>(matrixPath);
    generatedAt = matrix.generated_at;
    summary = {
      countriesTracked: matrix.summary.countries_tracked,
      relationshipsTracked: matrix.summary.relationships_tracked,
      averageCountryReadiness: matrix.summary.average_country_readiness,
      averageRelationshipReadiness: matrix.summary.average_relationship_readiness,
      queueItemsNeeded: matrix.summary.queue_items_needed,
      sharedDatasetsNeeded: matrix.summary.shared_datasets_needed,
    };
    const countryEntries = Object.entries(matrix.countries);
    const relationshipEntries = Object.entries(matrix.relationships);
    topCountries = sortByReadinessDesc(countryEntries).slice(0, 3);
    topRelationships = sortByReadinessDesc(relationshipEntries).slice(0, 3);
    lowestRelationships = sortByReadinessAsc(relationshipEntries).slice(0, 3);
  }

  let sharedQueue: KbStatusSnapshot["sharedQueue"] = [];
  let batch1ImportedCount = STATIC_FALLBACK.batch1ImportedCount;

  if (hasQueue) {
    const queue = await readJsonFile<CompletionQueue>(queuePath);
    sharedQueue = queue.items
      .filter((item) => item.shared_source_id)
      .map((item) => ({
        queueId: item.queue_id,
        sharedSourceId: item.shared_source_id,
        status: item.collection_status,
        title: item.source_title,
      }))
      .sort((left, right) => left.queueId.localeCompare(right.queueId));
    batch1ImportedCount = sharedQueue.filter((item) => item.status === "imported").length;
  }

  let implementedTransformers: string[] = [];
  let blockedSources: Array<{ id: string; reason: string }> = [];
  let nextCollectionPriorities: KbStatusSnapshot["nextCollectionPriorities"] = [
    {
      queueId: "shared-acled_events",
      rationale: "ACLED export access blocked by current account level; transformer exists.",
    },
    {
      queueId: "shared-treaties_manual",
      rationale: "Manual treaty and alliance curation for diplomatic and alliance modules.",
    },
    {
      queueId: "shared-sanctions_manual",
      rationale: "Manual sanctions coverage for relationship pressure and compliance modules.",
    },
    {
      queueId: "shared-un_voting_alignment",
      rationale: "UN General Assembly voting alignment for bilateral diplomatic similarity.",
    },
  ];

  if (hasManifest) {
    const manifest = await readJsonFile<BatchManifest>(manifestPath);
    implementedTransformers = manifest.collection_pipeline?.implemented_transformers ?? [];
    blockedSources = Object.entries(manifest.collection_pipeline?.collection_blocked ?? {}).map(
      ([id, reason]) => ({ id, reason }),
    );
    if (manifest.recommended_download_order?.length) {
      nextCollectionPriorities = manifest.recommended_download_order
        .slice(0, 6)
        .map((entry) => ({
          queueId: entry.queue_id,
          rationale: entry.rationale,
        }));
    }
  }

  const batch1TotalCount = implementedTransformers.length || STATIC_FALLBACK.batch1TotalCount;

  return {
    loadedFromDisk,
    generatedAt,
    summary,
    topCountries,
    topRelationships,
    lowestRelationships,
    batch1: {
      importedCount: batch1ImportedCount,
      totalCount: batch1TotalCount,
      blockedSources,
      implementedTransformers,
    },
    sharedQueue,
    nextCollectionPriorities,
    ragArtifactCounts: {
      countryDirs: countryDirs.length,
      relationshipDirs: relationshipDirs.length,
    },
  };
}
