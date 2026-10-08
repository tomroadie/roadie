"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { completeOnboarding } from "./actions";
import { GENRES } from "./genres";
import {
  CONFIDENCE_OPTIONS,
  CURRENT_POSTING_OPTIONS,
  WEEKDAYS,
  type Confidence,
  type CurrentPosting,
} from "@/lib/starting-point";

type Step = 1 | 2 | 3;
const STEPS: Step[] = [1, 2, 3];

const INPUT =
  "w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20";
const LABEL = "mb-2 block text-xs font-bold uppercase tracking-widest text-brand";
const PRIMARY =
  "flex h-11 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY =
  "flex h-11 w-full items-center justify-center rounded-lg border border-card-border bg-transparent px-4 text-sm font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-brand sm:w-auto sm:min-w-[7rem]";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={PRIMARY}>
      {pending ? "Setting you up…" : "Let's go"}
    </button>
  );
}

function StepDots({ step }: { step: Step }) {
  return (
    <div className="flex justify-center gap-2" aria-hidden="true">
      {STEPS.map((s) => (
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

function Choice<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly { value: T; label: string; description?: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className={LABEL}>{legend}</legend>
      <div className="grid gap-2">
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.value)}
              className={[
                "flex w-full items-start gap-3 rounded-xl border bg-input px-4 py-3 text-left transition-colors",
                selected ? "border-brand ring-2 ring-brand/20" : "border-card-border hover:border-brand",
              ].join(" ")}
            >
              <span
                className={[
                  "mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full border",
                  selected ? "border-brand" : "border-card-border",
                ].join(" ")}
                aria-hidden="true"
              >
                <span className={["h-2.5 w-2.5 rounded-full", selected ? "bg-brand" : "bg-transparent"].join(" ")} />
              </span>
              <span className="min-w-0 text-sm font-semibold text-foreground">
                {opt.label}
                {opt.description ? (
                  <span className="block text-xs font-normal text-muted">{opt.description}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function OnboardingForm() {
  const [state, formAction] = useActionState(completeOnboarding, null);
  const [step, setStep] = useState<Step>(1);

  const [artistName, setArtistName] = useState("");
  const [genre, setGenre] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");

  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [currentPosting, setCurrentPosting] = useState<CurrentPosting | null>(null);

  const [days, setDays] = useState<number[]>([]);
  const [comingUp, setComingUp] = useState("");

  const step1Valid = Boolean(artistName.trim() && genre);
  const step2Valid = Boolean(confidence && currentPosting);

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  return (
    <form action={formAction} className="space-y-6 rounded-xl border border-card-border bg-card p-6">
      <div className="space-y-3 border-b border-card-border pb-5">
        <p className="text-center text-xs font-bold uppercase tracking-widest text-muted">
          Step {step} of {STEPS.length}
        </p>
        <StepDots step={step} />
      </div>

      {/* Every answer travels as a hidden field, whichever step is showing. */}
      <input type="hidden" name="artist_name" value={artistName} />
      <input type="hidden" name="genre" value={genre} />
      <input type="hidden" name="instagram_handle" value={instagramHandle} />
      <input type="hidden" name="posting_confidence" value={confidence ?? ""} />
      <input type="hidden" name="current_posting" value={currentPosting ?? ""} />
      {days.map((d) => (
        <input key={d} type="hidden" name="content_days" value={d} />
      ))}
      <input type="hidden" name="coming_up" value={comingUp} />

      {step === 1 ? (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">Tell us about your music</h2>
          <div>
            <label htmlFor="artist_name" className={LABEL}>
              Artist name
            </label>
            <input
              id="artist_name"
              type="text"
              required
              autoComplete="organization"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              className={INPUT}
              placeholder="Your stage or project name"
            />
          </div>

          <div>
            <label htmlFor="genre" className={LABEL}>
              Genre
            </label>
            <select id="genre" required value={genre} onChange={(e) => setGenre(e.target.value)} className={INPUT}>
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
            <label htmlFor="instagram_handle" className={LABEL}>
              Instagram handle <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="instagram_handle"
              type="text"
              autoComplete="off"
              value={instagramHandle}
              onChange={(e) => setInstagramHandle(e.target.value)}
              className={INPUT}
              placeholder="e.g. @dyeband"
            />
            <p className="mt-2 text-xs leading-relaxed text-muted">
              We&apos;ll run a free audit of your posts in the background, so your ideas come from what already works for you.
            </p>
          </div>

          <button type="button" disabled={!step1Valid} onClick={() => step1Valid && setStep(2)} className={PRIMARY}>
            Next
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">Where are you starting?</h2>
            <p className="mt-1 text-sm text-muted">
              No wrong answers. We start you where you are and build up gently from there.
            </p>
          </div>

          <Choice
            legend="How do you feel about posting?"
            options={CONFIDENCE_OPTIONS}
            value={confidence}
            onChange={setConfidence}
          />
          <Choice
            legend="How often do you post right now?"
            options={CURRENT_POSTING_OPTIONS}
            value={currentPosting}
            onChange={setCurrentPosting}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button type="button" onClick={() => setStep(1)} className={SECONDARY}>
              Back
            </button>
            <button
              type="button"
              disabled={!step2Valid}
              onClick={() => step2Valid && setStep(3)}
              className={`${PRIMARY} sm:max-w-xs`}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">Your week</h2>
            <p className="mt-1 text-sm text-muted">All optional. It helps us send ideas at the right time.</p>
          </div>

          <fieldset>
            <legend className={LABEL}>Which days do you usually have time to make content?</legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => {
                const on = days.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDay(d.value)}
                    className={[
                      "h-10 min-w-[3.25rem] rounded-lg border px-3 text-sm font-semibold transition-colors",
                      on
                        ? "border-brand bg-brand/15 text-brand"
                        : "border-card-border bg-input text-foreground hover:border-brand",
                    ].join(" ")}
                  >
                    {d.short}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted">Your weekly ideas arrive on the first of these.</p>
          </fieldset>


          <div>
            <label htmlFor="coming_up" className={LABEL}>
              Anything coming up?
            </label>
            <textarea
              id="coming_up"
              rows={3}
              value={comingUp}
              onChange={(e) => setComingUp(e.target.value)}
              className={INPUT}
              placeholder="Single out 14 Nov, Fleece gig on the 12th…"
            />
            <p className="mt-2 text-xs text-muted">Write it however you like. We&apos;ll pick out the dates.</p>
          </div>

          {state?.error ? (
            <p className="text-sm text-red-400" role="alert">
              {state.error}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button type="button" onClick={() => setStep(2)} className={SECONDARY}>
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
