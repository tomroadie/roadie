import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Roadie",
  description:
    "Terms of Service for Roadie, the content planning tool for music artists operated by Roadie Media.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">
        Legal
      </p>
      <h1 className="mt-2 text-4xl font-black uppercase tracking-tight text-foreground sm:text-5xl">
        Terms of Service
      </h1>
      <p className="mt-3 text-sm text-muted">
        Last updated: 5 May 2026. By using Roadie you agree to these terms.
      </p>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-muted">
        <section className="space-y-3">
          <h2 className="text-base font-black uppercase tracking-tight text-foreground">
            Introduction
          </h2>
          <p>
            Roadie is a software-as-a-service content planning tool designed for music artists and
            their teams. The service is operated by Roadie Media (“Roadie”, “we”, “us”). These Terms
            of Service (“Terms”) govern your access to and use of our websites, applications, and
            related services (collectively, the “Service”). If you do not agree, do not use the
            Service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-black uppercase tracking-tight text-foreground">
            Eligibility
          </h2>
          <p>
            You must be at least 18 years old and have full legal capacity to enter into a binding
            agreement in your jurisdiction. You represent that you own or have all rights,
            permissions, and authority necessary to connect any Instagram account or other third-party
            account you link to the Service, including where you act on behalf of an artist or
            organisation.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-black uppercase tracking-tight text-foreground">
            Subscription and billing
          </h2>
          <p>
            Paid plans are billed in advance on a monthly recurring basis unless otherwise stated at
            checkout. New subscribers receive a 14-day free trial as described on our pricing page;
            payment details may be required before or after the trial depending on the flow presented
            to you.
          </p>
          <p>
            You may cancel your subscription at any time through the billing controls we provide or,
            where applicable, via your payment provider. Cancellation stops future renewals; access
            typically continues until the end of the current paid period. Fees are non-refundable
            except where required by law. We do not provide refunds or credits for partial months or
            unused time.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-black uppercase tracking-tight text-foreground">
            Acceptable use
          </h2>
          <p>You agree not to:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Use the Service to scrape, harvest, automate access to, or systematically extract data
              from Instagram, Roadie, or third parties in breach of their terms or applicable law.
            </li>
            <li>
              Resell, sublicense, or commercially redistribute access to the Service without our
              written consent.
            </li>
            <li>
              Share login credentials or maintain more than one personal account where prohibited by
              us; team or roster features must be used as intended under your plan.
            </li>
            <li>
              Interfere with or disrupt the Service, attempt unauthorised access, or misuse support
              channels.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-black uppercase tracking-tight text-foreground">
            Instagram data
          </h2>
          <p>
            Where you connect Instagram through Meta’s APIs or OAuth, we retrieve and analyse data
            you authorise (such as public profile and media insights) to generate suggestions and
            reports inside Roadie. We do not ask for or store your Instagram password. Unless you
            explicitly use features that send content on your behalf (if we offer them), we do not
            post to Instagram or change your account settings for you. Your use of Instagram remains
            subject to Meta’s terms and policies.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-black uppercase tracking-tight text-foreground">
            Intellectual property
          </h2>
          <p>
            Roadie and its branding, software, and documentation are protected by intellectual
            property laws. Subject to these Terms, outputs such as content ideas, captions, or plans
            generated for you are yours to use for your creative and commercial purposes; we do not
            claim ownership of those outputs. You grant us a limited licence to host and process your
            content and inputs solely to operate and improve the Service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-black uppercase tracking-tight text-foreground">
            Disclaimers
          </h2>
          <p>
            The Service is provided “as is” and “as available”. To the fullest extent permitted by
            law, we disclaim warranties of merchantability, fitness for a particular purpose, and
            non-infringement. Roadie provides planning assistance and analytics-style insights only.
            We do not guarantee any particular level of follower growth, engagement, revenue, or
            other business outcome. You are responsible for your posts, releases, and compliance with
            platform rules and applicable law.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-black uppercase tracking-tight text-foreground">
            Termination
          </h2>
          <p>
            You may stop using the Service at any time. We may suspend or terminate accounts or
            access if you violate these Terms, misuse the Service, create risk or legal exposure for
            us, or where we are required to do so by law or by a platform partner.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-black uppercase tracking-tight text-foreground">Contact</h2>
          <p>
            Questions about these Terms:{" "}
            <a
              href="mailto:hello@roadie.media"
              className="font-semibold text-foreground underline underline-offset-4 hover:text-brand hover:no-underline"
            >
              hello@roadie.media
            </a>
          </p>
        </section>
      </div>

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
