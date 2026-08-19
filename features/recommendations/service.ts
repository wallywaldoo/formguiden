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
import sql from "@/lib/db";
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
  const inserted = await sql`
    INSERT INTO recommendations
      (generated_at, rule_id, action_key, action_sv, comparison_period_days,
       completeness, confidence, disclaimer_key, valid_until)
    VALUES (
      ${now.toISOString()}, ${draft.ruleId}, ${draft.actionKey}, ${draft.actionSv},
      ${draft.comparisonPeriodDays}, ${draft.completeness}, ${draft.confidence},
      ${draft.disclaimerKey}, ${validUntil.toISOString()}
    )
    RETURNING id
  `;
  const recommendationId = inserted[0]!.id as string;
  if (draft.signals.length > 0) {
    await sql`
      INSERT INTO recommendation_signals
        (recommendation_id, signal_key, observed_value, unit, comparator, reference_value)
      SELECT * FROM json_to_recordset(${JSON.stringify(
        draft.signals.map((signal) => ({
          recommendation_id: recommendationId,
          signal_key: signal.signalKey,
          observed_value: signal.observedValue,
          unit: signal.unit,
          comparator: signal.comparator,
          reference_value: signal.referenceValue,
        }))
      )}::json) AS x(recommendation_id uuid, signal_key text, observed_value numeric, unit text, comparator text, reference_value numeric)
    `;
  }
  return recommendationId;
}

export async function ensureFreshRecommendation(input: {
  context: AnalyticsContext;
  force?: boolean;
}): Promise<StoredRecommendation | null> {
  const now = input.context.now;
  if (!input.force) {
    const rows = await sql`
      SELECT
        r.id, r.generated_at, r.rule_id, r.action_key, r.action_sv,
        r.comparison_period_days, r.completeness, r.confidence,
        r.disclaimer_key, r.valid_until,
        COALESCE(
          json_agg(
            json_build_object(
              'signal_key', rs.signal_key,
              'observed_value', rs.observed_value,
              'unit', rs.unit,
              'comparator', rs.comparator,
              'reference_value', rs.reference_value
            ) ORDER BY rs.created_at
          ) FILTER (WHERE rs.id IS NOT NULL),
          '[]'::json
        ) AS recommendation_signals
      FROM recommendations r
      LEFT JOIN recommendation_signals rs ON rs.recommendation_id = r.id
      WHERE (r.valid_until IS NULL OR r.valid_until >= ${now.toISOString()})
      GROUP BY r.id
      ORDER BY r.generated_at DESC
      LIMIT 1
    `;
    const latest = rows[0] as RecommendationRow | undefined;
    if (latest) {
      return mapStored(latest);
    }
  }

  const since = new Date(now.getTime() - 100 * 86_400_000).toISOString();
  const sinceDate = since.slice(0, 10);

  const [goals, activities, healthMetrics, bodyMeasurements, strengthSessions, pendingImports] =
    await Promise.all([
      sql`SELECT weekly_run_distance_m, target_pace_s_per_km, target_mass_kg, weekly_strength_sessions FROM goals WHERE status = 'active' LIMIT 1`,
      sql`
        SELECT id, activity_type, started_at, distance_m, avg_pace_s_per_km, duration_s, avg_heart_rate_bpm
        FROM activities WHERE started_at >= ${since} ORDER BY started_at DESC LIMIT 500
      `,
      sql`
        SELECT local_date, sleep_duration_s, sleep_start_at, hrv_rmssd_ms, resting_heart_rate_bpm,
               steps, stress_avg, body_battery_high, body_battery_low
        FROM daily_health_metrics WHERE local_date >= ${sinceDate} ORDER BY local_date DESC LIMIT 120
      `,
      sql`
        SELECT measured_at, mass_kg, body_fat_pct
        FROM body_measurements WHERE measured_at >= ${since} ORDER BY measured_at DESC LIMIT 120
      `,
      sql`SELECT started_at FROM strength_sessions WHERE started_at >= ${since} ORDER BY started_at DESC LIMIT 200`,
      sql`
        SELECT id FROM data_imports
        WHERE status IN ('preview_ready', 'partial', 'queued', 'processing')
        ORDER BY created_at DESC LIMIT 1
      `,
    ]);

  const goal = goals[0];
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
    activities: (activities as unknown as Parameters<typeof mapActivityRow>[0][]).map(mapActivityRow),
    health: (healthMetrics as unknown as Parameters<typeof mapHealthRow>[0][]).map(mapHealthRow),
    body: (bodyMeasurements as unknown as Parameters<typeof mapBodyRow>[0][]).map(mapBodyRow),
    strengthSessions: strengthSessions.map((session) => ({
      startedAt: session.started_at as string,
    })),
    context,
    weeklyStrengthTarget: (goal?.weekly_strength_sessions as number | null) ?? null,
    pendingImportId: (pendingImports[0]?.id as string) ?? null,
  });

  if (!draft) {
    return null;
  }

  const staleBefore = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  await sql`DELETE FROM recommendations WHERE generated_at < ${staleBefore}`;
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
