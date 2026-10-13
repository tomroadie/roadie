"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VISUAL_KINDS, VISUAL_KIND_LABEL, type VisualKind } from "@/lib/visual-kinds";

/**
 * What Tempo thinks a post looks like, with a way to correct it. Once
 * corrected, Tempo keeps the artist's version.
 */
export function VisualNote({
  artistId,
  postId,
  kind,
  note,
  source,
}: {
  artistId: string;
  postId: string;
  kind: VisualKind | null;
  note: string | null;
  source: "ai" | "artist" | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [k, setK] = useState<VisualKind>(kind ?? "other");
  const [n, setN] = useState(note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!source && !editing) return null;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/posts/visual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ artistId, postId, kind: k, note: n }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? "Couldn't save that");
      }
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <p className="text-xs leading-snug text-muted">
        <span className="font-semibold text-foreground">{kind ? VISUAL_KIND_LABEL[kind] : "Looks like"}</span>
        {note ? <span className="line-clamp-2 block">{note}</span> : null}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-0.5 min-h-6 font-semibold text-brand hover:underline"
          aria-label={source === "artist" ? "Edit your description of this post" : "Fix Tempo's description of this post"}
        >
          {source === "artist" ? "Edit" : "Not right?"}
        </button>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-background p-2">
      <label className="text-xs font-semibold text-foreground">
        What it is
        <select
          value={k}
          onChange={(e) => setK(e.target.value as VisualKind)}
          className="mt-0.5 block min-h-9 w-full rounded-md border border-card-border bg-card px-2 text-xs font-normal"
        >
          {VISUAL_KINDS.map((v) => (
            <option key={v} value={v}>
              {VISUAL_KIND_LABEL[v]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-foreground">
        What&rsquo;s in it
        <textarea
          value={n}
          onChange={(e) => setN(e.target.value)}
          rows={2}
          maxLength={200}
          className="mt-0.5 block w-full resize-y rounded-md border border-card-border bg-card px-2 py-1 text-xs font-normal"
        />
      </label>
      {error ? (
        <p role="alert" className="text-xs font-semibold text-red-800">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="min-h-8 rounded-md bg-ink px-2.5 text-xs font-semibold text-ink-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setK(kind ?? "other");
            setN(note ?? "");
          }}
          className="min-h-8 px-1.5 text-xs font-semibold text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
