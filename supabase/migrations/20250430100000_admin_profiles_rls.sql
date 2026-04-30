-- Admin users (profiles.is_admin) + RLS so admins can manage/view any artist.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

alter table public.profiles
  add column if not exists client_managed boolean not null default false;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.owner_user_id = auth.uid()
      and coalesce(p.is_admin, false)
  );
$$;

revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to authenticated;

-- Artists
drop policy if exists "Users manage own artists" on public.artists;

create policy "Users manage own artists"
  on public.artists for all
  to authenticated
  using (
    owner_user_id = auth.uid()
    or public.is_app_admin()
  )
  with check (
    owner_user_id = auth.uid()
    or public.is_app_admin()
  );

-- Profiles
drop policy if exists "Profiles select own" on public.profiles;
drop policy if exists "Profiles insert own" on public.profiles;
drop policy if exists "Profiles update own" on public.profiles;
drop policy if exists "Profiles delete own" on public.profiles;

create policy "Profiles select own"
  on public.profiles for select
  to authenticated
  using (
    owner_user_id = auth.uid()
    or public.is_app_admin()
  );

create policy "Profiles insert own"
  on public.profiles for insert
  to authenticated
  with check (
    owner_user_id = auth.uid()
    or public.is_app_admin()
  );

create policy "Profiles update own"
  on public.profiles for update
  to authenticated
  using (
    owner_user_id = auth.uid()
    or public.is_app_admin()
  )
  with check (
    owner_user_id = auth.uid()
    or public.is_app_admin()
  );

create policy "Profiles delete own"
  on public.profiles for delete
  to authenticated
  using (
    owner_user_id = auth.uid()
    or public.is_app_admin()
  );

-- Events
drop policy if exists "Users can select own events" on public.events;
drop policy if exists "Users can insert own events" on public.events;
drop policy if exists "Users can update own events" on public.events;
drop policy if exists "Users can delete own events" on public.events;

create policy "Users can select own events"
  on public.events for select
  to authenticated
  using (
    public.is_app_admin()
    or exists (
      select 1 from public.artists a
      where a.id = events.artist_id and a.owner_user_id = auth.uid()
    )
  );

create policy "Users can insert own events"
  on public.events for insert
  to authenticated
  with check (
    public.is_app_admin()
    or exists (
      select 1 from public.artists a
      where a.id = artist_id and a.owner_user_id = auth.uid()
    )
  );

create policy "Users can update own events"
  on public.events for update
  to authenticated
  using (
    public.is_app_admin()
    or exists (
      select 1 from public.artists a
      where a.id = events.artist_id and a.owner_user_id = auth.uid()
    )
  )
  with check (
    public.is_app_admin()
    or exists (
      select 1 from public.artists a
      where a.id = events.artist_id and a.owner_user_id = auth.uid()
    )
  );

create policy "Users can delete own events"
  on public.events for delete
  to authenticated
  using (
    public.is_app_admin()
    or exists (
      select 1 from public.artists a
      where a.id = events.artist_id and a.owner_user_id = auth.uid()
    )
  );

-- Weekly plans (table may exist from multi_artist migration)
drop policy if exists "Users can select own weekly_plans" on public.weekly_plans;
drop policy if exists "Users can insert own weekly_plans" on public.weekly_plans;
drop policy if exists "Users can update own weekly_plans" on public.weekly_plans;
drop policy if exists "Users can delete own weekly_plans" on public.weekly_plans;

create policy "Users can select own weekly_plans"
  on public.weekly_plans for select
  to authenticated
  using (
    public.is_app_admin()
    or exists (
      select 1 from public.artists a
      where a.id = weekly_plans.artist_id and a.owner_user_id = auth.uid()
    )
  );

create policy "Users can insert own weekly_plans"
  on public.weekly_plans for insert
  to authenticated
  with check (
    public.is_app_admin()
    or exists (
      select 1 from public.artists a
      where a.id = artist_id and a.owner_user_id = auth.uid()
    )
  );

create policy "Users can update own weekly_plans"
  on public.weekly_plans for update
  to authenticated
  using (
    public.is_app_admin()
    or exists (
      select 1 from public.artists a
      where a.id = weekly_plans.artist_id and a.owner_user_id = auth.uid()
    )
  )
  with check (
    public.is_app_admin()
    or exists (
      select 1 from public.artists a
      where a.id = weekly_plans.artist_id and a.owner_user_id = auth.uid()
    )
  );

create policy "Users can delete own weekly_plans"
  on public.weekly_plans for delete
  to authenticated
  using (
    public.is_app_admin()
    or exists (
      select 1 from public.artists a
      where a.id = weekly_plans.artist_id and a.owner_user_id = auth.uid()
    )
  );

-- Audits (select only in migrations)
drop policy if exists "Users can select own audits" on public.audits;

create policy "Users can select own audits"
  on public.audits for select
  to authenticated
  using (
    artist_id is not null
    and (
      public.is_app_admin()
      or exists (
        select 1 from public.artists a
        where a.id = audits.artist_id and a.owner_user_id = auth.uid()
      )
    )
  );

-- Promote an account to admin (run once in SQL editor after migrate):
-- update public.profiles
-- set is_admin = true
-- where owner_user_id = (select id from auth.users where email = 'tom@roadie.media');
