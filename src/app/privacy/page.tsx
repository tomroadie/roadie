import type { Metadata } from "next";
import Link from "next/link";
import { CookieSettingsLink } from "@/components/consent-banner";

export const metadata: Metadata = {
  title: "Privacy policy — Tempo",
  description: "What Tempo collects, why, who it's shared with, and your rights.",
};

const UPDATED = "8 October 2026";
const CONTACT = "hello@roadie.media";

const h2Class = "mt-10 text-lg font-black uppercase tracking-tight text-foreground";
const h3Class = "mt-5 text-sm font-bold text-foreground";
const pClass = "mt-3 text-sm leading-relaxed text-muted-strong";
const listClass = `${pClass} list-disc space-y-2 pl-5`;
const linkClass =
  "font-semibold text-foreground underline underline-offset-4 hover:text-brand hover:no-underline";

function Mail() {
  return (
    <a href={`mailto:${CONTACT}`} className={linkClass}>
      {CONTACT}
    </a>
  );
}

const PROCESSORS: { name: string; what: string; where: string }[] = [
  { name: "Supabase", what: "Database and sign-in", where: "Sweden (EU), with support access from the US" },
  { name: "Vercel", what: "Hosting the app", where: "US and Germany" },
  { name: "Anthropic", what: "The AI that writes your ideas and audit", where: "US" },
  { name: "Resend", what: "Sending emails", where: "US" },
  { name: "Sentry", what: "Error reports so we can fix bugs", where: "US" },
  { name: "Stripe", what: "Payments, if you subscribe", where: "UK, EU and US" },
  { name: "Cloudflare (Turnstile)", what: "Checking sign-ups aren't bots", where: "Global network" },
  { name: "Google (Analytics, Tag Manager)", what: "Site analytics, only if you accept cookies", where: "US" },
  { name: "Meta (Pixel, Conversions API)", what: "Measuring our ads, only if you accept cookies", where: "Ireland and US" },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-widest text-brand">Tempo</p>
      <h1 className="mt-3 text-4xl font-black uppercase tracking-tight text-foreground">Privacy policy</h1>
      <p className="mt-2 text-sm text-muted">Last updated {UPDATED}</p>

      <p className={pClass}>
        The short version: we use your posts and answers to suggest what to post next and to show
        how your posts did against your own usual. We never compare you with other artists, never
        sell your data and never use it for advertising. You can disconnect Instagram or delete
        everything at any time.
      </p>

      <section>
        <h2 className={h2Class}>Who we are</h2>
        <p className={pClass}>
          Tempo is run by Roadie Media Ltd, a company registered in England and Wales (company number
          14753427), registered office 128 City Road, London, EC1V 2NX. We are the controller of the
          personal data described here. Contact us at <Mail />.
        </p>
      </section>

      <section>
        <h2 className={h2Class}>What we collect</h2>
        <h3 className={h3Class}>When you sign up and set up</h3>
        <ul className={listClass}>
          <li>Your email address and password (stored scrambled; we can&apos;t read it).</li>
          <li>
            Your artist name, genre and Instagram handle, and your answers to our set-up questions:
            how you feel about posting, how often you post now, which days you have time, and anything
            coming up (gigs, releases).
          </li>
        </ul>

        <h3 className={h3Class}>If you connect Instagram</h3>
        <p className={pClass}>
          Only with your permission, through Instagram&apos;s official API. We collect:
        </p>
        <ul className={listClass}>
          <li>Your username, profile picture, follower count and number of posts, checked once a day.</li>
          <li>
            For each post: the caption, type, date, link, cover image, likes and comments, and
            Instagram&apos;s insights (reach, views, saves and shares).
          </li>
          <li>An access token that lets us read this data. It can&apos;t post for you.</li>
        </ul>
        <p className={pClass}>
          We can&apos;t see your messages, and Tempo never posts, likes or comments on your behalf.
        </p>

        <h3 className={h3Class}>When you use Tempo</h3>
        <ul className={listClass}>
          <li>
            What you do with your ideas: pinning, posting, or turning them down (and the reason, if
            you give one), plus dates you add.
          </li>
          <li>Which emails we&apos;ve sent you, and your email settings.</li>
          <li>If you subscribe, your plan and billing status. Card details go to Stripe; we never see them.</li>
        </ul>

        <h3 className={h3Class}>Technical data</h3>
        <ul className={listClass}>
          <li>Server logs (such as IP address and browser) kept by our hosting provider for security.</li>
          <li>Error reports when something breaks. These don&apos;t include your name or email.</li>
          <li>A bot check on the sign-up form.</li>
          <li>Analytics and advertising cookies, only if you accept them (see Cookies below).</li>
        </ul>

        <h3 className={h3Class}>Earlier free audits</h3>
        <p className={pClass}>
          Before October 2026, our free Instagram audit collected public posts from the profile you
          gave us using a third-party tool (Apify). Tempo no longer does this. Audits now use only
          the data you share by connecting Instagram.
        </p>
      </section>

      <section>
        <h2 className={h2Class}>What we use it for, and why we&apos;re allowed to</h2>
        <ul className={listClass}>
          <li>
            <span className="font-semibold text-foreground">Running Tempo for you</span>: your weekly
            ideas, your weekly target, &ldquo;How your posts did&rdquo; and the emails about them.
            Lawful basis: our contract with you.
          </li>
          <li>
            <span className="font-semibold text-foreground">Writing ideas with AI</span>: we send your
            captions, post numbers and set-up answers to Anthropic, whose AI drafts your ideas and
            audit. Anthropic doesn&apos;t use this data to train its models. Lawful basis: contract.
          </li>
          <li>
            <span className="font-semibold text-foreground">Comparing your posts</span>: always with
            your own previous posts, never with other artists. Lawful basis: contract.
          </li>
          <li>
            <span className="font-semibold text-foreground">Occasional news about Tempo</span>: you can
            unsubscribe from any email. Lawful basis: legitimate interests.
          </li>
          <li>
            <span className="font-semibold text-foreground">Keeping Tempo secure and fixing bugs</span>.
            Lawful basis: legitimate interests.
          </li>
          <li>
            <span className="font-semibold text-foreground">Analytics and measuring our ads</span>, if
            you accept cookies. Lawful basis: consent, which you can withdraw at any time.
          </li>
          <li>
            <span className="font-semibold text-foreground">Billing records</span> we must keep for tax.
            Lawful basis: legal obligation.
          </li>
        </ul>
        <p className={pClass}>We don&apos;t sell your data, and we don&apos;t use your Instagram data for advertising.</p>
      </section>

      <section>
        <h2 className={h2Class}>Who we share it with</h2>
        <p className={pClass}>
          These companies process data for us, under contracts that only let them use it to provide
          their service to us:
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-card-border text-xs uppercase tracking-widest text-muted">
                <th className="py-2 pr-4 font-bold">Company</th>
                <th className="py-2 pr-4 font-bold">What for</th>
                <th className="py-2 font-bold">Where</th>
              </tr>
            </thead>
            <tbody>
              {PROCESSORS.map((p) => (
                <tr key={p.name} className="border-b border-card-border align-top text-muted-strong">
                  <td className="py-2 pr-4 font-semibold text-foreground">{p.name}</td>
                  <td className="py-2 pr-4">{p.what}</td>
                  <td className="py-2">{p.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={pClass}>
          Where data goes outside the UK, we rely on the UK&apos;s adequacy regulations, the UK
          Extension to the EU-US Data Privacy Framework, or the UK International Data Transfer
          Addendum to the EU standard contractual clauses, depending on the company.
        </p>
      </section>

      <section>
        <h2 className={h2Class}>How long we keep it</h2>
        <ul className={listClass}>
          <li>Your account and Instagram data: for as long as your account is open.</li>
          <li>
            If you disconnect Instagram, we stop collecting new data straight away. What we already
            have stays until you delete your account or ask us to remove it.
          </li>
          <li>
            When you delete your account or ask us to, we delete your data within 30 days. Backups are
            overwritten as part of our normal backup cycle.
          </li>
          <li>Billing records: for as long as UK tax law requires (held by Stripe).</li>
          <li>Your cookie choice: six months, then we ask again.</li>
        </ul>
      </section>

      <section>
        <h2 className={h2Class}>Your rights</h2>
        <p className={pClass}>Under UK data protection law you can ask us to:</p>
        <ul className={listClass}>
          <li>give you a copy of the data we hold about you, including in a portable format;</li>
          <li>correct anything that&apos;s wrong;</li>
          <li>delete your data;</li>
          <li>restrict or object to how we use it;</li>
          <li>stop using it for anything you consented to, such as cookies.</li>
        </ul>
        <p className={pClass}>
          Email <Mail /> and we&apos;ll reply within a month. You can also unsubscribe or pause emails
          from any email or from Settings. If you&apos;re unhappy with how we handle your data, you can
          complain to the Information Commissioner&apos;s Office at{" "}
          <a href="https://ico.org.uk/make-a-complaint/" className={linkClass}>
            ico.org.uk
          </a>
          , though we&apos;d appreciate the chance to put it right first.
        </p>
      </section>

      <section id="cookies">
        <h2 className={h2Class}>Cookies</h2>
        <h3 className={h3Class}>Always on</h3>
        <ul className={listClass}>
          <li>Sign-in cookies, so you stay logged in.</li>
          <li>A cookie that remembers which artist you&apos;re working on.</li>
          <li>A cookie that remembers your cookie choice.</li>
        </ul>
        <h3 className={h3Class}>Only if you accept</h3>
        <ul className={listClass}>
          <li>Google Analytics and Google Tag Manager: how people find and use the site.</li>
          <li>
            Meta Pixel: whether our ads lead to sign-ups. If you accept, we also tell Meta when you sign
            up or subscribe, identified by a scrambled (hashed) version of your email.
          </li>
        </ul>
        <p className={pClass}>
          You can change your mind at any time: <CookieSettingsLink className={linkClass} />.
        </p>
      </section>

      <section>
        <h2 className={h2Class}>Disconnecting and deleting</h2>
        <p className={pClass}>
          See{" "}
          <Link href="/data-deletion" className={linkClass}>
            Delete your data
          </Link>{" "}
          for how to remove Tempo&apos;s access to Instagram and how to have everything deleted.
        </p>
      </section>

      <section>
        <h2 className={h2Class}>Age</h2>
        <p className={pClass}>Tempo is for people aged 18 and over.</p>
      </section>

      <section>
        <h2 className={h2Class}>Changes</h2>
        <p className={pClass}>
          If we change this policy in a way that matters, we&apos;ll email you before it takes effect.
        </p>
      </section>

      <p className="mt-12 text-sm text-muted">
        <Link href="/" className="underline underline-offset-4 hover:text-brand hover:no-underline">
          Back to home
        </Link>
      </p>
    </div>
  );
}
