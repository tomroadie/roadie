import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import type { RoadiePlan } from "@/lib/stripe-plans";

export async function POST(request: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing Stripe secrets" },
      { status: 500 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const stripe = new Stripe(stripeSecretKey);
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid signature";
    return NextResponse.json({ error: "Invalid webhook signature", details: msg }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan as RoadiePlan | undefined;
  const artistId = session.metadata?.artistId;
  const stripeCustomerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;

  if (!userId || !plan || !artistId) {
    return NextResponse.json(
      { error: "Missing userId/plan/artistId metadata on session" },
      { status: 400 }
    );
  }

  if (!stripeCustomerId) {
    return NextResponse.json(
      { error: "Missing customer on session" },
      { status: 400 }
    );
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("profiles")
    .update({ plan, stripe_customer_id: stripeCustomerId })
    .eq("owner_user_id", userId)
    .eq("id", artistId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to update profile", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

