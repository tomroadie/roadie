"use client";

import { useMemo, useState } from "react";

type ParsedPost = {
  type: string | null;
  date: Date | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  caption: string | null;
};

function parseNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[,\s]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseRecentPosts(raw: string): ParsedPost[] {
  const blocks = raw
    .split(/\n\s*---\s*\n/g)
    .map((b) => b.trim())
    .filter(Boolean);

  const posts: ParsedPost[] = [];

  for (const block of blocks) {
    const typeMatch = block.match(/^Type:\s*(.+)$/m);
    const dateMatch = block.match(/^Date:\s*(.+)$/m);
    const viewsMatch = block.match(/^Views:\s*(.+)$/m);
    const likesMatch = block.match(/^Likes:\s*(.+)$/m);
    const commentsMatch = block.match(/^Comments:\s*(.+)$/m);

    let caption: string | null = null;
    const captionIdx = block.search(/^Caption:\s*/m);
    if (captionIdx >= 0) {
      const after = block.slice(captionIdx);
      const firstLineEnd = after.indexOf("\n");
      if (firstLineEnd === -1) {
        caption = after.replace(/^Caption:\s*/m, "").trim() || null;
      } else {
        const firstLine = after.slice(0, firstLineEnd).replace(/^Caption:\s*/m, "");
        const rest = after.slice(firstLineEnd + 1);
        caption = [firstLine, rest].join("\n").trim() || null;
      }
    }

    const type = typeMatch?.[1]?.trim() ?? null;
    const dateStr = dateMatch?.[1]?.trim() ?? null;
    const date = dateStr ? new Date(dateStr) : null;

    posts.push({
      type,
      date: date && Number.isFinite(date.getTime()) ? date : null,
      views: parseNumber(viewsMatch?.[1]),
      likes: parseNumber(likesMatch?.[1]),
      comments: parseNumber(commentsMatch?.[1]),
      caption,
    });
  }

  return posts;
}

function badgeClasses(type: string | null): string {
  const t = (type ?? "").trim().toLowerCase();
  if (t.includes("video")) return "bg-purple-500/15 text-purple-200 ring-purple-500/25";
  if (t.includes("sidecar") || t.includes("carousel"))
    return "bg-sky-500/15 text-sky-200 ring-sky-500/25";
  if (t.includes("image")) return "bg-teal-500/15 text-teal-200 ring-teal-500/25";
  if (t.includes("reel")) return "bg-amber-500/15 text-amber-200 ring-amber-500/25";
  return "bg-zinc-500/15 text-zinc-200 ring-zinc-500/25";
}

function formatDate(d: Date | null): string | null {
  if (!d) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function StatChip({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number | null;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-input px-3 py-1 text-xs font-medium text-foreground">
      <span aria-hidden="true" className="text-muted">
        {icon}
      </span>
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-foreground">
        {value === null ? "—" : value.toLocaleString()}
      </span>
    </span>
  );
}

function Caption({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3">
      <p
        className="text-sm leading-relaxed text-muted-strong"
        style={
          expanded
            ? undefined
            : {
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }
        }
      >
        {text}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 text-xs font-bold uppercase tracking-widest text-brand hover:underline"
      >
        {expanded ? "Show less" : "Show more"}
      </button>
    </div>
  );
}

export function RecentPostsCards({ raw }: { raw: string }) {
  const posts = useMemo(() => parseRecentPosts(raw), [raw]);
  const [showAll, setShowAll] = useState(false);

  const validPosts = posts.filter((p) => {
    const hasAny =
      p.type ||
      p.date ||
      p.views !== null ||
      p.likes !== null ||
      p.comments !== null ||
      (p.caption && p.caption.trim());
    return Boolean(hasAny);
  });

  if (validPosts.length === 0) return null;

  const previewCount = 5;
  const visiblePosts = showAll ? validPosts : validPosts.slice(0, previewCount);

  return (
    <section className="rounded-xl border border-card-border bg-card p-7">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
          Recent posts
        </h2>
      </div>

      <div className="mt-5">
        {visiblePosts.map((p, idx) => (
          <article
            key={`${p.type ?? "post"}-${p.date?.toISOString() ?? "unknown"}-${idx}`}
            className="mb-3 rounded-xl border border-card-border bg-input p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span
                className={[
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
                  badgeClasses(p.type),
                ].join(" ")}
              >
                {p.type ?? "Post"}
              </span>
              <span className="text-xs font-medium text-muted">
                {formatDate(p.date) ?? ""}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <StatChip icon="👁" label="Views" value={p.views} />
              <StatChip icon="♥" label="Likes" value={p.likes} />
              <StatChip icon="💬" label="Comments" value={p.comments} />
            </div>

            {p.caption?.trim() ? <Caption text={p.caption.trim()} /> : null}
          </article>
        ))}
        {!showAll && validPosts.length > previewCount ? (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="mt-2 text-xs font-bold uppercase tracking-widest text-brand hover:underline"
          >
            Show all posts
          </button>
        ) : null}
      </div>
    </section>
  );
}

