/** Public-facing plan names. Internal Stripe keys (starter/pro/label) stay unchanged. */
export function planDisplayName(plan: unknown): string {
  switch (plan) {
    case "free":
      return "Free";
    case "starter":
      // Legacy tier — no longer sold publicly; keep label for existing subscribers.
      return "Starter";
    case "pro":
      return "Tempo Pro";
    case "label":
      return "Teams";
    default:
      return "Free";
  }
}

/** Display prices for marketing/analytics. Stripe may still charge legacy amounts until price IDs are updated. */
export function planDisplayPrice(plan: unknown): string {
  switch (plan) {
    case "starter":
      return "£29";
    case "pro":
      return "£39";
    case "label":
      return "£149";
    default:
      return "£0";
  }
}

/** Numeric GBP value for analytics events. */
export function planDisplayValue(plan: unknown): number {
  switch (plan) {
    case "starter":
      return 29;
    case "pro":
      return 39;
    case "label":
      return 149;
    default:
      return 0;
  }
}

export type PublicPaidPlanKey = "pro" | "label";

/** Maps public checkout keys to internal Stripe plan keys. Tempo Pro → pro, Teams → label. */
export const PUBLIC_PAID_PLANS: Array<{
  key: PublicPaidPlanKey;
  name: string;
  price: string;
  blurb: string;
  highlight?: string;
  features: string[];
}> = [
  {
    key: "pro",
    name: "Tempo Pro",
    price: "£39/month",
    blurb: "Turn your audit into a clear weekly strategy — built around what's already working.",
    highlight: "Most popular",
    features: [
      "Weekly content plan every Monday",
      "Live Instagram data",
      "Monthly audit refresh",
      "Events calendar",
      "Weekly focus questions",
      "Content reviews",
      "Up to 3 artist projects",
      "14-day free trial",
      "Cancel anytime",
    ],
  },
  {
    key: "label",
    name: "Teams",
    price: "£149/month",
    blurb: "Full-service strategy for managers and rosters who need expert eyes across multiple artists.",
    features: [
      "Everything in Tempo Pro",
      "Up to 10 artists",
      "Priority support",
      "Monthly strategy call",
      "14-day free trial",
      "Cancel anytime",
    ],
  },
];

export const FREE_PLAN_CARD = {
  name: "Free",
  price: "£0",
  blurb: "A powerful Instagram audit that shows you exactly what your audience responds to.",
  features: [
    "Full Instagram audit",
    "Artist snapshot & content pattern",
    "Strategic diagnosis with specific data",
    "No card required",
  ],
};
