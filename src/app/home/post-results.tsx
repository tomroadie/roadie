import type { PostResult, PostResultsData } from "@/lib/post-results";

const TYPE_LABEL: Record<string, string> = {
  IMAGE: "Photo",
  VIDEO: "Reel",
  CAROUSEL_ALBUM: "Carousel",
};

const LATEST_SHOWN = 3;
const EARLIER_SHOWN = 7;

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-GB");
}

function roughly(n: number): string {
  // "about 1,100" reads better than "about 1,117".
  const step = n >= 1000 ? 100 : n >= 100 ? 10 : 1;
  return fmt(Math.round(n / step) * step);
}

function postDateLabel(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  });
}

function lineClass(post: PostResult): string {
  const band = post.comparison?.settled ? post.comparison.band : null;
  if (band === "well_above" || band === "above") return "text-brand";
  return "text-muted-strong";
}

function PostRow({ post }: { post: PostResult }) {
  const body = (
    <>
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-input">
        {post.thumbnailUrl ? (
          // Instagram CDN images; next/image would need every CDN host allow-listed.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted">
          {postDateLabel(post.postDate)}
          {post.mediaType ? ` · ${TYPE_LABEL[post.mediaType] ?? post.mediaType}` : ""}
        </p>
        {post.caption ? (
          <p className="mt-0.5 truncate text-sm text-foreground">{post.caption}</p>
        ) : null}
        <p className={`mt-1 text-sm ${lineClass(post)}`}>
          {post.line ??
            (post.reach !== null ? `Reached ${fmt(post.reach)}.` : "Not enough earlier posts to compare yet.")}
        </p>
        {post.ideaTitle ? (
          <p className="mt-1 text-xs text-muted">From your board: {post.ideaTitle}</p>
        ) : null}
      </div>
    </>
  );

  return post.permalink ? (
    <a
      href={post.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-4 rounded-lg p-2 -mx-2 hover:bg-input"
    >
      {body}
    </a>
  ) : (
    <div className="flex gap-4 p-2 -mx-2">{body}</div>
  );
}

function WeeksStrip({ weeks, target }: { weeks: PostResultsData["weeks"]; target: number | null }) {
  const max = Math.max(4, target ?? 0, ...weeks.map((w) => w.posts));
  return (
    <div className="mt-8">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Posts per week</p>
      <div className="mt-3 grid grid-cols-8 items-end gap-2" role="img" aria-label={`Posts per week over the last ${weeks.length} weeks: ${weeks.map((w) => w.posts).join(", ")}`}>
        {weeks.map((w) => (
          <div key={w.label} className="flex flex-col items-center gap-1.5" aria-hidden="true">
            <span className={`text-xs font-bold ${w.posts > 0 ? "text-foreground" : "text-muted"}`}>{w.posts}</span>
            <div className="relative flex h-16 w-full max-w-8 items-end overflow-hidden rounded bg-input">
              <div
                className={`w-full rounded ${w.current ? "bg-brand" : "bg-brand/50"}`}
                style={{ height: `${(w.posts / max) * 100}%` }}
              />
              {target ? (
                <div
                  className="absolute inset-x-0 border-t border-dashed border-muted"
                  style={{ bottom: `${(target / max) * 100}%` }}
                />
              ) : null}
            </div>
            <span className={`text-[10px] ${w.current ? "font-bold text-brand" : "text-muted"}`}>
              {w.current ? "Now" : w.label}
            </span>
          </div>
        ))}
      </div>
      {target ? (
        <p className="mt-2 text-xs text-muted">Dashed line: this week&rsquo;s target of {target}.</p>
      ) : null}
    </div>
  );
}

export function PostResultsSection({
  data,
  handle,
  target,
}: {
  data: PostResultsData;
  handle: string | null;
  target: number | null;
}) {
  const latest = data.posts.slice(0, LATEST_SHOWN);
  const earlier = data.posts.slice(LATEST_SHOWN, LATEST_SHOWN + EARLIER_SHOWN);

  return (
    <section className="mt-10 rounded-xl border border-card-border bg-card p-7">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">How your posts did</h2>
        {handle || data.followers !== null ? (
          <p className="text-xs text-muted">
            {handle ? `@${handle}` : ""}
            {handle && data.followers !== null ? " · " : ""}
            {data.followers !== null ? `${fmt(data.followers)} followers` : ""}
            {data.followerChange && data.followerChange.change !== 0
              ? ` (${data.followerChange.change > 0 ? "+" : ""}${fmt(data.followerChange.change)} in ${data.followerChange.days} days)`
              : ""}
          </p>
        ) : null}
      </div>
      {data.typicalReach !== null ? (
        <p className="mt-1 text-sm text-muted">
          Each post is compared with your own usual: a typical post of yours reaches about{" "}
          {roughly(data.typicalReach)} people.
        </p>
      ) : null}

      <div className="mt-5 space-y-2">
        {latest.map((p) => (
          <PostRow key={p.id} post={p} />
        ))}
      </div>

      {earlier.length > 0 ? (
        <details className="group mt-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-muted hover:text-foreground">
            <span className="group-open:hidden">Show earlier posts</span>
            <span className="hidden group-open:inline">Hide earlier posts</span>
          </summary>
          <div className="mt-3 space-y-2">
            {earlier.map((p) => (
              <PostRow key={p.id} post={p} />
            ))}
          </div>
        </details>
      ) : null}

      <WeeksStrip weeks={data.weeks} target={target} />
    </section>
  );
}
