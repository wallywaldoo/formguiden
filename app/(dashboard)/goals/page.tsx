import { GoalForm } from "@/features/goals/goal-form";
import { BackendUnavailable } from "@/features/dashboard/backend-unavailable";
import { mapActivityRow } from "@/features/dashboard/map-rows";
import { MetricCard } from "@/features/dashboard/metric-card";
import { todayLocal } from "@/lib/analytics/dates";
import { goalPaceGap, weeklyRunDistance } from "@/lib/analytics/running";
import type { AnalyticsContext } from "@/lib/analytics/types";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { getGoalsPageData } from "@/lib/db/queries";
import { toFiniteNumber } from "@/lib/numbers";
import { asRaceType } from "@/lib/race-type";
import { formatDistanceKm } from "@/lib/units/format";
import { formatPaceMinPerKm } from "@/lib/units/pace";

export default async function GoalsPage() {
  const now = new Date();
  const since = new Date(now.getTime() - 100 * 86_400_000).toISOString();

  let pageData: { user_preferences: SettingsPayload["user_preferences"]; goals: SettingsPayload["goals"]; activities: DashboardSlice["activities"] } | null = null;
  try {
    pageData = await getGoalsPageData(since);
  } catch {
    pageData = null;
  }

  if (!pageData) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Mål</h1>
        <BackendUnavailable />
      </div>
    );
  }

  const settings = pageData;
  const dashboard = pageData;
  const goal = settings.goals[0];
  const context: AnalyticsContext = {
    timeZone: settings.user_preferences[0]?.timezone || DEFAULT_TIMEZONE,
    now,
    goal: {
      weeklyRunDistanceM: toFiniteNumber(goal?.weekly_run_distance_m),
      targetPaceSPerKm: toFiniteNumber(
        dashboard.goals[0]?.target_pace_s_per_km ?? goal?.target_pace_s_per_km,
      ),
      targetMassKg: toFiniteNumber(goal?.target_mass_kg),
    },
  };
  const activities = dashboard.activities.map(mapActivityRow);
  const weekly = weeklyRunDistance(activities, context);
  const paceGap = goalPaceGap(activities, context);
  const today = todayLocal(now, context.timeZone);
  const daysToRace =
    goal?.race_date != null
      ? Math.round(
          (Date.parse(`${goal.race_date}T12:00:00Z`) -
            Date.parse(`${today}T12:00:00Z`)) /
            86_400_000,
        )
      : null;
  const distanceUnit =
    settings.user_preferences[0]?.distance_unit === "mi" ? "mi" : "km";

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Mål</h1>
        <p className="text-muted-foreground">
          Tempo räknas från distans och måltid. Du kan ändra det när som helst.
        </p>
      </div>

      <div className="grid gap-4">
        <MetricCard
          title="Vecka mot mål"
          value={
            weekly.value != null
              ? formatDistanceKm(weekly.value, distanceUnit)
              : "—"
          }
          caption={
            context.goal.weeklyRunDistanceM
              ? `Mål ${formatDistanceKm(context.goal.weeklyRunDistanceM, distanceUnit)}`
              : "Sätt ett veckomål nedan"
          }
        />
        <MetricCard
          title="Temposkillnad"
          value={
            paceGap.value != null
              ? `${paceGap.value > 0 ? "+" : ""}${Math.round(paceGap.value)} s/km`
              : "—"
          }
          caption={
            context.goal.targetPaceSPerKm
              ? `Mål ${formatPaceMinPerKm(context.goal.targetPaceSPerKm)} /km`
              : "Sätt måltid för att få tempo"
          }
        />
        <MetricCard
          title="Till loppet"
          value={
            daysToRace == null
              ? "—"
              : daysToRace >= 0
                ? `${daysToRace} dagar`
                : "Datumet har passerat"
          }
        />
      </div>

      <GoalForm
        initial={
          goal
            ? {
                raceType: asRaceType(goal.race_type),
                raceDistanceM: toFiniteNumber(goal.race_distance_m) ?? 0,
                raceDate: goal.race_date,
                targetDurationS: goal.target_duration_s,
                targetMassKg: toFiniteNumber(goal.target_mass_kg),
                weeklyRunDistanceM: toFiniteNumber(goal.weekly_run_distance_m),
                weeklyRunDurationS: goal.weekly_run_duration_s,
                weeklyStrengthSessions: goal.weekly_strength_sessions,
                weeklyStrengthDurationS: goal.weekly_strength_duration_s,
                notes: goal.notes,
              }
            : null
        }
      />
    </div>
  );
}

type SettingsPayload = {
  user_preferences: Array<{ timezone: string; distance_unit: string }>;
  goals: Array<{
    race_type: string;
    race_distance_m: unknown;
    race_date: string | null;
    target_duration_s: number | null;
    target_pace_s_per_km?: unknown;
    target_mass_kg: unknown;
    weekly_run_distance_m: unknown;
    weekly_run_duration_s: number | null;
    weekly_strength_sessions: number | null;
    weekly_strength_duration_s: number | null;
    notes: string | null;
  }>;
};

type DashboardSlice = {
  goals: Array<{ target_pace_s_per_km: unknown }>;
  activities: Array<{
    id: string;
    activity_type: string;
    started_at: string;
    duration_s: number | null;
    distance_m: unknown;
    avg_pace_s_per_km: unknown;
    avg_heart_rate_bpm: unknown;
  }>;
};
