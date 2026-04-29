"use client";

import { createClient } from "@/utils/supabase/client";
import { useMemo, useState } from "react";
import {
  EVENT_TYPES,
  type EventRow,
  type EventType,
} from "@/types/event";

function formatEventDate(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

type EventsSectionProps = {
  initialEvents: EventRow[];
  userId: string;
};

export function EventsSection({ initialEvents, userId }: EventsSectionProps) {
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
        user_id: userId,
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
          className="inline-flex h-10 items-center justify-center rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
                <article className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-background p-5 dark:border-zinc-800 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      {formatEventDate(ev.event_date)}
                    </p>
                    <h3 className="text-base font-semibold text-foreground">
                      {ev.title}
                    </h3>
                    <span className="inline-flex w-fit rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs font-medium text-foreground dark:border-zinc-700">
                      {ev.event_type}
                    </span>
                    {ev.notes?.trim() ? (
                      <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                        {ev.notes}
                      </p>
                    ) : null}
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
