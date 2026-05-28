"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { trackCompleteRegistration, generateEventId } from "@/lib/meta-pixel";
import { trackSignUp } from "@/lib/analytics";

export function OnboardingConversionTracking() {
  const searchParams = useSearchParams();
  const isNew = searchParams.get("new") === "true";

  useEffect(() => {
    if (!isNew) return;

    const eventId = searchParams.get("event_id") ?? generateEventId();
    trackCompleteRegistration(eventId);
    trackSignUp();
    sessionStorage.setItem("registration_event_id", eventId);
  }, [isNew, searchParams]);

  return null;
}
