export const AI_ESTIMATE_MAX_PER_HOUR = 10;
export const AI_ESTIMATE_MAX_PER_DAY = 30;
export const AI_ESTIMATE_TIMEOUT_MS = 8_000;
export const AI_ESTIMATE_DAILY_BUDGET_USD = 0;

export type NutritionEstimateInput = {
  description: string;
  locale: string;
  massUnit: "kg" | "lb";
};

export type NutritionEstimate = {
  energyKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
  fiberG: number | null;
  assumptions: string[];
  confidence: "low" | "medium" | "high";
  energyKcalRange: { min: number; max: number };
  provider: string;
  model: string;
};

export class NutritionAiDisabledError extends Error {
  constructor() {
    super("Uppskattning är avstängd tills en leverantör och kostnad godkänns.");
    this.name = "NutritionAiDisabledError";
  }
}

export class NutritionAiRateLimitError extends Error {
  constructor() {
    super(
      "För många uppskattningar just nu. Fyll i manuellt eller försök senare.",
    );
    this.name = "NutritionAiRateLimitError";
  }
}

export interface NutritionEstimator {
  estimate(input: NutritionEstimateInput): Promise<NutritionEstimate>;
}
