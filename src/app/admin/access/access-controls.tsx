"use client";

import { useActionState, useState, useTransition } from "react";
import { declineRequest, inviteByEmail, inviteRequest, type InviteResult } from "./actions";

const INPUT =
  "h-10 w-full rounded-lg border border-card-border bg-input px-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-brand";

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteResult | null, FormData>(inviteByEmail, null);
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input name="email" type="email" required placeholder="Email" className={INPUT} />
      <input name="name" type="text" placeholder="Artist name (optional)" className={INPUT} />
      <button
        type="submit"
        disabled={pending}
        className="h-10 shrink-0 rounded-lg bg-brand px-4 text-sm font-bold text-brand-foreground disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send invite"}
      </button>
      {state ? (
        <span className={`text-sm ${state.ok ? "text-brand" : "text-red-300"}`}>{state.ok ? "Invite sent." : state.error}</span>
      ) : null}
    </form>
  );
}

export function RequestActions({
  id,
  email,
  status,
}: {
  id: string;
  email: string;
  status: "new" | "invited" | "declined";
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run(fn: () => Promise<InviteResult>, done: string) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? done : r.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => inviteRequest(id, email), "Invite sent.")}
        className="font-semibold text-brand underline-offset-2 hover:underline disabled:opacity-50"
      >
        {status === "invited" ? "Resend invite" : "Invite"}
      </button>
      {status !== "declined" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => declineRequest(id), "Declined.")}
          className="text-muted hover:text-foreground disabled:opacity-50"
        >
          Decline
        </button>
      ) : null}
      {msg ? <span className="text-muted">{msg}</span> : null}
    </div>
  );
}
