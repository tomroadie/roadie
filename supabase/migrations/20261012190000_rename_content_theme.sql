-- Artists can rename their concepts (names Tempo suggests aren't always how
-- they'd say it). Same access and uniqueness rules as adding one.
create or replace function public.rename_content_theme(
  p_theme_id uuid,
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
  select * into v_row from public.content_themes where id = p_theme_id for update;
  if v_row.id is null or not public.can_access_artist(v_row.artist_id) or v_row.status = 'archived' then
    raise exception 'Concept not found' using errcode = 'P0002';
  end if;
  if v_name = '' then
    raise exception 'Give the concept a name' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.content_themes
    where artist_id = v_row.artist_id and status <> 'archived' and id <> p_theme_id
      and lower(trim(name)) = lower(v_name)
  ) then
    raise exception 'You already have a concept called that' using errcode = '22023';
  end if;

  update public.content_themes
  set name = v_name,
      description = case
        when p_description is null then description
        else nullif(left(trim(p_description), 200), '')
      end
  where id = p_theme_id
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.rename_content_theme(uuid, text, text) from public, anon, authenticated;
grant execute on function public.rename_content_theme(uuid, text, text) to authenticated;
