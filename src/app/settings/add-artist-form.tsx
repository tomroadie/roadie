"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addArtist, type AddArtistState } from "./actions";
import { GENRES } from "@/app/onboarding/genres";
import Link from "next/link";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
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
    <form action={formAction} className="mt-6 space-y-4 rounded-xl border border-card-border bg-card p-7 shadow-sm">
      <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
        Add another artist
      </h2>
      <p className="text-sm text-muted">
        Creates a separate profile, calendar, weekly plans, and audits for this
        act. Switch between artists from the navigation bar.
      </p>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="add-artist_name"
            className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
          >
            Artist name
          </label>
          <input
            id="add-artist_name"
            name="artist_name"
            type="text"
            required
            autoComplete="organization"
            className="w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
            placeholder="Stage or project name"
          />
        </div>

        <div>
          <label
            htmlFor="add-artist_genre"
            className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
          >
            Genre
          </label>
          <select
            id="add-artist_genre"
            name="genre"
            required
            defaultValue=""
            className="w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus:border-brand focus:ring-2 focus:ring-brand/20"
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
            className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
          >
            Sub-genre or sound{" "}
            <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="add-artist_sound"
            name="sound_description"
            type="text"
            className="w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <div>
          <label
            htmlFor="add-artist_similar"
            className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
          >
            Similar artists{" "}
            <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="add-artist_similar"
            name="similar_artists"
            type="text"
            className="w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </div>

      {state?.error ? (
        <div role="alert" className="space-y-2 text-sm text-red-400">
          <p>{state.error}</p>
          {state.upgrade ? (
            <p className="text-red-400">
              Upgrade to add more artists.{" "}
              <Link
                href="/pricing"
                className="font-semibold underline underline-offset-4 hover:text-brand hover:no-underline"
              >
                View pricing
              </Link>
              .
            </p>
          ) : null}
        </div>
      ) : null}

      <SubmitButton />
    </form>
  );
}
