/**
 * Centralised SQL data-fetching functions that replace the old GraphQL layer.
 * All functions return typed data matching the shapes previously provided by
 * graphqlRequest so that page components need minimal changes.
 */
import sql from "@/lib/db";

// ─── Preferences / goals helpers ─────────────────────────────────────────────

export async function getUserPreferences() {
  const rows = await sql`
    SELECT timezone, locale, week_starts_on,
           distance_unit, mass_unit, elevation_unit, volume_unit, temperature_unit
    FROM user_preferences
    LIMIT 1
  `;
  return rows as unknown as Array<{
    timezone: string;
    locale: string;
    week_starts_on: number;
    distance_unit: string;
    mass_unit: string;
    elevation_unit: string;
    volume_unit: string;
    temperature_unit: string;
  }>;
}

export async function getActiveGoal() {
  const rows = await sql`
    SELECT id, status, race_type, race_distance_m, race_date,
           target_duration_s, target_pace_s_per_km, target_mass_kg,
           weekly_run_distance_m, weekly_run_duration_s,
           weekly_strength_sessions, weekly_strength_duration_s, notes
    FROM goals
    WHERE status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows as unknown as Array<{
    id: string;
    status: string;
    race_type: string;
    race_distance_m: unknown;
    race_date: string | null;
    target_duration_s: number | null;
    target_pace_s_per_km: unknown;
    target_mass_kg: unknown;
    weekly_run_distance_m: unknown;
    weekly_run_duration_s: number | null;
    weekly_strength_sessions: number | null;
    weekly_strength_duration_s: number | null;
    notes: string | null;
  }>;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardData(since: string, sinceDate: string) {
  const [preferences, goals, profile, activities, health, body, imports] =
    await Promise.all([
      getUserPreferences(),
      getActiveGoal(),
      sql`
        SELECT date_of_birth, sex_at_birth, height_cm
        FROM profiles
        LIMIT 1
      `,
      sql`
        SELECT id, activity_type, started_at, duration_s,
               distance_m, avg_pace_s_per_km, avg_heart_rate_bpm, calories_kcal
        FROM activities
        WHERE started_at >= ${since}
        ORDER BY started_at DESC
        LIMIT 500
      `,
      sql`
        SELECT local_date, sleep_duration_s, sleep_start_at,
               hrv_rmssd_ms, resting_heart_rate_bpm, steps,
               stress_avg, body_battery_high, body_battery_low
        FROM daily_health_metrics
        WHERE local_date >= ${sinceDate}
        ORDER BY local_date DESC
        LIMIT 120
      `,
      sql`
        SELECT measured_at, mass_kg, body_fat_pct
        FROM body_measurements
        WHERE measured_at >= ${since}
        ORDER BY measured_at DESC
        LIMIT 120
      `,
      sql`
        SELECT id, status, created_at, committed_at, committed_count, file_count
        FROM data_imports
        ORDER BY created_at DESC
        LIMIT 5
      `,
    ]);
  return {
    user_preferences: preferences,
    goals,
    profile: (profile[0] ?? null) as {
      date_of_birth: string | null;
      sex_at_birth: string | null;
      height_cm: unknown;
    } | null,
    activities: activities as unknown as Array<{
      id: string;
      activity_type: string;
      started_at: string;
      duration_s: number | null;
      distance_m: unknown;
      avg_pace_s_per_km: unknown;
      avg_heart_rate_bpm: unknown;
      calories_kcal: unknown;
    }>,
    daily_health_metrics: health as unknown as Array<{
      local_date: string;
      sleep_duration_s: number | null;
      sleep_start_at: string | null;
      hrv_rmssd_ms: unknown;
      resting_heart_rate_bpm: unknown;
      steps: number | null;
      stress_avg: unknown;
      body_battery_high: unknown;
      body_battery_low: unknown;
    }>,
    body_measurements: body as unknown as Array<{
      measured_at: string;
      mass_kg: unknown;
      body_fat_pct: unknown;
    }>,
    data_imports: imports as unknown as Array<{
      id: string;
      status: string;
      created_at: string;
      committed_at: string | null;
      committed_count: number;
      file_count: number;
    }>,
  };
}

export async function listRunDistanceHistory() {
  const rows = await sql`
    SELECT id, activity_type, started_at, duration_s,
           distance_m, avg_pace_s_per_km, avg_heart_rate_bpm
    FROM activities
    WHERE activity_type IN ('run', 'trail_run', 'treadmill')
      AND distance_m IS NOT NULL
    ORDER BY started_at ASC
    LIMIT 20000
  `;
  return rows as unknown as Array<{
    id: string;
    activity_type: string;
    started_at: string;
    duration_s: number | null;
    distance_m: unknown;
    avg_pace_s_per_km: unknown;
    avg_heart_rate_bpm: unknown;
  }>;
}

export async function listRecentFuel(since: string) {
  const [nutrition, hydration] = await Promise.all([
    sql`
      SELECT eaten_at, energy_kcal
      FROM nutrition_entries
      WHERE eaten_at >= ${since}
      ORDER BY eaten_at DESC
      LIMIT 800
    `,
    sql`
      SELECT consumed_at, volume_ml
      FROM hydration_entries
      WHERE consumed_at >= ${since}
      ORDER BY consumed_at DESC
      LIMIT 800
    `,
  ]);
  return {
    nutrition: nutrition as unknown as Array<{
      eaten_at: string;
      energy_kcal: unknown;
    }>,
    hydration: hydration as unknown as Array<{
      consumed_at: string;
      volume_ml: unknown;
    }>,
  };
}

export async function getGarminIntegrationStatus() {
  const rows = await sql`
    SELECT provider, status, connected_at, metadata
    FROM integrations
    WHERE provider = 'garmin-api'
    LIMIT 1
  `;

  return (rows[0] ?? null) as {
    provider: string;
    status: string;
    connected_at: string | null;
    metadata: Record<string, unknown> | null;
  } | null;
}

// ─── Activities ───────────────────────────────────────────────────────────────

export async function listRunActivities(limit = 4000) {
  const [preferences, goals, activities] = await Promise.all([
    getUserPreferences(),
    getActiveGoal(),
    sql`
      SELECT id, activity_type, started_at, duration_s, distance_m,
             avg_pace_s_per_km, avg_heart_rate_bpm, elevation_gain_m, calories_kcal,
             notes, detail_hydrated_at
      FROM activities
      WHERE activity_type IN ('run', 'trail_run', 'treadmill')
      ORDER BY started_at DESC
      LIMIT ${limit}
    `,
  ]);
  return {
    user_preferences: preferences,
    goals,
    activities: activities as unknown as Array<{
      id: string;
      activity_type: string;
      started_at: string;
      duration_s: number | null;
      distance_m: unknown;
      avg_pace_s_per_km: unknown;
      avg_heart_rate_bpm: unknown;
      elevation_gain_m: unknown;
      calories_kcal: unknown;
      notes: string | null;
      detail_hydrated_at: string | Date | null;
    }>,
  };
}

export async function listActivities(since: string, limit = 2000) {
  const [preferences, goals, activities] = await Promise.all([
    getUserPreferences(),
    getActiveGoal(),
    sql`
      SELECT id, activity_type, started_at, duration_s, distance_m,
             avg_pace_s_per_km, avg_heart_rate_bpm, elevation_gain_m, calories_kcal,
             notes, detail_hydrated_at
      FROM activities
      WHERE started_at >= ${since}
      ORDER BY started_at DESC
      LIMIT ${limit}
    `,
  ]);
  return {
    user_preferences: preferences,
    goals,
    activities: activities as unknown as Array<{
      id: string;
      activity_type: string;
      started_at: string;
      duration_s: number | null;
      distance_m: unknown;
      avg_pace_s_per_km: unknown;
      avg_heart_rate_bpm: unknown;
      elevation_gain_m: unknown;
      calories_kcal: unknown;
      notes: string | null;
      detail_hydrated_at: string | Date | null;
    }>,
  };
}

export async function getActivity(id: string) {
  const [preferences, activityRows, laps, trackpoints, samples] =
    await Promise.all([
      getUserPreferences(),
      sql`
      SELECT id, activity_type, started_at, ended_at, duration_s, duration_kind,
             distance_m, elevation_gain_m, elevation_loss_m, avg_pace_s_per_km,
             avg_heart_rate_bpm, max_heart_rate_bpm, avg_cadence, calories_kcal,
             training_load, perceived_effort, notes, source, provider_payload,
             external_id, detail_hydrated_at
      FROM activities
      WHERE id = ${id}
      LIMIT 1
    `,
      sql`
      SELECT id, lap_index, kind, started_at, duration_s, distance_m,
             avg_pace_s_per_km, avg_heart_rate_bpm, elevation_gain_m,
             max_heart_rate_bpm, avg_cadence, elevation_loss_m, calories_kcal
      FROM activity_laps
      WHERE activity_id = ${id}
      ORDER BY kind DESC, lap_index ASC
    `,
      sql`
      SELECT point_index, recorded_at, latitude, longitude, altitude_m, distance_m,
             heart_rate_bpm, cadence, speed_mps, power_w, temperature_c
      FROM activity_trackpoints
      WHERE activity_id = ${id}
      ORDER BY point_index ASC
    `,
      sql`
      SELECT sample_index, recorded_at, elapsed_s, distance_m, heart_rate_bpm,
             cadence, speed_mps, altitude_m, power_w, temperature_c
      FROM activity_samples
      WHERE activity_id = ${id}
      ORDER BY sample_index ASC
    `,
    ]);
  return {
    user_preferences: preferences,
    activities_by_pk: (activityRows[0] ?? null) as unknown as {
      id: string;
      activity_type: string;
      started_at: string;
      ended_at: string | null;
      duration_s: number | null;
      duration_kind: string | null;
      distance_m: unknown;
      elevation_gain_m: unknown;
      elevation_loss_m: unknown;
      avg_pace_s_per_km: unknown;
      avg_heart_rate_bpm: unknown;
      max_heart_rate_bpm: unknown;
      avg_cadence: unknown;
      calories_kcal: unknown;
      training_load: unknown;
      perceived_effort: unknown;
      notes: string | null;
      source: string;
      provider_payload: Record<string, unknown> | null;
      external_id: string | null;
      detail_hydrated_at: string | null;
    } | null,
    activity_laps: laps as unknown as Array<{
      id: string;
      lap_index: number;
      kind: string | null;
      started_at: string | null;
      duration_s: number | null;
      distance_m: unknown;
      avg_pace_s_per_km: unknown;
      avg_heart_rate_bpm: unknown;
      elevation_gain_m: unknown;
      max_heart_rate_bpm: unknown;
      avg_cadence: unknown;
      elevation_loss_m: unknown;
      calories_kcal: unknown;
    }>,
    activity_trackpoints: trackpoints as unknown as Array<{
      point_index: number;
      recorded_at: string;
      latitude: number;
      longitude: number;
      altitude_m: unknown;
      distance_m: unknown;
      heart_rate_bpm: unknown;
      cadence: unknown;
      speed_mps: unknown;
      power_w: unknown;
      temperature_c: unknown;
    }>,
    activity_samples: samples as unknown as Array<{
      sample_index: number;
      recorded_at: string;
      elapsed_s: number | null;
      distance_m: unknown;
      heart_rate_bpm: unknown;
      cadence: unknown;
      speed_mps: unknown;
      altitude_m: unknown;
      power_w: unknown;
      temperature_c: unknown;
    }>,
  };
}

// ─── Recovery ─────────────────────────────────────────────────────────────────

export async function listRecovery(sinceDate: string) {
  const [preferences, health] = await Promise.all([
    getUserPreferences(),
    sql`
      SELECT id, local_date::text AS local_date, sleep_duration_s, sleep_start_at, sleep_end_at,
             sleep_light_s, sleep_deep_s, sleep_rem_s, sleep_awake_s,
             hrv_rmssd_ms, resting_heart_rate_bpm, stress_avg,
             body_battery_high, body_battery_low, steps, respiration_avg_brpm
      FROM daily_health_metrics
      WHERE local_date >= ${sinceDate}
      ORDER BY local_date DESC
      LIMIT 120
    `,
  ]);
  return {
    user_preferences: preferences,
    daily_health_metrics: health as unknown as Array<{
      id: string;
      local_date: string;
      sleep_duration_s: number | null;
      sleep_start_at: string | null;
      sleep_end_at: string | null;
      sleep_light_s: number | null;
      sleep_deep_s: number | null;
      sleep_rem_s: number | null;
      sleep_awake_s: number | null;
      hrv_rmssd_ms: unknown;
      resting_heart_rate_bpm: unknown;
      stress_avg: unknown;
      body_battery_high: unknown;
      body_battery_low: unknown;
      steps: number | null;
      respiration_avg_brpm: unknown;
    }>,
  };
}

// ─── Body ─────────────────────────────────────────────────────────────────────

export async function listBodyMeasurements(since: string) {
  const [preferences, goals, profile, measurements] = await Promise.all([
    getUserPreferences(),
    getActiveGoal(),
    sql`
      SELECT height_cm
      FROM profiles
      LIMIT 1
    `,
    sql`
      SELECT id, measured_at, mass_kg, body_fat_pct, source
      FROM body_measurements
      WHERE measured_at >= ${since}
      ORDER BY measured_at DESC
      LIMIT 120
    `,
  ]);
  return {
    user_preferences: preferences,
    goals,
    profile: (profile[0] ?? null) as { height_cm: unknown } | null,
    body_measurements: measurements as unknown as Array<{
      id: string;
      measured_at: string;
      mass_kg: unknown;
      body_fat_pct: unknown;
      source: string;
    }>,
  };
}

// ─── Strength ─────────────────────────────────────────────────────────────────

export async function listStrengthSessions(since: string) {
  const [preferences, goals, sessions, sets] = await Promise.all([
    getUserPreferences(),
    getActiveGoal(),
    sql`
      SELECT id, started_at, duration_s, perceived_effort, notes, source
      FROM strength_sessions
      WHERE started_at >= ${since}
      ORDER BY started_at DESC
      LIMIT 100
    `,
    sql`
      SELECT s.id, s.session_id, s.exercise_name, s.repetitions, s.mass_kg,
             ss.started_at
      FROM strength_sets s
      INNER JOIN strength_sessions ss ON ss.id = s.session_id
      WHERE ss.started_at >= ${since}
      ORDER BY ss.started_at DESC, s.set_index ASC
      LIMIT 2000
    `,
  ]);
  return {
    user_preferences: preferences,
    goals,
    strength_sessions: sessions as unknown as Array<{
      id: string;
      started_at: string;
      duration_s: number | null;
      perceived_effort: unknown;
      notes: string | null;
      source: string;
    }>,
    strength_sets: sets as unknown as Array<{
      id: string;
      session_id: string;
      exercise_name: string;
      repetitions: number | null;
      mass_kg: unknown;
      started_at: string;
    }>,
  };
}

export async function getStrengthSession(id: string) {
  const [preferences, sessionRows, sets] = await Promise.all([
    getUserPreferences(),
    sql`
      SELECT id, started_at, duration_s, perceived_effort, notes, source
      FROM strength_sessions
      WHERE id = ${id}
      LIMIT 1
    `,
    sql`
      SELECT id, set_index, exercise_name, repetitions, mass_kg, rpe, notes
      FROM strength_sets
      WHERE session_id = ${id}
      ORDER BY set_index ASC
    `,
  ]);
  return {
    user_preferences: preferences,
    strength_sessions_by_pk: (sessionRows[0] ?? null) as unknown as {
      id: string;
      started_at: string;
      duration_s: number | null;
      perceived_effort: unknown;
      notes: string | null;
      source: string;
    } | null,
    strength_sets: sets as unknown as Array<{
      id: string;
      set_index: number;
      exercise_name: string;
      repetitions: number | null;
      mass_kg: unknown;
      rpe: unknown;
      notes: string | null;
    }>,
  };
}

// ─── Nutrition ────────────────────────────────────────────────────────────────

export async function listNutrition(since: string) {
  const [preferences, nutrition, hydration, profile, body] = await Promise.all([
    getUserPreferences(),
    sql`
      SELECT id, eaten_at, meal_type, description, energy_kcal,
             protein_g, carbohydrate_g, fat_g, fiber_g, provenance, notes
      FROM nutrition_entries
      WHERE eaten_at >= ${since}
      ORDER BY eaten_at DESC
      LIMIT 200
    `,
    sql`
      SELECT id, consumed_at, volume_ml, beverage_type, caffeine_mg, notes
      FROM hydration_entries
      WHERE consumed_at >= ${since}
      ORDER BY consumed_at DESC
      LIMIT 200
    `,
    sql`
      SELECT date_of_birth, sex_at_birth, height_cm
      FROM profiles
      LIMIT 1
    `,
    sql`
      SELECT mass_kg
      FROM body_measurements
      ORDER BY measured_at DESC
      LIMIT 1
    `,
  ]);
  return {
    user_preferences: preferences,
    profile: (profile[0] ?? null) as {
      date_of_birth: string | null;
      sex_at_birth: string | null;
      height_cm: unknown;
    } | null,
    latest_mass_kg: (body[0]?.mass_kg ?? null) as unknown,
    nutrition_entries: nutrition as unknown as Array<{
      id: string;
      eaten_at: string;
      meal_type: string;
      description: string;
      energy_kcal: unknown;
      protein_g: unknown;
      carbohydrate_g: unknown;
      fat_g: unknown;
      fiber_g: unknown;
      provenance: string;
      notes: string | null;
    }>,
    hydration_entries: hydration as unknown as Array<{
      id: string;
      consumed_at: string;
      volume_ml: unknown;
      beverage_type: string;
      caffeine_mg: unknown;
      notes: string | null;
    }>,
  };
}

// ─── Goals page ───────────────────────────────────────────────────────────────

export async function getGoalsPageData(since: string) {
  const [preferences, goals, activities, measurements, strength] =
    await Promise.all([
      getUserPreferences(),
      getActiveGoal(),
      sql`
      SELECT id, activity_type, started_at, duration_s,
             distance_m, avg_pace_s_per_km, avg_heart_rate_bpm
      FROM activities
      WHERE started_at >= ${since}
      ORDER BY started_at DESC
      LIMIT 500
    `,
      sql`
      SELECT mass_kg
      FROM body_measurements
      ORDER BY measured_at DESC
      LIMIT 1
    `,
      sql`
      SELECT started_at
      FROM strength_sessions
      WHERE started_at >= ${since}
      ORDER BY started_at DESC
      LIMIT 80
    `,
    ]);
  return {
    user_preferences: preferences,
    goals,
    activities: activities as unknown as Array<{
      id: string;
      activity_type: string;
      started_at: string;
      duration_s: number | null;
      distance_m: unknown;
      avg_pace_s_per_km: unknown;
      avg_heart_rate_bpm: unknown;
    }>,
    latest_mass_kg:
      (measurements[0] as { mass_kg?: unknown } | undefined)?.mass_kg ?? null,
    strength_sessions: strength as unknown as Array<{ started_at: string }>,
  };
}

// ─── Weekly report ────────────────────────────────────────────────────────────

export async function getWeeklyReportData(
  since: string,
  sinceDate: string,
  now: string,
) {
  const [preferences, goals, activities, health, strengthSessions, recs] =
    await Promise.all([
      getUserPreferences(),
      getActiveGoal(),
      sql`
        SELECT id, activity_type, started_at, distance_m,
               avg_pace_s_per_km, duration_s, avg_heart_rate_bpm
        FROM activities
        WHERE started_at >= ${since}
        ORDER BY started_at DESC
        LIMIT 500
      `,
      sql`
        SELECT local_date, sleep_duration_s, sleep_start_at,
               hrv_rmssd_ms, resting_heart_rate_bpm
        FROM daily_health_metrics
        WHERE local_date >= ${sinceDate}
        ORDER BY local_date DESC
        LIMIT 120
      `,
      sql`
        SELECT started_at
        FROM strength_sessions
        WHERE started_at >= ${since}
        ORDER BY started_at DESC
        LIMIT 200
      `,
      sql`
        SELECT r.id, r.generated_at, r.rule_id, r.action_key, r.action_sv,
               r.comparison_period_days, r.completeness, r.confidence,
               r.disclaimer_key, r.valid_until,
               COALESCE(
                 json_agg(
                   json_build_object(
                     'signal_key', s.signal_key,
                     'observed_value', s.observed_value,
                     'unit', s.unit,
                     'comparator', s.comparator,
                     'reference_value', s.reference_value
                   ) ORDER BY s.created_at
                 ) FILTER (WHERE s.id IS NOT NULL),
                 '[]'
               ) AS recommendation_signals
        FROM recommendations r
        LEFT JOIN recommendation_signals s ON s.recommendation_id = r.id
        WHERE r.valid_until IS NULL OR r.valid_until >= ${now}
        GROUP BY r.id
        ORDER BY r.generated_at DESC
        LIMIT 1
      `,
    ]);
  return {
    user_preferences: preferences,
    goals,
    activities: activities as unknown as Array<{
      id: string;
      activity_type: string;
      started_at: string;
      distance_m: unknown;
      avg_pace_s_per_km: unknown;
      duration_s: number | null;
      avg_heart_rate_bpm: unknown;
    }>,
    daily_health_metrics: health as unknown as Array<{
      local_date: string;
      sleep_duration_s: number | null;
      sleep_start_at: string | null;
      hrv_rmssd_ms: unknown;
      resting_heart_rate_bpm: unknown;
    }>,
    strength_sessions: strengthSessions as unknown as Array<{
      started_at: string;
    }>,
    recommendations: recs as unknown as Array<{
      id: string;
      generated_at: string;
      rule_id: string;
      action_key: string;
      action_sv: string;
      comparison_period_days: number;
      completeness: unknown;
      confidence: string;
      disclaimer_key: string;
      valid_until: string | null;
      recommendation_signals: Array<{
        signal_key: string;
        observed_value: unknown;
        unit: string | null;
        comparator: string | null;
        reference_value: unknown;
      }>;
    }>,
  };
}

export async function listWeekRecaps(limit = 12) {
  const rows = await sql`
    SELECT week_start::text AS week_start, week_end::text AS week_end,
           score, medal, headline, summary, dimensions
    FROM week_recaps
    ORDER BY week_start DESC
    LIMIT ${limit}
  `;
  return rows as unknown as Array<{
    week_start: string;
    week_end: string;
    score: number;
    medal: string;
    headline: string;
    summary: string;
    dimensions: unknown;
  }>;
}

export async function insertWeekRecapIfMissing(recap: {
  weekStart: string;
  weekEnd: string;
  score: number;
  medal: string;
  headline: string;
  summary: string;
  dimensions: unknown;
}) {
  await sql`
    INSERT INTO week_recaps
      (week_start, week_end, score, medal, headline, summary, dimensions, generated_at)
    VALUES (
      ${recap.weekStart},
      ${recap.weekEnd},
      ${recap.score},
      ${recap.medal},
      ${recap.headline},
      ${recap.summary},
      ${sql.json(recap.dimensions as never)},
      now()
    )
    ON CONFLICT (week_start) DO NOTHING
  `;
}

export async function upsertWeekRecap(recap: {
  weekStart: string;
  weekEnd: string;
  score: number;
  medal: string;
  headline: string;
  summary: string;
  dimensions: unknown;
}) {
  await sql`
    INSERT INTO week_recaps
      (week_start, week_end, score, medal, headline, summary, dimensions, generated_at)
    VALUES (
      ${recap.weekStart},
      ${recap.weekEnd},
      ${recap.score},
      ${recap.medal},
      ${recap.headline},
      ${recap.summary},
      ${sql.json(recap.dimensions as never)},
      now()
    )
    ON CONFLICT (week_start)
    DO UPDATE SET
      week_end = EXCLUDED.week_end,
      score = EXCLUDED.score,
      medal = EXCLUDED.medal,
      headline = EXCLUDED.headline,
      summary = EXCLUDED.summary,
      dimensions = EXCLUDED.dimensions,
      generated_at = now(),
      updated_at = now()
  `;
}

export async function getActivityRecap(activityId: string) {
  const rows = await sql`
    SELECT activity_id, fingerprint, payload, source, model
    FROM activity_recaps
    WHERE activity_id = ${activityId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return row as unknown as {
    activity_id: string;
    fingerprint: string;
    payload: unknown;
    source: string;
    model: string | null;
  };
}

export async function upsertActivityRecap(recap: {
  activityId: string;
  fingerprint: string;
  payload: unknown;
  source: "rules" | "stub" | "openai";
  model: string | null;
}) {
  await sql`
    INSERT INTO activity_recaps
      (activity_id, fingerprint, payload, source, model, generated_at)
    VALUES (
      ${recap.activityId},
      ${recap.fingerprint},
      ${sql.json(recap.payload as never)},
      ${recap.source},
      ${recap.model},
      now()
    )
    ON CONFLICT (activity_id)
    DO UPDATE SET
      fingerprint = EXCLUDED.fingerprint,
      payload = EXCLUDED.payload,
      source = EXCLUDED.source,
      model = EXCLUDED.model,
      generated_at = now(),
      updated_at = now()
  `;
}

export async function listWeekPlansByStarts(weekStarts: string[]) {
  if (weekStarts.length === 0) return [];
  const rows = await sql`
    SELECT local_date::text AS local_date, payload
    FROM training_plans
    WHERE plan_type = 'week'
      AND local_date IN ${sql(weekStarts)}
  `;
  return rows as unknown as Array<{
    local_date: string;
    payload: unknown;
  }>;
}

export async function listRecapSourceData(since: string, sinceDate: string) {
  const [preferences, goals, profile, body, activities, health, fuel] =
    await Promise.all([
      sql`SELECT timezone FROM user_preferences LIMIT 1`,
      sql`SELECT weekly_run_distance_m FROM goals WHERE status = 'active' LIMIT 1`,
      sql`SELECT date_of_birth, sex_at_birth, height_cm FROM profiles LIMIT 1`,
      sql`
        SELECT mass_kg
        FROM body_measurements
        ORDER BY measured_at DESC
        LIMIT 1
      `,
      sql`
        SELECT activity_type, started_at, distance_m, calories_kcal
        FROM activities
        WHERE started_at >= ${since}
        ORDER BY started_at DESC
        LIMIT 500
      `,
      sql`
        SELECT local_date, sleep_duration_s, sleep_start_at, hrv_rmssd_ms,
               resting_heart_rate_bpm, steps, stress_avg,
               body_battery_high, body_battery_low
        FROM daily_health_metrics
        WHERE local_date >= ${sinceDate}
        ORDER BY local_date DESC
        LIMIT 120
      `,
      listRecentFuel(since),
    ]);

  return {
    timezone: (preferences[0]?.timezone as string | undefined) ?? null,
    weeklyRunDistanceM: goals[0]?.weekly_run_distance_m ?? null,
    profile: (profile[0] ?? null) as {
      date_of_birth: string | null;
      sex_at_birth: string | null;
      height_cm: unknown;
    } | null,
    massKg: body[0]?.mass_kg ?? null,
    activities: activities as unknown as Array<{
      activity_type: string;
      started_at: string;
      distance_m: unknown;
      calories_kcal: unknown;
    }>,
    health: health as unknown as Array<{
      local_date: string;
      sleep_duration_s: number | null;
      sleep_start_at: string | null;
      hrv_rmssd_ms: unknown;
      resting_heart_rate_bpm: unknown;
      steps: number | null;
      stress_avg: unknown;
      body_battery_high: unknown;
      body_battery_low: unknown;
    }>,
    fuel,
  };
}

// ─── Imports ──────────────────────────────────────────────────────────────────

export async function listImports() {
  const rows = await sql`
    SELECT id, status, file_count, previewed_count, committed_count,
           failed_count, duplicate_count, created_at, committed_at,
           error_summary, provider
    FROM data_imports
    ORDER BY created_at DESC
    LIMIT 30
  `;
  return rows as unknown as Array<{
    id: string;
    status: string;
    file_count: number;
    previewed_count: number;
    committed_count: number;
    failed_count: number;
    duplicate_count: number;
    created_at: string;
    committed_at: string | null;
    error_summary: string | null;
    provider: string | null;
  }>;
}

export async function getImportDetail(id: string) {
  const [importRows, files, jobs, actPreviews, healthPreviews, bodyPreviews] =
    await Promise.all([
      sql`
        SELECT id, status, provider, error_summary, file_count,
               previewed_count, committed_count, failed_count,
               duplicate_count, created_at, confirmed_at, committed_at
        FROM data_imports WHERE id = ${id} LIMIT 1
      `,
      sql`
        SELECT id, storage_file_id, original_filename, detected_kind,
               byte_size, sha256, status, zip_entry_path,
               error_code, error_message, source_provenance
        FROM import_files
        WHERE import_id = ${id}
        ORDER BY created_at ASC
      `,
      sql`
        SELECT id, cursor, lease_expires_at, attempt_count, last_error
        FROM import_jobs
        WHERE import_id = ${id}
        LIMIT 1
      `,
      sql`
        SELECT id, activity_type, started_at, duration_s, distance_m,
               avg_pace_s_per_km, avg_heart_rate_bpm, notes, external_id
        FROM activity_previews
        WHERE import_id = ${id}
        ORDER BY started_at DESC
      `,
      sql`SELECT id FROM daily_health_metric_previews WHERE import_id = ${id}`,
      sql`SELECT id FROM body_measurement_previews WHERE import_id = ${id}`,
    ]);
  return {
    data_imports_by_pk: (importRows[0] ?? null) as unknown as {
      id: string;
      status: string;
      error_summary: string | null;
      created_at: string;
    } | null,
    import_files: files as unknown as Array<{
      id: string;
      original_filename: string | null;
      detected_kind: string | null;
      status: string;
      zip_entry_path: string | null;
      error_message: string | null;
    }>,
    import_jobs: jobs,
    activity_previews: actPreviews as unknown as Array<{
      id: string;
      activity_type: string;
      started_at: string;
      distance_m: unknown;
      avg_pace_s_per_km: unknown;
      avg_heart_rate_bpm: number | null;
    }>,
    daily_health_metric_previews: healthPreviews as unknown as Array<{
      id: string;
    }>,
    body_measurement_previews: bodyPreviews as unknown as Array<{ id: string }>,
  };
}

export async function getImportLanding(id: string) {
  const [importRows, activities, health, body] = await Promise.all([
    sql`
      SELECT id, status, committed_count, duplicate_count, committed_at
      FROM data_imports WHERE id = ${id} LIMIT 1
    `,
    sql`
      SELECT id, activity_type, started_at, distance_m, avg_pace_s_per_km
      FROM activities
      WHERE import_id = ${id}
      ORDER BY started_at DESC
    `,
    sql`SELECT id FROM daily_health_metrics WHERE import_id = ${id}`,
    sql`SELECT id FROM body_measurements WHERE import_id = ${id}`,
  ]);
  return {
    data_imports_by_pk: (importRows[0] ?? null) as unknown as {
      id: string;
      status: string;
      committed_count: number;
      duplicate_count: number;
      committed_at: string | null;
    } | null,
    activities: activities as unknown as Array<{
      id: string;
      activity_type: string;
      started_at: string;
      distance_m: unknown;
      avg_pace_s_per_km: unknown;
    }>,
    daily_health_metrics: health as unknown as Array<{ id: string }>,
    body_measurements: body as unknown as Array<{ id: string }>,
  };
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getProfileSettings() {
  const [profiles, preferences, goals] = await Promise.all([
    sql`
      SELECT id, display_name, date_of_birth, sex_at_birth, height_cm,
             onboarding_completed_at, created_at, updated_at
      FROM profiles LIMIT 1
    `,
    sql`
      SELECT id, timezone, locale, week_starts_on,
             distance_unit, mass_unit, elevation_unit, volume_unit, temperature_unit
      FROM user_preferences LIMIT 1
    `,
    getActiveGoal(),
  ]);
  return {
    profiles: profiles as unknown as Array<{
      id: string;
      display_name: string | null;
      date_of_birth: string | null;
      sex_at_birth: string | null;
      height_cm: unknown;
      onboarding_completed_at: string | null;
      created_at: string;
      updated_at: string;
    }>,
    user_preferences: preferences as unknown as Array<{
      id: string;
      timezone: string;
      locale: string;
      week_starts_on: number;
      distance_unit: string;
      mass_unit: string;
      elevation_unit: string;
      volume_unit: string;
      temperature_unit: string;
    }>,
    goals,
  };
}

export async function listExportJobs() {
  const rows = await sql`
    SELECT id, status, storage_file_id, error_summary, created_at, completed_at
    FROM data_export_jobs
    ORDER BY created_at DESC
    LIMIT 5
  `;
  return rows as unknown as Array<{
    id: string;
    status: string;
    storage_file_id: string | null;
    error_summary: string | null;
    created_at: string;
    completed_at: string | null;
  }>;
}

export async function getPendingDeletion() {
  const rows = await sql`
    SELECT id, requested_at, purge_after
    FROM account_deletion_requests
    WHERE status = 'pending'
    ORDER BY requested_at DESC
    LIMIT 1
  `;
  return (rows[0] ?? null) as unknown as {
    id: string;
    requested_at: string;
    purge_after: string;
  } | null;
}
