import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppNavWrapper } from "@/components/app-nav-wrapper";
import { EventsSection } from "./events-section";
import { TourPageForm } from "./tour-page-form";
import { DateSuggestions, type DateSuggestion } from "@/app/home/date-suggestions";
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
    .select("artist_name, tour_page_url, tour_page_status, tour_page_checked_at, tour_page_found")
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
    .select("id, title, event_date, event_type, notes, link_url, link_context, link_status")
    .eq("artist_id", activeArtistId)
    .order("event_date", { ascending: true });

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const initialEvents = (eventsRows ?? []) as EventRow[];

  // Everything waiting to be added, from captions and the tour page.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  const { data: suggestionRows } = await supabase
    .from("date_suggestions")
    .select("id, title, event_date, source_excerpt")
    .eq("artist_id", activeArtistId)
    .eq("status", "pending")
    .or(`event_date.gte.${today},event_date.is.null`)
    .order("event_date", { nullsFirst: false })
    .limit(60);
  const suggestions: DateSuggestion[] = (suggestionRows ?? []).map((r) => ({
    id: String(r.id),
    title: String(r.title),
    eventDate: r.event_date ? String(r.event_date) : null,
    excerpt: r.source_excerpt ? String(r.source_excerpt) : null,
  }));

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6">
      <AppNavWrapper />

      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Dates</h1>
        <p className="max-w-2xl text-muted">
          Shows, releases and sessions coming up. Tempo plans your weeks around them and sends a shot list the day before.
        </p>
      </div>

      <TourPageForm
        artistId={activeArtistId}
        url={profile.tour_page_url ?? null}
        status={profile.tour_page_status === "ok" || profile.tour_page_status === "failed" ? profile.tour_page_status : null}
        checkedAt={profile.tour_page_checked_at ?? null}
        found={typeof profile.tour_page_found === "number" ? profile.tour_page_found : null}
      />

      {suggestions.length > 0 ? (
        <section className="mt-6 rounded-2xl border border-card-border bg-card p-5 [&>div]:mt-0 [&>div]:border-t-0 [&>div]:pt-0">
          <DateSuggestions
            suggestions={suggestions}
            artistId={activeArtistId}
            datedTotal={suggestions.filter((s) => s.eventDate).length}
            heading="Waiting to add"
          />
        </section>
      ) : null}

      <EventsSection
        key={initialEvents.map((e) => e.id).join(",")}
        initialEvents={initialEvents}
        artistId={activeArtistId}
      />
    </div>
  );
}
