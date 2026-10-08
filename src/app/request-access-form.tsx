"use client";

import { useState } from "react";
import Turnstile from "react-turnstile";
import { trackGA4Event } from "@/lib/analytics";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const INPUT =
  "h-12 w-full rounded-lg border border-card-border bg-input px-4 text-sm text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20";

export function RequestAccessForm() {
  const [email, setEmail] = useState("");
  const [artistName, setArtistName] = useState("");
  const [instagram, setInstagram] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "done" | "already">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (TURNSTILE_SITE_KEY && !token) {
      setError("One moment, we're checking you're human.");
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/request-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, artist_name: artistName, instagram, turnstile_token: token ?? "" }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; already?: boolean };
      if (!res.ok) throw new Error(json.error ?? "Something went wrong. Please try again.");
      trackGA4Event("request_access");
      setState(json.already ? "already" : "done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("idle");
      setToken(null);
    }
  }

  if (state === "done" || state === "already") {
    return (
      <div className="rounded-xl border border-brand/40 bg-brand/10 p-6">
        <p className="text-lg font-bold text-foreground">
          {state === "done" ? "You're on the list." : "You're already on the list."}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-strong">
          We&rsquo;re letting artists in a few at a time from November. We&rsquo;ll email you when it&rsquo;s your turn.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="sr-only" htmlFor="ra-email">Email</label>
      <input
        id="ra-email"
        type="email"
        required
        autoComplete="email"
        placeholder="Your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={INPUT}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sr-only" htmlFor="ra-name">Artist or band name</label>
        <input
          id="ra-name"
          type="text"
          autoComplete="organization"
          placeholder="Artist or band name"
          value={artistName}
          onChange={(e) => setArtistName(e.target.value)}
          className={INPUT}
        />
        <label className="sr-only" htmlFor="ra-ig">Instagram handle (optional)</label>
        <input
          id="ra-ig"
          type="text"
          autoComplete="off"
          placeholder="@instagram (optional)"
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          className={INPUT}
        />
      </div>
      {TURNSTILE_SITE_KEY ? (
        <Turnstile sitekey={TURNSTILE_SITE_KEY} onVerify={setToken} onExpire={() => setToken(null)} theme="dark" />
      ) : null}
      <button
        type="submit"
        disabled={state === "sending"}
        className="h-12 w-full rounded-lg bg-brand px-6 text-sm font-black uppercase tracking-wide text-brand-foreground hover:brightness-95 disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : "Request access"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
      <p className="text-xs leading-relaxed text-muted">
        We&rsquo;ll only use this to let you know about access. See our{" "}
        <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">privacy policy</a>.
      </p>
    </form>
  );
}
