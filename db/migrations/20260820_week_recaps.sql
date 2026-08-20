-- Weekly recap snapshots, written on Monday and shown in Veckorapport.
CREATE TABLE IF NOT EXISTS public.week_recaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  week_end date NOT NULL,
  score smallint NOT NULL,
  medal text NOT NULL,
  headline text NOT NULL,
  summary text NOT NULL,
  dimensions jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT week_recaps_week_start_key UNIQUE (week_start),
  CONSTRAINT week_recaps_score_check CHECK (score BETWEEN 1 AND 10),
  CONSTRAINT week_recaps_medal_check CHECK (medal IN ('gold', 'silver', 'bronze', 'none'))
);

CREATE INDEX IF NOT EXISTS week_recaps_week_start_idx
  ON public.week_recaps (week_start DESC);

DROP TRIGGER IF EXISTS set_updated_at_week_recaps ON public.week_recaps;
CREATE TRIGGER set_updated_at_week_recaps BEFORE UPDATE ON public.week_recaps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
