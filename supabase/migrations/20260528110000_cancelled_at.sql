ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
