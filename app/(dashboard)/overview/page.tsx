import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BackendUnavailable } from "@/features/dashboard/backend-unavailable";
import { DataEmptyState } from "@/features/dashboard/data-empty-state";
import { DistanceRangeChart } from "@/features/dashboard/distance-range-chart";
import {
  mapActivityRow,
  mapBodyRow,
  mapHealthRow,
} from "@/features/dashboard/map-rows";
import { MetricCard } from "@/features/dashboard/metric-card";
import { IMPORT_STATUS_LABEL } from "@/features/imports/labels";
import { QuickLogActions } from "@/features/logging/quick-log-actions";
import { RecommendationCard } from "@/features/recommendations/recommendation-card";
import { ensureFreshRecommendation } from "@/features/recommendations/service";
import { CatchUpHero } from "@/features/sync/catch-up-hero";
import { isNutritionAiEnabled } from "@/lib/ai/nutrition/create-estimator";
import { computeDashboard } from "@/lib/analytics/dashboard";
import { toDatetimeLocal } from "@/lib/analytics/dates";
import { dailyDistanceSeries } from "@/lib/analytics/running";
import type { AnalyticsContext } from "@/lib/analytics/types";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { getDashboardData } from "@/lib/db/queries";
import { toFiniteNumber } from "@/lib/numbers";
import {
  formatDistanceKm,
  formatHours,
  formatPercent,
} from "@/lib/units/format";
import { formatPaceMinPerKm } from "@/lib/units/pace";

export default async function OverviewPage() {
  const now = new Date();
  const since = new Date(now.getTime() - 100 * 86_400_000).toISOString();
  const sinceDate = since.slice(0, 10);

  let data: DashboardPayload | null = null;
  try {
    data = await getDashboardData(since, sinceDate);
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Översikt</h1>
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
      targetMassKg: toFiniteNumber(goal?.target_mass_kg),
    },
  };
  const activities = data.activities.map(mapActivityRow);
  const health = data.daily_health_metrics.map(mapHealthRow);
  const body = data.body_measurements.map(mapBodyRow);
  const pending = data.data_imports.find((item) =>
    ["preview_ready", "partial", "queued", "processing"].includes(item.status),
  );

  let recommendation = null;
  try {
    recommendation = await ensureFreshRecommendation({ context });
  } catch {
    recommendation = null;
  }
  if (pending) {
    recommendation = null;
  }

  const dashboard = computeDashboard({
    activities,
    health,
    body,
    context,
    pendingImportId: pending?.id ?? null,
    recommendation,
  });
  const distanceUnit = preferences?.distance_unit === "mi" ? "mi" : "km";
  const targetPace = context.goal.targetPaceSPerKm;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Översikt</h1>
        <p className="text-muted-foreground">
          Ett primärt nästa steg. Saknade värden lämnas tomma.
        </p>
      </div>

      <CatchUpHero
        lastActivityAt={activities[0]?.startedAt ?? null}
        now={now}
        timeZone={context.timeZone}
      />

      {recommendation ? (
        <RecommendationCard recommendation={recommendation} />
      ) : null}

      <Card>
        <CardHeader>
          <CardDescription>Nästa steg</CardDescription>
          <CardTitle className="text-2xl">{dashboard.action.label}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {dashboard.action.reason}
          </p>
          <Button asChild>
            <Link href={dashboard.action.href}>{dashboard.action.label}</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logga</CardTitle>
          <CardDescription>
            Mat, vätska, vikt och styrka — snabbloggning utan att lämna
            översikten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QuickLogActions
            timeZone={context.timeZone}
            nowLocal={toDatetimeLocal(now.toISOString(), context.timeZone)}
            massUnit={preferences?.mass_unit === "lb" ? "lb" : "kg"}
            volumeUnit={preferences?.volume_unit === "floz" ? "floz" : "ml"}
            aiEnabled={isNutritionAiEnabled()}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Vecka"
          value={
            dashboard.weeklyDistance.value != null
              ? formatDistanceKm(dashboard.weeklyDistance.value, distanceUnit)
              : "—"
          }
          caption={
            context.goal.weeklyRunDistanceM
              ? `Mål ${formatDistanceKm(context.goal.weeklyRunDistanceM, distanceUnit)}`
              : "Inget veckomål"
          }
          explanation="Summa distans för löpning/trail/löpband i innevarande ISO-vecka. Pass utan distans räknas inte in."
        />
        <MetricCard
          title="Måltempo"
          value={targetPace ? `${formatPaceMinPerKm(targetPace)} /km` : "—"}
          caption={
            dashboard.paceGap.value != null
              ? `Gap ${dashboard.paceGap.value > 0 ? "+" : ""}${Math.round(dashboard.paceGap.value)} s/km`
              : "Inget representativt pass"
          }
          explanation="Senaste löppass ≥ 5 km (annars senaste med tempo) minus måltempo, i sekunder per kilometer."
        />
        <MetricCard
          title="Datatäckning"
          value={
            dashboard.completeness.value != null
              ? formatPercent(dashboard.completeness.value)
              : "—"
          }
          caption="Viktad andel av förväntade serier"
          explanation="Löpvecka och tempo väger tyngst, därefter sömn, HRV, vilopuls och vikt."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Sömn 7 dagar"
          value={
            dashboard.sleep.value != null
              ? formatHours(dashboard.sleep.value)
              : "—"
          }
          caption={`${Math.round(dashboard.sleep.completeness * 7)} av 7 nätter`}
          explanation="Medel av nätter med sleep_duration_s. Tomma nätter exkluderas."
        />
        <MetricCard
          title="HRV-baslinje"
          value={
            dashboard.hrv.value != null
              ? `${Math.round(dashboard.hrv.value)} ms`
              : "—"
          }
          caption="Median 28 dagar, minst 14 mätningar"
          explanation="Median hrv_rmssd_ms de senaste 28 lokala dagarna. Kräver minst 14 värden."
        />
        <MetricCard
          title="Vikt"
          value={
            dashboard.latestMass != null
              ? `${dashboard.latestMass.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} kg`
              : "—"
          }
          caption={
            dashboard.bodyTrend.value != null
              ? `${dashboard.bodyTrend.value >= 0 ? "+" : ""}${dashboard.bodyTrend.value.toFixed(2)} kg/vecka`
              : "Behöver minst 4 mätningar"
          }
          explanation="Lutning (minsta kvadrat) för mass_kg de senaste 28 dagarna, omräknad till kg per vecka."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Löptrend</CardTitle>
          <CardDescription>
            7 / 28 / 90 dagar. Tomma dagar är noll, inte påhittad data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <DataEmptyState
              title="Ingen löpning ännu"
              description="Exportera Original/FIT från Garmin Connect och släpp filen här."
            />
          ) : (
            <DistanceRangeChart
              series={{
                "7": dailyDistanceSeries(activities, context, 7),
                "28": dailyDistanceSeries(activities, context, 28),
                "90": dailyDistanceSeries(activities, context, 90),
              }}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Senaste inhämtningar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.data_imports.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Inga inhämtningar ännu.
            </p>
          ) : (
            data.data_imports.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3"
              >
                <Link
                  href={`/import/${item.id}`}
                  className="text-sm underline-offset-4 hover:underline"
                >
                  {new Date(item.created_at).toLocaleString("sv-SE")}
                </Link>
                <Badge variant="secondary">
                  {IMPORT_STATUS_LABEL[item.status] ?? item.status}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type DashboardPayload = {
  user_preferences: Array<{
    timezone: string;
    distance_unit: string;
    mass_unit: string;
    elevation_unit: string;
    volume_unit: string;
  }>;
  goals: Array<{
    weekly_run_distance_m: unknown;
    target_pace_s_per_km: unknown;
    target_mass_kg: unknown;
  }>;
  activities: Array<{
    id: string;
    activity_type: string;
    started_at: string;
    duration_s: number | null;
    distance_m: unknown;
    avg_pace_s_per_km: unknown;
    avg_heart_rate_bpm: unknown;
  }>;
  daily_health_metrics: Array<{
    local_date: string;
    sleep_duration_s: number | null;
    sleep_start_at: string | null;
    hrv_rmssd_ms: unknown;
    resting_heart_rate_bpm: unknown;
    steps: number | null;
    stress_avg: unknown;
    body_battery_high: unknown;
    body_battery_low: unknown;
  }>;
  body_measurements: Array<{
    measured_at: string;
    mass_kg: unknown;
    body_fat_pct: unknown;
  }>;
  data_imports: Array<{
    id: string;
    status: string;
    created_at: string;
    committed_count: number;
    committed_at: string | null;
    file_count: number;
  }>;
};
