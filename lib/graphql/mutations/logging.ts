export const INSERT_NUTRITION_ENTRY = /* GraphQL */ `
  mutation InsertNutritionEntry(
    $eaten_at: timestamptz!
    $meal_type: String!
    $description: String!
    $energy_kcal: numeric
    $protein_g: numeric
    $carbohydrate_g: numeric
    $fat_g: numeric
    $fiber_g: numeric
    $provenance: String!
    $ai_estimation_request_id: uuid
    $notes: String
  ) {
    insert_nutrition_entries_one(
      object: {
        eaten_at: $eaten_at
        meal_type: $meal_type
        description: $description
        energy_kcal: $energy_kcal
        protein_g: $protein_g
        carbohydrate_g: $carbohydrate_g
        fat_g: $fat_g
        fiber_g: $fiber_g
        provenance: $provenance
        ai_estimation_request_id: $ai_estimation_request_id
        notes: $notes
      }
    ) {
      id
    }
  }
`;

export const DELETE_NUTRITION_ENTRY = /* GraphQL */ `
  mutation DeleteNutritionEntry($id: uuid!) {
    delete_nutrition_entries_by_pk(id: $id) {
      id
    }
  }
`;

export const INSERT_HYDRATION_ENTRY = /* GraphQL */ `
  mutation InsertHydrationEntry(
    $consumed_at: timestamptz!
    $volume_ml: numeric!
    $beverage_type: String!
    $caffeine_mg: numeric
    $notes: String
  ) {
    insert_hydration_entries_one(
      object: {
        consumed_at: $consumed_at
        volume_ml: $volume_ml
        beverage_type: $beverage_type
        caffeine_mg: $caffeine_mg
        notes: $notes
      }
    ) {
      id
    }
  }
`;

export const DELETE_HYDRATION_ENTRY = /* GraphQL */ `
  mutation DeleteHydrationEntry($id: uuid!) {
    delete_hydration_entries_by_pk(id: $id) {
      id
    }
  }
`;

export const INSERT_MANUAL_BODY_MEASUREMENT = /* GraphQL */ `
  mutation InsertManualBodyMeasurement(
    $measured_at: timestamptz!
    $mass_kg: numeric!
    $body_fat_pct: numeric
    $notes: String
  ) {
    insert_body_measurements_one(
      object: {
        measured_at: $measured_at
        source: "manual"
        mass_kg: $mass_kg
        body_fat_pct: $body_fat_pct
        notes: $notes
      }
    ) {
      id
    }
  }
`;

export const DELETE_BODY_MEASUREMENT = /* GraphQL */ `
  mutation DeleteBodyMeasurement($id: uuid!) {
    delete_body_measurements_by_pk(id: $id) {
      id
    }
  }
`;

export const INSERT_STRENGTH_SESSION = /* GraphQL */ `
  mutation InsertStrengthSession(
    $started_at: timestamptz!
    $duration_s: Int
    $perceived_effort: numeric
    $notes: String
  ) {
    insert_strength_sessions_one(
      object: {
        started_at: $started_at
        duration_s: $duration_s
        perceived_effort: $perceived_effort
        notes: $notes
        source: "manual"
      }
    ) {
      id
    }
  }
`;

export const UPDATE_STRENGTH_SESSION = /* GraphQL */ `
  mutation UpdateStrengthSession(
    $id: uuid!
    $started_at: timestamptz!
    $duration_s: Int
    $perceived_effort: numeric
    $notes: String
  ) {
    update_strength_sessions_by_pk(
      pk_columns: { id: $id }
      _set: {
        started_at: $started_at
        duration_s: $duration_s
        perceived_effort: $perceived_effort
        notes: $notes
      }
    ) {
      id
    }
  }
`;

export const DELETE_STRENGTH_SESSION = /* GraphQL */ `
  mutation DeleteStrengthSession($id: uuid!) {
    delete_strength_sessions_by_pk(id: $id) {
      id
    }
  }
`;

export const INSERT_STRENGTH_SET = /* GraphQL */ `
  mutation InsertStrengthSet(
    $session_id: uuid!
    $set_index: Int!
    $exercise_name: String!
    $repetitions: Int
    $mass_kg: numeric
    $rpe: numeric
    $notes: String
  ) {
    insert_strength_sets_one(
      object: {
        session_id: $session_id
        set_index: $set_index
        exercise_name: $exercise_name
        repetitions: $repetitions
        mass_kg: $mass_kg
        rpe: $rpe
        notes: $notes
      }
    ) {
      id
    }
  }
`;

export const DELETE_STRENGTH_SET = /* GraphQL */ `
  mutation DeleteStrengthSet($id: uuid!) {
    delete_strength_sets_by_pk(id: $id) {
      id
    }
  }
`;

export const INSERT_AI_ESTIMATION_REQUEST = /* GraphQL */ `
  mutation InsertAiEstimationRequest(
    $provider: String!
    $model: String
    $status: String!
    $prompt_description: String!
    $locale: String
    $response_energy_kcal: numeric
    $response_protein_g: numeric
    $response_carbohydrate_g: numeric
    $response_fat_g: numeric
    $response_fiber_g: numeric
    $assumptions: String
    $confidence: String
    $range_energy_kcal_min: numeric
    $range_energy_kcal_max: numeric
    $error_code: String
    $duration_ms: Int
  ) {
    insert_ai_estimation_requests_one(
      object: {
        provider: $provider
        model: $model
        status: $status
        prompt_description: $prompt_description
        locale: $locale
        response_energy_kcal: $response_energy_kcal
        response_protein_g: $response_protein_g
        response_carbohydrate_g: $response_carbohydrate_g
        response_fat_g: $response_fat_g
        response_fiber_g: $response_fiber_g
        assumptions: $assumptions
        confidence: $confidence
        range_energy_kcal_min: $range_energy_kcal_min
        range_energy_kcal_max: $range_energy_kcal_max
        error_code: $error_code
        duration_ms: $duration_ms
      }
    ) {
      id
    }
  }
`;
