"use client";

import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { trackBeginCheckout } from "@/lib/analytics";
import {
  FREE_PLAN_CARD,
  planDisplayValue,
  PUBLIC_PAID_PLANS,
  type PublicPaidPlanKey,
} from "@/lib/plan-display";
import { normalizePlan, type RoadiePlan } from "@/lib/plan-limits";

type PriceIds = { starter: string; pro: string; label: string };

export default function PricingClient({
  priceIds,
  currentPlan,
}: {
  priceIds: PriceIds;
  currentPlan: RoadiePlan;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loadingPlan, setLoadingPlan] = useState<PublicPaidPlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const normalizedCurrent = normalizePlan(currentPlan);

  async function startCheckout(plan: PublicPaidPlanKey) {
    trackBeginCheckout(plan, planDisplayValue(plan));
    setError(null);
    setLoadingPlan(plan);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoadingPlan(null);
      router.push("/login?redirect=/pricing");
      return;
    }

    // Internal Stripe keys: Tempo Pro → pro, Teams → label. Starter removed from public checkout.
    const priceId = priceIds[plan];
    if (!priceId) {
      setError("Missing Stripe price ID for this plan.");
      setLoadingPlan(null);
      return;
    }

    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ priceId }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as
        | { error?: string; details?: string }
        | null;
      setError(data?.error ?? "Failed to start checkout.");
      setLoadingPlan(null);
      return;
    }

    const data = (await res.json()) as { url: string };
    if (!data.url) {
      setError("Checkout URL was missing.");
      setLoadingPlan(null);
      return;
    }

    window.location.assign(data.url);
  }

  const isOnFree = normalizedCurrent === "free";

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">
          Pricing
        </p>
        <h1 className="text-4xl font-black uppercase tracking-tight text-foreground sm:text-5xl">
          Your music deserves a real content strategy
        </h1>
        {isOnFree ? (
          <p className="mt-3 text-sm text-muted">You&apos;re on the free plan</p>
        ) : null}
        <p className="max-w-2xl text-base text-muted">
          Start with a free Instagram audit. Upgrade to Tempo Pro when you&apos;re
          ready to turn that diagnosis into a weekly plan.
        </p>
      </div>

      <div
        className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center text-xs font-bold uppercase tracking-widest text-muted"
        aria-label="Highlights"
      >
        <span>5 ideas every Monday</span>
        <span aria-hidden className="hidden sm:inline">
          ·
        </span>
        <span>Based on your real Instagram data</span>
        <span aria-hidden className="hidden sm:inline">
          ·
        </span>
        <span>Cancels anytime</span>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <div className="relative flex h-full min-w-0 flex-col rounded-xl border border-card-border bg-card p-6 shadow-sm">
          <div className="space-y-2">
            {isOnFree ? (
              <div className="mb-2 inline-flex w-fit rounded-full bg-brand px-3 py-1 text-xs font-black uppercase tracking-wide text-brand-foreground">
                Current plan
              </div>
            ) : null}
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground">
              {FREE_PLAN_CARD.name}
            </h2>
            <p className="text-3xl font-black tracking-tight text-foreground">
              {FREE_PLAN_CARD.price}
            </p>
            <p className="text-sm leading-relaxed text-muted">{FREE_PLAN_CARD.blurb}</p>
          </div>
          <ul className="mt-5 space-y-2 text-sm text-muted-strong">
            {FREE_PLAN_CARD.features.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-auto pt-6">
            {isOnFree ? (
              <div className="flex h-11 w-full items-center justify-center rounded-lg border border-card-border px-4 text-sm font-black uppercase tracking-wide text-muted">
                Current plan
              </div>
            ) : (
              <Link
                href="/home"
                className="flex h-11 w-full items-center justify-center rounded-lg border border-card-border bg-transparent px-4 text-sm font-black uppercase tracking-wide text-foreground shadow-sm transition-colors hover:border-brand"
              >
                Run free audit
              </Link>
            )}
          </div>
        </div>

        {PUBLIC_PAID_PLANS.map((p) => {
          const isPopular = p.key === "pro";
          const isCurrent = normalizedCurrent === p.key;

          const ctaLabel = isCurrent ? "Current plan" : "Start your 14-day free trial";

          const ctaButtonClass = [
            "flex h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-black uppercase tracking-wide shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            isPopular
              ? "bg-brand text-brand-foreground hover:brightness-95"
              : "border border-card-border bg-transparent text-foreground hover:border-brand",
          ].join(" ");

          return (
            <div
              key={p.key}
              className={[
                "relative flex h-full min-w-0 flex-col rounded-xl border border-card-border bg-card p-6 shadow-sm",
                isPopular ? "ring-1 ring-brand/20" : "",
              ].join(" ")}
            >
              {p.highlight ? (
                <div className="absolute right-6 top-6 rounded-full bg-brand px-3 py-1 text-xs font-black uppercase tracking-wide text-brand-foreground">
                  {p.highlight}
                </div>
              ) : null}
              <div className="space-y-2">
                {isCurrent ? (
                  <div className="mb-2 inline-flex w-fit rounded-full bg-brand px-3 py-1 text-xs font-black uppercase tracking-wide text-brand-foreground">
                    Current plan
                  </div>
                ) : null}
                <h2 className="text-xl font-black uppercase tracking-tight text-foreground">
                  {p.name}
                </h2>
                <p className="text-3xl font-black tracking-tight text-foreground">{p.price}</p>
                <p className="text-sm leading-relaxed text-muted">{p.blurb}</p>
              </div>

              <ul className="mt-5 space-y-2 text-sm text-muted-strong">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-6">
                <button
                  type="button"
                  onClick={() => void startCheckout(p.key)}
                  disabled={loadingPlan !== null || isCurrent}
                  className={ctaButtonClass}
                >
                  {loadingPlan === p.key ? "Redirecting…" : ctaLabel}
                </button>
                {!isCurrent ? (
                  <p className="mt-2 text-center text-xs text-muted">
                    14-day free trial · Cancel anytime
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-10 text-center text-sm leading-relaxed text-muted">
        All paid plans start with a 14-day free trial. Cancel anytime.
        <br />
        Your data is always yours.
      </p>

      {error ? (
        <p className="mt-6 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <footer className="mt-16 border-t border-card-border pt-8">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted">
          <Link
            href="/dashboard"
            className="underline underline-offset-4 hover:text-brand hover:no-underline"
          >
            Back to dashboard
          </Link>
          <span aria-hidden className="text-card-border">
            ·
          </span>
          <Link
            href="/terms"
            className="underline underline-offset-4 hover:text-brand hover:no-underline"
          >
            Terms of Service
          </Link>
        </div>
      </footer>
    </div>
  );
}
