"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type DateSuggestion = {
  id: string;
  title: string;
  eventDate: string;
  excerpt: string | null;
};

function dayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Dates Tempo spotted in their captions: add to their dates, or not. */
export function DateSuggestions({ suggestions }: { suggestions: DateSuggestion[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());

  async function resolve(id: string, action: "accept" | "dismiss") {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/date-suggestions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
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

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-card-border pt-4">
      <p className="text-sm font-semibold text-foreground">Spotted in your posts</p>
      <ul className="flex flex-col gap-2">
        {shown.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-background p-3">
            <div className="min-w-0 flex-[1_1_200px]">
              <p className="text-sm">
                <span className="text-muted">{dayLabel(s.eventDate)}</span>{" "}
                <span className="font-semibold text-foreground">{s.title}</span>
              </p>
              {s.excerpt ? <p className="truncate text-xs text-muted">&ldquo;{s.excerpt}&rdquo;</p> : null}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy === s.id}
                onClick={() => resolve(s.id, "accept")}
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
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-red-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
