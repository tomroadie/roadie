import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { userIsAdmin } from "@/lib/is-admin";
import { publishGeneration } from "@/lib/concepts/store";
import { sendYourWeek } from "@/lib/concepts/weekly";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Admin-only. Two actions:
 *   { generation_id, notify? }        publish a draft to the artist's board
 *                                     (switches the board on); notify sends
 *                                     "Your week" 
 *   { artist_id, board_enabled }      switch the board on or off without
 *                                     touching concepts
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
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

  const admin = createServiceRoleClient();
  const generationId =
    typeof body.generation_id === "string" ? body.generation_id.trim() : "";
  const artistId =
    typeof body.artist_id === "string" ? body.artist_id.trim() : "";

  try {
    if (generationId) {
      if (!UUID_RE.test(generationId)) {
        return NextResponse.json({ error: "Invalid generation_id" }, { status: 400 });
      }
      const { artistId: published } = await publishGeneration(admin, generationId);
      const emailed = body.notify === true ? await sendYourWeek(admin, generationId) : false;
      return NextResponse.json({ ok: true, artist_id: published, emailed });
    }

    if (artistId && typeof body.board_enabled === "boolean") {
      if (!UUID_RE.test(artistId)) {
        return NextResponse.json({ error: "Invalid artist_id" }, { status: 400 });
      }
      const { error } = await admin
        .from("profiles")
        .update({ board_enabled: body.board_enabled })
        .eq("id", artistId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, board_enabled: body.board_enabled });
    }

    return NextResponse.json({ error: "Nothing to do" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("publish-concepts failed", { generationId, artistId, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
