import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { after } from "next/server";
import { enqueueNewLead, cleanInstagramHandle } from "@/lib/new-lead-pipeline";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { runConnectedAudit, startAuditProgress } from "@/lib/audit/connected-audit";
import { userIsAdmin } from "@/lib/is-admin";

// Fetching posts and two AI calls take around a minute.
export const maxDuration = 120;
import { trackUsage } from "@/lib/track-usage";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Expected JSON object body" }, { status: 400 });
  }

  const artistId = String(
    (body as Record<string, unknown>).artist_id ?? ""
  ).trim();

  if (!artistId) {
    return NextResponse.json({ error: "Missing artist_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email?.trim()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("instagram_handle, artist_name, owner_user_id, instagram_user_id")
    .eq("id", artistId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const isAdmin = await userIsAdmin(supabase, user.id);
  if (!profile || (profile.owner_user_id !== user.id && !isAdmin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!profile.artist_name?.trim()) {
    return NextResponse.json(
      { error: "Artist profile is missing a name" },
      { status: 400 }
    );
  }

  // The public audit only ever reads the artist's own connected account.
  if (profile.instagram_user_id) {
    const admin = createServiceRoleClient();
    const pendingLeadId = await startAuditProgress(admin, {
      email: user.email.trim(),
      handle: cleanInstagramHandle(profile.instagram_handle ?? "") ?? "",
      artistName: profile.artist_name.trim(),
    });
    after(async () => {
      try {
        await runConnectedAudit(admin, artistId, { pendingLeadId: pendingLeadId ?? undefined });
      } catch (e) {
        console.error("run-audit: connected audit failed", artistId, e);
      }
    });
    await trackUsage({ supabase, userId: user.id, artistId, eventType: "audit_started", metadata: { source: "connected" } });
    return NextResponse.json({ success: true, message: "Audit started. Results appear in a minute or two." });
  }

  // Scraping a handle (Apify) is for Roadie admins only, never the public product.
  if (!isAdmin) {
    return NextResponse.json(
      { error: "Connect Instagram first. Your audit is built from your own account." },
      { status: 400 }
    );
  }

  const ig = profile.instagram_handle?.trim();
  if (!ig) {
    return NextResponse.json(
      { error: "No Instagram handle on file" },
      { status: 400 }
    );
  }

  try {
    await enqueueNewLead({
      email: user.email.trim(),
      artist_name: profile.artist_name.trim(),
      instagram_input: ig,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to start audit";
    const lower = msg.toLowerCase();
    let status = 502;
    if (lower.includes("could not extract")) status = 400;
    else if (lower.includes("misconfiguration")) status = 500;
    return NextResponse.json({ error: msg }, { status });
  }

  await trackUsage({
    supabase,
    userId: user.id,
    artistId,
    eventType: "audit_started",
  });

  return NextResponse.json({
    success: true,
    message: "Audit started — results appear in 3-5 minutes",
  });
}
