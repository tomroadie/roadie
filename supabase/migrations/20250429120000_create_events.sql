-- Events for artists (shows, releases, sessions, etc.) used in content planning.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  event_date date not null,
  event_type text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists events_user_id_event_date_idx
  on public.events (user_id, event_date);

alter table public.events enable row level security;

drop policy if exists "Users can select own events" on public.events;
drop policy if exists "Users can insert own events" on public.events;
drop policy if exists "Users can update own events" on public.events;
drop policy if exists "Users can delete own events" on public.events;

create policy "Users can select own events"
  on public.events for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own events"
  on public.events for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own events"
  on public.events for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own events"
  on public.events for delete
  to authenticated
  using (auth.uid() = user_id);
