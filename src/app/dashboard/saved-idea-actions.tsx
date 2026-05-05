"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

type SavedIdeaActionsProps = {
  ideaId: string;
  artistId: string;
  copyText: string;
};

export function SavedIdeaActions({ ideaId, artistId, copyText }: SavedIdeaActionsProps) {
  const router = useRouter();
  const supabase = createClient();
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(copyText);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1000);
          } catch {
            // ignore
          }
        }}
        className="inline-flex h-9 items-center justify-center rounded-lg border border-card-border bg-transparent px-3 text-xs font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-brand"
      >
        {copied ? "Copied" : "Copy"}
      </button>

      <button
        type="button"
        disabled={removing}
        onClick={async () => {
          if (removing) return;
          setRemoving(true);
          try {
            await supabase
              .from("saved_ideas")
              .delete()
              .eq("id", ideaId)
              .eq("artist_id", artistId);
            router.refresh();
          } finally {
            setRemoving(false);
          }
        }}
        className="inline-flex h-9 items-center justify-center rounded-lg border border-card-border bg-transparent px-3 text-xs font-semibold uppercase tracking-wide text-muted transition-colors hover:border-red-500 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {removing ? "Removing…" : "Remove"}
      </button>
    </div>
  );
}

