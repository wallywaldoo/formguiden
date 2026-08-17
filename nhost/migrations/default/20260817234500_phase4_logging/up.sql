-- Phase 4 logging: nutrition, AI estimate requests, hydration, strength.
-- SECURITY INVOKER default. No SECURITY DEFINER.

CREATE TABLE public.ai_estimation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  provider text NOT NULL,
  model text,
  status text NOT NULL,
  prompt_description text NOT NULL,
  locale text,
  response_energy_kcal numeric,
  response_protein_g numeric,
  response_carbohydrate_g numeric,
  response_fat_g numeric,
  response_fiber_g numeric,
  assumptions text,
  confidence text,
  range_energy_kcal_min numeric,
  range_energy_kcal_max numeric,
  error_code text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_estimation_requests_provider_check CHECK (
    provider IN ('none', 'openai', 'anthropic', 'stub')
  ),
  CONSTRAINT ai_estimation_requests_status_check CHECK (
    status IN ('pending', 'succeeded', 'failed', 'rate_limited')
  ),
  CONSTRAINT ai_estimation_requests_prompt_check CHECK (
    char_length(prompt_description) BETWEEN 1 AND 2000
  ),
  CONSTRAINT ai_estimation_requests_confidence_check CHECK (
    confidence IS NULL OR confidence IN ('low', 'medium', 'high')
  ),
  CONSTRAINT ai_estimation_requests_energy_check CHECK (
    response_energy_kcal IS NULL OR response_energy_kcal >= 0
  ),
  CONSTRAINT ai_estimation_requests_protein_check CHECK (
    response_protein_g IS NULL OR response_protein_g >= 0
  ),
  CONSTRAINT ai_estimation_requests_carb_check CHECK (
    response_carbohydrate_g IS NULL OR response_carbohydrate_g >= 0
  ),
  CONSTRAINT ai_estimation_requests_fat_check CHECK (
    response_fat_g IS NULL OR response_fat_g >= 0
  ),
  CONSTRAINT ai_estimation_requests_fiber_check CHECK (
    response_fiber_g IS NULL OR response_fiber_g >= 0
  )
);

CREATE INDEX ai_estimation_requests_user_created_idx
  ON public.ai_estimation_requests (user_id, created_at DESC);

CREATE TABLE public.nutrition_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  eaten_at timestamptz NOT NULL,
  meal_type text NOT NULL,
  description text NOT NULL,
  energy_kcal numeric,
  protein_g numeric,
  carbohydrate_g numeric,
  fat_g numeric,
  fiber_g numeric,
  provenance text NOT NULL,
  ai_estimation_request_id uuid REFERENCES public.ai_estimation_requests (id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_entries_meal_type_check CHECK (
    meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'other')
  ),
  CONSTRAINT nutrition_entries_description_check CHECK (
    char_length(description) BETWEEN 1 AND 2000
  ),
  CONSTRAINT nutrition_entries_provenance_check CHECK (
    provenance IN ('manual', 'ai_estimated', 'ai_estimated_edited')
  ),
  CONSTRAINT nutrition_entries_energy_check CHECK (
    energy_kcal IS NULL OR energy_kcal >= 0
  ),
  CONSTRAINT nutrition_entries_protein_check CHECK (
    protein_g IS NULL OR protein_g >= 0
  ),
  CONSTRAINT nutrition_entries_carb_check CHECK (
    carbohydrate_g IS NULL OR carbohydrate_g >= 0
  ),
  CONSTRAINT nutrition_entries_fat_check CHECK (
    fat_g IS NULL OR fat_g >= 0
  ),
  CONSTRAINT nutrition_entries_fiber_check CHECK (
    fiber_g IS NULL OR fiber_g >= 0
  )
);

CREATE INDEX nutrition_entries_user_eaten_idx
  ON public.nutrition_entries (user_id, eaten_at DESC);

CREATE TABLE public.hydration_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  consumed_at timestamptz NOT NULL,
  volume_ml numeric NOT NULL,
  beverage_type text NOT NULL,
  caffeine_mg numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hydration_entries_volume_check CHECK (volume_ml > 0),
  CONSTRAINT hydration_entries_beverage_check CHECK (
    beverage_type IN ('water', 'coffee', 'tea', 'electrolyte', 'other')
  ),
  CONSTRAINT hydration_entries_caffeine_check CHECK (
    caffeine_mg IS NULL OR caffeine_mg >= 0
  )
);

CREATE INDEX hydration_entries_user_consumed_idx
  ON public.hydration_entries (user_id, consumed_at DESC);

CREATE TABLE public.strength_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  duration_s integer,
  perceived_effort numeric,
  notes text,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT strength_sessions_duration_check CHECK (
    duration_s IS NULL OR duration_s > 0
  ),
  CONSTRAINT strength_sessions_effort_check CHECK (
    perceived_effort IS NULL
    OR (perceived_effort >= 1 AND perceived_effort <= 10)
  ),
  CONSTRAINT strength_sessions_source_check CHECK (
    source IN ('garmin-file', 'garmin-api', 'manual', 'derived', 'system')
  )
);

CREATE INDEX strength_sessions_user_started_idx
  ON public.strength_sessions (user_id, started_at DESC);

CREATE TABLE public.strength_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.strength_sessions (id) ON DELETE CASCADE,
  set_index integer NOT NULL,
  exercise_name text NOT NULL,
  repetitions integer,
  mass_kg numeric,
  rpe numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT strength_sets_index_check CHECK (set_index >= 1),
  CONSTRAINT strength_sets_name_check CHECK (
    char_length(exercise_name) BETWEEN 1 AND 120
  ),
  CONSTRAINT strength_sets_reps_check CHECK (
    repetitions IS NULL OR repetitions > 0
  ),
  CONSTRAINT strength_sets_mass_check CHECK (mass_kg IS NULL OR mass_kg >= 0),
  CONSTRAINT strength_sets_rpe_check CHECK (
    rpe IS NULL OR (rpe >= 1 AND rpe <= 10)
  ),
  CONSTRAINT strength_sets_session_index_key UNIQUE (session_id, set_index)
);

CREATE INDEX strength_sets_user_session_idx
  ON public.strength_sets (user_id, session_id);

CREATE OR REPLACE FUNCTION public.enforce_nutrition_ai_request_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.ai_estimation_request_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.ai_estimation_requests
    WHERE id = NEW.ai_estimation_request_id
      AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'ai estimation request must belong to the same user';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER nutrition_entries_ai_request_owner
  BEFORE INSERT OR UPDATE ON public.nutrition_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_nutrition_ai_request_owner();

CREATE OR REPLACE FUNCTION public.enforce_strength_set_session_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.strength_sessions
    WHERE id = NEW.session_id
      AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'strength set session must belong to the same user';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER strength_sets_session_owner
  BEFORE INSERT OR UPDATE ON public.strength_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_strength_set_session_owner();

CREATE TRIGGER set_updated_at_nutrition_entries
  BEFORE UPDATE ON public.nutrition_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_hydration_entries
  BEFORE UPDATE ON public.hydration_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_strength_sessions
  BEFORE UPDATE ON public.strength_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_strength_sets
  BEFORE UPDATE ON public.strength_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
