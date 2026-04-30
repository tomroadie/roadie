import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppNavWrapper } from "@/components/app-nav-wrapper";
import { LogoutButton } from "./logout-button";
import { WeeklyPlanSection } from "./weekly-plan-section";
import { normalizeIdeasFromDb } from "@/lib/parse-ideas-json";
import { getActiveArtistIdForUser } from "@/lib/active-artist";
import { getMondayDateString } from "@/lib/week";

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
    .select("ideas")
    .eq("artist_id", activeArtistId)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  const initialIdeas = normalizeIdeasFromDb(weeklyPlan?.ideas ?? null);
  const weekStart = getMondayDateString();
  const weekStartLabel = new Date(weekStart + "T12:00:00").toLocaleDateString(
    "en-GB",
    { weekday: "short", day: "numeric", month: "short" }
  );
  const momentumLabel = initialIdeas?.length
    ? "Momentum: building"
    : "Momentum: ready for a push";

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-1 flex-col px-6 py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Week of {weekStartLabel}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {artistName}
          </h1>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7C3AED]" />
            {momentumLabel}
          </div>
        </div>
        <LogoutButton />
      </div>

      <AppNavWrapper />

      <WeeklyPlanSection initialIdeas={initialIdeas} />
    </div>
  );
}
