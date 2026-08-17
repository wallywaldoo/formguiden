-- Phase 2: import jobs, preview tables, canonical activities/health/body.

CREATE TABLE public.data_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
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
  CONSTRAINT data_imports_provider_check CHECK (provider IN ('garmin-file', 'garmin-api')),
  CONSTRAINT data_imports_status_check CHECK (
    status IN (
      'uploaded',
      'queued',
      'processing',
      'preview_ready',
      'partial',
      'failed',
      'committed',
      'abandoned'
    )
  )
);

CREATE INDEX data_imports_user_id_created_at_idx
  ON public.data_imports (user_id, created_at DESC);

CREATE TABLE public.import_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  import_id uuid NOT NULL REFERENCES public.data_imports (id) ON DELETE CASCADE,
  storage_file_id uuid NOT NULL REFERENCES storage.files (id),
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT import_files_kind_check CHECK (
    detected_kind IS NULL
    OR detected_kind IN ('fit', 'tcx', 'gpx', 'csv', 'zip', 'unknown')
  ),
  CONSTRAINT import_files_status_check CHECK (
    status IN ('pending', 'processing', 'previewed', 'duplicate', 'failed', 'committed')
  ),
  CONSTRAINT import_files_byte_size_check CHECK (byte_size >= 0)
);

CREATE INDEX import_files_user_import_idx ON public.import_files (user_id, import_id);
CREATE INDEX import_files_storage_file_id_idx ON public.import_files (storage_file_id);
CREATE UNIQUE INDEX import_files_user_sha256_committed_idx
  ON public.import_files (user_id, sha256)
  WHERE status = 'committed';

CREATE TABLE public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  import_id uuid NOT NULL UNIQUE REFERENCES public.data_imports (id) ON DELETE CASCADE,
  cursor jsonb NOT NULL DEFAULT '{}'::jsonb,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activities_type_check CHECK (
    activity_type IN ('run', 'trail_run', 'treadmill', 'walk', 'hike', 'cycle', 'strength', 'other')
  ),
  CONSTRAINT activities_duration_s_check CHECK (duration_s IS NULL OR duration_s >= 0),
  CONSTRAINT activities_distance_m_check CHECK (distance_m IS NULL OR distance_m >= 0)
);

CREATE UNIQUE INDEX activities_user_source_external_id_idx
  ON public.activities (user_id, source, external_id)
  WHERE external_id IS NOT NULL;
CREATE INDEX activities_user_started_at_idx
  ON public.activities (user_id, started_at DESC);
CREATE INDEX activities_user_type_started_at_idx
  ON public.activities (user_id, activity_type, started_at DESC);

CREATE TABLE public.activity_laps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES public.activities (id) ON DELETE CASCADE,
  lap_index integer NOT NULL,
  kind text NOT NULL,
  started_at timestamptz,
  duration_s integer,
  distance_m numeric,
  avg_pace_s_per_km numeric,
  avg_heart_rate_bpm numeric,
  elevation_gain_m numeric,
  CONSTRAINT activity_laps_kind_check CHECK (kind IN ('lap', 'split')),
  CONSTRAINT activity_laps_activity_kind_index_key UNIQUE (activity_id, kind, lap_index)
);

CREATE INDEX activity_laps_user_id_idx ON public.activity_laps (user_id);

CREATE TABLE public.daily_health_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
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
  CONSTRAINT daily_health_metrics_user_date_source_key UNIQUE (user_id, local_date, source)
);

CREATE TABLE public.body_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
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

CREATE INDEX body_measurements_user_measured_at_idx
  ON public.body_measurements (user_id, measured_at DESC);

CREATE TABLE public.activity_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
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

CREATE INDEX activity_previews_user_import_idx
  ON public.activity_previews (user_id, import_id);

CREATE TABLE public.activity_lap_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
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
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
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
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
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

CREATE TRIGGER set_updated_at_data_imports
  BEFORE UPDATE ON public.data_imports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_import_files
  BEFORE UPDATE ON public.import_files
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_import_jobs
  BEFORE UPDATE ON public.import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_activities
  BEFORE UPDATE ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_daily_health_metrics
  BEFORE UPDATE ON public.daily_health_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_body_measurements
  BEFORE UPDATE ON public.body_measurements
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
