"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ContentIdea } from "@/types/content-plan";

export type PlanReviewPlan = {
  id: string;
  artist_id: string;
  artist_name: string;
  week_start: string;
  concepts: unknown;
  admin_note: string | null;
  status: string;
};

type PlanConcept = ContentIdea & { variant: string };

type PlanSlot = {
  slot_number: number;
  slot_purpose: string;
  suggested_day: string;
  concepts: PlanConcept[];
};

function formatWeekStart(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function truncate(text: string, max: number): string {
  const t = String(text ?? "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

function parseConceptSlots(concepts: unknown): PlanSlot[] {
  if (!concepts || typeof concepts !== "object") return [];
  const slots = (concepts as { slots?: unknown }).slots;
  if (!Array.isArray(slots)) return [];

  return slots
    .filter((slot): slot is PlanSlot => {
      if (!slot || typeof slot !== "object") return false;
      const s = slot as Record<string, unknown>;
      return (
        typeof s.slot_number === "number" &&
        typeof s.slot_purpose === "string" &&
        typeof s.suggested_day === "string" &&
        Array.isArray(s.concepts)
      );
    })
    .map((slot) => ({
      ...slot,
      concepts: slot.concepts.filter(
        (c): c is PlanConcept =>
          !!c &&
          typeof c === "object" &&
          typeof (c as PlanConcept).variant === "string" &&
          typeof (c as PlanConcept).format === "string" &&
          typeof (c as PlanConcept).hook === "string" &&
          typeof (c as PlanConcept).caption === "string" &&
          typeof (c as PlanConcept).why === "string" &&
          typeof (c as PlanConcept).timing === "string"
      ),
    }))
    .sort((a, b) => a.slot_number - b.slot_number);
}

function defaultSelections(slots: PlanSlot[]): Record<number, number> {
  const next: Record<number, number> = {};
  for (const slot of slots) {
    next[slot.slot_number] = 0;
  }
  return next;
}

function variantLabel(variant: string): string {
  const v = variant.trim().toLowerCase();
  if (v === "safe") return "Safe";
  if (v === "creative") return "Creative";
  if (v === "bold") return "Bold";
  return variant;
}

function variantBadgeClass(variant: string): string {
  const v = variant.trim().toLowerCase();
  if (v === "safe") {
    return "bg-blue-500/10 text-blue-300 ring-blue-500/30";
  }
  if (v === "creative") {
    return "bg-purple-500/10 text-purple-300 ring-purple-500/30";
  }
  if (v === "bold") {
    return "bg-amber-500/10 text-amber-300 ring-amber-500/30";
  }
  return "bg-white/5 text-muted ring-white/10";
}

function editKey(slotNumber: number, conceptIndex: number): string {
  return `${slotNumber}-${conceptIndex}`;
}

function mergeConcept(
  concept: PlanConcept,
  edits: Partial<ContentIdea> | undefined
): ContentIdea {
  return {
    format: concept.format,
    hook: edits?.hook ?? concept.hook,
    caption: edits?.caption ?? concept.caption,
    why: edits?.why ?? concept.why,
    timing: edits?.timing ?? concept.timing,
  };
}

export function PlanReviewSection({ plans }: { plans: PlanReviewPlan[] }) {
  const [localPlans, setLocalPlans] = useState<PlanReviewPlan[]>(() => plans);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<number, number>>({});
  const [editedConcepts, setEditedConcepts] = useState<
    Record<string, Partial<ContentIdea>>
  >({});
  const [adminNote, setAdminNote] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setLocalPlans(plans);
  }, [plans]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selectedPlan = useMemo(
    () => localPlans.find((plan) => plan.id === selectedPlanId) ?? null,
    [localPlans, selectedPlanId]
  );

  const selectedSlots = useMemo(
    () => (selectedPlan ? parseConceptSlots(selectedPlan.concepts) : []),
    [selectedPlan]
  );

  const resetPlanEditor = useCallback((plan: PlanReviewPlan) => {
    const slots = parseConceptSlots(plan.concepts);
    setSelections(defaultSelections(slots));
    setEditedConcepts({});
    setAdminNote(plan.admin_note ?? "");
    setEditingKey(null);
    setError(null);
  }, []);

  const openPlan = useCallback(
    (planId: string) => {
      const plan = localPlans.find((p) => p.id === planId);
      if (!plan) return;
      setSelectedPlanId(planId);
      resetPlanEditor(plan);
    },
    [localPlans, resetPlanEditor]
  );

  function updateEditField(
    key: string,
    field: keyof ContentIdea,
    value: string
  ) {
    setEditedConcepts((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }

  function buildIdeas(): ContentIdea[] {
    return selectedSlots.map((slot) => {
      const conceptIndex = selections[slot.slot_number] ?? 0;
      const concept = slot.concepts[conceptIndex];
      if (!concept) {
        throw new Error(`Missing concept for slot ${slot.slot_number}`);
      }
      return mergeConcept(concept, editedConcepts[editKey(slot.slot_number, conceptIndex)]);
    });
  }

  function buildUpdatedConceptsPayload() {
    if (!selectedPlan) return null;
    const base =
      selectedPlan.concepts &&
      typeof selectedPlan.concepts === "object" &&
      !Array.isArray(selectedPlan.concepts)
        ? { ...(selectedPlan.concepts as Record<string, unknown>) }
        : { slots: selectedSlots };

    const slots = selectedSlots.map((slot) => ({
      ...slot,
      concepts: slot.concepts.map((concept, index) => ({
        ...concept,
        ...editedConcepts[editKey(slot.slot_number, index)],
      })),
    }));

    return { ...base, slots };
  }

  async function handlePublish() {
    if (!selectedPlan || publishing) return;
    setError(null);
    setPublishing(true);
    try {
      const ideas = buildIdeas();
      const res = await fetch("/api/admin/plans", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: selectedPlan.id,
          ideas,
          admin_note: adminNote,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          details?: string;
        };
        setError(
          data.details
            ? `${data.error ?? "Request failed"}: ${data.details}`
            : (data.error ?? "Could not publish plan.")
        );
        return;
      }

      setLocalPlans((prev) => prev.filter((plan) => plan.id !== selectedPlan.id));
      setSelectedPlanId(null);
      setToast(`Plan published for ${selectedPlan.artist_name}`);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleSaveDraft() {
    if (!selectedPlan || savingDraft) return;
    setError(null);
    setSavingDraft(true);
    try {
      const res = await fetch("/api/admin/plans", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: selectedPlan.id,
          admin_note: adminNote,
          concepts: buildUpdatedConceptsPayload(),
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          details?: string;
        };
        setError(
          data.details
            ? `${data.error ?? "Request failed"}: ${data.details}`
            : (data.error ?? "Could not save draft.")
        );
        return;
      }

      setLocalPlans((prev) =>
        prev.map((plan) =>
          plan.id === selectedPlan.id
            ? {
                ...plan,
                admin_note: adminNote,
                concepts: buildUpdatedConceptsPayload(),
              }
            : plan
        )
      );
      setToast("Draft saved");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSavingDraft(false);
    }
  }

  return (
    <div className="relative mt-8">
      {toast ? (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-200 shadow-lg"
        >
          {toast}
        </div>
      ) : null}

      <div className="mb-4">
        <span className="inline-flex items-center rounded-full bg-brand/15 px-3 py-1 text-sm font-bold text-brand ring-1 ring-inset ring-brand/30">
          {localPlans.length} plan{localPlans.length === 1 ? "" : "s"} awaiting
          review
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <section className="rounded-xl border border-card-border bg-card p-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted">
            Pending
          </h2>
          {localPlans.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No plans awaiting review.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {localPlans.map((plan) => {
                const isSelected = selectedPlanId === plan.id;
                return (
                  <li key={plan.id}>
                    <button
                      type="button"
                      onClick={() => openPlan(plan.id)}
                      className={[
                        "w-full rounded-lg border px-3 py-3 text-left transition-colors",
                        isSelected
                          ? "border-brand bg-brand/10"
                          : "border-card-border hover:border-brand/40 hover:bg-white/3",
                      ].join(" ")}
                    >
                      <div className="font-semibold text-foreground">
                        {plan.artist_name}
                      </div>
                      <div className="mt-1 text-xs text-muted">
                        Week of {formatWeekStart(plan.week_start)}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="min-w-0 rounded-xl border border-card-border bg-card p-6">
          {!selectedPlan ? (
            <p className="text-sm text-muted">
              Select a plan to review its concept slots.
            </p>
          ) : (
            <>
              <header className="border-b border-card-border pb-4">
                <h2 className="text-xl font-bold text-foreground">
                  {selectedPlan.artist_name}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Week of {formatWeekStart(selectedPlan.week_start)}
                </p>
              </header>

              {selectedSlots.length === 0 ? (
                <p className="mt-6 text-sm text-muted">
                  No concept slots found for this plan.
                </p>
              ) : (
                <div className="mt-6 space-y-8">
                  {selectedSlots.map((slot) => {
                    const selectedIndex = selections[slot.slot_number] ?? 0;
                    return (
                      <div key={slot.slot_number}>
                        <div className="mb-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-widest text-muted">
                              Slot {slot.slot_number}
                            </span>
                            <span className="text-xs text-muted">·</span>
                            <span className="text-xs font-semibold text-foreground">
                              {slot.suggested_day}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-muted-strong">
                            {slot.slot_purpose}
                          </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          {slot.concepts.map((concept, conceptIndex) => {
                            const key = editKey(slot.slot_number, conceptIndex);
                            const isSelected = selectedIndex === conceptIndex;
                            const isEditing = editingKey === key;
                            const merged = mergeConcept(
                              concept,
                              editedConcepts[key]
                            );

                            return (
                              <article
                                key={key}
                                className={[
                                  "flex flex-col rounded-lg border bg-background/40 p-4 transition-colors",
                                  isSelected
                                    ? "border-brand ring-1 ring-brand/40"
                                    : "border-card-border hover:border-brand/30",
                                ].join(" ")}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelections((prev) => ({
                                      ...prev,
                                      [slot.slot_number]: conceptIndex,
                                    }));
                                    if (!isSelected) {
                                      setEditingKey(null);
                                    }
                                  }}
                                  className="flex flex-1 flex-col text-left"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={[
                                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ring-1 ring-inset",
                                        variantBadgeClass(concept.variant),
                                      ].join(" ")}
                                    >
                                      {variantLabel(concept.variant)}
                                    </span>
                                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-medium text-muted">
                                      {concept.format}
                                    </span>
                                  </div>
                                  <h3 className="mt-3 text-sm font-semibold text-foreground">
                                    {merged.hook}
                                  </h3>
                                  <p className="mt-2 text-sm text-muted-strong">
                                    {truncate(merged.caption, 140) || "—"}
                                  </p>
                                  <p className="mt-3 text-xs text-muted">
                                    {merged.why}
                                  </p>
                                  <p className="mt-2 text-xs font-medium text-foreground">
                                    {merged.timing}
                                  </p>
                                </button>

                                {isSelected ? (
                                  <div className="mt-4 border-t border-card-border pt-4">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditingKey((prev) =>
                                          prev === key ? null : key
                                        )
                                      }
                                      className="text-xs font-bold uppercase tracking-wide text-brand transition-colors hover:text-brand/80"
                                    >
                                      {isEditing ? "Hide edit" : "Edit"}
                                    </button>

                                    {isEditing ? (
                                      <div className="mt-3 space-y-3">
                                        {(
                                          [
                                            ["hook", "Hook"],
                                            ["caption", "Caption"],
                                            ["why", "Why"],
                                            ["timing", "Timing"],
                                          ] as const
                                        ).map(([field, label]) => (
                                          <label
                                            key={field}
                                            className="block text-xs font-semibold uppercase tracking-wide text-muted"
                                          >
                                            {label}
                                            <textarea
                                              rows={field === "caption" ? 4 : 2}
                                              value={merged[field]}
                                              onChange={(e) =>
                                                updateEditField(
                                                  key,
                                                  field,
                                                  e.target.value
                                                )
                                              }
                                              className="mt-1 w-full rounded-lg border border-card-border bg-card px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground"
                                            />
                                          </label>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-8 space-y-4 border-t border-card-border pt-6">
                <label className="block text-sm font-semibold text-foreground">
                  Note to artist (optional)
                  <textarea
                    rows={3}
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="Any context or guidance for the artist this week…"
                    className="mt-2 w-full rounded-lg border border-card-border bg-background/40 px-3 py-2 text-sm text-foreground"
                  />
                </label>

                {error ? (
                  <p className="text-sm text-destructive">{error}</p>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={publishing || savingDraft || selectedSlots.length === 0}
                    className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {publishing ? "Publishing…" : "Publish plan"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={publishing || savingDraft}
                    className="rounded-lg border border-card-border bg-transparent px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingDraft ? "Saving…" : "Save draft"}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
