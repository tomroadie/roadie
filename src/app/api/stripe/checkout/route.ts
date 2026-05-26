import Stripe from "stripe";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getActiveArtistIdForUser } from "@/lib/active-artist";
import { planFromPriceId } from "@/lib/stripe-plans";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing STRIPE_SECRET_KEY" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const priceId = (body as { priceId?: unknown })?.priceId;
  if (typeof priceId !== "string" || !priceId.trim()) {
    return NextResponse.json({ error: "Expected priceId" }, { status: 400 });
  }

  const plan = planFromPriceId(priceId.trim());
  if (!plan) {
    return NextResponse.json({ error: "Invalid priceId" }, { status: 400 });
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return NextResponse.json({ error: "Missing Origin header" }, { status: 400 });
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

  const stripe = new Stripe(stripeSecretKey);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId.trim(), quantity: 1 }],
    success_url: `${origin}/home?upgraded=true`,
    cancel_url: `${origin}/pricing`,
    customer_email: user.email ?? undefined,
    subscription_data: {
      trial_period_days: 14,
    },
    metadata: {
      userId: user.id,
      plan,
      artistId: activeArtistId,
    },
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 502 }
    );
  }

  return NextResponse.json({ url: session.url });
}

