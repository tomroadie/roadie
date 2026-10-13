import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { userIsAdmin } from "@/lib/is-admin";
import { appBaseUrl } from "@/lib/email";
import { refreshThemesForArtist } from "@/lib/themes/refresh";

export const maxDuration = 300;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Admin-only. { artist_id } syncs that account's posts from Instagram now,
 * then seeds and sorts its concepts. Same work as the daily jobs, on demand.
 */
export async function POST(request: Request) {
  let artistId = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    artistId = typeof body.artist_id === "string" ? body.artist_id.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!UUID_RE.test(artistId)) return NextResponse.json({ error: "Invalid artist_id" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await userIsAdmin(supabase, user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET missing" }, { status: 500 });

  const syncRes = await fetch(
    `${appBaseUrl()}/api/cron/sync-post-performance?artist_id=${encodeURIComponent(artistId)}&full=1`,
    { headers: { authorization: `Bearer ${secret}` }, cache: "no-store" }
  );
  const sync = (await syncRes.json().catch(() => ({}))) as Record<string, unknown>;

  let themes: Record<string, unknown> = {};
  try {
    themes = { ...(await refreshThemesForArtist(createServiceRoleClient(), artistId)) };
  } catch (e) {
    themes = { error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json({ ok: syncRes.ok, sync_status: syncRes.status, sync, themes });
}
