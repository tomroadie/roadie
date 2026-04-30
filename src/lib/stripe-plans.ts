export type RoadiePlan = "starter" | "pro" | "label";

export function planFromPriceId(priceId: string): RoadiePlan | null {
  const starter = process.env.STRIPE_STARTER_PRICE_ID;
  const pro = process.env.STRIPE_PRO_PRICE_ID;
  const label = process.env.STRIPE_LABEL_PRICE_ID;

  if (starter && priceId === starter) return "starter";
  if (pro && priceId === pro) return "pro";
  if (label && priceId === label) return "label";
  return null;
}

