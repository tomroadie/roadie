-- Add optional sub-genre / free-text sound description to profiles.
-- Run in Supabase SQL Editor, or apply via Supabase CLI migrations.

alter table public.profiles
  add column if not exists sound_description text;

comment on column public.profiles.sound_description is
  'Optional artist-defined sub-genre or sound (e.g. dark folk, cinematic trap).';
