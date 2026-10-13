-- The Monday check-in: three optional prompts at the start of an artist's
-- week. Their answers shape that week's ideas (Tempo redraws the board) and
-- any dates in "coming up" become suggested dates.
create table if not exists public.week_notes (
  artist_id uuid not null references public.artists (id) on delete cascade,
  week_start date not null,
  coming_up text check (coming_up is null or char_length(coming_up) <= 600),
  unposted text check (unposted is null or char_length(unposted) <= 600),
  want_to_post text check (want_to_post is null or char_length(want_to_post) <= 600),
  skipped boolean not null default false,
  ideas_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (artist_id, week_start)
);

alter table public.week_notes enable row level security;

create policy "Artist access reads week notes"
  on public.week_notes for select
  to authenticated
  using (public.can_access_artist(artist_id));

create policy "Service role manages week notes"
  on public.week_notes for all
  to service_role
  using (true) with check (true);

-- Save (or skip) this week's check-in. p_week_start = their current board
-- week, worked out by the app; must be within the last 7 days.
create or replace function public.save_week_notes(
  p_artist_id uuid,
  p_week_start date,
  p_coming_up text,
  p_unposted text,
  p_want_to_post text,
  p_skipped boolean
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
  if p_week_start is null or p_week_start > current_date or p_week_start < current_date - 7 then
    raise exception 'That week isn''t this week' using errcode = '22023';
  end if;
  insert into public.week_notes (artist_id, week_start, coming_up, unposted, want_to_post, skipped)
  values (
    p_artist_id, p_week_start,
    nullif(left(trim(coalesce(p_coming_up, '')), 600), ''),
    nullif(left(trim(coalesce(p_unposted, '')), 600), ''),
    nullif(left(trim(coalesce(p_want_to_post, '')), 600), ''),
    coalesce(p_skipped, false)
  )
  on conflict (artist_id, week_start) do update set
    coming_up = excluded.coming_up,
    unposted = excluded.unposted,
    want_to_post = excluded.want_to_post,
    skipped = excluded.skipped;
end;
$$;

revoke all on function public.save_week_notes(uuid, date, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.save_week_notes(uuid, date, text, text, text, boolean) to authenticated;
