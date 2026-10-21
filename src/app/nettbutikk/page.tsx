import type { Metadata } from "next";
import Image from "next/image";
import { PRODUCTS } from "@/lib/constants";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/SiteFooter";
import "@/components/home/home.css";
import "@/components/shop/shop.css";

export const metadata: Metadata = {
  title: "Nettbutikk",
  description: "Kjøp islamske barnebøker og læringsmateriell fra Iqra Læring og Aktivitetssenter. Vakre illustrasjoner og inspirerende fortellinger.",
  alternates: {
    canonical: "https://www.iqrasenter.net/nettbutikk",
  },
  openGraph: {
    title: "Nettbutikk - Iqra Senter",
    description: "Kjøp islamske barnebøker og læringsmateriell fra Iqra Læring og Aktivitetssenter.",
    url: "https://www.iqrasenter.net/nettbutikk",
  },
};

const VIPPS_LINK = "https://qr.vipps.no/vp/mSPWvQajp";
const VIPPS_NUMBER = "21490";

// The names printed on the covers, in the order of PRODUCTS, and what the covers show.
const COVERS = [
  { tile: "meadow", name: "Første bok", alt: "Omslaget til Første bok: fire barn hopper på en grønn eng" },
  { tile: "sky", name: "Andre bok", alt: "Omslaget til Andre bok: de samme barna på blå bakgrunn med konfetti" },
] as const;

const STEPS = ["Åpne Vipps og søk opp 21490.", "Skriv hvilken bok du vil ha.", "Skriv hvor du vil ha den levert."];

export default function NettbutikkPage() {
  const price = PRODUCTS[0].price;
  const samePrice = PRODUCTS.every((p) => p.price === price);

  return (
    <div className="iqra-home shop-page" id="top">
      <div className="shop-screen">
        <SiteHeader variant="page" current="Nettbutikk" />
        <main id="main">
          <div className="shop-top">
            <h1>{samePrice ? <>To barnebøker. {price}&nbsp;kr&nbsp;hver.</> : "To barnebøker."}</h1>
            <p>Tarbyah for barnetrinn elever, av Abdullahi Awil Ahmed.</p>
            <a className="shop-open" href={VIPPS_LINK}>
              Åpne i Vipps
              <span aria-hidden="true">↗</span>
            </a>
          </div>

          <div className="shop-row">
            {PRODUCTS.map((product, i) => {
              const cover = COVERS[i];
              if (!cover) return null;
              return (
                <article key={product.slug} className={`shop-tile ${cover.tile}`}>
                  <Image
                    className="shop-cover"
                    src={product.image}
                    alt={cover.alt}
                    width={800}
                    height={1135}
                    sizes="(max-width: 700px) 50vw, 26vw"
                    priority
                  />
                  <p className="shop-cap">
                    <strong>{cover.name}</strong>
                    <span>{product.price} kr</span>
                  </p>
                </article>
              );
            })}

            <section className="shop-tile shop-how deep" aria-labelledby="how-title">
              <h2 id="how-title">Slik bestiller du.</h2>
              <ol className="shop-steps">
                {STEPS.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <div className="shop-vipps">
                <Image
                  className="shop-qr"
                  src="/images/qr-nettbutikk.png"
                  alt="QR-kode som åpner Vipps-betalingen til Iqra"
                  width={150}
                  height={150}
                  unoptimized
                />
                <p className="shop-number">{VIPPS_NUMBER}</p>
              </div>
              <p className="shop-contact">
                <span>Lurer du på noe?</span>
                <a href="tel:+4799864331">+47 998 64 331</a>
                <a href="mailto:info@iqrasenter.net">info@iqrasenter.net</a>
              </p>
            </section>
          </div>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}
