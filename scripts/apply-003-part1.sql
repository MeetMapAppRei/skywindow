-- Part 1: tables + indexes + RLS on (SkyWindow)

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
