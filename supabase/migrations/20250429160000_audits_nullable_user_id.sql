-- Pending audits before signup: user_id may be null; email is stored for matching later.

alter table public.audits
  add column if not exists email text;

alter table public.audits
  alter column user_id drop not null;

create index if not exists audits_pending_email_idx
  on public.audits (email)
  where user_id is null;
