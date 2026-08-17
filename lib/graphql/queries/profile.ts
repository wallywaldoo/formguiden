export const GET_ONBOARDING_STATE = /* GraphQL */ `
  query GetOnboardingState {
    profiles {
      user_id
      display_name
      onboarding_completed_at
    }
  }
`;

export const GET_PROFILE_SETTINGS = /* GraphQL */ `
  query GetProfileSettings {
    profiles {
      user_id
      display_name
      onboarding_completed_at
      created_at
      updated_at
    }
    user_preferences {
      id
      timezone
      locale
      week_starts_on
      distance_unit
      mass_unit
      elevation_unit
      volume_unit
      temperature_unit
    }
    goals(where: { status: { _eq: "active" } }, limit: 1) {
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
      notes
    }
  }
`;
