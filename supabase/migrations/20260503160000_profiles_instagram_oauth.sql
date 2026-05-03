-- OAuth-connected Instagram Business account (live stats API).
alter table public.profiles
  add column if not exists instagram_user_id text,
  add column if not exists instagram_access_token text;
