import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { userIsAdmin } from "@/lib/is-admin";

function appBaseUrl(request: Request): string {
  const hdrHost =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const hdrProto = request.headers.get("x-forwarded-proto") ?? "http";
  const fallbackOrigin = hdrHost
    ? `${hdrProto}://${hdrHost}`
    : "http://localhost:3000";
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? fallbackOrigin;
}

export async function POST(request: Request) {
  let requestId = "";
  let action = "";
  let adminNote = "";

  try {
    const body = (await request.json()) as Record<string, unknown>;
    requestId =
      typeof body.request_id === "string" ? body.request_id.trim() : "";
    action = typeof body.action === "string" ? body.action.trim() : "";
    adminNote =
      typeof body.admin_note === "string" ? body.admin_note.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!requestId) {
    return NextResponse.json({ error: "Expected request_id" }, { status: 400 });
  }

  if (action !== "approved" && action !== "declined") {
    return NextResponse.json(
      { error: "Expected action to be 'approved' or 'declined'" },
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

  if (!(await userIsAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let adminSupabase;
  try {
    adminSupabase = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { data: revisionRequest, error: fetchError } = await adminSupabase
    .from("plan_revision_requests")
    .select("id, artist_id, artist_note, status")
    .eq("id", requestId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      { error: "Failed to load revision request", details: fetchError.message },
      { status: 500 }
    );
  }

  if (!revisionRequest?.id) {
    return NextResponse.json({ error: "Revision request not found" }, { status: 404 });
  }

  if (revisionRequest.status !== "pending") {
    return NextResponse.json(
      { error: "Revision request is no longer pending" },
      { status: 409 }
    );
  }

  const nowIso = new Date().toISOString();

  if (action === "declined") {
    const { error: updateError } = await adminSupabase
      .from("plan_revision_requests")
      .update({
        status: "declined",
        admin_note: adminNote || null,
        actioned_at: nowIso,
        actioned_by: user.id,
      })
      .eq("id", requestId);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to decline revision request", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  }

  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing WEBHOOK_SECRET" },
      { status: 500 }
    );
  }

  const artistId = String(revisionRequest.artist_id ?? "").trim();
  const artistNote = String(revisionRequest.artist_note ?? "").trim();

  try {
    const generateRes = await fetch(`${appBaseUrl(request)}/api/generate-plan`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-artist-id": artistId,
        "x-webhook-secret": webhookSecret,
      },
      body: JSON.stringify({ focus: artistNote }),
      cache: "no-store",
    });

    if (!generateRes.ok) {
      const data = (await generateRes.json().catch(() => ({}))) as {
        error?: string;
        details?: string;
      };
      console.error("action-revision: generate-plan failed", {
        request_id: requestId,
        artist_id: artistId,
        status: generateRes.status,
        error: data.error,
        details: data.details,
      });
      return NextResponse.json(
        { error: "Plan generation failed, request left pending" },
        { status: 500 }
      );
    }
  } catch (e) {
    console.error("action-revision: generate-plan request failed", {
      request_id: requestId,
      artist_id: artistId,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: "Plan generation failed, request left pending" },
      { status: 500 }
    );
  }

  const { error: updateError } = await adminSupabase
    .from("plan_revision_requests")
    .update({
      status: "approved",
      admin_note: adminNote || null,
      actioned_at: nowIso,
      actioned_by: user.id,
    })
    .eq("id", requestId);

  if (updateError) {
    return NextResponse.json(
      { error: "Plan regenerated but failed to update request status", details: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
