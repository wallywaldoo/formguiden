import { GraphQLRequestError, graphqlRequest } from "@/lib/graphql/client";
import { INSERT_AUDIT_EVENT } from "@/lib/graphql/mutations/profile";
import {
  GET_ACTIVITY_BY_EXTERNAL_ID,
  GET_PREVIEW_FOR_COMMIT,
  INSERT_ACTIVITY,
  INSERT_ACTIVITY_LAPS,
  INSERT_BODY_MEASUREMENT,
  INSERT_DAILY_HEALTH,
  UPDATE_DATA_IMPORT,
  UPDATE_IMPORT_FILE,
} from "@/lib/graphql/mutations/imports";
import { IMPORT_SOURCE } from "@/lib/import/limits";
import { createNhostClient } from "@/lib/nhost/server";

export type CommitImportResult = {
  error?: string;
  importId?: string;
};

export async function commitImport(
  importId: string,
): Promise<CommitImportResult> {
  const nhost = await createNhostClient();
  if (!nhost.getUserSession()?.user?.id) {
    return { error: "Du är inte inloggad." };
  }

  const preview = await graphqlRequest<{
    data_imports_by_pk: { id: string; status: string } | null;
    activity_previews: Array<
      Record<string, unknown> & { id: string; import_file_id: string }
    >;
    activity_lap_previews: Array<
      Record<string, unknown> & { activity_preview_id: string }
    >;
    daily_health_metric_previews: Array<Record<string, unknown>>;
    body_measurement_previews: Array<Record<string, unknown>>;
    import_files: Array<{ id: string; status: string }>;
  }>(GET_PREVIEW_FOR_COMMIT, { import_id: importId });

  const status = preview.data_imports_by_pk?.status;
  if (!status || !["preview_ready", "partial"].includes(status)) {
    return { error: "Importen är inte redo att bekräftas." };
  }

  let committed = 0;
  let duplicates = 0;

  for (const activity of preview.activity_previews) {
    if (typeof activity.external_id === "string" && activity.external_id) {
      const existing = await graphqlRequest<{
        activities: Array<{ id: string }>;
      }>(GET_ACTIVITY_BY_EXTERNAL_ID, { external_id: activity.external_id });
      if (existing.activities.length > 0) {
        duplicates += 1;
        continue;
      }
    }
    const inserted = await graphqlRequest<{
      insert_activities_one: { id: string };
    }>(INSERT_ACTIVITY, {
      object: {
        import_id: importId,
        import_file_id: activity.import_file_id,
        source: activity.source ?? IMPORT_SOURCE,
        external_id: activity.external_id,
        activity_type: activity.activity_type,
        started_at: activity.started_at,
        ended_at: activity.ended_at,
        duration_s: activity.duration_s,
        duration_kind: activity.duration_kind,
        distance_m: activity.distance_m,
        elevation_gain_m: activity.elevation_gain_m,
        elevation_loss_m: activity.elevation_loss_m,
        avg_pace_s_per_km: activity.avg_pace_s_per_km,
        avg_heart_rate_bpm: activity.avg_heart_rate_bpm,
        max_heart_rate_bpm: activity.max_heart_rate_bpm,
        avg_cadence: activity.avg_cadence,
        calories_kcal: activity.calories_kcal,
        training_load: activity.training_load,
        notes: activity.notes,
      },
    });
    const laps = preview.activity_lap_previews.filter(
      (lap) => lap.activity_preview_id === activity.id,
    );
    if (laps.length > 0) {
      await graphqlRequest(INSERT_ACTIVITY_LAPS, {
        objects: laps.map((lap) => ({
          activity_id: inserted.insert_activities_one.id,
          lap_index: lap.lap_index,
          kind: lap.kind,
          started_at: lap.started_at,
          duration_s: lap.duration_s,
          distance_m: lap.distance_m,
          avg_pace_s_per_km: lap.avg_pace_s_per_km,
          avg_heart_rate_bpm: lap.avg_heart_rate_bpm,
          elevation_gain_m: lap.elevation_gain_m,
        })),
      });
    }
    committed += 1;
  }

  for (const day of preview.daily_health_metric_previews) {
    try {
      await graphqlRequest(INSERT_DAILY_HEALTH, {
        object: {
          import_id: importId,
          source: day.source ?? IMPORT_SOURCE,
          external_id: day.external_id,
          local_date: day.local_date,
          sleep_duration_s: day.sleep_duration_s,
          sleep_start_at: day.sleep_start_at,
          sleep_end_at: day.sleep_end_at,
          sleep_light_s: day.sleep_light_s,
          sleep_deep_s: day.sleep_deep_s,
          sleep_rem_s: day.sleep_rem_s,
          sleep_awake_s: day.sleep_awake_s,
          hrv_rmssd_ms: day.hrv_rmssd_ms,
          resting_heart_rate_bpm: day.resting_heart_rate_bpm,
          stress_avg: day.stress_avg,
          body_battery_high: day.body_battery_high,
          body_battery_low: day.body_battery_low,
          steps: day.steps,
          respiration_avg_brpm: day.respiration_avg_brpm,
        },
      });
      committed += 1;
    } catch (error) {
      if (error instanceof GraphQLRequestError) {
        duplicates += 1;
        continue;
      }
      throw error;
    }
  }

  for (const body of preview.body_measurement_previews) {
    try {
      await graphqlRequest(INSERT_BODY_MEASUREMENT, {
        object: {
          import_id: importId,
          source: body.source ?? IMPORT_SOURCE,
          external_id: body.external_id,
          measured_at: body.measured_at,
          mass_kg: body.mass_kg,
          body_fat_pct: body.body_fat_pct,
        },
      });
      committed += 1;
    } catch (error) {
      if (error instanceof GraphQLRequestError) {
        duplicates += 1;
        continue;
      }
      throw error;
    }
  }

  for (const file of preview.import_files) {
    if (file.status === "previewed") {
      await graphqlRequest(UPDATE_IMPORT_FILE, {
        id: file.id,
        set: { status: "committed" },
      });
    }
  }

  const now = new Date().toISOString();
  await graphqlRequest(UPDATE_DATA_IMPORT, {
    id: importId,
    set: {
      status: "committed",
      committed_count: committed,
      duplicate_count: duplicates,
      confirmed_at: now,
      committed_at: now,
    },
  });
  await graphqlRequest(INSERT_AUDIT_EVENT, {
    action: "import.confirm",
    entity_type: "data_imports",
    entity_id: importId,
  });

  return { importId };
}
