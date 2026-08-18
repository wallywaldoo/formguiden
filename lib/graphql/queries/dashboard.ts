export const GET_DASHBOARD = /* GraphQL */ `
  query GetDashboard($since: timestamptz!, $since_date: date!) {
    user_preferences {
      timezone
      distance_unit
      mass_unit
      elevation_unit
      volume_unit
    }
    goals(where: { status: { _eq: "active" } }, limit: 1) {
      race_type
      race_distance_m
      race_date
      target_duration_s
      target_pace_s_per_km
      target_mass_kg
      weekly_run_distance_m
    }
    activities(
      where: { started_at: { _gte: $since } }
      order_by: { started_at: desc }
      limit: 500
    ) {
      id
      activity_type
      started_at
      duration_s
      distance_m
      avg_pace_s_per_km
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
    data_imports(order_by: { created_at: desc }, limit: 5) {
      id
      status
      created_at
      committed_at
      committed_count
      file_count
    }
  }
`;

export const LIST_ACTIVITIES = /* GraphQL */ `
  query ListActivities($since: timestamptz!) {
    user_preferences {
      timezone
      distance_unit
      elevation_unit
    }
    goals(where: { status: { _eq: "active" } }, limit: 1) {
      target_pace_s_per_km
      weekly_run_distance_m
    }
    activities(
      where: { started_at: { _gte: $since } }
      order_by: { started_at: desc }
      limit: 500
    ) {
      id
      activity_type
      started_at
      duration_s
      distance_m
      avg_pace_s_per_km
      avg_heart_rate_bpm
      elevation_gain_m
      calories_kcal
    }
  }
`;

export const GET_ACTIVITY = /* GraphQL */ `
  query GetActivity($id: uuid!) {
    user_preferences {
      timezone
      distance_unit
      elevation_unit
    }
    activities_by_pk(id: $id) {
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
    }
    activity_laps(
      where: { activity_id: { _eq: $id } }
      order_by: { lap_index: asc }
    ) {
      id
      lap_index
      kind
      started_at
      duration_s
      distance_m
      avg_pace_s_per_km
      avg_heart_rate_bpm
      elevation_gain_m
    }
  }
`;

export const LIST_RECOVERY = /* GraphQL */ `
  query ListRecovery($since_date: date!) {
    user_preferences {
      timezone
    }
    daily_health_metrics(
      where: { local_date: { _gte: $since_date } }
      order_by: { local_date: desc }
      limit: 120
    ) {
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
    }
  }
`;

export const LIST_BODY = /* GraphQL */ `
  query ListBody($since: timestamptz!) {
    user_preferences {
      timezone
      mass_unit
    }
    goals(where: { status: { _eq: "active" } }, limit: 1) {
      target_mass_kg
    }
    body_measurements(
      where: { measured_at: { _gte: $since } }
      order_by: { measured_at: desc }
      limit: 120
    ) {
      id
      measured_at
      mass_kg
      body_fat_pct
      source
    }
  }
`;
