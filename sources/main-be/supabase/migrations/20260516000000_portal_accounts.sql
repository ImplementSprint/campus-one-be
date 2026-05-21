-- Migration: Create portal_accounts table
-- Owner:     CAMPUS-ONE-MAIN-BE
--
-- This table stores accounts created on the main sign-up page.
-- It is intentionally DECOUPLED from super_admins — no foreign keys link the two.
-- Synchronisation with super_admins is handled exclusively via inter-service
-- HTTP API calls (microservices pattern). The shared natural key is `email`.

CREATE TABLE IF NOT EXISTS public.portal_accounts (
  id         UUID        NOT NULL,          -- Supabase Auth UID copied as a plain value (no FK)
  email      TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT portal_accounts_pkey PRIMARY KEY (id)
);

-- Keep updated_at current on any row update
CREATE OR REPLACE FUNCTION public.portal_accounts_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER portal_accounts_set_updated_at
  BEFORE UPDATE ON public.portal_accounts
  FOR EACH ROW EXECUTE FUNCTION public.portal_accounts_set_updated_at();

CREATE INDEX IF NOT EXISTS portal_accounts_email_idx ON public.portal_accounts (email);

-- Row-Level Security
ALTER TABLE public.portal_accounts ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own record
CREATE POLICY "portal_accounts_select_own"
  ON public.portal_accounts
  FOR SELECT
  USING (auth.uid() = id);

-- All writes are performed exclusively by the CAMPUS-ONE-MAIN-BE service role key,
-- which bypasses RLS. No additional write policies are needed.
