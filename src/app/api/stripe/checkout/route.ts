import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
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

  const stripe = new Stripe(stripeSecretKey);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId.trim(), quantity: 1 }],
    success_url: `${origin}/dashboard?upgraded=true`,
    cancel_url: `${origin}/pricing`,
    customer_email: user.email ?? undefined,
    metadata: {
      userId: user.id,
      plan,
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

