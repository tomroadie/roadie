"use client";

import type { ContentIdea } from "@/types/content-plan";
import { useEffect, useMemo, useState } from "react";
import type { EventRow } from "@/types/event";
import Link from "next/link";
import { canDo, normalizePlan } from "@/lib/plan-limits";
import { createClient } from "@/utils/supabase/client";

type Accent = {
  border: string;
  pill: string;
  label: string;
};

function getAccent(format: string): Accent {
  const f = format.trim().toLowerCase();
  if (f.includes("reel")) {
    return {
      border: "border-l-fuchsia-500",
      pill: "bg-brand text-brand-foreground",
      label: "text-brand",
    };
  }
  if (f.includes("carousel")) {
    return {
      border: "border-l-sky-400",
      pill: "bg-brand text-brand-foreground",
      label: "text-brand",
    };
  }
  if (f.includes("story")) {
    return {
      border: "border-l-teal-400",
      pill: "bg-brand text-brand-foreground",
      label: "text-brand",
    };
  }
  if (f.includes("video")) {
    return {
      border: "border-l-amber-400",
      pill: "bg-brand text-brand-foreground",
      label: "text-brand",
    };
  }
  return {
    border: "border-l-zinc-600",
    pill: "bg-brand text-brand-foreground",
    label: "text-brand",
  };
}

function buildCopyText(idea: ContentIdea): string {
  return [
    `Format: ${idea.format}`,
    `Hook: ${idea.hook}`,
    "",
    idea.caption,
    "",
    `Why: ${idea.why}`,
    `Timing: ${idea.timing}`,
  ].join("\n");
}

function IdeaCard({
  idea,
  onRate,
  initialRating = null,
  onSubmitReview,
}: {
  idea: ContentIdea;
  onRate: (hook: string, rating: "up" | "down") => void;
  initialRating?: "up" | "down" | null;
  onSubmitReview?: (idea: ContentIdea, file: File | null) => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState<null | "up" | "down">(initialRating ?? null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewFile, setReviewFile] = useState<File | null>(null);
  const accent = useMemo(() => getAccent(idea.format), [idea.format]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildCopyText(idea));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  async function handleSubmitReview() {
    if (!onSubmitReview) return;
    if (reviewSubmitting || reviewSubmitted) return;
    setReviewSubmitting(true);
    try {
      await onSubmitReview(idea, reviewFile);
      setReviewSubmitted(true);
    } finally {
      setReviewSubmitting(false);
    }
  }

  return (
    <article
      className={[
        "relative overflow-hidden rounded-xl border border-card-border bg-card p-6 transition-all duration-150",
        "hover:-translate-y-[1px] hover:shadow-[0_0_0_1px_rgba(0,255,135,0.20),0_18px_60px_rgba(0,0,0,0.45)]",
        `${accent.border} border-l-4`,
      ].join(" ")}
    >
      <div className="flex min-w-0 items-start justify-between gap-4">
        <span
          className={`inline-flex h-6 max-w-full items-center rounded-full px-2.5 text-[11px] font-black uppercase tracking-wide ring-1 ring-inset ring-brand/30 ${accent.pill} overflow-hidden text-ellipsis whitespace-nowrap`}
        >
          {idea.format}
        </span>
      </div>

      <h3 className="mt-4 text-xl font-bold leading-snug text-foreground">
        {idea.hook}
      </h3>

      <p className="mt-3 text-sm leading-7 text-muted-strong">
        {idea.caption}
      </p>

      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt
            className={`text-xs font-semibold uppercase tracking-widest ${accent.label}`}
          >
            Why
          </dt>
          <dd className="mt-1 text-muted">{idea.why}</dd>
        </div>
        <div>
          <dt
            className={`text-xs font-semibold uppercase tracking-widest ${accent.label}`}
          >
            Timing
          </dt>
          <dd className="mt-1 text-muted">{idea.timing}</dd>
        </div>
      </dl>

      <div className="mt-6">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-card-border bg-transparent px-4 text-sm font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-brand sm:w-auto"
        >
          {copied ? "Copied" : "Copy idea"}
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          aria-pressed={rating === "up"}
          aria-label="Thumbs up"
          onClick={() => {
            setRating("up");
            onRate(idea.hook, "up");
          }}
          className={[
            "inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-card-border bg-transparent px-4 text-lg transition-colors hover:border-brand sm:flex-initial sm:min-w-[5rem]",
            rating === "up" ? "text-emerald-400" : "text-foreground",
          ].join(" ")}
        >
          👍
        </button>
        <button
          type="button"
          aria-pressed={rating === "down"}
          aria-label="Thumbs down"
          onClick={() => {
            setRating("down");
            onRate(idea.hook, "down");
          }}
          className={[
            "inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-card-border bg-transparent px-4 text-lg transition-colors hover:border-brand sm:flex-initial sm:min-w-[5rem]",
            rating === "down" ? "text-red-400" : "text-foreground",
          ].join(" ")}
        >
          👎
        </button>
      </div>

      {onSubmitReview ? (
        <div className="mt-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Optional attachment
            </span>
            <input
              type="file"
              disabled={reviewSubmitting || reviewSubmitted}
              onChange={(e) => {
                const f = e.currentTarget.files?.[0] ?? null;
                setReviewFile(f);
              }}
              className="mt-1.5 block w-full cursor-pointer rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-2 file:text-xs file:font-black file:uppercase file:tracking-wide file:text-brand-foreground disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleSubmitReview()}
            disabled={reviewSubmitting || reviewSubmitted}
            className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-lg border border-card-border bg-transparent px-4 text-sm font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-60"
          >
            {reviewSubmitted
              ? "Submitted ✓"
              : reviewSubmitting
                ? "Submitting..."
                : "Submit for review"}
          </button>
        </div>
      ) : null}

      {rating !== null ? (
        <p className="mt-2 text-xs text-muted">Thanks for the feedback</p>
      ) : null}
    </article>
  );
}

const PLAN_LOADING_MESSAGES = [
  "Analysing your Instagram...",
  "Reading your dates...",
  "Crafting your ideas...",
  "Almost there...",
] as const;

function IdeaCardSkeleton() {
  return (
    <article className="rounded-xl border border-card-border bg-card p-6">
      <div className="h-6 w-28 animate-pulse rounded-full bg-zinc-800" />
      <div className="mt-4 h-7 max-w-[85%] animate-pulse rounded bg-zinc-800" />
      <div className="mt-3 space-y-2">
        <div className="h-4 w-full animate-pulse rounded bg-zinc-800" />
        <div className="h-4 w-full animate-pulse rounded bg-zinc-800" />
        <div className="h-4 w-[72%] animate-pulse rounded bg-zinc-800" />
      </div>
      <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <div className="h-3 w-10 animate-pulse rounded bg-zinc-800" />
          <div className="mt-2 h-4 w-full animate-pulse rounded bg-zinc-800" />
        </div>
        <div>
          <div className="h-3 w-14 animate-pulse rounded bg-zinc-800" />
          <div className="mt-2 h-4 w-full animate-pulse rounded bg-zinc-800" />
        </div>
      </div>
    </article>
  );
}

type WeeklyPlanSectionProps = {
  initialIdeas: ContentIdea[] | null;
  initialIdeaRatings?: Record<string, "up" | "down">;
  upcomingEventsCount: number;
  lastGeneratedAt: string | null;
  upcomingThisWeek: EventRow[];
  plan: string;
  isAdmin?: boolean;
  canReview: boolean;
};

function hoursSince(iso: string): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return (Date.now() - t) / (1000 * 60 * 60);
}

type ConfirmKind = "no-dates" | "recent-plan";

type PlanAnswers = {
  vibe: string;
  avoid: string;
  focus: string;
};

export function WeeklyPlanSection({
  initialIdeas,
  initialIdeaRatings = {},
  upcomingEventsCount,
  lastGeneratedAt,
  upcomingThisWeek,
  plan,
  isAdmin = false,
  canReview,
}: WeeklyPlanSectionProps) {
  const [ideas, setIdeas] = useState<ContentIdea[] | null>(initialIdeas);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [answers, setAnswers] = useState<PlanAnswers>({
    vibe: "",
    avoid: "",
    focus: "",
  });
  const normalizedPlan = normalizePlan(plan);
  const canGenerate = canDo(normalizedPlan, "canGeneratePlan", isAdmin);
  const supabase = useMemo(() => createClient(), []);

  function sanitizeStorageFilename(name: string): string {
    const base = (name || "file").trim();
    const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
    return cleaned || "file";
  }

  async function uploadReviewFile(file: File): Promise<string> {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) throw new Error(userError.message);
    if (!user) throw new Error("You must be signed in to upload.");

    const filename = sanitizeStorageFilename(file.name);
    const path = `reviews/${user.id}/${Date.now()}-${crypto.randomUUID()}-${filename}`;
    const { error: uploadError } = await supabase.storage
      .from("content-reviews")
      .upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
    if (uploadError) throw new Error(uploadError.message);

    return path;
  }

  async function handleSubmitReview(idea: ContentIdea, file: File | null) {
    setError(null);
    const file_urls = file ? [await uploadReviewFile(file)] : [];
    const res = await fetch("/api/content-reviews", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...idea, file_urls }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: string;
      };
      throw new Error(
        data.details
          ? `${data.error ?? "Request failed"}: ${data.details}`
          : (data.error ?? "Could not submit for review.")
      );
    }
  }

  useEffect(() => {
    if (!loading) {
      setLoadingStep(null);
      return;
    }

    let index = 0;
    setLoadingStep(PLAN_LOADING_MESSAGES[0]);
    const id = window.setInterval(() => {
      index = (index + 1) % PLAN_LOADING_MESSAGES.length;
      setLoadingStep(PLAN_LOADING_MESSAGES[index]);
    }, 3000);

    return () => {
      window.clearInterval(id);
      setLoadingStep(null);
    };
  }, [loading]);

  async function runGenerate(answersParam: PlanAnswers | null) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        credentials: "same-origin",
        ...(answersParam !== null
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(answersParam),
            }
          : {}),
      });
      const data = (await res.json()) as {
        ideas?: ContentIdea[];
        error?: string;
        details?: string;
      };

      if (!res.ok) {
        setError(
          data.details
            ? `${data.error ?? "Request failed"}: ${data.details}`
            : (data.error ?? "Could not generate plan.")
        );
        return;
      }

      if (data.ideas && Array.isArray(data.ideas)) {
        setIdeas(data.ideas);
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRate(hook: string, rating: "up" | "down") {
    try {
      const res = await fetch("/api/generate-plan", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hook, rating }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not save rating.");
      }
    } catch {
      setError("Network error. Try again.");
    }
  }

  function requestGenerate() {
    if (loading) return;
    if (!canGenerate) return;
    if (upcomingEventsCount === 0) {
      setConfirm("no-dates");
      return;
    }
    if (lastGeneratedAt && hoursSince(lastGeneratedAt) < 24) {
      setConfirm("recent-plan");
      return;
    }
    setShowQuestionsModal(true);
  }

  function confirmGenerateAnyway() {
    setConfirm(null);
    setShowQuestionsModal(true);
  }

  return (
    <section className="mt-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
            Your weekly plan
          </h2>
          <p className="mt-1 text-sm text-muted">
            Five ideas shaped by your profile, dates, and Instagram audit.
          </p>
          <p className="mt-2 text-sm text-muted">
            {upcomingEventsCount > 0 ? (
              <>Plan shaped by {upcomingEventsCount} upcoming events.</>
            ) : (
              <>No upcoming dates — add some to get more specific ideas.</>
            )}
          </p>
        </div>
        {canGenerate ? (
          <button
            id="dashboard-generate-plan"
            type="button"
            onClick={requestGenerate}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-5 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Generating…"
              : ideas?.length
                ? "Regenerate plan"
                : "Generate my weekly plan"}
          </button>
        ) : (
          <Link
            href="/pricing"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-card-border bg-card px-5 text-sm font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-brand"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M5.5 8V6a4.5 4.5 0 1 1 9 0v2h.5A1.5 1.5 0 0 1 16.5 9.5v6A1.5 1.5 0 0 1 15 17H5A1.5 1.5 0 0 1 3.5 15.5v-6A1.5 1.5 0 0 1 5 8h.5Zm2-2a2.5 2.5 0 0 1 5 0v2h-5V6Z"
                clipRule="evenodd"
              />
            </svg>
            Upgrade to generate your plan
          </Link>
        )}
      </div>

      {ideas?.length ? (
        <ul className="mt-6 flex flex-col gap-5">
          {ideas.map((idea, i) => (
            <li key={`${idea.hook}-${i}`}>
              <IdeaCard
                idea={idea}
                onRate={handleRate}
                initialRating={initialIdeaRatings[idea.hook] ?? null}
                onSubmitReview={
                  canReview
                    ? async (ideaParam, file) => {
                        try {
                          await handleSubmitReview(ideaParam, file);
                        } catch (e) {
                          const msg =
                            e instanceof Error ? e.message : "Could not submit for review.";
                          setError(msg);
                          throw e;
                        }
                      }
                    : undefined
                }
              />
            </li>
          ))}
        </ul>
      ) : !loading ? (
        <div className="mt-6 rounded-xl border border-dashed border-card-border bg-input p-10 text-center">
          <p className="text-sm leading-relaxed text-muted">
            No plan for this week yet. Generate tailored ideas from your profile,
            dates, and Instagram audit.
          </p>
          <div className="mt-6 flex justify-center">
            {canGenerate ? (
              <button
                type="button"
                onClick={requestGenerate}
                disabled={loading}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-5 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Generate my weekly plan
              </button>
            ) : (
              <Link
                href="/pricing"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-card-border bg-card px-5 text-sm font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-brand"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.5 8V6a4.5 4.5 0 1 1 9 0v2h.5A1.5 1.5 0 0 1 16.5 9.5v6A1.5 1.5 0 0 1 15 17H5A1.5 1.5 0 0 1 3.5 15.5v-6A1.5 1.5 0 0 1 5 8h.5Zm2-2a2.5 2.5 0 0 1 5 0v2h-5V6Z"
                    clipRule="evenodd"
                  />
                </svg>
                Upgrade to generate your plan
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-5">
          <p className="text-sm text-muted animate-pulse">
            {loadingStep ?? PLAN_LOADING_MESSAGES[0]}
          </p>
          <ul className="flex flex-col gap-5">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i}>
                <IdeaCardSkeleton />
              </li>
            ))}
          </ul>
          <p className="text-center text-xs text-muted">
            Usually takes 20–30 seconds
          </p>
        </div>
      )}

      <div className="mt-10 rounded-xl border border-card-border bg-card p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-brand">
          Upcoming this week
        </p>
        {upcomingThisWeek.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {upcomingThisWeek.map((ev) => (
              <span
                key={ev.id}
                className="inline-flex items-center gap-2 rounded-full bg-input px-3 py-1 text-xs font-medium text-foreground"
              >
                <span className="text-muted">
                  {new Date(ev.event_date + "T12:00:00").toLocaleDateString(
                    "en-GB",
                    { weekday: "short", day: "numeric", month: "short" }
                  )}
                </span>
                <span className="font-semibold text-foreground">{ev.title}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Nothing scheduled this week —{" "}
            <Link href="/events" className="font-semibold text-brand hover:underline">
              add a date
            </Link>
            .
          </p>
        )}
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {showQuestionsModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl border border-card-border bg-card p-6 shadow-[0_18px_70px_rgba(0,0,0,0.65)]">
            <h3 className="text-base font-semibold text-foreground">
              Shape your plan
            </h3>
            <div className="mt-4 flex flex-col gap-4">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  What&apos;s your vibe this week?
                </span>
                <input
                  type="text"
                  value={answers.vibe}
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, vibe: e.target.value }))
                  }
                  placeholder="e.g. Hype around release, low-key, behind the scenes..."
                  className="mt-1.5 w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Anything to avoid?
                </span>
                <input
                  type="text"
                  value={answers.avoid}
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, avoid: e.target.value }))
                  }
                  placeholder="e.g. No sales posts, avoid anything too polished"
                  className="mt-1.5 w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Anything specific to focus on?
                </span>
                <input
                  type="text"
                  value={answers.focus}
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, focus: e.target.value }))
                  }
                  placeholder="e.g. The show on Friday, new single announcement"
                  className="mt-1.5 w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted"
                />
              </label>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowQuestionsModal(false);
                  void runGenerate(null);
                }}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-card-border bg-transparent px-4 text-sm font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-brand"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowQuestionsModal(false);
                  void runGenerate(answers);
                }}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95"
              >
                Generate my plan
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl border border-card-border bg-card p-6 shadow-[0_18px_70px_rgba(0,0,0,0.65)]">
            <h3 className="text-base font-semibold text-foreground">
              {confirm === "no-dates"
                ? "Your dates are empty"
                : "Regenerate your plan?"}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {confirm === "no-dates"
                ? "Content ideas will be more generic without dates. Add dates first or continue anyway?"
                : "You generated a plan today. Regenerate with updated info?"}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              {confirm === "no-dates" ? (
                <Link
                  href="/events"
                  onClick={() => {
                    setConfirm(null);
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-card-border bg-transparent px-4 text-sm font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-brand"
                >
                  Add dates
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setConfirm(null);
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-card-border bg-transparent px-4 text-sm font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-brand"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={confirmGenerateAnyway}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95"
              >
                {confirm === "no-dates" ? "Generate anyway" : "Regenerate"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
