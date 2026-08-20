-- Coach recaps for completed activities (score, plan fit, short take).
CREATE TABLE IF NOT EXISTS public.activity_recaps (
  activity_id uuid PRIMARY KEY REFERENCES public.activities (id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  payload jsonb NOT NULL,
  source text NOT NULL,
  model text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_recaps_source_check CHECK (source IN ('rules', 'stub', 'openai'))
);

DROP TRIGGER IF EXISTS set_updated_at_activity_recaps ON public.activity_recaps;
CREATE TRIGGER set_updated_at_activity_recaps BEFORE UPDATE ON public.activity_recaps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
