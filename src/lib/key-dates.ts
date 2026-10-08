import Anthropic from "@anthropic-ai/sdk";
import { EVENT_TYPES, type EventType } from "@/types/event";

export type ParsedKeyDate = {
  date: string;
  title: string;
  event_type: EventType;
};

/** Small and fast is enough for pulling dates out of a sentence. */
const KEY_DATES_MODEL = process.env.KEY_DATES_MODEL ?? "claude-haiku-4-5";
const MAX_DATES = 10;

const SYSTEM = `You pull upcoming dates out of what a musician types, for their content calendar.
Return only JSON: {"dates":[{"date":"YYYY-MM-DD","title":"...","event_type":"..."}]}
- event_type is one of: ${EVENT_TYPES.join(", ")}.
- title is short and in their words ("Fleece gig", "Single out: Dreams Fade").
- Resolve relative dates ("next Friday", "the 12th") from today's date. A day and month with no year means the next time that date comes round.
- Only include things with a date you can pin down. If there's no date, leave it out.
- Return {"dates":[]} when there's nothing.`;

function isIsoDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/**
 * Turns "single out 14 Nov, Fleece gig 12th" into dated events. Never throws:
 * on any failure it returns [] and the caller keeps the raw text.
 */
export async function parseKeyDates(
  text: string,
  today: string = new Date().toISOString().slice(0, 10)
): Promise<ParsedKeyDate[]> {
  const input = text.trim().slice(0, 1000);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!input || !apiKey) return [];

  try {
    const res = await new Anthropic({ apiKey }).messages.create({
      model: KEY_DATES_MODEL,
      max_tokens: 800,
      system: SYSTEM,
      messages: [{ role: "user", content: `Today is ${today}.\n\nThey wrote:\n${input}` }],
    });
    const out = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const start = out.indexOf("{");
    const end = out.lastIndexOf("}");
    if (start === -1 || end <= start) return [];
    const parsed = JSON.parse(out.slice(start, end + 1)) as { dates?: unknown };
    if (!Array.isArray(parsed.dates)) return [];

    // Keep dates from yesterday to 18 months out; anything else is a misread.
    const earliest = new Date(`${today}T12:00:00Z`);
    earliest.setUTCDate(earliest.getUTCDate() - 1);
    const latest = new Date(`${today}T12:00:00Z`);
    latest.setUTCMonth(latest.getUTCMonth() + 18);

    const seen = new Set<string>();
    const dates: ParsedKeyDate[] = [];
    for (const raw of parsed.dates) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const date = typeof r.date === "string" ? r.date.trim() : "";
      const title = typeof r.title === "string" ? r.title.trim().slice(0, 120) : "";
      if (!isIsoDate(date) || !title) continue;
      const when = new Date(`${date}T12:00:00Z`);
      if (when < earliest || when > latest) continue;
      const type = EVENT_TYPES.includes(r.event_type as EventType)
        ? (r.event_type as EventType)
        : "Other";
      const key = `${date}|${title.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dates.push({ date, title, event_type: type });
      if (dates.length >= MAX_DATES) break;
    }
    return dates;
  } catch (e) {
    console.error("parseKeyDates failed", e instanceof Error ? e.message : e);
    return [];
  }
}
