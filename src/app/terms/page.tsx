import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms — Tempo",
  description: "The terms for using Tempo, run by Roadie Media Ltd.",
};

const UPDATED = "8 October 2026";

const h2Class = "text-base font-black uppercase tracking-tight text-foreground";
const linkClass =
  "font-semibold text-foreground underline underline-offset-4 hover:text-brand hover:no-underline";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className={h2Class}>{title}</h2>
      {children}
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">Legal</p>
      <h1 className="mt-2 text-4xl font-black uppercase tracking-tight text-foreground sm:text-5xl">Terms</h1>
      <p className="mt-3 text-sm text-muted">Last updated {UPDATED}. By using Tempo you agree to these terms.</p>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-muted-strong">
        <Section title="Who we are">
          <p>
            Tempo is run by Roadie Media Ltd (&ldquo;we&rdquo;, &ldquo;us&rdquo;), a company registered
            in England and Wales, company number 14753427, registered office 128 City Road, London,
            EC1V 2NX. Contact us at{" "}
            <a href="mailto:hello@roadie.media" className={linkClass}>
              hello@roadie.media
            </a>
            .
          </p>
          <p>
            Tempo helps music artists post more consistently: weekly ideas drawn from your own posts, a
            weekly target that starts where you are, and a view of how your posts did against your own
            usual.
          </p>
        </Section>

        <Section title="Who can use Tempo">
          <p>
            You must be 18 or over. If you connect an Instagram account or add an artist, you must own
            it or have permission to manage it.
          </p>
        </Section>

        <Section title="The beta">
          <p>
            Tempo is in a closed beta. Features will change, some things won&apos;t work perfectly, and we
            may pause or end the beta. During the closed beta Tempo is free. We&apos;ll tell you before
            anything you use starts costing money, and nothing will be charged without you choosing a
            paid plan.
          </p>
        </Section>

        <Section title="Your account">
          <p>
            Keep your login details to yourself and tell us if you think someone else has used your
            account. You&apos;re responsible for what happens in your account.
          </p>
        </Section>

        <Section title="Ideas written by AI">
          <p>
            Tempo&apos;s ideas, audits and summaries are written with AI, based on your posts and
            answers. They&apos;re suggestions, not professional advice, and they can be wrong. Check
            anything before you post it, especially facts, names, dates and anything about other
            people. You decide what to post, and you&apos;re responsible for what you post.
          </p>
          <p>
            What Tempo writes for you is yours to use. We don&apos;t claim ownership of it. You give us
            permission to store and process your content and answers only to run Tempo for you.
          </p>
        </Section>

        <Section title="Instagram">
          <p>
            If you connect Instagram, we use Meta&apos;s official API to read the data you allow (your
            profile, posts and their insights). We never see your Instagram password, and Tempo never
            posts, likes or comments for you. You can remove our access at any time in Instagram&apos;s
            settings; see{" "}
            <Link href="/data-deletion" className={linkClass}>
              Delete your data
            </Link>
            .
          </p>
          <p>
            Tempo isn&apos;t affiliated with, endorsed by or sponsored by Meta or Instagram. Your use of
            Instagram is still covered by Meta&apos;s own terms.
          </p>
        </Section>

        <Section title="Paid plans">
          <p>
            If you choose a paid plan after the beta, the price, what&apos;s included and how often
            you&apos;re billed will be shown before you pay. Payments are handled by Stripe. You can
            cancel at any time from Settings; you keep access until the end of the period you&apos;ve
            paid for, and you won&apos;t be charged again.
          </p>
          <p>
            If you&apos;re a consumer, you have legal rights, including cancellation rights, that these
            terms don&apos;t take away.
          </p>
        </Section>

        <Section title="Fair use">
          <p>Please don&apos;t:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>use Tempo for accounts you don&apos;t have permission to manage;</li>
            <li>scrape, copy or automatically extract data from Tempo or Instagram;</li>
            <li>resell or share access to Tempo without our written agreement;</li>
            <li>try to break, overload or get around the security of Tempo.</li>
          </ul>
        </Section>

        <Section title="No promises about results">
          <p>
            We work hard to make Tempo useful, but we can&apos;t promise any particular growth, reach,
            engagement or income. Tempo is provided as it is, and may sometimes be unavailable.
          </p>
        </Section>

        <Section title="Our liability">
          <p>
            Nothing in these terms limits our liability for death or personal injury caused by our
            negligence, for fraud, or for anything else the law doesn&apos;t allow us to limit.
          </p>
          <p>
            Otherwise, we&apos;re not liable for indirect losses or for loss of profit, income, followers
            or opportunity, and our total liability to you is limited to the greater of the amount
            you&apos;ve paid us in the 12 months before the claim and £100.
          </p>
        </Section>

        <Section title="Ending things">
          <p>
            You can stop using Tempo and ask us to delete your data at any time. We may suspend or close
            an account that breaks these terms, puts others at risk, or where the law or a platform
            partner such as Meta requires it. Where we reasonably can, we&apos;ll tell you first.
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>
            If we change these terms in a way that matters, we&apos;ll email you at least 14 days before
            the change takes effect. If you don&apos;t agree, you can stop using Tempo before then.
          </p>
        </Section>

        <Section title="Law">
          <p>
            These terms are governed by the law of England and Wales, and the courts of England and Wales
            can hear any dispute. If you live in Scotland or Northern Ireland, you can also bring a claim
            in your local courts.
          </p>
        </Section>

        <Section title="Privacy">
          <p>
            How we handle your data is explained in our{" "}
            <Link href="/privacy" className={linkClass}>
              privacy policy
            </Link>
            .
          </p>
        </Section>
      </div>

      <p className="mt-12 text-sm text-muted">
        <Link href="/" className="underline underline-offset-4 hover:text-brand hover:no-underline">
          Back to home
        </Link>
      </p>
    </div>
  );
}
