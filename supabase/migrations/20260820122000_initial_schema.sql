create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  default_currency text not null default 'RUB',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.projects(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('task', 'purchase', 'idea', 'inbox')),
  title text not null,
  description text,
  project_path text[] not null default '{}',
  status text not null default 'active',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  due_date date,
  schedule text not null default 'none',
  quantity numeric,
  unit_price numeric,
  total_price numeric,
  currency text,
  store text,
  url text,
  notes text,
  needs_review boolean not null default false,
  source_text text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.entries enable row level security;

create policy "Profiles are owned by user" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "Projects are owned by user" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Entries are owned by user" on public.entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists entries_user_due_date_idx on public.entries(user_id, due_date);
create index if not exists entries_user_kind_idx on public.entries(user_id, kind);
create index if not exists entries_user_status_idx on public.entries(user_id, status);
