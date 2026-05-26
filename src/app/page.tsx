"use client";

import Link from "next/link";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { MetaPixelScript } from "@/components/meta-pixel-script";
import { trackMeta } from "@/lib/meta-pixel";

const BRAND_GREEN = "#00FF87";
const BRAND_DARK = "#0A0A0F";
const BRAND_DARK_SOFT = "#111111";
const CARD_BG = "#1A1A1A";
const CARD_BORDER = "#333333";

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

const TICKER_ITEMS = [
  "Weekly content plan",
  "Music industry expertise",
  "AI assisted",
  "Built for artists",
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

  function onLeadCtaClick() {
    trackMeta("Lead");
  }

  return (
    <div
      className="min-h-screen font-sans text-white"
      style={{ backgroundColor: BRAND_DARK }}
    >
      <MetaPixelScript />
      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }
        @keyframes roadie-ticker {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>

      <header
        className="fixed inset-x-0 top-0 z-50 border-b backdrop-blur supports-[backdrop-filter]:bg-white/5"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          backgroundColor: "rgba(10,10,15,0.72)",
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-black tracking-tight"
            aria-label="Roadie home"
          >
            <img
              src="/logo.png"
              alt="Roadie"
              className="h-12 w-auto object-contain"
            />
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-white/80 md:flex">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-md px-1 py-1 transition-colors hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white/80 transition-colors hover:bg-white/5 hover:text-white"
            >
              Sign in
            </Link>
            <div className="flex flex-col items-end gap-0.5">
              <Link
                href="/dashboard"
                onClick={onLeadCtaClick}
                className="inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-semibold shadow-sm transition-colors hover:bg-white/5"
                style={{
                  borderColor: "rgba(0,255,135,0.55)",
                  color: BRAND_GREEN,
                  backgroundColor: "rgba(10,10,15,0.60)",
                }}
              >
                Get started free
              </Link>
              <span className="text-[10px] font-medium text-white/45">
                14-day free trial · No card required
              </span>
            </div>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/90 transition-colors hover:bg-white/5 md:hidden"
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
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <div
              className="relative z-50 border-t"
              style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: BRAND_DARK }}
            >
              <div className="mx-auto max-w-6xl px-6 py-4">
                <div className="flex flex-col gap-2">
                  {navItems.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className="rounded-lg px-3 py-2 text-sm font-semibold text-white/85 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex h-10 items-center justify-center rounded-lg border text-sm font-semibold text-white/85 transition-colors hover:bg-white/5"
                    style={{ borderColor: "rgba(255,255,255,0.12)" }}
                  >
                    Sign in
                  </Link>
                  <div className="flex flex-col gap-1">
                  <Link
                    href="/dashboard"
                    onClick={() => {
                      onLeadCtaClick();
                      setMobileOpen(false);
                    }}
                    className="inline-flex h-10 items-center justify-center rounded-lg border text-sm font-semibold shadow-sm transition-colors hover:bg-white/5"
                    style={{
                      borderColor: "rgba(0,255,135,0.55)",
                      color: BRAND_GREEN,
                      backgroundColor: "rgba(10,10,15,0.60)",
                    }}
                  >
                    Get started free
                  </Link>
                    <span className="text-center text-[10px] font-medium text-white/45">
                      14-day free trial · No card required
                    </span>
                  </div>
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
            <div className="absolute inset-0 opacity-[0.18] [background:radial-gradient(70%_50%_at_50%_0%,rgba(0,255,135,0.45)_0%,rgba(10,10,15,0)_65%)]" />
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

              <h1 className="text-balance text-6xl font-black uppercase tracking-tight text-white md:text-8xl">
                Your weekly content plan. Built for your music.
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-pretty text-xl leading-8 text-gray-400">
                Roadie combines AI speed with music industry expertise and your
                real data — so every idea feels made for you, not generated for
                anyone.
              </p>

              <p className="mx-auto mt-5 max-w-2xl text-pretty text-sm leading-7 text-gray-500">
                Connect your sound, upcoming dates, and Instagram profile → get 5
                specific post ideas every week with hooks, captions, and timing.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/dashboard"
                  onClick={onLeadCtaClick}
                  className="inline-flex h-12 items-center justify-center rounded-xl border px-6 text-base font-semibold shadow-sm transition-colors hover:bg-white/5"
                  style={{
                    borderColor: "rgba(0,255,135,0.55)",
                    color: BRAND_GREEN,
                    backgroundColor: "rgba(10,10,15,0.60)",
                  }}
                >
                  Get your first plan free
                </Link>
                <a
                  href="#how-it-works"
                  className="group inline-flex h-12 items-center justify-center rounded-xl border px-6 text-base font-semibold text-white transition-colors hover:bg-white/5"
                  style={{ borderColor: "rgba(255,255,255,0.16)" }}
                >
                  See how it works
                  <IconArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
              </div>

              <p className="mt-4 text-center text-xs text-white/55">
                14-day free trial · No card required
              </p>

              <p className="mt-8 text-sm text-white/60">
                Join artists using Roadie to show up consistently and grow their
                audience.
              </p>
            </div>
          </div>

          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
            style={{
              background:
                "linear-gradient(to bottom, rgba(10,10,15,0), rgba(17,17,17,1))",
            }}
          />
        </section>

        <section
          aria-label="Ticker"
          className="overflow-hidden border-y py-3"
          style={{
            backgroundColor: "#1a1a1a",
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          <div className="relative">
            <div
              className="flex w-[200%] items-center gap-10 whitespace-nowrap text-xs font-medium tracking-[0.18em] text-white/85"
              style={{
                animation: "roadie-ticker 30s linear infinite",
              }}
            >
              <div className="flex w-1/2 items-center gap-10">
                <span className="inline-flex items-center gap-4 uppercase">
                  {TICKER_ITEMS.map((item, idx) => (
                    <span key={item} className="inline-flex items-center gap-4">
                      <span>{item}</span>
                      {idx === TICKER_ITEMS.length - 1 ? null : (
                        <span className="text-gray-500">◆</span>
                      )}
                    </span>
                  ))}
                </span>
              </div>
              <div className="flex w-1/2 items-center gap-10" aria-hidden="true">
                <span className="inline-flex items-center gap-4 uppercase">
                  {TICKER_ITEMS.map((item, idx) => (
                    <span key={item} className="inline-flex items-center gap-4">
                      <span>{item}</span>
                      {idx === TICKER_ITEMS.length - 1 ? null : (
                        <span className="text-gray-500">◆</span>
                      )}
                    </span>
                  ))}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section id="problem" className="py-24 md:py-32" style={{ backgroundColor: BRAND_DARK_SOFT }}>
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <p
                className="text-xs font-bold tracking-[0.22em]"
                style={{ color: BRAND_GREEN }}
              >
                THE PROBLEM
              </p>
              <h2 className="mt-4 text-balance text-4xl font-black uppercase tracking-tight text-white md:text-5xl">
                Content shouldn&apos;t feel like a second job.
              </h2>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              <div
                className="rounded-2xl border p-7 transition-colors hover:bg-white/[0.03]"
                style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
              >
                <div
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border"
                  style={{
                    borderColor: "rgba(0,255,135,0.28)",
                    backgroundColor: "rgba(0,255,135,0.06)",
                    color: BRAND_GREEN,
                  }}
                >
                  <IconSparkles className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-black uppercase tracking-tight text-white">
                  Blank screen syndrome
                </h3>
                <p className="mt-2 text-sm leading-7 text-gray-400">
                  You know you should be posting. But staring at a blank screen
                  beats another generic idea that doesn&apos;t feel like you.
                </p>
              </div>

              <div
                className="rounded-2xl border p-7 transition-colors hover:bg-white/[0.03]"
                style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
              >
                <div
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border"
                  style={{
                    borderColor: "rgba(0,255,135,0.28)",
                    backgroundColor: "rgba(0,255,135,0.06)",
                    color: BRAND_GREEN,
                  }}
                >
                  <IconTarget className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-black uppercase tracking-tight text-white">
                  Generic AI doesn&apos;t get music
                </h3>
                <p className="mt-2 text-sm leading-7 text-gray-400">
                  Tools built for coffee shops and fitness brands give you advice
                  that sounds right but misses what actually grows a fanbase.
                </p>
              </div>

              <div
                className="rounded-2xl border p-7 transition-colors hover:bg-white/[0.03]"
                style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
              >
                <div
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border"
                  style={{
                    borderColor: "rgba(0,255,135,0.28)",
                    backgroundColor: "rgba(0,255,135,0.06)",
                    color: BRAND_GREEN,
                  }}
                >
                  <IconCalendar className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-black uppercase tracking-tight text-white">
                  Your data sits unused
                </h3>
                <p className="mt-2 text-sm leading-7 text-gray-400">
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
          style={{ backgroundColor: BRAND_DARK }}
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <p
                className="text-xs font-bold tracking-[0.22em]"
                style={{ color: BRAND_GREEN }}
              >
                HOW IT WORKS
              </p>
              <h2 className="mt-4 text-balance text-4xl font-black uppercase tracking-tight text-white md:text-5xl">
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
                  className="rounded-2xl border p-7 transition-colors hover:bg-white/[0.03]"
                  style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border"
                        style={{
                          borderColor: "rgba(0,255,135,0.28)",
                          backgroundColor: "rgba(0,255,135,0.06)",
                          color: BRAND_GREEN,
                        }}
                      >
                        {step.icon}
                      </div>
                      <div className="text-sm font-black uppercase tracking-tight text-white">
                        {step.n}
                      </div>
                    </div>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                  <p className="mt-5 text-base font-black uppercase tracking-tight text-white">
                    {step.title}{" "}
                    <span className="font-semibold normal-case text-gray-400">
                      {step.body}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          className="py-24 md:py-32"
          style={{ backgroundColor: BRAND_DARK }}
          aria-labelledby="weekly-plan-preview-heading"
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h2
                id="weekly-plan-preview-heading"
                className="text-balance text-4xl font-black uppercase tracking-tight text-white md:text-5xl uppercase"
              >
                What your weekly plan looks like
              </h2>
              <p className="mt-3 text-sm font-medium text-gray-400">
                Real ideas. Real hooks. Ready to post.
              </p>
            </div>

            <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
              <article
                className="relative overflow-hidden rounded-xl border border-card-border bg-card p-6 transition-all duration-150 border-l-fuchsia-500 border-l-4"
              >
                <span className="inline-flex h-6 max-w-full items-center rounded-full bg-brand px-2.5 text-[11px] font-black uppercase tracking-wide text-brand-foreground ring-1 ring-inset ring-brand/30">
                  Reel
                </span>
                <h3 className="mt-4 text-xl font-bold leading-snug text-white">
                  POV: The mix is finally done and it&apos;s 2am — here&apos;s the
                  hook that stops the scroll.
                </h3>
                <p className="mt-3 text-sm leading-7 text-muted-strong">
                  12 seconds: room tone → first chorus hit → text overlay with the
                  release date. Tag your producer in the comments — builds trust and
                  signals momentum without begging for streams.
                </p>
                <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-widest text-brand">
                      Why
                    </dt>
                    <dd className="mt-1 text-muted">
                      Bridges studio authenticity with a clear ask (save / pre-save)
                      while the algorithm favours native audio + fast retention.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-widest text-brand">
                      Timing
                    </dt>
                    <dd className="mt-1 text-muted">
                      Tuesday 7–9pm local — peak engagement after work, ahead of
                      mid-week noise.
                    </dd>
                  </div>
                </dl>
              </article>

              <article
                className="relative overflow-hidden rounded-xl border border-card-border bg-card p-6 transition-all duration-150 border-l-sky-400 border-l-4"
              >
                <span className="inline-flex h-6 max-w-full items-center rounded-full bg-brand px-2.5 text-[11px] font-black uppercase tracking-wide text-brand-foreground ring-1 ring-inset ring-brand/30">
                  Carousel
                </span>
                <h3 className="mt-4 text-xl font-bold leading-snug text-white">
                  5 things nobody tells you about dropping your first EP
                </h3>
                <p className="mt-3 text-sm leading-7 text-muted-strong">
                  Slide 1: bold title. Slides 2–4: myth vs reality (short bullets).
                  Slide 5: CTA to pre-save + tour dates. Keep captions tight — let
                  the carousel carry the story.
                </p>
                <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-widest text-brand">
                      Why
                    </dt>
                    <dd className="mt-1 text-muted">
                      Educational carousels earn saves and shares; fans learn your
                      POV before you pitch the release.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-widest text-brand">
                      Timing
                    </dt>
                    <dd className="mt-1 text-muted">
                      Thursday lunchtime — strong browse traffic; pair with a Story
                      sticker pointing to slide 1.
                    </dd>
                  </div>
                </dl>
              </article>
            </div>
          </div>
        </section>

        <section
          id="features"
          className="py-24 md:py-32"
          style={{ backgroundColor: BRAND_DARK_SOFT }}
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-balance text-4xl font-black uppercase tracking-tight text-white md:text-5xl">
                Everything shaped by your world
              </h2>
              <p className="mt-5 text-lg leading-8 text-gray-400">
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
                  className="group rounded-2xl border p-8 transition-colors hover:bg-white/[0.03]"
                  style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
                >
                  <div
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors"
                    style={{
                      borderColor: "rgba(0,255,135,0.28)",
                      backgroundColor: "rgba(0,255,135,0.06)",
                      color: BRAND_GREEN,
                    }}
                  >
                    {f.icon}
                  </div>
                  <h3 className="mt-5 text-lg font-black uppercase tracking-tight text-white">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-gray-400">
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
          style={{ backgroundColor: BRAND_DARK }}
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-balance text-4xl font-black uppercase tracking-tight text-white md:text-5xl">
                Simple pricing. No surprises.
              </h2>
              <p className="mt-5 text-lg leading-8 text-gray-400">
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
                    "Weekly plan (unlimited)",
                    "AI assistant",
                    "Events calendar",
                    "Instagram audit",
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
                    "Weekly plan (unlimited)",
                    "AI assistant",
                    "Events calendar",
                    "Instagram audit + insights",
                    "Audit refresh (monthly)",
                    "Up to 3 artists",
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
                    "Up to 10 artists",
                    "Weekly audit refresh",
                    "Priority support",
                    "Team roster management",
                  ],
                },
              ].map((plan) => (
                <div
                  key={plan.name}
                  className={classNames(
                    "relative rounded-2xl border p-8",
                    plan.highlight
                      ? "border-transparent ring-1 ring-inset"
                      : ""
                  )}
                  style={
                    plan.highlight
                      ? ({
                          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
                          ["--tw-ring-color" as never]:
                            "rgba(0,255,135,0.40)",
                          backgroundColor: CARD_BG,
                          borderColor: CARD_BORDER,
                        } as CSSProperties)
                      : ({
                          backgroundColor: CARD_BG,
                          borderColor: CARD_BORDER,
                        } as CSSProperties)
                  }
                >
                  {plan.badge ? (
                    <div className="absolute -top-3 left-6">
                      <span
                        className="inline-flex items-center rounded-full px-3 py-1 text-xs font-black uppercase tracking-tight shadow-sm"
                        style={{ backgroundColor: BRAND_GREEN, color: BRAND_DARK }}
                      >
                        {plan.badge}
                      </span>
                    </div>
                  ) : null}

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-tight text-white">
                        {plan.name}
                      </h3>
                      <p className="mt-1 text-sm text-gray-400">
                        For {plan.name === "Label" ? "teams" : "artists"} who
                        ship weekly.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex items-baseline gap-2">
                    <div className="text-4xl font-black uppercase tracking-tight text-white">
                      {plan.price}
                    </div>
                    <div className="text-sm font-semibold text-gray-400">
                      {plan.note}
                    </div>
                  </div>

                  <ul className="mt-6 space-y-3 text-sm text-white/80">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-3">
                        <span
                          className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full"
                          style={{
                            backgroundColor: "rgba(0,255,135,0.10)",
                            color: BRAND_GREEN,
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
                        ? "border hover:bg-white/5"
                        : "border hover:bg-white/5"
                    )}
                    style={
                      plan.highlight
                        ? {
                            borderColor: "rgba(0,255,135,0.55)",
                            color: BRAND_GREEN,
                            backgroundColor: "rgba(10,10,15,0.60)",
                          }
                        : {
                            borderColor: "rgba(255,255,255,0.12)",
                            color: "rgba(255,255,255,0.90)",
                            backgroundColor: "rgba(10,10,15,0.35)",
                          }
                    }
                  >
                    Get started
                  </Link>
                  <p className="mt-2 text-center text-xs text-gray-500">
                    14-day free trial · No card required
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-10 text-center text-sm text-gray-400">
              All plans include a 14-day free trial. No card required. Cancel
              anytime.
            </p>
          </div>
        </section>

        <section
          id="for-labels"
          className="py-24 md:py-32"
          aria-label="For labels"
          style={{ backgroundColor: BRAND_DARK_SOFT }}
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid items-center gap-10 md:grid-cols-2">
              <div>
                <p
                  className="text-xs font-bold tracking-[0.22em]"
                  style={{ color: BRAND_GREEN }}
                >
                  FOR LABELS
                </p>
                <h2 className="mt-4 text-balance text-4xl font-black uppercase tracking-tight text-white md:text-5xl">
                  Keep multiple artists consistent — without losing the plot.
                </h2>
                <p className="mt-5 text-lg leading-8 text-gray-400">
                  Roadie helps teams coordinate releases, campaigns, and weekly
                  content across a roster — with plans that stay grounded in each
                  artist’s voice.
                </p>
                <div className="mt-8 flex flex-wrap items-start gap-3">
                  <Link
                    href="/pricing"
                    className="inline-flex h-11 items-center justify-center rounded-xl border px-5 text-sm font-semibold text-white/90 transition-colors hover:bg-white/5"
                    style={{ borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(10,10,15,0.35)" }}
                  >
                    View label pricing
                  </Link>
                  <div className="flex flex-col gap-1">
                    <Link
                      href="/dashboard"
                      onClick={onLeadCtaClick}
                      className="inline-flex h-11 items-center justify-center rounded-xl border px-5 text-sm font-semibold shadow-sm transition-colors hover:bg-white/5"
                      style={{
                        borderColor: "rgba(0,255,135,0.55)",
                        color: BRAND_GREEN,
                        backgroundColor: "rgba(10,10,15,0.60)",
                      }}
                    >
                      Get started free
                    </Link>
                    <span className="text-[11px] text-gray-500">
                      14-day free trial · No card required
                    </span>
                  </div>
                </div>
              </div>

              <div
                className="rounded-2xl border p-8"
                style={{
                  backgroundColor: CARD_BG,
                  borderColor: CARD_BORDER,
                  boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-black uppercase tracking-tight text-white">
                    Weekly planning board
                  </div>
                  <div className="text-xs font-semibold text-gray-400">
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
                      className="rounded-xl border p-4 transition-colors hover:bg-white/[0.03]"
                      style={{ backgroundColor: "rgba(255,255,255,0.02)", borderColor: CARD_BORDER }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
                              style={{
                                backgroundColor: "rgba(0,255,135,0.12)",
                                color: BRAND_GREEN,
                              }}
                            >
                              {row.tag}
                            </span>
                          </div>
                          <div className="mt-2 text-sm font-semibold text-white">
                            {row.title}
                          </div>
                          <div className="mt-1 text-xs text-gray-400">
                            {row.meta}
                          </div>
                        </div>
                        <IconArrowRight className="mt-1 h-4 w-4 text-white/25" />
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
            <div className="absolute inset-0 opacity-[0.16] [background:radial-gradient(60%_50%_at_50%_0%,rgba(0,255,135,0.40)_0%,rgba(10,10,15,0)_70%)]" />
          </div>

          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-balance text-4xl font-black uppercase tracking-tight text-white md:text-5xl">
                Your next weekly plan is waiting.
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-8 text-gray-400">
                Join artists using Roadie to show up consistently, grow their
                audience, and spend less time stressing about content.
              </p>
              <div className="mt-10 flex flex-col items-center gap-2">
                <Link
                  href="/dashboard"
                  onClick={onLeadCtaClick}
                  className="inline-flex h-12 items-center justify-center rounded-xl border px-7 text-base font-semibold shadow-sm transition-colors hover:bg-white/5"
                  style={{
                    borderColor: "rgba(0,255,135,0.55)",
                    color: BRAND_GREEN,
                    backgroundColor: "rgba(10,10,15,0.60)",
                  }}
                >
                  Get started free
                </Link>
                <span className="text-xs text-white/55">
                  14-day free trial · No card required
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer
        className="border-t py-10"
        style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: BRAND_DARK }}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Roadie" style={{ height: 24, width: "auto" }} />
            <div className="text-sm text-white/60">Roadie © 2026</div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-semibold text-white/70">
            <Link className="transition-colors hover:text-white" href="/privacy">
              Privacy
            </Link>
            <span className="text-white/20">·</span>
            <Link className="transition-colors hover:text-white" href="/terms">
              Terms
            </Link>
            <span className="text-white/20">·</span>
            <Link className="transition-colors hover:text-white" href="/contact">
              Contact
            </Link>
          </div>

          <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start sm:justify-center">
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center text-sm font-semibold text-white/70 transition-colors hover:text-white sm:px-2"
            >
              Sign in
            </Link>
            <div className="flex flex-col items-center gap-0.5 sm:items-end">
              <Link
                href="/dashboard"
                className="inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-semibold shadow-sm transition-colors hover:bg-white/5"
                style={{
                  borderColor: "rgba(0,255,135,0.55)",
                  color: BRAND_GREEN,
                  backgroundColor: "rgba(10,10,15,0.60)",
                }}
              >
                Get started
              </Link>
              <span className="text-[10px] font-medium text-white/45">
                14-day free trial · No card required
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
