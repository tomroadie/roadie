"use client";

import type { ContentIdea } from "@/types/content-plan";
import { useMemo, useState } from "react";
import type { EventRow } from "@/types/event";
import Link from "next/link";
import { canDo, normalizePlan } from "@/lib/plan-limits";

type Accent = {
  border: string;
  pill: string;
  label: string;
};

function getAccent(format: string): Accent {
  const f = format.trim().toLowerCase();
  if (f.includes("reel")) {
    return {
      border: "border-l-[#7C3AED]",
      pill: "bg-purple-50 text-purple-700 ring-purple-200",
      label: "text-purple-700",
    };
  }
  if (f.includes("carousel")) {
    return {
      border: "border-l-blue-500",
      pill: "bg-blue-50 text-blue-700 ring-blue-200",
      label: "text-blue-700",
    };
  }
  if (f.includes("story")) {
    return {
      border: "border-l-teal-500",
      pill: "bg-teal-50 text-teal-700 ring-teal-200",
      label: "text-teal-700",
    };
  }
  if (f.includes("video")) {
    return {
      border: "border-l-amber-500",
      pill: "bg-amber-50 text-amber-800 ring-amber-200",
      label: "text-amber-800",
    };
  }
  return {
    border: "border-l-zinc-300 dark:border-l-zinc-700",
    pill: "bg-zinc-50 text-zinc-700 ring-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-200 dark:ring-zinc-800",
    label: "text-slate-600 dark:text-slate-300",
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

function IdeaCard({ idea }: { idea: ContentIdea }) {
  const [copied, setCopied] = useState(false);
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

  return (
    <article
      className={`relative overflow-hidden rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-transform duration-150 hover:translate-y-[-1px] dark:bg-zinc-950 ${accent.border} border-l-4`}
    >
      <div className="flex min-w-0 items-start justify-between gap-4">
        <span
          className={`inline-flex h-6 max-w-full items-center rounded-full px-2.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${accent.pill} overflow-hidden text-ellipsis whitespace-nowrap`}
        >
          {idea.format}
        </span>
      </div>

      <h3 className="mt-4 text-xl font-bold leading-snug text-foreground">
        {idea.hook}
      </h3>

      <p className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-300">
        {idea.caption}
      </p>

      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt
            className={`text-xs font-semibold uppercase tracking-widest ${accent.label}`}
          >
            Why
          </dt>
          <dd className="mt-1 text-slate-600 dark:text-slate-400">{idea.why}</dd>
        </div>
        <div>
          <dt
            className={`text-xs font-semibold uppercase tracking-widest ${accent.label}`}
          >
            Timing
          </dt>
          <dd className="mt-1 text-slate-600 dark:text-slate-400">
            {idea.timing}
          </dd>
        </div>
      </dl>

      <div className="mt-6">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-[#7C3AED]/40 bg-transparent px-4 text-sm font-semibold text-[#7C3AED] shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-colors hover:border-[#7C3AED]/60 hover:bg-purple-50 sm:w-auto dark:hover:bg-purple-950/20"
        >
          {copied ? "Copied" : "Copy idea"}
        </button>
      </div>
    </article>
  );
}

type WeeklyPlanSectionProps = {
  initialIdeas: ContentIdea[] | null;
  upcomingEventsCount: number;
  lastGeneratedAt: string | null;
  upcomingThisWeek: EventRow[];
  plan: string;
};

function hoursSince(iso: string): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return (Date.now() - t) / (1000 * 60 * 60);
}

type ConfirmKind = "no-dates" | "recent-plan";

export function WeeklyPlanSection({
  initialIdeas,
  upcomingEventsCount,
  lastGeneratedAt,
  upcomingThisWeek,
  plan,
}: WeeklyPlanSectionProps) {
  const [ideas, setIdeas] = useState<ContentIdea[] | null>(initialIdeas);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const normalizedPlan = normalizePlan(plan);
  const canGenerate = canDo(normalizedPlan, "canGeneratePlan");

  async function runGenerate() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        credentials: "same-origin",
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
    void runGenerate();
  }

  async function confirmGenerateAnyway() {
    setConfirm(null);
    await runGenerate();
  }

  return (
    <section className="mt-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Your weekly plan
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Five ideas shaped by your profile, dates, and Instagram audit.
          </p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {upcomingEventsCount > 0 ? (
              <>Plan shaped by {upcomingEventsCount} upcoming events.</>
            ) : (
              <>No upcoming dates — add some to get more specific ideas.</>
            )}
          </p>
        </div>
        {canGenerate ? (
          <button
            type="button"
            onClick={requestGenerate}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#7C3AED] px-5 text-sm font-semibold text-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-colors hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-50"
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
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-200 px-5 text-sm font-semibold text-zinc-700 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-colors hover:bg-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-200"
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
              <IdeaCard idea={idea} />
            </li>
          ))}
        </ul>
      ) : !loading ? (
        <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:border-zinc-700 dark:bg-zinc-950">
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            No plan for this week yet. Generate tailored ideas from your profile,
            dates, and Instagram audit.
          </p>
          <div className="mt-6 flex justify-center">
            {canGenerate ? (
              <button
                type="button"
                onClick={requestGenerate}
                disabled={loading}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[#7C3AED] px-5 text-sm font-semibold text-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-colors hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Generate my weekly plan
              </button>
            ) : (
              <Link
                href="/pricing"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-200 px-5 text-sm font-semibold text-zinc-700 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-colors hover:bg-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-200"
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
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Creating your plan…
        </p>
      )}

      <div className="mt-10 rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:bg-zinc-950">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Upcoming this week
        </p>
        {upcomingThisWeek.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {upcomingThisWeek.map((ev) => (
              <span
                key={ev.id}
                className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-200"
              >
                <span className="text-slate-500">
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
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Nothing scheduled this week —{" "}
            <Link href="/events" className="font-semibold text-[#7C3AED]">
              add a date
            </Link>
            .
          </p>
        )}
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {confirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
            <h3 className="text-base font-semibold text-foreground">
              {confirm === "no-dates"
                ? "Your dates are empty"
                : "Regenerate your plan?"}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
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
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:bg-zinc-50"
                >
                  Add dates
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setConfirm(null);
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:bg-zinc-50"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={() => void confirmGenerateAnyway()}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[#7C3AED] px-4 text-sm font-semibold text-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-colors hover:bg-[#6D28D9]"
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
