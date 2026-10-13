"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type PickableArtist = { id: string; name: string; managed: boolean; type: string };

/** Admin: create a roster or change who's on it. Nothing is ticked to start with; ticked artists sit at the top. */
export function RosterEditor({
  mode,
  rosterId,
  artists,
  selected,
  defaultName,
}: {
  mode: "create" | "update";
  rosterId?: string;
  artists: PickableArtist[];
  selected: string[];
  defaultName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [ids, setIds] = useState<Set<string>>(new Set(selected));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Order is fixed when the editor opens, so rows don't jump while ticking.
  const [order] = useState(() => [...artists].sort((a, b) => Number(selected.includes(b.id)) - Number(selected.includes(a.id))));

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/rosters", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: mode, roster_id: rosterId, name, artist_ids: [...ids] }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Couldn't save");
      return;
    }
    router.push(`/roster?id=${json.id ?? rosterId}`);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-card-border bg-card p-5">
      <h2 className="text-lg font-bold text-foreground">{mode === "create" ? "Make a roster" : "Edit roster"}</h2>
      {mode === "create" ? (
        <p className="text-sm text-muted">
          A roster is a manager or agency&rsquo;s artists on one page. Tick the artists that belong on it.
        </p>
      ) : null}
      <label className="text-sm font-semibold text-foreground">
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          className="mt-1 block min-h-10 w-full rounded-lg border border-card-border bg-background px-3 text-sm font-normal"
        />
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-semibold text-foreground">
          Artists <span className="font-normal text-muted">({ids.size} ticked)</span>
        </legend>
        <div className="mb-1 flex gap-3 text-xs font-semibold">
          <button type="button" onClick={() => setIds(new Set())} className="text-muted hover:text-foreground">
            Untick all
          </button>
          <button
            type="button"
            onClick={() => setIds(new Set(artists.filter((a) => a.managed).map((a) => a.id)))}
            className="text-muted hover:text-foreground"
          >
            Tick all managed
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto rounded-lg border border-card-border bg-background p-2">
          {order.map((a) => (
            <label key={a.id} className="flex min-h-9 items-center gap-2 rounded px-1 text-sm hover:bg-card">
              <input
                type="checkbox"
                checked={ids.has(a.id)}
                onChange={(e) =>
                  setIds((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(a.id);
                    else next.delete(a.id);
                    return next;
                  })
                }
                className="h-4 w-4"
              />
              <span className="text-foreground">{a.name}</span>
              <span className="text-xs text-muted">
                {a.managed ? "managed" : "self-serve"}
                {a.type !== "artist" ? ` · ${a.type}` : ""}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-red-800">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving || !name.trim()}
          onClick={() => void save()}
          className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-ink-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : mode === "create" ? "Make roster" : "Save"}
        </button>
        {mode === "update" ? (
          <button type="button" onClick={() => router.push(`/roster?id=${rosterId}`)} className="min-h-10 px-2 text-sm font-semibold text-muted">
            Cancel
          </button>
        ) : null}
      </div>
    </section>
  );
}
