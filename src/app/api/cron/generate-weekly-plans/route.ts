import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { getMondayDateString } from "@/lib/week";
import { PUBLIC_PROFILES_OR_FILTER } from "@/lib/public-profiles-filter";

const ELIGIBLE_PROFILES_FILTER =
  "is_managed.eq.true,and(is_managed.eq.false,plan.in.(starter,pro,label))";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    if (!appUrl) {
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

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, artist_name")
      .or(ELIGIBLE_PROFILES_FILTER)
      .or(PUBLIC_PROFILES_OR_FILTER)
      .eq("cron_active", true);

    if (profilesError) {
      return NextResponse.json(
        { error: "Failed to load artists", details: profilesError.message },
        { status: 500 }
      );
    }

    const artists = profiles ?? [];
    if (artists.length === 0) {
      return NextResponse.json({ queued: 0, artists: 0 });
    }

    const weekStart = getMondayDateString();
    const artistIds = artists
      .map((p) => String(p.id ?? "").trim())
      .filter(Boolean);

    const { data: checkins, error: checkinsError } = await supabase
      .from("weekly_checkins")
      .select("artist_id, response")
      .eq("week_start", weekStart)
      .in("artist_id", artistIds);

    if (checkinsError) {
      return NextResponse.json(
        { error: "Failed to load check-ins", details: checkinsError.message },
        { status: 500 }
      );
    }

    const checkinByArtistId = new Map<string, string>();
    for (const row of checkins ?? []) {
      const artistId = String(row.artist_id ?? "").trim();
      const response = String(row.response ?? "").trim();
      if (artistId && response) {
        checkinByArtistId.set(artistId, response);
      }
    }

    let queued = 0;

    for (const profile of artists) {
      const artistId = String(profile.id ?? "").trim();
      if (!artistId) continue;

      const checkinResponse = checkinByArtistId.get(artistId) ?? "";
      const requestBody: Record<string, string> = {};
      if (checkinResponse) {
        requestBody.focus = checkinResponse;
      }

      fetch(`${appUrl}/api/generate-plan`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-artist-id": artistId,
          "x-webhook-secret": webhookSecret,
        },
        body: JSON.stringify(requestBody),
      }).catch((e) => {
        console.error(`Failed to queue plan for ${artistId}:`, e);
      });

      queued += 1;
    }

    return NextResponse.json({ queued, artists: artists.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
