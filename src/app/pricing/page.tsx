import PricingClient from "./pricing-client";
import { createClient } from "@/utils/supabase/server";
import { normalizePlan, type RoadiePlan } from "@/lib/plan-limits";

export default async function PricingPage() {
  const starterPriceId = process.env.STRIPE_STARTER_PRICE_ID ?? "";
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID ?? "";
  const labelPriceId = process.env.STRIPE_LABEL_PRICE_ID ?? "";

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

  return (
    <PricingClient
      priceIds={{
        starter: starterPriceId,
        pro: proPriceId,
        label: labelPriceId,
      }}
      currentPlan={currentPlan}
    />
  );
}

