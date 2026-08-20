import type { PrimaryAction } from "@/lib/analytics/primary-action";
import type { RecommendationDraft } from "@/lib/recommendations/types";

const ACTION_REASON: Record<string, string> = {
  sleep_debt_limit_intensity: "Sömnen är låg efter ett hårt pass.",
  weekly_volume_behind: "Veckan ligger efter målet.",
  strength_behind_target: "Styrkan har halkat efter.",
  pace_gap_review: "Senaste passet är långsammare än måltempot.",
  maintain_consistency: "Läget är stabilt. Håll i planen.",
};

export function primaryActionFromRecommendation(
  recommendation: RecommendationDraft,
): PrimaryAction {
  return {
    href: recommendation.href,
    label: recommendation.actionSv,
    reason:
      ACTION_REASON[recommendation.ruleId] ?? "Baserat på din senaste träning.",
  };
}
