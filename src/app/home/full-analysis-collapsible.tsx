"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ParsedAnalysisSection } from "@/lib/parse-full-analysis";

function sectionStyle(title: string): { container: string; label: string } {
  const t = title.toLowerCase();

  if (t.includes("biggest missed")) {
    return {
      container: "rounded-xl border border-amber-500/30 bg-amber-500/10 p-6",
      label: "text-xs font-bold uppercase tracking-widest text-amber-400",
    };
  }

  if (
    t.includes("position") ||
    t.includes("content") ||
    t.includes("engagement") ||
    t.includes("next move") ||
    t.includes("opportun")
  ) {
    return {
      container: "rounded-xl border border-brand/30 bg-brand/10 p-6",
      label: "text-xs font-bold uppercase tracking-widest text-brand",
    };
  }

  if (t.includes("core")) {
    return {
      container: "rounded-xl border border-amber-500/30 bg-amber-500/10 p-6",
      label: "text-xs font-bold uppercase tracking-widest text-amber-400",
    };
  }

  return {
    container: "rounded-xl border border-card-border bg-input p-6",
    label: "text-sm font-bold uppercase tracking-widest text-foreground",
  };
}

function isBiggestMissedOpportunity(title: string): boolean {
  return title.toLowerCase().includes("biggest missed");
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
  canGeneratePlan?: boolean;
};

export function FullAnalysisCollapsible({
  sections,
  artistId,
  updatedAt = null,
  canGeneratePlan = true,
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
            const style = sectionStyle(sec.title);
            return (
              <div key={`${sec.title}-${i}`} className={style.container}>
                <h3 className={style.label}>{sec.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-strong">
                  {sec.body}
                </p>
                {isBiggestMissedOpportunity(sec.title) && !canGeneratePlan ? (
                  <div className="mt-4 rounded-lg border border-brand/30 bg-brand/10 p-4">
                    <p className="text-sm font-semibold text-foreground">
                      Turn this insight into action every week.
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      Your weekly plan is built around exactly these patterns — 5
                      specific ideas every Monday shaped by what&apos;s actually
                      working for your account.
                    </p>
                    <Link
                      href="/pricing"
                      className="mt-3 inline-flex h-9 items-center justify-center rounded-lg bg-brand px-4 text-xs font-black uppercase tracking-wide text-brand-foreground transition-colors hover:brightness-95"
                    >
                      Unlock your weekly plan →
                    </Link>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
