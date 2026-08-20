import { Trophy } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { GoalForm } from "@/features/goals/goal-form";
import { BackendUnavailable } from "@/features/dashboard/backend-unavailable";
import { mapActivityRow } from "@/features/dashboard/map-rows";
import { MetricCard } from "@/features/dashboard/metric-card";
import { isoWeekStart, todayLocal, toLocalDate } from "@/lib/analytics/dates";
import { RACE_TYPE_LABEL } from "@/lib/analytics/race-progress";
import { goalPaceGap, weeklyRunDistance } from "@/lib/analytics/running";
import type { AnalyticsContext } from "@/lib/analytics/types";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { getGoalsPageData } from "@/lib/db/queries";
import { toFiniteNumber } from "@/lib/numbers";
import { asRaceType } from "@/lib/race-type";
import { formatDistanceKm } from "@/lib/units/format";
import { formatPaceMinPerKm } from "@/lib/units/pace";
import { cn } from "@/lib/utils";

export default async function GoalsPage() {
  const now = new Date();
  const since = new Date(now.getTime() - 100 * 86_400_000).toISOString();

  let pageData: {
    user_preferences: SettingsPayload["user_preferences"];
    goals: SettingsPayload["goals"];
    activities: DashboardSlice["activities"];
    latest_mass_kg: unknown;
    strength_sessions: Array<{ started_at: string }>;
  } | null = null;
  try {
    pageData = await getGoalsPageData(since);
  } catch {
    pageData = null;
  }

  if (!pageData) {
    return (
      <div className="space-y-6">
        <h1 className="page-title">Mål</h1>
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

  const weeklyTargetM = context.goal.weeklyRunDistanceM;
  const weeklyDoneM = weekly.value ?? 0;
  const weeklyPct =
    weeklyTargetM != null && weeklyTargetM > 0
      ? Math.max(0, Math.min(100, (weeklyDoneM / weeklyTargetM) * 100))
      : null;

  const strengthTarget = goal?.weekly_strength_sessions ?? null;
  const weekStartDate = isoWeekStart(today);
  const strengthThisWeek = pageData.strength_sessions.filter((session) => {
    const local = toLocalDate(session.started_at, context.timeZone);
    return local >= weekStartDate && local <= today;
  }).length;
  const strengthPct =
    strengthTarget != null && strengthTarget > 0
      ? Math.max(0, Math.min(100, (strengthThisWeek / strengthTarget) * 100))
      : null;

  const currentKg = toFiniteNumber(pageData.latest_mass_kg);
  const targetKg = context.goal.targetMassKg;
  const weightPct =
    currentKg != null && targetKg != null && currentKg > 0 && targetKg > 0
      ? Math.max(
          0,
          Math.min(100, (Math.min(currentKg, targetKg) / Math.max(currentKg, targetKg)) * 100),
        )
      : null;

  const raceLabel = goal
    ? (RACE_TYPE_LABEL[asRaceType(goal.race_type)] ?? "Mållopp")
    : null;
  const raceDateLabel =
    goal?.race_date != null
      ? new Date(`${goal.race_date}T12:00:00Z`).toLocaleDateString("sv-SE", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;

  const timeline = raceTimeline(today, goal?.race_date ?? null);
  const aheadOfPace = paceGap.value != null && paceGap.value <= 0;
  const behindPace = paceGap.value != null && paceGap.value > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="page-title">Mål</h1>

      {goal?.race_date != null && daysToRace != null ? (
        <section className="glass-panel ambient-divider relative overflow-hidden rounded-[1.5rem] border border-white/55 px-6 py-6">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/12 via-transparent to-sky-200/25"
          />
          <div className="relative flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/50 bg-white/55 text-primary shadow-sm">
              <Trophy className="size-6" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[0.78rem] font-medium text-muted-foreground">
                {raceLabel}
              </p>
              <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">
                {daysToRace >= 0 ? daysToRace : 0}
                <span className="ml-2 text-base font-medium text-muted-foreground">
                  {daysToRace === 1 ? "dag kvar" : "dagar kvar"}
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {daysToRace < 0
                  ? "Loppet har passerat"
                  : daysToRace === 0
                    ? "Loppdag i dag"
                    : raceDateLabel}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="surface-tile flex items-start gap-4 px-5 py-5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/50 bg-white/50 text-muted-foreground">
            <Trophy className="size-5" aria-hidden />
          </div>
          <div>
            <p className="font-medium">Sätt ett mållopp</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Välj distans och datum nedan så får du nedräkning och tidslinje hit.
            </p>
          </div>
        </section>
      )}

      {weeklyTargetM != null && weeklyTargetM > 0 ? (
        <section className="surface-tile space-y-3 px-5 py-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[0.78rem] font-medium text-muted-foreground">
                Vecka mot mål
              </p>
              <p className="text-[1.05rem] font-semibold tabular-nums">
                {formatDistanceKm(weeklyDoneM, distanceUnit)}
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  av {formatDistanceKm(weeklyTargetM, distanceUnit)}
                </span>
              </p>
            </div>
            <p className="text-sm font-medium tabular-nums text-primary">
              {Math.round(weeklyPct ?? 0)} %
            </p>
          </div>
          <Progress
            value={weeklyPct ?? 0}
            className="h-3 rounded-full border border-white/45 bg-white/45"
            indicatorClassName="rounded-full bg-primary"
          />
        </section>
      ) : (
        <section className="surface-tile px-5 py-4">
          <p className="text-[0.78rem] font-medium text-muted-foreground">
            Vecka mot mål
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sätt ett veckomål nedan för att följa distansen visuellt.
          </p>
        </section>
      )}

      {strengthTarget != null && strengthTarget > 0 ? (
        <section className="surface-tile space-y-3 px-5 py-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[0.78rem] font-medium text-muted-foreground">
                Styrka den här veckan
              </p>
              <p className="text-[1.05rem] font-semibold tabular-nums">
                {strengthThisWeek}
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  av {strengthTarget} pass
                </span>
              </p>
            </div>
            <p className="text-sm font-medium tabular-nums text-primary">
              {Math.round(strengthPct ?? 0)} %
            </p>
          </div>
          <Progress
            value={strengthPct ?? 0}
            className="h-3 rounded-full border border-white/45 bg-white/45"
            indicatorClassName="rounded-full bg-primary/80"
          />
        </section>
      ) : null}

      {currentKg != null && targetKg != null ? (
        <section className="surface-tile space-y-3 px-5 py-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[0.78rem] font-medium text-muted-foreground">
                Vikt mot mål
              </p>
              <p className="text-[1.05rem] font-semibold tabular-nums">
                {currentKg.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} kg
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  mot {targetKg.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} kg
                </span>
              </p>
            </div>
            <p className="text-sm font-medium tabular-nums text-primary">
              {Math.round(weightPct ?? 0)} %
            </p>
          </div>
          <Progress
            value={weightPct ?? 0}
            className="h-3 rounded-full border border-white/45 bg-white/45"
            indicatorClassName="rounded-full bg-sky-500/80"
          />
        </section>
      ) : null}

      {context.goal.targetPaceSPerKm != null ? (
        <section
          className={cn(
            "surface-tile flex items-center gap-4 px-5 py-4",
            aheadOfPace && "border-emerald-400/40",
            behindPace && "border-amber-400/45",
          )}
        >
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
              aheadOfPace &&
                "border-emerald-500/35 bg-emerald-500/15 text-emerald-700",
              behindPace &&
                "border-amber-500/40 bg-amber-500/15 text-amber-800",
              !aheadOfPace &&
                !behindPace &&
                "border-white/50 bg-white/55 text-muted-foreground",
            )}
          >
            {aheadOfPace ? "✓" : behindPace ? "!" : "·"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[0.78rem] font-medium text-muted-foreground">
              Tempo mot mål
            </p>
            {paceGap.value != null ? (
              <>
                <p
                  className={cn(
                    "font-semibold",
                    aheadOfPace && "text-emerald-700",
                    behindPace && "text-amber-800",
                  )}
                >
                  {aheadOfPace ? "Du är på tempo" : "Bakom målfarten"}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                  {paceGap.value > 0 ? "+" : ""}
                  {Math.round(paceGap.value)} s/km · mål{" "}
                  {formatPaceMinPerKm(context.goal.targetPaceSPerKm)} /km
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Behöver ett representativt löppass för att jämföra tempo.
              </p>
            )}
          </div>
        </section>
      ) : null}

      {timeline ? (
        <section className="surface-tile space-y-4 px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[0.78rem] font-medium text-muted-foreground">
              Tidslinje till loppet
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {timeline.weeksDone}/{timeline.weeksTotal} veckor
            </p>
          </div>
          <div className="relative pt-1 pb-5">
            <div className="h-2 rounded-full border border-white/45 bg-white/45">
              <div
                className="h-full rounded-full bg-primary/80 transition-all"
                style={{ width: `${timeline.elapsedPct}%` }}
              />
            </div>
            <div
              className="absolute top-0 size-3.5 -translate-x-1/2 rounded-full border-2 border-white bg-primary shadow-sm"
              style={{ left: `${timeline.elapsedPct}%` }}
              aria-hidden
            />
            <div className="mt-3 flex justify-between text-xs text-muted-foreground">
              <span>Nu</span>
              <span className="tabular-nums">{Math.round(timeline.elapsedPct)} %</span>
              <span>Race</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {timeline.elapsedPct >= 100
              ? "Perioden fram till loppet är slut."
              : `${Math.round(timeline.elapsedPct)} % av tiden från tre månader före loppet har gått.`}
          </p>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard
          title="Vecka mot mål"
          value={
            weekly.value != null
              ? formatDistanceKm(weekly.value, distanceUnit)
              : "—"
          }
          caption={
            weeklyTargetM
              ? `Mål ${formatDistanceKm(weeklyTargetM, distanceUnit)}`
              : "Sätt ett veckomål nedan"
          }
        />
        <MetricCard
          title="Målfart"
          value={
            context.goal.targetPaceSPerKm
              ? `${formatPaceMinPerKm(context.goal.targetPaceSPerKm)} /km`
              : "—"
          }
          caption={
            paceGap.value != null
              ? `${paceGap.value > 0 ? "+" : ""}${Math.round(paceGap.value)} s/km mot senaste tempo`
              : "Sätt måltid för att få målfart"
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

function raceTimeline(
  today: string,
  raceDate: string | null,
): {
  elapsedPct: number;
  weeksDone: number;
  weeksTotal: number;
} | null {
  if (raceDate == null) {
    return null;
  }
  const raceMs = Date.parse(`${raceDate}T12:00:00Z`);
  const todayMs = Date.parse(`${today}T12:00:00Z`);
  if (!Number.isFinite(raceMs) || !Number.isFinite(todayMs)) {
    return null;
  }
  const startMs = raceMs - 90 * 86_400_000;
  const totalMs = Math.max(raceMs - startMs, 1);
  const elapsedMs = Math.max(0, Math.min(totalMs, todayMs - startMs));
  const elapsedPct = Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100));
  const weeksTotal = Math.max(1, Math.round(90 / 7));
  const weeksDone = Math.max(
    0,
    Math.min(weeksTotal, Math.floor(elapsedMs / (7 * 86_400_000))),
  );
  return { elapsedPct, weeksDone, weeksTotal };
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
