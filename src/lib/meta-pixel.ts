import { generateEventId } from "@/lib/analytics";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export { generateEventId };

export function trackMeta(
  event: string,
  params?: Record<string, unknown>
): void {
  if (typeof window === "undefined" || !PIXEL_ID) return;
  if (params) {
    window.fbq?.("track", event, params);
  } else {
    window.fbq?.("track", event);
  }
}

export function trackCompleteRegistration(eventId: string) {
  trackMeta("CompleteRegistration", {
    eventID: eventId,
  });
}

export function trackStartTrial(plan: string, value: number, eventId: string) {
  trackMeta("StartTrial", {
    currency: "GBP",
    value,
    predicted_ltv: value * 12,
    eventID: eventId,
  });
}

export function trackPurchase(
  plan: string,
  value: number,
  eventId: string
) {
  trackMeta("Purchase", {
    currency: "GBP",
    value,
    eventID: eventId,
  });
}
