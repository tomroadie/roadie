import type { Learning } from "@/lib/themes/load";

/** "What we're learning": what's working, and the one change most worth making. */
export function LearningsSection({ learnings, hint = null }: { learnings: Learning[]; hint?: string | null }) {
  return (
    <section aria-labelledby="learnings-heading" className="flex flex-col gap-3">
      <h2 id="learnings-heading" className="text-xl font-bold text-foreground">
        What we&rsquo;re learning
      </h2>
      {learnings.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          {learnings.map((l) => (
            <article
              key={`${l.tag}-${l.title}`}
              className="flex flex-col gap-2 rounded-2xl border border-card-border bg-card p-5"
            >
              <p
                className={`font-display text-3xl font-bold tracking-tight ${l.kind === "improve" ? "text-quiet" : "text-brand"}`}
              >
                {l.stat}
              </p>
              <p className="font-semibold text-foreground">{l.title}</p>
              <p className="text-sm leading-relaxed text-muted">{l.body}</p>
              <p
                className={`mt-auto text-xs font-semibold uppercase tracking-[0.06em] ${l.kind === "improve" ? "text-quiet" : "text-muted"}`}
              >
                {l.kind === "improve" && l.tag !== "Room to grow" ? `Room to grow · ${l.tag}` : l.tag}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-card-border bg-card p-5 text-sm leading-relaxed text-muted">
          {hint ? (
            <p className="text-foreground">{hint}</p>
          ) : null}
          <p className={hint ? "mt-2" : undefined}>
            Learnings show up once a few of your posts have settled. Every post is compared with your own
            usual, never with other artists.
          </p>
        </div>
      )}
    </section>
  );
}
