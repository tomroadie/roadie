import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import type { RoadiePlan } from "@/lib/stripe-plans";
import { getMondayDateString } from "@/lib/week";

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

  const { error } = await supabase
    .from("profiles")
    .update({ plan: "free" })
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

async function sendResendEmail(args: {
  apiKey: string;
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${args.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: "Roadie <hello@roadie.media>",
      to: [args.to],
      subject: args.subject,
      text: args.text,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: text || res.statusText };
  }

  return { ok: true };
}

async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  const stripeCustomerIdValue = stripeCustomerId(subscription.customer);
  if (!stripeCustomerIdValue) {
    console.log("customer.subscription.trial_will_end: missing customer ID");
    return;
  }

  const supabase = createServiceRoleClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, owner_user_id")
    .eq("stripe_customer_id", stripeCustomerIdValue)
    .maybeSingle();

  if (!profile?.owner_user_id) {
    console.log(
      `No profile found for Stripe customer ${stripeCustomerIdValue} (trial_will_end)`
    );
    return;
  }

  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
    profile.owner_user_id
  );

  const email = userData?.user?.email?.trim();
  if (userError || !email) {
    console.log(
      `No email found for profile ${profile.id} (trial_will_end)`,
      userError?.message
    );
    return;
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.log("trial_will_end: RESEND_API_KEY not configured");
    return;
  }

  const text = [
    "Hi,",
    "",
    "Your 14-day free trial of Roadie ends in 3 days.",
    "",
    "Everything you've built — your audit, your content plan, your Instagram insights — stays live as long as your subscription is active.",
    "",
    "No action needed if you're happy to continue — you'll be charged automatically when the trial ends.",
    "",
    "If you have any questions, just reply to this email.",
    "",
    "— Tom at Roadie",
    "https://app.roadie.media",
  ].join("\n");

  const emailSend = await sendResendEmail({
    apiKey: resendKey,
    to: email,
    subject: "Your Roadie trial ends in 3 days",
    text,
  });

  if (!emailSend.ok) {
    console.error("trial_will_end: Resend send failed", {
      profileId: profile.id,
      status: emailSend.status,
      error: emailSend.error,
    });
    return;
  }

  console.log(`Sent trial_will_end email to profile ${profile.id}`);
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
      .update({ plan, stripe_customer_id: stripeCustomerIdValue })
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
