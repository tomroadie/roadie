import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppNavWrapper } from "@/components/app-nav-wrapper";
import { LogoutButton } from "./logout-button";
import { WeeklyPlanSection } from "./weekly-plan-section";
import { normalizeIdeasFromDb } from "@/lib/parse-ideas-json";
import { getActiveArtistIdForUser } from "@/lib/active-artist";
import { getMondayDateString } from "@/lib/week";
import type { EventRow } from "@/types/event";

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

  if (!activeArtistId) {
    redirect("/onboarding");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("artist_name")
    .eq("id", activeArtistId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const artistName = profile?.artist_name?.trim();
  if (!artistName) {
    redirect("/onboarding");
  }

  const { data: weeklyPlan } = await supabase
    .from("weekly_plans")
    .select("ideas, created_at")
    .eq("artist_id", activeArtistId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const initialIdeas = normalizeIdeasFromDb(weeklyPlan?.ideas ?? null);
  const lastGeneratedAt = (weeklyPlan?.created_at as string | undefined) ?? null;

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

  const ideasCount = initialIdeas?.length ?? 0;
  const momentum =
    ideasCount >= 5
      ? { label: "High momentum", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" }
      : ideasCount > 0
        ? { label: "Building", cls: "bg-amber-50 text-amber-700 ring-amber-200" }
        : { label: "Low momentum", cls: "bg-zinc-100 text-zinc-700 ring-zinc-200" };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-1 flex-col px-6 py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
            Week of {weekStartLabel}
          </p>
          <h1 className="text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl">
            {artistName}
          </h1>
          <div
            className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset shadow-[0_1px_3px_rgba(0,0,0,0.08)] ${momentum.cls}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
            {momentum.label}
          </div>
        </div>
        <LogoutButton />
      </div>

      <div className="mt-8 h-px w-full bg-zinc-200/80 dark:bg-zinc-800" />

      <AppNavWrapper />

      <WeeklyPlanSection
        initialIdeas={initialIdeas}
        upcomingEventsCount={upcomingEventsCount}
        lastGeneratedAt={lastGeneratedAt}
        upcomingThisWeek={upcomingThisWeek}
      />
    </div>
  );
}
