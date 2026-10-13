-- Profile visits from each post, alongside follows (which existed but was
-- never filled in). Both feed the post value score.
alter table public.post_performance add column if not exists profile_visits integer;
