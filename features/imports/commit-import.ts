import sql from "@/lib/db";
import { getSession } from "@/lib/auth";
import { IMPORT_SOURCE } from "@/lib/import/limits";

export type CommitImportResult = {
  error?: string;
  importId?: string;
};

export async function commitImport(
  importId: string,
): Promise<CommitImportResult> {
  const ok = await getSession();
  if (!ok) {
    return { error: "Du är inte inloggad." };
  }

  const importRows = await sql`
    SELECT id, status FROM data_imports WHERE id = ${importId} LIMIT 1
  `;
  const importRow = importRows[0];
  const status = importRow?.status as string | undefined;
  if (!status || !["preview_ready", "partial"].includes(status)) {
    return { error: "Importen är inte redo att bekräftas." };
  }

  const [activityPreviews, lapPreviews, healthPreviews, bodyPreviews, importFiles] =
    await Promise.all([
      sql`
        SELECT id, import_file_id, source, external_id, activity_type, started_at, ended_at,
               duration_s, duration_kind, distance_m, elevation_gain_m, elevation_loss_m,
               avg_pace_s_per_km, avg_heart_rate_bpm, max_heart_rate_bpm, avg_cadence,
               calories_kcal, training_load, notes
        FROM activity_previews WHERE import_id = ${importId}
      `,
      sql`
        SELECT activity_preview_id, lap_index, kind, started_at, duration_s, distance_m,
               avg_pace_s_per_km, avg_heart_rate_bpm, elevation_gain_m
        FROM activity_lap_previews WHERE import_id = ${importId}
      `,
      sql`
        SELECT source, external_id, local_date, sleep_duration_s, sleep_start_at, sleep_end_at,
               sleep_light_s, sleep_deep_s, sleep_rem_s, sleep_awake_s, hrv_rmssd_ms,
               resting_heart_rate_bpm, stress_avg, body_battery_high, body_battery_low,
               steps, respiration_avg_brpm
        FROM daily_health_metric_previews WHERE import_id = ${importId}
      `,
      sql`
        SELECT source, external_id, measured_at, mass_kg, body_fat_pct
        FROM body_measurement_previews WHERE import_id = ${importId}
      `,
      sql`SELECT id, status FROM import_files WHERE import_id = ${importId}`,
    ]);

  let committed = 0;
  let duplicates = 0;

  for (const activity of activityPreviews) {
    if (typeof activity.external_id === "string" && activity.external_id) {
      const existing = await sql`
        SELECT id FROM activities WHERE external_id = ${activity.external_id} LIMIT 1
      `;
      if (existing.length > 0) {
        duplicates += 1;
        continue;
      }
    }
    const inserted = await sql`
      INSERT INTO activities
        (import_id, import_file_id, source, external_id, activity_type, started_at, ended_at,
         duration_s, duration_kind, distance_m, elevation_gain_m, elevation_loss_m,
         avg_pace_s_per_km, avg_heart_rate_bpm, max_heart_rate_bpm, avg_cadence,
         calories_kcal, training_load, notes)
      VALUES (
        ${importId}, ${activity.import_file_id as string},
        ${(activity.source as string) ?? IMPORT_SOURCE},
        ${activity.external_id ?? null}, ${activity.activity_type as string},
        ${activity.started_at as string}, ${activity.ended_at ?? null},
        ${activity.duration_s ?? null}, ${activity.duration_kind ?? null},
        ${activity.distance_m ?? null}, ${activity.elevation_gain_m ?? null},
        ${activity.elevation_loss_m ?? null}, ${activity.avg_pace_s_per_km ?? null},
        ${activity.avg_heart_rate_bpm ?? null}, ${activity.max_heart_rate_bpm ?? null},
        ${activity.avg_cadence ?? null}, ${activity.calories_kcal ?? null},
        ${activity.training_load ?? null}, ${activity.notes ?? null}
      )
      RETURNING id
    `;
    const activityId = inserted[0]!.id as string;
    const laps = lapPreviews.filter(
      (lap) => lap.activity_preview_id === activity.id,
    );
    for (const lap of laps) {
      await sql`
        INSERT INTO activity_laps
          (activity_id, lap_index, kind, started_at, duration_s, distance_m,
           avg_pace_s_per_km, avg_heart_rate_bpm, elevation_gain_m)
        VALUES (
          ${activityId}, ${lap.lap_index as number}, ${lap.kind as string},
          ${lap.started_at ?? null}, ${lap.duration_s ?? null}, ${lap.distance_m ?? null},
          ${lap.avg_pace_s_per_km ?? null}, ${lap.avg_heart_rate_bpm ?? null},
          ${lap.elevation_gain_m ?? null}
        )
        ON CONFLICT (activity_id, kind, lap_index) DO NOTHING
      `;
    }
    committed += 1;
  }

  for (const day of healthPreviews) {
    try {
      await sql`
        INSERT INTO daily_health_metrics
          (import_id, source, external_id, local_date, sleep_duration_s, sleep_start_at,
           sleep_end_at, sleep_light_s, sleep_deep_s, sleep_rem_s, sleep_awake_s,
           hrv_rmssd_ms, resting_heart_rate_bpm, stress_avg, body_battery_high,
           body_battery_low, steps, respiration_avg_brpm)
        VALUES (
          ${importId}, ${(day.source as string) ?? IMPORT_SOURCE},
          ${day.external_id ?? null}, ${day.local_date as string},
          ${day.sleep_duration_s ?? null}, ${day.sleep_start_at ?? null},
          ${day.sleep_end_at ?? null}, ${day.sleep_light_s ?? null},
          ${day.sleep_deep_s ?? null}, ${day.sleep_rem_s ?? null},
          ${day.sleep_awake_s ?? null}, ${day.hrv_rmssd_ms ?? null},
          ${day.resting_heart_rate_bpm ?? null}, ${day.stress_avg ?? null},
          ${day.body_battery_high ?? null}, ${day.body_battery_low ?? null},
          ${day.steps ?? null}, ${day.respiration_avg_brpm ?? null}
        )
        ON CONFLICT (local_date, source) DO NOTHING
      `;
      committed += 1;
    } catch {
      duplicates += 1;
    }
  }

  for (const body of bodyPreviews) {
    try {
      await sql`
        INSERT INTO body_measurements
          (import_id, source, external_id, measured_at, mass_kg, body_fat_pct)
        VALUES (
          ${importId}, ${(body.source as string) ?? IMPORT_SOURCE},
          ${body.external_id ?? null}, ${body.measured_at as string},
          ${body.mass_kg ?? null}, ${body.body_fat_pct ?? null}
        )
      `;
      committed += 1;
    } catch {
      duplicates += 1;
    }
  }

  for (const file of importFiles) {
    if (file.status === "previewed") {
      await sql`UPDATE import_files SET status = 'committed' WHERE id = ${file.id}`;
    }
  }

  const now = new Date().toISOString();
  await sql`
    UPDATE data_imports SET
      status = 'committed',
      committed_count = ${committed},
      duplicate_count = ${duplicates},
      confirmed_at = ${now},
      committed_at = ${now}
    WHERE id = ${importId}
  `;

  return { importId };
}
