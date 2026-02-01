-- Add email to profiles so we can join to pre_applications by email
alter table public.profiles
  add column if not exists email text;

-- Backfill from auth.users (safe to run repeatedly)
update public.profiles p
set email = u.email
from auth.users u
where p.user_id = u.id
  and (p.email is null or btrim(p.email) = '');
