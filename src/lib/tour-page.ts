import type { SupabaseClient } from "@supabase/supabase-js";
import { ask } from "@/lib/themes/ai";
import { clip } from "@/lib/text";
import { fetchPage, pageText } from "@/lib/date-links";
import { summariseBrief } from "@/lib/artist-brief";
import { EVENT_TYPES, type EventType } from "@/types/event";

/**
 * An act's website (or a venue's what's-on page): read weekly for upcoming
 * dates of any kind (shows, releases, pre-orders), which become suggestions
 * to add. It reads the page given plus up to three of the site's own tour,
 * music or news pages. Dates that load from a Bandsintown widget can't be
 * read from the page, so they come from Bandsintown directly when the act's
 * API key is saved. With no brief links set, the same pages also fill the
 * artist brief.
 */

const REREAD_DAYS = 7;
const MAX_DATES = 60;
const MAX_EXTRA_PAGES = 3;
const LINK_HINT = /(tour|live|shows?|events?|dates|gigs?|music|releases?|discography|records?|albums?|news|store|shop)/i;

export type TourDate = { date: string; title: string; event_type: EventType; notes: string | null };
type Widget = "bandsintown" | "songkick" | null;

const SYSTEM = `You read pages from a music act's website and list the UPCOMING dates on them, of any kind: shows, festivals, tours, releases (singles, EPs, albums, pre-orders, vinyl), listening parties, in-stores.
For each date give:
- date: YYYY-MM-DD. Work out the page's date style before reading: if any first number is over 12 it's day-first (24.10.26); if any second number is over 12 it's month-first (10/25/26, common on US widgets). British sites are usually day-first.
- title: short and plain. Shows: place first, "St Davids, City Hall". Festivals: "Mira Festival, Barcelona". Releases: "Album out: Godspeed", "Single out: Dreams Fade".
- event_type: one of ${EVENT_TYPES.join(", ")}.
- notes: the tour or release name and anything useful such as "Sold out" or "Pre-order now", under 120 characters, or null.
Only dates on or after today. Leave out past dates, even if they're listed. A release with only a month and no day: skip it. Don't invent anything that isn't on the pages.
Reply with JSON only: {"dates":[{"date":"","title":"","event_type":"","notes":null}]}`;

function isIsoDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function londonToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now);
}

function widgetIn(html: string): Widget {
  if (/bandsintown|bit-widget/i.test(html)) return "bandsintown";
  if (/songkick/i.test(html)) return "songkick";
  return null;
}

/** The site's own tour/music/news pages linked from this one. */
function sitePages(html: string, base: URL): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    let u: URL;
    try {
      u = new URL(m[1], base);
    } catch {
      continue;
    }
    if (u.hostname !== base.hostname || !/^https?:$/.test(u.protocol)) continue;
    if (u.pathname === base.pathname || !LINK_HINT.test(u.pathname)) continue;
    u.hash = "";
    out.add(u.toString());
    if (out.size >= MAX_EXTRA_PAGES) break;
  }
  return [...out];
}

function cleanDates(raw: unknown, today: string): TourDate[] {
  const latest = new Date(`${today}T12:00:00Z`);
  latest.setUTCMonth(latest.getUTCMonth() + 24);
  const seen = new Set<string>();
  const out: TourDate[] = [];
  for (const item of Array.isArray(raw) ? raw : []) {
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

/** Upcoming shows from Bandsintown, with the act's own API key. Null on failure. */
async function bandsintownDates(artistName: string, key: string, today: string): Promise<TourDate[] | null> {
  try {
    const url = `https://rest.bandsintown.com/artists/${encodeURIComponent(artistName)}/events?app_id=${encodeURIComponent(key)}&date=upcoming`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    if (!Array.isArray(json)) return null;
    return cleanDates(
      json.map((e: Record<string, unknown>) => {
        const v = (e.venue ?? {}) as Record<string, unknown>;
        const place = [v.city, v.name].filter((x) => typeof x === "string" && x).join(", ");
        const lineup = Array.isArray(e.lineup) ? (e.lineup as unknown[]).filter((x) => typeof x === "string" && x !== artistName) : [];
        return {
          date: typeof e.datetime === "string" ? e.datetime.slice(0, 10) : "",
          title: (typeof e.title === "string" && e.title.trim()) || place || "Show",
          event_type: "Show",
          notes: [lineup.length ? `With ${lineup.slice(0, 4).join(", ")}` : null, typeof e.description === "string" ? clip(e.description, 80) : null]
            .filter(Boolean)
            .join(". ") || null,
        };
      }),
      today
    );
  } catch {
    return null;
  }
}

export type WebsiteRead = { dates: TourDate[]; pages: string[]; widget: Widget; fromBandsintown: boolean };

/** Reads the site. Null when the first page couldn't be read at all. */
export async function readWebsite(
  url: string,
  artistName: string,
  today: string,
  bandsintownKey?: string | null
): Promise<WebsiteRead | null> {
  let html: string | null = null;
  try {
    html = await fetchPage(url);
  } catch {
    html = null;
  }
  if (!html) return null;

  const htmls = [html];
  for (const extra of sitePages(html, new URL(url))) {
    try {
      const h = await fetchPage(extra);
      if (h) htmls.push(h);
    } catch {
      // skip unreadable pages
    }
  }
  const widget = htmls.map(widgetIn).find(Boolean) ?? null;
  const pages = htmls.map((h) => pageText(h)).filter((t) => t.length >= 80);

  let dates: TourDate[] = [];
  if (pages.length > 0) {
    try {
      const raw = (await ask(
        SYSTEM,
        `Today is ${today}.\nAct: ${artistName}\nSite: ${url}\n\n${pages.map((t) => clip(t, 6000)).join("\n\n---\n\n")}`,
        4000
      )) as { dates?: unknown };
      dates = cleanDates(raw.dates, today);
    } catch {
      dates = [];
    }
  }

  let fromBandsintown = false;
  if (bandsintownKey) {
    const bit = await bandsintownDates(artistName, bandsintownKey, today);
    if (bit) {
      fromBandsintown = true;
      const have = new Set(dates.map((d) => d.date));
      dates = [...dates, ...bit.filter((d) => !have.has(d.date))];
    }
  }
  return { dates, pages, widget, fromBandsintown };
}

/**
 * Reads the act's website if it's due (new, or a week since the last read)
 * or forced, and saves new dates as suggestions. Skips days they already
 * have, or that were suggested before (even if dismissed). Needs a
 * service-role client. Null when there's no website set.
 */
export async function syncTourPage(
  admin: SupabaseClient,
  artistId: string,
  opts: { force?: boolean; now?: Date } = {}
): Promise<{ status: "ok" | "failed"; found: number; added: number; note: string | null } | null> {
  const now = opts.now ?? new Date();
  const { data: profile } = await admin
    .from("profiles")
    .select("artist_name, tour_page_url, tour_page_checked_at, bandsintown_key, brief_links")
    .eq("id", artistId)
    .maybeSingle();
  const url = profile?.tour_page_url ? String(profile.tour_page_url) : "";
  if (!url) return null;
  const last = profile?.tour_page_checked_at ? Date.parse(String(profile.tour_page_checked_at)) : 0;
  if (!opts.force && last && now.getTime() - last < REREAD_DAYS * 86400000) return null;

  const today = londonToday(now);
  const name = String(profile?.artist_name ?? "the act");
  const read = await readWebsite(url, name, today, profile?.bandsintown_key ? String(profile.bandsintown_key) : null);
  if (read === null) {
    await admin
      .from("profiles")
      .update({
        tour_page_checked_at: now.toISOString(),
        tour_page_status: "failed",
        tour_page_found: null,
        tour_page_note: "Couldn't open that site.",
      })
      .eq("id", artistId)
      .eq("tour_page_url", url);
    return { status: "failed", found: 0, added: 0, note: "Couldn't open that site." };
  }

  const note =
    read.widget === "bandsintown" && !read.fromBandsintown
      ? profile?.bandsintown_key
        ? "Bandsintown didn't return any dates with that key. Check it's this artist's key, and that their Bandsintown name matches their name in Tempo."
        : "Their show dates load from Bandsintown, which Tempo can't read from the page. Add their Bandsintown API key to pick them up."
      : read.widget === "songkick" && read.dates.length === 0
        ? "Their show dates load from Songkick, which Tempo can't read from the page. Add dates by hand for now."
        : null;

  let added = 0;
  const dates = read.dates;
  if (dates.length > 0) {
    const days = [...new Set(dates.map((d) => d.date))];
    const [{ data: events }, { data: existing }] = await Promise.all([
      admin.from("events").select("event_date").eq("artist_id", artistId).in("event_date", days),
      admin.from("date_suggestions").select("event_date, title").eq("artist_id", artistId).in("event_date", days),
    ]);
    const takenDays = new Set((events ?? []).map((e) => String(e.event_date)));
    const suggestedDays = new Set((existing ?? []).map((e) => String(e.event_date)));
    const rows = dates
      .filter((d) => !takenDays.has(d.date) && !suggestedDays.has(d.date))
      .map((d) => ({
        artist_id: artistId,
        title: d.title,
        event_date: d.date,
        event_type: d.event_type,
        notes: d.notes,
        source: "tour_page",
        source_excerpt: "From your website",
      }));
    if (rows.length > 0) {
      const { error } = await admin.from("date_suggestions").insert(rows);
      if (error) throw new Error(`save website dates: ${error.message}`);
      added = rows.length;
    }
  }

  // No brief links of their own: the website doubles as the brief.
  const brief = !profile?.brief_links ? await summariseBrief(name, read.pages.map((t) => clip(t, 5000))) : undefined;

  await admin
    .from("profiles")
    .update({
      tour_page_checked_at: now.toISOString(),
      tour_page_status: "ok",
      tour_page_found: Math.min(dates.length, 999),
      tour_page_note: note,
      ...(brief ? { brief_context: brief, brief_checked_at: now.toISOString() } : {}),
    })
    .eq("id", artistId)
    .eq("tour_page_url", url);
  return { status: "ok", found: dates.length, added, note };
}
