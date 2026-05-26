"use client";

import { useState } from "react";

export function CheckinForm({
  artistId,
  token,
}: {
  artistId: string;
  token: string;
}) {
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || submitted) return;

    const trimmed = response.trim();
    if (!trimmed) {
      setError("Please tell us what's happening next week.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artist_id: artistId,
          token,
          response: trimmed,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          details?: string;
        };
        setError(
          data.details
            ? `${data.error ?? "Request failed"}: ${data.details}`
            : (data.error ?? "Could not submit. Try again.")
        );
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
        <p className="text-base font-semibold text-emerald-200">
          Thanks — we&apos;ll factor this into your plan.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <label className="block">
        <span className="text-sm font-semibold text-foreground">
          What&apos;s happening next week?
        </span>
        <textarea
          rows={6}
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Show on Friday, new single dropping, studio day with…"
          className="mt-2 w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted"
        />
      </label>

      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-brand px-5 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Submit"}
      </button>
    </form>
  );
}
