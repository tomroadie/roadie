import type { SupabaseClient } from "@supabase/supabase-js";
import { generateConceptPool } from "./generate";
import { saveDraftGeneration, publishGeneration } from "./store";
import { appBaseUrl, buildEmailRecipient, sendEmail } from "@/lib/email";
import { yourWeekEmail } from "@/lib/email-templates";
import type { ConceptExecution } from "./types";
import { effectivePrime, nextTarget, type WeekRow } from "@/lib/pace";
import { boardWeek } from "@/lib/board-week";
import { refreshThemesForArtist } from "@/lib/themes/refresh";

export const BOARD_TIMEZONE = "Europe/London";

/** 0 = Sunday ... 6 = Saturday, in the board's timezone. */
export function weekdayInTimezone(now: Date, timeZone = BOARD_TIMEZONE): number {
  const name = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone }).format(now);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}


export type WeeklyOutcome = {
  artistId: string;
  artistName: string;
  generationId: string;
  postedLastWeek: number;
  previousTarget: number | null;
  target: number;
  published: boolean;
  emailed: boolean;
  warnings: string[];
  /** The model that wrote the ideas, and how long it took. */
  model: string;
  seconds: number;
};

/**
 * Posts in the last 7 days: the larger of what they marked as posted on the
 * board and what Instagram sync saw, so a post counted both ways isn't
 * double-counted.
 */
async function postsInLastWeek(admin: SupabaseClient, artistId: string, now: Date): Promise<number> {
  const since = new Date(now.getTime() - 7 * 86400000).toISOString();
  const [marked, synced] = await Promise.all([
    admin
      .from("concepts")
      .select("id", { count: "exact", head: true })
      .eq("artist_id", artistId)
      .eq("status", "posted")
      .gte("posted_at", since),
    admin
      .from("post_performance")
      .select("id", { count: "exact", head: true })
      .eq("artist_id", artistId)
      .gte("post_date", since),
  ]);
  return Math.max(marked.count ?? 0, synced.count ?? 0);
}

/**
 * The weekly step for one artist: adapt the target, generate a fresh pool and
 * save it as a draft. With autoPublish it also goes live and sends "Your week".
 */
export async function runWeeklyForArtist(
  admin: SupabaseClient,
  artistId: string,
  opts: { autoPublish: boolean; now?: Date }
): Promise<WeeklyOutcome> {
  const now = opts.now ?? new Date();

  const { data: profile, error } = await admin
    .from("profiles")
    .select("artist_name, weekly_target, week_start_day, prime_target, prime_suggested")
    .eq("id", artistId)
    .maybeSingle();
  if (error || !profile) throw new Error(`profile: ${error?.message ?? "not found"}`);

  const postedLastWeek = await postsInLastWeek(admin, artistId, now);
  const previousTarget =
    typeof profile.weekly_target === "number" ? profile.weekly_target : null;
  const prime = effectivePrime(profile);
  const weekStart = boardWeek(profile.week_start_day, now).start;
  const lastWeekStart = new Date(Date.parse(`${weekStart}T12:00:00Z`) - 7 * 86400000).toISOString().slice(0, 10);

  // Close last week: its target, what they posted, hit or miss. A quiet
  // week keeps its outcome. Then step the target on the two-week rules.
  // Only a week they were on Tempo for counts: their board must have gone
  // live before last week ended, or it would be a "miss" they never had.
  const { data: firstLive } = await admin
    .from("concept_generations")
    .select("published_at")
    .eq("artist_id", artistId)
    .not("published_at", "is", null)
    .order("published_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const wasLiveLastWeek =
    Boolean(firstLive?.published_at) && Date.parse(String(firstLive?.published_at)) < Date.parse(`${weekStart}T00:00:00Z`);

  let paceReason = "first week";
  if (previousTarget !== null && wasLiveLastWeek) {
    const { data: lastRow } = await admin
      .from("weekly_targets")
      .select("outcome")
      .eq("artist_id", artistId)
      .eq("week_start", lastWeekStart)
      .maybeSingle();
    const outcome = lastRow?.outcome === "quiet" ? "quiet" : postedLastWeek >= previousTarget ? "hit" : "miss";
    const { error: closeErr } = await admin.from("weekly_targets").upsert(
      { artist_id: artistId, week_start: lastWeekStart, target: previousTarget, posted: postedLastWeek, outcome },
      { onConflict: "artist_id,week_start", ignoreDuplicates: false }
    );
    if (closeErr) throw new Error(`close week: ${closeErr.message}`);

    const { data: finished } = await admin
      .from("weekly_targets")
      .select("week_start, target, posted, outcome, step_offer")
      .eq("artist_id", artistId)
      .lte("week_start", lastWeekStart)
      .order("week_start", { ascending: false })
      .limit(6);
    const next = nextTarget(previousTarget, prime, (finished ?? []) as WeekRow[]);
    paceReason = next.reason;
    if (next.target !== previousTarget) {
      const { error: tErr } = await admin.from("profiles").update({ weekly_target: next.target }).eq("id", artistId);
      if (tErr) throw new Error(`target: ${tErr.message}`);
    }
  }

  const genStarted = Date.now();
  const result = await generateConceptPool(admin, artistId, { now });
  const genSeconds = Math.round((Date.now() - genStarted) / 1000);
  // First week: the generator derives a starting target from history.
  const target = Math.min(result.context.weeklyTarget, prime);
  if (previousTarget === null || target !== result.context.weeklyTarget) {
    await admin.from("profiles").update({ weekly_target: target }).eq("id", artistId);
  }
  // Open this week's row (a step answer given earlier this week is kept).
  await admin
    .from("weekly_targets")
    .upsert({ artist_id: artistId, week_start: weekStart, target }, { onConflict: "artist_id,week_start" });

  const generationId = await saveDraftGeneration(admin, result, null, {
    kind: "weekly",
    posted_last_week: postedLastWeek,
    previous_target: previousTarget,
    target,
    pace_reason: paceReason,
    model: result.model,
    attempts: result.attempts,
    seconds: genSeconds,
  });

  // Sort the new ideas (and any unsorted posts) into the artist's themes.
  // A failure here never holds up the week.
  const warnings = [...result.warnings];
  try {
    await refreshThemesForArtist(admin, artistId, now);
  } catch (e) {
    warnings.push(`themes: ${e instanceof Error ? e.message : String(e)}`);
  }

  let published = false;
  let emailed = false;
  if (opts.autoPublish) {
    await publishGeneration(admin, generationId);
    published = true;
    emailed = await sendYourWeek(admin, generationId);
  }

  return {
    artistId,
    artistName: result.context.artistName,
    generationId,
    postedLastWeek,
    previousTarget,
    target,
    published,
    emailed,
    warnings,
    model: result.model,
    seconds: genSeconds,
  };
}

/**
 * Sends "Your week" for a live weekly generation. Returns false (without
 * failing) when the artist has emails paused or it was already sent today.
 */
export async function sendYourWeek(admin: SupabaseClient, generationId: string): Promise<boolean> {
  const { data: gen } = await admin
    .from("concept_generations")
    .select("artist_id, focus, status, context_summary")
    .eq("id", generationId)
    .maybeSingle();
  if (!gen || gen.status !== "live") return false;

  const summary = (gen.context_summary ?? {}) as Record<string, unknown>;
  const artistId = String(gen.artist_id);

  const today = new Date().toISOString().slice(0, 10);
  const fortnight = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

  const [{ data: profile }, { data: events }, { data: pinned }, { data: board }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, owner_user_id, artist_name, plan, marketing_unsubscribed, all_emails_paused, weekly_target")
      .eq("id", artistId)
      .maybeSingle(),
    admin
      .from("events")
      .select("title, event_date")
      .eq("artist_id", artistId)
      .gte("event_date", today)
      .lte("event_date", fortnight)
      .order("event_date"),
    admin
      .from("concepts")
      .select("title, executions")
      .eq("artist_id", artistId)
      .eq("status", "pinned")
      .order("pinned_at", { ascending: false })
      .limit(1),
    admin
      .from("concepts")
      .select("title, executions")
      .eq("artist_id", artistId)
      .eq("status", "board")
      .order("slot")
      .limit(1),
  ]);
  if (!profile) return false;

  const recipient = await buildEmailRecipient(
    admin as Parameters<typeof buildEmailRecipient>[0],
    profile
  );
  if (!recipient) return false;

  // A pinned idea first (they already said yes to it), else the first card.
  const source = pinned?.[0] ?? board?.[0] ?? null;
  const executions = (Array.isArray(source?.executions) ? source.executions : []) as ConceptExecution[];
  const easy = executions.find((e) => e.effort === "low") ?? executions[0];

  const email = yourWeekEmail({
    artistId,
    artistName: recipient.artistName,
    appUrl: appBaseUrl(),
    focus: String(gen.focus),
    postedLastWeek: Number(summary.posted_last_week ?? 0),
    previousTarget:
      typeof summary.previous_target === "number" ? summary.previous_target : null,
    target: Number(summary.target ?? profile.weekly_target ?? 1),
    comingUp: (events ?? []).map((e) => ({ date: String(e.event_date), title: String(e.title ?? "") })),
    easyIdea: source && easy ? { title: String(source.title), idea: easy.idea } : null,
    welcomeBack: await lastWeekWasQuiet(admin, artistId),
  });

  return sendEmail({
    to: recipient.email,
    subject: email.subject,
    html: email.html,
    recipient,
    type: "your_week",
    metadata: { generation_id: generationId },
  });
}

/** Drafts go live on their own this long after they're made, unless already published. */
export const REVIEW_WINDOW_HOURS = Number(process.env.CONCEPT_REVIEW_WINDOW_HOURS ?? 24);

/**
 * Publishes weekly and first-board drafts that have waited past the review
 * window, so artists are never stuck on last week's ideas. Edits made in
 * review are kept (the draft is published as it stands). Weekly ones also
 * send "Your week". Skipped when the artist already has a newer live board.
 */
export async function autoPublishDueDrafts(
  admin: SupabaseClient,
  now: Date = new Date()
): Promise<{ published: string[]; failed: string[] }> {
  const cutoff = new Date(now.getTime() - REVIEW_WINDOW_HOURS * 3600000).toISOString();
  const { data: drafts, error } = await admin
    .from("concept_generations")
    .select("id, artist_id, created_at, kind:context_summary->>kind")
    .eq("status", "draft")
    .eq("held", false)
    .lte("created_at", cutoff)
    .gte("created_at", new Date(now.getTime() - 14 * 86400000).toISOString())
    .order("created_at", { ascending: true });
  if (error) throw new Error(`drafts: ${error.message}`);

  const published: string[] = [];
  const failed: string[] = [];
  for (const d of drafts ?? []) {
    if (d.kind !== "weekly" && d.kind !== "first") continue;
    const { data: newer } = await admin
      .from("concept_generations")
      .select("id")
      .eq("artist_id", d.artist_id)
      .eq("status", "live")
      .gt("published_at", String(d.created_at))
      .limit(1);
    if (newer && newer.length > 0) continue;
    try {
      await publishGeneration(admin, String(d.id));
      if (d.kind === "weekly") await sendYourWeek(admin, String(d.id));
      published.push(String(d.artist_id));
    } catch (e) {
      failed.push(`${d.artist_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { published, failed };
}

/** Whether the artist's most recent finished week was a quiet week. */
async function lastWeekWasQuiet(admin: SupabaseClient, artistId: string): Promise<boolean> {
  const { data: profile } = await admin.from("profiles").select("week_start_day").eq("id", artistId).maybeSingle();
  const start = boardWeek(profile?.week_start_day).start;
  const { data } = await admin
    .from("weekly_targets")
    .select("outcome")
    .eq("artist_id", artistId)
    .lt("week_start", start)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.outcome === "quiet";
}
