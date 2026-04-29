export type EventRow = {
  id: string;
  title: string;
  event_date: string;
  event_type: string;
  notes: string | null;
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
