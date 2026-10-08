"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Lets the artist take an unusually big post (an ad or a collab) out of
 * "your usual", or put it back.
 */
export function UsualToggle({ postId, excluded }: { postId: string; excluded: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/posts/exclude", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instagram_post_id: postId, excluded: next }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Something went wrong");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ml-20 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      {excluded ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => set(false)}
          className="font-semibold underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
        >
          Count it in my usual again
        </button>
      ) : (
        <>
          <span>Unusually high. Was this an ad or a collab?</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => set(true)}
            className="font-semibold text-foreground underline-offset-2 hover:underline disabled:opacity-50"
          >
            Yes, leave it out of my usual
          </button>
        </>
      )}
      {error ? <span className="text-red-300">{error}</span> : null}
    </div>
  );
}
