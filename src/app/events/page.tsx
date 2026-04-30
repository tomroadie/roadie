import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppNavWrapper } from "@/components/app-nav-wrapper";
import { LogoutButton } from "@/app/dashboard/logout-button";
import { EventsSection } from "./events-section";
import type { EventRow } from "@/types/event";
import { getActiveArtistIdForUser } from "@/lib/active-artist";

export default async function EventsPage() {
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

  if (!profile?.artist_name?.trim()) {
    redirect("/onboarding");
  }

  const { data: eventsRows, error: eventsError } = await supabase
    .from("events")
    .select("id, title, event_date, event_type, notes")
    .eq("artist_id", activeArtistId)
    .order("event_date", { ascending: true });

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const initialEvents = (eventsRows ?? []) as EventRow[];

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">
            Your dates
          </h1>
          <p className="mt-2 text-muted">
            Shows, releases, rehearsals — these shape your weekly content plan
          </p>
        </div>
        <LogoutButton />
      </header>

      <AppNavWrapper />

      <div className="mt-6 rounded-xl border-l-4 border-brand bg-card p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">
          Why dates matter
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Your dates shape your weekly content plan. The more specific you are,
          the better your ideas.
        </p>
      </div>

      <EventsSection initialEvents={initialEvents} artistId={activeArtistId} />
    </div>
  );
}
