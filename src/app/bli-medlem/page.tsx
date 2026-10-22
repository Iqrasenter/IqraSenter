import type { Metadata } from "next";
import { OG_IMAGES } from "@/lib/seo";
import Image from "next/image";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/SiteFooter";
import { HomeMotion } from "@/components/home/HomeMotion";
import { MemberDoors } from "@/components/membership/MemberDoors";
import { MemberFaq } from "@/components/membership/MemberFaq";
import "@/components/home/home.css";
import "@/components/home/motion.css";
import "@/components/membership/membership.css";

export const metadata: Metadata = {
  title: "Bli medlem / Opptak",
  description: "Helgeskolen er full, men ventelisten er åpen. Sett barnet på ventelisten, meld familien inn som medlemmer, eller spør oss om det dere lurer på.",
  alternates: {
    canonical: "https://www.iqrasenter.no/bli-medlem",
  },
  openGraph: {
    images: OG_IMAGES,
    title: "Bli medlem - Iqra Senter",
    description: "Helgeskolen er full, men ventelisten er åpen. Sett barnet på ventelisten eller meld familien inn som medlemmer.",
    url: "https://www.iqrasenter.no/bli-medlem",
  },
};

const REVEAL = [
  ".doors-section .head > *",
  ".doors",
  ".rooms",
  ".road .head > *",
  ".stops li",
  ".road-photo",
  ".faq .head > *",
  ".card",
  ".where h2",
  ".rows li",
  ".route",
  ".footer-grid > *",
].join(",");

const STOPS = [
  { title: "Interessemelding", text: "Dere fyller ut skjemaet. Det tar noen minutter." },
  { title: "Ventelisten", text: "Barnet står på lista. Ring gjerne og spør." },
  { title: "Vi ringer", text: "Når en plass blir ledig, avtaler vi innmelding." },
  { title: "Første helg", text: "Barnet møter klassen sin på Ryen." },
];

const MAPS = "https://www.google.com/maps/search/?api=1&query=Ryenstubben+2%2C+0679+Oslo";

export default function BliMedlemPage() {
  return (
    <div className="iqra-home member-page" id="top">
      <a className="skip" href="#main">
        Gå til innhold
      </a>
      <SiteHeader variant="page" current="Bli medlem / opptak" />
      <main id="main">
        {/* Hero: one honest sentence, two photographs that overlap like prints on a table. */}
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-text">
            <h1 id="hero-title">
              Ventelisten er åpen.
            </h1>
            <p>Helgeskolen er full, men vi tar imot interessemeldinger fortløpende. Velg det som passer dere, så tar vi kontakt.</p>
            <div className="hero-actions">
              <a className="button" href="#dorer" data-open-door="0">
                Sett barnet på lista <span aria-hidden="true">↓</span>
              </a>
              <a className="link" href="#dorer" data-open-door="2">
                Har dere et spørsmål? <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>
          <div className="hero-prints">
            <figure className="print wide">
              <Image src="/images/editorial/sommerfest-5.webp" alt="Gutter og menn i gymsalen følger med på scenen, noen ser mot kameraet" width={2172} height={2896} sizes="(max-width: 1100px) 90vw, 50vw" priority />
            </figure>
            <figure className="print tall">
              <Image src="/images/home/portrait-editorial.webp" alt="Gutter fra helgeskolen står arm i arm i gymsalen og smiler" width={1086} height={1448} sizes="(max-width: 500px) 38vw, 20vw" priority />
            </figure>
          </div>
        </section>

        <MemberDoors />

        {/* The road to a place: four stops on one bar, on the deep green. */}
        <section className="road" id="veien" aria-labelledby="veien-title">
          <div className="road-main">
            <div className="head">
              <h2 id="veien-title">Veien til en plass.</h2>
              <p>Slik går det til. Vi kan ikke love når en plass blir ledig.</p>
            </div>
            <ol className="stops">
              {STOPS.map((s, i) => (
                <li key={s.title}>
                  <span className={`dot${i === STOPS.length - 1 ? " last" : ""}`} aria-hidden="true" />
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
          <figure className="road-photo">
            <Image src="/images/editorial/iqrany4.webp" alt="Jenter fra helgeskolen holder opp diplomene sine" width={1200} height={1600} sizes="(max-width: 1100px) 90vw, 25vw" />
          </figure>
        </section>

        {/* Questions: cards with arched tabs. */}
        <section className="faq" id="sporsmal" aria-labelledby="faq-title">
          <div className="head">
            <h2 id="faq-title">
              Det dere lurer på.
            </h2>
            <p>
              Finner dere ikke svaret?{" "}
              <a className="inline" href="#dorer" data-open-door="2">
                Spør oss
              </a>
              .
            </p>
            <figure className="faq-photo">
              <Image src="/images/editorial/sommerfest-3.webp" alt="To barn presenterer med mikrofon på scenen ved siden av Iqras rollup" width={2172} height={2896} sizes="25vw" />
            </figure>
          </div>
          <MemberFaq />
        </section>

        {/* Where: the address beside a drawn route from Ryen T-bane (a sketch, not a map), in an arch. */}
        <section className="where" id="finn-oss" aria-labelledby="where-title">
          <div className="where-text">
            <h2 id="where-title">
              Her holder vi til.
            </h2>
            <ul className="rows">
              <li>
                <a href={MAPS}>
                  Ryenstubben 2, 0679 Oslo <span aria-hidden="true">↗</span>
                </a>
              </li>
              <li>5 min fra Ryen&nbsp;T&#8209;bane</li>
              <li>
                <a href="tel:+4799864331">
                  +47 998 64 331 <span aria-hidden="true">↗</span>
                </a>
              </li>
            </ul>
          </div>
          <div className="route">
            <svg viewBox="0 0 560 380" aria-hidden="true" focusable="false">
              <path className="street" d="M-20 318 C 120 312 190 262 280 226 S 430 150 580 118" />
              <path className="street" d="M150 -20 C 170 120 196 250 210 400" />
              <path className="street" d="M380 -20 C 395 80 430 200 470 400" />
              <path className="walk" d="M90 292 C 170 280 236 236 300 205 S 420 135 470 112" />
              <circle className="stop-ring" cx="90" cy="292" r="15" />
              <circle className="pin" cx="470" cy="112" r="19" />
            </svg>
            <p className="route-label at-start">Ryen T-bane</p>
            <p className="route-label at-mid">5 min å gå</p>
            <p className="route-label at-end">Iqra, Ryenstubben 2</p>
          </div>
        </section>
      </main>
      <SiteFooter />
      <HomeMotion targets={REVEAL} />
    </div>
  );
}
