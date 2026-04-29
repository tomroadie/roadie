"use client";

import type { ContentIdea } from "@/types/content-plan";
import { useState } from "react";

function IdeaCard({ idea }: { idea: ContentIdea }) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-background p-5 dark:border-zinc-800">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {idea.format}
      </p>
      <h3 className="mt-1 text-base font-semibold text-foreground">
        {idea.hook}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {idea.caption}
      </p>
      <dl className="mt-4 space-y-2 text-sm">
        <div>
          <dt className="font-medium text-foreground">Why</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{idea.why}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Timing</dt>
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Your weekly plan
        </h2>
        {!ideas?.length ? (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Generating…" : "Generate my weekly plan"}
          </button>
        ) : null}
      </div>

      {ideas?.length ? (
        <ul className="mt-6 flex flex-col gap-4">
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
