import {
  NutritionAiDisabledError,
  type NutritionEstimate,
  type NutritionEstimator,
} from "@/lib/ai/nutrition/types";

export class DisabledNutritionEstimator implements NutritionEstimator {
  async estimate(): Promise<NutritionEstimate> {
    throw new NutritionAiDisabledError();
  }
}
