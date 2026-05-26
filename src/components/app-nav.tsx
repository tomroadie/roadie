"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

export type AppNavArtist = {
  id: string;
  label: string;
};

function buildLinks(showAdminLink: boolean) {
  const base = [
    { href: "/home", label: "Home" },
    { href: "/settings", label: "Settings" },
  ] as const;
  if (!showAdminLink) return base;
  return [
    ...base,
    { href: "/prep", label: "Prep" } as const,
    { href: "/admin", label: "Admin" } as const,
  ];
}

type AppNavProps = {
  artists: AppNavArtist[];
  activeArtistId: string | null;
  showAdminLink?: boolean;
};

export function AppNav({
  artists,
  activeArtistId,
  showAdminLink = false,
}: AppNavProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const links = useMemo(() => buildLinks(showAdminLink), [showAdminLink]);

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
      window.location.href = "/home";
    } catch {
      setSwitchError("Network error.");
      setSwitching(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 mb-6 border-b border-[#1a1a1a] bg-background/90 pb-3 pt-3 backdrop-blur">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3 md:justify-start md:gap-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/home"
              className="inline-flex shrink-0 items-center"
              aria-label="Roadie"
              onClick={() => setMenuOpen(false)}
            >
              <img src="/logo.png" height={36} alt="Roadie" className="h-9 w-auto" />
            </Link>

            <nav
              className="hidden items-center gap-2 overflow-x-auto whitespace-nowrap pr-1 md:flex"
              aria-label="Main"
            >
              {links.map(({ href, label }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`relative shrink-0 px-1.5 py-1 text-sm font-semibold transition-colors ${
                      active ? "text-brand" : "text-foreground hover:text-brand"
                    }`}
                  >
                    {label}
                    {active ? (
                      <span className="absolute inset-x-1.5 bottom-0 h-0.5 rounded-full bg-brand" />
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </div>

          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-card-border bg-card text-lg leading-none text-foreground shadow-sm transition-colors hover:border-brand md:hidden"
            aria-expanded={menuOpen}
            aria-controls="app-nav-mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            ☰
          </button>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
          {artistOptions.length > 1 ? (
            <div className="flex items-center gap-3">
              <div className="relative">
                <select
                  id="artist-switcher"
                  value={selectValue}
                  disabled={switching}
                  onChange={(e) => void handleArtistChange(e.target.value)}
                  className="max-w-xs appearance-none rounded-full border border-card-border bg-card py-2 pl-4 pr-10 text-sm font-semibold text-foreground shadow-sm outline-none ring-offset-background transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
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
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              {switching ? (
                <span className="text-xs text-muted">Updating…</span>
              ) : null}
            </div>
          ) : null}

          {switchError ? (
            <p className="text-sm text-red-400" role="alert">
              {switchError}
            </p>
          ) : null}
        </div>
      </div>

      {menuOpen ? (
        <nav
          id="app-nav-mobile-menu"
          className="mt-3 flex flex-col gap-0.5 rounded-lg border border-card-border bg-card p-2 shadow-lg md:hidden"
          aria-label="Main"
        >
          {links.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-md px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active ? "bg-brand/10 text-brand" : "text-foreground hover:bg-card-border/40"
                }`}
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </header>
  );
}
