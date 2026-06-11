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

function IconTikTok(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={props.className}
      fill="none"
    >
      <path
        d="M9 18V6l11-3v3L9 9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17" cy="9" r="3" stroke="currentColor" strokeWidth="1.6" />
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
  { label: "FAQ", href: "#faq" },
] as const;

const TICKER_ITEMS = [
  "Free Instagram audit",
  "◆",
  "Weekly content plan",
  "◆",
  "Shaped by your real data",
  "◆",
  "Built for music artists",
] as const;

const FAQ_ITEMS = [
  {
    question: "What is Tempo?",
    answer:
      "Tempo is a content planning tool built specifically for music artists, managers, and labels. It analyses your Instagram presence, learns your voice and style, and delivers five specific post ideas every week — shaped by your sound, your upcoming shows, and what's actually working for your audience.",
  },
  {
    question: "How does the free Instagram audit work?",
    answer:
      "When you sign up, Tempo analyses your last 10 Instagram posts — looking at engagement rates, content patterns, what resonates with your audience, and where the gaps are. You get a full breakdown within 3–5 minutes. No card required.",
  },
  {
    question: "How is Tempo different from ChatGPT or other AI tools?",
    answer:
      "Generic content tools aren't built for music. Unlike general AI tools, Tempo combines music industry expertise with your real Instagram data — so every idea feels made for you, not generated for anyone. Your plans also get smarter over time as Tempo learns what performs for your specific audience.",
  },
  {
    question: "How does the weekly plan work?",
    answer:
      "Every Friday you receive a short check-in email asking what's coming up — shows, releases, anything on your mind. Every Monday your content plan arrives with five specific post ideas, shaped by your check-in response and what performed best last week.",
  },
  {
    question: "Can I use Tempo for multiple artists?",
    answer:
      "Yes. Pro plans support up to 3 artist profiles and Label plans support up to 10. Each artist gets their own audit, their own voice profile, and their own weekly plan.",
  },
  {
    question: "What Instagram data does Tempo use?",
    answer:
      "Tempo analyses your public Instagram posts via your handle — no login required for the free audit. For live performance stats and week-on-week tracking, you can optionally connect your Instagram Business account via the Pro plan.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "Yes — all paid plans include a 14-day free trial. Your free Instagram audit is always free with no card required.",
  },
  {
    question: "What happens if I cancel?",
    answer:
      "You can cancel anytime. Your data stays in your account and you keep access until the end of your billing period.",
  },
] as const;

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="mx-auto mt-12 max-w-3xl space-y-3">
      {FAQ_ITEMS.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div
            key={item.question}
            className="overflow-hidden rounded-xl border border-card-border bg-card"
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
              aria-expanded={isOpen}
              onClick={() => setOpenIndex(isOpen ? null : index)}
            >
              <h3 className="text-base font-black uppercase tracking-tight text-white">
                {item.question}
              </h3>
              <span
                className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-white/10 text-lg leading-none text-white/70 transition-transform duration-300"
                style={{ transform: isOpen ? "rotate(45deg)" : undefined }}
                aria-hidden="true"
              >
                +
              </span>
            </button>
            <div
              className="grid transition-[grid-template-rows] duration-300 ease-in-out"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <p className="border-t border-card-border px-6 pb-5 pt-4 text-sm leading-7 text-gray-400">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LandingPage() {
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
            aria-label="Tempo home"
          >
            <img
              src="/logo.png"
              alt="Tempo"
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
            <Link
              href="/login?mode=signup"
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
                  <Link
                    href="/login?mode=signup"
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
                Weekly content planning for music artists
              </p>

              <h1 className="text-balance text-6xl font-black uppercase tracking-tight text-white md:text-8xl">
                Your weekly content plan.
                <br />
                Built for your music.
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-pretty text-xl leading-8 text-gray-400">
                Tempo analyses your Instagram, learns your voice, and delivers 5
                specific post ideas every week — shaped by your sound, your shows,
                and what&apos;s actually working for you.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/login?mode=signup"
                  onClick={onLeadCtaClick}
                  className="inline-flex h-12 items-center justify-center rounded-xl border px-6 text-base font-semibold shadow-sm transition-colors hover:bg-white/5"
                  style={{
                    borderColor: "rgba(0,255,135,0.55)",
                    color: BRAND_GREEN,
                    backgroundColor: "rgba(10,10,15,0.60)",
                  }}
                >
                  Get your free Instagram audit →
                </Link>
                <a
                  href="#how-it-works"
                  className="group inline-flex h-12 items-center justify-center rounded-xl border px-6 text-base font-semibold text-white transition-colors hover:bg-white/5"
                  style={{ borderColor: "rgba(255,255,255,0.16)" }}
                >
                  See how it works ↓
                </a>
              </div>

              <p className="mt-4 text-center text-xs text-white/55">
                Free audit · No card required · 14-day trial to unlock your plan
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
              {[0, 1].map((half) => (
                <div
                  key={half}
                  className="flex w-1/2 items-center gap-10"
                  aria-hidden={half === 1}
                >
                  <span className="inline-flex items-center gap-4 uppercase">
                    {TICKER_ITEMS.map((item, idx) => (
                      <span
                        key={`${half}-${idx}`}
                        className={item === "◆" ? "text-gray-500" : undefined}
                      >
                        {item}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
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
                  Generic tools don&apos;t understand music
                </h3>
                <p className="mt-2 text-sm leading-7 text-gray-400">
                  Tools built for coffee shops and fitness brands give you advice
                  that sounds right but misses what actually grows a fanbase.
                  Tempo is built on how artists actually grow.
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
                  Your data should be working for you
                </h3>
                <p className="mt-2 text-sm leading-7 text-gray-400">
                  Your Instagram posts, upcoming shows, release dates — all of
                  it should be shaping what you post next. With Tempo, it does.
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
                How Tempo works
              </h2>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[
                {
                  n: "01",
                  title: "Get your free Instagram audit",
                  body: "Enter your Instagram handle and we'll analyse your last 10 posts — engagement patterns, content style, what's working and what's not. Takes 3 minutes. No card required.",
                  icon: <IconWaveform className="h-5 w-5" />,
                },
                {
                  n: "02",
                  title: "Your first plan arrives instantly",
                  body: "Five post ideas shaped by your audit data, your genre, and your voice. Hooks, captions, format, and timing. Ready to post.",
                  icon: <IconSparkles className="h-5 w-5" />,
                },
                {
                  n: "03",
                  title: "Every week, your plan gets smarter",
                  body: "On Friday we ask what's coming up — shows, releases, anything on your mind. Monday morning your new plan arrives, informed by your check-in and what performed last week.",
                  icon: <IconCalendar className="h-5 w-5" />,
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
                  <h3 className="mt-5 text-base font-black uppercase tracking-tight text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-gray-400">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>

            <div className="mx-auto mt-20 max-w-3xl text-center">
              <h3 className="text-balance text-3xl font-black uppercase tracking-tight text-white md:text-4xl">
                What your weekly plan looks like
              </h3>
              <p className="mt-3 text-sm font-medium text-gray-400">
                Real ideas. Real hooks. Ready to post.
              </p>
            </div>

            <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
              <article className="relative overflow-hidden rounded-xl border border-card-border bg-card p-6 transition-all duration-150 border-l-fuchsia-500 border-l-4">
                <span className="inline-flex h-6 max-w-full items-center rounded-full bg-brand px-2.5 text-[11px] font-black uppercase tracking-wide text-brand-foreground ring-1 ring-inset ring-brand/30">
                  Reel
                </span>
                <h3 className="mt-4 text-xl font-bold leading-snug text-white">
                  The song that almost didn&apos;t make the album
                </h3>
                <p className="mt-3 text-sm leading-7 text-muted-strong">
                  Wrote this one three times. The first two versions were safer.
                  This one scared me a little — which is usually the sign. Out
                  Friday.
                </p>
                <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-widest text-brand">
                      Why
                    </dt>
                    <dd className="mt-1 text-muted">
                      Personal creative process posts outperform
                      announcement-only content. The vulnerability is the hook
                      — it earns the listen before you ask for it.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-widest text-brand">
                      Timing
                    </dt>
                    <dd className="mt-1 text-muted">
                      Wednesday 7–9pm — mid-week engagement peak, gives the
                      algorithm time to push before Friday release.
                    </dd>
                  </div>
                </dl>
              </article>

              <article className="relative overflow-hidden rounded-xl border border-card-border bg-card p-6 transition-all duration-150 border-l-sky-400 border-l-4">
                <span className="inline-flex h-6 max-w-full items-center rounded-full bg-brand px-2.5 text-[11px] font-black uppercase tracking-wide text-brand-foreground ring-1 ring-inset ring-brand/30">
                  Carousel
                </span>
                <h3 className="mt-4 text-xl font-bold leading-snug text-white">
                  What writing on the road actually looks like
                </h3>
                <p className="mt-3 text-sm leading-7 text-muted-strong">
                  Voice memos at 6am. Lyrics on receipts. Half-finished ideas in
                  the notes app. Here&apos;s what the album actually sounded like
                  before it sounded like anything.
                </p>
                <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-widest text-brand">
                      Why
                    </dt>
                    <dd className="mt-1 text-muted">
                      Behind-the-scenes process content earns saves and shares —
                      fans feel like insiders before the release drops.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-widest text-brand">
                      Timing
                    </dt>
                    <dd className="mt-1 text-muted">
                      Sunday noon — highest carousel save rate of the week.
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
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {[
                {
                  title: "Real Instagram data",
                  body: "Your actual posts, analysed. Engagement rates, content patterns, best posting times — all feeding into your weekly plan.",
                  icon: <IconWaveform className="h-5 w-5" />,
                },
                {
                  title: "Event-driven ideas",
                  body: "Add your shows and releases and every plan idea connects back to what's actually happening in your world.",
                  icon: <IconCalendar className="h-5 w-5" />,
                },
                {
                  title: "Music industry expertise",
                  body: "Not generic marketing advice. Built on how independent artists actually grow their audience and convert listeners to fans.",
                  icon: <IconSparkles className="h-5 w-5" />,
                },
                {
                  title: "Gets smarter every week",
                  body: "As Tempo learns what content resonates with your audience, your plans get more targeted. The longer you use it, the better it gets.",
                  icon: <IconChart className="h-5 w-5" />,
                },
                {
                  title: "TikTok (coming soon)",
                  body: "Native TikTok content plans, built for how each platform actually works.",
                  icon: <IconTikTok className="h-5 w-5" />,
                  comingSoon: true,
                },
              ].map((f) => {
                const card = (
                  <div
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
                    <p className="mt-2 text-sm leading-7 text-gray-400">{f.body}</p>
                  </div>
                );

                if ("comingSoon" in f && f.comingSoon) {
                  return (
                    <div key={f.title} className="relative opacity-75">
                      <span className="absolute top-0 right-0 z-10 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-400">
                        Coming soon
                      </span>
                      {card}
                    </div>
                  );
                }

                return <div key={f.title}>{card}</div>;
              })}
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
                Start with a free Instagram audit. Upgrade when you&apos;re ready
                to unlock your weekly content plan.
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
                  description:
                    "For independent artists who want to show up consistently every week.",
                  features: [
                    "Free Instagram audit",
                    "Weekly content plan (every Monday)",
                    "Plan shaped by your weekly check-in",
                    "14-day free trial",
                    "1 artist profile",
                  ],
                },
                {
                  name: "Pro",
                  price: "£59",
                  note: "/mo",
                  highlight: true,
                  badge: "Most popular",
                  description:
                    "For artists serious about growth. Live data, performance tracking, and room to scale.",
                  features: [
                    "Everything in Starter",
                    "Live Instagram performance stats",
                    "Week-on-week engagement tracking",
                    "2 content reviews per month",
                    "Up to 3 artist profiles",
                  ],
                },
                {
                  name: "Label",
                  price: "£149",
                  note: "/mo",
                  highlight: false,
                  badge: null,
                  description:
                    "For managers and labels who want expert-reviewed content plans across a roster.",
                  features: [
                    "Everything in Pro",
                    "Expert-reviewed content plans",
                    "Monthly strategy call",
                    "8 content reviews per month",
                    "Up to 10 artist profiles",
                    "Priority support",
                  ],
                },
              ].map((plan) => (
                <div
                  key={plan.name}
                  className={classNames(
                    "relative rounded-2xl border p-8",
                    plan.highlight ? "border-transparent ring-1 ring-inset" : ""
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
                        {plan.description}
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
                    href="/login?mode=signup"
                    onClick={onLeadCtaClick}
                    className={classNames(
                      "mt-8 inline-flex h-11 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold transition-colors",
                      "border hover:bg-white/5"
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
                    Get your free audit →
                  </Link>
                  <p className="mt-2 text-center text-xs text-gray-500">
                    14-day free trial · Cancel anytime
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-10 text-center text-sm text-gray-400">
              All plans start with a free Instagram audit and a 14-day trial.
              Cancel anytime — your data is always yours.
            </p>
          </div>
        </section>

        <section
          id="for-labels"
          className="py-24 md:py-32"
          aria-labelledby="for-labels-heading"
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
                <h2
                  id="for-labels-heading"
                  className="mt-4 text-balance text-4xl font-black uppercase tracking-tight text-white md:text-5xl"
                >
                  Keep your roster consistent — without losing
                  <br />
                  the plot.
                </h2>
                <p className="mt-5 text-lg leading-8 text-gray-400">
                  Tempo manages the full weekly content cycle for every artist
                  on your roster. Each artist gets a plan shaped by their own
                  data and voice. You get expert-reviewed content before anything
                  goes live.
                </p>
                <p className="mt-4 text-sm leading-7 text-gray-400">
                  Friday: artists receive their weekly check-in
                  <br />
                  Monday: content plans are ready for your review
                  <br />
                  You approve, refine, and deliver — or it goes straight to the
                  artist.
                </p>
                <ul className="mt-6 space-y-2 text-sm text-white/80">
                  {[
                    "One dashboard for your full roster",
                    "Each artist's plan shaped by their own data",
                    "Expert-reviewed before delivery",
                    "Scales from 2 to 10 artists",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
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
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login?mode=signup"
                  onClick={onLeadCtaClick}
                  className="mt-8 inline-flex h-11 items-center justify-center rounded-xl border px-5 text-sm font-semibold shadow-sm transition-colors hover:bg-white/5"
                  style={{
                    borderColor: "rgba(0,255,135,0.55)",
                    color: BRAND_GREEN,
                    backgroundColor: "rgba(10,10,15,0.60)",
                  }}
                >
                  Get started with Label →
                </Link>
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
          id="faq"
          className="py-24 md:py-32"
          aria-labelledby="faq-heading"
          style={{ backgroundColor: BRAND_DARK }}
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h2
                id="faq-heading"
                className="text-balance text-4xl font-black uppercase tracking-tight text-white md:text-5xl"
              >
                Frequently asked questions
              </h2>
            </div>
            <FaqAccordion />
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
                Join artists using Tempo to show up consistently, grow their
                audience, and spend less time stressing about content.
              </p>
              <div className="mt-10 flex flex-col items-center gap-2">
                <Link
                  href="/login?mode=signup"
                  onClick={onLeadCtaClick}
                  className="inline-flex h-12 items-center justify-center rounded-xl border px-7 text-base font-semibold shadow-sm transition-colors hover:bg-white/5"
                  style={{
                    borderColor: "rgba(0,255,135,0.55)",
                    color: BRAND_GREEN,
                    backgroundColor: "rgba(10,10,15,0.60)",
                  }}
                >
                  Get your free audit →
                </Link>
                <span className="text-xs text-white/55">
                  Free audit · No card required · 14-day trial to unlock your plan
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
            <img src="/logo.png" alt="Tempo" style={{ height: 24, width: "auto" }} />
            <div className="text-sm text-white/60">Tempo © 2026</div>
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
            <a
              className="transition-colors hover:text-white"
              href="mailto:hello@roadie.media"
            >
              Contact
            </a>
          </div>

          <div className="flex items-center justify-center gap-3 sm:justify-end">
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center text-sm font-semibold text-white/70 transition-colors hover:text-white sm:px-2"
            >
              Sign in
            </Link>
            <Link
              href="/login?mode=signup"
              onClick={onLeadCtaClick}
              className="inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-semibold shadow-sm transition-colors hover:bg-white/5"
              style={{
                borderColor: "rgba(0,255,135,0.55)",
                color: BRAND_GREEN,
                backgroundColor: "rgba(10,10,15,0.60)",
              }}
            >
              Get started
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
