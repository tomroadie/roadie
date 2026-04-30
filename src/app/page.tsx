"use client";

import Link from "next/link";
import { type CSSProperties, useEffect, useMemo, useState } from "react";

const BRAND_PURPLE = "#7C3AED";
const BRAND_DARK = "#0A0A0F";

function IconSparkles(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={props.className}
      fill="none"
    >
      <path
        d="M12 2l1.2 4.2L17.4 8 13.2 9.2 12 13.4 10.8 9.2 6.6 8l4.2-1.8L12 2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M19 12l.8 2.8L22.6 16l-2.8.8L19 19.6l-.8-2.8L15.4 16l2.8-1.2L19 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M5 13l.8 2.8L8.6 17l-2.8.8L5 20.6l-.8-2.8L1.4 17l2.8-1.2L5 13Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTarget(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={props.className}>
      <path
        d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M12 18a6 6 0 1 0-6-6 6 6 0 0 0 6 6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M12 14a2 2 0 1 0-2-2 2 2 0 0 0 2 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconWaveform(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={props.className}>
      <path
        d="M4 13V11M7 16V8M10 19V5M14 18V6M17 15V9M20 13V11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCalendar(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={props.className}>
      <path
        d="M7 2v3M17 2v3M3.5 9h17"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6.5 5h11A3 3 0 0 1 20.5 8v11a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M7.5 12.5h3M7.5 16h3M13.5 12.5h3M13.5 16h3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconChart(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={props.className}>
      <path
        d="M4 19V5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M4 19h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M7.5 16v-5M12 16V8M16.5 16v-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconShield(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={props.className}>
      <path
        d="M12 2 20 6v6c0 5-3.2 8.8-8 10-4.8-1.2-8-5-8-10V6l8-4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9 12.2 11.2 14.4 15.6 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconArrowRight(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={props.className}
      fill="none"
    >
      <path
        d="M5 12h12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function classNames(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "For labels", href: "#for-labels" },
] as const;

export default function Home() {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const navItems = useMemo(() => NAV_LINKS, []);

  return (
    <div className="min-h-screen bg-white font-sans text-zinc-950">
      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }
      `}</style>

      <header className="fixed inset-x-0 top-0 z-50 border-b border-black/5 bg-white/75 backdrop-blur supports-[backdrop-filter]:bg-white/65">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-black tracking-tight"
            aria-label="Roadie home"
          >
            <span
              className="text-xl"
              style={{ color: BRAND_PURPLE, letterSpacing: "-0.02em" }}
            >
              Roadie
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-zinc-700 md:flex">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-md px-1 py-1 transition-colors hover:text-zinc-950"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-950/[0.04] hover:text-zinc-950"
            >
              Sign in
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:opacity-95"
              style={{ backgroundColor: BRAND_PURPLE }}
            >
              Get started free
            </Link>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-zinc-950/[0.04] md:hidden"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
              <path
                d="M4 7h16M4 12h16M4 17h16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {mobileOpen ? (
          <div className="md:hidden">
            <div
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <div className="relative z-50 border-t border-black/5 bg-white">
              <div className="mx-auto max-w-6xl px-6 py-4">
                <div className="flex flex-col gap-2">
                  {navItems.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-950/[0.04] hover:text-zinc-950"
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-black/10 bg-white text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-950/[0.04]"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex h-10 items-center justify-center rounded-lg text-sm font-semibold text-white shadow-sm transition-colors hover:opacity-95"
                    style={{ backgroundColor: BRAND_PURPLE }}
                  >
                    Get started free
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <main className="pt-16">
        <section
          className="relative overflow-hidden"
          style={{ backgroundColor: BRAND_DARK }}
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 opacity-[0.18] [background:radial-gradient(70%_50%_at_50%_0%,rgba(124,58,237,0.55)_0%,rgba(10,10,15,0)_65%)]" />
            <div className="absolute inset-0 opacity-[0.25] [background:radial-gradient(55%_55%_at_20%_40%,rgba(255,255,255,0.08)_0%,rgba(10,10,15,0)_70%)]" />
          </div>

          <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
            <div className="mx-auto max-w-3xl text-center">
              <p
                className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold tracking-wide"
                style={{
                  borderColor: "rgba(255,255,255,0.10)",
                  color: "rgba(255,255,255,0.78)",
                  backgroundColor: "rgba(255,255,255,0.03)",
                }}
              >
                <IconWaveform className="h-4 w-4" />
                AI content planning for music artists
              </p>

              <h1 className="text-balance text-5xl font-black tracking-tight text-white md:text-7xl">
                Your weekly content plan. Built for your music.
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-pretty text-xl leading-8 text-gray-400">
                Roadie combines AI speed with music industry expertise and your
                real data — so every idea feels made for you, not generated for
                anyone.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/dashboard"
                  className="inline-flex h-12 items-center justify-center rounded-xl px-6 text-base font-semibold text-white shadow-sm transition-colors hover:opacity-95"
                  style={{ backgroundColor: BRAND_PURPLE }}
                >
                  Get your first plan free
                </Link>
                <a
                  href="#how-it-works"
                  className="group inline-flex h-12 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 text-base font-semibold text-white transition-colors hover:bg-white/10"
                >
                  See how it works
                  <IconArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
              </div>

              <p className="mt-6 text-sm text-white/60">
                Trusted by independent artists, managers and labels
              </p>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-white" />
        </section>

        <section id="problem" className="bg-white py-24 md:py-32">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <p
                className="text-xs font-bold tracking-[0.22em]"
                style={{ color: BRAND_PURPLE }}
              >
                THE PROBLEM
              </p>
              <h2 className="mt-4 text-balance text-4xl font-black tracking-tight text-zinc-950 md:text-5xl">
                Content shouldn&apos;t feel like a second job.
              </h2>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-black/10 bg-white p-7 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
                <div
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border"
                  style={{
                    borderColor: "rgba(124,58,237,0.18)",
                    backgroundColor: "rgba(124,58,237,0.06)",
                    color: BRAND_PURPLE,
                  }}
                >
                  <IconSparkles className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-bold tracking-tight">
                  Blank screen syndrome
                </h3>
                <p className="mt-2 text-sm leading-7 text-zinc-600">
                  You know you should be posting. But staring at a blank screen
                  beats another generic idea that doesn&apos;t feel like you.
                </p>
              </div>

              <div className="rounded-2xl border border-black/10 bg-white p-7 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
                <div
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border"
                  style={{
                    borderColor: "rgba(124,58,237,0.18)",
                    backgroundColor: "rgba(124,58,237,0.06)",
                    color: BRAND_PURPLE,
                  }}
                >
                  <IconTarget className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-bold tracking-tight">
                  Generic AI doesn&apos;t get music
                </h3>
                <p className="mt-2 text-sm leading-7 text-zinc-600">
                  Tools built for coffee shops and fitness brands give you advice
                  that sounds right but misses what actually grows a fanbase.
                </p>
              </div>

              <div className="rounded-2xl border border-black/10 bg-white p-7 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
                <div
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border"
                  style={{
                    borderColor: "rgba(124,58,237,0.18)",
                    backgroundColor: "rgba(124,58,237,0.06)",
                    color: BRAND_PURPLE,
                  }}
                >
                  <IconCalendar className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-bold tracking-tight">
                  Your data sits unused
                </h3>
                <p className="mt-2 text-sm leading-7 text-zinc-600">
                  Your Instagram stats, upcoming shows, release dates — none of
                  it is shaping what you post. It should be.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="py-24 md:py-32"
          style={{ backgroundColor: "#F8F8F8" }}
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <p
                className="text-xs font-bold tracking-[0.22em]"
                style={{ color: BRAND_PURPLE }}
              >
                HOW IT WORKS
              </p>
              <h2 className="mt-4 text-balance text-4xl font-black tracking-tight text-zinc-950 md:text-5xl">
                Roadie thinks like a music marketing strategist. At AI speed.
              </h2>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[
                {
                  n: "01",
                  title: "Tell us about your sound.",
                  body: "Genre, influences, similar artists. 2 minutes.",
                  icon: <IconWaveform className="h-5 w-5" />,
                },
                {
                  n: "02",
                  title: "Add your dates.",
                  body: "Shows, releases, studio sessions. Your reality shapes your plan.",
                  icon: <IconCalendar className="h-5 w-5" />,
                },
                {
                  n: "03",
                  title: "Generate your plan.",
                  body: "Five specific ideas every week. Hooks, captions, format, timing. Done.",
                  icon: <IconSparkles className="h-5 w-5" />,
                },
              ].map((step) => (
                <div
                  key={step.n}
                  className="rounded-2xl border border-black/10 bg-white p-7 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border"
                        style={{
                          borderColor: "rgba(124,58,237,0.18)",
                          backgroundColor: "rgba(124,58,237,0.06)",
                          color: BRAND_PURPLE,
                        }}
                      >
                        {step.icon}
                      </div>
                      <div className="text-sm font-bold tracking-tight text-zinc-900">
                        {step.n}
                      </div>
                    </div>
                    <div className="h-px flex-1 bg-black/5" />
                  </div>
                  <p className="mt-5 text-base font-bold tracking-tight text-zinc-950">
                    {step.title}{" "}
                    <span className="font-semibold text-zinc-600">
                      {step.body}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="bg-white py-24 md:py-32">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-balance text-4xl font-black tracking-tight text-zinc-950 md:text-5xl">
                Everything shaped by your world
              </h2>
              <p className="mt-5 text-lg leading-8 text-zinc-600">
                Roadie is designed around the realities of building a fanbase —
                not generic brand marketing.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {[
                {
                  title: "Event-driven ideas",
                  body: "Your shows and releases shape every plan. No irrelevant content.",
                  icon: <IconCalendar className="h-5 w-5" />,
                },
                {
                  title: "Real Instagram data",
                  body: "Your actual posts, analysed. What’s working, what’s missing, what to fix.",
                  icon: <IconChart className="h-5 w-5" />,
                },
                {
                  title: "Music industry expertise",
                  body: "Not generic marketing. Built on how artists actually grow.",
                  icon: <IconWaveform className="h-5 w-5" />,
                },
                {
                  title: "Weekly, not whenever",
                  body: "A full plan every Monday. Show up consistently without the stress.",
                  icon: <IconShield className="h-5 w-5" />,
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="group rounded-2xl border border-black/10 bg-white p-8 transition-colors hover:bg-zinc-950/[0.02]"
                >
                  <div
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors"
                    style={{
                      borderColor: "rgba(124,58,237,0.18)",
                      backgroundColor: "rgba(124,58,237,0.06)",
                      color: BRAND_PURPLE,
                    }}
                  >
                    {f.icon}
                  </div>
                  <h3 className="mt-5 text-lg font-bold tracking-tight text-zinc-950">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-zinc-600">
                    {f.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="pricing"
          className="py-24 md:py-32"
          style={{ backgroundColor: "#F8F8F8" }}
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-balance text-4xl font-black tracking-tight text-zinc-950 md:text-5xl">
                Simple pricing. No surprises.
              </h2>
              <p className="mt-5 text-lg leading-8 text-zinc-600">
                Choose the plan that matches your output — upgrade anytime.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[
                {
                  name: "Starter",
                  price: "£29",
                  note: "/mo",
                  highlight: false,
                  badge: null,
                  features: [
                    "Weekly plan",
                    "AI assistant",
                    "Events calendar",
                    "1 artist",
                  ],
                },
                {
                  name: "Pro",
                  price: "£59",
                  note: "/mo",
                  highlight: true,
                  badge: "Most popular",
                  features: [
                    "Everything in Starter",
                    "Instagram insights",
                    "Live social data",
                    "3 artists",
                  ],
                },
                {
                  name: "Label",
                  price: "£149",
                  note: "/mo",
                  highlight: false,
                  badge: null,
                  features: [
                    "Everything in Pro",
                    "10 artists",
                    "Priority support",
                  ],
                },
              ].map((plan) => (
                <div
                  key={plan.name}
                  className={classNames(
                    "relative rounded-2xl border bg-white p-8 shadow-[0_1px_0_rgba(0,0,0,0.02)]",
                    plan.highlight
                      ? "border-transparent ring-1 ring-inset"
                      : "border-black/10"
                  )}
                  style={
                    plan.highlight
                      ? ({
                          boxShadow: "0 20px 60px rgba(0,0,0,0.10)",
                          ["--tw-ring-color" as never]:
                            "rgba(124,58,237,0.35)",
                        } as CSSProperties)
                      : undefined
                  }
                >
                  {plan.badge ? (
                    <div className="absolute -top-3 left-6">
                      <span
                        className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold text-white shadow-sm"
                        style={{ backgroundColor: BRAND_PURPLE }}
                      >
                        {plan.badge}
                      </span>
                    </div>
                  ) : null}

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-black tracking-tight text-zinc-950">
                        {plan.name}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-600">
                        For {plan.name === "Label" ? "teams" : "artists"} who
                        ship weekly.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex items-baseline gap-2">
                    <div className="text-4xl font-black tracking-tight text-zinc-950">
                      {plan.price}
                    </div>
                    <div className="text-sm font-semibold text-zinc-600">
                      {plan.note}
                    </div>
                  </div>

                  <ul className="mt-6 space-y-3 text-sm text-zinc-700">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-3">
                        <span
                          className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full"
                          style={{
                            backgroundColor: "rgba(124,58,237,0.10)",
                            color: BRAND_PURPLE,
                          }}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                          >
                            <path
                              d="M9 12.2 11.2 14.4 15.6 10"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/pricing"
                    className={classNames(
                      "mt-8 inline-flex h-11 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold transition-colors",
                      plan.highlight
                        ? "text-white hover:opacity-95"
                        : "border border-black/10 bg-white text-zinc-950 hover:bg-zinc-950/[0.04]"
                    )}
                    style={
                      plan.highlight ? { backgroundColor: BRAND_PURPLE } : undefined
                    }
                  >
                    Get started
                  </Link>
                </div>
              ))}
            </div>

            <p className="mt-10 text-center text-sm text-zinc-600">
              All plans include a 7-day free trial. Cancel anytime.
            </p>
          </div>
        </section>

        <section
          id="for-labels"
          className="bg-white py-24 md:py-32"
          aria-label="For labels"
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid items-center gap-10 md:grid-cols-2">
              <div>
                <p
                  className="text-xs font-bold tracking-[0.22em]"
                  style={{ color: BRAND_PURPLE }}
                >
                  FOR LABELS
                </p>
                <h2 className="mt-4 text-balance text-4xl font-black tracking-tight text-zinc-950 md:text-5xl">
                  Keep multiple artists consistent — without losing the plot.
                </h2>
                <p className="mt-5 text-lg leading-8 text-zinc-600">
                  Roadie helps teams coordinate releases, campaigns, and weekly
                  content across a roster — with plans that stay grounded in each
                  artist’s voice.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/pricing"
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-black/10 bg-white px-5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-950/[0.04]"
                  >
                    View label pricing
                  </Link>
                  <Link
                    href="/dashboard"
                    className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white transition-colors hover:opacity-95"
                    style={{ backgroundColor: BRAND_PURPLE }}
                  >
                    Get started free
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border border-black/10 bg-white p-8 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-zinc-950">
                    Weekly planning board
                  </div>
                  <div className="text-xs font-semibold text-zinc-500">
                    Monday
                  </div>
                </div>
                <div className="mt-6 space-y-4">
                  {[
                    {
                      tag: "Release week",
                      title: "Short-form teaser + hook",
                      meta: "Reels · 20s · Tue 6pm",
                    },
                    {
                      tag: "Show run",
                      title: "Backstage photo set + caption",
                      meta: "Carousel · Wed noon",
                    },
                    {
                      tag: "Community",
                      title: "Ask fans to pick the next cover",
                      meta: "Story · Thu 9pm",
                    },
                  ].map((row) => (
                    <div
                      key={row.title}
                      className="rounded-xl border border-black/10 bg-white p-4 transition-colors hover:bg-zinc-950/[0.02]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
                              style={{
                                backgroundColor: "rgba(124,58,237,0.10)",
                                color: BRAND_PURPLE,
                              }}
                            >
                              {row.tag}
                            </span>
                          </div>
                          <div className="mt-2 text-sm font-semibold text-zinc-950">
                            {row.title}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {row.meta}
                          </div>
                        </div>
                        <IconArrowRight className="mt-1 h-4 w-4 text-zinc-300" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="relative overflow-hidden py-24 md:py-32"
          style={{ backgroundColor: BRAND_DARK }}
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 opacity-[0.16] [background:radial-gradient(60%_50%_at_50%_0%,rgba(124,58,237,0.55)_0%,rgba(10,10,15,0)_70%)]" />
          </div>

          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-balance text-4xl font-black tracking-tight text-white md:text-5xl">
                Your next weekly plan is waiting.
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-8 text-gray-400">
                Join artists using Roadie to show up consistently, grow their
                audience, and spend less time stressing about content.
              </p>
              <div className="mt-10 flex justify-center">
                <Link
                  href="/dashboard"
                  className="inline-flex h-12 items-center justify-center rounded-xl px-7 text-base font-semibold text-white shadow-sm transition-colors hover:opacity-95"
                  style={{ backgroundColor: BRAND_PURPLE }}
                >
                  Get started free
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/5 bg-white py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-zinc-500">Roadie © 2026</div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-medium text-zinc-600">
            <Link className="transition-colors hover:text-zinc-950" href="/privacy">
              Privacy
            </Link>
            <span className="text-zinc-300">·</span>
            <Link className="transition-colors hover:text-zinc-950" href="/terms">
              Terms
            </Link>
            <span className="text-zinc-300">·</span>
            <Link className="transition-colors hover:text-zinc-950" href="/contact">
              Contact
            </Link>
          </div>

          <div className="flex items-center justify-center gap-4 text-sm font-semibold">
            <Link
              href="/login"
              className="text-zinc-600 transition-colors hover:text-zinc-950"
            >
              Sign in
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center justify-center rounded-lg px-4 text-white shadow-sm transition-colors hover:opacity-95"
              style={{ backgroundColor: BRAND_PURPLE }}
            >
              Get started
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
