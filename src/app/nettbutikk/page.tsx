import type { Metadata } from "next";
import { PRODUCTS } from "@/lib/constants";
import { EditorialPageHeader } from "@/components/EditorialPageHeader";
import { FadeIn } from "@/components/FadeIn";
import { ProductCard } from "@/components/ProductCard";
import { Footer } from "@/components/Footer";
import { NettbutikkVippsAction } from "@/components/NettbutikkQRToggle";

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
  }
};

const STEPS = [
  {
    number: "1",
    title: "Finn oss i Vipps",
    description: (
      <>
        Åpne <span className="font-semibold text-accent">Vipps-appen</span> og søk opp nummer{" "}
        <span className="font-data font-bold text-accent">21490</span>
      </>
    ),
  },
  {
    number: "2",
    title: "Velg bok",
    description: "Skriv hvilken bok du ønsker å bestille",
  },
  {
    number: "3",
    title: "Oppgi leveringssted",
    description: (
      <>
        Skriv i meldingsfeltet <span className="font-semibold text-text">hvor du vil ha den levert</span>
      </>
    ),
  },
];

export default function NetbutikkPage() {
  return (
    <>
      <EditorialPageHeader
        label=""
        title="Vår"
        highlight="nettbutikk"
        subtitle="Utforsk vårt utvalg av islamske barnebøker — vakre illustrasjoner og inspirerende fortellinger for de minste."
      />

      <section className="py-12 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto space-y-10">
            {/* Books grid */}
            <div className="grid grid-cols-2 gap-8">
              {PRODUCTS.map((product, index) => (
                <FadeIn key={product.slug} delay={index * 0.1}>
                  <ProductCard product={product} />
                </FadeIn>
              ))}
            </div>

            {/* Redesigned Vipps ordering section */}
            <FadeIn delay={0.2}>
              <div className="rounded-2xl border border-border/50 bg-white p-6 md:p-10">
                <h3 className="font-heading text-xl md:text-2xl font-bold text-text mb-2 text-center">
                  Slik bestiller du
                </h3>
                <p className="text-sm text-text-muted text-center mb-8 max-w-md mx-auto">
                  Tre enkle steg via Vipps — raskt og trygt
                </p>

                {/* Steps — vertical on mobile, horizontal on desktop */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                  {STEPS.map((step) => (
                    <div key={step.number} className="flex md:flex-col items-start md:items-center gap-4 md:gap-3 text-left md:text-center">
                      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-accent text-white text-sm font-bold flex items-center justify-center">
                        {step.number}
                      </span>

                      <div>
                        <h4 className="font-heading font-bold text-text text-sm mb-1">
                          {step.title}
                        </h4>
                        <p className="text-sm text-text-muted leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* QR (desktop) / Vipps link (mobile) */}
                <NettbutikkVippsAction />
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
