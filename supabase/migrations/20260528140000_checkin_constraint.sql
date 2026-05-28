alter table public.weekly_checkins
  add constraint weekly_checkins_artist_week_unique
  unique (artist_id, week_start);
