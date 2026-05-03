"use client";

import { useMemo, useState } from "react";

export type InstagramLiveInsightRow = {
  key: "impressions" | "reach" | "profile_views";
  label: string;
  value: number;
};

export type InstagramLiveMediaRow = {
  id: string;
  caption: string | null;
  thumbnailUrl: string | null;
  likes: number;
  comments: number;
  impressions: number | null;
  reach: number | null;
  timestamp: string;
};

function truncateCaption(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

function engagementPct(likes: number, comments: number, followers: number): number | null {
  if (followers <= 0) return null;
  return ((likes + comments) / followers) * 100;
}

function engagementBadgeClasses(pct: number): string {
  if (pct > 3) {
    return "bg-brand/15 text-brand ring-1 ring-brand/25";
  }
  if (pct >= 1) {
    return "bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/25 dark:text-amber-400";
  }
  return "bg-input text-muted ring-1 ring-card-border";
}

function formatHourPretty(hour24: number): string {
  const h = ((hour24 % 24) + 24) % 24;
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${period}`;
}

function modeHour(hours: number[]): number | null {
  if (hours.length === 0) return null;
  const counts = new Map<number, number>();
  for (const hr of hours) {
    counts.set(hr, (counts.get(hr) ?? 0) + 1);
  }
  let bestH = hours[0]!;
  let bestC = -1;
  for (const [h, c] of counts) {
    if (c > bestC || (c === bestC && h < bestH)) {
      bestC = c;
      bestH = h;
    }
  }
  return bestH;
}

function computeBestTimeLine(
  media: InstagramLiveMediaRow[],
  timestamps: string[] | undefined
): string | null {
  if (media.length < 3) return null;

  const resolved = media.map((m, i) => ({
    m,
    ts: (m.timestamp?.trim() || timestamps?.[i]?.trim() || ""),
  }));

  const ranked = [...resolved]
    .sort(
      (a, b) =>
        b.m.likes +
        b.m.comments -
        (a.m.likes + a.m.comments)
    )
    .slice(0, 5);

  const hours: number[] = [];
  for (const row of ranked) {
    if (!row.ts) continue;
    const d = new Date(row.ts);
    if (!Number.isFinite(d.getTime())) continue;
    hours.push(d.getHours());
  }

  if (hours.length < 3) return null;

  const topHour = modeHour(hours);
  if (topHour === null) return null;

  return `Your top posts tend to go up around ${formatHourPretty(topHour)}.`;
}

export function LiveStatsSection({
  insights,
  media,
  followers,
  timestamps,
}: {
  insights: InstagramLiveInsightRow[];
  media: InstagramLiveMediaRow[];
  followers: number;
  timestamps?: string[];
}) {
  const [sortBy, setSortBy] = useState<"recent" | "top">("recent");

  const showStatsCards = insights.length > 0;

  const orderedMedia = useMemo(() => {
    const copy = [...media];
    if (sortBy === "top") {
      copy.sort(
        (a, b) =>
          b.likes +
          b.comments -
          (a.likes + a.comments)
      );
      return copy;
    }
    return copy;
  }, [media, sortBy]);

  const bestTimeLine = useMemo(
    () => computeBestTimeLine(media, timestamps),
    [media, timestamps]
  );

  return (
    <div className="space-y-8">
      {showStatsCards ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {insights.map((row) => (
            <div
              key={row.key}
              className="rounded-xl border border-card-border bg-input p-5"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-brand">
                {row.label}
              </p>
              <p className="mt-2 text-3xl font-black tracking-tight text-foreground">
                {row.value.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-muted">Last 7 days</p>
            </div>
          ))}
        </div>
      ) : null}

      {media.length > 0 ? (
        <div>
          {!showStatsCards ? (
            <p className="text-sm leading-relaxed text-muted">
              Impressions and reach data coming soon — requires additional
              permissions.
            </p>
          ) : null}
          <div
            className={[
              "flex flex-wrap items-center justify-between gap-3",
              !showStatsCards ? "mt-5" : "",
            ].join(" ")}
          >
            <h3 className="text-sm font-bold uppercase tracking-tight text-foreground">
              Posts
            </h3>
            <div className="flex gap-1 rounded-lg border border-card-border bg-input p-1">
              <button
                type="button"
                onClick={() => setSortBy("recent")}
                className={[
                  "rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors",
                  sortBy === "recent"
                    ? "bg-brand text-brand-foreground shadow-sm"
                    : "text-muted hover:text-foreground",
                ].join(" ")}
              >
                Recent
              </button>
              <button
                type="button"
                onClick={() => setSortBy("top")}
                className={[
                  "rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors",
                  sortBy === "top"
                    ? "bg-brand text-brand-foreground shadow-sm"
                    : "text-muted hover:text-foreground",
                ].join(" ")}
              >
                Top posts
              </button>
            </div>
          </div>
          <ul className="mt-4 space-y-3">
            {orderedMedia.map((m) => (
              <li
                key={m.id}
                className="flex gap-4 rounded-xl border border-card-border bg-input p-4"
              >
                <div className="size-20 shrink-0 overflow-hidden rounded-lg border border-card-border bg-muted/30">
                  {m.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.thumbnailUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex size-full items-center justify-center text-[10px] font-bold uppercase tracking-wider text-muted"
                      aria-hidden
                    >
                      IG
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-muted-strong">
                    {m.caption
                      ? truncateCaption(m.caption, 100)
                      : "No caption"}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted">
                    <span>
                      <span className="font-semibold text-foreground">
                        {m.likes.toLocaleString()}
                      </span>{" "}
                      likes
                    </span>
                    <span>
                      <span className="font-semibold text-foreground">
                        {m.comments.toLocaleString()}
                      </span>{" "}
                      comments
                    </span>
                    {(() => {
                      const pct = engagementPct(
                        m.likes,
                        m.comments,
                        followers
                      );
                      if (pct === null) {
                        return (
                          <span className="inline-flex rounded-full bg-input px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted ring-1 ring-card-border">
                            Engagement —
                          </span>
                        );
                      }
                      const rounded = Math.round(pct * 10) / 10;
                      return (
                        <span
                          className={[
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                            engagementBadgeClasses(pct),
                          ].join(" ")}
                        >
                          {rounded.toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 1,
                          })}
                          % engagement
                        </span>
                      );
                    })()}
                    <span>
                      <span className="font-semibold text-foreground">
                        {m.impressions === null
                          ? "—"
                          : m.impressions.toLocaleString()}
                      </span>{" "}
                      impressions
                    </span>
                    <span>
                      <span className="font-semibold text-foreground">
                        {m.reach === null ? "—" : m.reach.toLocaleString()}
                      </span>{" "}
                      reach
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {bestTimeLine ? (
            <div className="mt-6 rounded-xl border border-card-border bg-input p-5">
              <h4 className="text-xs font-bold uppercase tracking-widest text-brand">
                Best time to post
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-muted-strong">
                {bestTimeLine}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
