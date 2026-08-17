-- Phase 1 foundation: identity, preferences, goals, integrations, audit, import bucket.
-- SECURITY INVOKER default. No SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text,
  date_of_birth date,
  sex_at_birth text,
  onboarding_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_sex_at_birth_check CHECK (
    sex_at_birth IS NULL
    OR sex_at_birth IN ('female', 'male', 'unspecified')
  )
);

CREATE TABLE public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
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

CREATE TABLE public.privacy_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  document_version text NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  ip_hash text,
  CONSTRAINT privacy_acknowledgements_user_document_key UNIQUE (user_id, document_version)
);

CREATE INDEX privacy_acknowledgements_user_id_idx
  ON public.privacy_acknowledgements (user_id);

CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
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

CREATE UNIQUE INDEX goals_one_active_per_user
  ON public.goals (user_id)
  WHERE status = 'active';

CREATE INDEX goals_user_id_idx ON public.goals (user_id);

CREATE TABLE public.goal_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
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

CREATE INDEX goal_snapshots_user_id_idx ON public.goal_snapshots (user_id);
CREATE INDEX goal_snapshots_goal_id_idx ON public.goal_snapshots (goal_id);

CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL,
  external_athlete_id text,
  connected_at timestamptz,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT integrations_provider_check CHECK (provider IN ('garmin-file', 'garmin-api')),
  CONSTRAINT integrations_status_check CHECK (status IN ('active', 'disabled')),
  CONSTRAINT integrations_user_provider_key UNIQUE (user_id, provider)
);

CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_user_id_created_at_idx
  ON public.audit_events (user_id, created_at DESC);

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_user_preferences
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_goals
  BEFORE UPDATE ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_integrations
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

INSERT INTO storage.buckets (
  id,
  min_upload_file_size,
  max_upload_file_size,
  cache_control,
  presigned_urls_enabled,
  download_expiration
) VALUES (
  'garmin-imports',
  1,
  26214400,
  'private, no-store',
  true,
  30
)
ON CONFLICT (id) DO UPDATE
SET
  min_upload_file_size = EXCLUDED.min_upload_file_size,
  max_upload_file_size = EXCLUDED.max_upload_file_size,
  cache_control = EXCLUDED.cache_control,
  presigned_urls_enabled = EXCLUDED.presigned_urls_enabled,
  download_expiration = EXCLUDED.download_expiration;
