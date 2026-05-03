-- Per-idea thumbs feedback for weekly plan hooks (merged by hook string key).
alter table public.weekly_plans
  add column if not exists idea_ratings jsonb not null default '{}'::jsonb;
