import type { SupabaseClient } from "@supabase/supabase-js";

/** Same as the weekly job's review window (kept here to avoid loading the email code). */
const REVIEW_WINDOW_HOURS = Number(process.env.CONCEPT_REVIEW_WINDOW_HOURS ?? 24);
import { boardWeek } from "@/lib/board-week";

/**
 * Admin's "This week": every live artist's week, with any drafted week
 * waiting to go out, when it will publish itself, and whether it's held.
 */
export type WeekRow = {
  artistId: string;
  artistName: string;
  handle: string | null;
  weekStart: string;
  target: number | null;
  posted: number;
  quiet: boolean;
  liveSince: string | null;
  draft: {
    generationId: string;
    createdAt: string;
    publishesAt: string | null;
    held: boolean;
    kind: string | null;
    focus: string | null;
    ideas: { id: string; title: string; why: string | null; executions: unknown }[];
  } | null;
};

export async function loadThisWeek(admin: SupabaseClient, now: Date = new Date()): Promise<WeekRow[]> {
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, artist_name, instagram_handle, account_type, week_start_day, weekly_target, quiet_week_start")
    .eq("board_enabled", true)
    .order("artist_name");
  const artists = (profiles ?? []).filter((p) => !p.account_type || p.account_type === "artist");
  if (artists.length === 0) return [];
  const ids = artists.map((p) => String(p.id));

  const [{ data: gens }, { data: posts }] = await Promise.all([
    admin
      .from("concept_generations")
      .select("id, artist_id, status, created_at, published_at, held, focus, kind:context_summary->>kind")
      .in("artist_id", ids)
      .gte("created_at", new Date(now.getTime() - 21 * 86400000).toISOString())
      .order("created_at", { ascending: false }),
    admin
      .from("post_performance")
      .select("artist_id, post_date")
      .in("artist_id", ids)
      .gte("post_date", new Date(now.getTime() - 8 * 86400000).toISOString()),
  ]);

  const draftIds: string[] = [];
  const pick = new Map<string, { draft: (typeof gens extends (infer T)[] | null ? T : never) | null; live: string | null }>();
  for (const id of ids) {
    const mine = (gens ?? []).filter((g) => String(g.artist_id) === id);
    const live = mine.find((g) => g.status !== "draft");
    const draft = mine.find((g) => g.status === "draft" && (!live || String(g.created_at) > String(live.created_at))) ?? null;
    if (draft) draftIds.push(String(draft.id));
    pick.set(id, { draft, live: live ? String(live.published_at ?? live.created_at) : null });
  }

  const { data: ideas } = draftIds.length
    ? await admin.from("concepts").select("id, generation_id, title, why, executions, position").in("generation_id", draftIds).order("position")
    : { data: [] as { id: string; generation_id: string; title: string; why: string | null; executions: unknown }[] };

  return artists.map((p) => {
    const id = String(p.id);
    const week = boardWeek(p.week_start_day, now);
    const posted = (posts ?? []).filter(
      (r) => String(r.artist_id) === id && r.post_date && String(r.post_date).slice(0, 10) >= week.start
    ).length;
    const { draft, live } = pick.get(id)!;
    const createdAt = draft ? String(draft.created_at) : null;
    const autoKind = draft?.kind === "weekly" || draft?.kind === "first";
    return {
      artistId: id,
      artistName: String(p.artist_name ?? ""),
      handle: p.instagram_handle ? String(p.instagram_handle).replace(/^@/, "") : null,
      weekStart: week.start,
      target: typeof p.weekly_target === "number" ? p.weekly_target : null,
      posted,
      quiet: p.quiet_week_start === week.start,
      liveSince: live,
      draft: draft
        ? {
            generationId: String(draft.id),
            createdAt: createdAt!,
            publishesAt: autoKind ? new Date(Date.parse(createdAt!) + REVIEW_WINDOW_HOURS * 3600000).toISOString() : null,
            held: draft.held === true,
            kind: draft.kind ? String(draft.kind) : null,
            focus: draft.focus ? String(draft.focus) : null,
            ideas: (ideas ?? [])
              .filter((i) => String(i.generation_id) === String(draft.id))
              .map((i) => ({ id: String(i.id), title: String(i.title), why: i.why ? String(i.why) : null, executions: i.executions })),
          }
        : null,
    };
  });
}
