import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadConceptContext } from "./context";
import {
  buildConceptPrompt,
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
const DEFAULT_MODEL = "claude-sonnet-4-5";
/** The board needs three cards plus spares; below this the run has failed. */
const MIN_VALID_CONCEPTS = 3;

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
export function validatePool(
  raw: unknown,
  ctx: ConceptContext,
  opts: { strict?: boolean } = {}
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
      if (evidence.length === 0 && !ctx.coldStart) {
        errors.push(`${label} ("${title}"): no evidence left once news posts were removed`);
        return;
      }
    }

    let basis: Concept["basis"] =
      str(c.basis) === "starting_point" ? "starting_point" : "from_data";
    if (basis === "from_data" && evidence.length === 0) {
      if (ctx.coldStart) {
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

  const missingKeyDate =
    ctx.keyDates.length > 0 && !concepts.some((c) => c.key_date);
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
    if (titles.length >= 3) {
      overCited = true;
      errors.push(`Post ${n} is the evidence for ${titles.length} different concepts`);
    } else if (titles.length === 2) {
      warnings.push(`Post ${n} backs two concepts: "${titles[0]}" and "${titles[1]}"`);
    }
  }

  // Strict (first attempt): anything short of a full, date-aware pool is
  // worth one retry. Lenient (retry): accept what holds up.
  const needed = opts.strict ? POOL_SIZE : MIN_VALID_CONCEPTS;
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
  opts: { apiKey?: string; model?: string; now?: Date } = {}
): Promise<GenerateResult> {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  const model = opts.model ?? process.env.CONCEPT_MODEL ?? DEFAULT_MODEL;
  const now = opts.now ?? new Date();

  const context = await loadConceptContext(supabase, artistId, now);
  const prompt = buildConceptPrompt(context, now.toISOString().slice(0, 10));
  const anthropic = new Anthropic({ apiKey });

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
  let lastErrors: string[] = [];

  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await anthropic.messages.create({
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
        return { pool, context, warnings, attempts: attempt, model };
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
