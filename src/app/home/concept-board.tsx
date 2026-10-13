"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
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

function formatsOf(concept: BoardConcept): ExecutionFormat[] {
  return [...new Set(concept.executions.map((e) => e.format))];
}

/**
 * One idea, compact: its theme, the idea and the formats it suits. The full
 * "Inspire me" detail (why it fits, example executions, pin / not for me) opens
 * on demand, so Home stays about the week rather than the briefs.
 */
function ConceptCard({
  concept,
  busy,
  onAction,
}: {
  concept: BoardConcept;
  busy: boolean;
  onAction: (action: Action, reason?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [choosingReason, setChoosingReason] = useState(false);
  const detailsId = `idea-${concept.id}`;

  return (
    <article className="rounded-2xl border border-card-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {concept.theme ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            {concept.theme.name}
          </p>
        ) : null}
        {concept.key_date ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-800">
            For {formatKeyDate(concept.key_date)}
          </p>
        ) : null}
      </div>
      <h3 className="mt-1 text-base font-semibold leading-snug text-foreground">
        {concept.title}
      </h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {formatsOf(concept).map((f) => (
          <span key={f} className="rounded-full bg-input px-2.5 py-0.5 text-xs font-medium text-muted-strong">
            {FORMAT_LABEL[f] ?? f}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen((o) => !o)}
          className="min-h-11 rounded-xl bg-ink px-4 text-sm font-semibold text-ink-foreground hover:opacity-90"
        >
          {open ? "Hide" : "Inspire me"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction("posted")}
          className="min-h-11 rounded-xl border border-card-border px-4 text-sm font-semibold text-foreground hover:border-muted disabled:opacity-50"
        >
          I posted this
        </button>
      </div>

      {open ? (
        <div id={detailsId} className="mt-4 border-t border-card-border pt-4">
          <p className="text-sm leading-relaxed text-muted-strong">{concept.why}</p>
          <Executions concept={concept} />
          <div className="mt-4">
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
                      className="min-h-9 rounded-full border border-card-border px-3 text-xs font-semibold text-foreground hover:border-muted disabled:opacity-50"
                    >
                      {r}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onAction("bin")}
                    className="min-h-9 rounded-full px-3 text-xs font-semibold text-muted hover:text-foreground disabled:opacity-50"
                  >
                    Just not this one
                  </button>
                  <button
                    type="button"
                    onClick={() => setChoosingReason(false)}
                    className="min-h-9 px-2 text-xs text-muted hover:text-foreground"
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
                  onClick={() => onAction("pin")}
                  className="min-h-10 rounded-lg border border-card-border px-3 text-sm font-semibold text-foreground hover:border-muted disabled:opacity-50"
                >
                  Pin for later
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setChoosingReason(true)}
                  className="min-h-10 px-3 text-sm font-semibold text-muted hover:text-foreground disabled:opacity-50"
                >
                  Not for me
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
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
    <li className="rounded-xl border border-card-border bg-background p-4">
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

/** A post Instagram spotted this week that isn't linked to an idea yet. */
export type UnmatchedPost = {
  id: string;
  postDate: string | null;
  thumbnailUrl: string | null;
  caption: string;
};

function dayName(iso: string | null): string {
  if (!iso) return "this week";
  return `on ${new Date(iso).toLocaleDateString("en-GB", { weekday: "long", timeZone: "Europe/London" })}`;
}

/**
 * "Was this one of your ideas?" for a post Instagram spotted. Choosing an
 * idea links them (so results follow the idea); "Something else" stops
 * the question for that post.
 */
function IdeaMatchPrompt({
  post,
  options,
  busy,
  onAnswer,
}: {
  post: UnmatchedPost;
  options: { id: string; title: string }[];
  busy: boolean;
  onAnswer: (conceptId: string | null) => void;
}) {
  return (
    <div className="rounded-2xl border border-card-border bg-card p-5">
      <div className="flex gap-4">
        {post.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.thumbnailUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
        ) : null}
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">
            Instagram spotted a post {dayName(post.postDate)}. Was it one of your ideas?
          </p>
          {post.caption ? <p className="mt-1 truncate text-sm text-muted">{post.caption}</p> : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={busy}
            onClick={() => onAnswer(o.id)}
            className="rounded-full border border-card-border px-3 py-1.5 text-left text-xs font-semibold text-foreground hover:border-brand disabled:opacity-50"
          >
            {o.title}
          </button>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => onAnswer(null)}
          className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground disabled:opacity-50"
        >
          Something else
        </button>
      </div>
    </div>
  );
}

export type PaceInfo = {
  /** The most they should post in a week at their best (confirmed, else suggested). */
  prime: number;
  primeSuggested: number | null;
  primeConfirmed: boolean;
  /** "Up for n+1 next week?" when the week's target is hit, else null. */
  offerNext: number | null;
  stepAnswer: "accepted" | "declined" | null;
  /** This week is a quiet week. */
  quiet: boolean;
  /** Quiet weeks have been frequent: suggest this lower prime. */
  suggestPrime: number | null;
};

async function postPace(body: Record<string, unknown>): Promise<void> {
  const res = await fetch("/api/pace", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? "Something went wrong");
  }
}

/** The step-up question and the prime, at the foot of the week strip. */
function PaceControls({
  pace,
  artistId,
  target,
  onQuiet,
  quietBusy,
}: {
  pace: PaceInfo;
  artistId: string;
  target: number;
  onQuiet: () => void;
  quietBusy: boolean;
}) {
  const [answer, setAnswer] = useState(pace.stepAnswer);
  const [confirmed, setConfirmed] = useState(pace.primeConfirmed);
  const [prime, setPrime] = useState(pace.prime);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(pace.prime));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(body: Record<string, unknown>, after: () => void) {
    setBusy(true);
    setError(null);
    try {
      await postPace({ artist_id: artistId, ...body });
      after();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const btn = "min-h-10 rounded-lg px-3 text-sm font-semibold disabled:opacity-50";
  const offer = pace.offerNext !== null && !answer;

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-ink-foreground/15 pt-4">
      {offer ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold">Up for {pace.offerNext} next week?</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => run({ action: "step", accept: true }, () => setAnswer("accepted"))}
            className={`${btn} bg-accent text-ink`}
          >
            Yes, {pace.offerNext}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run({ action: "step", accept: false }, () => setAnswer("declined"))}
            className={`${btn} border border-ink-foreground/30 text-ink-foreground`}
          >
            Keep at {target}
          </button>
        </div>
      ) : answer === "accepted" ? (
        <p className="text-sm text-accent">Next week goes up to {target + 1}.</p>
      ) : answer === "declined" ? (
        <p className="text-sm text-ink-muted">Staying at {target} next week.</p>
      ) : null}

      {editing ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(draft);
            if (!Number.isInteger(n) || n < 1 || n > 21) {
              setError("Pick between 1 and 21 posts a week.");
              return;
            }
            void run({ action: "prime", prime: n }, () => {
              setPrime(n);
              setConfirmed(true);
              setEditing(false);
            });
          }}
        >
          <label htmlFor="prime-input" className="text-sm">
            At my best I&rsquo;d post
          </label>
          <input
            id="prime-input"
            type="number"
            min={1}
            max={21}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-10 w-20 rounded-lg border border-ink-foreground/30 bg-transparent px-2 text-ink-foreground"
          />
          <span className="text-sm">a week</span>
          <button type="submit" disabled={busy} className={`${btn} bg-accent text-ink`}>
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className={`${btn} text-ink-muted`}>
            Cancel
          </button>
        </form>
      ) : !confirmed && pace.primeSuggested !== null ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-ink-foreground/85">
            At your best you&rsquo;ve posted about {pace.primeSuggested} a week. Tempo will build you up towards that.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => run({ action: "prime", prime: pace.primeSuggested }, () => setConfirmed(true))}
            className={`${btn} border border-ink-foreground/30 text-ink-foreground`}
          >
            Sounds right
          </button>
          <button type="button" onClick={() => setEditing(true)} className={`${btn} text-ink-muted underline underline-offset-4`}>
            Change
          </button>
        </div>
      ) : pace.suggestPrime !== null && pace.suggestPrime < prime ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-ink-foreground/85">
            You&rsquo;ve taken a few quiet weeks lately. {pace.suggestPrime} a week might suit you better right now.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => run({ action: "prime", prime: pace.suggestPrime }, () => setPrime(pace.suggestPrime!))}
            className={`${btn} border border-ink-foreground/30 text-ink-foreground`}
          >
            Set it to {pace.suggestPrime}
          </button>
        </div>
      ) : (
        <p className="text-xs text-ink-muted">
          Building towards {prime} a week.{" "}
          <button type="button" onClick={() => setEditing(true)} className="underline underline-offset-4">
            Change
          </button>
          {" · "}
          <button type="button" disabled={quietBusy} onClick={onQuiet} className="underline underline-offset-4">
            Take a quiet week
          </button>
        </p>
      )}
      {error ? (
        <p role="alert" className="text-sm font-semibold text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type WeekProgress = {
  target: number;
  /** Ideas they marked "I posted this" since their week started. */
  marked: number;
  /** Posts Instagram sync has seen since their week started, oldest first. */
  verified: { permalink: string | null; result?: string | null }[];
};

/** Whichever source saw more, so one post isn't counted twice. */
function postedCount(p: WeekProgress): number {
  return Math.max(p.marked, p.verified.length);
}

function InstagramMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  );
}

/**
 * One bubble per post in this week's target; each fills with a tick as they
 * post. Posts Instagram has confirmed come first, carry a small Instagram
 * badge and link to the post. Ones they only marked are a plain tick.
 * Posting past the target adds filled bubbles. No numbers, no "missed".
 */
function WeekBubbles({ progress }: { progress: WeekProgress }) {
  const target = Math.max(1, progress.target);
  const verified = progress.verified;
  const posted = postedCount(progress);
  const total = Math.max(target, posted);
  const base =
    "relative flex h-7 w-7 items-center justify-center rounded-full border-2 text-sm font-black transition-colors";
  // Drawn on the dark week strip.
  const filledCls = "border-accent bg-accent text-ink";
  return (
    <div className="flex items-center gap-2">
      <span className="sr-only">
        {posted} of {target} posts this week
        {verified.length > 0 ? `, ${verified.length} spotted on Instagram` : ""}
      </span>
      {Array.from({ length: total }, (_, i) => {
        if (i < verified.length) {
          const link = verified[i].permalink;
          const result = verified[i].result;
          const inner = (
            <>
              <span aria-hidden="true">✓</span>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-card text-brand ring-1 ring-accent">
                <InstagramMark />
              </span>
            </>
          );
          return link ? (
            <a
              key={i}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              title={`Spotted on Instagram.${result ? ` ${result}` : ""} Tap to see the post.`}
              aria-label={`Spotted on Instagram.${result ? ` ${result}` : ""} Open post`}
              className={`${base} ${filledCls} hover:brightness-110`}
            >
              {inner}
            </a>
          ) : (
            <span key={i} title={`Spotted on Instagram.${result ? ` ${result}` : ""}`} className={`${base} ${filledCls}`}>
              {inner}
            </span>
          );
        }
        const filled = i < posted;
        return (
          <span
            key={i}
            title={filled ? "You marked this as posted" : undefined}
            className={`${base} ${
              filled ? filledCls : "border-ink-foreground/25 bg-transparent text-transparent"
            }`}
            aria-hidden="true"
          >
            {filled ? "✓" : ""}
          </span>
        );
      })}
    </div>
  );
}

export function ConceptBoard({
  initialBoard,
  initialProgress,
  nextIdeasDay,
  artistId,
  unmatchedPosts = [],
  postedUnlinked = [],
  weekLabel,
  pace,
  children,
}: {
  /** Prime and the "n+1?" question; absent until the pace data loads. */
  pace?: PaceInfo;
  initialBoard: BoardState;
  /** e.g. "13–19 Oct", shown on the week strip. */
  weekLabel?: string;
  /** Left column of Home: learnings and recent posts. */
  children?: ReactNode;
  initialProgress?: WeekProgress;
  artistId?: string;
  /** Posts Instagram spotted this week with no idea linked yet. */
  unmatchedPosts?: UnmatchedPost[];
  /** Ideas marked "I posted this" this week that aren't linked to a post. */
  postedUnlinked?: { id: string; title: string }[];
  /** Weekday their next ideas arrive, e.g. "Friday". */
  nextIdeasDay?: string;
}) {
  const [progress, setProgress] = useState<WeekProgress | null>(initialProgress ?? null);
  const [quiet, setQuiet] = useState(pace?.quiet ?? false);
  const [quietBusy, setQuietBusy] = useState(false);

  async function toggleQuiet(on: boolean) {
    if (!artistId) return;
    setQuietBusy(true);
    setError(null);
    try {
      await postPace({ action: "quiet", artist_id: artistId, on });
      setQuiet(on);
      setNote(on ? "Quiet week on. Emails are paused until your next week starts." : "Quiet week off. You're back on.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setQuietBusy(false);
    }
  }
  const [board, setBoard] = useState(initialBoard);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [unmatched, setUnmatched] = useState(unmatchedPosts);
  const [postedOpen, setPostedOpen] = useState(postedUnlinked);

  async function answerMatch(postId: string, conceptId: string | null) {
    if (!artistId) return;
    setBusyId(postId);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/concepts/link-post", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instagram_post_id: postId, concept_id: conceptId, artist_id: artistId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      const wasOpen = conceptId ? postedOpen.some((p) => p.id === conceptId) : false;
      setBoard(json.board as BoardState);
      setUnmatched((u) => u.filter((p) => p.id !== postId));
      if (conceptId) {
        setPostedOpen((p) => p.filter((c) => c.id !== conceptId));
        // An idea still on the board or shelf has just been marked posted.
        if (!wasOpen) setProgress((p) => (p ? { ...p, marked: p.marked + 1 } : p));
        setNote("Linked. You'll see how that idea did once the numbers settle.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

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
      if (action === "posted") {
        setNote("Nice one. That counts towards this week.");
        setProgress((p) => (p ? { ...p, marked: p.marked + 1 } : p));
      }
      if (action === "pin") setNote("Pinned. It's on your shelf below whenever you want it.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  const hasCards = board.cards.some(Boolean);
  const target = progress ? Math.max(1, progress.target) : null;
  const posted = progress ? postedCount(progress) : null;

  const strip = (
    <section className="rounded-2xl bg-ink px-6 py-6 text-ink-foreground sm:px-7">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
            This week{weekLabel ? ` · ${weekLabel}` : ""}
          </p>
          {quiet ? (
            <p className="font-display text-2xl font-bold sm:text-3xl">Quiet week</p>
          ) : progress && target !== null && posted !== null ? (
            <p className="font-display text-2xl font-bold sm:text-3xl">
              {target} {target === 1 ? "post" : "posts"} this week · {Math.min(posted, target)} done
            </p>
          ) : (
            <p className="font-display text-2xl font-bold sm:text-3xl">Your week</p>
          )}
          {board.focus ? (
            <p className="max-w-2xl text-sm leading-relaxed text-ink-foreground/85">{board.focus}</p>
          ) : null}
        </div>
        {progress && !quiet ? <WeekBubbles progress={progress} /> : null}
      </div>
      {quiet ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-ink-foreground/85">
            Your target and streak are on hold and emails are paused until next week. The ideas are still here if you
            fancy it.
          </p>
          <button
            type="button"
            disabled={quietBusy}
            onClick={() => toggleQuiet(false)}
            className="min-h-10 rounded-lg border border-ink-foreground/30 px-3 text-sm font-semibold text-ink-foreground disabled:opacity-50"
          >
            End quiet week
          </button>
        </div>
      ) : progress && posted !== null && target !== null ? (
        posted >= target ? (
          <p className="mt-4 text-sm font-semibold text-accent">
            That&rsquo;s your week done. Anything else is a bonus.
          </p>
        ) : posted === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">Your week&rsquo;s just started. One post is a good week.</p>
        ) : null
      ) : null}
      {pace && artistId && progress && !quiet ? (
        <PaceControls
          pace={pace}
          artistId={artistId}
          target={progress.target}
          onQuiet={() => toggleQuiet(true)}
          quietBusy={quietBusy}
        />
      ) : null}
    </section>
  );

  const ideas = !board.focus ? (
    <div className="rounded-2xl border border-card-border bg-card p-5">
      <p className="font-semibold text-foreground">Your first ideas are being put together.</p>
      <p className="mt-2 text-sm text-muted">
        They&rsquo;re built from your own posts, so they take a little while. They&rsquo;ll show up here.
      </p>
    </div>
  ) : (
    <>
      <div className="space-y-3">
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
              className="rounded-2xl border border-dashed border-card-border p-5 text-sm text-muted"
            >
              You&rsquo;ve worked through this week&rsquo;s ideas.{" "}
              {nextIdeasDay ? `Fresh ones arrive ${nextIdeasDay}` : "Fresh ones arrive with your next weekly update"}
              {board.shelf.length > 0 ? ", and your pinned ideas are below" : ""}.
            </div>
          ) : null
        )}
        {hasCards && board.cards.some((c) => !c) ? (
          <p className="px-1 text-sm text-muted">
            {nextIdeasDay ? `More ideas arrive ${nextIdeasDay}.` : "More ideas arrive with your next weekly update."}
          </p>
        ) : null}
      </div>

      {board.shelf.length > 0 && (
        <details className="group rounded-2xl border border-card-border bg-card p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
            Pinned for later ({board.shelf.length})
          </summary>
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
        </details>
      )}
    </>
  );

  return (
    <div className="mt-2 flex flex-col gap-6">
      {strip}

      {unmatched[0] ? (
        <IdeaMatchPrompt
          post={unmatched[0]}
          busy={busyId === unmatched[0].id}
          options={[
            ...postedOpen,
            ...board.cards.filter((c): c is BoardConcept => Boolean(c)).map((c) => ({ id: c.id, title: c.title })),
            ...board.shelf.map((c) => ({ id: c.id, title: c.title })),
          ].filter((o, i, all) => all.findIndex((x) => x.id === o.id) === i)}
          onAnswer={(conceptId) => answerMatch(unmatched[0].id, conceptId)}
        />
      ) : null}

      {(note || error) && (
        <p
          role="status"
          className={`rounded-lg px-4 py-3 text-sm font-semibold ${
            error ? "bg-red-500/10 text-red-800" : "bg-brand-soft text-brand"
          }`}
        >
          {error ?? note}
        </p>
      )}

      <div className="flex flex-wrap items-start gap-7">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-8">{children}</div>
        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-3" aria-label="This week's ideas">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-bold text-foreground">This week&rsquo;s ideas</h2>
            <Link href="/concepts" className="text-sm font-semibold text-brand hover:underline">
              All concepts
            </Link>
          </div>
          {ideas}
        </aside>
      </div>
    </div>
  );
}
