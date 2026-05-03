"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { completeOnboarding } from "./actions";
import { GENRES } from "./genres";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-11 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save and go to dashboard"}
    </button>
  );
}

function StepDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex justify-center gap-2" aria-hidden="true">
      {([1, 2, 3] as const).map((s) => (
        <span
          key={s}
          className={
            s === step
              ? "h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-brand/30"
              : "h-2.5 w-2.5 rounded-full bg-zinc-700"
          }
        />
      ))}
    </div>
  );
}

export function OnboardingForm() {
  const [state, formAction] = useActionState(completeOnboarding, null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [artistName, setArtistName] = useState("");
  const [genre, setGenre] = useState("");
  const [soundDescription, setSoundDescription] = useState("");
  const [similarArtists, setSimilarArtists] = useState("");
  const [voiceDescription, setVoiceDescription] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");

  const step1Valid = Boolean(artistName.trim() && genre);

  return (
    <form action={formAction} className="space-y-6 rounded-xl border border-card-border bg-card p-6">
      <div className="space-y-3 border-b border-card-border pb-5">
        <p className="text-center text-xs font-bold uppercase tracking-widest text-muted">
          Step {step} of 3
        </p>
        <StepDots step={step} />
      </div>

      {/* Always submit all fields */}
      {step !== 1 ? (
        <>
          <input type="hidden" name="artist_name" value={artistName} />
          <input type="hidden" name="genre" value={genre} />
        </>
      ) : null}
      {step !== 2 ? (
        <>
          <input type="hidden" name="sound_description" value={soundDescription} />
          <input type="hidden" name="similar_artists" value={similarArtists} />
          <input type="hidden" name="voice_description" value={voiceDescription} />
        </>
      ) : null}
      {step !== 3 ? (
        <input type="hidden" name="instagram_handle" value={instagramHandle} />
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">Tell us about your music</h2>
          <div>
            <label
              htmlFor="artist_name"
              className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
            >
              Artist name
            </label>
            <input
              id="artist_name"
              name="artist_name"
              type="text"
              required
              autoComplete="organization"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              className="w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
              placeholder="Your stage or project name"
            />
          </div>

          <div>
            <label
              htmlFor="genre"
              className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
            >
              Genre
            </label>
            <select
              id="genre"
              name="genre"
              required
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
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

          <button
            type="button"
            disabled={!step1Valid}
            onClick={() => {
              if (step1Valid) setStep(2);
            }}
            className="flex h-11 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">Define your sound</h2>
          <div>
            <label
              htmlFor="sound_description"
              className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
            >
              Sub-genre or sound{" "}
              <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="sound_description"
              name="sound_description"
              type="text"
              value={soundDescription}
              onChange={(e) => setSoundDescription(e.target.value)}
              className="w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
              placeholder="e.g. dark folk, cinematic trap, bedroom pop with jazz influences"
            />
          </div>

          <div>
            <label
              htmlFor="similar_artists"
              className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
            >
              Similar artists{" "}
              <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="similar_artists"
              name="similar_artists"
              type="text"
              value={similarArtists}
              onChange={(e) => setSimilarArtists(e.target.value)}
              className="w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
              placeholder="e.g. Frank Ocean, SZA"
            />
          </div>

          <div>
            <label
              htmlFor="voice_description"
              className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
            >
              How would you describe yourself in your own words?
            </label>
            <textarea
              id="voice_description"
              name="voice_description"
              rows={5}
              value={voiceDescription}
              onChange={(e) => setVoiceDescription(e.target.value)}
              className="w-full resize-y rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
              placeholder={
                "Write freely — e.g. 'I'm a DIY pop artist from Cornwall making dramatic songs about real life...'"
              }
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex h-11 w-full items-center justify-center rounded-lg border border-card-border bg-transparent px-4 text-sm font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-brand sm:w-auto sm:min-w-[7rem]"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex h-11 w-full flex-1 items-center justify-center rounded-lg bg-brand px-4 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95 sm:flex-initial sm:min-w-[7rem]"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">Connect your Instagram</h2>
          <div>
            <label
              htmlFor="instagram_handle"
              className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
            >
              Instagram handle{" "}
              <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="instagram_handle"
              name="instagram_handle"
              type="text"
              autoComplete="off"
              value={instagramHandle}
              onChange={(e) => setInstagramHandle(e.target.value)}
              className="w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
              placeholder="e.g. @dyeband"
            />
            <p className="mt-2 text-xs leading-relaxed text-muted">
              We&apos;ll use this to pull your Instagram audit — takes 2-3 minutes
            </p>
          </div>

          <p className="rounded-lg border border-card-border bg-input px-3 py-3 text-sm leading-relaxed text-muted">
            We&apos;ll run a free Instagram audit in the background — your first content plan will be
            shaped by real data from your profile.
          </p>

          {state?.error ? (
            <p className="text-sm text-red-400" role="alert">
              {state.error}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex h-11 w-full items-center justify-center rounded-lg border border-card-border bg-transparent px-4 text-sm font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-brand sm:w-auto sm:min-w-[7rem]"
            >
              Back
            </button>
            <div className="flex w-full flex-1 flex-col gap-3 sm:max-w-xs">
              <SubmitButton />
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
