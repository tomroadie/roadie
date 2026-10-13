import type { ShotList } from "@/lib/shot-lists";

const FORMAT_LABEL: Record<string, string> = { reel: "Reel", photo: "Photo", story: "Story", carousel: "Carousel" };

function when(iso: string): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  return iso === today ? "Today" : "Tomorrow";
}

/** "Gig tomorrow: what to capture", each shot tied to something of theirs. */
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
          <ol className="flex flex-col gap-3">
            {l.shots.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-foreground">
                <span className="mt-0.5 shrink-0 self-start rounded-full bg-input px-2.5 py-0.5 text-xs font-medium text-muted-strong">
                  {FORMAT_LABEL[s.format] ?? s.format}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{s.shot}</span>
                  {s.why ? <span className="text-muted">{s.why}</span> : null}
                  {s.anchorLabel ? (
                    s.anchorHref ? (
                      <a
                        href={s.anchorHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-brand hover:underline"
                      >
                        {s.anchorLabel} ↗
                      </a>
                    ) : (
                      <span className="text-xs font-semibold text-brand">{s.anchorLabel}</span>
                    )
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted">Grab what you can on the day. Each one gives you a post for the week after.</p>
        </section>
      ))}
    </>
  );
}
