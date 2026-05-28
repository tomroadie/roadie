import Anthropic from "@anthropic-ai/sdk";
import { timingSafeEqual } from "crypto";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";
import { getActiveArtistIdForUser } from "@/lib/active-artist";
import { getMondayDateString } from "@/lib/week";
import type { ContentIdea } from "@/types/content-plan";
import { NextResponse } from "next/server";
import { canDo, getPlanForGating } from "@/lib/plan-limits";
import { userIsAdmin } from "@/lib/is-admin";
import { trackUsage } from "@/lib/track-usage";
import {
  appBaseUrl,
  buildEmailRecipient,
  everSent,
  formatWeekLabel,
  sendEmail,
} from "@/lib/email";
import {
  firstPlanGeneratedEmail,
  weeklyPlanReadyEmail,
} from "@/lib/email-templates";

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

type PlanConcept = ContentIdea & { variant: string };
type PlanSlot = {
  slot_number: number;
  slot_purpose: string;
  suggested_day: string;
  concepts: PlanConcept[];
};
type PlanSlotsResponse = { slots: PlanSlot[] };

function stripCodeFence(raw: string): string {
  let trimmed = raw.trim();
  trimmed = trimmed.replace(/^```(?:json)?\s*\n?/i, "");
  trimmed = trimmed.replace(/\n?```\s*$/i, "");
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/m.exec(trimmed);
  if (fence) {
    return fence[1].trim();
  }
  return trimmed.trim();
}

function replaceNewlinesInQuotedStrings(text: string): string {
  return text.replace(/"(?:[^"\\]|\\.)*"/g, (match) =>
    match.replace(/\r\n|\n|\r/g, "\\n")
  );
}

function cleanPlanSlotsJsonText(raw: string): string {
  const withoutFences = stripCodeFence(raw);
  return replaceNewlinesInQuotedStrings(withoutFences);
}

function isPlanConcept(value: unknown): value is PlanConcept {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.variant === "string" &&
    typeof o.format === "string" &&
    typeof o.hook === "string" &&
    typeof o.caption === "string" &&
    typeof o.why === "string" &&
    typeof o.timing === "string"
  );
}

function isPlanSlot(value: unknown): value is PlanSlot {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (
    typeof o.slot_number !== "number" ||
    typeof o.slot_purpose !== "string" ||
    typeof o.suggested_day !== "string" ||
    !Array.isArray(o.concepts)
  ) {
    return false;
  }
  return o.concepts.every(isPlanConcept);
}

function parsePlanSlotsJson(text: string): PlanSlotsResponse {
  const cleaned = cleanPlanSlotsJsonText(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse plan slots JSON", {
      error: e instanceof Error ? e.message : String(e),
      raw: text,
      cleaned,
    });
    throw e instanceof Error ? e : new Error("Invalid JSON from model");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Response is not a JSON object");
  }
  const slots = (parsed as Record<string, unknown>).slots;
  if (!Array.isArray(slots)) {
    throw new Error("Response missing slots array");
  }
  const validSlots = slots.filter(isPlanSlot);
  if (validSlots.length !== 5) {
    throw new Error("Expected exactly 5 content slots");
  }
  return { slots: validSlots };
}

function pickSafeIdeasFromSlots(slots: PlanSlot[]): ContentIdea[] {
  const ideas: ContentIdea[] = [];
  for (const slot of slots) {
    const safe =
      slot.concepts.find((c) => c.variant.toLowerCase() === "safe") ??
      slot.concepts[0];
    if (!safe) {
      throw new Error(`Slot ${slot.slot_number} has no concepts`);
    }
    ideas.push({
      format: safe.format,
      hook: safe.hook,
      caption: safe.caption,
      why: safe.why,
      timing: safe.timing,
    });
  }
  return ideas;
}

async function sendResendEmail(args: {
  apiKey: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${args.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: "Tempo <hello@roadie.media>",
      to: [args.to],
      subject: args.subject,
      text: args.text,
      html: args.html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: text || res.statusText };
  }

  return { ok: true };
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

function parseIdeaRatingsFromDb(raw: unknown): Record<string, "up" | "down"> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, "up" | "down"> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === "up" || v === "down") out[k] = v;
  }
  return out;
}

function formatIdeaRatingsPromptSection(
  uplikedHooks: string[],
  dislikedHooks: string[]
): string {
  if (uplikedHooks.length === 0 && dislikedHooks.length === 0) return "";

  const parts: string[] = ["## Artist content feedback (last 4 weeks)", ""];

  if (uplikedHooks.length > 0) {
    parts.push(
      "### Ideas the artist rated positively",
      ...uplikedHooks.map((hook) => `- ${hook}`),
      ""
    );
  }

  if (dislikedHooks.length > 0) {
    parts.push(
      "### Ideas the artist did not want to pursue",
      ...dislikedHooks.map((hook) => `- ${hook}`),
      ""
    );
  }

  parts.push(
    'Do not repeat any concept, format, or angle from the "did not want to pursue" list. Weight the "rated positively" list as signals of what resonates — but do not repeat those ideas directly, use them as directional signals only.'
  );

  return `${parts.join("\n")}\n`;
}

type PostPerformanceRow = {
  post_type: string | null;
  likes: number | null;
  comments: number | null;
  views: number | null;
  engagement_rate: number | null;
  post_date: string | null;
  caption: string | null;
  linked_idea_hook: string | null;
  linked_idea_format: string | null;
};

const POST_PERFORMANCE_TYPES = ["reel", "carousel", "image"] as const;

function postTypeLabel(postType: string): string {
  switch (postType.toLowerCase()) {
    case "reel":
      return "Reels";
    case "carousel":
      return "Carousels";
    case "image":
      return "Images";
    default:
      return postType;
  }
}

function averageEngagementRate(rows: PostPerformanceRow[]): number {
  if (rows.length === 0) return 0;
  const total = rows.reduce(
    (sum, row) => sum + (Number(row.engagement_rate) || 0),
    0
  );
  return Math.round((total / rows.length) * 100) / 100;
}

function formatPostPerformancePromptSection(
  rows: PostPerformanceRow[]
): string {
  const byType = Object.fromEntries(
    POST_PERFORMANCE_TYPES.map((type) => [type, [] as PostPerformanceRow[]])
  ) as Record<(typeof POST_PERFORMANCE_TYPES)[number], PostPerformanceRow[]>;

  for (const row of rows) {
    const type = String(row.post_type ?? "").trim().toLowerCase();
    if (type in byType) {
      byType[type as (typeof POST_PERFORMANCE_TYPES)[number]].push(row);
    }
  }

  const typeStats = POST_PERFORMANCE_TYPES.map((type) => ({
    type,
    count: byType[type].length,
    avg: averageEngagementRate(byType[type]),
  }));

  const rankedTypes = typeStats
    .filter((stat) => stat.count > 0)
    .sort((a, b) => b.avg - a.avg);

  const formatLines = typeStats
    .map((stat) => {
      if (stat.count === 0) {
        return `- ${postTypeLabel(stat.type)}: no posts`;
      }
      return `- ${postTypeLabel(stat.type)}: avg ${stat.avg.toFixed(2)}% engagement (${stat.count} posts)`;
    })
    .join("\n");

  const bestType = rankedTypes[0];

  const last5 = rows.slice(0, 5);
  const posts6to15 = rows.slice(5, 15);
  const avgLast5 = averageEngagementRate(last5);
  const avg6to15 = averageEngagementRate(posts6to15);

  let trendSentence = "Engagement appears stable compared to earlier posts.";
  if (posts6to15.length > 0 && avg6to15 > 0) {
    const pctChange = ((avgLast5 - avg6to15) / avg6to15) * 100;
    if (pctChange <= -20) {
      trendSentence =
        "Recent engagement dip — average engagement on the last 5 posts is more than 20% lower than posts 6–15.";
    } else if (pctChange >= 20) {
      trendSentence =
        "Recent engagement uplift — average engagement on the last 5 posts is more than 20% higher than posts 6–15.";
    }
  } else if (last5.length > 0 && posts6to15.length === 0) {
    trendSentence = "Not enough historical posts to compare recent trend.";
  }

  const topPosts = [...rows]
    .sort(
      (a, b) =>
        (Number(b.engagement_rate) || 0) - (Number(a.engagement_rate) || 0)
    )
    .slice(0, 3);

  const topLines = topPosts
    .map((post, index) => {
      const type = String(post.post_type ?? "unknown");
      const rate = (Number(post.engagement_rate) || 0).toFixed(2);
      const snippet = truncateForPlanCaption(String(post.caption ?? ""), 80);
      return `${index + 1}. ${type} — ${rate}% — "${snippet}"`;
    })
    .join("\n");

  const bestSection = bestType
    ? `### Best performing format
${bestType.type} — lean into this format this week.

`
    : "";

  const linkedPosts = rows
    .filter(
      (row) =>
        String(row.linked_idea_hook ?? "").trim() &&
        (Number(row.engagement_rate) || 0) > 0
    )
    .sort(
      (a, b) =>
        (Number(b.engagement_rate) || 0) - (Number(a.engagement_rate) || 0)
    )
    .slice(0, 5);

  const linkedSection =
    linkedPosts.length > 0
      ? `### What worked from past plans
${linkedPosts
  .map((post) => {
    const hook = String(post.linked_idea_hook ?? "").trim();
    const format = String(post.linked_idea_format ?? "unknown").trim();
    const rate = (Number(post.engagement_rate) || 0).toFixed(2);
    return `- "${hook}" (${format}) → ${rate}% engagement`;
  })
  .join("\n")}

Use the "What worked from past plans" list as strong directional signals. These are ideas from previous Tempo plans that the artist actually posted and that generated measurable engagement. Build on these themes and formats — do not repeat them directly.

`
      : "";

  return `## Post performance history (${rows.length} posts analysed)

### By format
${formatLines}

${bestSection}### Recent trend
${trendSentence}

### Top performing posts (for directional reference)
${topLines}

${linkedSection}Use this data to weight format choices in the plan. If reels are outperforming other formats, more ideas should be reels. If a format is consistently underperforming, deprioritise it unless there is a strong strategic reason.
`;
}

export async function POST(request: Request) {
  let vibe = "";
  let avoid = "";
  let focus = "";
  let forcePendingReview = false;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    vibe = optionalBodyString(body.vibe);
    avoid = optionalBodyString(body.avoid);
    focus = optionalBodyString(body.focus);
    forcePendingReview = body.force_pending_review === "true";
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
      .select("plan, plan_override")
      .eq("owner_user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (planError) {
      return NextResponse.json(
        { error: "Failed to load plan", details: planError.message },
        { status: 500 }
      );
    }

    const plan = getPlanForGating(planRow ?? {});
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
      "artist_name, genre, sound_description, similar_artists, voice_description, instagram_access_token, instagram_user_id, posting_frequency, owner_user_id, is_managed, plan, marketing_unsubscribed, all_emails_paused"
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

  let isManaged = false;
  if (profile.is_managed === true) {
    isManaged = true;
  }
  const treatAsManaged = isManaged || forcePendingReview;

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

  let ideaRatingsSection = "";
  try {
    const { data: recentPlans, error: recentPlansError } = await supabase
      .from("weekly_plans")
      .select("ideas, idea_ratings, week_start, created_at")
      .eq("artist_id", activeArtistId)
      .order("created_at", { ascending: false })
      .limit(4);

    if (recentPlansError) {
      console.error("generate-plan: failed to load idea ratings", {
        artist_id: activeArtistId,
        error: recentPlansError.message,
      });
    } else {
      const uplikedHooks: string[] = [];
      const dislikedHooks: string[] = [];

      for (const plan of recentPlans ?? []) {
        const ratings = parseIdeaRatingsFromDb(plan.idea_ratings);
        for (const [hook, rating] of Object.entries(ratings)) {
          if (rating === "up") uplikedHooks.push(hook);
          else if (rating === "down") dislikedHooks.push(hook);
        }
      }

      ideaRatingsSection = formatIdeaRatingsPromptSection(
        [...new Set(uplikedHooks)],
        [...new Set(dislikedHooks)]
      );
    }
  } catch (e) {
    console.error("generate-plan: idea ratings enrichment failed", {
      artist_id: activeArtistId,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  let postPerformanceSection = "";
  try {
    const { data: performanceRows, error: performanceError } = await supabase
      .from("post_performance")
      .select(
        "post_type, likes, comments, views, engagement_rate, post_date, caption, linked_idea_hook, linked_idea_format"
      )
      .eq("artist_id", activeArtistId)
      .order("post_date", { ascending: false })
      .limit(30);

    if (performanceError) {
      console.error("generate-plan: failed to load post performance", {
        artist_id: activeArtistId,
        error: performanceError.message,
      });
    } else if ((performanceRows ?? []).length > 0) {
      postPerformanceSection = formatPostPerformancePromptSection(
        performanceRows as PostPerformanceRow[]
      );
    }
  } catch (e) {
    console.error("generate-plan: post performance enrichment failed", {
      artist_id: activeArtistId,
      error: e instanceof Error ? e.message : String(e),
    });
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
${ideaRatingsSection}
${postPerformanceSection}
${instagramLiveSection}

## Audit synthesis you must use
- CORE PROBLEM from audit: ${coreProblemFromAudit || "—"}
- OPPORTUNITY from audit: ${opportunityFromAudit || "—"}

## Posting schedule
This artist wants to post ${frequency === "weekly" ? "1-2x" : frequency === "active" ? "5+x" : "3-4x"} per week.
Suggested posting days this week: ${getPostingSchedule(frequency)}

${eventsCalendarSection}

${artistInputSection}CRITICAL PRIORITY RULE: If there are any URGENT events (within 7 days), at least 3 of the 5 slots MUST directly serve those events — building hype, driving ticket sales, creating anticipation, or capturing behind-the-scenes content. Do not suggest content about unrelated songs or past work when there is an imminent event. The imminent event IS the content opportunity this week.

## What you must produce
Produce exactly 5 content slots. Each slot represents a different strategic purpose for the week.

For each slot, produce 3 concept options:
- SAFE: A proven format with predictable engagement. Low effort, reliable results.
- CREATIVE: An interesting angle that requires some thought and effort. Higher upside than safe.
- BOLD: Unconventional approach. Might not suit every artist but highest potential impact.

The 3 concepts within each slot should serve the same strategic purpose but via meaningfully different approaches — different formats, different angles, different emotional registers.

Each concept's **caption** must naturally mention **${artistName}** by name **or** clearly reference something specific to them (a release, show, collaboration, or detail from their profile/dates) so it could not be swapped onto another act.

The slots should directly address what the audit says is missing and amplify what's already working. Reference the audit's language and specifics, not generic social advice.

Use the CORE PROBLEM and OPPORTUNITY above to shape at least **3 of the 5** slots directly.

CAPTION STYLE: Do not include hashtags in any captions or caption suggestions. In 2026, hashtags on Instagram have minimal impact on reach and make captions feel generic and spammy. Write captions that sound natural and human — the algorithm rewards content quality and engagement, not hashtag volume.

Respond with ONLY valid JSON in this exact structure:
{
  "slots": [
    {
      "slot_number": 1,
      "slot_purpose": "brief description of what this slot achieves this week",
      "suggested_day": "Monday",
      "concepts": [
        {
          "variant": "safe",
          "format": "...",
          "hook": "...",
          "caption": "...",
          "why": "...",
          "timing": "..."
        },
        {
          "variant": "creative",
          "format": "...",
          "hook": "...",
          "caption": "...",
          "why": "...",
          "timing": "..."
        },
        {
          "variant": "bold",
          "format": "...",
          "hook": "...",
          "caption": "...",
          "why": "...",
          "timing": "..."
        }
      ]
    }
  ]
}

IMPORTANT: Ensure all JSON string values use \\n for line breaks, never literal newlines. Keep captions concise — under 200 characters each.

No markdown fences, no commentary outside the JSON object.`;

  const anthropic = new Anthropic({ apiKey });

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8192,
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

  let planSlots: PlanSlotsResponse;
  try {
    if (treatAsManaged) {
      console.error(
        "[generate-plan] raw slots response:",
        textBlock.text.slice(4500, 6500)
      );
    }
    planSlots = parsePlanSlotsJson(textBlock.text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid JSON from model";
    return NextResponse.json(
      { error: "Failed to parse AI response", details: msg },
      { status: 502 }
    );
  }

  const weekStart = getMondayDateString();
  const nowIso = new Date().toISOString();

  const planPayload = treatAsManaged
    ? {
        concepts: planSlots,
        status: "pending_review" as const,
        ideas: null,
        created_at: nowIso,
      }
    : {
        ideas: pickSafeIdeasFromSlots(planSlots.slots),
        status: "published" as const,
        created_at: nowIso,
      };

  const { data: existing } = await supabase
    .from("weekly_plans")
    .select("id")
    .eq("artist_id", activeArtistId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("weekly_plans")
      .update({ ...planPayload, week_start: weekStart })
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
      ...planPayload,
    });

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to save plan", details: insertError.message },
        { status: 500 }
      );
    }
  }

  if (isManaged) {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const hdrHost =
        request.headers.get("x-forwarded-host") ?? request.headers.get("host");
      const hdrProto = request.headers.get("x-forwarded-proto") ?? "http";
      const fallbackOrigin = hdrHost
        ? `${hdrProto}://${hdrHost}`
        : "http://localhost:3000";
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? fallbackOrigin;
      const adminPlansUrl = `${baseUrl}/admin/plans`;

      const emailSend = await sendResendEmail({
        apiKey: resendKey,
        to: "tom@roadie.media",
        subject: `Plan ready to review: ${artistName}`,
        text: `A weekly content plan for ${artistName} is ready for review.\n\nReview it here: ${adminPlansUrl}`,
        html: `<p>A weekly content plan for <strong>${artistName}</strong> is ready for review.</p><p><a href="${adminPlansUrl}">Review plan</a></p>`,
      });

      if (!emailSend.ok) {
        console.error("Resend send failed", {
          artist_id: activeArtistId,
          status: emailSend.status,
          error: emailSend.error,
        });
      }
    }
  }

  const usageUserId =
    sessionUserId ??
    (typeof profile.owner_user_id === "string" && profile.owner_user_id.trim()
      ? profile.owner_user_id.trim()
      : null);

  if (!isManaged && !treatAsManaged) {
    const adminSupabase = isInternalPlan
      ? supabase
      : createServiceRoleClient();
    const recipient = await buildEmailRecipient(adminSupabase, {
      id: activeArtistId,
      owner_user_id: profile.owner_user_id,
      artist_name: profile.artist_name,
      plan: profile.plan,
      marketing_unsubscribed: profile.marketing_unsubscribed,
      all_emails_paused: profile.all_emails_paused,
    });

    if (recipient) {
      const appUrl = appBaseUrl();
      const planValue = String(profile.plan ?? "free").trim();
      const isPaid = planValue !== "free";
      const isFirstPlan = !(await everSent(
        activeArtistId,
        "first_plan_generated"
      ));

      if (isFirstPlan && isPaid) {
        const email = firstPlanGeneratedEmail({
          artistId: activeArtistId,
          artistName: recipient.artistName,
          appUrl,
        });
        await sendEmail({
          to: recipient.email,
          subject: email.subject,
          html: email.html,
          recipient,
          type: "first_plan_generated",
        });
      } else if (!sessionUserId && usageUserId) {
        const today = new Date().toISOString().slice(0, 10);
        const { count } = await adminSupabase
          .from("usage_events")
          .select("id", { count: "exact", head: true })
          .eq("user_id", usageUserId)
          .gte("created_at", `${today}T00:00:00Z`);

        if ((count ?? 0) === 0) {
          const email = weeklyPlanReadyEmail({
            artistId: activeArtistId,
            artistName: recipient.artistName,
            weekLabel: formatWeekLabel(weekStart),
            appUrl,
          });
          await sendEmail({
            to: recipient.email,
            subject: email.subject,
            html: email.html,
            recipient,
            type: "weekly_plan_ready",
          });
        }
      }
    }
  }

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

  if (treatAsManaged) {
    return NextResponse.json({
      concepts: planSlots,
      status: "pending_review",
    });
  }

  return NextResponse.json({ ideas: planPayload.ideas });
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
