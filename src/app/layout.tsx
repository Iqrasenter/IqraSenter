import type { Metadata } from "next";
import { Sora, Instrument_Serif, Fira_Code } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { ScrollProvider } from "@/lib/scroll-context";


const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  subsets: ["latin"],
  style: ["italic", "normal"],
  display: "swap",
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
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
    <html lang="nb">
      <body
        className={`${sora.variable} ${instrumentSerif.variable} ${firaCode.variable} antialiased selection:bg-accent/20 selection:text-accent`}
      >
        <ScrollProvider>
          <NoiseOverlay />
          <Navbar />
          <main>{children}</main>
        </ScrollProvider>
      </body>
    </html>
  );
}

function NoiseOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 h-[100dvh] w-screen opacity-[0.05]">
      <svg className="h-full w-full" style={{ pointerEvents: "none" }}>
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
