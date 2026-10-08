-- Posts the artist marked as an ad or collab: left out of "your usual" and
-- out of what the concept generator learns from.
alter table public.post_performance
  add column if not exists excluded_from_usual boolean not null default false;

-- Artists (and admins) flip the flag for posts on artists they can access.
create or replace function public.set_post_excluded(p_instagram_post_id text, p_excluded boolean)
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

  update public.post_performance
  set excluded_from_usual = p_excluded
  where instagram_post_id = p_instagram_post_id
    and artist_id = v_artist;
end;
$$;

revoke all on function public.set_post_excluded(text, boolean) from public, anon;
grant execute on function public.set_post_excluded(text, boolean) to authenticated;
