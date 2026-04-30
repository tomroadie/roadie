"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RefreshAuditButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        setLoading(true);
        router.refresh();
        window.setTimeout(() => setLoading(false), 600);
      }}
      disabled={loading}
      className="inline-flex h-10 items-center justify-center rounded-lg border border-card-border bg-transparent px-4 text-sm font-semibold uppercase tracking-wide text-foreground shadow-sm transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Refreshing…" : "Refresh audit"}
    </button>
  );
}

