import type { Metadata } from "next";
import Link from "next/link";
import { CookieSettingsLink } from "@/components/consent-banner";
import { RequestAccessForm } from "./request-access-form";

const SITE_URL = "https://tempo.roadie.media";
const YEAR = new Date().getFullYear();
const TITLE = "Tempo: couch to 5K for socials";
const DESCRIPTION =
  "Tempo helps music artists post more without the dread: a few ideas each week built from your own posts, a target that starts where you are, and how each post did against your own usual. Closed beta from November.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: SITE_URL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: SITE_URL, type: "website", siteName: "Tempo" },
};

const STEPS = [
  {
    title: "Start where you are",
    body: "Tell us how posting feels and how often you post now. If that's rarely, your first week's target might be one post. That's a good week.",
  },
  {
    title: "Ideas from your own posts",
    body: "Each week you get a focus and three ideas, each with a couple of quick ways to do it. Pin one for later, post it, or tell us it's not for you and why.",
  },
  {
    title: "Build the habit",
    body: "Hit your target and it nudges up by one. Have a quiet week and it eases off. After each post you'll see how it did against your own usual.",
  },
];

const PROMISES = [
  "Compared with your own posts, never with other artists",
  "Never posts, likes or comments for you",
  "Your data is never sold or used for ads",
];

export default function HoldingPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-8 w-auto" />
          <span className="text-lg font-black uppercase tracking-tight text-foreground">Tempo</span>
        </Link>
        <Link href="/login" className="text-sm font-semibold text-muted-strong hover:text-foreground">
          Log in
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6">
        <section className="grid gap-10 pb-16 pt-8 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">For music artists · Closed beta</p>
            <h1 className="mt-4 text-5xl font-black uppercase leading-[0.95] tracking-tight text-foreground sm:text-6xl">
              Couch to 5K
              <br />
              for socials
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-strong">
              Tempo helps you post more, without the dread. A few ideas each week built from your own
              posts, a target that starts where you are, and a quiet note on how each post did.
            </p>
            <ul className="mt-8 space-y-3">
              {PROMISES.map((p) => (
                <li key={p} className="flex items-start gap-3 text-sm text-muted-strong">
                  <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-black text-brand-foreground">
                    ✓
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <div id="request-access" className="rounded-xl border border-card-border bg-card p-6 sm:p-8">
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Request access</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-strong">
              We&rsquo;re letting artists in a few at a time from November. It&rsquo;s free while
              it&rsquo;s in beta. You&rsquo;ll need an Instagram professional (creator or business) account.
            </p>
            <div className="mt-6">
              <RequestAccessForm />
            </div>
          </div>
        </section>

        <section className="border-t border-card-border py-16">
          <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-muted">How it works</h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-card-border bg-card p-6">
                <p className="text-sm font-black text-brand">{i + 1}</p>
                <h3 className="mt-2 text-lg font-black leading-snug text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-strong">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-card-border py-16">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-black uppercase tracking-tight text-foreground">Why &ldquo;couch to 5K&rdquo;?</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-strong">
              Most artists don&rsquo;t need a content calendar with five posts a week. They need to post
              a bit more often than they do now, about things their audience already responds to, without
              it taking over their week. Tempo starts small and builds up gently, the way a running plan
              does. It&rsquo;s made in Bristol by Roadie Media, who work with independent artists every day.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-card-border">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {YEAR} Roadie Media Ltd · Company no. 14753427</p>
          <nav className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/data-deletion" className="hover:text-foreground">Delete your data</Link>
            <CookieSettingsLink className="hover:text-foreground" />
            <a href="mailto:hello@roadie.media" className="hover:text-foreground">hello@roadie.media</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
