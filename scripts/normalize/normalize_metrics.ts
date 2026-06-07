import type { ProcessedMetricsFile } from "@/lib/pipeline/metrics";
import { MVP_COUNTRIES } from "@/lib/pipeline/constants";
import { readJsonFile, repoPath } from "@/lib/pipeline/io";
import { validateMetric } from "@/lib/pipeline/validation";

async function main() {
  const errors: string[] = [];

  for (const countryCode of MVP_COUNTRIES) {
    const processed = await readJsonFile<ProcessedMetricsFile>(
      repoPath("data", "processed", "countries", countryCode, "metrics.v1.json"),
    );

    for (const metric of processed.metrics) {
      errors.push(...validateMetric(metric, `${countryCode}/metrics.v1.json`).errors);
    }
  }

  if (errors.length > 0) {
    errors.forEach((error) => console.error(error));
    process.exit(1);
  }

  console.log("Processed metric files are normalized and metadata-complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
