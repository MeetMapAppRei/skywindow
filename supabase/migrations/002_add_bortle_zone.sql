-- Add bortle_zone when profiles existed from another app (e.g. Meetmap) without this column.

alter table public.profiles
  add column if not exists bortle_zone integer;
