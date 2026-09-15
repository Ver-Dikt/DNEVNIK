create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  default_currency text not null default 'RUB',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
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
alter table public.app_state enable row level security;
alter table public.projects enable row level security;
alter table public.entries enable row level security;

drop policy if exists "Profiles are owned by user" on public.profiles;
create policy "Profiles are owned by user" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "App state is owned by user" on public.app_state;
create policy "App state is owned by user" on public.app_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Projects are owned by user" on public.projects;
create policy "Projects are owned by user" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Entries are owned by user" on public.entries;
create policy "Entries are owned by user" on public.entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  insert into public.app_state (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create index if not exists entries_user_due_date_idx on public.entries(user_id, due_date);
create index if not exists entries_user_kind_idx on public.entries(user_id, kind);
create index if not exists entries_user_status_idx on public.entries(user_id, status);
