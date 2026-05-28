import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { planFromPriceId } from "@/lib/stripe-plans";

const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type WinbackToken = {
  artistId?: string;
  userId?: string;
  ts?: number;
  type?: string;
};

function decodeToken(raw: string | null): WinbackToken | null {
  if (!raw?.trim()) return null;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as WinbackToken;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function priceIdForPlan(plan: string): string | null {
  switch (plan) {
    case "starter":
      return process.env.STRIPE_STARTER_PRICE_ID ?? null;
    case "pro":
      return process.env.STRIPE_PRO_PRICE_ID ?? null;
    case "label":
      return process.env.STRIPE_LABEL_PRICE_ID ?? null;
    default:
      return process.env.STRIPE_STARTER_PRICE_ID ?? null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenRaw = searchParams.get("token");
  const token = decodeToken(tokenRaw);

  if (
    !token?.artistId?.trim() ||
    !token?.userId?.trim() ||
    token.type !== "winback_extension" ||
    typeof token.ts !== "number"
  ) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  if (Date.now() - token.ts > TOKEN_MAX_AGE_MS) {
    return NextResponse.json({ error: "Token expired" }, { status: 400 });
  }

  const artistId = token.artistId.trim();
  const tokenUserId = token.userId.trim();
  const redirectTarget = `/api/email/winback-extension?token=${encodeURIComponent(tokenRaw ?? "")}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", redirectTarget);
    return NextResponse.redirect(loginUrl);
  }

  if (user.id !== tokenUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing STRIPE_SECRET_KEY" },
      { status: 500 }
    );
  }

  const admin = createServiceRoleClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, plan, stripe_customer_id, owner_user_id")
    .eq("id", artistId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const stripe = new Stripe(stripeSecretKey);
  const trialEnd = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;
  const customerId = profile.stripe_customer_id?.trim() ?? "";

  if (customerId) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });

    const activeOrTrialing = subscriptions.data.find((sub) =>
      ["active", "trialing", "past_due", "unpaid"].includes(sub.status)
    );

    if (activeOrTrialing) {
      await stripe.subscriptions.update(activeOrTrialing.id, {
        trial_end: trialEnd,
        proration_behavior: "none",
      });

      const plan =
        planFromPriceId(activeOrTrialing.items.data[0]?.price?.id ?? "") ??
        (profile.plan !== "free" ? profile.plan : "starter");

      await admin
        .from("profiles")
        .update({
          plan,
          trial_started_at: new Date().toISOString(),
          cancelled_at: null,
        })
        .eq("id", artistId);

      const homeUrl = new URL("/home", request.url);
      homeUrl.searchParams.set("winback", "1");
      return NextResponse.redirect(homeUrl);
    }
  }

  const plan = profile.plan !== "free" ? profile.plan : "starter";
  const priceId = priceIdForPlan(plan);
  if (!priceId) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing Stripe price IDs" },
      { status: 500 }
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    new URL(request.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/home?winback=1`,
    cancel_url: `${origin}/pricing`,
    customer: customerId || undefined,
    customer_email: customerId ? undefined : (user.email ?? undefined),
    subscription_data: {
      trial_period_days: 14,
    },
    metadata: {
      userId: user.id,
      plan,
      artistId,
    },
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 502 }
    );
  }

  return NextResponse.redirect(session.url);
}
