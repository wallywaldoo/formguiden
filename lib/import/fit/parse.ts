import { Decoder, Stream } from "@garmin/fitsdk";

import { sha256Hex } from "@/lib/import/checksum";
import {
  derivedPace,
  positiveInt,
  positiveNumber,
  toIso,
  toLocalDate,
} from "@/lib/import/normalize";
import { toLatitude, toLongitude } from "@/lib/garmin/geo";
import type {
  ActivityType,
  CanonicalActivity,
  CanonicalActivitySample,
  CanonicalBodyMeasurement,
  CanonicalDailyHealth,
  CanonicalLap,
  CanonicalTrackpoint,
  ParseResult,
} from "@/lib/import/types";

type FitMessage = Record<string, unknown>;

function asMessages(value: unknown): FitMessage[] {
  return Array.isArray(value) ? (value as FitMessage[]) : [];
}

function num(message: FitMessage, key: string): number | null {
  return positiveNumber(message[key]);
}

function anyNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function dateIso(message: FitMessage, key: string): string | null {
  return toIso(message[key] as Date | string | number | null);
}

function mapSport(value: unknown): ActivityType {
  const sport = String(value ?? "").toLowerCase();
  if (sport.includes("trail")) {
    return "trail_run";
  }
  if (sport.includes("treadmill")) {
    return "treadmill";
  }
  if (sport.includes("run") || sport === "running") {
    return "run";
  }
  if (sport.includes("walk")) {
    return "walk";
  }
  if (sport.includes("hik")) {
    return "hike";
  }
  if (sport.includes("cycl") || sport.includes("bik")) {
    return "cycle";
  }
  if (sport.includes("train") || sport.includes("strength")) {
    return "strength";
  }
  return "other";
}

function buildExternalId(
  fileId: FitMessage | undefined,
  startedAt: string,
  bytes: Uint8Array,
): string {
  const parts = [
    fileId?.manufacturer,
    fileId?.product,
    fileId?.serialNumber,
    startedAt,
  ]
    .filter((part) => part != null && String(part).length > 0)
    .map(String);
  if (parts.length >= 2) {
    return `garmin-file:${parts.join(":")}`;
  }
  return `garmin-file:${sha256Hex(bytes)}:${startedAt}`;
}

function toActivity(
  session: FitMessage,
  laps: CanonicalLap[],
  trackpoints: CanonicalTrackpoint[],
  samples: CanonicalActivitySample[],
  fileId: FitMessage | undefined,
  bytes: Uint8Array,
): CanonicalActivity | null {
  const startedAt =
    dateIso(session, "startTime") ?? dateIso(session, "timestamp");
  if (!startedAt) {
    return null;
  }
  const durationS =
    positiveInt(session.totalTimerTime) ??
    positiveInt(session.totalElapsedTime);
  const distanceM = num(session, "totalDistance");
  return {
    externalId: buildExternalId(fileId, startedAt, bytes),
    activityType: mapSport(session.sport ?? session.subSport),
    startedAt,
    endedAt: dateIso(session, "timestamp"),
    durationS,
    durationKind: session.totalTimerTime != null ? "moving" : "elapsed",
    distanceM,
    elevationGainM: num(session, "totalAscent"),
    elevationLossM: num(session, "totalDescent"),
    avgPaceSPerKm: derivedPace(distanceM, durationS),
    avgHeartRateBpm: num(session, "avgHeartRate"),
    maxHeartRateBpm: num(session, "maxHeartRate"),
    avgCadence: runningCadence(
      mapSport(session.sport ?? session.subSport),
      num(session, "avgCadence"),
    ),
    caloriesKcal: num(session, "totalCalories"),
    trainingLoad:
      num(session, "trainingStressScore") ??
      num(session, "totalTrainingEffect"),
    notes: null,
    laps,
    trackpoints,
    samples,
    providerPayload: {
      avgSpeed: anyNumber(session.avgSpeed),
      maxSpeed: anyNumber(session.maxSpeed),
      avgPower: anyNumber(session.avgPower),
      maxPower: anyNumber(session.maxPower),
      normalizedPower: anyNumber(session.normalizedPower),
      trainingEffect: anyNumber(session.totalTrainingEffect),
      anaerobicTrainingEffect: anyNumber(session.totalAnaerobicTrainingEffect),
      event: session.event,
      eventType: session.eventType,
      sport: session.sport,
      subSport: session.subSport,
    },
  };
}

function runningCadence(
  activityType: ActivityType,
  cadence: number | null,
): number | null {
  if (cadence == null) return null;
  const isRun =
    activityType === "run" ||
    activityType === "trail_run" ||
    activityType === "treadmill";
  return isRun && cadence > 0 && cadence < 100 ? cadence * 2 : cadence;
}

function toLaps(messages: FitMessage[]): CanonicalLap[] {
  return messages.map((lap, index) => {
    const durationS =
      positiveInt(lap.totalTimerTime) ?? positiveInt(lap.totalElapsedTime);
    const distanceM = num(lap, "totalDistance");
    return {
      lapIndex: index + 1,
      kind: "lap" as const,
      startedAt: dateIso(lap, "startTime"),
      durationS,
      distanceM,
      avgPaceSPerKm: derivedPace(distanceM, durationS),
      avgHeartRateBpm: num(lap, "avgHeartRate"),
      elevationGainM: num(lap, "totalAscent"),
    };
  });
}

function toTrackpoints(
  messages: FitMessage[],
  activityType: ActivityType,
): { trackpoints: CanonicalTrackpoint[]; samples: CanonicalActivitySample[] } {
  const trackpoints: CanonicalTrackpoint[] = [];
  const samples: CanonicalActivitySample[] = [];
  const firstRecordedAt = dateIso(messages[0] ?? {}, "timestamp");

  for (const [index, record] of messages.entries()) {
    const recordedAt = dateIso(record, "timestamp");
    if (!recordedAt) continue;

    const heartRateBpm = num(record, "heartRate");
    const cadence = runningCadence(activityType, num(record, "cadence"));
    const speedMps = anyNumber(record.enhancedSpeed) ?? anyNumber(record.speed);
    const altitudeM =
      anyNumber(record.enhancedAltitude) ?? anyNumber(record.altitude);
    const distanceM = num(record, "distance");
    const powerW = num(record, "power");
    const temperatureC = anyNumber(record.temperature);
    const elapsedS = firstRecordedAt
      ? Math.max(
          0,
          Math.round(
            (Date.parse(recordedAt) - Date.parse(firstRecordedAt)) / 1000,
          ),
        )
      : null;

    samples.push({
      sampleIndex: index + 1,
      recordedAt,
      elapsedS,
      distanceM,
      heartRateBpm,
      cadence,
      speedMps,
      altitudeM,
      powerW,
      temperatureC,
    });

    const latitude = toLatitude(anyNumber(record.positionLat));
    const longitude = toLongitude(anyNumber(record.positionLong));
    if (latitude == null || longitude == null) continue;

    trackpoints.push({
      pointIndex: trackpoints.length + 1,
      recordedAt,
      latitude,
      longitude,
      altitudeM,
      distanceM,
      heartRateBpm,
      cadence,
      speedMps,
      powerW,
      temperatureC,
    });
  }

  return { trackpoints, samples };
}

export function parseFit(bytes: Uint8Array): ParseResult {
  const warnings: ParseResult["warnings"] = [];
  const stream = Stream.fromByteArray(Array.from(bytes));
  const decoder = new Decoder(stream);
  if (!decoder.isFIT()) {
    return {
      activities: [],
      dailyHealth: [],
      bodyMeasurements: [],
      warnings: [
        { code: "not_fit", message: "Filen är inte en giltig FIT-fil." },
      ],
    };
  }

  const decoded = decoder.read({
    applyScaleAndOffset: true,
    convertTypesToStrings: true,
    convertDateTimesToDates: true,
    mergeHeartRates: true,
  });
  const messages = decoded.messages as unknown as Record<string, unknown>;
  const errors = decoded.errors;

  if (errors?.length) {
    warnings.push({
      code: "fit_decode",
      message: "FIT-filen kunde bara läsas delvis.",
    });
  }

  const fileId = asMessages(messages.fileIdMesgs)[0];
  const sessions = asMessages(messages.sessionMesgs);
  const laps = toLaps(asMessages(messages.lapMesgs));
  const sportHint = mapSport(sessions[0]?.sport ?? sessions[0]?.subSport);
  const { trackpoints, samples } = toTrackpoints(
    asMessages(messages.recordMesgs),
    sportHint,
  );
  const activities: CanonicalActivity[] = [];

  for (const session of sessions) {
    const activity = toActivity(
      session,
      laps,
      trackpoints,
      samples,
      fileId,
      bytes,
    );
    if (activity) {
      activities.push(activity);
    }
  }

  if (activities.length === 0) {
    const activityMesg = asMessages(messages.activityMesgs)[0];
    if (activityMesg) {
      const fallback = toActivity(
        activityMesg,
        laps,
        trackpoints,
        samples,
        fileId,
        bytes,
      );
      if (fallback) {
        activities.push(fallback);
      }
    }
  }

  const dailyHealth: CanonicalDailyHealth[] = [];
  for (const sleep of asMessages(messages.sleepAssessmentMesgs).concat(
    asMessages(messages.sleepLevelMesgs),
  )) {
    const start = dateIso(sleep, "startTime") ?? dateIso(sleep, "timestamp");
    if (!start) {
      continue;
    }
    dailyHealth.push({
      externalId: `garmin-file:sleep:${start}`,
      localDate: toLocalDate(start),
      sleepDurationS:
        positiveInt(sleep.totalSleepTime) ?? positiveInt(sleep.duration),
      sleepStartAt: start,
      sleepEndAt: dateIso(sleep, "endTime"),
      sleepLightS: positiveInt(sleep.lightSleepTime),
      sleepDeepS: positiveInt(sleep.deepSleepTime),
      sleepRemS: positiveInt(sleep.remSleepTime),
      sleepAwakeS: positiveInt(sleep.awakeTime),
      hrvRmssdMs: num(sleep, "hrvRmssd"),
      restingHeartRateBpm: num(sleep, "restingHeartRate"),
      stressAvg: null,
      bodyBatteryHigh: null,
      bodyBatteryLow: null,
      steps: null,
      respirationAvgBrpm: null,
    });
  }

  const bodyMeasurements: CanonicalBodyMeasurement[] = [];
  for (const weight of asMessages(messages.weightScaleMesgs)) {
    const measuredAt = dateIso(weight, "timestamp");
    const massKg = num(weight, "weight");
    if (!measuredAt || massKg == null) {
      continue;
    }
    bodyMeasurements.push({
      externalId: `garmin-file:weight:${measuredAt}`,
      measuredAt,
      massKg,
      bodyFatPct: num(weight, "percentFat"),
    });
  }

  if (
    activities.length === 0 &&
    dailyHealth.length === 0 &&
    bodyMeasurements.length === 0
  ) {
    warnings.push({
      code: "empty_fit",
      message: "FIT-filen innehöll inga aktiviteter, sömn eller viktdata.",
    });
  }

  if (activities.some((activity) => activity.avgHeartRateBpm == null)) {
    warnings.push({
      code: "no_heart_rate",
      message: "Puls saknas i minst en aktivitet.",
    });
  }

  return { activities, dailyHealth, bodyMeasurements, warnings };
}
