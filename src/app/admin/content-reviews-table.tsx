"use client";

import { useMemo, useState } from "react";

export type ContentReviewQueueRow = {
  id: string;
  artist_id: string;
  owner_user_id: string;
  idea_hook: string;
  idea_format: string;
  idea_caption: string;
  notes: string;
  status: string;
  feedback: string;
  created_at: string;
  file_urls?: string[] | null;
};

function formatSubmittedLabel(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(text: string, max: number): string {
  const t = String(text ?? "").trim().replace(/\s+/g, " ");
  if (!t) return "—";
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i.test(url);
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|m4v|mkv)(\?.*)?$/i.test(url);
}

function filenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop() ?? "";
    return decodeURIComponent(last) || url;
  } catch {
    const last = url.split("?")[0]?.split("#")[0]?.split("/").filter(Boolean).pop() ?? "";
    return last || url;
  }
}

export function ContentReviewsTable({
  reviews,
  artistNames,
}: {
  reviews: ContentReviewQueueRow[];
  artistNames: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState<null | string>(null);
  const [draftById, setDraftById] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<null | string>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(() => new Set());

  const sorted = useMemo(() => reviews, [reviews]);

  async function sendFeedback(id: string) {
    setError(null);
    const feedback = (draftById[id] ?? "").trim();
    if (!feedback) {
      setError("Feedback cannot be empty.");
      return;
    }
    setSendingId(id);
    try {
      const res = await fetch("/api/content-reviews", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, feedback }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          details?: string;
        };
        setError(
          data.details
            ? `${data.error ?? "Request failed"}: ${data.details}`
            : (data.error ?? "Could not send feedback.")
        );
        return;
      }
      setReviewedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      setExpanded(null);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSendingId((prev) => (prev === id ? null : prev));
    }
  }

  return (
    <section className="mt-10 rounded-xl border border-card-border bg-card p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
            Content reviews
          </h2>
          <p className="mt-1 text-sm text-muted">Latest 20 submitted requests.</p>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-xs font-bold uppercase tracking-widest text-muted">
              <th className="border-b border-card-border px-3 py-3">Artist</th>
              <th className="border-b border-card-border px-3 py-3">Idea</th>
              <th className="border-b border-card-border px-3 py-3">Submitted</th>
              <th className="border-b border-card-border px-3 py-3">Status</th>
              <th className="border-b border-card-border px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const isExpanded = expanded === r.id;
              const isReviewed = reviewedIds.has(r.id) || r.status === "reviewed";
              const busy = sendingId === r.id;
              const fileUrls = Array.isArray(r.file_urls)
                ? r.file_urls.map((u) => String(u ?? "").trim()).filter(Boolean)
                : [];
              return (
                <tr key={r.id} className="align-top">
                  <td className="border-b border-card-border px-3 py-4 text-sm font-semibold text-foreground">
                    {artistNames[r.artist_id] ?? "Unknown artist"}
                  </td>
                  <td className="border-b border-card-border px-3 py-4 text-sm text-muted-strong">
                    <div className="font-semibold text-foreground">
                      {truncate(r.idea_hook, 90)}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {truncate(r.idea_caption, 120)}
                    </div>
                    {fileUrls.length ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {fileUrls.map((url) => {
                          if (isVideoUrl(url) || /video/i.test(url)) {
                            return (
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-7 items-center rounded-md bg-brand px-2.5 text-xs font-black uppercase tracking-wide text-brand-foreground hover:opacity-90"
                                title={filenameFromUrl(url)}
                              >
                                ▶ Watch video
                              </a>
                            );
                          }

                          if (isImageUrl(url)) {
                            return (
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="group relative inline-flex h-12 w-12 overflow-hidden rounded-lg border border-card-border bg-black/20"
                                title={filenameFromUrl(url)}
                              >
                                <img
                                  src={url}
                                  alt={filenameFromUrl(url)}
                                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                  loading="lazy"
                                />
                              </a>
                            );
                          }

                          return (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-7 items-center rounded-md border border-card-border bg-transparent px-2.5 text-xs font-semibold text-foreground hover:border-brand"
                              title={filenameFromUrl(url)}
                            >
                              View file
                            </a>
                          );
                        })}
                      </div>
                    ) : null}
                    {isExpanded ? (
                      <div className="mt-3">
                        <textarea
                          value={draftById[r.id] ?? ""}
                          onChange={(e) =>
                            setDraftById((prev) => ({ ...prev, [r.id]: e.target.value }))
                          }
                          placeholder="Write feedback…"
                          className="min-h-[96px] w-full resize-y rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted"
                        />
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => void sendFeedback(r.id)}
                            disabled={busy}
                            className="inline-flex h-9 items-center justify-center rounded-lg bg-brand px-4 text-xs font-black uppercase tracking-wide text-brand-foreground disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busy ? "Sending…" : "Send feedback"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpanded(null)}
                            className="text-xs font-semibold uppercase tracking-wide text-muted hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </td>
                  <td className="border-b border-card-border px-3 py-4 text-sm text-muted">
                    {formatSubmittedLabel(r.created_at)}
                  </td>
                  <td className="border-b border-card-border px-3 py-4 text-sm">
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ring-1 ring-inset",
                        isReviewed
                          ? "bg-emerald-500/10 text-emerald-300 ring-emerald-400/20"
                          : "bg-amber-500/10 text-amber-200 ring-amber-400/20",
                      ].join(" ")}
                    >
                      {isReviewed ? "Reviewed" : (r.status || "Pending")}
                    </span>
                  </td>
                  <td className="border-b border-card-border px-3 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setExpanded((prev) => (prev === r.id ? null : r.id))}
                      disabled={isReviewed}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-card-border bg-transparent px-3 text-xs font-bold uppercase tracking-wide text-foreground transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Give feedback
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

