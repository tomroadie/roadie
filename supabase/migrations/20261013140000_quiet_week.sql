-- Quiet week: a one-week skip with no reason asked. The target and streaks
-- hold (the week's outcome is 'quiet'), and all Tempo emails pause until
-- the next week starts. quiet_week_start = the board week it covers.
alter table public.profiles add column if not exists quiet_week_start date;

-- p_week_start = the artist's current board week (worked out by the app);
-- it must be within the last 7 days. p_on false ends it early.
create or replace function public.set_quiet_week(p_artist_id uuid, p_week_start date, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target smallint;
begin
  if not public.can_access_artist(p_artist_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_week_start is null or p_week_start > current_date or p_week_start < current_date - 7 then
    raise exception 'That week isn''t this week' using errcode = '22023';
  end if;

  if p_on then
    select coalesce(weekly_target, 1) into v_target from public.profiles where id = p_artist_id;
    insert into public.weekly_targets (artist_id, week_start, target, outcome)
    values (p_artist_id, p_week_start, v_target, 'quiet')
    on conflict (artist_id, week_start) do update set outcome = 'quiet';
    update public.profiles set quiet_week_start = p_week_start where id = p_artist_id;
  else
    update public.weekly_targets set outcome = null
    where artist_id = p_artist_id and week_start = p_week_start and outcome = 'quiet';
    update public.profiles set quiet_week_start = null
    where id = p_artist_id and quiet_week_start = p_week_start;
  end if;
end;
$$;

revoke all on function public.set_quiet_week(uuid, date, boolean) from public, anon, authenticated;
grant execute on function public.set_quiet_week(uuid, date, boolean) to authenticated;
