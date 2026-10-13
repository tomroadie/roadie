import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadConceptContext } from "./context";
import {
  buildConceptPrompt,
  buildReplacementPrompt,
  CONCEPT_SYSTEM_PROMPT,
  POOL_SIZE,
} from "./prompt";
import type {
  Concept,
  ConceptContext,
  ConceptExecution,
  ConceptPool,
  Effort,
  ExecutionFormat,
  GenerateResult,
} from "./types";

/** Same model the weekly plan uses; override with CONCEPT_MODEL to compare. */
/** Weekly ideas are the product, written once a week per artist: use the strongest model. */
const DEFAULT_MODEL = "claude-opus-5-5";
/** If the default isn't available on this API key, fall back rather than fail. */
const FALLBACK_MODEL = "claude-sonnet-4-5";
/** The board needs three cards plus spares; below this the run has failed. */
const MIN_VALID_CONCEPTS = 3;
/** Fewer everyday (non-news) posts than this and everyday concepts may be starting points. */
export const THIN_EVERYDAY = 3;

const FORMATS: ExecutionFormat[] = ["reel", "carousel", "photo", "story", "text"];
const EFFORTS: Effort[] = ["low", "medium", "high"];

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function extractJson(text: string): unknown {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in response");
  return JSON.parse(t.slice(start, end + 1));
}

function normaliseFormat(v: unknown): ExecutionFormat | null {
  const f = str(v).toLowerCase();
  if (FORMATS.includes(f as ExecutionFormat)) return f as ExecutionFormat;
  if (f === "image" || f === "post") return "photo";
  if (f === "video" || f === "reels") return "reel";
  return null;
}

/**
 * Checks the model output against the context and keeps only concepts that
 * hold up. Evidence must point at posts that exist; this is what stops the
 * "why" lines inventing patterns.
 */
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const GENERIC = new Set(["show", "gig", "the", "and", "with", "live", "release", "single", "session", "studio", "launch", "night", "date", "from", "your", "tour"]);

/** Does the text name this key date: a distinctive word from its title, or its day and month? */
export function mentionsKeyDate(text: string, kd: { date: string; title: string }): boolean {
  const t = text.toLowerCase();
  const words = kd.title
    .toLowerCase()
    .split(/[^a-z0-9\u00c0-\u024f]+/)
    .filter((w) => w.length >= 4 && !GENERIC.has(w));
  if (words.some((w) => t.includes(w))) return true;
  const [, m, d] = kd.date.split("-").map(Number);
  const mon = MONTHS[m - 1];
  return new RegExp(`\\b${d}(st|nd|rd|th)?\\s+${mon}|\\b${mon}[a-z]*\\s+${d}\\b`).test(t);
}

/**
 * Orders a pool for the board, which takes the first three: the concept for
 * the nearest key date first, then ones whose evidence doesn't overlap with
 * those already chosen, so the three cards stand on different posts.
 */
export function orderForBoard(concepts: Concept[], boardSize = 3): Concept[] {
  const rest = [...concepts];
  const chosen: Concept[] = [];
  const dated = rest
    .filter((c) => c.key_date)
    .sort((a, b) => String(a.key_date).localeCompare(String(b.key_date)))[0];
  if (dated) {
    chosen.push(dated);
    rest.splice(rest.indexOf(dated), 1);
  }
  while (chosen.length < boardSize && rest.length > 0) {
    const used = new Set(chosen.flatMap((c) => c.evidence_posts));
    const next = rest.find((c) => !c.evidence_posts.some((n) => used.has(n))) ?? rest[0];
    chosen.push(next);
    rest.splice(rest.indexOf(next), 1);
  }
  return [...chosen, ...rest];
}

/** messages.create, falling back to a model that's always available if this key can't use the chosen one. */
async function createMessage(
  anthropic: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming
): Promise<Anthropic.Message> {
  try {
    return await anthropic.messages.create(params);
  } catch (e) {
    const status = (e as { status?: number }).status;
    const msg = e instanceof Error ? e.message : "";
    if (params.model !== FALLBACK_MODEL && (status === 404 || /model/i.test(msg) && status === 400)) {
      console.warn(`concepts: ${params.model} unavailable, using ${FALLBACK_MODEL}`);
      return createMessage(anthropic, { ...params, model: FALLBACK_MODEL });
    }
    throw e;
  }
}

export function validatePool(
  raw: unknown,
  ctx: ConceptContext,
  opts: { strict?: boolean; single?: boolean } = {}
): { pool: ConceptPool | null; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { pool: null, errors: ["Response is not a JSON object"], warnings };
  }
  const o = raw as Record<string, unknown>;

  let focus = str(o.focus);
  if (!focus) errors.push("Missing focus line");
  if (focus.length > 120) {
    warnings.push(`Focus line was ${focus.length} chars; trimmed`);
    focus = `${focus.slice(0, 117).trimEnd()}…`;
  }

  const validPostNumbers = new Set(ctx.posts.map((p) => p.n));
  const newsPosts = new Set(ctx.posts.filter((p) => p.news).map((p) => p.n));
  // An artist who only posts news has little everyday evidence; ideas for
  // the gaps between announcements are then honest starting points.
  const thinEveryday = ctx.posts.length - newsPosts.size < THIN_EVERYDAY;
  const validDates = new Set(ctx.keyDates.map((d) => d.date));
  const rawConcepts = Array.isArray(o.concepts) ? o.concepts : [];
  const concepts: Concept[] = [];
  const seenTitles = new Set<string>();

  rawConcepts.forEach((rc, i) => {
    const label = `Concept ${i + 1}`;
    if (!rc || typeof rc !== "object") {
      errors.push(`${label}: not an object`);
      return;
    }
    const c = rc as Record<string, unknown>;
    const title = str(c.title);
    const why = str(c.why);
    if (!title || !why) {
      errors.push(`${label}: missing title or why`);
      return;
    }
    const titleKey = title.toLowerCase();
    if (seenTitles.has(titleKey)) {
      errors.push(`${label}: duplicate of an earlier concept`);
      return;
    }

    // Artists read the why and never see post numbers.
    if (/\bposts?\s*#?\d+/i.test(why)) {
      const msg = `${label} ("${title}"): why mentions a post number`;
      if (opts.strict) {
        errors.push(msg);
        return;
      }
      warnings.push(msg);
    }

    // NEWS and STANDOUT are our labels, not the artist's.
    if (/\b(STANDOUT|NEWS)\b/.test(why) || /\bmarked (as )?(standout|news)\b/i.test(why)) {
      const msg = `${label} ("${title}"): why uses an internal label (NEWS/STANDOUT)`;
      if (opts.strict) {
        errors.push(msg);
        return;
      }
      warnings.push(msg);
    }

    const evidenceRaw = Array.isArray(c.evidence_posts) ? c.evidence_posts : [];
    let evidence = evidenceRaw.map(Number).filter(Number.isInteger);
    const bogus = evidence.filter((n) => !validPostNumbers.has(n));
    if (bogus.length > 0) {
      errors.push(`${label} ("${title}"): cites posts that don't exist (${bogus.join(", ")})`);
      return;
    }

    // A release-day spike can't prove an everyday technique.
    const aboutNews = c.about_news === true;
    const newsCited = evidence.filter((n) => newsPosts.has(n));
    if (!aboutNews && newsCited.length > 0) {
      const msg = `${label} ("${title}"): isn't about news but cites news posts (${newsCited.join(", ")})`;
      if (opts.strict) {
        errors.push(msg);
        return;
      }
      warnings.push(`${msg}; those posts were removed from its evidence`);
      evidence = evidence.filter((n) => !newsPosts.has(n));
      // Its why still talks about the news posts, so it can't stand as a starting point.
      if (evidence.length === 0) {
        errors.push(`${label} ("${title}"): no evidence left once news posts were removed`);
        return;
      }
    }

    let basis: Concept["basis"] =
      str(c.basis) === "starting_point" ? "starting_point" : "from_data";
    if (basis === "from_data" && evidence.length === 0) {
      if (ctx.coldStart || (thinEveryday && !aboutNews)) {
        basis = "starting_point";
      } else {
        errors.push(`${label} ("${title}"): no evidence posts`);
        return;
      }
    }

    const executions: ConceptExecution[] = (
      Array.isArray(c.executions) ? c.executions : []
    )
      .map((e) => {
        if (!e || typeof e !== "object") return null;
        const er = e as Record<string, unknown>;
        const format = normaliseFormat(er.format);
        const idea = str(er.idea);
        const effort = str(er.effort).toLowerCase() as Effort;
        if (!format || !idea) return null;
        return {
          format,
          idea,
          effort: EFFORTS.includes(effort) ? effort : "medium",
        };
      })
      .filter((e): e is ConceptExecution => e !== null)
      .slice(0, 3);

    if (executions.length < 2) {
      errors.push(`${label} ("${title}"): needs two or three executions`);
      return;
    }
    if (!executions.some((e) => e.effort === "low")) {
      errors.push(`${label} ("${title}"): no low-effort execution`);
      return;
    }

    let keyDate = str(c.key_date) || null;
    if (keyDate && !validDates.has(keyDate)) {
      warnings.push(`${label}: key_date ${keyDate} isn't a known date; cleared`);
      keyDate = null;
    }
    // A date only belongs on a concept that's about it. A news concept is;
    // anything else has to name the date or the event somewhere.
    if (keyDate && !aboutNews) {
      const kd = ctx.keyDates.find((d) => d.date === keyDate);
      const text = [title, why, ...executions.map((e) => e.idea)].join(" ");
      if (kd && !mentionsKeyDate(text, kd)) {
        warnings.push(`${label} ("${title}"): key_date ${keyDate} doesn't fit what it's about; cleared`);
        keyDate = null;
      }
    }

    seenTitles.add(titleKey);
    concepts.push({
      title,
      why,
      evidence_posts: [...new Set(evidence)],
      executions,
      key_date: keyDate,
      basis,
      about_news: aboutNews,
    });
  });

  // A single replacement doesn't have to cover the key date; the rest of the draft may.
  const missingKeyDate =
    !opts.single && ctx.keyDates.length > 0 && !concepts.some((c) => c.key_date);
  if (missingKeyDate) errors.push("No concept serves the upcoming key date");

  // One spike explained several different ways is a sign the model is
  // reading causes into noise. Two is a flag for review; three is a retry.
  const citedBy = new Map<number, string[]>();
  for (const c of concepts) {
    for (const n of c.evidence_posts) {
      citedBy.set(n, [...(citedBy.get(n) ?? []), c.title]);
    }
  }
  const newsConcepts = concepts.filter((c) => c.about_news).length;
  const tooMuchNews = newsConcepts > 2;
  if (tooMuchNews) errors.push(`${newsConcepts} concepts are about news; at most two should be`);

  let overCited = false;
  for (const [n, titles] of citedBy) {
    // With only one or two everyday posts, each may back one concept.
    const limit = thinEveryday && !newsPosts.has(n) ? 2 : 3;
    if (titles.length >= limit) {
      overCited = true;
      errors.push(`Post ${n} is the evidence for ${titles.length} different concepts`);
    } else if (titles.length === 2) {
      warnings.push(`Post ${n} backs two concepts: "${titles[0]}" and "${titles[1]}"`);
    }
  }

  // Strict (first attempt): anything short of a full, date-aware pool is
  // worth one retry. Lenient (retry): accept what holds up.
  const needed = opts.single ? 1 : opts.strict ? POOL_SIZE : MIN_VALID_CONCEPTS;
  if (
    !focus ||
    concepts.length < needed ||
    (opts.strict && (missingKeyDate || overCited || tooMuchNews))
  ) {
    return { pool: null, errors, warnings };
  }

  // Concepts that failed are reported but don't sink the run if enough survive.
  warnings.push(...errors);
  return {
    pool: {
      focus,
      focus_why: str(o.focus_why),
      concepts: concepts.slice(0, POOL_SIZE),
    },
    errors: [],
    warnings,
  };
}

/**
 * Generates a concept pool for one artist. Nothing is saved; callers decide
 * what to do with the result. Retries once, telling the model what was wrong.
 */
export async function generateConceptPool(
  supabase: SupabaseClient,
  artistId: string,
  opts: { apiKey?: string; model?: string; now?: Date; note?: string } = {}
): Promise<GenerateResult> {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  const model = opts.model ?? process.env.CONCEPT_MODEL ?? DEFAULT_MODEL;
  const now = opts.now ?? new Date();

  const context = await loadConceptContext(supabase, artistId, now);
  const prompt = buildConceptPrompt(context, now.toISOString().slice(0, 10), { note: opts.note });
  const anthropic = new Anthropic({ apiKey });

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
  let lastErrors: string[] = [];

  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await createMessage(anthropic, {
      model,
      max_tokens: 4096,
      system: CONCEPT_SYSTEM_PROMPT,
      messages,
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsed: unknown;
    try {
      parsed = extractJson(text);
    } catch (e) {
      lastErrors = [`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`];
    }

    if (parsed !== undefined) {
      const { pool, errors, warnings } = validatePool(parsed, context, {
        strict: attempt === 1,
      });
      if (pool) {
        return { pool: { ...pool, concepts: orderForBoard(pool.concepts) }, context, warnings, attempts: attempt, model };
      }
      lastErrors = errors;
    }

    messages.push(
      { role: "assistant", content: text },
      {
        role: "user",
        content: `That didn't pass checks:\n${lastErrors.map((e) => `- ${e}`).join("\n")}\nSend the full JSON again with these fixed. Only cite post numbers from the list.`,
      }
    );
  }

  throw new Error(`Concept generation failed: ${lastErrors.join("; ")}`);
}

/**
 * One new concept to replace a weak one in a draft. `ctx` should carry the
 * draft's own post list so evidence numbers match the rest of the draft.
 */
export async function generateReplacementConcept(
  ctx: ConceptContext,
  input: { focus: string; keep: Concept[]; replacing: Concept; note?: string },
  opts: { apiKey?: string; model?: string; now?: Date } = {}
): Promise<{ concept: Concept; warnings: string[]; model: string }> {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  const model = opts.model ?? process.env.CONCEPT_MODEL ?? DEFAULT_MODEL;
  const now = opts.now ?? new Date();
  const anthropic = new Anthropic({ apiKey });

  const taken = new Set([...input.keep, input.replacing].map((c) => c.title.trim().toLowerCase()));
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: buildReplacementPrompt(ctx, now.toISOString().slice(0, 10), input) },
  ];
  let lastErrors: string[] = [];

  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await createMessage(anthropic, {
      model,
      max_tokens: 1500,
      system: CONCEPT_SYSTEM_PROMPT,
      messages,
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    try {
      const parsed = extractJson(text) as Record<string, unknown>;
      const { pool, errors, warnings } = validatePool(
        { focus: input.focus, concepts: [parsed.concept] },
        ctx,
        { strict: attempt === 1, single: true }
      );
      const concept = pool?.concepts[0];
      if (concept && taken.has(concept.title.toLowerCase())) {
        lastErrors = [`"${concept.title}" is already on the list`];
      } else if (concept) {
        // Flag evidence the rest of the draft already leans on.
        for (const n of concept.evidence_posts) {
          const others = input.keep.filter((c) => c.evidence_posts.includes(n));
          if (others.length > 0) {
            warnings.push(`Post ${n} also backs "${others.map((c) => c.title).join('" and "')}"`);
          }
        }
        return { concept, warnings, model };
      } else {
        lastErrors = errors.length ? errors : ["No usable concept"];
      }
    } catch (e) {
      lastErrors = [`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`];
    }

    messages.push(
      { role: "assistant", content: text },
      {
        role: "user",
        content: `That didn't pass checks:\n${lastErrors.map((e) => `- ${e}`).join("\n")}\nSend the JSON again with these fixed. Only cite post numbers from the list.`,
      }
    );
  }

  throw new Error(`Couldn't write a replacement: ${lastErrors.join("; ")}`);
}
