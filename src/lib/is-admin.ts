import type { SupabaseClient } from "@supabase/supabase-js";

export async function userIsAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("owner_user_id", userId)
    .eq("is_admin", true)
    .limit(1)
    .maybeSingle();

  if (error) return false;
  return !!data;
}
