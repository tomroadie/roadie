-- Closed beta: sign-up needs a one-time invite link.
alter table public.access_requests
  add column if not exists invite_token text,
  add column if not exists invited_at timestamptz,
  add column if not exists joined_at timestamptz,
  add column if not exists source text not null default 'request';

create unique index if not exists access_requests_invite_token_key
  on public.access_requests (invite_token) where invite_token is not null;
