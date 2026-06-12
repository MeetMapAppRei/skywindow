-- Add push-style notifications preference for "good observing nights".

alter table public.profiles
  add column if not exists notify_good_nights boolean not null default false;

