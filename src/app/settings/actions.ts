"use server";

import { createClient } from "@/utils/supabase/server";
import { ACTIVE_ARTIST_COOKIE } from "@/lib/active-artist";
import { GENRES } from "@/app/onboarding/genres";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type AddArtistState = { error?: string } | null;

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

  redirect("/dashboard");
}
