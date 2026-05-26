"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

function PulsingDots() {
  return (
    <div className="flex justify-center gap-2" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand"
          style={{ animationDelay: `${i * 200}ms` }}
        />
      ))}
    </div>
  );
}

export function AuditPendingSection({ artistId }: { artistId: string }) {
  const router = useRouter();

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
  }, [artistId, router]);

  return (
    <section className="mt-10 rounded-xl border border-brand/40 bg-card p-8 text-center">
      <div className="flex justify-center">
        <PulsingDots />
      </div>
      <h2 className="mt-4 text-xl font-black uppercase tracking-tight text-foreground">
        Analysing your Instagram
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-strong">
        We&apos;re looking at your last 10 posts, engagement patterns, and content
        style. This takes about 3 minutes.
      </p>
      <p className="mt-2 text-xs text-muted">
        The page will update automatically when your audit is ready.
      </p>
    </section>
  );
}
