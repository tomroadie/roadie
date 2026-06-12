const KNOWN_SECTIONS = [
  "Positioning",
  "Content Pattern",
  "Engagement Reality",
  "The Hidden Pattern",
  "THE HIDDEN PATTERN",
  "Biggest Missed Opportunity",
  "What Happens If Nothing Changes",
  "WHAT HAPPENS IF NOTHING CHANGES",
  "Your Next Move",
  "Core Problem",
  "Core Opportunity",
  "Opportunity",
] as const;

export type ParsedAnalysisSection = {
  title: string;
  body: string;
};

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Split on **Positioning**-style headers for known sections; else plain text. */
export function parseFullAnalysisText(text: string): ParsedAnalysisSection[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const alternation = KNOWN_SECTIONS.map(escapeRe).join("|");
  const headerRe = new RegExp(
    `\\*\\*(${alternation})\\*\\*`,
    "gi"
  );

  function normalizeTitle(raw: string) {
    const lower = raw.trim().toLowerCase();
    const hit = KNOWN_SECTIONS.find((k) => k.toLowerCase() === lower);
    return hit ?? raw.trim();
  }

  const matches: { index: number; title: string; headerLen: number }[] = [];
  let m: RegExpExecArray | null;
  for (;;) {
    m = headerRe.exec(trimmed);
    if (!m) break;
    matches.push({
      index: m.index,
      title: normalizeTitle(m[1]),
      headerLen: m[0].length,
    });
  }

  if (matches.length === 0) {
    return [{ title: "Analysis", body: trimmed }];
  }

  const sections: ParsedAnalysisSection[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].headerLen;
    const end =
      i + 1 < matches.length ? matches[i + 1].index : trimmed.length;
    let body = trimmed.slice(start, end).trim();
    if (i === 0 && matches[0].index > 0) {
      const preamble = trimmed.slice(0, matches[0].index).trim();
      if (preamble) {
        body = `${preamble}\n\n${body}`.trim();
      }
    }
    sections.push({
      title: matches[i].title,
      body: body || "—",
    });
  }

  return sections;
}

/** Extract up to 3 teaser actions from the Your Next Move section for upgrade copy. */
export function extractNextMoveTeasers(
  sections: ParsedAnalysisSection[]
): string[] {
  const nextMove = sections.find((s) =>
    s.title.toLowerCase().includes("next move")
  );
  if (!nextMove?.body.trim()) return [];

  const lines = nextMove.body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-•*]\s*/, "").replace(/^\d+[.)]\s*/, ""));

  if (lines.length >= 2) return lines.slice(0, 3);

  const sentences = nextMove.body
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  return sentences.slice(0, 3);
}
