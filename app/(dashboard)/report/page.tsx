import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BackendUnavailable } from "@/features/dashboard/backend-unavailable";
import { mapActivityRow, mapHealthRow } from "@/features/dashboard/map-rows";
import { MetricCard } from "@/features/dashboard/metric-card";
import { RecommendationCard } from "@/features/recommendations/recommendation-card";
import { mapRecommendationRow } from "@/features/recommendations/service";
import { strengthFrequency } from "@/lib/analytics/strength";
import { computeDashboard } from "@/lib/analytics/dashboard";
import type { AnalyticsContext } from "@/lib/analytics/types";
import { weeklyRunDistance } from "@/lib/analytics/running";
import { sleepDurationMean } from "@/lib/analytics/recovery";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { getWeeklyReportData } from "@/lib/db/queries";
import { toFiniteNumber } from "@/lib/numbers";
import { formatDistanceKm, formatHours } from "@/lib/units/format";

export default async function WeeklyReportPage() {
  const now = new Date();
  const since = new Date(now.getTime() - 28 * 86_400_000).toISOString();

  let data: WeeklyReportPayload | null = null;
  try {
    data = await getWeeklyReportData(since, since.slice(0, 10), now.toISOString()) as unknown as WeeklyReportPayload;
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Veckorapport</h1>
        <BackendUnavailable />
      </div>
    );
  }

  const preferences = data.user_preferences[0];
  const goal = data.goals[0];
  const context: AnalyticsContext = {
    timeZone: preferences?.timezone || DEFAULT_TIMEZONE,
    now,
    goal: {
      weeklyRunDistanceM: toFiniteNumber(goal?.weekly_run_distance_m),
      targetPaceSPerKm: toFiniteNumber(goal?.target_pace_s_per_km),
      targetMassKg: null,
    },
  };
  const activities = data.activities.map(mapActivityRow);
  const health = data.daily_health_metrics.map(mapHealthRow);
  const dashboard = computeDashboard({
    activities,
    health,
    body: [],
    context,
    pendingImportId: null,
  });
  const strength = strengthFrequency(
    data.strength_sessions.map((session) => ({
      startedAt: session.started_at,
    })),
    context,
    goal?.weekly_strength_sessions ?? null,
  );
  const weeklyDistance = weeklyRunDistance(activities, context);
  const sleep = sleepDurationMean(health, context);
  const distanceUnit = preferences?.distance_unit === "mi" ? "mi" : "km";
  const recommendationRow = data.recommendations[0];
  const recommendation = recommendationRow
    ? mapRecommendationRow(recommendationRow)
    : null;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Veckorapport</h1>
        <p className="text-muted-foreground">
          Sammanfattning av senaste veckan och aktuell rekommendation.{" "}
          <Link href="/overview" className="underline">
            Till översikt
          </Link>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Veckodistans"
          value={
            weeklyDistance.value != null
              ? formatDistanceKm(weeklyDistance.value, distanceUnit)
              : "—"
          }
          caption={
            context.goal.weeklyRunDistanceM
              ? `Mål ${formatDistanceKm(context.goal.weeklyRunDistanceM, distanceUnit)}`
              : "Inget veckomål"
          }
          explanation="Summa löpdistans innevarande ISO-vecka."
        />
        <MetricCard
          title="Sömn 7 dagar"
          value={sleep.value != null ? formatHours(sleep.value) : "—"}
          caption={`${Math.round(sleep.completeness * 7)} av 7 nätter`}
          explanation="Medel sömn per natt med data."
        />
        <MetricCard
          title="Styrkepass"
          value={strength.value != null ? String(strength.value) : "—"}
          caption={
            goal?.weekly_strength_sessions
              ? `Mål ${goal.weekly_strength_sessions}/vecka`
              : "Inget styrkemål"
          }
          explanation="Antal styrkepass senaste 7 lokala dagar."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datatäckning</CardTitle>
          <CardDescription>
            Andel tillgängliga serier som matar rekommendationer och trender.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">
            {dashboard.completeness.value != null
              ? `${Math.round(dashboard.completeness.value * 100)} %`
              : "—"}
          </p>
        </CardContent>
      </Card>

      {recommendation ? (
        <RecommendationCard recommendation={recommendation} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Ingen aktiv rekommendation</CardTitle>
            <CardDescription>
              Uppdatera från översikten när du har mer data.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

type WeeklyReportPayload = {
  user_preferences: Array<{ timezone: string; distance_unit: string }>;
  goals: Array<{
    weekly_run_distance_m: unknown;
    target_pace_s_per_km: unknown;
    weekly_strength_sessions: number | null;
    race_type: string;
    race_date: string | null;
    target_duration_s: number | null;
  }>;
  activities: Parameters<typeof mapActivityRow>[0][];
  daily_health_metrics: Parameters<typeof mapHealthRow>[0][];
  strength_sessions: Array<{ started_at: string }>;
  recommendations: Array<{
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
  }>;
};
