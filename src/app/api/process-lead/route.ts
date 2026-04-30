import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceRoleClient } from "@/utils/supabase/admin";

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

async function sendResendEmail(args: {
  apiKey: string;
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${args.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: "Roadie <hello@roadie.media>",
      to: [args.to],
      subject: args.subject,
      text: args.text,
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
    .select("id, email, instagram_handle, artist_name, apify_posts_run_id, apify_profile_run_id, status")
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

  const postsUrl = `https://api.apify.com/v2/acts/apify~instagram-scraper/runs/${encodeURIComponent(
    lead.apify_posts_run_id
  )}/dataset/items?token=${encodeURIComponent(apifyToken)}&limit=10`;

  const profileUrl = `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/runs/${encodeURIComponent(
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
  const formattedPosts = formatPosts(postsRes.items);

  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const analysis1Prompt =
    "You are analysing Instagram data for a music artist. Below is a structured summary of their profile and 3 recent posts. Your job is to identify the single most important pattern in how they show up. Focus on: what their bio suggests they want to be, what their recent content actually consists of, whether there is a gap between the two. Return 2-3 sentences maximum.\n\n" +
    `${formattedProfile}\n\n${formatPosts(postsRes.items.slice(0, 3))}`;

  const artistName = lead.artist_name?.trim() || "Unknown artist";
  const analysis2Prompt =
    `You are a blunt, high-level music marketing strategist. Artist: ${artistName}. Below is a structured summary of their Instagram profile and recent posts. ${formattedProfile} ${formattedPosts}. Provide a strategic analysis with these exact sections: **POSITIONING** **CONTENT PATTERN** **ENGAGEMENT REALITY** **CORE PROBLEM** **OPPORTUNITY**. Be direct, specific, and actionable. Max 300 words total.`;

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

  const emailText =
    `Your Roadie Instagram audit is ready.\n\n` +
    `${ai_pattern_analysis}\n\n` +
    `${ai_full_analysis}\n\n` +
    `---\n\n` +
    `${formattedProfile}\n\n` +
    `${formattedPosts}`;

  const emailSend = await sendResendEmail({
    apiKey: resendKey,
    to: lead.email.trim().toLowerCase(),
    subject: "Your Instagram audit is ready",
    text: emailText,
  });

  if (!emailSend.ok) {
    return NextResponse.json(
      { error: "Failed to send email", details: emailSend.error },
      { status: 502 }
    );
  }

  // Persist audit + mark lead complete (best-effort; email already sent).
  const followers = asNumberOrNull((profileItem as ApifyProfileItem).followersCount);
  const following = asNumberOrNull((profileItem as ApifyProfileItem).followsCount);
  const post_count = asNumberOrNull((profileItem as ApifyProfileItem).postsCount);
  const bio = asString((profileItem as ApifyProfileItem).biography);

  await supabase.from("audits").insert({
    user_id: null,
    artist_id: null,
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
  });

  await supabase
    .from("pending_leads")
    .update({ status: "completed" })
    .eq("id", lead.id);

  return NextResponse.json({
    success: true,
    formattedProfile,
    formattedPosts,
    ai_pattern_analysis,
    ai_full_analysis,
  });
}

