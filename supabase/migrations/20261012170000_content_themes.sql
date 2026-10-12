-- Content themes: the broad concepts an artist's posts live in ("Behind the
-- record", "Live moments"). Board ideas sit under a theme as its angles, and
-- synced posts are tagged with one so learnings can roll up per theme.
--
--   active     shown on Home and the Concepts page
--   suggested  Tempo spotted a gap; the artist can add it or say no
--   archived   let go, or a suggestion they turned down
--
-- Keyed to the artist like the board, so access goes through can_access_artist().

create table if not exists public.content_themes (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  description text check (description is null or char_length(description) <= 200),
  position smallint not null default 0,
  status text not null default 'active'
    check (status in ('active', 'suggested', 'archived')),
  source text not null default 'tempo' check (source in ('tempo', 'artist')),
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists content_themes_artist_idx
  on public.content_themes (artist_id, status, position);
-- One live theme per name per artist.
create unique index if not exists content_themes_unique_name_idx
  on public.content_themes (artist_id, lower(trim(name)))
  where status <> 'archived';

alter table public.content_themes enable row level security;

create policy "Artist access reads themes"
  on public.content_themes for select
  to authenticated
  using (public.can_access_artist(artist_id));

create policy "Service role manages themes"
  on public.content_themes for all
  to service_role
  using (true) with check (true);

-- Board ideas: which theme each one is an angle of.
alter table public.concepts
  add column if not exists theme_id uuid references public.content_themes (id) on delete set null;
create index if not exists concepts_theme_idx on public.concepts (theme_id);

-- Synced posts: which theme they belong to, and who decided.
--   auto    Tempo sorted it; shown to the artist to confirm
--   artist  the artist chose or confirmed it
alter table public.post_performance
  add column if not exists theme_id uuid references public.content_themes (id) on delete set null;
alter table public.post_performance
  add column if not exists theme_source text check (theme_source in ('auto', 'artist'));
create index if not exists post_performance_theme_idx on public.post_performance (theme_id);

-- ---------------------------------------------------------------------------
-- Artist actions. Artists change themes and tags only through these.
-- ---------------------------------------------------------------------------

-- Add their own theme. Returns the new row.
create or replace function public.add_content_theme(
  p_artist_id uuid,
  p_name text,
  p_description text default null
)
returns public.content_themes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.content_themes;
  v_name text := left(trim(coalesce(p_name, '')), 60);
begin
  if not public.can_access_artist(p_artist_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'Give the concept a name' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.content_themes
    where artist_id = p_artist_id and status <> 'archived'
      and lower(trim(name)) = lower(v_name)
  ) then
    raise exception 'You already have a concept called that' using errcode = '22023';
  end if;

  insert into public.content_themes (artist_id, name, description, position, status, source)
  values (
    p_artist_id,
    v_name,
    nullif(left(trim(coalesce(p_description, '')), 200), ''),
    coalesce((select max(position) + 1 from public.content_themes where artist_id = p_artist_id), 1),
    'active',
    'artist'
  )
  returning * into v_row;
  return v_row;
end;
$$;

-- accept   suggested -> active
-- dismiss  suggested -> archived ("Not for me")
-- archive  active    -> archived (posts and ideas keep their history)
create or replace function public.set_content_theme_status(
  p_theme_id uuid,
  p_action text
)
returns public.content_themes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.content_themes;
  v_allowed text;
  v_next text;
begin
  select * into v_row from public.content_themes where id = p_theme_id for update;
  if v_row.id is null or not public.can_access_artist(v_row.artist_id) then
    raise exception 'Concept not found' using errcode = 'P0002';
  end if;

  case p_action
    when 'accept' then v_allowed := 'suggested'; v_next := 'active';
    when 'dismiss' then v_allowed := 'suggested'; v_next := 'archived';
    when 'archive' then v_allowed := 'active'; v_next := 'archived';
    else raise exception 'unknown action %', p_action using errcode = '22023';
  end case;

  if v_row.status <> v_allowed then
    raise exception 'cannot % a % concept', p_action, v_row.status using errcode = '22023';
  end if;

  update public.content_themes
  set status = v_next, status_changed_at = now()
  where id = p_theme_id
  returning * into v_row;
  return v_row;
end;
$$;

-- Choose or confirm the theme for a synced post. Null clears it ("none of these").
create or replace function public.set_post_theme(
  p_instagram_post_id text,
  p_theme_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_artist uuid;
begin
  select artist_id into v_artist
  from public.post_performance
  where instagram_post_id = p_instagram_post_id
  limit 1;
  if v_artist is null then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
  if not public.can_access_artist(v_artist) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_theme_id is not null and not exists (
    select 1 from public.content_themes
    where id = p_theme_id and artist_id = v_artist and status = 'active'
  ) then
    raise exception 'Concept not found' using errcode = 'P0002';
  end if;

  update public.post_performance
  set theme_id = p_theme_id, theme_source = 'artist'
  where instagram_post_id = p_instagram_post_id and artist_id = v_artist;
end;
$$;

revoke all on function public.add_content_theme(uuid, text, text) from public, anon, authenticated;
revoke all on function public.set_content_theme_status(uuid, text) from public, anon, authenticated;
revoke all on function public.set_post_theme(text, uuid) from public, anon, authenticated;
grant execute on function public.add_content_theme(uuid, text, text) to authenticated;
grant execute on function public.set_content_theme_status(uuid, text) to authenticated;
grant execute on function public.set_post_theme(text, uuid) to authenticated;
