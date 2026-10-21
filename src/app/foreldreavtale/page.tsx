import type { Metadata } from "next";
import Image from "next/image";
import avtale from "./avtale.json";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/SiteFooter";
import { HomeMotion } from "@/components/home/HomeMotion";
import "@/components/home/home.css";
import "@/components/home/motion.css";
import "@/components/agreement/agreement.css";

export const metadata: Metadata = {
  title: "Foreldreavtale",
  description:
    "Avtale mellom Iqra Læring og Aktivitetssenter og foresatte. Les avtalen og bekreft din skoleplass.",
  alternates: {
    canonical: "https://www.iqrasenter.no/foreldreavtale",
  },
  openGraph: {
    title: "Foreldreavtale - Iqra Senter",
    description:
      "Les foreldreavtalen og bekreft skoleplassen for ditt barn hos Iqra Senter.",
    url: "https://www.iqrasenter.no/foreldreavtale",
  },
};

const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSenPcdDjskImTmPErM670_QGbnw2jl4fbCWk2eDmk_MecjQ2A/viewform";

/**
 * The agreement text lives in ./avtale.json, not here.
 *
 * scripts/generate-foreldreavtale-pdf.mjs renders the printable PDF from that
 * same file. The PDF is what many parents actually read and keep, and it is the
 * wording an oppsigelse of a skoleplass would be argued against — so page and
 * PDF disagreeing is the one failure this document cannot have. One source.
 *
 * Bump `versjon` in avtale.json on every wording change: the Google Form records
 * WHEN a family accepted but not WHAT, so the stamp is the only thing tying an
 * acceptance to the terms that were on screen.
 */
type Section = {
  title: string;
  intro?: string;
  items?: string[];
};

const AVTALE_VERSJON: string = avtale.versjon;
const SECTIONS: Section[] = avtale.sections;

const REVEAL = [".index", ".sheet", ".confirm .head > *", ".confirm-photo", ".footer-grid > *"].join(",");

const pad = (n: number) => String(n).padStart(2, "0");

export default function ForeldreavtalePage() {
  return (
    <div className="iqra-home agreement-page" id="top">
      <a className="skip" href="#main">
        Gå til innhold
      </a>
      <SiteHeader variant="page" current="Foreldreavtale" />
      <main id="main">
        {/* Hero: a short welcome, the two things to do, and one photograph in an arch. */}
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-text">
            <p className="kicker">Gratulerer med skoleplassen</p>
            <h1 id="hero-title">Foreldre&shy;avtalen.</h1>
            <p className="lead">
              Les avtalen i ro og mak. Når dere er enige i den, bekrefter dere nederst på siden, og plassen er endelig.
            </p>
            <div className="hero-actions">
              <a className="button" href="#del-1">
                Les avtalen <span aria-hidden="true">↓</span>
              </a>
              <a className="link" href="/foreldreavtale.pdf" target="_blank" rel="noopener noreferrer">
                Last ned som PDF <span aria-hidden="true">↓</span>
              </a>
            </div>
            <p className="version">
              Versjon{" "}
              <time dateTime={AVTALE_VERSJON} className="tabular">
                {AVTALE_VERSJON}
              </time>{" "}
              · gjelder fra skolestart høsten 2026
            </p>
          </div>
          <figure className="hero-arch">
            <Image
              src="/images/home/kurs-editorial.webp"
              alt="En elev skriver i skrivebok ved pulten i klasserommet"
              width={1300}
              height={1211}
              sizes="(max-width: 1100px) 90vw, 50vw"
              priority
            />
          </figure>
        </section>

        {/* The agreement: a quiet index on the left, each part as a sheet with an arched tab. */}
        <section className="reader" aria-label="Avtaleteksten">
          <nav className="index" aria-label="Innhold i avtalen">
            <p className="index-title">I denne avtalen</p>
            <ol>
              {SECTIONS.map((section, i) => (
                <li key={section.title}>
                  <a href={`#del-${i + 1}`}>
                    <span className="n">{pad(i + 1)}</span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="sheets">
            {SECTIONS.map((section, i) => (
              <article className="sheet" id={`del-${i + 1}`} key={section.title} aria-labelledby={`del-${i + 1}-title`}>
                <span className="tab" aria-hidden="true">
                  Del {i + 1}
                </span>
                <h2 id={`del-${i + 1}-title`}>{section.title}</h2>
                {section.intro && <p className="intro">{section.intro}</p>}
                {section.items && (
                  <ul className="clauses">
                    {section.items.map((item, j) => (
                      <li key={j} className={item.startsWith("Eksempel:") ? "note" : undefined}>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* Confirm: the one thing left to do, on the deep green. */}
        <section className="confirm" id="bekreft" aria-labelledby="confirm-title">
          <div className="confirm-main">
            <div className="head">
              <h2 id="confirm-title">
                Har dere lest hele avtalen?
              </h2>
              <p>Ved å fylle ut skjemaet bekrefter dere at dere har lest og godtar foreldreavtalen.</p>
            </div>
            <div className="confirm-actions">
              <a className="button meadow" href={GOOGLE_FORM_URL} target="_blank" rel="noopener noreferrer">
                Bekreft foreldreavtalen <span aria-hidden="true">↗</span>
              </a>
              <a className="link" href="/foreldreavtale.pdf" target="_blank" rel="noopener noreferrer">
                Last ned som PDF <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>
          <figure className="confirm-photo">
            <Image
              src="/images/home/summer-editorial.webp"
              alt="Jenter fra helgeskolen poserer under et stort tre i skolegården"
              width={1086}
              height={1448}
              sizes="(max-width: 1100px) 90vw, 25vw"
            />
          </figure>
        </section>
      </main>
      <SiteFooter />
      <HomeMotion targets={REVEAL} />
    </div>
  );
}
