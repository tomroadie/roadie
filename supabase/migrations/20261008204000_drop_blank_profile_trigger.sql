-- Run by hand in the Supabase SQL editor (the MCP connection can't run
-- destructive statements). New logins no longer get a blank, ownerless
-- profile row; artists and profiles are created by onboarding.
drop trigger if exists on_auth_user_created on auth.users;

-- Remove the existing blank rows (no name, no owner, nothing attached).
delete from public.profiles p
where p.artist_name is null
  and p.owner_user_id is null
  and not exists (select 1 from public.artists a where a.id = p.id)
  and not exists (select 1 from public.audits x where x.artist_id = p.id)
  and not exists (select 1 from public.email_log x where x.artist_id = p.id)
  and not exists (select 1 from public.events x where x.artist_id = p.id)
  and not exists (select 1 from public.weekly_plans x where x.artist_id = p.id);
