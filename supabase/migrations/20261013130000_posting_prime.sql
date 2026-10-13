-- Posting pace: each artist's prime (the most they should post in a week
-- at their best) and a week-by-week history of targets, so the target can
-- step towards the prime on two-week rules and offer "n+1?" after a hit.

-- prime_suggested: worked out by Tempo from their best four-week stretch
--   over the past year (refreshed monthly by the post sync).
-- prime_target: what the artist confirmed or changed it to. Null until then;
--   the suggestion applies meanwhile.
alter table public.profiles add column if not exists prime_suggested smallint
  check (prime_suggested between 1 and 21);
alter table public.profiles add column if not exists prime_target smallint
  check (prime_target between 1 and 21);
alter table public.profiles add column if not exists prime_computed_at timestamptz;

-- One row per artist per board week, written by the weekly job.
--   outcome    hit | miss | quiet, set when the week is over
--   step_offer accepted | declined: their answer to "Up for n+1 next week?"
create table if not exists public.weekly_targets (
  artist_id uuid not null references public.artists (id) on delete cascade,
  week_start date not null,
  target smallint not null check (target between 1 and 21),
  posted smallint,
  outcome text check (outcome in ('hit', 'miss', 'quiet')),
  step_offer text check (step_offer in ('accepted', 'declined')),
  created_at timestamptz not null default now(),
  primary key (artist_id, week_start)
);

alter table public.weekly_targets enable row level security;

create policy "Artist access reads weekly targets"
  on public.weekly_targets for select
  to authenticated
  using (public.can_access_artist(artist_id));

create policy "Service role manages weekly targets"
  on public.weekly_targets for all
  to service_role
  using (true) with check (true);

-- Confirm or change the prime. Lowering it below this week's target brings
-- the target down too.
create or replace function public.set_posting_prime(p_artist_id uuid, p_prime integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_access_artist(p_artist_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_prime is null or p_prime < 1 or p_prime > 21 then
    raise exception 'Pick between 1 and 21 posts a week' using errcode = '22023';
  end if;
  update public.profiles
  set prime_target = p_prime,
      weekly_target = least(coalesce(weekly_target, p_prime), p_prime)
  where id = p_artist_id;
  update public.weekly_targets
  set target = least(target, p_prime)
  where artist_id = p_artist_id
    and week_start = (select max(week_start) from public.weekly_targets where artist_id = p_artist_id);
end;
$$;

-- Answer "Up for n+1 next week?" on the current week.
create or replace function public.answer_step_offer(p_artist_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week date;
begin
  if not public.can_access_artist(p_artist_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select max(week_start) into v_week from public.weekly_targets where artist_id = p_artist_id;
  if v_week is null then
    raise exception 'No week to answer for yet' using errcode = 'P0002';
  end if;
  update public.weekly_targets
  set step_offer = case when p_accept then 'accepted' else 'declined' end
  where artist_id = p_artist_id and week_start = v_week;
end;
$$;

revoke all on function public.set_posting_prime(uuid, integer) from public, anon, authenticated;
revoke all on function public.answer_step_offer(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_posting_prime(uuid, integer) to authenticated;
grant execute on function public.answer_step_offer(uuid, boolean) to authenticated;
