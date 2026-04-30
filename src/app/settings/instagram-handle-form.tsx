"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateInstagramHandle,
  type InstagramHandleState,
} from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

export function InstagramHandleForm({
  initialHandle,
}: {
  initialHandle: string | null;
}) {
  const displayDefault =
    initialHandle?.trim().replace(/^@/, "") ?? "";

  const [state, formAction] = useActionState<
    InstagramHandleState,
    FormData
  >(updateInstagramHandle, null);

  return (
    <form
      key={initialHandle ?? ""}
      action={formAction}
      className="mt-6 space-y-4 rounded-xl border border-card-border bg-card p-7 shadow-sm"
    >
      <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
        Instagram
      </h2>
      <p className="text-sm text-muted">
        Used for your audit and insights. You can enter @handle or a profile URL.
      </p>

      <div>
        <label
          htmlFor="settings-instagram_handle"
          className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
        >
          Instagram handle
        </label>
        <input
          id="settings-instagram_handle"
          name="instagram_handle"
          type="text"
          defaultValue={displayDefault}
          autoComplete="off"
          className="w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
          placeholder="@yourartist"
        />
      </div>

      {state?.error ? (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
