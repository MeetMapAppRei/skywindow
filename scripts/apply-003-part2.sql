-- Part 2: RLS policies + schema reload

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

notify pgrst, 'reload schema';
