-- Onboarding "where are you starting?" answers. They set the starting weekly
-- target and the day each artist's week starts, and shape generated ideas.

alter table public.profiles
  add column if not exists posting_confidence text
    check (posting_confidence in ('hard', 'getting_there', 'comfortable'));

alter table public.profiles
  add column if not exists current_posting text
    check (current_posting in ('rarely', 'weekly', 'few_times', 'most_days'));

-- Days they usually have time to make content, 0 = Sunday ... 6 = Saturday.
alter table public.profiles
  add column if not exists content_days smallint[] not null default '{}';

alter table public.profiles
  add column if not exists tone_tag text;

-- Whatever they typed into "anything coming up?", kept as written even when
-- dates were pulled out of it, so nothing they said is lost.
alter table public.profiles
  add column if not exists coming_up_note text;
