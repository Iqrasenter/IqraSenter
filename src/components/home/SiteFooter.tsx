import Image from "next/image";
import Link from "next/link";

// The footer shared by the homepage and the pages that use the new header.
export function SiteFooter() {
  return (
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
  );
}
