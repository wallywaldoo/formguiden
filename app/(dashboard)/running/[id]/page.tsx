import Link from "next/link";
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
import { ActivityMap } from "@/features/activities/activity-map";
import { ActivityNotesForm } from "@/features/activities/activity-notes-form";
import {
  ActivityHeroStats,
  ActivityHrZones,
  ActivityStatGrid,
  ActivityWeatherCard,
} from "@/features/activities/activity-stats";
import { ActivityStreamCharts } from "@/features/activities/activity-stream-charts";
import { EnsureGarminDetail } from "@/features/activities/ensure-garmin-detail";
import { BackendUnavailable } from "@/features/dashboard/backend-unavailable";
import { ACTIVITY_TYPE_LABEL } from "@/features/imports/labels";
import { readGarminPayload } from "@/lib/garmin/payload";
import { getActivity } from "@/lib/db/queries";
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
    data = await getActivity(id);
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="page-title">Pass</h1>
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
  const payload = readGarminPayload(activity.provider_payload);
  const hasRoute = data.activity_trackpoints.length > 1;
  const hasSamples = data.activity_samples.length > 1;
  const canFetchGarminDetail =
    activity.source === "garmin-api" && activity.external_id != null;
  const shouldFetchDetail = canFetchGarminDetail && payload == null;
  const title =
    payload?.name ||
    ACTIVITY_TYPE_LABEL[activity.activity_type] ||
    activity.activity_type;
  const splits = data.activity_laps.filter((lap) => lap.kind !== "lap").length
    ? data.activity_laps.filter((lap) => lap.kind !== "lap")
    : data.activity_laps;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/running"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Alla pass
        </Link>
          <h1 className="page-title">{title}</h1>
        <p className="text-muted-foreground">
          {new Date(activity.started_at).toLocaleString("sv-SE")}
          {" · "}
          {ACTIVITY_TYPE_LABEL[activity.activity_type] ?? activity.activity_type}
          {payload?.deviceManufacturer ? ` · ${payload.deviceManufacturer}` : ""}
        </p>
      </div>

      <EnsureGarminDetail
        activityId={activity.id}
        shouldFetch={shouldFetchDetail}
      />

      <Card className="overflow-hidden py-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle>Rutt</CardTitle>
          <CardDescription>
            {hasRoute
              ? "GPS-spår från Garmin på OpenStreetMap."
              : "Kartan fylls i när Garmin-detaljerna har hämtats."}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <ActivityMap
            points={data.activity_trackpoints.map((point) => ({
              latitude: point.latitude,
              longitude: point.longitude,
            }))}
          />
        </CardContent>
      </Card>

      <ActivityHeroStats
        distanceM={distance}
        durationS={activity.duration_s}
        paceSPerKm={pace}
        avgHeartRateBpm={toFiniteNumber(activity.avg_heart_rate_bpm)}
        distanceUnit={distanceUnit}
      />

      <ActivityStatGrid
        payload={payload}
        durationS={activity.duration_s}
        maxHeartRateBpm={toFiniteNumber(activity.max_heart_rate_bpm)}
        avgCadence={toFiniteNumber(activity.avg_cadence)}
        caloriesKcal={toFiniteNumber(activity.calories_kcal)}
        elevationGainM={elevation}
        elevationLossM={toFiniteNumber(activity.elevation_loss_m)}
        distanceUnit={distanceUnit}
        elevationUnit={elevationUnit}
      />

      {payload?.hrZones?.length ? (
        <ActivityHrZones zones={payload.hrZones} />
      ) : null}
      {payload?.weather ? (
        <ActivityWeatherCard weather={payload.weather} />
      ) : null}

      {hasSamples ? (
        <ActivityStreamCharts
          samples={data.activity_samples.map((sample) => ({
            recordedAt: sample.recorded_at,
            elapsedS: sample.elapsed_s,
            heartRateBpm: toFiniteNumber(sample.heart_rate_bpm),
            speedMps: toFiniteNumber(sample.speed_mps),
            altitudeM: toFiniteNumber(sample.altitude_m),
            cadence: toFiniteNumber(sample.cadence),
          }))}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Varv</CardTitle>
          <CardDescription>
            Kilometersplits när Garmin har dem, annars varv från filen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {splits.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga varv i passet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Distans</TableHead>
                  <TableHead>Tid</TableHead>
                  <TableHead>Tempo</TableHead>
                  <TableHead>Puls</TableHead>
                  <TableHead>Kadens</TableHead>
                  <TableHead>Höjd</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {splits.map((lap) => (
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
                      {toFiniteNumber(lap.max_heart_rate_bpm) != null
                        ? ` / ${Math.round(toFiniteNumber(lap.max_heart_rate_bpm)!)}`
                        : ""}
                    </TableCell>
                    <TableCell>
                      {toFiniteNumber(lap.avg_cadence) != null
                        ? Math.round(toFiniteNumber(lap.avg_cadence)!)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {toFiniteNumber(lap.elevation_gain_m) != null
                        ? `+${formatElevation(
                            toFiniteNumber(lap.elevation_gain_m)!,
                            elevationUnit,
                          )}`
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

type ActivityPayload = {
  user_preferences: Array<{ distance_unit: string; elevation_unit: string }>;
  activities_by_pk: {
    id: string;
    activity_type: string;
    started_at: string;
    ended_at: string | null;
    duration_s: number | null;
    duration_kind: string | null;
    distance_m: unknown;
    elevation_gain_m: unknown;
    elevation_loss_m: unknown;
    avg_pace_s_per_km: unknown;
    avg_heart_rate_bpm: unknown;
    max_heart_rate_bpm: unknown;
    avg_cadence: unknown;
    calories_kcal: unknown;
    training_load: unknown;
    perceived_effort: unknown;
    notes: string | null;
    source: string;
    provider_payload: Record<string, unknown> | null;
    external_id: string | null;
    detail_hydrated_at: string | null;
  } | null;
  activity_laps: Array<{
    id: string;
    lap_index: number;
    kind: string | null;
    duration_s: number | null;
    distance_m: unknown;
    avg_pace_s_per_km: unknown;
    avg_heart_rate_bpm: unknown;
    max_heart_rate_bpm: unknown;
    avg_cadence: unknown;
    elevation_gain_m: unknown;
  }>;
  activity_trackpoints: Array<{
    point_index: number;
    recorded_at: string;
    latitude: number;
    longitude: number;
    altitude_m: unknown;
    distance_m: unknown;
    heart_rate_bpm: unknown;
    cadence: unknown;
    speed_mps: unknown;
    power_w: unknown;
    temperature_c: unknown;
  }>;
  activity_samples: Array<{
    sample_index: number;
    recorded_at: string;
    elapsed_s: number | null;
    distance_m: unknown;
    heart_rate_bpm: unknown;
    cadence: unknown;
    speed_mps: unknown;
    altitude_m: unknown;
    power_w: unknown;
    temperature_c: unknown;
  }>;
};
