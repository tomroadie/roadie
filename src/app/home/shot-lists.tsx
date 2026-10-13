import type { ShotList } from "@/lib/shot-lists";

const FORMAT_LABEL: Record<string, string> = { reel: "Reel", photo: "Photo", story: "Story", carousel: "Carousel" };

function when(iso: string): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  return iso === today ? "Today" : "Tomorrow";
}

/** "Gig tomorrow: what to capture", from the concept that fits it. */
export function ShotListsSection({ lists }: { lists: ShotList[] }) {
  if (lists.length === 0) return null;
  return (
    <>
      {lists.map((l) => (
        <section
          key={l.eventId}
          aria-label={`Shot list for ${l.title}`}
          className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-card p-5"
        >
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
              {when(l.date)} · {l.type}
              {l.themeName ? ` · ${l.themeName}` : ""}
            </p>
            <h2 className="text-xl font-bold text-foreground">{l.title}: what to capture</h2>
          </div>
          <ul className="flex flex-col gap-2">
            {l.shots.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-foreground">
                <span className="mt-0.5 shrink-0 self-start rounded-full bg-input px-2.5 py-0.5 text-xs font-medium text-muted-strong">
                  {FORMAT_LABEL[s.format] ?? s.format}
                </span>
                <span>{s.shot}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">Grab what you can. A few of these will cover your week.</p>
        </section>
      ))}
    </>
  );
}
