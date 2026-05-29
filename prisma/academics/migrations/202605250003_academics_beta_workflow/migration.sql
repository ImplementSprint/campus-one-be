CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS academic_student_accounts (
  id text PRIMARY KEY,
  institution_id uuid NOT NULL,
  email text,
  student_number text,
  applicant_id text,
  full_name text,
  program text,
  year_level integer,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS academic_student_accounts_institution_idx
  ON academic_student_accounts (institution_id);

CREATE TABLE IF NOT EXISTS academic_professor_users (
  id text PRIMARY KEY,
  institution_id uuid NOT NULL,
  email text,
  full_name text,
  department text,
  employee_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS academic_professor_users_institution_idx
  ON academic_professor_users (institution_id);

CREATE TABLE IF NOT EXISTS academic_subjects (
  id text PRIMARY KEY,
  institution_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  units integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academic_subjects_institution_code_key UNIQUE (institution_id, code)
);

CREATE TABLE IF NOT EXISTS academic_curriculum (
  id text PRIMARY KEY,
  institution_id uuid NOT NULL,
  program text NOT NULL,
  year_level integer NOT NULL,
  term text NOT NULL,
  subject_id text NOT NULL REFERENCES academic_subjects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS academic_curriculum_program_idx
  ON academic_curriculum (institution_id, program, year_level);

CREATE TABLE IF NOT EXISTS academic_class_assignments (
  id text PRIMARY KEY,
  institution_id uuid NOT NULL,
  subject_id text NOT NULL REFERENCES academic_subjects(id) ON DELETE CASCADE,
  professor_id text NOT NULL REFERENCES academic_professor_users(id) ON DELETE CASCADE,
  section text NOT NULL,
  schedule text,
  room text,
  max_students integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS academic_class_assignments_professor_idx
  ON academic_class_assignments (institution_id, professor_id);

CREATE INDEX IF NOT EXISTS academic_class_assignments_subject_idx
  ON academic_class_assignments (institution_id, subject_id);

CREATE TABLE IF NOT EXISTS academic_class_enrollments (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  institution_id uuid NOT NULL,
  student_id text NOT NULL REFERENCES academic_student_accounts(id) ON DELETE CASCADE,
  class_assignment_id text NOT NULL REFERENCES academic_class_assignments(id) ON DELETE CASCADE,
  enrollment_status text NOT NULL DEFAULT 'enrolled',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  CONSTRAINT academic_class_enrollments_unique_student_class UNIQUE (institution_id, student_id, class_assignment_id)
);

CREATE INDEX IF NOT EXISTS academic_class_enrollments_class_idx
  ON academic_class_enrollments (institution_id, class_assignment_id);

CREATE TABLE IF NOT EXISTS academic_grades (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  institution_id uuid NOT NULL,
  enrollment_id text NOT NULL REFERENCES academic_class_enrollments(id) ON DELETE CASCADE,
  professor_id text NOT NULL,
  prelim_grade numeric,
  midterm_grade numeric,
  finals_grade numeric,
  final_grade numeric,
  letter_grade text,
  remarks text,
  is_locked boolean NOT NULL DEFAULT false,
  encoded_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academic_grades_unique_enrollment UNIQUE (institution_id, enrollment_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS academic_grades_enrollment_id_key
  ON academic_grades (enrollment_id);

CREATE INDEX IF NOT EXISTS academic_grades_professor_idx
  ON academic_grades (institution_id, professor_id);

CREATE TABLE IF NOT EXISTS academic_enrollment_audit_events (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  institution_id uuid NOT NULL,
  student_id text NOT NULL,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS academic_enrollment_audit_student_idx
  ON academic_enrollment_audit_events (institution_id, student_id);
