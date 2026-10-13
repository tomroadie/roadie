/**
 * Posting pace: the prime (the most an artist should post in a week at
 * their best) and the rules that move the weekly target towards it.
 * Pure functions, shared by the weekly job, the post sync and Home.
 */

const DAY_MS = 86400000;
/** Fallback prime before Tempo has worked one out. */
export const DEFAULT_PRIME = 4;
export const MAX_PRIME = 21;

/**
 * Best sustained rate: the most posts in any 28-day stretch over the past
 * year, as a weekly rate, rounded. A single big week (a release or festival)
 * doesn't set it; a month at that pace does. Null with no posts.
 */
export function bestSustainedRate(postDates: (string | Date)[], now: Date = new Date()): number | null {
  const since = now.getTime() - 365 * DAY_MS;
  const times = postDates
    .map((d) => (d instanceof Date ? d.getTime() : Date.parse(d)))
    .filter((t) => Number.isFinite(t) && t >= since && t <= now.getTime())
    .sort((a, b) => a - b);
  if (times.length === 0) return null;
  let best = 0;
  let start = 0;
  for (let end = 0; end < times.length; end++) {
    while (times[end] - times[start] >= 28 * DAY_MS) start++;
    best = Math.max(best, end - start + 1);
  }
  return Math.max(1, Math.min(MAX_PRIME, Math.round(best / 4)));
}

export function effectivePrime(p: { prime_target?: number | null; prime_suggested?: number | null }): number {
  return p.prime_target ?? p.prime_suggested ?? DEFAULT_PRIME;
}

export type WeekRow = {
  week_start: string;
  target: number;
  posted: number | null;
  outcome: "hit" | "miss" | "quiet" | null;
  step_offer: "accepted" | "declined" | null;
};

export type NextTarget = { target: number; reason: string };

/**
 * Next week's target from finished weeks, newest first. Quiet weeks are
 * skipped when looking at the last two weeks, and never count either way.
 *   - Said yes to "n+1?" last week: up one.
 *   - Beat the target by 2+ two weeks running: straight to their actual rate.
 *   - Hit it two weeks running (and didn't say "keep at n"): up one.
 *   - Under it two weeks running: down one (a zero week is a miss, not an instant drop).
 *   - Otherwise: hold.
 * Always between 1 and the prime.
 */
export function nextTarget(current: number, prime: number, finished: WeekRow[]): NextTarget {
  const clamp = (n: number) => Math.max(1, Math.min(prime, n));
  const last = finished[0];
  if (current > prime) return { target: prime, reason: "brought down to your prime" };
  if (!last) return { target: clamp(current), reason: "first week" };
  if (last.outcome === "quiet") return { target: clamp(current), reason: "quiet week" };

  if (last.step_offer === "accepted") return { target: clamp(current + 1), reason: "said yes to one more" };

  const counted = finished.filter((w) => w.outcome === "hit" || w.outcome === "miss").slice(0, 2);
  if (counted.length < 2) return { target: clamp(current), reason: "not enough weeks yet" };
  const [a, b] = counted;
  const pa = a.posted ?? 0;
  const pb = b.posted ?? 0;

  if (pa >= a.target + 2 && pb >= b.target + 2) {
    return { target: clamp(Math.max(current, Math.min(pa, pb))), reason: "well ahead two weeks running" };
  }
  const declined = finished.slice(0, 2).some((w) => w.step_offer === "declined");
  if (pa >= a.target && pb >= b.target && !declined) {
    return { target: clamp(current + 1), reason: "hit it two weeks running" };
  }
  if (pa < a.target && pb < b.target) {
    return { target: clamp(current - 1), reason: "under it two weeks running" };
  }
  return { target: clamp(current), reason: declined ? "kept at your choice" : "holding" };
}

/**
 * Whether to ask "Up for n+1 next week?" this week: target hit, room under
 * the prime, not answered this week, and no "keep at n" in the last two weeks.
 */
export function shouldOfferStep(p: {
  target: number;
  prime: number;
  postedThisWeek: number;
  thisWeek: WeekRow | null;
  finished: WeekRow[];
}): boolean {
  if (!p.thisWeek || p.thisWeek.step_offer) return false;
  if (p.thisWeek.outcome === "quiet") return false;
  if (p.postedThisWeek < p.target || p.target >= p.prime) return false;
  return !p.finished.slice(0, 2).some((w) => w.step_offer === "declined");
}

/**
 * Post timestamps for the past year from the Graph API (feed posts and
 * Reels; stories aren't in /media). Up to 4 pages of 100, stopping once
 * past a year. Used only to work out the prime.
 */
export async function fetchPostDatesForYear(
  graphBase: string,
  igUserId: string,
  accessToken: string,
  now: Date = new Date()
): Promise<string[]> {
  const since = now.getTime() - 365 * DAY_MS;
  const out: string[] = [];
  const first = new URL(`${graphBase}/${igUserId}/media`);
  first.searchParams.set("fields", "timestamp");
  first.searchParams.set("limit", "100");
  first.searchParams.set("access_token", accessToken);
  let next: string | undefined = first.toString();
  for (let page = 0; next && page < 4; page++) {
    const res: Response = await fetch(next, { cache: "no-store" });
    const json = (await res.json()) as { data?: { timestamp?: string }[]; paging?: { next?: string }; error?: { message?: string } };
    if (!res.ok || json.error) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
    const stamps = (json.data ?? []).map((m) => m.timestamp).filter((t): t is string => Boolean(t));
    out.push(...stamps);
    if (stamps.length === 0 || Date.parse(stamps[stamps.length - 1]) < since) break;
    next = json.paging?.next;
  }
  return out;
}
