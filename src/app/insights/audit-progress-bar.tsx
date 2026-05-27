"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins === 0) return `${secs} sec`;
  return `${mins} min ${secs} sec`;
}

function computeProgress(
  triggeredAt: string | null,
  estimatedMinutes: number
): { progress: number; elapsedLabel: string } {
  if (!triggeredAt) {
    return { progress: 0, elapsedLabel: "0 sec" };
  }

  const start = new Date(triggeredAt).getTime();
  if (!Number.isFinite(start)) {
    return { progress: 0, elapsedLabel: "0 sec" };
  }

  const elapsedSeconds = Math.max(0, (Date.now() - start) / 1000);
  const totalSeconds = estimatedMinutes * 60;
  const progress = Math.min((elapsedSeconds / totalSeconds) * 100, 95);

  return {
    progress,
    elapsedLabel: formatElapsed(elapsedSeconds),
  };
}

export function AuditProgressBar({
  artistId,
  triggeredAt,
  estimatedMinutes = 4,
  onAuditReady,
}: {
  artistId: string;
  triggeredAt: string | null;
  estimatedMinutes?: number;
  onAuditReady?: () => void;
}) {
  const router = useRouter();
  const [{ progress, elapsedLabel }, setProgressState] = useState(() =>
    computeProgress(triggeredAt, estimatedMinutes)
  );

  useEffect(() => {
    const tick = () => {
      setProgressState(computeProgress(triggeredAt, estimatedMinutes));
    };

    tick();
    const progressId = window.setInterval(tick, 10_000);

    return () => {
      window.clearInterval(progressId);
    };
  }, [triggeredAt, estimatedMinutes]);

  useEffect(() => {
    const refreshId = window.setInterval(() => {
      router.refresh();
    }, 30_000);

    const statusId = window.setInterval(async () => {
      try {
        const res = await fetch(
          `/api/audit-status?artist_id=${encodeURIComponent(artistId)}`
        );
        const data = (await res.json()) as { ready?: boolean };
        if (data.ready === true) {
          onAuditReady?.();
          router.refresh();
        }
      } catch {
        // keep polling
      }
    }, 10_000);

    return () => {
      window.clearInterval(refreshId);
      window.clearInterval(statusId);
    };
  }, [artistId, router, onAuditReady]);

  return (
    <div className="mt-10 rounded-xl border border-brand/40 bg-card p-8">
      <p className="text-center text-xs font-bold uppercase tracking-widest text-brand">
        Analysing your Instagram
      </p>
      <h2 className="mt-3 text-center text-xl font-black uppercase tracking-tight text-foreground">
        Your audit is being prepared
      </h2>
      <p className="mx-auto mt-3 max-w-sm text-center text-sm text-muted">
        We&apos;re looking at your posts, engagement patterns, and content style.
        This takes about 3–5 minutes.
      </p>

      <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-input">
        <div
          className="h-full rounded-full bg-brand transition-all duration-1000 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-2 text-center text-xs text-muted">
        {Math.round(progress)}% complete
        {triggeredAt ? ` · ${elapsedLabel}` : null}
      </p>

      <p className="mt-4 text-center text-xs text-muted">
        The page will update automatically when ready.
      </p>
    </div>
  );
}
