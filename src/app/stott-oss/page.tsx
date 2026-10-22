import type { Metadata } from "next";
import { OG_IMAGES } from "@/lib/seo";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/SiteFooter";
import { HomeMotion } from "@/components/home/HomeMotion";
import { SupportGive } from "@/components/support/SupportGive";
import { GiftRail } from "@/components/support/GiftRail";
import "@/components/home/home.css";
import "@/components/home/motion.css";
import "@/components/support/support.css";

export const metadata: Metadata = {
  title: "Støtt oss",
  description:
    "Gi til helgeskolen på Ryen: Vipps 957045, konto 1503.67.58535, eller fast hver måned med AvtaleGiro.",
  alternates: {
    canonical: "https://www.iqrasenter.no/stott-oss",
  },
  openGraph: {
    images: OG_IMAGES,
    title: "Støtt Iqra Senter",
    description: "Gi til helgeskolen på Ryen med Vipps, bankoverføring eller fast hver måned med AvtaleGiro.",
    url: "https://www.iqrasenter.no/stott-oss",
  },
};

const REVEAL = [".give-intro > *", ".give-card", ".goes-head", ".goes-rail li", ".footer-grid > *"].join(",");

export default function StottOssPage() {
  return (
    <div className="iqra-home support-page" id="top">
      <a className="skip" href="#main">
        Gå til innhold
      </a>
      <SiteHeader variant="dark" current="Støtt oss" />
      <main id="main">
        {/* One screen: the headline and the choice on the left, the card on the right, and under both a strip of
            what the gift goes to. */}
        <section className="give-desk" aria-labelledby="give-title">
          <SupportGive />
          <GiftRail />
        </section>
      </main>
      <SiteFooter />
      <HomeMotion targets={REVEAL} />
    </div>
  );
}
