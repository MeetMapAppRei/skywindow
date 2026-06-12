-- Repair equipment RLS when the table exists but INSERT was denied (RLS on, policies missing or stale).

alter table public.equipment enable row level security;

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
