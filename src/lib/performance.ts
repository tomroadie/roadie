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
