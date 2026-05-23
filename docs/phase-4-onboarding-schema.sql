-- Phase 4A school onboarding tables for Cloud SQL/PostgreSQL.
-- Apply after the baseline tenant registry tables exist.

alter table institution_profiles
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by text,
  add column if not exists rejection_reason text;

create table if not exists onboarding_progress (
  institution_id uuid primary key,
  current_step text not null,
  completed_steps jsonb not null default '[]'::jsonb,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists school_owner_invitations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  email text not null,
  token_hash text not null,
  status text not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create unique index if not exists school_owner_invitations_institution_pending_idx
  on school_owner_invitations (institution_id)
  where status = 'pending';

alter table portal_accounts
  add column if not exists password_hash text;

create table if not exists school_owner_accounts (
  id uuid primary key,
  institution_id uuid not null,
  email text not null unique,
  role text not null default 'school_owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_owner_accounts_role_check check (role = 'school_owner')
);

create index if not exists school_owner_accounts_institution_idx
  on school_owner_accounts (institution_id);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid,
  action text not null,
  actor_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_institution_created_idx
  on audit_events (institution_id, created_at desc);
