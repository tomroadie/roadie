"use server";

import { createClient } from "@/utils/supabase/server";
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

  const { error: artistErr } = await supabase.from("artists").upsert(
    { id: user.id, owner_user_id: user.id },
    { onConflict: "id" }
  );

  if (artistErr) {
    return { error: artistErr.message };
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
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
