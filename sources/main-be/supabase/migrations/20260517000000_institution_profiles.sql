CREATE TABLE IF NOT EXISTS public.institution_profiles (
  id               UUID        PRIMARY KEY,
  name             TEXT        NOT NULL DEFAULT '',
  representative   TEXT        NOT NULL DEFAULT '',
  email            TEXT        NOT NULL DEFAULT '',
  contact_number   TEXT        NOT NULL DEFAULT '',
  school_type      TEXT        NOT NULL DEFAULT '',
  target_subdomain TEXT        NOT NULL DEFAULT '',
  status           TEXT        NOT NULL DEFAULT 'draft',
  setup_progress   INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.institution_profiles_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER institution_profiles_set_updated_at
  BEFORE UPDATE ON public.institution_profiles
  FOR EACH ROW EXECUTE FUNCTION public.institution_profiles_set_updated_at();

ALTER TABLE public.institution_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "institution_profiles_select_own"
  ON public.institution_profiles FOR SELECT
  USING (auth.uid() = id);
