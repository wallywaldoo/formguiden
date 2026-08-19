import { zipSync } from "fflate";

import sql from "@/lib/db";

export type ExportSliceResult = {
  status: "continue" | "ready" | "error";
  jobId: string;
  error?: string;
};

function json(name: string, data: unknown): { name: string; bytes: Uint8Array } {
  const text = JSON.stringify(data, null, 2);
  return { name, bytes: new TextEncoder().encode(text) };
}

function csv(
  name: string,
  rows: Array<Record<string, unknown>>,
): { name: string; bytes: Uint8Array } {
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
          if (value == null) return "";
          const text = String(value).replaceAll('"', '""');
          return `"${text}"`;
        })
        .join(","),
    ),
  ];
  return { name, bytes: new TextEncoder().encode(lines.join("\n")) };
}

export async function processExportJob(
  jobId: string,
): Promise<ExportSliceResult> {
  const jobRows = await sql`SELECT id, status FROM data_export_jobs WHERE id = ${jobId} LIMIT 1`;
  const job = jobRows[0];
  if (!job) {
    return { status: "error", jobId, error: "Exportjobbet hittades inte." };
  }
  if (job.status === "ready") {
    return { status: "ready", jobId };
  }
  if (job.status === "failed") {
    return { status: "error", jobId, error: "Exporten misslyckades tidigare." };
  }

  try {
    if (job.status === "queued") {
      await sql`UPDATE data_export_jobs SET status = 'processing' WHERE id = ${jobId}`;
    }

    const [
      profiles, userPrefs, goals, activities, activityLaps,
      healthMetrics, bodyMeasurements, nutritionEntries, hydrationEntries,
      strengthSessions, strengthSets, dataImports, importFiles,
      aiEstimationRequests,
    ] = await Promise.all([
      sql`SELECT * FROM profiles`,
      sql`SELECT * FROM user_preferences`,
      sql`SELECT * FROM goals ORDER BY created_at DESC`,
      sql`SELECT * FROM activities ORDER BY started_at DESC`,
      sql`SELECT * FROM activity_laps ORDER BY activity_id, lap_index`,
      sql`SELECT * FROM daily_health_metrics ORDER BY local_date DESC`,
      sql`SELECT * FROM body_measurements ORDER BY measured_at DESC`,
      sql`SELECT * FROM nutrition_entries ORDER BY eaten_at DESC`,
      sql`SELECT * FROM hydration_entries ORDER BY consumed_at DESC`,
      sql`SELECT * FROM strength_sessions ORDER BY started_at DESC`,
      sql`SELECT * FROM strength_sets ORDER BY session_id, set_index`,
      sql`SELECT * FROM data_imports ORDER BY created_at DESC`,
      sql`SELECT * FROM import_files ORDER BY created_at ASC`,
      sql`SELECT * FROM ai_estimation_requests ORDER BY created_at DESC`,
    ]);

    const entries = [
      json("profile.json", {
        exported_at: new Date().toISOString(),
        profiles,
        user_preferences: userPrefs,
      }),
      json("goals.json", goals),
      json("activities.json", activities),
      json("activity_laps.json", activityLaps),
      json("daily_health_metrics.json", healthMetrics),
      json("body_measurements.json", bodyMeasurements),
      json("nutrition_entries.json", nutritionEntries),
      json("hydration_entries.json", hydrationEntries),
      json("strength_sessions.json", strengthSessions),
      json("strength_sets.json", strengthSets),
      json("data_imports.json", dataImports),
      json("import_files.json", importFiles),
      json("ai_estimation_requests.json", aiEstimationRequests),
      csv("activities.csv", activities as Array<Record<string, unknown>>),
      csv(
        "daily_health_metrics.csv",
        healthMetrics as Array<Record<string, unknown>>,
      ),
    ];

    const zipObject: Record<string, Uint8Array> = {};
    for (const entry of entries) {
      zipObject[entry.name] = entry.bytes;
    }
    const zipBytes = zipSync(zipObject);

    // Store the zip in the export job's file_path as a base64 data URI.
    // The UI reads this back as a download link.
    const base64 = Buffer.from(zipBytes).toString("base64");
    const dataUrl = `data:application/zip;base64,${base64}`;

    await sql`
      UPDATE data_export_jobs SET
        status = 'ready',
        file_path = ${dataUrl},
        completed_at = now()
      WHERE id = ${jobId}
    `;

    return { status: "ready", jobId };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Exporten misslyckades.";
    await sql`
      UPDATE data_export_jobs SET
        status = 'failed',
        error_summary = ${message.slice(0, 500)},
        completed_at = now()
      WHERE id = ${jobId}
    `.catch(() => undefined);
    return { status: "error", jobId, error: message };
  }
}

export async function getExportDownloadUrl(
  jobId: string,
): Promise<string | null> {
  const rows = await sql`SELECT file_path FROM data_export_jobs WHERE id = ${jobId} LIMIT 1`;
  return (rows[0]?.file_path as string) ?? null;
}
