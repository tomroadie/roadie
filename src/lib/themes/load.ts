import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostResult } from "@/lib/post-results";
import { SIGNAL_LABEL, SIGNAL_WEIGHTS, type SignalName } from "@/lib/performance";

export type Theme = {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "suggested" | "archived";
  source: "tempo" | "artist";
};

export type ThemeStats = {
  /** Posts sorted into this theme (in the loaded window). */
  posts: number;
  /** Settled posts with a fair comparison. */
  compared: number;
  /** Median ratio against the artist's usual, or null below MIN_COMPARED. */
  ratio: number | null;
};

export type Learning = {
  /** Short headline number, e.g. "2.1×" or "+41%". */
  stat: string;
  title: string;
  body: string;
  /** Small label underneath: the theme or area it's about. */
  tag: string;
  /** "win" = what's working; "improve" = the one thing most worth changing, with what to do. */
  kind?: "win" | "improve";
};

/** Fewest settled posts in a group before we'll say anything about it. */
export const MIN_COMPARED = 3;
/** A group has to beat the usual by this much to be a learning. */
const LEARNING_RATIO = 1.2;

export async function loadThemes(
  supabase: SupabaseClient,
  artistId: string
): Promise<{ active: Theme[]; suggested: Theme[] }> {
  const { data, error } = await supabase
    .from("content_themes")
    .select("id, name, description, status, source")
    .eq("artist_id", artistId)
    .in("status", ["active", "suggested"])
    .order("position");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Theme[];
  return {
    active: rows.filter((t) => t.status === "active"),
    suggested: rows.filter((t) => t.status === "suggested"),
  };
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Posts that count towards learnings: settled, compared, not an ad or collab. */
function comparable(posts: PostResult[]): PostResult[] {
  return posts.filter((p) => !p.excluded && p.comparison !== null && p.comparison.settled);
}

export function statsFor(posts: PostResult[], themeId: string): ThemeStats {
  const mine = posts.filter((p) => p.themeId === themeId);
  const ratios = comparable(mine).map((p) => p.comparison!.ratio);
  return {
    posts: mine.length,
    compared: ratios.length,
    ratio: ratios.length >= MIN_COMPARED ? median(ratios) : null,
  };
}

/** "2.1×" for big wins, "+41%" / "−9%" otherwise, "On par" when close. */
export function formatRatio(ratio: number): string {
  if (ratio >= 1.9) return `${ratio.toFixed(1)}×`;
  const pct = Math.round((ratio - 1) * 100);
  if (Math.abs(pct) < 5) return "On par";
  return pct > 0 ? `+${pct}%` : `−${Math.abs(pct)}%`;
}

const FORMAT_NAMES: Record<string, string> = {
  VIDEO: "Reels",
  REELS: "Reels",
  CAROUSEL_ALBUM: "Carousels",
  IMAGE: "Photos",
};

export function formatName(mediaType: string | null): string {
  const n = FORMAT_NAMES[String(mediaType ?? "").toUpperCase()];
  return n ? n.replace(/s$/, "") : "Post";
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function weekdayOf(iso: string | null): number | null {
  if (!iso) return null;
  const name = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "Europe/London" }).format(
    new Date(iso)
  );
  const i = WEEKDAYS.indexOf(name);
  return i === -1 ? null : i;
}

/**
 * How a group of posts beats their usual, in words: "do better than your
 * usual, especially for shares" when the value score is in play, otherwise
 * the single measure the comparison used.
 */
function doesBetter(posts: PostResult[]): string {
  if (!posts.every((p) => p.comparison?.metric === "reach")) return "get more likes and comments than your usual";
  const blended = posts.some((p) => p.comparison?.signals?.some((sg) => sg.name !== "reach"));
  if (!blended) return "get more reach than your usual";
  const byName = new Map<SignalName, number[]>();
  for (const p of posts) {
    for (const sg of p.comparison?.signals ?? []) byName.set(sg.name, [...(byName.get(sg.name) ?? []), sg.ratio]);
  }
  let best: { name: SignalName; score: number } | null = null;
  for (const [name, ratios] of byName) {
    if (name === "reach" || ratios.length < 2) continue;
    const r = median(ratios);
    const score = SIGNAL_WEIGHTS[name] * Math.log(r);
    if (r >= 1.3 && (!best || score > best.score)) best = { name, score };
  }
  return best ? `do better than your usual, especially for ${SIGNAL_LABEL[best.name]}` : "do better than your usual overall";
}

type Group = { key: string; label: string; posts: PostResult[] };

function bestGroup(groups: Group[]): { group: Group; ratio: number } | null {
  let best: { group: Group; ratio: number } | null = null;
  for (const g of groups) {
    if (g.posts.length < MIN_COMPARED) continue;
    const r = median(g.posts.map((p) => p.comparison!.ratio));
    if (r >= LEARNING_RATIO && (!best || r > best.ratio)) best = { group: g, ratio: r };
  }
  return best;
}

/** Fewer posts than this in RHYTHM_DAYS and posting more often is the first learning. */
const RHYTHM_DAYS = 90;
const RHYTHM_MIN_POSTS = 6;
/** Comments need a clearer gap than reach before we call it a pattern. */
const COMMENTS_RATIO = 1.3;

function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "Europe/London" });
}

/** Most of their recent reach-compared posts land close to their usual. */
function steadyReach(settled: PostResult[]): { within: number; of: number } | null {
  const recent = settled.filter((p) => p.comparison!.metric === "reach").slice(0, 12);
  if (recent.length < 6) return null;
  const reachOf = (p: PostResult) => p.comparison!.reachRatio ?? p.comparison!.ratio;
  const within = recent.filter((p) => reachOf(p) >= 0.8 && reachOf(p) <= 1.25).length;
  return within / recent.length >= 0.7 ? { within, of: recent.length } : null;
}

/** The theme or format that gets clearly more comments than their usual. */
function commentsLeader(
  settled: PostResult[],
  themes: Theme[]
): { label: string; kind: "theme" | "format"; ratio: number; n: number } | null {
  const withComments = settled.filter((p) => p.comments !== null);
  if (withComments.length < 6) return null;
  const usual = median(withComments.map((p) => p.comments!));
  if (usual <= 0) return null;

  const groups: { label: string; kind: "theme" | "format"; posts: PostResult[] }[] = [
    ...themes.map((t) => ({ label: t.name, kind: "theme" as const, posts: withComments.filter((p) => p.themeId === t.id) })),
  ];
  const formats = new Map<string, PostResult[]>();
  for (const p of withComments) {
    const f = formatName(p.mediaType);
    formats.set(f, [...(formats.get(f) ?? []), p]);
  }
  for (const [f, ps] of formats) groups.push({ label: f, kind: "format", posts: ps });

  let best: { label: string; kind: "theme" | "format"; ratio: number; n: number } | null = null;
  for (const g of groups) {
    if (g.posts.length < MIN_COMPARED) continue;
    const r = median(g.posts.map((p) => p.comments!)) / usual;
    if (r >= COMMENTS_RATIO && (!best || r > best.ratio)) best = { label: g.label, kind: g.kind, ratio: r, n: g.posts.length };
  }
  return best;
}

/** A group has to sit this far under the usual before it's worth changing. */
const IMPROVE_RATIO = 0.8;
/** …and be at least this share of what they post, or it isn't strategic. */
const IMPROVE_MIN_SHARE = 0.25;
/** The alternative has to beat the weak group by at least this much. */
const IMPROVE_MIN_LIFT = 0.25;

type Gap = {
  kind: "format" | "theme";
  weak: { label: string; ratio: number; n: number; share: number };
  strong: { label: string; ratio: number; n: number };
  impact: number;
};

/**
 * The single change most worth making: a format or concept that's a big
 * share of what they post, clearly under their usual, where something else
 * they already do clearly works better. Scored by how much of their output
 * it touches times the gap, so a one-off flop never qualifies. Null when
 * nothing clears every bar: then there's nothing strategic to say.
 */
function biggestGap(settled: PostResult[], themes: Theme[]): Gap | null {
  if (settled.length < 6) return null;
  const dims: { kind: Gap["kind"]; groups: { label: string; posts: PostResult[] }[] }[] = [];

  const formats = new Map<string, PostResult[]>();
  for (const p of settled) {
    const f = formatName(p.mediaType);
    formats.set(f, [...(formats.get(f) ?? []), p]);
  }
  dims.push({ kind: "format", groups: [...formats].map(([label, ps]) => ({ label, posts: ps })) });
  dims.push({
    kind: "theme",
    groups: themes.map((t) => ({ label: t.name, posts: settled.filter((p) => p.themeId === t.id) })),
  });

  let best: Gap | null = null;
  for (const d of dims) {
    const scored = d.groups
      .filter((g) => g.posts.length >= MIN_COMPARED)
      .map((g) => ({
        label: g.label,
        n: g.posts.length,
        share: g.posts.length / settled.length,
        ratio: median(g.posts.map((p) => p.comparison!.ratio)),
      }));
    for (const weak of scored) {
      if (weak.ratio > IMPROVE_RATIO || weak.share < IMPROVE_MIN_SHARE) continue;
      const strong = scored
        .filter((o) => o.label !== weak.label && o.ratio >= Math.max(1, weak.ratio + IMPROVE_MIN_LIFT))
        .sort((a, b) => b.ratio - a.ratio)[0];
      if (!strong) continue; // no better option they already use: nothing concrete to suggest
      const impact = weak.share * (strong.ratio - weak.ratio);
      if (!best || impact > best.impact) best = { kind: d.kind, weak, strong, impact };
    }
  }
  return best;
}

function improvementFrom(gap: Gap): Learning {
  const pct = Math.round(gap.weak.share * 100);
  if (gap.kind === "format") {
    const weak = gap.weak.label.toLowerCase();
    const strong = gap.strong.label.toLowerCase();
    return {
      kind: "improve",
      stat: formatRatio(gap.weak.ratio),
      title: `Swap some ${weak}s for ${strong}s`,
      body: `${gap.weak.label}s are ${pct}% of your posts but land below your usual. Your ${strong}s do ${formatRatio(gap.strong.ratio)}. Next time you'd post a ${weak}, try it as a ${strong} instead.`,
      tag: "Room to grow",
    };
  }
  return {
    kind: "improve",
    stat: formatRatio(gap.weak.ratio),
    title: `Lean from ${gap.weak.label} towards ${gap.strong.label}`,
    body: `${gap.weak.label} is ${pct}% of what you post but lands below your usual, while ${gap.strong.label} does ${formatRatio(gap.strong.ratio)}. Try the next couple of posts as ${gap.strong.label.toLowerCase()} and see if it holds.`,
    tag: "Room to grow",
  };
}

/**
 * What's working, plus the one change most worth making, from the artist's
 * own posts. Encouraging in tone, honest in content: up to two wins and one
 * improvement, which always comes with what to do. The improvement is the
 * posting rhythm when they post rarely (the biggest lever, readable from day
 * one), otherwise the biggest strategic gap if there is one.
 */
export function computeLearnings(posts: PostResult[], themes: Theme[], now: Date = new Date()): Learning[] {
  const settled = comparable(posts);
  const out: Learning[] = [];
  let improvement: Learning | null = null;
  const steady = steadyReach(settled);

  // Rhythm: how often they've posted lately. Works with almost no data.
  const dated = posts.filter((p) => p.postDate).sort((a, b) => Date.parse(b.postDate!) - Date.parse(a.postDate!));
  if (dated.length > 0) {
    const since = now.getTime() - RHYTHM_DAYS * 86400000;
    const recent = dated.filter((p) => Date.parse(p.postDate!) >= since).length;
    if (recent < RHYTHM_MIN_POSTS) {
      const audience = steady
        ? "Your audience still turns up when you do post, so"
        : "Every post is a chance to learn what works, so";
      improvement = {
        kind: "improve",
        stat: String(recent),
        title: recent === 1 ? "Post in the last 3 months" : "Posts in the last 3 months",
        body:
          recent === 0
            ? `Your last post was in ${monthYear(dated[0].postDate!)}. ${audience} getting a steady rhythm going is the biggest win. One post this week is a good start.`
            : `${audience} posting more often is the biggest lever right now. Tempo's weekly pace is built for exactly that.`,
        tag: "Rhythm",
      };
    }
  }
  if (!improvement) {
    const gap = biggestGap(settled, themes);
    if (gap) improvement = improvementFrom(gap);
  }

  const byTheme = bestGroup(
    themes.map((t) => ({ key: t.id, label: t.name, posts: settled.filter((p) => p.themeId === t.id) }))
  );
  if (byTheme) {
    out.push({
      stat: formatRatio(byTheme.ratio),
      title: `${byTheme.group.label} is landing`,
      body: `Your ${byTheme.group.label.toLowerCase()} posts ${doesBetter(byTheme.group.posts)}, across ${byTheme.group.posts.length} posts.`,
      tag: byTheme.group.label,
    });
  }

  const talk = commentsLeader(settled, themes);
  if (talk) {
    out.push({
      stat: formatRatio(talk.ratio),
      title: talk.kind === "theme" ? `${talk.label} gets people talking` : `${talk.label}s get people talking`,
      body:
        talk.kind === "theme"
          ? `Your ${talk.label.toLowerCase()} posts get more comments than your usual, across ${talk.n} posts.`
          : `Your ${talk.label.toLowerCase()}s get more comments than your usual, across ${talk.n} posts.`,
      tag: "Comments",
    });
  }

  const formats = new Map<string, PostResult[]>();
  for (const p of settled) {
    const f = formatName(p.mediaType);
    formats.set(f, [...(formats.get(f) ?? []), p]);
  }
  const byFormat = bestGroup([...formats].map(([f, ps]) => ({ key: f, label: f, posts: ps })));
  if (byFormat) {
    out.push({
      stat: formatRatio(byFormat.ratio),
      title: `${byFormat.group.label}s work for you`,
      body: `Your ${byFormat.group.label.toLowerCase()}s ${doesBetter(byFormat.group.posts)}. Worth leaning on.`,
      tag: "Format",
    });
  }

  if (steady) {
    out.push({
      stat: `${steady.within}/${steady.of}`,
      title: "Your reach is steady",
      body: `${steady.within} of your last ${steady.of} posts reached within about 20% of your usual. Your audience turns up whatever you post.`,
      tag: "Reach",
    });
  }

  const days = new Map<number, PostResult[]>();
  for (const p of settled) {
    const d = weekdayOf(p.postDate);
    if (d !== null) days.set(d, [...(days.get(d) ?? []), p]);
  }
  const byDay = bestGroup([...days].map(([d, ps]) => ({ key: String(d), label: WEEKDAYS[d], posts: ps })));
  if (byDay) {
    out.push({
      stat: byDay.group.label.slice(0, 3),
      title: `${byDay.group.label}s are a good slot`,
      body: `Posts on a ${byDay.group.label} have done better than your usual so far.`,
      tag: "Timing",
    });
  }

  const wins = out.map((l) => ({ ...l, kind: "win" as const }));
  return improvement ? [...wins.slice(0, 2), improvement] : wins.slice(0, 3);
}

/**
 * When there's no learning yet: the concept closest to one, and how many
 * posts are still settling, so the box says something real instead of
 * sitting empty. Never negative.
 */
export function learningHint(posts: PostResult[], themes: Theme[]): string | null {
  const settled = comparable(posts);
  let best: { name: string; ratio: number } | null = null;
  for (const t of themes) {
    const ratios = settled.filter((p) => p.themeId === t.id).map((p) => p.comparison!.ratio);
    if (ratios.length < 2) continue;
    const r = median(ratios);
    if (!best || r > best.ratio) best = { name: t.name, ratio: r };
  }

  const settling = posts.filter((p) => !p.excluded && p.comparison !== null && !p.comparison.settled).length;
  const parts: string[] = [];
  if (best && best.ratio >= 1.05) {
    parts.push(
      `${best.name} is your strongest concept so far (${formatRatio(best.ratio)} on your usual). A couple more posts there will show whether it's a pattern.`
    );
  } else if (best && best.ratio >= 0.95) {
    parts.push(`${best.name} is holding steady at your usual. A few more posts and the patterns will start to show.`);
  }
  if (settling > 0) {
    parts.push(`${settling} recent ${settling === 1 ? "post is" : "posts are"} still settling.`);
  }
  return parts.length > 0 ? parts.join(" ") : null;
}
