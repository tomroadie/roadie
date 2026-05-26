"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type FirstRunChecklistProps = {
  hasInstagram: boolean;
  hasAudit: boolean;
  hasPlanIdeas: boolean;
  hasRatedIdea: boolean;
  canGeneratePlan: boolean;
  isManaged: boolean;
  auditPending?: boolean;
};

function scrollToGeneratePlan() {
  const el = document.getElementById("dashboard-generate-plan");
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

function StepIndicator({ complete }: { complete: boolean }) {
  if (complete) {
    return (
      <span
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-bold text-brand"
        aria-hidden
      >
        ✓
      </span>
    );
  }
  return (
    <span
      className="mt-0.5 inline-flex h-2 w-2 shrink-0 rounded-full bg-zinc-600"
      aria-hidden
    />
  );
}

export function FirstRunChecklist({
  hasInstagram,
  hasAudit,
  hasPlanIdeas,
  hasRatedIdea,
  canGeneratePlan,
  isManaged,
  auditPending = false,
}: FirstRunChecklistProps) {
  const profileComplete = true;
  const showPlanStep = !isManaged;
  const showRateStep = canGeneratePlan && !isManaged;

  const allComplete =
    profileComplete &&
    hasInstagram &&
    hasAudit &&
    (isManaged || hasPlanIdeas) &&
    (!showRateStep || hasRatedIdea);

  if (allComplete) return null;

  type StepRow = {
    key: string;
    label: string;
    complete: boolean;
    detail: ReactNode;
  };

  const steps: StepRow[] = [
    {
      key: "profile",
      label: "Profile set up",
      complete: profileComplete,
      detail: null,
    },
    {
      key: "instagram",
      label: "Instagram connected",
      complete: hasInstagram,
      detail: hasInstagram ? null : (
        <Link
          href="/settings"
          className="text-xs text-muted underline-offset-4 hover:text-brand hover:underline"
        >
          Add in settings →
        </Link>
      ),
    },
    {
      key: "audit",
      label: "Audit complete",
      complete: hasAudit,
      detail: hasAudit ? null : auditPending ? (
        <span className="text-xs text-muted">running…</span>
      ) : (
        <a
          href="#audit-section"
          className="text-xs text-muted underline-offset-4 hover:text-brand hover:underline"
        >
          Run your audit →
        </a>
      ),
    },
  ];

  if (showPlanStep) {
    steps.push({
      key: "plan",
      label: "Content plan generated",
      complete: hasPlanIdeas,
      detail: hasPlanIdeas ? null : canGeneratePlan ? (
        <button
          type="button"
          onClick={scrollToGeneratePlan}
          className="text-xs text-muted underline-offset-4 hover:text-brand hover:underline"
        >
          Generate below →
        </button>
      ) : (
        <Link
          href="/pricing"
          className="text-xs text-muted underline-offset-4 hover:text-brand hover:underline"
        >
          Upgrade to unlock →
        </Link>
      ),
    });
  }

  if (showRateStep) {
    steps.push({
      key: "rate",
      label: "Rate your first idea",
      complete: hasRatedIdea,
      detail: hasRatedIdea ? null : (
        <span className="text-xs text-muted">👍 or 👎 an idea below</span>
      ),
    });
  }

  return (
    <section
      className="mt-8 rounded-xl border border-card-border bg-card p-5"
      aria-labelledby="first-run-checklist-title"
    >
      <h2
        id="first-run-checklist-title"
        className="text-xs font-bold uppercase tracking-widest text-brand"
      >
        Getting started
      </h2>
      <ol className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-3">
        {steps.map((step) => (
          <li
            key={step.key}
            className={`flex min-w-0 items-start gap-2.5 sm:max-w-[11rem] sm:flex-1 sm:flex-col sm:gap-1.5 ${
              step.complete ? "opacity-80" : ""
            }`}
          >
            <div className="flex items-center gap-2.5">
              <StepIndicator complete={step.complete} />
              <span
                className={`text-sm ${
                  step.complete ? "text-muted-strong" : "text-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
            {step.detail ? <div className="pl-7 sm:pl-0">{step.detail}</div> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
