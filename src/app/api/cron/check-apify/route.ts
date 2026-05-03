import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";

type ApifyActorRun = {
  data?: {
    status?: unknown;
  };
};

function asString(x: unknown): string {
  return typeof x === "string" ? x : x == null ? "" : String(x);
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

type PendingLeadRow = {
  id: string;
  apify_posts_run_id: string | null;
  apify_profile_run_id: string | null;
};

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apifyToken = process.env.APIFY_API_TOKEN;
  if (!apifyToken) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing APIFY_API_TOKEN" },
      { status: 500 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl?.trim()) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing NEXT_PUBLIC_APP_URL" },
      { status: 500 }
    );
  }

  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing WEBHOOK_SECRET" },
      { status: 500 }
    );
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: leads, error: queryError } = await supabase
    .from("pending_leads")
    .select("id, apify_posts_run_id, apify_profile_run_id")
    .eq("status", "processing")
    .gte("created_at", cutoff);

  if (queryError) {
    return NextResponse.json(
      { error: "Failed to load pending leads", details: queryError.message },
      { status: 500 }
    );
  }

  const rows = (leads ?? []) as PendingLeadRow[];

  let processed = 0;
  let failed = 0;
  let pending = 0;

  const base = appUrl.replace(/\/$/, "");

  for (const lead of rows) {
    const postsId = lead.apify_posts_run_id?.trim();
    const profileId = lead.apify_profile_run_id?.trim();
    if (!postsId || !profileId) {
      const { error: upErr } = await supabase
        .from("pending_leads")
        .update({ status: "failed" })
        .eq("id", lead.id);
      if (!upErr) failed++;
      continue;
    }

    const postsUrl = `https://api.apify.com/v2/actor-runs/${encodeURIComponent(
      postsId
    )}?token=${encodeURIComponent(apifyToken)}`;
    const profileUrl = `https://api.apify.com/v2/actor-runs/${encodeURIComponent(
      profileId
    )}?token=${encodeURIComponent(apifyToken)}`;

    const [postsRes, profileRes] = await Promise.all([
      fetchApifyRunStatus(postsUrl),
      fetchApifyRunStatus(profileUrl),
    ]);

    if (!postsRes.ok || !profileRes.ok) {
      pending++;
      continue;
    }

    const postsStatus = postsRes.status;
    const profileStatus = profileRes.status;

    if (postsStatus === "FAILED" || postsStatus === "ABORTED" || profileStatus === "FAILED" || profileStatus === "ABORTED") {
      const { error: upErr } = await supabase
        .from("pending_leads")
        .update({ status: "failed" })
        .eq("id", lead.id);
      if (!upErr) failed++;
      continue;
    }

    if (postsStatus === "SUCCEEDED" && profileStatus === "SUCCEEDED") {
      const res = await fetch(`${base}/api/process-lead`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-webhook-secret": webhookSecret,
        },
        body: JSON.stringify({ pending_lead_id: lead.id }),
      });
      if (res.ok) {
        processed++;
      } else {
        failed++;
      }
      continue;
    }

    pending++;
  }

  return NextResponse.json({ processed, failed, pending });
}