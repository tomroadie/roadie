import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { loadBoard } from "@/lib/concepts/store";
import { trackUsage } from "@/lib/track-usage";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Answers "Was this one of your ideas?" for a post Instagram spotted.
 * With a concept_id: links the post to that idea (marking it posted if it
 * was still on the board or shelf). Without one: "something else", so we
 * stop asking. Returns the fresh board.
 */
export async function POST(request: Request) {
  let postId = "";
  let conceptId: string | null = null;
  let artistId = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    postId = typeof body.instagram_post_id === "string" ? body.instagram_post_id.trim() : "";
    conceptId = typeof body.concept_id === "string" ? body.concept_id.trim() : null;
    artistId = typeof body.artist_id === "string" ? body.artist_id.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!/^\d{1,40}$/.test(postId) || !UUID_RE.test(artistId) || (conceptId !== null && !UUID_RE.test(conceptId))) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = conceptId
    ? await supabase.rpc("link_post_to_concept", { p_concept_id: conceptId, p_instagram_post_id: postId })
    : await supabase.rpc("dismiss_post_idea_prompt", { p_instagram_post_id: postId });
  if (error) {
    const status = error.code === "P0002" ? 404 : error.code === "42501" ? 403 : error.code === "22023" ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  const board = await loadBoard(supabase, artistId);
  await trackUsage({
    supabase,
    userId: user.id,
    artistId,
    eventType: conceptId ? "post_linked_to_idea" : "post_not_an_idea",
    metadata: { instagram_post_id: postId, ...(conceptId ? { concept_id: conceptId } : {}) },
  });
  return NextResponse.json({ board });
}
