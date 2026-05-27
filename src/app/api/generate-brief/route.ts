import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/utils/supabase/server";
import { userIsAdmin } from "@/lib/is-admin";
import { NextResponse } from "next/server";

type CallBrief = {
  situation: string;
  instagram_health: string;
  biggest_opportunity: string;
  roadie_fit: {
    primary_service: "release_support" | "tour_support" | "content_social" | "all_three";
    reasoning: string;
    suggested_plan: "starter" | "pro" | "label";
    plan_reasoning: string;
  };
  talking_points: string[];
  suggested_questions: string[];
  red_flags: string[];
  one_liner: string;
};

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/m.exec(trimmed);
  if (fence) {
    return fence[1].trim();
  }
  return trimmed;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isCallBrief(value: unknown): value is CallBrief {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  const roadieFit = o.roadie_fit;
  if (!roadieFit || typeof roadieFit !== "object") return false;
  const rf = roadieFit as Record<string, unknown>;

  const primaryService = rf.primary_service;
  const suggestedPlan = rf.suggested_plan;

  return (
    typeof o.situation === "string" &&
    typeof o.instagram_health === "string" &&
    typeof o.biggest_opportunity === "string" &&
    typeof rf.reasoning === "string" &&
    typeof rf.plan_reasoning === "string" &&
    typeof o.one_liner === "string" &&
    (primaryService === "release_support" ||
      primaryService === "tour_support" ||
      primaryService === "content_social" ||
      primaryService === "all_three") &&
    (suggestedPlan === "starter" ||
      suggestedPlan === "pro" ||
      suggestedPlan === "label") &&
    isStringArray(o.talking_points) &&
    isStringArray(o.suggested_questions) &&
    isStringArray(o.red_flags)
  );
}

function parseCallBriefJson(text: string): CallBrief {
  const inner = stripCodeFence(text);
  const parsed: unknown = JSON.parse(inner);
  if (!isCallBrief(parsed)) {
    throw new Error("Response is not a valid call brief object");
  }
  return parsed;
}

function formatEventsSummary(
  events: Array<{
    title: string;
    event_date: string;
    event_type: string | null;
    notes: string | null;
  }>
): string {
  if (events.length === 0) return "None scheduled";

  return events
    .map((e) => {
      const type = e.event_type?.trim();
      const notes = e.notes?.trim();
      let line = `- ${e.event_date}: ${e.title}`;
      if (type) line += ` (${type})`;
      if (notes) line += ` — ${notes}`;
      return line;
    })
    .join("\n");
}

export async function POST(request: Request) {
  let artistId = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    artistId = asTrimmedString(body.artist_id);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!artistId) {
    return NextResponse.json({ error: "Missing artist_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await userIsAdmin(supabase, user.id);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "artist_name, genre, instagram_handle, sound_description, similar_artists, voice_description"
    )
    .eq("id", artistId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: "Failed to load profile", details: profileError.message },
      { status: 500 }
    );
  }

  if (!profile) {
    return NextResponse.json({ error: "Artist not found" }, { status: 404 });
  }

  const { data: audit, error: auditError } = await supabase
    .from("audits")
    .select(
      "followers, following, post_count, bio, ai_pattern_analysis, ai_full_analysis, recent_posts_raw, created_at, instagram_handle"
    )
    .eq("artist_id", artistId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (auditError) {
    return NextResponse.json(
      { error: "Failed to load audit", details: auditError.message },
      { status: 500 }
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("title, event_date, event_type, notes")
    .eq("artist_id", artistId)
    .gte("event_date", today)
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

  const artistName = profile.artist_name?.trim() || "Unknown artist";
  const genre = profile.genre?.trim() || "unspecified";
  const handle = (
    profile.instagram_handle?.trim() ||
    audit?.instagram_handle?.trim() ||
    "unknown"
  ).replace(/^@/, "");
  const followers = Number(audit?.followers ?? 0).toLocaleString();
  const bio = audit?.bio?.trim() || "—";
  const soundDescription = profile.sound_description?.trim() || "not specified";
  const similarArtists = profile.similar_artists?.trim() || "none listed";
  const aiFullAnalysis = audit?.ai_full_analysis?.trim() || "No audit available yet.";
  const eventsSummary = formatEventsSummary(events ?? []);

  const prompt = `You are a music industry consultant preparing a client call brief for Tempo — an AI content planning tool that helps artists with release support, tour support, and content/social media strategy.

Your job is to analyse this artist's Instagram presence and create a concise, actionable call brief that helps identify which Tempo services would benefit them most.

Artist: ${artistName}
Genre: ${genre}
Instagram: @${handle}
Followers: ${followers}
Bio: ${bio}
Sound: ${soundDescription}
Similar artists: ${similarArtists}

Instagram audit analysis:
${aiFullAnalysis}

Upcoming events:
${eventsSummary}

Produce a call brief with exactly these sections in JSON format:
{
  "situation": "2-3 sentences on where this artist is right now — career stage, momentum, what's happening",
  "instagram_health": "2-3 sentences on the state of their Instagram — what's working, what isn't, key numbers",
  "biggest_opportunity": "1-2 sentences on the single most impactful thing Tempo could help with right now",
  "roadie_fit": {
    "primary_service": "release_support | tour_support | content_social | all_three",
    "reasoning": "2-3 sentences on why this service mix fits them right now",
    "suggested_plan": "starter | pro | label",
    "plan_reasoning": "1 sentence on why this plan tier fits"
  },
  "talking_points": ["5-7 specific talking points for the call — things to bring up, observations to share, hooks to get them interested"],
  "suggested_questions": ["5-7 questions to ask them on the call — focused on understanding their goals, upcoming activity, and pain points around content"],
  "red_flags": ["any concerns or objections they might have — address these proactively"],
  "one_liner": "A single sentence you could use to open the conversation that shows you've done your homework"
}

Return ONLY valid JSON, no markdown fences.`;

  const anthropic = new Anthropic({ apiKey });

  let message;
  try {
    message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Claude request failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return NextResponse.json(
      { error: "Unexpected model response shape" },
      { status: 502 }
    );
  }

  let brief: CallBrief;
  try {
    brief = parseCallBriefJson(textBlock.text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid JSON from model";
    return NextResponse.json(
      { error: "Failed to parse AI response", details: msg },
      { status: 502 }
    );
  }

  return NextResponse.json(brief);
}
