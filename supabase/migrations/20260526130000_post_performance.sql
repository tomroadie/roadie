-- Remove audit refresh tracking (no longer needed client-side)
-- Add engagement tracking for Phase 2 prep
CREATE TABLE IF NOT EXISTS public.post_performance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_id uuid REFERENCES public.artists(id),
  instagram_post_id text NOT NULL,
  scraped_at timestamptz DEFAULT now(),
  post_date timestamptz,
  post_type text,
  caption text,
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  views integer,
  engagement_rate numeric(5,2),
  linked_idea_hook text,
  linked_idea_format text,
  week_start date,
  created_at timestamptz DEFAULT now(),
  UNIQUE(artist_id, instagram_post_id)
);

ALTER TABLE public.post_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own post performance"
ON public.post_performance FOR SELECT TO public
USING (
  artist_id IN (
    SELECT id FROM artists WHERE owner_user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage post performance"
ON public.post_performance FOR ALL TO service_role
USING (true) WITH CHECK (true);
