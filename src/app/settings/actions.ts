"use server";

import { createClient } from "@/utils/supabase/server";
import {
  ACTIVE_ARTIST_COOKIE,
  getActiveArtistIdForUser,
} from "@/lib/active-artist";
import { GENRES } from "@/app/onboarding/genres";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { maxArtistsAllowed, normalizePlan, type RoadiePlan } from "@/lib/plan-limits";
import { userIsAdmin } from "@/lib/is-admin";

export type AddArtistState =
  | { error?: string; upgrade?: { plan: RoadiePlan; maxArtists: number } }
  | null;

export type InstagramHandleState = { error?: string } | null;

export async function updateInstagramHandle(
  _prev: InstagramHandleState,
  formData: FormData
): Promise<InstagramHandleState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const raw = String(formData.get("instagram_handle") ?? "").trim();
  const normalized = raw.replace(/^@/, "").trim() || null;

  const cookieStore = await cookies();
  const activeArtistId = await getActiveArtistIdForUser(
    supabase,
    user.id,
    cookieStore
  );

  if (!activeArtistId) {
    return { error: "No active artist selected." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ instagram_handle: normalized })
    .eq("id", activeArtistId)
    .eq("owner_user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/insights");
  return null;
}

export async function addArtist(
  _prev: AddArtistState,
  formData: FormData
): Promise<AddArtistState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const artistName = String(formData.get("artist_name") ?? "").trim();
  const genre = String(formData.get("genre") ?? "").trim();
  const soundDescription = String(
    formData.get("sound_description") ?? ""
  ).trim();
  const similarArtists = String(formData.get("similar_artists") ?? "").trim();

  if (!artistName || !genre) {
    return { error: "Artist name and genre are required." };
  }

  if (!(GENRES as readonly string[]).includes(genre)) {
    return { error: "Please select a valid genre." };
  }

  const isAdmin = await userIsAdmin(supabase, user.id);

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
  const maxArtists = maxArtistsAllowed(plan, isAdmin);

  const { count: artistCount, error: countError } = await supabase
    .from("artists")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", user.id);

  if (countError) {
    return { error: countError.message };
  }

  if (typeof artistCount === "number" && artistCount >= maxArtists) {
    return {
      error: `You've reached your artist limit on the ${plan} plan.`,
      upgrade: { plan, maxArtists },
    };
  }

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
