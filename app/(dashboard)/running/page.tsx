import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BackendUnavailable } from "@/features/dashboard/backend-unavailable";
import { DataEmptyState } from "@/features/dashboard/data-empty-state";
import { DistanceRangeChart } from "@/features/dashboard/distance-range-chart";
import { mapActivityRow } from "@/features/dashboard/map-rows";
import { MetricCard } from "@/features/dashboard/metric-card";
import { ACTIVITY_TYPE_LABEL } from "@/features/imports/labels";
import { dailyDistanceSeries, rollingDistance } from "@/lib/analytics/running";
import type { AnalyticsContext } from "@/lib/analytics/types";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { graphqlRequest } from "@/lib/graphql/client";
import { LIST_ACTIVITIES } from "@/lib/graphql/queries/dashboard";
import { toFiniteNumber } from "@/lib/numbers";
import { formatDistanceKm, formatElevation } from "@/lib/units/format";
import { formatDurationHms, formatPaceMinPerKm } from "@/lib/units/pace";

export default async function RunningPage() {
  const now = new Date();
  const since = new Date(now.getTime() - 100 * 86_400_000).toISOString();

  let data: RunningPayload | null = null;
  try {
    data = await graphqlRequest<RunningPayload>(LIST_ACTIVITIES, {
      since,
    });
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Löpning</h1>
        <BackendUnavailable />
      </div>
    );
  }

  const preferences = data.user_preferences[0];
  const context: AnalyticsContext = {
    timeZone: preferences?.timezone || DEFAULT_TIMEZONE,
    now,
    goal: {
      weeklyRunDistanceM: toFiniteNumber(data.goals[0]?.weekly_run_distance_m),
      targetPaceSPerKm: toFiniteNumber(data.goals[0]?.target_pace_s_per_km),
      targetMassKg: null,
    },
  };
  const activities = data.activities.map(mapActivityRow);
  const distanceUnit = preferences?.distance_unit === "mi" ? "mi" : "km";
  const elevationUnit = preferences?.elevation_unit === "ft" ? "ft" : "m";
  const d7 = rollingDistance(activities, context, 7);
  const d28 = rollingDistance(activities, context, 28);
  const d90 = rollingDistance(activities, context, 90);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Löpning</h1>
        <p className="text-muted-foreground">
          Pass från importerade filer. Tomma fält betyder att exporten saknade
          värdet.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="7 dagar"
          value={
            d7.value != null ? formatDistanceKm(d7.value, distanceUnit) : "—"
          }
        />
        <MetricCard
          title="28 dagar"
          value={
            d28.value != null ? formatDistanceKm(d28.value, distanceUnit) : "—"
          }
        />
        <MetricCard
          title="90 dagar"
          value={
            d90.value != null ? formatDistanceKm(d90.value, distanceUnit) : "—"
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Volym</CardTitle>
          <CardDescription>Lokala kalenderdagar i din tidszon.</CardDescription>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <DataEmptyState
              title="Inga pass"
              description="Aktivitets-FIT, TCX eller GPX från Garmin Connect innehåller vanligtvis distans och tid."
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

      {activities.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pass</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Start</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Distans</TableHead>
                  <TableHead>Tempo</TableHead>
                  <TableHead>Tid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.activities.map((activity) => {
                  const distance = toFiniteNumber(activity.distance_m);
                  const pace = toFiniteNumber(activity.avg_pace_s_per_km);
                  const elevation = toFiniteNumber(activity.elevation_gain_m);
                  return (
                    <TableRow key={activity.id}>
                      <TableCell>
                        <Link
                          href={`/running/${activity.id}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {new Date(activity.started_at).toLocaleString(
                            "sv-SE",
                          )}
                        </Link>
                        {elevation != null ? (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {formatElevation(elevation, elevationUnit)} stigning
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {ACTIVITY_TYPE_LABEL[activity.activity_type] ??
                          activity.activity_type}
                      </TableCell>
                      <TableCell>
                        {distance != null
                          ? formatDistanceKm(distance, distanceUnit)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {pace != null ? `${formatPaceMinPerKm(pace)} /km` : "—"}
                      </TableCell>
                      <TableCell>
                        {activity.duration_s != null
                          ? formatDurationHms(activity.duration_s)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

type RunningPayload = {
  user_preferences: Array<{
    timezone: string;
    distance_unit: string;
    elevation_unit: string;
  }>;
  goals: Array<{
    target_pace_s_per_km: unknown;
    weekly_run_distance_m: unknown;
  }>;
  activities: Array<{
    id: string;
    activity_type: string;
    started_at: string;
    duration_s: number | null;
    distance_m: unknown;
    avg_pace_s_per_km: unknown;
    avg_heart_rate_bpm: unknown;
    elevation_gain_m: unknown;
    calories_kcal: unknown;
  }>;
};
