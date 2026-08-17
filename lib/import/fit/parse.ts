import { Decoder, Stream } from "@garmin/fitsdk";

import { sha256Hex } from "@/lib/import/checksum";
import {
  derivedPace,
  positiveInt,
  positiveNumber,
  toIso,
  toLocalDate,
} from "@/lib/import/normalize";
import type {
  ActivityType,
  CanonicalActivity,
  CanonicalBodyMeasurement,
  CanonicalDailyHealth,
  CanonicalLap,
  ParseResult,
} from "@/lib/import/types";

type FitMessage = Record<string, unknown>;

function asMessages(value: unknown): FitMessage[] {
  return Array.isArray(value) ? (value as FitMessage[]) : [];
}

function num(message: FitMessage, key: string): number | null {
  return positiveNumber(message[key]);
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
    avgCadence: num(session, "avgCadence"),
    caloriesKcal: num(session, "totalCalories"),
    trainingLoad:
      num(session, "trainingStressScore") ??
      num(session, "totalTrainingEffect"),
    notes: null,
    laps,
  };
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
  const activities: CanonicalActivity[] = [];

  for (const session of sessions) {
    const activity = toActivity(session, laps, fileId, bytes);
    if (activity) {
      activities.push(activity);
    }
  }

  if (activities.length === 0) {
    const activityMesg = asMessages(messages.activityMesgs)[0];
    if (activityMesg) {
      const fallback = toActivity(activityMesg, laps, fileId, bytes);
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
