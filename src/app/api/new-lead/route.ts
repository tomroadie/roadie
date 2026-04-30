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
  const raw = instagramUrlOrHandle.trim();
  if (!raw) return null;

  // If already a handle:
  const asHandle = raw.replace(/^@/, "");
  if (/^[a-zA-Z0-9._]{1,30}$/.test(asHandle) && !asHandle.includes("/")) return asHandle;

  // Otherwise parse URL.
  try {
    const u = new URL(raw);
    if (!/instagram\.com$/i.test(u.hostname) && !/^(www\.)?instagram\.com$/i.test(u.hostname)) {
      return null;
    }
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 1) return null;
    const handle = parts[0].replace(/^@/, "");
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(handle)) return null;
    return handle;
  } catch {
    // Try to normalize common "instagram.com/handle" without protocol
    const normalized = raw.replace(/^https?:\/\//i, "");
    const m = normalized.match(/^(?:www\.)?instagram\.com\/([^/?#]+).*$/i);
    if (!m) return null;
    const handle = (m[1] ?? "").replace(/^@/, "");
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(handle)) return null;
    return handle;
  }
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
  const instagram_url = o.instagram_url;

  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "Invalid or missing email" }, { status: 400 });
  }
  if (typeof artist_name !== "string" || !artist_name.trim()) {
    return NextResponse.json({ error: "Invalid or missing artist_name" }, { status: 400 });
  }
  if (typeof instagram_url !== "string" || !instagram_url.trim()) {
    return NextResponse.json({ error: "Invalid or missing instagram_url" }, { status: 400 });
  }

  const handle = cleanInstagramHandle(instagram_url);
  if (!handle) {
    return NextResponse.json({ error: "Invalid Instagram URL/handle" }, { status: 400 });
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

