import PricingClient from "./pricing-client";
import { createClient } from "@/utils/supabase/server";
import { normalizePlan, type RoadiePlan } from "@/lib/plan-limits";

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentPlan: RoadiePlan = "free";
  if (user) {
    const { data: planRow } = await supabase
      .from("profiles")
      .select("plan")
      .eq("owner_user_id", user.id)
      .limit(1)
      .maybeSingle();
    currentPlan = normalizePlan(planRow?.plan);
  }

  return <PricingClient currentPlan={currentPlan} />;
}
