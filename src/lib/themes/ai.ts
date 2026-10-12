import Anthropic from "@anthropic-ai/sdk";

/**
 * The two model jobs behind themes: suggesting an artist's starting themes,
 * and sorting posts and ideas into them. Both return plain JSON that is
 * checked here before anything is saved.
 */

const DEFAULT_MODEL = "claude-sonnet-4-5";
const MAX_ACTIVE = 5;

export type ThemeSuggestion = { name: string; description: string };

export type SuggestInput = {
  artistName: string;
  genre: string | null;
  auditPattern: string | null;
  /** Recent captions, newest first. */
  captions: string[];
};

export type ClassifyItem = { key: string; text: string };

function client(): { anthropic: Anthropic; model: string } {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  return {
    anthropic: new Anthropic({ apiKey }),
    model: process.env.THEME_MODEL ?? process.env.CONCEPT_MODEL ?? DEFAULT_MODEL,
  };
}

function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in response");
  return JSON.parse(t.slice(start, end + 1));
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

async function ask(system: string, prompt: string, maxTokens: number): Promise<unknown> {
  const { anthropic, model } = client();
  const res = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  return extractJson(text);
}

const SUGGEST_SYSTEM = `You help independent music artists organise their social media into a few broad content themes.
A theme is a durable area their posts live in, not a one-off idea: "Behind the record", "Live moments", "Everyday life", "Release news".
Names are 2-4 plain words, in British English, no emoji, no hashtags, no marketing jargon.
Descriptions are one short sentence (under 100 characters) saying what belongs in it, written to the artist.
Reply with JSON only.`;

/**
 * Starting themes for an artist: a handful drawn from what they already post,
 * plus at most one gap worth suggesting.
 */
export async function suggestThemes(
  input: SuggestInput
): Promise<{ active: ThemeSuggestion[]; suggested: ThemeSuggestion | null }> {
  const captions = input.captions
    .slice(0, 30)
    .map((c, i) => `${i + 1}. ${c.replace(/\s+/g, " ").slice(0, 220)}`)
    .join("\n");

  const prompt = `Artist: ${input.artistName}${input.genre ? ` (${input.genre})` : ""}

${input.auditPattern ? `What we noticed about their account:\n${input.auditPattern.slice(0, 1200)}\n\n` : ""}Recent post captions, newest first:
${captions || "(no posts yet)"}

Give 4 themes that cover what this artist already posts (or, with no posts, what most artists like them would post), and at most 1 extra theme they don't post yet but plausibly should.
Only suggest the extra theme if there's a real gap; otherwise null.

{"themes":[{"name":"","description":""}],"suggested":{"name":"","description":""} | null}`;

  const raw = (await ask(SUGGEST_SYSTEM, prompt, 800)) as Record<string, unknown>;
  const seen = new Set<string>();
  const clean = (v: unknown): ThemeSuggestion | null => {
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    const name = str(o.name, 60);
    if (!name || seen.has(name.toLowerCase())) return null;
    seen.add(name.toLowerCase());
    return { name, description: str(o.description, 200) };
  };

  const active = (Array.isArray(raw.themes) ? raw.themes : [])
    .map(clean)
    .filter((t): t is ThemeSuggestion => t !== null)
    .slice(0, MAX_ACTIVE);
  if (active.length < 2) throw new Error("Theme suggestion returned too few themes");

  return { active, suggested: clean(raw.suggested) };
}

const CLASSIFY_SYSTEM = `You sort a music artist's social posts and content ideas into their own content themes.
Pick the single theme each item fits best. Use null only when an item plainly fits none of them.
Reply with JSON only.`;

/**
 * Sorts items into the given themes. Returns a map of item key to theme
 * index (0-based), or null where nothing fits. Items the model skips are
 * left out of the map.
 */
export async function classifyIntoThemes(
  themes: { name: string; description: string | null }[],
  items: ClassifyItem[]
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  if (themes.length === 0 || items.length === 0) return out;

  const themeList = themes
    .map((t, i) => `${i + 1}. ${t.name}${t.description ? ` — ${t.description}` : ""}`)
    .join("\n");
  const itemList = items
    .map((it) => `[${it.key}] ${it.text.replace(/\s+/g, " ").slice(0, 300) || "(no caption)"}`)
    .join("\n");

  const prompt = `Themes:
${themeList}

Items:
${itemList}

{"items":[{"key":"<item key>","theme":<theme number or null>}]}`;

  const raw = (await ask(CLASSIFY_SYSTEM, prompt, 2000)) as Record<string, unknown>;
  const keys = new Set(items.map((i) => i.key));
  for (const row of Array.isArray(raw.items) ? raw.items : []) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const key = typeof r.key === "string" ? r.key : String(r.key ?? "");
    if (!keys.has(key)) continue;
    const n = typeof r.theme === "number" ? r.theme : null;
    out.set(key, n !== null && Number.isInteger(n) && n >= 1 && n <= themes.length ? n - 1 : null);
  }
  return out;
}
