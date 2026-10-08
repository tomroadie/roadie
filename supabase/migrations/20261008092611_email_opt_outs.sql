-- Per-email-type switches. Each entry is an email type the artist has turned
-- off (e.g. 'your_week'). all_emails_paused stays the master switch and
-- marketing_unsubscribed the marketing switch.
alter table public.profiles
  add column if not exists email_opt_outs text[] not null default '{}';
