import sql from "@/lib/db";
import { GarminClient } from "@/lib/garmin/client";
import { parseFit } from "@/lib/import/fit/parse";
import { derivedPace } from "@/lib/import/normalize";
import type { CanonicalLap } from "@/lib/import/types";
import { parseGarminInstant } from "@/lib/garmin/time";
import { toFiniteNumber } from "@/lib/numbers";

import {
  buildGarminPayload,
  parseGarminHrZones,
  parseGarminPolyline,
  parseGarminSplits,
  parseGarminSummary,
  parseGarminWeather,
} from "./payload";

function settledValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

function settledError(result: PromiseSettledResult<unknown>): string | null {
  if (result.status !== "rejected") return null;
  return result.reason instanceof Error
    ? result.reason.message
    : String(result.reason);
}

export type HydrateResult =
  | {
      ok: true;
      laps: number;
      trackpoints: number;
      samples: number;
      warnings: Array<{ code: string; message: string }>;
    }
  | {
      ok: false;
      reason: "missing_detail" | "unreadable_fit";
      warnings?: Array<{ code: string; message: string }>;
    };

export async function hydrateGarminActivityDetail(options: {
  activityId: string;
  externalId: string;
  client?: GarminClient;
}): Promise<HydrateResult> {
  const client = options.client ?? GarminClient.fromEnv();
  const warnings: Array<{ code: string; message: string }> = [];

  const [
    summaryResult,
    detailsResult,
    splitsResult,
    zonesResult,
    weatherResult,
    fitResult,
  ] = await Promise.allSettled([
    client.getActivitySummary(options.externalId),
    client.getActivityDetails(options.externalId),
    client.getActivitySplits(options.externalId),
    client.getActivityHrZones(options.externalId),
    client.getActivityWeather(options.externalId),
    client.downloadActivityFit(options.externalId),
  ]);

  for (const [code, result] of [
    ["garmin_summary", summaryResult],
    ["garmin_details", detailsResult],
    ["garmin_splits", splitsResult],
    ["garmin_hr_zones", zonesResult],
    ["garmin_weather", weatherResult],
    ["garmin_fit", fitResult],
  ] as const) {
    const message = settledError(result);
    if (message) {
      warnings.push({ code, message });
    }
  }

  const summaryRaw = settledValue(summaryResult);
  const detailsRaw = settledValue(detailsResult);
  const parsedSummary = parseGarminSummary(summaryRaw);
  const payload = buildGarminPayload({
    summary: parsedSummary,
    hrZones: parseGarminHrZones(settledValue(zonesResult)),
    weather: parseGarminWeather(settledValue(weatherResult)),
  });

  const fitBytes = settledValue(fitResult);
  const parsedFit = fitBytes ? parseFit(fitBytes) : null;
  const fitActivity = parsedFit?.activities[0] ?? null;
  if (parsedFit?.warnings.length) {
    warnings.push(...parsedFit.warnings);
  }

  const startedAt =
    parseGarminInstant(strFromUnknown(summaryRaw, "startTimeGMT")) ??
    parseGarminInstant(strFromUnknown(summaryRaw, "startTimeLocal")) ??
    parseGarminInstant(fitActivity?.startedAt) ??
    null;

  const polyline = parseGarminPolyline(detailsRaw, startedAt);
  const trackpoints = withTimestamps(
    polyline.length > 1 ? polyline : (fitActivity?.trackpoints ?? []),
    "pointIndex",
  );
  const samples = withTimestamps(fitActivity?.samples ?? [], "sampleIndex");
  const splitLaps = parseGarminSplits(settledValue(splitsResult));
  const laps: CanonicalLap[] = (
    splitLaps.length > 0 ? splitLaps : (fitActivity?.laps ?? [])
  ).map((lap) => ({
    ...lap,
    startedAt: parseGarminInstant(lap.startedAt),
  }));

  const hasAnything =
    Boolean(parsedSummary.name) ||
    payload.hrZones.length > 0 ||
    trackpoints.length > 0 ||
    samples.length > 0 ||
    laps.length > 0 ||
    fitActivity != null;

  if (!hasAnything) {
    return { ok: false, reason: "missing_detail", warnings };
  }

  const distanceM =
    numFromUnknown(summaryRaw, "distance") ?? fitActivity?.distanceM ?? null;
  const durationS = Math.round(
    payload.movingDurationS ??
      payload.elapsedDurationS ??
      fitActivity?.durationS ??
      0,
  );
  const avgHeartRate =
    numFromUnknown(summaryRaw, "averageHR") ??
    fitActivity?.avgHeartRateBpm ??
    null;
  const maxHeartRate =
    numFromUnknown(summaryRaw, "maxHR") ?? fitActivity?.maxHeartRateBpm ?? null;
  const avgCadence =
    numFromUnknown(summaryRaw, "averageRunningCadenceInStepsPerMinute") ??
    numFromUnknown(summaryRaw, "avgRunCadence") ??
    fitActivity?.avgCadence ??
    null;
  const calories =
    numFromUnknown(summaryRaw, "calories") ?? fitActivity?.caloriesKcal ?? null;
  const elevationGain =
    numFromUnknown(summaryRaw, "elevationGain") ??
    fitActivity?.elevationGainM ??
    null;
  const elevationLoss =
    numFromUnknown(summaryRaw, "elevationLoss") ??
    fitActivity?.elevationLossM ??
    null;
  const avgPace =
    derivedPace(distanceM, durationS || null) ??
    fitActivity?.avgPaceSPerKm ??
    null;
  const trainingLoad =
    payload.trainingEffect ?? fitActivity?.trainingLoad ?? null;

  await sql.begin(async (tx) => {
    await tx`DELETE FROM activity_trackpoints WHERE activity_id = ${options.activityId}`;
    await tx`DELETE FROM activity_samples WHERE activity_id = ${options.activityId}`;
    await tx`DELETE FROM activity_laps WHERE activity_id = ${options.activityId}`;

    await tx`
      UPDATE activities
      SET
        ended_at = COALESCE(${parseGarminInstant(fitActivity?.endedAt) ?? null}, ended_at),
        duration_s = COALESCE(${durationS || null}, duration_s),
        duration_kind = COALESCE(${
          payload.movingDurationS != null
            ? "moving"
            : (fitActivity?.durationKind ?? null)
        }, duration_kind),
        distance_m = COALESCE(${distanceM}, distance_m),
        elevation_gain_m = COALESCE(${elevationGain}, elevation_gain_m),
        elevation_loss_m = COALESCE(${elevationLoss}, elevation_loss_m),
        avg_pace_s_per_km = COALESCE(${avgPace}, avg_pace_s_per_km),
        avg_heart_rate_bpm = COALESCE(${avgHeartRate}, avg_heart_rate_bpm),
        max_heart_rate_bpm = COALESCE(${maxHeartRate}, max_heart_rate_bpm),
        avg_cadence = COALESCE(${avgCadence}, avg_cadence),
        calories_kcal = COALESCE(${calories}, calories_kcal),
        training_load = COALESCE(${trainingLoad}, training_load),
        provider_payload = ${sql.json(payload as never)},
        detail_hydrated_at = now(),
        updated_at = now()
      WHERE id = ${options.activityId}
    `;

    if (laps.length > 0) {
      for (const chunk of chunkRows(laps, 200)) {
        await tx`
          INSERT INTO activity_laps ${sql(
            chunk.map((lap) => ({
              activity_id: options.activityId,
              lap_index: lap.lapIndex,
              kind: lap.kind,
              started_at: lap.startedAt,
              duration_s: lap.durationS,
              distance_m: lap.distanceM,
              avg_pace_s_per_km: lap.avgPaceSPerKm,
              avg_heart_rate_bpm: lap.avgHeartRateBpm,
              elevation_gain_m: lap.elevationGainM,
              max_heart_rate_bpm: lap.maxHeartRateBpm ?? null,
              avg_cadence: lap.avgCadence ?? null,
              elevation_loss_m: lap.elevationLossM ?? null,
              calories_kcal: lap.caloriesKcal ?? null,
            })),
            "activity_id",
            "lap_index",
            "kind",
            "started_at",
            "duration_s",
            "distance_m",
            "avg_pace_s_per_km",
            "avg_heart_rate_bpm",
            "elevation_gain_m",
            "max_heart_rate_bpm",
            "avg_cadence",
            "elevation_loss_m",
            "calories_kcal",
          )}
        `;
      }
    }

    if (trackpoints.length > 0) {
      for (const chunk of chunkRows(trackpoints, 400)) {
        await tx`
          INSERT INTO activity_trackpoints ${sql(
            chunk.map((point) => ({
              activity_id: options.activityId,
              point_index: point.pointIndex,
              recorded_at: point.recordedAt,
              latitude: point.latitude,
              longitude: point.longitude,
              altitude_m: point.altitudeM,
              distance_m: point.distanceM,
              heart_rate_bpm: point.heartRateBpm,
              cadence: point.cadence,
              speed_mps: point.speedMps,
              power_w: point.powerW,
              temperature_c: point.temperatureC,
            })),
            "activity_id",
            "point_index",
            "recorded_at",
            "latitude",
            "longitude",
            "altitude_m",
            "distance_m",
            "heart_rate_bpm",
            "cadence",
            "speed_mps",
            "power_w",
            "temperature_c",
          )}
        `;
      }
    }

    if (samples.length > 0) {
      for (const chunk of chunkRows(samples, 400)) {
        await tx`
          INSERT INTO activity_samples ${sql(
            chunk.map((sample) => ({
              activity_id: options.activityId,
              sample_index: sample.sampleIndex,
              recorded_at: sample.recordedAt,
              elapsed_s: sample.elapsedS,
              distance_m: sample.distanceM,
              heart_rate_bpm: sample.heartRateBpm,
              cadence: sample.cadence,
              speed_mps: sample.speedMps,
              altitude_m: sample.altitudeM,
              power_w: sample.powerW,
              temperature_c: sample.temperatureC,
            })),
            "activity_id",
            "sample_index",
            "recorded_at",
            "elapsed_s",
            "distance_m",
            "heart_rate_bpm",
            "cadence",
            "speed_mps",
            "altitude_m",
            "power_w",
            "temperature_c",
          )}
        `;
      }
    }
  });

  return {
    ok: true,
    laps: laps.length,
    trackpoints: trackpoints.length,
    samples: samples.length,
    warnings,
  };
}

function withTimestamps<T extends { recordedAt: string }>(
  rows: T[],
  indexKey: "pointIndex" | "sampleIndex",
): T[] {
  const kept: T[] = [];
  for (const row of rows) {
    const recordedAt = parseGarminInstant(row.recordedAt);
    if (!recordedAt) continue;
    kept.push({
      ...row,
      recordedAt,
      [indexKey]: kept.length + 1,
    });
  }
  return kept;
}

function chunkRows<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function numFromUnknown(raw: unknown, key: string): number | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  const summary =
    root.summaryDTO && typeof root.summaryDTO === "object"
      ? (root.summaryDTO as Record<string, unknown>)
      : root;
  return toFiniteNumber(summary[key] ?? root[key]);
}

function strFromUnknown(raw: unknown, key: string): string | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  const summary =
    root.summaryDTO && typeof root.summaryDTO === "object"
      ? (root.summaryDTO as Record<string, unknown>)
      : root;
  const value = summary[key] ?? root[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function backfillGarminActivityDetails(options?: {
  client?: GarminClient;
  limit?: number;
}): Promise<{
  processed: number;
  remaining: number;
  hydrated: number;
  errors: string[];
  done: boolean;
}> {
  const limit = options?.limit ?? 3;
  const client = options?.client ?? GarminClient.fromEnv();
  const pending = await sql`
    SELECT id, external_id
    FROM activities
    WHERE source = 'garmin-api'
      AND external_id IS NOT NULL
      AND detail_hydrated_at IS NULL
    ORDER BY started_at DESC
    LIMIT ${limit}
  `;
  const remainingRows = await sql`
    SELECT COUNT(*)::int AS count
    FROM activities
    WHERE source = 'garmin-api'
      AND external_id IS NOT NULL
      AND detail_hydrated_at IS NULL
  `;
  const remainingBefore = Number(remainingRows[0]?.count ?? 0);
  const errors: string[] = [];
  let hydrated = 0;

  for (const row of pending) {
    const activityId = String(row.id);
    const externalId = String(row.external_id);
    try {
      const result = await hydrateGarminActivityDetail({
        activityId,
        externalId,
        client,
      });
      if (result.ok) {
        hydrated += 1;
      } else {
        await sql`
          UPDATE activities
          SET
            detail_hydrated_at = now(),
            updated_at = now()
          WHERE id = ${activityId}
        `;
        errors.push(`${externalId}: ${result.reason}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${externalId}: ${message}`);
    }
  }

  return {
    processed: pending.length,
    remaining: Math.max(0, remainingBefore - pending.length),
    hydrated,
    errors,
    done: remainingBefore - pending.length <= 0,
  };
}
