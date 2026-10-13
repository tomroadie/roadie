"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { userIsAdmin } from "@/lib/is-admin";
import { ACTIVE_ARTIST_COOKIE } from "@/lib/active-artist";

/** Opens one of the roster's artists: makes them the active artist and goes to their Home. */
export async function openRosterArtist(formData: FormData) {
  const artistId = String(formData.get("artistId") ?? "").trim();
  const rosterId = String(formData.get("rosterId") ?? "").trim();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createServiceRoleClient();
  const [isAdmin, { data: member }, { data: link }] = await Promise.all([
    userIsAdmin(supabase, user.id),
    admin.from("roster_members").select("user_id").eq("roster_id", rosterId).eq("user_id", user.id).maybeSingle(),
    admin.from("roster_artists").select("artist_id").eq("roster_id", rosterId).eq("artist_id", artistId).maybeSingle(),
  ]);
  if (!link || (!isAdmin && !member)) redirect("/roster");

  (await cookies()).set(ACTIVE_ARTIST_COOKIE, artistId, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 400,
    httpOnly: false,
  });
  redirect("/home");
}

/** Admin: take one artist off a roster, straight from its row. */
export async function removeFromRoster(formData: FormData) {
  const artistId = String(formData.get("artistId") ?? "").trim();
  const rosterId = String(formData.get("rosterId") ?? "").trim();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await userIsAdmin(supabase, user.id))) redirect("/roster");
  await createServiceRoleClient().from("roster_artists").delete().eq("roster_id", rosterId).eq("artist_id", artistId);
  redirect(`/roster?id=${rosterId}`);
}
