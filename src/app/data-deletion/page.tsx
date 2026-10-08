import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Delete your data — Tempo",
  description:
    "How to ask Roadie Media to delete the Tempo data we hold about you, and how to remove Tempo’s access to Instagram.",
};

const h2Class =
  "mt-8 text-lg font-black uppercase tracking-tight text-foreground";
const pClass = "mt-3 text-sm leading-relaxed text-muted-strong";
const linkClass =
  "font-semibold text-foreground underline underline-offset-4 hover:text-brand hover:no-underline";

export default function DataDeletionPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-widest text-brand">
        Tempo
      </p>
      <h1 className="mt-3 text-4xl font-black uppercase tracking-tight text-foreground">
        Delete your data
      </h1>
      <p className="mt-2 text-sm text-muted">Last updated 4 October 2026</p>

      <p className={pClass}>
        Tempo is run by Roadie Media. You can ask us to delete the data we hold
        about you at any time, whether or not you still have an account. This
        page explains what we hold, how to remove it, and what happens next.
      </p>

      <section>
        <h2 className={h2Class}>What we hold</h2>
        <p className={pClass}>
          If you created an account or connected Instagram, we may hold:
        </p>
        <ul className={`${pClass} list-disc space-y-2 pl-5`}>
          <li>Your account details, such as your name and email address.</li>
          <li>
            Data from your connected Instagram professional account, including
            your username, profile information, posts, and post insights such as
            reach and engagement.
          </li>
          <li>
            Data from a free Instagram audit, if you requested one: publicly
            available profile and post information, and the audit we produced
            from it.
          </li>
          <li>
            The plans, ideas, and recommendations Tempo has generated for you,
            and anything you have saved, pinned, or written in Tempo.
          </li>
          <li>Your email preferences and subscription status.</li>
        </ul>
      </section>

      <section>
        <h2 className={h2Class}>Request deletion</h2>
        <p className={pClass}>
          Email{" "}
          <a
            href="mailto:hello@roadie.media?subject=Delete%20my%20Tempo%20data"
            className={linkClass}
          >
            hello@roadie.media
          </a>{" "}
          with the subject line “Delete my Tempo data”. Include the email
          address you signed up with and your Instagram username, so we can
          find everything linked to you. We will confirm by email once your
          data has been deleted.
        </p>
      </section>

      <section>
        <h2 className={h2Class}>Remove Tempo’s access to Instagram</h2>
        <p className={pClass}>
          You can stop Tempo accessing your Instagram account at any time from
          within Instagram:
        </p>
        <ol className={`${pClass} list-decimal space-y-2 pl-5`}>
          <li>Open Instagram and go to your profile.</li>
          <li>
            Open Settings, then go to Website permissions, then Apps and
            websites.
          </li>
          <li>Find Tempo under Active and select Remove.</li>
        </ol>
        <p className={pClass}>
          Removing access stops Tempo collecting new data. It does not delete
          data we already hold, so email us as well if you want that removed.
        </p>
      </section>

      <section>
        <h2 className={h2Class}>What happens next</h2>
        <p className={pClass}>
          We delete your account, your Instagram data, your audit results, and
          everything Tempo generated for you within 30 days of your request,
          and remove you from our email lists. Data in backups is overwritten
          as part of our normal backup cycle.
        </p>
        <p className={pClass}>
          If you paid for Tempo, we keep billing records, such as invoices and
          payment confirmations, for as long as UK tax law requires. These are
          held by our payment provider, Stripe, and do not include your
          Instagram data.
        </p>
      </section>

      <section>
        <h2 className={h2Class}>Questions</h2>
        <p className={pClass}>
          For anything else about your data, contact{" "}
          <a href="mailto:hello@roadie.media" className={linkClass}>
            hello@roadie.media
          </a>
          , or read our{" "}
          <Link href="/privacy" className={linkClass}>
            privacy policy
          </Link>
          .
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
