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
      className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
    >
      {loading ? "Refreshing…" : "Refresh audit"}
    </button>
  );
}

