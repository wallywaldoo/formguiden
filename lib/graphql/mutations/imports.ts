export const INSERT_DATA_IMPORT = /* GraphQL */ `
  mutation InsertDataImport(
    $provider: String!
    $status: String!
    $file_count: Int!
  ) {
    insert_data_imports_one(
      object: { provider: $provider, status: $status, file_count: $file_count }
    ) {
      id
    }
  }
`;

export const UPDATE_DATA_IMPORT = /* GraphQL */ `
  mutation UpdateDataImport($id: uuid!, $set: data_imports_set_input!) {
    update_data_imports_by_pk(pk_columns: { id: $id }, _set: $set) {
      id
      status
    }
  }
`;

export const INSERT_IMPORT_FILE = /* GraphQL */ `
  mutation InsertImportFile(
    $import_id: uuid!
    $storage_file_id: uuid!
    $original_filename: String
    $declared_mime_type: String
    $detected_kind: String
    $byte_size: bigint!
    $sha256: String!
    $status: String!
    $parent_file_id: uuid
    $zip_entry_path: String
    $error_code: String
    $error_message: String
  ) {
    insert_import_files_one(
      object: {
        import_id: $import_id
        storage_file_id: $storage_file_id
        original_filename: $original_filename
        declared_mime_type: $declared_mime_type
        detected_kind: $detected_kind
        byte_size: $byte_size
        sha256: $sha256
        status: $status
        parent_file_id: $parent_file_id
        zip_entry_path: $zip_entry_path
        error_code: $error_code
        error_message: $error_message
      }
    ) {
      id
    }
  }
`;

export const UPDATE_IMPORT_FILE = /* GraphQL */ `
  mutation UpdateImportFile($id: uuid!, $set: import_files_set_input!) {
    update_import_files_by_pk(pk_columns: { id: $id }, _set: $set) {
      id
    }
  }
`;

export const INSERT_IMPORT_JOB = /* GraphQL */ `
  mutation InsertImportJob($import_id: uuid!, $cursor: jsonb!) {
    insert_import_jobs_one(object: { import_id: $import_id, cursor: $cursor }) {
      id
    }
  }
`;

export const UPDATE_IMPORT_JOB = /* GraphQL */ `
  mutation UpdateImportJob($id: uuid!, $set: import_jobs_set_input!) {
    update_import_jobs_by_pk(pk_columns: { id: $id }, _set: $set) {
      id
    }
  }
`;

export const INSERT_ACTIVITY_PREVIEW = /* GraphQL */ `
  mutation InsertActivityPreview($object: activity_previews_insert_input!) {
    insert_activity_previews_one(object: $object) {
      id
    }
  }
`;

export const INSERT_ACTIVITY_LAP_PREVIEWS = /* GraphQL */ `
  mutation InsertActivityLapPreviews(
    $objects: [activity_lap_previews_insert_input!]!
  ) {
    insert_activity_lap_previews(objects: $objects) {
      affected_rows
    }
  }
`;

export const INSERT_HEALTH_PREVIEW = /* GraphQL */ `
  mutation InsertHealthPreview(
    $object: daily_health_metric_previews_insert_input!
  ) {
    insert_daily_health_metric_previews_one(object: $object) {
      id
    }
  }
`;

export const INSERT_BODY_PREVIEW = /* GraphQL */ `
  mutation InsertBodyPreview($object: body_measurement_previews_insert_input!) {
    insert_body_measurement_previews_one(object: $object) {
      id
    }
  }
`;

export const INSERT_ACTIVITY = /* GraphQL */ `
  mutation InsertActivity($object: activities_insert_input!) {
    insert_activities_one(object: $object) {
      id
    }
  }
`;

export const INSERT_ACTIVITY_LAPS = /* GraphQL */ `
  mutation InsertActivityLaps($objects: [activity_laps_insert_input!]!) {
    insert_activity_laps(objects: $objects) {
      affected_rows
    }
  }
`;

export const INSERT_DAILY_HEALTH = /* GraphQL */ `
  mutation InsertDailyHealth($object: daily_health_metrics_insert_input!) {
    insert_daily_health_metrics_one(object: $object) {
      id
    }
  }
`;

export const INSERT_BODY_MEASUREMENT = /* GraphQL */ `
  mutation InsertBodyMeasurement($object: body_measurements_insert_input!) {
    insert_body_measurements_one(object: $object) {
      id
    }
  }
`;

export const GET_ACTIVITY_BY_EXTERNAL_ID = /* GraphQL */ `
  query GetActivityByExternalId($external_id: String!) {
    activities(where: { external_id: { _eq: $external_id } }, limit: 1) {
      id
    }
  }
`;

export const GET_PREVIEW_FOR_COMMIT = /* GraphQL */ `
  query GetPreviewForCommit($import_id: uuid!) {
    data_imports_by_pk(id: $import_id) {
      id
      status
    }
    activity_previews(where: { import_id: { _eq: $import_id } }) {
      id
      import_file_id
      source
      external_id
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
      notes
    }
    activity_lap_previews(where: { import_id: { _eq: $import_id } }) {
      activity_preview_id
      lap_index
      kind
      started_at
      duration_s
      distance_m
      avg_pace_s_per_km
      avg_heart_rate_bpm
      elevation_gain_m
    }
    daily_health_metric_previews(where: { import_id: { _eq: $import_id } }) {
      source
      external_id
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
    body_measurement_previews(where: { import_id: { _eq: $import_id } }) {
      source
      external_id
      measured_at
      mass_kg
      body_fat_pct
    }
    import_files(where: { import_id: { _eq: $import_id } }) {
      id
      status
    }
  }
`;

export const DELETE_PREVIEWS = /* GraphQL */ `
  mutation DeletePreviews($import_id: uuid!) {
    delete_activity_lap_previews(where: { import_id: { _eq: $import_id } }) {
      affected_rows
    }
    delete_activity_previews(where: { import_id: { _eq: $import_id } }) {
      affected_rows
    }
    delete_daily_health_metric_previews(
      where: { import_id: { _eq: $import_id } }
    ) {
      affected_rows
    }
    delete_body_measurement_previews(
      where: { import_id: { _eq: $import_id } }
    ) {
      affected_rows
    }
  }
`;
