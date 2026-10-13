-- A drafted week can be held from Admin, so it doesn't publish itself after
-- the review window while it's being fixed.
alter table public.concept_generations add column if not exists held boolean not null default false;
