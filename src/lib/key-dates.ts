import Anthropic from "@anthropic-ai/sdk";
import { EVENT_TYPES, type EventType } from "@/types/event";
import { clip } from "@/lib/text";

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

type RawDate = { date: string | null; title: string; event_type: EventType };

/**
 * Runs the model and checks what comes back. Dates outside yesterday to
 * 18 months out are dropped as misreads. With allowUndated, items with no
 * date come back with date null; otherwise they're dropped.
 */
async function extract(system: string, user: string, today: string, allowUndated: boolean): Promise<RawDate[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];
  const res = await new Anthropic({ apiKey }).messages.create({
    model: KEY_DATES_MODEL,
    max_tokens: 800,
    system,
    messages: [{ role: "user", content: user }],
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

  const earliest = new Date(`${today}T12:00:00Z`);
  earliest.setUTCDate(earliest.getUTCDate() - 1);
  const latest = new Date(`${today}T12:00:00Z`);
  latest.setUTCMonth(latest.getUTCMonth() + 18);

  const seen = new Set<string>();
  const dates: RawDate[] = [];
  for (const raw of parsed.dates) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const dateStr = typeof r.date === "string" ? r.date.trim() : "";
    const title = typeof r.title === "string" ? r.title.trim().slice(0, 120) : "";
    if (!title) continue;
    let date: string | null = null;
    if (isIsoDate(dateStr)) {
      const when = new Date(`${dateStr}T12:00:00Z`);
      if (when < earliest || when > latest) continue;
      date = dateStr;
    } else if (!allowUndated) {
      continue;
    }
    const type = EVENT_TYPES.includes(r.event_type as EventType)
      ? (r.event_type as EventType)
      : "Other";
    const key = `${date ?? "-"}|${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dates.push({ date, title, event_type: type });
    if (dates.length >= MAX_DATES) break;
  }
  return dates;
}

/**
 * Turns "single out 14 Nov, Fleece gig 12th" into dated events. Never throws:
 * on any failure it returns [] and the caller keeps the raw text.
 */
export async function parseKeyDates(
  text: string,
  today: string = new Date().toISOString().slice(0, 10)
): Promise<ParsedKeyDate[]> {
  const input = clip(text.trim(), 1000);
  if (!input) return [];
  try {
    const rows = await extract(SYSTEM, `Today is ${today}.\n\nThey wrote:\n${input}`, today, false);
    return rows.filter((r): r is ParsedKeyDate => r.date !== null);
  } catch (e) {
    console.error("parseKeyDates failed", e instanceof Error ? e.message : e);
    return [];
  }
}

const CAPTION_SYSTEM = `You read a musician's own Instagram caption and pick out anything still to come that belongs on their calendar: shows, festivals, tours, releases, sessions.
Return only JSON: {"dates":[{"date":"YYYY-MM-DD" or null,"title":"...","event_type":"..."}]}
- event_type is one of: ${EVENT_TYPES.join(", ")}.
- title is short and plain, naming the thing and, for shows, the place if given ("Noizzefest, Clwb Ifor Bach", "Single out: Dreams Fade"). Turn @handles into plain names.
- Resolve relative dates ("Friday", "the 12th") from the day the post went up. A day and month with no year means the next time that date comes round.
- If they announce something to come but give no exact day (a festival they're playing, "new single soon", only a year or month), include it with "date": null.
- Leave out things that have already happened ("thanks for last night"), teasers with nothing named ("announcement tomorrow"), and other people's events they're only sharing.
- Return {"dates":[]} when there's nothing.`;

export type CaptionDates = {
  dated: ParsedKeyDate[];
  /** Announced, but with no day given. */
  undated: { title: string; event_type: EventType }[];
};

/** Dates and undated announcements in one caption. Never throws. */
export async function parseCaptionDates(caption: string, postedOn: string): Promise<CaptionDates> {
  const input = clip(caption.trim(), 1000);
  const empty: CaptionDates = { dated: [], undated: [] };
  if (!input) return empty;
  try {
    const rows = await extract(CAPTION_SYSTEM, `The post went up on ${postedOn}.\n\nCaption:\n${input}`, postedOn, true);
    return {
      dated: rows.filter((r): r is ParsedKeyDate => r.date !== null),
      undated: rows.filter((r) => r.date === null).map((r) => ({ title: r.title, event_type: r.event_type })),
    };
  } catch (e) {
    console.error("parseCaptionDates failed", e instanceof Error ? e.message : e);
    return empty;
  }
}
