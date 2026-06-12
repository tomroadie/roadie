"use client";

import { useState } from "react";
import { planDisplayName } from "@/lib/plan-display";

function formatLongDateWithYear(iso: string): string {
  const d = new Date(iso);
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function BillingSection({
  plan,
  trialActive,
  trialEndDate,
}: {
  plan: string;
  trialActive: boolean;
  trialEndDate: string | null;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [cancelDate, setCancelDate] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accessUntilLabel =
    trialActive && trialEndDate
      ? trialEndDate
      : "the end of your current billing period";

  async function handleConfirmCancel() {
    setError(null);
    setCancelling(true);
    try {
      const res = await fetch("/api/stripe/cancel", {
        method: "POST",
        credentials: "same-origin",
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        cancelAt?: string;
      };

      if (!res.ok) {
        setError(data.error ?? "Could not cancel subscription.");
        return;
      }

      if (data.cancelAt) {
        setCancelDate(formatLongDateWithYear(data.cancelAt));
      }
      setCancelled(true);
      setShowConfirm(false);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <section className="mt-10 rounded-xl border border-card-border bg-card p-6">
      <h2 className="text-lg font-black uppercase tracking-tight text-foreground">
        Billing
      </h2>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {planDisplayName(plan)} plan
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {trialActive && trialEndDate
              ? `Trial ends ${trialEndDate}`
              : "Active subscription"}
          </p>
        </div>

        {!showConfirm && !cancelled ? (
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={cancelling}
            className="shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
          >
            Cancel subscription
          </button>
        ) : null}

        {cancelled ? (
          <span className="shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 opacity-50">
            Cancellation confirmed
          </span>
        ) : null}
      </div>

      {showConfirm && !cancelled ? (
        <div className="mt-4 rounded-lg border border-card-border bg-input p-4">
          <p className="text-sm text-foreground">
            Are you sure? You&apos;ll keep access until {accessUntilLabel}.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void handleConfirmCancel()}
              disabled={cancelling}
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
            >
              {cancelling ? "Cancelling..." : "Confirm cancellation"}
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              disabled={cancelling}
              className="rounded-lg border border-card-border bg-card px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-foreground disabled:opacity-50"
            >
              Keep subscription
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {cancelled && cancelDate ? (
        <p className="mt-3 text-xs text-muted">
          Your subscription will remain active until {cancelDate}. You can
          resubscribe at any time.
        </p>
      ) : null}

      {!cancelled && !showConfirm ? (
        <p className="mt-3 text-xs text-muted">
          Cancelling will keep your access active until the end of your current
          billing period. Your data will be preserved.
        </p>
      ) : null}
    </section>
  );
}
