"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AuditProgressBar } from "./audit-progress-bar";

export function AuditCTASection({
  artistId,
  instagramHandle,
  initialHasPending,
  initialTriggeredAt,
  connected = false,
  isAdmin = false,
}: {
  artistId: string;
  instagramHandle: string | null;
  initialHasPending: boolean;
  initialTriggeredAt: string | null;
  /** Instagram connected: the audit reads their own account. */
  connected?: boolean;
  /** Admins can still audit a handle without connecting (Roadie use only). */
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const hasHandle = Boolean(instagramHandle?.trim());
  const canRun = connected || (isAdmin && hasHandle);

  const [isPending, setIsPending] = useState(initialHasPending);
  const [triggeredAt, setTriggeredAt] = useState<string | null>(
    initialTriggeredAt
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsPending(initialHasPending);
    setTriggeredAt(initialTriggeredAt);
  }, [initialHasPending, initialTriggeredAt]);

  const handleAuditReady = useCallback(() => {
    router.refresh();
  }, [router]);

  async function handleRunAudit() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/run-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artist_id: artistId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (res.ok) {
        setIsPending(true);
        setTriggeredAt(new Date().toISOString());
        setLoading(false);
        return;
      }

      setError(
        typeof data.error === "string" ? data.error : "Could not start audit"
      );
      setLoading(false);
    } catch {
      setError("Network error — try again.");
      setLoading(false);
    }
  }

  if (isPending) {
    return (
      <AuditProgressBar
        artistId={artistId}
        triggeredAt={triggeredAt}
        onAuditReady={handleAuditReady}
      />
    );
  }

  return (
    <section
      id="audit-section"
      className="mt-10 rounded-xl border-2 border-brand bg-card p-8 text-center"
    >
      <p className="text-xs font-bold uppercase tracking-widest text-brand">
        Next step
      </p>
      <h2 className="mt-3 text-2xl font-black uppercase tracking-tight text-foreground">
        {connected ? "Get your free audit" : "Connect Instagram for your free audit"}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-strong">
        {connected
          ? "We'll read your recent posts and show you what's already working, plus one easy first step. Takes a minute or two."
          : "Connect your Instagram and we'll show you what's already working, then build your weekly ideas from your own posts. Takes a minute or two."}
      </p>
      <div className="mt-6">
        {canRun ? (
          <button
            type="button"
            onClick={() => void handleRunAudit()}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-brand px-6 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Starting…" : connected ? "Run my audit" : "Run audit from handle (admin)"}
          </button>
        ) : (
          <Link
            href="/api/auth/instagram"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-brand px-6 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95"
          >
            Connect Instagram →
          </Link>
        )}
      </div>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
