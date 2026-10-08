import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing — Tempo",
  description: "Tempo is free during the closed beta.",
};

// The old Pro/Teams pricing (pricing-client.tsx) is kept for after the beta.
export default function PricingPage() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-1 flex-col justify-center px-4 py-16 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">Pricing</p>
      <h1 className="mt-3 text-4xl font-black uppercase tracking-tight text-foreground">Free during the beta</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-strong">
        Tempo is in a closed beta and costs nothing while it is. We&rsquo;ll share pricing before
        the public launch, and nothing will be charged unless you choose a paid plan.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/home"
          className="inline-flex h-11 items-center rounded-lg bg-brand px-5 text-sm font-black uppercase tracking-wide text-brand-foreground hover:brightness-95"
        >
          Back to Tempo
        </Link>
        <Link
          href="/#request-access"
          className="inline-flex h-11 items-center rounded-lg border border-card-border px-5 text-sm font-semibold text-foreground hover:border-muted"
        >
          Request access
        </Link>
      </div>
    </div>
  );
}
