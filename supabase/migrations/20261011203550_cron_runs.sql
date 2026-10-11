-- One row per scheduled-job run, so a daily health check can spot jobs that
-- stopped running or keep failing.
create table if not exists public.cron_runs (
  id bigint generated always as identity primary key,
  job text not null,
  ok boolean not null,
  summary jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cron_runs_job_created_idx on public.cron_runs (job, created_at desc);

alter table public.cron_runs enable row level security;
revoke all on public.cron_runs from public, anon, authenticated;
