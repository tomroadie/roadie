import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ConsentBanner } from "@/components/consent-banner";
import { ConsentedScripts } from "@/components/consented-scripts";
import "./globals.css";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ConsentedScripts />
        <ConsentBanner />
      </body>
    </html>
  );
}
