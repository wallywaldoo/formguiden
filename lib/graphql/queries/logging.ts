export const LIST_NUTRITION = /* GraphQL */ `
  query ListNutrition($since: timestamptz!) {
    user_preferences {
      timezone
      locale
      mass_unit
      volume_unit
    }
    nutrition_entries(
      where: { eaten_at: { _gte: $since } }
      order_by: { eaten_at: desc }
      limit: 200
    ) {
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
    hydration_entries(
      where: { consumed_at: { _gte: $since } }
      order_by: { consumed_at: desc }
      limit: 200
    ) {
      id
      consumed_at
      volume_ml
      beverage_type
      caffeine_mg
      notes
    }
  }
`;

export const LIST_STRENGTH = /* GraphQL */ `
  query ListStrength($since: timestamptz!) {
    user_preferences {
      timezone
      mass_unit
    }
    goals(where: { status: { _eq: "active" } }, limit: 1) {
      weekly_strength_sessions
      weekly_strength_duration_s
    }
    strength_sessions(
      where: { started_at: { _gte: $since } }
      order_by: { started_at: desc }
      limit: 100
    ) {
      id
      started_at
      duration_s
      perceived_effort
      notes
      source
    }
  }
`;

export const GET_STRENGTH_SESSION = /* GraphQL */ `
  query GetStrengthSession($id: uuid!) {
    user_preferences {
      timezone
      mass_unit
    }
    strength_sessions_by_pk(id: $id) {
      id
      started_at
      duration_s
      perceived_effort
      notes
      source
    }
    strength_sets(
      where: { session_id: { _eq: $id } }
      order_by: { set_index: asc }
    ) {
      id
      set_index
      exercise_name
      repetitions
      mass_kg
      rpe
      notes
    }
  }
`;

export const LIST_RECENT_AI_ESTIMATES = /* GraphQL */ `
  query ListRecentAiEstimates($since: timestamptz!) {
    ai_estimation_requests(
      where: { created_at: { _gte: $since } }
      order_by: { created_at: desc }
      limit: 50
    ) {
      id
      created_at
      status
    }
  }
`;
