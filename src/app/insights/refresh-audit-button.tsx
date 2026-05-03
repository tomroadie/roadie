"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type RefreshAuditButtonProps = {
  artistId: string;
};

export function RefreshAuditButton({ artistId }: RefreshAuditButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        setLoading(true);
        try {
          await fetch("/api/run-audit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ artist_id: artistId }),
          });
          router.refresh();
        } finally {
          setLoading(false);
        }
      }}
      disabled={loading}
      className="inline-flex h-10 items-center justify-center rounded-lg border border-card-border bg-transparent px-4 text-sm font-semibold uppercase tracking-wide text-foreground shadow-sm transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Refreshing…" : "Refresh audit"}
    </button>
  );
}
