import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import type { RoadiePlan } from "@/lib/stripe-plans";
import { getMondayDateString } from "@/lib/week";
import { capiCheckoutEvent } from "@/lib/meta-capi";

const PAID_PLANS: RoadiePlan[] = ["starter", "pro", "label"];

function stripeCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined
): string | null {
  if (typeof customer === "string") return customer;
  if (customer && typeof customer === "object" && "id" in customer) {
    return customer.id;
  }
  return null;
}

async function downgradeProfileToFree(
  stripeCustomerIdValue: string,
  reason: "subscription deleted" | "payment failed"
) {
  const supabase = createServiceRoleClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", stripeCustomerIdValue)
    .maybeSingle();

  if (!profile) {
    console.log(
      `No profile found for Stripe customer ${stripeCustomerIdValue} (${reason})`
    );
    return;
  }

  const updatePayload: { plan: string; cancelled_at?: string } = { plan: "free" };
  if (reason === "subscription deleted") {
    updatePayload.cancelled_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", profile.id);

  if (error) {
    console.error(
      `Failed to downgrade profile ${profile.id} to free (${reason}):`,
      error.message
    );
    return;
  }

  console.log(`Downgraded profile ${profile.id} to free (${reason})`);
}

async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  const stripeCustomerIdValue = stripeCustomerId(subscription.customer);
  if (!stripeCustomerIdValue) {
    console.log("customer.subscription.trial_will_end: missing customer ID");
    return;
  }

  console.log(
    `customer.subscription.trial_will_end for ${stripeCustomerIdValue} — handled by email-sequences cron`
  );
}

async function triggerFirstWeeklyPlanIfNeeded(artistId: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (!appUrl || !webhookSecret) {
    console.log(
      "checkout.session.completed: skip plan generation (missing NEXT_PUBLIC_APP_URL or WEBHOOK_SECRET)"
    );
    return;
  }

  const supabase = createServiceRoleClient();
  const weekStart = getMondayDateString();

  const { data: existingPlan, error: planLookupError } = await supabase
    .from("weekly_plans")
    .select("id")
    .eq("artist_id", artistId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (planLookupError) {
    console.error("checkout.session.completed: failed to check weekly plan", {
      artist_id: artistId,
      error: planLookupError.message,
    });
    return;
  }

  if (existingPlan?.id) {
    return;
  }

  try {
    const res = await fetch(`${appUrl}/api/generate-plan`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-artist-id": artistId,
        "x-webhook-secret": webhookSecret,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: string;
      };
      console.error("checkout.session.completed: generate-plan failed", {
        artist_id: artistId,
        status: res.status,
        error: data.error,
        details: data.details,
      });
    }
  } catch (e) {
    console.error("checkout.session.completed: generate-plan request failed", {
      artist_id: artistId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const plan = session.metadata?.plan as RoadiePlan | undefined;
    const artistId = session.metadata?.artistId;
    const stripeCustomerIdValue = stripeCustomerId(session.customer);

    if (!userId || !plan || !artistId) {
      return NextResponse.json(
        { error: "Missing userId/plan/artistId metadata on session" },
        { status: 400 }
      );
    }

    if (!stripeCustomerIdValue) {
      return NextResponse.json(
        { error: "Missing customer on session" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        plan,
        stripe_customer_id: stripeCustomerIdValue,
        trial_started_at: new Date().toISOString(),
      })
      .eq("owner_user_id", userId)
      .eq("id", artistId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to update profile", details: error.message },
        { status: 500 }
      );
    }

    if (PAID_PLANS.includes(plan)) {
      await triggerFirstWeeklyPlanIfNeeded(artistId);
    }

    const customerEmail =
      session.customer_details?.email ?? session.customer_email ?? "";
    const planName = session.metadata?.plan ?? "starter";
    // Public display values; update when Stripe price IDs match new pricing (£39 Pro).
    const planValues: Record<string, number> = {
      starter: 29,
      pro: 39,
      label: 149,
    };
    const value = planValues[planName] ?? 0;
    const eventId = `stripe-${session.id}`;

    await capiCheckoutEvent(
      "StartTrial",
      customerEmail,
      planName,
      value,
      eventId
    );

    await capiCheckoutEvent(
      "Subscribe",
      customerEmail,
      planName,
      value,
      `${eventId}-subscribe`
    );

    return NextResponse.json({ ok: true });
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const stripeCustomerIdValue = stripeCustomerId(subscription.customer);
    if (stripeCustomerIdValue) {
      await downgradeProfileToFree(stripeCustomerIdValue, "subscription deleted");
    } else {
      console.log("customer.subscription.deleted: missing customer ID");
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const stripeCustomerIdValue = stripeCustomerId(invoice.customer);
    if (stripeCustomerIdValue) {
      await downgradeProfileToFree(stripeCustomerIdValue, "payment failed");
    } else {
      console.log("invoice.payment_failed: missing customer ID");
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "customer.subscription.trial_will_end") {
    const subscription = event.data.object as Stripe.Subscription;
    await handleTrialWillEnd(subscription);
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}
