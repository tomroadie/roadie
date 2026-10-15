import type { SupabaseClient } from "@supabase/supabase-js";
import { parseCaptionDates } from "@/lib/key-dates";

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
  // Announcements that often come without a day.
  /\b(announce\w*|playing|line-?up|join us|see you at|coming soon|new single|new album|ep|lp|show|gig)\b/i,
  /fest\b|festival/i,
  /\b20\d\d\b/,
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
export const CAPTION_DATE_SUGGESTIONS = false;

export async function suggestDatesFromPosts(
  admin: SupabaseClient,
  artistId: string,
  now: Date = new Date()
): Promise<number> {
  // Paused: caption guesses were too often wrong (month-only dates as the
  // 1st, promos and seasons as events). Dates are added by hand or from an
  // artist's website until the dates redesign.
  if (!CAPTION_DATE_SUGGESTIONS) return 0;
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

  const found: { title: string; event_date: string | null; event_type: string; postId: string; caption: string }[] = [];
  for (const p of posts) {
    const caption = String(p.caption ?? "");
    if (!caption.trim() || !captionMayHaveDate(caption)) continue;
    const postedOn = p.post_date ? todayInLondon(new Date(String(p.post_date))) : today;
    const { dated, undated } = await parseCaptionDates(caption, postedOn);
    for (const u of undated) {
      found.push({ title: u.title, event_date: null, event_type: u.event_type, postId: String(p.instagram_post_id), caption });
    }
    for (const d of dated) {
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
    // Skip anything they already have: dated ones by day and kind, undated
    // ones by name (an event or suggestion with the same title, any status).
    const days = [...new Set(found.map((f) => f.event_date).filter((d): d is string => d !== null))];
    const [{ data: events }, { data: existing }, { data: named }, { data: namedEvents }] = await Promise.all([
      days.length
        ? admin.from("events").select("event_date, event_type").eq("artist_id", artistId).in("event_date", days)
        : Promise.resolve({ data: [] as { event_date: string; event_type: string }[] }),
      days.length
        ? admin.from("date_suggestions").select("event_date, event_type").eq("artist_id", artistId).in("event_date", days)
        : Promise.resolve({ data: [] as { event_date: string; event_type: string }[] }),
      admin.from("date_suggestions").select("title").eq("artist_id", artistId),
      admin.from("events").select("title").eq("artist_id", artistId).gte("event_date", today),
    ]);
    const taken = new Set(
      [...(events ?? []), ...(existing ?? [])].map((e) => `${e.event_date}|${e.event_type}`)
    );
    for (const n of [...(named ?? []), ...(namedEvents ?? [])]) {
      taken.add(`title|${String(n.title).trim().toLowerCase()}`);
    }

    const rows = [];
    for (const f of found) {
      const key = f.event_date ? `${f.event_date}|${f.event_type}` : `title|${f.title.trim().toLowerCase()}`;
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
