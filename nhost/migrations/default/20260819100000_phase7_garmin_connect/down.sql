DROP TABLE IF EXISTS public.automation_tokens;

DROP INDEX IF EXISTS body_measurements_user_source_external_id_idx;

ALTER TABLE public.strength_sessions
  DROP CONSTRAINT IF EXISTS strength_sessions_source_check;

ALTER TABLE public.strength_sessions
  ADD CONSTRAINT strength_sessions_source_check
  CHECK (
    source IN ('garmin-file', 'garmin-api', 'garmindb', 'manual', 'derived', 'system')
  );

ALTER TABLE public.import_files
  DROP CONSTRAINT IF EXISTS import_files_kind_check;

ALTER TABLE public.import_files
  ADD CONSTRAINT import_files_kind_check
  CHECK (
    detected_kind IS NULL
    OR detected_kind IN ('fit', 'tcx', 'gpx', 'csv', 'zip', 'sqlite', 'unknown')
  );

ALTER TABLE public.data_imports
  DROP CONSTRAINT IF EXISTS data_imports_provider_check;

ALTER TABLE public.data_imports
  ADD CONSTRAINT data_imports_provider_check
  CHECK (provider IN ('garmin-file', 'garmin-api', 'garmindb'));
