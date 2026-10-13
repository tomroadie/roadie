import { NextResponse, after } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { boardWeek } from "@/lib/board-week";
import { parseKeyDates } from "@/lib/key-dates";
import { generateConceptPool } from "@/lib/concepts/generate";
import { publishGeneration, saveDraftGeneration } from "@/lib/concepts/store";
import { refreshThemesForArtist } from "@/lib/themes/refresh";
import { trackUsage } from "@/lib/track-usage";

export const maxDuration = 300;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const text = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 600) : "");

/**
 * The Monday check-in. { artist_id, coming_up?, unposted?, want_to_post?, skip? }
 * Saves the answers; when there are any, dates in "coming up" become events
 * and this week's ideas are redrawn around the answers (once a week), in the
 * background. The board refreshes on the next load.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const artistId = text(body.artist_id);
  if (!UUID_RE.test(artistId)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const comingUp = text(body.coming_up);
  const unposted = text(body.unposted);
  const wantToPost = text(body.want_to_post);
  const skipped = body.skip === true || (!comingUp && !unposted && !wantToPost);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("week_start_day, board_enabled")
    .eq("id", artistId)
    .maybeSingle();
  const weekStart = boardWeek(profile?.week_start_day).start;

  const { error } = await supabase.rpc("save_week_notes", {
    p_artist_id: artistId,
    p_week_start: weekStart,
    p_coming_up: comingUp || null,
    p_unposted: unposted || null,
    p_want_to_post: wantToPost || null,
    p_skipped: skipped,
  });
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "22023" ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  await trackUsage({ supabase, userId: user.id, artistId, eventType: skipped ? "checkin_skipped" : "checkin_saved" });
  if (skipped || !profile?.board_enabled) return NextResponse.json({ ok: true, refreshing: false });

  const admin = createServiceRoleClient();
  const { data: notes } = await admin
    .from("week_notes")
    .select("ideas_refreshed_at")
    .eq("artist_id", artistId)
    .eq("week_start", weekStart)
    .maybeSingle();
  const refresh = !notes?.ideas_refreshed_at;

  after(async () => {
    try {
      if (comingUp) {
        const dates = await parseKeyDates(comingUp);
        if (dates.length > 0) {
          const { data: owner } = await admin.from("artists").select("owner_user_id").eq("id", artistId).maybeSingle();
          await admin.from("events").insert(
            dates.map((d) => ({
              artist_id: artistId,
              user_id: owner?.owner_user_id ?? user.id,
              title: d.title,
              event_date: d.date,
              event_type: d.event_type,
              notes: "From your weekly check-in",
            }))
          );
        }
      }
      if (refresh) {
        const result = await generateConceptPool(admin, artistId);
        const generationId = await saveDraftGeneration(admin, result, user.id, { kind: "checkin" });
        await publishGeneration(admin, generationId);
        await admin
          .from("week_notes")
          .update({ ideas_refreshed_at: new Date().toISOString() })
          .eq("artist_id", artistId)
          .eq("week_start", weekStart);
        await refreshThemesForArtist(admin, artistId);
      }
    } catch (e) {
      console.error("week-notes: follow-on work failed", artistId, e);
    }
  });

  return NextResponse.json({ ok: true, refreshing: refresh });
}
