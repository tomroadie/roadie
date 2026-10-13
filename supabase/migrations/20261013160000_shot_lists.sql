-- Shot lists: the day before a gig, release or session in an artist's
-- dates, Tempo turns the concept that fits into a short list of concrete
-- things to capture. One per event.
create table if not exists public.shot_lists (
  event_id uuid primary key references public.events (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  theme_name text,
  shots jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists shot_lists_artist_idx on public.shot_lists (artist_id, created_at desc);

alter table public.shot_lists enable row level security;

create policy "Artist access reads shot lists"
  on public.shot_lists for select
  to authenticated
  using (public.can_access_artist(artist_id));

create policy "Service role manages shot lists"
  on public.shot_lists for all
  to service_role
  using (true) with check (true);
