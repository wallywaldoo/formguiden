import type { PrimaryAction } from "@/lib/analytics/primary-action";
import type { RecommendationDraft } from "@/lib/recommendations/types";

export function primaryActionFromRecommendation(
  recommendation: RecommendationDraft,
): PrimaryAction {
  return {
    href: recommendation.href,
    label: recommendation.actionSv,
    reason: `Rekommendation (${recommendation.ruleId.replaceAll("_", " ")}).`,
  };
}
