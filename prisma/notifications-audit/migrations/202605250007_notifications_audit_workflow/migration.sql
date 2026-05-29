create table if not exists in_app_notifications (
  id text primary key default gen_random_uuid()::text,
  profile_id text not null,
  title text not null,
  body text,
  is_read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists in_app_notifications_profile_created_idx
  on in_app_notifications (profile_id, created_at desc);

create index if not exists in_app_notifications_profile_read_idx
  on in_app_notifications (profile_id, is_read);

create table if not exists notification_audit_events (
  id text primary key default gen_random_uuid()::text,
  action text not null,
  actor text not null,
  tenant_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notification_audit_events_tenant_action_idx
  on notification_audit_events (tenant_id, action);

create index if not exists notification_audit_events_actor_created_idx
  on notification_audit_events (actor, created_at desc);
