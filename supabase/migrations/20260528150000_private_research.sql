-- Private admin/research profiles (excluded from crons and customer flows).
alter table public.profiles
  add column if not exists is_private boolean default false;

-- Research pipeline flags (never shown on customer dashboard).
alter table public.pending_leads
  add column if not exists is_research boolean default false;

alter table public.audits
  add column if not exists is_research boolean default false;

alter table public.weekly_plans
  add column if not exists is_research boolean default false;
