-- "Request access" sign-ups from the holding page during the closed beta.
create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  artist_name text,
  instagram_handle text,
  note text,
  status text not null default 'new' check (status in ('new', 'invited', 'declined')),
  created_at timestamptz not null default now()
);

create unique index if not exists access_requests_email_key on public.access_requests (lower(email));

alter table public.access_requests enable row level security;
revoke all on public.access_requests from public, anon, authenticated;
-- Written and read only by the server (service role) and admins in SQL.
