alter table public.profiles
  add column if not exists account_type text not null default 'artist'
  check (account_type in ('artist', 'venue'));
