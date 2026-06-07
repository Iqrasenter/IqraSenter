import type { Metadata, Viewport } from "next";
import { Geist, Outfit } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/JsonLd";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#1B6B4A",
  width: "device-width",
  initialScale: 1,
};

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
    "islamsk utdanning",
    "arabisk",
    "koranskole",
  ],
  authors: [{ name: "Iqra Læring og Aktivitetssenter" }],
  creator: "Iqra Senter",
  publisher: "Iqra Læring og Aktivitetssenter",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "Iqra Læring og Aktivitetssenter",
    description:
      "Læring, fellesskap og muligheter — for hele familien i Oslo.",
    url: "https://www.iqrasenter.net",
    siteName: "Iqra Senter",
    locale: "nb_NO",
    type: "website",
    images: [
      {
        url: "/images/hero-children.jpg",
        width: 1200,
        height: 630,
        alt: "Barn og familier hos Iqra Senter i Oslo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Iqra Læring og Aktivitetssenter",
    description:
      "Læring, fellesskap og muligheter — for hele familien i Oslo.",
    images: ["/images/hero-children.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://www.iqrasenter.net",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nb" className={`${geist.variable} ${outfit.variable}`}>
      <body className="antialiased selection:bg-accent/20 selection:text-accent">
        <OrganizationJsonLd />
        <WebSiteJsonLd />
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
    <div
      className="pointer-events-none fixed inset-0 z-40 h-[100dvh] w-screen opacity-[0.05]"
      aria-hidden="true"
    >
      <svg className="h-full w-full" style={{ pointerEvents: "none" }}>
        <filter id="noiseFilter">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
        </filter>
        <rect
          width="100%"
          height="100%"
          filter="url(#noiseFilter)"
          style={{ pointerEvents: "none" }}
        />
      </svg>
    </div>
  );
}
