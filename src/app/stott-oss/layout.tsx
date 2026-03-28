import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Støtt oss",
  description:
    "Din støtte gjør en forskjell. Se hvordan du kan bidra til Iqra Læring og Aktivitetssenter gjennom Vipps, bankoverføring eller Avtalegiro.",
  alternates: {
    canonical: "https://www.iqrasenter.net/stott-oss",
  },
  openGraph: {
    title: "Støtt Iqra Senter",
    description:
      "Din støtte gjør en forskjell. Se hvordan du kan bidra til Iqra Læring og Aktivitetssenter i Oslo.",
    url: "https://www.iqrasenter.net/stott-oss",
  },
};

export default function StottOssLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
