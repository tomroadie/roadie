"use client";

import { useMemo, useState, type ReactNode } from "react";

export type PrepArtist = {
  id: string;
  artist_name: string;
  genre: string;
  instagram_handle: string;
  followers: number | null;
  has_audit: boolean;
};

type CallBrief = {
  situation: string;
  instagram_health: string;
  biggest_opportunity: string;
  roadie_fit: {
    primary_service:
      | "release_support"
      | "tour_support"
      | "content_social"
      | "all_three";
    reasoning: string;
    suggested_plan: "starter" | "pro" | "label";
    plan_reasoning: string;
  };
  talking_points: string[];
  suggested_questions: string[];
  red_flags: string[];
  one_liner: string;
};

function formatFollowers(count: number | null): string {
  if (count === null || !Number.isFinite(count)) return "—";
  return count.toLocaleString();
}

function formatHandle(handle: string): string {
  const trimmed = handle.trim().replace(/^@/, "");
  return trimmed ? `@${trimmed}` : "—";
}

function primaryServiceLabel(
  service: CallBrief["roadie_fit"]["primary_service"]
): string {
  switch (service) {
    case "release_support":
      return "Release Support";
    case "tour_support":
      return "Tour Support";
    case "content_social":
      return "Content & Social";
    case "all_three":
      return "Full Service";
  }
}

function planLabel(plan: CallBrief["roadie_fit"]["suggested_plan"]): string {
  switch (plan) {
    case "starter":
      return "Starter";
    case "pro":
      return "Pro";
    case "label":
      return "Label";
  }
}

function planPillClass(plan: CallBrief["roadie_fit"]["suggested_plan"]): string {
  switch (plan) {
    case "starter":
      return "bg-blue-500/15 text-blue-300 ring-blue-400/30";
    case "pro":
      return "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30";
    case "label":
      return "bg-purple-500/15 text-purple-300 ring-purple-400/30";
  }
}

function buildFullBriefText(artistName: string, brief: CallBrief): string {
  const lines = [
    `Call brief — ${artistName}`,
    "",
    "THE SITUATION",
    brief.situation,
    "",
    "INSTAGRAM HEALTH",
    brief.instagram_health,
    "",
    "BIGGEST OPPORTUNITY",
    brief.biggest_opportunity,
    "",
    "TEMPO FIT",
    `Primary service: ${primaryServiceLabel(brief.roadie_fit.primary_service)}`,
    `Suggested plan: ${planLabel(brief.roadie_fit.suggested_plan)}`,
    brief.roadie_fit.reasoning,
    brief.roadie_fit.plan_reasoning,
    "",
    "TALKING POINTS",
    ...brief.talking_points.map((point, i) => `${i + 1}. ${point}`),
    "",
    "SUGGESTED QUESTIONS",
    ...brief.suggested_questions.map((question, i) => `${i + 1}. ${question}`),
  ];

  if (brief.red_flags.length > 0) {
    lines.push(
      "",
      "RED FLAGS",
      ...brief.red_flags.map((flag, i) => `${i + 1}. ${flag}`)
    );
  }

  lines.push("", "OPEN WITH", `"${brief.one_liner}"`);

  return lines.join("\n");
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-widest text-brand">
      {children}
    </h3>
  );
}

function BriefSkeleton() {
  return (
    <div className="mt-8 space-y-5">
      <p className="text-sm text-muted animate-pulse">
        Generating your call brief...
      </p>
      <div className="space-y-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="rounded-xl border border-card-border bg-card p-6"
          >
            <div className="h-3 w-32 animate-pulse rounded bg-zinc-800" />
            <div className="mt-4 space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-zinc-800" />
              <div className="h-4 w-full animate-pulse rounded bg-zinc-800" />
              <div className="h-4 w-[70%] animate-pulse rounded bg-zinc-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type PrepSectionProps = {
  artists: PrepArtist[];
};

export function PrepSection({ artists }: PrepSectionProps) {
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [brief, setBrief] = useState<CallBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedFull, setCopiedFull] = useState(false);
  const [copiedOpener, setCopiedOpener] = useState(false);

  const selectedArtist = useMemo(
    () => artists.find((artist) => artist.id === selectedArtistId) ?? null,
    [artists, selectedArtistId]
  );

  async function handlePrepareBrief(artistId: string) {
    setSelectedArtistId(artistId);
    setBrief(null);
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/generate-brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ artist_id: artistId }),
      });

      const data = (await res.json()) as CallBrief & {
        error?: string;
        details?: string;
      };

      if (!res.ok) {
        throw new Error(
          data.details
            ? `${data.error ?? "Request failed"}: ${data.details}`
            : data.error ?? "Request failed"
        );
      }

      setBrief(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to generate brief";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setSelectedArtistId(null);
    setBrief(null);
    setError(null);
    setCopiedFull(false);
    setCopiedOpener(false);
  }

  async function handleCopyFull() {
    if (!brief || !selectedArtist) return;
    try {
      await navigator.clipboard.writeText(
        buildFullBriefText(selectedArtist.artist_name.trim() || "Artist", brief)
      );
      setCopiedFull(true);
      window.setTimeout(() => setCopiedFull(false), 1500);
    } catch {
      // ignore
    }
  }

  async function handleCopyOpener() {
    if (!brief) return;
    try {
      await navigator.clipboard.writeText(brief.one_liner);
      setCopiedOpener(true);
      window.setTimeout(() => setCopiedOpener(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {artists.map((artist) => {
          const isSelected = selectedArtistId === artist.id;
          const isBusy = loading && isSelected;

          return (
            <article
              key={artist.id}
              className={[
                "flex flex-col rounded-xl border border-card-border bg-card p-6 shadow-sm transition-all",
                isSelected && brief
                  ? "ring-1 ring-brand/40"
                  : "hover:border-brand/30",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold text-foreground">
                    {artist.artist_name.trim() || "Untitled artist"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-strong">
                    {artist.genre.trim() || "—"}
                  </p>
                </div>
                {!artist.has_audit ? (
                  <span className="shrink-0 rounded-full bg-input px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted ring-1 ring-inset ring-card-border">
                    No audit yet
                  </span>
                ) : null}
              </div>

              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Instagram</dt>
                  <dd className="font-mono text-xs text-muted-strong">
                    {formatHandle(artist.instagram_handle)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Followers</dt>
                  <dd className="font-semibold text-foreground">
                    {formatFollowers(artist.followers)}
                  </dd>
                </div>
              </dl>

              <button
                type="button"
                disabled={loading}
                onClick={() => void handlePrepareBrief(artist.id)}
                className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand px-4 text-xs font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isBusy ? "Generating…" : "Prepare brief"}
              </button>
            </article>
          );
        })}
      </div>

      {artists.length === 0 ? (
        <p className="rounded-xl border border-dashed border-card-border bg-input p-10 text-center text-sm text-muted">
          No artists available.
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? <BriefSkeleton /> : null}

      {brief && selectedArtist ? (
        <section className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand">
                Call brief
              </p>
              <h2 className="mt-1 text-xl font-black uppercase tracking-tight text-foreground">
                {selectedArtist.artist_name.trim() || "Artist"}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleCopyFull()}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-card-border bg-transparent px-4 text-xs font-bold uppercase tracking-wide text-foreground transition-colors hover:border-brand"
              >
                {copiedFull ? "Copied" : "Copy full brief"}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-xs font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95"
              >
                Generate new brief
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-card-border bg-card p-6">
            <SectionHeading>The situation</SectionHeading>
            <p className="mt-3 text-sm leading-relaxed text-muted-strong">
              {brief.situation}
            </p>
          </div>

          <div className="rounded-xl border border-card-border bg-card p-6">
            <SectionHeading>Instagram health</SectionHeading>
            <p className="mt-3 text-sm leading-relaxed text-muted-strong">
              {brief.instagram_health}
            </p>
          </div>

          <div className="rounded-xl border border-brand/30 bg-brand/10 p-6">
            <SectionHeading>Biggest opportunity</SectionHeading>
            <p className="mt-3 text-sm leading-relaxed text-foreground">
              {brief.biggest_opportunity}
            </p>
          </div>

          <div className="rounded-xl border border-card-border bg-card p-6">
            <SectionHeading>Tempo fit</SectionHeading>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-lg bg-input px-4 py-2 text-sm font-black uppercase tracking-wide text-foreground ring-1 ring-inset ring-brand/30">
                {primaryServiceLabel(brief.roadie_fit.primary_service)}
              </span>
              <span
                className={[
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ring-1 ring-inset",
                  planPillClass(brief.roadie_fit.suggested_plan),
                ].join(" ")}
              >
                {planLabel(brief.roadie_fit.suggested_plan)}
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-strong">
              {brief.roadie_fit.reasoning}
            </p>
            <p className="mt-3 text-sm text-muted">
              {brief.roadie_fit.plan_reasoning}
            </p>
          </div>

          <div className="rounded-xl border border-card-border bg-card p-6">
            <SectionHeading>Talking points</SectionHeading>
            <ol className="mt-4 space-y-3">
              {brief.talking_points.map((point, index) => (
                <li
                  key={`${index}-${point.slice(0, 24)}`}
                  className="flex gap-3 rounded-lg bg-input px-4 py-3 text-sm leading-relaxed text-muted-strong"
                >
                  <span className="shrink-0 font-black text-brand">
                    {index + 1}.
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl border border-card-border bg-card p-6">
            <SectionHeading>Suggested questions</SectionHeading>
            <ol className="mt-4 space-y-3">
              {brief.suggested_questions.map((question, index) => (
                <li
                  key={`${index}-${question.slice(0, 24)}`}
                  className="border-l-2 border-card-border pl-4 text-sm leading-relaxed text-muted-strong"
                >
                  <span className="mr-2 font-black text-brand">{index + 1}.</span>
                  {question}
                </li>
              ))}
            </ol>
          </div>

          {brief.red_flags.length > 0 ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
              <SectionHeading>Red flags</SectionHeading>
              <ul className="mt-4 space-y-2">
                {brief.red_flags.map((flag, index) => (
                  <li
                    key={`${index}-${flag.slice(0, 24)}`}
                    className="flex gap-2 text-sm leading-relaxed text-amber-100/90"
                  >
                    <span aria-hidden className="text-amber-400">
                      ⚠
                    </span>
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-xl border border-card-border bg-card p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <SectionHeading>Open with</SectionHeading>
              <button
                type="button"
                onClick={() => void handleCopyOpener()}
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-card-border bg-transparent px-3 text-xs font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-brand"
              >
                {copiedOpener ? "Copied" : "Copy"}
              </button>
            </div>
            <blockquote className="mt-4 text-lg font-semibold leading-relaxed text-brand">
              &ldquo;{brief.one_liner}&rdquo;
            </blockquote>
          </div>
        </section>
      ) : null}
    </div>
  );
}
