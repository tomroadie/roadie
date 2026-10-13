-- Post descriptions in two parts: a short label shown to the artist
-- ("Festival poster, band photo"), and the longer note Tempo uses behind
-- the scenes. The artist corrects the label and can say what Tempo got
-- wrong (visual_correction), which overrides the note wherever it's used.
alter table public.post_performance add column if not exists visual_label text
  check (char_length(visual_label) <= 40);
alter table public.post_performance add column if not exists visual_correction text
  check (char_length(visual_correction) <= 300);

drop function if exists public.set_post_visual(uuid, text, text, text);

create or replace function public.set_post_visual(
  p_artist_id uuid,
  p_post_id text,
  p_kind text,
  p_label text,
  p_correction text
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
      visual_label = nullif(left(trim(coalesce(p_label, '')), 40), ''),
      visual_correction = nullif(left(trim(coalesce(p_correction, '')), 300), ''),
      visual_source = 'artist'
  where artist_id = p_artist_id and instagram_post_id = p_post_id;
  if not found then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.set_post_visual(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.set_post_visual(uuid, text, text, text, text) to authenticated;
