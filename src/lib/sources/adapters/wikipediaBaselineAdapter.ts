import { writeFile } from "node:fs/promises";
import path from "node:path";
import { MVP_COUNTRIES } from "@/lib/pipeline/constants";
import { ensureDirectory, repoPath, writeJsonFile } from "@/lib/pipeline/io";
import type { SourceAdapter } from "../SourceAdapter";

const COUNTRY_TITLES: Record<string, string> = {
  USA: "United States",
  CHN: "China",
  RUS: "Russia",
  UKR: "Ukraine",
  EGY: "Egypt",
  ETH: "Ethiopia",
  IND: "India",
  PAK: "Pakistan",
  ISR: "Israel",
  IRN: "Iran",
  SAU: "Saudi Arabia",
  TUR: "Turkey",
};

type WikipediaSummary = {
  title: string;
  extract?: string;
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
};

export class WikipediaBaselineAdapter implements SourceAdapter {
  sourceId = "wikipedia";

  async fetchRaw(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const rawDirectory = repoPath("data", "raw", "wikipedia", today);
    await ensureDirectory(rawDirectory);

    for (const countryCode of MVP_COUNTRIES) {
      const title = COUNTRY_TITLES[countryCode] ?? countryCode;
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "country-rag-globe/1.0 (baseline topic discovery)",
        },
      });
      const payload = response.ok
        ? ((await response.json()) as WikipediaSummary)
        : { title, extract: "", content_urls: { desktop: { page: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}` } } };

      await writeFile(
        path.join(rawDirectory, `${countryCode}.summary.raw.json`),
        `${JSON.stringify({ source_id: this.sourceId, retrieved_at: new Date().toISOString(), url, payload }, null, 2)}\n`,
        "utf8",
      );
    }
  }

  async normalize(): Promise<void> {
    const retrievedAt = new Date().toISOString();

    for (const countryCode of MVP_COUNTRIES) {
      const title = COUNTRY_TITLES[countryCode] ?? countryCode;
      const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`;
      const countryDirectory = repoPath("data", "rag", "countries", countryCode);

      await writeJsonFile(`${countryDirectory}/wikipedia_baseline.v1.json`, {
        country_code: countryCode,
        module: "wikipedia_baseline",
        version: "1.0",
        last_updated: retrievedAt.slice(0, 10),
        page_title: title,
        page_url: pageUrl,
        revision_id: null,
        retrieved_at: retrievedAt,
        license: "CC BY-SA",
        attribution: "Wikipedia contributors",
        source_family: "wikipedia",
        claim_type: "baseline_summary",
        authority_rank: "secondary_tertiary",
        can_override_official_data: false,
        sections: {
          overview: "",
          history_section_headings: [],
          government: "",
          economy: "",
          demographics: "",
          religion: "",
          foreign_relations: "",
          military: "",
          major_historical_events_mentioned: [],
          important_linked_pages: [],
        },
        source_ids: [this.sourceId],
        confidence: { overall: "unknown", weak_areas: ["manual_review", "revision_metadata"] },
      });

      await writeJsonFile(`${countryDirectory}/wikipedia_references.v1.json`, {
        country_code: countryCode,
        page_title: title,
        page_url: pageUrl,
        revision_id: null,
        retrieved_at: retrievedAt,
        cited_external_references: [],
        important_linked_pages: [],
        source_ids: [this.sourceId],
      });
    }
  }

  async validate(): Promise<void> {
    return Promise.resolve();
  }
}
