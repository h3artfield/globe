import type { CountryModule } from "@/types/pipeline";

export function detectModuleMissingData(module: CountryModule): string[] {
  const missing: string[] = [];

  if (module.metrics.length === 0) {
    missing.push(`${module.module}: structured metrics missing`);
  }
  if (module.claims.length === 0) {
    missing.push(`${module.module}: source-linked claims missing`);
  }
  if (module.source_ids.length === 0) {
    missing.push(`${module.module}: sources missing`);
  }

  return missing;
}
