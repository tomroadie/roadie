"use client";

import { useState } from "react";
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

type FullAnalysisCollapsibleProps = {
  sections: ParsedAnalysisSection[];
};

export function FullAnalysisCollapsible({ sections }: FullAnalysisCollapsibleProps) {
  const [open, setOpen] = useState(false);

  if (sections.length === 0) return null;

  return (
    <section className="rounded-xl border border-card-border bg-card p-7">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
          Full analysis
        </h2>
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
