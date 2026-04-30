"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addArtist, type AddArtistState } from "./actions";
import { GENRES } from "@/app/onboarding/genres";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 items-center justify-center rounded-lg bg-[#7C3AED] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Creating…" : "Add artist"}
    </button>
  );
}

export function AddArtistForm() {
  const [state, formAction] = useActionState<AddArtistState, FormData>(
    addArtist,
    null
  );

  return (
    <form action={formAction} className="mt-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        Add another artist
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Creates a separate profile, calendar, weekly plans, and audits for this
        act. Switch between artists from the navigation bar.
      </p>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="add-artist_name"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Artist name
          </label>
          <input
            id="add-artist_name"
            name="artist_name"
            type="text"
            required
            autoComplete="organization"
            className="w-full rounded-lg border border-zinc-200 bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-zinc-400 focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 dark:border-zinc-800 dark:focus:border-[#7C3AED] dark:focus:ring-[#7C3AED]/20"
            placeholder="Stage or project name"
          />
        </div>

        <div>
          <label
            htmlFor="add-artist_genre"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Genre
          </label>
          <select
            id="add-artist_genre"
            name="genre"
            required
            defaultValue=""
            className="w-full rounded-lg border border-zinc-200 bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 dark:border-zinc-800 dark:focus:border-[#7C3AED] dark:focus:ring-[#7C3AED]/20"
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
            htmlFor="add-artist_sound"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Sub-genre or sound{" "}
            <span className="font-normal text-zinc-500">(optional)</span>
          </label>
          <input
            id="add-artist_sound"
            name="sound_description"
            type="text"
            className="w-full rounded-lg border border-zinc-200 bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-zinc-400 focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 dark:border-zinc-800 dark:focus:border-[#7C3AED] dark:focus:ring-[#7C3AED]/20"
          />
        </div>

        <div>
          <label
            htmlFor="add-artist_similar"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Similar artists{" "}
            <span className="font-normal text-zinc-500">(optional)</span>
          </label>
          <input
            id="add-artist_similar"
            name="similar_artists"
            type="text"
            className="w-full rounded-lg border border-zinc-200 bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-zinc-400 focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 dark:border-zinc-800 dark:focus:border-[#7C3AED] dark:focus:ring-[#7C3AED]/20"
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
