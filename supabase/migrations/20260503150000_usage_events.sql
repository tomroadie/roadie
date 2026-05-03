-- Lightweight product analytics (plan, audit funnel).
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null,
  artist_id uuid not null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now ()
);

create index if not exists usage_events_user_created_idx
  on public.usage_events (user_id, created_at desc);

create index if not exists usage_events_artist_created_idx
  on public.usage_events (artist_id, created_at desc);

alter table public.usage_events enable row level security;

create policy "Users insert own usage_events"
  on public.usage_events for insert
  to authenticated
  with check (
    user_id = (select auth.uid ())
    and exists (
      select 1
      from public.artists a
      where
        a.id = usage_events.artist_id
        and a.owner_user_id = (select auth.uid ())
    )
  );

create policy "Users select own usage_events"
  on public.usage_events for select
  to authenticated
  using (user_id = (select auth.uid ()));
