import Anthropic from "@anthropic-ai/sdk";
import { timingSafeEqual } from "crypto";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";
import { getActiveArtistIdForUser } from "@/lib/active-artist";
import { getMondayDateString } from "@/lib/week";
import { parseIdeasJson } from "@/lib/parse-ideas-json";
import { NextResponse } from "next/server";
import { canDo, normalizePlan } from "@/lib/plan-limits";
import { userIsAdmin } from "@/lib/is-admin";
import { trackUsage } from "@/lib/track-usage";

const SYSTEM_PROMPT = `You are a creative content strategist who deeply understands music culture. You write like a human, not like a marketing bot.

You have access to a real Instagram audit for this artist. Your content ideas MUST directly address what the audit identified as their core problem and opportunity. If the audit says they need more music-first content, suggest music-first ideas. If it says they're too retrospective, suggest forward-looking content. Make the connection explicit in the 'why' field — reference the audit insight that inspired each idea.

CRITICAL — Voice matching: Before writing any caption, analyse the artist's actual post captions in the audit data. Identify: (1) sentence length — do they write in short punchy lines or longer flowing sentences? (2) emoji usage — how many and which type? (3) case style — lowercase casual or proper? (4) personality — dry wit, earnest, hype, vulnerable? (5) specific phrases or words they repeat. Then write every caption as if you ARE that artist, not as if you're writing FOR them. A music industry professional reading the caption should not be able to tell it was AI-written.`;

function firstSentence(text: string): string {
  const t = String(text ?? "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  const match = t.match(/^(.+?[.!?])(\s|$)/);
  return (match?.[1] ?? t).trim();
}

function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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

function verifyWebhookSecret(headerValue: string | null, secret: string): boolean {
  if (!headerValue || !secret) return false;
  const a = Buffer.from(headerValue, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const ARTIST_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getPostingSchedule(frequency: string): string {
  if (frequency === "weekly") return "Mon, Thu";
  if (frequency === "active") return "Mon, Tue, Wed, Thu, Fri, Sat, Sun";
  return "Mon, Wed, Fri, Sat"; // regular default
}

function truncateForPlanCaption(text: string, max: number): string {
  const t = String(text ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!t) return "(no caption)";
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

type PlanInstagramPostLine = {
  captionSnippet: string;
  likes: number;
  comments: number;
  engagementRateLabel: string;
};

function parseInstagramMediaForPlan(
  mediaPayload: unknown,
  followerCount: unknown
): PlanInstagramPostLine[] {
  const followersNum = Number(followerCount);
  const followers =
    Number.isFinite(followersNum) && followersNum > 0 ? followersNum : 0;

  const rawMedia = mediaPayload;
  const list =
    rawMedia &&
    typeof rawMedia === "object" &&
    Array.isArray((rawMedia as { data?: unknown }).data)
      ? ((rawMedia as { data: Record<string, unknown>[] }).data ?? [])
      : [];

  const sorted = [...list].sort((a, b) => {
    const ta =
      typeof a.timestamp === "string"
        ? new Date(a.timestamp).getTime()
        : 0;
    const tb =
      typeof b.timestamp === "string"
        ? new Date(b.timestamp).getTime()
        : 0;
    return tb - ta;
  });

  return sorted.slice(0, 10).map((item) => {
    const caption = typeof item.caption === "string" ? item.caption : "";
    const likes = typeof item.like_count === "number" ? item.like_count : 0;
    const comments =
      typeof item.comments_count === "number" ? item.comments_count : 0;
    const engagementRateLabel =
      followers > 0
        ? `${(((likes + comments) / followers) * 100).toFixed(2)}%`
        : "—";

    return {
      captionSnippet: truncateForPlanCaption(caption, 80),
      likes,
      comments,
      engagementRateLabel,
    };
  });
}

function formatInstagramLivePromptSection(
  posts: PlanInstagramPostLine[]
): string {
  const lines = posts.map(
    (p, i) =>
      `${i + 1}. ${p.captionSnippet} — Likes: ${p.likes.toLocaleString()} — Comments: ${p.comments.toLocaleString()} — Engagement rate: ${p.engagementRateLabel}`
  );

  return `## Live Instagram performance (last 10 posts)

Use this live data to identify what content formats and topics are actually performing for this artist right now. Reference specific posts that worked well when suggesting similar ideas.

${lines.join("\n")}
`;
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

  const internalArtistIdRaw = request.headers.get("x-internal-artist-id")?.trim() ?? "";
  const internalSecretHeader = request.headers.get("x-webhook-secret");
  const webhookSecretEnv = process.env.WEBHOOK_SECRET ?? "";
  const isInternalPlan =
    internalArtistIdRaw.length > 0 &&
    webhookSecretEnv.length > 0 &&
    verifyWebhookSecret(internalSecretHeader, webhookSecretEnv);

  if (isInternalPlan && !ARTIST_ID_UUID_RE.test(internalArtistIdRaw)) {
    return NextResponse.json({ error: "Invalid artist id" }, { status: 400 });
  }

  const supabase = isInternalPlan
    ? createServiceRoleClient()
    : await createClient();

  let sessionUserId: string | null = null;
  let activeArtistId: string | null = null;

  if (isInternalPlan) {
    activeArtistId = internalArtistIdRaw;
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    sessionUserId = user.id;
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
    activeArtistId = await getActiveArtistIdForUser(supabase, user.id, cookieStore);
  }

  if (!activeArtistId) {
    return NextResponse.json(
      { error: "No active artist. Complete onboarding first." },
      { status: 400 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "artist_name, genre, sound_description, similar_artists, voice_description, instagram_access_token, instagram_user_id, posting_frequency, owner_user_id"
    )
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

  let instagramLiveSection = "";
  const igToken = profile.instagram_access_token?.trim();
  const igUserId = profile.instagram_user_id?.trim();
  if (igToken && igUserId) {
    try {
      const hdrHost =
        request.headers.get("x-forwarded-host") ?? request.headers.get("host");
      const hdrProto = request.headers.get("x-forwarded-proto") ?? "http";
      const fallbackOrigin = hdrHost
        ? `${hdrProto}://${hdrHost}`
        : "http://localhost:3000";
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? fallbackOrigin;

      const statsRes = await fetch(
        `${baseUrl}/api/instagram-stats?artist_id=${encodeURIComponent(activeArtistId)}`,
        {
          headers: { cookie: request.headers.get("cookie") ?? "" },
          cache: "no-store",
        }
      );

      if (statsRes.ok) {
        const statsJson = (await statsRes.json()) as {
          error?: string;
          media?: unknown;
        };
        if (
          statsJson.error !== "not_connected" &&
          statsJson.media !== undefined &&
          statsJson.media !== null
        ) {
          const rows = parseInstagramMediaForPlan(
            statsJson.media,
            audit?.followers
          );
          if (rows.length > 0) {
            instagramLiveSection = formatInstagramLivePromptSection(rows);
          }
        }
      }
    } catch {
      /* skip live Instagram section */
    }
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

  const today = new Date().toISOString().slice(0, 10);
  const in7Days = addDaysISO(today, 7);
  const in14Days = addDaysISO(today, 14);

  const urgentEvents =
    events?.filter(
      (e) => e.event_date >= today && e.event_date <= in7Days
    ) ?? [];
  const upcomingEvents =
    events?.filter(
      (e) => e.event_date > in7Days && e.event_date <= in14Days
    ) ?? [];

  const urgentLines =
    urgentEvents.length > 0
      ? urgentEvents
          .map(
            (e) =>
              `- ${e.event_date}: ${e.title}${e.event_type ? ` (${e.event_type})` : ""}${e.notes ? ` — ${e.notes}` : ""}`
          )
          .join("\n")
      : "None";

  const upcomingLines =
    upcomingEvents.length > 0
      ? upcomingEvents
          .map((e) => `- ${e.event_date}: ${e.title}`)
          .join("\n")
      : "None";

  const eventsCalendarSection = `## URGENT — Events in the next 7 days
${urgentLines}

## Coming up — Next 7-14 days  
${upcomingLines}`;

  const artistName = profile.artist_name.trim();
  const frequency = String(profile.posting_frequency ?? "regular")
    .trim()
    .toLowerCase();

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
  .slice(0, 5000)}${String(audit.recent_posts_raw ?? "").trim().length > 5000 ? "…" : ""}
`
    : `## INSTAGRAM AUDIT DATA
No audit available yet.`;

  const prompt = `## Artist
- **Name:** ${artistName}
- **Genre:** ${profile.genre ?? "unspecified"}
- **Sound / how they describe themselves:** ${profile.sound_description?.trim() || "not specified"}
- **Similar artists (for tone and reference):** ${profile.similar_artists?.trim() || "none listed"}
- **In their own words:** ${profile.voice_description?.trim() || "not provided"}

If 'In their own words' is provided, treat it as the primary voice reference and make captions sound exactly like that person wrote them.

${auditSection}
${instagramLiveSection}

## Audit synthesis you must use
- CORE PROBLEM from audit: ${coreProblemFromAudit || "—"}
- OPPORTUNITY from audit: ${opportunityFromAudit || "—"}

## Posting schedule
This artist wants to post ${frequency === "weekly" ? "1-2x" : frequency === "active" ? "5+x" : "3-4x"} per week.
Suggested posting days this week: ${getPostingSchedule(frequency)}

${eventsCalendarSection}

${artistInputSection}CRITICAL PRIORITY RULE: If there are any URGENT events (within 7 days), at least 3 of the 5 ideas MUST directly serve those events — building hype, driving ticket sales, creating anticipation, or capturing behind-the-scenes content. Do not suggest content about unrelated songs or past work when there is an imminent event. The imminent event IS the content opportunity this week.

## What you must produce
Give **exactly 5** content ideas that feel personal, specific, and tied to what is actually happening in this artist's world — their sound, references, the dates above, and the Instagram audit data (if present). No filler, no one-size-fits-all tips.

Each idea's **caption** must naturally mention **${artistName}** by name **or** clearly reference something specific to them (a release, show, collaboration, or detail from their profile/dates) so it could not be swapped onto another act.

The ideas should directly address what the audit says is missing and amplify what's already working. Reference the audit's language and specifics, not generic social advice.

Use the CORE PROBLEM and OPPORTUNITY above to shape at least **3 of the 5** ideas directly.

Respond with **ONLY** valid JSON: a JSON array of exactly 5 objects. Each object must have these string fields:
- **format** — e.g. Reel, Carousel, Story thread, Short video
- **hook** — sharp, specific angle (not generic)
- **caption** — short draft caption or voice-note script; must include "${artistName}" or unmistakable personal context as above
- **why** — one or two sentences on why this fits *this* artist right now
- **timing** — include a specific suggested posting day from the schedule above (e.g. "Post Monday evening — [reason]") and space the 5 ideas across the week according to that schedule

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

  const usageUserId =
    sessionUserId ??
    (typeof profile.owner_user_id === "string" && profile.owner_user_id.trim()
      ? profile.owner_user_id.trim()
      : null);
  if (usageUserId) {
    await trackUsage({
      supabase,
      userId: usageUserId,
      artistId: activeArtistId,
      eventType: "plan_generated",
      metadata: {
        week_start: weekStart,
        has_audit: !!audit,
        upcoming_events_count: events?.length ?? 0,
      },
    });
  }

  return NextResponse.json({ ideas });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function PATCH(request: Request) {
  let hook = "";
  let rating: string | undefined;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    hook = typeof body.hook === "string" ? body.hook.trim() : "";
    rating = typeof body.rating === "string" ? body.rating.trim() : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!hook) {
    return NextResponse.json({ error: "Expected hook" }, { status: 400 });
  }
  if (rating !== "up" && rating !== "down") {
    return NextResponse.json(
      { error: "Expected rating to be 'up' or 'down'" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const weekStart = getMondayDateString();

  const { data: row, error: fetchError } = await supabase
    .from("weekly_plans")
    .select("id, idea_ratings")
    .eq("artist_id", activeArtistId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      { error: "Failed to load plan", details: fetchError.message },
      { status: 500 }
    );
  }

  if (!row?.id) {
    return NextResponse.json(
      { error: "No weekly plan for this week yet." },
      { status: 404 }
    );
  }

  const prev = isRecord(row.idea_ratings) ? row.idea_ratings : {};
  const next = { ...prev, [hook]: rating } as Record<string, string>;

  const { error: updateError } = await supabase
    .from("weekly_plans")
    .update({ idea_ratings: next })
    .eq("id", row.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to save rating", details: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
