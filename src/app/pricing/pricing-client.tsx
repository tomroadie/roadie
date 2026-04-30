"use client";

import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { comparePlans, normalizePlan, type RoadiePlan } from "@/lib/plan-limits";

type PriceIds = { starter: string; pro: string; label: string };
type PlanKey = keyof PriceIds;

const PLANS: Array<{
  key: PlanKey;
  name: string;
  price: string;
  blurb: string;
  highlight?: string;
  features: string[];
}> = [
  {
    key: "starter",
    name: "Starter",
    price: "£29/month",
    blurb: "Weekly content plan, AI assistant, events calendar, up to 1 artist",
    features: ["Weekly content plan", "Events calendar", "AI assistant", "Up to 1 artist"],
  },
  {
    key: "pro",
    name: "Pro",
    price: "£59/month",
    blurb: "Everything in Starter + Instagram audit insights, trend feed, up to 3 artists",
    highlight: "Most popular",
    features: [
      "Everything in Starter",
      "Insights tab",
      "Audit refresh",
      "Up to 3 artists",
    ],
  },
  {
    key: "label",
    name: "Label",
    price: "£149/month",
    blurb: "Everything in Pro + up to 10 artists, priority support",
    features: ["Everything in Pro", "Up to 10 artists", "Priority support"],
  },
];

export default function PricingClient({
  priceIds,
  currentPlan,
}: {
  priceIds: PriceIds;
  currentPlan: RoadiePlan;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const normalizedCurrent = normalizePlan(currentPlan);

  async function startCheckout(plan: PlanKey) {
    setError(null);
    setLoadingPlan(plan);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login?redirect=/pricing");
      return;
    }

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

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-1 flex-col px-6 py-14">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
          Pricing
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
          Upgrade when you’re ready
        </h1>
        <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          Pick a plan that matches your workflow. You can cancel any time.
        </p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {PLANS.map((p) => {
          const isPopular = p.key === "pro";
          const isCurrent =
            normalizedCurrent !== "free" && normalizedCurrent === (p.key as RoadiePlan);
          const isUpgrade =
            comparePlans(normalizedCurrent, p.key as RoadiePlan) < 0 &&
            normalizedCurrent !== "free";
          const cta =
            isCurrent ? "Current plan" : isUpgrade ? "Upgrade" : "Get started";
          return (
            <div
              key={p.key}
              className={[
                "relative flex flex-col rounded-2xl border bg-background p-6 shadow-sm",
                isPopular
                  ? "border-[#7C3AED]/30 ring-1 ring-[#7C3AED]/20"
                  : "border-zinc-200 dark:border-zinc-800",
              ].join(" ")}
            >
              {p.highlight ? (
                <div className="absolute right-6 top-6 rounded-full bg-[#7C3AED]/10 px-3 py-1 text-xs font-semibold text-[#7C3AED]">
                  {p.highlight}
                </div>
              ) : null}
              {isCurrent ? (
                <div className="absolute left-6 top-6 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  Current plan
                </div>
              ) : null}
              <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  {p.name}
                </h2>
                <p className="text-3xl font-extrabold tracking-tight text-foreground">
                  {p.price}
                </p>
                <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {p.blurb}
                </p>
              </div>

              <ul className="mt-5 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7C3AED]/70" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => startCheckout(p.key)}
                  disabled={loadingPlan !== null || isCurrent}
                  className={[
                    "flex h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    isPopular
                      ? "bg-[#7C3AED] text-white hover:bg-[#6D28D9]"
                      : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white",
                  ].join(" ")}
                >
                  {loadingPlan === p.key ? "Redirecting…" : cta}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {error ? (
        <p className="mt-6 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-10 text-sm text-zinc-600 dark:text-zinc-400">
        <Link
          href="/dashboard"
          className="underline underline-offset-4 hover:no-underline"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

