import type { SupabaseClient } from "@supabase/supabase-js";
import { ask } from "@/lib/themes/ai";
import { clip } from "@/lib/text";
import { fetchPage, pageText } from "@/lib/date-links";
import { EVENT_TYPES, type EventType } from "@/types/event";

/**
 * An act's tour page (or a venue's what's-on page): read weekly, and any
 * upcoming dates not already known become suggestions to add, one by one
 * or all at once.
 */

const REREAD_DAYS = 7;
const MAX_DATES = 60;

export type TourDate = { date: string; title: string; event_type: EventType; notes: string | null };

const SYSTEM = `You read a music act's tour or events page and list the UPCOMING dates on it.
For each date give:
- date: YYYY-MM-DD. Pages often write 24.10.26 or 24/10 (day first, British style).
- title: short and plain, place first: "Amsterdam, Fabrique des Lumières". For a festival, the festival and city: "Mira Festival, Barcelona".
- event_type: one of ${EVENT_TYPES.join(", ")} (usually Show).
- notes: the event or tour name and anything useful such as "Sold out", under 120 characters, or null.
Only dates on or after today. Leave out past dates, even if they're listed. Don't invent anything that isn't on the page.
Reply with JSON only: {"dates":[{"date":"","title":"","event_type":"","notes":null}]}`;

function isIsoDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function londonToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now);
}

/** Reads the page. Null when it couldn't be read; [] when it had no upcoming dates. */
export async function readTourPage(url: string, artistName: string, today: string): Promise<TourDate[] | null> {
  let html: string | null = null;
  try {
    html = await fetchPage(url);
  } catch {
    html = null;
  }
  if (!html) return null;
  const text = pageText(html);
  if (text.length < 80) return null;

  let raw: { dates?: unknown };
  try {
    raw = (await ask(SYSTEM, `Today is ${today}.\nAct: ${artistName}\nPage: ${url}\n\n${clip(text, 15000)}`, 4000)) as {
      dates?: unknown;
    };
  } catch {
    return null;
  }
  const latest = new Date(`${today}T12:00:00Z`);
  latest.setUTCMonth(latest.getUTCMonth() + 24);
  const seen = new Set<string>();
  const out: TourDate[] = [];
  for (const item of Array.isArray(raw.dates) ? raw.dates : []) {
    const r = item as Record<string, unknown>;
    const date = typeof r.date === "string" ? r.date.trim() : "";
    const title = typeof r.title === "string" ? r.title.trim().slice(0, 120) : "";
    if (!isIsoDate(date) || !title || date < today || new Date(`${date}T12:00:00Z`) > latest) continue;
    const key = `${date}|${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      date,
      title,
      event_type: EVENT_TYPES.includes(r.event_type as EventType) ? (r.event_type as EventType) : "Show",
      notes: typeof r.notes === "string" && r.notes.trim() ? r.notes.trim().slice(0, 300) : null,
    });
    if (out.length >= MAX_DATES) break;
  }
  return out;
}

/**
 * Reads the artist's tour page if it's due (new, or a week since the last
 * read) or forced, and saves new dates as suggestions. Skips dates they
 * already have on that day, or that were suggested before (even if
 * dismissed). Needs a service-role client. Returns how many were added,
 * or null when there's no page or it couldn't be read.
 */
export async function syncTourPage(
  admin: SupabaseClient,
  artistId: string,
  opts: { force?: boolean; now?: Date } = {}
): Promise<{ status: "ok" | "failed"; found: number; added: number } | null> {
  const now = opts.now ?? new Date();
  const { data: profile } = await admin
    .from("profiles")
    .select("artist_name, tour_page_url, tour_page_checked_at")
    .eq("id", artistId)
    .maybeSingle();
  const url = profile?.tour_page_url ? String(profile.tour_page_url) : "";
  if (!url) return null;
  const last = profile?.tour_page_checked_at ? Date.parse(String(profile.tour_page_checked_at)) : 0;
  if (!opts.force && last && now.getTime() - last < REREAD_DAYS * 86400000) return null;

  const today = londonToday(now);
  const dates = await readTourPage(url, String(profile?.artist_name ?? "the act"), today);
  if (dates === null) {
    await admin
      .from("profiles")
      .update({ tour_page_checked_at: now.toISOString(), tour_page_status: "failed", tour_page_found: null })
      .eq("id", artistId)
      .eq("tour_page_url", url);
    return { status: "failed", found: 0, added: 0 };
  }

  let added = 0;
  if (dates.length > 0) {
    const days = [...new Set(dates.map((d) => d.date))];
    const [{ data: events }, { data: existing }] = await Promise.all([
      admin.from("events").select("event_date").eq("artist_id", artistId).in("event_date", days),
      admin.from("date_suggestions").select("event_date, title").eq("artist_id", artistId).in("event_date", days),
    ]);
    // One date per day is the norm; a day they already have is skipped.
    const takenDays = new Set((events ?? []).map((e) => String(e.event_date)));
    const suggested = new Set((existing ?? []).map((e) => `${e.event_date}|${String(e.title).toLowerCase()}`));
    const suggestedDays = new Set((existing ?? []).map((e) => String(e.event_date)));
    const rows = dates
      .filter((d) => !takenDays.has(d.date) && !suggested.has(`${d.date}|${d.title.toLowerCase()}`) && !suggestedDays.has(d.date))
      .map((d) => ({
        artist_id: artistId,
        title: d.title,
        event_date: d.date,
        event_type: d.event_type,
        notes: d.notes,
        source: "tour_page",
        source_excerpt: "From your tour page",
      }));
    if (rows.length > 0) {
      const { error } = await admin.from("date_suggestions").insert(rows);
      if (error) throw new Error(`save tour dates: ${error.message}`);
      added = rows.length;
    }
  }
  await admin
    .from("profiles")
    .update({ tour_page_checked_at: now.toISOString(), tour_page_status: "ok", tour_page_found: Math.min(dates.length, 999) })
    .eq("id", artistId)
    .eq("tour_page_url", url);
  return { status: "ok", found: dates.length, added };
}
