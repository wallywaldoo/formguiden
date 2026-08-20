-- Profile height for calorie budget (Mifflin–St Jeor).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS height_cm numeric;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_height_cm_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_height_cm_check
      CHECK (height_cm IS NULL OR height_cm > 0);
  END IF;
END$$;
