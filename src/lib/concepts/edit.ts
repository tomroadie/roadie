import type { SupabaseClient } from "@supabase/supabase-js";
import { loadConceptContext } from "./context";
import { generateConceptPool, generateReplacementConcept } from "./generate";
import { conceptRows, contextSnapshot, contextStats } from "./store";
import type {
  Concept,
  ConceptContext,
  ConceptExecution,
  ContextKeyDate,
  ContextPost,
  Effort,
  ExecutionFormat,
} from "./types";

/**
 * Reviewing a draft before it goes live: load it with its evidence, fix the
 * wording by hand, change which ideas take the three board slots, replace
 * one idea, or redo the whole draft with a note. Only drafts can change;
 * a live board is the artist's. Needs a service-role client.
 */

export type DraftConcept = Concept & { id: string; position: number };

export type DraftView = {
  generation_id: string;
  status: string;
  kind: string;
  created_at: string;
  pool: { focus: string; focus_why: string; concepts: DraftConcept[] };
  context: ConceptContext;
  warnings: string[];
  notes: { at: string; action: string; note: string }[];
  attempts: number;
  model: string;
  ms: number;
};

const FORMATS: ExecutionFormat[] = ["reel", "carousel", "photo", "story", "text"];
const EFFORTS: Effort[] = ["low", "medium", "high"];
const MAX_FOCUS = 120;
const MAX_TITLE = 80;
const MAX_WHY = 600;
const MAX_IDEA = 400;

type GenRow = {
  id: string;
  artist_id: string;
  focus: string;
  focus_why: string | null;
  status: string;
  model: string | null;
  attempts: number | null;
  warnings: unknown;
  context_summary: Record<string, unknown> | null;
  created_at: string;
};

async function loadGen(admin: SupabaseClient, generationId: string): Promise<GenRow> {
  const { data, error } = await admin
    .from("concept_generations")
    .select("id, artist_id, focus, focus_why, status, model, attempts, warnings, context_summary, created_at")
    .eq("id", generationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Draft not found");
  return data as GenRow;
}

async function loadDraftGen(admin: SupabaseClient, generationId: string): Promise<GenRow> {
  const gen = await loadGen(admin, generationId);
  if (gen.status !== "draft") {
    throw new Error(`Only drafts can be changed (this one is ${gen.status})`);
  }
  return gen;
}

async function loadConcepts(admin: SupabaseClient, generationId: string): Promise<DraftConcept[]> {
  const { data, error } = await admin
    .from("concepts")
    .select("id, position, title, why, evidence_posts, executions, key_date, basis, about_news")
    .eq("generation_id", generationId)
    .order("position");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    position: Number(r.position),
    title: String(r.title),
    why: String(r.why),
    evidence_posts: (r.evidence_posts ?? []) as number[],
    executions: (Array.isArray(r.executions) ? r.executions : []) as ConceptExecution[],
    key_date: r.key_date ? String(r.key_date) : null,
    basis: r.basis as Concept["basis"],
    about_news: r.about_news === true,
  }));
}

function snapshotOf(gen: GenRow) {
  const s = gen.context_summary ?? {};
  const snap = (s.snapshot ?? {}) as Record<string, unknown>;
  return {
    summary: s,
    posts: (Array.isArray(snap.posts) ? snap.posts : []) as ContextPost[],
    keyDates: (Array.isArray(snap.key_dates) ? snap.key_dates : []) as ContextKeyDate[],
    artistName: String(snap.artist_name ?? ""),
  };
}

function warningsOf(gen: GenRow): string[] {
  return Array.isArray(gen.warnings) ? gen.warnings.map(String) : [];
}

function notesOf(summary: Record<string, unknown>): DraftView["notes"] {
  return Array.isArray(summary.review_notes) ? (summary.review_notes as DraftView["notes"]) : [];
}

/** A draft in the shape the review page renders, evidence posts included. */
export async function loadDraftView(admin: SupabaseClient, generationId: string): Promise<DraftView> {
  const [gen, concepts] = await Promise.all([
    loadGen(admin, generationId),
    loadConcepts(admin, generationId),
  ]);
  const { summary: s, posts, keyDates, artistName } = snapshotOf(gen);

  const context: ConceptContext = {
    artistId: String(gen.artist_id),
    artistName,
    genre: null,
    sound: null,
    voice: null,
    confidence: null,
    contentDays: [],
    comingUpNote: null,
    handle: null,
    followers: null,
    postSource: (s.post_source as ConceptContext["postSource"]) ?? "none",
    auditCreatedAt: typeof s.audit_created_at === "string" ? s.audit_created_at : null,
    posts,
    postsLast28Days: Number(s.posts_last_28_days ?? 0),
    daysSinceLastPost: typeof s.days_since_last_post === "number" ? s.days_since_last_post : null,
    weeklyTarget: Number(s.target ?? s.weekly_target ?? 1),
    auditPattern: null,
    keyDates,
    declined: [],
    postedIdeas: [],
    pinnedIdeas: [],
    coldStart: Boolean(s.cold_start),
  };

  return {
    generation_id: gen.id,
    status: gen.status,
    kind: String(s.kind ?? "manual"),
    created_at: gen.created_at,
    pool: { focus: gen.focus, focus_why: gen.focus_why ?? "", concepts },
    context,
    warnings: warningsOf(gen),
    notes: notesOf(s),
    attempts: Number(gen.attempts ?? 1),
    model: String(gen.model ?? ""),
    ms: 0,
  };
}

// ---------------------------------------------------------------------------
// Typed edits
// ---------------------------------------------------------------------------

function clean(v: unknown, max: number, label: string): string {
  const t = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  if (!t) throw new Error(`${label} can't be empty`);
  if (t.length > max) throw new Error(`${label} is too long (${t.length}/${max} characters)`);
  return t;
}

function cleanExecutions(v: unknown): ConceptExecution[] {
  if (!Array.isArray(v)) throw new Error("Ways to do it are missing");
  const out = v
    .map((e, i) => {
      const r = (e ?? {}) as Record<string, unknown>;
      const idea = typeof r.idea === "string" ? r.idea.replace(/\s+/g, " ").trim() : "";
      if (!idea) return null; // a cleared box removes that way
      if (idea.length > MAX_IDEA) throw new Error(`Way ${i + 1} is too long`);
      const format = FORMATS.includes(r.format as ExecutionFormat) ? (r.format as ExecutionFormat) : "photo";
      const effort = EFFORTS.includes(r.effort as Effort) ? (r.effort as Effort) : "medium";
      return { format, idea, effort };
    })
    .filter((e): e is ConceptExecution => e !== null);
  if (out.length < 1 || out.length > 3) throw new Error("Each idea needs one to three ways to do it");
  return out;
}

export async function editFocus(admin: SupabaseClient, generationId: string, focus: unknown): Promise<void> {
  await loadDraftGen(admin, generationId);
  const { error } = await admin
    .from("concept_generations")
    .update({ focus: clean(focus, MAX_FOCUS, "Focus line") })
    .eq("id", generationId);
  if (error) throw new Error(error.message);
}

export async function editConcept(
  admin: SupabaseClient,
  generationId: string,
  conceptId: string,
  input: { title: unknown; why: unknown; executions: unknown }
): Promise<void> {
  await loadDraftGen(admin, generationId);
  const { error, count } = await admin
    .from("concepts")
    .update(
      {
        title: clean(input.title, MAX_TITLE, "Title"),
        why: clean(input.why, MAX_WHY, "Why"),
        executions: cleanExecutions(input.executions),
      },
      { count: "exact" }
    )
    .eq("id", conceptId)
    .eq("generation_id", generationId);
  if (error) throw new Error(error.message);
  if (!count) throw new Error("Idea not found in this draft");
}

/** Swaps an idea with its neighbour. Positions 1-3 are the board. */
export async function moveConcept(
  admin: SupabaseClient,
  generationId: string,
  conceptId: string,
  direction: "up" | "down"
): Promise<void> {
  await loadDraftGen(admin, generationId);
  const concepts = await loadConcepts(admin, generationId);
  const i = concepts.findIndex((c) => c.id === conceptId);
  if (i === -1) throw new Error("Idea not found in this draft");
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= concepts.length) return;
  const a = concepts[i];
  const b = concepts[j];
  const [r1, r2] = await Promise.all([
    admin.from("concepts").update({ position: b.position }).eq("id", a.id),
    admin.from("concepts").update({ position: a.position }).eq("id", b.id),
  ]);
  const err = r1.error ?? r2.error;
  if (err) throw new Error(err.message);
}

function withNote(summary: Record<string, unknown>, action: string, note: string | undefined) {
  const n = note?.trim();
  if (!n) return summary;
  return {
    ...summary,
    review_notes: [...notesOf(summary), { at: new Date().toISOString(), action, note: n.slice(0, 1000) }],
  };
}

// ---------------------------------------------------------------------------
// Regenerating
// ---------------------------------------------------------------------------

/** Writes a new idea in place of one, using the draft's own post list. */
export async function replaceConcept(
  admin: SupabaseClient,
  generationId: string,
  conceptId: string,
  note?: string
): Promise<void> {
  const gen = await loadDraftGen(admin, generationId);
  const concepts = await loadConcepts(admin, generationId);
  const replacing = concepts.find((c) => c.id === conceptId);
  if (!replacing) throw new Error("Idea not found in this draft");

  // Fresh context for everything the prompt says about the artist (turned
  // down ideas, shelf, dates), but the draft's own numbered posts so
  // evidence numbers line up with the ideas that stay.
  const snap = snapshotOf(gen);
  const fresh = await loadConceptContext(admin, gen.artist_id);
  const ctx: ConceptContext =
    snap.posts.length > 0 ? { ...fresh, posts: snap.posts, keyDates: snap.keyDates } : fresh;

  const { concept, warnings } = await generateReplacementConcept(ctx, {
    focus: gen.focus,
    keep: concepts.filter((c) => c.id !== conceptId),
    replacing,
    note,
  });

  const { error } = await admin
    .from("concepts")
    .update({
      title: concept.title,
      why: concept.why,
      evidence_posts: concept.evidence_posts,
      executions: concept.executions,
      key_date: concept.key_date,
      basis: concept.basis,
      about_news: concept.about_news,
    })
    .eq("id", conceptId);
  if (error) throw new Error(error.message);

  // Warnings about the old idea no longer apply.
  const kept = warningsOf(gen).filter((w) => !w.includes(`"${replacing.title}"`));
  const { error: genError } = await admin
    .from("concept_generations")
    .update({
      warnings: [...kept, ...warnings.map((w) => `New idea "${concept.title}": ${w}`)],
      context_summary: withNote(gen.context_summary ?? {}, `replace "${replacing.title}"`, note),
    })
    .eq("id", generationId);
  if (genError) throw new Error(genError.message);
}

/**
 * Redoes the whole draft from fresh data, optionally steered by a note. The
 * draft keeps its id and what kind it is (weekly target, last week's count).
 */
export async function regenerateDraft(
  admin: SupabaseClient,
  generationId: string,
  note?: string
): Promise<void> {
  const gen = await loadDraftGen(admin, generationId);
  const result = await generateConceptPool(admin, gen.artist_id, { note });

  // Re-check it's still a draft: a minute has passed and it may have been published.
  await loadDraftGen(admin, generationId);

  const { error: delError } = await admin.from("concepts").delete().eq("generation_id", generationId);
  if (delError) throw new Error(delError.message);
  const { error: insError } = await admin
    .from("concepts")
    .insert(conceptRows(gen.artist_id, generationId, result.pool.concepts));
  if (insError) throw new Error(`save concepts: ${insError.message}`);

  // Keep what kind of draft this is; refresh the numbers and evidence.
  const summary = {
    ...(gen.context_summary ?? {}),
    ...contextStats(result.context),
    snapshot: contextSnapshot(result.context),
  };
  const { error } = await admin
    .from("concept_generations")
    .update({
      focus: result.pool.focus,
      focus_why: result.pool.focus_why || null,
      model: result.model,
      attempts: result.attempts,
      warnings: result.warnings,
      context_summary: withNote(summary, "redo all", note),
    })
    .eq("id", generationId);
  if (error) throw new Error(error.message);
}
