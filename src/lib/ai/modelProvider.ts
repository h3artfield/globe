export type ModelProviderRequest = {
  prompt: string;
};

export type ModelProviderResponse = {
  text: string;
  sourceIds: string[];
};

export interface ModelProvider {
  generate(request: ModelProviderRequest): Promise<ModelProviderResponse>;
}

class MockModelProvider implements ModelProvider {
  async generate(request: ModelProviderRequest): Promise<ModelProviderResponse> {
    return {
      text: [
        "Mock strategic answer generated from local RAG context.",
        "No external model provider is configured yet.",
        "Prompt preview:",
        request.prompt.slice(0, 1200),
      ].join("\n\n"),
      sourceIds: [],
    };
  }
}

export function getModelProvider(): ModelProvider {
  return new MockModelProvider();
}
