"use client";

import { createClient } from "@/utils/supabase/client";
import { useMemo, useState } from "react";
import {
  EVENT_TYPES,
  type EventRow,
  type EventType,
} from "@/types/event";

function formatEventDate(isoDate: string): { day: string; month: string } {
  const d = new Date(isoDate + "T12:00:00");
  const day = d.toLocaleDateString("en-GB", { day: "numeric" });
  const month = d
    .toLocaleDateString("en-GB", { month: "short" })
    .toUpperCase();
  return { day, month };
}

function badgeClass(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("show") || t.includes("gig")) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-900/40";
  }
  if (t.includes("release")) {
    return "bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-950/40 dark:text-purple-200 dark:ring-purple-900/40";
  }
  if (t.includes("rehears")) {
    return "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-900/40";
  }
  if (t.includes("studio") || t.includes("session")) {
    return "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/30 dark:text-blue-200 dark:ring-blue-900/40";
  }
  return "bg-zinc-50 text-zinc-700 ring-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-200 dark:ring-zinc-800";
}

function isoToday(): string {
  const d = new Date();
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return local.toISOString().slice(0, 10);
}

function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  function sortByDateAsc(a: EventRow, b: EventRow): number {
    return a.event_date.localeCompare(b.event_date);
  }

  function resetForm() {
    setTitle("");
    setEventDate("");
    setEventType(EVENT_TYPES[0]);
    setNotes("");
    setEditingId(null);
  }

  function startEdit(ev: EventRow) {
    setFormError(null);
    setEditingId(ev.id);
    setTitle(ev.title);
    setEventDate(ev.event_date);
    setEventType(ev.event_type as EventType);
    setNotes(ev.notes ?? "");
    // Keep scroll behavior simple; user requested visual polish only elsewhere.
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!title.trim() || !eventDate) {
      setFormError("Add a title and date.");
      return;
    }

    setSubmitting(true);
    const isEditing = Boolean(editingId);
    const payload = {
      title: title.trim(),
      event_date: eventDate,
      event_type: eventType,
      notes: notes.trim() || null,
    };

    const { data, error } = isEditing
      ? await supabase
          .from("events")
          .update(payload)
          .eq("id", editingId as string)
          .select("id, title, event_date, event_type, notes")
          .single()
      : await supabase
          .from("events")
          .insert({ artist_id: artistId, ...payload })
          .select("id, title, event_date, event_type, notes")
          .single();

    if (error) {
      setFormError(error.message);
      setSubmitting(false);
      return;
    }

    if (data) {
      if (isEditing) {
        setEvents((prev) =>
          prev.map((e) => (e.id === (data as EventRow).id ? (data as EventRow) : e)).sort(sortByDateAsc)
        );
      } else {
        setEvents((prev) => [...prev, data as EventRow].sort(sortByDateAsc));
      }
      resetForm();
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

  const today = isoToday();
  const weekEnd = addDaysISO(today, 7);
  const in30 = addDaysISO(today, 30);

  const grouped = useMemo(() => {
    const past: EventRow[] = [];
    const thisWeek: EventRow[] = [];
    const next30: EventRow[] = [];
    const further: EventRow[] = [];

    for (const ev of events) {
      if (ev.event_date < today) {
        past.push(ev);
      } else if (ev.event_date <= weekEnd) {
        thisWeek.push(ev);
      } else if (ev.event_date <= in30) {
        next30.push(ev);
      } else {
        further.push(ev);
      }
    }

    return { thisWeek, next30, further, past };
  }, [events, in30, today, weekEnd]);

  function quickAdd(type: EventType) {
    setEventType(type);
    setTitle(
      type === "Show"
        ? "Show"
        : type === "Release"
          ? "Release"
          : type === "Studio session"
            ? "Studio session"
            : ""
    );
  }

  function EventList({ title, rows }: { title: string; rows: EventRow[] }) {
    if (rows.length === 0) return null;
    return (
      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
          {title}
        </h2>
        <ul className="mt-4 flex flex-col gap-4">
          {rows.map((ev) => (
            <li key={ev.id}>
              {(() => {
                const d = formatEventDate(ev.event_date);
                return (
                  <article className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:bg-zinc-950 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-1 gap-4">
                      <div className="flex w-14 flex-col items-center justify-center rounded-2xl bg-white p-3 text-center shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:bg-zinc-950">
                        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                          {d.month}
                        </span>
                        <span className="mt-1 text-xl font-extrabold leading-none text-foreground">
                          {d.day}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
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
                        </div>

                        {ev.notes?.trim() ? (
                          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                            {ev.notes}
                          </p>
                        ) : (
                          <p className="text-sm text-slate-400">
                            No content notes yet.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(ev)}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(ev.id)}
                        disabled={deletingId === ev.id}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        {deletingId === ev.id ? "Removing…" : "Delete"}
                      </button>
                    </div>
                  </article>
                );
              })()}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <div className="space-y-10">
      <form onSubmit={handleAdd} className="space-y-6">
        <div className="flex flex-col gap-6">
          <div className="mt-6">
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
              className="w-full rounded-lg border border-zinc-200 bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-zinc-400 focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 dark:border-zinc-800 dark:focus:border-[#7C3AED] dark:focus:ring-[#7C3AED]/20"
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
              className="w-full rounded-lg border border-zinc-200 bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 dark:border-zinc-800 dark:focus:border-[#7C3AED] dark:focus:ring-[#7C3AED]/20"
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
              className="w-full rounded-lg border border-zinc-200 bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 dark:border-zinc-800 dark:focus:border-[#7C3AED] dark:focus:ring-[#7C3AED]/20"
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
              Content notes{" "}
              <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <textarea
              id="event-notes"
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What do you want people to know about this? Any ideas already?"
              className="w-full resize-y rounded-lg border border-zinc-200 bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-zinc-400 focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 dark:border-zinc-800 dark:focus:border-[#7C3AED] dark:focus:ring-[#7C3AED]/20"
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
          {submitting
            ? editingId
              ? "Saving…"
              : "Adding…"
            : editingId
              ? "Save changes"
              : "Add date"}
        </button>
        {editingId ? (
          <button
            type="button"
            onClick={resetForm}
            className="ml-3 inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
        ) : null}
      </form>

      <section>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          All dates
        </h2>
        {events.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:border-zinc-700 dark:bg-zinc-950">
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              No dates yet. Add a few real-world moments so your weekly plan can
              get specific.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => quickAdd("Show")}
                className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
              >
                + Add a show
              </button>
              <button
                type="button"
                onClick={() => quickAdd("Release")}
                className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
              >
                + Add a release
              </button>
              <button
                type="button"
                onClick={() => quickAdd("Studio session")}
                className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
              >
                + Add a studio session
              </button>
            </div>
          </div>
        ) : (
          <>
            <EventList title="This week" rows={grouped.thisWeek} />
            <EventList title="Next 30 days" rows={grouped.next30} />
            <EventList title="Further ahead" rows={grouped.further} />
            <EventList title="Past" rows={grouped.past} />
          </>
        )}
      </section>
    </div>
  );
}
