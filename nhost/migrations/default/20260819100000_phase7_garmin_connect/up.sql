-- Phase 7: automated garmin-connect ingest.
--
-- The runner lives on the user's machine. This migration only widens the
-- canonical source vocabulary and stops scheduled weigh-ins from duplicating.

ALTER TABLE public.data_imports
  DROP CONSTRAINT IF EXISTS data_imports_provider_check;

ALTER TABLE public.data_imports
  ADD CONSTRAINT data_imports_provider_check
  CHECK (provider IN ('garmin-file', 'garmin-api', 'garmindb', 'garmin-connect'));

ALTER TABLE public.import_files
  DROP CONSTRAINT IF EXISTS import_files_kind_check;

ALTER TABLE public.import_files
  ADD CONSTRAINT import_files_kind_check
  CHECK (
    detected_kind IS NULL
    OR detected_kind IN ('fit', 'tcx', 'gpx', 'csv', 'zip', 'sqlite', 'json', 'unknown')
  );

ALTER TABLE public.strength_sessions
  DROP CONSTRAINT IF EXISTS strength_sessions_source_check;

ALTER TABLE public.strength_sessions
  ADD CONSTRAINT strength_sessions_source_check
  CHECK (
    source IN (
      'garmin-file',
      'garmin-api',
      'garmindb',
      'garmin-connect',
      'manual',
      'derived',
      'system'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS body_measurements_user_source_external_id_idx
  ON public.body_measurements (user_id, source, external_id)
  WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.automation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  nhost_pat_id uuid NOT NULL,
  label text NOT NULL DEFAULT 'garmin-sync',
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT automation_tokens_label_check CHECK (char_length(label) BETWEEN 1 AND 64)
);

CREATE UNIQUE INDEX IF NOT EXISTS automation_tokens_nhost_pat_id_idx
  ON public.automation_tokens (nhost_pat_id);

CREATE INDEX IF NOT EXISTS automation_tokens_user_created_idx
  ON public.automation_tokens (user_id, created_at DESC);

COMMENT ON TABLE public.automation_tokens IS
  'Metadata for Nhost personal access tokens used by the local Garmin sync runner. The token secret is never stored.';
