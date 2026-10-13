-- 1. What each post looks like, from its cover image: a kind (live, posed…)
--    and one plain line. Written by Tempo, correctable by the artist.
--    visual_source: 'ai' until the artist edits it, then 'artist' (never
--    overwritten by Tempo after that).
--    visual_attempts: failed reads (image gone, unreadable); stops at 3.
alter table public.post_performance add column if not exists visual_kind text
  check (visual_kind in ('live', 'posed', 'candid', 'studio', 'artwork', 'poster', 'graphic', 'other'));
alter table public.post_performance add column if not exists visual_note text
  check (char_length(visual_note) <= 200);
alter table public.post_performance add column if not exists visual_source text
  check (visual_source in ('ai', 'artist'));
alter table public.post_performance add column if not exists visual_attempts smallint not null default 0;

create or replace function public.set_post_visual(
  p_artist_id uuid,
  p_post_id text,
  p_kind text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_access_artist(p_artist_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_kind is not null and p_kind not in ('live', 'posed', 'candid', 'studio', 'artwork', 'poster', 'graphic', 'other') then
    raise exception 'Unknown kind' using errcode = '22023';
  end if;
  update public.post_performance
  set visual_kind = p_kind,
      visual_note = nullif(left(trim(coalesce(p_note, '')), 200), ''),
      visual_source = 'artist'
  where artist_id = p_artist_id and instagram_post_id = p_post_id;
  if not found then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.set_post_visual(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.set_post_visual(uuid, text, text, text) to authenticated;

-- 2. An optional link on a date (ticket page, festival page, Bandcamp,
--    press release). Tempo reads it once and keeps a short summary.
--    link_status: 'ok' read and summarised, 'failed' couldn't read it.
--    Changing the link clears the summary so it's read again.
alter table public.events add column if not exists link_url text
  check (link_url is null or (char_length(link_url) <= 500 and link_url ~* '^https?://'));
alter table public.events add column if not exists link_context text;
alter table public.events add column if not exists link_status text
  check (link_status in ('ok', 'failed'));
alter table public.events add column if not exists link_checked_at timestamptz;

create or replace function public.events_reset_link_context()
returns trigger
language plpgsql
as $$
begin
  if new.link_url is distinct from old.link_url then
    new.link_context := null;
    new.link_status := null;
    new.link_checked_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists events_reset_link_context on public.events;
create trigger events_reset_link_context
  before update of link_url on public.events
  for each row execute function public.events_reset_link_context();

-- 3. Shot lists get a tidied title ("single release" -> "Release day"), and
--    the lists made by the first version (test ones only) are cleared so
--    they're made again the new way.
alter table public.shot_lists add column if not exists title text
  check (title is null or char_length(title) <= 80);
delete from public.shot_lists;
