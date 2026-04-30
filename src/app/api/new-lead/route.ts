import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createServiceRoleClient } from "@/utils/supabase/admin";

function verifyWebhookSecret(headerValue: string | null, secret: string): boolean {
  if (!headerValue || !secret) return false;
  const a = Buffer.from(headerValue, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function cleanInstagramHandle(instagramUrlOrHandle: string): string | null {
  // Cleaning logic:
  // 1. Trim whitespace
  // 2. Remove @ if present
  // 3. If it contains 'instagram.com', extract everything after the last / before any ? or trailing slash
  // 4. Remove any remaining slashes
  // 5. Lowercase the result
  const trimmed = instagramUrlOrHandle.trim();
  if (!trimmed) return null;

  const withoutAt = trimmed.replace(/^@/, "");

  let candidate = withoutAt;
  if (/instagram\.com/i.test(withoutAt)) {
    const beforeQueryOrHash = withoutAt.split(/[?#]/)[0] ?? "";
    const withoutTrailingSlash = beforeQueryOrHash.replace(/\/+$/, "");
    const lastSlash = withoutTrailingSlash.lastIndexOf("/");
    candidate = lastSlash === -1 ? "" : withoutTrailingSlash.slice(lastSlash + 1);
  }

  const cleaned = candidate.replace(/^@/, "").replace(/\//g, "").toLowerCase();
  return cleaned || null;
}

async function apifyRun(
  actId: string,
  token: string,
  input: Record<string, unknown>
): Promise<string> {
  const url = `https://api.apify.com/v2/acts/${encodeURIComponent(
    actId
  )}/runs?token=${encodeURIComponent(token)}&waitForFinish=0`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apify run error ${res.status}: ${text || res.statusText}`);
  }

  const json = (await res.json()) as { data?: { id?: unknown } };
  const id = json.data?.id;
  if (typeof id !== "string" || !id.trim()) throw new Error("Apify run missing id");
  return id;
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
  const email = o.email;
  const artist_name = o.artist_name;
  const instagram_input = o.instagram_url ?? o.instagram_handle ?? o.instagram;

  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "Invalid or missing email" }, { status: 400 });
  }
  if (typeof artist_name !== "string" || !artist_name.trim()) {
    return NextResponse.json({ error: "Invalid or missing artist_name" }, { status: 400 });
  }
  if (typeof instagram_input !== "string" || !instagram_input.trim()) {
    return NextResponse.json({ error: "Invalid or missing instagram" }, { status: 400 });
  }

  const handle = cleanInstagramHandle(instagram_input);
  if (!handle) {
    return NextResponse.json({ error: "Could not extract Instagram handle" }, { status: 400 });
  }

  const cleanInstagramUrl = `https://www.instagram.com/${handle}/`;

  let apify_posts_run_id: string;
  let apify_profile_run_id: string;
  try {
    apify_posts_run_id = await apifyRun("apify~instagram-scraper", apifyToken, {
      directUrls: [cleanInstagramUrl],
      resultsLimit: 10,
    });
    apify_profile_run_id = await apifyRun("apify~instagram-profile-scraper", apifyToken, {
      usernames: [handle],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to trigger Apify";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { error: insertError } = await supabase.from("pending_leads").insert({
    email: email.trim().toLowerCase(),
    instagram_handle: handle,
    artist_name: artist_name.trim(),
    apify_posts_run_id,
    apify_profile_run_id,
    status: "processing",
  });

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to save pending lead", details: insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

