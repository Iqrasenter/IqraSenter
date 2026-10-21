import type { Metadata } from "next";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/SiteFooter";
import { ContactLetter } from "@/components/contact/ContactLetter";
import { SITE } from "@/lib/constants";
import "@/components/home/home.css";
import "@/components/contact/contact.css";

export const metadata: Metadata = {
  title: "Kontakt",
  description: "Ta kontakt med Iqra Læring og Aktivitetssenter. Vi svarer gjerne på dine spørsmål om våre tilbud, aktiviteter og medlemskap.",
  alternates: {
    canonical: "https://www.iqrasenter.net/kontakt",
  },
  openGraph: {
    title: "Kontakt Iqra Senter",
    description: "Ta kontakt med Iqra Læring og Aktivitetssenter. Vi svarer gjerne på dine spørsmål om våre tilbud.",
    url: "https://www.iqrasenter.net/kontakt",
  },
};

const ADDRESS_QUERY = "Ryenstubben 2, 0679 Oslo";
const MAP_EMBED = `https://maps.google.com/maps?q=${encodeURIComponent(ADDRESS_QUERY)}&z=16&output=embed`;
const MAP_LINK = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS_QUERY)}`;

export default function KontaktPage() {
  return (
    <div className="iqra-home contact-page" id="top">
      <a className="skip" href="#main">
        Gå til innhold
      </a>
      <SiteHeader variant="dark" current="Kontakt oss" />
      <main id="main">
        {/* One screen: the headline over the letter on the left; a small map and the other ways to reach us on the right. */}
        <section className="hero" aria-labelledby="hero-title">
          <ContactLetter />

          <div className="info-side">
            <div className="map">
              <iframe title="Kart over Iqra Senter, Ryenstubben 2 i Oslo" src={MAP_EMBED} loading="eager" referrerPolicy="no-referrer-when-downgrade" />
            </div>
            <div className="where-line">
              <p>
                {SITE.address}
                <br />5 min fra Ryen&nbsp;T&#8209;bane
              </p>
              <a className="maplink" href={MAP_LINK}>
                Åpne i Google Maps <span aria-hidden="true">↗</span>
              </a>
            </div>
            <div className="tiles">
              <a href={`tel:${SITE.phoneRaw}`}>
                <span className="tile-value">{SITE.phone}</span>
                <span className="tile-label">Ring oss</span>
                <span className="tile-go" aria-hidden="true">
                  ↗
                </span>
              </a>
              <a href={SITE.social.whatsapp}>
                <span className="tile-value">WhatsApp</span>
                <span className="tile-label">Send en melding</span>
                <span className="tile-go" aria-hidden="true">
                  ↗
                </span>
              </a>
              <a className="wide" href={`mailto:${SITE.email}`}>
                <span className="tile-value">{SITE.email}</span>
                <span className="tile-label">Skriv en e-post</span>
                <span className="tile-go" aria-hidden="true">
                  ↗
                </span>
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
