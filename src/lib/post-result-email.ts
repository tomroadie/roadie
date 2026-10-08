import type { SupabaseClient } from "@supabase/supabase-js";
import { appBaseUrl, buildEmailRecipient, sendEmail } from "@/lib/email";
import { postResultEmail } from "@/lib/email-templates";
import { compareToUsual, describeComparison, SETTLE_HOURS, type PerfPost } from "@/lib/performance";
import { boardWeek } from "@/lib/board-week";
import type { ConceptExecution } from "@/lib/concepts/types";

const DAY_MS = 86400000;
/** Posts older than this when they settle aren't worth an email any more. */
const MAX_AGE_DAYS = 7;

export type PostResultOutcome =
  | { sent: true; postId: string }
  | { sent: false; reason: string };

/**
 * Sends "You posted, here's how it did" for the artist's newest post whose
 * numbers have settled and that hasn't had one yet. At most one a day
 * (sendEmail enforces it), only for board artists, and only for posts made
 * after their board went live, so switching the board on doesn't trigger a
 * backlog.
 */
export async function sendPostResultEmail(
  admin: SupabaseClient,
  artistId: string,
  now: Date = new Date()
): Promise<PostResultOutcome> {
  const { data: profile } = await admin
    .from("profiles")
    .select(
      "id, owner_user_id, artist_name, plan, marketing_unsubscribed, all_emails_paused, weekly_target, week_start_day, board_enabled"
    )
    .eq("id", artistId)
    .maybeSingle();
  if (!profile?.board_enabled) return { sent: false, reason: "board off" };

  const { data: firstLive } = await admin
    .from("concept_generations")
    .select("published_at")
    .eq("artist_id", artistId)
    .not("published_at", "is", null)
    .order("published_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!firstLive?.published_at) return { sent: false, reason: "no board yet" };

  const settledBefore = now.getTime() - SETTLE_HOURS * 3600000;
  const since = Math.max(now.getTime() - MAX_AGE_DAYS * DAY_MS, Date.parse(String(firstLive.published_at)));

  const [{ data: rows }, { data: sentLog }] = await Promise.all([
    admin
      .from("post_performance")
      .select(
        "instagram_post_id, post_date, ig_media_type, caption, permalink, thumbnail_url, reach, likes, comments, excluded_from_usual"
      )
      .eq("artist_id", artistId)
      .not("post_date", "is", null)
      .order("post_date", { ascending: false })
      .limit(40),
    admin
      .from("email_log")
      .select("metadata")
      .eq("artist_id", artistId)
      .eq("email_type", "post_detected")
      .gte("sent_at", new Date(now.getTime() - 30 * DAY_MS).toISOString()),
  ]);
  if (!rows?.length) return { sent: false, reason: "no posts" };

  const emailed = new Set(
    (sentLog ?? [])
      .map((l) => (l.metadata as { instagram_post_id?: unknown } | null)?.instagram_post_id)
      .filter((id): id is string => typeof id === "string")
  );

  const perf: PerfPost[] = rows.map((r) => ({
    id: String(r.instagram_post_id),
    postDate: String(r.post_date),
    mediaType: r.ig_media_type ?? null,
    reach: typeof r.reach === "number" ? r.reach : null,
    likes: typeof r.likes === "number" ? r.likes : null,
    comments: typeof r.comments === "number" ? r.comments : null,
    excluded: r.excluded_from_usual === true,
  }));

  const index = rows.findIndex(
    (r, i) =>
      !perf[i].excluded &&
      !emailed.has(perf[i].id) &&
      Date.parse(String(r.post_date)) >= since &&
      Date.parse(String(r.post_date)) <= settledBefore
  );
  if (index === -1) return { sent: false, reason: "nothing new and settled" };

  const row = rows[index];
  const post = perf[index];
  const comparison = compareToUsual(post, perf, now);
  if (!comparison?.settled) return { sent: false, reason: "no fair comparison yet" };

  const week = boardWeek(profile.week_start_day);
  const [{ data: idea }, { count: marked }, { data: board }] = await Promise.all([
    admin.from("concepts").select("title").eq("instagram_post_id", post.id).maybeSingle(),
    admin
      .from("concepts")
      .select("id", { count: "exact", head: true })
      .eq("artist_id", artistId)
      .eq("status", "posted")
      .gte("posted_at", week.startsAt),
    admin
      .from("concepts")
      .select("title, executions")
      .eq("artist_id", artistId)
      .eq("status", "board")
      .order("slot")
      .limit(1),
  ]);
  const syncedThisWeek = perf.filter((p) => p.postDate && Date.parse(p.postDate) >= Date.parse(week.startsAt)).length;
  const target = typeof profile.weekly_target === "number" && profile.weekly_target > 0 ? profile.weekly_target : null;

  const card = board?.[0];
  const executions = (Array.isArray(card?.executions) ? card.executions : []) as ConceptExecution[];
  const easy = executions.find((e) => e.effort === "low") ?? executions[0];

  const recipient = await buildEmailRecipient(admin as Parameters<typeof buildEmailRecipient>[0], profile);
  if (!recipient) return { sent: false, reason: "no recipient" };

  const caption = (String(row.caption ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? "").slice(0, 90);
  const email = postResultEmail({
    artistId,
    artistName: recipient.artistName,
    appUrl: appBaseUrl(),
    postDay: new Date(String(row.post_date)).toLocaleDateString("en-GB", { weekday: "long", timeZone: "Europe/London" }),
    line: describeComparison(comparison),
    band: comparison.band,
    metric: comparison.metric,
    value: comparison.value,
    caption,
    permalink: row.permalink ?? null,
    thumbnailUrl: row.thumbnail_url ?? null,
    ideaTitle: idea?.title ? String(idea.title) : null,
    week: target ? { posted: Math.max(marked ?? 0, syncedThisWeek), target } : null,
    nextIdea: card && easy ? { title: String(card.title), idea: easy.idea } : null,
  });

  const sent = await sendEmail({
    to: recipient.email,
    subject: email.subject,
    html: email.html,
    recipient,
    type: "post_detected",
    metadata: { instagram_post_id: post.id },
  });
  return sent ? { sent: true, postId: post.id } : { sent: false, reason: "not sent (paused, opted out or already emailed today)" };
}
