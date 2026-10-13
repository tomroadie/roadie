-- Each post's numbers at about 24 hours old, taken once by the 3-hourly
-- sync, so a new post can be compared fairly with the artist's other posts
-- at the same age (the "early read").
alter table public.post_performance add column if not exists reach_24h integer;
alter table public.post_performance add column if not exists interactions_24h integer;
alter table public.post_performance add column if not exists snapshot_24h_at timestamptz;
