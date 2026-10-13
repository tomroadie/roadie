-- The tour page becomes the act's website: read for dates of any kind
-- (shows and releases) and, without brief links, for the brief.
--   tour_page_note   what Tempo couldn't read and why (e.g. a Bandsintown widget)
--   bandsintown_key  the act's own Bandsintown API key (Bandsintown for
--                    Artists > Settings > General > Get API Key), for show
--                    dates that only load in a widget
alter table public.profiles add column if not exists tour_page_note text;
alter table public.profiles add column if not exists bandsintown_key text
  check (bandsintown_key is null or char_length(bandsintown_key) <= 200);

-- Saving the website from the Dates page, now with the optional key.
create or replace function public.set_tour_page(p_artist_id uuid, p_url text, p_bandsintown_key text default null)
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
      bandsintown_key = nullif(trim(coalesce(p_bandsintown_key, '')), ''),
      tour_page_checked_at = null,
      tour_page_status = null,
      tour_page_found = null,
      tour_page_note = null
  where id = p_artist_id;
end;
$$;

drop function if exists public.set_tour_page(uuid, text);
revoke all on function public.set_tour_page(uuid, text, text) from public, anon, authenticated;
grant execute on function public.set_tour_page(uuid, text, text) to authenticated;

-- Dates added from the website say so.
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
              case when v_row.source = 'tour_page' then 'From your website'
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

