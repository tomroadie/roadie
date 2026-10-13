"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type DateSuggestion = {
  id: string;
  title: string;
  /** Null when the post announced it without a day. */
  eventDate: string | null;
  excerpt: string | null;
};

function dayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * Dates Tempo spotted in their captions or tour page: add to their dates, or
 * not. With more than one waiting, "Add all" adds every one that has a date.
 * total and datedTotal are how many are waiting in all, when only some are shown.
 */
export function DateSuggestions({
  suggestions,
  artistId,
  total,
  datedTotal,
  heading = "Spotted in your posts",
}: {
  suggestions: DateSuggestion[];
  artistId?: string;
  total?: number;
  /** How many waiting have a date (what "Add all" adds). */
  datedTotal?: number;
  heading?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Record<string, string>>({});

  async function addAll() {
    if (!artistId) return;
    setBusy("all");
    setError(null);
    try {
      const res = await fetch("/api/date-suggestions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "accept_all", artistId }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? "Something went wrong");
      }
      setGone(new Set(suggestions.filter((s) => s.eventDate).map((s) => s.id)));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function resolve(id: string, action: "accept" | "dismiss", date?: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/date-suggestions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action, date }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? "Something went wrong");
      }
      setGone((g) => new Set(g).add(id));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const shown = suggestions.filter((s) => !gone.has(s.id));
  if (shown.length === 0) return null;
  const goneDated = suggestions.filter((s) => gone.has(s.id) && s.eventDate).length;
  const waiting = Math.max(total ?? 0, suggestions.length) - gone.size;
  const allCount = Math.max(datedTotal ?? 0, suggestions.filter((s) => s.eventDate).length) - goneDated;

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-card-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          {heading}
          {waiting > shown.length ? <span className="font-normal text-muted"> · {waiting} waiting</span> : null}
        </p>
        {artistId && allCount > 1 ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={addAll}
            className="min-h-10 rounded-lg border border-card-border px-3 text-sm font-semibold text-foreground hover:bg-background disabled:opacity-50"
          >
            {busy === "all" ? "Adding…" : `Add all ${allCount}`}
          </button>
        ) : null}
      </div>
      <ul className="flex flex-col gap-2">
        {shown.map((s) => {
          const date = s.eventDate ?? picked[s.id] ?? "";
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-background p-3">
              <div className="min-w-0 flex-[1_1_200px]">
                <p className="text-sm">
                  {s.eventDate ? <span className="text-muted">{dayLabel(s.eventDate)}</span> : null}{" "}
                  <span className="font-semibold text-foreground">{s.title}</span>
                  {s.eventDate ? null : <span className="text-muted"> &ndash; when is it?</span>}
                </p>
                {s.excerpt ? <p className="truncate text-xs text-muted">&ldquo;{s.excerpt}&rdquo;</p> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {s.eventDate ? null : (
                  <label className="flex items-center">
                    <span className="sr-only">Date for {s.title}</span>
                    <input
                      type="date"
                      value={picked[s.id] ?? ""}
                      onChange={(e) => setPicked((p) => ({ ...p, [s.id]: e.target.value }))}
                      className="min-h-10 rounded-lg border border-card-border bg-card px-2 text-sm text-foreground"
                    />
                  </label>
                )}
                <button
                  type="button"
                  disabled={busy === s.id || !date}
                  onClick={() => resolve(s.id, "accept", s.eventDate ? undefined : date)}
                  className="min-h-10 rounded-lg bg-ink px-3 text-sm font-semibold text-ink-foreground hover:opacity-90 disabled:opacity-50"
                >
                  Add date
                </button>
                <button
                  type="button"
                  disabled={busy === s.id}
                  onClick={() => resolve(s.id, "dismiss")}
                  className="min-h-10 px-2 text-sm font-semibold text-muted hover:text-foreground disabled:opacity-50"
                >
                  Not right
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-red-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
