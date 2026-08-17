DROP TRIGGER IF EXISTS set_updated_at_body_measurements ON public.body_measurements;
DROP TRIGGER IF EXISTS set_updated_at_daily_health_metrics ON public.daily_health_metrics;
DROP TRIGGER IF EXISTS set_updated_at_activities ON public.activities;
DROP TRIGGER IF EXISTS set_updated_at_import_jobs ON public.import_jobs;
DROP TRIGGER IF EXISTS set_updated_at_import_files ON public.import_files;
DROP TRIGGER IF EXISTS set_updated_at_data_imports ON public.data_imports;

DROP TABLE IF EXISTS public.body_measurement_previews;
DROP TABLE IF EXISTS public.daily_health_metric_previews;
DROP TABLE IF EXISTS public.activity_lap_previews;
DROP TABLE IF EXISTS public.activity_previews;
DROP TABLE IF EXISTS public.body_measurements;
DROP TABLE IF EXISTS public.daily_health_metrics;
DROP TABLE IF EXISTS public.activity_laps;
DROP TABLE IF EXISTS public.activities;
DROP TABLE IF EXISTS public.import_jobs;
DROP TABLE IF EXISTS public.import_files;
DROP TABLE IF EXISTS public.data_imports;
