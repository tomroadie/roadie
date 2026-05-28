"use client";

import { useEffect, useState } from "react";
import type { ParsedAnalysisSection } from "@/lib/parse-full-analysis";

function sectionAccent(title: string): { border: string; label: string } {
  const t = title.toLowerCase();
  if (t.includes("position")) return { border: "border-l-purple-400", label: "text-purple-200" };
  if (t.includes("content")) return { border: "border-l-sky-400", label: "text-sky-200" };
  if (t.includes("engagement")) return { border: "border-l-teal-400", label: "text-teal-200" };
  if (t.includes("core")) return { border: "border-l-amber-400", label: "text-amber-200" };
  if (t.includes("opportun")) return { border: "border-l-emerald-400", label: "text-emerald-200" };
  return { border: "border-l-zinc-600", label: "text-foreground" };
}

function analysisSeenKey(artistId: string): string {
  return `roadie_analysis_seen_${artistId}`;
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

type FullAnalysisCollapsibleProps = {
  sections: ParsedAnalysisSection[];
  artistId: string;
  updatedAt?: string | null;
};

export function FullAnalysisCollapsible({
  sections,
  artistId,
  updatedAt = null,
}: FullAnalysisCollapsibleProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const key = analysisSeenKey(artistId);
    const seen = localStorage.getItem(key);
    if (!seen) {
      localStorage.setItem(key, "true");
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [artistId]);

  if (sections.length === 0) return null;

  return (
    <section className="rounded-xl border border-card-border bg-card p-7">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
            Full analysis
          </h2>
          {updatedAt ? (
            <p className="mt-1 text-xs text-muted">
              Last updated {formatRelativeDate(updatedAt)}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 text-sm font-semibold text-brand">
          {open ? "Hide full analysis ▴" : "Show full analysis ▾"}
        </span>
      </button>
      {open ? (
        <div className="mt-5 space-y-4">
          {sections.map((sec, i) => {
            const a = sectionAccent(sec.title);
            return (
              <div
                key={`${sec.title}-${i}`}
                className={`rounded-xl border border-card-border bg-input p-6 ${a.border} border-l-4`}
              >
                <h3 className={`text-sm font-bold uppercase tracking-widest ${a.label}`}>
                  {sec.title}
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-strong">
                  {sec.body}
                </p>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
