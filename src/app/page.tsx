import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";

const SITE_URL = "https://tempo.roadie.media";

const PAGE_TITLE = "Tempo — Weekly Content Planning for Music Artists";
const PAGE_DESCRIPTION =
  "Tempo analyses your Instagram, learns your voice, and delivers 5 specific post ideas every week — shaped by your sound, your shows, and what's actually working for you. Free Instagram audit included.";

const OG_TITLE = "Tempo — Weekly Content Planning for Music Artists";
const OG_DESCRIPTION =
  "Weekly content plans built for independent artists and labels. Free Instagram audit. 14-day free trial.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    url: SITE_URL,
    type: "website",
    siteName: "Tempo",
  },
};

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is Tempo?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Tempo is a content planning tool built specifically for music artists, managers, and labels. It analyses your Instagram presence, learns your voice and style, and delivers five specific post ideas every week — shaped by your sound, your upcoming shows, and what's actually working for your audience.",
      },
    },
    {
      "@type": "Question",
      name: "How does the free Instagram audit work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "When you sign up, Tempo analyses your last 10 Instagram posts — looking at engagement rates, content patterns, what resonates with your audience, and where the gaps are. You get a full breakdown within 3–5 minutes. No card required.",
      },
    },
    {
      "@type": "Question",
      name: "How is Tempo different from ChatGPT or other AI tools?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Generic content tools aren't built for music. Unlike general AI tools, Tempo combines music industry expertise with your real Instagram data — so every idea feels made for you, not generated for anyone. Your plans also get smarter over time as Tempo learns what performs for your specific audience.",
      },
    },
    {
      "@type": "Question",
      name: "How does the weekly plan work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Every Friday you receive a short check-in email asking what's coming up — shows, releases, anything on your mind. Every Monday your content plan arrives with five specific post ideas, shaped by your check-in response and what performed best last week.",
      },
    },
    {
      "@type": "Question",
      name: "Can I use Tempo for multiple artists?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Pro plans support up to 3 artist profiles and Label plans support up to 10. Each artist gets their own audit, their own voice profile, and their own weekly plan.",
      },
    },
    {
      "@type": "Question",
      name: "What Instagram data does Tempo use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Tempo analyses your public Instagram posts via your handle — no login required for the free audit. For live performance stats and week-on-week tracking, you can optionally connect your Instagram Business account via the Pro plan.",
      },
    },
    {
      "@type": "Question",
      name: "Is there a free trial?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — all paid plans include a 14-day free trial. Your free Instagram audit is always free with no card required.",
      },
    },
    {
      "@type": "Question",
      name: "What happens if I cancel?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You can cancel anytime. Your data stays in your account and you keep access until the end of your billing period.",
      },
    },
  ],
};

const SOFTWARE_APPLICATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Tempo",
  description:
    "Weekly content planning for music artists. Content plans shaped by your Instagram data, your shows, and your voice.",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: [
    {
      "@type": "Offer",
      name: "Starter",
      price: "29",
      priceCurrency: "GBP",
      billingPeriod: "P1M",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "59",
      priceCurrency: "GBP",
      billingPeriod: "P1M",
    },
    {
      "@type": "Offer",
      name: "Label",
      price: "149",
      priceCurrency: "GBP",
      billingPeriod: "P1M",
    },
  ],
  audience: {
    "@type": "Audience",
    audienceType:
      "Music artists, musicians, independent artists, music managers, record labels",
  },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(SOFTWARE_APPLICATION_JSON_LD),
        }}
      />
      <LandingPage />
    </>
  );
}
