import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PRODUCTS } from "@/lib/constants";
import { FadeIn } from "@/components/FadeIn";
import { Footer } from "@/components/Footer";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = PRODUCTS.find((p) => p.slug === slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.description,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = PRODUCTS.find((p) => p.slug === slug);
  if (!product) notFound();

  return (
    <>
      <section className="pt-28 pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Back link */}
          <FadeIn>
            <Link
              href="/netbutikk"
              className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-primary transition-colors mb-8 cursor-pointer"
            >
              <ArrowLeft size={16} />
              Tilbake til nettbutikken
            </Link>
          </FadeIn>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
            {/* Image */}
            <FadeIn>
              <div className="relative aspect-square bg-white rounded-2xl border border-border/50 p-8">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-contain p-8"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />
              </div>
            </FadeIn>

            {/* Info */}
            <FadeIn delay={0.1}>
              <div className="flex flex-col justify-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                  Barnebok
                </span>
                <h1 className="mt-3 font-heading text-3xl lg:text-4xl font-bold text-text">
                  {product.name}
                </h1>
                <p className="mt-4 text-lg text-text-muted leading-relaxed">
                  {product.description}
                </p>
                <p className="mt-6 font-data text-3xl font-bold text-accent">
                  {product.price} kr
                </p>

                {/* Vipps info box */}
                <div className="mt-8 rounded-2xl border border-accent/20 bg-accent/5 p-6">
                  <h3 className="font-heading text-base font-bold text-text mb-3">
                    Bestill via Vipps
                  </h3>
                  <ol className="space-y-2 text-sm text-text-muted list-none">
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
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
