import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { NewsReel } from "@/components/news/NewsReel";
import { itemDetails, itemFit, itemLink, itemPosition, newsSections, type NewsItem } from "@/components/news/sections";
import { newsDate, newsTitle } from "@/components/home/news";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/SiteFooter";
import { HomeMotion } from "@/components/home/HomeMotion";
import "@/components/home/home.css";
import "@/components/home/motion.css";
import "@/components/news/news.css";

export const metadata: Metadata = {
  title: "Siste Nytt",
  description: "Hold deg oppdatert med siste nyheter, arrangementer og aktiviteter fra Iqra Læring og Aktivitetssenter i Oslo.",
  alternates: {
    canonical: "https://www.iqrasenter.no/sistenytt",
  },
  openGraph: {
    title: "Siste Nytt hos Iqra Senter",
    description: "Hold deg oppdatert med siste nyheter, arrangementer og aktiviteter fra Iqra Læring og Aktivitetssenter i Oslo.",
    url: "https://www.iqrasenter.no/sistenytt",
  },
};

const REVEAL = ".news-reel, .news-block, .news-older h2, .news-card, .news-follow .inner > *";

function Block({ item }: { item: NewsItem }) {
  const details = itemDetails(item);
  const link = itemLink(item);
  const fit = itemFit(item);
  const picture = (
    <figure className={`news-pic ${fit}`}>
      <Image
        src={item.image}
        alt={details.length ? `Plakat: ${item.title}` : item.title}
        width={1200}
        height={900}
        sizes="(max-width: 1100px) 100vw, 50vw"
        style={fit === "cover" && itemPosition(item) ? { objectPosition: itemPosition(item) } : undefined}
      />
    </figure>
  );
  const text = (
    <div className="news-block-text">
      <h2>{newsTitle(item)}</h2>
      <time dateTime={item.date}>{newsDate(item)}</time>
      <p className="news-lead">{item.excerpt}</p>
      {details.length > 0 && (
        <ul>
          {details.map((d) => (
            <li key={d.text}>{d.text}</li>
          ))}
        </ul>
      )}
      {link && (
        <p>
          <Link className="news-arrow" href={link.href}>
            {link.label}
            <span aria-hidden="true">→</span>
          </Link>
        </p>
      )}
    </div>
  );
  // A story with facts is set text first, on green. A plainer story is set picture first, on sand.
  return details.length > 0 ? (
    <article className="news-block facts">
      {text}
      {picture}
    </article>
  ) : (
    <article className="news-block plain">
      {picture}
      {text}
    </article>
  );
}

export default function SisteNyttPage() {
  const { lead, blocks, archive } = newsSections();
  const photos = "gallery" in lead ? lead.gallery : [];

  return (
    <div className="iqra-home news-page" id="top">
      <HomeMotion targets={REVEAL} />
      <SiteHeader variant="page" />
      <main id="main">
        <section className="news-title">
          <h1>Siste nytt</h1>
          <p className="news-lead">Nyheter, arrangementer og små innblikk i fellesskapet vårt.</p>
        </section>

        {photos.length > 0 ? (
          <NewsReel title={newsTitle(lead)} dateIso={lead.date} dateLabel={newsDate(lead)} text={lead.excerpt} photos={photos} />
        ) : (
          <Block item={lead} />
        )}

        {blocks.map((item) => (
          <Block key={item.title} item={item} />
        ))}

        {archive.length > 0 && (
          <section className="news-older" aria-labelledby="older-title">
            <h2 id="older-title">Tidligere</h2>
            <div className="news-cards">
              {archive.map((item) => (
                <article className="news-card" key={item.title}>
                  <figure className={`news-pic ${itemFit(item)}`}>
                    <Image
                      src={item.image}
                      alt={item.title}
                      width={1200}
                      height={1500}
                      sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
                      style={itemFit(item) === "cover" && itemPosition(item) ? { objectPosition: itemPosition(item) } : undefined}
                    />
                  </figure>
                  <div className="news-card-text">
                    <h3>{newsTitle(item)}</h3>
                    <time dateTime={item.date}>{newsDate(item)}</time>
                    <p>{item.excerpt}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="news-follow">
          <div className="inner">
            <div>
              <h2>Følg med</h2>
              <p>Vi legger ut nye arrangementer og aktiviteter her og på sosiale medier.</p>
            </div>
            <div className="acts">
              <a className="news-button" href="https://www.instagram.com/iqrasenter">
                Følg oss på Instagram
                <span aria-hidden="true">↗</span>
              </a>
              <Link className="news-arrow" href="/kontakt">
                Kontakt oss
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
