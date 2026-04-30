import type { SupabaseClient } from "@supabase/supabase-js";

export async function userIsAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .or(`owner_user_id.eq.${userId},id.eq.${userId}`)
    .eq("is_admin", true)
    .limit(1)
    .maybeSingle();

  if (error) return false;
  return !!data;
}
