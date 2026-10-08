-- Link to the post on Instagram, so the board can link a verified post.
alter table public.post_performance add column if not exists permalink text;
