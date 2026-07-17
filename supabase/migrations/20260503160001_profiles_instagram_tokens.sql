-- OAuth tokens for Instagram Graph API (Facebook Login).

alter table public.profiles
  add column if not exists instagram_access_token text;

alter table public.profiles
  add column if not exists instagram_user_id text;

alter table public.profiles
  add column if not exists instagram_token_expires_at timestamptz;

comment on column public.profiles.instagram_access_token is
  'Page access token for the Facebook Page linked to the Instagram professional account.';

comment on column public.profiles.instagram_user_id is
  'Instagram professional account id (instagram_business_account id).';

comment on column public.profiles.instagram_token_expires_at is
  'Approximate expiry for the stored token (long-lived tokens are refreshed periodically).';
