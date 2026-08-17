DROP TRIGGER IF EXISTS set_updated_at_integrations ON public.integrations;
DROP TRIGGER IF EXISTS set_updated_at_goals ON public.goals;
DROP TRIGGER IF EXISTS set_updated_at_user_preferences ON public.user_preferences;
DROP TRIGGER IF EXISTS set_updated_at_profiles ON public.profiles;

DROP TABLE IF EXISTS public.audit_events;
DROP TABLE IF EXISTS public.integrations;
DROP TABLE IF EXISTS public.goal_snapshots;
DROP TABLE IF EXISTS public.goals;
DROP TABLE IF EXISTS public.privacy_acknowledgements;
DROP TABLE IF EXISTS public.user_preferences;
DROP TABLE IF EXISTS public.profiles;

DROP FUNCTION IF EXISTS public.set_updated_at();

DELETE FROM storage.files WHERE bucket_id = 'garmin-imports';
DELETE FROM storage.buckets WHERE id = 'garmin-imports';
