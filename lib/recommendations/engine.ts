import { evaluateRecommendation } from "@/lib/recommendations/rules";
import type {
  RecommendationDraft,
  RecommendationInput,
} from "@/lib/recommendations/types";

export function generateRecommendation(
  input: RecommendationInput,
): RecommendationDraft | null {
  return evaluateRecommendation(input);
}

export { evaluateRecommendation };
