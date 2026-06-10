import type { QuestionDomain, ReplaySession } from "@/types/forecasting";

const DOMAIN_KEYWORDS: Record<QuestionDomain, string[]> = {
  geopolitics: ["war", "conflict", "nato", "invasion", "military", "ceasefire", "geopolit"],
  elections: ["election", "vote", "ballot", "poll", "primary", "president", "parliament"],
  economy_trade: ["trade", "tariff", "gdp", "economy", "export", "import", "comtrade"],
  crime: ["crime", "homicide", "murder", "violence", "unodc"],
  finance: ["market", "stock", "bond", "rate", "inflation", "fed", "finance", "price"],
  politics: ["politic", "government", "policy", "minister", "congress", "sanction"],
  general: [],
};

export function inferQuestionDomain(session: ReplaySession): QuestionDomain {
  const haystack = `${session.question_text} ${session.template_id}`.toLowerCase();

  if (session.forecast_mode === "live" && session.external_source === "polymarket") {
    if (/trade|economy|gdp|tariff/.test(haystack)) {
      return "economy_trade";
    }
    if (/election|vote|poll/.test(haystack)) {
      return "elections";
    }
    if (/war|nato|conflict|military|geopolit/.test(haystack)) {
      return "geopolitics";
    }
    if (/market|price|stock|finance|fed|rate/.test(haystack)) {
      return "finance";
    }
  }

  if (session.resolution_spec.kind === "metric_compare_years") {
    const metric = session.resolution_spec.metric_id.toLowerCase();
    if (metric.includes("homicide") || metric.includes("crime")) {
      return "crime";
    }
    if (metric.includes("trade") || metric.includes("import") || metric.includes("export")) {
      return "economy_trade";
    }
    if (metric.includes("democracy") || metric.includes("electoral")) {
      return "elections";
    }
  }

  if (session.resolution_spec.kind === "event_exists") {
    if (session.resolution_spec.source_id === "ucdp") {
      return "geopolitics";
    }
  }

  for (const domain of [
    "geopolitics",
    "elections",
    "economy_trade",
    "crime",
    "finance",
    "politics",
  ] as QuestionDomain[]) {
    if (DOMAIN_KEYWORDS[domain].some((keyword) => haystack.includes(keyword))) {
      return domain;
    }
  }

  return "general";
}

export function recommendedSourcesForDomain(domain: QuestionDomain): string[] {
  switch (domain) {
    case "geopolitics":
      return ["gdelt_news_events", "ucdp"];
    case "elections":
      return ["gdelt_news_events"];
    case "economy_trade":
      return ["un_comtrade_bilateral", "gdelt_news_events"];
    case "crime":
      return ["unodc"];
    case "finance":
      return ["polymarket", "gdelt_news_events"];
    case "politics":
      return ["gdelt_news_events", "polymarket"];
    default:
      return ["gdelt_news_events"];
  }
}
