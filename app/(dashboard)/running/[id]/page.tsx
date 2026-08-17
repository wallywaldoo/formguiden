import { notFound } from "next/navigation";

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
import { ActivityNotesForm } from "@/features/activities/activity-notes-form";
import { BackendUnavailable } from "@/features/dashboard/backend-unavailable";
import { ACTIVITY_TYPE_LABEL } from "@/features/imports/labels";
import { graphqlRequest } from "@/lib/graphql/client";
import { GET_ACTIVITY } from "@/lib/graphql/queries/dashboard";
import { toFiniteNumber } from "@/lib/numbers";
import { formatDistanceKm, formatElevation } from "@/lib/units/format";
import { formatDurationHms, formatPaceMinPerKm } from "@/lib/units/pace";

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let data: ActivityPayload | null = null;
  try {
    data = await graphqlRequest<ActivityPayload>(GET_ACTIVITY, { id });
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Pass</h1>
        <BackendUnavailable />
      </div>
    );
  }

  const activity = data.activities_by_pk;
  if (!activity) {
    notFound();
  }

  const distanceUnit =
    data.user_preferences[0]?.distance_unit === "mi" ? "mi" : "km";
  const elevationUnit =
    data.user_preferences[0]?.elevation_unit === "ft" ? "ft" : "m";
  const distance = toFiniteNumber(activity.distance_m);
  const pace = toFiniteNumber(activity.avg_pace_s_per_km);
  const elevation = toFiniteNumber(activity.elevation_gain_m);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {ACTIVITY_TYPE_LABEL[activity.activity_type] ??
            activity.activity_type}
        </h1>
        <p className="text-muted-foreground">
          {new Date(activity.started_at).toLocaleString("sv-SE")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Distans"
          value={
            distance != null ? formatDistanceKm(distance, distanceUnit) : "—"
          }
        />
        <Metric
          label="Tempo"
          value={pace != null ? `${formatPaceMinPerKm(pace)} /km` : "—"}
        />
        <Metric
          label="Tid"
          value={
            activity.duration_s != null
              ? formatDurationHms(activity.duration_s)
              : "—"
          }
        />
        <Metric
          label="Puls"
          value={
            toFiniteNumber(activity.avg_heart_rate_bpm) != null
              ? `${Math.round(toFiniteNumber(activity.avg_heart_rate_bpm)!)} bpm`
              : "—"
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detaljer</CardTitle>
          <CardDescription>
            Källa: {activity.source}. Saknade fält lämnas tomma.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Row
            label="Stigning"
            value={
              elevation != null
                ? formatElevation(elevation, elevationUnit)
                : "—"
            }
          />
          <Row
            label="Kalorier"
            value={
              toFiniteNumber(activity.calories_kcal) != null
                ? `${Math.round(toFiniteNumber(activity.calories_kcal)!)} kcal`
                : "—"
            }
          />
          <Row
            label="Kadens"
            value={
              toFiniteNumber(activity.avg_cadence) != null
                ? `${Math.round(toFiniteNumber(activity.avg_cadence)!)}`
                : "—"
            }
          />
          <Row
            label="Träningsbelastning"
            value={
              toFiniteNumber(activity.training_load) != null
                ? String(toFiniteNumber(activity.training_load))
                : "—"
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Varv</CardTitle>
        </CardHeader>
        <CardContent>
          {data.activity_laps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga varv i filen.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Distans</TableHead>
                  <TableHead>Tid</TableHead>
                  <TableHead>Tempo</TableHead>
                  <TableHead>Puls</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.activity_laps.map((lap) => (
                  <TableRow key={lap.id}>
                    <TableCell>{lap.lap_index}</TableCell>
                    <TableCell>
                      {toFiniteNumber(lap.distance_m) != null
                        ? formatDistanceKm(
                            toFiniteNumber(lap.distance_m)!,
                            distanceUnit,
                          )
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {lap.duration_s != null
                        ? formatDurationHms(lap.duration_s)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {toFiniteNumber(lap.avg_pace_s_per_km) != null
                        ? `${formatPaceMinPerKm(toFiniteNumber(lap.avg_pace_s_per_km)!)} /km`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {toFiniteNumber(lap.avg_heart_rate_bpm) != null
                        ? Math.round(toFiniteNumber(lap.avg_heart_rate_bpm)!)
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Anteckning</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityNotesForm activityId={activity.id} notes={activity.notes} />
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tracking-tight">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

type ActivityPayload = {
  user_preferences: Array<{ distance_unit: string; elevation_unit: string }>;
  activities_by_pk: {
    id: string;
    activity_type: string;
    started_at: string;
    duration_s: number | null;
    distance_m: unknown;
    elevation_gain_m: unknown;
    avg_pace_s_per_km: unknown;
    avg_heart_rate_bpm: unknown;
    avg_cadence: unknown;
    calories_kcal: unknown;
    training_load: unknown;
    notes: string | null;
    source: string;
  } | null;
  activity_laps: Array<{
    id: string;
    lap_index: number;
    duration_s: number | null;
    distance_m: unknown;
    avg_pace_s_per_km: unknown;
    avg_heart_rate_bpm: unknown;
  }>;
};
