"use client";

import type { ContentIdea } from "@/types/content-plan";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { EventRow } from "@/types/event";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffMs = Date.now() - t;
  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function IdeaCard({
  idea,
  onRate,
  initialRating = null,
  onSubmitReview,
  canReview = false,
  reviewForThisIdea = null,
  reviewLimitReached = false,
  plan = "pro",
}: {
  idea: ContentIdea;
  onRate: (hook: string, rating: "up" | "down") => void;
  initialRating?: "up" | "down" | null;
  onSubmitReview?: (idea: ContentIdea, file: File | null) => Promise<void>;
  canReview?: boolean;
  reviewForThisIdea?: {
    feedback: string;
    reviewed_at: string;
  } | null;
  reviewLimitReached?: boolean;
  plan?: string;
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
    <div className="flex flex-col">
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

        <p className="mt-3 text-sm leading-7 text-muted-strong">{idea.caption}</p>

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

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
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

        {rating !== null ? (
          <p className="mt-2 text-xs text-muted">Thanks for the feedback</p>
        ) : null}

        {canReview ? (
          <div className="mt-4 border-t border-card-border pt-4">
            {reviewForThisIdea ? (
              <div className="rounded-lg bg-input p-3">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-brand">
                  Expert feedback
                </p>
                <p className="text-sm leading-relaxed text-muted-strong">
                  {reviewForThisIdea.feedback}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Reviewed {formatRelativeTime(reviewForThisIdea.reviewed_at)}
                </p>
              </div>
            ) : reviewSubmitted ? (
              <p className="text-xs italic text-muted">
                Submitted for review — feedback coming soon.
              </p>
            ) : reviewLimitReached ? (
              <p className="text-xs italic text-muted">
                Monthly review limit reached. Resets on the 1st.
                {normalizePlan(plan) === "pro" ? (
                  <>
                    {" "}
                    <Link
                      href="/pricing"
                      className="text-brand hover:underline"
                    >
                      Upgrade for more →
                    </Link>
                  </>
                ) : null}
              </p>
            ) : (
              <>
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-brand">
                  Content review
                </p>
                <div className="space-y-2">
                  <p className="text-xs text-muted">
                    Want expert eyes on this before you post?
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="flex-1">
                      <input
                        type="file"
                        className="hidden"
                        disabled={reviewSubmitting}
                        accept="image/*,video/*"
                        onChange={(e) => {
                          const f = e.currentTarget.files?.[0] ?? null;
                          setReviewFile(f);
                        }}
                      />
                      <span className="inline-flex h-8 w-full cursor-pointer items-center gap-1.5 rounded-lg border border-card-border bg-input px-3 text-xs font-medium text-muted transition-colors hover:text-foreground">
                        {reviewFile ? reviewFile.name : "Attach draft (optional)"}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleSubmitReview()}
                      disabled={reviewSubmitting}
                      className="h-8 shrink-0 rounded-lg bg-brand px-3 text-xs font-black uppercase tracking-wide text-brand-foreground transition-colors hover:brightness-95 disabled:opacity-50"
                    >
                      {reviewSubmitting ? "Submitting..." : "Submit for review"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}
      </article>
    </div>
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
  planStatus: string | null;
  auditPending: boolean;
  hasAudit: boolean;
  isAdmin?: boolean;
  canReview: boolean;
  reviews: Array<{ idea_hook: string; feedback: string; reviewed_at: string }>;
  artistId: string;
  hideUpcomingThisWeek?: boolean;
  isManaged?: boolean;
  revisionRequest?: {
    id: string;
    status: "pending" | "approved" | "declined";
    admin_note: string | null;
    artist_acknowledged_at: string | null;
  } | null;
  hasJustUpgraded?: boolean;
  hasJustRegistered?: boolean;
  hasInstagram?: boolean;
};

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
  planStatus,
  auditPending,
  hasAudit,
  isAdmin = false,
  canReview,
  reviews,
  artistId,
  hideUpcomingThisWeek = false,
  isManaged = false,
  revisionRequest = null,
  hasJustUpgraded = false,
  hasJustRegistered = false,
  hasInstagram = false,
}: WeeklyPlanSectionProps) {
  const router = useRouter();
  const [ideas, setIdeas] = useState<ContentIdea[] | null>(initialIdeas);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [answers, setAnswers] = useState<PlanAnswers>({
    vibe: "",
    avoid: "",
    focus: "",
  });
  const [revision, setRevision] = useState(revisionRequest);
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [revisionSubmitting, setRevisionSubmitting] = useState(false);
  const [revisionSent, setRevisionSent] = useState(false);
  const refreshedApprovedRevisionId = useRef<string | null>(null);
  const normalizedPlan = normalizePlan(plan);
  const canGenerate = canDo(normalizedPlan, "canGeneratePlan", isAdmin);
  const supabase = useMemo(() => createClient(), []);
  const hasPlanIdeas = (ideas?.length ?? 0) > 0;
  const freePlanNoIdeasYet = !canGenerate && !hasPlanIdeas;
  const isPlanBeingPrepared =
    planStatus === "pending_review" && !hasPlanIdeas;

  const now = new Date();
  const reviewsUsedThisMonth = reviews.filter((r) => {
    const d = new Date(r.reviewed_at);
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  }).length;
  const reviewLimit = normalizedPlan === "label" ? 8 : 2;
  const reviewLimitReached = canReview && reviewsUsedThisMonth >= reviewLimit;

  useEffect(() => {
    setIdeas(initialIdeas);
  }, [initialIdeas]);

  useEffect(() => {
    setRevision(revisionRequest);
  }, [revisionRequest]);

  useEffect(() => {
    if (
      revision?.status === "approved" &&
      !revision.artist_acknowledged_at &&
      revision.id &&
      refreshedApprovedRevisionId.current !== revision.id
    ) {
      refreshedApprovedRevisionId.current = revision.id;
      router.refresh();
    }
  }, [revision, router]);

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

  async function handleAcknowledgeRevision() {
    if (!revision?.id) return;
    setError(null);
    try {
      const res = await fetch("/api/revision-request/acknowledge", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: revision.id }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not dismiss message.");
        return;
      }
      setRevision((prev) =>
        prev
          ? { ...prev, artist_acknowledged_at: new Date().toISOString() }
          : prev
      );
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    }
  }

  async function handleSubmitRevisionRequest() {
    const note = revisionNote.trim();
    if (!note) {
      setError("Please describe what you would like changed.");
      return;
    }

    setError(null);
    setRevisionSubmitting(true);
    try {
      const res = await fetch("/api/revision-request", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artist_id: artistId,
          artist_note: note,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (res.status === 409) {
        setError(data.error ?? "You already have a pending request this week.");
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Could not send revision request.");
        return;
      }

      setRevisionSent(true);
      setShowRevisionForm(false);
      setRevisionNote("");
      setRevision({
        id: revision?.id ?? "pending",
        status: "pending",
        admin_note: null,
        artist_acknowledged_at: null,
      });
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setRevisionSubmitting(false);
    }
  }

  function renderRevisionRequestUi() {
    if (isManaged || !hasPlanIdeas || isPlanBeingPrepared) return null;

    if (revision?.status === "pending" || revisionSent) {
      return (
        <p className="mt-8 text-sm text-muted">
          Revision requested — we&apos;ll review it shortly.
        </p>
      );
    }

    if (
      revision?.status === "approved" &&
      !revision.artist_acknowledged_at
    ) {
      return (
        <div className="mt-8 flex flex-col gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-relaxed text-emerald-100">
            Your revision is being prepared — we&apos;ll have it ready soon.
          </p>
          <button
            type="button"
            onClick={() => void handleAcknowledgeRevision()}
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/40 bg-transparent px-3 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition-colors hover:border-emerald-400"
          >
            Dismiss
          </button>
        </div>
      );
    }

    if (
      revision?.status === "declined" &&
      !revision.artist_acknowledged_at
    ) {
      return (
        <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm leading-relaxed text-amber-100">
                Revision not applied this week.
              </p>
              {revision.admin_note?.trim() ? (
                <p className="mt-2 text-xs leading-relaxed text-amber-100/80">
                  {revision.admin_note.trim()}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void handleAcknowledgeRevision()}
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-transparent px-3 text-xs font-semibold uppercase tracking-wide text-amber-100 transition-colors hover:border-amber-400"
            >
              Dismiss
            </button>
          </div>
        </div>
      );
    }

    if (showRevisionForm) {
      return (
        <div className="mt-8 rounded-xl border border-card-border bg-card p-5">
          <label className="block">
            <span className="text-sm text-muted">
              What would you like changed?
            </span>
            <textarea
              value={revisionNote}
              onChange={(e) => setRevisionNote(e.target.value)}
              placeholder="What would you like changed?"
              maxLength={500}
              rows={3}
              className="mt-2 w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSubmitRevisionRequest()}
              disabled={revisionSubmitting}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-brand px-4 text-xs font-black uppercase tracking-wide text-brand-foreground transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {revisionSubmitting ? "Sending…" : "Send request"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowRevisionForm(false);
                setRevisionNote("");
              }}
              disabled={revisionSubmitting}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-card-border bg-transparent px-4 text-xs font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={() => {
          setShowRevisionForm(true);
          setError(null);
        }}
        className="mt-8 text-sm text-muted transition-colors hover:text-foreground"
      >
        Not quite right? Request a revision →
      </button>
    );
  }

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
    setShowQuestionsModal(true);
  }

  let headerRight: ReactNode = null;
  let headerRightIsButton = false;

  if (!isPlanBeingPrepared && !isManaged) {
    if (canGenerate && !hasPlanIdeas) {
      headerRight = (
        <button
          id="dashboard-generate-plan"
          type="button"
          onClick={requestGenerate}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-5 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate my weekly plan"}
        </button>
      );
      headerRightIsButton = true;
    } else if (freePlanNoIdeasYet) {
      headerRight = auditPending ? (
        <Link
          href="/pricing"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-card-border bg-card px-5 text-sm font-black uppercase tracking-wide text-foreground shadow-sm transition-colors hover:border-brand"
        >
          Upgrade
        </Link>
      ) : hasAudit ? (
        <Link
          href="/pricing"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-5 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95"
        >
          Upgrade
        </Link>
      ) : (
        <Link
          href="/settings"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-card-border bg-card px-5 text-sm font-black uppercase tracking-wide text-foreground shadow-sm transition-colors hover:border-brand"
        >
          Go to settings
        </Link>
      );
      headerRightIsButton = true;
    } else if (!(canGenerate && hasPlanIdeas)) {
      headerRight = (
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
      );
      headerRightIsButton = true;
    }
  }

  return (
    <section className="mt-12">
      {hasJustRegistered && !hasInstagram && !auditPending ? (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-sm leading-relaxed text-amber-100">
            Welcome to Tempo. Add your Instagram handle in{" "}
            <Link
              href="/settings"
              className="font-semibold underline underline-offset-4 hover:text-amber-50"
            >
              Settings
            </Link>{" "}
            to run your free audit and unlock your content plan.
          </p>
        </div>
      ) : null}

      {hasJustUpgraded && !hasPlanIdeas ? (
        <div className="mb-6 rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-4 py-3">
          <p className="text-sm leading-relaxed text-emerald-100">
            Welcome to Tempo Pro. Generate your first plan below.
          </p>
        </div>
      ) : null}

      <div
        className={
          headerRightIsButton
            ? "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
            : "flex flex-col gap-3"
        }
      >
        <div>
          <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
            Your weekly plan
          </h2>
          <p className="mt-1 text-sm text-muted">
            Five ideas shaped by your profile, dates, and Instagram audit.
          </p>
          {canReview && hasPlanIdeas ? (
            <p className="mt-1 text-xs text-muted">
              Pro includes expert feedback on your ideas before you post.
            </p>
          ) : null}
          {canReview ? (
            <p className="mt-1 text-xs text-muted">
              Content reviews: {reviewsUsedThisMonth} / {reviewLimit} used this
              month
            </p>
          ) : null}
          <p className="mt-2 text-sm text-muted">
            {upcomingEventsCount > 0 ? (
              <>Plan shaped by {upcomingEventsCount} upcoming events.</>
            ) : (
              <>No upcoming dates — add some to get more specific ideas.</>
            )}
          </p>
          {!headerRightIsButton && headerRight ? (
            <div className="mt-3">{headerRight}</div>
          ) : null}
        </div>
        {headerRightIsButton && headerRight ? headerRight : null}
      </div>

      {ideas?.length ? (
        <>
          <ul className="mt-6 flex flex-col gap-5">
            {ideas.map((idea, i) => (
              <li key={`${idea.hook}-${i}`}>
                {(() => {
                  const reviewForThisIdea =
                    reviews.find((r) => r.idea_hook === idea.hook) ?? null;
                  return (
                    <IdeaCard
                      idea={idea}
                      onRate={handleRate}
                      initialRating={initialIdeaRatings[idea.hook] ?? null}
                      canReview={canReview}
                      reviewForThisIdea={reviewForThisIdea}
                      reviewLimitReached={reviewLimitReached}
                      plan={plan}
                      onSubmitReview={
                        canReview && !reviewLimitReached
                          ? async (ideaParam, file) => {
                              try {
                                await handleSubmitReview(ideaParam, file);
                              } catch (e) {
                                const msg =
                                  e instanceof Error
                                    ? e.message
                                    : "Could not submit for review.";
                                setError(msg);
                                throw e;
                              }
                            }
                          : undefined
                      }
                    />
                  );
                })()}
              </li>
            ))}
          </ul>
          {renderRevisionRequestUi()}
        </>
      ) : isPlanBeingPrepared ? (
        <div className="mt-6 rounded-xl border border-card-border bg-card p-5">
          <div className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
            <p className="text-sm leading-relaxed text-muted">
              Your plan for this week is being prepared — you&apos;ll get an email
              when it&apos;s ready.
            </p>
          </div>
        </div>
      ) : isManaged && !hasPlanIdeas ? (
        <div className="mt-6 rounded-xl border border-dashed border-card-border bg-input p-10 text-center">
          <div className="py-8 text-center">
            <p className="text-sm font-semibold text-foreground">
              Your plan arrives every Monday.
            </p>
            <p className="mt-1 text-sm text-muted">
              Check your email on Friday for your weekly check-in.
            </p>
          </div>
        </div>
      ) : !loading ? (
        <div className="mt-6 rounded-xl border border-dashed border-card-border bg-input p-10 text-center">
          <p className="text-sm leading-relaxed text-muted">
            {freePlanNoIdeasYet ? (
              auditPending ? (
                "Your audit is running — upgrade to get your personalised plan when it's ready."
              ) : hasAudit ? (
                "Your audit is ready! Upgrade to generate your personalised content plan."
              ) : (
                "Complete your profile to get started."
              )
            ) : !auditPending && !hasAudit && !hasPlanIdeas ? (
              hasInstagram
                ? "Run your audit above to get a personalised content plan."
                : "Add your Instagram handle in Settings to get started."
            ) : (
              "No plan for this week yet. Generate tailored ideas from your profile, dates, and Instagram audit."
            )}
          </p>
          <div className="mt-6 flex justify-center">
            {freePlanNoIdeasYet ? (
              auditPending || hasAudit ? (
                <Link
                  href="/pricing"
                  className={
                    hasAudit
                      ? "inline-flex h-11 min-w-[200px] items-center justify-center rounded-lg bg-brand px-8 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95"
                      : "inline-flex h-11 min-w-[200px] items-center justify-center rounded-lg border border-card-border bg-card px-8 text-sm font-black uppercase tracking-wide text-foreground shadow-sm transition-colors hover:border-brand"
                  }
                >
                  Upgrade
                </Link>
              ) : (
                <Link
                  href="/settings"
                  className="inline-flex h-11 min-w-[200px] items-center justify-center rounded-lg border border-card-border bg-card px-8 text-sm font-black uppercase tracking-wide text-foreground shadow-sm transition-colors hover:border-brand"
                >
                  Go to settings
                </Link>
              )
            ) : canGenerate ? (
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

      {!hideUpcomingThisWeek ? (
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
      ) : null}

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
    </section>
  );
}
