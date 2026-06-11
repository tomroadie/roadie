"use client";

import { useEffect, useMemo, useState } from "react";
import { adminSwitchArtist } from "./actions";

export type AdminUserAccountArtist = {
  id: string;
  artist_name: string;
  instagram_handle: string;
  plan: string;
  is_managed: boolean;
  is_private: boolean;
  account_type: "artist" | "venue";
};

export type AdminUserAccountRow = {
  user_id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
  all_emails_paused: boolean;
  artists: AdminUserAccountArtist[];
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function UserAccountsTable({ rows }: { rows: AdminUserAccountRow[] }) {
  const [localRows, setLocalRows] = useState<AdminUserAccountRow[]>(() => rows);
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [emailsBusy, setEmailsBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return localRows;
    return localRows.filter((r) => {
      const hay = [
        r.email,
        r.is_admin ? "admin" : "",
        r.all_emails_paused ? "paused" : "",
        ...r.artists.flatMap((a) => [a.artist_name, a.instagram_handle, a.plan]),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [q, localRows]);

  async function handleToggleEmails(userId: string, nextPaused: boolean) {
    setError(null);
    setEmailsBusy(userId);
    try {
      const res = await fetch("/api/admin/update-user", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: userId, all_emails_paused: nextPaused }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: string;
      };
      if (!res.ok) {
        setError(
          data.details
            ? `${data.error ?? "Update failed"}: ${data.details}`
            : (data.error ?? `HTTP ${res.status}`)
        );
        return;
      }
      setLocalRows((prev) =>
        prev.map((row) =>
          row.user_id === userId
            ? { ...row, all_emails_paused: nextPaused }
            : row
        )
      );
    } catch {
      setError("Update failed");
    } finally {
      setEmailsBusy(null);
    }
  }

  async function handleDelete(userId: string) {
    setError(null);
    setDeleting(userId);
    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      if (res.ok) {
        setLocalRows((prev) => prev.filter((row) => row.user_id !== userId));
        setConfirming(null);
        setExpanded(null);
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Delete failed");
      }
    } catch {
      setError("Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="mt-10 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
            User accounts
          </h2>
          <p className="mt-1 text-sm text-muted">
            {localRows.length} account{localRows.length === 1 ? "" : "s"}. Click a
            row to see artists and account controls.
          </p>
        </div>
        <div className="w-full sm:max-w-xs">
          <label
            htmlFor="user-accounts-search"
            className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
          >
            Search
          </label>
          <input
            id="user-accounts-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Email, artist name, IG…"
            className="w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-card-border bg-card shadow-sm">
        <table className="min-w-full divide-y divide-[#1a1a1a] text-left text-sm">
          <thead>
            <tr className="text-xs font-bold uppercase tracking-widest text-muted">
              <th className="whitespace-nowrap px-4 py-3">Email</th>
              <th className="whitespace-nowrap px-4 py-3">Joined</th>
              <th className="whitespace-nowrap px-4 py-3">Last sign-in</th>
              <th className="whitespace-nowrap px-4 py-3">Artists</th>
              <th className="whitespace-nowrap px-4 py-3">Status</th>
              <th className="whitespace-nowrap px-4 py-3 text-right" aria-label="Expand" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1a1a]">
            {filtered.map((r) => {
              const isExpanded = expanded === r.user_id;
              return (
                <UserAccountRow
                  key={r.user_id}
                  row={r}
                  isExpanded={isExpanded}
                  onToggleExpanded={() =>
                    setExpanded(isExpanded ? null : r.user_id)
                  }
                  emailsBusy={emailsBusy === r.user_id}
                  onToggleEmails={(next) =>
                    void handleToggleEmails(r.user_id, next)
                  }
                  confirming={confirming === r.user_id}
                  onStartConfirm={() => setConfirming(r.user_id)}
                  onCancelConfirm={() => setConfirming(null)}
                  deleting={deleting === r.user_id}
                  onDelete={() => void handleDelete(r.user_id)}
                />
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">
            No matching accounts.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function UserAccountRow({
  row,
  isExpanded,
  onToggleExpanded,
  emailsBusy,
  onToggleEmails,
  confirming,
  onStartConfirm,
  onCancelConfirm,
  deleting,
  onDelete,
}: {
  row: AdminUserAccountRow;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  emailsBusy: boolean;
  onToggleEmails: (next: boolean) => void;
  confirming: boolean;
  onStartConfirm: () => void;
  onCancelConfirm: () => void;
  deleting: boolean;
  onDelete: () => void;
}) {
  const planSummary = Array.from(
    new Set(row.artists.map((a) => a.plan || "free"))
  ).join(", ");

  return (
    <>
      <tr
        className="cursor-pointer text-foreground transition-colors hover:bg-white/[0.02]"
        onClick={onToggleExpanded}
      >
        <td className="px-4 py-3 font-semibold">{row.email}</td>
        <td className="whitespace-nowrap px-4 py-3 text-muted-strong">
          {formatDate(row.created_at)}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-muted-strong">
          {formatDate(row.last_sign_in_at)}
        </td>
        <td className="whitespace-nowrap px-4 py-3">
          {row.artists.length}
          {planSummary ? (
            <span className="ml-2 text-xs uppercase text-muted">
              {planSummary}
            </span>
          ) : null}
        </td>
        <td className="px-4 py-3">
          <span className="inline-flex flex-wrap gap-1.5">
            {row.is_admin ? (
              <span className="rounded-full bg-brand/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
                Admin
              </span>
            ) : null}
            {row.all_emails_paused ? (
              <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400">
                Emails paused
              </span>
            ) : null}
            {!row.is_admin && !row.all_emails_paused ? (
              <span className="text-xs text-muted">—</span>
            ) : null}
          </span>
        </td>
        <td className="px-4 py-3 text-right text-xs text-muted">
          {isExpanded ? "▲" : "▼"}
        </td>
      </tr>
      {isExpanded ? (
        <tr className="bg-white/[0.015]">
          <td colSpan={6} className="px-4 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-widest text-brand">
                  Artists
                </p>
                {row.artists.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">
                    No artist profiles on this account.
                  </p>
                ) : (
                  <ul className="mt-2 divide-y divide-[#1a1a1a] rounded-lg border border-card-border">
                    {row.artists.map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-foreground">
                            {a.artist_name || "(unnamed)"}
                          </span>
                          <span className="ml-2 font-mono text-xs text-muted-strong">
                            {a.instagram_handle ? `@${a.instagram_handle}` : "—"}
                          </span>
                          <span className="ml-2 inline-flex flex-wrap gap-1.5 align-middle">
                            <span className="rounded-full bg-input px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                              {a.plan || "free"}
                            </span>
                            {a.account_type === "venue" ? (
                              <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-400">
                                Venue
                              </span>
                            ) : null}
                            {a.is_managed ? (
                              <span className="rounded-full bg-brand/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
                                Managed
                              </span>
                            ) : null}
                            {a.is_private ? (
                              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400">
                                Private
                              </span>
                            ) : null}
                          </span>
                        </div>
                        <form
                          action={adminSwitchArtist}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input type="hidden" name="artistId" value={a.id} />
                          <button
                            type="submit"
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-card-border bg-transparent px-3 text-xs font-bold uppercase tracking-wide text-foreground transition-colors hover:border-brand"
                          >
                            Switch to this artist
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div
                className="flex shrink-0 flex-col gap-2 lg:w-56"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-xs font-bold uppercase tracking-widest text-brand">
                  Account controls
                </p>
                <button
                  type="button"
                  disabled={emailsBusy}
                  onClick={() => onToggleEmails(!row.all_emails_paused)}
                  className={[
                    "inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-bold uppercase tracking-wide transition-colors disabled:opacity-60",
                    row.all_emails_paused
                      ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                      : "border border-card-border bg-transparent text-foreground hover:border-brand",
                  ].join(" ")}
                >
                  {emailsBusy
                    ? "Saving…"
                    : row.all_emails_paused
                      ? "Resume emails"
                      : "Pause all emails"}
                </button>
                {confirming ? (
                  <div className="flex flex-col gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                    <p className="text-xs font-semibold text-red-400">
                      Delete {row.email}?
                    </p>
                    <p className="text-xs text-muted">
                      Deletes their login, all {row.artists.length} artist
                      {row.artists.length === 1 ? "" : "s"}, and all related
                      data. This cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={onDelete}
                        disabled={deleting}
                        className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-black text-white hover:bg-red-600 disabled:opacity-50"
                      >
                        {deleting ? "Deleting…" : "Confirm"}
                      </button>
                      <button
                        type="button"
                        onClick={onCancelConfirm}
                        className="rounded-lg border border-card-border bg-input px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onStartConfirm}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 px-3 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/20"
                  >
                    Delete account
                  </button>
                )}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
