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
  if (t.includes("video")) return "bg-purple-50 text-purple-700 ring-purple-200";
  if (t.includes("sidecar") || t.includes("carousel"))
    return "bg-blue-50 text-blue-700 ring-blue-200";
  if (t.includes("image")) return "bg-teal-50 text-teal-700 ring-teal-200";
  if (t.includes("reel")) return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-200 dark:ring-zinc-800";
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
    <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-200">
      <span aria-hidden="true" className="text-zinc-500 dark:text-zinc-400">
        {icon}
      </span>
      <span className="text-zinc-600 dark:text-zinc-300">{label}</span>
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
        className="text-sm leading-relaxed text-slate-700 dark:text-slate-300"
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
        className="mt-2 text-xs font-semibold text-[#7C3AED] hover:underline"
      >
        {expanded ? "Show less" : "Show more"}
      </button>
    </div>
  );
}

export function RecentPostsCards({ raw }: { raw: string }) {
  const posts = useMemo(() => parseRecentPosts(raw), [raw]);

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

  return (
    <section className="rounded-2xl bg-white p-7 shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:bg-zinc-950">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Recent posts
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Last {validPosts.length} posts scraped from Instagram
        </p>
      </div>

      <div className="mt-5">
        {validPosts.map((p, idx) => (
          <article
            key={`${p.type ?? "post"}-${p.date?.toISOString() ?? "unknown"}-${idx}`}
            className="mb-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
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
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
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
      </div>
    </section>
  );
}

