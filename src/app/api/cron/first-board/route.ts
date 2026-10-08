import { after, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { draftFirstBoard } from "@/lib/concepts/first-board";
import { escapeHtml, notifyAdminEmail } from "@/lib/admin-notify";

export const maxDuration = 300;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Drafts a new artist's first board. Called by the app itself after their
 * audit finishes (CRON_SECRET), and safe to call by hand. Replies straight
 * away; the work runs after the response.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const artistId = new URL(request.url).searchParams.get("artist_id")?.trim() ?? "";
  if (!UUID_RE.test(artistId)) {
    return NextResponse.json({ error: "artist_id required" }, { status: 400 });
  }

  after(async () => {
    try {
      const outcome = await draftFirstBoard(createServiceRoleClient(), artistId);
      console.log("first-board", artistId, outcome);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("first-board failed", artistId, msg);
      await notifyAdminEmail(
        "Tempo: first ideas failed",
        `<p>Couldn't draft first ideas for artist ${escapeHtml(artistId)}: ${escapeHtml(msg)}</p><p>Try Generate in admin.</p>`
      );
    }
  });
  return NextResponse.json({ accepted: true, artist_id: artistId }, { status: 202 });
}
