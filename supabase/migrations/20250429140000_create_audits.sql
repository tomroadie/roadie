-- Instagram intake audits (webhook from Zapier).

alter table public.profiles
  add column if not exists instagram_handle text;

create table if not exists public.audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  instagram_handle text not null,
  followers integer not null,
  following integer not null,
  post_count integer not null,
  bio text not null default '',
  recent_posts jsonb not null default '[]'::jsonb,
  ai_pattern_analysis text not null,
  ai_full_analysis text not null,
  created_at timestamptz not null default now()
);

create index if not exists audits_user_id_created_at_idx
  on public.audits (user_id, created_at desc);

alter table public.audits enable row level security;

drop policy if exists "Users can select own audits" on public.audits;

create policy "Users can select own audits"
  on public.audits for select
  to authenticated
  using (auth.uid() = user_id);
