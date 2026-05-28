-- Optional thumbs-down feedback reasons per idea hook.
alter table public.weekly_plans
  add column if not exists idea_feedback jsonb default '{}'::jsonb;
