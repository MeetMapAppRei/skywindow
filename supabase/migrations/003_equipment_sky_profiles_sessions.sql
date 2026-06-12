-- SkyWindow tables used after onboarding (Tonight, equipment, sky profiles, sessions).
-- Safe to run if tables already exist (idempotent-ish).

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  aperture_mm integer,
  focal_length_mm integer,
  type text,
  is_seestar boolean not null default false,
  fov_degrees double precision
);

create table if not exists public.sky_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text,
  horizon_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date,
  equipment_id uuid references public.equipment (id) on delete set null,
  sky_profile_id uuid references public.sky_profiles (id) on delete set null,
  location_lat double precision,
  location_lng double precision,
  notes text,
  targets_observed jsonb,
  created_at timestamptz not null default now()
);

create index if not exists equipment_user_id_idx on public.equipment (user_id);
create index if not exists sky_profiles_user_id_idx on public.sky_profiles (user_id);
create index if not exists sessions_user_id_idx on public.sessions (user_id);

alter table public.equipment enable row level security;
alter table public.sky_profiles enable row level security;
alter table public.sessions enable row level security;

drop policy if exists "equipment_select_own" on public.equipment;
drop policy if exists "equipment_insert_own" on public.equipment;
drop policy if exists "equipment_update_own" on public.equipment;
drop policy if exists "equipment_delete_own" on public.equipment;

create policy "equipment_select_own"
  on public.equipment for select to authenticated
  using (auth.uid() = user_id);

create policy "equipment_insert_own"
  on public.equipment for insert to authenticated
  with check (auth.uid() = user_id);

create policy "equipment_update_own"
  on public.equipment for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "equipment_delete_own"
  on public.equipment for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "sky_profiles_select_own" on public.sky_profiles;
drop policy if exists "sky_profiles_insert_own" on public.sky_profiles;
drop policy if exists "sky_profiles_update_own" on public.sky_profiles;
drop policy if exists "sky_profiles_delete_own" on public.sky_profiles;

create policy "sky_profiles_select_own"
  on public.sky_profiles for select to authenticated
  using (auth.uid() = user_id);

create policy "sky_profiles_insert_own"
  on public.sky_profiles for insert to authenticated
  with check (auth.uid() = user_id);

create policy "sky_profiles_update_own"
  on public.sky_profiles for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "sky_profiles_delete_own"
  on public.sky_profiles for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "sessions_select_own" on public.sessions;
drop policy if exists "sessions_insert_own" on public.sessions;
drop policy if exists "sessions_update_own" on public.sessions;
drop policy if exists "sessions_delete_own" on public.sessions;

create policy "sessions_select_own"
  on public.sessions for select to authenticated
  using (auth.uid() = user_id);

create policy "sessions_insert_own"
  on public.sessions for insert to authenticated
  with check (auth.uid() = user_id);

create policy "sessions_update_own"
  on public.sessions for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "sessions_delete_own"
  on public.sessions for delete to authenticated
  using (auth.uid() = user_id);
