import { repoPath, writeJsonFile } from "@/lib/pipeline/io";

export type DossierBuildReport = {
  country_code: string;
  modules_attempted: string[];
  modules_generated: string[];
  modules_skipped: string[];
  claims_generated: number;
  claims_with_sources: number;
  claims_rejected: number;
  review_items_created: number;
  missing_data: string[];
  weak_sources: string[];
  next_recommended_sources: string[];
};

export async function writeDossierBuildReport(report: DossierBuildReport): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await writeJsonFile(
    repoPath("data", "reports", "dossier_builds", report.country_code, `${today}.json`),
    report,
  );
}
