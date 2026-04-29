"use server";

import { createClient } from "@/utils/supabase/server";
import { ACTIVE_ARTIST_COOKIE } from "@/lib/active-artist";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GENRES } from "./genres";

export type OnboardingState = { error?: string } | null;

export async function completeOnboarding(
  _prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
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

  const cookieStore = await cookies();
  let activeArtistId = cookieStore.get(ACTIVE_ARTIST_COOKIE)?.value ?? null;

  if (!activeArtistId) {
    activeArtistId = crypto.randomUUID();
    const { error: createArtistErr } = await supabase.from("artists").insert({
      id: activeArtistId,
      owner_user_id: user.id,
    });
    if (createArtistErr) {
      return { error: createArtistErr.message };
    }
    cookieStore.set(ACTIVE_ARTIST_COOKIE, activeArtistId, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 400,
      httpOnly: false,
    });
  }

  const { data: owned, error: ownedErr } = await supabase
    .from("artists")
    .select("id")
    .eq("id", activeArtistId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (ownedErr) {
    return { error: ownedErr.message };
  }

  if (!owned) {
    return {
      error:
        "That artist profile isn’t available. Pick an artist from the nav or add one in Settings.",
    };
  }

  const { error: artistUpsertErr } = await supabase.from("artists").upsert(
    { id: activeArtistId, owner_user_id: user.id },
    { onConflict: "id" }
  );

  if (artistUpsertErr) {
    return { error: artistUpsertErr.message };
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      id: activeArtistId,
      owner_user_id: user.id,
      artist_name: artistName,
      genre,
      sound_description: soundDescription || null,
      similar_artists: similarArtists || null,
    },
    { onConflict: "id" }
  );

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}
