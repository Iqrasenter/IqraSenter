import type { Metadata } from "next";
import { HomeContent } from "@/components/home/HomeContent";

export const metadata: Metadata = {
  title: "Iqra Læring og Aktivitetssenter — Læring for hele familien",
  description:
    "Et trygt og inkluderende fellesskap med læring, fritidsaktiviteter og sosialt samvær for barn, unge og familier i Oslo.",
  alternates: {
    canonical: "https://www.iqrasenter.net",
  },
};

export default function HomePage() {
  return <HomeContent />;
}
