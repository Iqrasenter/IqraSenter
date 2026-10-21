import Image from "next/image";
import Link from "next/link";
import { Programmes } from "./Programmes";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { CopyAccount } from "./CopyAccount";
import { homeNews, newsBlurb, newsDate, newsLeadPhoto, newsTitle } from "./news";
import { HomeMotion } from "./HomeMotion";
import "./home.css";
import "./hero.css";
import "./motion.css";

export function HomeContent() {
  const { lead, deskTop, deskBottom } = homeNews();
  const leadPhoto = newsLeadPhoto(lead);
  return (
    <div className="iqra-home" id="top">
      <HomeMotion />
    <SiteHeader variant="home" />
    <main id="main">
      <section className="hero-d" aria-labelledby="hero-title">
        <div className="hero-pair">
          <figure className="hero-summer">
            <Image src="/images/home/hero-children-editorial.webp" alt="Barn fra Iqra samles til piknik på gresset" width={1448} height={1086} sizes="(max-width: 700px) 100vw, 62vw" priority />
          </figure>
          <figure className="hero-winter">
            <Image src="/images/home/winter-editorial.webp" alt="Iqras fellesskap på vintertur i skogen" width={1448} height={1086} sizes="(max-width: 700px) 100vw, 38vw" priority />
          </figure>
        </div>
        <div className="hero-base">
          <div>
            <h1 id="hero-title">
              Her vokser <br className="hero-br" />
              vi sammen.
            </h1>
            <p>
              Helgeskole, språk og aktiviteter for barn, unge og familier i Oslo.
            </p>
          </div>
          <Link className="hero-action" href="/om-oss">
            Bli kjent med Iqra
            <span aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      </section>
      <Programmes />
      <div className="news-piece">
        <section className="section newsroom" id="nyheter" aria-labelledby="news-title">
          <div className="heading">
            <h2 id="news-title">
              Fra livet på Iqra.
            </h2>
            <div>
              <p>
                Nyheter, arrangementer og små innblikk i fellesskapet vårt.
              </p>
              <Link className="link filled" href="/sistenytt">
                Se alle nyheter
                <span aria-hidden="true">
                  →
                </span>
              </Link>
            </div>
          </div>
          <div className="newsroom-grid">
            <article className="lead-story">
              <Link href="/sistenytt">
                <Image src={leadPhoto.src} width={1200} height={1600} alt={leadPhoto.alt} sizes="(max-width: 700px) 100vw, 60vw" />
                <div className="lead-body">
                  <h3>
                    {newsTitle(lead)}
                  </h3>
                  <time dateTime={lead.date}>
                    {newsDate(lead)}
                  </time>
                  <p>
                    {newsBlurb(lead)}
                  </p>
                  <span className="link">
                    Les mer
                    <span aria-hidden="true">
                      →
                    </span>
                  </span>
                </div>
              </Link>
            </article>
            <aside className="news-desk" aria-label="Flere nyheter">
              <article className="desk-story">
                <time dateTime={deskTop.date}>
                  {newsDate(deskTop)}
                </time>
                <Link href="/sistenytt">
                  <h3>
                    {newsTitle(deskTop)}
                  </h3>
                </Link>
                <p>
                  {newsBlurb(deskTop)}
                </p>
                <Link className="link" href="/sistenytt">
                  Les mer
                  <span aria-hidden="true">
                    →
                  </span>
                </Link>
              </article>
              <article className="desk-story desk-book">
                <Image src={deskBottom.image} width={1169} height={800} alt="" sizes="(max-width: 700px) 100vw, 60vw" />
                <div>
                  <time dateTime={deskBottom.date}>
                    {newsDate(deskBottom)}
                  </time>
                  <Link href="/sistenytt">
                    <h3>
                      {newsTitle(deskBottom)}
                    </h3>
                  </Link>
                  <Link className="link" href="/sistenytt">
                    Les mer
                    <span aria-hidden="true">
                      →
                    </span>
                  </Link>
                </div>
              </article>
              <Link className="link" href="/sistenytt">
                Flere historier fra Iqra
                <span aria-hidden="true">
                  →
                </span>
              </Link>
            </aside>
          </div>
        </section>
      </div>
      <div className="about-piece">
        <section className="section portrait" id="om-iqra" aria-labelledby="about-title">
          <div className="portrait-grid">
            <div className="portrait-copy">
              <h2 id="about-title">
                Om Iqra.
              </h2>
              <p className="portrait-intro">
                Iqra er et lærings- og aktivitetssenter på Ryen i Oslo. Her møtes barn, unge og familier for å lære og for å gjøre ting sammen.
              </p>
              <p className="portrait-mission">
                Helgeskole, kurs og aktiviteter gir mennesker med ulik bakgrunn en plass å lære sammen.
              </p>
              <p className="portrait-mission">
                Barna kommer til helgeskolen hver lørdag og søndag. Gjennom året arrangerer vi også turer, kurs for foreldre og fest på sommeren.
              </p>
              <Link className="action button" href="/om-oss">
                Bli kjent med Iqra
                <span aria-hidden="true">
                  →
                </span>
              </Link>
            </div>
            <figure className="portrait-photo">
              <div className="photo-frame">
                <Image src="/images/home/portrait-editorial.webp" width={1200} height={1600} alt="En gruppe barn fra Iqra samlet i gymsalen" sizes="(max-width: 700px) 100vw, 60vw" />
              </div>
              <figcaption>
                Barn fra Iqra samlet i gymsalen.
              </figcaption>
            </figure>
          </div>
        </section>
      </div>
      <div className="support-piece">
        <section className="section open" id="stott-iqra" aria-labelledby="support-title">
          <div className="header">
            <h2 id="support-title">
              Støtt Iqra.
            </h2>
            <p>
              Gi én gang eller fast hver måned. Gaven går til helgeskolen og aktivitetene på Ryen.
            </p>
          </div>
          <div className="ways">
            <section className="open-vipps">
              <div>
                <h3>
                  Gi med Vipps
                </h3>
                <p className="number">
                  957045
                </p>
                <p>
                  Søk på nummeret i Vipps, eller skann koden med mobilen.
                </p>
              </div>
              <Image className="qr" src="/images/qr-stott-oss.png" width={182} height={182} alt="QR-kode for Vipps til nummer 957045" unoptimized sizes="186px" />
            </section>
            <div className="ways-right">
              <section className="open-bank">
                <h3>
                  Overfør fra banken
                </h3>
                <div className="bank-row">
                  <p className="account">
                    1503.67.58535
                  </p>
                  <CopyAccount />
                </div>
                <p className="description">
                  Merk betalingen med «Støtte».
                </p>
              </section>
              <section className="open-monthly">
                <h3>
                  Gi fast hver måned
                </h3>
                <p>
                  Opprett AvtaleGiro. Du velger selv hvor mye du vil bidra med.
                </p>
                <a className="action" href="https://nettbutikk.solidus.no/avtalestraks/D6E5B9EA-89CF-43F0-90F0-2BD4039EADD2" target="_blank" rel="noopener noreferrer">
                  Opprett AvtaleGiro
                  <span aria-hidden="true">
                    ↗
                  </span>
                </a>
              </section>
            </div>
          </div>
        </section>
      </div>
      <div className="finish b">
        <section className="invitation" aria-labelledby="invitation-title">
          <div className="invite-copy">
            <h2 id="invitation-title">
              Velkommen til Iqra.
            </h2>
            <p>
              Barn, unge og familier er velkomne til å lære og være sammen hos oss, midt i Oslo.
            </p>
            <div className="actions">
              <Link className="button" href="/bli-medlem">
                Bli med i Iqra →
              </Link>
              <Link className="text-action" href="/kontakt">
                Kontakt oss →
              </Link>
            </div>
          </div>
          <div className="photo">
            <Image src="/images/home/forest-editorial.webp" alt="Barn på tur sammen i skogen" width={768} height={1024} sizes="(max-width: 700px) 100vw, 60vw" />
          </div>
        </section>
      </div>
    </main>
    <SiteFooter />
    </div>
  );
}
