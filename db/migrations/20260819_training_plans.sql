-- Daily and weekly training plans generated from stats + optional AI.
CREATE TABLE IF NOT EXISTS public.training_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_type text NOT NULL,
  local_date date NOT NULL,
  payload jsonb NOT NULL,
  rule_caps jsonb NOT NULL DEFAULT '[]'::jsonb,
  fingerprint text NOT NULL,
  source text NOT NULL,
  model text,
  feedback text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_plans_type_check CHECK (plan_type IN ('daily', 'week')),
  CONSTRAINT training_plans_source_check CHECK (source IN ('rules', 'stub', 'openai')),
  CONSTRAINT training_plans_type_date_key UNIQUE (plan_type, local_date)
);

CREATE INDEX IF NOT EXISTS training_plans_generated_idx
  ON public.training_plans (generated_at DESC);

DROP TRIGGER IF EXISTS set_updated_at_training_plans ON public.training_plans;
CREATE TRIGGER set_updated_at_training_plans BEFORE UPDATE ON public.training_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
