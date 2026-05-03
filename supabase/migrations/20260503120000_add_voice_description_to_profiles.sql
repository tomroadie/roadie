-- Artist-written voice / how they describe themselves (settings).

alter table public.profiles
  add column if not exists voice_description text;

comment on column public.profiles.voice_description is
  'Free-text how the artist describes themselves in their own words (for authentic caption tone).';
