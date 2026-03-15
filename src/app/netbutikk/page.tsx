import type { Metadata } from "next";
import { PRODUCTS } from "@/lib/constants";
import { EditorialPageHeader } from "@/components/EditorialPageHeader";
import { FadeIn } from "@/components/FadeIn";
import { ProductCard } from "@/components/ProductCard";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Nettbutikk",
  description: "Kjøp islamske barnebøker og læringsmateriell fra Iqra Læring og Aktivitetssenter. Vakre illustrasjoner og inspirerende fortellinger.",
  openGraph: {
    title: "Nettbutikk - Iqra Senter",
    description: "Kjøp islamske barnebøker og læringsmateriell fra Iqra Læring og Aktivitetssenter.",
    url: "https://www.iqrasenter.net/netbutikk",
  }
};

export default function NetbutikkPage() {
  return (
    <>
      <EditorialPageHeader
        label="Netbutikk"
        title="Vår nettbutikk"
        subtitle="Utforsk vårt utvalg av islamske barnebøker — vakre illustrasjoner og inspirerende fortellinger for de minste."
      />

      <section className="py-12 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Books grid */}
            <div className="grid grid-cols-2 gap-8">
              {PRODUCTS.map((product, index) => (
                <FadeIn key={product.slug} delay={index * 0.1}>
                  <ProductCard product={product} />
                </FadeIn>
              ))}
            </div>

            {/* Vipps "how to buy" — full width, 2x2 step grid */}
            <FadeIn delay={0.2}>
              <div className="rounded-2xl border border-border/50 p-6 md:p-8">
                <h3 className="font-heading text-lg font-bold text-text mb-5">
                  Slik bestiller du
                </h3>
                <ol className="grid grid-cols-2 gap-4 text-sm text-text-muted list-none">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                    <span>Gå til <span className="font-semibold text-accent">Vipps-appen</span></span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                    <span>Søk opp Vipps-nummer <span className="font-data font-bold text-accent">21490</span></span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                    <span>Velg hvilken bok du ønsker</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center mt-0.5">4</span>
                    <span>Skriv i teksten <span className="font-semibold text-text">stedet du vil ha den sendt til</span></span>
                  </li>
                </ol>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
