"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { completeOnboarding } from "./actions";
import { GENRES } from "./genres";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-11 w-full items-center justify-center rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Saving…" : "Continue"}
    </button>
  );
}

export function OnboardingForm() {
  const [state, formAction] = useActionState(completeOnboarding, null);

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-4">
        <div>
          <label
            htmlFor="artist_name"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Artist name
          </label>
          <input
            id="artist_name"
            name="artist_name"
            type="text"
            required
            autoComplete="organization"
            className="w-full rounded-lg border border-zinc-200 bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20 dark:border-zinc-800 dark:focus:border-zinc-600 dark:focus:ring-zinc-600/20"
            placeholder="Your stage or project name"
          />
        </div>

        <div>
          <label
            htmlFor="genre"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Genre
          </label>
          <select
            id="genre"
            name="genre"
            required
            defaultValue=""
            className="w-full rounded-lg border border-zinc-200 bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20 dark:border-zinc-800 dark:focus:border-zinc-600 dark:focus:ring-zinc-600/20"
          >
            <option value="" disabled>
              Select a genre
            </option>
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="sound_description"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Sub-genre or sound{" "}
            <span className="font-normal text-zinc-500">(optional)</span>
          </label>
          <input
            id="sound_description"
            name="sound_description"
            type="text"
            className="w-full rounded-lg border border-zinc-200 bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20 dark:border-zinc-800 dark:focus:border-zinc-600 dark:focus:ring-zinc-600/20"
            placeholder="e.g. dark folk, cinematic trap, bedroom pop with jazz influences"
          />
        </div>

        <div>
          <label
            htmlFor="similar_artists"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Similar artists{" "}
            <span className="font-normal text-zinc-500">(optional)</span>
          </label>
          <input
            id="similar_artists"
            name="similar_artists"
            type="text"
            className="w-full rounded-lg border border-zinc-200 bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20 dark:border-zinc-800 dark:focus:border-zinc-600 dark:focus:ring-zinc-600/20"
            placeholder="e.g. Frank Ocean, SZA"
          />
        </div>
      </div>

      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
