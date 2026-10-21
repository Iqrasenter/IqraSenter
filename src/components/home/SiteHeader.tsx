import Image from "next/image";
import Link from "next/link";
import { HomeMenu, type MenuLink } from "./HomeMenu";
import "./chrome.css";

// "home": the homepage, where the logo sits on a photograph.
// "page": every other page that uses this header, where the links go to their own pages.
// "dark": a page on a deep green field (Kontakt oss, Støtt oss): page links, with the light logo.
type Variant = "home" | "page" | "dark";

const PORTAL = "https://portal.iqrasenter.no";

// "current" names the nav link of the page being shown (page variant only). Siste nytt was the
// first page to use this header, so it stays the default.
export function headerLinks(variant: Variant, current = "Siste nytt"): { nav: MenuLink[]; portal: MenuLink; support: MenuLink } {
  const home = variant === "home";
  const here = (label: string) => !home && current === label;
  return {
    nav: [
      { href: "/sistenytt", label: "Siste nytt", current: here("Siste nytt") },
      { href: "/nettbutikk", label: "Nettbutikk", current: here("Nettbutikk") },
      { href: "/bli-medlem", label: "Bli medlem / opptak", current: here("Bli medlem / opptak") },
      { href: "/om-oss", label: "Om oss", current: here("Om oss") },
      { href: "/kontakt", label: "Kontakt oss" },
    ],
    portal: { href: PORTAL, label: "Logg inn ↗" },
    support: { href: "/stott-oss", label: "Støtt oss →", current: here("Støtt oss") },
  };
}

function NavItem({ link, className }: { link: MenuLink; className?: string }) {
  const plain = link.href.startsWith("#") || link.href.startsWith("http");
  const props = { className, "aria-current": link.current ? ("page" as const) : undefined };
  return plain ? (
    <a href={link.href} {...props}>
      {link.label}
    </a>
  ) : (
    <Link href={link.href} {...props}>
      {link.label}
    </Link>
  );
}

export function SiteHeader({ variant, current }: { variant: Variant; current?: string }) {
  const { nav, portal, support } = headerLinks(variant, current);
  const home = variant === "home";
  const logo = (
    <Image
      src={variant === "page" ? "/images/logo-wide.webp" : "/images/logo-wide-light.webp"}
      alt="Iqra Læring og Aktivitetssenter"
      width={1024}
      height={289}
      unoptimized
      sizes="186px"
    />
  );
  return (
    <div className={`finish a ${home ? "is-home" : "is-page"}${variant === "dark" ? " on-dark" : ""}`}>
      {/* Only the homepage carries the parents' agreement notice; most families have already signed. */}
      {home && (
        <aside className="announcement">
          <Link href="/foreldreavtale">
            <span>Til foreldre og foresatte av nye elever</span>
            <strong>Les og bekreft foreldreavtalen →</strong>
          </Link>
        </aside>
      )}
      <header className="header">
        {home ? (
          <a className="logo" href="#top" aria-label="Iqra – hjem">
            {logo}
          </a>
        ) : (
          <Link className="logo" href="/" aria-label="Iqra – hjem">
            {logo}
          </Link>
        )}
        <nav className="desktop-nav" aria-label="Hovedmeny">
          {nav.map((link) => (
            <NavItem key={link.label} link={link} />
          ))}
        </nav>
        <div className="header-actions">
          <NavItem link={portal} className="portal" />
          <NavItem link={support} className="button" />
        </div>
        <HomeMenu links={[...nav, portal, support]} />
      </header>
    </div>
  );
}
