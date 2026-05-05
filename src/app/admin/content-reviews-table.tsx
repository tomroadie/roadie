"use client";

import { useMemo, useState } from "react";

export type ContentReviewQueueRow = {
  id: string;
  artist_id: string;
  owner_user_id: string;
  idea_hook: string;
  idea_format: string;
  idea_caption: string;
  idea_why: string | null;
  idea_timing: string | null;
  notes: string;
  status: string;
  feedback: string;
  created_at: string;
  file_urls: string[] | null;
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

function parseSubmittedFiles(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v ?? "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v ?? "").trim()).filter(Boolean);
      }
    } catch {
      // treat as a single URL
    }
    return [raw];
  }
  return [];
}

export function ContentReviewsTable({
  reviews,
  artistNames,
}: {
  reviews: ContentReviewQueueRow[];
  artistNames: Record<string, string>;
}) {
  const [expandedId, setExpandedId] = useState<null | string>(null);
  const [localReviews, setLocalReviews] = useState<ContentReviewQueueRow[]>(() => reviews);
  const [draftById, setDraftById] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<null | string>(null);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => localReviews, [localReviews]);
  const expandedRow = useMemo(
    () => (expandedId ? localReviews.find((r) => r.id === expandedId) ?? null : null),
    [expandedId, localReviews]
  );

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
      setLocalReviews((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "reviewed", feedback } : r))
      );
      setExpandedId(null);
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
              <th className="border-b border-card-border px-3 py-3 text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const isExpanded = expandedId === r.id;
              const isReviewed = r.status === "reviewed";
              const busy = sendingId === r.id;
              const fileUrls = parseSubmittedFiles(r.file_urls as unknown);
              return (
                <>
                  <tr
                    key={r.id}
                    className={[
                      "align-top transition-colors",
                      isExpanded ? "bg-white/2" : "hover:bg-white/2",
                      isReviewed ? "cursor-default" : "cursor-pointer",
                    ].join(" ")}
                    onClick={() =>
                      setExpandedId((prev) => (prev === r.id ? null : r.id))
                    }
                  >
                    <td className="border-b border-card-border px-3 py-4 text-sm font-semibold text-foreground">
                      {artistNames[r.artist_id] ?? "Unknown artist"}
                    </td>
                    <td className="border-b border-card-border px-3 py-4 text-sm text-muted-strong">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground">
                            {truncate(r.idea_hook, 90)}
                          </div>
                          <div className="mt-1 text-xs text-muted">
                            {truncate(r.idea_caption, 120)}
                          </div>
                        </div>
                      </div>
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
                        {isReviewed ? "Reviewed" : "Pending"}
                      </span>
                    </td>
                    <td className="border-b border-card-border px-3 py-4 text-right text-sm text-muted">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-card-border bg-transparent text-foreground">
                        {isExpanded ? "▲" : "▼"}
                      </span>
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr className="align-top">
                      <td
                        className="border-b border-card-border px-3 py-4"
                        colSpan={5}
                      >
                        <div className="grid gap-4 rounded-xl border border-card-border bg-input/30 p-4">
                          <div>
                            <div className="text-xs font-bold uppercase tracking-widest text-muted">
                              Full idea details
                            </div>
                            <div className="mt-3 grid gap-2 text-sm">
                              {[
                                ["Format", r.idea_format],
                                ["Hook", r.idea_hook],
                                ["Caption", r.idea_caption],
                                ["Why", r.idea_why],
                                ["Timing", r.idea_timing],
                              ].map(([label, value]) => (
                                <div
                                  key={label}
                                  className="grid gap-1 rounded-lg border border-card-border bg-card/40 p-3 md:grid-cols-[140px_1fr]"
                                >
                                  <div className="text-xs font-bold uppercase tracking-widest text-muted">
                                    {label}
                                  </div>
                                  <div className="whitespace-pre-wrap text-foreground">
                                    {String(value ?? "—").trim() || "—"}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {String(r.notes ?? "").trim() ? (
                            <div>
                              <div className="text-xs font-bold uppercase tracking-widest text-muted">
                                Artist notes
                              </div>
                              <div className="mt-2 whitespace-pre-wrap rounded-lg border border-card-border bg-card/40 p-3 text-sm text-foreground">
                                {r.notes}
                              </div>
                            </div>
                          ) : null}

                          {fileUrls.length ? (
                            <div>
                              <div className="text-xs font-bold uppercase tracking-widest text-muted">
                                SUBMITTED FILES
                              </div>
                              <div className="mt-2 grid gap-3">
                                {fileUrls.map((value) => {
                                  const url = String(value ?? "").trim();
                                  const label = filenameFromUrl(url);

                                  if (!url) return null;

                                  if (/\.(mp4)(\?.*)?$/i.test(url) || /video/i.test(url)) {
                                    return (
                                      <video
                                        key={value}
                                        controls
                                        src={url}
                                        className="w-full max-h-64 rounded-lg mt-2"
                                      />
                                    );
                                  }

                                  if (/\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(url)) {
                                    return (
                                      <img
                                        key={value}
                                        src={url}
                                        className="max-h-64 rounded-lg mt-2"
                                        alt={label}
                                        loading="lazy"
                                      />
                                    );
                                  }

                                  return (
                                    <a
                                      key={value}
                                      href={url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-brand underline"
                                    >
                                      Download file
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}

                          <div>
                            <div className="text-xs font-bold uppercase tracking-widest text-muted">
                              Feedback
                            </div>
                            <textarea
                              value={draftById[r.id] ?? ""}
                              onChange={(e) =>
                                setDraftById((prev) => ({ ...prev, [r.id]: e.target.value }))
                              }
                              placeholder="Write feedback…"
                              className="mt-2 min-h-[110px] w-full resize-y rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted"
                            />
                            <div className="mt-3 flex items-center justify-between gap-3">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void sendFeedback(r.id);
                                }}
                                disabled={busy}
                                className="inline-flex h-9 items-center justify-center rounded-lg bg-brand px-4 text-xs font-black uppercase tracking-wide text-brand-foreground disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {busy ? "Sending…" : "Send feedback"}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedId(null);
                                }}
                                className="text-xs font-semibold uppercase tracking-wide text-muted hover:text-foreground"
                              >
                                Close
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </>
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

