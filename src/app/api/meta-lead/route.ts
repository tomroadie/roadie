import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";

type MetaLeadFieldDataItem = {
  name?: unknown;
  values?: unknown;
};

type MetaLeadResponse = {
  field_data?: MetaLeadFieldDataItem[];
};

function getQueryParam(url: string, key: string): string | null {
  try {
    return new URL(url).searchParams.get(key);
  } catch {
    return null;
  }
}

function firstString(x: unknown): string | null {
  if (typeof x === "string") return x;
  if (Array.isArray(x) && typeof x[0] === "string") return x[0];
  return null;
}

function extractLeadAndPageIds(payload: unknown): { leadgen_id: string; page_id: string } | null {
  if (typeof payload !== "object" || payload === null) return null;

  // Expected Meta shape:
  // { entry: [{ changes: [{ value: { leadgen_id, page_id } }]}] }
  const root = payload as Record<string, unknown>;
  const entry = root.entry;
  if (!Array.isArray(entry)) return null;

  for (const e of entry) {
    if (typeof e !== "object" || e === null) continue;
    const changes = (e as Record<string, unknown>).changes;
    if (!Array.isArray(changes)) continue;
    for (const c of changes) {
      if (typeof c !== "object" || c === null) continue;
      const value = (c as Record<string, unknown>).value;
      if (typeof value !== "object" || value === null) continue;
      const v = value as Record<string, unknown>;
      const leadgen_id = firstString(v.leadgen_id);
      const page_id = firstString(v.page_id);
      if (leadgen_id && page_id) return { leadgen_id, page_id };
    }
  }

  return null;
}

function extractLeadFields(lead: MetaLeadResponse): {
  artist_name: string | null;
  email: string | null;
  instagram_url: string | null;
} {
  const fieldData = Array.isArray(lead.field_data) ? lead.field_data : [];
  const map = new Map<string, string>();

  for (const item of fieldData) {
    if (!item || typeof item !== "object") continue;
    const name = (item as MetaLeadFieldDataItem).name;
    const values = (item as MetaLeadFieldDataItem).values;
    if (typeof name !== "string") continue;
    const v = firstString(values);
    if (v) map.set(name, v);
  }

  return {
    artist_name: map.get("what_is_your_artist_project_name") ?? null,
    email: map.get("email") ?? null,
    instagram_url: map.get("instagram_profile_url_not_handle") ?? null,
  };
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

async function fetchMetaLead(leadgenId: string, accessToken: string): Promise<MetaLeadResponse> {
  const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(
    leadgenId
  )}?access_token=${encodeURIComponent(accessToken)}`;

  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Graph API error ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as MetaLeadResponse;
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

export async function GET(request: Request) {
  const mode = getQueryParam(request.url, "hub.mode");
  const token = getQueryParam(request.url, "hub.verify_token");
  const challenge = getQueryParam(request.url, "hub.challenge");

  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (!expected) {
    return new NextResponse("Server misconfiguration: missing META_WEBHOOK_VERIFY_TOKEN", {
      status: 500,
    });
  }

  if (mode === "subscribe" && token && challenge && token === expected) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const metaToken = process.env.META_PAGE_ACCESS_TOKEN;
  const apifyToken = process.env.APIFY_API_TOKEN;
  if (!metaToken || !apifyToken) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing META_PAGE_ACCESS_TOKEN or APIFY_API_TOKEN" },
      { status: 500 }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ids = extractLeadAndPageIds(payload);
  if (!ids) {
    return NextResponse.json({ error: "Could not extract leadgen_id/page_id" }, { status: 400 });
  }

  let lead: MetaLeadResponse;
  try {
    lead = await fetchMetaLead(ids.leadgen_id, metaToken);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch lead";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const { artist_name, email, instagram_url } = extractLeadFields(lead);
  if (!email?.trim()) {
    return NextResponse.json({ error: "Missing lead email" }, { status: 400 });
  }
  if (!instagram_url?.trim()) {
    return NextResponse.json({ error: "Missing instagram URL" }, { status: 400 });
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
    artist_name: artist_name?.trim() || null,
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

