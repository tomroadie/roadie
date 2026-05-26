import { createClient } from "@/utils/supabase/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AppNavWrapper } from "@/components/app-nav-wrapper";
import { LogoutButton } from "@/app/dashboard/logout-button";
import { WeeklyPlanSection } from "@/app/dashboard/weekly-plan-section";
import { FirstRunChecklist } from "@/app/dashboard/first-run-checklist";
import { InsightsAuditEmptyState } from "@/app/insights/insights-audit-empty-state";
import { RecentPostsCards } from "@/app/insights/recent-posts-cards";
import {
  LiveStatsSection,
  type InstagramLiveInsightRow,
  type InstagramLiveMediaRow,
} from "@/app/insights/live-stats-section";
import { FullAnalysisCollapsible } from "./full-analysis-collapsible";
import { normalizeIdeasFromDb } from "@/lib/parse-ideas-json";
import { getActiveArtistIdForUser } from "@/lib/active-artist";
import { getMondayDateString } from "@/lib/week";
import { parseFullAnalysisText } from "@/lib/parse-full-analysis";
import { canDo, normalizePlan } from "@/lib/plan-limits";
import { userIsAdmin } from "@/lib/is-admin";
import type { EventRow } from "@/types/event";

type ContentReviewRow = {
  idea_hook: string;
  feedback: string;
  reviewed_at: string;
};

type AuditRow = {
  followers: number;
  following: number;
  post_count: number;
  bio: string | null;
  ai_pattern_analysis: string;
  ai_full_analysis: string;
  recent_posts_raw: string | null;
  instagram_handle: string;
  created_at: string;
};

function isoToday(): string {
  const d = new Date();
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return local.toISOString().slice(0, 10);
}

function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function parseIdeaRatingsFromDb(raw: unknown): Record<string, "up" | "down"> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, "up" | "down"> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === "up" || v === "down") out[k] = v;
  }
  return out;
}

function sortRecentPostsRawByDateDesc(raw: string): string {
  const blocks = raw
    .split(/\n\s*---\s*\n/g)
    .map((b) => b.trim())
    .filter(Boolean);

  const scored = blocks.map((block, idx) => {
    const dateMatch = block.match(/^Date:\s*(.+)$/m);
    const dateStr = dateMatch?.[1]?.trim() ?? "";
    const d = dateStr ? new Date(dateStr) : null;
    const ts = d && Number.isFinite(d.getTime()) ? d.getTime() : null;
    return { block, idx, ts };
  });

  scored.sort((a, b) => {
    const at = a.ts;
    const bt = b.ts;
    if (at === null && bt === null) return a.idx - b.idx;
    if (at === null) return 1;
    if (bt === null) return -1;
    return bt - at;
  });

  return scored.map((x) => x.block).join("\n\n---\n\n");
}

function sumInstagramAccountMetric(insightsPayload: unknown, metric: string): number {
  if (!insightsPayload || typeof insightsPayload !== "object") return 0;
  const data = (insightsPayload as { data?: unknown }).data;
  if (!Array.isArray(data)) return 0;
  const row = data.find(
    (d: unknown) =>
      d &&
      typeof d === "object" &&
      (d as { name?: string }).name === metric
  ) as { values?: Array<{ value?: number }> } | undefined;
  if (!row?.values || !Array.isArray(row.values)) return 0;
  return row.values.reduce(
    (acc, v) => acc + (typeof v?.value === "number" ? v.value : 0),
    0
  );
}

function mediaMetric(
  item: Record<string, unknown>,
  metric: string
): number | null {
  const insights = item.insights;
  if (!insights || typeof insights !== "object") return null;
  const data = (insights as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;
  const row = data.find(
    (r: unknown) =>
      r &&
      typeof r === "object" &&
      (r as { name?: string }).name === metric
  ) as { values?: Array<{ value?: number }> } | undefined;
  const v = row?.values?.[0]?.value;
  return typeof v === "number" ? v : null;
}

function normalizeInstagramLivePayload(payload: {
  media?: unknown;
  insights?: unknown | null;
}): {
  insights: InstagramLiveInsightRow[];
  media: InstagramLiveMediaRow[];
} {
  const insightsPayload = payload.insights;

  const insights: InstagramLiveInsightRow[] =
    insightsPayload === null || insightsPayload === undefined
      ? []
      : [
          {
            key: "impressions",
            label: "Impressions",
            value: sumInstagramAccountMetric(insightsPayload, "impressions"),
          },
          {
            key: "reach",
            label: "Reach",
            value: sumInstagramAccountMetric(insightsPayload, "reach"),
          },
          {
            key: "profile_views",
            label: "Profile views",
            value: sumInstagramAccountMetric(
              insightsPayload,
              "profile_views"
            ),
          },
        ];

  const rawMedia = payload.media;
  const list =
    rawMedia &&
    typeof rawMedia === "object" &&
    Array.isArray((rawMedia as { data?: unknown }).data)
      ? ((rawMedia as { data: Record<string, unknown>[] }).data ?? [])
      : [];

  const sorted = [...list].sort((a, b) => {
    const ta =
      typeof a.timestamp === "string"
        ? new Date(a.timestamp).getTime()
        : 0;
    const tb =
      typeof b.timestamp === "string"
        ? new Date(b.timestamp).getTime()
        : 0;
    return tb - ta;
  });

  const media: InstagramLiveMediaRow[] = sorted.slice(0, 5).map((item) => {
    const id = typeof item.id === "string" ? item.id : "";
    const caption =
      typeof item.caption === "string" ? item.caption : null;
    const thumbnailUrl =
      (typeof item.thumbnail_url === "string" && item.thumbnail_url) ||
      (typeof item.media_url === "string" && item.media_url) ||
      null;
    const likes =
      typeof item.like_count === "number" ? item.like_count : 0;
    const comments =
      typeof item.comments_count === "number" ? item.comments_count : 0;

    const timestamp =
      typeof item.timestamp === "string" ? item.timestamp : "";

    return {
      id,
      caption,
      thumbnailUrl,
      likes,
      comments,
      impressions: mediaMetric(item, "impressions"),
      reach: mediaMetric(item, "reach"),
      timestamp,
    };
  });

  return { insights, media };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string; registered?: string }>;
}) {
  const { upgraded, registered } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const activeArtistId = await getActiveArtistIdForUser(
    supabase,
    user.id,
    cookieStore
  );

  const isAdmin = await userIsAdmin(supabase, user.id);

  if (!activeArtistId) {
    redirect("/onboarding");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "artist_name, genre, instagram_handle, plan, voice_description, posting_frequency, is_managed, instagram_user_id, instagram_access_token"
    )
    .eq("id", activeArtistId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const artistName = profile?.artist_name?.trim();
  if (!artistName) {
    redirect("/onboarding");
  }

  const plan = normalizePlan(profile?.plan);
  const canReview = canDo(plan, "canReview", isAdmin);
  const canViewLiveSocialData = canDo(plan, "canViewLiveSocialData", isAdmin);

  const { data: weeklyPlan } = await supabase
    .from("weekly_plans")
    .select("ideas, status, created_at, week_start, admin_note, idea_ratings")
    .eq("artist_id", activeArtistId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: pendingAudit } = await supabase
    .from("pending_leads")
    .select("id, created_at")
    .eq("instagram_handle", profile?.instagram_handle ?? "")
    .eq("status", "processing")
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1)
    .maybeSingle();

  const auditPending = !!pendingAudit;

  const { data: auditByArtistId, error: auditByArtistIdError } = await supabase
    .from("audits")
    .select(
      "followers, following, post_count, bio, ai_pattern_analysis, ai_full_analysis, recent_posts_raw, instagram_handle, created_at"
    )
    .eq("artist_id", activeArtistId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (auditByArtistIdError) {
    throw new Error(auditByArtistIdError.message);
  }

  const { data: auditByHandle, error: auditByHandleError } =
    auditByArtistId || !profile?.instagram_handle?.trim()
      ? { data: null, error: null }
      : await supabase
          .from("audits")
          .select(
            "followers, following, post_count, bio, ai_pattern_analysis, ai_full_analysis, recent_posts_raw, instagram_handle, created_at"
          )
          .eq("instagram_handle", profile.instagram_handle)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

  if (auditByHandleError) {
    throw new Error(auditByHandleError.message);
  }

  const audit = (auditByArtistId ?? auditByHandle ?? null) as AuditRow | null;
  const hasAudit = !!audit;

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentAudit } = await supabase
    .from("audits")
    .select("id, created_at")
    .eq("artist_id", activeArtistId)
    .gte("created_at", twentyFourHoursAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const auditJustCompleted = !!recentAudit;

  const { data: reviewsData, error: reviewsError } = await supabase
    .from("content_reviews")
    .select("idea_hook, feedback, reviewed_at")
    .eq("artist_id", activeArtistId)
    .eq("status", "reviewed")
    .order("reviewed_at", { ascending: false })
    .limit(10);

  if (reviewsError) {
    throw new Error(reviewsError.message);
  }

  const initialIdeas = normalizeIdeasFromDb(weeklyPlan?.ideas ?? null);
  const initialIdeaRatings = parseIdeaRatingsFromDb(weeklyPlan?.idea_ratings);
  const lastGeneratedAt = (weeklyPlan?.created_at as string | undefined) ?? null;
  const planWeekStart = (weeklyPlan?.week_start as string | undefined) ?? null;
  const reviews = (reviewsData ?? []) as ContentReviewRow[];

  const today = isoToday();
  const in7 = addDaysISO(today, 7);

  const { data: upcomingAll } = await supabase
    .from("events")
    .select("id")
    .eq("artist_id", activeArtistId)
    .gte("event_date", today);

  const upcomingEventsCount = (upcomingAll ?? []).length;

  const { data: upcomingWeekRows } = await supabase
    .from("events")
    .select("id, title, event_date, event_type, notes")
    .eq("artist_id", activeArtistId)
    .gte("event_date", today)
    .lte("event_date", in7)
    .order("event_date", { ascending: true });

  const upcomingThisWeek = (upcomingWeekRows ?? []) as EventRow[];

  const weekStart = getMondayDateString();
  const weekStartLabel = new Date(weekStart + "T12:00:00")
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    .toUpperCase();

  const { data: revisionRequestRow } = await supabase
    .from("plan_revision_requests")
    .select("id, status, admin_note, artist_acknowledged_at")
    .eq("artist_id", activeArtistId)
    .eq("week_start", weekStart)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const revisionRequest =
    revisionRequestRow?.id &&
    (revisionRequestRow.status === "pending" ||
      revisionRequestRow.status === "approved" ||
      revisionRequestRow.status === "declined")
      ? {
          id: String(revisionRequestRow.id),
          status: revisionRequestRow.status as
            | "pending"
            | "approved"
            | "declined",
          admin_note:
            typeof revisionRequestRow.admin_note === "string"
              ? revisionRequestRow.admin_note
              : null,
          artist_acknowledged_at:
            typeof revisionRequestRow.artist_acknowledged_at === "string"
              ? revisionRequestRow.artist_acknowledged_at
              : null,
        }
      : null;

  const hasPlanIdeas = (initialIdeas?.length ?? 0) > 0;
  const hasInstagram = Boolean(profile?.instagram_handle?.trim());
  const hasRatedIdea = Object.keys(initialIdeaRatings).length > 0;
  const canGeneratePlan = canDo(plan, "canGeneratePlan", isAdmin);
  const isManaged = profile?.is_managed ?? false;
  const profileIncomplete = !profile?.genre?.trim();
  const momentum =
    plan === "free" && !isAdmin && !hasPlanIdeas
      ? profileIncomplete
        ? {
            label: "Profile: Get started",
            cls: "bg-zinc-700 text-white ring-zinc-600/40",
          }
        : auditPending
          ? {
              label: "Audit: Running",
              cls: "bg-emerald-500/20 text-emerald-200 ring-emerald-500/35",
            }
          : hasAudit
            ? {
                label: "Plan: Upgrade to unlock",
                cls: "bg-amber-400 text-zinc-950 ring-amber-200/40",
              }
            : {
                label: "Audit: Get started",
                cls: "bg-zinc-700 text-white ring-zinc-600/40",
              }
      : !hasPlanIdeas
        ? {
            label: "Plan: Generate now",
            cls: "bg-zinc-700 text-white ring-zinc-600/40",
          }
        : planWeekStart === weekStart
          ? {
              label: "Plan: Up to date",
              cls: "bg-brand text-brand-foreground ring-brand/30",
            }
          : {
              label: "Plan: Ready",
              cls: "bg-amber-400 text-zinc-950 ring-amber-200/40",
            };

  let liveSocialStats: {
    insights: InstagramLiveInsightRow[];
    media: InstagramLiveMediaRow[];
  } | null = null;

  const instagramUserId = profile?.instagram_user_id?.trim();
  const instagramAccessToken = profile?.instagram_access_token?.trim();

  if (instagramUserId && instagramAccessToken) {
    const headersList = await headers();
    const cookie = headersList.get("cookie") ?? "";
    const hdrHost = headersList.get("x-forwarded-host") ?? headersList.get("host");
    const hdrProto = headersList.get("x-forwarded-proto") ?? "http";
    const fallbackOrigin = hdrHost
      ? `${hdrProto}://${hdrHost}`
      : "http://localhost:3000";
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? fallbackOrigin;

    const statsRes = await fetch(
      `${baseUrl}/api/instagram-stats?artist_id=${activeArtistId}`,
      {
        headers: { cookie },
        cache: "no-store",
      }
    );

    const statsJson = statsRes.ok ? await statsRes.json() : null;
    if (
      statsJson &&
      typeof statsJson === "object" &&
      (statsJson as { error?: string }).error !== "not_connected"
    ) {
      liveSocialStats = normalizeInstagramLivePayload(
        statsJson as { media?: unknown; insights?: unknown }
      );
    }
  }

  const fullAnalysisSections = audit
    ? parseFullAnalysisText(audit.ai_full_analysis)
    : [];

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">
            Week of {weekStartLabel}
          </p>
          <h1 className="text-5xl font-black uppercase tracking-tight text-foreground sm:text-6xl">
            {artistName}
          </h1>
          <div
            className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide ring-1 ring-inset ${momentum.cls}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
            {momentum.label}
          </div>
        </div>
        <LogoutButton />
      </div>

      <div className="mt-6 h-px w-full bg-[#1a1a1a]" />

      <AppNavWrapper />

      <FirstRunChecklist
        hasInstagram={hasInstagram}
        hasAudit={hasAudit}
        hasPlanIdeas={hasPlanIdeas}
        hasRatedIdea={hasRatedIdea}
        canGeneratePlan={canGeneratePlan}
        isManaged={isManaged}
        auditPending={auditPending}
      />

      {audit ? (
        <section className="mt-10 rounded-xl border border-card-border bg-card p-7">
          <p className="text-xs font-bold uppercase tracking-widest text-brand">
            @{audit.instagram_handle.replace(/^@/, "")}
          </p>
          <h2 className="mt-2 text-xl font-black uppercase tracking-tight text-foreground">
            Artist snapshot
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-card-border bg-input p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-brand">
                Followers
              </p>
              <p className="mt-2 text-3xl font-black tracking-tight text-foreground">
                {audit.followers.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-card-border bg-input p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-brand">
                Following
              </p>
              <p className="mt-2 text-3xl font-black tracking-tight text-foreground">
                {audit.following.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-card-border bg-input p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-brand">
                Posts
              </p>
              <p className="mt-2 text-3xl font-black tracking-tight text-foreground">
                {audit.post_count.toLocaleString()}
              </p>
            </div>
          </div>
          {audit.bio?.trim() ? (
            <p className="mt-5 text-sm leading-relaxed text-muted-strong">
              {audit.bio}
            </p>
          ) : null}
        </section>
      ) : null}

      <WeeklyPlanSection
        initialIdeas={initialIdeas}
        initialIdeaRatings={initialIdeaRatings}
        upcomingEventsCount={upcomingEventsCount}
        lastGeneratedAt={lastGeneratedAt}
        upcomingThisWeek={upcomingThisWeek}
        plan={plan}
        planStatus={(weeklyPlan?.status as string | undefined) ?? null}
        auditPending={auditPending}
        hasAudit={hasAudit}
        isAdmin={isAdmin}
        canReview={canReview}
        reviews={reviews}
        artistId={activeArtistId}
        hideUpcomingThisWeek
        isManaged={profile?.is_managed ?? false}
        revisionRequest={revisionRequest}
        hasJustUpgraded={upgraded === "true"}
        hasJustRegistered={registered === "true"}
        auditJustCompleted={auditJustCompleted}
      />

      {!audit ? (
        <div
          id="audit-section"
          className="mt-10 rounded-xl border border-dashed border-card-border bg-input p-10 text-center"
        >
          <InsightsAuditEmptyState
            artistId={activeArtistId}
            instagramHandle={profile?.instagram_handle ?? null}
            auditPending={auditPending}
          />
        </div>
      ) : (
        <>
          <section className="mt-10 rounded-xl border border-card-border bg-card p-7 border-l-4 border-brand">
            <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
              Your content pattern
            </h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-strong">
              {audit.ai_pattern_analysis}
            </p>
          </section>

          <div className="mt-8">
            <FullAnalysisCollapsible sections={fullAnalysisSections} />
          </div>
        </>
      )}

      <section className="mt-10 rounded-xl border border-card-border bg-card p-7">
        <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
          Your Instagram
        </h2>

        {canViewLiveSocialData && liveSocialStats ? (
          <div className="mt-5">
            <LiveStatsSection
              insights={liveSocialStats.insights}
              media={liveSocialStats.media}
              followers={audit?.followers ?? 0}
              timestamps={liveSocialStats.media.map((m) => m.timestamp)}
            />
          </div>
        ) : audit?.recent_posts_raw?.trim() ? (
          <div className="mt-5">
            <RecentPostsCards
              raw={sortRecentPostsRawByDateDesc(audit.recent_posts_raw)}
            />
            <p className="mt-5 text-center text-sm text-muted">
              <Link
                href={
                  canViewLiveSocialData
                    ? "/api/auth/instagram"
                    : "/pricing"
                }
                className="font-semibold text-brand hover:underline"
              >
                Connect Instagram for live data →
              </Link>
            </p>
          </div>
        ) : canViewLiveSocialData ? (
          <div className="mt-5 rounded-xl border border-card-border bg-input p-6">
            <p className="text-sm font-semibold leading-relaxed text-foreground">
              Connect your Instagram account to see real-time performance data
            </p>
            <div className="mt-5">
              <Link
                href="/api/auth/instagram"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95"
              >
                Connect Instagram →
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-card-border bg-input p-6 opacity-60">
            <p className="text-sm leading-relaxed text-muted">
              Connect your Instagram to see real-time performance data and post
              analytics.
            </p>
            <div className="mt-5">
              <Link
                href="/pricing"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95"
              >
                Upgrade to Pro
              </Link>
            </div>
          </div>
        )}
      </section>

      <section className="mt-10 rounded-xl border border-card-border bg-card p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-brand">
          Upcoming this week
        </p>
        {upcomingThisWeek.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {upcomingThisWeek.map((ev) => (
              <span
                key={ev.id}
                className="inline-flex items-center gap-2 rounded-full bg-input px-3 py-1 text-xs font-medium text-foreground"
              >
                <span className="text-muted">
                  {new Date(ev.event_date + "T12:00:00").toLocaleDateString(
                    "en-GB",
                    { weekday: "short", day: "numeric", month: "short" }
                  )}
                </span>
                <span className="font-semibold text-foreground">{ev.title}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Nothing scheduled this week —{" "}
            <Link href="/events" className="font-semibold text-brand hover:underline">
              Add a date →
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
