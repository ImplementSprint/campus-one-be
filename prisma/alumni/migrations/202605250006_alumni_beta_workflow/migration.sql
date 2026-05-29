create table if not exists alumni_registration_logs (
  log_id text primary key default gen_random_uuid()::text,
  institution_id uuid not null,
  created_at timestamptz not null default now(),
  actor_uuid text not null,
  action_type text not null,
  status_code integer not null,
  tenant_id uuid not null,
  full_name text not null,
  email text not null,
  graduation_year integer not null,
  program text not null,
  academic_unit text not null,
  is_legacy_registration boolean not null default false,
  document_url text,
  student_id text,
  proof_reference text
);

create index if not exists alumni_registration_logs_institution_created_idx
  on alumni_registration_logs (institution_id, created_at desc);

create index if not exists alumni_registration_logs_actor_created_idx
  on alumni_registration_logs (actor_uuid, created_at desc);

create table if not exists alumni_accounts (
  id text primary key default gen_random_uuid()::text,
  institution_id uuid not null,
  email text not null,
  password_hash text not null default '',
  name text not null,
  student_number text,
  graduation_year integer,
  program text,
  academic_unit text,
  phone_number text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login timestamptz,
  constraint alumni_accounts_institution_email_key unique (institution_id, email)
);

create index if not exists alumni_accounts_institution_idx
  on alumni_accounts (institution_id);

create table if not exists alumni_record_requests (
  log_id text primary key default gen_random_uuid()::text,
  institution_id uuid not null,
  created_at timestamptz not null default now(),
  actor_uuid text not null,
  action_type text not null,
  status_code integer not null,
  tenant_id uuid not null,
  document_type text not null,
  fee_amount integer not null,
  payment_status text not null default 'pending',
  notes text,
  delivery_method text,
  number_of_copies integer not null default 1
);

create index if not exists alumni_record_requests_institution_created_idx
  on alumni_record_requests (institution_id, created_at desc);

create index if not exists alumni_record_requests_actor_created_idx
  on alumni_record_requests (actor_uuid, created_at desc);

create index if not exists alumni_record_requests_status_idx
  on alumni_record_requests (institution_id, status_code);

create table if not exists alumni_card_applications (
  log_id text primary key default gen_random_uuid()::text,
  institution_id uuid not null,
  created_at timestamptz not null default now(),
  actor_uuid text not null,
  action_type text not null,
  status_code integer not null,
  tenant_id uuid not null,
  application_type text not null,
  delivery_method text not null,
  id_photo_url text,
  payment_status text not null default 'pending',
  card_serial text
);

create index if not exists alumni_card_applications_institution_created_idx
  on alumni_card_applications (institution_id, created_at desc);

create index if not exists alumni_card_applications_actor_created_idx
  on alumni_card_applications (actor_uuid, created_at desc);

create index if not exists alumni_card_applications_status_idx
  on alumni_card_applications (institution_id, status_code);

create table if not exists alumni_activity_events (
  id text primary key default gen_random_uuid()::text,
  institution_id uuid not null,
  actor_uuid text not null,
  event_type text not null,
  target_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists alumni_activity_events_actor_idx
  on alumni_activity_events (institution_id, actor_uuid);

create index if not exists alumni_activity_events_type_idx
  on alumni_activity_events (institution_id, event_type);
