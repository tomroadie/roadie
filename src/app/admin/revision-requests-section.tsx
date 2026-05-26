"use client";

import { useMemo, useState } from "react";
import type { ContentIdea } from "@/types/content-plan";
import { normalizeIdeasFromDb } from "@/lib/parse-ideas-json";

export type RevisionRequestRow = {
  id: string;
  artist_id: string;
  week_start: string;
  artist_note: string;
  created_at: string;
  weekly_plan_id: string | null;
  plan_ideas: unknown;
};

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffMs = Date.now() - t;
  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function formatWeekStart(weekStart: string): string {
  const d = new Date(`${weekStart}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return weekStart;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function RevisionRequestsSection({
  requests,
  artistNames,
}: {
  requests: RevisionRequestRow[];
  artistNames: Record<string, string>;
}) {
  const [rows, setRows] = useState(requests);
  const [activeAction, setActiveAction] = useState<{
    id: string;
    action: "approved" | "declined";
  } | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const count = rows.length;

  const sortedRows = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    [rows]
  );

  async function confirmAction(requestId: string, action: "approved" | "declined") {
    setError(null);
    setSubmittingId(requestId);
    try {
      const res = await fetch("/api/admin/action-revision", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: requestId,
          action,
          admin_note: adminNote.trim() || undefined,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: string;
      };

      if (!res.ok) {
        setError(
          data.details
            ? `${data.error ?? "Request failed"}: ${data.details}`
            : (data.error ?? "Could not action revision request.")
        );
        return;
      }

      setRows((prev) => prev.filter((row) => row.id !== requestId));
      setActiveAction(null);
      setAdminNote("");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <section className="mt-10 rounded-xl border border-card-border bg-card p-6">
      <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
        Revision Requests{count > 0 ? ` (${count})` : ""}
      </h2>

      {count === 0 ? (
        <p className="mt-4 text-sm text-muted">No pending revision requests.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-6">
          {sortedRows.map((row) => {
            const artistName =
              artistNames[row.artist_id]?.trim() || "Unknown artist";
            const ideas = normalizeIdeasFromDb(row.plan_ideas) ?? [];
            const isActive = activeAction?.id === row.id;
            const isSubmitting = submittingId === row.id;

            return (
              <li
                key={row.id}
                className="rounded-xl border border-card-border bg-input p-5"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {artistName}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Week of {formatWeekStart(row.week_start)} ·{" "}
                      {formatRelativeTime(row.created_at)}
                    </p>
                  </div>
                </div>

                <blockquote className="mt-4 border-l-2 border-brand/40 pl-4 text-sm leading-relaxed text-muted-strong">
                  {row.artist_note}
                </blockquote>

                {ideas.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Current plan hooks
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-muted">
                      {ideas.map((idea: ContentIdea, index) => (
                        <li key={`${idea.hook}-${index}`}>
                          <span className="font-medium text-foreground">
                            {idea.format}:
                          </span>{" "}
                          {idea.hook}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {isActive ? (
                  <div className="mt-4">
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                        Optional note to artist
                      </span>
                      <textarea
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                        rows={2}
                        maxLength={500}
                        placeholder="Optional message if declining"
                        className="mt-1.5 w-full rounded-lg border border-card-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted"
                      />
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() =>
                          void confirmAction(row.id, activeAction.action)
                        }
                        className="inline-flex h-9 items-center justify-center rounded-lg bg-brand px-4 text-xs font-black uppercase tracking-wide text-brand-foreground transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSubmitting ? "Saving…" : "Confirm"}
                      </button>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => {
                          setActiveAction(null);
                          setAdminNote("");
                        }}
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-card-border bg-transparent px-4 text-xs font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => {
                        setActiveAction({ id: row.id, action: "approved" });
                        setAdminNote("");
                        setError(null);
                      }}
                      className="inline-flex h-9 items-center justify-center rounded-lg bg-brand px-4 text-xs font-black uppercase tracking-wide text-brand-foreground transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => {
                        setActiveAction({ id: row.id, action: "declined" });
                        setAdminNote("");
                        setError(null);
                      }}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-card-border bg-transparent px-4 text-xs font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error ? (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
