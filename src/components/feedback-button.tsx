"use client";

import { useState } from "react";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = message.trim();
    if (!trimmed || submitting) return;

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Could not send feedback.");
        return;
      }

      setSubmitted(true);
      setMessage("");
      setTimeout(() => {
        setSubmitted(false);
        setOpen(false);
      }, 2000);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {open ? (
        <div className="fixed bottom-20 right-6 z-50 w-80 rounded-xl border border-card-border bg-card p-5 shadow-xl">
          <p className="text-sm font-black uppercase tracking-wide text-foreground">
            Share feedback
          </p>
          <p className="mt-1 text-xs text-muted">
            Ideas, bugs, or anything on your mind.
          </p>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What's on your mind?"
            className="mt-3 w-full resize-none rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-brand focus:outline-none"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || !message.trim()}
              className="flex-1 rounded-lg bg-brand px-3 py-2 text-xs font-black uppercase tracking-wide text-brand-foreground hover:brightness-95 disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Send"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="rounded-lg border border-card-border bg-input px-3 py-2 text-xs font-semibold text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          {submitted ? (
            <p className="mt-2 text-xs text-brand">Thanks — received.</p>
          ) : null}
          {error ? (
            <p className="mt-2 text-xs text-red-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full border border-card-border bg-card px-4 py-2.5 text-xs font-semibold text-muted shadow-lg transition-all hover:border-brand/50 hover:text-foreground"
      >
        <span>💬</span>
        <span>Feedback</span>
      </button>
    </>
  );
}
