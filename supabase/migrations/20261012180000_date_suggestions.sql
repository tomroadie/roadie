-- Dates spotted in an artist's own Instagram captions ("single out Friday",
-- "tickets on sale Thursday"). They're suggestions until the artist adds
-- them; only then do they become events and reach the idea generator.

alter table public.post_performance
  add column if not exists dates_checked_at timestamptz;

create table if not exists public.date_suggestions (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  event_date date not null,
  event_type text not null,
  source_post_id text,
  source_excerpt text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'dismissed')),
  event_id uuid references public.events (id) on delete set null,
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists date_suggestions_artist_idx
  on public.date_suggestions (artist_id, status, event_date);

alter table public.date_suggestions enable row level security;

create policy "Artist access reads date suggestions"
  on public.date_suggestions for select
  to authenticated
  using (public.can_access_artist(artist_id));

create policy "Service role manages date suggestions"
  on public.date_suggestions for all
  to service_role
  using (true) with check (true);

-- accept   pending -> accepted, and the date becomes one of their events
-- dismiss  pending -> dismissed ("Not right")
create or replace function public.resolve_date_suggestion(
  p_suggestion_id uuid,
  p_action text
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
begin
  select * into v_row from public.date_suggestions where id = p_suggestion_id for update;
  if v_row.id is null or not public.can_access_artist(v_row.artist_id) then
    raise exception 'Date not found' using errcode = 'P0002';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'Already sorted' using errcode = '22023';
  end if;

  if p_action = 'accept' then
    select owner_user_id into v_owner from public.artists where id = v_row.artist_id;
    insert into public.events (artist_id, user_id, title, event_date, event_type, notes)
    values (v_row.artist_id, v_owner, v_row.title, v_row.event_date, v_row.event_type,
            'Spotted in your Instagram post')
    returning id into v_event;
    update public.date_suggestions
    set status = 'accepted', event_id = v_event, status_changed_at = now()
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

revoke all on function public.resolve_date_suggestion(uuid, text) from public, anon, authenticated;
grant execute on function public.resolve_date_suggestion(uuid, text) to authenticated;
