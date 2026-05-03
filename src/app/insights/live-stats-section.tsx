"use client";

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
};

function truncateCaption(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

export function LiveStatsSection({
  insights,
  media,
}: {
  insights: InstagramLiveInsightRow[];
  media: InstagramLiveMediaRow[];
}) {
  const showStatsCards = insights.length > 0;

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
          <h3
            className={[
              "text-sm font-bold uppercase tracking-tight text-foreground",
              !showStatsCards ? "mt-5" : "",
            ].join(" ")}
          >
            Recent posts
          </h3>
          <ul className="mt-4 space-y-3">
            {media.map((m) => (
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
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
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
        </div>
      ) : null}
    </div>
  );
}
