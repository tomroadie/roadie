import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ConceptContext,
  ContextKeyDate,
  ContextPost,
} from "./types";

const MAX_POSTS = 15;
const KEY_DATE_WINDOW_DAYS = 28;
/** Below this many posts there's not enough to learn from. */
const COLD_START_MIN_POSTS = 4;

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Scrapes report hidden like counts as -1; treat any negative as unknown. */
function nonNegative(v: unknown): number | null {
  const n = toNum(v);
  return n === null || n < 0 ? null : n;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

type RawPost = Omit<ContextPost, "n" | "standout" | "news">;

/**
 * News posts get comments because of the news (a release, a gig, an
 * announcement), whatever the caption does. Tagging them in code stops the
 * model reading a release-day spike as proof of a caption technique.
 * Keyword matching will sometimes mislabel; that's fine for a review loop.
 */
const NEWS_PATTERNS: RegExp[] = [
  /\b(out[^a-z0-9]{0,6}now|is out|it['’]?s out|are out|out (today|tomorrow|this|next|on|friday|\d+))\b/i,
  /\b(single|ep|album|mixtape|record|releas\w*|pre-?save|stream\w* now|listening)\b/i,
  /\b(tickets?|tix|gigs?|tour\w*|festival|headlin\w*|supporting|support slot|line-?up|show tonight|free show|playing (at|a|some|the|our))\b/i,
  /\b(announc\w*|launch\w*|imminent|coming soon|stay tuned|counting down|\d+ days? (until|to go))\b/i,
];

export function isNewsPost(caption: string): boolean {
  return NEWS_PATTERNS.some((re) => re.test(caption));
}

/** Maps Instagram's internal names (Sidecar, CAROUSEL_ALBUM, IMAGE) to plain ones. */
function normaliseType(raw: unknown): string {
  const t = String(raw ?? "").trim().toLowerCase();
  if (t === "sidecar" || t === "carousel_album" || t === "carousel") return "carousel";
  if (t === "image" || t === "photo") return "photo";
  if (t === "video" || t === "reel" || t === "reels") return "reel";
  return t || "unknown";
}

/**
 * Parses audits.recent_posts_raw, which looks like:
 *   Post 1\nType: Image\nDate: ...\nViews: —\nLikes: -1\nComments: 0\nCaption: ...\n\n---\n\nPost 2...
 * Captions can span several lines, so everything after "Caption:" belongs to it.
 */
export function parseAuditPosts(raw: string | null | undefined): RawPost[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];

  return text
    .split(/\n-{3,}(?:\n|$)/)
    .map((block) => {
      const field = (name: string) =>
        block.match(new RegExp(`^${name}:\\s*(.*)$`, "mi"))?.[1]?.trim() ?? "";
      const captionMatch = block.match(/^Caption:\s*([\s\S]*)$/m);
      const date = field("Date");
      return {
        date: date && !Number.isNaN(Date.parse(date)) ? date : null,
        type: normaliseType(field("Type")),
        caption: (captionMatch?.[1] ?? "").trim(),
        comments: nonNegative(field("Comments")),
        likes: nonNegative(field("Likes")),
        views: nonNegative(field("Views")),
        reach: null,
        saves: null,
        shares: null,
      };
    })
    .filter((p) => p.caption || p.date);
}

function byDateDesc(a: RawPost, b: RawPost): number {
  const ta = a.date ? Date.parse(a.date) : 0;
  const tb = b.date ? Date.parse(b.date) : 0;
  return tb - ta;
}

/**
 * Numbers posts newest-first and flags standouts in code, so the model
 * points at real outliers instead of finding patterns in noise.
 */
export function numberPosts(posts: RawPost[]): ContextPost[] {
  const sorted = [...posts]
    .sort(byDateDesc)
    .slice(0, MAX_POSTS)
    .map((p) => ({ ...p, news: isNewsPost(p.caption) }));

  // Standouts are judged within their own kind: a busy everyday post is
  // compared with other everyday posts, not with release days.
  const thresholdFor = (news: boolean) =>
    Math.max(
      3,
      median(
        sorted
          .filter((p) => p.news === news)
          .map((p) => p.comments)
          .filter((c): c is number => c !== null)
      ) * 2
    );
  const thresholds = { news: thresholdFor(true), everyday: thresholdFor(false) };

  return sorted.map((p, i) => ({
    ...p,
    n: i + 1,
    standout:
      p.comments !== null &&
      p.comments >= (p.news ? thresholds.news : thresholds.everyday),
  }));
}

/**
 * Starting weekly target: meet the artist where they are.
 * Someone who hasn't posted in a month starts at 1; someone active starts
 * one above their recent rate, capped by what they said they want.
 */
export function startingWeeklyTarget(
  postsLast28Days: number,
  postingFrequency: string | null | undefined
): number {
  const wanted =
    postingFrequency === "weekly" ? 1 : postingFrequency === "active" ? 4 : 3;
  if (postsLast28Days <= 0) return 1;
  const recentRate = Math.round(postsLast28Days / 4);
  return Math.max(1, Math.min(wanted, recentRate + 1));
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Gathers everything the concept generator needs for one artist.
 * Pass a service-role client for crons/admin; RLS-scoped clients only see
 * their own artists.
 */
export async function loadConceptContext(
  supabase: SupabaseClient,
  artistId: string,
  now: Date = new Date()
): Promise<ConceptContext> {
  const today = now.toISOString().slice(0, 10);
  const windowEnd = addDaysISO(today, KEY_DATE_WINDOW_DAYS);

  const historySince = new Date(now.getTime() - 56 * 86400000).toISOString();
  const [profileRes, auditRes, perfRes, eventsRes, plansRes, conceptsRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "artist_name, genre, sound_description, voice_description, posting_frequency, weekly_target, posting_confidence, tone_tag, content_days, coming_up_note"
        )
        .eq("id", artistId)
        .maybeSingle(),
      supabase
        .from("audits")
        .select(
          "instagram_handle, followers, ai_pattern_analysis, recent_posts_raw, created_at"
        )
        .eq("artist_id", artistId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("post_performance")
        .select(
          "post_date, post_type, ig_media_type, caption, likes, comments, views, reach, saves, shares"
        )
        .eq("artist_id", artistId)
        .order("post_date", { ascending: false })
        .limit(MAX_POSTS),
      supabase
        .from("events")
        .select("title, event_date, event_type, notes")
        .eq("artist_id", artistId)
        .gte("event_date", today)
        .lte("event_date", windowEnd)
        .order("event_date", { ascending: true }),
      supabase
        .from("weekly_plans")
        .select("idea_ratings, idea_feedback")
        .eq("artist_id", artistId)
        .order("created_at", { ascending: false })
        .limit(4),
      // What they did with earlier board ideas.
      supabase
        .from("concepts")
        .select("title, status, bin_reason, status_changed_at")
        .eq("artist_id", artistId)
        .in("status", ["posted", "pinned", "binned"])
        .gte("status_changed_at", historySince)
        .order("status_changed_at", { ascending: false })
        .limit(40),
    ]);

  if (profileRes.error) throw new Error(`profile: ${profileRes.error.message}`);
  const profile = profileRes.data;
  if (!profile?.artist_name?.trim()) {
    throw new Error("Artist has no profile or name");
  }

  const audit = auditRes.error ? null : auditRes.data;

  // Prefer synced Instagram data (real reach/saves); fall back to the audit scrape.
  const synced: RawPost[] = perfRes.error
    ? []
    : (perfRes.data ?? []).map((r) => ({
        date: r.post_date ? String(r.post_date) : null,
        type: normaliseType(r.ig_media_type ?? r.post_type),
        caption: String(r.caption ?? "").trim(),
        comments: nonNegative(r.comments),
        likes: nonNegative(r.likes),
        views: nonNegative(r.views),
        reach: nonNegative(r.reach),
        saves: nonNegative(r.saves),
        shares: nonNegative(r.shares),
      }));
  const scraped = parseAuditPosts(audit?.recent_posts_raw);

  const postSource: ConceptContext["postSource"] =
    synced.length > 0 ? "synced" : scraped.length > 0 ? "audit" : "none";
  const posts = numberPosts(synced.length > 0 ? synced : scraped);

  const cutoff = now.getTime() - 28 * 86400000;
  const postsLast28Days = posts.filter(
    (p) => p.date && Date.parse(p.date) >= cutoff
  ).length;
  const latest = posts.find((p) => p.date)?.date;
  const daysSinceLastPost = latest
    ? Math.max(0, Math.floor((now.getTime() - Date.parse(latest)) / 86400000))
    : null;

  const keyDates: ContextKeyDate[] = eventsRes.error
    ? []
    : (eventsRes.data ?? []).map((e) => ({
        date: String(e.event_date),
        title: String(e.title ?? "").trim(),
        type: e.event_type ? String(e.event_type) : null,
        notes: e.notes ? String(e.notes).trim() : null,
      }));

  const history = conceptsRes.error ? [] : (conceptsRes.data ?? []);
  const titlesWith = (status: string) =>
    history.filter((c) => c.status === status).map((c) => String(c.title));

  // Board bins first, then legacy thumbs-down ratings from weekly plans.
  const declined = new Map<string, string | null>();
  for (const c of history.filter((h) => h.status === "binned")) {
    if (!declined.has(c.title)) {
      declined.set(String(c.title), c.bin_reason ? String(c.bin_reason) : null);
    }
  }
  for (const plan of plansRes.error ? [] : (plansRes.data ?? [])) {
    const ratings = (plan.idea_ratings ?? {}) as Record<string, unknown>;
    const feedback = (plan.idea_feedback ?? {}) as Record<string, unknown>;
    for (const [hook, rating] of Object.entries(ratings)) {
      if (rating === "down" && !declined.has(hook)) {
        const reason = feedback[hook];
        declined.set(hook, typeof reason === "string" ? reason : null);
      }
    }
  }

  return {
    artistId,
    artistName: profile.artist_name.trim(),
    genre: profile.genre ?? null,
    sound: profile.sound_description?.trim() || null,
    voice: profile.voice_description?.trim() || null,
    confidence: profile.posting_confidence ?? null,
    toneTag: profile.tone_tag ?? null,
    contentDays: Array.isArray(profile.content_days) ? profile.content_days.map(Number) : [],
    comingUpNote: profile.coming_up_note?.trim() || null,
    handle: audit?.instagram_handle
      ? String(audit.instagram_handle).replace(/^@/, "")
      : null,
    followers: toNum(audit?.followers),
    postSource,
    auditCreatedAt: audit?.created_at ? String(audit.created_at) : null,
    posts,
    postsLast28Days,
    daysSinceLastPost,
    // The weekly job adapts weekly_target; until it has, derive a start.
    weeklyTarget:
      typeof profile.weekly_target === "number" && profile.weekly_target > 0
        ? profile.weekly_target
        : startingWeeklyTarget(postsLast28Days, profile.posting_frequency),
    auditPattern: audit?.ai_pattern_analysis
      ? String(audit.ai_pattern_analysis).trim()
      : null,
    keyDates,
    declined: [...declined].slice(0, 12).map(([title, reason]) => ({
      title,
      reason,
    })),
    postedIdeas: titlesWith("posted").slice(0, 10),
    pinnedIdeas: titlesWith("pinned").slice(0, 10),
    coldStart: posts.length < COLD_START_MIN_POSTS,
  };
}
