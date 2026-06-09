export class ReplaySessionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplaySessionValidationError";
  }
}

export function assertSessionEditable(status: string): void {
  if (status !== "draft") {
    throw new ReplaySessionValidationError(`Cannot modify session with status ${status}`);
  }
}

export function validateProbability(probability: number | null | undefined, required = false): number | null {
  if (probability === null || probability === undefined) {
    if (required) {
      throw new ReplaySessionValidationError("probability is required");
    }
    return null;
  }
  if (!Number.isFinite(probability) || probability < 0 || probability > 100) {
    throw new ReplaySessionValidationError("probability must be between 0 and 100");
  }
  return probability;
}

export function validateConfidence(
  confidence: string | null | undefined,
): "low" | "medium" | "high" | null {
  if (confidence === null || confidence === undefined || confidence === "") {
    return null;
  }
  if (confidence !== "low" && confidence !== "medium" && confidence !== "high") {
    throw new ReplaySessionValidationError("confidence must be low, medium, or high");
  }
  return confidence;
}
