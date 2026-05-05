"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  updatePostingFrequency,
  type PostingFrequencyState,
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

const OPTIONS = [
  {
    value: "weekly",
    label: "Weekly (1-2x per week)",
    description: "quality over quantity",
  },
  {
    value: "regular",
    label: "Regular (3-4x per week)",
    description: "consistent presence",
  },
  {
    value: "active",
    label: "Active (5+ per week)",
    description: "maximum growth mode",
  },
] as const;

export function PostingGoalForm({
  initialPostingFrequency,
}: {
  initialPostingFrequency: "weekly" | "regular" | "active" | null;
}) {
  const initialAllowed = ["weekly", "regular", "active"] as const;
  const initial = initialAllowed.includes(
    (initialPostingFrequency ?? "regular") as (typeof initialAllowed)[number]
  )
    ? ((initialPostingFrequency ?? "regular") as (typeof initialAllowed)[number])
    : "regular";

  const [postingFrequency, setPostingFrequency] = useState<
    "weekly" | "regular" | "active"
  >(initial);

  const [state, formAction] = useActionState<
    PostingFrequencyState,
    FormData
  >(updatePostingFrequency, null);

  return (
    <form
      key={initialPostingFrequency ?? "regular"}
      action={formAction}
      className="mt-6 space-y-4 rounded-xl border border-card-border bg-card p-7 shadow-sm"
    >
      <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
        Posting goal
      </h2>
      <p className="text-sm text-muted">
        Pick a pace that feels sustainable — we&apos;ll shape your plan around it.
      </p>

      <div>
        <p className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand">
          How often do you want to post?
        </p>
        <div role="radiogroup" className="grid gap-2">
          {OPTIONS.map((opt) => {
            const selected = postingFrequency === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPostingFrequency(opt.value)}
                className={[
                  "flex w-full items-start gap-3 rounded-xl border bg-input p-4 text-left transition-colors",
                  selected
                    ? "border-brand ring-2 ring-brand/20"
                    : "border-card-border hover:border-brand",
                ].join(" ")}
                aria-pressed={selected}
              >
                <span
                  className={[
                    "mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full border",
                    selected ? "border-brand" : "border-card-border",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  <span
                    className={[
                      "h-2.5 w-2.5 rounded-full",
                      selected ? "bg-brand" : "bg-transparent",
                    ].join(" ")}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">
                    {opt.label}{" "}
                    <span className="font-normal text-muted">
                      — {opt.description}
                    </span>
                  </span>
                  <input
                    type="radio"
                    name="posting_frequency"
                    value={opt.value}
                    checked={selected}
                    onChange={() => setPostingFrequency(opt.value)}
                    className="sr-only"
                  />
                </span>
              </button>
            );
          })}
        </div>
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

