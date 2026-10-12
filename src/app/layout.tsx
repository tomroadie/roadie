import type { Metadata } from "next";
// Self-hosted (bundled from npm) rather than fetched from Google at build
// time, which broke a production build via a stale font cache.
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import { ConsentBanner } from "@/components/consent-banner";
import { ConsentedScripts } from "@/components/consented-scripts";
import "./globals.css";



export const metadata: Metadata = {
  title: "Tempo",
  description: "Tempo helps music artists post more, without the dread: a training plan for your socials.",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "Tempo",
    description: "Tempo helps music artists post more, without the dread: a training plan for your socials.",
    url: "https://tempo.roadie.media",
    siteName: "Tempo",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ConsentedScripts />
        <ConsentBanner />
      </body>
    </html>
  );
}
