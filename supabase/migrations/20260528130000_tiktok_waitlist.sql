-- TikTok launch waitlist interest flag per artist profile.
alter table public.profiles
  add column if not exists tiktok_waitlist boolean default false;
