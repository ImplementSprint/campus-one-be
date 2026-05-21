-- Migration: Create super_admins table
-- Owner:     Super Admin Module (internal)
--
-- This table is written to by the super admin module's own service via API — never
-- directly from CAMPUS-ONE-MAIN-BE. It mirrors portal_accounts through inter-service
-- HTTP calls only. No foreign keys or primary-key references link the two tables.
-- The natural sync key is `email`.

CREATE TABLE IF NOT EXISTS public.super_admins (
  id         UUID        NOT NULL,          -- mirrors portal_accounts.id (plain value, no FK)
  email      TEXT        NOT NULL UNIQUE,   -- mirrors portal_accounts.email (plain value, no FK)
  role       TEXT        NOT NULL DEFAULT 'super_admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT super_admins_pkey PRIMARY KEY (id)
);

CREATE OR REPLACE FUNCTION public.super_admins_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER super_admins_set_updated_at
  BEFORE UPDATE ON public.super_admins
  FOR EACH ROW EXECUTE FUNCTION public.super_admins_set_updated_at();

CREATE INDEX IF NOT EXISTS super_admins_email_idx ON public.super_admins (email);

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Authenticated super admins can read their own record
CREATE POLICY "super_admins_select_own"
  ON public.super_admins
  FOR SELECT
  USING (auth.uid() = id);

-- All writes go through the super admin module's service role key (bypasses RLS).
