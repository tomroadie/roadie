import Stripe from "stripe";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getActiveArtistIdForUser } from "@/lib/active-artist";

export async function POST() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing STRIPE_SECRET_KEY" },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const activeArtistId = await getActiveArtistIdForUser(
    supabase,
    user.id,
    cookieStore
  );

  if (!activeArtistId) {
    return NextResponse.json(
      { error: "No active artist. Complete onboarding first." },
      { status: 400 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", activeArtistId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: "Failed to load profile", details: profileError.message },
      { status: 500 }
    );
  }

  const stripeCustomerId = profile?.stripe_customer_id?.trim();
  if (!stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account found" },
      { status: 400 }
    );
  }

  const stripe = new Stripe(stripeSecretKey);

  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "active",
    limit: 1,
  });

  if (!subscriptions.data.length) {
    const trialing = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "trialing",
      limit: 1,
    });
    subscriptions.data.push(...trialing.data);
  }

  if (!subscriptions.data.length) {
    return NextResponse.json(
      { error: "No active subscription found" },
      { status: 404 }
    );
  }

  const sub = subscriptions.data[0];

  const updated = await stripe.subscriptions.update(sub.id, {
    cancel_at_period_end: true,
  });

  const periodEndSeconds =
    (
      updated as Stripe.Subscription & {
        current_period_end?: number;
      }
    ).current_period_end ??
    updated.cancel_at ??
    updated.trial_end ??
    Math.floor(Date.now() / 1000);

  return NextResponse.json({
    success: true,
    cancelAt: new Date(periodEndSeconds * 1000).toISOString(),
  });
}
