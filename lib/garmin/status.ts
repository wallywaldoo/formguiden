import {
  garminSessionConfigurationError,
  readGarminSessionFromEnv,
  userFacingGarminError,
} from "@/lib/garmin/session";

export type GarminSyncStatus = {
  connected: boolean;
  configurationError: string | null;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastTrigger: "manual" | "auto" | null;
  lastResult: {
    days: number;
    activitiesUpserted: number;
    healthDaysUpserted: number;
    weightEntriesUpserted: number;
    errors: number;
  } | null;
  fullSync: {
    totalDays: number;
    completedDays: number;
    chunkDays: number;
    lastChunkStart?: string;
    lastChunkEnd?: string;
    done: boolean;
  } | null;
  detailBackfill: {
    status: "idle" | "running" | "done" | "error";
    processed: number;
    remaining: number;
    hydrated: number;
    done: boolean;
  } | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function readGarminSyncStatus(
  integration: {
    status: string;
    metadata: Record<string, unknown> | null;
  } | null,
): GarminSyncStatus {
  const metadata = asRecord(integration?.metadata);
  const lastResult = asRecord(metadata?.lastResult);
  const fullSync = asRecord(metadata?.fullSync);
  const detailBackfill = asRecord(metadata?.detailBackfill);
  const detailStatus = detailBackfill?.status;
  const configurationError = garminSessionConfigurationError();
  const connected = readGarminSessionFromEnv() != null;
  const storedError = asString(metadata?.lastError);
  const lastError =
    configurationError ??
    (storedError ? userFacingGarminError(storedError) : null);

  return {
    connected,
    configurationError,
    lastSyncAt: asString(metadata?.lastSyncAt) ?? null,
    lastSuccessAt: asString(metadata?.lastSuccessAt) ?? null,
    lastError,
    lastTrigger:
      metadata?.lastTrigger === "manual" || metadata?.lastTrigger === "auto"
        ? metadata.lastTrigger
        : null,
    lastResult: lastResult
      ? {
          days: asNumber(lastResult.days, 14),
          activitiesUpserted: asNumber(lastResult.activitiesUpserted, 0),
          healthDaysUpserted: asNumber(lastResult.healthDaysUpserted, 0),
          weightEntriesUpserted: asNumber(lastResult.weightEntriesUpserted, 0),
          errors: asNumber(lastResult.errors, 0),
        }
      : null,
    fullSync: fullSync
      ? {
          totalDays: asNumber(fullSync.totalDays, 3650),
          completedDays: asNumber(fullSync.completedDays, 0),
          chunkDays: asNumber(fullSync.chunkDays, 30),
          lastChunkStart: asString(fullSync.lastChunkStart),
          lastChunkEnd: asString(fullSync.lastChunkEnd),
          done: fullSync.done === true,
        }
      : null,
    detailBackfill: detailBackfill
      ? {
          status:
            detailStatus === "running" ||
            detailStatus === "done" ||
            detailStatus === "error"
              ? detailStatus
              : "idle",
          processed: asNumber(detailBackfill.processed, 0),
          remaining: asNumber(detailBackfill.remaining, 0),
          hydrated: asNumber(detailBackfill.hydrated, 0),
          done: detailBackfill.done === true,
        }
      : null,
  };
}
