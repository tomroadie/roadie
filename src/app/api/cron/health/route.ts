import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { appBaseUrl } from "@/lib/email";
import { escapeHtml, notifyAdminEmail } from "@/lib/admin-notify";
import { recordCronRun, type CronJob } from "@/lib/cron-log";
import { boardWeek } from "@/lib/board-week";

const HOUR = 3600000;

/** How stale each job's last run can be before it counts as stopped. */
const MAX_AGE_HOURS: Partial<Record<CronJob, number>> = {
  "sync-post-performance": 26,
  "weekly-board": 3,
  "refresh-instagram-tokens": 26,
  "email-sequences": 26,
};

const JOB_LABEL: Record<string, string> = {
  "sync-post-performance": "Instagram post sync (daily)",
  "weekly-board": "Weekly boards (hourly)",
  "refresh-instagram-tokens": "Instagram token refresh (daily)",
  "email-sequences": "Email sequences (daily)",
};

function ago(ms: number): string {
  const h = Math.round(ms / HOUR);
  return h < 48 ? `${h} hours ago` : `${Math.round(h / 24)} days ago`;
}

/**
 * Daily check, run by Vercel Cron (independent of cron-job.org, so it still
 * runs if a cron-job.org job is switched off). Emails the admin only when
 * something needs attention.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const now = Date.now();
  const problems: string[] = [];
  const reminders: string[] = [];

  // 1. Jobs that stopped running, or whose last run failed.
  const { data: runs } = await admin
    .from("cron_runs")
    .select("job, ok, summary, created_at")
    .gte("created_at", new Date(now - 8 * 24 * HOUR).toISOString())
    .order("created_at", { ascending: false });
  for (const [job, maxHours] of Object.entries(MAX_AGE_HOURS)) {
    const jobRuns = (runs ?? []).filter(
      (r) => r.job === job && !(job === "sync-post-performance" && (r.summary as { only?: string } | null)?.only)
    );
    const last = jobRuns[0];
    const label = JOB_LABEL[job] ?? job;
    if (!last) {
      problems.push(`<strong>${label}</strong> hasn't run in the last 8 days. Check it's enabled in cron-job.org.`);
      continue;
    }
    const age = now - Date.parse(String(last.created_at));
    if (age > (maxHours as number) * HOUR) {
      problems.push(`<strong>${label}</strong> last ran ${ago(age)}. Check it's enabled in cron-job.org.`);
    } else if (!last.ok) {
      const detail = JSON.stringify(last.summary ?? {}).slice(0, 300);
      problems.push(`<strong>${label}</strong> ran ${ago(age)} but reported errors: <code>${escapeHtml(detail)}</code>`);
    }
  }

  // 2. Instagram connections expiring or expired.
  const { data: tokens } = await admin
    .from("profiles")
    .select("artist_name, instagram_token_expires_at")
    .not("instagram_access_token", "is", null)
    .not("instagram_token_expires_at", "is", null);
  for (const t of tokens ?? []) {
    const left = Date.parse(String(t.instagram_token_expires_at)) - now;
    const name = escapeHtml(String(t.artist_name ?? "An artist"));
    if (left < 0) problems.push(`<strong>${name}</strong>'s Instagram connection has expired. They need to reconnect.`);
    else if (left < 7 * 24 * HOUR)
      problems.push(`<strong>${name}</strong>'s Instagram connection expires in ${Math.ceil(left / (24 * HOUR))} days and hasn't been refreshed.`);
  }

  // 3. Boards: drafts waiting for review, and artists whose week started without new ideas.
  const [{ data: boardArtists }, { data: gens }] = await Promise.all([
    admin.from("profiles").select("id, artist_name, week_start_day").eq("board_enabled", true),
    admin
      .from("concept_generations")
      .select("artist_id, status, created_at, published_at, kind:context_summary->>kind")
      .gte("created_at", new Date(now - 60 * 24 * HOUR).toISOString()),
  ]);
  const names = new Map((boardArtists ?? []).map((a) => [String(a.id), String(a.artist_name ?? "An artist")]));
  for (const g of gens ?? []) {
    if (g.status !== "draft" || (g.kind !== "weekly" && g.kind !== "first")) continue;
    const age = now - Date.parse(String(g.created_at));
    const newerLive = (gens ?? []).some(
      (o) => o.artist_id === g.artist_id && o.published_at && Date.parse(String(o.published_at)) > Date.parse(String(g.created_at))
    );
    if (age > 12 * HOUR && !newerLive) {
      reminders.push(
        `<strong>${escapeHtml(names.get(String(g.artist_id)) ?? "An artist")}</strong>'s ${g.kind === "first" ? "first ideas have" : "weekly board has"} been waiting for review for ${ago(age)}.`
      );
    }
  }
  for (const a of boardArtists ?? []) {
    const start = Date.parse(boardWeek(a.week_start_day, new Date(now)).startsAt);
    if (now - start < 6 * HOUR) continue; // give the hourly job time
    const mine = (gens ?? []).filter((g) => g.artist_id === a.id);
    const liveBefore = mine.some((g) => g.published_at && Date.parse(String(g.published_at)) < start);
    const since = mine.some((g) => Date.parse(String(g.created_at)) >= start);
    if (liveBefore && !since) {
      problems.push(`<strong>${escapeHtml(String(a.artist_name ?? "An artist"))}</strong>'s week started ${ago(now - start)} and no new board has been drafted.`);
    }
  }

  const ok = problems.length === 0;
  if (problems.length || reminders.length) {
    await notifyAdminEmail(
      problems.length ? `Tempo health: ${problems.length} thing${problems.length === 1 ? "" : "s"} to fix` : "Tempo: boards waiting for review",
      `${problems.length ? `<p>Needs attention:</p><ul>${problems.map((p) => `<li>${p}</li>`).join("")}</ul>` : ""}
${reminders.length ? `<p>Waiting for you:</p><ul>${reminders.map((r) => `<li>${r}</li>`).join("")}</ul><p><a href="${appBaseUrl()}/admin/concepts">Open concept review</a></p>` : ""}`
    );
  }
  await recordCronRun("health", ok, { problems: problems.length, reminders: reminders.length });

  return NextResponse.json({ ok, problems, reminders });
}
