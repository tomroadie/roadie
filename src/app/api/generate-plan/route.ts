import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/utils/supabase/server";
import { getMondayDateString } from "@/lib/week";
import { parseIdeasJson } from "@/lib/parse-ideas-json";
import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are a creative content strategist who deeply understands music culture. You write like a human, not like a marketing bot. Avoid generic advice. Every idea should feel like it was written specifically for this artist.`;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("artist_name, genre, sound_description, similar_artists")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: "Failed to load profile", details: profileError.message },
      { status: 500 }
    );
  }

  if (!profile?.artist_name?.trim()) {
    return NextResponse.json(
      { error: "Complete onboarding before generating a plan." },
      { status: 400 }
    );
  }

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("title, event_date, event_type, notes")
    .eq("user_id", user.id)
    .order("event_date", { ascending: true });

  if (eventsError) {
    return NextResponse.json(
      { error: "Failed to load events", details: eventsError.message },
      { status: 500 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing ANTHROPIC_API_KEY" },
      { status: 500 }
    );
  }

  const eventsSummary =
    events && events.length > 0
      ? events
          .map(
            (e) =>
              `- ${e.event_date}: ${e.title}${e.event_type ? ` (${e.event_type})` : ""}${e.notes ? ` — Notes: ${e.notes}` : ""}`
          )
          .join("\n")
      : "No dates saved yet — suggest ideas that still feel grounded in their voice and world.";

  const artistName = profile.artist_name.trim();

  const prompt = `## Artist
- **Name:** ${artistName}
- **Genre:** ${profile.genre ?? "unspecified"}
- **Sound / how they describe themselves:** ${profile.sound_description?.trim() || "not specified"}
- **Similar artists (for tone and reference):** ${profile.similar_artists?.trim() || "none listed"}

## Their calendar (all saved dates, earliest first)
${eventsSummary}

## What you must produce
Give **exactly 5** content ideas that feel personal, specific, and tied to what is actually happening in this artist's world — their sound, references, and the dates above. No filler, no one-size-fits-all tips.

Each idea's **caption** must naturally mention **${artistName}** by name **or** clearly reference something specific to them (a release, show, collaboration, or detail from their profile/dates) so it could not be swapped onto another act.

Respond with **ONLY** valid JSON: a JSON array of exactly 5 objects. Each object must have these string fields:
- **format** — e.g. Reel, Carousel, Story thread, Short video
- **hook** — sharp, specific angle (not generic)
- **caption** — short draft caption or voice-note script; must include "${artistName}" or unmistakable personal context as above
- **why** — one or two sentences on why this fits *this* artist right now
- **timing** — when to post or how it ties to a date or momentum moment

No markdown fences, no commentary outside the JSON array.`;

  const anthropic = new Anthropic({ apiKey });

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return NextResponse.json(
      { error: "Unexpected model response shape" },
      { status: 502 }
    );
  }

  let ideas;
  try {
    ideas = parseIdeasJson(textBlock.text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid JSON from model";
    return NextResponse.json(
      { error: "Failed to parse AI response", details: msg },
      { status: 502 }
    );
  }

  const weekStart = getMondayDateString();

  const { data: existing } = await supabase
    .from("weekly_plans")
    .select("id")
    .eq("user_id", user.id)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("weekly_plans")
      .update({ ideas })
      .eq("id", existing.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to save plan", details: updateError.message },
        { status: 500 }
      );
    }
  } else {
    const { error: insertError } = await supabase.from("weekly_plans").insert({
      user_id: user.id,
      week_start: weekStart,
      ideas,
    });

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to save plan", details: insertError.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ideas });
}
