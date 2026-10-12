import type { SupabaseClient } from "@supabase/supabase-js";
import { loadConceptContext } from "@/lib/concepts/context";
import { classifyIntoThemes, suggestThemes } from "./ai";

/** How many recent untagged posts one run sorts. */
const POSTS_PER_RUN = 60;

export type ThemeRefreshOutcome = {
  seeded: number;
  conceptsTagged: number;
  postsTagged: number;
};

type ThemeRow = { id: string; name: string; description: string | null };

/**
 * Keeps an artist's themes in step: seeds starting themes the first time,
 * then sorts any untagged ideas and posts into the active ones. Safe to run
 * repeatedly; it only touches rows nobody has sorted yet. Needs a
 * service-role client.
 */
export async function refreshThemesForArtist(
  admin: SupabaseClient,
  artistId: string,
  now: Date = new Date()
): Promise<ThemeRefreshOutcome> {
  const outcome: ThemeRefreshOutcome = { seeded: 0, conceptsTagged: 0, postsTagged: 0 };

  const { count: everCount, error: countErr } = await admin
    .from("content_themes")
    .select("id", { count: "exact", head: true })
    .eq("artist_id", artistId);
  if (countErr) throw new Error(`themes: ${countErr.message}`);

  // First run: suggest starting themes from their posts and audit.
  if ((everCount ?? 0) === 0) {
    const [ctx, { data: typeRow }] = await Promise.all([
      loadConceptContext(admin, artistId, now),
      admin.from("profiles").select("account_type").eq("id", artistId).maybeSingle(),
    ]);
    const { active, suggested } = await suggestThemes({
      artistName: ctx.artistName,
      accountType: typeRow?.account_type ? String(typeRow.account_type) : "artist",
      genre: ctx.genre,
      auditPattern: ctx.auditPattern,
      captions: ctx.posts.map((p) => p.caption).filter(Boolean),
    });
    const rows = [
      ...active.map((t, i) => ({
        artist_id: artistId,
        name: t.name,
        description: t.description || null,
        position: i + 1,
        status: "active",
        source: "tempo",
      })),
      ...(suggested
        ? [{
            artist_id: artistId,
            name: suggested.name,
            description: suggested.description || null,
            position: active.length + 1,
            status: "suggested",
            source: "tempo",
          }]
        : []),
    ];
    const { error } = await admin.from("content_themes").insert(rows);
    if (error) throw new Error(`seed themes: ${error.message}`);
    outcome.seeded = rows.length;
  }

  const { data: themeData, error: themeErr } = await admin
    .from("content_themes")
    .select("id, name, description")
    .eq("artist_id", artistId)
    .eq("status", "active")
    .order("position");
  if (themeErr) throw new Error(`themes: ${themeErr.message}`);
  const themes = (themeData ?? []) as ThemeRow[];
  if (themes.length === 0) return outcome;

  // Ideas that aren't under a theme yet (drafts included, so they arrive sorted).
  const { data: concepts } = await admin
    .from("concepts")
    .select("id, title, why")
    .eq("artist_id", artistId)
    .is("theme_id", null)
    .in("status", ["pool", "board", "pinned", "posted"])
    .limit(40);
  if (concepts && concepts.length > 0) {
    const map = await classifyIntoThemes(
      themes,
      concepts.map((c) => ({ key: String(c.id), text: `${c.title}. ${c.why ?? ""}` }))
    );
    for (const [id, idx] of map) {
      if (idx === null) continue;
      const { error } = await admin.from("concepts").update({ theme_id: themes[idx].id }).eq("id", id);
      if (!error) outcome.conceptsTagged++;
    }
  }

  // Posts nobody has sorted. A post linked to an idea takes the idea's theme.
  const { data: posts } = await admin
    .from("post_performance")
    .select("instagram_post_id, caption")
    .eq("artist_id", artistId)
    .is("theme_source", null)
    .not("post_date", "is", null)
    .order("post_date", { ascending: false })
    .limit(POSTS_PER_RUN);
  if (!posts || posts.length === 0) return outcome;

  const ids = posts.map((p) => String(p.instagram_post_id));
  const { data: linked } = await admin
    .from("concepts")
    .select("instagram_post_id, theme_id")
    .eq("artist_id", artistId)
    .in("instagram_post_id", ids)
    .not("theme_id", "is", null);
  const themeByLinkedPost = new Map(
    (linked ?? []).map((l) => [String(l.instagram_post_id), String(l.theme_id)])
  );

  const toClassify = posts.filter((p) => !themeByLinkedPost.has(String(p.instagram_post_id)));
  const classified = toClassify.length
    ? await classifyIntoThemes(
        themes,
        toClassify.map((p) => ({ key: String(p.instagram_post_id), text: String(p.caption ?? "") }))
      )
    : new Map<string, number | null>();

  for (const id of ids) {
    let themeId: string | null | undefined = themeByLinkedPost.get(id);
    if (themeId === undefined) {
      if (!classified.has(id)) continue; // skipped by the model: try again next run
      const idx = classified.get(id);
      themeId = idx === null || idx === undefined ? null : themes[idx].id;
    }
    const { error } = await admin
      .from("post_performance")
      .update({ theme_id: themeId, theme_source: "auto" })
      .eq("artist_id", artistId)
      .eq("instagram_post_id", id)
      .is("theme_source", null);
    if (!error) outcome.postsTagged++;
  }

  return outcome;
}
