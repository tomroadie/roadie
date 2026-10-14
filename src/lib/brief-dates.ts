import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ask } from "@/lib/themes/ai";
import { cleanDates } from "@/lib/tour-page";
import { EVENT_TYPES } from "@/types/event";

/**
 * The artist's plan (brief notes) often holds the campaign timeline:
 * singles, announcements, album, shows. Those become date suggestions, so
 * ideas get them as real dates instead of the model working them out from
 * prose each week. Read again only when the notes change.
 */

const SYSTEM = `You read a music act's private campaign plan and list every UPCOMING dated moment in it: single and album releases, announcements, shows, tours, launch events, pre-orders.
For each give:
- date: YYYY-MM-DD. Plans write dates loosely ("3rd / 4th Nov", "29th Jan"): use the first day given, and the next time that day comes round on or after today. British plans are day-first.
- title: short and plain, saying what the thing is, so it makes sense on its own. "Single out: Real Thing", "Announce: album and St Pancras Old Church shows", "Album out", "Show: St Pancras Old Church". Never just a bare song name.
- event_type: one of ${EVENT_TYPES.join(", ")}. Releases are Release; announcements are Other; shows are Show.
- notes: anything that helps, under 120 characters, or null. If the plan gives the same moment two different dates, use the one in its timeline or summary and say so here: "Plan also says 28 Oct".
Skip anything with only a month or season and no day ("March", "Sep / October tbc"). Skip past dates. Don't invent anything.
Reply with JSON only: {"dates":[{"date":"","title":"","event_type":"","notes":null}]}`;

function hash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

/** Reads the notes if they changed since the last read and saves new dates as suggestions. */
export async function syncBriefDates(
  admin: SupabaseClient,
  artistId: string,
  opts: { force?: boolean; now?: Date } = {}
): Promise<{ found: number; added: number } | null> {
  const now = opts.now ?? new Date();
  const { data: p } = await admin
    .from("profiles")
    .select("artist_name, brief_notes, brief_notes_read_hash")
    .eq("id", artistId)
    .maybeSingle();
  const notes = p?.brief_notes ? String(p.brief_notes).trim() : "";
  if (!notes) return null;
  const h = hash(notes);
  if (!opts.force && p?.brief_notes_read_hash === h) return null;

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now);
  const raw = (await ask(SYSTEM, `Today is ${today}.\nAct: ${String(p?.artist_name ?? "the act")}\n\nPlan:\n${notes}`, 3000)) as {
    dates?: unknown;
  };
  const dates = cleanDates(raw.dates, today);

  let added = 0;
  if (dates.length > 0) {
    const days = [...new Set(dates.map((d) => d.date))];
    const [{ data: events }, { data: existing }] = await Promise.all([
      admin.from("events").select("event_date, title").eq("artist_id", artistId).in("event_date", days),
      admin.from("date_suggestions").select("event_date, title").eq("artist_id", artistId).in("event_date", days),
    ]);
    // Same day and title already there (added, or suggested before): skip.
    const seen = new Set([...(events ?? []), ...(existing ?? [])].map((e) => `${e.event_date}|${String(e.title).toLowerCase()}`));
    const takenDays = new Set((events ?? []).map((e) => String(e.event_date)));
    const rows = dates
      .filter((d) => !seen.has(`${d.date}|${d.title.toLowerCase()}`) && !takenDays.has(d.date))
      .map((d) => ({
        artist_id: artistId,
        title: d.title,
        event_date: d.date,
        event_type: d.event_type,
        notes: d.notes,
        source: "brief",
        source_excerpt: "From your plan",
      }));
    if (rows.length > 0) {
      const { error } = await admin.from("date_suggestions").insert(rows);
      if (error) throw new Error(`save plan dates: ${error.message}`);
      added = rows.length;
    }
  }
  await admin.from("profiles").update({ brief_notes_read_hash: h }).eq("id", artistId);
  return { found: dates.length, added };
}
