import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppNavWrapper } from "@/components/app-nav-wrapper";
import { LogoutButton } from "./logout-button";
import { WeeklyPlanSection } from "./weekly-plan-section";
import { normalizeIdeasFromDb } from "@/lib/parse-ideas-json";
import { getActiveArtistIdForUser } from "@/lib/active-artist";

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

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-1 flex-col px-4 py-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Welcome back, {artistName}.
          </p>
        </div>
        <LogoutButton />
      </header>

      <AppNavWrapper />

      <WeeklyPlanSection initialIdeas={initialIdeas} />
    </div>
  );
}
