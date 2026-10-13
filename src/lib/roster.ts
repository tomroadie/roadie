import type { SupabaseClient } from "@supabase/supabase-js";
import { boardWeek } from "@/lib/board-week";
import { loadPostResults, type PostResult } from "@/lib/post-results";
import { formatName, formatRatio } from "@/lib/themes/load";
import { describeSignal } from "@/lib/performance";
import { VISUAL_KIND_LABEL, type VisualKind } from "@/lib/visual-kinds";
import { asAccountType, ACCOUNT_TYPE_LABEL } from "@/lib/account-types";

/**
 * A roster: a manager's artists seen together. Every line here comes from
 * their own data: this week's posts against target, dates coming up, and
 * patterns that hold across three or more of them.
 */

export type RosterRow = {
  artistId: string;
  name: string;
  handle: string | null;
  typeLabel: string | null;
  live: boolean;
  target: number | null;
  posted: number;
  expected: number;
  onPace: boolean;
  quiet: boolean;
  status: string;
  /** Higher needs attention sooner. */
  attention: number;
  nextDate: { date: string; title: string; type: string } | null;
};

export type RosterLearning = { title: string; body: string; artists: number };

export type RosterView = {
  id: string;
  name: string;
  rows: RosterRow[];
  totals: { posted: number; target: number; onPace: number; counted: number };
  comingUp: { artist: string; date: string; title: string; type: string }[];
  learnings: RosterLearning[];
};

const DAY = 86400000;
const MIN_ARTISTS = 3;
const LIFT = 1.2;

function median(v: number[]): number {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function weekdayName(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "Europe/London" }).format(new Date(iso));
}

function shortDay(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** The one line about where an artist is this week. */
function statusFor(r: {
  live: boolean;
  quiet: boolean;
  posted: number;
  target: number | null;
  onPace: boolean;
  daysSincePost: number | null;
  best: PostResult | null;
  nextDate: RosterRow["nextDate"];
  watched: boolean;
}): { text: string; attention: number } {
  const soon = r.nextDate && Date.parse(`${r.nextDate.date}T12:00:00`) - Date.now() <= 7 * DAY ? r.nextDate : null;
  if (r.watched) return { text: r.posted ? `${r.posted} posts this week` : "No posts yet this week", attention: 0 };
  if (!r.live) return { text: "Not set up yet", attention: 1 };
  if (r.quiet) return { text: "Quiet week, back next week", attention: 0 };
  if (r.daysSincePost !== null && r.daysSincePost >= 14) {
    const weeks = Math.floor(r.daysSincePost / 7);
    return {
      text: `Nothing posted for ${weeks} weeks${soon ? `, with ${soon.title} on ${shortDay(soon.date)}` : ""}`,
      attention: soon ? 4 : 3,
    };
  }
  if (!r.onPace && soon) {
    return { text: `Behind this week, and ${soon.title} is on ${shortDay(soon.date)}: a good moment to nudge`, attention: 4 };
  }
  const c = r.best?.comparison;
  if (r.best && c?.settled && c.ratio >= 1.5) {
    const what = c.standout && c.standout.name !== "reach" ? describeSignal(c.standout) : `${formatRatio(c.ratio)} their usual`;
    return { text: `${weekdayName(r.best.postDate ?? "")}'s ${formatName(r.best.mediaType).toLowerCase()}: ${what}`, attention: 0 };
  }
  if (r.target && r.posted >= r.target) return { text: "Target hit this week", attention: 0 };
  if (!r.onPace) return { text: `${r.posted} of ${r.target ?? "?"} so far, a little behind`, attention: 2 };
  if (soon) return { text: `${soon.title} on ${shortDay(soon.date)}`, attention: 0 };
  return { text: r.posted ? `${r.posted} of ${r.target ?? "?"} so far, on pace` : "Week's just started", attention: 0 };
}

type ArtistPosts = { name: string; posts: PostResult[] };

/**
 * A pattern across the roster: for each artist, posts with this trait
 * against their own usual. Kept when it lifts at least three artists.
 */
function patterns(all: ArtistPosts[], keyOf: (p: PostResult) => string | null, label: (k: string) => string) {
  const byKey = new Map<string, { names: string[]; lifts: number[] }>();
  for (const a of all) {
    const settled = a.posts.filter((p) => !p.excluded && p.comparison?.settled);
    if (settled.length < 6) continue;
    const base = median(settled.map((p) => p.comparison!.ratio));
    if (base <= 0) continue;
    const groups = new Map<string, number[]>();
    for (const p of settled) {
      const k = keyOf(p);
      if (k) groups.set(k, [...(groups.get(k) ?? []), p.comparison!.ratio]);
    }
    for (const [k, ratios] of groups) {
      if (ratios.length < 2 || ratios.length === settled.length) continue;
      const lift = median(ratios) / base;
      if (lift < LIFT) continue;
      const cur = byKey.get(k) ?? { names: [], lifts: [] };
      cur.names.push(a.name);
      cur.lifts.push(lift);
      byKey.set(k, cur);
    }
  }
  return [...byKey]
    .filter(([, v]) => v.names.length >= MIN_ARTISTS)
    .map(([k, v]) => ({ key: k, label: label(k), names: v.names, lift: median(v.lifts) }));
}

function list(names: string[]): string {
  return names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export async function loadRoster(admin: SupabaseClient, rosterId: string, now: Date = new Date()): Promise<RosterView | null> {
  const [{ data: roster }, { data: links }] = await Promise.all([
    admin.from("rosters").select("id, name").eq("id", rosterId).maybeSingle(),
    admin.from("roster_artists").select("artist_id").eq("roster_id", rosterId),
  ]);
  if (!roster) return null;
  const ids = (links ?? []).map((l) => String(l.artist_id));
  if (ids.length === 0) {
    return { id: String(roster.id), name: String(roster.name), rows: [], totals: { posted: 0, target: 0, onPace: 0, counted: 0 }, comingUp: [], learnings: [] };
  }

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now);
  const [{ data: profiles }, { data: events }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, artist_name, instagram_handle, account_type, board_enabled, weekly_target, week_start_day, quiet_week_start")
      .in("id", ids),
    admin
      .from("events")
      .select("artist_id, title, event_date, event_type")
      .in("artist_id", ids)
      .gte("event_date", today)
      .lte("event_date", new Date(now.getTime() + 28 * DAY).toISOString().slice(0, 10))
      .order("event_date"),
  ]);

  const rows: RosterRow[] = [];
  const forPatterns: ArtistPosts[] = [];
  const comingUp: RosterView["comingUp"] = [];

  for (const p of profiles ?? []) {
    const id = String(p.id);
    const name = String(p.artist_name ?? "Artist");
    const type = asAccountType(p.account_type);
    const watched = type !== "artist";
    const week = boardWeek(p.week_start_day, now);
    const results = await loadPostResults(admin, id, week.startsAt, now).catch(() => null);
    const posts = results?.posts ?? [];
    forPatterns.push({ name, posts });

    const thisWeek = posts.filter((r) => r.postDate && r.postDate.slice(0, 10) >= week.start);
    const posted = thisWeek.length;
    const target = !watched && typeof p.weekly_target === "number" ? p.weekly_target : null;
    const elapsed = Math.min(7, Math.max(1, Math.floor((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${week.start}T12:00:00Z`)) / DAY) + 1));
    const expected = target ? Math.floor((target * elapsed) / 7) : 0;
    const quiet = p.quiet_week_start === week.start;
    const onPace = !target || quiet || posted >= expected;
    const latest = posts.find((r) => r.postDate)?.postDate ?? null;
    const daysSincePost = latest ? Math.floor((now.getTime() - Date.parse(latest)) / DAY) : null;
    const best =
      thisWeek
        .concat(posts.filter((r) => r.postDate && now.getTime() - Date.parse(r.postDate) <= 10 * DAY))
        .filter((r) => !r.excluded && r.comparison?.settled)
        .sort((a, b) => b.comparison!.ratio - a.comparison!.ratio)[0] ?? null;
    const mine = (events ?? []).filter((e) => String(e.artist_id) === id);
    const next = mine[0]
      ? { date: String(mine[0].event_date), title: String(mine[0].title), type: String(mine[0].event_type ?? "") }
      : null;
    for (const e of mine.slice(0, 4)) {
      comingUp.push({ artist: name, date: String(e.event_date), title: String(e.title), type: String(e.event_type ?? "") });
    }

    const live = p.board_enabled === true;
    const s = statusFor({ live, quiet, posted, target, onPace, daysSincePost, best, nextDate: next, watched });
    rows.push({
      artistId: id,
      name,
      handle: p.instagram_handle ? String(p.instagram_handle).replace(/^@/, "") : null,
      typeLabel: watched ? ACCOUNT_TYPE_LABEL[type] : null,
      live,
      target,
      posted,
      expected,
      onPace,
      quiet,
      status: s.text,
      attention: s.attention,
      nextDate: next,
    });
  }

  rows.sort((a, b) => b.attention - a.attention || a.name.localeCompare(b.name));
  comingUp.sort((a, b) => a.date.localeCompare(b.date));

  const counted = rows.filter((r) => r.live && r.target && !r.quiet);
  const totals = {
    posted: counted.reduce((n, r) => n + r.posted, 0),
    target: counted.reduce((n, r) => n + (r.target ?? 0), 0),
    onPace: counted.filter((r) => r.onPace).length,
    counted: counted.length,
  };

  const found = [
    ...patterns(
      forPatterns,
      (p) => (p.visualKind && p.visualKind !== "other" ? p.visualKind : null),
      (k) => VISUAL_KIND_LABEL[k as VisualKind]
    ).map((x) => ({
      title: `${x.label} posts are working`,
      body: `For ${list(x.names)}, ${x.label.toLowerCase()} posts do better than their usual.`,
      artists: x.names.length,
      lift: x.lift,
    })),
    ...patterns(forPatterns, (p) => formatName(p.mediaType), (k) => k).map((x) => ({
      title: `${x.label}s work across the roster`,
      body: `${x.label}s beat the usual for ${list(x.names)}.`,
      artists: x.names.length,
      lift: x.lift,
    })),
    ...patterns(forPatterns, (p) => (p.postDate ? weekdayName(p.postDate) : null), (k) => k).map((x) => ({
      title: `${x.label}s are a good slot`,
      body: `Posts on a ${x.label} do better than usual for ${list(x.names)}.`,
      artists: x.names.length,
      lift: x.lift,
    })),
  ]
    .sort((a, b) => b.artists - a.artists || b.lift - a.lift)
    .slice(0, 3)
    .map(({ title, body, artists }) => ({ title, body, artists }));

  return { id: String(roster.id), name: String(roster.name), rows, totals, comingUp: comingUp.slice(0, 8), learnings: found };
}
