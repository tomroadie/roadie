/**
 * "How did this post do?" — always against the artist's own usual, never
 * against other artists. Reach is what the artist sees as the headline
 * number, but a post's worth is judged on a blend of signals against their
 * usual, weighted by what moves an artist forward: new followers most, then
 * shares, saves and profile visits, then comments and reach. When there
 * isn't enough reach history yet, likes + comments stand in.
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
  saves?: number | null;
  shares?: number | null;
  follows?: number | null;
  profileVisits?: number | null;
  /** Marked by the artist as an ad or collab: never part of anyone's usual. */
  excluded?: boolean;
};

export type SignalName = "follows" | "shares" | "saves" | "profileVisits" | "comments" | "reach";

/** What each signal is worth towards a post's value. */
export const SIGNAL_WEIGHTS: Record<SignalName, number> = {
  follows: 3,
  shares: 2,
  saves: 1.5,
  profileVisits: 1.5,
  comments: 1,
  reach: 1,
};

export const SIGNAL_LABEL: Record<SignalName, string> = {
  follows: "new followers",
  shares: "shares",
  saves: "saves",
  profileVisits: "profile visits",
  comments: "comments",
  reach: "reach",
};

export type Signal = { name: SignalName; value: number; usual: number; ratio: number };

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
  /**
   * Reach posts only: each signal against its usual, and `ratio` above is
   * the weighted blend of them. reachRatio keeps reach alone.
   */
  signals?: Signal[];
  reachRatio?: number;
  /** The signal that stood out most, worth telling the artist about. */
  standout?: Signal | null;
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
      const reachRatio = post.reach / usual;
      const signals = signalsFor(post, earlier);
      const ratio = blend(signals) ?? reachRatio;
      return {
        metric: "reach",
        value: post.reach,
        usual,
        ratio,
        band: bandFor(ratio),
        settled,
        basedOn: reaches.length,
        signals,
        reachRatio,
        standout: standoutOf(signals),
      };
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

function signalValue(p: PerfPost, name: SignalName): number | null {
  const v = name === "reach" ? p.reach : name === "comments" ? p.comments : p[name];
  return typeof v === "number" && v >= 0 ? v : null;
}

/**
 * Each signal against its usual over the same earlier posts. Small counts
 * are smoothed (+1 on both sides) so 1 share against a usual of 0 isn't
 * "infinitely better". Signals without enough history are left out.
 */
function signalsFor(post: PerfPost, earlier: PerfPost[]): Signal[] {
  const out: Signal[] = [];
  for (const name of Object.keys(SIGNAL_WEIGHTS) as SignalName[]) {
    const value = signalValue(post, name);
    if (value === null) continue;
    const past = earlier.map((h) => signalValue(h, name)).filter((v): v is number => v !== null);
    if (past.length < MIN_HISTORY) continue;
    const usual = median(past);
    const ratio = Math.min(10, Math.max(0.1, (value + 1) / (usual + 1)));
    out.push({ name, value, usual, ratio });
  }
  return out;
}

/** Weighted geometric mean of the signals' ratios, or null with only reach to go on. */
function blend(signals: Signal[]): number | null {
  if (signals.filter((s) => s.name !== "reach").length === 0) return null;
  let num = 0;
  let den = 0;
  for (const s of signals) {
    const w = SIGNAL_WEIGHTS[s.name];
    num += w * Math.log(s.ratio);
    den += w;
  }
  return den > 0 ? Math.exp(num / den) : null;
}

/** The most notable thing a post did: a clearly above-usual signal with real numbers behind it. */
function standoutOf(signals: Signal[]): Signal | null {
  const strong = signals
    .filter((s) => s.ratio >= 1.5 && s.value >= (s.name === "reach" ? 1 : 3) && s.value > s.usual)
    .sort((a, b) => SIGNAL_WEIGHTS[b.name] * Math.log(b.ratio) - SIGNAL_WEIGHTS[a.name] * Math.log(a.ratio));
  return strong[0] ?? null;
}

/** "3× your usual shares", "brought in 12 new followers", "40% more saves than usual". */
export function describeSignal(s: Signal): string {
  // Spoken figures use the plain ratio; the smoothed one is only for scoring.
  const r = s.usual > 0 ? s.value / s.usual : s.ratio;
  if (s.name === "follows") return `brought in ${Math.round(s.value)} new followers${s.usual > 0 ? `, ${r >= 1.9 ? `about ${Math.round(r)}×` : "more than"} your usual` : ""}`;
  if (r >= 1.9) return `${Math.round(r * 10) / 10}× your usual ${SIGNAL_LABEL[s.name]}`;
  return `${Math.round((r - 1) * 100)}% more ${SIGNAL_LABEL[s.name]} than usual`;
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

  const seenNotActed =
    (c.reachRatio ?? 0) >= 1.2 && (c.band === "usual" || c.band === "quieter")
      ? " More people saw it than usual, but fewer acted on it."
      : "";
  const extra = c.standout && c.standout.name !== "reach" ? ` It ${describeSignal(c.standout)}.` : seenNotActed;
  // With several signals blended, the band is about the post overall, not reach alone.
  const blended = (c.signals?.filter((s) => s.name !== "reach").length ?? 0) > 0;
  const lead = blended ? `${what}. Overall,` : `${what},`;
  switch (c.band) {
    case "well_above": {
      const times = c.ratio >= 2.75 ? `${Math.round(c.ratio)} times` : c.ratio >= 1.9 ? "double" : "nearly double";
      return `${lead} about ${times} your usual.${extra}`;
    }
    case "above":
      return `${lead} more than your usual.${extra}`;
    case "usual":
      return `${lead} about your usual.${extra}`;
    case "quieter":
      return `${lead} quieter than usual.${extra} One post doesn't make a pattern.`;
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
