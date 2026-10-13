/**
 * "How did this post do?" — always against the artist's own usual, never
 * against other artists. Reach is the headline (how many people saw it);
 * when there isn't enough reach history yet, likes + comments stand in.
 */

export type PerfPost = {
  id: string;
  /** ISO timestamp. */
  postDate: string | null;
  /** Instagram media type: IMAGE, VIDEO, CAROUSEL_ALBUM. */
  mediaType: string | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  /** Marked by the artist as an ad or collab: never part of anyone's usual. */
  excluded?: boolean;
};

/** Reach this many times the usual gets the "was this an ad or collab?" question. */
export const UNUSUAL_RATIO = 3;

export type Band = "well_above" | "above" | "usual" | "quieter";

export type Comparison = {
  metric: "reach" | "interactions";
  value: number;
  usual: number;
  /** value / usual */
  ratio: number;
  band: Band;
  /** Instagram numbers keep moving for about two days. */
  settled: boolean;
  /** How many earlier posts the usual is based on. */
  basedOn: number;
};

/** Fewest earlier posts we'll call a "usual". */
export const MIN_HISTORY = 4;
/** Most recent earlier posts the usual is drawn from. */
export const HISTORY_WINDOW = 20;
export const SETTLE_HOURS = 48;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function interactions(p: PerfPost): number | null {
  if (p.likes === null && p.comments === null) return null;
  return (p.likes ?? 0) + (p.comments ?? 0);
}

function time(p: PerfPost): number {
  const t = p.postDate ? Date.parse(p.postDate) : NaN;
  return Number.isFinite(t) ? t : 0;
}

export function bandFor(ratio: number): Band {
  if (ratio >= 1.8) return "well_above";
  if (ratio >= 1.2) return "above";
  if (ratio >= 0.8) return "usual";
  return "quieter";
}

/**
 * Compares a post with the artist's earlier posts. `history` can include the
 * post itself and later posts; only earlier ones count. Returns null when
 * there's nothing fair to compare against yet.
 */
export function compareToUsual(
  post: PerfPost,
  history: PerfPost[],
  now: Date = new Date()
): Comparison | null {
  const t = time(post);
  const earlier = history
    .filter((h) => h.id !== post.id && !h.excluded && time(h) < t)
    .sort((a, b) => time(b) - time(a))
    .slice(0, HISTORY_WINDOW);

  const settled = t > 0 && now.getTime() - t >= SETTLE_HOURS * 3600000;

  if (post.reach !== null && post.reach > 0) {
    const reaches = earlier.map((h) => h.reach).filter((r): r is number => r !== null && r > 0);
    if (reaches.length >= MIN_HISTORY) {
      const usual = median(reaches);
      const ratio = post.reach / usual;
      return { metric: "reach", value: post.reach, usual, ratio, band: bandFor(ratio), settled, basedOn: reaches.length };
    }
  }

  const value = interactions(post);
  if (value === null) return null;
  const past = earlier.map(interactions).filter((v): v is number => v !== null);
  if (past.length < MIN_HISTORY) return null;
  const usual = median(past);
  if (usual <= 0) return null;
  const ratio = value / usual;
  return { metric: "interactions", value, usual, ratio, band: bandFor(ratio), settled, basedOn: past.length };
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-GB");
}

/**
 * One plain line for the artist, e.g. "Reached 1,240, about double your usual."
 * Quieter posts get a neutral line, never a telling-off.
 */
export function describeComparison(c: Comparison): string {
  const what = c.metric === "reach" ? `Reached ${fmt(c.value)}` : `${fmt(c.value)} likes and comments`;
  if (!c.settled) return `${what} so far. Still settling.`;

  switch (c.band) {
    case "well_above": {
      const times = c.ratio >= 2.75 ? `${Math.round(c.ratio)} times` : c.ratio >= 1.9 ? "double" : "nearly double";
      return `${what}, about ${times} your usual.`;
    }
    case "above":
      return `${what}, more than your usual.`;
    case "usual":
      return `${what}, about your usual.`;
    case "quieter":
      return `${what}, quieter than usual. One post doesn't make a pattern.`;
  }
}

/** A post's numbers at about 24 hours old (the sync's snapshot). */
export type EarlyPost = { id: string; postDate: string | null; reach24h: number | null; excluded?: boolean };

/**
 * The early read: a post's reach at 24 hours against the artist's other
 * posts at the same age. Null until there are enough earlier snapshots to
 * call a usual (they build up as posts pass 24 hours under the new sync).
 */
export function compareEarly(post: EarlyPost, history: EarlyPost[]): Comparison | null {
  if (post.reach24h === null || post.reach24h <= 0) return null;
  const t = post.postDate ? Date.parse(post.postDate) : 0;
  const earlier = history
    .filter((h) => h.id !== post.id && !h.excluded && (h.postDate ? Date.parse(h.postDate) : 0) < t)
    .map((h) => h.reach24h)
    .filter((r): r is number => r !== null && r > 0)
    .slice(0, HISTORY_WINDOW);
  if (earlier.length < MIN_HISTORY) return null;
  const usual = median(earlier);
  const ratio = post.reach24h / usual;
  return { metric: "reach", value: post.reach24h, usual, ratio, band: bandFor(ratio), settled: false, basedOn: earlier.length };
}

/** "At 24 hours: reached 1,240, ahead of your usual at that point." */
export function describeEarly(c: Comparison): string {
  const head = `At 24 hours: reached ${fmt(c.value)}`;
  switch (c.band) {
    case "well_above":
      return `${head}, well ahead of your usual at that point.`;
    case "above":
      return `${head}, ahead of your usual at that point.`;
    case "usual":
      return `${head}, about your usual at that point.`;
    case "quieter":
      return `${head}, a slower start than usual. Some posts pick up later.`;
  }
}
