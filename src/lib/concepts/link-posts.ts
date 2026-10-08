import type { SupabaseClient } from "@supabase/supabase-js";

/** How far either side of "I posted this" a synced post can be and still match. */
export const LINK_WINDOW_DAYS = 3;
const DAY_MS = 86400000;

type Marked = { id: string; postedAt: number };
type Synced = { id: string; postedAt: number };

/**
 * Pairs ideas marked "I posted this" with synced Instagram posts: closest in
 * time first, each post and each idea used once, never further apart than
 * LINK_WINDOW_DAYS. Pure, so it can be tested on its own.
 */
export function pairIdeasWithPosts(marked: Marked[], synced: Synced[]): { conceptId: string; postId: string }[] {
  const candidates: { conceptId: string; postId: string; gap: number }[] = [];
  for (const m of marked) {
    for (const s of synced) {
      const gap = Math.abs(m.postedAt - s.postedAt);
      if (gap <= LINK_WINDOW_DAYS * DAY_MS) candidates.push({ conceptId: m.id, postId: s.id, gap });
    }
  }
  candidates.sort((a, b) => a.gap - b.gap);

  const usedConcepts = new Set<string>();
  const usedPosts = new Set<string>();
  const pairs: { conceptId: string; postId: string }[] = [];
  for (const c of candidates) {
    if (usedConcepts.has(c.conceptId) || usedPosts.has(c.postId)) continue;
    usedConcepts.add(c.conceptId);
    usedPosts.add(c.postId);
    pairs.push({ conceptId: c.conceptId, postId: c.postId });
  }
  return pairs;
}

/**
 * Links an artist's posted board ideas to the Instagram posts they became.
 * Safe to run repeatedly; ideas and posts already linked are left alone.
 */
export async function linkPostsToConcepts(
  admin: SupabaseClient,
  artistId: string
): Promise<{ linked: number; error: string | null }> {
  const since = new Date(Date.now() - 60 * DAY_MS).toISOString();

  const [{ data: concepts, error: cErr }, { data: posts, error: pErr }, { data: taken, error: tErr }] =
    await Promise.all([
      admin
        .from("concepts")
        .select("id, posted_at")
        .eq("artist_id", artistId)
        .eq("status", "posted")
        .is("instagram_post_id", null)
        .gte("posted_at", since),
      admin
        .from("post_performance")
        .select("instagram_post_id, post_date")
        .eq("artist_id", artistId)
        .gte("post_date", new Date(Date.parse(since) - LINK_WINDOW_DAYS * DAY_MS).toISOString()),
      admin
        .from("concepts")
        .select("instagram_post_id")
        .eq("artist_id", artistId)
        .not("instagram_post_id", "is", null),
    ]);
  const error = cErr ?? pErr ?? tErr;
  if (error) return { linked: 0, error: error.message };
  if (!concepts?.length || !posts?.length) return { linked: 0, error: null };

  const alreadyLinked = new Set((taken ?? []).map((t) => String(t.instagram_post_id)));
  const pairs = pairIdeasWithPosts(
    concepts
      .filter((c) => c.posted_at)
      .map((c) => ({ id: String(c.id), postedAt: Date.parse(String(c.posted_at)) })),
    posts
      .filter((p) => p.post_date && !alreadyLinked.has(String(p.instagram_post_id)))
      .map((p) => ({ id: String(p.instagram_post_id), postedAt: Date.parse(String(p.post_date)) }))
  );

  let linked = 0;
  for (const pair of pairs) {
    const { error: uErr } = await admin
      .from("concepts")
      .update({ instagram_post_id: pair.postId })
      .eq("id", pair.conceptId)
      .is("instagram_post_id", null);
    if (uErr) return { linked, error: uErr.message };
    linked += 1;
  }
  return { linked, error: null };
}
