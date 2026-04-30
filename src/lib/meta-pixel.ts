declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

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
