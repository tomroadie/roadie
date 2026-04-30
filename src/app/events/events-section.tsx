"use client";

import { createClient } from "@/utils/supabase/client";
import { useMemo, useState } from "react";
import {
  EVENT_TYPES,
  type EventRow,
  type EventType,
} from "@/types/event";

function formatEventDate(isoDate: string): { day: string; rest: string } {
  const d = new Date(isoDate + "T12:00:00");
  const day = d.toLocaleDateString("en-GB", { day: "numeric" });
  const rest = d.toLocaleDateString("en-GB", { weekday: "short", month: "short" });
  return { day, rest };
}

function badgeClass(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("show") || t.includes("gig")) {
    return "bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-950/40 dark:text-purple-200 dark:ring-purple-900/40";
  }
  if (t.includes("release")) {
    return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-900/40";
  }
  if (t.includes("rehears")) {
    return "bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-950/30 dark:text-teal-200 dark:ring-teal-900/40";
  }
  if (t.includes("studio") || t.includes("session")) {
    return "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/30 dark:text-blue-200 dark:ring-blue-900/40";
  }
  return "bg-zinc-50 text-zinc-700 ring-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-200 dark:ring-zinc-800";
}

type EventsSectionProps = {
  initialEvents: EventRow[];
  artistId: string;
};

export function EventsSection({ initialEvents, artistId }: EventsSectionProps) {
  const [events, setEvents] = useState<EventRow[]>(initialEvents);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventType, setEventType] = useState<EventType>(EVENT_TYPES[0]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  function sortByDateAsc(a: EventRow, b: EventRow): number {
    return a.event_date.localeCompare(b.event_date);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!title.trim() || !eventDate) {
      setFormError("Add a title and date.");
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase
      .from("events")
      .insert({
        artist_id: artistId,
        title: title.trim(),
        event_date: eventDate,
        event_type: eventType,
        notes: notes.trim() || null,
      })
      .select("id, title, event_date, event_type, notes")
      .single();

    if (error) {
      setFormError(error.message);
      setSubmitting(false);
      return;
    }

    if (data) {
      setEvents((prev) => [...prev, data as EventRow].sort(sortByDateAsc));
      setTitle("");
      setEventDate("");
      setEventType(EVENT_TYPES[0]);
      setNotes("");
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const { error } = await supabase.from("events").delete().eq("id", id);

    if (error) {
      setFormError(error.message);
      setDeletingId(null);
      return;
    }

    setEvents((prev) => prev.filter((ev) => ev.id !== id));
    setDeletingId(null);
  }

  return (
    <div className="space-y-10">
      <form onSubmit={handleAdd} className="space-y-4">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="event-title"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Title
            </label>
            <input
              id="event-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Show at Scala, Single release, Studio session"
              className="w-full rounded-lg border border-zinc-200 bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20 dark:border-zinc-800 dark:focus:border-zinc-600 dark:focus:ring-zinc-600/20"
            />
          </div>
          <div>
            <label
              htmlFor="event-date"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Date
            </label>
            <input
              id="event-date"
              type="date"
              required
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20 dark:border-zinc-800 dark:focus:border-zinc-600 dark:focus:ring-zinc-600/20"
            />
          </div>
          <div>
            <label
              htmlFor="event-type"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Type
            </label>
            <select
              id="event-type"
              value={eventType}
              onChange={(e) => setEventType(e.target.value as EventType)}
              className="w-full rounded-lg border border-zinc-200 bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20 dark:border-zinc-800 dark:focus:border-zinc-600 dark:focus:ring-zinc-600/20"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="event-notes"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Notes <span className="font-normal text-zinc-500">(optional)</span>
            </label>
            <textarea
              id="event-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any details that might inspire content ideas…"
              className="w-full resize-y rounded-lg border border-zinc-200 bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20 dark:border-zinc-800 dark:focus:border-zinc-600 dark:focus:ring-zinc-600/20"
            />
          </div>
        </div>

        {formError ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {formError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[#7C3AED] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add date"}
        </button>
      </form>

      <section>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          All dates
        </h2>
        {events.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            No dates yet. Add shows, releases, and sessions so your weekly plan
            can reflect what is actually happening.
          </p>
        ) : (
          <ul className="mt-6 flex flex-col gap-4">
            {events.map((ev) => (
              <li key={ev.id}>
                {(() => {
                  const d = formatEventDate(ev.event_date);
                  return (
                <article className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-1 gap-4">
                    <div className="flex w-14 flex-col items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 py-2 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
                      <span className="text-lg font-semibold text-foreground">
                        {d.day}
                      </span>
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        {d.rest}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <h3 className="text-base font-semibold leading-snug text-foreground">
                        {ev.title}
                      </h3>
                      <span
                        className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${badgeClass(
                          ev.event_type
                        )}`}
                      >
                        {ev.event_type}
                      </span>
                    {ev.notes?.trim() ? (
                      <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                        {ev.notes}
                      </p>
                    ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(ev.id)}
                    disabled={deletingId === ev.id}
                    className="shrink-0 self-start rounded-lg border border-zinc-200 bg-background px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    {deletingId === ev.id ? "Removing…" : "Delete"}
                  </button>
                </article>
                  );
                })()}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
