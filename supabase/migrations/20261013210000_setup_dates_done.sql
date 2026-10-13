-- Admin setup checklist: the Dates step counts as done once a tour page or
-- a date is added, or when it's skipped (this flag).
alter table public.profiles add column if not exists setup_dates_done boolean not null default false;
