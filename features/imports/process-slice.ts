import sql from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { ImportProviderId } from "@/lib/import/adapters/types";
import { sha256Hex } from "@/lib/import/checksum";
import { scanForCredentialMaterial } from "@/lib/import/credentials/scan";
import { detectFileKind } from "@/lib/import/detect";
import { GarminConnectRejectionError } from "@/lib/import/garmin-connect";
import { entriesContainDatabase } from "@/lib/import/garmindb/archive";
import { GarminDbRejectionError } from "@/lib/import/garmindb/errors";
import { PREVIEW_TTL_DAYS, PROCESS_LEASE_SECONDS } from "@/lib/import/limits";
import { inspectAndParse } from "@/lib/import/parse-bytes";
import type { ParseResult } from "@/lib/import/types";
import { ZipLimitError, listZipEntries } from "@/lib/import/zip";
import { DEFAULT_TIMEZONE } from "@/lib/constants";

export type SliceResult = {
  status: "continue" | "done" | "error";
  importId: string;
  importStatus?: string;
  error?: string;
};

type ImportFileRow = {
  id: string;
  storage_path: string | null;
  original_filename: string | null;
  detected_kind: string | null;
  byte_size: number;
  sha256: string;
  status: string;
  zip_entry_path: string | null;
  error_code: string | null;
  error_message: string | null;
  source_provenance: Record<string, unknown> | null;
};

type ImportJobRow = {
  id: string;
  cursor: { fileId?: string; entryIndex?: number };
  lease_expires_at: string | null;
  attempt_count: number;
  last_error: string | null;
};

async function downloadStorageFile(storagePath: string): Promise<Uint8Array> {
  // In the new single-user setup, storage_path holds the file ID (UUID) from
  // the upload endpoint. The upload endpoint stores bytes inline in import_files.
  // We look up the raw bytes from a transient upload record if available.
  // Fall back to reading from the upload_bytes column if present.
  const rows = await sql`
    SELECT raw_bytes FROM upload_staging WHERE id = ${storagePath} LIMIT 1
  `.catch(() => []);

  if (rows.length > 0 && rows[0]!.raw_bytes) {
    return new Uint8Array(rows[0]!.raw_bytes as Buffer);
  }

  throw new Error(
    "Fildata saknas — ladda upp filen igen (upload_staging).",
  );
}

function expiresAt(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + PREVIEW_TTL_DAYS);
  return date.toISOString();
}

async function resolveTimeZone(): Promise<string> {
  try {
    const prefs = await sql`SELECT timezone FROM user_preferences LIMIT 1`;
    return (prefs[0]?.timezone as string) || DEFAULT_TIMEZONE;
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
    const inserted = await sql`
      INSERT INTO activity_previews
        (import_id, import_file_id, expires_at, source, external_id, activity_type,
         started_at, ended_at, duration_s, duration_kind, distance_m, elevation_gain_m,
         elevation_loss_m, avg_pace_s_per_km, avg_heart_rate_bpm, max_heart_rate_bpm,
         avg_cadence, calories_kcal, training_load, notes)
      VALUES (
        ${importId}, ${importFileId}, ${expires}, ${source as string},
        ${activity.externalId ?? null}, ${activity.activityType},
        ${activity.startedAt}, ${activity.endedAt ?? null}, ${activity.durationS ?? null},
        ${activity.durationKind ?? null}, ${activity.distanceM ?? null},
        ${activity.elevationGainM ?? null}, ${activity.elevationLossM ?? null},
        ${activity.avgPaceSPerKm ?? null}, ${activity.avgHeartRateBpm ?? null},
        ${activity.maxHeartRateBpm ?? null}, ${activity.avgCadence ?? null},
        ${activity.caloriesKcal ?? null}, ${activity.trainingLoad ?? null},
        ${activity.notes ?? null}
      )
      RETURNING id
    `;
    if (activity.laps.length > 0) {
      const previewId = inserted[0]!.id as string;
      for (const lap of activity.laps) {
        await sql`
          INSERT INTO activity_lap_previews
            (import_id, activity_preview_id, lap_index, kind, started_at,
             duration_s, distance_m, avg_pace_s_per_km, avg_heart_rate_bpm, elevation_gain_m)
          VALUES (
            ${importId}, ${previewId}, ${lap.lapIndex}, ${lap.kind},
            ${lap.startedAt ?? null}, ${lap.durationS ?? null}, ${lap.distanceM ?? null},
            ${lap.avgPaceSPerKm ?? null}, ${lap.avgHeartRateBpm ?? null},
            ${lap.elevationGainM ?? null}
          )
        `;
      }
    }
  }
  for (const day of parsed.dailyHealth) {
    await sql`
      INSERT INTO daily_health_metric_previews
        (import_id, import_file_id, expires_at, source, external_id, local_date,
         sleep_duration_s, sleep_start_at, sleep_end_at, sleep_light_s, sleep_deep_s,
         sleep_rem_s, sleep_awake_s, hrv_rmssd_ms, resting_heart_rate_bpm, stress_avg,
         body_battery_high, body_battery_low, steps, respiration_avg_brpm)
      VALUES (
        ${importId}, ${importFileId}, ${expires}, ${source as string},
        ${day.externalId ?? null}, ${day.localDate},
        ${day.sleepDurationS ?? null}, ${day.sleepStartAt ?? null}, ${day.sleepEndAt ?? null},
        ${day.sleepLightS ?? null}, ${day.sleepDeepS ?? null}, ${day.sleepRemS ?? null},
        ${day.sleepAwakeS ?? null}, ${day.hrvRmssdMs ?? null}, ${day.restingHeartRateBpm ?? null},
        ${day.stressAvg ?? null}, ${day.bodyBatteryHigh ?? null}, ${day.bodyBatteryLow ?? null},
        ${day.steps ?? null}, ${day.respirationAvgBrpm ?? null}
      )
    `;
  }
  for (const body of parsed.bodyMeasurements) {
    await sql`
      INSERT INTO body_measurement_previews
        (import_id, import_file_id, expires_at, source, external_id, measured_at, mass_kg, body_fat_pct)
      VALUES (
        ${importId}, ${importFileId}, ${expires}, ${source as string},
        ${body.externalId ?? null}, ${body.measuredAt}, ${body.massKg ?? null}, ${body.bodyFatPct ?? null}
      )
    `;
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
  await sql`
    UPDATE import_files SET
      status = ${status},
      detected_kind = COALESCE(${extra?.detected_kind ?? null}, detected_kind),
      error_code = ${extra?.error_code ?? null},
      error_message = ${extra?.error_message ?? null},
      sha256 = COALESCE(${extra?.sha256 ?? null}, sha256),
      source_provenance = COALESCE(${extra?.source_provenance ? JSON.stringify(extra.source_provenance) : null}::jsonb, source_provenance)
    WHERE id = ${id}
  `;
}

async function isCommittedHash(sha256: string): Promise<boolean> {
  const rows = await sql`
    SELECT id FROM import_files WHERE sha256 = ${sha256} AND status = 'committed' LIMIT 1
  `;
  return rows.length > 0;
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
    previewed_count: files.filter((f) => f.status === "previewed").length,
    failed_count: files.filter((f) => f.status === "failed").length,
    duplicate_count: files.filter((f) => f.status === "duplicate").length,
  };
}

function finalStatus(files: ImportFileRow[]) {
  const failed = files.filter((f) => f.status === "failed").length;
  const previewed = files.filter((f) => f.status === "previewed").length;
  if (previewed === 0 && failed > 0) return "failed";
  if (failed > 0) return "partial";
  return "preview_ready";
}

export async function processImportSlice(
  importId: string,
): Promise<SliceResult> {
  const ok = await getSession();
  if (!ok) {
    return { status: "error", importId, error: "Du är inte inloggad." };
  }

  const importRows = await sql`
    SELECT id, status FROM data_imports WHERE id = ${importId} LIMIT 1
  `;
  const importRow = importRows[0];
  if (!importRow) {
    return { status: "error", importId, error: "Importen hittades inte." };
  }

  const importStatus = importRow.status as string;
  if (
    ["preview_ready", "partial", "failed", "committed", "abandoned"].includes(
      importStatus,
    )
  ) {
    return { status: "done", importId, importStatus };
  }

  const jobRows = await sql`
    SELECT id, cursor, lease_expires_at, attempt_count, last_error
    FROM import_jobs WHERE import_id = ${importId} LIMIT 1
  `;
  const job = jobRows[0] as ImportJobRow | undefined;
  if (!job) {
    return { status: "error", importId, error: "Importjobbet saknas." };
  }

  const fileRows = await sql`
    SELECT id, storage_path, original_filename, detected_kind, byte_size, sha256,
           status, zip_entry_path, error_code, error_message, source_provenance
    FROM import_files WHERE import_id = ${importId} ORDER BY created_at ASC
  `;
  const files = fileRows as unknown as ImportFileRow[];

  const now = new Date();
  const lease = new Date(now.getTime() + PROCESS_LEASE_SECONDS * 1000);
  await sql`
    UPDATE import_jobs SET
      lease_expires_at = ${lease.toISOString()},
      heartbeat_at = ${now.toISOString()},
      attempt_count = ${job.attempt_count + 1}
    WHERE id = ${job.id}
  `;
  await sql`UPDATE data_imports SET status = 'processing' WHERE id = ${importId}`;

  const cursor = (job.cursor ?? {}) as { fileId?: string; entryIndex?: number };
  const topLevel = files.filter((f) => !f.zip_entry_path);
  const pending = topLevel.filter((f) =>
    ["pending", "processing"].includes(f.status),
  );
  const current =
    (cursor.fileId ? pending.find((f) => f.id === cursor.fileId) : pending[0]) ??
    pending[0];

  if (!current) {
    const counts = summarize(files);
    const status = finalStatus(files);
    await sql`
      UPDATE data_imports SET status = ${status}, previewed_count = ${counts.previewed_count},
        failed_count = ${counts.failed_count}, duplicate_count = ${counts.duplicate_count}
      WHERE id = ${importId}
    `;
    return { status: "done", importId, importStatus: status };
  }

  const timeZone = await resolveTimeZone();

  try {
    if (!current.storage_path) {
      throw new Error("Filen saknar lagringssökväg.");
    }
    const bytes = await downloadStorageFile(current.storage_path);

    const kind = detectFileKind(bytes);
    if (kind === "zip") {
      const entries = listZipEntries(bytes);

      const finding = entries
        .map((entry) => scanForCredentialMaterial(entry.bytes))
        .find((result) => result !== null);

      const entryIndex =
        cursor.fileId === current.id ? (cursor.entryIndex ?? 0) : 0;

      if (finding) {
        await markFile(current.id, "failed", {
          detected_kind: "zip",
          error_code: finding.code,
          error_message: finding.message,
        });
        await sql`
          UPDATE import_jobs SET cursor = '{}', last_error = ${finding.message}
          WHERE id = ${job.id}
        `;
      } else if (entriesContainDatabase(entries)) {
        await handleParsedBytes({
          importId,
          fileId: current.id,
          bytes,
          detectedKind: "zip",
          timeZone,
        });
        await sql`UPDATE import_jobs SET cursor = '{}' WHERE id = ${job.id}`;
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
        await sql`UPDATE import_jobs SET cursor = '{}' WHERE id = ${job.id}`;
      } else {
        const entry = entries[entryIndex]!;
        const hash = sha256Hex(entry.bytes);
        const childRows = await sql`
          INSERT INTO import_files
            (import_id, storage_path, original_filename, detected_kind, byte_size, sha256,
             status, parent_file_id, zip_entry_path)
          VALUES (
            ${importId}, ${current.storage_path}, ${entry.path.split("/").at(-1) ?? entry.path},
            ${detectFileKind(entry.bytes)}, ${entry.bytes.byteLength}, ${hash},
            'pending', ${current.id}, ${entry.path}
          )
          RETURNING id
        `;
        await handleParsedBytes({
          importId,
          fileId: childRows[0]!.id as string,
          bytes: entry.bytes,
          timeZone,
        });
        await sql`
          UPDATE import_jobs SET cursor = ${JSON.stringify({ fileId: current.id, entryIndex: entryIndex + 1 })}
          WHERE id = ${job.id}
        `;
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
      await sql`UPDATE import_jobs SET cursor = '{}' WHERE id = ${job.id}`;
    }
  } catch (error) {
    const message =
      error instanceof ZipLimitError ||
      error instanceof GarminDbRejectionError ||
      error instanceof GarminConnectRejectionError ||
      error instanceof Error
        ? error.message
        : "Kunde inte bearbeta filen.";
    const code =
      error instanceof ZipLimitError ||
      error instanceof GarminDbRejectionError ||
      error instanceof GarminConnectRejectionError
        ? error.code
        : "process_error";
    await markFile(current.id, "failed", {
      error_code: code,
      error_message: message,
    });
    await sql`
      UPDATE import_jobs SET cursor = '{}', last_error = ${message}
      WHERE id = ${job.id}
    `;
  }

  const refreshedRows = await sql`
    SELECT id, status, zip_entry_path FROM import_files WHERE import_id = ${importId}
  `;
  const refreshed = refreshedRows as unknown as Pick<ImportFileRow, "id" | "status" | "zip_entry_path">[];
  const counts = summarize(refreshed as ImportFileRow[]);

  await sql`
    UPDATE data_imports SET
      status = 'processing',
      previewed_count = ${counts.previewed_count},
      failed_count = ${counts.failed_count},
      duplicate_count = ${counts.duplicate_count},
      file_count = ${refreshed.length}
    WHERE id = ${importId}
  `;

  const stillPending = refreshed.some((f) =>
    ["pending", "processing"].includes(f.status),
  );
  if (!stillPending) {
    const status = finalStatus(refreshed as ImportFileRow[]);
    await sql`
      UPDATE data_imports SET
        status = ${status},
        previewed_count = ${counts.previewed_count},
        failed_count = ${counts.failed_count},
        duplicate_count = ${counts.duplicate_count},
        file_count = ${refreshed.length}
      WHERE id = ${importId}
    `;
    return { status: "done", importId, importStatus: status };
  }

  return { status: "continue", importId, importStatus: "processing" };
}
