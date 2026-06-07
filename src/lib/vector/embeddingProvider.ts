export type EmbeddingProvider = {
  providerName: string;
  modelName: string;
  embedText(text: string): Promise<number[]>;
  embedTexts(texts: string[]): Promise<number[][]>;
};

const DEFAULT_DIMENSION = 64;

function normalize(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return magnitude === 0 ? vector : vector.map((value) => value / magnitude);
}

export class MockEmbeddingProvider implements EmbeddingProvider {
  providerName = "mock_local";
  modelName = `hashing-${DEFAULT_DIMENSION}`;

  async embedText(text: string): Promise<number[]> {
    const vector = new Array(DEFAULT_DIMENSION).fill(0) as number[];
    const tokens = text.toLowerCase().match(/[a-z0-9_]+/g) ?? [];

    for (const token of tokens) {
      let hash = 0;
      for (let index = 0; index < token.length; index += 1) {
        hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
      }
      vector[hash % DEFAULT_DIMENSION] += 1;
    }

    return normalize(vector);
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embedText(text)));
  }
}

export function getEmbeddingProvider(): EmbeddingProvider {
  return new MockEmbeddingProvider();
}
