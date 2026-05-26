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
      {pending ? "Saving…" : "Let's go"}
    </button>
  );
}

function StepDots({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex justify-center gap-2" aria-hidden="true">
      {([1, 2] as const).map((s) => (
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
  const [step, setStep] = useState<1 | 2>(1);
  const [artistName, setArtistName] = useState("");
  const [genre, setGenre] = useState("");
  const [voiceDescription, setVoiceDescription] = useState("");
  const [postingFrequency, setPostingFrequency] = useState<
    "weekly" | "regular" | "active"
  >("regular");
  const [instagramHandle, setInstagramHandle] = useState("");

  const step1Valid = Boolean(artistName.trim() && genre);

  return (
    <form action={formAction} className="space-y-6 rounded-xl border border-card-border bg-card p-6">
      <div className="space-y-3 border-b border-card-border pb-5">
        <p className="text-center text-xs font-bold uppercase tracking-widest text-muted">
          Step {step} of 2
        </p>
        <StepDots step={step} />
      </div>

      {step !== 1 ? (
        <>
          <input type="hidden" name="artist_name" value={artistName} />
          <input type="hidden" name="genre" value={genre} />
          <input type="hidden" name="instagram_handle" value={instagramHandle} />
        </>
      ) : null}
      {step !== 2 ? (
        <>
          <input type="hidden" name="posting_frequency" value={postingFrequency} />
          <input type="hidden" name="voice_description" value={voiceDescription} />
        </>
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
          <h2 className="text-base font-semibold text-foreground">How do you want to show up?</h2>
          <div>
            <p className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand">
              How often do you want to post?
            </p>
            <div role="radiogroup" className="grid gap-2">
              {(
                [
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
                ] as const
              ).map((opt) => {
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
                        <span className="font-normal text-muted">— {opt.description}</span>
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

          <div>
            <label
              htmlFor="voice_description"
              className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
            >
              How would you describe yourself in your own words?{" "}
              <span className="font-normal text-muted">(optional)</span>
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

          {state?.error ? (
            <p className="text-sm text-red-400" role="alert">
              {state.error}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
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
