CREATE TABLE IF NOT EXISTS admission_applicants (
  id text PRIMARY KEY,
  institution_id uuid NOT NULL,
  email text NOT NULL,
  school_level text,
  applicant_type text,
  first_name text,
  last_name text,
  middle_name text,
  full_name text,
  birthdate date,
  mobile_number text,
  address text,
  status text NOT NULL DEFAULT 'Draft',
  reference_number text NOT NULL,
  applicant_number text,
  program text,
  rejection_reason text,
  acceptance_letter_url text,
  application_submitted_at timestamptz,
  reviewed_at timestamptz,
  is_enrolled boolean NOT NULL DEFAULT false,
  enrolled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admission_applicants_institution_reference_key UNIQUE (institution_id, reference_number)
);

CREATE INDEX IF NOT EXISTS admission_applicants_institution_email_idx
  ON admission_applicants (institution_id, email);

CREATE INDEX IF NOT EXISTS admission_applicants_institution_status_idx
  ON admission_applicants (institution_id, status);

CREATE TABLE IF NOT EXISTS admission_program_selections (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  institution_id uuid NOT NULL,
  applicant_id text NOT NULL REFERENCES admission_applicants(id) ON DELETE CASCADE,
  school_level text,
  college_program text,
  college_department text,
  senior_high_track text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admission_program_selections_institution_applicant_key UNIQUE (institution_id, applicant_id)
);

CREATE INDEX IF NOT EXISTS admission_program_selections_institution_idx
  ON admission_program_selections (institution_id);

CREATE UNIQUE INDEX IF NOT EXISTS admission_program_selections_applicant_id_key
  ON admission_program_selections (applicant_id);

CREATE TABLE IF NOT EXISTS admission_activity_logs (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  institution_id uuid NOT NULL,
  applicant_id text NOT NULL REFERENCES admission_applicants(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_email text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admission_activity_logs_applicant_idx
  ON admission_activity_logs (institution_id, applicant_id);

CREATE INDEX IF NOT EXISTS admission_activity_logs_event_idx
  ON admission_activity_logs (institution_id, event_type);
