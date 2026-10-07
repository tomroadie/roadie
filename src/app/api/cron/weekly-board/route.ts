import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { appBaseUrl } from "@/lib/email";
import {
  runWeeklyForArtist,
  weekdayInTimezone,
  type WeeklyOutcome,
} from "@/lib/concepts/weekly";

export const maxDuration = 300;

/** Stop starting new artists after this; leftovers run on the next call. */
const TIME_BUDGET_MS = 200_000;
/** A weekly run newer than this means the artist is done for the week. */
const RECENT_RUN_DAYS = 5;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function escapeHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function notifyAdmin(
  done: WeeklyOutcome[],
  failed: { artistId: string; artistName: string; error: string }[],
  remaining: number,
  autoPublish: boolean
) {
  const key = process.env.RESEND_API_KEY;
  if (!key || (done.length === 0 && failed.length === 0)) return;

  const reviewUrl = `${appBaseUrl()}/admin/concepts`;
  const lines = done.map(
    (o) =>
      `<li><strong>${escapeHtml(o.artistName)}</strong>: posted ${o.postedLastWeek} last week, target ${o.previousTarget ?? "new"} → ${o.target}${o.warnings.length ? `, ${o.warnings.length} warning(s)` : ""}${autoPublish ? (o.emailed ? ", published and emailed" : ", published (no email sent)") : ""}</li>`
  );
  const failures = failed.map(
    (f) => `<li><strong>${escapeHtml(f.artistName)}</strong>: ${escapeHtml(f.error)}</li>`
  );

  const subject = failed.length
    ? `Tempo weekly boards: ${failed.length} failed`
    : autoPublish
      ? `Tempo weekly boards: ${done.length} published`
      : `Tempo weekly boards: ${done.length} ready to review`;

  const html = `
    ${done.length ? `<p>${autoPublish ? "Published" : "Drafts waiting for your review"}:</p><ul>${lines.join("")}</ul>` : ""}
    ${failed.length ? `<p style="color:#b91c1c">Failed:</p><ul>${failures.join("")}</ul>` : ""}
    ${remaining ? `<p>${remaining} more will run on the next call.</p>` : ""}
    <p><a href="${reviewUrl}">Open concept review</a></p>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: "Tempo <hello@roadie.media>",
      to: [process.env.ADMIN_EMAIL?.trim() || "tom@roadie.media"],
      subject,
      html,
    }),
  });
  if (!res.ok) console.error("weekly-board: admin email failed", res.status);
}

/**
 * Weekly board job. Call hourly (cron-job.org) with
 *   Authorization: Bearer $CRON_SECRET
 * For each board artist whose chosen day it is (Europe/London) and who hasn't
 * had a weekly run in the last few days: adapt the target, generate a fresh
 * pool and save a draft. With CONCEPT_AUTO_PUBLISH=true the draft goes live
 * and "Your week" is sent; otherwise it waits for review at /admin/concepts.
 *
 * ?artist_id=<uuid> runs one artist now, whatever the day (for testing).
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const now = new Date();
  const autoPublish = process.env.CONCEPT_AUTO_PUBLISH === "true";
  const forced = new URL(request.url).searchParams.get("artist_id")?.trim() ?? "";
  if (forced && !UUID_RE.test(forced)) {
    return NextResponse.json({ error: "Invalid artist_id" }, { status: 400 });
  }

  const admin = createServiceRoleClient();

  let query = admin
    .from("profiles")
    .select("id, artist_name, week_start_day")
    // board_enabled is the deliberate opt-in. cron_active and is_private are
    // off for every admin-created client artist, so they can't gate this.
    .eq("board_enabled", true);
  if (forced) query = query.eq("id", forced);
  const { data: profiles, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const today = weekdayInTimezone(now);
  let due = (profiles ?? []).filter(
    (p) => forced || Number(p.week_start_day ?? 1) === today
  );

  if (!forced && due.length > 0) {
    const since = new Date(now.getTime() - RECENT_RUN_DAYS * 86400000).toISOString();
    const { data: recent } = await admin
      .from("concept_generations")
      .select("artist_id")
      .in("artist_id", due.map((p) => p.id))
      .eq("context_summary->>kind", "weekly")
      .gte("created_at", since);
    const doneAlready = new Set((recent ?? []).map((r) => String(r.artist_id)));
    due = due.filter((p) => !doneAlready.has(String(p.id)));
  }

  const done: WeeklyOutcome[] = [];
  const failed: { artistId: string; artistName: string; error: string }[] = [];
  let remaining = 0;

  for (const [i, p] of due.entries()) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      remaining = due.length - i;
      break;
    }
    const artistId = String(p.id);
    try {
      done.push(await runWeeklyForArtist(admin, artistId, { autoPublish, now }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("weekly-board failed", { artistId, message });
      failed.push({ artistId, artistName: String(p.artist_name ?? artistId), error: message });
    }
  }

  await notifyAdmin(done, failed, remaining, autoPublish);

  return NextResponse.json({
    weekday: today,
    due: due.length,
    done: done.map((o) => ({
      artist: o.artistName,
      generation_id: o.generationId,
      posted_last_week: o.postedLastWeek,
      target: `${o.previousTarget ?? "new"} -> ${o.target}`,
      published: o.published,
      emailed: o.emailed,
    })),
    failed,
    remaining,
    auto_publish: autoPublish,
    ms: Date.now() - started,
  });
}
