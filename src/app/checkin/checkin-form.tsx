"use client";

import Link from "next/link";
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
      setError("Please tell us what's on your radar.");
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
      <div className="text-center">
        <p className="text-2xl">✓</p>
        <h2 className="mt-3 text-xl font-black uppercase tracking-tight text-foreground">
          You&apos;re all set.
        </h2>
        <p className="mt-2 text-sm text-muted">
          Your check-in has been saved. Your content plan will be ready Monday
          morning.
        </p>
        <Link
          href="/home"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-brand px-5 text-sm font-black uppercase tracking-wide text-brand-foreground transition-colors hover:brightness-95"
        >
          Go to your dashboard →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <label className="block">
        <span className="text-sm font-semibold text-foreground">
          What&apos;s on your radar?
        </span>
        <textarea
          rows={6}
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Upcoming shows, releases in the pipeline, studio time, collabs — anything worth building content around."
          className="mt-2 w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted"
        />
      </label>

      <p className="text-xs text-muted mt-2">
        Doesn&apos;t have to be this week — tell us anything coming up that&apos;s
        worth building content around.
      </p>

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
