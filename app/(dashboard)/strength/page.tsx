import Link from "next/link";

import { CollapsiblePanel } from "@/components/dashboard/collapsible-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BackendUnavailable } from "@/features/dashboard/backend-unavailable";
import { MetricCard } from "@/features/dashboard/metric-card";
import {
  SessionDurationTrendChart,
  SessionVolumeTrendChart,
  SessionsPerWeekChart,
} from "@/features/strength/charts";
import { ExerciseLibrary } from "@/features/strength/exercise-library";
import { StrengthSessionForm } from "@/features/strength/session-form";
import {
  addDays,
  isoWeekStart,
  lastIsoWeekStarts,
  toDatetimeLocal,
  toLocalDate,
} from "@/lib/analytics/dates";
import { strengthFrequency } from "@/lib/analytics/strength";
import type { AnalyticsContext } from "@/lib/analytics/types";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { listStrengthSessions } from "@/lib/db/queries";
import { toFiniteNumber } from "@/lib/numbers";
import { formatDurationHms } from "@/lib/units/pace";
import { cn } from "@/lib/utils";

export default async function StrengthPage() {
  const now = new Date();
  const since = new Date(now.getTime() - 90 * 86_400_000).toISOString();

  let data: StrengthPayload | null = null;
  try {
    data = await listStrengthSessions(since);
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="page-title">Styrka</h1>
        <BackendUnavailable />
      </div>
    );
  }

  const timeZone = data.user_preferences[0]?.timezone || DEFAULT_TIMEZONE;
  const context: AnalyticsContext = {
    timeZone,
    now,
    goal: {
      weeklyRunDistanceM: null,
      targetPaceSPerKm: null,
      targetMassKg: null,
    },
  };
  const target = data.goals[0]?.weekly_strength_sessions ?? null;
  const frequency = strengthFrequency(
    data.strength_sessions.map((session) => ({
      startedAt: session.started_at,
    })),
    context,
    target,
  );
  const nowLocal = toDatetimeLocal(now.toISOString(), timeZone);
  const today = toLocalDate(now.toISOString(), timeZone);

  const weekStarts = lastIsoWeekStarts(today, 12).slice().reverse();
  const sessionsByWeek = new Map<string, number>();
  for (const weekStart of weekStarts) {
    sessionsByWeek.set(weekStart, 0);
  }
  for (const session of data.strength_sessions) {
    const week = isoWeekStart(toLocalDate(session.started_at, timeZone));
    if (sessionsByWeek.has(week)) {
      sessionsByWeek.set(week, (sessionsByWeek.get(week) ?? 0) + 1);
    }
  }
  const weekSeries = weekStarts.map((weekStart) => ({
    weekStart,
    count: sessionsByWeek.get(weekStart) ?? 0,
  }));
  const hasSessionHistory = data.strength_sessions.length > 0;

  const volumeBySession = new Map<string, number>();
  for (const set of data.strength_sets) {
    const mass = toFiniteNumber(set.mass_kg);
    const reps = set.repetitions;
    if (mass == null || reps == null || reps <= 0) continue;
    volumeBySession.set(
      set.session_id,
      (volumeBySession.get(set.session_id) ?? 0) + mass * reps,
    );
  }
  const hasVolumeData = volumeBySession.size > 0;

  const chronological = [...data.strength_sessions].sort(
    (a, b) =>
      new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
  );

  const volumeSeries = chronological
    .map((session) => {
      const volume = volumeBySession.get(session.id);
      if (volume == null) return null;
      return {
        date: toLocalDate(session.started_at, timeZone),
        volumeKg: Math.round(volume),
      };
    })
    .filter((row): row is { date: string; volumeKg: number } => row != null);

  const durationSeries = chronological
    .filter((session) => session.duration_s != null && session.duration_s > 0)
    .map((session) => ({
      date: toLocalDate(session.started_at, timeZone),
      minutes: Math.round((session.duration_s ?? 0) / 60),
    }));

  const since30 = addDays(today, -29);
  const exerciseCounts = new Map<string, number>();
  for (const set of data.strength_sets) {
    const local = toLocalDate(set.started_at, timeZone);
    if (local < since30 || local > today) continue;
    const name = set.exercise_name.trim();
    if (!name) continue;
    exerciseCounts.set(name, (exerciseCounts.get(name) ?? 0) + 1);
  }
  const topExercises = [...exerciseCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "sv"))
    .slice(0, 8);
  const maxExerciseCount = topExercises[0]?.[1] ?? 0;

  return (
    <div className="space-y-8">
      <h1 className="page-title">Styrka</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <MetricCard
          title="Pass senaste 7 dagarna"
          value={String(frequency.value ?? 0)}
          caption={
            target != null ? `Mål ${target} pass / vecka` : "Inget veckomål"
          }
          explanation="Antal styrkepass med started_at de senaste 7 lokala dagarna, jämfört med weekly_strength_sessions."
        />
      </div>

      {hasSessionHistory ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <CollapsiblePanel
            storageKey="fk:collapse:strength-weeks"
            title="Pass per vecka"
            bodyClassName="px-5 py-4"
          >
            <SessionsPerWeekChart data={weekSeries} goal={target} />
          </CollapsiblePanel>

          {hasVolumeData && volumeSeries.length > 0 ? (
            <CollapsiblePanel
              storageKey="fk:collapse:strength-volume"
              title="Volym per pass"
              bodyClassName="px-5 py-4"
            >
              <SessionVolumeTrendChart data={volumeSeries} />
            </CollapsiblePanel>
          ) : durationSeries.length > 0 ? (
            <CollapsiblePanel
              storageKey="fk:collapse:strength-duration"
              title="Tid per pass"
              bodyClassName="px-5 py-4"
            >
              <SessionDurationTrendChart data={durationSeries} />
            </CollapsiblePanel>
          ) : null}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Förslag på övningar</CardTitle>
          <CardDescription>
            Tryck på en muskelgrupp och välj övning. Cuen är en kort teknikpåminnelse, inte ett program.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExerciseLibrary />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nytt pass</CardTitle>
          <CardDescription>
            Efter första sparningen öppnas passet så du kan lägga set.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StrengthSessionForm timeZone={timeZone} nowLocal={nowLocal} />
        </CardContent>
      </Card>

      {topExercises.length > 0 ? (
        <CollapsiblePanel
          storageKey="fk:collapse:strength-exercises"
          title="Vanligaste övningarna"
          bodyClassName="space-y-3 px-5 py-4"
        >
          <p className="text-[0.78rem] text-muted-foreground">
            Antal set senaste 30 dagarna
          </p>
          <ul className="space-y-2.5">
            {topExercises.map(([name, count], index) => {
              const ratio =
                maxExerciseCount > 0 ? count / maxExerciseCount : 0;
              return (
                <li key={name} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-[0.85rem]">
                    <span className="min-w-0 truncate font-medium">
                      <span className="mr-2 text-muted-foreground tabular-nums">
                        {index + 1}.
                      </span>
                      {name}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {count} set
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/55">
                    <div
                      className="h-full rounded-full bg-primary/75"
                      style={{ width: `${Math.round(ratio * 100)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </CollapsiblePanel>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Pass</CardTitle>
        </CardHeader>
        <CardContent>
          {data.strength_sessions.length === 0 ? (
            <Empty className="border-border">
              <EmptyHeader>
                <EmptyTitle>Inga styrkepass</EmptyTitle>
                <EmptyDescription>
                  Skapa ett pass ovan. Övningsnamn är fri text i MVP.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Start</TableHead>
                  <TableHead>Tid</TableHead>
                  <TableHead>Ansträngning</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.strength_sessions.map((session) => {
                  const effort = toFiniteNumber(session.perceived_effort);
                  const durationLabel =
                    session.duration_s != null
                      ? formatDurationHms(session.duration_s)
                      : null;
                  return (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-medium">
                            {new Date(session.started_at).toLocaleDateString(
                              "sv-SE",
                              {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                              },
                            )}
                          </p>
                          <p className="text-[0.75rem] text-muted-foreground">
                            {new Date(session.started_at).toLocaleTimeString(
                              "sv-SE",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {durationLabel ? (
                          <span className="surface-tile inline-flex px-2.5 py-1 text-[0.8rem] font-medium tabular-nums">
                            {durationLabel}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {effort != null ? (
                          <EffortBadge value={effort} />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/strength/${session.id}`}>Öppna</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EffortBadge({ value }: { value: number }) {
  const rounded = Math.round(value);
  const tone =
    rounded <= 4
      ? "border-emerald-500/25 bg-emerald-500/15 text-emerald-800"
      : rounded <= 7
        ? "border-amber-500/30 bg-amber-500/15 text-amber-900"
        : "border-orange-500/30 bg-orange-500/15 text-orange-900";

  return (
    <Badge
      variant="secondary"
      className={cn("tabular-nums", tone)}
    >
      RPE {rounded}
    </Badge>
  );
}

type StrengthPayload = {
  user_preferences: Array<{ timezone: string; mass_unit: string }>;
  goals: Array<{ weekly_strength_sessions: number | null }>;
  strength_sessions: Array<{
    id: string;
    started_at: string;
    duration_s: number | null;
    perceived_effort: unknown;
    notes: string | null;
    source: string;
  }>;
  strength_sets: Array<{
    id: string;
    session_id: string;
    exercise_name: string;
    repetitions: number | null;
    mass_kg: unknown;
    started_at: string;
  }>;
};
