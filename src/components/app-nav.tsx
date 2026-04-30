"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

export type AppNavArtist = {
  id: string;
  label: string;
};

function buildLinks(canViewInsights: boolean) {
  return [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/events", label: "Your dates" },
    ...(canViewInsights ? [{ href: "/insights", label: "Insights" }] : []),
    { href: "/settings", label: "Settings" },
  ] as const;
}

type AppNavProps = {
  artists: AppNavArtist[];
  activeArtistId: string | null;
  canViewInsights: boolean;
};

export function AppNav({ artists, activeArtistId, canViewInsights }: AppNavProps) {
  const pathname = usePathname();
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const links = useMemo(() => buildLinks(canViewInsights), [canViewInsights]);

  const selectValue = activeArtistId ?? "";

  const artistOptions = useMemo(() => artists, [artists]);

  async function handleArtistChange(nextId: string) {
    setSwitchError(null);
    if (!nextId || nextId === activeArtistId) return;
    setSwitching(true);
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
        setSwitching(false);
        return;
      }
      try {
        localStorage.setItem("active_artist_id", nextId);
      } catch {
        /* ignore */
      }
      window.location.href = "/dashboard";
    } catch {
      setSwitchError("Network error.");
      setSwitching(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 mb-10 border-b border-zinc-200 bg-white/90 pb-4 pt-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/dashboard"
            className="text-lg font-extrabold tracking-tight text-[#7C3AED]"
          >
            Roadie
          </Link>

          <nav
            className="hidden items-center gap-2 overflow-x-auto whitespace-nowrap pr-1 sm:flex"
            aria-label="Main"
          >
            {links.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative shrink-0 px-1.5 py-1 text-sm font-medium transition-colors ${
                    active
                      ? "text-foreground"
                      : "text-slate-500 hover:text-foreground dark:text-slate-400"
                  }`}
                >
                  {label}
                  {active ? (
                    <span className="absolute inset-x-1.5 bottom-0 h-0.5 rounded-full bg-[#7C3AED]" />
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {artistOptions.length > 1 ? (
            <div className="flex items-center gap-3">
              <div className="relative">
                <select
                  id="artist-switcher"
                  value={selectValue}
                  disabled={switching}
                  onChange={(e) => void handleArtistChange(e.target.value)}
                  className="max-w-xs appearance-none rounded-full border border-zinc-200 bg-zinc-50 py-2 pl-4 pr-10 text-sm font-medium text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)] outline-none ring-offset-background transition-colors focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900/30 dark:focus:border-[#7C3AED] dark:focus:ring-[#7C3AED]/20"
                >
                  {artistOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              {switching ? (
                <span className="text-xs text-slate-500">Updating…</span>
              ) : null}
            </div>
          ) : null}

          {switchError ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {switchError}
            </p>
          ) : null}
        </div>
      </div>

      <nav className="mt-4 flex flex-wrap gap-x-6 gap-y-2 sm:hidden" aria-label="Main">
        {links.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`relative px-1.5 py-1 text-sm font-medium transition-colors ${
                active
                  ? "text-foreground"
                  : "text-slate-500 hover:text-foreground dark:text-slate-400"
              }`}
            >
              {label}
              {active ? (
                <span className="absolute inset-x-1.5 bottom-0 h-0.5 rounded-full bg-[#7C3AED]" />
              ) : null}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
