"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WeekRow } from "@/lib/admin-week";
import { DraftReview } from "./draft-review";

function when(iso: string): string {
  const ms = Date.parse(iso) - Date.now();
  const h = Math.round(Math.abs(ms) / 3600000);
  if (ms <= 0) return "due now";
  return h < 1 ? "in under an hour" : h < 48 ? `in ${h} h` : `in ${Math.round(h / 24)} days`;
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
}

/**
 * Every live artist's week in one list. Drafted weeks can be read and fixed
 * here before they publish themselves, held, or sent now.
 */
export function ThisWeek({ rows }: { rows: WeekRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(rows.find((r) => r.draft)?.artistId ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(url: string, body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setError(json.error ?? `Request failed (${res.status})`);
    }
    setBusy(null);
    router.refresh();
  }

  const waiting = rows.filter((r) => r.draft).length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        {waiting > 0
          ? `${waiting} ${waiting === 1 ? "week is" : "weeks are"} drafted and waiting. Read them, fix anything weak, then publish or let them go out on their own.`
          : "No weeks waiting. New weeks are drafted on each artist's first day of the week."}
      </p>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-red-800">
          {error}
        </p>
      ) : null}
      <ul className="divide-y divide-card-border rounded-2xl border border-card-border bg-card">
        {rows.map((r) => {
          const d = r.draft;
          const isOpen = open === r.artistId && d;
          return (
            <li key={r.artistId} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-0 flex-[1_1_240px]">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{r.artistName}</span>
                    {d ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${d.held ? "bg-amber-500/15 text-amber-900" : "bg-sky-500/15 text-sky-900"}`}>
                        {d.held ? "Held" : d.publishesAt ? `Publishes ${when(d.publishesAt)}` : "Draft, publishes when you say"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">Live</span>
                    )}
                    {r.quiet ? <span className="rounded-full bg-input px-2 py-0.5 text-xs font-semibold text-muted-strong">Quiet week</span> : null}
                  </p>
                  <p className="text-sm text-muted">
                    {r.handle ? `@${r.handle} · ` : ""}
                    {r.posted} of {r.target ?? "?"} posted this week
                    {!d && r.liveSince ? ` · this board since ${day(r.liveSince)}` : ""}
                    {d ? ` · drafted ${day(d.createdAt)}` : ""}
                  </p>
                </div>
                {d ? (
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      aria-expanded={Boolean(isOpen)}
                      onClick={() => setOpen(isOpen ? null : r.artistId)}
                      className="min-h-9 rounded-lg border border-card-border px-3 text-sm font-semibold text-foreground hover:bg-background"
                    >
                      {isOpen ? "Close" : "Read"}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        void post("/api/admin/publish-concepts", { generation_id: d.generationId, notify: d.kind === "weekly" }, `pub:${r.artistId}`)
                      }
                      className="min-h-9 rounded-lg bg-ink px-3 text-sm font-semibold text-ink-foreground disabled:opacity-50"
                    >
                      {busy === `pub:${r.artistId}` ? "Publishing…" : "Publish now"}
                    </button>
                    {d.publishesAt ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void post("/api/admin/drafts", { generation_id: d.generationId, action: "hold", held: !d.held }, `hold:${r.artistId}`)}
                        className="min-h-9 px-2 text-sm font-semibold text-muted hover:text-foreground disabled:opacity-50"
                      >
                        {d.held ? "Release" : "Hold"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {isOpen ? (
                <div className="mt-3 rounded-xl bg-background p-4 text-sm">
                  <DraftReview
                    draft={{ generationId: d.generationId, createdAt: d.createdAt, focus: d.focus, ideas: d.ideas }}
                    onChanged={async () => router.refresh()}
                  />
                  {d.kind === "weekly" ? (
                    <p className="mt-3 text-xs text-muted">Publish now sends their &ldquo;Your week&rdquo; email, same as when it goes out on its own.</p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
        {rows.length === 0 ? <li className="px-4 py-6 text-sm text-muted">No live artists yet.</li> : null}
      </ul>
    </div>
  );
}
