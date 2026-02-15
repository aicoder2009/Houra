-- Houra v2 baseline schema
create extension if not exists pgcrypto;

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  name text not null,
  email text not null,
  school_name text,
  grad_year int,
  timezone text not null default 'America/Los_Angeles',
  preferred_model text,
  is_approved boolean not null default false,
  role text not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  evidence_required boolean not null default true,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists organization_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  role text not null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  title text not null,
  target_hours numeric(8,2) not null,
  due_date timestamptz not null,
  status text not null,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  date timestamptz not null,
  status text not null,
  notes text,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists service_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete restrict,
  activity_name text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_minutes int not null,
  status text not null,
  reject_reason text,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists evidence_assets (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references service_entries(id) on delete cascade,
  storage_key text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  sync_state text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists verification_decisions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references service_entries(id) on delete cascade,
  decision text not null,
  reason text not null,
  decided_by_student_id uuid not null references students(id) on delete cascade,
  decided_at timestamptz not null,
  ai_suggested boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists report_presets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  name text not null,
  filters_json jsonb not null,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists export_jobs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  format text not null,
  range_start timestamptz not null,
  range_end timestamptz not null,
  file_url text,
  created_at timestamptz not null default now()
);

create table if not exists share_links (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  token_hash text not null,
  scope_json jsonb not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists reminder_preferences (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  cadence text not null default 'weekly',
  escalation_enabled boolean not null default true,
  channels_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sync_queue_items (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  operation text not null,
  payload_json jsonb not null,
  status text not null,
  retry_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  local_json jsonb not null,
  remote_json jsonb not null,
  resolution_json jsonb,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists import_jobs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  source_type text not null,
  status text not null,
  confidence_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  model text not null,
  objective text not null,
  context_scope text not null,
  status text not null,
  autonomous boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_actions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references agent_runs(id) on delete cascade,
  action_type text not null,
  action_kind text not null,
  safety_class text not null,
  target_entity text not null,
  target_id uuid not null,
  title text not null,
  detail text not null,
  diff_json jsonb not null,
  approved boolean not null default false,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists state_snapshots (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  batch_id uuid not null,
  snapshot_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  timestamp timestamptz not null default now(),
  actor_type text not null,
  actor_id text,
  source text not null,
  entity_type text not null,
  entity_id text not null,
  action_type text not null,
  before_json jsonb,
  after_json jsonb,
  diff_json jsonb,
  correlation_id text not null,
  snapshot_id uuid references state_snapshots(id)
);

create index if not exists idx_organizations_student_id on organizations(student_id);
create index if not exists idx_goals_student_id on goals(student_id);
create index if not exists idx_entries_student_id on service_entries(student_id);
create index if not exists idx_entries_org_id on service_entries(organization_id);
create index if not exists idx_share_links_student_id on share_links(student_id);
create index if not exists idx_sync_queue_student_status on sync_queue_items(student_id, status);
create index if not exists idx_sync_conflicts_student_status on sync_conflicts(student_id, status);
create index if not exists idx_agent_runs_student_created on agent_runs(student_id, created_at desc);
create index if not exists idx_agent_actions_run_id on agent_actions(run_id);
create index if not exists idx_audit_events_timestamp on audit_events(timestamp desc);
create index if not exists idx_audit_events_entity on audit_events(entity_type, entity_id);
