"use server";

import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { userIsAdmin } from "@/lib/is-admin";
import { ACTIVE_ARTIST_COOKIE } from "@/lib/active-artist";
import { GENRES } from "@/app/onboarding/genres";
import { enqueueNewLead } from "@/lib/new-lead-pipeline";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normalizePlan } from "@/lib/plan-limits";

export type AdminCreateArtistState = { error?: string } | null;

export async function adminSwitchArtist(formData: FormData) {
  const artistId = String(formData.get("artistId") ?? "").trim();
  if (!artistId) {
    redirect("/admin");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!(await userIsAdmin(supabase, user.id))) {
    redirect("/dashboard");
  }

  const { data: row } = await supabase
    .from("artists")
    .select("id")
    .eq("id", artistId)
    .maybeSingle();

  if (!row?.id) {
    redirect("/admin");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ARTIST_COOKIE, artistId, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 400,
    httpOnly: false,
  });

  redirect("/dashboard");
}

export async function adminCreateClientArtist(
  _prev: AdminCreateArtistState,
  formData: FormData
): Promise<AdminCreateArtistState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!(await userIsAdmin(supabase, user.id))) {
    redirect("/dashboard");
  }

  const artistName = String(formData.get("artist_name") ?? "").trim();
  const genre = String(formData.get("genre") ?? "").trim();
  const soundDescription = String(
    formData.get("sound_description") ?? ""
  ).trim();
  const similarArtists = String(formData.get("similar_artists") ?? "").trim();
  const instagramHandle = String(
    formData.get("instagram_handle") ?? ""
  ).trim();

  if (!artistName || !genre) {
    return { error: "Artist name and genre are required." };
  }

  if (!(GENRES as readonly string[]).includes(genre)) {
    return { error: "Please select a valid genre." };
  }

  const { data: planRow, error: planError } = await supabase
    .from("profiles")
    .select("plan")
    .eq("owner_user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (planError) {
    return { error: planError.message };
  }

  const plan = normalizePlan(planRow?.plan);

  const id = crypto.randomUUID();

  const { error: artistError } = await supabase.from("artists").insert({
    id,
    owner_user_id: user.id,
  });

  if (artistError) {
    return { error: artistError.message };
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id,
    owner_user_id: user.id,
    artist_name: artistName,
    plan,
    genre,
    sound_description: soundDescription || null,
    similar_artists: similarArtists || null,
    instagram_handle: instagramHandle.replace(/^@/, "") || null,
    client_managed: true,
  });

  if (profileError) {
    await supabase.from("artists").delete().eq("id", id);
    return { error: profileError.message };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ARTIST_COOKIE, id, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 400,
    httpOnly: false,
  });

  redirect("/onboarding");
}

export async function adminRunAuditForArtist(
  artistId: string
): Promise<{ error?: string }> {
  const trimmed = artistId.trim();
  if (!trimmed) {
    return { error: "Missing artist." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized." };
  }

  if (!(await userIsAdmin(supabase, user.id))) {
    return { error: "Forbidden." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("artist_name, instagram_handle, owner_user_id")
    .eq("id", trimmed)
    .maybeSingle();

  if (profileError) {
    return { error: profileError.message };
  }

  const ig = profile?.instagram_handle?.trim();
  if (!ig) {
    return { error: "This artist has no Instagram handle on file." };
  }

  const artistName = profile?.artist_name?.trim();
  if (!artistName) {
    return { error: "This artist has no name on file." };
  }

  const ownerId = profile?.owner_user_id;
  if (!ownerId) {
    return { error: "Missing owner for this artist." };
  }

  let email: string | undefined;
  try {
    const svc = createServiceRoleClient();
    const { data: authData, error: authErr } =
      await svc.auth.admin.getUserById(ownerId);
    if (authErr) {
      return { error: authErr.message };
    }
    email = authData.user.email ?? undefined;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Auth lookup failed";
    return { error: msg };
  }

  if (!email?.trim()) {
    return { error: "Could not resolve owner email for this artist." };
  }

  try {
    await enqueueNewLead({
      email: email.trim(),
      artist_name: artistName,
      instagram_input: ig,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Audit enqueue failed";
    return { error: msg };
  }

  return {};
}
