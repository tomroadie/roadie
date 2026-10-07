"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  disconnectInstagram,
  type InstagramDisconnectState,
} from "./actions";

const CONNECT_ERRORS: Record<string, string> = {
  instagram_cancelled:
    "Instagram wasn't connected because the permission screen was cancelled. Try again whenever you're ready.",
  instagram_connect_failed:
    "We couldn't connect your Instagram. Make sure it's a professional (Business or Creator) account, then try again.",
};

function DisconnectButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 items-center justify-center rounded-lg border border-card-border bg-transparent px-4 text-sm font-black uppercase tracking-wide text-foreground transition-colors hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Disconnecting…" : "Disconnect"}
    </button>
  );
}

export function InstagramConnectSection({
  instagramUserId,
  canConnectLiveStats,
  connectError,
}: {
  instagramUserId: string | null;
  canConnectLiveStats: boolean;
  connectError?: string | null;
}) {
  const connectErrorMessage = connectError ? CONNECT_ERRORS[connectError] : null;
  const connected = Boolean(instagramUserId?.trim());

  const [state, formAction] = useActionState<
    InstagramDisconnectState,
    FormData
  >(disconnectInstagram, null);

  return (
    <section className="mt-6 space-y-4 rounded-xl border border-card-border bg-card p-7 shadow-sm">
      <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
        Connect Instagram
      </h2>
      <p className="text-sm text-muted">
        Connects your Instagram professional (Business or Creator) account for real-time performance data
      </p>

      {connected ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex w-fit items-center rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-emerald-400">
            Instagram connected ✓
          </span>
          <form action={formAction}>
            <DisconnectButton />
          </form>
        </div>
      ) : canConnectLiveStats ? (
        <a
          href="/api/auth/instagram"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95"
        >
          Connect Instagram for live stats
        </a>
      ) : (
        <p className="text-sm text-muted">
          Live Instagram stats are available on Tempo Pro.
          <Link
            href="/pricing"
            className="ml-1 font-semibold text-brand hover:underline"
          >
            Upgrade →
          </Link>
        </p>
      )}

      {!connected && connectErrorMessage ? (
        <p role="alert" className="text-sm text-red-400">
          {connectErrorMessage}
        </p>
      ) : null}

      {state?.error ? (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
