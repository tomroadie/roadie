-- Rosters: a manager, label or agency's set of artists, seen together on
-- one page. Roadie Media is the first, built from the accounts it manages.
-- roster_members is for managers' own logins (next step); until then only
-- admins can open a roster, and all reads go through the server.
create table if not exists public.rosters (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.roster_artists (
  roster_id uuid not null references public.rosters (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (roster_id, artist_id)
);

create table if not exists public.roster_members (
  roster_id uuid not null references public.rosters (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'manager' check (role in ('owner', 'manager', 'viewer')),
  added_at timestamptz not null default now(),
  primary key (roster_id, user_id)
);

alter table public.rosters enable row level security;
alter table public.roster_artists enable row level security;
alter table public.roster_members enable row level security;

create policy "Service role manages rosters" on public.rosters for all to service_role using (true) with check (true);
create policy "Service role manages roster artists" on public.roster_artists for all to service_role using (true) with check (true);
create policy "Service role manages roster members" on public.roster_members for all to service_role using (true) with check (true);

create policy "Members read their rosters" on public.rosters for select to authenticated
  using (exists (select 1 from public.roster_members m where m.roster_id = rosters.id and m.user_id = auth.uid()));
create policy "Members read their roster artists" on public.roster_artists for select to authenticated
  using (exists (select 1 from public.roster_members m where m.roster_id = roster_artists.roster_id and m.user_id = auth.uid()));
create policy "Members read their own membership" on public.roster_members for select to authenticated
  using (user_id = auth.uid());
