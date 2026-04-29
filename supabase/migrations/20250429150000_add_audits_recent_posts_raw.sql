-- Plain-text recent posts when webhook sends a string; jsonb array when it sends JSON.

alter table public.audits
  add column if not exists recent_posts_raw text;

alter table public.audits
  alter column recent_posts drop not null;
