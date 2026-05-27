ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS cron_active boolean DEFAULT true;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS plan_override text
CHECK (plan_override IN ('free', 'starter', 'pro', 'label'));
