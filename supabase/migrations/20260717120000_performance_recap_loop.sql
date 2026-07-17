-- Performance Recap Loop: extend post_performance with insight metrics,
-- add rolling baselines and weekly scoreboard recaps.
-- Built on the existing artist_id -> artists.owner_user_id ownership model
-- (there is no plan_items table; ideas live in weekly_plans.ideas jsonb,
-- keyed by hook, and post_performance is the existing metrics table).

alter table public.post_performance
  add column if not exists ig_media_type text;
alter table public.post_performance
  add column if not exists reach integer;
alter table public.post_performance
  add column if not exists saves integer;
alter table public.post_performance
  add column if not exists shares integer;
alter table public.post_performance
  add column if not exists follows integer;
alter table public.post_performance
  add column if not exists raw jsonb not null default '{}'::jsonb;

create index if not exists post_performance_artist_post_date_idx
  on public.post_performance (artist_id, post_date desc);

-- Reconnect banner flag for expired/invalid Instagram tokens.
alter table public.profiles
  add column if not exists ig_token_stale boolean not null default false;

-- Rolling per-content-type baselines, recomputed weekly (Sunday build cron).
create table if not exists public.user_baselines (
  artist_id uuid not null references public.artists (id) on delete cascade,
  media_type text not null,
  window_days integer not null default 30,
  avg_reach numeric,
  avg_engagement numeric,
  post_count integer not null default 0,
  computed_at timestamptz not null default now(),
  primary key (artist_id, media_type)
);

alter table public.user_baselines enable row level security;

create policy "Users can view own baselines"
on public.user_baselines for select to public
using (
  artist_id in (select id from public.artists where owner_user_id = auth.uid())
);

create policy "Service role can manage baselines"
on public.user_baselines for all to service_role
using (true) with check (true);

-- One row per artist per week. The Monday recap email and plan prompt both read this.
create table if not exists public.weekly_recaps (
  id uuid default gen_random_uuid() primary key,
  artist_id uuid not null references public.artists (id) on delete cascade,
  week_start date not null,
  summary jsonb not null,
  insight_text text,
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (artist_id, week_start)
);

create index if not exists weekly_recaps_artist_week_idx
  on public.weekly_recaps (artist_id, week_start desc);

alter table public.weekly_recaps enable row level security;

create policy "Users can view own weekly recaps"
on public.weekly_recaps for select to public
using (
  artist_id in (select id from public.artists where owner_user_id = auth.uid())
);

create policy "Service role can manage weekly recaps"
on public.weekly_recaps for all to service_role
using (true) with check (true);
