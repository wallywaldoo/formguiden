import type { GarminRacePredictions } from "@/lib/analytics/race-estimates";
import { GarminClient } from "@/lib/garmin/client";
import {
  hasRunningRecords,
  type GarminRunningRecords,
} from "@/lib/garmin/personal-records";

export type GarminFitnessSnapshot = {
  syncedAt: string;
  racePredictions: GarminRacePredictions | null;
  personalRecords: GarminRunningRecords | null;
  vo2Max: number | null;
  trainingStatus: string | null;
  fitnessAge: number | null;
  chronologicalAge: number | null;
};

function asPositiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function asPositiveInt(value: unknown): number | null {
  const n = asPositiveNumber(value);
  return n != null ? Math.round(n) : null;
}

export async function fetchGarminFitnessSnapshot(
  client: GarminClient,
): Promise<GarminFitnessSnapshot> {
  const syncedAt = new Date().toISOString();
  const [raceRaw, vo2Raw, recordsRaw, trainingStatusRaw, fitnessAgeRaw] =
    await Promise.all([
      client.getRacePredictionsOptional(),
      client.getVo2MaxOptional(),
      client.getPersonalRecordsOptional(),
      client.getTrainingStatusOptional(),
      client.getFitnessAgeOptional(),
    ]);

  return {
    syncedAt,
    racePredictions: raceRaw,
    personalRecords: recordsRaw,
    vo2Max: vo2Raw,
    trainingStatus: trainingStatusRaw?.label ?? null,
    fitnessAge: fitnessAgeRaw?.fitnessAge ?? null,
    chronologicalAge: fitnessAgeRaw?.chronologicalAge ?? null,
  };
}

export function readGarminFitnessMetadata(
  metadata: Record<string, unknown> | null | undefined,
): GarminFitnessSnapshot | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }
  const fitness = metadata.fitness;
  if (!fitness || typeof fitness !== "object" || Array.isArray(fitness)) {
    return null;
  }
  const row = fitness as Record<string, unknown>;
  const predictions = row.racePredictions;
  const predictionRow =
    predictions &&
    typeof predictions === "object" &&
    !Array.isArray(predictions)
      ? (predictions as Record<string, unknown>)
      : null;

  const stored =
    row.personalRecords &&
    typeof row.personalRecords === "object" &&
    !Array.isArray(row.personalRecords)
      ? (row.personalRecords as Record<string, unknown>)
      : null;
  const personalRecords: GarminRunningRecords | null = stored
    ? {
        time1K: asPositiveNumber(stored.time1K),
        timeMile: asPositiveNumber(stored.timeMile),
        time5K: asPositiveNumber(stored.time5K),
        time10K: asPositiveNumber(stored.time10K),
        timeHalfMarathon: asPositiveNumber(stored.timeHalfMarathon),
        timeMarathon: asPositiveNumber(stored.timeMarathon),
        longestRunM: asPositiveNumber(stored.longestRunM),
      }
    : null;

  return {
    syncedAt: typeof row.syncedAt === "string" ? row.syncedAt : "",
    vo2Max: asPositiveNumber(row.vo2Max),
    trainingStatus:
      typeof row.trainingStatus === "string" ? row.trainingStatus : null,
    fitnessAge: asPositiveInt(row.fitnessAge),
    chronologicalAge: asPositiveInt(row.chronologicalAge),
    personalRecords: hasRunningRecords(personalRecords)
      ? personalRecords
      : null,
    racePredictions: predictionRow
      ? {
          calendarDate:
            typeof predictionRow.calendarDate === "string"
              ? predictionRow.calendarDate
              : null,
          time5K: asPositiveNumber(predictionRow.time5K),
          time10K: asPositiveNumber(predictionRow.time10K),
          timeHalfMarathon: asPositiveNumber(predictionRow.timeHalfMarathon),
          timeMarathon: asPositiveNumber(predictionRow.timeMarathon),
        }
      : null,
  };
}
