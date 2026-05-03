import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { getActiveArtistIdForUser } from "@/lib/active-artist";
import { getMondayDateString } from "@/lib/week";
import { parseIdeasJson } from "@/lib/parse-ideas-json";
import { NextResponse } from "next/server";
import { canDo, normalizePlan } from "@/lib/plan-limits";
import { userIsAdmin } from "@/lib/is-admin";

const SYSTEM_PROMPT = `You are a creative content strategist who deeply understands music culture. You write like a human, not like a marketing bot.

You have access to a real Instagram audit for this artist. Your content ideas MUST directly address what the audit identified as their core problem and opportunity. If the audit says they need more music-first content, suggest music-first ideas. If it says they're too retrospective, suggest forward-looking content. Make the connection explicit in the 'why' field — reference the audit insight that inspired each idea.`;

function firstSentence(text: string): string {
  const t = String(text ?? "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  const match = t.match(/^(.+?[.!?])(\s|$)/);
  return (match?.[1] ?? t).trim();
}

function extractOpportunitySection(fullAnalysis: string): string {
  const text = String(fullAnalysis ?? "").trim();
  if (!text) return "";

  const match = text.match(
    /\*\*\s*OPPORTUNITY\s*\*\*\s*([\s\S]*?)(?=\n\s*\*\*\s*[A-Z][A-Z _-]{2,}\s*\*\*|\s*$)/i
  );
  return String(match?.[1] ?? "").trim();
}

function optionalBodyString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

export async function POST(request: Request) {
  let vibe = "";
  let avoid = "";
  let focus = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    vibe = optionalBodyString(body.vibe);
    avoid = optionalBodyString(body.avoid);
    focus = optionalBodyString(body.focus);
  } catch {
    /* no JSON body or invalid JSON — optional inputs stay empty */
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = await userIsAdmin(supabase, user.id);

  const { data: planRow, error: planError } = await supabase
    .from("profiles")
    .select("plan")
    .eq("owner_user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (planError) {
    return NextResponse.json(
      { error: "Failed to load plan", details: planError.message },
      { status: 500 }
    );
  }

  const plan = normalizePlan(planRow?.plan);
  if (!canDo(plan, "canGeneratePlan", isAdmin)) {
    return NextResponse.json(
      { error: "Upgrade required", details: "Upgrade to generate your weekly plan." },
      { status: 403 }
    );
  }

  const cookieStore = await cookies();
  const activeArtistId = await getActiveArtistIdForUser(
    supabase,
    user.id,
    cookieStore
  );

  if (!activeArtistId) {
    return NextResponse.json(
      { error: "No active artist. Complete onboarding first." },
      { status: 400 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("artist_name, genre, sound_description, similar_artists")
    .eq("id", activeArtistId)
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

  const { data: audit, error: auditError } = await supabase
    .from("audits")
    .select(
      "instagram_handle, followers, bio, ai_pattern_analysis, ai_full_analysis, recent_posts_raw, created_at"
    )
    .eq("artist_id", activeArtistId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (auditError) {
    return NextResponse.json(
      { error: "Failed to load audit", details: auditError.message },
      { status: 500 }
    );
  }

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("title, event_date, event_type, notes")
    .eq("artist_id", activeArtistId)
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

  const coreProblemFromAudit = audit?.ai_pattern_analysis
    ? firstSentence(String(audit.ai_pattern_analysis))
    : "";
  const opportunityFromAudit = audit?.ai_full_analysis
    ? extractOpportunitySection(String(audit.ai_full_analysis))
    : "";

  const artistInputLines: string[] = [];
  if (vibe) artistInputLines.push(`- Vibe: ${vibe}`);
  if (avoid) artistInputLines.push(`- Avoid: ${avoid}`);
  if (focus) artistInputLines.push(`- Focus: ${focus}`);
  const artistInputSection =
    artistInputLines.length > 0
      ? `## Artist's input for this week
${artistInputLines.join("\n")}

`
      : "";

  const auditSection = audit
    ? `## INSTAGRAM AUDIT DATA
- **Handle:** @${String(audit.instagram_handle ?? "").replace(/^@/, "")}
- **Followers:** ${Number(audit.followers ?? 0).toLocaleString()}
- **Bio:** ${String(audit.bio ?? "").trim() || "—"}

### Pattern analysis
${String(audit.ai_pattern_analysis ?? "").trim()}

### Full analysis
${String(audit.ai_full_analysis ?? "").trim()}

### Recent posts (raw)
${String(audit.recent_posts_raw ?? "")
  .trim()
  .slice(0, 500)}${String(audit.recent_posts_raw ?? "").trim().length > 500 ? "…" : ""}
`
    : `## INSTAGRAM AUDIT DATA
No audit available yet.`;

  const prompt = `## Artist
- **Name:** ${artistName}
- **Genre:** ${profile.genre ?? "unspecified"}
- **Sound / how they describe themselves:** ${profile.sound_description?.trim() || "not specified"}
- **Similar artists (for tone and reference):** ${profile.similar_artists?.trim() || "none listed"}

${auditSection}

## Audit synthesis you must use
- CORE PROBLEM from audit: ${coreProblemFromAudit || "—"}
- OPPORTUNITY from audit: ${opportunityFromAudit || "—"}

## Their calendar (all saved dates, earliest first)
${eventsSummary}

${artistInputSection}## What you must produce
Give **exactly 5** content ideas that feel personal, specific, and tied to what is actually happening in this artist's world — their sound, references, the dates above, and the Instagram audit data (if present). No filler, no one-size-fits-all tips.

Each idea's **caption** must naturally mention **${artistName}** by name **or** clearly reference something specific to them (a release, show, collaboration, or detail from their profile/dates) so it could not be swapped onto another act.

The ideas should directly address what the audit says is missing and amplify what's already working. Reference the audit's language and specifics, not generic social advice.

Use the CORE PROBLEM and OPPORTUNITY above to shape at least **3 of the 5** ideas directly.

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
    .eq("artist_id", activeArtistId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("weekly_plans")
      .update({ ideas, created_at: new Date().toISOString() })
      .eq("id", existing.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to save plan", details: updateError.message },
        { status: 500 }
      );
    }
  } else {
    const { error: insertError } = await supabase.from("weekly_plans").insert({
      artist_id: activeArtistId,
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
