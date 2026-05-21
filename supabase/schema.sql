-- =============================================================================
-- CampusOne — Full Platform Schema (Consolidated)
-- Target: Supabase (PostgreSQL 15+)
-- Note: auth.users, auth.uid() are Supabase built-ins — not SQL standard.
--       uuid_generate_v4() requires the uuid-ossp extension (enabled below).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Custom Schemas
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS alumni;

-- ---------------------------------------------------------------------------
-- Enum Types
-- ---------------------------------------------------------------------------
DO $$ BEGIN CREATE TYPE public.admission_status  AS ENUM ('Under Review', 'Passed', 'Not Accepted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.document_status   AS ENUM ('submitted', 'approved', 'rejected', 'pending'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_method    AS ENUM ('cash', 'gcash', 'bank_transfer', 'credit_card'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_status    AS ENUM ('pending', 'paid', 'failed', 'refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.reschedule_status AS ENUM ('pending', 'approved', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.exam_result       AS ENUM ('PASSED', 'FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.school_level      AS ENUM ('College', 'Senior High', 'Junior High', 'Graduate'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.applicant_type    AS ENUM ('New Student', 'Transferee', 'Returnee', 'Cross-enrollee'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- SECTION 1: AUTH / PORTAL
-- No foreign keys between these tables — microservice pattern.
-- Synchronisation happens via inter-service HTTP calls using email as natural key.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.portal_accounts (
  id         UUID        PRIMARY KEY,
  email      TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE INDEX IF NOT EXISTS portal_accounts_email_idx ON public.portal_accounts (email);

ALTER TABLE public.portal_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS portal_accounts_select_own ON public.portal_accounts;
CREATE POLICY portal_accounts_select_own ON public.portal_accounts
  FOR SELECT USING (auth.uid() = id);

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.super_admins (
  id         UUID        PRIMARY KEY,
  email      TEXT        NOT NULL UNIQUE,
  role       TEXT        NOT NULL DEFAULT 'super_admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE INDEX IF NOT EXISTS super_admins_email_idx ON public.super_admins (email);

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admins_select_own ON public.super_admins;
CREATE POLICY super_admins_select_own ON public.super_admins
  FOR SELECT USING (auth.uid() = id);

-- =============================================================================
-- SECTION 2: INSTITUTION PROFILES
-- =============================================================================

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

ALTER TABLE public.institution_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS institution_profiles_select_own ON public.institution_profiles;
CREATE POLICY institution_profiles_select_own ON public.institution_profiles
  FOR SELECT USING (auth.uid() = id);

-- =============================================================================
-- SECTION 3: CORE IDENTITY
-- =============================================================================

-- profiles.id references auth.users — this is a Supabase built-in table
CREATE TABLE IF NOT EXISTS public.profiles (
  id             UUID        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role           TEXT        NOT NULL DEFAULT 'student',
  email          TEXT        UNIQUE,
  full_name      TEXT,
  student_id     TEXT,
  campus         TEXT,
  level          TEXT,
  contact_number TEXT,
  address        TEXT,
  date_of_birth  DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT profiles_role_check CHECK (
    role IN ('student', 'applicant', 'admin', 'alumni', 'professor', 'super_admin')
  )
);

CREATE TABLE IF NOT EXISTS public.admin_users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  name          TEXT        NOT NULL,
  role          TEXT        DEFAULT 'admin',
  is_active     BOOLEAN     DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login    TIMESTAMPTZ,
  created_by    UUID        REFERENCES public.admin_users (id),
  CONSTRAINT admin_users_role_check CHECK (role IN ('admin', 'super_admin'))
);

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL,
  ip_address    TEXT,
  success       BOOLEAN     NOT NULL,
  attempted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL,
  user_role     TEXT        NOT NULL,
  session_token TEXT        NOT NULL UNIQUE,
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT user_sessions_role_check CHECK (
    user_role IN ('applicant', 'student', 'professor', 'alumni', 'admin', 'super_admin')
  )
);

-- =============================================================================
-- SECTION 4: APPLICANT / ADMISSIONS FLOW
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.applicant_profiles (
  id                       UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  email                    TEXT                    NOT NULL UNIQUE,
  first_name               TEXT                    NOT NULL DEFAULT '',
  last_name                TEXT                    NOT NULL DEFAULT '',
  middle_name              TEXT                    DEFAULT '',
  full_name                TEXT                    NOT NULL DEFAULT '',
  birthdate                DATE,
  mobile_number            TEXT,
  address                  TEXT,
  school_level             public.school_level     NOT NULL,
  applicant_type           public.applicant_type   NOT NULL,
  program                  TEXT                    DEFAULT '',
  status                   public.admission_status NOT NULL DEFAULT 'Under Review',
  reference_number         TEXT                    UNIQUE,
  applicant_number         TEXT                    UNIQUE,
  application_submitted_at TIMESTAMPTZ,
  reviewed_at              TIMESTAMPTZ,
  reviewed_by              UUID,
  rejection_reason         TEXT,
  is_enrolled              BOOLEAN                 DEFAULT false,
  enrolled_at              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.academic_background (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id    UUID        NOT NULL REFERENCES public.applicant_profiles (id),
  grade_level     TEXT        NOT NULL,
  school_name     TEXT        NOT NULL,
  completion_year TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.alumni_relatives (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id   UUID        NOT NULL REFERENCES public.applicant_profiles (id),
  name           TEXT        NOT NULL,
  relationship   TEXT        NOT NULL,
  college        TEXT        NOT NULL,
  batch_year     TEXT        NOT NULL,
  contact_number TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.parent_information (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id        UUID        NOT NULL UNIQUE REFERENCES public.applicant_profiles (id),
  father_name         TEXT        NOT NULL,
  father_address      TEXT        NOT NULL,
  father_contact      TEXT        NOT NULL,
  mother_name         TEXT        NOT NULL,
  mother_address      TEXT        NOT NULL,
  mother_contact      TEXT        NOT NULL,
  guardian_name       TEXT,
  guardian_address    TEXT,
  guardian_phone_home TEXT,
  guardian_phone_work TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.program_selections (
  id                 UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id       UUID                  NOT NULL UNIQUE REFERENCES public.applicant_profiles (id),
  school_level       public.school_level   NOT NULL,
  applicant_type     public.applicant_type NOT NULL,
  college_department TEXT,
  college_program    TEXT,
  senior_high_track  TEXT,
  tvl_strand         TEXT,
  created_at         TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.applicant_documents (
  id               UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id     UUID                   NOT NULL REFERENCES public.applicant_profiles (id),
  document_name    TEXT                   NOT NULL,
  file_name        TEXT                   NOT NULL,
  file_url         TEXT                   NOT NULL,
  status           public.document_status NOT NULL DEFAULT 'submitted',
  school_level     public.school_level    NOT NULL,
  applicant_type   public.applicant_type  NOT NULL,
  submitted_at     TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  reviewed_at      TIMESTAMPTZ,
  reviewed_by      UUID,
  rejection_reason TEXT
);

CREATE TABLE IF NOT EXISTS public.admissions_results (
  id              UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id    UUID                    NOT NULL UNIQUE REFERENCES public.applicant_profiles (id),
  status          public.admission_status NOT NULL DEFAULT 'Under Review',
  noa_url         TEXT,
  exam_permit_url TEXT,
  exam_date       DATE,
  exam_time       TIME,
  exam_venue      TEXT,
  permit_number   TEXT,
  date_issued     DATE,
  created_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admissions_activity_logs (
  id             UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type     TEXT                  NOT NULL,
  applicant_type public.applicant_type NOT NULL,
  school_level   public.school_level   NOT NULL,
  metadata       JSONB                 DEFAULT '{}',
  timestamp      TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Exam flow
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.testing_centers (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  address    TEXT        NOT NULL,
  capacity   INTEGER     NOT NULL DEFAULT 50,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.exam_schedules (
  id                UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  testing_center_id UUID               NOT NULL REFERENCES public.testing_centers (id),
  exam_date         DATE               NOT NULL,
  exam_time         TIME               NOT NULL,
  school_level      public.school_level NOT NULL,
  available_slots   INTEGER            NOT NULL DEFAULT 50,
  total_slots       INTEGER            NOT NULL DEFAULT 50,
  is_active         BOOLEAN            NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.exam_registrations (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id      UUID        NOT NULL REFERENCES public.applicant_profiles (id),
  exam_schedule_id  UUID        NOT NULL REFERENCES public.exam_schedules (id),
  registration_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_confirmed      BOOLEAN     NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.exam_logs (
  id             UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id   UUID                  NOT NULL REFERENCES public.applicant_profiles (id),
  school_level   public.school_level   NOT NULL,
  applicant_type public.applicant_type NOT NULL,
  result         public.exam_result    NOT NULL,
  score          NUMERIC,
  metadata       JSONB                 DEFAULT '{}',
  created_at     TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.exam_scores (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID        NOT NULL REFERENCES public.applicant_profiles (id),
  subject      TEXT        NOT NULL,
  score        NUMERIC     NOT NULL,
  max_score    NUMERIC     NOT NULL DEFAULT 100,
  status       TEXT        NOT NULL DEFAULT 'Qualified',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reschedule_requests (
  id                    UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id          UUID                     NOT NULL REFERENCES public.applicant_profiles (id),
  original_schedule_id  UUID                     NOT NULL REFERENCES public.exam_schedules (id),
  requested_schedule_id UUID                     NOT NULL REFERENCES public.exam_schedules (id),
  reason                TEXT                     NOT NULL,
  status                public.reschedule_status NOT NULL DEFAULT 'pending',
  reviewed_by           UUID,
  reviewed_at           TIMESTAMPTZ,
  rejection_reason      TEXT,
  created_at            TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ              NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Payments & Fees
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fee_configuration (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_type    TEXT        NOT NULL UNIQUE,
  amount      NUMERIC     NOT NULL,
  description TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id                    UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id          UUID                  NOT NULL REFERENCES public.applicant_profiles (id),
  fee_type              TEXT                  NOT NULL,
  amount                NUMERIC               NOT NULL,
  payment_method        public.payment_method NOT NULL,
  payment_status        public.payment_status NOT NULL DEFAULT 'pending',
  transaction_reference TEXT,
  payment_date          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.guidelines (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT        NOT NULL,
  content       TEXT        NOT NULL,
  category      TEXT        NOT NULL,
  display_order INTEGER     NOT NULL DEFAULT 0,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- SECTION 5: STUDENT
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.student_accounts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id      UUID        NOT NULL UNIQUE REFERENCES public.applicant_profiles (id),
  student_number    TEXT        NOT NULL UNIQUE,
  email             TEXT        NOT NULL UNIQUE,
  password_hash     TEXT        NOT NULL,
  enrollment_status TEXT        DEFAULT 'active',
  is_active         BOOLEAN     DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enrolled_at       TIMESTAMPTZ,
  last_login        TIMESTAMPTZ,
  CONSTRAINT student_enrollment_status_check CHECK (
    enrollment_status IN ('active', 'inactive', 'graduated')
  )
);

-- =============================================================================
-- SECTION 6: PROFESSOR
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.professor_users (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  full_name     TEXT        NOT NULL,
  department    TEXT,
  employee_id   TEXT        UNIQUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- SECTION 7: ACADEMIC
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.subjects (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT        NOT NULL UNIQUE,
  name        TEXT        NOT NULL,
  description TEXT,
  units       INTEGER     DEFAULT 3,
  semester    TEXT,
  school_year TEXT        NOT NULL,
  is_active   BOOLEAN     DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT subjects_semester_check CHECK (
    semester IN ('1st Semester', '2nd Semester', 'Summer')
  )
);

CREATE TABLE IF NOT EXISTS public.curriculum (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  program     TEXT        NOT NULL,
  year_level  INTEGER     NOT NULL,
  term        TEXT        NOT NULL,
  subject_id  UUID        NOT NULL REFERENCES public.subjects (id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.class_assignments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id UUID        NOT NULL REFERENCES public.professor_users (id),
  subject_id   UUID        NOT NULL REFERENCES public.subjects (id),
  section      TEXT,
  schedule     TEXT,
  room         TEXT,
  max_students INTEGER     DEFAULT 40,
  is_active    BOOLEAN     DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.class_enrollments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_assignment_id UUID        NOT NULL REFERENCES public.class_assignments (id),
  student_id          UUID        NOT NULL REFERENCES public.student_accounts (id),
  enrollment_status   TEXT        DEFAULT 'enrolled',
  enrolled_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dropped_at          TIMESTAMPTZ,
  CONSTRAINT class_enrollment_status_check CHECK (
    enrollment_status IN ('enrolled', 'dropped', 'completed')
  )
);

CREATE TABLE IF NOT EXISTS public.grades (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID        NOT NULL UNIQUE REFERENCES public.class_enrollments (id),
  professor_id  UUID        NOT NULL REFERENCES public.professor_users (id),
  prelim_grade  NUMERIC,
  midterm_grade NUMERIC,
  finals_grade  NUMERIC,
  final_grade   NUMERIC,
  letter_grade  TEXT,
  remarks       TEXT,
  is_locked     BOOLEAN     DEFAULT false,
  encoded_at    TIMESTAMPTZ,
  encoded_by    UUID        REFERENCES public.professor_users (id),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT grades_letter_grade_check CHECK (
    letter_grade IN ('A', 'B+', 'B', 'C+', 'C', 'D', 'F', 'INC', 'W')
  )
);

CREATE TABLE IF NOT EXISTS public.grade_history (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id         UUID        NOT NULL REFERENCES public.grades (id),
  professor_id     UUID        NOT NULL REFERENCES public.professor_users (id),
  old_prelim       NUMERIC,
  old_midterm      NUMERIC,
  old_finals       NUMERIC,
  old_final_grade  NUMERIC,
  old_letter_grade TEXT,
  new_prelim       NUMERIC,
  new_midterm      NUMERIC,
  new_finals       NUMERIC,
  new_final_grade  NUMERIC,
  new_letter_grade TEXT,
  change_reason    TEXT,
  changed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.announcements (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_assignment_id UUID        NOT NULL REFERENCES public.class_assignments (id),
  professor_id        UUID        NOT NULL REFERENCES public.professor_users (id),
  title               TEXT        NOT NULL,
  content             TEXT        NOT NULL,
  announcement_type   TEXT        DEFAULT 'general',
  is_pinned           BOOLEAN     DEFAULT false,
  is_published        BOOLEAN     DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT announcements_type_check CHECK (
    announcement_type IN ('general', 'exam', 'assignment', 'reminder', 'urgent')
  )
);

CREATE TABLE IF NOT EXISTS public.submissions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_assignment_id UUID        NOT NULL REFERENCES public.class_assignments (id),
  student_id          UUID        NOT NULL REFERENCES public.student_accounts (id),
  title               TEXT        NOT NULL,
  description         TEXT,
  file_url            TEXT,
  file_name           TEXT,
  submission_type     TEXT        DEFAULT 'assignment',
  status              TEXT        DEFAULT 'submitted',
  score               NUMERIC,
  max_score           NUMERIC,
  feedback            TEXT,
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  graded_at           TIMESTAMPTZ,
  graded_by           UUID        REFERENCES public.professor_users (id),
  due_date            TIMESTAMPTZ,
  is_late             BOOLEAN     DEFAULT false,
  CONSTRAINT submissions_type_check CHECK (
    submission_type IN ('assignment', 'project', 'quiz', 'exam', 'other')
  ),
  CONSTRAINT submissions_status_check CHECK (
    status IN ('submitted', 'graded', 'returned', 'late')
  )
);

-- ---------------------------------------------------------------------------
-- Subject offerings + enrollment model used by Mobile (enroll_student RPC)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.subject_offerings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  UUID        NOT NULL REFERENCES public.subjects (id) ON DELETE CASCADE,
  term        TEXT        NOT NULL,
  school_year TEXT        NOT NULL,
  section     TEXT        NOT NULL,
  schedule    TEXT,
  room        TEXT,
  instructor  TEXT,
  slots_total INTEGER     DEFAULT 40,
  slots_taken INTEGER     DEFAULT 0,
  campus      TEXT,
  is_open     BOOLEAN     DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.enrollments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID        NOT NULL REFERENCES public.student_accounts (id) ON DELETE CASCADE,
  school_year TEXT        NOT NULL,
  term        TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'draft',
  total_units INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT enrollments_status_check CHECK (
    status IN ('draft', 'submitted', 'approved', 'paid', 'cancelled')
  )
);

CREATE TABLE IF NOT EXISTS public.enrollment_items (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID        NOT NULL REFERENCES public.enrollments (id) ON DELETE CASCADE,
  offering_id   UUID        NOT NULL REFERENCES public.subject_offerings (id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (enrollment_id, offering_id)
);

-- ---------------------------------------------------------------------------
-- Enrollment activity log (log-first pattern, no FKs by design)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.enrollment_activity_logs (
  log_id         UUID,
  created_at     TIMESTAMP,
  actor_uuid     UUID,
  action_type    TEXT,
  status_code    INTEGER,
  subject_code   TEXT,
  semester_id    TEXT,
  payment_ref_no TEXT,
  total_units    NUMERIC
);

-- =============================================================================
-- SECTION 8: PUBLIC ALUMNI (identity table)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.alumni (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT        NOT NULL UNIQUE,
  password_hash   TEXT        NOT NULL,
  name            TEXT        NOT NULL,
  student_number  TEXT        UNIQUE,
  graduation_year INTEGER,
  program         TEXT,
  is_active       BOOLEAN     DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login      TIMESTAMPTZ
);

-- =============================================================================
-- SECTION 9: ALUMNI SCHEMA (microservice tables)
-- No FKs, no NOT NULL, no UNIQUE — 5-column log template per architecture rule.
-- The alumni service uses .schema('alumni') to target these tables.
-- =============================================================================

CREATE TABLE IF NOT EXISTS alumni.accounts (
  id              UUID,
  email           TEXT,
  password_hash   TEXT,
  name            TEXT,
  student_number  TEXT,
  graduation_year INTEGER,
  program         TEXT,
  academic_unit   TEXT,
  phone_number    TEXT,
  is_active       BOOLEAN,
  created_at      TIMESTAMP,
  last_login      TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alumni.reg_activity_logs (
  log_id                 UUID,
  created_at             TIMESTAMP,
  actor_uuid             UUID,
  action_type            TEXT,
  status_code            INTEGER,
  tenant_id              TEXT,
  full_name              TEXT,
  email                  TEXT,
  graduation_year        INTEGER,
  program                TEXT,
  academic_unit          TEXT,
  is_legacy_registration BOOLEAN,
  student_id             TEXT,
  proof_reference        TEXT,
  document_url           TEXT
);

CREATE TABLE IF NOT EXISTS alumni.record_requests (
  log_id           UUID,
  created_at       TIMESTAMP,
  actor_uuid       UUID,
  action_type      TEXT,
  status_code      INTEGER,
  tenant_id        TEXT,
  document_type    TEXT,
  fee_amount       NUMERIC,
  payment_status   TEXT,
  notes            TEXT,
  delivery_method  TEXT,
  number_of_copies INTEGER
);

CREATE TABLE IF NOT EXISTS alumni.card_applications (
  log_id           UUID,
  created_at       TIMESTAMP,
  actor_uuid       UUID,
  action_type      TEXT,
  status_code      INTEGER,
  tenant_id        TEXT,
  application_type TEXT,
  delivery_method  TEXT,
  id_photo_url     TEXT,
  payment_status   TEXT
);

-- =============================================================================
-- SECTION 10: NOTIFICATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        REFERENCES public.profiles (id),
  title      TEXT        NOT NULL,
  message    TEXT,
  read       BOOLEAN     DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- SECTION 11: FUNCTIONS & TRIGGERS
-- =============================================================================

-- Auto-create a profile row when a new Supabase auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS
$$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'student')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Generate a formatted applicant number (called via RPC by application service)
CREATE OR REPLACE FUNCTION public.generate_applicant_number()
RETURNS TEXT LANGUAGE plpgsql AS
$$
DECLARE
  v_number TEXT;
BEGIN
  SELECT 'APP-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(COUNT(*) :: TEXT, 5, '0')
  INTO v_number
  FROM public.applicant_profiles;
  RETURN v_number;
END;
$$;

-- =============================================================================
-- SECTION 12: ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_accounts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Students
DROP POLICY IF EXISTS student_accounts_select_own ON public.student_accounts;
CREATE POLICY student_accounts_select_own ON public.student_accounts
  FOR SELECT USING (auth.uid() = id);

-- Applicants (public read — needed for reference number tracking)
DROP POLICY IF EXISTS applicant_profiles_select_own ON public.applicant_profiles;
CREATE POLICY applicant_profiles_select_own ON public.applicant_profiles
  FOR SELECT USING (true);

-- Subjects (public read)
DROP POLICY IF EXISTS subjects_public_read ON public.subjects;
CREATE POLICY subjects_public_read ON public.subjects
  FOR SELECT USING (true);

-- Class assignments (public read)
DROP POLICY IF EXISTS class_assignments_public_read ON public.class_assignments;
CREATE POLICY class_assignments_public_read ON public.class_assignments
  FOR SELECT USING (true);

-- Class enrollments (own only)
DROP POLICY IF EXISTS class_enrollments_select_own ON public.class_enrollments;
CREATE POLICY class_enrollments_select_own ON public.class_enrollments
  FOR SELECT USING (student_id = auth.uid());

-- Grades (own only via enrollment)
DROP POLICY IF EXISTS grades_select_own ON public.grades;
CREATE POLICY grades_select_own ON public.grades
  FOR SELECT USING (
    enrollment_id IN (
      SELECT id FROM public.class_enrollments WHERE student_id = auth.uid()
    )
  );

-- Notifications (own only)
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

-- =============================================================================
-- SECTION 13: INSTITUTION RESOURCES
-- Generic JSONB store for institution dashboard data
-- (classes, subjects, students, employees, accounts, fees, salary, attendance)
-- All writes go through the institution-data-service (service role key)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.institution_resources (
  id             TEXT        PRIMARY KEY,
  institution_id UUID        NOT NULL,
  resource_type  TEXT        NOT NULL,
  data           JSONB       NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT institution_resources_type_check CHECK (
    resource_type IN ('classes','subjects','students','employees','accounts','fees','salary','attendance')
  )
);

CREATE INDEX IF NOT EXISTS institution_resources_institution_idx
  ON public.institution_resources (institution_id, resource_type);

CREATE OR REPLACE FUNCTION public.institution_resources_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS
$$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS institution_resources_set_updated_at ON public.institution_resources;
CREATE TRIGGER institution_resources_set_updated_at
  BEFORE UPDATE ON public.institution_resources
  FOR EACH ROW EXECUTE PROCEDURE public.institution_resources_set_updated_at();
