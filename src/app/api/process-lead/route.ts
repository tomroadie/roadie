import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { trackUsage } from "@/lib/track-usage";
import {
  generateAuditEmail,
  generateAuditEmailPlainText,
  getAuditEmailSubject,
} from "@/lib/emails/generate-audit-email";

function verifyWebhookSecret(headerValue: string | null, secret: string): boolean {
  if (!headerValue || !secret) return false;
  const a = Buffer.from(headerValue, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function asString(x: unknown): string {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}

function asNumberOrNull(x: unknown): number | null {
  const n = typeof x === "number" ? x : typeof x === "string" ? Number(x) : NaN;
  return Number.isFinite(n) ? n : null;
}

type PendingLeadRow = {
  id: string;
  email: string | null;
  instagram_handle: string | null;
  artist_name: string | null;
  apify_posts_run_id: string | null;
  apify_profile_run_id: string | null;
  status: string | null;
  is_research: boolean | null;
};

type ApifyProfileItem = {
  username?: unknown;
  biography?: unknown;
  followersCount?: unknown;
  followsCount?: unknown;
  postsCount?: unknown;
};

type ApifyPostItem = {
  type?: unknown;
  timestamp?: unknown;
  videoViewCount?: unknown;
  likesCount?: unknown;
  commentsCount?: unknown;
  caption?: unknown;
};

type ApifyActorRun = {
  data?: {
    status?: unknown;
  };
};

function firstSentence(text: string): string {
  const t = String(text ?? "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  const match = t.match(/^(.+?[.!?])(\s|$)/);
  return (match?.[1] ?? t).trim();
}

async function fetchApifyDatasetItems<T>(
  url: string,
  init?: RequestInit
): Promise<{ ok: true; items: T[] } | { ok: false; error: string; status: number }> {
  const res = await fetch(url, { method: "GET", ...init });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      error: `Apify fetch error ${res.status}: ${text || res.statusText}`,
    };
  }
  const json = (await res.json()) as unknown;
  return { ok: true, items: Array.isArray(json) ? (json as T[]) : [] };
}

async function fetchApifyRunStatus(
  url: string
): Promise<{ ok: true; status: string } | { ok: false; error: string; status: number }> {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      error: `Apify run status error ${res.status}: ${text || res.statusText}`,
    };
  }
  const json = (await res.json()) as ApifyActorRun;
  const status = asString(json.data?.status).trim();
  return status ? { ok: true, status } : { ok: false, status: 502, error: "Apify run status missing" };
}

function formatProfile(item: ApifyProfileItem, fallbackUsername: string): string {
  const username = asString(item.username).trim() || fallbackUsername;
  const biography = asString(item.biography).trim() || "—";
  const followersCount = asNumberOrNull(item.followersCount);
  const followsCount = asNumberOrNull(item.followsCount);
  const postsCount = asNumberOrNull(item.postsCount);

  return [
    "Profile",
    `Username: ${username || "—"}`,
    `Bio: ${biography}`,
    `Followers: ${followersCount ?? "—"}`,
    `Following: ${followsCount ?? "—"}`,
    `Posts: ${postsCount ?? "—"}`,
  ].join("\n");
}

function formatPosts(items: ApifyPostItem[]): string {
  return items
    .map((p, idx) => {
      const n = idx + 1;
      const type = asString(p.type).trim() || "—";
      const timestamp = asString(p.timestamp).trim() || "—";
      const videoViewCount = asNumberOrNull(p.videoViewCount);
      const likesCount = asNumberOrNull(p.likesCount);
      const commentsCount = asNumberOrNull(p.commentsCount);
      const caption = asString(p.caption).trim() || "—";

      return (
        `Post ${n}\n` +
        `Type: ${type}\n` +
        `Date: ${timestamp}\n` +
        `Views: ${videoViewCount ?? "—"}\n` +
        `Likes: ${likesCount ?? "—"}\n` +
        `Comments: ${commentsCount ?? "—"}\n` +
        `Caption: ${caption}\n\n---\n\n`
      );
    })
    .join("");
}

function buildArtistPattern1Prompt(
  artistName: string,
  formattedProfile: string,
  hasPosts: boolean,
  noPostsNote: string,
  postsRes: { items: ApifyPostItem[] }
): string {
  return `You are a music industry analyst giving a private, honest assessment of an artist's Instagram presence. You have access to their last 30 posts with engagement data.

Your job is to identify the single most surprising or counterintuitive finding in this data — the thing the artist probably doesn't know about their own account.

Rules:
- Lead with a specific number or data point
- Name the tension or gap between what they are doing and what is actually working
- Never say "your identity is clear" or anything generically positive
- Do not list multiple observations — pick the ONE most interesting finding
- Sound like a strategist, not a copywriter
- 2-3 sentences maximum

Bad example:
"Your content shows a strong visual identity with consistent behind-the-scenes content that resonates with your audience."

Good example:
"Your teaser content generated 27 comments while your performance clips averaged 2 — you're accidentally training your audience to engage with announcements rather than your music. The data suggests your fans are more invested in the story around your releases than the releases themselves."

Artist: ${artistName}
Profile: ${formattedProfile}
${noPostsNote}
${hasPosts ? formatPosts(postsRes.items.slice(0, 10)) : ""}

Use specific numbers from the post data. If you cannot find a genuinely surprising finding, find the most significant gap between their highest and lowest performing content and explain what it means.`;
}

function buildArtistFullAnalysisPrompt(
  artistName: string,
  genre: string,
  formattedProfile: string,
  formattedPosts: string,
  noPostsNote: string
): string {
  return `You are a trusted music industry strategist giving a private diagnostic of an artist's Instagram presence. You have their last 30 posts with full engagement data.

Your job is to make the artist feel genuinely understood — and slightly uncomfortable. Not harsh, but honest. The best outcome is the artist reading this and thinking "oh shit, that's exactly what we're doing."

CRITICAL RULES:
- Use specific numbers in every section
- Never reference posts by number — reference by content
- Lead every section with the most interesting finding, not the most obvious one
- Create tension between what they are doing and what is working
- Sound like a strategist having a private conversation, not a report
- No hashtags in any suggestions
- Max 350 words total

TONE CALIBRATION:
Study the artist's actual captions carefully. Note their sentence length, punctuation, emoji usage, lowercase vs proper case, vocabulary, and personality. Every suggestion must sound like it came from them.

Artist: ${artistName}
Genre: ${genre}

${formattedProfile}
${noPostsNote}
${formattedPosts}

Provide analysis with these exact sections:

**POSITIONING**
What makes this artist distinct. Lead with something specific from the data, not a general observation. What do the numbers tell you about how their audience sees them?

**CONTENT PATTERN**
What the data actually shows — not what they think they post, but what they actually post and how it performs. Find the gap between their most and least effective content types. Use numbers.

**ENGAGEMENT REALITY**
The most surprising engagement signal in their data. What is working that they might not realise? What are they over-investing in that underperforms? Be specific.

**BIGGEST MISSED OPPORTUNITY**
The single most important thing they are not doing that their data suggests would work. This should feel like a revelation — something they could act on immediately. Frame it as an opportunity, not a criticism.
End with one sentence that naturally leads to the value of a weekly plan:
e.g. "This is exactly the kind of pattern that shapes every idea in your weekly plan."

**YOUR NEXT MOVE**
2-3 specific content ideas that emerge directly from the data. These should be angles, not formats. Not "post a carousel" but "the story behind [specific thing from their content]." Make these so specific that they could only have been written for this artist.

Be direct. Be specific. Make them feel seen.`;
}

function buildVenuePattern1Prompt(
  formattedProfile: string,
  formattedPosts: string,
  hasPosts: boolean,
  noPostsNote: string,
  postsRes: { items: ApifyPostItem[] }
): string {
  return (
    "You are a live music marketing strategist analysing social media data for a music venue. Below is a structured summary of their profile and recent posts. Your job is to identify the single most important pattern in how they promote shows online.\n\n" +
    "Focus on: how consistently they announce shows, whether ticket links are prominent, whether content varies across the show lifecycle (announce → on-sale → push → urgency), and whether there is a gap between what they post and what would actually sell tickets.\n\n" +
    "Write in a direct, practical tone — like a senior marketing consultant who understands both the venue business and digital advertising.\n\n" +
    "Do not reference posts by number. Reference them by their content (e.g. 'your announcement post for the June show').\n\n" +
    "Return 2-3 sentences maximum. Start with what is working or consistent, then note the most important opportunity.\n\n" +
    `${formattedProfile}${noPostsNote}` +
    (hasPosts ? `\n\n${formatPosts(postsRes.items.slice(0, 10))}` : "")
  );
}

function buildVenueFullAnalysisPrompt(
  venueName: string,
  formattedProfile: string,
  formattedPosts: string,
  noPostsNote: string
): string {
  return `You are a live music marketing strategist giving a private, honest review of a venue's social media presence. Your tone is direct, practical, and commercially focused — like a consultant who understands ticket sales, show promotion, and the operational realities of running a live music venue.

CRITICAL TONE RULES:
- Never imply the venue is failing — frame everything as an opportunity
- Always lead with what IS working
- Be specific — reference actual posts and content patterns observed
- Think in terms of the show promotion lifecycle: announce, on-sale, mid-campaign, final push, show day
- Flag anything that would waste ad spend or undermine ticket sales
- Sound like a strategic review, not a generic social media audit

CONTEXT: This is a music venue, not an artist. Their primary goal is selling tickets to individual shows. Secondary goals are building a loyal local audience and growing their owned data (email list). Instagram and Facebook are promotional channels for their gig calendar, not personal brand building.

CREATIVE STRATEGY: Where recurring shows or club nights are identified, consider what a smart content plan would look like for that specific event. Think about creative angles that go beyond announcements — social proof, atmosphere, audience identity, FOMO. If a recurring show appears to be underperforming or lacks creative variety, suggest a content approach tailored to that night's audience and identity. Every show should have a content arc, not just an announcement post.

Venue: ${venueName}. Below is a structured summary of their social profile and recent posts.${noPostsNote}${formattedProfile}

${formattedPosts}

Provide a strategic analysis with these exact sections:
**SHOW PROMOTION** — how effectively are individual shows being promoted, with specific observations
**CONTENT PATTERN** — what the posting data shows about consistency, format mix, and timing relative to shows
**AUDIENCE & REACH** — what is connecting with their audience and what the engagement data suggests
**CORE OPPORTUNITY** — the single highest-impact change they could make to sell more tickets
**IMMEDIATE ACTIONS** — 3 specific, actionable recommendations a venue marketing manager could action this week. Where relevant, include a suggested content plan outline for a specific upcoming or recurring show, with format and timing recommendations.

Be specific, commercially focused, and actionable. Max 350 words total.`;
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

export async function POST(request: Request) {
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing WEBHOOK_SECRET" },
      { status: 500 }
    );
  }
  const provided = request.headers.get("x-webhook-secret");
  if (!verifyWebhookSecret(provided, webhookSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apifyToken = process.env.APIFY_API_TOKEN;
  if (!apifyToken) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing APIFY_API_TOKEN" },
      { status: 500 }
    );
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing ANTHROPIC_API_KEY" },
      { status: 500 }
    );
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing RESEND_API_KEY" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Expected JSON object body" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const pending_lead_id = o.pending_lead_id;
  if (typeof pending_lead_id !== "string" || !pending_lead_id.trim()) {
    return NextResponse.json({ error: "Invalid or missing pending_lead_id" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { data: pending, error: pendingError } = await supabase
    .from("pending_leads")
    .select(
      "id, email, instagram_handle, artist_name, apify_posts_run_id, apify_profile_run_id, status, is_research"
    )
    .eq("id", pending_lead_id.trim())
    .maybeSingle();

  if (pendingError) {
    return NextResponse.json(
      { error: "Failed to load pending lead", details: pendingError.message },
      { status: 500 }
    );
  }
  if (!pending) {
    return NextResponse.json({ error: "Pending lead not found" }, { status: 404 });
  }

  const lead = pending as PendingLeadRow;
  if (!lead.email?.trim()) {
    return NextResponse.json({ error: "Pending lead missing email" }, { status: 400 });
  }
  if (!lead.instagram_handle?.trim()) {
    return NextResponse.json({ error: "Pending lead missing instagram_handle" }, { status: 400 });
  }
  if (!lead.apify_posts_run_id?.trim() || !lead.apify_profile_run_id?.trim()) {
    return NextResponse.json(
      { error: "Pending lead missing Apify run ids" },
      { status: 400 }
    );
  }

  const postsRunStatusUrl = `https://api.apify.com/v2/actor-runs/${encodeURIComponent(
    lead.apify_posts_run_id
  )}?token=${encodeURIComponent(apifyToken)}`;
  const profileRunStatusUrl = `https://api.apify.com/v2/actor-runs/${encodeURIComponent(
    lead.apify_profile_run_id
  )}?token=${encodeURIComponent(apifyToken)}`;

  const [postsRunStatusRes, profileRunStatusRes] = await Promise.all([
    fetchApifyRunStatus(postsRunStatusUrl),
    fetchApifyRunStatus(profileRunStatusUrl),
  ]);

  if (!postsRunStatusRes.ok) {
    return NextResponse.json({ error: postsRunStatusRes.error }, { status: 502 });
  }
  if (!profileRunStatusRes.ok) {
    return NextResponse.json({ error: profileRunStatusRes.error }, { status: 502 });
  }

  if (postsRunStatusRes.status !== "SUCCEEDED" || profileRunStatusRes.status !== "SUCCEEDED") {
    return NextResponse.json(
      {
        error: "Apify runs not finished",
        details: {
          posts: postsRunStatusRes.status,
          profile: profileRunStatusRes.status,
        },
      },
      { status: 409 }
    );
  }

  const postsUrl = `https://api.apify.com/v2/actor-runs/${encodeURIComponent(
    lead.apify_posts_run_id
  )}/dataset/items?token=${encodeURIComponent(apifyToken)}&limit=30`;

  const profileUrl = `https://api.apify.com/v2/actor-runs/${encodeURIComponent(
    lead.apify_profile_run_id
  )}/dataset/items?token=${encodeURIComponent(apifyToken)}&limit=1`;

  const [postsRes, profileRes] = await Promise.all([
    fetchApifyDatasetItems<ApifyPostItem>(postsUrl),
    fetchApifyDatasetItems<ApifyProfileItem>(profileUrl),
  ]);

  if (!postsRes.ok) {
    return NextResponse.json({ error: postsRes.error }, { status: 502 });
  }
  if (!profileRes.ok) {
    return NextResponse.json({ error: profileRes.error }, { status: 502 });
  }

  const profileItem = profileRes.items[0] ?? {};
  const formattedProfile = formatProfile(profileItem, lead.instagram_handle.trim());
  const hasPosts = postsRes.items.length > 0;
  const formattedPosts = hasPosts
    ? formatPosts(postsRes.items)
    : "Posts\nNo post data was available for this artist.\n";
  const noPostsNote = hasPosts
    ? ""
    : "\n\nNote: No post data was available for this artist. Base your analysis on the profile information only and note this limitation clearly.\n\n";

  const { data: profileLookup } = await supabase
    .from("profiles")
    .select("id, owner_user_id, account_type, genre")
    .eq("instagram_handle", lead.instagram_handle.trim())
    .maybeSingle();

  const isVenue = profileLookup?.account_type === "venue";

  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const artistName = lead.artist_name?.trim() || "Unknown artist";
  const genre =
    typeof profileLookup?.genre === "string" && profileLookup.genre.trim()
      ? profileLookup.genre.trim()
      : "Unknown";
  const analysis1Prompt = isVenue
    ? buildVenuePattern1Prompt(formattedProfile, formattedPosts, hasPosts, noPostsNote, postsRes)
    : buildArtistPattern1Prompt(artistName, formattedProfile, hasPosts, noPostsNote, postsRes);

  const analysis2Prompt = isVenue
    ? buildVenueFullAnalysisPrompt(artistName, formattedProfile, formattedPosts, noPostsNote)
    : buildArtistFullAnalysisPrompt(artistName, genre, formattedProfile, formattedPosts, noPostsNote);

  let ai_pattern_analysis: string;
  let ai_full_analysis: string;
  try {
    const [m1, m2] = await Promise.all([
      anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 512,
        messages: [{ role: "user", content: analysis1Prompt }],
      }),
      anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: analysis2Prompt }],
      }),
    ]);

    const t1 = m1.content.find((b) => b.type === "text");
    const t2 = m2.content.find((b) => b.type === "text");
    if (!t1 || t1.type !== "text" || !t2 || t2.type !== "text") {
      return NextResponse.json({ error: "Unexpected model response shape" }, { status: 502 });
    }
    ai_pattern_analysis = t1.text.trim();
    ai_full_analysis = t2.text.trim();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI analysis failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Persist audit + mark lead complete BEFORE attempting email.
  const followers = asNumberOrNull((profileItem as ApifyProfileItem).followersCount);
  const following = asNumberOrNull((profileItem as ApifyProfileItem).followsCount);
  const post_count = asNumberOrNull((profileItem as ApifyProfileItem).postsCount);
  const bio = asString((profileItem as ApifyProfileItem).biography);

  const isResearchLead = lead.is_research === true;

  const { error: auditInsertError } = await supabase.from("audits").insert({
    user_id: profileLookup?.owner_user_id ?? null,
    artist_id: profileLookup?.id ?? null,
    email: lead.email.trim(),
    instagram_handle: lead.instagram_handle.trim(),
    followers: followers ?? 0,
    following: following ?? 0,
    post_count: post_count ?? 0,
    bio,
    recent_posts: null,
    recent_posts_raw: formattedPosts,
    ai_pattern_analysis,
    ai_full_analysis,
    is_research: isResearchLead,
  });

  if (auditInsertError) {
    return NextResponse.json(
      { error: "Failed to save audit", details: auditInsertError.message },
      { status: 500 }
    );
  }

  if (profileLookup?.id && !isResearchLead) {
    const { error: auditTimestampError } = await supabase
      .from("profiles")
      .update({ audit_completed_at: new Date().toISOString() })
      .eq("id", profileLookup.id);

    if (auditTimestampError) {
      console.error("process-lead: failed to set audit_completed_at", {
        artist_id: profileLookup.id,
        error: auditTimestampError.message,
      });
    }
  }

  if (profileLookup?.owner_user_id && profileLookup?.id && !isResearchLead) {
    await trackUsage({
      supabase,
      userId: profileLookup.owner_user_id,
      artistId: profileLookup.id,
      eventType: "audit_completed",
      metadata: {
        instagram_handle: lead.instagram_handle,
        followers: followers ?? 0,
      },
    });
  }

  const { error: pendingUpdateError } = await supabase
    .from("pending_leads")
    .update({ status: "complete" })
    .eq("id", lead.id);

  if (pendingUpdateError) {
    return NextResponse.json(
      { error: "Failed to update pending lead status", details: pendingUpdateError.message },
      { status: 500 }
    );
  }

  // Auto-generate first plan if none exists (skip for research audits)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const planWebhookSecret = process.env.WEBHOOK_SECRET;
  if (appUrl && profileLookup?.id && planWebhookSecret && !isResearchLead) {
    try {
      const { data: existingPlan } = await supabase
        .from("weekly_plans")
        .select("id")
        .eq("artist_id", profileLookup.id)
        .eq("is_research", false)
        .limit(1)
        .maybeSingle();

      if (!existingPlan) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await fetch(`${appUrl}/api/generate-plan`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-internal-artist-id": profileLookup.id,
            "x-webhook-secret": planWebhookSecret,
          },
        });
      }
    } catch {
      // Don't block if plan generation fails
    }
  }

  if (!isResearchLead) {
    const teaser = firstSentence(ai_pattern_analysis);
    const insightsUrl = "https://tempo.roadie.media/insights";

    const emailText = generateAuditEmailPlainText({
      artist_name: artistName,
      followers: followers ?? "—",
      following: following ?? "—",
      post_count: post_count ?? "—",
      teaser,
      cta_url: insightsUrl,
    });

    const emailHtml = generateAuditEmail({
      artist_name: artistName,
      followers: followers ?? "—",
      following: following ?? "—",
      post_count: post_count ?? "—",
      teaser,
      cta_url: insightsUrl,
    });

    const emailSend = await sendResendEmail({
      apiKey: resendKey,
      to: lead.email.trim().toLowerCase(),
      subject: getAuditEmailSubject(artistName),
      text: emailText,
      html: emailHtml,
    });

    if (!emailSend.ok) {
      console.error("Resend send failed", {
        pending_lead_id: lead.id,
        status: emailSend.status,
        error: emailSend.error,
      });
    }
  }

  return NextResponse.json({
    success: true,
    formattedProfile,
    formattedPosts,
    ai_pattern_analysis,
    ai_full_analysis,
  });
}

