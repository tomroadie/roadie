import { after, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { appBaseUrl } from "@/lib/email";
import { runWeeklyForArtist, weekdayInTimezone, type WeeklyOutcome } from "@/lib/concepts/weekly";
import { boardWeek } from "@/lib/board-week";

export const maxDuration = 300;

/** Stop starting new artists after this; leftovers run on the next call. */
const TIME_BUDGET_MS = 200_000;

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

  // Due: the artist's current board week started (today or earlier this
  // week, so a missed run catches up on the next call), their board was
  // already live before it started, and nothing has been generated for
  // them since it started.
  let due = (profiles ?? []).map((p) => ({ ...p, weekStartsAt: boardWeek(p.week_start_day, now).startsAt }));

  if (!forced && due.length > 0) {
    const ids = due.map((p) => p.id);
    const [{ data: gens }, { data: lives }] = await Promise.all([
      admin
        .from("concept_generations")
        .select("artist_id, created_at")
        .in("artist_id", ids)
        .gte("created_at", new Date(now.getTime() - 8 * 86400000).toISOString()),
      admin
        .from("concept_generations")
        .select("artist_id, published_at")
        .in("artist_id", ids)
        .not("published_at", "is", null)
        .order("published_at", { ascending: true }),
    ]);
    const firstLive = new Map<string, number>();
    for (const g of lives ?? []) {
      const id = String(g.artist_id);
      if (!firstLive.has(id)) firstLive.set(id, Date.parse(String(g.published_at)));
    }
    due = due.filter((p) => {
      const start = Date.parse(p.weekStartsAt);
      const live = firstLive.get(String(p.id));
      if (live === undefined || live >= start) return false; // no board yet, or it went live this week
      return !(gens ?? []).some(
        (g) => String(g.artist_id) === String(p.id) && Date.parse(String(g.created_at)) >= start
      );
    });
  }

  // cron-job.org gives up after 30 seconds and a run takes about a minute
  // per artist, so reply now and do the work after the response. after()
  // keeps running for this route's maxDuration.
  after(async () => {
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

    console.log("weekly-board finished", {
      done: done.length,
      failed: failed.length,
      remaining,
    });
    await notifyAdmin(done, failed, remaining, autoPublish);
  });

  return NextResponse.json(
    {
      weekday: weekdayInTimezone(now),
      due: due.map((p) => String(p.artist_name ?? p.id)),
      auto_publish: autoPublish,
      note:
        due.length > 0
          ? "Running in the background; results arrive by email."
          : "Nobody due this hour.",
    },
    { status: due.length > 0 ? 202 : 200 }
  );
}
