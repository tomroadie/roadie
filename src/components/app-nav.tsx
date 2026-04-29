"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/events", label: "Your dates" },
  { href: "/settings", label: "Settings" },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      className="mb-10 flex flex-wrap gap-x-6 gap-y-2 border-b border-zinc-200 pb-4 dark:border-zinc-800"
      aria-label="Main"
    >
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
  );
}
