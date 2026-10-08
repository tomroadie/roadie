"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CONSENT_OPEN_EVENT,
  readConsent,
  writeConsent,
  type ConsentChoice,
} from "@/lib/consent";

/**
 * Asks before any analytics or ads cookies are set. Accept and Reject are
 * equally easy, as UK guidance requires.
 */
export function ConsentBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Reading a cookie has to happen after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (readConsent() === null) setOpen(true);
    const reopen = () => setOpen(true);
    window.addEventListener(CONSENT_OPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen);
  }, []);

  if (!open) return null;

  function choose(choice: ConsentChoice) {
    writeConsent(choice);
    setOpen(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie choices"
      className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-xl border border-card-border bg-card p-5 shadow-2xl sm:flex-row sm:items-center">
        <p className="flex-1 text-sm leading-relaxed text-muted-strong">
          We&rsquo;d like to use analytics and advertising cookies (Google and Meta) to see how people
          find Tempo. They&rsquo;re off unless you say yes. Sign-in cookies are always on.{" "}
          <Link href="/privacy#cookies" className="font-semibold text-foreground underline underline-offset-2">
            Details
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose("denied")}
            className="h-10 flex-1 rounded-lg border border-card-border px-4 text-sm font-bold text-foreground hover:border-muted sm:flex-none"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => choose("granted")}
            className="h-10 flex-1 rounded-lg bg-brand px-4 text-sm font-bold text-brand-foreground hover:brightness-95 sm:flex-none"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

/** "Cookie settings" link for footers. */
export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}
      className={className ?? "underline-offset-2 hover:underline"}
    >
      Cookie settings
    </button>
  );
}
