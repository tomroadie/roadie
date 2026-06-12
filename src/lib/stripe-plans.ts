export type RoadiePlan = "starter" | "pro" | "label";

/** Plans available for new public checkout (Tempo Pro, Teams). */
export type CheckoutPlan = "pro" | "label";

export function isStripePriceId(id: string): boolean {
  return id.startsWith("price_");
}

function readEnvPriceId(envKey: string): string | null {
  const id = process.env[envKey]?.trim();
  if (!id || !isStripePriceId(id)) return null;
  return id;
}

/** Resolve the active Stripe price ID for checkout from server env. */
export function priceIdForPlan(plan: string): string | null {
  switch (plan.trim().toLowerCase()) {
    case "starter":
      return readEnvPriceId("STRIPE_STARTER_PRICE_ID");
    case "pro":
      return readEnvPriceId("STRIPE_PRO_PRICE_ID");
    case "label":
      return readEnvPriceId("STRIPE_LABEL_PRICE_ID");
    default:
      return null;
  }
}

export function normalizeCheckoutPlan(plan: unknown): CheckoutPlan | null {
  const p = typeof plan === "string" ? plan.trim().toLowerCase() : "";
  if (p === "pro" || p === "label") return p;
  return null;
}

/** Map a Stripe price ID back to an internal plan (includes optional legacy price IDs). */
export function planFromPriceId(priceId: string): RoadiePlan | null {
  const id = priceId.trim();
  const mappings: Array<[string | undefined, RoadiePlan]> = [
    [process.env.STRIPE_STARTER_PRICE_ID, "starter"],
    [process.env.STRIPE_PRO_PRICE_ID, "pro"],
    [process.env.STRIPE_PRO_LEGACY_PRICE_ID, "pro"],
    [process.env.STRIPE_LABEL_PRICE_ID, "label"],
    [process.env.STRIPE_LABEL_LEGACY_PRICE_ID, "label"],
  ];

  for (const [envId, plan] of mappings) {
    if (envId?.trim() === id) return plan;
  }
  return null;
}
