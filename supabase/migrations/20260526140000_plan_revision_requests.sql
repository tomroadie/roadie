CREATE TABLE IF NOT EXISTS public.plan_revision_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_id uuid REFERENCES public.artists(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  weekly_plan_id uuid REFERENCES public.weekly_plans(id) ON DELETE SET NULL,
  artist_note text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined')),
  admin_note text,
  actioned_by uuid REFERENCES auth.users(id),
  actioned_at timestamptz,
  artist_acknowledged_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX plan_revision_requests_one_pending_per_week
ON plan_revision_requests (artist_id, week_start)
WHERE status = 'pending';

CREATE INDEX plan_revision_requests_status_idx
ON plan_revision_requests (status, created_at DESC);

CREATE INDEX plan_revision_requests_artist_idx
ON plan_revision_requests (artist_id, week_start DESC);

ALTER TABLE public.plan_revision_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Artists can view own revision requests"
ON plan_revision_requests FOR SELECT TO public
USING (
  artist_id IN (
    SELECT id FROM artists WHERE owner_user_id = auth.uid()
  )
);

CREATE POLICY "Artists can create pending revision requests"
ON plan_revision_requests FOR INSERT TO public
WITH CHECK (
  status = 'pending' AND
  artist_id IN (
    SELECT id FROM artists WHERE owner_user_id = auth.uid()
  )
);

CREATE POLICY "Artists can acknowledge revision outcomes"
ON plan_revision_requests FOR UPDATE TO public
USING (
  artist_id IN (
    SELECT id FROM artists WHERE owner_user_id = auth.uid()
  )
)
WITH CHECK (status = status);

CREATE POLICY "Service role can manage revision requests"
ON plan_revision_requests FOR ALL TO service_role
USING (true) WITH CHECK (true);
