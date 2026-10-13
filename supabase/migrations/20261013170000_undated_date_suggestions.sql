-- Announcements with no date ("we're playing Noizzefest", "new single
-- coming soon") become suggestions with no date. The artist fills the date
-- in when they add it, or dismisses it.

alter table public.date_suggestions alter column event_date drop not null;

-- The old two-argument version is replaced by one that takes the date.
drop function if exists public.resolve_date_suggestion(uuid, text);

-- accept   pending -> accepted, and the date becomes one of their events.
--          p_date is required when the suggestion has no date, and
--          overrides the spotted date when given.
-- dismiss  pending -> dismissed ("Not right")
create or replace function public.resolve_date_suggestion(
  p_suggestion_id uuid,
  p_action text,
  p_date date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.date_suggestions;
  v_owner uuid;
  v_event uuid;
  v_date date;
begin
  select * into v_row from public.date_suggestions where id = p_suggestion_id for update;
  if v_row.id is null or not public.can_access_artist(v_row.artist_id) then
    raise exception 'Date not found' using errcode = 'P0002';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'Already sorted' using errcode = '22023';
  end if;

  if p_action = 'accept' then
    v_date := coalesce(p_date, v_row.event_date);
    if v_date is null then
      raise exception 'Pick the date first' using errcode = '22023';
    end if;
    select owner_user_id into v_owner from public.artists where id = v_row.artist_id;
    insert into public.events (artist_id, user_id, title, event_date, event_type, notes)
    values (v_row.artist_id, v_owner, v_row.title, v_date, v_row.event_type,
            'Spotted in your Instagram post')
    returning id into v_event;
    update public.date_suggestions
    set status = 'accepted', event_id = v_event, event_date = v_date, status_changed_at = now()
    where id = p_suggestion_id;
  elsif p_action = 'dismiss' then
    update public.date_suggestions
    set status = 'dismissed', status_changed_at = now()
    where id = p_suggestion_id;
  else
    raise exception 'unknown action %', p_action using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.resolve_date_suggestion(uuid, text, date) from public, anon, authenticated;
grant execute on function public.resolve_date_suggestion(uuid, text, date) to authenticated;

-- Read the last month's posts again so announcements already passed over
-- (no date in them) get picked up. Dated ones already suggested are skipped.
update public.post_performance
set dates_checked_at = null
where post_date > now() - interval '30 days';
