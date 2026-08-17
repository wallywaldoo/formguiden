DROP TRIGGER IF EXISTS set_updated_at_strength_sets ON public.strength_sets;
DROP TRIGGER IF EXISTS set_updated_at_strength_sessions ON public.strength_sessions;
DROP TRIGGER IF EXISTS set_updated_at_hydration_entries ON public.hydration_entries;
DROP TRIGGER IF EXISTS set_updated_at_nutrition_entries ON public.nutrition_entries;
DROP TRIGGER IF EXISTS strength_sets_session_owner ON public.strength_sets;
DROP TRIGGER IF EXISTS nutrition_entries_ai_request_owner ON public.nutrition_entries;

DROP FUNCTION IF EXISTS public.enforce_strength_set_session_owner();
DROP FUNCTION IF EXISTS public.enforce_nutrition_ai_request_owner();

DROP TABLE IF EXISTS public.strength_sets;
DROP TABLE IF EXISTS public.strength_sessions;
DROP TABLE IF EXISTS public.hydration_entries;
DROP TABLE IF EXISTS public.nutrition_entries;
DROP TABLE IF EXISTS public.ai_estimation_requests;
