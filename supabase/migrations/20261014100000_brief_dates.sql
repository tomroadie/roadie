-- Dates from the artist's plan (brief notes) become date suggestions.
--   date_suggestions.source  gains 'brief'
--   profiles.brief_notes     room for a full campaign plan (3000 -> 8000)
--   profiles.brief_notes_read_hash  which version of the notes was last read

alter table public.date_suggestions drop constraint if exists date_suggestions_source_check;
alter table public.date_suggestions add constraint date_suggestions_source_check
  check (source in ('post', 'tour_page', 'brief'));

alter table public.profiles drop constraint if exists profiles_brief_notes_check;
alter table public.profiles add constraint profiles_brief_notes_check
  check (brief_notes is null or char_length(brief_notes) <= 8000);

alter table public.profiles add column if not exists brief_notes_read_hash text;

-- Dates added from the plan say so.
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
                   when v_row.source = 'brief' then 'From your plan'
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

