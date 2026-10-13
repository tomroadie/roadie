"use client";

import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABEL, type AccountType } from "@/lib/account-types";
import { useEffect, useMemo, useRef, useState } from "react";
import { adminRunAuditForArtist, adminSwitchArtist } from "./actions";
import { SetupPanel } from "./setup-panel";

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
  is_private: boolean;
  account_type: AccountType;
  /** Has an Instagram connection Tempo can sync from. */
  instagram_connected: boolean;
  last_plan_at: string | null;
  board_enabled: boolean;
  /** A first or new week written and waiting to be published. */
  has_draft: boolean;
  post_count: number;
  last_synced: string | null;
  weekly_target: number | null;
  posted_this_week: number;
};

export type ArtistStatus = "needs_instagram" | "not_set_up" | "ready" | "live" | "watching";

const STATUS_LABEL: Record<ArtistStatus, string> = {
  needs_instagram: "Needs Instagram",
  not_set_up: "Not set up",
  ready: "Ready to publish",
  live: "Live",
  watching: "Watching",
};

const STATUS_CLASS: Record<ArtistStatus, string> = {
  needs_instagram: "bg-amber-500/15 text-amber-900",
  not_set_up: "bg-input text-muted-strong",
  ready: "bg-sky-500/15 text-sky-900",
  live: "bg-brand-soft text-brand",
  watching: "bg-purple-500/15 text-purple-900",
};

export function statusOf(r: AdminArtistDirectoryRow): ArtistStatus {
  if (!r.instagram_connected) return "needs_instagram";
  if (r.account_type !== "artist") return r.post_count > 0 ? "watching" : "not_set_up";
  if (r.board_enabled) return "live";
  if (r.has_draft) return "ready";
  return "not_set_up";
}

function synced(iso: string | null): string {
  if (!iso) return "never synced";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 60) return `synced ${Math.max(1, mins)} min ago`;
  if (mins < 60 * 24) return `synced ${Math.round(mins / 60)} h ago`;
  return `synced ${new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

type SyncState = "queued" | "syncing" | "done" | "failed";

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
  is_private?: boolean;
  account_type?: AccountType;
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

export function AdminArtistsTable({
  rows,
  tiktokWaitlistCount = 0,
}: {
  rows: AdminArtistDirectoryRow[];
  tiktokWaitlistCount?: number;
}) {
  const [localRows, setLocalRows] = useState<AdminArtistDirectoryRow[]>(() => rows);
  const [q, setQ] = useState("");
  const [auditBusy, setAuditBusy] = useState<string | null>(null);
  const [cronBusy, setCronBusy] = useState<string | null>(null);
  const [planBusy, setPlanBusy] = useState<string | null>(null);
  const [managedBusy, setManagedBusy] = useState<string | null>(null);
  const [planOverrideBusy, setPlanOverrideBusy] = useState<string | null>(null);
  const [privateBusy, setPrivateBusy] = useState<string | null>(null);
  const [accountTypeBusy, setAccountTypeBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [controlsError, setControlsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [syncState, setSyncState] = useState<Record<string, { state: SyncState; note?: string }>>({});
  const [syncing, setSyncing] = useState(false);
  const [openPanel, setOpenPanel] = useState<{ id: string; kind: "setup" | "more" } | null>(null);
  const [statusFilter, setStatusFilter] = useState<ArtistStatus | "all">("all");
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
    const byStatus = statusFilter === "all" ? localRows : localRows.filter((r) => statusOf(r) === statusFilter);
    if (!needle) return byStatus;
    return byStatus.filter((r) => {
      const hay = [
        r.artist_name,
        r.owner_email,
        r.genre,
        r.instagram_handle,
        r.plan,
        r.plan_override ?? "",
        r.is_managed ? "managed" : "self-serve",
        r.cron_active ? "active" : "inactive",
        r.is_private ? "private" : "public",
        r.account_type,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [q, localRows, statusFilter]);

  const statusCounts = useMemo(() => {
    const c: Partial<Record<ArtistStatus, number>> = {};
    for (const r of localRows) c[statusOf(r)] = (c[statusOf(r)] ?? 0) + 1;
    return c;
  }, [localRows]);

  function toggleSelected(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /** Syncs posts then sorts concepts, one account at a time (each can take a while). */
  async function syncAccounts(ids: string[]) {
    if (ids.length === 0 || syncing) return;
    setSyncing(true);
    setSyncState((s) => ({ ...s, ...Object.fromEntries(ids.map((id) => [id, { state: "queued" as SyncState }])) }));
    for (const id of ids) {
      setSyncState((s) => ({ ...s, [id]: { state: "syncing" } }));
      try {
        const res = await fetch("/api/admin/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ artist_id: id }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          sync?: { synced?: number; errors?: string[] };
          themes?: { seeded?: number; postsTagged?: number; error?: string };
        };
        if (!res.ok || json.ok === false) {
          setSyncState((s) => ({
            ...s,
            [id]: { state: "failed", note: json.error ?? json.sync?.errors?.[0] ?? `HTTP ${res.status}` },
          }));
        } else {
          const parts = [
            typeof json.sync?.synced === "number" ? `${json.sync.synced} posts` : null,
            json.themes?.seeded ? `${json.themes.seeded} concepts` : null,
            json.themes?.postsTagged ? `${json.themes.postsTagged} sorted` : null,
            json.themes?.error ? `concepts failed: ${json.themes.error}` : null,
          ].filter(Boolean);
          setSyncState((s) => ({ ...s, [id]: { state: json.themes?.error ? "failed" : "done", note: parts.join(" · ") } }));
        }
      } catch (e) {
        setSyncState((s) => ({ ...s, [id]: { state: "failed", note: e instanceof Error ? e.message : String(e) } }));
      }
    }
    setSyncing(false);
    setSelected(new Set());
  }

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

  async function handleTogglePrivate(artistId: string, nextPrivate: boolean) {
    setControlsError(null);
    setPrivateBusy(artistId);
    const res = await patchArtist(artistId, { is_private: nextPrivate });
    setPrivateBusy(null);
    if (res.error) {
      setControlsError(res.error);
      return;
    }
    setLocalRows((prev) =>
      prev.map((row) =>
        row.id === artistId ? { ...row, is_private: nextPrivate } : row
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

  async function handleToggleAccountType(
    artistId: string,
    nextType: AccountType
  ) {
    setControlsError(null);
    setAccountTypeBusy(artistId);
    const res = await patchArtist(artistId, { account_type: nextType });
    setAccountTypeBusy(null);
    if (res.error) {
      setControlsError(res.error);
      return;
    }
    setLocalRows((prev) =>
      prev.map((row) =>
        row.id === artistId ? { ...row, account_type: nextType } : row
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

  const select = "min-h-9 rounded-lg border border-card-border bg-card px-2 text-sm";
  const toggle = (on: boolean) =>
    `min-h-9 rounded-full px-3 text-sm font-semibold ${on ? "bg-ink text-ink-foreground" : "border border-card-border text-foreground"}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
          {(["all", "needs_instagram", "not_set_up", "ready", "live", "watching"] as const).map((f) => {
            const n = f === "all" ? localRows.length : statusCounts[f] ?? 0;
            if (f !== "all" && n === 0) return null;
            return (
              <button key={f} type="button" aria-pressed={statusFilter === f} onClick={() => setStatusFilter(f)} className={toggle(statusFilter === f)}>
                {f === "all" ? "All" : STATUS_LABEL[f]} {n}
              </button>
            );
          })}
        </div>
        <label htmlFor="admin-search" className="sr-only">
          Search
        </label>
        <input
          id="admin-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, handle…"
          className="ml-auto min-h-9 w-full rounded-lg border border-card-border bg-card px-3 text-sm outline-none placeholder:text-muted focus:border-brand sm:w-64"
        />
      </div>

      {selected.size > 0 || syncing ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-card-border bg-card px-4 py-2 text-sm">
          <span className="text-muted">{selected.size} selected</span>
          <button
            type="button"
            disabled={syncing || selected.size === 0}
            onClick={() => void syncAccounts([...selected])}
            className="min-h-9 rounded-lg bg-ink px-3 font-semibold text-ink-foreground disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync selected"}
          </button>
          {!syncing ? (
            <button type="button" onClick={() => setSelected(new Set())} className="font-semibold text-muted hover:text-foreground">
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      {auditError || controlsError ? (
        <p className="text-sm font-semibold text-red-800" role="alert">
          {auditError ?? controlsError}
        </p>
      ) : null}

      <ul className="divide-y divide-card-border rounded-2xl border border-card-border bg-card">
        {filtered.map((r) => {
          const st = statusOf(r);
          const sync = syncState[r.id];
          const panel = openPanel?.id === r.id ? openPanel.kind : null;
          return (
            <li key={r.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <input
                  type="checkbox"
                  aria-label={`Select ${r.artist_name}`}
                  checked={selected.has(r.id)}
                  disabled={!r.instagram_connected}
                  onChange={(e) => toggleSelected(r.id, e.target.checked)}
                  className="h-4 w-4"
                />
                <div className="min-w-0 flex-[1_1_220px]">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{r.artist_name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[st]}`}>{STATUS_LABEL[st]}</span>
                    {savedHint === r.id ? <span className="text-xs font-semibold text-brand">Saved</span> : null}
                  </p>
                  <p className="truncate text-sm text-muted">
                    {ACCOUNT_TYPE_LABEL[r.account_type]}
                    {r.instagram_handle ? ` · @${r.instagram_handle}` : ""}
                    {r.instagram_connected ? ` · ${r.post_count} posts, ${synced(r.last_synced)}` : ""}
                    {st === "live" && r.weekly_target ? ` · ${r.posted_this_week} of ${r.weekly_target} this week` : ""}
                  </p>
                  {sync ? (
                    <p className={`text-xs ${sync.state === "failed" ? "font-semibold text-red-800" : "text-muted"}`}>
                      {sync.state === "queued" ? "Waiting…" : sync.state === "syncing" ? "Syncing…" : sync.note ?? (sync.state === "done" ? "Synced" : "Failed")}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    aria-expanded={panel === "setup"}
                    onClick={() => setOpenPanel(panel === "setup" ? null : { id: r.id, kind: "setup" })}
                    className={
                      st === "live" || st === "watching"
                        ? "min-h-9 rounded-lg border border-card-border px-3 text-sm font-semibold text-foreground hover:bg-background"
                        : "min-h-9 rounded-lg bg-ink px-3 text-sm font-semibold text-ink-foreground"
                    }
                  >
                    {st === "live" || st === "watching" ? "Setup" : st === "ready" ? "Review & publish" : "Set up"}
                  </button>
                  <form action={adminSwitchArtist}>
                    <input type="hidden" name="artistId" value={r.id} />
                    <button type="submit" className="min-h-9 px-2 text-sm font-semibold text-foreground hover:underline">
                      Open
                    </button>
                  </form>
                  <button
                    type="button"
                    aria-expanded={panel === "more"}
                    onClick={() => setOpenPanel(panel === "more" ? null : { id: r.id, kind: "more" })}
                    className="min-h-9 px-2 text-sm font-semibold text-muted hover:text-foreground"
                  >
                    More
                  </button>
                </div>
              </div>

              {panel === "setup" ? (
                <div className="mt-3">
                  <SetupPanel
                    artistId={r.id}
                    onTypeChange={(t) =>
                      setLocalRows((prev) => prev.map((row) => (row.id === r.id ? { ...row, account_type: t } : row)))
                    }
                  />
                </div>
              ) : null}

              {panel === "more" ? (
                <div className="mt-3 flex flex-col gap-3 rounded-xl bg-background p-4 text-sm">
                  <p className="text-muted">
                    Owner {r.owner_email}
                    {r.genre ? ` · ${r.genre}` : ""} · added {formatCreated(r.created_at)}
                    {r.last_plan_at ? ` · last plan ${formatCreated(r.last_plan_at)}` : ""}
                  </p>
                  <div className="flex flex-wrap items-end gap-4">
                    <label className="flex flex-col gap-1 font-semibold text-foreground">
                      Plan
                      <select
                        value={r.plan}
                        disabled={planBusy === r.id}
                        onChange={(e) => void handlePlanChange(r.id, e.target.value)}
                        className={select}
                      >
                        {PLAN_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 font-semibold text-foreground">
                      Plan override
                      <select
                        value={r.plan_override ?? ""}
                        disabled={planOverrideBusy === r.id}
                        onChange={(e) => void handlePlanOverrideChange(r.id, e.target.value)}
                        className={select}
                      >
                        {PLAN_OVERRIDE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 font-semibold text-foreground">
                      Account type
                      <select
                        value={r.account_type}
                        disabled={accountTypeBusy === r.id}
                        onChange={(e) => void handleToggleAccountType(r.id, e.target.value as AccountType)}
                        className={select}
                      >
                        {ACCOUNT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {ACCOUNT_TYPE_LABEL[t]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={managedBusy === r.id}
                      aria-pressed={r.is_managed}
                      onClick={() => void handleToggleManaged(r.id, !r.is_managed)}
                      className={toggle(r.is_managed)}
                    >
                      Managed
                    </button>
                    <button
                      type="button"
                      disabled={privateBusy === r.id}
                      aria-pressed={r.is_private}
                      onClick={() => void handleTogglePrivate(r.id, !r.is_private)}
                      className={toggle(r.is_private)}
                    >
                      Private
                    </button>
                    <button
                      type="button"
                      disabled={cronBusy === r.id}
                      aria-pressed={r.cron_active}
                      onClick={() => void handleToggleCron(r.id, !r.cron_active)}
                      className={toggle(r.cron_active)}
                    >
                      Legacy crons (old plans, nudges)
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={auditBusy === r.id}
                      onClick={() => void handleRunAudit(r.id)}
                      className="min-h-9 rounded-lg border border-card-border px-3 font-semibold text-foreground hover:bg-card disabled:opacity-50"
                    >
                      {auditBusy === r.id ? "Running…" : "Run audit"}
                    </button>
                    <button
                      type="button"
                      disabled={!r.instagram_connected || syncing}
                      onClick={() => void syncAccounts([r.id])}
                      className="min-h-9 rounded-lg border border-card-border px-3 font-semibold text-foreground hover:bg-card disabled:opacity-50"
                    >
                      Sync now
                    </button>
                    <span className="ml-auto">
                      {confirming === r.id ? (
                        <span className="flex items-center gap-2">
                          <span className="font-semibold text-red-800">Delete {r.artist_name}?</span>
                          <button
                            type="button"
                            disabled={deleting === r.id}
                            onClick={() => void handleDelete(r.id)}
                            className="min-h-9 rounded-lg bg-red-800 px-3 font-semibold text-white disabled:opacity-50"
                          >
                            {deleting === r.id ? "Deleting…" : "Yes, delete"}
                          </button>
                          <button type="button" onClick={() => setConfirming(null)} className="min-h-9 px-2 font-semibold text-muted">
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setConfirming(r.id)} className="min-h-9 px-2 font-semibold text-muted hover:text-red-800">
                          Delete
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
        {filtered.length === 0 ? <li className="px-4 py-6 text-sm text-muted">No accounts match.</li> : null}
      </ul>
      {tiktokWaitlistCount > 0 ? (
        <p className="text-xs text-muted">
          {tiktokWaitlistCount} on the TikTok waitlist.
        </p>
      ) : null}
    </div>
  );
}
