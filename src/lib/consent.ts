/**
 * Cookie consent for analytics and ads (Google Analytics, Tag Manager, Meta
 * Pixel and the Meta Conversions API). Nothing loads or sends until the
 * visitor accepts. Essential cookies (sign-in) don't need consent.
 */

export const CONSENT_COOKIE = "tempo_consent";
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180; // ask again after six months
export const CONSENT_CHANGED_EVENT = "tempo-consent-changed";
export const CONSENT_OPEN_EVENT = "tempo-consent-open";

export type ConsentChoice = "granted" | "denied";

export function parseConsent(value: string | undefined | null): ConsentChoice | null {
  return value === "granted" || value === "denied" ? value : null;
}

/** Browser only. */
export function readConsent(): ConsentChoice | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  return parseConsent(match?.split("=")[1]);
}

/** Browser only. */
export function writeConsent(choice: ConsentChoice): void {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${choice}; Path=/; Max-Age=${CONSENT_MAX_AGE}; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: choice }));
}

/** Browser only: reopen the banner (the "Cookie settings" link). */
export function openConsentSettings(): void {
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}
