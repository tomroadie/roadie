import type { SupabaseClient } from "@supabase/supabase-js";
import { generateConceptPool } from "./generate";
import { saveDraftGeneration, publishGeneration } from "./store";
import { appBaseUrl, buildEmailRecipient, sendEmail } from "@/lib/email";
import { yourWeekEmail } from "@/lib/email-templates";
import type { ConceptExecution } from "./types";

export const BOARD_TIMEZONE = "Europe/London";

/** 0 = Sunday ... 6 = Saturday, in the board's timezone. */
export function weekdayInTimezone(now: Date, timeZone = BOARD_TIMEZONE): number {
  const name = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone }).format(now);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

/** Highest weekly target the artist asked for, via their posting frequency. */
export function targetCeiling(postingFrequency: string | null | undefined): number {
  if (postingFrequency === "weekly") return 2;
  if (postingFrequency === "active") return 6;
  return 4;
}

/**
 * Couch to 5K: hit it and it rises by one; post nothing and it eases off by
 * one; anything in between holds. Never below 1, never above the ceiling.
 */
export function adaptTarget(current: number, postedLastWeek: number, ceiling: number): number {
  if (postedLastWeek >= current) return Math.min(current + 1, Math.max(ceiling, 1));
  if (postedLastWeek === 0) return Math.max(1, current - 1);
  return current;
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
    .select("artist_name, posting_frequency, weekly_target")
    .eq("id", artistId)
    .maybeSingle();
  if (error || !profile) throw new Error(`profile: ${error?.message ?? "not found"}`);

  const postedLastWeek = await postsInLastWeek(admin, artistId, now);
  const previousTarget =
    typeof profile.weekly_target === "number" ? profile.weekly_target : null;

  // First week: let the generator derive a starting target from history.
  if (previousTarget !== null) {
    const next = adaptTarget(previousTarget, postedLastWeek, targetCeiling(profile.posting_frequency));
    if (next !== previousTarget) {
      const { error: tErr } = await admin.from("profiles").update({ weekly_target: next }).eq("id", artistId);
      if (tErr) throw new Error(`target: ${tErr.message}`);
    }
  }

  const result = await generateConceptPool(admin, artistId, { now });
  const target = result.context.weeklyTarget;
  if (previousTarget === null) {
    await admin.from("profiles").update({ weekly_target: target }).eq("id", artistId);
  }

  const generationId = await saveDraftGeneration(admin, result, null, {
    kind: "weekly",
    posted_last_week: postedLastWeek,
    previous_target: previousTarget,
    target,
  });

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
    warnings: result.warnings,
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
