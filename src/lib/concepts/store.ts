import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Concept,
  ConceptExecution,
  GenerateResult,
} from "./types";

/**
 * Saves a generator run as a draft. Nothing reaches the artist until
 * publishGeneration() is called. Needs a service-role client.
 */
export async function saveDraftGeneration(
  admin: SupabaseClient,
  result: GenerateResult,
  createdBy: string | null,
  extra: Record<string, unknown> = { kind: "manual" }
): Promise<string> {
  const { context, pool } = result;

  const { data: gen, error: genError } = await admin
    .from("concept_generations")
    .insert({
      artist_id: context.artistId,
      focus: pool.focus,
      focus_why: pool.focus_why || null,
      status: "draft",
      model: result.model,
      attempts: result.attempts,
      warnings: result.warnings,
      context_summary: {
        post_source: context.postSource,
        posts: context.posts.length,
        news_posts: context.posts.filter((p) => p.news).length,
        posts_last_28_days: context.postsLast28Days,
        days_since_last_post: context.daysSinceLastPost,
        weekly_target: context.weeklyTarget,
        cold_start: context.coldStart,
        key_dates: context.keyDates.length,
        audit_created_at: context.auditCreatedAt,
        ...extra,
        // What the generator saw, so a draft can be reviewed with its evidence.
        snapshot: {
          posts: context.posts,
          key_dates: context.keyDates,
          artist_name: context.artistName,
        },
      },
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (genError || !gen) {
    throw new Error(`save generation: ${genError?.message ?? "no row"}`);
  }

  const rows = pool.concepts.map((c, i) => ({
    artist_id: context.artistId,
    generation_id: gen.id,
    position: i + 1,
    title: c.title,
    why: c.why,
    evidence_posts: c.evidence_posts,
    executions: c.executions,
    key_date: c.key_date,
    basis: c.basis,
    about_news: c.about_news,
  }));

  const { error: conceptsError } = await admin.from("concepts").insert(rows);
  if (conceptsError) {
    await admin.from("concept_generations").delete().eq("id", gen.id);
    throw new Error(`save concepts: ${conceptsError.message}`);
  }

  return gen.id as string;
}

/**
 * Puts a draft live: retires the previous board and pool (pins stay),
 * deals three cards and switches the board on for the artist.
 */
export async function publishGeneration(
  admin: SupabaseClient,
  generationId: string
): Promise<{ artistId: string }> {
  const { data: gen, error } = await admin
    .from("concept_generations")
    .select("artist_id, status, context_summary")
    .eq("id", generationId)
    .maybeSingle();
  if (error || !gen) throw new Error("Generation not found");
  if (gen.status !== "draft") {
    throw new Error(`Only drafts can be published (this one is ${gen.status})`);
  }

  const { error: rpcError } = await admin.rpc("publish_concept_generation", {
    p_generation_id: generationId,
  });
  if (rpcError) throw new Error(`publish: ${rpcError.message}`);

  const { error: flagError } = await admin
    .from("profiles")
    .update({ board_enabled: true })
    .eq("id", gen.artist_id);
  if (flagError) throw new Error(`enable board: ${flagError.message}`);

  // First board: keep the starting target the generator worked out, so Home
  // and the weekly job agree. An existing target is left alone.
  const summary = (gen.context_summary ?? {}) as Record<string, unknown>;
  const startTarget = Number(summary.weekly_target);
  if (Number.isInteger(startTarget) && startTarget > 0) {
    const { error: tErr } = await admin
      .from("profiles")
      .update({ weekly_target: startTarget })
      .eq("id", gen.artist_id)
      .is("weekly_target", null);
    if (tErr) throw new Error(`target: ${tErr.message}`);
  }

  return { artistId: gen.artist_id as string };
}

// ---------------------------------------------------------------------------
// Reading the board (works with an artist's own RLS-scoped client)
// ---------------------------------------------------------------------------

export type BoardConcept = Omit<Concept, "evidence_posts"> & {
  id: string;
  slot: number | null;
  pinned_at: string | null;
};

export type BoardState = {
  focus: string | null;
  liveSince: string | null;
  /** Index 0-2 = slots 1-3; null when a slot is empty. */
  cards: (BoardConcept | null)[];
  shelf: BoardConcept[];
};

type ConceptRow = {
  id: string;
  title: string;
  why: string;
  executions: unknown;
  key_date: string | null;
  basis: "from_data" | "starting_point";
  about_news: boolean;
  slot: number | null;
  pinned_at: string | null;
};

function toBoardConcept(r: ConceptRow): BoardConcept {
  return {
    id: r.id,
    title: r.title,
    why: r.why,
    executions: (Array.isArray(r.executions) ? r.executions : []) as ConceptExecution[],
    key_date: r.key_date,
    basis: r.basis,
    about_news: r.about_news,
    slot: r.slot,
    pinned_at: r.pinned_at,
  };
}

const CONCEPT_COLUMNS =
  "id, title, why, executions, key_date, basis, about_news, slot, pinned_at";

export async function loadBoard(
  supabase: SupabaseClient,
  artistId: string
): Promise<BoardState> {
  const [genRes, boardRes, shelfRes] = await Promise.all([
    supabase
      .from("concept_generations")
      .select("focus, published_at")
      .eq("artist_id", artistId)
      .eq("status", "live")
      .maybeSingle(),
    supabase
      .from("concepts")
      .select(CONCEPT_COLUMNS)
      .eq("artist_id", artistId)
      .eq("status", "board"),
    supabase
      .from("concepts")
      .select(CONCEPT_COLUMNS)
      .eq("artist_id", artistId)
      .eq("status", "pinned")
      .order("pinned_at", { ascending: false }),
  ]);

  const firstError = genRes.error ?? boardRes.error ?? shelfRes.error;
  if (firstError) throw new Error(firstError.message);

  const cards: (BoardConcept | null)[] = [null, null, null];
  for (const row of (boardRes.data ?? []) as ConceptRow[]) {
    if (row.slot && row.slot >= 1 && row.slot <= 3) {
      cards[row.slot - 1] = toBoardConcept(row);
    }
  }

  return {
    focus: genRes.data?.focus ?? null,
    liveSince: genRes.data?.published_at ?? null,
    cards,
    shelf: ((shelfRes.data ?? []) as ConceptRow[]).map(toBoardConcept),
  };
}
