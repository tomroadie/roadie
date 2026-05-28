-- Email log — tracks every email sent
CREATE TABLE IF NOT EXISTS public.email_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_type text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  metadata jsonb
);

-- One send per artist + type per UTC day (expression index; table UNIQUE cannot use date_trunc)
CREATE UNIQUE INDEX IF NOT EXISTS email_log_artist_type_day_unique
ON public.email_log (
  artist_id,
  email_type,
  (date_trunc('day', sent_at AT TIME ZONE 'UTC'))
);

CREATE INDEX IF NOT EXISTS email_log_artist_type_idx
ON public.email_log (artist_id, email_type, sent_at DESC);

CREATE INDEX IF NOT EXISTS email_log_user_idx
ON public.email_log (user_id, sent_at DESC);

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS marketing_unsubscribed boolean DEFAULT false;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS all_emails_paused boolean DEFAULT false;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS audit_completed_at timestamptz;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage email log"
ON public.email_log FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own email log"
ON public.email_log FOR SELECT TO public
USING (user_id = auth.uid());
