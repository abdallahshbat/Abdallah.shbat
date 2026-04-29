-- Run once in Supabase SQL editor
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.admin_users (
  id bigserial primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.brand_users (
  id bigserial primary key,
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique (brand_id, user_id)
);

alter table public.client_reports
  add column if not exists brand_id uuid references public.brands(id),
  add column if not exists report_data jsonb,
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default now();

-- Recommended RLS
alter table public.brands enable row level security;
alter table public.brand_users enable row level security;
alter table public.client_reports enable row level security;

create policy if not exists "admins manage brands" on public.brands
for all using (exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.is_active = true))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.is_active = true));

create policy if not exists "admins manage brand_users" on public.brand_users
for all using (exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.is_active = true))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.is_active = true));

create policy if not exists "admins manage reports" on public.client_reports
for all using (exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.is_active = true))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.is_active = true));

create policy if not exists "clients view own brand reports" on public.client_reports
for select using (
  exists (
    select 1
    from public.brand_users bu
    where bu.brand_id = client_reports.brand_id
      and bu.user_id = auth.uid()
      and bu.is_active = true
  )
  and coalesce(client_reports.is_active, true) = true
);
