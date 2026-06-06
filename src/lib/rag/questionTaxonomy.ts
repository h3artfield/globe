export type QuestionTaxonomy = {
  mode: "factual" | "strategic";
  topics: string[];
};

const TOPIC_KEYWORDS: Record<string, string[]> = {
  military: ["war", "invade", "military", "attack", "escalate", "fight"],
  economy: ["trade", "sanction", "debt", "currency", "economy", "lithium"],
  water_food: ["water", "nile", "food", "drought", "river", "grain"],
  alliances: ["alliance", "ally", "nato", "bloc", "partner"],
  regime_security: ["collapse", "coup", "revolution", "ruling", "regime"],
  leverage: ["leverage", "pressure", "coerce", "bargain", "dependency"],
};

export function classifyQuestion(question: string): QuestionTaxonomy {
  const normalizedQuestion = question.toLowerCase();
  const topics = Object.entries(TOPIC_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => normalizedQuestion.includes(keyword)))
    .map(([topic]) => topic);

  const isStrategic = ["if", "would", "happens", "respond", "leverage", "risk", "likely"].some(
    (keyword) => normalizedQuestion.includes(keyword),
  );

  return {
    mode: isStrategic ? "strategic" : "factual",
    topics,
  };
}
