import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppNavWrapper } from "@/components/app-nav-wrapper";
import { LogoutButton } from "./logout-button";
import { WeeklyPlanSection } from "./weekly-plan-section";
import { FirstRunChecklist } from "./first-run-checklist";
import { SavedIdeasSection } from "./saved-ideas-section";
import { normalizeIdeasFromDb } from "@/lib/parse-ideas-json";
import { getActiveArtistIdForUser } from "@/lib/active-artist";
import { getMondayDateString } from "@/lib/week";
import type { EventRow } from "@/types/event";
import Link from "next/link";
import { canDo, normalizePlan } from "@/lib/plan-limits";
import { userIsAdmin } from "@/lib/is-admin";
import { DashboardTracking } from "./dashboard-tracking";

type ContentReviewRow = {
  idea_hook: string;
  feedback: string;
  reviewed_at: string;
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

export default async function DashboardPage() {
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
    .select("artist_name, plan, posting_frequency, instagram_handle")
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
  const postingFrequency =
    typeof profile?.posting_frequency === "string" ? profile.posting_frequency : null;
  const canReview = canDo(plan, "canReview", isAdmin);
  const canRefineIdeas = canDo(plan, "canRefineIdeas", isAdmin);
  const canSaveIdeas = canDo(plan, "canSaveIdeas", isAdmin);

  const { data: weeklyPlan } = await supabase
    .from("weekly_plans")
    .select("ideas, created_at, week_start, idea_ratings")
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

  const { data: existingAudit } = await supabase
    .from("audits")
    .select("id")
    .eq("artist_id", activeArtistId)
    .limit(1)
    .maybeSingle();

  const hasAudit = !!existingAudit;

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

  const { count: eventsTotalCount } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("artist_id", activeArtistId);

  const hasAnyEvents = (eventsTotalCount ?? 0) > 0;

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

  const hasPlanIdeas = (initialIdeas?.length ?? 0) > 0;
  const momentum = !hasPlanIdeas
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

  const showFirstRunChecklist = !hasPlanIdeas && !hasAnyEvents;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:px-6">
      <DashboardTracking />
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

      {plan === "free" && !isAdmin ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border-l-4 border-brand bg-card px-3 py-2 text-xs text-muted">
          You&apos;re on the free plan.{" "}
          <Link
            href="/pricing"
            className="font-semibold text-foreground underline underline-offset-4 hover:text-brand hover:no-underline"
          >
            View pricing
          </Link>
        </div>
      ) : null}

      <div className="mt-6 h-px w-full bg-[#1a1a1a]" />

      <AppNavWrapper />

      {showFirstRunChecklist ? (
        <FirstRunChecklist hasEvents={hasAnyEvents} hasPlan={hasPlanIdeas} />
      ) : null}

      <WeeklyPlanSection
        initialIdeas={initialIdeas}
        initialIdeaRatings={initialIdeaRatings}
        upcomingEventsCount={upcomingEventsCount}
        lastGeneratedAt={lastGeneratedAt}
        upcomingThisWeek={upcomingThisWeek}
        plan={plan}
        postingFrequency={postingFrequency}
        auditPending={auditPending}
        hasAudit={hasAudit}
        isAdmin={isAdmin}
        canReview={canReview}
        canRefineIdeas={canRefineIdeas}
        canSaveIdeas={canSaveIdeas}
        reviews={reviews}
        artistId={activeArtistId}
      />

      <SavedIdeasSection artistId={activeArtistId} />
    </div>
  );
}
