-- Reverse of Phase 6.

DELETE FROM storage.files WHERE bucket_id = 'garmindb-quarantine';
DELETE FROM storage.buckets WHERE id = 'garmindb-quarantine';

ALTER TABLE public.import_files
  DROP COLUMN IF EXISTS source_provenance;

ALTER TABLE public.strength_sessions
  DROP CONSTRAINT IF EXISTS strength_sessions_source_check;

ALTER TABLE public.strength_sessions
  ADD CONSTRAINT strength_sessions_source_check
  CHECK (
    source IN ('garmin-file', 'garmin-api', 'manual', 'derived', 'system')
  );

ALTER TABLE public.import_files
  DROP CONSTRAINT IF EXISTS import_files_kind_check;

ALTER TABLE public.import_files
  ADD CONSTRAINT import_files_kind_check
  CHECK (
    detected_kind IS NULL
    OR detected_kind IN ('fit', 'tcx', 'gpx', 'csv', 'zip', 'unknown')
  );

ALTER TABLE public.data_imports
  DROP CONSTRAINT IF EXISTS data_imports_provider_check;

ALTER TABLE public.data_imports
  ADD CONSTRAINT data_imports_provider_check
  CHECK (provider IN ('garmin-file', 'garmin-api'));
