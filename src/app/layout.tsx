import type { Metadata } from "next";
import { IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import { ConsentBanner } from "@/components/consent-banner";
import { ConsentedScripts } from "@/components/consented-scripts";
import "./globals.css";


const body = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const heading = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "700"],
});

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
      className={`${body.variable} ${heading.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ConsentedScripts />
        <ConsentBanner />
      </body>
    </html>
  );
}
