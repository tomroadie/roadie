-- Facebook Business connections (the "Tempo for Teams" Meta app, Facebook
-- Login). One person logs in with Facebook once and Tempo can see every
-- Instagram account their Business Manager reaches. Each artist added that
-- way stores a Page token on their profile, read with the Facebook Graph host.

-- How each artist's Instagram is connected.
--   instagram  Instagram Login (the artist logged in themselves); 60-day token, refreshed
--   facebook   Facebook Business (a manager or Roadie connected it); Page token, no expiry
alter table public.profiles
  add column if not exists instagram_auth text not null default 'instagram'
    check (instagram_auth in ('instagram', 'facebook'));
alter table public.profiles
  add column if not exists instagram_page_id text;

-- The Facebook login itself: a long-lived user token, used to list the
-- Pages and Instagram accounts the person can reach. Tokens never leave the
-- server, so only the service role can read this table.
create table if not exists public.facebook_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  fb_user_id text not null,
  fb_name text,
  user_access_token text not null,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.facebook_connections enable row level security;

create policy "Service role manages facebook connections"
  on public.facebook_connections for all
  to service_role
  using (true) with check (true);
