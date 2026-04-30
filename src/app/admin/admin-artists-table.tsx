"use client";

import { useMemo, useState } from "react";
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
  const [q, setQ] = useState("");
  const [auditBusy, setAuditBusy] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      const hay = [
        r.artist_name,
        r.owner_email,
        r.genre,
        r.instagram_handle,
        r.plan,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [q, rows]);

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

  return (
    <div className="mt-10 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
            All artists
          </h2>
          <p className="mt-1 text-sm text-muted">
            {rows.length} artist{rows.length === 1 ? "" : "s"} in the directory.
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

      <div className="overflow-x-auto rounded-xl border border-card-border bg-card shadow-sm">
        <table className="min-w-full divide-y divide-[#1a1a1a] text-left text-sm">
          <thead>
            <tr className="text-xs font-bold uppercase tracking-widest text-muted">
              <th className="whitespace-nowrap px-4 py-3">Artist</th>
              <th className="whitespace-nowrap px-4 py-3">Owner email</th>
              <th className="whitespace-nowrap px-4 py-3">Genre</th>
              <th className="whitespace-nowrap px-4 py-3">Instagram</th>
              <th className="whitespace-nowrap px-4 py-3">Plan</th>
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
