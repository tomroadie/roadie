"use client";

import type { ContentIdea } from "@/types/content-plan";
import { useMemo, useState } from "react";

function formatAccentClass(format: string): string {
  const f = format.trim().toLowerCase();
  if (f.includes("reel")) return "border-l-[#7C3AED]"; // purple
  if (f.includes("carousel")) return "border-l-blue-500";
  if (f.includes("story")) return "border-l-teal-500";
  if (f.includes("video")) return "border-l-amber-500";
  return "border-l-zinc-300 dark:border-l-zinc-700";
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
  const accent = useMemo(() => formatAccentClass(idea.format), [idea.format]);

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
      className={`relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-950 ${accent} border-l-4`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {idea.format}
          </p>
          <h3 className="mt-1 text-base font-semibold leading-snug text-foreground">
            {idea.hook}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {idea.caption}
      </p>

      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Why
          </dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{idea.why}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Timing
          </dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{idea.timing}</dd>
        </div>
      </dl>
    </article>
  );
}

type WeeklyPlanSectionProps = {
  initialIdeas: ContentIdea[] | null;
};

export function WeeklyPlanSection({ initialIdeas }: WeeklyPlanSectionProps) {
  const [ideas, setIdeas] = useState<ContentIdea[] | null>(initialIdeas);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
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

  return (
    <section className="mt-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Your weekly plan
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Five ideas shaped by your profile, dates, and Instagram audit.
          </p>
        </div>
        {!ideas?.length ? (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#7C3AED] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Generating…" : "Generate my weekly plan"}
          </button>
        ) : null}
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
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          No plan for this week yet. Generate tailored ideas from your profile
          and upcoming events.
        </p>
      ) : (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          Creating your plan…
        </p>
      )}

      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
