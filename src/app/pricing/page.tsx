import PricingClient from "./pricing-client";

export default function PricingPage() {
  const starterPriceId = process.env.STRIPE_STARTER_PRICE_ID ?? "";
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID ?? "";
  const labelPriceId = process.env.STRIPE_LABEL_PRICE_ID ?? "";

  return (
    <PricingClient
      priceIds={{
        starter: starterPriceId,
        pro: proPriceId,
        label: labelPriceId,
      }}
    />
  );
}

