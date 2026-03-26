-- ============================================================
-- Qwezy — Supabase Schema
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- Organizations (one per company that signs up)
create table organizations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  plan text default 'trial',
  onboarding_complete boolean default false,
  created_at timestamptz default now()
);

-- User profiles (extends Supabase auth.users)
create table profiles (
  id uuid references auth.users primary key,
  org_id uuid references organizations,
  full_name text,
  role text default 'analyst',
  created_at timestamptz default now()
);

-- Database connections (customer's databases)
create table connections (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references organizations not null,
  name text not null,
  db_type text not null,
  host text not null,
  port integer not null,
  database text not null,
  username text not null,
  password_encrypted text not null,
  ssl boolean default false,
  status text default 'pending',
  created_at timestamptz default now()
);

-- Tables pulled from customer databases
create table db_tables (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references organizations not null,
  connection_id uuid references connections not null,
  name text not null,
  description text default '',
  team text default '',
  key_metrics text default '',
  refresh_cadence text default '',
  row_count bigint default 0,
  columns jsonb default '[]',
  annotation_complete boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id, connection_id, name)
);

-- Registered join paths (the semantic layer — your core IP)
create table join_paths (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references organizations not null,
  from_table text not null,
  to_table text not null,
  condition text not null,
  description text,
  auto_detected boolean default false,
  created_at timestamptz default now(),
  unique(org_id, from_table, to_table)
);

-- Every query that gets run (learning loop)
create table query_history (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references organizations not null,
  user_id uuid references auth.users,
  natural_language text not null,
  sql text not null,
  corrected_sql text,
  result_count integer,
  duration_ms integer,
  feedback text,
  created_at timestamptz default now()
);

-- Queries analysts save for reuse
create table saved_queries (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references organizations not null,
  user_id uuid references auth.users,
  name text not null,
  natural_language text not null,
  sql text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- Users can only see data from their own organization
-- ============================================================

alter table organizations enable row level security;
alter table connections enable row level security;
alter table db_tables enable row level security;
alter table join_paths enable row level security;
alter table query_history enable row level security;
alter table saved_queries enable row level security;

create policy "Users see own org"
  on organizations for all
  using (id in (select org_id from profiles where id = auth.uid()));

create policy "Users see own org connections"
  on connections for all
  using (org_id in (select org_id from profiles where id = auth.uid()));

create policy "Users see own org tables"
  on db_tables for all
  using (org_id in (select org_id from profiles where id = auth.uid()));

create policy "Users see own org joins"
  on join_paths for all
  using (org_id in (select org_id from profiles where id = auth.uid()));

create policy "Users see own query history"
  on query_history for all
  using (org_id in (select org_id from profiles where id = auth.uid()));

create policy "Users see own saved queries"
  on saved_queries for all
  using (org_id in (select org_id from profiles where id = auth.uid()));

-- ============================================================
-- Done! Your Qwezy database is ready.
-- ============================================================
