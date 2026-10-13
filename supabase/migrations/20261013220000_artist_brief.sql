-- What Tempo knows about an act beyond Instagram, for writing ideas:
--   brief_links    their website, bio, press or release links (one per line)
--   brief_notes    notes from the Tempo team, in their words
--   brief_context  Tempo's summary of the linked pages
--   setup_brief_done  the setup checklist's Brief step is done or skipped
alter table public.profiles add column if not exists brief_links text
  check (brief_links is null or char_length(brief_links) <= 2000);
alter table public.profiles add column if not exists brief_notes text
  check (brief_notes is null or char_length(brief_notes) <= 3000);
alter table public.profiles add column if not exists brief_context text;
alter table public.profiles add column if not exists brief_checked_at timestamptz;
alter table public.profiles add column if not exists setup_brief_done boolean not null default false;
