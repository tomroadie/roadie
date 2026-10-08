import type { SupabaseClient } from "@supabase/supabase-js";
import { compareToUsual, describeComparison, type Comparison, type PerfPost } from "@/lib/performance";

const DAY_MS = 86400000;
/** Posts loaded: enough for the list plus a usual for each of them. */
const LOAD = 40;
export const WEEKS_SHOWN = 8;

export type PostResult = {
  id: string;
  postDate: string | null;
  mediaType: string | null;
  caption: string;
  permalink: string | null;
  thumbnailUrl: string | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  comparison: Comparison | null;
  /** One plain line, or null when there's no fair comparison yet. */
  line: string | null;
  /** Board idea this post came from, if linked. */
  ideaTitle: string | null;
};

export type WeekCount = { label: string; posts: number; current: boolean };

export type PostResultsData = {
  posts: PostResult[];
  weeks: WeekCount[];
  /** Median reach of the latest 20 posts that have reach. */
  typicalReach: number | null;
  followers: number | null;
  /** Change in followers over roughly the last 4 weeks, when we have history. */
  followerChange: { change: number; days: number } | null;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function firstLine(caption: string | null): string {
  const line = (caption ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return line.length > 70 ? `${line.slice(0, 67).trimEnd()}…` : line;
}

/**
 * Everything the "How your posts did" section needs, from synced posts only.
 * Returns null when nothing has been synced (Instagram not connected yet).
 */
export async function loadPostResults(
  supabase: SupabaseClient,
  artistId: string,
  weekStartsAt: string,
  now: Date = new Date()
): Promise<PostResultsData | null> {
  const [{ data: rows }, { data: ideas }, { data: snapshots }] = await Promise.all([
    supabase
      .from("post_performance")
      .select("instagram_post_id, post_date, ig_media_type, caption, permalink, thumbnail_url, reach, likes, comments")
      .eq("artist_id", artistId)
      .not("post_date", "is", null)
      .order("post_date", { ascending: false })
      .limit(LOAD),
    supabase
      .from("concepts")
      .select("title, instagram_post_id")
      .eq("artist_id", artistId)
      .not("instagram_post_id", "is", null),
    supabase
      .from("instagram_account_snapshots")
      .select("snapshot_date, followers_count")
      .eq("artist_id", artistId)
      .gte("snapshot_date", new Date(now.getTime() - 35 * DAY_MS).toISOString().slice(0, 10))
      .order("snapshot_date", { ascending: true }),
  ]);
  if (!rows || rows.length === 0) return null;

  const ideaByPost = new Map((ideas ?? []).map((i) => [String(i.instagram_post_id), String(i.title)]));
  const perf: PerfPost[] = rows.map((r) => ({
    id: String(r.instagram_post_id),
    postDate: r.post_date ? String(r.post_date) : null,
    mediaType: r.ig_media_type ?? null,
    reach: typeof r.reach === "number" ? r.reach : null,
    likes: typeof r.likes === "number" ? r.likes : null,
    comments: typeof r.comments === "number" ? r.comments : null,
  }));

  const posts: PostResult[] = rows.map((r, i) => {
    const comparison = compareToUsual(perf[i], perf, now);
    return {
      ...perf[i],
      caption: firstLine(r.caption),
      permalink: r.permalink ?? null,
      thumbnailUrl: r.thumbnail_url ?? null,
      comparison,
      line: comparison ? describeComparison(comparison) : null,
      ideaTitle: ideaByPost.get(perf[i].id) ?? null,
    };
  });

  // The reassurance on quieter posts reads as a lecture if it repeats, so keep it once.
  const REASSURE = " One post doesn't make a pattern.";
  let reassured = false;
  for (const p of posts) {
    if (!p.line?.endsWith(REASSURE)) continue;
    if (reassured) p.line = p.line.slice(0, -REASSURE.length);
    reassured = true;
  }

  // Posts per board week, oldest first, ending with the current week.
  const currentStart = Date.parse(weekStartsAt);
  const weeks: WeekCount[] = [];
  for (let k = WEEKS_SHOWN - 1; k >= 0; k--) {
    const start = currentStart - k * 7 * DAY_MS;
    const end = start + 7 * DAY_MS;
    const count = perf.filter((p) => {
      const t = p.postDate ? Date.parse(p.postDate) : NaN;
      return t >= start && t < end;
    }).length;
    weeks.push({
      label: new Date(start + 12 * 3600000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }),
      posts: count,
      current: k === 0,
    });
  }

  const typicalReach = median(
    perf.map((p) => p.reach).filter((r): r is number => r !== null && r > 0).slice(0, 20)
  );

  const snaps = (snapshots ?? []).filter((s) => typeof s.followers_count === "number");
  const latest = snaps.at(-1);
  const earliest = snaps[0];
  const days =
    latest && earliest
      ? Math.round((Date.parse(String(latest.snapshot_date)) - Date.parse(String(earliest.snapshot_date))) / DAY_MS)
      : 0;

  return {
    posts,
    weeks,
    typicalReach,
    followers: latest ? Number(latest.followers_count) : null,
    followerChange:
      latest && earliest && days >= 7
        ? { change: Number(latest.followers_count) - Number(earliest.followers_count), days }
        : null,
  };
}
