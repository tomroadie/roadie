import type { Learning } from "@/lib/themes/load";

/** "What we're learning": up to three patterns from the artist's own posts. */
export function LearningsSection({ learnings }: { learnings: Learning[] }) {
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
              <p className="font-display text-3xl font-bold tracking-tight text-brand">{l.stat}</p>
              <p className="font-semibold text-foreground">{l.title}</p>
              <p className="text-sm leading-relaxed text-muted">{l.body}</p>
              <p className="mt-auto text-xs font-semibold uppercase tracking-[0.06em] text-muted">{l.tag}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-card-border bg-card p-5 text-sm leading-relaxed text-muted">
          Learnings show up once a few of your posts have settled. Every post is compared with your own
          usual, never with other artists.
        </div>
      )}
    </section>
  );
}
