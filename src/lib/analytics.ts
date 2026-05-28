// Browser-side GA4 events
export function trackGA4Event(
  eventName: string,
  params?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;
  if (!window.gtag) return;
  window.gtag("event", eventName, params);
}

export function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function trackSignUp(method = "email") {
  trackGA4Event("sign_up", { method });
}

export function trackBeginCheckout(plan: string, value: number) {
  trackGA4Event("begin_checkout", {
    currency: "GBP",
    value,
    items: [{ item_name: plan }],
  });
}

export function trackPurchase(
  plan: string,
  value: number,
  transactionId: string
) {
  trackGA4Event("purchase", {
    currency: "GBP",
    value,
    transaction_id: transactionId,
    items: [{ item_name: plan }],
  });
}

export function trackStartTrial(plan: string, value: number) {
  trackGA4Event("begin_checkout", {
    currency: "GBP",
    value,
    items: [{ item_name: `${plan}_trial` }],
  });
}

declare global {
  interface Window {
    gtag: (command: string, ...args: unknown[]) => void;
  }
}
