"use server";

import { createClient } from "@/utils/supabase/server";
import { ACTIVE_ARTIST_COOKIE } from "@/lib/active-artist";
import { enqueueNewLead, cleanInstagramHandle } from "@/lib/new-lead-pipeline";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GENRES } from "./genres";
import { userIsAdmin } from "@/lib/is-admin";

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
  const voiceDescription = String(formData.get("voice_description") ?? "").trim();
  const instagramRaw = String(formData.get("instagram_handle") ?? "").trim();
  const instagramHandle = cleanInstagramHandle(instagramRaw);
  const postingFrequencyRaw = String(
    formData.get("posting_frequency") ?? ""
  ).trim();
  const validFrequencies = ["weekly", "regular", "active"];
  const postingFrequency = validFrequencies.includes(postingFrequencyRaw)
    ? postingFrequencyRaw
    : "regular";

  if (!artistName || !genre) {
    return { error: "Artist name and genre are required." };
  }

  if (!(GENRES as readonly string[]).includes(genre)) {
    return { error: "Please select a valid genre." };
  }

  const cookieStore = await cookies();
  const cookieArtistId =
    cookieStore.get(ACTIVE_ARTIST_COOKIE)?.value?.trim() || null;
  const isAdmin = await userIsAdmin(supabase, user.id);

  const { data: existingProfile, error: findProfileErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("owner_user_id", user.id)
    .eq("artist_name", artistName)
    .maybeSingle();

  if (findProfileErr) {
    return { error: findProfileErr.message };
  }

  let activeArtistId: string;

  if (existingProfile?.id) {
    activeArtistId = existingProfile.id;
  } else if (cookieArtistId) {
    const { data: cookieArtist, error: cookieArtistErr } = await supabase
      .from("artists")
      .select("id, owner_user_id")
      .eq("id", cookieArtistId)
      .maybeSingle();

    if (cookieArtistErr) {
      return { error: cookieArtistErr.message };
    }

    if (
      cookieArtist &&
      (isAdmin || cookieArtist.owner_user_id === user.id)
    ) {
      activeArtistId = cookieArtist.id;
    } else {
      activeArtistId = crypto.randomUUID();
      const { error: createArtistErr } = await supabase.from("artists").insert({
        id: activeArtistId,
        owner_user_id: user.id,
      });
      if (createArtistErr) {
        return { error: createArtistErr.message };
      }
    }
  } else {
    activeArtistId = crypto.randomUUID();
    const { error: createArtistErr } = await supabase.from("artists").insert({
      id: activeArtistId,
      owner_user_id: user.id,
    });
    if (createArtistErr) {
      return { error: createArtistErr.message };
    }
  }

  cookieStore.set(ACTIVE_ARTIST_COOKIE, activeArtistId, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 400,
    httpOnly: false,
  });

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
      instagram_handle: instagramHandle,
      voice_description: voiceDescription || null,
      posting_frequency: postingFrequency,
    },
    { onConflict: "id" }
  );

  if (error) {
    return { error: error.message };
  }

  if (instagramHandle && artistName && user.email) {
    try {
      await enqueueNewLead({
        email: user.email,
        artist_name: artistName,
        instagram_input: instagramHandle,
      });
    } catch {
      // Don't block onboarding if audit fails to start
    }
  }

  redirect("/home?registered=true");
}
