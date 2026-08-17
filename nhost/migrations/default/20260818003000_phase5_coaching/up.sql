-- Phase 5: recommendations, export jobs, account deletion, user-exports bucket.

CREATE TABLE public.recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
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

CREATE INDEX recommendations_user_generated_idx
  ON public.recommendations (user_id, generated_at DESC);

CREATE TABLE public.recommendation_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
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

CREATE OR REPLACE FUNCTION public.enforce_recommendation_signal_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.recommendations
    WHERE id = NEW.recommendation_id
      AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'recommendation signal must belong to the same user';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER recommendation_signals_owner
  BEFORE INSERT OR UPDATE ON public.recommendation_signals
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_recommendation_signal_owner();

CREATE TABLE public.data_export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL,
  storage_file_id uuid REFERENCES storage.files (id),
  error_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT data_export_jobs_status_check CHECK (
    status IN ('queued', 'processing', 'ready', 'failed')
  )
);

CREATE INDEX data_export_jobs_user_created_idx
  ON public.data_export_jobs (user_id, created_at DESC);

CREATE TABLE public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  purge_after timestamptz NOT NULL,
  cancelled_at timestamptz,
  purged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_deletion_requests_status_check CHECK (
    status IN ('pending', 'cancelled', 'purged')
  )
);

CREATE UNIQUE INDEX account_deletion_one_pending_per_user
  ON public.account_deletion_requests (user_id)
  WHERE status = 'pending';

CREATE INDEX account_deletion_purge_after_idx
  ON public.account_deletion_requests (purge_after)
  WHERE status = 'pending';

CREATE TRIGGER set_updated_at_data_export_jobs
  BEFORE UPDATE ON public.data_export_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_account_deletion_requests
  BEFORE UPDATE ON public.account_deletion_requests
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
  'user-exports',
  1,
  52428800,
  'private, no-store',
  true,
  300
)
ON CONFLICT (id) DO UPDATE
SET
  min_upload_file_size = EXCLUDED.min_upload_file_size,
  max_upload_file_size = EXCLUDED.max_upload_file_size,
  cache_control = EXCLUDED.cache_control,
  presigned_urls_enabled = EXCLUDED.presigned_urls_enabled,
  download_expiration = EXCLUDED.download_expiration;
