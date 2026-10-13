"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const FIELDS = [
  { key: "coming_up", label: "What's coming up?", hint: "Gigs, releases, sessions, anything with a date" },
  { key: "unposted", label: "Anything you've made but not posted?", hint: "Clips, photos, demos sitting on your phone" },
  { key: "want_to_post", label: "Anything you want to post about?", hint: "Something on your mind this week" },
] as const;

type Key = (typeof FIELDS)[number]["key"];

/** The Monday check-in: three optional prompts that shape this week's ideas. */
export function WeekCheckin({ artistId }: { artistId: string }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<Key, string>>({ coming_up: "", unposted: "", want_to_post: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | "saved" | "skipped">(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function send(skip: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/week-notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ artist_id: artistId, skip, ...values }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; refreshing?: boolean };
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      setDone(skip ? "skipped" : "saved");
      if (json.refreshing) setTimeout(() => router.refresh(), 90000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (done === "skipped") return null;
  if (done === "saved") {
    return (
      <section className="rounded-2xl bg-brand-soft p-5 text-sm text-foreground">
        Thanks. Your ideas for this week are being redrawn around that. They&rsquo;ll show up here in a minute or two.
      </section>
    );
  }

  const empty = !values.coming_up.trim() && !values.unposted.trim() && !values.want_to_post.trim();

  // Closed by default: one line that opens into the three prompts.
  if (!open) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-card-border bg-card px-5 py-3">
        <p className="text-sm text-foreground">
          <span className="font-semibold">Anything going on this week?</span>{" "}
          <span className="text-muted">Tell Tempo and this week&rsquo;s ideas are redrawn around it.</span>
        </p>
        <button
          type="button"
          aria-expanded={false}
          onClick={() => setOpen(true)}
          className="min-h-10 rounded-lg border border-card-border px-3 text-sm font-semibold text-foreground hover:bg-background"
        >
          Add something
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="checkin-heading" className="flex flex-col gap-4 rounded-2xl border border-card-border bg-card p-5">
      <div className="space-y-1">
        <h2 id="checkin-heading" className="text-xl font-bold text-foreground">
          What&rsquo;s going on this week?
        </h2>
        <p className="text-sm text-muted">All optional. Anything you add shapes this week&rsquo;s ideas.</p>
      </div>
      {FIELDS.map((f) => (
        <label key={f.key} className="flex flex-col gap-1 text-sm font-semibold text-foreground">
          {f.label}
          <textarea
            value={values[f.key]}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            maxLength={600}
            rows={2}
            placeholder={f.hint}
            className="rounded-lg border border-card-border bg-background px-3 py-2 font-normal"
          />
        </label>
      ))}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || empty}
          onClick={() => send(false)}
          className="min-h-11 rounded-xl bg-ink px-4 text-sm font-semibold text-ink-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Shape my ideas"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => send(true)}
          className="min-h-11 px-3 text-sm font-semibold text-muted hover:text-foreground"
        >
          Not this week
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-red-800">
          {error}
        </p>
      ) : null}
    </section>
  );
}
