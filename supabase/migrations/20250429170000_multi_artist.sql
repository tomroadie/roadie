-- Multi-artist: artists table, profiles.owner_user_id, scope events/weekly_plans/audits by artist.

-- 1. Artists (one row per artist profile; id matches profiles.id)
create table if not exists public.artists (
  id uuid primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists artists_owner_user_id_idx
  on public.artists (owner_user_id);

alter table public.artists enable row level security;

drop policy if exists "Users manage own artists" on public.artists;

create policy "Users manage own artists"
  on public.artists for all
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- 2. Backfill artists from existing profiles (legacy: profile.id = user id)
insert into public.artists (id, owner_user_id)
select id, id from public.profiles
on conflict (id) do nothing;

-- 3. profiles.owner_user_id
alter table public.profiles
  add column if not exists owner_user_id uuid references auth.users (id) on delete cascade;

update public.profiles
set owner_user_id = id
where owner_user_id is null;

alter table public.profiles
  alter column owner_user_id set not null;

-- Prefer artists as profile identity (was often profiles.id -> auth.users)
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles drop constraint if exists profiles_user_id_fkey;
alter table public.profiles drop constraint if exists profiles_id_artists_fkey;

alter table public.profiles
  add constraint profiles_id_artists_fkey
  foreign key (id) references public.artists (id) on delete cascade;

-- 4. events: user_id -> artist_id
alter table public.events
  add column if not exists artist_id uuid references public.artists (id) on delete cascade;

update public.events
set artist_id = user_id
where artist_id is null and user_id is not null;

alter table public.events
  alter column artist_id set not null;

drop policy if exists "Users can select own events" on public.events;
drop policy if exists "Users can insert own events" on public.events;
drop policy if exists "Users can update own events" on public.events;
drop policy if exists "Users can delete own events" on public.events;

alter table public.events drop column if exists user_id;

drop index if exists events_user_id_event_date_idx;
create index if not exists events_artist_id_event_date_idx
  on public.events (artist_id, event_date);

create policy "Users can select own events"
  on public.events for select
  to authenticated
  using (
    exists (
      select 1 from public.artists a
      where a.id = events.artist_id and a.owner_user_id = auth.uid()
    )
  );

create policy "Users can insert own events"
  on public.events for insert
  to authenticated
  with check (
    exists (
      select 1 from public.artists a
      where a.id = artist_id and a.owner_user_id = auth.uid()
    )
  );

create policy "Users can update own events"
  on public.events for update
  to authenticated
  using (
    exists (
      select 1 from public.artists a
      where a.id = events.artist_id and a.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.artists a
      where a.id = events.artist_id and a.owner_user_id = auth.uid()
    )
  );

create policy "Users can delete own events"
  on public.events for delete
  to authenticated
  using (
    exists (
      select 1 from public.artists a
      where a.id = events.artist_id and a.owner_user_id = auth.uid()
    )
  );

-- 5. weekly_plans: create or migrate to artist_id
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'weekly_plans'
  ) then
    create table public.weekly_plans (
      id uuid primary key default gen_random_uuid (),
      artist_id uuid not null references public.artists (id) on delete cascade,
      week_start date not null,
      ideas jsonb not null,
      created_at timestamptz not null default now (),
      unique (artist_id, week_start)
    );
    create index weekly_plans_artist_week_idx
      on public.weekly_plans (artist_id, week_start desc);
    alter table public.weekly_plans enable row level security;
    create policy "Users can select own weekly_plans"
      on public.weekly_plans for select
      to authenticated
      using (
        exists (
          select 1 from public.artists a
          where a.id = weekly_plans.artist_id and a.owner_user_id = auth.uid()
        )
      );
    create policy "Users can insert own weekly_plans"
      on public.weekly_plans for insert
      to authenticated
      with check (
        exists (
          select 1 from public.artists a
          where a.id = artist_id and a.owner_user_id = auth.uid()
        )
      );
    create policy "Users can update own weekly_plans"
      on public.weekly_plans for update
      to authenticated
      using (
        exists (
          select 1 from public.artists a
          where a.id = weekly_plans.artist_id and a.owner_user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.artists a
          where a.id = weekly_plans.artist_id and a.owner_user_id = auth.uid()
        )
      );
    create policy "Users can delete own weekly_plans"
      on public.weekly_plans for delete
      to authenticated
      using (
        exists (
          select 1 from public.artists a
          where a.id = weekly_plans.artist_id and a.owner_user_id = auth.uid()
        )
      );
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'weekly_plans'
      and column_name = 'user_id'
  ) then
    alter table public.weekly_plans
      add column if not exists artist_id uuid references public.artists (id) on delete cascade;
    update public.weekly_plans w
    set artist_id = w.user_id
    where w.artist_id is null and w.user_id is not null;
    alter table public.weekly_plans drop constraint if exists weekly_plans_user_id_week_start_key;
    alter table public.weekly_plans drop constraint if exists weekly_plans_user_id_fkey;
    alter table public.weekly_plans alter column artist_id set not null;
    alter table public.weekly_plans drop column user_id;
    alter table public.weekly_plans add constraint weekly_plans_artist_week_unique unique (artist_id, week_start);
    drop policy if exists "Users can select own weekly_plans" on public.weekly_plans;
    drop policy if exists "Users can insert own weekly_plans" on public.weekly_plans;
    drop policy if exists "Users can update own weekly_plans" on public.weekly_plans;
    drop policy if exists "Users can delete own weekly_plans" on public.weekly_plans;
    create policy "Users can select own weekly_plans"
      on public.weekly_plans for select
      to authenticated
      using (
        exists (
          select 1 from public.artists a
          where a.id = weekly_plans.artist_id and a.owner_user_id = auth.uid()
        )
      );
    create policy "Users can insert own weekly_plans"
      on public.weekly_plans for insert
      to authenticated
      with check (
        exists (
          select 1 from public.artists a
          where a.id = artist_id and a.owner_user_id = auth.uid()
        )
      );
    create policy "Users can update own weekly_plans"
      on public.weekly_plans for update
      to authenticated
      using (
        exists (
          select 1 from public.artists a
          where a.id = weekly_plans.artist_id and a.owner_user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.artists a
          where a.id = weekly_plans.artist_id and a.owner_user_id = auth.uid()
        )
      );
    create policy "Users can delete own weekly_plans"
      on public.weekly_plans for delete
      to authenticated
      using (
        exists (
          select 1 from public.artists a
          where a.id = weekly_plans.artist_id and a.owner_user_id = auth.uid()
        )
      );
  end if;
end $$;

-- 6. audits: scope by artist
alter table public.audits
  add column if not exists artist_id uuid references public.artists (id) on delete cascade;

update public.audits u
set artist_id = u.user_id
where u.artist_id is null and u.user_id is not null;

drop policy if exists "Users can select own audits" on public.audits;

create policy "Users can select own audits"
  on public.audits for select
  to authenticated
  using (
    artist_id is not null
    and exists (
      select 1 from public.artists a
      where a.id = audits.artist_id and a.owner_user_id = auth.uid()
    )
  );

create index if not exists audits_artist_id_created_at_idx
  on public.audits (artist_id, created_at desc);

-- 7. profiles RLS by owner (supports multiple profiles per account)
alter table public.profiles enable row level security;

drop policy if exists "Profiles select own" on public.profiles;
drop policy if exists "Profiles insert own" on public.profiles;
drop policy if exists "Profiles update own" on public.profiles;
drop policy if exists "Profiles delete own" on public.profiles;

create policy "Profiles select own"
  on public.profiles for select
  to authenticated
  using (owner_user_id = auth.uid());

create policy "Profiles insert own"
  on public.profiles for insert
  to authenticated
  with check (owner_user_id = auth.uid());

create policy "Profiles update own"
  on public.profiles for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "Profiles delete own"
  on public.profiles for delete
  to authenticated
  using (owner_user_id = auth.uid());
