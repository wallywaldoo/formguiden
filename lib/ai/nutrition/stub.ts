import type {
  NutritionEstimate,
  NutritionEstimateInput,
  NutritionEstimator,
} from "@/lib/ai/nutrition/types";

export class StubNutritionEstimator implements NutritionEstimator {
  async estimate(input: NutritionEstimateInput): Promise<NutritionEstimate> {
    const length = input.description.trim().length;
    const energyKcal = Math.max(150, Math.min(900, 40 + length * 4));
    return {
      energyKcal,
      proteinG: Math.round(energyKcal * 0.08),
      carbohydrateG: Math.round(energyKcal * 0.12),
      fatG: Math.round(energyKcal * 0.04),
      fiberG: 4,
      assumptions: [
        "Exempeldata från stubben, inte en modell.",
        input.massUnit === "lb"
          ? "Portioner tolkas i amerikanska hushållsmått."
          : "Portioner tolkas i metriska hushållsmått.",
      ],
      confidence: "low",
      energyKcalRange: {
        min: Math.round(energyKcal * 0.7),
        max: Math.round(energyKcal * 1.3),
      },
      provider: "stub",
      model: "stub-v1",
    };
  }
}
