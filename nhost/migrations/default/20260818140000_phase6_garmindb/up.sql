-- Phase 6: GarminDB local-export compatibility.
--
-- GarminDB runs on the user's own computer and stays outside this system's
-- trust boundary. Nothing here connects to Garmin Connect or stores any
-- Garmin credential. See docs/garmindb-compatibility.md.

-- 'garmindb' is a file-import provider, not a connected integration, so
-- public.integrations is deliberately left unchanged.
ALTER TABLE public.data_imports
  DROP CONSTRAINT IF EXISTS data_imports_provider_check;

ALTER TABLE public.data_imports
  ADD CONSTRAINT data_imports_provider_check
  CHECK (provider IN ('garmin-file', 'garmin-api', 'garmindb'));

ALTER TABLE public.import_files
  DROP CONSTRAINT IF EXISTS import_files_kind_check;

ALTER TABLE public.import_files
  ADD CONSTRAINT import_files_kind_check
  CHECK (
    detected_kind IS NULL
    OR detected_kind IN ('fit', 'tcx', 'gpx', 'csv', 'zip', 'sqlite', 'unknown')
  );

ALTER TABLE public.strength_sessions
  DROP CONSTRAINT IF EXISTS strength_sessions_source_check;

ALTER TABLE public.strength_sessions
  ADD CONSTRAINT strength_sessions_source_check
  CHECK (
    source IN ('garmin-file', 'garmin-api', 'garmindb', 'manual', 'derived', 'system')
  );

-- Provenance for a GarminDB import: schema version, resolved measurement
-- system, and the assumed timezone. Recorded so a later unit or timezone bug
-- can be traced to the exact rows it produced.
ALTER TABLE public.import_files
  ADD COLUMN IF NOT EXISTS source_provenance jsonb;

COMMENT ON COLUMN public.import_files.source_provenance IS
  'Non-identifying parse provenance. Must never contain credentials, device serial numbers, or file paths outside the uploaded archive.';

-- Quarantine bucket. Uploads land here before validation and are moved to
-- garmin-imports only after the file passes every check and the user confirms.
-- Objects that never graduate are deleted, so credential material a user
-- uploads by mistake does not persist in the durable bucket.
INSERT INTO storage.buckets (
  id,
  min_upload_file_size,
  max_upload_file_size,
  cache_control,
  presigned_urls_enabled,
  download_expiration
) VALUES (
  'garmindb-quarantine',
  1,
  26214400,
  'private, no-store',
  false,
  30
)
ON CONFLICT (id) DO UPDATE
SET
  min_upload_file_size = EXCLUDED.min_upload_file_size,
  max_upload_file_size = EXCLUDED.max_upload_file_size,
  cache_control = EXCLUDED.cache_control,
  presigned_urls_enabled = EXCLUDED.presigned_urls_enabled,
  download_expiration = EXCLUDED.download_expiration;
