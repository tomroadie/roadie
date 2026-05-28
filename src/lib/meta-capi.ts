const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const CAPI_TOKEN = process.env.META_CAPI_TOKEN;
const CAPI_URL = `https://graph.facebook.com/v19.0/${PIXEL_ID}/events`;

type CAPIEvent = {
  event_name: string;
  event_time: number;
  event_id: string;
  event_source_url: string;
  action_source: "website";
  user_data: {
    em?: string;
    client_user_agent?: string;
  };
  custom_data?: {
    currency?: string;
    value?: number;
    predicted_ltv?: number;
  };
};

async function hashEmail(email: string): Promise<string> {
  const normalized = email.toLowerCase().trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sendCAPIEvent(
  event: Omit<CAPIEvent, "action_source"> & {
    email?: string;
  }
): Promise<void> {
  if (!PIXEL_ID || !CAPI_TOKEN) return;

  const hashedEmail = event.email ? await hashEmail(event.email) : undefined;

  const payload = {
    data: [
      {
        ...event,
        action_source: "website" as const,
        user_data: {
          ...event.user_data,
          em: hashedEmail,
        },
      },
    ],
    access_token: CAPI_TOKEN,
  };

  try {
    await fetch(CAPI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("CAPI event failed:", e);
  }
}

export async function capiCompleteRegistration(
  email: string,
  eventId: string
): Promise<void> {
  await sendCAPIEvent({
    event_name: "CompleteRegistration",
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    event_source_url: "https://app.roadie.media/onboarding",
    email,
    user_data: {},
  });
}

export async function capiCheckoutEvent(
  eventName: "StartTrial" | "Purchase" | "Subscribe",
  email: string,
  plan: string,
  value: number,
  eventId: string
): Promise<void> {
  await sendCAPIEvent({
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    event_source_url: "https://app.roadie.media/pricing",
    email,
    user_data: {},
    custom_data: {
      currency: "GBP",
      value,
      predicted_ltv: value * 12,
    },
  });
}
