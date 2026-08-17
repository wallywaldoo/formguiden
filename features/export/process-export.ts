import { zipSync } from "fflate";

import {
  EXPORT_MAX_GARMIN_BYTES,
  GARMIN_IMPORTS_BUCKET,
  USER_EXPORTS_BUCKET,
} from "@/lib/constants";
import { graphqlRequest } from "@/lib/graphql/client";
import { UPDATE_EXPORT_JOB } from "@/lib/graphql/mutations/coaching";
import {
  GET_EXPORT_DATA,
  GET_EXPORT_JOB,
} from "@/lib/graphql/queries/coaching";
import { GET_STORAGE_FILE } from "@/lib/graphql/queries/imports";
import { createNhostClient } from "@/lib/nhost/server";

export type ExportSliceResult = {
  status: "continue" | "ready" | "error";
  jobId: string;
  error?: string;
};

type ExportPayload = Record<string, unknown>;

function json(
  name: string,
  data: unknown,
): { name: string; bytes: Uint8Array } {
  const text = JSON.stringify(data, null, 2);
  return { name, bytes: new TextEncoder().encode(text) };
}

function csv(
  name: string,
  rows: Array<Record<string, unknown>>,
): {
  name: string;
  bytes: Uint8Array;
} {
  if (rows.length === 0) {
    return { name, bytes: new TextEncoder().encode("") };
  }
  const columns = Object.keys(rows[0] ?? {});
  const lines = [
    columns.join(","),
    ...rows.map((row) =>
      columns
        .map((column) => {
          const value = row[column];
          if (value == null) {
            return "";
          }
          const text = String(value).replaceAll('"', '""');
          return `"${text}"`;
        })
        .join(","),
    ),
  ];
  return { name, bytes: new TextEncoder().encode(lines.join("\n")) };
}

async function downloadGarminFile(
  fileId: string,
  userId: string,
): Promise<{ name: string; bytes: Uint8Array } | null> {
  const nhost = await createNhostClient();
  const meta = await graphqlRequest<{
    files_by_pk: {
      id: string;
      bucket_id: string;
      name: string;
      size: number | null;
      uploaded_by_user_id: string | null;
    } | null;
  }>(GET_STORAGE_FILE, { id: fileId });

  const file = meta.files_by_pk;
  if (
    !file ||
    file.bucket_id !== GARMIN_IMPORTS_BUCKET ||
    file.uploaded_by_user_id !== userId ||
    (file.size ?? 0) > EXPORT_MAX_GARMIN_BYTES
  ) {
    return null;
  }

  const response = await nhost.storage.getFile(fileId);
  const bytes = new Uint8Array(await response.body.arrayBuffer());
  return {
    name: `garmin/${file.name || file.id}`,
    bytes,
  };
}

export async function processExportJob(
  jobId: string,
): Promise<ExportSliceResult> {
  const nhost = await createNhostClient();
  const userId = nhost.getUserSession()?.user?.id;
  if (!userId) {
    return { status: "error", jobId, error: "Du är inte inloggad." };
  }

  let job: {
    id: string;
    status: string;
    storage_file_id: string | null;
  } | null = null;

  try {
    const data = await graphqlRequest<{
      data_export_jobs_by_pk: {
        id: string;
        status: string;
        storage_file_id: string | null;
      } | null;
    }>(GET_EXPORT_JOB, { id: jobId });
    job = data.data_export_jobs_by_pk;
  } catch (error) {
    return {
      status: "error",
      jobId,
      error:
        error instanceof Error
          ? error.message
          : "Kunde inte läsa exportjobbet.",
    };
  }

  if (!job) {
    return { status: "error", jobId, error: "Exportjobbet hittades inte." };
  }
  if (job.status === "ready" && job.storage_file_id) {
    return { status: "ready", jobId };
  }
  if (job.status === "failed") {
    return { status: "error", jobId, error: "Exporten misslyckades tidigare." };
  }

  try {
    if (job.status === "queued") {
      await graphqlRequest(UPDATE_EXPORT_JOB, {
        id: jobId,
        status: "processing",
        storage_file_id: null,
        error_summary: null,
        completed_at: null,
      });
    }

    const payload = await graphqlRequest<ExportPayload>(GET_EXPORT_DATA);
    const entries = [
      json("profile.json", {
        exported_at: new Date().toISOString(),
        profiles: payload.profiles,
        user_preferences: payload.user_preferences,
      }),
      json("goals.json", payload.goals),
      json("activities.json", payload.activities),
      json("activity_laps.json", payload.activity_laps),
      json("daily_health_metrics.json", payload.daily_health_metrics),
      json("body_measurements.json", payload.body_measurements),
      json("nutrition_entries.json", payload.nutrition_entries),
      json("hydration_entries.json", payload.hydration_entries),
      json("strength_sessions.json", payload.strength_sessions),
      json("strength_sets.json", payload.strength_sets),
      json("data_imports.json", payload.data_imports),
      json("import_files.json", payload.import_files),
      json("audit_events.json", payload.audit_events),
      json("ai_estimation_requests.json", payload.ai_estimation_requests),
      csv(
        "activities.csv",
        (payload.activities as Array<Record<string, unknown>>) ?? [],
      ),
      csv(
        "daily_health_metrics.csv",
        (payload.daily_health_metrics as Array<Record<string, unknown>>) ?? [],
      ),
    ];

    const files = payload.files as
      Array<{ id: string; name: string }> | undefined;
    let garminBytes = 0;
    for (const file of files ?? []) {
      if (garminBytes >= EXPORT_MAX_GARMIN_BYTES) {
        break;
      }
      const downloaded = await downloadGarminFile(file.id, userId);
      if (!downloaded) {
        continue;
      }
      garminBytes += downloaded.bytes.byteLength;
      entries.push(downloaded);
    }

    const zipObject: Record<string, Uint8Array> = {};
    for (const entry of entries) {
      zipObject[entry.name] = entry.bytes;
    }
    const zipBytes = zipSync(zipObject);
    const fileName = `formkurvan-export-${jobId.slice(0, 8)}.zip`;
    const blob = new Blob([zipBytes], { type: "application/zip" });
    const upload = await nhost.storage.uploadFiles({
      "bucket-id": USER_EXPORTS_BUCKET,
      "file[]": [new File([blob], fileName, { type: "application/zip" })],
    });
    const stored = upload.body.processedFiles?.[0];
    if (upload.status !== 201 || !stored?.id) {
      throw new Error("Kunde inte ladda upp export-ZIP.");
    }

    await graphqlRequest(UPDATE_EXPORT_JOB, {
      id: jobId,
      status: "ready",
      storage_file_id: stored.id,
      error_summary: null,
      completed_at: new Date().toISOString(),
    });

    return { status: "ready", jobId };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Exporten misslyckades.";
    await graphqlRequest(UPDATE_EXPORT_JOB, {
      id: jobId,
      status: "failed",
      storage_file_id: null,
      error_summary: message.slice(0, 500),
      completed_at: new Date().toISOString(),
    }).catch(() => undefined);
    return { status: "error", jobId, error: message };
  }
}

export async function getExportDownloadUrl(
  storageFileId: string,
): Promise<string | null> {
  const nhost = await createNhostClient();
  const response = await nhost.storage.getFilePresignedURL(storageFileId);
  if (response.status !== 200) {
    return null;
  }
  return response.body.url ?? null;
}
