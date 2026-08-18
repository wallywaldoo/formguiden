import { INSERT_AUDIT_EVENT } from "@/lib/graphql/mutations/profile";
import {
  INSERT_ACTIVITY_LAP_PREVIEWS,
  INSERT_ACTIVITY_PREVIEW,
  INSERT_BODY_PREVIEW,
  INSERT_HEALTH_PREVIEW,
  INSERT_IMPORT_FILE,
  UPDATE_DATA_IMPORT,
  UPDATE_IMPORT_FILE,
  UPDATE_IMPORT_JOB,
} from "@/lib/graphql/mutations/imports";
import {
  GET_COMMITTED_FILES_BY_HASH,
  GET_IMPORT,
  GET_STORAGE_FILE,
} from "@/lib/graphql/queries/imports";
import { GET_PROFILE_SETTINGS } from "@/lib/graphql/queries/profile";
import { graphqlRequest } from "@/lib/graphql/client";
import type { ImportProviderId } from "@/lib/import/adapters/types";
import { sha256Hex } from "@/lib/import/checksum";
import { scanForCredentialMaterial } from "@/lib/import/credentials/scan";
import { detectFileKind } from "@/lib/import/detect";
import { entriesContainDatabase } from "@/lib/import/garmindb/archive";
import { GarminDbRejectionError } from "@/lib/import/garmindb/errors";
import { PREVIEW_TTL_DAYS, PROCESS_LEASE_SECONDS } from "@/lib/import/limits";
import { inspectAndParse } from "@/lib/import/parse-bytes";
import type { ParseResult } from "@/lib/import/types";
import { ZipLimitError, listZipEntries } from "@/lib/import/zip";
import { DEFAULT_TIMEZONE, GARMIN_IMPORTS_BUCKET } from "@/lib/constants";
import { createNhostClient } from "@/lib/nhost/server";

export type SliceResult = {
  status: "continue" | "done" | "error";
  importId: string;
  importStatus?: string;
  error?: string;
};

type ImportFileRow = {
  id: string;
  storage_file_id: string;
  original_filename: string | null;
  detected_kind: string | null;
  byte_size: number;
  sha256: string;
  status: string;
  zip_entry_path: string | null;
  error_code: string | null;
  error_message: string | null;
};

type ImportJobRow = {
  id: string;
  cursor: { fileId?: string; entryIndex?: number };
  lease_expires_at: string | null;
  attempt_count: number;
  last_error: string | null;
};

async function downloadStorageFile(
  fileId: string,
  userId: string,
): Promise<Uint8Array> {
  const nhost = await createNhostClient();
  const meta = await graphqlRequest<{
    files_by_pk: {
      id: string;
      bucket_id: string;
      uploaded_by_user_id: string | null;
    } | null;
  }>(GET_STORAGE_FILE, { id: fileId });

  const file = meta.files_by_pk;
  if (
    !file ||
    file.bucket_id !== GARMIN_IMPORTS_BUCKET ||
    file.uploaded_by_user_id !== userId
  ) {
    throw new Error("Filen tillhör inte det här kontot.");
  }

  const response = await nhost.storage.getFile(fileId);
  return new Uint8Array(await response.body.arrayBuffer());
}

function expiresAt(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + PREVIEW_TTL_DAYS);
  return date.toISOString();
}

async function resolveTimeZone(): Promise<string> {
  try {
    const profile = await graphqlRequest<{
      user_preferences: Array<{ timezone: string }>;
    }>(GET_PROFILE_SETTINGS);
    return profile.user_preferences[0]?.timezone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

async function writePreviews(
  importId: string,
  importFileId: string,
  parsed: ParseResult,
  source: ImportProviderId,
) {
  const expires = expiresAt();
  for (const activity of parsed.activities) {
    const inserted = await graphqlRequest<{
      insert_activity_previews_one: { id: string };
    }>(INSERT_ACTIVITY_PREVIEW, {
      object: {
        import_id: importId,
        import_file_id: importFileId,
        expires_at: expires,
        source,
        external_id: activity.externalId,
        activity_type: activity.activityType,
        started_at: activity.startedAt,
        ended_at: activity.endedAt,
        duration_s: activity.durationS,
        duration_kind: activity.durationKind,
        distance_m: activity.distanceM,
        elevation_gain_m: activity.elevationGainM,
        elevation_loss_m: activity.elevationLossM,
        avg_pace_s_per_km: activity.avgPaceSPerKm,
        avg_heart_rate_bpm: activity.avgHeartRateBpm,
        max_heart_rate_bpm: activity.maxHeartRateBpm,
        avg_cadence: activity.avgCadence,
        calories_kcal: activity.caloriesKcal,
        training_load: activity.trainingLoad,
        notes: activity.notes,
      },
    });
    if (activity.laps.length > 0) {
      await graphqlRequest(INSERT_ACTIVITY_LAP_PREVIEWS, {
        objects: activity.laps.map((lap) => ({
          import_id: importId,
          activity_preview_id: inserted.insert_activity_previews_one.id,
          lap_index: lap.lapIndex,
          kind: lap.kind,
          started_at: lap.startedAt,
          duration_s: lap.durationS,
          distance_m: lap.distanceM,
          avg_pace_s_per_km: lap.avgPaceSPerKm,
          avg_heart_rate_bpm: lap.avgHeartRateBpm,
          elevation_gain_m: lap.elevationGainM,
        })),
      });
    }
  }
  for (const day of parsed.dailyHealth) {
    await graphqlRequest(INSERT_HEALTH_PREVIEW, {
      object: {
        import_id: importId,
        import_file_id: importFileId,
        expires_at: expires,
        source,
        ...{
          external_id: day.externalId,
          local_date: day.localDate,
          sleep_duration_s: day.sleepDurationS,
          sleep_start_at: day.sleepStartAt,
          sleep_end_at: day.sleepEndAt,
          sleep_light_s: day.sleepLightS,
          sleep_deep_s: day.sleepDeepS,
          sleep_rem_s: day.sleepRemS,
          sleep_awake_s: day.sleepAwakeS,
          hrv_rmssd_ms: day.hrvRmssdMs,
          resting_heart_rate_bpm: day.restingHeartRateBpm,
          stress_avg: day.stressAvg,
          body_battery_high: day.bodyBatteryHigh,
          body_battery_low: day.bodyBatteryLow,
          steps: day.steps,
          respiration_avg_brpm: day.respirationAvgBrpm,
        },
      },
    });
  }
  for (const body of parsed.bodyMeasurements) {
    await graphqlRequest(INSERT_BODY_PREVIEW, {
      object: {
        import_id: importId,
        import_file_id: importFileId,
        expires_at: expires,
        source,
        external_id: body.externalId,
        measured_at: body.measuredAt,
        mass_kg: body.massKg,
        body_fat_pct: body.bodyFatPct,
      },
    });
  }
}

async function markFile(
  id: string,
  status: string,
  extra?: {
    error_code?: string;
    error_message?: string;
    detected_kind?: string;
    sha256?: string;
    source_provenance?: Record<string, unknown>;
  },
) {
  await graphqlRequest(UPDATE_IMPORT_FILE, {
    id,
    set: {
      status,
      ...(extra?.detected_kind ? { detected_kind: extra.detected_kind } : {}),
      ...(extra?.error_code ? { error_code: extra.error_code } : {}),
      ...(extra?.error_message ? { error_message: extra.error_message } : {}),
      ...(extra?.sha256 ? { sha256: extra.sha256 } : {}),
      ...(extra?.source_provenance
        ? { source_provenance: extra.source_provenance }
        : {}),
    },
  });
}

async function isCommittedHash(sha256: string): Promise<boolean> {
  const data = await graphqlRequest<{ import_files: Array<{ id: string }> }>(
    GET_COMMITTED_FILES_BY_HASH,
    { sha256 },
  );
  return data.import_files.length > 0;
}

async function handleParsedBytes(args: {
  importId: string;
  fileId: string;
  bytes: Uint8Array;
  detectedKind?: string;
  timeZone: string;
}) {
  const hash = sha256Hex(args.bytes);
  if (await isCommittedHash(hash)) {
    await markFile(args.fileId, "duplicate", {
      detected_kind: args.detectedKind,
      sha256: hash,
    });
    return;
  }
  const inspected = await inspectAndParse(args.bytes, {
    timeZone: args.timeZone,
  });
  if (
    inspected.parse.activities.length === 0 &&
    inspected.parse.dailyHealth.length === 0 &&
    inspected.parse.bodyMeasurements.length === 0 &&
    inspected.kind !== "zip"
  ) {
    await markFile(args.fileId, "failed", {
      detected_kind: inspected.kind,
      sha256: hash,
      error_code: inspected.parse.warnings[0]?.code ?? "empty",
      error_message:
        inspected.parse.warnings[0]?.message ?? "Inget kunde tolkas ur filen.",
    });
    return;
  }
  await writePreviews(
    args.importId,
    args.fileId,
    inspected.parse,
    inspected.source,
  );
  await markFile(args.fileId, "previewed", {
    detected_kind: inspected.kind,
    sha256: hash,
    source_provenance: inspected.provenance,
  });
}

function summarize(files: ImportFileRow[]) {
  return {
    previewed_count: files.filter((file) => file.status === "previewed").length,
    failed_count: files.filter((file) => file.status === "failed").length,
    duplicate_count: files.filter((file) => file.status === "duplicate").length,
  };
}

function finalStatus(files: ImportFileRow[]) {
  const failed = files.filter((file) => file.status === "failed").length;
  const previewed = files.filter((file) => file.status === "previewed").length;
  if (previewed === 0 && failed > 0) {
    return "failed";
  }
  if (failed > 0) {
    return "partial";
  }
  return "preview_ready";
}

export async function processImportSlice(
  importId: string,
): Promise<SliceResult> {
  const userId = (await createNhostClient()).getUserSession()?.user?.id;
  if (!userId) {
    return { status: "error", importId, error: "Du är inte inloggad." };
  }

  const data = await graphqlRequest<{
    data_imports_by_pk: { id: string; status: string } | null;
    import_files: ImportFileRow[];
    import_jobs: ImportJobRow[];
  }>(GET_IMPORT, { id: importId });

  const importRow = data.data_imports_by_pk;
  const job = data.import_jobs[0];
  if (!importRow || !job) {
    return { status: "error", importId, error: "Importen hittades inte." };
  }
  if (
    ["preview_ready", "partial", "failed", "committed", "abandoned"].includes(
      importRow.status,
    )
  ) {
    return { status: "done", importId, importStatus: importRow.status };
  }

  const now = new Date();
  const lease = new Date(now.getTime() + PROCESS_LEASE_SECONDS * 1000);
  await graphqlRequest(UPDATE_IMPORT_JOB, {
    id: job.id,
    set: {
      lease_expires_at: lease.toISOString(),
      heartbeat_at: now.toISOString(),
      attempt_count: job.attempt_count + 1,
    },
  });
  await graphqlRequest(UPDATE_DATA_IMPORT, {
    id: importId,
    set: { status: "processing" },
  });

  const files = data.import_files;
  const topLevel = files.filter((file) => !file.zip_entry_path);
  const pending = topLevel.filter((file) =>
    ["pending", "processing"].includes(file.status),
  );
  const current =
    (job.cursor.fileId
      ? pending.find((file) => file.id === job.cursor.fileId)
      : pending[0]) ?? pending[0];

  if (!current) {
    const counts = summarize(files);
    const status = finalStatus(files);
    await graphqlRequest(UPDATE_DATA_IMPORT, {
      id: importId,
      set: { status, ...counts },
    });
    await graphqlRequest(INSERT_AUDIT_EVENT, {
      action: "import.preview_ready",
      entity_type: "data_imports",
      entity_id: importId,
    });
    return { status: "done", importId, importStatus: status };
  }

  const timeZone = await resolveTimeZone();

  try {
    const bytes = await downloadStorageFile(current.storage_file_id, userId);

    const kind = detectFileKind(bytes);
    if (kind === "zip") {
      const entries = listZipEntries(bytes);

      // One credential-bearing entry condemns the whole archive. Rejecting
      // per entry would let a hostile archive import its payload anyway.
      const finding = entries
        .map((entry) => scanForCredentialMaterial(entry.bytes))
        .find((result) => result !== null);

      const entryIndex =
        job.cursor.fileId === current.id ? (job.cursor.entryIndex ?? 0) : 0;

      if (finding) {
        await markFile(current.id, "failed", {
          detected_kind: "zip",
          error_code: finding.code,
          error_message: finding.message,
        });
        await graphqlRequest(UPDATE_IMPORT_JOB, {
          id: job.id,
          set: { cursor: {}, last_error: finding.message },
        });
      } else if (entriesContainDatabase(entries)) {
        // Parsed as one unit so the tighter GarminDB archive rules apply.
        await handleParsedBytes({
          importId,
          fileId: current.id,
          bytes,
          detectedKind: "zip",
          timeZone,
        });
        await graphqlRequest(UPDATE_IMPORT_JOB, {
          id: job.id,
          set: { cursor: {} },
        });
      } else if (entryIndex >= entries.length) {
        await markFile(
          current.id,
          entries.length === 0 ? "failed" : "previewed",
          {
            detected_kind: "zip",
            error_code: entries.length === 0 ? "empty_zip" : undefined,
            error_message:
              entries.length === 0 ? "ZIP-arkivet var tomt." : undefined,
          },
        );
        await graphqlRequest(UPDATE_IMPORT_JOB, {
          id: job.id,
          set: { cursor: {} },
        });
      } else {
        const entry = entries[entryIndex]!;
        const hash = sha256Hex(entry.bytes);
        const child = await graphqlRequest<{
          insert_import_files_one: { id: string };
        }>(INSERT_IMPORT_FILE, {
          import_id: importId,
          storage_file_id: current.storage_file_id,
          original_filename: entry.path.split("/").at(-1) ?? entry.path,
          detected_kind: detectFileKind(entry.bytes),
          byte_size: entry.bytes.byteLength,
          sha256: hash,
          status: "pending",
          parent_file_id: current.id,
          zip_entry_path: entry.path,
        });
        await handleParsedBytes({
          importId,
          fileId: child.insert_import_files_one.id,
          bytes: entry.bytes,
          timeZone,
        });
        await graphqlRequest(UPDATE_IMPORT_JOB, {
          id: job.id,
          set: { cursor: { fileId: current.id, entryIndex: entryIndex + 1 } },
        });
        await markFile(current.id, "processing", { detected_kind: "zip" });
      }
    } else {
      await handleParsedBytes({
        importId,
        fileId: current.id,
        bytes,
        detectedKind: kind,
        timeZone,
      });
      await graphqlRequest(UPDATE_IMPORT_JOB, {
        id: job.id,
        set: { cursor: {} },
      });
    }
  } catch (error) {
    const message =
      error instanceof ZipLimitError ||
      error instanceof GarminDbRejectionError ||
      error instanceof Error
        ? error.message
        : "Kunde inte bearbeta filen.";
    const code =
      error instanceof ZipLimitError || error instanceof GarminDbRejectionError
        ? error.code
        : "process_error";
    await markFile(current.id, "failed", {
      error_code: code,
      error_message: message,
    });
    await graphqlRequest(UPDATE_IMPORT_JOB, {
      id: job.id,
      set: { cursor: {}, last_error: message },
    });
  }

  const refreshed = await graphqlRequest<{ import_files: ImportFileRow[] }>(
    `query Files($id: uuid!) {
      import_files(where: { import_id: { _eq: $id } }) {
        id status zip_entry_path
      }
    }`,
    { id: importId },
  );
  const counts = summarize(refreshed.import_files);
  await graphqlRequest(UPDATE_DATA_IMPORT, {
    id: importId,
    set: {
      status: "processing",
      ...counts,
      file_count: refreshed.import_files.length,
    },
  });

  const stillPending = refreshed.import_files.some((file) =>
    ["pending", "processing"].includes(file.status),
  );
  if (!stillPending) {
    const status = finalStatus(refreshed.import_files);
    await graphqlRequest(UPDATE_DATA_IMPORT, {
      id: importId,
      set: {
        status,
        ...counts,
        file_count: refreshed.import_files.length,
      },
    });
    return { status: "done", importId, importStatus: status };
  }

  return { status: "continue", importId, importStatus: "processing" };
}
