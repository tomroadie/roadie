"use server";

import { createClient } from "@/utils/supabase/server";
import { ACTIVE_ARTIST_COOKIE } from "@/lib/active-artist";
import { cleanInstagramHandle } from "@/lib/new-lead-pipeline";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GENRES } from "./genres";
import { userIsAdmin } from "@/lib/is-admin";
import { parseKeyDates } from "@/lib/key-dates";
import {
  isConfidence,
  isCurrentPosting,
  startingTargetFromAnswers,
  weekStartFromDays,
} from "@/lib/starting-point";

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
  // "Where are you starting?" answers.
  const confidenceRaw = String(formData.get("posting_confidence") ?? "").trim();
  const confidence = isConfidence(confidenceRaw) ? confidenceRaw : null;
  const currentRaw = String(formData.get("current_posting") ?? "").trim();
  const currentPosting = isCurrentPosting(currentRaw) ? currentRaw : null;
  const contentDays = [
    ...new Set(
      formData
        .getAll("content_days")
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    ),
  ];
  const comingUp = String(formData.get("coming_up") ?? "").trim().slice(0, 1000);

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

  // Only fill in an existing artist when that's clearly what's happening:
  // same name (re-running onboarding), the artist "Add artist" just created
  // (passed explicitly), or a selected artist that has no name yet. Anything
  // else is a new artist, so a selected artist is never renamed.
  const targetArtistId = String(formData.get("target_artist_id") ?? "").trim() || null;
  let activeArtistId: string | null = existingProfile?.id ?? null;

  if (!activeArtistId) {
    const candidateId = targetArtistId ?? cookieArtistId;
    if (candidateId) {
      const [{ data: candidate, error: candidateErr }, { data: candidateProfile }] =
        await Promise.all([
          supabase.from("artists").select("id, owner_user_id").eq("id", candidateId).maybeSingle(),
          supabase.from("profiles").select("artist_name").eq("id", candidateId).maybeSingle(),
        ]);
      if (candidateErr) {
        return { error: candidateErr.message };
      }
      const canEdit = Boolean(candidate && (isAdmin || candidate.owner_user_id === user.id));
      const unnamed = !candidateProfile?.artist_name?.trim();
      const explicitlyTargeted = targetArtistId !== null && targetArtistId === candidateId;
      if (canEdit && (explicitlyTargeted || unnamed)) {
        activeArtistId = candidateId;
      }
    }
  }

  if (!activeArtistId) {
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
      posting_confidence: confidence,
      current_posting: currentPosting,
      content_days: contentDays,
      coming_up_note: comingUp || null,
      weekly_target: startingTargetFromAnswers({ confidence, currentPosting }),
      week_start_day: weekStartFromDays(contentDays),
    },
    { onConflict: "id" }
  );

  if (error) {
    return { error: error.message };
  }

  // "Anything coming up?" becomes dated events. The raw text is already
  // saved above, so a failed parse loses nothing.
  if (comingUp) {
    const dates = await parseKeyDates(comingUp);
    if (dates.length > 0) {
      const { error: eventsError } = await supabase.from("events").insert(
        dates.map((d) => ({
          artist_id: activeArtistId,
          user_id: user.id,
          title: d.title,
          event_date: d.date,
          event_type: d.event_type,
          notes: "Added from onboarding",
        }))
      );
      if (eventsError) {
        console.error("onboarding: saving key dates failed", eventsError.message);
      }
    }
  }

  // No audit here: it's built once they connect Instagram (no scraping).

  redirect("/home?registered=true");
}
