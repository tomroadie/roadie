alter table public.profiles
  add column if not exists is_managed boolean not null default false;

create table if not exists public.weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists (id) on delete cascade,
  week_start date not null,
  response text not null,
  created_at timestamptz not null default now(),
  unique (artist_id, week_start)
);

create index if not exists weekly_checkins_artist_week_idx
  on public.weekly_checkins (artist_id, week_start desc);

alter table public.weekly_checkins enable row level security;
