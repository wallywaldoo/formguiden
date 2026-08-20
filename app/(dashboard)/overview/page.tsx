import { CoachChat } from "@/features/assistant/coach-chat";
import { BackendUnavailable } from "@/features/dashboard/backend-unavailable";
import { DataEmptyState } from "@/features/dashboard/data-empty-state";
import { DistanceRangeChart } from "@/features/dashboard/distance-range-chart";
import { OverviewDaily } from "@/features/dashboard/overview-daily";
import { OverviewInsights } from "@/features/dashboard/overview-insights";
import { OverviewTodayPlan } from "@/features/dashboard/overview-today-plan";
import { OverviewWeek } from "@/features/dashboard/overview-week";
import {
  OverviewTodayActivity,
  type TodayActivity,
} from "@/features/dashboard/overview-today-activity";
import {
  mapActivityRow,
  mapBodyRow,
  mapHealthRow,
} from "@/features/dashboard/map-rows";
import { QuickLogActions } from "@/features/logging/quick-log-actions";
import { ensureFreshRecommendation } from "@/features/recommendations/service";
import { ensureTrainingPlans } from "@/features/training-plan/service";
import {
  ensureWeekRecaps,
  mondayRecapFrom,
} from "@/features/week-recap/service";
import { GarminSyncPanel } from "@/features/sync/garmin-sync-panel";
import { isNutritionAiEnabled } from "@/lib/ai/nutrition/create-estimator";
import { computeDashboard } from "@/lib/analytics/dashboard";
import { dailyEnergyBalance } from "@/lib/analytics/daily-energy";
import {
  toDatetimeLocal,
  toLocalDate,
  isoWeekStart,
  inInclusiveRange,
} from "@/lib/analytics/dates";
import {
  dailyDistanceSeries,
  historyDistanceSeries,
  representativeRunPace,
} from "@/lib/analytics/running";
import { trainingCue } from "@/lib/analytics/training-cue";
import type { AnalyticsContext } from "@/lib/analytics/types";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import {
  getDashboardData,
  getGarminIntegrationStatus,
  listRecentFuel,
  listRunDistanceHistory,
} from "@/lib/db/queries";
import { readGarminFitnessMetadata } from "@/lib/garmin/fitness";
import { readGarminSyncStatus } from "@/lib/garmin/status";
import { toFiniteNumber } from "@/lib/numbers";

export default async function OverviewPage() {
  const now = new Date();
  const since = new Date(now.getTime() - 100 * 86_400_000).toISOString();
  const sinceDate = since.slice(0, 10);

  let data: DashboardPayload | null = null;
  let runHistoryRows: Parameters<typeof mapActivityRow>[0][] = [];
  let fuel: {
    nutrition: Array<{ eaten_at: string; energy_kcal: unknown }>;
    hydration: Array<{ consumed_at: string; volume_ml: unknown }>;
  } = { nutrition: [], hydration: [] };
  let dashboardError: unknown = null;
  const garminPromise = getGarminIntegrationStatus().catch(() => null);
  const fuelSince = new Date(now.getTime() - 2 * 86_400_000).toISOString();
  try {
    const [dashboard, history, recentFuel] = await Promise.all([
      getDashboardData(since, sinceDate),
      listRunDistanceHistory(),
      listRecentFuel(fuelSince),
    ]);
    data = dashboard;
    runHistoryRows = history;
    fuel = recentFuel;
  } catch (error) {
    dashboardError = error;
    data = null;
  }

  if (!data) {
    const isMissingPostgresUrl =
      dashboardError instanceof Error &&
      dashboardError.message.includes("POSTGRES_URL");

    return (
      <div className="space-y-4">
        <h1 className="page-title">Översikt</h1>
        <BackendUnavailable
          reason={isMissingPostgresUrl ? "configuration" : "database"}
        />
      </div>
    );
  }

  const preferences = data.user_preferences[0];
  const goal = data.goals[0];
  const profile = data.profile;
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
  const runHistory = runHistoryRows.map(mapActivityRow);
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

  let trainingPlans = null;
  try {
    trainingPlans = await ensureTrainingPlans();
  } catch {
    trainingPlans = null;
  }

  let weekRecaps: Awaited<ReturnType<typeof ensureWeekRecaps>> = [];
  try {
    weekRecaps = await ensureWeekRecaps(now);
  } catch {
    weekRecaps = [];
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
  const garminIntegration = await garminPromise;
  const garminStatus = readGarminSyncStatus(garminIntegration);
  const garminFitness = readGarminFitnessMetadata(garminIntegration?.metadata);
  const representativePace = representativeRunPace(
    runHistory.length > 0 ? runHistory : activities,
    context,
  );

  const today = toLocalDate(now.toISOString(), context.timeZone);
  const todayHealth = health.find((row) => row.localDate === today);
  const healthByRecency = [...health].sort((a, b) =>
    b.localDate.localeCompare(a.localDate),
  );
  const latestHealth = healthByRecency.find(
    (row) =>
      row.restingHeartRateBpm != null ||
      row.bodyBatteryHigh != null ||
      row.stressAvg != null,
  );
  const latestRestingHr =
    healthByRecency.find((row) => row.restingHeartRateBpm != null)
      ?.restingHeartRateBpm ?? null;
  const loggedKcal = fuel.nutrition
    .filter((row) => toLocalDate(row.eaten_at, context.timeZone) === today)
    .reduce((sum, row) => sum + (toFiniteNumber(row.energy_kcal) ?? 0), 0);
  const waterMl = fuel.hydration
    .filter((row) => toLocalDate(row.consumed_at, context.timeZone) === today)
    .reduce((sum, row) => sum + (toFiniteNumber(row.volume_ml) ?? 0), 0);

  const todayActivities: TodayActivity[] = data.activities
    .filter((row) => toLocalDate(row.started_at, context.timeZone) === today)
    .map((row) => ({
      id: row.id,
      activityType: row.activity_type,
      startedAt: row.started_at,
      distanceM: toFiniteNumber(row.distance_m),
      durationS: row.duration_s,
      paceSPerKm: toFiniteNumber(row.avg_pace_s_per_km),
      caloriesKcal: toFiniteNumber(row.calories_kcal),
    }));
  const weekStart = isoWeekStart(today);
  const weekActivities: TodayActivity[] = data.activities
    .filter((row) => {
      const localDate = toLocalDate(row.started_at, context.timeZone);
      return inInclusiveRange(localDate, weekStart, today);
    })
    .map((row) => ({
      id: row.id,
      activityType: row.activity_type,
      startedAt: row.started_at,
      distanceM: toFiniteNumber(row.distance_m),
      durationS: row.duration_s,
      paceSPerKm: toFiniteNumber(row.avg_pace_s_per_km),
      caloriesKcal: toFiniteNumber(row.calories_kcal),
    }));
  const weekStepDays = health.filter((row) =>
    inInclusiveRange(row.localDate, weekStart, today),
  );
  const weekStepsTotal = weekStepDays.reduce(
    (sum, row) => sum + (row.steps ?? 0),
    0,
  );
  const weekSteps = weekStepDays.some(
    (row) => row.steps != null && row.steps > 0,
  )
    ? weekStepsTotal
    : null;

  const activityKcal = todayActivities.reduce(
    (sum, activity) => sum + (activity.caloriesKcal ?? 0),
    0,
  );

  const massKg = dashboard.latestMass;
  const heightCm = toFiniteNumber(profile?.height_cm);
  const energy = dailyEnergyBalance({
    massKg,
    heightCm,
    birthDate: profile?.date_of_birth,
    sex: profile?.sex_at_birth ?? null,
    loggedKcal,
    activityKcal,
    now,
  });
  const energyIncomplete = energy == null;

  const recap = mondayRecapFrom(weekRecaps, today);

  const insightStats = [
    {
      label: "Träningsstatus",
      value: garminFitness?.trainingStatus ?? "—",
      detail: garminFitness?.trainingStatus ? "Garmin" : "saknas i Garmin",
      href: "/running",
    },
    {
      label: "Konditionsålder",
      value:
        garminFitness?.fitnessAge != null
          ? `${garminFitness.fitnessAge} år`
          : "—",
      detail:
        garminFitness?.fitnessAge != null &&
        garminFitness.chronologicalAge != null
          ? `Kalenderålder ${garminFitness.chronologicalAge}`
          : garminFitness?.fitnessAge != null
            ? "Garmin"
            : "saknas i Garmin",
      href: "/running",
    },
    {
      label: "Vilopuls",
      value:
        latestRestingHr != null ? `${Math.round(latestRestingHr)} bpm` : "—",
      detail: latestRestingHr != null ? "Senaste mätning" : "saknas",
      href: "/recovery",
    },
    {
      label: "Body Battery",
      value:
        latestHealth?.bodyBatteryHigh != null
          ? `${Math.round(latestHealth.bodyBatteryHigh)}`
          : "—",
      detail:
        latestHealth?.bodyBatteryHigh != null ? "Dagens topp" : "saknas",
      href: "/recovery",
    },
    {
      label: "Stress",
      value:
        latestHealth?.stressAvg != null
          ? `${Math.round(latestHealth.stressAvg)}`
          : "—",
      detail: latestHealth?.stressAvg != null ? "Snitt idag" : "saknas",
      href: "/recovery",
    },
  ];

  const cue = trainingCue({
    action: dashboard.action,
    recommendation,
    lastRunAt:
      todayActivities[0]?.startedAt ??
      runHistory.at(-1)?.startedAt ??
      activities[0]?.startedAt ??
      null,
    now,
  });
  const coachWelcome = `${cue.label}. ${cue.reason}`;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">Översikt</h1>
        <GarminSyncPanel variant="compact" initialStatus={garminStatus} />
      </header>

      <section>
        <QuickLogActions
          timeZone={context.timeZone}
          nowLocal={toDatetimeLocal(now.toISOString(), context.timeZone)}
          massUnit={preferences?.mass_unit === "lb" ? "lb" : "kg"}
          volumeUnit={preferences?.volume_unit === "floz" ? "floz" : "ml"}
          distanceUnit={distanceUnit}
          aiEnabled={isNutritionAiEnabled()}
        />
      </section>

      <OverviewTodayPlan today={trainingPlans?.today ?? null}>
        <OverviewDaily
          embedded
          energy={energy}
          energyIncomplete={energyIncomplete}
          waterMl={waterMl}
          volumeUnit={preferences?.volume_unit === "floz" ? "floz" : "ml"}
          sleepS={todayHealth?.sleepDurationS ?? null}
          steps={todayHealth?.steps ?? null}
        />
        <OverviewTodayActivity
          embedded
          activities={todayActivities}
          distanceUnit={distanceUnit}
        />
      </OverviewTodayPlan>

      <OverviewWeek
        week={trainingPlans?.week ?? null}
        todayDate={today}
        weeklyDistanceM={dashboard.weeklyDistance.value}
        weeklyGoalM={context.goal.weeklyRunDistanceM}
        weekSteps={weekSteps}
        distanceUnit={distanceUnit}
        activities={weekActivities}
        recap={recap}
      />

      <CoachChat variant="panel" initialSummary={coachWelcome} />

      <OverviewInsights
        paceSPerKm={representativePace}
        personalRecords={garminFitness?.personalRecords ?? null}
        goalRaceType={goal?.race_type}
        vo2Max={garminFitness?.vo2Max ?? null}
        stats={insightStats}
        runTrend={
          runHistory.length === 0 && activities.length === 0 ? (
            <DataEmptyState
              title="Ingen löpning ännu"
              description="Synca Garmin eller ladda upp ett pass uppe till höger."
            />
          ) : (
            <DistanceRangeChart
              series={{
                "7": dailyDistanceSeries(activities, context, 7),
                "28": dailyDistanceSeries(activities, context, 28),
                "90": dailyDistanceSeries(activities, context, 90),
                all: historyDistanceSeries(
                  runHistory.length > 0 ? runHistory : activities,
                  context,
                ),
              }}
            />
          )
        }
        currentKg={dashboard.latestMass}
        targetKg={toFiniteNumber(goal?.target_mass_kg)}
        trendKgPerWeek={dashboard.bodyTrend.value}
        timeZone={context.timeZone}
        nowLocal={toDatetimeLocal(now.toISOString(), context.timeZone)}
        massUnit={preferences?.mass_unit === "lb" ? "lb" : "kg"}
        distanceUnit={distanceUnit}
      />
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
  profile: {
    date_of_birth: string | null;
    sex_at_birth: string | null;
    height_cm: unknown;
  } | null;
  goals: Array<{
    weekly_run_distance_m: unknown;
    target_pace_s_per_km: unknown;
    target_mass_kg: unknown;
    race_type?: string | null;
  }>;
  activities: Array<{
    id: string;
    activity_type: string;
    started_at: string;
    duration_s: number | null;
    distance_m: unknown;
    avg_pace_s_per_km: unknown;
    avg_heart_rate_bpm: unknown;
    calories_kcal: unknown;
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
