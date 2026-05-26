export type RoadiePlan = "free" | "starter" | "pro" | "label";

export type PlanFeature =
  | "canGeneratePlan"
  | "canViewInsights"
  | "canViewLiveSocialData"
  | "canRefreshAudit"
  | "canReview"
  | "canRefineIdeas"
  | "canSaveIdeas"
  | "canViewEngagementTrends"
  | "maxArtists";

export const PLAN_LIMITS: Record<
  RoadiePlan,
  {
    maxArtists: number;
    canGeneratePlan: boolean;
    canViewInsights: boolean;
    canViewLiveSocialData: boolean;
    canRefreshAudit: boolean;
    canReview: boolean;
    canRefineIdeas: boolean;
    canSaveIdeas: boolean;
    canViewEngagementTrends: boolean;
  }
> = {
  free: {
    maxArtists: 1,
    canGeneratePlan: false,
    canViewInsights: true,
    canViewLiveSocialData: false,
    canRefreshAudit: false,
    canReview: false,
    canRefineIdeas: false,
    canSaveIdeas: false,
    canViewEngagementTrends: false,
  },
  starter: {
    maxArtists: 1,
    canGeneratePlan: true,
    canViewInsights: true,
    canViewLiveSocialData: false,
    canRefreshAudit: false,
    canReview: false,
    canRefineIdeas: false,
    canSaveIdeas: true,
    canViewEngagementTrends: false,
  },
  pro: {
    maxArtists: 3,
    canGeneratePlan: true,
    canViewInsights: true,
    canViewLiveSocialData: true,
    canRefreshAudit: true,
    canReview: true,
    canRefineIdeas: true,
    canSaveIdeas: true,
    canViewEngagementTrends: true,
  },
  label: {
    maxArtists: 10,
    canGeneratePlan: true,
    canViewInsights: true,
    canViewLiveSocialData: true,
    canRefreshAudit: true,
    canReview: true,
    canRefineIdeas: true,
    canSaveIdeas: true,
    canViewEngagementTrends: true,
  },
};

export function normalizePlan(plan: unknown): RoadiePlan {
  const p = typeof plan === "string" ? plan.trim().toLowerCase() : "";
  if (p === "starter" || p === "pro" || p === "label" || p === "free") return p;
  return "free";
}

export function canDo(
  plan: unknown,
  feature: Exclude<PlanFeature, "maxArtists">,
  isAdmin = false
): boolean {
  if (isAdmin) return true;
  const p = normalizePlan(plan);
  return PLAN_LIMITS[p][feature];
}

export function maxArtistsAllowed(plan: unknown, isAdmin = false): number {
  if (isAdmin) return 999;
  return PLAN_LIMITS[normalizePlan(plan)].maxArtists;
}

export const PLAN_ORDER: RoadiePlan[] = ["free", "starter", "pro", "label"];

export function comparePlans(a: unknown, b: unknown): number {
  const pa = normalizePlan(a);
  const pb = normalizePlan(b);
  return PLAN_ORDER.indexOf(pa) - PLAN_ORDER.indexOf(pb);
}

