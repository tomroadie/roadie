"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { adminRunAuditForArtist, adminSwitchArtist } from "./actions";

export type AdminArtistDirectoryRow = {
  id: string;
  created_at: string;
  owner_user_id: string;
  owner_email: string;
  artist_name: string;
  genre: string;
  instagram_handle: string;
  plan: string;
  plan_override: string | null;
  cron_active: boolean;
  is_managed: boolean;
  last_plan_at: string | null;
};

const PLAN_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "starter", label: "Starter" },
  { value: "pro", label: "Pro" },
  { value: "label", label: "Label" },
] as const;

const PLAN_OVERRIDE_OPTIONS = [
  { value: "", label: "No override" },
  { value: "starter", label: "Starter" },
  { value: "pro", label: "Pro" },
  { value: "label", label: "Label" },
] as const;

function formatCreated(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type ArtistPatch = {
  cron_active?: boolean;
  plan_override?: string | null;
  plan?: string;
  is_managed?: boolean;
};

async function patchArtist(
  artistId: string,
  patch: ArtistPatch
): Promise<{ error?: string }> {
  const res = await fetch("/api/admin/update-artist", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ artist_id: artistId, ...patch }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    details?: string;
  };
  if (!res.ok) {
    return {
      error: data.details
        ? `${data.error ?? "Update failed"}: ${data.details}`
        : (data.error ?? `HTTP ${res.status}`),
    };
  }
  return {};
}

export function AdminArtistsTable({ rows }: { rows: AdminArtistDirectoryRow[] }) {
  const [localRows, setLocalRows] = useState<AdminArtistDirectoryRow[]>(() => rows);
  const [q, setQ] = useState("");
  const [auditBusy, setAuditBusy] = useState<string | null>(null);
  const [cronBusy, setCronBusy] = useState<string | null>(null);
  const [planBusy, setPlanBusy] = useState<string | null>(null);
  const [managedBusy, setManagedBusy] = useState<string | null>(null);
  const [planOverrideBusy, setPlanOverrideBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [controlsError, setControlsError] = useState<string | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  function flashSaved(artistId: string) {
    setSavedHint(artistId);
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    savedTimeoutRef.current = setTimeout(() => {
      setSavedHint((current) => (current === artistId ? null : current));
    }, 2000);
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return localRows;
    return localRows.filter((r) => {
      const hay = [
        r.artist_name,
        r.owner_email,
        r.genre,
        r.instagram_handle,
        r.plan,
        r.plan_override ?? "",
        r.is_managed ? "managed" : "self-serve",
        r.cron_active ? "active" : "inactive",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [q, localRows]);

  async function handleRunAudit(artistId: string) {
    setAuditError(null);
    setAuditBusy(artistId);
    const res = await adminRunAuditForArtist(artistId);
    setAuditBusy(null);
    if (res.error) {
      setAuditError(res.error);
    }
  }

  async function handlePlanChange(artistId: string, value: string) {
    setControlsError(null);
    setPlanBusy(artistId);
    const res = await patchArtist(artistId, { plan: value });
    setPlanBusy(null);
    if (res.error) {
      setControlsError(res.error);
      return;
    }
    setLocalRows((prev) =>
      prev.map((row) => (row.id === artistId ? { ...row, plan: value } : row))
    );
    flashSaved(artistId);
  }

  async function handleToggleManaged(artistId: string, nextManaged: boolean) {
    setControlsError(null);
    setManagedBusy(artistId);
    const res = await patchArtist(artistId, { is_managed: nextManaged });
    setManagedBusy(null);
    if (res.error) {
      setControlsError(res.error);
      return;
    }
    setLocalRows((prev) =>
      prev.map((row) =>
        row.id === artistId ? { ...row, is_managed: nextManaged } : row
      )
    );
    flashSaved(artistId);
  }

  async function handleToggleCron(artistId: string, nextActive: boolean) {
    setControlsError(null);
    setCronBusy(artistId);
    const res = await patchArtist(artistId, { cron_active: nextActive });
    setCronBusy(null);
    if (res.error) {
      setControlsError(res.error);
      return;
    }
    setLocalRows((prev) =>
      prev.map((row) =>
        row.id === artistId ? { ...row, cron_active: nextActive } : row
      )
    );
    flashSaved(artistId);
  }

  async function handlePlanOverrideChange(artistId: string, value: string) {
    setControlsError(null);
    setPlanOverrideBusy(artistId);
    const planOverride = value === "" ? null : value;
    const res = await patchArtist(artistId, { plan_override: planOverride });
    setPlanOverrideBusy(null);
    if (res.error) {
      setControlsError(res.error);
      return;
    }
    setLocalRows((prev) =>
      prev.map((row) =>
        row.id === artistId ? { ...row, plan_override: planOverride } : row
      )
    );
    flashSaved(artistId);
  }

  async function handleDelete(artistId: string) {
    setDeleting(artistId);
    try {
      const res = await fetch("/api/admin/delete-artist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          artist_id: artistId,
        }),
      });
      if (res.ok) {
        setLocalRows((prev) => prev.filter((row) => row.id !== artistId));
        setConfirming(null);
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        alert(data.error ?? "Delete failed");
      }
    } catch {
      alert("Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="mt-10 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
            Artists
          </h2>
          <p className="mt-1 text-sm text-muted">
            {localRows.length} artist{localRows.length === 1 ? "" : "s"} in the directory.
          </p>
        </div>
        <div className="w-full sm:max-w-xs">
          <label
            htmlFor="admin-search"
            className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
          >
            Search
          </label>
          <input
            id="admin-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, email, genre, IG…"
            className="w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </div>

      {auditError ? (
        <p className="text-sm text-red-400" role="alert">
          {auditError}
        </p>
      ) : null}

      {controlsError ? (
        <p className="text-sm text-red-400" role="alert">
          {controlsError}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-card-border bg-card shadow-sm">
        <table className="min-w-full divide-y divide-[#1a1a1a] text-left text-sm">
          <thead>
            <tr className="text-xs font-bold uppercase tracking-widest text-muted">
              <th className="whitespace-nowrap px-4 py-3">Artist</th>
              <th className="whitespace-nowrap px-4 py-3">Plan</th>
              <th className="whitespace-nowrap px-4 py-3">Plan override</th>
              <th className="whitespace-nowrap px-4 py-3">Managed</th>
              <th className="whitespace-nowrap px-4 py-3">Weekly crons</th>
              <th className="whitespace-nowrap px-4 py-3">Instagram</th>
              <th className="whitespace-nowrap px-4 py-3">Last plan</th>
              <th className="whitespace-nowrap px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1a1a]">
            {filtered.map((r) => (
              <tr key={r.id} className="text-foreground">
                <td className="px-4 py-3 font-semibold">{r.artist_name.trim()}</td>
                <td className="px-4 py-3">
                  <label className="sr-only" htmlFor={`plan-${r.id}`}>
                    Plan for {r.artist_name}
                  </label>
                  <select
                    id={`plan-${r.id}`}
                    value={r.plan}
                    disabled={planBusy === r.id}
                    onChange={(e) => void handlePlanChange(r.id, e.target.value)}
                    className="rounded-md border border-card-border bg-input px-2 py-1 text-xs font-semibold uppercase text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
                  >
                    {PLAN_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {savedHint === r.id && planBusy !== r.id ? (
                    <p className="mt-1 text-[10px] font-semibold text-brand">Saved</p>
                  ) : planBusy === r.id ? (
                    <p className="mt-1 text-[10px] text-muted">Saving…</p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <label className="sr-only" htmlFor={`plan-override-${r.id}`}>
                    Plan override for {r.artist_name}
                  </label>
                  <select
                    id={`plan-override-${r.id}`}
                    value={r.plan_override ?? ""}
                    disabled={planOverrideBusy === r.id}
                    onChange={(e) =>
                      void handlePlanOverrideChange(r.id, e.target.value)
                    }
                    className="w-full min-w-[8rem] rounded-lg border border-card-border bg-input px-2 py-1.5 text-xs text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
                  >
                    {PLAN_OVERRIDE_OPTIONS.map((opt) => (
                      <option key={opt.value || "none"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 max-w-[12rem] text-[10px] leading-snug text-muted">
                    Overrides feature access without affecting billing
                  </p>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={managedBusy === r.id}
                    onClick={() => void handleToggleManaged(r.id, !r.is_managed)}
                    className={[
                      "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide transition-colors disabled:opacity-60",
                      r.is_managed
                        ? "bg-brand text-brand-foreground"
                        : "bg-input text-muted",
                    ].join(" ")}
                  >
                    {managedBusy === r.id
                      ? "Saving…"
                      : r.is_managed
                        ? "Managed"
                        : "Self-serve"}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={r.cron_active}
                      aria-label={`${r.cron_active ? "Disable" : "Enable"} weekly crons for ${r.artist_name}`}
                      disabled={cronBusy === r.id}
                      onClick={() => void handleToggleCron(r.id, !r.cron_active)}
                      className={[
                        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-60",
                        r.cron_active ? "bg-brand" : "bg-zinc-700",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                          r.cron_active ? "translate-x-6" : "translate-x-1",
                        ].join(" ")}
                      />
                    </button>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                      Weekly crons
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-strong">
                  {r.instagram_handle ? `@${r.instagram_handle.replace(/^@/, "")}` : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-strong">
                  {r.last_plan_at ? formatCreated(r.last_plan_at) : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-col items-stretch gap-2 sm:items-end">
                    <form action={adminSwitchArtist} className="inline-block w-full sm:w-auto">
                      <input type="hidden" name="artistId" value={r.id} />
                      <button
                        type="submit"
                        className="inline-flex h-9 w-full min-w-[8rem] items-center justify-center rounded-lg border border-card-border bg-transparent px-3 text-xs font-bold uppercase tracking-wide text-foreground transition-colors hover:border-brand"
                      >
                        Switch to this artist
                      </button>
                    </form>
                    <button
                      type="button"
                      disabled={auditBusy === r.id || !r.instagram_handle.trim()}
                      onClick={() => void handleRunAudit(r.id)}
                      className="inline-flex h-9 w-full min-w-[8rem] items-center justify-center rounded-lg bg-brand px-3 text-xs font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {auditBusy === r.id ? "Running…" : "Run audit"}
                    </button>
                    {confirming === r.id ? (
                      <div className="flex flex-col gap-1.5">
                        <p className="text-xs font-semibold text-red-400">
                          Delete {r.artist_name}?
                        </p>
                        <p className="text-xs text-muted">This cannot be undone.</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleDelete(r.id)}
                            disabled={deleting === r.id}
                            className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-black text-white hover:bg-red-600 disabled:opacity-50"
                          >
                            {deleting === r.id ? "Deleting..." : "Confirm"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirming(null)}
                            className="rounded-lg border border-card-border bg-input px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirming(r.id)}
                        className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/20"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">No matching artists.</p>
        ) : null}
      </div>
    </div>
  );
}
