export type EventRow = {
  id: string;
  title: string;
  event_date: string;
  event_type: string;
  notes: string | null;
  /** Optional page about the date; Tempo reads it and keeps a short summary. */
  link_url?: string | null;
  link_context?: string | null;
  link_status?: "ok" | "failed" | null;
};

export const EVENT_TYPES = [
  "Show",
  "Release",
  "Rehearsal",
  "Studio session",
  "Press/Interview",
  "Collaboration",
  "Other",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];
