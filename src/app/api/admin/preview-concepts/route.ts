import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { userIsAdmin } from "@/lib/is-admin";
import { generateConceptPool } from "@/lib/concepts/generate";
import { saveDraftGeneration } from "@/lib/concepts/store";

const ARTIST_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const maxDuration = 120;

/**
 * Admin-only: generate a concept pool for any artist and save it as a draft.
 * Nothing reaches the artist until the draft is published.
 */
export async function POST(request: Request) {
  let artistId = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    artistId = typeof body.artist_id === "string" ? body.artist_id.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!ARTIST_ID_UUID_RE.test(artistId)) {
    return NextResponse.json({ error: "Invalid artist_id" }, { status: 400 });
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

  try {
    const started = Date.now();
    const admin = createServiceRoleClient();
    const result = await generateConceptPool(admin, artistId);
    const generationId = await saveDraftGeneration(admin, result, user.id);
    return NextResponse.json({
      ...result,
      generation_id: generationId,
      ms: Date.now() - started,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("preview-concepts failed", { artist_id: artistId, message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
