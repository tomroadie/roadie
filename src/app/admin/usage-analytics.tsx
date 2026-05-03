"use client";

import { useMemo } from "react";

export type UsageAnalyticsRecentEvent = {
  event_type: string;
  created_at: string;
  artist_id: string;
};

function formatTimeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function truncateArtistId(id: string): string {
  const s = id.trim();
  if (s.length <= 10) return s || "—";
  return `${s.slice(0, 8)}…`;
}

const STAT_KEYS = [
  { key: "plan_generated", label: "Plans generated" },
  { key: "audit_started", label: "Audits started" },
  { key: "audit_completed", label: "Audits completed" },
] as const;

export function UsageAnalytics({
  totalCounts,
  recentEvents,
}: {
  totalCounts: Record<string, number>;
  recentEvents: UsageAnalyticsRecentEvent[];
}) {
  const top10 = useMemo(() => recentEvents.slice(0, 10), [recentEvents]);

  return (
    <section className="mt-6 space-y-5 rounded-xl border border-card-border bg-card p-7 shadow-sm">
      <div>
        <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
          Usage Analytics
        </h2>
        <p className="mt-1 text-sm text-muted">
          Totals across all events; recent activity from the last 7 days.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STAT_KEYS.map(({ key, label }) => (
          <div
            key={key}
            className="rounded-lg border border-card-border bg-input px-4 py-4 shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-brand">{label}</p>
            <p className="mt-2 text-3xl font-black tabular-nums text-foreground">
              {totalCounts[key] ?? 0}
            </p>
            <p className="mt-1 font-mono text-[11px] text-muted">{key}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-card-border bg-input p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-brand">Recent events</p>
        <p className="mt-0.5 text-xs text-muted">10 most recent (last 7 days sample)</p>
        {top10.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No events in the last 7 days.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[#1a1a1a]">
            {top10.map((ev, i) => (
              <li
                key={`${ev.created_at}-${ev.artist_id}-${i}`}
                className="flex flex-col gap-1 py-3 text-sm first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <span className="font-semibold text-foreground">{ev.event_type}</span>
                <span
                  className="font-mono text-xs text-muted-strong sm:text-center"
                  title={ev.artist_id}
                >
                  {truncateArtistId(ev.artist_id)}
                </span>
                <span className="text-xs text-muted sm:whitespace-nowrap sm:text-right">
                  {formatTimeAgo(ev.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
