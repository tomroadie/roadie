/**
 * Onboarding "where are you starting?" options and the rules that turn the
 * answers into a starting weekly target and the day an artist's week starts.
 * Shared by the form (client) and the server action, so no server imports.
 */

export const CONFIDENCE_OPTIONS = [
  { value: "hard", label: "I find it hard", description: "posting feels like a chore or exposing" },
  { value: "getting_there", label: "Getting there", description: "fine once I get going" },
  { value: "comfortable", label: "Comfortable", description: "I just need ideas and a nudge" },
] as const;

export const CURRENT_POSTING_OPTIONS = [
  { value: "rarely", label: "Rarely, or not for a while" },
  { value: "weekly", label: "About once a week" },
  { value: "few_times", label: "A few times a week" },
  { value: "most_days", label: "Most days" },
] as const;

export const WANTED_FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Once or twice a week" },
  { value: "regular", label: "Three or four times a week" },
  { value: "active", label: "Five or more" },
] as const;

/** Monday first, as people think about their week. Values match Date.getDay(). */
export const WEEKDAYS = [
  { value: 1, short: "Mon" },
  { value: 2, short: "Tue" },
  { value: 3, short: "Wed" },
  { value: 4, short: "Thu" },
  { value: 5, short: "Fri" },
  { value: 6, short: "Sat" },
  { value: 0, short: "Sun" },
] as const;

export const TONE_TAGS = [
  "Chatty",
  "Low-key",
  "Funny",
  "Heartfelt",
  "Arty",
  "Loud and proud",
] as const;

export type Confidence = (typeof CONFIDENCE_OPTIONS)[number]["value"];
export type CurrentPosting = (typeof CURRENT_POSTING_OPTIONS)[number]["value"];
export type WantedFrequency = (typeof WANTED_FREQUENCY_OPTIONS)[number]["value"];

const CURRENT_TO_TARGET: Record<CurrentPosting, number> = {
  rarely: 1,
  weekly: 1,
  few_times: 2,
  most_days: 3,
};

const WANTED_CEILING: Record<WantedFrequency, number> = {
  weekly: 2,
  regular: 4,
  active: 6,
};

/**
 * Start where they are, not where they want to be: roughly what they do now,
 * never above what they asked for, and one a week for anyone who finds it
 * hard. The weekly job raises it as they hit it.
 */
export function startingTargetFromAnswers(a: {
  confidence: Confidence | null;
  currentPosting: CurrentPosting | null;
  wanted: WantedFrequency;
}): number {
  if (a.confidence === "hard") return 1;
  const now = a.currentPosting ? CURRENT_TO_TARGET[a.currentPosting] : 1;
  return Math.max(1, Math.min(now, WANTED_CEILING[a.wanted]));
}

/**
 * Their week starts on the first day they have time to create (Monday-first
 * order), so "Your week" lands on a day they can act on it. Monday if none.
 */
export function weekStartFromDays(days: number[]): number {
  for (const d of WEEKDAYS) {
    if (days.includes(d.value)) return d.value;
  }
  return 1;
}

export function isConfidence(v: string): v is Confidence {
  return CONFIDENCE_OPTIONS.some((o) => o.value === v);
}
export function isCurrentPosting(v: string): v is CurrentPosting {
  return CURRENT_POSTING_OPTIONS.some((o) => o.value === v);
}
export function isWantedFrequency(v: string): v is WantedFrequency {
  return WANTED_FREQUENCY_OPTIONS.some((o) => o.value === v);
}
