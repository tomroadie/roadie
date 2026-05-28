"use client";

import { useState } from "react";

type PreferenceType = "marketing" | "all";

function makeUnsubscribeToken(artistId: string, type: PreferenceType): string {
  return btoa(JSON.stringify({ artistId, type, ts: Date.now() }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function EmailPreferencesSection({
  artistId,
  initialMarketingUnsubscribed,
  initialAllEmailsPaused,
}: {
  artistId: string;
  initialMarketingUnsubscribed: boolean;
  initialAllEmailsPaused: boolean;
}) {
  const [marketingUnsubscribed, setMarketingUnsubscribed] = useState(
    initialMarketingUnsubscribed
  );
  const [allEmailsPaused, setAllEmailsPaused] = useState(
    initialAllEmailsPaused
  );
  const [loading, setLoading] = useState<PreferenceType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function togglePreference(type: PreferenceType) {
    setError(null);
    setLoading(type);

    const isCurrentlyOff =
      type === "marketing" ? marketingUnsubscribed : allEmailsPaused;

    if (type === "marketing") {
      setMarketingUnsubscribed(!isCurrentlyOff);
    } else {
      setAllEmailsPaused(!isCurrentlyOff);
    }

    try {
      if (isCurrentlyOff) {
        const res = await fetch("/api/email/resubscribe", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artistId, type }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? "Could not update preferences.");
        }
      } else {
        const token = makeUnsubscribeToken(artistId, type);
        const res = await fetch(
          `/api/email/unsubscribe?token=${encodeURIComponent(token)}`
        );

        if (!res.ok) {
          throw new Error("Could not update preferences.");
        }
      }
    } catch (e) {
      if (type === "marketing") {
        setMarketingUnsubscribed(isCurrentlyOff);
      } else {
        setAllEmailsPaused(isCurrentlyOff);
      }
      setError(e instanceof Error ? e.message : "Could not update preferences.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg font-black uppercase tracking-tight text-foreground">
        Email preferences
      </h2>

      <div className="mt-5 space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-card-border bg-card p-5">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Marketing emails
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Tips, updates, and content ideas to help you grow
            </p>
          </div>
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => void togglePreference("marketing")}
            className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-60 ${
              !marketingUnsubscribed
                ? "bg-brand text-brand-foreground"
                : "bg-input text-muted"
            }`}
          >
            {loading === "marketing"
              ? "…"
              : marketingUnsubscribed
                ? "Off"
                : "On"}
          </button>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-card-border bg-card p-5">
          <div>
            <p className="text-sm font-semibold text-foreground">All emails</p>
            <p className="mt-0.5 text-xs text-muted">
              Pause everything including your weekly plan and check-in emails
            </p>
          </div>
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => void togglePreference("all")}
            className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-60 ${
              !allEmailsPaused
                ? "bg-brand text-brand-foreground"
                : "bg-input text-muted"
            }`}
          >
            {loading === "all" ? "…" : allEmailsPaused ? "Paused" : "Active"}
          </button>
        </div>

        <p className="px-1 text-xs text-muted">
          Note: pausing all emails will stop your weekly content plan and Friday
          check-in emails. You can re-enable at any time.
        </p>

        {error ? (
          <p className="px-1 text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
