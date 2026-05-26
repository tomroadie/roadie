"use client";

import Link from "next/link";

type Props = {
  hasCheckin: boolean;
  hasPlan: boolean;
  instagramHandle: string | null;
  onGeneratePlan?: () => void;
};

export function FirstRunChecklist({
  hasCheckin,
  hasPlan,
  instagramHandle,
  onGeneratePlan,
}: Props) {
  const step1Done = true;
  const step2Done = hasCheckin;
  const step3Done = hasPlan;
  const step4Done = Boolean(instagramHandle?.trim());

  function defaultGeneratePlan() {
    const el = document.getElementById("dashboard-generate-plan");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      (el as HTMLElement).click?.();
    }, 250);
  }

  return (
    <section
      className="mt-10 rounded-xl border border-card-border bg-card p-6"
      aria-labelledby="first-run-checklist-title"
    >
      <h2
        id="first-run-checklist-title"
        className="text-sm font-black uppercase tracking-tight text-foreground"
      >
        Get your first plan
      </h2>
      <ul className="mt-4 space-y-3 text-sm">
        <li className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-brand" aria-hidden>
            ✓
          </span>
          <span className="text-muted-strong">Profile set up</span>
        </li>
        <li className="flex items-start gap-3">
          <span
            className={`mt-0.5 shrink-0 ${step2Done ? "text-brand" : "text-muted"}`}
            aria-hidden
          >
            {step2Done ? "✓" : "+"}
          </span>
          {step2Done ? (
            <span className="text-muted-strong">Answer your weekly check-in</span>
          ) : (
            <Link
              href="/checkin"
              className="font-medium text-foreground underline-offset-4 hover:text-brand hover:underline"
            >
              Answer your weekly check-in
            </Link>
          )}
        </li>
        <li className="flex items-start gap-3">
          <span
            className={`mt-0.5 shrink-0 ${step3Done ? "text-brand" : "text-muted"}`}
            aria-hidden
          >
            {step3Done ? "✓" : "+"}
          </span>
          {step3Done ? (
            <span className="text-muted-strong">Generate your first plan</span>
          ) : (
            <button
              type="button"
              onClick={() => (onGeneratePlan ? onGeneratePlan() : defaultGeneratePlan())}
              className="font-medium text-foreground underline-offset-4 hover:text-brand hover:underline"
            >
              Generate your first plan
            </button>
          )}
        </li>
        {!step4Done ? (
          <li className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 text-muted" aria-hidden>
              +
            </span>
            <Link
              href="/settings"
              className="font-medium text-foreground underline-offset-4 hover:text-brand hover:underline"
            >
              Connect Instagram for a personalised audit
            </Link>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
