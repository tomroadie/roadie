export type RoadiePlan = "free" | "starter" | "pro" | "label";

export type PlanFeature =
  | "canGeneratePlan"
  | "canViewInsights"
  | "canRefreshAudit"
  | "maxArtists";

export const PLAN_LIMITS: Record<
  RoadiePlan,
  {
    maxArtists: number;
    canGeneratePlan: boolean;
    canViewInsights: boolean;
    canRefreshAudit: boolean;
  }
> = {
  free: {
    maxArtists: 1,
    canGeneratePlan: false,
    canViewInsights: false,
    canRefreshAudit: false,
  },
  starter: {
    maxArtists: 1,
    canGeneratePlan: true,
    canViewInsights: false,
    canRefreshAudit: false,
  },
  pro: {
    maxArtists: 3,
    canGeneratePlan: true,
    canViewInsights: true,
    canRefreshAudit: true,
  },
  label: {
    maxArtists: 10,
    canGeneratePlan: true,
    canViewInsights: true,
    canRefreshAudit: true,
  },
};

export function normalizePlan(plan: unknown): RoadiePlan {
  const p = typeof plan === "string" ? plan.trim().toLowerCase() : "";
  if (p === "starter" || p === "pro" || p === "label" || p === "free") return p;
  return "free";
}

export function canDo(
  plan: unknown,
  feature: Exclude<PlanFeature, "maxArtists">
): boolean {
  const p = normalizePlan(plan);
  return PLAN_LIMITS[p][feature];
}

export const PLAN_ORDER: RoadiePlan[] = ["free", "starter", "pro", "label"];

export function comparePlans(a: unknown, b: unknown): number {
  const pa = normalizePlan(a);
  const pb = normalizePlan(b);
  return PLAN_ORDER.indexOf(pa) - PLAN_ORDER.indexOf(pb);
}

