import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { LogoutButton } from "@/app/dashboard/logout-button";
import { EventsSection } from "./events-section";
import type { EventRow } from "@/types/event";

export default async function EventsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("artist_name")
    .eq("id", user.id)
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
    .eq("user_id", user.id)
    .order("event_date", { ascending: true });

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const initialEvents = (eventsRows ?? []) as EventRow[];

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-1 flex-col px-4 py-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Your dates
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Shows, releases, rehearsals — these shape your weekly content plan
          </p>
        </div>
        <LogoutButton />
      </header>

      <AppNav />

      <EventsSection initialEvents={initialEvents} userId={user.id} />
    </div>
  );
}
