CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.tenant_user_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_user_memberships_role_check CHECK (
    role IN (
      'school_owner',
      'school_admin',
      'registrar',
      'admissions_admin',
      'student_admin',
      'professor',
      'student',
      'applicant',
      'alumni',
      'alumni_admin'
    )
  ),
  CONSTRAINT tenant_user_memberships_status_check CHECK (status IN ('active', 'inactive', 'suspended')),
  CONSTRAINT tenant_user_memberships_unique_user_school UNIQUE (institution_id, user_id)
);

CREATE INDEX IF NOT EXISTS tenant_user_memberships_user_idx
  ON public.tenant_user_memberships (user_id, status);

CREATE INDEX IF NOT EXISTS tenant_user_memberships_institution_role_idx
  ON public.tenant_user_memberships (institution_id, role, status);

CREATE INDEX IF NOT EXISTS tenant_user_memberships_email_idx
  ON public.tenant_user_memberships (email);

CREATE OR REPLACE FUNCTION public.tenant_user_memberships_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS
$$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenant_user_memberships_set_updated_at ON public.tenant_user_memberships;
CREATE TRIGGER tenant_user_memberships_set_updated_at
  BEFORE UPDATE ON public.tenant_user_memberships
  FOR EACH ROW EXECUTE PROCEDURE public.tenant_user_memberships_set_updated_at();

CREATE TABLE IF NOT EXISTS public.portal_accounts (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS portal_accounts_email_idx
  ON public.portal_accounts (email);

CREATE OR REPLACE FUNCTION public.portal_accounts_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS
$$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS portal_accounts_set_updated_at ON public.portal_accounts;
CREATE TRIGGER portal_accounts_set_updated_at
  BEFORE UPDATE ON public.portal_accounts
  FOR EACH ROW EXECUTE PROCEDURE public.portal_accounts_set_updated_at();

CREATE TABLE IF NOT EXISTS public.admin_users (
  institution_id UUID NOT NULL,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  created_by UUID,
  CONSTRAINT admin_users_role_check CHECK (role IN ('admin', 'super_admin'))
);

CREATE INDEX IF NOT EXISTS admin_users_institution_idx
  ON public.admin_users (institution_id);

CREATE INDEX IF NOT EXISTS admin_users_email_idx
  ON public.admin_users (email);

CREATE TABLE IF NOT EXISTS public.student_accounts (
  institution_id UUID NOT NULL,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL UNIQUE,
  student_number TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  enrollment_status TEXT DEFAULT 'active',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enrolled_at TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  CONSTRAINT student_enrollment_status_check CHECK (enrollment_status IN ('active', 'inactive', 'graduated'))
);

CREATE INDEX IF NOT EXISTS student_accounts_institution_idx
  ON public.student_accounts (institution_id);

CREATE INDEX IF NOT EXISTS student_accounts_email_idx
  ON public.student_accounts (email);

CREATE TABLE IF NOT EXISTS public.professor_users (
  institution_id UUID NOT NULL,
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  department TEXT,
  employee_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS professor_users_institution_idx
  ON public.professor_users (institution_id);

CREATE INDEX IF NOT EXISTS professor_users_email_idx
  ON public.professor_users (email);

CREATE OR REPLACE FUNCTION public.professor_users_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS
$$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS professor_users_set_updated_at ON public.professor_users;
CREATE TRIGGER professor_users_set_updated_at
  BEFORE UPDATE ON public.professor_users
  FOR EACH ROW EXECUTE PROCEDURE public.professor_users_set_updated_at();

CREATE TABLE IF NOT EXISTS public.alumni (
  institution_id UUID NOT NULL,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  student_number TEXT UNIQUE,
  graduation_year INTEGER,
  program TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS alumni_institution_idx
  ON public.alumni (institution_id);

CREATE INDEX IF NOT EXISTS alumni_email_idx
  ON public.alumni (email);
