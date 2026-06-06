import type { AskResponse } from "@/types/api";
import type { RagContext } from "@/types/rag";
import { buildStrategicAnalysis } from "@/lib/gameTheory/strategicAnalysis";
import { buildStrategicPrompt } from "./buildStrategicPrompt";
import { getModelProvider } from "./modelProvider";

export async function askStrategicQuestion(
  question: string,
  ragContext: RagContext,
): Promise<AskResponse> {
  const prompt = buildStrategicPrompt(question, ragContext);
  const provider = getModelProvider();
  const modelResponse = await provider.generate({ prompt });
  const analysis = buildStrategicAnalysis(question, ragContext);

  return {
    answer: analysis.answer || modelResponse.text,
    selectedCountries: ragContext.selectedCountries,
    strategicSummary: analysis.strategicSummary,
    confidence: ragContext.missingData.length > 0 ? "low" : "medium",
    missingData: ragContext.missingData,
    sourceIds: modelResponse.sourceIds,
    debugContext: ragContext,
  };
}
