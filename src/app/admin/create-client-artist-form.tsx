"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  adminCreateClientArtist,
  type AdminCreateArtistState,
} from "./actions";
import { GENRES } from "@/app/onboarding/genres";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Creating…" : "Create new artist"}
    </button>
  );
}

export function AdminCreateClientArtistForm() {
  const [state, formAction] = useActionState<
    AdminCreateArtistState,
    FormData
  >(adminCreateClientArtist, null);

  return (
    <form
      action={formAction}
      className="mt-6 space-y-4 rounded-xl border border-card-border bg-card p-7 shadow-sm"
    >
      <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
        Create client artist
      </h2>
      <p className="text-sm text-muted">
        Creates an artist owned by your admin account (no separate login). Appears
        in the table below as a managed client; after create you return here with
        that artist as your active context.
      </p>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="admin-artist_name"
            className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
          >
            Artist name
          </label>
          <input
            id="admin-artist_name"
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
            htmlFor="admin-artist_genre"
            className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
          >
            Genre
          </label>
          <select
            id="admin-artist_genre"
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
            htmlFor="admin-instagram"
            className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
          >
            Instagram handle{" "}
            <span className="font-normal text-muted">(for audits)</span>
          </label>
          <input
            id="admin-instagram"
            name="instagram_handle"
            type="text"
            className="w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
            placeholder="@artist or URL"
          />
        </div>

        <div>
          <label
            htmlFor="admin-artist_sound"
            className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
          >
            Sub-genre or sound{" "}
            <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="admin-artist_sound"
            name="sound_description"
            type="text"
            className="w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <div>
          <label
            htmlFor="admin-artist_similar"
            className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
          >
            Similar artists{" "}
            <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="admin-artist_similar"
            name="similar_artists"
            type="text"
            className="w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
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
