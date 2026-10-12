import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { trackUsage } from "@/lib/track-usage";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Artist actions on content themes. The database functions check access.
 *   { action: "add", artist_id, name, description? }
 *   { action: "accept" | "dismiss" | "archive", theme_id }
 *   { action: "tag_post", instagram_post_id, theme_id | null }
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action : "";
  const s = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let rpc: { name: string; args: Record<string, unknown> } | null = null;
  let artistId: string | null = null;

  if (action === "add") {
    artistId = s("artist_id");
    if (!UUID_RE.test(artistId) || !s("name")) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    rpc = {
      name: "add_content_theme",
      args: { p_artist_id: artistId, p_name: s("name").slice(0, 60), p_description: s("description").slice(0, 200) || null },
    };
  } else if (action === "accept" || action === "dismiss" || action === "archive") {
    if (!UUID_RE.test(s("theme_id"))) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    rpc = { name: "set_content_theme_status", args: { p_theme_id: s("theme_id"), p_action: action } };
  } else if (action === "tag_post") {
    const postId = s("instagram_post_id");
    const themeId = body.theme_id === null ? null : s("theme_id");
    if (!postId || postId.length > 64 || (themeId !== null && !UUID_RE.test(themeId))) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    rpc = { name: "set_post_theme", args: { p_instagram_post_id: postId, p_theme_id: themeId } };
  } else {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc(rpc.name, rpc.args);
  if (error) {
    const status =
      error.code === "P0002" ? 404 : error.code === "42501" ? 403 : error.code === "22023" ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  const resolvedArtist =
    artistId ?? (data && typeof data === "object" ? String((data as { artist_id?: string }).artist_id ?? "") : "");
  if (resolvedArtist) await trackUsage({
    supabase,
    userId: user.id,
    artistId: resolvedArtist,
    eventType: `theme_${action}`,
    metadata: {},
  });

  return NextResponse.json({ ok: true });
}
