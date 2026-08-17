import {
  mapActivityRow,
  mapBodyRow,
  mapHealthRow,
} from "@/features/dashboard/map-rows";
import { generateRecommendation } from "@/lib/recommendations/engine";
import type {
  RecommendationDraft,
  StoredRecommendation,
} from "@/lib/recommendations/types";
import { RECOMMENDATION_VALID_HOURS } from "@/lib/constants";
import { RULE_FORMULA_KEYS } from "@/lib/recommendations/formulas";
import { graphqlRequest } from "@/lib/graphql/client";
import {
  DELETE_STALE_RECOMMENDATIONS,
  INSERT_RECOMMENDATION,
  INSERT_RECOMMENDATION_SIGNALS,
} from "@/lib/graphql/mutations/coaching";
import {
  GET_COACHING_CONTEXT,
  GET_LATEST_RECOMMENDATION,
} from "@/lib/graphql/queries/coaching";
import type { AnalyticsContext } from "@/lib/analytics/types";
import { toFiniteNumber } from "@/lib/numbers";

type RecommendationRow = {
  id: string;
  generated_at: string;
  rule_id: string;
  action_key: string;
  action_sv: string;
  comparison_period_days: number;
  completeness: unknown;
  confidence: string;
  disclaimer_key: string;
  valid_until: string | null;
  recommendation_signals: Array<{
    signal_key: string;
    observed_value: unknown;
    unit: string | null;
    comparator: string | null;
    reference_value: unknown;
  }>;
};

function mapStored(row: RecommendationRow): StoredRecommendation {
  return {
    id: row.id,
    generatedAt: row.generated_at,
    validUntil: row.valid_until,
    ruleId: row.rule_id,
    actionKey: row.action_key,
    actionSv: row.action_sv,
    href: hrefForActionKey(row.action_key),
    comparisonPeriodDays: row.comparison_period_days,
    completeness: toFiniteNumber(row.completeness) ?? 0,
    confidence: row.confidence as StoredRecommendation["confidence"],
    disclaimerKey: row.disclaimer_key,
    priority: 0,
    formulaKeys: RULE_FORMULA_KEYS[row.rule_id] ?? [],
    signals: row.recommendation_signals.map((signal) => ({
      signalKey: signal.signal_key,
      observedValue: toFiniteNumber(signal.observed_value),
      unit: signal.unit,
      comparator: signal.comparator,
      referenceValue: toFiniteNumber(signal.reference_value),
    })),
  };
}

function hrefForActionKey(actionKey: string): string {
  switch (actionKey) {
    case "recovery_easy_day":
      return "/recovery";
    case "plan_strength_session":
      return "/strength";
    case "import_more_data":
      return "/import";
    case "increase_weekly_volume":
    case "review_pace_gap":
    case "maintain_training":
    default:
      return "/running";
  }
}

async function persistRecommendation(
  draft: RecommendationDraft,
  now: Date,
): Promise<string> {
  const validUntil = new Date(
    now.getTime() + RECOMMENDATION_VALID_HOURS * 3_600_000,
  );
  const inserted = await graphqlRequest<{
    insert_recommendations_one: { id: string };
  }>(INSERT_RECOMMENDATION, {
    generated_at: now.toISOString(),
    rule_id: draft.ruleId,
    action_key: draft.actionKey,
    action_sv: draft.actionSv,
    comparison_period_days: draft.comparisonPeriodDays,
    completeness: draft.completeness,
    confidence: draft.confidence,
    disclaimer_key: draft.disclaimerKey,
    valid_until: validUntil.toISOString(),
  });
  const recommendationId = inserted.insert_recommendations_one.id;
  if (draft.signals.length > 0) {
    await graphqlRequest(INSERT_RECOMMENDATION_SIGNALS, {
      objects: draft.signals.map((signal) => ({
        recommendation_id: recommendationId,
        signal_key: signal.signalKey,
        observed_value: signal.observedValue,
        unit: signal.unit,
        comparator: signal.comparator,
        reference_value: signal.referenceValue,
      })),
    });
  }
  return recommendationId;
}

export async function ensureFreshRecommendation(input: {
  context: AnalyticsContext;
  force?: boolean;
}): Promise<StoredRecommendation | null> {
  const now = input.context.now;
  if (!input.force) {
    const existing = await graphqlRequest<{
      recommendations: RecommendationRow[];
    }>(GET_LATEST_RECOMMENDATION, { now: now.toISOString() });
    const latest = existing.recommendations[0];
    if (latest) {
      return mapStored(latest);
    }
  }

  const since = new Date(now.getTime() - 100 * 86_400_000).toISOString();
  const coaching = await graphqlRequest<{
    goals: Array<{
      weekly_run_distance_m: unknown;
      target_pace_s_per_km: unknown;
      target_mass_kg: unknown;
      weekly_strength_sessions: number | null;
    }>;
    activities: Parameters<typeof mapActivityRow>[0][];
    daily_health_metrics: Parameters<typeof mapHealthRow>[0][];
    body_measurements: Parameters<typeof mapBodyRow>[0][];
    strength_sessions: Array<{ started_at: string }>;
    data_imports: Array<{ id: string }>;
  }>(GET_COACHING_CONTEXT, {
    since,
    since_date: since.slice(0, 10),
  });

  const goal = coaching.goals[0];
  const context: AnalyticsContext = {
    timeZone: input.context.timeZone,
    now: input.context.now,
    goal: {
      weeklyRunDistanceM: toFiniteNumber(goal?.weekly_run_distance_m),
      targetPaceSPerKm: toFiniteNumber(goal?.target_pace_s_per_km),
      targetMassKg: toFiniteNumber(goal?.target_mass_kg),
    },
  };
  const draft = generateRecommendation({
    activities: coaching.activities.map(mapActivityRow),
    health: coaching.daily_health_metrics.map(mapHealthRow),
    body: coaching.body_measurements.map(mapBodyRow),
    strengthSessions: coaching.strength_sessions.map((session) => ({
      startedAt: session.started_at,
    })),
    context,
    weeklyStrengthTarget: goal?.weekly_strength_sessions ?? null,
    pendingImportId: coaching.data_imports[0]?.id ?? null,
  });

  if (!draft) {
    return null;
  }

  const staleBefore = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  await graphqlRequest(DELETE_STALE_RECOMMENDATIONS, { before: staleBefore });
  const id = await persistRecommendation(draft, now);
  return {
    ...draft,
    id,
    generatedAt: now.toISOString(),
    validUntil: new Date(
      now.getTime() + RECOMMENDATION_VALID_HOURS * 3_600_000,
    ).toISOString(),
  };
}

export function mapRecommendationRow(
  row: RecommendationRow,
): StoredRecommendation {
  return mapStored(row);
}
