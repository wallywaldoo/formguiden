export const GET_STORAGE_FILE = /* GraphQL */ `
  query GetStorageFile($id: uuid!) {
    files_by_pk(id: $id) {
      id
      bucket_id
      name
      size
      mime_type
      uploaded_by_user_id
    }
  }
`;

export const GET_COMMITTED_FILES_BY_HASH = /* GraphQL */ `
  query GetCommittedFilesByHash($sha256: String!) {
    import_files(
      where: { sha256: { _eq: $sha256 }, status: { _eq: "committed" } }
      limit: 1
    ) {
      id
    }
  }
`;

export const GET_IMPORT = /* GraphQL */ `
  query GetImport($id: uuid!) {
    data_imports_by_pk(id: $id) {
      id
      status
      provider
      error_summary
      file_count
      previewed_count
      committed_count
      failed_count
      duplicate_count
      created_at
      confirmed_at
      committed_at
    }
    import_files(
      where: { import_id: { _eq: $id } }
      order_by: { created_at: asc }
    ) {
      id
      storage_file_id
      original_filename
      detected_kind
      byte_size
      sha256
      status
      zip_entry_path
      error_code
      error_message
    }
    import_jobs(where: { import_id: { _eq: $id } }, limit: 1) {
      id
      cursor
      lease_expires_at
      attempt_count
      last_error
    }
    activity_previews(
      where: { import_id: { _eq: $id } }
      order_by: { started_at: desc }
    ) {
      id
      activity_type
      started_at
      duration_s
      distance_m
      avg_pace_s_per_km
      avg_heart_rate_bpm
      notes
      external_id
    }
    daily_health_metric_previews(where: { import_id: { _eq: $id } }) {
      id
      local_date
      sleep_duration_s
      resting_heart_rate_bpm
      steps
    }
    body_measurement_previews(where: { import_id: { _eq: $id } }) {
      id
      measured_at
      mass_kg
    }
  }
`;

export const GET_IMPORT_LANDING = /* GraphQL */ `
  query GetImportLanding($id: uuid!) {
    data_imports_by_pk(id: $id) {
      id
      status
      committed_count
      duplicate_count
      committed_at
    }
    activities(
      where: { import_id: { _eq: $id } }
      order_by: { started_at: desc }
    ) {
      id
      activity_type
      started_at
      distance_m
      avg_pace_s_per_km
    }
    daily_health_metrics(where: { import_id: { _eq: $id } }) {
      id
    }
    body_measurements(where: { import_id: { _eq: $id } }) {
      id
    }
  }
`;

export const LIST_IMPORTS = /* GraphQL */ `
  query ListImports {
    data_imports(order_by: { created_at: desc }, limit: 30) {
      id
      status
      file_count
      previewed_count
      committed_count
      failed_count
      duplicate_count
      created_at
      committed_at
      error_summary
    }
  }
`;
