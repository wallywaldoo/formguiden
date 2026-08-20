import { NextResponse } from "next/server";

import sql from "@/lib/db";
import { getSession } from "@/lib/auth";
import { backfillGarminActivityDetails } from "@/lib/garmin/detail";

import { GarminClient } from "@/lib/garmin/client";
import { fetchGarminFitnessSnapshot } from "@/lib/garmin/fitness";
import {
  GARMIN_SESSION_INVALID_MESSAGE,
  userFacingGarminError,
} from "@/lib/garmin/session";
import { loadGarminSession } from "@/lib/garmin/session-file";

import { runGarminSync } from "../../cron/garmin-sync/sync";

type SyncMetadata = {
  lastSyncAt?: string;
  lastSuccessAt?: string;
  lastError?: string | null;
  lastTrigger?: "manual" | "auto";
  lastResult?: {
    days: number;
    activitiesUpserted: number;
    healthDaysUpserted: number;
    weightEntriesUpserted: number;
    errors: number;
  };
  fullSync?: {
    totalDays: number;
    completedDays: number;
    chunkDays: number;
    lastChunkStart?: string;
    lastChunkEnd?: string;
    done: boolean;
  };
  detailBackfill?: {
    status: "idle" | "running" | "done" | "error";
    processed: number;
    remaining: number;
    hydrated: number;
    lastError?: string | null;
    done: boolean;
  };
  fitness?: {
    syncedAt: string;
    vo2Max: number | null;
    trainingStatus: string | null;
    fitnessAge: number | null;
    chronologicalAge: number | null;
    racePredictions: {
      calendarDate: string | null;
      time5K: number | null;
      time10K: number | null;
      timeHalfMarathon: number | null;
      timeMarathon: number | null;
    } | null;
    personalRecords: {
      time1K: number | null;
      timeMile: number | null;
      time5K: number | null;
      time10K: number | null;
      timeHalfMarathon: number | null;
      timeMarathon: number | null;
      longestRunM: number | null;
    } | null;
  };
};

const FULL_SYNC_DAYS = 3650;
const FULL_SYNC_CHUNK_DAYS = 120;
const DETAIL_BACKFILL_BATCH = 3;

async function saveMetadata(metadata: SyncMetadata) {
  await sql`
    INSERT INTO integrations (provider, status, connected_at, metadata)
    VALUES ('garmin-api', 'active', now(), ${sql.json(metadata)})
    ON CONFLICT (provider)
    DO UPDATE SET
      status = 'active',
      connected_at = COALESCE(integrations.connected_at, now()),
      metadata = ${sql.json(metadata)},
      updated_at = now()
  `;
}

export async function POST(request: Request) {
  const authenticated = await getSession();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!loadGarminSession()) {
    return NextResponse.json(
      {
        error: process.env.GARMIN_SESSION?.trim()
          ? GARMIN_SESSION_INVALID_MESSAGE
          : "Garmin Connect är inte konfigurerat i miljön ännu.",
      },
      { status: 503 },
    );
  }

  let days = 14;
  let trigger: "manual" | "auto" = "manual";
  let scope: "recent" | "full" | "details" = "recent";

  try {
    const body = await request.json().catch(() => ({}));
    if (body?.scope === "full") {
      scope = "full";
      days = 3650;
    } else if (body?.scope === "details") {
      scope = "details";
    } else if (
      typeof body?.days === "number" &&
      body.days > 0 &&
      body.days <= 3650
    ) {
      days = body.days;
    }
    if (body?.trigger === "auto") {
      trigger = "auto";
    }
  } catch {
    // Keep defaults on invalid JSON.
  }

  const integrationRows = await sql`
    SELECT metadata
    FROM integrations
    WHERE provider = 'garmin-api'
    LIMIT 1
  `;
  const currentMetadata =
    integrationRows[0]?.metadata &&
    typeof integrationRows[0].metadata === "object" &&
    !Array.isArray(integrationRows[0].metadata)
      ? (integrationRows[0].metadata as SyncMetadata)
      : {};

  try {
    if (scope === "details") {
      const result = await backfillGarminActivityDetails({
        limit: DETAIL_BACKFILL_BATCH,
      });
      const metadata: SyncMetadata = {
        ...currentMetadata,
        lastSyncAt: new Date().toISOString(),
        lastSuccessAt: new Date().toISOString(),
        lastError: result.errors[0] ?? null,
        lastTrigger: trigger,
        detailBackfill: {
          status: result.done
            ? "done"
            : result.errors.length > 0
              ? "error"
              : "running",
          processed:
            (currentMetadata.detailBackfill?.processed ?? 0) + result.processed,
          remaining: result.remaining,
          hydrated:
            (currentMetadata.detailBackfill?.hydrated ?? 0) + result.hydrated,
          lastError: result.errors[0] ?? null,
          done: result.done,
        },
      };
      await saveMetadata(metadata);
      return NextResponse.json({
        ok: true,
        scope,
        trigger,
        ...result,
        detailBackfill: metadata.detailBackfill,
      });
    }

    const today = new Date();
    let result;
    let metadata: SyncMetadata;

    if (scope === "full") {
      const currentFull = currentMetadata.fullSync;
      const completedDays = currentFull?.done
        ? 0
        : Math.max(0, currentFull?.completedDays ?? 0);
      const chunkEnd = new Date(today);
      chunkEnd.setDate(today.getDate() - completedDays);
      const earliest = new Date(today);
      earliest.setDate(today.getDate() - (FULL_SYNC_DAYS - 1));
      const chunkStart = new Date(chunkEnd);
      chunkStart.setDate(chunkEnd.getDate() - (FULL_SYNC_CHUNK_DAYS - 1));
      if (chunkStart < earliest) {
        chunkStart.setTime(earliest.getTime());
      }

      const chunkStartStr = chunkStart.toISOString().split("T")[0];
      const chunkEndStr = chunkEnd.toISOString().split("T")[0];
      const chunkDays =
        Math.floor(
          (Date.parse(`${chunkEndStr}T12:00:00Z`) -
            Date.parse(`${chunkStartStr}T12:00:00Z`)) /
            86_400_000,
        ) + 1;

      result = await runGarminSync({
        days: chunkDays,
        startDate: chunkStartStr,
        endDate: chunkEndStr,
      });

      const nextCompleted = Math.min(FULL_SYNC_DAYS, completedDays + chunkDays);
      metadata = {
        ...currentMetadata,
        lastSyncAt: result.syncedAt,
        lastSuccessAt: result.syncedAt,
        lastError: result.errors[0] ?? null,
        lastTrigger: trigger,
        lastResult: {
          days: result.days,
          activitiesUpserted: result.activitiesUpserted,
          healthDaysUpserted: result.healthDaysUpserted,
          weightEntriesUpserted: result.weightEntriesUpserted,
          errors: result.errors.length,
        },
        fullSync: {
          totalDays: FULL_SYNC_DAYS,
          completedDays: nextCompleted,
          chunkDays: FULL_SYNC_CHUNK_DAYS,
          lastChunkStart: chunkStartStr,
          lastChunkEnd: chunkEndStr,
          done: nextCompleted >= FULL_SYNC_DAYS,
        },
      };
    } else {
      result = await runGarminSync({ days });
      metadata = {
        ...currentMetadata,
        lastSyncAt: result.syncedAt,
        lastSuccessAt: result.syncedAt,
        lastError: result.errors[0] ?? null,
        lastTrigger: trigger,
        lastResult: {
          days: result.days,
          activitiesUpserted: result.activitiesUpserted,
          healthDaysUpserted: result.healthDaysUpserted,
          weightEntriesUpserted: result.weightEntriesUpserted,
          errors: result.errors.length,
        },
      };
    }

    const syncedAt = new Date().toISOString();
    metadata.lastSyncAt = syncedAt;
    metadata.lastSuccessAt = syncedAt;

    try {
      const fitness = await fetchGarminFitnessSnapshot(GarminClient.fromEnv());
      metadata.fitness = {
        syncedAt: fitness.syncedAt,
        vo2Max: fitness.vo2Max,
        trainingStatus: fitness.trainingStatus,
        fitnessAge: fitness.fitnessAge,
        chronologicalAge: fitness.chronologicalAge,
        racePredictions: fitness.racePredictions,
        personalRecords: fitness.personalRecords,
      };
    } catch {
      if (currentMetadata.fitness) {
        metadata.fitness = currentMetadata.fitness;
      }
    }

    await saveMetadata(metadata);

    try {
      const { invalidateTrainingPlans } =
        await import("@/features/training-plan/service");
      await invalidateTrainingPlans();
    } catch {
      // Plan refresh is best-effort after a successful sync.
    }

    return NextResponse.json({
      ok: true,
      ...result,
      trigger,
      scope,
      fullSync: metadata.fullSync ?? null,
      detailBackfill: metadata.detailBackfill ?? null,
    });
  } catch (err) {
    const message = userFacingGarminError(
      err instanceof Error ? err.message : String(err),
    );
    const failedAt = new Date().toISOString();
    const metadata: SyncMetadata = {
      ...currentMetadata,
      lastSyncAt: failedAt,
      lastError: message,
      lastTrigger: trigger,
    };

    await sql`
      INSERT INTO integrations (provider, status, connected_at, metadata)
      VALUES ('garmin-api', 'active', now(), ${sql.json(metadata)})
      ON CONFLICT (provider)
      DO UPDATE SET
        status = 'active',
        connected_at = COALESCE(integrations.connected_at, now()),
        metadata = integrations.metadata || ${sql.json(metadata)},
        updated_at = now()
    `;

    console.error("[garmin-sync app route] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
