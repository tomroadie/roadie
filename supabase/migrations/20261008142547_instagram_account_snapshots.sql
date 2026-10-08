-- One row per artist per day: follower and post counts as the sync saw them,
-- so growth can be shown over time.
create table if not exists public.instagram_account_snapshots (
  artist_id uuid not null references public.artists(id) on delete cascade,
  snapshot_date date not null,
  followers_count integer,
  media_count integer,
  created_at timestamptz not null default now(),
  primary key (artist_id, snapshot_date)
);

alter table public.instagram_account_snapshots enable row level security;

revoke all on public.instagram_account_snapshots from public, anon, authenticated;
grant select on public.instagram_account_snapshots to authenticated;

create policy "Read snapshots for artists you can access"
  on public.instagram_account_snapshots for select
  to authenticated
  using (public.can_access_artist(artist_id));

-- Cover image for each synced post (Instagram CDN link; refreshed on each sync).
alter table public.post_performance add column if not exists thumbnail_url text;

-- Each synced post belongs to at most one board idea.
create unique index if not exists concepts_instagram_post_id_key
  on public.concepts (instagram_post_id) where instagram_post_id is not null;
