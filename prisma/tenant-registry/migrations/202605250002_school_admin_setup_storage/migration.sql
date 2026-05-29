create table if not exists school_admin_profiles (
  institution_id uuid primary key references institution_profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists institution_resources (
  id text primary key,
  institution_id uuid not null references institution_profiles(id) on delete cascade,
  resource_type text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists institution_resources_institution_type_idx
  on institution_resources(institution_id, resource_type);

create table if not exists school_admin_delivery_queue (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution_profiles(id) on delete cascade,
  channel text not null,
  template text not null,
  recipient text not null,
  actor_id text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  created_at timestamptz not null default now()
);

create index if not exists school_admin_delivery_queue_institution_idx
  on school_admin_delivery_queue(institution_id, created_at desc);
