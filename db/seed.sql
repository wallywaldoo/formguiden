-- Seed: single profile for the sole user of Formkurvan.
INSERT INTO public.profiles (display_name)
VALUES ('Viktor')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_preferences DEFAULT VALUES
ON CONFLICT DO NOTHING;
