"use client";

import { useState } from "react";

export function TikTokWaitlistSection({
  initialWaitlisted,
}: {
  initialWaitlisted: boolean;
}) {
  const [joining, setJoining] = useState(false);
  const [waitlisted, setWaitlisted] = useState(initialWaitlisted);
  const [error, setError] = useState<string | null>(null);

  async function handleWaitlist() {
    if (joining || waitlisted) return;
    setError(null);
    setJoining(true);
    try {
      const res = await fetch("/api/tiktok-waitlist", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not join waitlist.");
        return;
      }
      setWaitlisted(true);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-dashed border-amber-500/25 bg-card p-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-black uppercase tracking-tight text-foreground">
          TikTok
        </h2>
        <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-400">
          Coming soon
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-muted">
        Connect your TikTok Business account to get a separate TikTok-native
        content plan every week — built for how each platform actually works.
      </p>

      {waitlisted ? (
        <p className="mt-4 text-sm font-semibold text-brand">
          ✓ We&apos;ll notify you when TikTok launches.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => void handleWaitlist()}
          disabled={joining}
          className="mt-4 inline-flex h-9 items-center justify-center rounded-lg border border-brand/40 bg-brand/10 px-4 text-sm font-semibold text-brand transition-colors hover:bg-brand/20 disabled:opacity-50"
        >
          {joining ? "Joining..." : "Notify me when TikTok launches →"}
        </button>
      )}

      {error ? (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
