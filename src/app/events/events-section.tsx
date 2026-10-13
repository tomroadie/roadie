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
    return "bg-emerald-500/15 text-emerald-800 ring-emerald-500/25";
  }
  if (t.includes("release")) {
    return "bg-purple-500/15 text-purple-800 ring-purple-500/25";
  }
  if (t.includes("rehears")) {
    return "bg-amber-500/15 text-amber-800 ring-amber-500/25";
  }
  if (t.includes("studio") || t.includes("session")) {
    return "bg-sky-500/15 text-sky-800 ring-sky-500/25";
  }
  return "bg-zinc-500/15 text-foreground ring-zinc-500/25";
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
    <section className="mt-8">
      <h2 className="text-lg font-bold text-foreground">
        {title}
      </h2>
      <ul className="mt-3 flex flex-col gap-3">
        {rows.map((ev) => (
          <li key={ev.id}>
            {(() => {
              const d = formatEventDate(ev.event_date);
              return (
                <article className="flex flex-col gap-4 rounded-2xl border border-card-border bg-card p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-1 gap-4">
                    <div className="flex w-14 flex-col items-center justify-center rounded-xl bg-background p-3 text-center">
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
                        <p className="text-sm leading-relaxed text-muted">{ev.notes}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(ev)}
                      className="min-h-10 rounded-lg border border-card-border px-3 text-sm font-semibold text-foreground hover:bg-background"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(ev.id)}
                      disabled={deletingId === ev.id}
                      className="min-h-10 px-2 text-sm font-semibold text-muted hover:text-red-800 disabled:opacity-50"
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
  const [formOpen, setFormOpen] = useState(initialEvents.length === 0);
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
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = isEditing
      ? await supabase
          .from("events")
          .update(payload)
          .eq("id", editingId as string)
          .select("id, title, event_date, event_type, notes")
          .single()
      : await supabase
          .from("events")
          .insert({ artist_id: artistId, user_id: user?.id, ...payload })
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
      if (!isEditing) setFormOpen(false);
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

  return (
    <div className="mt-6">
      {formOpen ? (
        <div className="rounded-2xl border border-card-border bg-card p-5">
          <h2 className="text-lg font-bold text-foreground">{editingId ? "Edit date" : "Add a date"}</h2>
          <form onSubmit={handleAdd} className="mt-4 flex flex-col gap-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-[2_1_240px]">
                <label htmlFor="event-title" className="mb-1 block text-sm font-semibold text-foreground">What is it?</label>
                <input
                  id="event-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Show at Scala, Single out, Studio session"
                  className="w-full min-h-10 rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <div className="flex-[1_1_160px]">
                <label htmlFor="event-date" className="mb-1 block text-sm font-semibold text-foreground">Date</label>
                <input
                  id="event-date"
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full min-h-10 rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <div className="flex-[1_1_160px]">
                <label htmlFor="event-type" className="mb-1 block text-sm font-semibold text-foreground">Type</label>
                <select
                  id="event-type"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as EventType)}
                  className="w-full min-h-10 rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="event-notes" className="mb-1 block text-sm font-semibold text-foreground">
                Notes <span className="font-normal text-muted">(optional)</span>
              </label>
              <textarea
                id="event-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything worth knowing: who you're supporting, what's new, ideas you already have."
                className="w-full min-h-10 rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20 resize-y"
              />
            </div>

            {formError ? (
              <p className="text-sm font-semibold text-red-800" role="alert">
                {formError}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-ink-foreground hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Saving…" : editingId ? "Save changes" : "Add date"}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setFormError(null);
                  if (events.length > 0) setFormOpen(false);
                }}
                className="min-h-10 px-2 text-sm font-semibold text-muted hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setFormOpen(true);
          }}
          className="min-h-10 self-start rounded-lg bg-ink px-4 text-sm font-semibold text-ink-foreground hover:opacity-90"
        >
          Add a date
        </button>
      )}

      {events.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-card-border bg-card p-6 text-muted">
          No dates yet. Add your next show, release or session so your weeks plan around it.
        </p>
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
    </div>
  );
}
