"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

export type AppNavArtist = {
  id: string;
  label: string;
};

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/events", label: "Your dates" },
  { href: "/insights", label: "Insights" },
  { href: "/settings", label: "Settings" },
] as const;

type AppNavProps = {
  artists: AppNavArtist[];
  activeArtistId: string | null;
};

export function AppNav({ artists, activeArtistId }: AppNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [switchError, setSwitchError] = useState<string | null>(null);

  const selectValue = activeArtistId ?? "";

  const artistOptions = useMemo(() => artists, [artists]);

  async function handleArtistChange(nextId: string) {
    setSwitchError(null);
    if (!nextId || nextId === activeArtistId) return;
    try {
      const res = await fetch("/api/active-artist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ artistId: nextId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setSwitchError(data.error ?? "Could not switch artist.");
        return;
      }
      try {
        localStorage.setItem("active_artist_id", nextId);
      } catch {
        /* ignore */
      }
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setSwitchError("Network error.");
    }
  }

  return (
    <div className="mb-10 space-y-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
      {artistOptions.length > 1 ? (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          <label
            htmlFor="artist-switcher"
            className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
          >
            Artist
          </label>
          <select
            id="artist-switcher"
            value={selectValue}
            disabled={pending}
            onChange={(e) => void handleArtistChange(e.target.value)}
            className="max-w-xs rounded-lg border border-zinc-200 bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20 disabled:opacity-50 dark:border-zinc-800 dark:focus:border-zinc-600 dark:focus:ring-zinc-600/20"
          >
            {artistOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          {pending ? (
            <span className="text-xs text-zinc-500">Updating…</span>
          ) : null}
        </div>
      ) : null}
      {switchError ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {switchError}
        </p>
      ) : null}

      <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Main">
        {links.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`text-sm font-medium transition-colors ${
                active
                  ? "text-foreground"
                  : "text-zinc-500 hover:text-foreground dark:text-zinc-400"
              } ${active ? "underline underline-offset-4" : ""}`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
