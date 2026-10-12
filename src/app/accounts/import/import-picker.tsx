"use client";

import { useState } from "react";
import Link from "next/link";

export type PickerAccount = {
  pageId: string;
  pageName: string;
  username: string | null;
  name: string | null;
  profilePictureUrl: string | null;
  followers: number | null;
  existing: { artistName: string; mine: boolean; viaFacebook: boolean } | null;
};

type Row = { selected: boolean; artistName: string; genre: string };
type Result = { page_id: string; status: "created" | "updated" | "skipped"; artist_id?: string; note?: string };

export function ImportPicker({ accounts, genres }: { accounts: PickerAccount[]; genres: readonly string[] }) {
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      accounts.map((a) => [a.pageId, { selected: false, artistName: a.name || a.username || a.pageName, genre: "" }])
    )
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [filter, setFilter] = useState("");

  const set = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  const chosen = accounts.filter((a) => rows[a.pageId]?.selected);
  const shown = accounts.filter((a) =>
    `${a.username ?? ""} ${a.name ?? ""} ${a.pageName}`.toLowerCase().includes(filter.trim().toLowerCase())
  );

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/accounts/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accounts: chosen.map((a) => ({
            page_id: a.pageId,
            artist_name: rows[a.pageId].artistName,
            genre: rows[a.pageId].genre,
          })),
        }),
      });
      const json = (await res.json()) as { results?: Result[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      setResults(Object.fromEntries((json.results ?? []).map((r) => [r.page_id, r])));
      setRows((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { ...v, selected: false }])));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {accounts.length > 8 ? (
        <label className="flex max-w-sm flex-col gap-1 text-sm font-semibold text-foreground">
          Find an account
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="min-h-11 rounded-lg border border-card-border bg-card px-3 font-normal"
          />
        </label>
      ) : null}

      <ul className="flex flex-col gap-2">
        {shown.map((a) => {
          const row = rows[a.pageId];
          const result = results[a.pageId];
          const blocked = a.existing !== null && !a.existing.mine;
          return (
            <li key={a.pageId} className="flex flex-wrap items-center gap-4 rounded-2xl border border-card-border bg-card p-4">
              <input
                type="checkbox"
                id={`pick-${a.pageId}`}
                checked={row.selected}
                disabled={blocked || busy}
                onChange={(e) => set(a.pageId, { selected: e.target.checked })}
                className="h-5 w-5 accent-[var(--brand)]"
              />
              {a.profilePictureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.profilePictureUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <span className="h-11 w-11 rounded-full bg-input" aria-hidden="true" />
              )}
              <label htmlFor={`pick-${a.pageId}`} className="flex min-w-0 flex-[1_1_200px] flex-col">
                <span className="font-semibold text-foreground">@{a.username ?? "unknown"}</span>
                <span className="text-sm text-muted">
                  {a.pageName}
                  {a.followers !== null ? ` · ${a.followers.toLocaleString("en-GB")} followers` : ""}
                </span>
              </label>

              {result ? (
                <span
                  className={`text-sm font-semibold ${result.status === "skipped" ? "text-quiet" : "text-brand"}`}
                >
                  {result.status === "created"
                    ? "Added, posts syncing"
                    : result.status === "updated"
                      ? "Reconnected"
                      : `Skipped: ${result.note ?? ""}`}
                </span>
              ) : a.existing ? (
                <span className="text-sm text-muted">
                  {a.existing.mine
                    ? `In Tempo as ${a.existing.artistName}${a.existing.viaFacebook ? "" : " (tick to switch to this connection)"}`
                    : "Connected by someone else"}
                </span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <label className="sr-only" htmlFor={`name-${a.pageId}`}>
                    Artist name
                  </label>
                  <input
                    id={`name-${a.pageId}`}
                    value={row.artistName}
                    onChange={(e) => set(a.pageId, { artistName: e.target.value })}
                    maxLength={80}
                    className="min-h-10 w-48 rounded-lg border border-card-border bg-background px-3 text-sm"
                  />
                  <label className="sr-only" htmlFor={`genre-${a.pageId}`}>
                    Genre
                  </label>
                  <select
                    id={`genre-${a.pageId}`}
                    value={row.genre}
                    onChange={(e) => set(a.pageId, { genre: e.target.value })}
                    className="min-h-10 rounded-lg border border-card-border bg-background px-2 text-sm"
                  >
                    <option value="">Genre (optional)</option>
                    {genres.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-2xl bg-ink p-4 text-ink-foreground">
        <span className="text-sm">
          {chosen.length === 0 ? "Tick the accounts to add" : `${chosen.length} selected`}
        </span>
        <button
          type="button"
          disabled={busy || chosen.length === 0}
          onClick={submit}
          className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-ink disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add to Tempo"}
        </button>
        {Object.keys(results).length > 0 ? (
          <Link href="/admin" className="text-sm font-semibold text-ink-foreground underline underline-offset-4">
            Go to admin
          </Link>
        ) : null}
        {error ? (
          <span role="alert" className="text-sm font-semibold text-accent">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
