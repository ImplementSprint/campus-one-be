ALTER TABLE public.portal_accounts
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE TABLE IF NOT EXISTS public.super_admins (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'super_admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT super_admins_role_check CHECK (role = 'super_admin')
);

CREATE INDEX IF NOT EXISTS super_admins_email_idx
  ON public.super_admins (email);

CREATE OR REPLACE FUNCTION public.super_admins_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS
$$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS super_admins_set_updated_at ON public.super_admins;
CREATE TRIGGER super_admins_set_updated_at
  BEFORE UPDATE ON public.super_admins
  FOR EACH ROW EXECUTE PROCEDURE public.super_admins_set_updated_at();

CREATE TABLE IF NOT EXISTS public.school_owner_accounts (
  id UUID PRIMARY KEY,
  institution_id UUID NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'school_owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT school_owner_accounts_role_check CHECK (role = 'school_owner')
);

CREATE INDEX IF NOT EXISTS school_owner_accounts_institution_idx
  ON public.school_owner_accounts (institution_id);

CREATE INDEX IF NOT EXISTS school_owner_accounts_email_idx
  ON public.school_owner_accounts (email);

CREATE OR REPLACE FUNCTION public.school_owner_accounts_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS
$$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS school_owner_accounts_set_updated_at ON public.school_owner_accounts;
CREATE TRIGGER school_owner_accounts_set_updated_at
  BEFORE UPDATE ON public.school_owner_accounts
  FOR EACH ROW EXECUTE PROCEDURE public.school_owner_accounts_set_updated_at();
