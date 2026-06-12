-- Repair sky_profiles RLS when INSERT is denied (policies missing or stale), and
-- force user_id from the session JWT on insert so WITH CHECK (auth.uid() = user_id) always matches.

create or replace function public.sky_profiles_set_user_id()
returns trigger
language plpgsql
as $$
begin
  new.user_id := coalesce(auth.uid(), new.user_id);
  return new;
end;
$$;

drop trigger if exists sky_profiles_set_user_id on public.sky_profiles;
create trigger sky_profiles_set_user_id
  before insert on public.sky_profiles
  for each row
  execute function public.sky_profiles_set_user_id();

alter table public.sky_profiles enable row level security;

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

grant select, insert, update, delete on public.sky_profiles to authenticated;
