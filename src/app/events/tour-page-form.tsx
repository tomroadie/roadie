"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function readOn(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
}

/**
 * The act's tour page (or a venue's what's-on page). Saving reads it
 * straight away; after that Tempo reads it once a week.
 */
export function TourPageForm({
  artistId,
  url,
  status,
  checkedAt,
  found,
}: {
  artistId: string;
  url: string | null;
  status: "ok" | "failed" | null;
  checkedAt: string | null;
  found: number | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(url ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(next: string) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/tour-page", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ artistId, url: next }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        status?: "ok" | "failed" | null;
        found?: number;
        added?: number;
      };
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      if (!next.trim()) setMessage("Removed.");
      else if (json.status === "failed") setError("Couldn't read that page. If the dates load in a widget, try your Songkick or Bandsintown page instead.");
      else if ((json.found ?? 0) === 0) setMessage("Read it, but found no upcoming dates.");
      else
        setMessage(
          `Found ${json.found} upcoming ${json.found === 1 ? "date" : "dates"}${
            json.added ? `, ${json.added} new to add below` : ", all already in your dates"
          }.`
        );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-card-border bg-card p-5">
      <h2 className="text-lg font-bold text-foreground">Your tour page</h2>
      <p className="mt-1 text-sm text-muted">
        The page that lists your upcoming dates. Tempo reads it every week and offers any new ones to add.
      </p>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save(value);
        }}
      >
        <label htmlFor="tour-page" className="sr-only">
          Tour page link
        </label>
        <input
          id="tour-page"
          type="text"
          inputMode="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. yourband.com/tour, or your Songkick page"
          className="min-h-10 min-w-0 flex-[1_1_260px] rounded-lg border border-card-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <button
          type="submit"
          disabled={saving}
          className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-ink-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Reading…" : url && value.trim() === url ? "Read again" : "Save"}
        </button>
        {url ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setValue("");
              void save("");
            }}
            className="min-h-10 px-2 text-sm font-semibold text-muted hover:text-foreground disabled:opacity-50"
          >
            Remove
          </button>
        ) : null}
      </form>
      <div aria-live="polite" className="mt-2 text-sm">
        {error ? (
          <p className="font-semibold text-red-800">{error}</p>
        ) : message ? (
          <p className="text-foreground">{message}</p>
        ) : url && checkedAt ? (
          <p className="text-muted">
            {status === "failed"
              ? `Couldn't read it on ${readOn(checkedAt)}.`
              : `Last read ${readOn(checkedAt)}: ${found ?? 0} upcoming ${found === 1 ? "date" : "dates"}.`}
          </p>
        ) : null}
      </div>
    </section>
  );
}
