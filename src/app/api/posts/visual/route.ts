import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { asVisualKind } from "@/lib/visual-kinds";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * { artistId, postId, kind, label, correction }: the artist's correction of
 * what a post looks like. Tempo won't overwrite it. The database function checks access.
 */
export async function POST(request: Request) {
  let artistId = "";
  let postId = "";
  let kind: string | null = null;
  let label = "";
  let correction = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    artistId = typeof body.artistId === "string" ? body.artistId.trim() : "";
    postId = typeof body.postId === "string" ? body.postId.trim() : "";
    kind = asVisualKind(body.kind);
    label = typeof body.label === "string" ? body.label.trim().slice(0, 40) : "";
    correction = typeof body.correction === "string" ? body.correction.trim().slice(0, 300) : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!UUID_RE.test(artistId) || !postId || postId.length > 64 || !kind) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.rpc("set_post_visual", {
    p_artist_id: artistId,
    p_post_id: postId,
    p_kind: kind,
    p_label: label,
    p_correction: correction,
  });
  if (error) {
    const status = error.code === "P0002" ? 404 : error.code === "42501" ? 403 : error.code === "22023" ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ ok: true });
}
