import type { PostResult } from "@/lib/post-results";
import { formatName, formatRatio } from "@/lib/themes/load";

const SHOWN = 6;

function chip(post: PostResult): { text: string; cls: string } {
  if (post.excluded) return { text: "Ad or collab", cls: "text-muted" };
  const c = post.comparison;
  if (!c) return { text: "", cls: "text-muted" };
  if (!c.settled) return { text: "Settling", cls: "text-muted" };
  const text = formatRatio(c.ratio);
  if (c.band === "well_above" || c.band === "above") return { text, cls: "text-brand" };
  if (c.band === "quieter") return { text, cls: "text-quiet" };
  return { text, cls: "text-muted" };
}

/** The latest posts at a glance, each against the artist's own usual. */
export function RecentPostsGrid({ posts }: { posts: PostResult[] }) {
  const shown = posts.slice(0, SHOWN);
  if (shown.length === 0) return null;
  const metric = shown.some((p) => p.comparison?.metric === "interactions") ? "likes and comments" : "reach";

  return (
    <section aria-labelledby="recent-posts-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="recent-posts-heading" className="text-xl font-bold text-foreground">
          Recent posts
        </h2>
        <span className="text-sm text-muted">vs your usual {metric}</span>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown.map((p) => {
          const c = chip(p);
          const format = formatName(p.mediaType);
          const tile = (
            <div className="relative flex aspect-[4/5] items-end overflow-hidden rounded-xl bg-input p-2.5">
              {p.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : null}
              <span className="relative rounded-full bg-card px-2.5 py-0.5 text-xs font-semibold text-foreground">
                {format}
              </span>
            </div>
          );
          return (
            <li key={p.id} className="flex min-w-0 flex-col gap-1.5">
              {p.permalink ? (
                <a
                  href={p.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open this ${format.toLowerCase()} on Instagram${p.line ? `. ${p.line}` : ""}`}
                  className="rounded-xl hover:opacity-90"
                >
                  {tile}
                </a>
              ) : (
                tile
              )}
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate text-muted">{p.themeName ?? "Not sorted yet"}</span>
                {c.text ? <span className={`shrink-0 font-semibold ${c.cls}`}>{c.text}</span> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
