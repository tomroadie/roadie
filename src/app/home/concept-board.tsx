"use client";

import { useState } from "react";
import type { BoardConcept, BoardState } from "@/lib/concepts/store";
import type { Effort, ExecutionFormat } from "@/lib/concepts/types";

const BIN_REASONS = ["Not my style", "No gear for this", "No time"] as const;

const EFFORT_LABEL: Record<Effort, string> = {
  low: "Quick",
  medium: "Some effort",
  high: "Bigger job",
};

const FORMAT_LABEL: Record<ExecutionFormat, string> = {
  reel: "Reel",
  carousel: "Carousel",
  photo: "Photo",
  story: "Story",
  text: "Text post",
};

function formatKeyDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

type Action = "pin" | "bin" | "posted" | "let_go";

function Executions({ concept }: { concept: BoardConcept }) {
  return (
    <ul className="mt-4 space-y-3">
      {concept.executions.map((e, i) => (
        <li key={i} className="flex gap-3 text-sm leading-relaxed text-foreground">
          <span className="mt-0.5 shrink-0 self-start whitespace-nowrap rounded bg-input px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-muted">
            {FORMAT_LABEL[e.format] ?? e.format} · {EFFORT_LABEL[e.effort] ?? e.effort}
          </span>
          <span>{e.idea}</span>
        </li>
      ))}
    </ul>
  );
}

function ConceptCard({
  concept,
  busy,
  onAction,
}: {
  concept: BoardConcept;
  busy: boolean;
  onAction: (action: Action, reason?: string) => void;
}) {
  const [choosingReason, setChoosingReason] = useState(false);

  return (
    <article className="rounded-xl border border-card-border bg-card p-6">
      {concept.key_date && (
        <p className="text-[11px] font-bold uppercase tracking-widest text-sky-300">
          For {formatKeyDate(concept.key_date)}
        </p>
      )}
      <h3 className="mt-1 text-xl font-black leading-snug text-foreground">
        {concept.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-strong">{concept.why}</p>

      <Executions concept={concept} />

      <div className="mt-6 border-t border-card-border pt-4">
        {choosingReason ? (
          <div>
            <p className="text-xs font-semibold text-muted">
              What&rsquo;s putting you off? It helps the next ideas fit better.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {BIN_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  disabled={busy}
                  onClick={() => onAction("bin", r)}
                  className="rounded-full border border-card-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-muted disabled:opacity-50"
                >
                  {r}
                </button>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={() => onAction("bin")}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground disabled:opacity-50"
              >
                Just not this one
              </button>
              <button
                type="button"
                onClick={() => setChoosingReason(false)}
                className="px-2 py-1.5 text-xs text-muted hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction("posted")}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-brand-foreground disabled:opacity-50"
            >
              I posted this
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction("pin")}
              className="rounded-lg border border-card-border px-4 py-2 text-sm font-semibold text-foreground hover:border-muted disabled:opacity-50"
            >
              Pin for later
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setChoosingReason(true)}
              className="px-3 py-2 text-sm font-semibold text-muted hover:text-foreground disabled:opacity-50"
            >
              Not for me
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function ShelfItem({
  concept,
  busy,
  onAction,
}: {
  concept: BoardConcept;
  busy: boolean;
  onAction: (action: Action) => void;
}) {
  return (
    <li className="rounded-lg border border-card-border bg-input p-4">
      <details>
        <summary className="cursor-pointer list-none text-sm font-bold text-foreground">
          {concept.title}
        </summary>
        <p className="mt-2 text-sm text-muted-strong">{concept.why}</p>
        <Executions concept={concept} />
      </details>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction("posted")}
          className="rounded-lg bg-brand/15 px-3 py-1.5 text-xs font-bold text-brand ring-1 ring-inset ring-brand/30 disabled:opacity-50"
        >
          I posted this
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction("let_go")}
          className="px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground disabled:opacity-50"
        >
          Let go
        </button>
      </div>
    </li>
  );
}

export function ConceptBoard({ initialBoard }: { initialBoard: BoardState }) {
  const [board, setBoard] = useState(initialBoard);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function act(conceptId: string, action: Action, reason?: string) {
    setBusyId(conceptId);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/concepts/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ concept_id: conceptId, action, reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      setBoard(json.board as BoardState);
      if (action === "posted") setNote("Nice one. That counts towards this week.");
      if (action === "pin") setNote("Pinned. It's on your shelf below whenever you want it.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  if (!board.focus) {
    return (
      <section className="mt-10 rounded-xl border border-card-border bg-card p-7">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">
          Your board
        </p>
        <p className="mt-3 text-lg font-bold text-foreground">
          Your first ideas are being put together.
        </p>
        <p className="mt-2 text-sm text-muted">
          They&rsquo;re built from your own posts, so they take a little while. They&rsquo;ll show up here.
        </p>
      </section>
    );
  }

  const hasCards = board.cards.some(Boolean);

  return (
    <section className="mt-10">
      <div className="rounded-xl border border-card-border bg-card p-7">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">
          This week&rsquo;s focus
        </p>
        <p className="mt-3 text-2xl font-black leading-snug text-foreground">
          {board.focus}
        </p>
        <p className="mt-2 text-sm text-muted">
          Pick whichever idea fits your week. One post is a good week.
        </p>
      </div>

      {(note || error) && (
        <p
          role="status"
          className={`mt-4 rounded-lg px-4 py-3 text-sm font-semibold ${
            error
              ? "bg-red-500/10 text-red-300"
              : "bg-brand/10 text-brand"
          }`}
        >
          {error ?? note}
        </p>
      )}

      <div className="mt-4 space-y-4">
        {board.cards.map((card, i) =>
          card ? (
            <ConceptCard
              key={card.id}
              concept={card}
              busy={busyId === card.id}
              onAction={(action, reason) => act(card.id, action, reason)}
            />
          ) : hasCards ? null : i === 0 ? (
            <div
              key={`empty-${i}`}
              className="rounded-xl border border-dashed border-card-border p-6 text-sm text-muted"
            >
              You&rsquo;ve worked through this week&rsquo;s ideas. Fresh ones arrive with your next weekly update
              {board.shelf.length > 0 ? ", and your pinned ideas are below" : ""}.
            </div>
          ) : null
        )}
      </div>

      {board.shelf.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-muted">
            Pinned for later
          </h2>
          <ul className="mt-3 space-y-3">
            {board.shelf.map((c) => (
              <ShelfItem
                key={c.id}
                concept={c}
                busy={busyId === c.id}
                onAction={(action) => act(c.id, action)}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
