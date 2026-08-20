import { toFiniteNumber } from "@/lib/numbers";
import { derivedPace } from "@/lib/import/normalize";
import type { CanonicalLap, CanonicalTrackpoint } from "@/lib/import/types";

import {
  parseGarminInstant,
  recordedAtFromGarminPoint,
} from "@/lib/garmin/time";
import {
  toLatitude,
  toLongitude,
  weatherTempToCelsius,
} from "@/lib/garmin/geo";

export const GARMIN_DETAIL_VERSION = 2;

export type GarminHrZone = {
  zoneNumber: number;
  secsInZone: number;
  zoneLowBoundary: number | null;
};

export type GarminWeather = {
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  humidityPercent: number | null;
  windSpeed: number | null;
  windSpeedUnit: string | null;
  windDirectionCompass: string | null;
  description: string | null;
  stationName: string | null;
};

export type GarminActivityPayload = {
  detailVersion: number;
  name: string | null;
  eventType: string | null;
  deviceManufacturer: string | null;
  elapsedDurationS: number | null;
  movingDurationS: number | null;
  avgSpeedMps: number | null;
  maxSpeedMps: number | null;
  minHeartRateBpm: number | null;
  maxCadence: number | null;
  avgStrideLengthCm: number | null;
  steps: number | null;
  trainingEffect: number | null;
  anaerobicTrainingEffect: number | null;
  moderateIntensityMinutes: number | null;
  vigorousIntensityMinutes: number | null;
  maxElevationM: number | null;
  minElevationM: number | null;
  hrZones: GarminHrZone[];
  weather: GarminWeather | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function num(
  record: Record<string, unknown> | null,
  ...keys: string[]
): number | null {
  if (!record) return null;
  for (const key of keys) {
    const parsed = toFiniteNumber(record[key]);
    if (parsed != null) return parsed;
  }
  return null;
}

function str(
  record: Record<string, unknown> | null,
  ...keys: string[]
): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function unwrapGarminActivity(raw: unknown): Record<string, unknown> {
  const root = asRecord(raw);
  if (!root) return {};
  const summary = asRecord(root.summaryDTO);
  return summary ? { ...root, ...summary } : root;
}

export function parseGarminSummary(
  raw: unknown,
): Partial<GarminActivityPayload> {
  const activity = unwrapGarminActivity(raw);
  return {
    name: str(activity, "activityName", "name"),
    eventType:
      str(
        asRecord(activity.eventTypeDTO) ?? asRecord(activity.eventType),
        "typeKey",
        "key",
      ) ?? str(activity, "eventType"),
    deviceManufacturer:
      str(asRecord(activity.deviceMetaDataDTO), "manufacturer") ??
      str(activity, "deviceManufacturer", "manufacturer"),
    elapsedDurationS: num(
      activity,
      "elapsedDuration",
      "elapsedDurationSeconds",
    ),
    movingDurationS: num(activity, "movingDuration", "movingDurationSeconds"),
    avgSpeedMps: num(activity, "averageSpeed", "avgSpeed", "avgSpeedMps"),
    maxSpeedMps: num(activity, "maxSpeed", "maxSpeedMps"),
    minHeartRateBpm: num(activity, "minHR", "minHr", "minHrBpm"),
    maxCadence: num(activity, "maxRunCadence", "maxBikeCadence", "maxCadence"),
    avgStrideLengthCm: num(activity, "avgStrideLength", "avgStrideLengthCm"),
    steps: num(activity, "steps"),
    trainingEffect: num(activity, "aerobicTrainingEffect", "trainingEffect"),
    anaerobicTrainingEffect: num(activity, "anaerobicTrainingEffect"),
    moderateIntensityMinutes: num(activity, "moderateIntensityMinutes"),
    vigorousIntensityMinutes: num(activity, "vigorousIntensityMinutes"),
    maxElevationM: num(activity, "maxElevation", "maxElevationMeters"),
    minElevationM: num(activity, "minElevation", "minElevationMeters"),
  };
}

export function parseGarminHrZones(raw: unknown): GarminHrZone[] {
  const rows = Array.isArray(raw) ? raw : [];
  return rows
    .map((row) => {
      const record = asRecord(row);
      const zoneNumber = num(record, "zoneNumber");
      const secsInZone = num(record, "secsInZone");
      if (zoneNumber == null || secsInZone == null) return null;
      return {
        zoneNumber,
        secsInZone,
        zoneLowBoundary: num(record, "zoneLowBoundary"),
      };
    })
    .filter((zone): zone is GarminHrZone => zone != null)
    .sort((a, b) => a.zoneNumber - b.zoneNumber);
}

export function parseGarminWeather(raw: unknown): GarminWeather | null {
  const root = asRecord(raw);
  if (!root) return null;
  const weather =
    asRecord(root.weatherDto) ?? asRecord(root.weatherDTO) ?? root;
  const type =
    asRecord(weather.weatherTypeDTO) ?? asRecord(weather.weatherType);
  const temperature = num(weather, "temp", "temperature");
  const apparent = num(weather, "apparentTemp", "apparentTemperature");
  const unit = str(weather, "temperatureUnit", "tempUnit", "unit");
  if (
    temperature == null &&
    apparent == null &&
    num(weather, "relativeHumidity", "humidity") == null
  ) {
    return null;
  }
  return {
    temperatureC:
      temperature == null ? null : weatherTempToCelsius(temperature, unit),
    apparentTemperatureC:
      apparent == null ? null : weatherTempToCelsius(apparent, unit),
    humidityPercent: num(
      weather,
      "relativeHumidity",
      "humidity",
      "humidityPercent",
    ),
    windSpeed: num(weather, "windSpeed"),
    windSpeedUnit: str(weather, "windSpeedUnit") ?? "km/h",
    windDirectionCompass: str(weather, "windDirectionCompass", "windDirection"),
    description:
      str(type, "desc", "description") ?? str(weather, "weatherDescription"),
    stationName: str(weather, "stationName", "weatherStationName"),
  };
}

export function parseGarminSplits(raw: unknown): CanonicalLap[] {
  const root = asRecord(raw);
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray(root?.lapDTOs)
      ? root.lapDTOs
      : Array.isArray(root?.laps)
        ? root.laps
        : [];

  return rows.flatMap((row, index) => {
    const record = asRecord(row);
    if (!record) return [];
    const durationS = num(
      record,
      "duration",
      "durationSeconds",
      "elapsedDuration",
    );
    const distanceM = num(record, "distance", "distanceMeters");
    const startedAt =
      parseGarminInstant(
        str(record, "startTimeGMT", "startTimeGmt", "startTime"),
      ) ?? null;
    return [
      {
        lapIndex: num(record, "lapIndex", "lapNumber") ?? index + 1,
        kind: "split" as const,
        startedAt,
        durationS: durationS != null ? Math.round(durationS) : null,
        distanceM,
        avgPaceSPerKm: derivedPace(
          distanceM,
          durationS != null ? Math.round(durationS) : null,
        ),
        avgHeartRateBpm: num(record, "averageHR", "avgHR", "avgHrBpm"),
        elevationGainM: num(record, "elevationGain", "elevationGainMeters"),
        maxHeartRateBpm: num(record, "maxHR", "maxHrBpm"),
        avgCadence: num(record, "averageRunCadence", "avgCadence"),
        elevationLossM: num(record, "elevationLoss", "elevationLossMeters"),
        caloriesKcal: num(record, "calories"),
      } satisfies CanonicalLap,
    ];
  });
}

export function parseGarminPolyline(
  raw: unknown,
  startedAt?: string | null,
): CanonicalTrackpoint[] {
  const root = asRecord(raw);
  const geo =
    asRecord(root?.geoPolylineDTO) ??
    asRecord(root?.geoPolylineDto) ??
    asRecord(root?.geoPolyline);
  const points = Array.isArray(geo?.polyline)
    ? geo.polyline
    : Array.isArray(geo?.points)
      ? geo.points
      : [];

  const startIso = parseGarminInstant(startedAt);
  const trackpoints: CanonicalTrackpoint[] = [];

  for (const point of points) {
    const record = asRecord(point);
    const latitude = toLatitude(num(record, "lat", "latitude"));
    const longitude = toLongitude(num(record, "lon", "lng", "longitude"));
    if (latitude == null || longitude == null) continue;
    const recordedAt = recordedAtFromGarminPoint({
      startedAt: startIso,
      offsetS: num(record, "timeOffsetInSeconds"),
      time: num(record, "time", "timestamp"),
    });
    if (!recordedAt) continue;
    trackpoints.push({
      pointIndex: trackpoints.length + 1,
      recordedAt,
      latitude,
      longitude,
      altitudeM: num(record, "altitude", "elevation"),
      distanceM: num(record, "distance"),
      heartRateBpm: num(record, "heartRate"),
      cadence: num(record, "cadence"),
      speedMps: num(record, "speed"),
      powerW: num(record, "power"),
      temperatureC: num(record, "temperature"),
    });
  }

  return trackpoints;
}

export function buildGarminPayload(parts: {
  summary?: Partial<GarminActivityPayload>;
  hrZones?: GarminHrZone[];
  weather?: GarminWeather | null;
}): GarminActivityPayload {
  return {
    detailVersion: GARMIN_DETAIL_VERSION,
    name: parts.summary?.name ?? null,
    eventType: parts.summary?.eventType ?? null,
    deviceManufacturer: parts.summary?.deviceManufacturer ?? null,
    elapsedDurationS: parts.summary?.elapsedDurationS ?? null,
    movingDurationS: parts.summary?.movingDurationS ?? null,
    avgSpeedMps: parts.summary?.avgSpeedMps ?? null,
    maxSpeedMps: parts.summary?.maxSpeedMps ?? null,
    minHeartRateBpm: parts.summary?.minHeartRateBpm ?? null,
    maxCadence: parts.summary?.maxCadence ?? null,
    avgStrideLengthCm: parts.summary?.avgStrideLengthCm ?? null,
    steps: parts.summary?.steps ?? null,
    trainingEffect: parts.summary?.trainingEffect ?? null,
    anaerobicTrainingEffect: parts.summary?.anaerobicTrainingEffect ?? null,
    moderateIntensityMinutes: parts.summary?.moderateIntensityMinutes ?? null,
    vigorousIntensityMinutes: parts.summary?.vigorousIntensityMinutes ?? null,
    maxElevationM: parts.summary?.maxElevationM ?? null,
    minElevationM: parts.summary?.minElevationM ?? null,
    hrZones: parts.hrZones ?? [],
    weather: parts.weather ?? null,
  };
}

export function readGarminPayload(
  value: Record<string, unknown> | null | undefined,
): GarminActivityPayload | null {
  const record = asRecord(value);
  if (!record) return null;
  if (toFiniteNumber(record.detailVersion) !== GARMIN_DETAIL_VERSION) {
    return null;
  }
  return record as unknown as GarminActivityPayload;
}

export function paceFromSpeedMps(
  speedMps: number | null | undefined,
): number | null {
  if (speedMps == null || speedMps <= 0) return null;
  return 1000 / speedMps;
}
