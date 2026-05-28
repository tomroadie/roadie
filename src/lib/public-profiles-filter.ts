/** Supabase .or() filter: profiles visible in customer/cron flows. */
export const PUBLIC_PROFILES_OR_FILTER =
  "is_private.eq.false,is_private.is.null";
