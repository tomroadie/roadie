import type { SupabaseClient } from "@supabase/supabase-js";
import { parseKeyDates } from "@/lib/key-dates";

/** Only recent posts can announce something still to come. */
const LOOKBACK_DAYS = 30;
const POSTS_PER_RUN = 20;

/**
 * Cheap first pass: does the caption sound like it mentions a date? Only
 * these go to the model. Everything else is marked checked for free.
 */
const DATE_CUES = [
  /\b(mon|tues?|wed(nes)?|thu(rs)?|fri|sat(ur)?|sun)(day)?\b/i,
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/i,
  /\b\d{1,2}(st|nd|rd|th)\b/i,
  /\b\d{1,2}[./]\d{1,2}([./]\d{2,4})?\b/,
  /\b(tomorrow|tonight|next week|this week(end)?|out now|on sale|pre-?save|pre-?order|tickets?|tour|release|premiere|live at|headlin|support(ing)?)\b/i,
];

export function captionMayHaveDate(caption: string): boolean {
  return DATE_CUES.some((re) => re.test(caption));
}

function todayInLondon(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function excerpt(caption: string): string {
  const line = caption.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return line.length > 140 ? `${line.slice(0, 137).trimEnd()}…` : line;
}

/**
 * Reads the artist's recent, unchecked captions for upcoming dates and saves
 * any new ones as suggestions for the artist to add or dismiss. Relative
 * dates ("Friday") are read from the day the post went up. Each post is
 * checked once. Needs a service-role client. Returns how many were saved.
 */
export async function suggestDatesFromPosts(
  admin: SupabaseClient,
  artistId: string,
  now: Date = new Date()
): Promise<number> {
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 86400000).toISOString();
  const { data: posts, error } = await admin
    .from("post_performance")
    .select("instagram_post_id, caption, post_date")
    .eq("artist_id", artistId)
    .is("dates_checked_at", null)
    .gte("post_date", since)
    .order("post_date", { ascending: false })
    .limit(POSTS_PER_RUN);
  if (error) throw new Error(`posts: ${error.message}`);
  if (!posts || posts.length === 0) return 0;

  const today = todayInLondon(now);

  const found: { title: string; event_date: string; event_type: string; postId: string; caption: string }[] = [];
  for (const p of posts) {
    const caption = String(p.caption ?? "");
    if (!caption.trim() || !captionMayHaveDate(caption)) continue;
    const postedOn = p.post_date ? todayInLondon(new Date(String(p.post_date))) : today;
    const dates = await parseKeyDates(caption, postedOn);
    for (const d of dates) {
      // Only what's still ahead; a gig last week isn't a key date any more.
      if (d.date < today) continue;
      found.push({
        title: d.title,
        event_date: d.date,
        event_type: d.event_type,
        postId: String(p.instagram_post_id),
        caption,
      });
    }
  }

  let saved = 0;
  if (found.length > 0) {
    // Skip anything they already have on that day as the same kind of date,
    // whether it's an event or a suggestion they've seen before.
    const days = [...new Set(found.map((f) => f.event_date))];
    const [{ data: events }, { data: existing }] = await Promise.all([
      admin.from("events").select("event_date, event_type").eq("artist_id", artistId).in("event_date", days),
      admin.from("date_suggestions").select("event_date, event_type").eq("artist_id", artistId).in("event_date", days),
    ]);
    const taken = new Set(
      [...(events ?? []), ...(existing ?? [])].map((e) => `${e.event_date}|${e.event_type}`)
    );

    const rows = [];
    for (const f of found) {
      const key = `${f.event_date}|${f.event_type}`;
      if (taken.has(key)) continue;
      taken.add(key);
      rows.push({
        artist_id: artistId,
        title: f.title,
        event_date: f.event_date,
        event_type: f.event_type,
        source_post_id: f.postId,
        source_excerpt: excerpt(f.caption),
      });
    }
    if (rows.length > 0) {
      const { error: insErr } = await admin.from("date_suggestions").insert(rows);
      if (insErr) throw new Error(`save suggestions: ${insErr.message}`);
      saved = rows.length;
    }
  }

  const { error: markErr } = await admin
    .from("post_performance")
    .update({ dates_checked_at: now.toISOString() })
    .eq("artist_id", artistId)
    .in("instagram_post_id", posts.map((p) => String(p.instagram_post_id)));
  if (markErr) throw new Error(`mark checked: ${markErr.message}`);

  return saved;
}
