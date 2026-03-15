import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.iqrasenter.net"),
  title: {
    default: "Iqra Læring og Aktivitetssenter — Læring for hele familien",
    template: "%s | Iqra Senter",
  },
  description:
    "Et trygt og inkluderende fellesskap med læring, fritidsaktiviteter og sosialt samvær for barn, unge og familier i Oslo.",
  keywords: [
    "Iqra",
    "læring",
    "aktivitetssenter",
    "Oslo",
    "helgeskole",
    "fritidsaktiviteter",
    "kurs",
    "fellesskap",
    "barn",
    "unge",
    "familier",
  ],
  other: {
    "theme-color": "#FFFFFF",
  },
  openGraph: {
    title: "Iqra Læring og Aktivitetssenter",
    description:
      "Læring, fellesskap og muligheter — for hele familien i Oslo.",
    url: "https://www.iqrasenter.net",
    siteName: "Iqra Senter",
    locale: "nb_NO",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nb" className={`${fraunces.variable} ${outfit.variable}`}>
      <body
        className="antialiased selection:bg-accent/20 selection:text-accent"
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold"
        >
          Gå til innhold
        </a>
        <NoiseOverlay />
        <Navbar />
        <main id="main">{children}</main>
      </body>
    </html>
  );
}

function NoiseOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 h-[100dvh] w-screen opacity-[0.05]">
      <svg className="h-full w-full" aria-hidden="true" style={{ pointerEvents: "none" }}>
        <filter id="noiseFilter">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#noiseFilter)" style={{ pointerEvents: "none" }} />
      </svg>
    </div>
  );
}
