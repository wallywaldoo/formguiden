import type {
  ActivityPoint,
  AnalyticsContext,
  BodyPoint,
  HealthPoint,
} from "@/lib/analytics/types";
import type { StrengthSessionPoint } from "@/lib/analytics/strength";

export type RecommendationConfidence = "low" | "medium" | "high";

export type RecommendationSignalDraft = {
  signalKey: string;
  observedValue: number | null;
  unit: string | null;
  comparator: string | null;
  referenceValue: number | null;
};

export type RecommendationDraft = {
  ruleId: string;
  actionKey: string;
  actionSv: string;
  href: string;
  comparisonPeriodDays: number;
  completeness: number;
  confidence: RecommendationConfidence;
  disclaimerKey: string;
  signals: RecommendationSignalDraft[];
  formulaKeys: string[];
  priority: number;
};

export type RecommendationInput = {
  activities: ActivityPoint[];
  health: HealthPoint[];
  body: BodyPoint[];
  strengthSessions: StrengthSessionPoint[];
  context: AnalyticsContext;
  weeklyStrengthTarget: number | null;
  pendingImportId: string | null;
};

export type StoredRecommendation = RecommendationDraft & {
  id: string;
  generatedAt: string;
  validUntil: string | null;
};
