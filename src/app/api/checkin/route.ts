import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import {
  getUpcomingPlanWeekStart,
  verifyCheckinToken,
} from "@/lib/checkin-token";

const ARTIST_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const artistId =
    typeof body.artist_id === "string" ? body.artist_id.trim() : "";
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const response =
    typeof body.response === "string" ? body.response.trim() : "";

  if (!artistId || !ARTIST_ID_UUID_RE.test(artistId)) {
    return NextResponse.json({ error: "Invalid artist_id" }, { status: 400 });
  }

  if (!token || !verifyCheckinToken(artistId, token)) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 403 });
  }

  if (!response) {
    return NextResponse.json({ error: "Response is required" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", artistId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: "Failed to verify artist", details: profileError.message },
      { status: 500 }
    );
  }

  if (!profile?.id) {
    return NextResponse.json({ error: "Artist not found" }, { status: 404 });
  }

  const weekStart = getUpcomingPlanWeekStart();

  const { error: insertError } = await supabase.from("weekly_checkins").upsert(
    {
      artist_id: artistId,
      week_start: weekStart,
      response,
    },
    { onConflict: "artist_id,week_start" }
  );

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to save check-in", details: insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
