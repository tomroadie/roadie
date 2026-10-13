-- A page listing an act's upcoming dates (their own tour page, a venue's
-- what's-on page). Tempo reads it weekly and offers the dates it finds as
-- suggestions, which can be added one by one or all at once.
alter table public.profiles add column if not exists tour_page_url text
  check (tour_page_url is null or (char_length(tour_page_url) <= 500 and tour_page_url ~* '^https?://'));
alter table public.profiles add column if not exists tour_page_checked_at timestamptz;
-- ok: read, found dates (or none upcoming); failed: couldn't read it
alter table public.profiles add column if not exists tour_page_status text
  check (tour_page_status in ('ok', 'failed'));
alter table public.profiles add column if not exists tour_page_found smallint;

-- Where a suggestion came from, and notes to carry onto the date
-- ("3D/AV Live, Feeling Is Structure Tour. Sold out").
alter table public.date_suggestions add column if not exists source text not null default 'post'
  check (source in ('post', 'tour_page'));
alter table public.date_suggestions add column if not exists notes text
  check (notes is null or char_length(notes) <= 300);

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
            coalesce(v_row.notes,
              case when v_row.source = 'tour_page' then 'From your tour page'
                   else 'Spotted in your Instagram post' end))
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

-- "Add all": every pending suggestion that has a date and is still ahead.
create or replace function public.accept_all_date_suggestions(p_artist_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  if not public.can_access_artist(p_artist_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  for v_id in
    select id from public.date_suggestions
    where artist_id = p_artist_id and status = 'pending'
      and event_date is not null and event_date >= current_date
    order by event_date
  loop
    perform public.resolve_date_suggestion(v_id, 'accept', null);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Saving the tour page from the Dates page (artist access, not admin-only).
create or replace function public.set_tour_page(p_artist_id uuid, p_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_access_artist(p_artist_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.profiles
  set tour_page_url = nullif(trim(coalesce(p_url, '')), ''),
      tour_page_checked_at = null,
      tour_page_status = null,
      tour_page_found = null
  where id = p_artist_id;
end;
$$;

revoke all on function public.accept_all_date_suggestions(uuid) from public, anon, authenticated;
grant execute on function public.accept_all_date_suggestions(uuid) to authenticated;
revoke all on function public.set_tour_page(uuid, text) from public, anon, authenticated;
grant execute on function public.set_tour_page(uuid, text) to authenticated;
