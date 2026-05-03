"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function pendingStorageKey(artistId: string) {
  return `roadie_insights_audit_pending_${artistId}`;
}

export function InsightsAuditEmptyState({
  artistId,
  instagramHandle,
}: {
  artistId: string;
  instagramHandle: string | null;
}) {
  const router = useRouter();
  const trimmed = instagramHandle?.trim() ?? "";
  const hasHandle = Boolean(trimmed);
  const displayHandle = trimmed.replace(/^@/, "");

  const [pending, setPending] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        setPending(localStorage.getItem(pendingStorageKey(artistId)) === "1");
      }
    } catch {
      // ignore storage failures
    }
  }, [artistId]);

  useEffect(() => {
    if (!pending) return;
    const id = window.setInterval(async () => {
      try {
        const res = await fetch(
          `/api/audit-status?artist_id=${encodeURIComponent(artistId)}`
        );
        const data = (await res.json()) as { ready?: boolean };
        if (data.ready === true) {
          clearInterval(id);
          router.refresh();
        }
      } catch {
        // keep polling
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [pending, artistId, router]);

  const runAudit = async () => {
    setError(null);
    setStarting(true);
    try {
      const res = await fetch("/api/run-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artist_id: artistId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        success?: boolean;
      };
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "Could not start audit"
        );
        setStarting(false);
        return;
      }
      try {
        localStorage.setItem(pendingStorageKey(artistId), "1");
      } catch {
        // still show pending UI
      }
      setPending(true);
    } catch {
      setError("Network error — try again.");
    } finally {
      setStarting(false);
    }
  };

  if (!hasHandle) {
    return (
      <>
        <p className="text-sm leading-relaxed text-muted">
          Add your Instagram handle in Settings to run your audit
        </p>
        <p className="mt-5">
          <Link
            href="/settings"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-brand px-5 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95"
          >
            Go to settings →
          </Link>
        </p>
      </>
    );
  }

  if (pending) {
    return (
      <>
        <p className="animate-pulse text-sm leading-relaxed text-muted">
          Checking for your audit results...
        </p>
        <p className="mt-5">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-card-border bg-input px-4 text-sm font-semibold uppercase tracking-wide text-foreground shadow-sm transition-colors hover:border-brand"
          >
            Refresh
          </button>
        </p>
      </>
    );
  }

  return (
    <>
      <p className="text-sm leading-relaxed text-muted">
        We have your Instagram handle (@{displayHandle}). Ready to run your
        audit?
      </p>
      <p className="mt-5">
        <button
          type="button"
          onClick={runAudit}
          disabled={starting}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-emerald-600 px-5 text-sm font-black uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {starting ? "Starting…" : "Run my Instagram audit"}
        </button>
      </p>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </>
  );
}
