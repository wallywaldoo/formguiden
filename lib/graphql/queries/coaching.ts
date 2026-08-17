export const GET_LATEST_RECOMMENDATION = /* GraphQL */ `
  query GetLatestRecommendation($now: timestamptz!) {
    recommendations(
      where: {
        _or: [
          { valid_until: { _is_null: true } }
          { valid_until: { _gte: $now } }
        ]
      }
      order_by: { generated_at: desc }
      limit: 1
    ) {
      id
      generated_at
      rule_id
      action_key
      action_sv
      comparison_period_days
      completeness
      confidence
      disclaimer_key
      valid_until
      recommendation_signals(order_by: { created_at: asc }) {
        id
        signal_key
        observed_value
        unit
        comparator
        reference_value
      }
    }
  }
`;

export const GET_COACHING_CONTEXT = /* GraphQL */ `
  query GetCoachingContext($since: timestamptz!, $since_date: date!) {
    goals(where: { status: { _eq: "active" } }, limit: 1) {
      weekly_run_distance_m
      target_pace_s_per_km
      target_mass_kg
      weekly_strength_sessions
    }
    activities(
      where: { started_at: { _gte: $since } }
      order_by: { started_at: desc }
      limit: 500
    ) {
      id
      activity_type
      started_at
      distance_m
      avg_pace_s_per_km
      duration_s
      avg_heart_rate_bpm
    }
    daily_health_metrics(
      where: { local_date: { _gte: $since_date } }
      order_by: { local_date: desc }
      limit: 120
    ) {
      local_date
      sleep_duration_s
      sleep_start_at
      hrv_rmssd_ms
      resting_heart_rate_bpm
      steps
      stress_avg
      body_battery_high
      body_battery_low
    }
    body_measurements(
      where: { measured_at: { _gte: $since } }
      order_by: { measured_at: desc }
      limit: 120
    ) {
      measured_at
      mass_kg
      body_fat_pct
    }
    strength_sessions(
      where: { started_at: { _gte: $since } }
      order_by: { started_at: desc }
      limit: 200
    ) {
      started_at
    }
    data_imports(
      where: {
        status: { _in: ["preview_ready", "partial", "queued", "processing"] }
      }
      order_by: { created_at: desc }
      limit: 1
    ) {
      id
    }
  }
`;

export const GET_WEEKLY_REPORT = /* GraphQL */ `
  query GetWeeklyReport(
    $since: timestamptz!
    $since_date: date!
    $now: timestamptz!
  ) {
    user_preferences {
      timezone
      distance_unit
    }
    goals(where: { status: { _eq: "active" } }, limit: 1) {
      weekly_run_distance_m
      target_pace_s_per_km
      weekly_strength_sessions
      race_type
      race_date
      target_duration_s
    }
    activities(
      where: { started_at: { _gte: $since } }
      order_by: { started_at: desc }
      limit: 500
    ) {
      id
      activity_type
      started_at
      distance_m
      avg_pace_s_per_km
      duration_s
      avg_heart_rate_bpm
    }
    daily_health_metrics(
      where: { local_date: { _gte: $since_date } }
      order_by: { local_date: desc }
      limit: 120
    ) {
      local_date
      sleep_duration_s
      sleep_start_at
      hrv_rmssd_ms
      resting_heart_rate_bpm
    }
    strength_sessions(
      where: { started_at: { _gte: $since } }
      order_by: { started_at: desc }
      limit: 200
    ) {
      started_at
    }
    recommendations(
      where: {
        _or: [
          { valid_until: { _is_null: true } }
          { valid_until: { _gte: $now } }
        ]
      }
      order_by: { generated_at: desc }
      limit: 1
    ) {
      id
      generated_at
      rule_id
      action_key
      action_sv
      comparison_period_days
      completeness
      confidence
      disclaimer_key
      valid_until
      recommendation_signals(order_by: { created_at: asc }) {
        signal_key
        observed_value
        unit
        comparator
        reference_value
      }
    }
  }
`;

export const GET_EXPORT_JOB = /* GraphQL */ `
  query GetExportJob($id: uuid!) {
    data_export_jobs_by_pk(id: $id) {
      id
      status
      storage_file_id
      error_summary
      created_at
      completed_at
    }
  }
`;

export const LIST_EXPORT_JOBS = /* GraphQL */ `
  query ListExportJobs {
    data_export_jobs(order_by: { created_at: desc }, limit: 5) {
      id
      status
      storage_file_id
      error_summary
      created_at
      completed_at
    }
  }
`;

export const GET_PENDING_DELETION = /* GraphQL */ `
  query GetPendingDeletion {
    account_deletion_requests(
      where: { status: { _eq: "pending" } }
      order_by: { requested_at: desc }
      limit: 1
    ) {
      id
      requested_at
      purge_after
    }
  }
`;

export const GET_EXPORT_DATA = /* GraphQL */ `
  query GetExportData {
    profiles {
      user_id
      display_name
      onboarding_completed_at
      created_at
    }
    user_preferences {
      timezone
      locale
      distance_unit
      mass_unit
      elevation_unit
      volume_unit
      temperature_unit
      week_starts_on
    }
    goals {
      id
      status
      race_type
      race_distance_m
      race_date
      target_duration_s
      target_pace_s_per_km
      target_mass_kg
      weekly_run_distance_m
      weekly_run_duration_s
      weekly_strength_sessions
      weekly_strength_duration_s
      created_at
      updated_at
    }
    activities(order_by: { started_at: desc }) {
      id
      activity_type
      started_at
      ended_at
      duration_s
      duration_kind
      distance_m
      elevation_gain_m
      elevation_loss_m
      avg_pace_s_per_km
      avg_heart_rate_bpm
      max_heart_rate_bpm
      avg_cadence
      calories_kcal
      training_load
      perceived_effort
      notes
      source
      external_id
      created_at
    }
    activity_laps(order_by: [{ activity_id: asc }, { lap_index: asc }]) {
      id
      activity_id
      lap_index
      kind
      started_at
      duration_s
      distance_m
      avg_pace_s_per_km
      avg_heart_rate_bpm
      elevation_gain_m
    }
    daily_health_metrics(order_by: { local_date: desc }) {
      id
      local_date
      sleep_duration_s
      sleep_start_at
      sleep_end_at
      sleep_light_s
      sleep_deep_s
      sleep_rem_s
      sleep_awake_s
      hrv_rmssd_ms
      resting_heart_rate_bpm
      stress_avg
      body_battery_high
      body_battery_low
      steps
      respiration_avg_brpm
      source
    }
    body_measurements(order_by: { measured_at: desc }) {
      id
      measured_at
      mass_kg
      body_fat_pct
      source
      notes
    }
    nutrition_entries(order_by: { eaten_at: desc }) {
      id
      eaten_at
      meal_type
      description
      energy_kcal
      protein_g
      carbohydrate_g
      fat_g
      fiber_g
      provenance
      notes
    }
    hydration_entries(order_by: { consumed_at: desc }) {
      id
      consumed_at
      volume_ml
      beverage_type
      caffeine_mg
      notes
    }
    strength_sessions(order_by: { started_at: desc }) {
      id
      started_at
      duration_s
      perceived_effort
      notes
    }
    strength_sets(order_by: [{ session_id: asc }, { set_index: asc }]) {
      id
      session_id
      set_index
      exercise_name
      repetitions
      mass_kg
      rpe
      notes
    }
    data_imports(order_by: { created_at: desc }) {
      id
      provider
      status
      file_count
      committed_count
      error_summary
      created_at
      updated_at
    }
    import_files(order_by: { created_at: asc }) {
      id
      import_id
      storage_file_id
      original_filename
      detected_kind
      byte_size
      sha256
      status
      zip_entry_path
    }
    audit_events(order_by: { created_at: desc }) {
      id
      action
      entity_type
      entity_id
      created_at
    }
    ai_estimation_requests(order_by: { created_at: desc }) {
      id
      status
      provider
      created_at
      completed_at
    }
    files: files(
      where: { bucket_id: { _eq: "garmin-imports" } }
      order_by: { created_at: asc }
    ) {
      id
      name
      size
      mime_type
      created_at
    }
  }
`;
