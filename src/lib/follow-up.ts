import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConceptExecution } from "@/lib/concepts/types";

export type FollowUp = {
  conceptId: string;
  title: string;
  /** The easiest way to make it. */
  idea: string;
  source: "pinned" | "board";
  /** Same concept (theme) as the post that did well. */
  sameTheme: boolean;
};

type Row = { id: string; title: string; executions: unknown; theme_id: string | null; status: string };

function easiest(executions: unknown): string | null {
  const list = (Array.isArray(executions) ? executions : []) as ConceptExecution[];
  return (list.find((e) => e.effort === "low") ?? list[0])?.idea ?? null;
}

/**
 * The idea to follow a good post with: something they already said yes to
 * (pinned) before something new, and the same concept as the post before
 * anything else. Null when there's nothing on the board or shelf.
 */
export async function pickFollowUp(
  supabase: SupabaseClient,
  artistId: string,
  instagramPostId: string
): Promise<FollowUp | null> {
  const [{ data: post }, { data: ideas }] = await Promise.all([
    supabase
      .from("post_performance")
      .select("theme_id")
      .eq("artist_id", artistId)
      .eq("instagram_post_id", instagramPostId)
      .maybeSingle(),
    supabase
      .from("concepts")
      .select("id, title, executions, theme_id, status")
      .eq("artist_id", artistId)
      .in("status", ["pinned", "board"])
      .order("pinned_at", { ascending: false, nullsFirst: false })
      .order("slot", { ascending: true }),
  ]);
  const themeId = post?.theme_id ? String(post.theme_id) : null;
  const rows = (ideas ?? []) as Row[];
  const rank = (r: Row) => (r.status === "pinned" ? 0 : 2) + (themeId && r.theme_id === themeId ? 0 : 1);
  const best = [...rows].sort((a, b) => rank(a) - rank(b))[0];
  if (!best) return null;
  const idea = easiest(best.executions);
  if (!idea) return null;
  return {
    conceptId: best.id,
    title: best.title,
    idea,
    source: best.status === "pinned" ? "pinned" : "board",
    sameTheme: Boolean(themeId && best.theme_id === themeId),
  };
}
