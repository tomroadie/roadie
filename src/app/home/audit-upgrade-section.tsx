import Link from "next/link";
import {
  extractNextMoveTeasers,
  type ParsedAnalysisSection,
} from "@/lib/parse-full-analysis";

type AuditUpgradeSectionProps = {
  sections: ParsedAnalysisSection[];
};

export function AuditUpgradeSection({ sections }: AuditUpgradeSectionProps) {
  const teasers = extractNextMoveTeasers(sections);

  return (
    <section className="mt-8 rounded-xl border-2 border-brand/40 bg-brand/5 p-7">
      <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
        Turn this insight into action every week
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-strong">
        Your audit shows what your audience responds to. Tempo Pro turns that
        into a clear weekly plan, with 5 specific post ideas every Monday built
        around the patterns working on your account.
      </p>

      {teasers.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-widest text-brand">
            What we&apos;d focus on next
          </p>
          <ul className="mt-3 space-y-2">
            {teasers.map((teaser, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm leading-relaxed text-muted-strong"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                <span>{teaser}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Link
        href="/pricing"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-brand px-6 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95"
      >
        Start your 14-day free trial
      </Link>
      <p className="mt-2 text-xs text-muted">Cancel anytime</p>
    </section>
  );
}
