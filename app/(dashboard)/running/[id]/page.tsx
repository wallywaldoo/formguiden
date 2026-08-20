import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CollapsiblePanel } from "@/components/dashboard/collapsible-panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ActivityAnalysisPanel } from "@/features/activities/activity-analysis";
import { ActivityMap } from "@/features/activities/activity-map";
import { ActivityNotesForm } from "@/features/activities/activity-notes-form";
import { ActivityRecapCard } from "@/features/activities/activity-recap-card";
import { ActivitySplitChart } from "@/features/activities/activity-split-chart";
import {
  ActivityHeroStats,
  ActivityHrZones,
  ActivityStatGrid,
  ActivityWeatherCard,
} from "@/features/activities/activity-stats";
import { ActivityStreamCharts } from "@/features/activities/activity-stream-charts";
import { EnsureGarminDetail } from "@/features/activities/ensure-garmin-detail";
import {
  ensureActivityRecap,
  plannedSessionForLocalDate,
} from "@/features/activities/load-recap";
import { BackendUnavailable } from "@/features/dashboard/backend-unavailable";
import { ACTIVITY_TYPE_LABEL } from "@/features/imports/labels";
import { analyzeActivity } from "@/lib/analytics/activity-detail";
import { toLocalDate } from "@/lib/analytics/dates";
import type { ActivityRecapFacts } from "@/lib/analytics/activity-recap";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { getActivity, listRunActivities } from "@/lib/db/queries";
import { readGarminPayload } from "@/lib/garmin/payload";
import { toFiniteNumber } from "@/lib/numbers";
import { formatDistanceKm, formatElevation } from "@/lib/units/format";
import { formatDurationHms, formatPaceMinPerKm } from "@/lib/units/pace";
import { cn } from "@/lib/utils";

async function CoachRecap({
  facts,
}: {
  facts: Omit<ActivityRecapFacts, "planned">;
}) {
  const planned = await plannedSessionForLocalDate(facts.localDate).catch(
    () => null,
  );
  const recap = await ensureActivityRecap({ ...facts, planned });
  if (!recap) return null;
  return <ActivityRecapCard recap={recap} />;
}

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let data: ActivityPayload | null = null;
  let recentRuns: Awaited<ReturnType<typeof listRunActivities>>["activities"] =
    [];
  try {
    const [activityData, runList] = await Promise.all([
      getActivity(id),
      listRunActivities(40),
    ]);
    data = activityData;
    recentRuns = runList.activities;
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

  const analysis = analyzeActivity({
    samples: data.activity_samples.map((sample) => ({
      elapsedS: sample.elapsed_s,
      distanceM: toFiniteNumber(sample.distance_m),
      heartRateBpm: toFiniteNumber(sample.heart_rate_bpm),
      cadence: toFiniteNumber(sample.cadence),
      speedMps: toFiniteNumber(sample.speed_mps),
      altitudeM: toFiniteNumber(sample.altitude_m),
      powerW: toFiniteNumber(sample.power_w),
      temperatureC: toFiniteNumber(sample.temperature_c),
    })),
    laps: splits.map((lap) => ({
      lapIndex: lap.lap_index,
      kind: lap.kind,
      durationS: lap.duration_s,
      distanceM: toFiniteNumber(lap.distance_m),
      avgPaceSPerKm: toFiniteNumber(lap.avg_pace_s_per_km),
      avgHeartRateBpm: toFiniteNumber(lap.avg_heart_rate_bpm),
      maxHeartRateBpm: toFiniteNumber(lap.max_heart_rate_bpm),
      avgCadence: toFiniteNumber(lap.avg_cadence),
      elevationGainM: toFiniteNumber(lap.elevation_gain_m),
      elevationLossM: toFiniteNumber(lap.elevation_loss_m),
      caloriesKcal: toFiniteNumber(lap.calories_kcal),
    })),
    durationS: activity.duration_s,
    movingDurationS: payload?.movingDurationS ?? null,
    elapsedDurationS: payload?.elapsedDurationS ?? null,
    distanceM: distance,
    paceSPerKm: pace,
    avgHeartRateBpm: toFiniteNumber(activity.avg_heart_rate_bpm),
    maxHeartRateBpm: toFiniteNumber(activity.max_heart_rate_bpm),
    elevationGainM: elevation,
    elevationLossM: toFiniteNumber(activity.elevation_loss_m),
    recentRuns: recentRuns
      .filter((row) => row.id !== activity.id)
      .map((row) => ({
        id: row.id,
        startedAt: row.started_at,
        distanceM: toFiniteNumber(row.distance_m),
        durationS: row.duration_s,
        paceSPerKm: toFiniteNumber(row.avg_pace_s_per_km),
        avgHeartRateBpm: toFiniteNumber(row.avg_heart_rate_bpm),
      })),
  });

  const displaySplits =
    analysis.kmSplits.length > 0
      ? analysis.kmSplits
      : splits
          .map((lap) => ({
            index: lap.lap_index,
            label: String(lap.lap_index),
            distanceM: toFiniteNumber(lap.distance_m) ?? 0,
            durationS: lap.duration_s ?? 0,
            paceSPerKm: toFiniteNumber(lap.avg_pace_s_per_km) ?? 0,
            avgHeartRateBpm: toFiniteNumber(lap.avg_heart_rate_bpm),
            avgCadence: toFiniteNumber(lap.avg_cadence),
            elevationDeltaM: toFiniteNumber(lap.elevation_gain_m),
            avgPowerW: null as number | null,
            deltaVsAvgS: null as number | null,
          }))
          .filter((row) => row.durationS > 0);

  const timeZone = data.user_preferences[0]?.timezone || DEFAULT_TIMEZONE;
  const localDate = toLocalDate(activity.started_at, timeZone);
  const recapFacts: Omit<ActivityRecapFacts, "planned"> = {
    activityId: activity.id,
    activityType: activity.activity_type,
    localDate,
    durationS: activity.duration_s,
    distanceM: distance,
    paceSPerKm: pace,
    avgHeartRateBpm: toFiniteNumber(activity.avg_heart_rate_bpm),
    analysis,
  };

  const computedZones = payload?.hrZones?.length
    ? payload.hrZones
    : analysis.hrZoneShare
        .filter((zone) => zone.secs > 0)
        .map((zone) => ({
          zoneNumber: zone.zone,
          secsInZone: zone.secs,
          zoneLowBoundary: null,
        }));

  return (
    <div className="space-y-5">
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
          {ACTIVITY_TYPE_LABEL[activity.activity_type] ??
            activity.activity_type}
          {payload?.deviceManufacturer
            ? ` · ${payload.deviceManufacturer}`
            : ""}
          {payload?.eventType ? ` · ${payload.eventType}` : ""}
        </p>
      </div>

      <EnsureGarminDetail
        activityId={activity.id}
        shouldFetch={shouldFetchDetail}
      />

      <ActivityHeroStats
        distanceM={distance}
        durationS={activity.duration_s}
        paceSPerKm={pace}
        avgHeartRateBpm={toFiniteNumber(activity.avg_heart_rate_bpm)}
        distanceUnit={distanceUnit}
      />

      <Suspense fallback={null}>
        <CoachRecap facts={recapFacts} />
      </Suspense>

      <CollapsiblePanel
        storageKey="fk:collapse:activity-map"
        title="Rutt"
        bodyClassName="px-4 pb-4 md:px-5"
      >
        <p className="mb-3 text-[0.78rem] text-muted-foreground">
          {hasRoute
            ? "GPS-spår från Garmin på OpenStreetMap."
            : "Kartan fylls i när Garmin-detaljerna har hämtats."}
        </p>
        <ActivityMap
          points={data.activity_trackpoints.map((point) => ({
            latitude: point.latitude,
            longitude: point.longitude,
          }))}
        />
      </CollapsiblePanel>

      <ActivityAnalysisPanel analysis={analysis} />

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

      {computedZones.length ? <ActivityHrZones zones={computedZones} /> : null}
      {payload?.weather ? (
        <ActivityWeatherCard weather={payload.weather} />
      ) : null}

      {displaySplits.length > 1 ? (
        <CollapsiblePanel
          storageKey="fk:collapse:activity-splits"
          title="Kilometersplits"
          bodyClassName="space-y-4 px-4 py-4 md:px-5"
        >
          <ActivitySplitChart splits={analysis.kmSplits} />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Km</TableHead>
                  <TableHead>Distans</TableHead>
                  <TableHead>Tid</TableHead>
                  <TableHead>Tempo</TableHead>
                  <TableHead>vs snitt</TableHead>
                  <TableHead>Puls</TableHead>
                  <TableHead>Kadens</TableHead>
                  <TableHead>Höjd</TableHead>
                  <TableHead>Effekt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displaySplits.map((split) => (
                  <TableRow key={`${split.index}-${split.label}`}>
                    <TableCell>{split.label}</TableCell>
                    <TableCell>
                      {split.distanceM > 0
                        ? formatDistanceKm(split.distanceM, distanceUnit)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {split.durationS > 0
                        ? formatDurationHms(Math.round(split.durationS))
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {split.paceSPerKm > 0
                        ? `${formatPaceMinPerKm(split.paceSPerKm)} /km`
                        : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        split.deltaVsAvgS != null &&
                          split.deltaVsAvgS < -2 &&
                          "text-emerald-700",
                        split.deltaVsAvgS != null &&
                          split.deltaVsAvgS > 2 &&
                          "text-orange-700",
                      )}
                    >
                      {split.deltaVsAvgS != null
                        ? `${split.deltaVsAvgS > 0 ? "+" : ""}${Math.round(split.deltaVsAvgS)} s`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {split.avgHeartRateBpm != null
                        ? Math.round(split.avgHeartRateBpm)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {split.avgCadence != null
                        ? Math.round(split.avgCadence)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {split.elevationDeltaM != null
                        ? `${split.elevationDeltaM > 0 ? "+" : ""}${formatElevation(
                            Math.abs(split.elevationDeltaM),
                            elevationUnit,
                          )}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {split.avgPowerW != null
                        ? `${Math.round(split.avgPowerW)} W`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CollapsiblePanel>
      ) : null}

      {hasSamples ? (
        <CollapsiblePanel
          storageKey="fk:collapse:activity-streams"
          title="Grafer"
          bodyClassName="px-4 py-4 md:px-5"
        >
          <ActivityStreamCharts
            samples={data.activity_samples.map((sample) => ({
              recordedAt: sample.recorded_at,
              elapsedS: sample.elapsed_s,
              heartRateBpm: toFiniteNumber(sample.heart_rate_bpm),
              speedMps: toFiniteNumber(sample.speed_mps),
              altitudeM: toFiniteNumber(sample.altitude_m),
              cadence: toFiniteNumber(sample.cadence),
              powerW: toFiniteNumber(sample.power_w),
              temperatureC: toFiniteNumber(sample.temperature_c),
            }))}
          />
        </CollapsiblePanel>
      ) : null}

      <CollapsiblePanel
        storageKey="fk:collapse:activity-notes"
        title="Anteckning"
        bodyClassName="px-4 py-4 md:px-5"
      >
        <ActivityNotesForm activityId={activity.id} notes={activity.notes} />
      </CollapsiblePanel>
    </div>
  );
}

type ActivityPayload = {
  user_preferences: Array<{
    timezone: string;
    distance_unit: string;
    elevation_unit: string;
  }>;
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
    elevation_loss_m: unknown;
    calories_kcal: unknown;
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
