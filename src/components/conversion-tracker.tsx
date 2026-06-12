"use client";

import { useEffect } from "react";
import {
  trackStartTrial,
  trackPurchase,
  generateEventId,
} from "@/lib/meta-pixel";
import {
  trackPurchase as trackGA4Purchase,
  trackStartTrial as trackGA4Trial,
} from "@/lib/analytics";

type Props = {
  upgraded: boolean;
  plan: string;
  isTrial: boolean;
};

export function ConversionTracker({ upgraded, plan, isTrial }: Props) {
  useEffect(() => {
    if (!upgraded) return;

    // Display values for public pricing. Stripe may still charge legacy amounts until price IDs are updated.
    const planValues: Record<string, number> = {
      starter: 29,
      pro: 39,
      label: 149,
    };
    const value = planValues[plan] ?? 0;
    const eventId = generateEventId();

    if (isTrial) {
      trackStartTrial(plan, value, eventId);
      trackGA4Trial(plan, value);
    } else {
      trackPurchase(plan, value, eventId);
      trackGA4Purchase(plan, value, eventId);
    }

    sessionStorage.setItem("conversion_event_id", eventId);
  }, [upgraded, plan, isTrial]);

  return null;
}
