import { DisabledNutritionEstimator } from "@/lib/ai/nutrition/disabled";
import { StubNutritionEstimator } from "@/lib/ai/nutrition/stub";
import type { NutritionEstimator } from "@/lib/ai/nutrition/types";

export function isNutritionAiEnabled(): boolean {
  return process.env.NUTRITION_AI_PROVIDER === "stub";
}

export function createNutritionEstimator(): NutritionEstimator {
  if (process.env.NUTRITION_AI_PROVIDER === "stub") {
    return new StubNutritionEstimator();
  }
  return new DisabledNutritionEstimator();
}
