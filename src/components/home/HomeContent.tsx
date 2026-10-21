import Image from "next/image";
import Link from "next/link";
import { Programmes } from "./Programmes";
import { HomeMenu } from "./HomeMenu";
import { CopyAccount } from "./CopyAccount";
import { homeNews, newsBlurb, newsDate, newsLeadPhoto, newsTitle } from "./news";
import { HomeMotion } from "./HomeMotion";
import "./home.css";
import "./motion.css";

export function HomeContent() {
  const { lead, deskTop, deskBottom } = homeNews();
  const leadPhoto = newsLeadPhoto(lead);
  return (
    <div className="iqra-home" id="top">
      <HomeMotion />
    <div className="finish a">
      <aside className="announcement">
        <Link href="/foreldreavtale">
          <span>
            Til foreldre og foresatte av nye elever
          </span>
          <strong>
            Les og bekreft foreldreavtalen →
          </strong>
        </Link>
      </aside>
      <header className="header">
        <a className="logo" href="#top" aria-label="Iqra – hjem">
          <Image src="/images/logo-wide.webp" alt="Iqra Læring og Aktivitetssenter" width={1024} height={289} unoptimized sizes="186px" />
        </a>
        <nav className="desktop-nav" aria-label="Hovedmeny">
          <a href="#nyheter">
            Siste nytt
          </a>
          <Link href="/nettbutikk">
            Nettbutikk
          </Link>
          <Link href="/bli-medlem">
            Bli medlem / opptak
          </Link>
          <a href="#om-iqra">
            Om oss
          </a>
          <a href="#kontakt">
            Kontakt oss
          </a>
        </nav>
        <div className="header-actions">
          <a className="portal" href="https://portal.iqrasenter.no">
            Logg inn ↗
          </a>
          <a className="button" href="#stott-iqra">
            Støtt oss ↓
          </a>
        </div>
        <HomeMenu />
      </header>
    </div>
    <main id="main">
      <div className="hero-editorial">
        <section className="hero" aria-labelledby="hero-title">
          <div className="masthead enter">
            <Image src="/images/home/hero-children-editorial.webp" alt="Barn fra Iqra samles til piknik på gresset" width={1920} height={1440} sizes="(max-width: 700px) 100vw, 60vw" priority />
            <Image src="/images/home/winter-editorial.webp" alt="Iqras fellesskap på vintertur i skogen" width={1200} height={900} sizes="(max-width: 700px) 100vw, 60vw" />
          </div>
          <div className="story">
            <div className="story-copy enter delay">
              <p className="lede">
                Helgeskole, språk og aktiviteter for barn, unge og familier i Oslo.
              </p>
              <Link className="button" href="/bli-medlem">
                Bli medlem
                <span className="arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </div>
            <h1 id="hero-title" className="enter delay">
              Her vokser
              <br />
              vi sammen.
            </h1>
          </div>
          <div className="endnote enter delay-more">
            <p className="location">
              Et fellesskap på Ryen.
              <br />
              Ryenstubben 2, Oslo
            </p>
            <p>
              <span>
                Læring
              </span>
              <span>
                Kultur
              </span>
              <span>
                Vennskap
              </span>
            </p>
          </div>
        </section>
      </div>
      <Programmes />
      <div className="news-piece">
        <section className="section newsroom" id="nyheter" aria-labelledby="news-title">
          <div className="heading">
            <h2 id="news-title">
              Fra livet
              <br />
              på Iqra.
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
                Her hører
                <br />
                vi sammen.
              </h2>
              <p className="portrait-intro">
                Iqra er et lærings- og aktivitetssenter på Ryen i Oslo. Her møtes barn, unge og familier til kunnskap, kultur og felles opplevelser.
              </p>
              <p className="portrait-mission">
                Gjennom helgeskole, kurs og aktiviteter bygger vi et inkluderende fellesskap der mennesker med ulik bakgrunn kan lære og vokse sammen.
              </p>
              <p className="portrait-values">
                Felles røtter.
                <br />
                Nye perspektiver.
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
                Fellesskapet vårt begynner med menneskene.
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
              <br />
              På din måte.
            </h2>
            <p>
              En enkeltgave eller fast støtte. Bidra til et fellesskap med læring, aktiviteter og samvær for hele familien.
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
              <Image className="qr" src="/images/qr-stott-oss.png" width={182} height={182} alt="Iqras eksisterende QR-kode for Vipps 957045" unoptimized sizes="186px" />
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
              Et fellesskap
              <br />
              å vokse i.
            </h2>
            <p>
              Nye venner. Nye opplevelser. Et sted å lære og være sammen, midt i Oslo.
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
    <div className="finish b">
      <footer className="footer" id="kontakt">
        <div className="footer-grid">
          <div className="identity">
            <Link className="logo" href="/" aria-label="Iqra – hjem">
              <Image src="/images/logo-wide-light.webp" alt="Iqra Læring og Aktivitetssenter" width={1024} height={289} unoptimized sizes="186px" />
            </Link>
            <p>
              Et trygt fellesskap i Oslo
              <br />
              for hele familien.
            </p>
            <div className="social">
              <a href="https://www.instagram.com/iqrasenter">
                Instagram ↗
              </a>
              <a href="https://www.facebook.com/iqrasenter">
                Facebook ↗
              </a>
              <a href="https://wa.me/4799864331">
                WhatsApp ↗
              </a>
            </div>
          </div>
          <nav aria-label="Nyttige lenker">
            <h3>
              Finn frem
            </h3>
            <Link href="/sistenytt">
              Siste nytt
            </Link>
            <Link href="/nettbutikk">
              Nettbutikk
            </Link>
            <Link href="/bli-medlem">
              Bli medlem / opptak
            </Link>
            <Link href="/om-oss">
              Om oss
            </Link>
            <Link href="/kontakt">
              Kontakt oss
            </Link>
            <Link href="/foreldreavtale">
              Foreldreavtalen
            </Link>
          </nav>
          <div className="contact">
            <h3>
              Kom innom. Ta kontakt.
            </h3>
            <p>
              Ryenstubben 2
              <br />
              0679 Oslo
            </p>
            <a href="mailto:info@iqrasenter.net">
              info@iqrasenter.net
            </a>
            <a href="tel:+4799864331">
              +47 998 64 331
            </a>
          </div>
        </div>
        <div className="bottom">
          <p>
            © 2026 Iqra Læring og Aktivitetssenter
          </p>
          <a href="https://www.idweb.no">
            Nettsiden er laget av IDweb ↗
          </a>
        </div>
      </footer>
    </div>
    </div>
  );
}
