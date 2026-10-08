import { createClient } from "@/utils/supabase/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AppNavWrapper } from "@/components/app-nav-wrapper";
import { LogoutButton } from "@/app/dashboard/logout-button";
import { WeeklyPlanSection } from "@/app/dashboard/weekly-plan-section";
import { ConceptBoard, type WeekProgress } from "./concept-board";
import { PostResultsSection } from "./post-results";
import { loadPostResults, type PostResultsData } from "@/lib/post-results";
import { loadBoard } from "@/lib/concepts/store";
import { AuditCTASection } from "@/app/insights/audit-cta-section";
import { RecentPostsCards } from "@/app/insights/recent-posts-cards";
import {
  LiveStatsSection,
  type InstagramLiveAccount,
  type InstagramLiveInsightRow,
  type InstagramLiveMediaRow,
} from "@/app/insights/live-stats-section";
import { FullAnalysisCollapsible } from "./full-analysis-collapsible";
import { AuditUpgradeSection } from "./audit-upgrade-section";
import { ConversionTracker } from "@/components/conversion-tracker";
import { normalizeIdeasFromDb } from "@/lib/parse-ideas-json";
import { getActiveArtistIdForUser } from "@/lib/active-artist";
import { getMondayDateString } from "@/lib/week";
import { parseFullAnalysisText } from "@/lib/parse-full-analysis";
import { cleanInstagramHandle } from "@/lib/new-lead-pipeline";
import { canDo, getPlanForGating } from "@/lib/plan-limits";
import { userIsAdmin } from "@/lib/is-admin";
import type { EventRow } from "@/types/event";
import { boardWeek } from "@/lib/board-week";

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

function countRecentPostsRaw(raw: string): number {
  return raw
    .split(/\n\s*---\s*\n/g)
    .map((b) => b.trim())
    .filter(Boolean).length;
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
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
  followers?: unknown;
  account?: unknown;
}): {
  insights: InstagramLiveInsightRow[];
  media: InstagramLiveMediaRow[];
  followers: number | null;
  account: InstagramLiveAccount | null;
} {
  const insightsPayload = payload.insights;

  const insights: InstagramLiveInsightRow[] =
    insightsPayload === null || insightsPayload === undefined
      ? []
      : [
          {
            key: "views",
            label: "Views",
            value: sumInstagramAccountMetric(insightsPayload, "views"),
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
      views: mediaMetric(item, "views") ?? mediaMetric(item, "impressions"),
      reach: mediaMetric(item, "reach"),
      timestamp,
    };
  });

  const followers =
    typeof payload.followers === "number" ? payload.followers : null;

  const acc = (payload.account ?? null) as Record<string, unknown> | null;
  const account: InstagramLiveAccount | null =
    acc && typeof acc.username === "string"
      ? {
          username: acc.username,
          profilePictureUrl:
            typeof acc.profile_picture_url === "string" ? acc.profile_picture_url : null,
        }
      : null;

  return { insights, media, followers, account };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string; registered?: string; audit?: string }>;
}) {
  const { upgraded, registered, audit: auditParam } = await searchParams;
  const auditReady = auditParam === "ready";
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
      "artist_name, genre, instagram_handle, plan, plan_override, voice_description, posting_frequency, is_managed, instagram_user_id, instagram_access_token, trial_started_at, board_enabled, week_start_day, weekly_target"
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

  const plan = getPlanForGating(profile ?? {});
  const canReview = canDo(plan, "canReview", isAdmin);
  const canViewLiveSocialData = canDo(plan, "canViewLiveSocialData", isAdmin);
  const canViewEngagementTrends = canDo(
    plan,
    "canViewEngagementTrends",
    isAdmin
  );

  const { data: weeklyPlan } = await supabase
    .from("weekly_plans")
    .select("ideas, status, created_at, week_start, admin_note, idea_ratings")
    .eq("artist_id", activeArtistId)
    .eq("is_research", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const normalizedInstagramHandle =
    cleanInstagramHandle(profile?.instagram_handle ?? "") ??
    profile?.instagram_handle?.trim().toLowerCase() ??
    "";

  const { data: pendingAudit } = await supabase
    .from("pending_leads")
    .select("id, created_at")
    .eq("instagram_handle", normalizedInstagramHandle)
    .eq("status", "processing")
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1)
    .maybeSingle();

  const auditPending = !!pendingAudit;
  const pendingAuditTriggeredAt =
    (pendingAudit?.created_at as string | undefined) ?? null;

  const { data: auditByArtistId, error: auditByArtistIdError } = await supabase
    .from("audits")
    .select(
      "followers, following, post_count, bio, ai_pattern_analysis, ai_full_analysis, recent_posts_raw, instagram_handle, created_at"
    )
    .eq("artist_id", activeArtistId)
    .eq("is_research", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (auditByArtistIdError) {
    throw new Error(auditByArtistIdError.message);
  }

  const { data: auditByHandle, error: auditByHandleError } =
    auditByArtistId || !normalizedInstagramHandle
      ? { data: null, error: null }
      : await supabase
          .from("audits")
          .select(
            "followers, following, post_count, bio, ai_pattern_analysis, ai_full_analysis, recent_posts_raw, instagram_handle, created_at"
          )
          .ilike("instagram_handle", normalizedInstagramHandle)
          .eq("is_research", false)
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
    .eq("is_research", false)
    .gte("created_at", twentyFourHoursAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const auditJustCompleted = !!recentAudit;
  const showAuditBanner = auditJustCompleted || auditReady;

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
  const canGeneratePlan = canDo(plan, "canGeneratePlan", isAdmin);
  const showAuditFirst = hasAudit && !canGeneratePlan && !hasPlanIdeas;
  const canMarkAsPosted =
    canDo(plan, "canViewLiveSocialData", isAdmin) &&
    !!profile?.instagram_user_id?.trim();

  const { data: recentPostsData } = await supabase
    .from("post_performance")
    .select(
      "instagram_post_id, caption, likes, engagement_rate, post_date, post_type"
    )
    .eq("artist_id", activeArtistId)
    .order("post_date", { ascending: false })
    .limit(5);

  const recentPosts = (recentPostsData ?? []).map((row) => ({
    instagram_post_id: String(row.instagram_post_id ?? ""),
    caption: typeof row.caption === "string" ? row.caption : null,
    likes: typeof row.likes === "number" ? row.likes : 0,
    engagement_rate: Number(row.engagement_rate ?? 0),
    post_date: String(row.post_date ?? ""),
    post_type: typeof row.post_type === "string" ? row.post_type : "",
  }));

  const isManaged = profile?.is_managed ?? false;
  const hasInstagram = Boolean(profile?.instagram_handle?.trim());
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
                label: "Plan: Start free trial",
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
    followers: number | null;
    account: InstagramLiveAccount | null;
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
        statsJson as { media?: unknown; insights?: unknown; followers?: unknown; account?: unknown }
      );
    }
  }

  const fullAnalysisSections = audit
    ? parseFullAnalysisText(audit.ai_full_analysis)
    : [];

  // Beta: artists with the concept board see it in place of the weekly plan.
  const board = profile?.board_enabled
    ? await loadBoard(supabase, activeArtistId)
    : null;

  // Board artists: their own week, progress so far, and the next 4 weeks of dates.
  const week = board ? boardWeek(profile?.week_start_day) : null;
  let weekProgress: WeekProgress | undefined;
  let comingUp: EventRow[] = [];
  let postResults: PostResultsData | null = null;
  if (board && week) {
    const fourWeeksOut = new Date(`${week.start}T12:00:00Z`);
    fourWeeksOut.setUTCDate(fourWeeksOut.getUTCDate() + 28);
    const [markedRes, syncedRes, eventsRes, resultsRes] = await Promise.all([
      supabase
        .from("concepts")
        .select("id", { count: "exact", head: true })
        .eq("artist_id", activeArtistId)
        .eq("status", "posted")
        .gte("posted_at", week.startsAt),
      supabase
        .from("post_performance")
        .select("instagram_post_id, permalink, post_date")
        .eq("artist_id", activeArtistId)
        .gte("post_date", week.startsAt)
        .order("post_date", { ascending: true }),
      supabase
        .from("events")
        .select("id, title, event_date, event_type, notes")
        .eq("artist_id", activeArtistId)
        .gte("event_date", new Date().toISOString().slice(0, 10))
        .lte("event_date", fourWeeksOut.toISOString().slice(0, 10))
        .order("event_date", { ascending: true }),
      loadPostResults(supabase, activeArtistId, week.startsAt),
    ]);
    postResults = resultsRes;
    const lineByPost = new Map((postResults?.posts ?? []).map((p) => [p.id, p.line]));
    weekProgress = {
      target:
        typeof profile?.weekly_target === "number" && profile.weekly_target > 0
          ? profile.weekly_target
          : 1,
      marked: markedRes.count ?? 0,
      verified: (syncedRes.data ?? []).map((p) => ({
        permalink: typeof p.permalink === "string" ? p.permalink : null,
        result: lineByPost.get(String(p.instagram_post_id)) ?? null,
      })),
    };
    comingUp = (eventsRes.data ?? []) as EventRow[];
  }

  const weeklyPlanSection = board ? (
    <ConceptBoard
      key={activeArtistId}
      initialBoard={board}
      initialProgress={weekProgress}
      nextIdeasDay={
        ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
          typeof profile?.week_start_day === "number" ? profile.week_start_day : 1
        ]
      }
    />
  ) : (
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
      isManaged={isManaged}
      revisionRequest={revisionRequest}
      hasJustUpgraded={upgraded === "true"}
      hasJustRegistered={false}
      showAuditBanner={showAuditBanner}
      hasInstagram={hasInstagram}
      canMarkAsPosted={canMarkAsPosted}
      recentPosts={recentPosts}
    />
  );

  const auditSnapshotSection = audit ? (
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
  ) : null;

  const auditAnalysisSections = audit ? (
    <>
      <section className="mt-10 rounded-xl border border-card-border bg-card p-7 border-l-4 border-brand">
        <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
          Your content pattern
        </h2>
        <p className="mt-1 text-xs text-muted">
          Last updated {formatRelativeDate(audit.created_at)}
        </p>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-strong">
          {audit.ai_pattern_analysis}
        </p>
      </section>

      <div className="mt-8">
        <FullAnalysisCollapsible
          sections={fullAnalysisSections}
          artistId={activeArtistId}
          updatedAt={audit.created_at}
          forceOpen={auditReady}
        />
      </div>

      {!canGeneratePlan && !auditPending ? (
        <AuditUpgradeSection sections={fullAnalysisSections} />
      ) : null}
    </>
  ) : null;

  const instagramSection = (
    <section className="mt-10 rounded-xl border border-card-border bg-card p-7">
      <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
        Your Instagram
      </h2>

      {canViewLiveSocialData && liveSocialStats ? (
        <div className="mt-5">
          <LiveStatsSection
            insights={liveSocialStats.insights}
            media={liveSocialStats.media}
            followers={liveSocialStats.followers ?? audit?.followers ?? 0}
            account={liveSocialStats.account}
            timestamps={liveSocialStats.media.map((m) => m.timestamp)}
          />
        </div>
      ) : hasAudit && !liveSocialStats && audit?.recent_posts_raw?.trim() ? (
        <div className="mt-5">
          <p className="mb-3 text-xs text-muted">
            Showing your last{" "}
            {countRecentPostsRaw(audit.recent_posts_raw)} posts from your
            Instagram audit
          </p>
          <RecentPostsCards
            raw={sortRecentPostsRawByDateDesc(audit.recent_posts_raw)}
            previewCount={10}
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
      ) : hasAudit && !canViewLiveSocialData ? (
        <div className="relative mt-5 overflow-hidden rounded-xl">
          <div
            className="pointer-events-none select-none space-y-3 blur-sm opacity-50"
            aria-hidden="true"
          >
            {[
              {
                likes: 142,
                comments: 23,
                eng: "6.2%",
                label: "Your most recent post",
              },
              {
                likes: 98,
                comments: 11,
                eng: "4.8%",
                label: "Two days ago",
              },
              {
                likes: 203,
                comments: 31,
                eng: "8.1%",
                label: "Last week",
              },
            ].map((post, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-input px-4 py-3"
              >
                <p className="text-xs text-muted">{post.label}</p>
                <div className="flex gap-4 text-xs">
                  <span className="font-semibold text-foreground">
                    ♥ {post.likes}
                  </span>
                  <span className="font-semibold text-foreground">
                    💬 {post.comments}
                  </span>
                  <span className="font-bold text-brand">{post.eng}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-card/80 backdrop-blur-[2px]">
            <div className="px-4 text-center">
              <p className="text-2xl">📊</p>
              <p className="mt-2 text-sm font-black uppercase tracking-wide text-foreground">
                Live Instagram stats
              </p>
              <p className="mt-1 max-w-xs text-sm text-muted">
                Connect your Instagram Business account to see real-time
                performance data feeding into your weekly plan.
              </p>
              <Link
                href="/pricing"
                className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-brand px-4 text-sm font-black uppercase tracking-wide text-brand-foreground transition-colors hover:brightness-95"
              >
                Start 14-day free trial
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );

  const upcomingSection = (
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
  );

  const engagementLockedSection =
    hasAudit && !canViewEngagementTrends ? (
    <section className="relative mt-10 overflow-hidden rounded-xl border border-card-border bg-card p-7">
      <div
        className="pointer-events-none select-none blur-sm opacity-60"
        aria-hidden="true"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-brand">
          Engagement trends
        </p>
        <h2 className="mt-2 text-lg font-black uppercase tracking-tight text-foreground">
          Week-on-week performance
        </h2>
        <div className="mt-5 flex h-24 items-end gap-2">
          {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-brand/40"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between">
          <span className="text-xs text-muted">Mon</span>
          <span className="text-xs text-muted">Sun</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-input p-3">
            <p className="text-xs text-muted">Avg engagement</p>
            <p className="text-xl font-black text-foreground">4.2%</p>
          </div>
          <div className="rounded-lg bg-input p-3">
            <p className="text-xs text-muted">Best format</p>
            <p className="text-xl font-black text-foreground">Reels</p>
          </div>
          <div className="rounded-lg bg-input p-3">
            <p className="text-xs text-muted">Trend</p>
            <p className="text-xl font-black text-brand">↑ 12%</p>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-card/80 backdrop-blur-[2px]">
        <div className="px-6 text-center">
          <p className="text-2xl">📈</p>
          <p className="mt-2 text-sm font-black uppercase tracking-wide text-foreground">
            Engagement trends
          </p>
          <p className="mt-1 max-w-xs text-sm text-muted">
            See how your content is performing week on week — format
            breakdowns, engagement trends, and what&apos;s working.
          </p>
          <Link
            href="/pricing"
            className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-brand px-4 text-sm font-black uppercase tracking-wide text-brand-foreground transition-colors hover:brightness-95"
          >
            Start 14-day free trial
          </Link>
        </div>
      </div>
    </section>
  ) : null;

  const reviewLockedSection = hasAudit && !canReview ? (
    <section className="relative mt-10 overflow-hidden rounded-xl border border-card-border bg-card p-7">
      <div
        className="pointer-events-none select-none blur-sm opacity-60"
        aria-hidden="true"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-brand">
          Content review
        </p>
        <h2 className="mt-2 text-lg font-black uppercase tracking-tight text-foreground">
          Expert feedback on your ideas
        </h2>
        <div className="mt-5 space-y-3">
          <div className="rounded-xl border border-card-border bg-input p-4">
            <p className="text-xs font-bold text-brand">REEL</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              Behind the scenes — recording day
            </p>
            <div className="mt-3 rounded-lg bg-card p-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-brand">
                Feedback
              </p>
              <p className="text-xs text-muted-strong">
                Strong concept. Lead with the moment of tension — the take
                that went wrong before the one that didn&apos;t. That&apos;s
                the hook. Keep it under 30 seconds.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-card/80 backdrop-blur-[2px]">
        <div className="px-6 text-center">
          <p className="text-2xl">✍️</p>
          <p className="mt-2 text-sm font-black uppercase tracking-wide text-foreground">
            Content review
          </p>
          <p className="mt-1 max-w-xs text-sm text-muted">
            Submit your plan ideas for expert feedback before you post.
            Included with Tempo Pro.
          </p>
          <Link
            href="/pricing"
            className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-brand px-4 text-sm font-black uppercase tracking-wide text-brand-foreground transition-colors hover:brightness-95"
          >
            Start 14-day free trial
          </Link>
        </div>
      </div>
    </section>
  ) : null;

  // Board artists get one focused page: the week, the ideas, dates, then
  // their Instagram. The old plan-era sections stay for everyone else.
  if (board && week) {
    const comingUpSection = (
      <section className="mt-10 rounded-xl border border-card-border bg-card p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-brand">
          Coming up
        </p>
        {comingUp.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {comingUp.map((ev) => (
              <li key={ev.id} className="flex gap-3 text-sm">
                <span className="w-24 shrink-0 text-muted">
                  {new Date(ev.event_date + "T12:00:00").toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <span className="font-semibold text-foreground">{ev.title}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">Nothing in the next four weeks.</p>
        )}
        <p className="mt-4 text-sm">
          <Link href="/events" className="font-semibold text-brand hover:underline">
            Add a date →
          </Link>
        </p>
      </section>
    );

    // A compact Instagram box: live account once connected, otherwise a
    // connect prompt first and only a few audit posts underneath.
    const boardInstagramSection = postResults ? (
      <PostResultsSection
        data={postResults}
        handle={liveSocialStats?.account?.username ?? profile?.instagram_handle ?? null}
        target={weekProgress?.target ?? null}
      />
    ) : canViewLiveSocialData && liveSocialStats ? (
        instagramSection
      ) : (
        <section className="mt-10 rounded-xl border border-card-border bg-card p-7">
          <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
            Your Instagram
          </h2>
          {canViewLiveSocialData ? (
            <div className="mt-4 flex flex-col gap-3 rounded-lg border border-card-border bg-input p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-strong">
                Connect Instagram so Tempo can see what you post and how it does.
              </p>
              <Link
                href="/api/auth/instagram"
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-brand px-4 text-sm font-black uppercase tracking-wide text-brand-foreground hover:brightness-95"
              >
                Connect Instagram
              </Link>
            </div>
          ) : null}
          {hasAudit && audit?.recent_posts_raw?.trim() ? (
            <div className="mt-5">
              <p className="mb-3 text-xs text-muted">
                Recent posts from your audit ({formatRelativeDate(audit.created_at)})
              </p>
              <RecentPostsCards
                raw={sortRecentPostsRawByDateDesc(audit.recent_posts_raw)}
                previewCount={3}
              />
            </div>
          ) : null}
        </section>
      );

    return (
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">
              Your week · {week.label}
            </p>
            <h1 className="text-5xl font-black uppercase tracking-tight text-foreground sm:text-6xl">
              {artistName}
            </h1>
          </div>
          <LogoutButton />
        </div>

        <div className="mt-6 h-px w-full bg-[#1a1a1a]" />

        <AppNavWrapper />

        {!hasAudit ? (
          <AuditCTASection
            artistId={activeArtistId}
            instagramHandle={profile?.instagram_handle ?? null}
            initialHasPending={auditPending}
            initialTriggeredAt={pendingAuditTriggeredAt}
            connected={Boolean(profile?.instagram_user_id?.trim())}
            isAdmin={isAdmin}
          />
        ) : null}

        {weeklyPlanSection}
        {comingUpSection}
        {boardInstagramSection}

        {audit ? (
          <details className="group mt-10 rounded-xl border border-card-border bg-card p-6">
            <summary className="cursor-pointer list-none text-sm font-bold uppercase tracking-tight text-muted-strong hover:text-foreground">
              Your audit <span className="text-xs font-normal normal-case text-muted">· {formatRelativeDate(audit.created_at)}</span>
            </summary>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-strong">
              {audit.ai_pattern_analysis}
            </p>
            <div className="mt-6">
              <FullAnalysisCollapsible
                sections={fullAnalysisSections}
                artistId={activeArtistId}
                updatedAt={audit.created_at}
                forceOpen={auditReady}
              />
            </div>
          </details>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:px-6">
      {upgraded === "true" ? (
        <ConversionTracker
          upgraded={true}
          plan={plan}
          isTrial={!!profile?.trial_started_at}
        />
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">
            Week of {weekStartLabel}
          </p>
          <h1 className="text-5xl font-black uppercase tracking-tight text-foreground sm:text-6xl">
            {artistName}
          </h1>
          {/* The plan status badge belongs to the weekly plan, not the board. */}
          {board ? null : (
            <div
              className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide ring-1 ring-inset ${momentum.cls}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
              {momentum.label}
            </div>
          )}
        </div>
        <LogoutButton />
      </div>

      <div className="mt-6 h-px w-full bg-[#1a1a1a]" />

      <AppNavWrapper />

      {!showAuditFirst && registered === "true" && !hasInstagram && !auditPending ? (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-sm leading-relaxed text-amber-100">
            Welcome to Tempo. Add your Instagram handle in{" "}
            <Link
              href="/settings"
              className="font-semibold underline underline-offset-4 hover:text-amber-50"
            >
              Settings
            </Link>{" "}
            to run your free Instagram audit.
          </p>
        </div>
      ) : null}

      {!showAuditFirst && !hasAudit ? (
        <AuditCTASection
          artistId={activeArtistId}
          instagramHandle={profile?.instagram_handle ?? null}
          initialHasPending={auditPending}
          initialTriggeredAt={pendingAuditTriggeredAt}
          connected={Boolean(profile?.instagram_user_id?.trim())}
          isAdmin={isAdmin}
        />
      ) : null}

      {!showAuditFirst ? weeklyPlanSection : null}

      {auditSnapshotSection}
      {auditAnalysisSections}
      {instagramSection}

      {showAuditFirst ? weeklyPlanSection : null}

      {engagementLockedSection}
      {reviewLockedSection}
      {upcomingSection}
    </div>
  );
}
