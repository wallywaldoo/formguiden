import { runFamilyActivities } from "@/lib/analytics/running-filter";
import type { ActivityPoint, MetricResult } from "@/lib/analytics/types";
import type { RecommendationDraft } from "@/lib/recommendations/types";
import { primaryActionFromRecommendation } from "@/lib/recommendations/primary-action";

export type PrimaryAction = {
  href: string;
  label: string;
  reason: string;
};

export function primaryAction(input: {
  activities: ActivityPoint[];
  pendingImportId: string | null;
  completeness: MetricResult<number>;
  paceGap: MetricResult<number>;
  recommendation?: RecommendationDraft | null;
}): PrimaryAction {
  if (input.recommendation) {
    return primaryActionFromRecommendation(input.recommendation);
  }
  if (input.pendingImportId) {
    return {
      href: `/import/${input.pendingImportId}`,
      label: "Bekräfta import",
      reason: "En förhandsvisning väntar på att sparas.",
    };
  }
  if (runFamilyActivities(input.activities).length === 0) {
    return {
      href: "/import",
      label: "Hämta in första passet",
      reason:
        "Inga löppass ännu. Exportera FIT från Garmin Connect och släpp filen — Formkurvan tar det härifrån.",
    };
  }
  if ((input.completeness.value ?? 0) < 0.4) {
    return {
      href: "/import",
      label: "Hämta ikapp klockan",
      reason:
        "Flera serier saknas. Sömn och HRV finns oftast i FIT-hälsoexport. Dubbletter hoppas över.",
    };
  }
  if ((input.paceGap.value ?? 0) > 15) {
    return {
      href: "/running",
      label: "Se löpningen",
      reason: "Senaste representativa passet är långsammare än måltempot.",
    };
  }
  return {
    href: "/running",
    label: "Öppna löpning",
    reason: "Trender och pass för de senaste 90 dagarna.",
  };
}
