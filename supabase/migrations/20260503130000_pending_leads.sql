CREATE TABLE IF NOT EXISTS public.pending_leads (
  id uuid DEFAULT gen_random_uuid () PRIMARY KEY,
  email text,
  instagram_handle text,
  artist_name text,
  apify_posts_run_id text,
  apify_profile_run_id text,
  status text DEFAULT 'processing',
  created_at timestamptz DEFAULT now ()
);

ALTER TABLE public.pending_leads ENABLE ROW LEVEL SECURITY;
