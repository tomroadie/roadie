import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { getMondayDateString } from "@/lib/week";

type FailedArtist = {
  artist_id: string;
  error: string;
};

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
      .eq("is_managed", true);

    if (profilesError) {
      return NextResponse.json(
        { error: "Failed to load managed artists", details: profilesError.message },
        { status: 500 }
      );
    }

    const managedArtists = profiles ?? [];
    if (managedArtists.length === 0) {
      return NextResponse.json({ generated: 0, failed: [] });
    }

    const weekStart = getMondayDateString();
    const artistIds = managedArtists
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

    let generated = 0;
    const failed: FailedArtist[] = [];

    for (const profile of managedArtists) {
      const artistId = String(profile.id ?? "").trim();
      if (!artistId) continue;

      const checkinResponse = checkinByArtistId.get(artistId) ?? "";
      const requestBody: Record<string, string> = {};
      if (checkinResponse) {
        requestBody.focus = checkinResponse;
      }

      try {
        const res = await fetch(`${appUrl}/api/generate-plan`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-internal-artist-id": artistId,
            "x-webhook-secret": webhookSecret,
          },
          body: JSON.stringify(requestBody),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
            details?: string;
          };
          failed.push({
            artist_id: artistId,
            error: data.details
              ? `${data.error ?? "Request failed"}: ${data.details}`
              : (data.error ?? `HTTP ${res.status}`),
          });
          continue;
        }

        generated += 1;
      } catch (e) {
        failed.push({
          artist_id: artistId,
          error: e instanceof Error ? e.message : "Network error",
        });
      }
    }

    return NextResponse.json({ generated, failed });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
