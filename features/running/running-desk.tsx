"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Footprints } from "lucide-react";

import { CollapsiblePanel } from "@/components/dashboard/collapsible-panel";
import { Button } from "@/components/ui/button";
import { DistanceChart } from "@/features/dashboard/charts";
import { DataEmptyState } from "@/features/dashboard/data-empty-state";
import {
  HeartRateTrendChart,
  PaceTrendChart,
} from "@/features/dashboard/running-charts";
import { ACTIVITY_TYPE_LABEL } from "@/features/imports/labels";
import { distanceDeltaRatio, runListStats } from "@/features/running/stats";
import type { RunActivityView } from "@/features/running/types";
import { addDays, rollingWindow, toLocalDate } from "@/lib/analytics/dates";
import { formatRaceClock } from "@/lib/analytics/race-estimates";
import {
  dailyDistanceSeries,
  filterActivitiesByRange,
  heartRateTrendSeries,
  historyDistanceSeries,
  parseRunningRange,
  paceTrendSeries,
  rollingDistance,
  weeklyRunDistance,
  type RunningRangeKey,
} from "@/lib/analytics/running";
import type { AnalyticsContext } from "@/lib/analytics/types";
import type { GarminRunningRecords } from "@/lib/garmin/personal-records";
import { formatDistanceKm, formatElevation } from "@/lib/units/format";
import { formatDurationHms, formatPaceMinPerKm } from "@/lib/units/pace";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS: Array<{ key: RunningRangeKey; label: string }> = [
  { key: "7d", label: "7 dagar" },
  { key: "90d", label: "90 dagar" },
  { key: "365d", label: "1 år" },
  { key: "all", label: "Alla" },
];

const RANGE_HEADINGS: Record<RunningRangeKey, string> = {
  "7d": "Senaste 7 dagarna",
  "90d": "Senaste 90 dagarna",
  "365d": "Senaste året",
  all: "All historik",
};

const RANGE_DAYS: Record<RunningRangeKey, number> = {
  "7d": 7,
  "90d": 90,
  "365d": 365,
  all: 3650,
};

const RECORD_TILES: Array<{
  key: keyof GarminRunningRecords;
  label: string;
}> = [
  { key: "time1K", label: "1K" },
  { key: "timeMile", label: "Mile" },
  { key: "time5K", label: "5K" },
  { key: "time10K", label: "10K" },
  { key: "timeHalfMarathon", label: "Halv" },
  { key: "timeMarathon", label: "Maraton" },
];

const PAGE_SIZE = 12;

type PaceTier = "fast" | "average" | "slow";

function classifyPace(
  pace: number,
  stats: { best: number; average: number },
): PaceTier {
  if (pace <= stats.best * 1.05) return "fast";
  if (pace <= stats.average) return "average";
  return "slow";
}

function PaceBadge({
  pace,
  tier,
}: {
  pace: number;
  tier: PaceTier | null;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        tier === "fast" && "bg-emerald-500/15 text-emerald-800",
        tier === "average" && "bg-amber-500/18 text-amber-900",
        tier === "slow" && "bg-rose-500/12 text-rose-800",
        tier == null && "bg-white/55 text-muted-foreground",
      )}
    >
      {formatPaceMinPerKm(pace)} /km
    </span>
  );
}

function formatSignedPercent(ratio: number): string {
  const percent = Math.round(ratio * 100);
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent} %`;
}

function formatRunWhen(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString("sv-SE", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CompactStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-tile min-w-0 px-2 py-2.5 text-center">
      <p className="truncate text-[0.65rem] font-medium text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-[0.92rem] font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}

function TodayRunCard({
  run,
  timeZone,
  distanceUnit,
  elevationUnit,
  paceTier,
}: {
  run: RunActivityView;
  timeZone: string;
  distanceUnit: "km" | "mi";
  elevationUnit: "m" | "ft";
  paceTier: PaceTier | null;
}) {
  const label = ACTIVITY_TYPE_LABEL[run.activityType] ?? run.activityType;
  const time = new Date(run.startedAt).toLocaleTimeString("sv-SE", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });
  const facts = [
    run.distanceM != null ? formatDistanceKm(run.distanceM, distanceUnit) : null,
    run.durationS != null ? formatDurationHms(run.durationS) : null,
    run.avgHeartRateBpm != null ? `${Math.round(run.avgHeartRateBpm)} bpm` : null,
    run.elevationGainM != null
      ? `${formatElevation(run.elevationGainM, elevationUnit)} stigning`
      : null,
  ].filter(Boolean);

  return (
    <Link
      href={`/running/${run.id}`}
      className="surface flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/70"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Footprints className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate font-semibold">{label}</span>
          <span className="shrink-0 text-[0.78rem] text-muted-foreground tabular-nums">
            {time}
          </span>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.82rem] text-muted-foreground">
          {run.avgPaceSPerKm != null ? (
            <PaceBadge pace={run.avgPaceSPerKm} tier={paceTier} />
          ) : null}
          <span className="truncate">{facts.join(" · ")}</span>
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function RunRow({
  run,
  timeZone,
  distanceUnit,
  elevationUnit,
  paceTier,
}: {
  run: RunActivityView;
  timeZone: string;
  distanceUnit: "km" | "mi";
  elevationUnit: "m" | "ft";
  paceTier: PaceTier | null;
}) {
  const label = ACTIVITY_TYPE_LABEL[run.activityType] ?? run.activityType;
  const facts = [
    run.distanceM != null ? formatDistanceKm(run.distanceM, distanceUnit) : null,
    run.durationS != null ? formatDurationHms(run.durationS) : null,
    run.avgHeartRateBpm != null ? `${Math.round(run.avgHeartRateBpm)} bpm` : null,
    run.elevationGainM != null
      ? formatElevation(run.elevationGainM, elevationUnit)
      : null,
  ].filter(Boolean);

  return (
    <Link
      href={`/running/${run.id}`}
      className="surface-tile flex min-h-14 items-center gap-3 px-3.5 py-3 transition-colors hover:bg-white/65"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[0.88rem] font-medium">{label}</span>
          <span className="shrink-0 text-[0.72rem] text-muted-foreground">
            {formatRunWhen(run.startedAt, timeZone)}
          </span>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.78rem] text-muted-foreground">
          {run.avgPaceSPerKm != null ? (
            <PaceBadge pace={run.avgPaceSPerKm} tier={paceTier} />
          ) : null}
          <span className="truncate">{facts.join(" · ")}</span>
        </span>
      </span>
    </Link>
  );
}

export function RunningDesk({
  nowIso,
  timeZone,
  initialRange,
  activities,
  weeklyGoalM,
  distanceUnit,
  elevationUnit,
  personalRecords,
}: {
  nowIso: string;
  timeZone: string;
  initialRange: RunningRangeKey;
  activities: RunActivityView[];
  weeklyGoalM: number | null;
  distanceUnit: "km" | "mi";
  elevationUnit: "m" | "ft";
  personalRecords: GarminRunningRecords | null;
}) {
  const router = useRouter();
  const [range, setRange] = useState<RunningRangeKey>(
    parseRunningRange(initialRange),
  );
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setRange(parseRunningRange(initialRange));
  }, [initialRange]);

  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const context: AnalyticsContext = useMemo(
    () => ({
      timeZone,
      now,
      goal: {
        weeklyRunDistanceM: weeklyGoalM,
        targetPaceSPerKm: null,
        targetMassKg: null,
      },
    }),
    [now, timeZone, weeklyGoalM],
  );
  const today = toLocalDate(nowIso, timeZone);

  const todayRuns = useMemo(
    () =>
      activities.filter(
        (activity) => toLocalDate(activity.startedAt, timeZone) === today,
      ),
    [activities, timeZone, today],
  );

  const ranged = useMemo(
    () => filterActivitiesByRange(activities, context, range),
    [activities, context, range],
  );
  const previous = useMemo(() => {
    if (range === "all") return [];
    const days = RANGE_DAYS[range];
    const window = rollingWindow(today, days);
    const prevEnd = addDays(window.start, -1);
    const prevStart = addDays(prevEnd, -(days - 1));
    return activities.filter((activity) => {
      const localDate = toLocalDate(activity.startedAt, timeZone);
      return localDate >= prevStart && localDate <= prevEnd;
    });
  }, [activities, range, timeZone, today]);

  const calendarWeek = weeklyRunDistance(activities, context);
  const stats = runListStats(ranged);
  const previousStats = runListStats(previous);
  const volumeDelta = distanceDeltaRatio(
    stats.totalDistanceM,
    previousStats.totalDistanceM,
  );
  const d7 = rollingDistance(activities, context, 7);
  const d28 = rollingDistance(activities, context, 28);
  const d90 = rollingDistance(activities, context, 90);

  const volumeSeries = useMemo(() => {
    if (range === "7d") return dailyDistanceSeries(activities, context, 7);
    if (range === "90d") return dailyDistanceSeries(activities, context, 90);
    return historyDistanceSeries(range === "all" ? activities : ranged, context);
  }, [activities, context, range, ranged]);

  const paceSeries = paceTrendSeries(activities, context, RANGE_DAYS[range]);
  const hrSeries = heartRateTrendSeries(activities, context, RANGE_DAYS[range]);

  const paceStats = useMemo(() => {
    const paces = ranged
      .map((run) => run.avgPaceSPerKm)
      .filter((pace): pace is number => pace != null && pace > 0);
    if (paces.length === 0) return null;
    return {
      best: Math.min(...paces),
      average: paces.reduce((sum, pace) => sum + pace, 0) / paces.length,
    };
  }, [ranged]);

  const list = ranged.filter(
    (run) => !todayRuns.some((todayRun) => todayRun.id === run.id),
  );
  const visible = list.slice(0, visibleCount);
  const weekGoalRatio =
    range === "7d" &&
    weeklyGoalM != null &&
    calendarWeek.value != null &&
    weeklyGoalM > 0
      ? calendarWeek.value / weeklyGoalM
      : null;
  const rangeLabel =
    RANGE_OPTIONS.find((option) => option.key === range)?.label ?? "";

  function selectRange(next: RunningRangeKey) {
    setRange(next);
    setVisibleCount(PAGE_SIZE);
    router.replace(`/running?range=${next}`, { scroll: false });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h1 className="page-title">Löpning</h1>
        <div
          className="grid grid-cols-4 gap-1 rounded-2xl border border-white/45 bg-white/45 p-1"
          role="tablist"
          aria-label="Period"
        >
          {RANGE_OPTIONS.map((option) => {
            const active = range === option.key;
            return (
              <button
                key={option.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectRange(option.key)}
                className={cn(
                  "min-h-10 rounded-xl px-1 text-[0.72rem] font-medium transition-colors sm:text-sm",
                  active
                    ? "bg-white/80 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                    : "text-muted-foreground",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {todayRuns.length > 0 ? (
        <section className="space-y-2">
          <h2 className="px-0.5 text-[0.82rem] font-medium text-muted-foreground">
            Idag
          </h2>
          <div className="space-y-2">
            {todayRuns.map((run) => (
              <TodayRunCard
                key={run.id}
                run={run}
                timeZone={timeZone}
                distanceUnit={distanceUnit}
                elevationUnit={elevationUnit}
                paceTier={
                  run.avgPaceSPerKm != null && paceStats
                    ? classifyPace(run.avgPaceSPerKm, paceStats)
                    : null
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-3 px-0.5">
          <h2 className="text-[0.82rem] font-medium text-muted-foreground">
            {RANGE_HEADINGS[range]}
          </h2>
          {weekGoalRatio != null ? (
            <p className="text-[0.75rem] text-muted-foreground">
              {Math.round(Math.max(0, Math.min(1, weekGoalRatio)) * 100)}% av
              veckomål
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-4 gap-2">
          <CompactStat
            label="Distans"
            value={
              stats.totalDistanceM != null
                ? formatDistanceKm(stats.totalDistanceM, distanceUnit)
                : "—"
            }
          />
          <CompactStat
            label="Pass"
            value={stats.runCount > 0 ? String(stats.runCount) : "—"}
          />
          <CompactStat
            label="Tid"
            value={
              stats.totalDurationS != null
                ? formatDurationHms(stats.totalDurationS)
                : "—"
            }
          />
          <CompactStat
            label="Tempo /km"
            value={
              stats.medianPaceSPerKm != null
                ? formatPaceMinPerKm(stats.medianPaceSPerKm)
                : "—"
            }
          />
        </div>
        {weekGoalRatio != null ? (
          <div className="h-1.5 overflow-hidden rounded-full bg-white/55">
            <div
              className="h-full rounded-full bg-foreground/80"
              style={{
                width: `${Math.round(Math.max(0, Math.min(1, weekGoalRatio)) * 100)}%`,
              }}
            />
          </div>
        ) : null}
      </section>

      <CollapsiblePanel
        storageKey="fk:collapse:running-passes"
        title={`Pass · ${rangeLabel}`}
        bodyClassName="space-y-2 px-4 py-3 md:px-5"
      >
        {list.length === 0 && todayRuns.length === 0 ? (
          <DataEmptyState
            title="Inga pass"
            description="Synca Garmin eller ladda upp ett pass så syns de här."
          />
        ) : list.length === 0 ? (
          <p className="text-[0.82rem] text-muted-foreground">
            Dagens pass syns ovan. Inga äldre pass i den här perioden.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {visible.map((run) => (
                <RunRow
                  key={run.id}
                  run={run}
                  timeZone={timeZone}
                  distanceUnit={distanceUnit}
                  elevationUnit={elevationUnit}
                  paceTier={
                    run.avgPaceSPerKm != null && paceStats
                      ? classifyPace(run.avgPaceSPerKm, paceStats)
                      : null
                  }
                />
              ))}
            </div>
            {list.length > visible.length ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full shadow-none"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              >
                Visa fler ({list.length - visible.length} kvar)
              </Button>
            ) : null}
          </>
        )}
      </CollapsiblePanel>

      <CollapsiblePanel
        storageKey="fk:collapse:running-volume"
        title="Volym"
        bodyClassName="space-y-4 px-4 py-4 md:px-5"
      >
        <div className="grid grid-cols-3 gap-2">
          <CompactStat
            label="7 dagar"
            value={
              d7.value != null ? formatDistanceKm(d7.value, distanceUnit) : "—"
            }
          />
          <CompactStat
            label="28 dagar"
            value={
              d28.value != null ? formatDistanceKm(d28.value, distanceUnit) : "—"
            }
          />
          <CompactStat
            label="90 dagar"
            value={
              d90.value != null ? formatDistanceKm(d90.value, distanceUnit) : "—"
            }
          />
        </div>
        {stats.runCount === 0 ? (
          <DataEmptyState
            title="Ingen volym ännu"
            description="När passen är inne ritas distansen över perioden här."
          />
        ) : (
          <>
            <p className="text-[0.8rem] text-muted-foreground">
              {stats.runCount} pass
              {stats.totalDistanceM != null
                ? ` · ${formatDistanceKm(stats.totalDistanceM, distanceUnit)}`
                : ""}
              {stats.longestM != null
                ? ` · längst ${formatDistanceKm(stats.longestM, distanceUnit)}`
                : ""}
              {stats.totalElevationM != null
                ? ` · ${formatElevation(stats.totalElevationM, elevationUnit)} stigning`
                : ""}
              {volumeDelta != null
                ? ` · ${formatSignedPercent(volumeDelta)} mot förra perioden`
                : ""}
            </p>
            <DistanceChart data={volumeSeries} className="h-64" />
          </>
        )}
      </CollapsiblePanel>

      {paceSeries.length > 0 ? (
        <CollapsiblePanel
          storageKey="fk:collapse:running-pace"
          title="Tempoutveckling"
          bodyClassName="space-y-3 px-4 py-4 md:px-5"
        >
          <div className="grid grid-cols-3 gap-2">
            <CompactStat
              label="Median"
              value={
                stats.medianPaceSPerKm != null
                  ? formatPaceMinPerKm(stats.medianPaceSPerKm)
                  : "—"
              }
            />
            <CompactStat
              label="Snabbast"
              value={
                stats.bestPaceSPerKm != null
                  ? formatPaceMinPerKm(stats.bestPaceSPerKm)
                  : "—"
              }
            />
            <CompactStat
              label="Föregående"
              value={
                previousStats.medianPaceSPerKm != null
                  ? formatPaceMinPerKm(previousStats.medianPaceSPerKm)
                  : "—"
              }
            />
          </div>
          <p className="text-[0.8rem] text-muted-foreground">
            Snittempo per pass över 1 km i vald period. Lägre linje är snabbare.
          </p>
          <PaceTrendChart data={paceSeries} />
        </CollapsiblePanel>
      ) : null}

      {hrSeries.length > 0 ? (
        <CollapsiblePanel
          storageKey="fk:collapse:running-hr"
          title="Pulsutveckling"
          bodyClassName="space-y-3 px-4 py-4 md:px-5"
        >
          <p className="text-[0.8rem] text-muted-foreground">
            {stats.medianHeartRateBpm != null
              ? `Medelpuls ${Math.round(stats.medianHeartRateBpm)} bpm per pass i vald period.`
              : "Medelpuls per pass i vald period."}
          </p>
          <HeartRateTrendChart data={hrSeries} />
        </CollapsiblePanel>
      ) : null}

      {personalRecords ? (
        <CollapsiblePanel
          storageKey="fk:collapse:running-records"
          title="Personliga rekord"
          bodyClassName="px-4 py-3 md:px-5"
        >
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {RECORD_TILES.map((tile) => {
              const value = personalRecords[tile.key];
              return (
                <div key={tile.key} className="surface-tile px-2.5 py-2">
                  <p className="text-[0.68rem] font-medium text-muted-foreground">
                    {tile.label}
                  </p>
                  <p className="mt-0.5 text-[0.92rem] font-semibold tabular-nums">
                    {typeof value === "number" && value > 0
                      ? formatRaceClock(value)
                      : "—"}
                  </p>
                </div>
              );
            })}
          </div>
        </CollapsiblePanel>
      ) : null}
    </div>
  );
}
