"use client";

import { useState } from "react";
import type { SetupState } from "@/lib/admin-setup";

type Draft = NonNullable<SetupState["draft"]>;

async function draftAction(generationId: string, body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch("/api/admin/drafts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ generation_id: generationId, ...body }),
  });
  if (res.ok) return null;
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  return json.error ?? `Request failed (${res.status})`;
}

/**
 * The drafted week, ready to read and fix before it goes out: edit an idea,
 * replace one with a note, or redo the lot with a note.
 */
export function DraftReview({ draft, onChanged }: { draft: Draft; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ id: string; mode: "edit" | "replace" } | null>(null);
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [note, setNote] = useState("");
  const [redoNote, setRedoNote] = useState("");

  async function act(key: string, body: Record<string, unknown>) {
    setBusy(key);
    setError(null);
    const err = await draftAction(draft.generationId, body);
    if (err) setError(err);
    else {
      setOpen(null);
      setNote("");
      await onChanged();
    }
    setBusy(null);
  }

  const field = "block w-full rounded-lg border border-card-border bg-card px-2 py-1.5 text-sm";
  const small = "min-h-8 px-1.5 text-xs font-semibold text-brand hover:underline disabled:opacity-50";

  return (
    <div className="flex flex-col gap-3">
      {draft.focus ? <p className="text-foreground">Focus: {draft.focus}</p> : null}
      <ol className="flex flex-col gap-2.5">
        {draft.ideas.map((i, n) => {
          const isOpen = open?.id === i.id ? open.mode : null;
          return (
            <li key={i.id} className={`rounded-lg p-2.5 ${n < 3 ? "bg-card" : ""}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
                {n < 3 ? `On the board · ${n + 1}` : "In the pool"}
              </p>
              {isOpen === "edit" ? (
                <div className="mt-1 flex flex-col gap-1.5">
                  <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} aria-label="Title" className={field} />
                  <textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={3} aria-label="Why" className={field} />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void act(`edit:${i.id}`, { action: "edit", concept_id: i.id, title, why, executions: i.executions })}
                      className="min-h-8 rounded-md bg-ink px-2.5 text-xs font-semibold text-ink-foreground disabled:opacity-50"
                    >
                      {busy === `edit:${i.id}` ? "Saving…" : "Save"}
                    </button>
                    <button type="button" onClick={() => setOpen(null)} className="min-h-8 px-1.5 text-xs font-semibold text-muted">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-semibold text-foreground">{i.title}</p>
                  {i.why ? <p className="text-muted">{i.why}</p> : null}
                </>
              )}
              {isOpen === "replace" ? (
                <div className="mt-1.5 flex flex-col gap-1.5">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    aria-label="What you want instead"
                    placeholder="What you want instead (optional), e.g. something about the Tulsa King sync"
                    className={field}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void act(`replace:${i.id}`, { action: "replace", concept_id: i.id, note })}
                      className="min-h-8 rounded-md bg-ink px-2.5 text-xs font-semibold text-ink-foreground disabled:opacity-50"
                    >
                      {busy === `replace:${i.id}` ? "Writing a new one…" : "Replace it"}
                    </button>
                    <button type="button" onClick={() => setOpen(null)} className="min-h-8 px-1.5 text-xs font-semibold text-muted">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
              {!isOpen ? (
                <div className="mt-0.5 flex gap-1">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => {
                      setTitle(i.title);
                      setWhy(i.why ?? "");
                      setOpen({ id: i.id, mode: "edit" });
                    }}
                    className={small}
                  >
                    Edit
                  </button>
                  <button type="button" disabled={busy !== null} onClick={() => setOpen({ id: i.id, mode: "replace" })} className={small}>
                    Replace
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-col gap-1.5 border-t border-card-border pt-3">
        <label htmlFor={`redo-${draft.generationId}`} className="text-xs font-semibold text-foreground">
          Not right overall? Redo the whole week with a note
        </label>
        <textarea
          id={`redo-${draft.generationId}`}
          value={redoNote}
          onChange={(e) => setRedoNote(e.target.value)}
          rows={2}
          placeholder="e.g. Lead on the album campaign. Less live footage, they're not touring until March."
          className={field}
        />
        <div>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void act("regenerate", { action: "regenerate", note: redoNote })}
            className="min-h-9 rounded-lg border border-card-border px-3 text-sm font-semibold text-foreground hover:bg-card disabled:opacity-50"
          >
            {busy === "regenerate" ? "Redoing… (up to a minute)" : "Redo with this note"}
          </button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-red-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
