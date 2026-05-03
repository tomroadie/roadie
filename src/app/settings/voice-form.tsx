"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateVoiceDescription, type VoiceDescriptionState } from "./actions";

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

export function VoiceForm({
  initialVoice,
}: {
  initialVoice: string | null;
}) {
  const displayDefault = initialVoice?.trim() ?? "";

  const [state, formAction] = useActionState<
    VoiceDescriptionState,
    FormData
  >(updateVoiceDescription, null);

  return (
    <form
      key={displayDefault}
      action={formAction}
      className="mt-6 space-y-4 rounded-xl border border-card-border bg-card p-7 shadow-sm"
    >
      <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
        Your voice
      </h2>

      <div>
        <label
          htmlFor="settings-voice_description"
          className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
        >
          How would you describe yourself in your own words?
        </label>
        <textarea
          id="settings-voice_description"
          name="voice_description"
          rows={5}
          defaultValue={displayDefault}
          autoComplete="off"
          className="min-h-[120px] w-full resize-y rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
          placeholder="Write freely — this helps us write content that actually sounds like you. E.g. 'I'm a DIY pop artist from Cornwall making dramatic songs about real life drama...'"
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
