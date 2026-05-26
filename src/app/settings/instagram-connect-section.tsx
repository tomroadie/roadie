"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  disconnectInstagram,
  type InstagramDisconnectState,
} from "./actions";

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
}: {
  instagramUserId: string | null;
  canConnectLiveStats: boolean;
}) {
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
        Connects your Instagram Business account for real-time performance data
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
          Live Instagram stats are available on the Pro plan.
          <Link
            href="/pricing"
            className="ml-1 font-semibold text-brand hover:underline"
          >
            Upgrade →
          </Link>
        </p>
      )}

      {state?.error ? (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
