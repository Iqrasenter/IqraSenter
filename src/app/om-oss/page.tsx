import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/SiteFooter";
import { HomeMotion } from "@/components/home/HomeMotion";
import { AboutFrame } from "@/components/about/AboutFrame";
import "@/components/home/home.css";
import "@/components/home/motion.css";
import "@/components/about/about.css";

export const metadata: Metadata = {
  title: "Om oss",
  description: "Iqra er et lærings- og aktivitetssenter på Ryen i Oslo: helgeskole, turer, kurs og fester for barn, unge og hele familien.",
  alternates: {
    canonical: "https://www.iqrasenter.no/om-oss",
  },
  openGraph: {
    title: "Om Iqra Senter",
    description: "Et lærings- og aktivitetssenter på Ryen i Oslo for barn, unge og hele familien.",
    url: "https://www.iqrasenter.no/om-oss",
  },
};

const REVEAL = [
  ".chapter-text > *",
  ".school-photos figure",
  ".trips-photo",
  ".courses-photo",
  ".party-photo",
  ".facts",
  ".close-photo",
  ".close-text > *",
  ".footer-grid > *",
].join(",");

export default function OmOssPage() {
  return (
    <div className="iqra-home about-page" id="top">
      <a className="skip" href="#main">
        Gå til innhold
      </a>
      <SiteHeader variant="page" current="Om oss" />
      <main id="main">
        {/* Hero: Iqra in one frame. The picker previews the four chapters below. */}
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-text">
            <h1 id="hero-title">Dette er Iqra.</h1>
            <p>Et lærings- og aktivitetssenter på Ryen i Oslo, for barn, unge og hele familien. Her lærer og leker vi sammen.</p>
          </div>
          <AboutFrame />
        </section>

        {/* The weekend school, on green. Text left, two photographs stepped right. */}
        <section className="chapter school" id="helgeskolen" aria-labelledby="skole-title">
          <div className="chapter-text">
            <h2 id="skole-title">
              Helgeskolen vår.
            </h2>
            <p>Barn og unge lærer språk, kultur og tradisjon, og leser Koranen sammen. Undervisningen er praktisk, og vennskap oppstår underveis.</p>
            <p>Skolen er et samarbeid med hjemmet. Foreldrene møtes på foreldremøter, og vi har en egen avtale med hver familie.</p>
          </div>
          <div className="school-photos">
            <figure>
              <Image src="/images/stottoss1.webp" alt="Elever i et klasserom på helgeskolen" width={1200} height={900} sizes="(max-width: 1100px) 55vw, 30vw" />
            </figure>
            <figure>
              <Image src="/images/home/kurs-editorial.webp" alt="En elev skriver i notatboken sin ved pulten" width={1299} height={1211} sizes="(max-width: 1100px) 40vw, 22vw" />
            </figure>
          </div>
        </section>

        {/* Trips, on white: one tall photograph to the edge, the text beside it. */}
        <section className="chapter trips" id="turene" aria-labelledby="tur-title">
          <figure className="trips-photo">
            <Image src="/images/home/forest-editorial.webp" alt="Barn går på sti i skogen" width={1086} height={1448} sizes="(max-width: 1100px) 100vw, 50vw" />
          </figure>
          <div className="chapter-text">
            <h2 id="tur-title">
              Ute i skogen.
            </h2>
            <p>Skogstur med niste i snøen, hyttetur med overnatting og piknik i parken. Barna kommer hjem slitne og glade.</p>
            <figure className="small-photo">
              <Image src="/images/stottoss5.webp" alt="Barn og voksne gjør klart til piknik i parken" width={1200} height={900} sizes="(max-width: 500px) 90vw, 440px" />
            </figure>
          </div>
        </section>

        {/* Courses and competitions, on mint: text across the top, two photographs below. */}
        <section className="chapter courses" id="kursene" aria-labelledby="kurs-title">
          <div className="chapter-text">
            <h2 id="kurs-title">
              For alle aldre.
            </h2>
            <p>Vi holder kurs og seminarer for foreldre og voksne i språk, kultur, barneoppdragelse og personlig utvikling. For barna har vi Koran-konkurranse, og diplomer for innsatsen.</p>
          </div>
          <figure className="courses-photo">
            <Image src="/images/iqrany4.webp" alt="Elever viser frem diplomene sine" width={1200} height={1600} sizes="(max-width: 760px) 45vw, 38vw" />
          </figure>
          <figure className="courses-photo wide">
            <Image src="/images/stottoss4.webp" alt="Deltakere på kurs rundt et bord med læreren" width={1200} height={900} sizes="(max-width: 760px) 45vw, 52vw" />
          </figure>
        </section>

        {/* Celebrations, on deep green: the stage photograph across, the summer school's facts beside the text. */}
        <section className="chapter party" id="festene" aria-labelledby="fest-title">
          <figure className="party-photo">
            <Image src="/images/home/stage-editorial.webp" alt="Jenter fra helgeskolen står på scenen under sommerfesten" width={1672} height={941} sizes="(max-width: 1340px) 96vw, 1260px" />
          </figure>
          <div className="party-grid">
            <div className="chapter-text">
              <h2 id="fest-title">
                Vi feirer sammen.
              </h2>
              <p>På sommerfesten fremfører barna på scenen, og det er taler, ansiktsmaling, fotball, sang og god mat. Om sommeren holder vi også sommerskole med undervisning, lek og turer.</p>
            </div>
            <dl className="facts">
              <div>
                <dt>Sommerskolen 2026</dt>
                <dd>29. juni – 30. juli</dd>
              </div>
              <div>
                <dt>Når</dt>
                <dd>Mandag–torsdag kl. 11–16</dd>
              </div>
              <div>
                <dt>For hvem</dt>
                <dd>Elever og barn på ventelisten</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Close: support or get in touch. */}
        <section className="close" aria-labelledby="close-title">
          <figure className="close-photo">
            <Image src="/images/home/summer-editorial.webp" alt="Jenter fra helgeskolen samlet i skolegården" width={1086} height={1448} sizes="(max-width: 500px) 90vw, 480px" />
          </figure>
          <div className="close-text">
            <h2 id="close-title">
              Bli en del av Iqra.
            </h2>
            <p>En gave, stor eller liten, blir til flere turer, kurs og fester for barna. Eller ta kontakt, så forteller vi mer.</p>
            <div className="close-actions">
              <Link className="button" href="/stott-oss">
                Støtt Iqra <span aria-hidden="true">→</span>
              </Link>
              <Link className="link" href="/kontakt">
                Kontakt oss <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <HomeMotion targets={REVEAL} />
    </div>
  );
}
