-- Concept board: the new Home loop (focus line, three concept cards from a
-- pool of five, pinned shelf). Replaces the weekly plan for artists with
-- profiles.board_enabled; everyone else is unaffected.
--
-- Everything is keyed to the artist, not the login, so memberships
-- (managers and artists with their own logins) only need to change
-- can_access_artist().

-- ---------------------------------------------------------------------------
-- Access: one place to decide who can see and act on an artist's board.
-- ---------------------------------------------------------------------------
create or replace function public.can_access_artist(p_artist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.artists a
    where a.id = p_artist_id
      and a.owner_user_id = auth.uid()
  ) or exists (
    -- Same admin rule as src/lib/is-admin.ts. Inlined because the live
    -- database doesn't have is_app_admin() despite its migration being
    -- recorded as applied.
    select 1 from public.profiles p
    where (p.owner_user_id = auth.uid() or p.id = auth.uid())
      and coalesce(p.is_admin, false)
  );
$$;

-- Supabase grants new functions to anon and authenticated by default;
-- revoking from public alone doesn't undo that, so each role is named.
revoke all on function public.can_access_artist(uuid) from public, anon, authenticated;
grant execute on function public.can_access_artist(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Profile switches. Onboarding will set weekly_target and week_start_day.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists board_enabled boolean not null default false;
alter table public.profiles
  add column if not exists weekly_target smallint
    check (weekly_target between 1 and 14);
-- 0 = Sunday ... 6 = Saturday, matching JS Date.getDay().
alter table public.profiles
  add column if not exists week_start_day smallint not null default 1
    check (week_start_day between 0 and 6);

-- ---------------------------------------------------------------------------
-- One row per generator run. The focus line lives here.
-- status: draft (saved, not shown) -> live (on the board) -> superseded.
-- ---------------------------------------------------------------------------
create table if not exists public.concept_generations (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists (id) on delete cascade,
  focus text not null,
  focus_why text,
  status text not null default 'draft'
    check (status in ('draft', 'live', 'superseded')),
  model text,
  attempts smallint,
  warnings jsonb not null default '[]'::jsonb,
  -- Snapshot of what the generator saw (post source, counts, target), for review.
  context_summary jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists concept_generations_artist_idx
  on public.concept_generations (artist_id, created_at desc);
-- At most one live generation per artist.
create unique index if not exists concept_generations_one_live_idx
  on public.concept_generations (artist_id) where status = 'live';

alter table public.concept_generations enable row level security;

create policy "Artist access reads generations"
  on public.concept_generations for select
  to authenticated
  using (public.can_access_artist(artist_id));

create policy "Service role manages generations"
  on public.concept_generations for all
  to service_role
  using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Concepts and their lifecycle.
--   pool    waiting to fill a board slot
--   board   showing in slot 1-3
--   pinned  on the shelf
--   posted  artist said they posted it
--   binned  "Not for me", with a reason
--   retired replaced by a newer generation, or let go from the shelf
-- ---------------------------------------------------------------------------
create table if not exists public.concepts (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists (id) on delete cascade,
  generation_id uuid not null references public.concept_generations (id) on delete cascade,
  position smallint not null,
  title text not null,
  why text not null,
  evidence_posts integer[] not null default '{}',
  executions jsonb not null,
  key_date date,
  basis text not null check (basis in ('from_data', 'starting_point')),
  about_news boolean not null default false,
  status text not null default 'pool'
    check (status in ('pool', 'board', 'pinned', 'posted', 'binned', 'retired')),
  slot smallint check (slot between 1 and 3),
  bin_reason text,
  instagram_post_id text,
  pinned_at timestamptz,
  posted_at timestamptz,
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check ((status = 'board') = (slot is not null))
);

create index if not exists concepts_artist_status_idx
  on public.concepts (artist_id, status);
create index if not exists concepts_generation_idx
  on public.concepts (generation_id, position);
-- A slot holds one card.
create unique index if not exists concepts_one_card_per_slot_idx
  on public.concepts (artist_id, slot) where status = 'board';

alter table public.concepts enable row level security;

create policy "Artist access reads concepts"
  on public.concepts for select
  to authenticated
  using (public.can_access_artist(artist_id));

create policy "Service role manages concepts"
  on public.concepts for all
  to service_role
  using (true) with check (true);

-- Artists change concepts only through apply_concept_action(), so there is
-- no update policy for authenticated users.

-- ---------------------------------------------------------------------------
-- Fill empty board slots from the live pool, oldest position first.
-- ---------------------------------------------------------------------------
create or replace function public.refill_board(p_artist_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot integer;
  v_concept uuid;
begin
  for v_slot in 1..3 loop
    if not exists (
      select 1 from public.concepts
      where artist_id = p_artist_id and status = 'board' and slot = v_slot
    ) then
      select c.id into v_concept
      from public.concepts c
      join public.concept_generations g on g.id = c.generation_id
      where c.artist_id = p_artist_id
        and c.status = 'pool'
        and g.status = 'live'
      order by c.position
      limit 1
      for update of c skip locked;

      exit when v_concept is null;

      update public.concepts
      set status = 'board', slot = v_slot, status_changed_at = now()
      where id = v_concept;
      v_concept := null;
    end if;
  end loop;
end;
$$;

revoke all on function public.refill_board(uuid) from public, anon, authenticated;
grant execute on function public.refill_board(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Put a generation live: retire the previous board and pool (pins stay on
-- the shelf), then deal three cards.
-- ---------------------------------------------------------------------------
create or replace function public.publish_concept_generation(p_generation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_artist uuid;
begin
  select artist_id into v_artist
  from public.concept_generations
  where id = p_generation_id
  for update;

  if v_artist is null then
    raise exception 'generation not found';
  end if;

  update public.concepts
  set status = 'retired', slot = null, status_changed_at = now()
  where artist_id = v_artist
    and status in ('pool', 'board')
    and generation_id <> p_generation_id;

  update public.concept_generations
  set status = 'superseded'
  where artist_id = v_artist and status = 'live' and id <> p_generation_id;

  update public.concept_generations
  set status = 'live', published_at = now()
  where id = p_generation_id;

  perform public.refill_board(v_artist);
end;
$$;

revoke all on function public.publish_concept_generation(uuid) from public, anon, authenticated;
grant execute on function public.publish_concept_generation(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Artist actions from the board and shelf. Checks access, changes status,
-- and refills the slot in one transaction.
--   pin      board -> pinned
--   bin      board/pinned -> binned (reason optional)
--   posted   board/pinned -> posted
--   let_go   pinned -> retired ("Still keen?" -> Let go)
-- ---------------------------------------------------------------------------
create or replace function public.apply_concept_action(
  p_concept_id uuid,
  p_action text,
  p_reason text default null
)
returns public.concepts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_concept public.concepts;
  v_allowed text[];
  v_next text;
begin
  select * into v_concept
  from public.concepts
  where id = p_concept_id
  for update;

  if v_concept.id is null or not public.can_access_artist(v_concept.artist_id) then
    raise exception 'concept not found' using errcode = 'P0002';
  end if;

  case p_action
    when 'pin' then v_allowed := array['board']; v_next := 'pinned';
    when 'bin' then v_allowed := array['board', 'pinned']; v_next := 'binned';
    when 'posted' then v_allowed := array['board', 'pinned']; v_next := 'posted';
    when 'let_go' then v_allowed := array['pinned']; v_next := 'retired';
    else raise exception 'unknown action %', p_action using errcode = '22023';
  end case;

  if not (v_concept.status = any (v_allowed)) then
    raise exception 'cannot % a % concept', p_action, v_concept.status
      using errcode = '22023';
  end if;

  update public.concepts
  set status = v_next,
      slot = null,
      status_changed_at = now(),
      pinned_at = case when v_next = 'pinned' then now() else pinned_at end,
      posted_at = case when v_next = 'posted' then now() else posted_at end,
      bin_reason = case
        when v_next = 'binned' then nullif(left(trim(p_reason), 200), '')
        else bin_reason
      end
  where id = p_concept_id
  returning * into v_concept;

  perform public.refill_board(v_concept.artist_id);
  return v_concept;
end;
$$;

revoke all on function public.apply_concept_action(uuid, text, text) from public, anon, authenticated;
grant execute on function public.apply_concept_action(uuid, text, text) to authenticated;
