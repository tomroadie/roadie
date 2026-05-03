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
    return "bg-emerald-500/15 text-emerald-200 ring-emerald-500/25";
  }
  if (t.includes("release")) {
    return "bg-purple-500/15 text-purple-200 ring-purple-500/25";
  }
  if (t.includes("rehears")) {
    return "bg-amber-500/15 text-amber-200 ring-amber-500/25";
  }
  if (t.includes("studio") || t.includes("session")) {
    return "bg-sky-500/15 text-sky-200 ring-sky-500/25";
  }
  return "bg-zinc-500/15 text-zinc-200 ring-zinc-500/25";
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

function EventList({
  title,
  rows,
  deletingId,
  onEdit,
  onDelete,
}: {
  title: string;
  rows: EventRow[];
  deletingId: string | null;
  onEdit: (ev: EventRow) => void;
  onDelete: (id: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="text-xs font-bold uppercase tracking-widest text-brand">
        {title}
      </h2>
      <ul className="mt-4 flex flex-col gap-4">
        {rows.map((ev) => (
          <li key={ev.id}>
            {(() => {
              const d = formatEventDate(ev.event_date);
              return (
                <article className="flex flex-col gap-4 rounded-xl border border-card-border bg-card p-6 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-1 gap-4">
                    <div className="flex w-14 flex-col items-center justify-center rounded-xl bg-input p-3 text-center">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-brand">
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
                        <p className="text-sm leading-relaxed text-muted-strong">
                          {ev.notes}
                        </p>
                      ) : (
                        <p className="text-sm text-muted">No content notes yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(ev)}
                      className="rounded-lg border border-card-border bg-transparent px-3 py-1.5 text-sm font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-brand"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(ev.id)}
                      disabled={deletingId === ev.id}
                      className="rounded-lg border border-card-border bg-transparent px-3 py-1.5 text-sm font-semibold uppercase tracking-wide text-red-400 transition-colors hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-50"
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

    let data: EventRow | null = null;
    let error: { message: string } | null = null;

    if (isEditing) {
      const r = await supabase
        .from("events")
        .update(payload)
        .eq("id", editingId as string)
        .select("id, title, event_date, event_type, notes")
        .single();
      data = r.data as EventRow | null;
      error = r.error;
    } else {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        setFormError("You must be signed in to add an event.");
        setSubmitting(false);
        return;
      }
      const r = await supabase
        .from("events")
        .insert({ artist_id: artistId, user_id: user.id, ...payload })
        .select("id, title, event_date, event_type, notes")
        .single();
      data = r.data as EventRow | null;
      error = r.error;
    }

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

  return (
    <div className="space-y-10">
      <form onSubmit={handleAdd} className="space-y-6">
        <div className="flex flex-col gap-6">
          <div className="mt-6">
            <label
              htmlFor="event-title"
              className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
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
              className="w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <div>
            <label
              htmlFor="event-date"
              className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
            >
              Date
            </label>
            <input
              id="event-date"
              type="date"
              required
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <div>
            <label
              htmlFor="event-type"
              className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
            >
              Type
            </label>
            <select
              id="event-type"
              value={eventType}
              onChange={(e) => setEventType(e.target.value as EventType)}
              className="w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus:border-brand focus:ring-2 focus:ring-brand/20"
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
              className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
            >
              Content notes{" "}
              <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="event-notes"
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What do you want people to know about this? Any ideas already?"
              className="w-full resize-y rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
        </div>

        {formError ? (
          <p className="text-sm text-red-400" role="alert">
            {formError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
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
            className="ml-3 inline-flex h-10 items-center justify-center rounded-lg border border-card-border bg-transparent px-4 text-sm font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-brand"
          >
            Cancel
          </button>
        ) : null}
      </form>

      <section>
        <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
          All dates
        </h2>
        {events.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-card-border bg-input p-10 text-center">
            <p className="text-sm leading-relaxed text-muted">
              No dates yet. Add a few real-world moments so your weekly plan can
              get specific.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => quickAdd("Show")}
                className="inline-flex h-10 items-center justify-center rounded-full border border-card-border bg-transparent px-4 text-sm font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-brand"
              >
                + Add a show
              </button>
              <button
                type="button"
                onClick={() => quickAdd("Release")}
                className="inline-flex h-10 items-center justify-center rounded-full border border-card-border bg-transparent px-4 text-sm font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-brand"
              >
                + Add a release
              </button>
              <button
                type="button"
                onClick={() => quickAdd("Studio session")}
                className="inline-flex h-10 items-center justify-center rounded-full border border-card-border bg-transparent px-4 text-sm font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-brand"
              >
                + Add a studio session
              </button>
            </div>
          </div>
        ) : (
          <>
            <EventList
              title="This week"
              rows={grouped.thisWeek}
              deletingId={deletingId}
              onEdit={startEdit}
              onDelete={handleDelete}
            />
            <EventList
              title="Next 30 days"
              rows={grouped.next30}
              deletingId={deletingId}
              onEdit={startEdit}
              onDelete={handleDelete}
            />
            <EventList
              title="Further ahead"
              rows={grouped.further}
              deletingId={deletingId}
              onEdit={startEdit}
              onDelete={handleDelete}
            />
            <EventList
              title="Past"
              rows={grouped.past}
              deletingId={deletingId}
              onEdit={startEdit}
              onDelete={handleDelete}
            />
          </>
        )}
      </section>
    </div>
  );
}
