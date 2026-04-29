import { createServiceRoleClient } from "@/utils/supabase/admin";
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

function verifyWebhookSecret(headerValue: string | null, secret: string): boolean {
  if (!headerValue || !secret) return false;
  const a = Buffer.from(headerValue, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function getUserIdByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<string | null> {
  const target = email.trim().toLowerCase();
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < perPage) return null;
    page += 1;
  }
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
  const instagram_handle = o.instagram_handle;
  const followers = Number(o.followers);
  const following = Number(o.following);
  const post_count = Number(o.post_count);
  const bio = o.bio;
  const recent_posts = o.recent_posts;
  const ai_pattern_analysis = o.ai_pattern_analysis;
  const ai_full_analysis = o.ai_full_analysis;
  const email = o.email;

  if (typeof instagram_handle !== "string" || !instagram_handle.trim()) {
    return NextResponse.json({ error: "Invalid or missing instagram_handle" }, { status: 400 });
  }
  if (
    !Number.isFinite(followers) ||
    !Number.isFinite(following) ||
    !Number.isFinite(post_count)
  ) {
    return NextResponse.json(
      { error: "followers, following, and post_count must be numbers" },
      { status: 400 }
    );
  }
  if (typeof bio !== "string") {
    return NextResponse.json({ error: "bio must be a string" }, { status: 400 });
  }
  let recentPostsJsonb: unknown[] | null = null;
  let recentPostsRaw: string | null = null;
  if (typeof recent_posts === "string") {
    recentPostsRaw = recent_posts;
  } else if (Array.isArray(recent_posts)) {
    recentPostsJsonb = recent_posts;
  } else {
    return NextResponse.json(
      { error: "recent_posts must be a string or JSON array" },
      { status: 400 }
    );
  }
  if (typeof ai_pattern_analysis !== "string" || typeof ai_full_analysis !== "string") {
    return NextResponse.json(
      { error: "ai_pattern_analysis and ai_full_analysis must be strings" },
      { status: 400 }
    );
  }
  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "Invalid or missing email" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  let userId: string | null;
  try {
    userId = await getUserIdByEmail(supabase, email);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Auth lookup failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (!userId) {
    return NextResponse.json({ error: "No user found for that email" }, { status: 404 });
  }

  const { error: insertError } = await supabase.from("audits").insert({
    user_id: userId,
    email: email.trim(),
    instagram_handle: instagram_handle.trim(),
    followers,
    following,
    post_count,
    bio,
    recent_posts: recentPostsJsonb,
    recent_posts_raw: recentPostsRaw,
    ai_pattern_analysis,
    ai_full_analysis,
  });

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to save audit", details: insertError.message },
      { status: 500 }
    );
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ instagram_handle: instagram_handle.trim() })
    .eq("id", userId);

  if (profileError) {
    return NextResponse.json(
      { error: "Failed to update profile", details: profileError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
