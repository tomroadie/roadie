import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * Marks a synced post as an ad or collab (or undoes it). The database
 * function checks the signed-in user can access the post's artist.
 */
export async function POST(request: Request) {
  let postId = "";
  let excluded: boolean | null = null;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    postId = typeof body.instagram_post_id === "string" ? body.instagram_post_id.trim() : "";
    excluded = typeof body.excluded === "boolean" ? body.excluded : null;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!/^\d{1,40}$/.test(postId) || excluded === null) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.rpc("set_post_excluded", {
    p_instagram_post_id: postId,
    p_excluded: excluded,
  });
  if (error) {
    const status = error.code === "P0002" ? 404 : error.code === "42501" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ ok: true });
}
