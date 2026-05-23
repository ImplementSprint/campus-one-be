CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.institution_profiles (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  representative TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  contact_number TEXT NOT NULL DEFAULT '',
  school_type TEXT NOT NULL DEFAULT '',
  target_subdomain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  setup_progress INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT institution_profiles_target_subdomain_required_lowercase_check CHECK (
    target_subdomain <> ''
    AND target_subdomain = LOWER(target_subdomain)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS institution_profiles_target_subdomain_unique_idx
  ON public.institution_profiles (target_subdomain);

CREATE INDEX IF NOT EXISTS institution_profiles_status_idx
  ON public.institution_profiles (status);

CREATE INDEX IF NOT EXISTS institution_profiles_email_idx
  ON public.institution_profiles (email);

CREATE OR REPLACE FUNCTION public.institution_profiles_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS
$$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS institution_profiles_set_updated_at ON public.institution_profiles;
CREATE TRIGGER institution_profiles_set_updated_at
  BEFORE UPDATE ON public.institution_profiles
  FOR EACH ROW EXECUTE PROCEDURE public.institution_profiles_set_updated_at();
