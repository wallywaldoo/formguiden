DROP TRIGGER IF EXISTS set_updated_at_account_deletion_requests ON public.account_deletion_requests;
DROP TRIGGER IF EXISTS set_updated_at_data_export_jobs ON public.data_export_jobs;
DROP TRIGGER IF EXISTS recommendation_signals_owner ON public.recommendation_signals;

DROP FUNCTION IF EXISTS public.enforce_recommendation_signal_owner();

DROP TABLE IF EXISTS public.recommendation_signals;
DROP TABLE IF EXISTS public.recommendations;
DROP TABLE IF EXISTS public.data_export_jobs;
DROP TABLE IF EXISTS public.account_deletion_requests;

DELETE FROM storage.buckets WHERE id = 'user-exports';
