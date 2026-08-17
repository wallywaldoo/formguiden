export const INSERT_PROFILE = /* GraphQL */ `
  mutation InsertProfile($display_name: String) {
    insert_profiles_one(object: { display_name: $display_name }) {
      user_id
    }
  }
`;

export const UPDATE_PROFILE = /* GraphQL */ `
  mutation UpdateProfile($user_id: uuid!, $display_name: String) {
    update_profiles_by_pk(
      pk_columns: { user_id: $user_id }
      _set: { display_name: $display_name }
    ) {
      user_id
      display_name
    }
  }
`;

export const COMPLETE_ONBOARDING = /* GraphQL */ `
  mutation CompleteOnboarding($user_id: uuid!, $completed_at: timestamptz!) {
    update_profiles_by_pk(
      pk_columns: { user_id: $user_id }
      _set: { onboarding_completed_at: $completed_at }
    ) {
      user_id
      onboarding_completed_at
    }
  }
`;

export const INSERT_PREFERENCES = /* GraphQL */ `
  mutation InsertPreferences(
    $timezone: String!
    $locale: String!
    $distance_unit: String!
    $mass_unit: String!
    $elevation_unit: String!
    $volume_unit: String!
    $temperature_unit: String!
  ) {
    insert_user_preferences_one(
      object: {
        timezone: $timezone
        locale: $locale
        week_starts_on: 1
        distance_unit: $distance_unit
        mass_unit: $mass_unit
        elevation_unit: $elevation_unit
        volume_unit: $volume_unit
        temperature_unit: $temperature_unit
      }
    ) {
      id
    }
  }
`;

export const UPDATE_PREFERENCES = /* GraphQL */ `
  mutation UpdatePreferences(
    $id: uuid!
    $timezone: String!
    $distance_unit: String!
    $mass_unit: String!
    $elevation_unit: String!
    $volume_unit: String!
    $temperature_unit: String!
  ) {
    update_user_preferences_by_pk(
      pk_columns: { id: $id }
      _set: {
        timezone: $timezone
        distance_unit: $distance_unit
        mass_unit: $mass_unit
        elevation_unit: $elevation_unit
        volume_unit: $volume_unit
        temperature_unit: $temperature_unit
      }
    ) {
      id
    }
  }
`;

export const INSERT_PRIVACY_ACKNOWLEDGEMENT = /* GraphQL */ `
  mutation InsertPrivacyAcknowledgement($document_version: String!) {
    insert_privacy_acknowledgements_one(
      object: { document_version: $document_version }
    ) {
      id
    }
  }
`;

export const INSERT_GOAL = /* GraphQL */ `
  mutation InsertGoal(
    $status: String!
    $race_type: String!
    $race_distance_m: numeric!
    $race_date: date
    $target_duration_s: Int
    $target_pace_s_per_km: numeric
    $target_mass_kg: numeric
    $weekly_run_distance_m: numeric
    $weekly_run_duration_s: Int
    $weekly_strength_sessions: Int
    $weekly_strength_duration_s: Int
    $notes: String
  ) {
    insert_goals_one(
      object: {
        status: $status
        race_type: $race_type
        race_distance_m: $race_distance_m
        race_date: $race_date
        target_duration_s: $target_duration_s
        target_pace_s_per_km: $target_pace_s_per_km
        target_mass_kg: $target_mass_kg
        weekly_run_distance_m: $weekly_run_distance_m
        weekly_run_duration_s: $weekly_run_duration_s
        weekly_strength_sessions: $weekly_strength_sessions
        weekly_strength_duration_s: $weekly_strength_duration_s
        notes: $notes
      }
    ) {
      id
    }
  }
`;

export const UPDATE_GOAL = /* GraphQL */ `
  mutation UpdateGoal(
    $id: uuid!
    $race_type: String!
    $race_distance_m: numeric!
    $race_date: date
    $target_duration_s: Int
    $target_pace_s_per_km: numeric
    $target_mass_kg: numeric
    $weekly_run_distance_m: numeric
    $weekly_run_duration_s: Int
    $weekly_strength_sessions: Int
    $weekly_strength_duration_s: Int
    $notes: String
  ) {
    update_goals_by_pk(
      pk_columns: { id: $id }
      _set: {
        race_type: $race_type
        race_distance_m: $race_distance_m
        race_date: $race_date
        target_duration_s: $target_duration_s
        target_pace_s_per_km: $target_pace_s_per_km
        target_mass_kg: $target_mass_kg
        weekly_run_distance_m: $weekly_run_distance_m
        weekly_run_duration_s: $weekly_run_duration_s
        weekly_strength_sessions: $weekly_strength_sessions
        weekly_strength_duration_s: $weekly_strength_duration_s
        notes: $notes
      }
    ) {
      id
    }
  }
`;

export const INSERT_GOAL_SNAPSHOT = /* GraphQL */ `
  mutation InsertGoalSnapshot(
    $goal_id: uuid!
    $race_type: String!
    $race_distance_m: numeric!
    $race_date: date
    $target_duration_s: Int
    $target_pace_s_per_km: numeric
    $target_mass_kg: numeric
    $weekly_run_distance_m: numeric
    $weekly_run_duration_s: Int
    $weekly_strength_sessions: Int
    $weekly_strength_duration_s: Int
  ) {
    insert_goal_snapshots_one(
      object: {
        goal_id: $goal_id
        source: "user_edit"
        race_type: $race_type
        race_distance_m: $race_distance_m
        race_date: $race_date
        target_duration_s: $target_duration_s
        target_pace_s_per_km: $target_pace_s_per_km
        target_mass_kg: $target_mass_kg
        weekly_run_distance_m: $weekly_run_distance_m
        weekly_run_duration_s: $weekly_run_duration_s
        weekly_strength_sessions: $weekly_strength_sessions
        weekly_strength_duration_s: $weekly_strength_duration_s
      }
    ) {
      id
    }
  }
`;

export const INSERT_FILE_INTEGRATION = /* GraphQL */ `
  mutation InsertFileIntegration {
    insert_integrations_one(
      object: { provider: "garmin-file", status: "active" }
    ) {
      id
    }
  }
`;

export const INSERT_AUDIT_EVENT = /* GraphQL */ `
  mutation InsertAuditEvent(
    $action: String!
    $entity_type: String
    $entity_id: uuid
  ) {
    insert_audit_events_one(
      object: {
        action: $action
        entity_type: $entity_type
        entity_id: $entity_id
      }
    ) {
      id
    }
  }
`;
