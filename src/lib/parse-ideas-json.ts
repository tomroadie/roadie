import type { ContentIdea } from "@/types/content-plan";

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/m.exec(trimmed);
  if (fence) {
    return fence[1].trim();
  }
  return trimmed;
}

export function normalizeIdeasFromDb(raw: unknown): ContentIdea[] | null {
  if (!Array.isArray(raw)) return null;
  const ideas = raw.filter(isIdea);
  return ideas.length ? ideas : null;
}

function isIdea(x: unknown): x is ContentIdea {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.format === "string" &&
    typeof o.hook === "string" &&
    typeof o.caption === "string" &&
    typeof o.why === "string" &&
    typeof o.timing === "string"
  );
}

export function parseIdeasJson(text: string): ContentIdea[] {
  const inner = stripCodeFence(text);
  const parsed: unknown = JSON.parse(inner);
  const arr = Array.isArray(parsed) ? parsed : null;
  if (!arr) {
    throw new Error("Response is not a JSON array");
  }
  const ideas = arr.filter(isIdea);
  if (ideas.length === 0) {
    throw new Error("No valid content ideas in response");
  }
  return ideas;
}
