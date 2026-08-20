-- Formkurvan: single-user Vercel Postgres schema.
-- Migrated from Nhost/Hasura multi-tenant setup.
-- No user_id foreign keys to auth.users, no RLS, no multi-tenant features.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Identity & preferences
-- ---------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text,
  date_of_birth date,
  sex_at_birth text,
  height_cm numeric,
  onboarding_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_sex_at_birth_check CHECK (
    sex_at_birth IS NULL
    OR sex_at_birth IN ('female', 'male', 'unspecified')
  ),
  CONSTRAINT profiles_height_cm_check CHECK (
    height_cm IS NULL OR height_cm > 0
  )
);

CREATE TABLE public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timezone text NOT NULL DEFAULT 'Europe/Stockholm',
  locale text NOT NULL DEFAULT 'sv-SE',
  week_starts_on smallint NOT NULL DEFAULT 1,
  distance_unit text NOT NULL DEFAULT 'km',
  mass_unit text NOT NULL DEFAULT 'kg',
  elevation_unit text NOT NULL DEFAULT 'm',
  volume_unit text NOT NULL DEFAULT 'ml',
  temperature_unit text NOT NULL DEFAULT 'c',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_preferences_week_starts_on_check CHECK (week_starts_on BETWEEN 0 AND 6),
  CONSTRAINT user_preferences_distance_unit_check CHECK (distance_unit IN ('km', 'mi')),
  CONSTRAINT user_preferences_mass_unit_check CHECK (mass_unit IN ('kg', 'lb')),
  CONSTRAINT user_preferences_elevation_unit_check CHECK (elevation_unit IN ('m', 'ft')),
  CONSTRAINT user_preferences_volume_unit_check CHECK (volume_unit IN ('ml', 'floz')),
  CONSTRAINT user_preferences_temperature_unit_check CHECK (temperature_unit IN ('c', 'f'))
);

-- ---------------------------------------------------------------------------
-- Goals
-- ---------------------------------------------------------------------------

CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL,
  race_type text NOT NULL,
  race_distance_m numeric NOT NULL,
  race_date date,
  target_duration_s integer,
  target_pace_s_per_km numeric,
  target_mass_kg numeric,
  weekly_run_distance_m numeric,
  weekly_run_duration_s integer,
  weekly_strength_sessions integer,
  weekly_strength_duration_s integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT goals_status_check CHECK (status IN ('active', 'archived')),
  CONSTRAINT goals_race_type_check CHECK (
    race_type IN ('5k', '10k', 'half_marathon', 'marathon', 'custom')
  ),
  CONSTRAINT goals_race_distance_m_check CHECK (race_distance_m > 0),
  CONSTRAINT goals_target_duration_s_check CHECK (
    target_duration_s IS NULL OR target_duration_s > 0
  ),
  CONSTRAINT goals_target_mass_kg_check CHECK (
    target_mass_kg IS NULL OR target_mass_kg > 0
  )
);

CREATE UNIQUE INDEX goals_one_active
  ON public.goals (status)
  WHERE status = 'active';

CREATE TABLE public.goal_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.goals (id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  race_type text NOT NULL,
  race_distance_m numeric NOT NULL,
  race_date date,
  target_duration_s integer,
  target_pace_s_per_km numeric,
  target_mass_kg numeric,
  weekly_run_distance_m numeric,
  weekly_run_duration_s integer,
  weekly_strength_sessions integer,
  weekly_strength_duration_s integer,
  CONSTRAINT goal_snapshots_source_check CHECK (source IN ('user_edit', 'weekly_job'))
);

CREATE INDEX goal_snapshots_goal_id_idx ON public.goal_snapshots (goal_id);

-- ---------------------------------------------------------------------------
-- Integrations
-- ---------------------------------------------------------------------------

CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  status text NOT NULL,
  external_athlete_id text,
  connected_at timestamptz,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT integrations_provider_check CHECK (provider IN ('garmin-file', 'garmin-api')),
  CONSTRAINT integrations_status_check CHECK (status IN ('active', 'disabled'))
);

-- ---------------------------------------------------------------------------
-- Data imports & files
-- ---------------------------------------------------------------------------

CREATE TABLE public.data_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  status text NOT NULL,
  confirmed_at timestamptz,
  committed_at timestamptz,
  error_summary text,
  file_count integer NOT NULL DEFAULT 0,
  previewed_count integer NOT NULL DEFAULT 0,
  committed_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_imports_provider_check CHECK (
    provider IN ('garmin-file', 'garmin-api', 'garmindb', 'garmin-connect')
  ),
  CONSTRAINT data_imports_status_check CHECK (
    status IN (
      'uploaded', 'queued', 'processing', 'preview_ready',
      'partial', 'failed', 'committed', 'abandoned'
    )
  )
);

CREATE INDEX data_imports_created_at_idx
  ON public.data_imports (created_at DESC);

CREATE TABLE public.import_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.data_imports (id) ON DELETE CASCADE,
  storage_path text,
  original_filename text,
  declared_mime_type text,
  detected_kind text,
  byte_size bigint NOT NULL,
  sha256 text NOT NULL,
  status text NOT NULL,
  parent_file_id uuid REFERENCES public.import_files (id) ON DELETE CASCADE,
  zip_entry_path text,
  error_code text,
  error_message text,
  source_provenance jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT import_files_kind_check CHECK (
    detected_kind IS NULL
    OR detected_kind IN ('fit', 'tcx', 'gpx', 'csv', 'zip', 'sqlite', 'json', 'unknown')
  ),
  CONSTRAINT import_files_status_check CHECK (
    status IN ('pending', 'processing', 'previewed', 'duplicate', 'failed', 'committed')
  ),
  CONSTRAINT import_files_byte_size_check CHECK (byte_size >= 0)
);

CREATE INDEX import_files_import_idx ON public.import_files (import_id);
CREATE UNIQUE INDEX import_files_sha256_committed_idx
  ON public.import_files (sha256)
  WHERE status = 'committed';

CREATE TABLE public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL UNIQUE REFERENCES public.data_imports (id) ON DELETE CASCADE,
  cursor jsonb NOT NULL DEFAULT '{}'::jsonb,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Activities
-- ---------------------------------------------------------------------------

CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid REFERENCES public.data_imports (id) ON DELETE SET NULL,
  import_file_id uuid REFERENCES public.import_files (id) ON DELETE SET NULL,
  source text NOT NULL,
  external_id text,
  activity_type text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  duration_s integer,
  duration_kind text,
  distance_m numeric,
  elevation_gain_m numeric,
  elevation_loss_m numeric,
  avg_pace_s_per_km numeric,
  avg_heart_rate_bpm numeric,
  max_heart_rate_bpm numeric,
  avg_cadence numeric,
  calories_kcal numeric,
  training_load numeric,
  perceived_effort numeric,
  notes text,
  provider_payload jsonb,
  detail_hydrated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activities_type_check CHECK (
    activity_type IN ('run', 'trail_run', 'treadmill', 'walk', 'hike', 'cycle', 'strength', 'other')
  ),
  CONSTRAINT activities_duration_s_check CHECK (duration_s IS NULL OR duration_s >= 0),
  CONSTRAINT activities_distance_m_check CHECK (distance_m IS NULL OR distance_m >= 0)
);

CREATE UNIQUE INDEX activities_source_external_id_idx
  ON public.activities (source, external_id)
  WHERE external_id IS NOT NULL;
CREATE INDEX activities_started_at_idx
  ON public.activities (started_at DESC);
CREATE INDEX activities_type_started_at_idx
  ON public.activities (activity_type, started_at DESC);

CREATE TABLE public.activity_laps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities (id) ON DELETE CASCADE,
  lap_index integer NOT NULL,
  kind text NOT NULL,
  started_at timestamptz,
  duration_s integer,
  distance_m numeric,
  avg_pace_s_per_km numeric,
  avg_heart_rate_bpm numeric,
  elevation_gain_m numeric,
  max_heart_rate_bpm numeric,
  avg_cadence numeric,
  elevation_loss_m numeric,
  calories_kcal numeric,
  CONSTRAINT activity_laps_kind_check CHECK (kind IN ('lap', 'split')),
  CONSTRAINT activity_laps_activity_kind_index_key UNIQUE (activity_id, kind, lap_index)
);

CREATE TABLE public.activity_trackpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities (id) ON DELETE CASCADE,
  point_index integer NOT NULL,
  recorded_at timestamptz NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  altitude_m numeric,
  distance_m numeric,
  heart_rate_bpm numeric,
  cadence numeric,
  speed_mps numeric,
  power_w numeric,
  temperature_c numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_trackpoints_activity_point_key UNIQUE (activity_id, point_index)
);

CREATE INDEX activity_trackpoints_activity_recorded_idx
  ON public.activity_trackpoints (activity_id, recorded_at ASC);

CREATE TABLE public.activity_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities (id) ON DELETE CASCADE,
  sample_index integer NOT NULL,
  recorded_at timestamptz NOT NULL,
  elapsed_s integer,
  distance_m numeric,
  heart_rate_bpm numeric,
  cadence numeric,
  speed_mps numeric,
  altitude_m numeric,
  power_w numeric,
  temperature_c numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_samples_activity_sample_key UNIQUE (activity_id, sample_index)
);

CREATE INDEX activity_samples_activity_recorded_idx
  ON public.activity_samples (activity_id, recorded_at ASC);

-- ---------------------------------------------------------------------------
-- Health & body
-- ---------------------------------------------------------------------------

CREATE TABLE public.daily_health_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  local_date date NOT NULL,
  source text NOT NULL,
  import_id uuid REFERENCES public.data_imports (id) ON DELETE SET NULL,
  external_id text,
  sleep_duration_s integer,
  sleep_start_at timestamptz,
  sleep_end_at timestamptz,
  sleep_light_s integer,
  sleep_deep_s integer,
  sleep_rem_s integer,
  sleep_awake_s integer,
  hrv_rmssd_ms numeric,
  resting_heart_rate_bpm numeric,
  stress_avg numeric,
  body_battery_high numeric,
  body_battery_low numeric,
  steps integer,
  respiration_avg_brpm numeric,
  systolic_mmhg integer,
  diastolic_mmhg integer,
  provider_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_health_metrics_date_source_key UNIQUE (local_date, source)
);

CREATE TABLE public.body_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measured_at timestamptz NOT NULL,
  source text NOT NULL,
  import_id uuid REFERENCES public.data_imports (id) ON DELETE SET NULL,
  external_id text,
  mass_kg numeric,
  body_fat_pct numeric,
  waist_m numeric,
  systolic_mmhg integer,
  diastolic_mmhg integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT body_measurements_mass_kg_check CHECK (mass_kg IS NULL OR mass_kg > 0),
  CONSTRAINT body_measurements_body_fat_pct_check CHECK (
    body_fat_pct IS NULL OR (body_fat_pct >= 0 AND body_fat_pct <= 100)
  )
);

CREATE INDEX body_measurements_measured_at_idx
  ON public.body_measurements (measured_at DESC);
CREATE UNIQUE INDEX body_measurements_source_external_id_idx
  ON public.body_measurements (source, external_id)
  WHERE external_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Previews (transient import data)
-- ---------------------------------------------------------------------------

CREATE TABLE public.activity_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.data_imports (id) ON DELETE CASCADE,
  import_file_id uuid NOT NULL REFERENCES public.import_files (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  source text NOT NULL,
  external_id text,
  activity_type text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  duration_s integer,
  duration_kind text,
  distance_m numeric,
  elevation_gain_m numeric,
  elevation_loss_m numeric,
  avg_pace_s_per_km numeric,
  avg_heart_rate_bpm numeric,
  max_heart_rate_bpm numeric,
  avg_cadence numeric,
  calories_kcal numeric,
  training_load numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX activity_previews_import_idx
  ON public.activity_previews (import_id);

CREATE TABLE public.activity_lap_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.data_imports (id) ON DELETE CASCADE,
  activity_preview_id uuid NOT NULL REFERENCES public.activity_previews (id) ON DELETE CASCADE,
  lap_index integer NOT NULL,
  kind text NOT NULL,
  started_at timestamptz,
  duration_s integer,
  distance_m numeric,
  avg_pace_s_per_km numeric,
  avg_heart_rate_bpm numeric,
  elevation_gain_m numeric
);

CREATE TABLE public.daily_health_metric_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.data_imports (id) ON DELETE CASCADE,
  import_file_id uuid NOT NULL REFERENCES public.import_files (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  source text NOT NULL,
  external_id text,
  local_date date NOT NULL,
  sleep_duration_s integer,
  sleep_start_at timestamptz,
  sleep_end_at timestamptz,
  sleep_light_s integer,
  sleep_deep_s integer,
  sleep_rem_s integer,
  sleep_awake_s integer,
  hrv_rmssd_ms numeric,
  resting_heart_rate_bpm numeric,
  stress_avg numeric,
  body_battery_high numeric,
  body_battery_low numeric,
  steps integer,
  respiration_avg_brpm numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.body_measurement_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.data_imports (id) ON DELETE CASCADE,
  import_file_id uuid NOT NULL REFERENCES public.import_files (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  source text NOT NULL,
  external_id text,
  measured_at timestamptz NOT NULL,
  mass_kg numeric,
  body_fat_pct numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Nutrition & hydration
-- ---------------------------------------------------------------------------

CREATE TABLE public.ai_estimation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  model text,
  status text NOT NULL,
  prompt_description text NOT NULL,
  locale text,
  response_energy_kcal numeric,
  response_protein_g numeric,
  response_carbohydrate_g numeric,
  response_fat_g numeric,
  response_fiber_g numeric,
  assumptions text,
  confidence text,
  range_energy_kcal_min numeric,
  range_energy_kcal_max numeric,
  error_code text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_estimation_requests_provider_check CHECK (
    provider IN ('none', 'openai', 'anthropic', 'stub')
  ),
  CONSTRAINT ai_estimation_requests_status_check CHECK (
    status IN ('pending', 'succeeded', 'failed', 'rate_limited')
  ),
  CONSTRAINT ai_estimation_requests_confidence_check CHECK (
    confidence IS NULL OR confidence IN ('low', 'medium', 'high')
  )
);

CREATE INDEX ai_estimation_requests_created_idx
  ON public.ai_estimation_requests (created_at DESC);

CREATE TABLE public.nutrition_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eaten_at timestamptz NOT NULL,
  meal_type text NOT NULL,
  description text NOT NULL,
  energy_kcal numeric,
  protein_g numeric,
  carbohydrate_g numeric,
  fat_g numeric,
  fiber_g numeric,
  provenance text NOT NULL,
  ai_estimation_request_id uuid REFERENCES public.ai_estimation_requests (id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_entries_meal_type_check CHECK (
    meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'other')
  ),
  CONSTRAINT nutrition_entries_provenance_check CHECK (
    provenance IN ('manual', 'ai_estimated', 'ai_estimated_edited')
  )
);

CREATE INDEX nutrition_entries_eaten_idx
  ON public.nutrition_entries (eaten_at DESC);

CREATE TABLE public.hydration_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumed_at timestamptz NOT NULL,
  volume_ml numeric NOT NULL,
  beverage_type text NOT NULL,
  caffeine_mg numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hydration_entries_volume_check CHECK (volume_ml > 0),
  CONSTRAINT hydration_entries_beverage_check CHECK (
    beverage_type IN ('water', 'coffee', 'tea', 'electrolyte', 'other')
  )
);

CREATE INDEX hydration_entries_consumed_idx
  ON public.hydration_entries (consumed_at DESC);

-- ---------------------------------------------------------------------------
-- Strength
-- ---------------------------------------------------------------------------

CREATE TABLE public.strength_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL,
  duration_s integer,
  perceived_effort numeric,
  notes text,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT strength_sessions_duration_check CHECK (
    duration_s IS NULL OR duration_s > 0
  ),
  CONSTRAINT strength_sessions_effort_check CHECK (
    perceived_effort IS NULL
    OR (perceived_effort >= 1 AND perceived_effort <= 10)
  ),
  CONSTRAINT strength_sessions_source_check CHECK (
    source IN (
      'garmin-file', 'garmin-api', 'garmindb', 'garmin-connect',
      'manual', 'derived', 'system'
    )
  )
);

CREATE INDEX strength_sessions_started_idx
  ON public.strength_sessions (started_at DESC);

CREATE TABLE public.strength_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.strength_sessions (id) ON DELETE CASCADE,
  set_index integer NOT NULL,
  exercise_name text NOT NULL,
  repetitions integer,
  mass_kg numeric,
  rpe numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT strength_sets_index_check CHECK (set_index >= 1),
  CONSTRAINT strength_sets_reps_check CHECK (repetitions IS NULL OR repetitions > 0),
  CONSTRAINT strength_sets_mass_check CHECK (mass_kg IS NULL OR mass_kg >= 0),
  CONSTRAINT strength_sets_rpe_check CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
  CONSTRAINT strength_sets_session_index_key UNIQUE (session_id, set_index)
);

-- ---------------------------------------------------------------------------
-- Coaching: recommendations
-- ---------------------------------------------------------------------------

CREATE TABLE public.recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_at timestamptz NOT NULL DEFAULT now(),
  rule_id text NOT NULL,
  action_key text NOT NULL,
  action_sv text NOT NULL,
  comparison_period_days integer NOT NULL,
  completeness numeric,
  confidence text NOT NULL,
  disclaimer_key text NOT NULL,
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recommendations_confidence_check CHECK (
    confidence IN ('low', 'medium', 'high')
  ),
  CONSTRAINT recommendations_completeness_check CHECK (
    completeness IS NULL OR (completeness >= 0 AND completeness <= 1)
  ),
  CONSTRAINT recommendations_comparison_period_check CHECK (
    comparison_period_days > 0
  )
);

CREATE INDEX recommendations_generated_idx
  ON public.recommendations (generated_at DESC);

CREATE TABLE public.recommendation_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES public.recommendations (id) ON DELETE CASCADE,
  signal_key text NOT NULL,
  observed_value numeric,
  unit text,
  comparator text,
  reference_value numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX recommendation_signals_recommendation_idx
  ON public.recommendation_signals (recommendation_id);

-- ---------------------------------------------------------------------------
-- Coaching: daily and weekly training plans
-- ---------------------------------------------------------------------------

CREATE TABLE public.training_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_type text NOT NULL,
  local_date date NOT NULL,
  payload jsonb NOT NULL,
  rule_caps jsonb NOT NULL DEFAULT '[]'::jsonb,
  fingerprint text NOT NULL,
  source text NOT NULL,
  model text,
  feedback text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_plans_type_check CHECK (plan_type IN ('daily', 'week')),
  CONSTRAINT training_plans_source_check CHECK (source IN ('rules', 'stub', 'openai')),
  CONSTRAINT training_plans_type_date_key UNIQUE (plan_type, local_date)
);

CREATE INDEX training_plans_generated_idx
  ON public.training_plans (generated_at DESC);

-- ---------------------------------------------------------------------------
-- Weekly recaps
-- ---------------------------------------------------------------------------

CREATE TABLE public.week_recaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  week_end date NOT NULL,
  score smallint NOT NULL,
  medal text NOT NULL,
  headline text NOT NULL,
  summary text NOT NULL,
  dimensions jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT week_recaps_week_start_key UNIQUE (week_start),
  CONSTRAINT week_recaps_score_check CHECK (score BETWEEN 1 AND 10),
  CONSTRAINT week_recaps_medal_check CHECK (medal IN ('gold', 'silver', 'bronze', 'none'))
);

CREATE INDEX week_recaps_week_start_idx
  ON public.week_recaps (week_start DESC);

-- ---------------------------------------------------------------------------
-- Data exports
-- ---------------------------------------------------------------------------

CREATE TABLE public.data_export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL,
  file_path text,
  error_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT data_export_jobs_status_check CHECK (
    status IN ('queued', 'processing', 'ready', 'failed')
  )
);

CREATE INDEX data_export_jobs_created_idx
  ON public.data_export_jobs (created_at DESC);

-- ---------------------------------------------------------------------------
-- Triggers: set_updated_at
-- ---------------------------------------------------------------------------

CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_user_preferences BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_goals BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_integrations BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_data_imports BEFORE UPDATE ON public.data_imports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_import_files BEFORE UPDATE ON public.import_files
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_import_jobs BEFORE UPDATE ON public.import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_activities BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_daily_health_metrics BEFORE UPDATE ON public.daily_health_metrics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_body_measurements BEFORE UPDATE ON public.body_measurements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_nutrition_entries BEFORE UPDATE ON public.nutrition_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_hydration_entries BEFORE UPDATE ON public.hydration_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_strength_sessions BEFORE UPDATE ON public.strength_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_strength_sets BEFORE UPDATE ON public.strength_sets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_data_export_jobs BEFORE UPDATE ON public.data_export_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_training_plans BEFORE UPDATE ON public.training_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_week_recaps BEFORE UPDATE ON public.week_recaps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
