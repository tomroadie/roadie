"use client";

import { useEffect, useMemo, useState } from "react";
import {
  adminRunAuditForArtist,
  adminSwitchArtist,
  adminToggleManaged,
} from "./actions";

export type AdminArtistDirectoryRow = {
  id: string;
  created_at: string;
  owner_user_id: string;
  owner_email: string;
  artist_name: string;
  genre: string;
  instagram_handle: string;
  plan: string;
  is_managed: boolean;
};

function formatCreated(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function AdminArtistsTable({ rows }: { rows: AdminArtistDirectoryRow[] }) {
  const [localRows, setLocalRows] = useState<AdminArtistDirectoryRow[]>(() => rows);
  const [q, setQ] = useState("");
  const [auditBusy, setAuditBusy] = useState<string | null>(null);
  const [managedBusy, setManagedBusy] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [managedError, setManagedError] = useState<string | null>(null);

  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

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
        r.is_managed ? "managed" : "",
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
      return;
    }
  }

  async function handleToggleManaged(artistId: string, nextManaged: boolean) {
    setManagedError(null);
    setManagedBusy(artistId);
    const res = await adminToggleManaged(artistId, nextManaged);
    setManagedBusy(null);
    if (res.error) {
      setManagedError(res.error);
      return;
    }
    setLocalRows((prev) =>
      prev.map((row) =>
        row.id === artistId ? { ...row, is_managed: nextManaged } : row
      )
    );
  }

  return (
    <div className="mt-10 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
            All artists
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

      {managedError ? (
        <p className="text-sm text-red-400" role="alert">
          {managedError}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-card-border bg-card shadow-sm">
        <table className="min-w-full divide-y divide-[#1a1a1a] text-left text-sm">
          <thead>
            <tr className="text-xs font-bold uppercase tracking-widest text-muted">
              <th className="whitespace-nowrap px-4 py-3">Artist</th>
              <th className="whitespace-nowrap px-4 py-3">Owner email</th>
              <th className="whitespace-nowrap px-4 py-3">Genre</th>
              <th className="whitespace-nowrap px-4 py-3">Instagram</th>
              <th className="whitespace-nowrap px-4 py-3">Plan</th>
              <th className="whitespace-nowrap px-4 py-3">Managed</th>
              <th className="whitespace-nowrap px-4 py-3">Created</th>
              <th className="whitespace-nowrap px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1a1a]">
            {filtered.map((r) => (
              <tr key={r.id} className="text-foreground">
                <td className="px-4 py-3 font-semibold">
                  {r.artist_name.trim() || "—"}
                </td>
                <td className="max-w-[14rem] truncate px-4 py-3 text-muted-strong">
                  {r.owner_email}
                </td>
                <td className="px-4 py-3 text-muted-strong">{r.genre || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-strong">
                  {r.instagram_handle ? `@${r.instagram_handle.replace(/^@/, "")}` : "—"}
                </td>
                <td className="px-4 py-3 uppercase text-muted-strong">{r.plan}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={r.is_managed}
                    aria-label={`${r.is_managed ? "Disable" : "Enable"} managed for ${r.artist_name.trim() || "artist"}`}
                    disabled={managedBusy === r.id}
                    onClick={() => void handleToggleManaged(r.id, !r.is_managed)}
                    className={[
                      "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-60",
                      r.is_managed ? "bg-brand" : "bg-zinc-700",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                        r.is_managed ? "translate-x-6" : "translate-x-1",
                      ].join(" ")}
                    />
                  </button>
                  {managedBusy === r.id ? (
                    <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-muted">
                      Saving…
                    </span>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-strong">
                  {formatCreated(r.created_at)}
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
