import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/Hero";
import { AnnouncementMarquee } from "@/components/AnnouncementMarquee";

import { SectionHeading } from "@/components/SectionHeading";
import { TestimonialCard } from "@/components/ui/testimonial-card";
import { Footer } from "@/components/Footer";
import { NewsCard } from "@/components/NewsCard";
import { FadeIn } from "@/components/FadeIn";
import { SupportSection } from "@/components/SupportSection";

const EditorialFeatures = dynamic(
  () =>
    import("@/components/EditorialFeatures").then((m) => m.EditorialFeatures),
  { ssr: true }
);

const AboutBentoGrid = dynamic(
  () => import("@/components/AboutBentoGrid"),
  { ssr: true }
);

import { NEWS, TESTIMONIALS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Iqra Læring og Aktivitetssenter — Læring for hele familien",
  description:
    "Et trygt og inkluderende fellesskap med læring, fritidsaktiviteter og sosialt samvær for barn, unge og familier i Oslo.",
  alternates: {
    canonical: "https://www.iqrasenter.net",
  },
};

export default function HomePage() {
  const latestNews = NEWS.slice(0, 3);

  return (
    <>
      {/* ===== ANNOUNCEMENT BANNER ===== */}
      <AnnouncementMarquee />

      {/* ===== HERO ===== */}
      <section id="hero">
        <Hero />
      </section>

      {/* ===== SERVICES ===== */}
      <section id="tjenester">
        <EditorialFeatures />
      </section>

      {/* ===== AKTUELT — LATEST ARTICLES ===== */}
      <section id="aktuelt" className="bg-white py-10 md:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full">
          <FadeIn>
            <SectionHeading
              title="Siste"
              highlight="Nytt"
              subtitle="Nyheter og arrangementer"
            />
          </FadeIn>

          <FadeIn delay={0.1}>
            <p className="mt-3 text-sm text-text-muted">
              Nye elever med opptak:{" "}
              <Link
                href="/foreldreavtale"
                className="text-accent font-medium underline underline-offset-4 hover:text-accent-light transition-colors"
              >
                les foreldreavtalen
              </Link>
              <span aria-hidden> →</span>
            </p>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mt-8 md:mt-10">
              {latestNews.map((item) => (
                <NewsCard
                  key={item.title}
                  title={item.title}
                  excerpt={item.excerpt}
                  date={item.date}
                  image={item.image}
                  imagePosition={"imagePosition" in item ? (item.imagePosition as string) : undefined}
                />
              ))}
            </div>
          </FadeIn>

          <FadeIn delay={0.25}>
            <div className="mt-6 md:mt-8 text-center">
              <Link
                href="/sistenytt"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-accent font-heading font-medium rounded-full transition-[border-color] duration-300 btn-magnetic text-sm border-2 border-accent/25 hover:border-accent"
              >
                Se siste nytt
                <ArrowRight size={16} />
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ===== OM OSS — BENTO + TESTIMONIALS ===== */}
      <section id="om-oss" className="bg-white py-10 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <SectionHeading
              title="Om"
              highlight="Oss"
              subtitle="Hvem vi er og hva andre sier"
            />
          </FadeIn>

          <div className="mt-8 md:mt-14 grid grid-cols-1 lg:grid-cols-5 gap-3 md:gap-6 items-stretch">
            {/* Left — bento grid (60%) */}
            <div className="lg:col-span-3">
              <AboutBentoGrid />
            </div>

            {/* Right — testimonials: horizontal scroll on mobile, stacked on desktop */}
            <FadeIn delay={0.1} className="lg:col-span-2">
              <div className="flex flex-row lg:flex-col gap-3 overflow-x-auto lg:overflow-x-visible snap-x snap-mandatory no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 pb-2 lg:pb-0">
                {TESTIMONIALS.map((t) => (
                  <div
                    key={t.name}
                    className="min-w-[280px] max-w-[85vw] lg:min-w-0 lg:max-w-none flex-shrink-0 lg:flex-shrink lg:flex-1 flex snap-start"
                  >
                    <TestimonialCard
                      author={{
                        name: t.name,
                        handle: `${t.age} år`,
                        initials: t.initials,
                      }}
                      text={t.quote}
                      className="!max-w-none w-full"
                    />
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ===== STØTT OSS ===== */}
      <SupportSection />

      {/* ===== CTA BANNER & FOOTER ===== */}
      <section id="cta" className="bg-white py-20 md:py-28">
        <div className="flex flex-col items-center justify-center">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
            <FadeIn>
              <h2 className="font-drama italic text-3xl md:text-4xl lg:text-5xl text-text leading-tight">
                Fokuser på det viktigste.{" "}
                <span className="text-primary">Bli med i Iqra i dag.</span>
              </h2>
            </FadeIn>

            <FadeIn delay={0.1}>
              <p className="mt-4 md:mt-8 text-sm md:text-2xl text-text-muted max-w-2xl mx-auto font-body">
                Læring, mestring og moro — sammen. Meld deg inn i dag og gi
                familien din et fellesskap som varer.
              </p>
            </FadeIn>

            <FadeIn delay={0.2}>
              <div className="mt-8 md:mt-14 flex flex-col sm:flex-row gap-4 md:gap-5 justify-center">
                <Link
                  href="/bli-medlem"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 md:px-8 md:py-4 bg-primary hover:bg-primary-light text-white font-bold rounded-container transition-[background-color,box-shadow] duration-300 shadow-xl btn-magnetic text-sm md:text-base"
                >
                  Bli medlem
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href="/kontakt"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 md:px-8 md:py-4 bg-white hover:border-accent text-accent font-heading font-medium rounded-full transition-[border-color] duration-300 btn-magnetic text-sm md:text-base border-2 border-accent/25"
                >
                  Kontakt oss
                </Link>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
