import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  MessageCircleHeart,
  Sparkles,
} from "lucide-react";

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
  const headlineMetrics = [
    {
      label: "Vecka",
      value:
        dashboard.weeklyDistance.value != null
          ? formatDistanceKm(dashboard.weeklyDistance.value, distanceUnit)
          : "—",
      detail: context.goal.weeklyRunDistanceM
        ? `Mål ${formatDistanceKm(context.goal.weeklyRunDistanceM, distanceUnit)}`
        : "Inget veckomål",
    },
    {
      label: "Sömn",
      value:
        dashboard.sleep.value != null
          ? formatHours(dashboard.sleep.value)
          : "—",
      detail: `${Math.round(dashboard.sleep.completeness * 7)} av 7 nätter`,
    },
    {
      label: "Datatäckning",
      value:
        dashboard.completeness.value != null
          ? formatPercent(dashboard.completeness.value)
          : "—",
      detail: "Viktad överblick av signalerna",
    },
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(20rem,0.95fr)]">
        <Card className="glass-panel ambient-divider overflow-hidden border-white/50">
          <CardContent className="p-0">
            <div className="grid gap-8 p-5 md:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <Badge
                    variant="secondary"
                    className="border-white/50 bg-white/70 px-3 py-1 text-[0.7rem] tracking-[0.18em] uppercase"
                  >
                    Dagens överblick
                  </Badge>
                  <div className="space-y-2">
                    <h1 className="text-3xl font-semibold tracking-tight md:text-[2.6rem]">
                      Översikt först. Nästa steg tydligt.
                    </h1>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                      Formkurvan samlar veckan, återhämtningen och vad du bör
                      göra härnäst i en vy som går att läsa på några sekunder.
                    </p>
                  </div>
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="border-white/55 bg-white/62 shadow-none"
                >
                  <Link href="/coach">
                    Öppna Coach
                    <ArrowUpRight className="size-4" />
                  </Link>
                </Button>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.9fr)]">
                <div className="rounded-[1.8rem] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(242,246,255,0.72))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_16px_40px_rgba(77,95,135,0.12)] md:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        Nästa steg
                      </p>
                      <h2 className="max-w-xl text-2xl font-semibold tracking-tight md:text-3xl">
                        {dashboard.action.label}
                      </h2>
                    </div>
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Sparkles className="size-5" />
                    </span>
                  </div>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                    {dashboard.action.reason}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Button asChild size="lg" className="shadow-none">
                      <Link href={dashboard.action.href}>
                        Gå till nästa steg
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      size="lg"
                      className="border-white/55 bg-white/58 shadow-none"
                    >
                      <Link href="/import">Lägg in nytt pass</Link>
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  {headlineMetrics.map((metric) => (
                    <div
                      key={metric.label}
                      className="glass-panel-soft ambient-divider rounded-[1.6rem] border p-4"
                    >
                      <p className="text-sm font-medium text-muted-foreground">
                        {metric.label}
                      </p>
                      <p className="mt-3 text-2xl font-semibold tracking-tight">
                        {metric.value}
                      </p>
                      <p className="mt-2 text-sm leading-5 text-muted-foreground">
                        {metric.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="glass-panel ambient-divider border-white/50">
            <CardHeader className="gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <MessageCircleHeart className="size-5" />
                  </span>
                  <div>
                    <CardTitle className="text-xl">Coach i flödet</CardTitle>
                    <CardDescription>
                      Fråga direkt när översikten väcker en följdfråga.
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                {recommendation
                  ? `Just nu pekar rekommendationen mot “${recommendation.actionSv}”. Öppna Coach för att få resonemanget i dialogform.`
                  : "Coach använder samma tränings- och återhämtningsbild som översikten, men låter dig ställa en egen fråga direkt."}
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/coach">Fråga Coach</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-panel ambient-divider border-white/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <CalendarClock className="size-5 text-primary" />
                Snabblogga
              </CardTitle>
              <CardDescription>
                Mat, vätska, vikt och styrka utan att lämna översikten.
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
        </div>
      </section>

      <CatchUpHero
        lastActivityAt={activities[0]?.startedAt ?? null}
        now={now}
        timeZone={context.timeZone}
      />

      <div className="grid gap-4 lg:grid-cols-3">
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.9fr)]">
        <Card className="glass-panel ambient-divider border-white/50">
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

        <div className="grid gap-4">
          {recommendation ? (
            <RecommendationCard recommendation={recommendation} />
          ) : null}

          <Card className="glass-panel ambient-divider border-white/50">
            <CardHeader>
              <CardTitle>Senaste inhämtningar</CardTitle>
              <CardDescription>
                Håll koll på vad som precis kommit in i dagsbilden.
              </CardDescription>
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
                    className="glass-panel-soft ambient-divider flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
                  >
                    <Link
                      href={`/import/${item.id}`}
                      className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {new Date(item.created_at).toLocaleString("sv-SE")}
                    </Link>
                    <Badge
                      variant="secondary"
                      className="border-white/50 bg-white/70"
                    >
                      {IMPORT_STATUS_LABEL[item.status] ?? item.status}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
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
