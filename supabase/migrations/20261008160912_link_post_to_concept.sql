-- "Was this one of your ideas?" for posts Instagram spotted that weren't
-- matched to a board idea.
alter table public.post_performance
  add column if not exists idea_prompt_dismissed boolean not null default false;

-- Links a synced post to one of the artist's ideas. An idea still on the
-- board or shelf is marked posted first (which refills its slot).
create or replace function public.link_post_to_concept(p_concept_id uuid, p_instagram_post_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_concept public.concepts;
  v_post_artist uuid;
begin
  select * into v_concept from public.concepts where id = p_concept_id;
  if v_concept.id is null then
    raise exception 'Idea not found' using errcode = 'P0002';
  end if;
  if not public.can_access_artist(v_concept.artist_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select artist_id into v_post_artist
  from public.post_performance
  where instagram_post_id = p_instagram_post_id and artist_id = v_concept.artist_id
  limit 1;
  if v_post_artist is null then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.concepts where instagram_post_id = p_instagram_post_id) then
    raise exception 'That post is already linked to an idea' using errcode = '22023';
  end if;
  if v_concept.instagram_post_id is not null then
    raise exception 'That idea is already linked to a post' using errcode = '22023';
  end if;

  if v_concept.status in ('board', 'pinned') then
    perform public.apply_concept_action(p_concept_id, 'posted', null);
  end if;

  update public.concepts set instagram_post_id = p_instagram_post_id where id = p_concept_id;
end;
$$;

-- "No, something else": stop asking about this post.
create or replace function public.dismiss_post_idea_prompt(p_instagram_post_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_artist uuid;
begin
  select artist_id into v_artist from public.post_performance where instagram_post_id = p_instagram_post_id limit 1;
  if v_artist is null then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
  if not public.can_access_artist(v_artist) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.post_performance set idea_prompt_dismissed = true
  where instagram_post_id = p_instagram_post_id and artist_id = v_artist;
end;
$$;

revoke all on function public.link_post_to_concept(uuid, text) from public, anon;
revoke all on function public.dismiss_post_idea_prompt(text) from public, anon;
grant execute on function public.link_post_to_concept(uuid, text) to authenticated;
grant execute on function public.dismiss_post_idea_prompt(text) to authenticated;
