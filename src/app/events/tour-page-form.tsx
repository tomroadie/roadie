"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function readOn(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
}

/**
 * The act's website (or a venue's what's-on page). Saving reads it
 * straight away; after that Tempo reads it once a week.
 */
export function TourPageForm({
  artistId,
  url,
  status,
  checkedAt,
  found,
  note,
  hasBandsintownKey,
}: {
  artistId: string;
  url: string | null;
  status: "ok" | "failed" | null;
  checkedAt: string | null;
  found: number | null;
  /** What Tempo couldn't read, e.g. a Bandsintown widget. */
  note: string | null;
  hasBandsintownKey: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(url ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(!url);
  const [bitKey, setBitKey] = useState("");

  async function save(next: string) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/tour-page", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ artistId, url: next, ...(bitKey.trim() ? { bandsintown_key: bitKey } : {}) }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        status?: "ok" | "failed" | null;
        found?: number;
        added?: number;
        note?: string | null;
      };
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      if (next.trim() && json.status !== "failed" && !json.note) setOpen(false);
      if (!next.trim()) setMessage("Removed.");
      else if (json.status === "failed") setError("Couldn't open that site. Check the address.");
      else if (json.note && (json.found ?? 0) === 0) setError(json.note);
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

  // Once set, it shrinks to one line.
  if (url && !open) {
    let host = url;
    try {
      host = new URL(url).hostname.replace(/^www\./, "") + new URL(url).pathname.replace(/\/$/, "");
    } catch {}
    const summary =
      message ??
      (checkedAt
        ? status === "failed"
          ? `couldn't read it on ${readOn(checkedAt)}`
          : `read ${readOn(checkedAt)}, ${found ?? 0} upcoming`
        : "not read yet");
    return (
      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-card-border bg-card px-4 py-2 text-sm">
        <span className="font-semibold text-foreground">Website</span>
        <a href={url} target="_blank" rel="noopener noreferrer" className="truncate text-brand hover:underline">
          {host}
        </a>
        <span className={status === "failed" && !message ? "text-red-800" : "text-muted"} aria-live="polite">
          {saving ? "reading…" : summary}
        </span>
        <span className="ml-auto flex gap-1">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save(url)}
            className="min-h-9 px-2 font-semibold text-foreground hover:underline disabled:opacity-50"
          >
            Read again
          </button>
          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setOpen(true);
            }}
            className="min-h-9 px-2 font-semibold text-muted hover:text-foreground"
          >
            Change
          </button>
        </span>
      </div>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-card-border bg-card p-5">
      <h2 className="text-lg font-bold text-foreground">
        Your website <span className="text-sm font-normal text-muted">(optional)</span>
      </h2>
      <p className="mt-1 text-sm text-muted">
        Tempo reads it every week for shows and releases and offers any new dates to add. It also helps your ideas know what you&rsquo;re about.
      </p>
      {note ? <p className="mt-2 text-sm font-semibold text-amber-900">{note}</p> : null}
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save(value);
        }}
      >
        <label htmlFor="tour-page" className="sr-only">
          Website
        </label>
        <input
          id="tour-page"
          type="text"
          inputMode="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. yourband.com"
          className="min-h-10 min-w-0 flex-[1_1_260px] rounded-lg border border-card-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        {note?.includes("Bandsintown") || hasBandsintownKey ? (
          <input
            type="text"
            value={bitKey}
            onChange={(e) => setBitKey(e.target.value)}
            aria-label="Bandsintown API key"
            placeholder={hasBandsintownKey ? "Bandsintown key saved (paste a new one to change)" : "Bandsintown API key: Bandsintown for Artists › Settings › General › Get API Key"}
            className="min-h-10 w-full rounded-lg border border-card-border bg-background px-3 text-sm outline-none placeholder:text-muted focus:border-brand"
          />
        ) : null}
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
              setValue(url);
              setError(null);
              setOpen(false);
            }}
            className="min-h-10 px-2 text-sm font-semibold text-muted hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
        ) : null}
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
