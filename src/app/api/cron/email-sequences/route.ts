import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import {
  appBaseUrl,
  buildEmailRecipient,
  daysSince,
  daysUntil,
  everSent,
  formatLongDate,
  planPriceLabel,
  sendEmail,
  winbackExtensionUrl,
  type EmailRecipient,
  type EmailType,
} from "@/lib/email";
import { PUBLIC_PROFILES_OR_FILTER } from "@/lib/public-profiles-filter";
import {
  auditReadyEmail,
  freeDay14Email,
  freeDay3Email,
  freeDay7Email,
  trialEndingEngagedEmail,
  trialEndingInactiveEmail,
  trialEngagedDay5Email,
  trialNoPlanDay2Email,
  trialWelcomeEmail,
  winbackDay1Email,
  winbackDay30Email,
  winbackDay7Email,
} from "@/lib/email-templates";

type SendStats = { sent: number; skipped: number; failed: number };

function emptyStats(): SendStats {
  return { sent: 0, skipped: 0, failed: 0 };
}

function mergeStats(into: SendStats, from: SendStats): void {
  into.sent += from.sent;
  into.skipped += from.skipped;
  into.failed += from.failed;
}

async function sendIfNotEverSent(
  recipient: EmailRecipient,
  type: EmailType,
  subject: string,
  html: string,
  metadata?: Record<string, unknown>
): Promise<SendStats> {
  const stats = emptyStats();
  if (await everSent(recipient.artistId, type)) {
    stats.skipped += 1;
    return stats;
  }
  const ok = await sendEmail({
    to: recipient.email,
    subject,
    html,
    recipient,
    type,
    metadata,
  });
  if (ok) stats.sent += 1;
  else stats.skipped += 1;
  return stats;
}

async function runFreeToPaidSequence(
  supabase: ReturnType<typeof createServiceRoleClient>,
  appUrl: string
): Promise<SendStats> {
  const stats = emptyStats();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select(
      "id, artist_name, owner_user_id, plan, genre, marketing_unsubscribed, all_emails_paused, cron_active, audit_completed_at"
    )
    .eq("plan", "free")
    .not("audit_completed_at", "is", null)
    .eq("marketing_unsubscribed", false)
    .eq("all_emails_paused", false)
    .or(PUBLIC_PROFILES_OR_FILTER);

  if (error) {
    console.error("email-sequences: free sequence query failed", error.message);
    stats.failed += 1;
    return stats;
  }

  for (const profile of profiles ?? []) {
    if (profile.cron_active === false) {
      stats.skipped += 1;
      continue;
    }

    const recipient = await buildEmailRecipient(supabase, profile);
    if (!recipient) {
      stats.skipped += 1;
      continue;
    }

    const auditCompletedAt = String(profile.audit_completed_at ?? "");
    if (!auditCompletedAt) {
      stats.skipped += 1;
      continue;
    }

    const daysSinceAudit = daysSince(auditCompletedAt);
    const artistId = recipient.artistId;

    if (daysSinceAudit >= 0 && daysSinceAudit < 1) {
      const { data: audit } = await supabase
        .from("audits")
        .select("followers, following, post_count, ai_pattern_analysis")
        .eq("artist_id", artistId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const patternAnalysis = String(
        audit?.ai_pattern_analysis ??
          "Your Instagram shows clear patterns worth building on."
      ).trim();

      const email = auditReadyEmail({
        artistId,
        artistName: recipient.artistName,
        followers: Number(audit?.followers ?? 0),
        following: Number(audit?.following ?? 0),
        postCount: Number(audit?.post_count ?? 0),
        patternAnalysis,
        appUrl,
      });

      mergeStats(
        stats,
        await sendIfNotEverSent(
          recipient,
          "audit_ready",
          email.subject,
          email.html
        )
      );
    }

    if (daysSinceAudit >= 3) {
      const email = freeDay3Email({
        artistId,
        artistName: recipient.artistName,
        genre: String(profile.genre ?? "your genre").trim() || "your genre",
        appUrl,
      });
      mergeStats(
        stats,
        await sendIfNotEverSent(
          recipient,
          "free_day3",
          email.subject,
          email.html
        )
      );
    }

    if (daysSinceAudit >= 7) {
      const email = freeDay7Email({
        artistId,
        artistName: recipient.artistName,
        appUrl,
      });
      mergeStats(
        stats,
        await sendIfNotEverSent(
          recipient,
          "free_day7",
          email.subject,
          email.html
        )
      );
    }

    if (daysSinceAudit >= 14) {
      const email = freeDay14Email({
        artistId,
        artistName: recipient.artistName,
        appUrl,
      });
      mergeStats(
        stats,
        await sendIfNotEverSent(
          recipient,
          "free_day14",
          email.subject,
          email.html
        )
      );
    }
  }

  return stats;
}

async function artistHasGeneratedPlan(
  supabase: ReturnType<typeof createServiceRoleClient>,
  artistId: string
): Promise<boolean> {
  const { count } = await supabase
    .from("weekly_plans")
    .select("id", { count: "exact", head: true })
    .eq("artist_id", artistId);
  return (count ?? 0) > 0;
}

async function recentUsageCount(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string
): Promise<number> {
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
  const { count } = await supabase
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", fiveDaysAgo.toISOString());
  return count ?? 0;
}

async function runTrialOnboardingSequence(
  supabase: ReturnType<typeof createServiceRoleClient>,
  appUrl: string
): Promise<SendStats> {
  const stats = emptyStats();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select(
      "id, artist_name, owner_user_id, plan, marketing_unsubscribed, all_emails_paused, cron_active, trial_started_at"
    )
    .in("plan", ["starter", "pro", "label"])
    .not("trial_started_at", "is", null)
    .eq("all_emails_paused", false)
    .or(PUBLIC_PROFILES_OR_FILTER);

  if (error) {
    console.error(
      "email-sequences: trial onboarding query failed",
      error.message
    );
    stats.failed += 1;
    return stats;
  }

  const today = new Date().getDay();

  for (const profile of profiles ?? []) {
    if (profile.cron_active === false) {
      stats.skipped += 1;
      continue;
    }

    const recipient = await buildEmailRecipient(supabase, profile);
    if (!recipient) {
      stats.skipped += 1;
      continue;
    }

    const trialStartedAt = String(profile.trial_started_at ?? "");
    if (!trialStartedAt) {
      stats.skipped += 1;
      continue;
    }

    const daysSinceTrial = daysSince(trialStartedAt);
    const artistId = recipient.artistId;
    const hasGeneratedPlan = await artistHasGeneratedPlan(supabase, artistId);

    if (daysSinceTrial >= 0 && daysSinceTrial < 1) {
      const email = trialWelcomeEmail({
        artistId,
        artistName: recipient.artistName,
        appUrl,
      });
      mergeStats(
        stats,
        await sendIfNotEverSent(
          recipient,
          "trial_welcome",
          email.subject,
          email.html
        )
      );
    }

    if (daysSinceTrial >= 2 && !hasGeneratedPlan) {
      const email = trialNoPlanDay2Email({
        artistId,
        artistName: recipient.artistName,
        appUrl,
      });
      mergeStats(
        stats,
        await sendIfNotEverSent(
          recipient,
          "trial_no_plan_day2",
          email.subject,
          email.html
        )
      );
    }

    if (daysSinceTrial >= 5 && hasGeneratedPlan && today !== 1) {
      const email = trialEngagedDay5Email({
        artistId,
        artistName: recipient.artistName,
        appUrl,
      });
      mergeStats(
        stats,
        await sendIfNotEverSent(
          recipient,
          "trial_engaged_day5",
          email.subject,
          email.html
        )
      );
    }
  }

  return stats;
}

async function runTrialEndingSequence(
  supabase: ReturnType<typeof createServiceRoleClient>,
  appUrl: string
): Promise<SendStats> {
  const stats = emptyStats();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select(
      "id, artist_name, owner_user_id, plan, marketing_unsubscribed, all_emails_paused, cron_active, trial_started_at"
    )
    .in("plan", ["starter", "pro", "label"])
    .not("trial_started_at", "is", null)
    .eq("all_emails_paused", false)
    .or(PUBLIC_PROFILES_OR_FILTER);

  if (error) {
    console.error("email-sequences: trial ending query failed", error.message);
    stats.failed += 1;
    return stats;
  }

  for (const profile of profiles ?? []) {
    if (profile.cron_active === false) {
      stats.skipped += 1;
      continue;
    }

    const recipient = await buildEmailRecipient(supabase, profile);
    if (!recipient) {
      stats.skipped += 1;
      continue;
    }

    const trialStartedAt = String(profile.trial_started_at ?? "");
    if (!trialStartedAt) {
      stats.skipped += 1;
      continue;
    }

    const trialEnd = new Date(trialStartedAt);
    trialEnd.setDate(trialEnd.getDate() + 14);
    const daysUntilEnd = daysUntil(trialEnd.toISOString());

    if (daysUntilEnd > 3 || daysUntilEnd <= 0) {
      stats.skipped += 1;
      continue;
    }

    const artistId = recipient.artistId;
    const hasGeneratedPlan = await artistHasGeneratedPlan(supabase, artistId);
    const recentUsage = await recentUsageCount(supabase, recipient.userId);
    const isEngaged = hasGeneratedPlan && recentUsage > 1;

    const endDate = formatLongDate(trialEnd);
    const price = planPriceLabel(String(profile.plan ?? "starter"));

    if (isEngaged) {
      const email = trialEndingEngagedEmail({
        artistId,
        artistName: recipient.artistName,
        endDate,
        price,
        appUrl,
      });
      mergeStats(
        stats,
        await sendIfNotEverSent(
          recipient,
          "trial_ending_engaged",
          email.subject,
          email.html
        )
      );
    } else {
      const email = trialEndingInactiveEmail({
        artistId,
        artistName: recipient.artistName,
        endDate,
        price,
        appUrl,
      });
      mergeStats(
        stats,
        await sendIfNotEverSent(
          recipient,
          "trial_ending_inactive",
          email.subject,
          email.html
        )
      );
    }
  }

  return stats;
}

async function runWinbackSequence(
  supabase: ReturnType<typeof createServiceRoleClient>,
  appUrl: string
): Promise<SendStats> {
  const stats = emptyStats();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select(
      "id, artist_name, owner_user_id, plan, marketing_unsubscribed, all_emails_paused, cancelled_at"
    )
    .not("cancelled_at", "is", null)
    .eq("plan", "free")
    .eq("all_emails_paused", false)
    .eq("marketing_unsubscribed", false)
    .or(PUBLIC_PROFILES_OR_FILTER);

  if (error) {
    console.error("email-sequences: winback query failed", error.message);
    stats.failed += 1;
    return stats;
  }

  for (const profile of profiles ?? []) {
    const recipient = await buildEmailRecipient(supabase, profile);
    if (!recipient) {
      stats.skipped += 1;
      continue;
    }

    const cancelledAt = String(profile.cancelled_at ?? "");
    if (!cancelledAt) {
      stats.skipped += 1;
      continue;
    }

    const daysSinceCancel = daysSince(cancelledAt);
    const artistId = recipient.artistId;

    if (daysSinceCancel >= 0 && daysSinceCancel < 1) {
      const email = winbackDay1Email({
        artistId,
        artistName: recipient.artistName,
      });
      mergeStats(
        stats,
        await sendIfNotEverSent(
          recipient,
          "winback_day1",
          email.subject,
          email.html
        )
      );
    }

    if (daysSinceCancel >= 7) {
      const email = winbackDay7Email({
        artistId,
        artistName: recipient.artistName,
        appUrl,
      });
      mergeStats(
        stats,
        await sendIfNotEverSent(
          recipient,
          "winback_day7",
          email.subject,
          email.html
        )
      );
    }

    if (daysSinceCancel >= 30) {
      const extensionUrl = winbackExtensionUrl(artistId, recipient.userId);
      const email = winbackDay30Email({
        artistId,
        artistName: recipient.artistName,
        extensionUrl,
      });
      mergeStats(
        stats,
        await sendIfNotEverSent(
          recipient,
          "winback_day30",
          email.subject,
          email.html
        )
      );
    }
  }

  return stats;
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let supabase;
    try {
      supabase = createServiceRoleClient();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Configuration error";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const appUrl = appBaseUrl();

    const totals = emptyStats();
    const results = await Promise.allSettled([
      runFreeToPaidSequence(supabase, appUrl),
      runTrialOnboardingSequence(supabase, appUrl),
      runTrialEndingSequence(supabase, appUrl),
      runWinbackSequence(supabase, appUrl),
    ]);

    for (const result of results) {
      if (result.status === "fulfilled") {
        mergeStats(totals, result.value);
      } else {
        console.error("email-sequences: sequence failed", result.reason);
        totals.failed += 1;
      }
    }

    return NextResponse.json(totals);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
