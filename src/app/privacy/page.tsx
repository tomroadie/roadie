import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Tempo",
};

const h2Class =
  "mt-8 text-lg font-black uppercase tracking-tight text-foreground";
const pClass = "mt-3 text-sm leading-relaxed text-muted-strong";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-widest text-brand">
        Tempo
      </p>
      <h1 className="mt-3 text-4xl font-black uppercase tracking-tight text-foreground">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-muted">Last updated: May 2026</p>

      <section>
        <h2 className={h2Class}>Who we are</h2>
        <p className={pClass}>
          Tempo is a product of Roadie Media. We provide AI-powered content
          planning for music artists. Contact:{" "}
          <a
            href="mailto:hello@roadie.media"
            className="font-semibold text-foreground underline underline-offset-4 hover:text-brand hover:no-underline"
          >
            hello@roadie.media
          </a>
        </p>
      </section>

      <section>
        <h2 className={h2Class}>What data we collect</h2>
        <ul className={`${pClass} list-disc space-y-2 pl-5`}>
          <li>
            Account information: email address, artist name, genre, Instagram
            handle
          </li>
          <li>
            Instagram data: public post data analysed via Instagram&apos;s API
            and third-party tools
          </li>
          <li>
            Usage data: how you interact with the app, which features you use
          </li>
          <li>
            Payment data: handled entirely by Stripe — we never store card
            details
          </li>
        </ul>
      </section>

      <section>
        <h2 className={h2Class}>How we use your data</h2>
        <ul className={`${pClass} list-disc space-y-2 pl-5`}>
          <li>To generate your weekly content plan</li>
          <li>To analyse your Instagram presence</li>
          <li>
            To send you product emails (plan ready, check-in, account
            notifications)
          </li>
          <li>To improve the product over time</li>
        </ul>
      </section>

      <section>
        <h2 className={h2Class}>Data sharing</h2>
        <p className={pClass}>
          We do not sell your data. We share data with the following services to
          operate the product:
        </p>
        <ul className={`${pClass} list-disc space-y-2 pl-5`}>
          <li>Stripe (payments)</li>
          <li>Resend (email delivery)</li>
          <li>Supabase (database)</li>
          <li>Anthropic (AI plan generation)</li>
          <li>Apify (Instagram data collection)</li>
          <li>Vercel (hosting)</li>
          <li>Sentry (error monitoring)</li>
        </ul>
      </section>

      <section>
        <h2 className={h2Class}>Your rights (GDPR)</h2>
        <p className={pClass}>You have the right to:</p>
        <ul className={`${pClass} list-disc space-y-2 pl-5`}>
          <li>Access the data we hold about you</li>
          <li>Request deletion of your account and data</li>
          <li>
            Unsubscribe from marketing emails at any time via the link in any
            email
          </li>
          <li>Pause all emails via your account settings</li>
        </ul>
        <p className={pClass}>
          To exercise any of these rights, email{" "}
          <a
            href="mailto:hello@roadie.media"
            className="font-semibold text-foreground underline underline-offset-4 hover:text-brand hover:no-underline"
          >
            hello@roadie.media
          </a>
        </p>
      </section>

      <section>
        <h2 className={h2Class}>Data retention</h2>
        <p className={pClass}>
          We retain your data for as long as your account is active. When you
          delete your account, your data is permanently removed within 30 days.
        </p>
      </section>

      <section>
        <h2 className={h2Class}>Cookies</h2>
        <p className={pClass}>
          We use essential cookies for authentication only. We do not use
          tracking cookies.
        </p>
      </section>

      <section>
        <h2 className={h2Class}>Changes to this policy</h2>
        <p className={pClass}>
          We may update this policy from time to time. We&apos;ll notify you of
          significant changes by email.
        </p>
      </section>

      <section>
        <h2 className={h2Class}>Contact</h2>
        <p className={pClass}>
          Roadie Media
          <br />
          <a
            href="mailto:hello@roadie.media"
            className="font-semibold text-foreground underline underline-offset-4 hover:text-brand hover:no-underline"
          >
            hello@roadie.media
          </a>
          <br />
          <a
            href="https://app.roadie.media"
            className="font-semibold text-foreground underline underline-offset-4 hover:text-brand hover:no-underline"
          >
            app.roadie.media
          </a>
        </p>
      </section>

      <p className="mt-12 text-sm text-muted">
        <Link
          href="/"
          className="underline underline-offset-4 hover:text-brand hover:no-underline"
        >
          Back to home
        </Link>
      </p>
    </div>
  );
}
