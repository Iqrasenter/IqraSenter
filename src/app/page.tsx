'use client'

import { motion } from 'framer-motion'
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/Hero";

import { SectionHeading } from "@/components/SectionHeading";
import { EditorialFeatures } from "@/components/EditorialFeatures";
import AboutBentoGrid from "@/components/AboutBentoGrid";
import { TestimonialCard } from "@/components/ui/testimonial-card";
import { Footer } from "@/components/Footer";
import { NewsCard } from "@/components/NewsCard";

import { NEWS, TESTIMONIALS } from "@/lib/constants";

export default function HomePage() {
  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: (delay: number = 0) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut' as const, delay },
    }),
  }

  const latestNews = NEWS.slice(0, 3);

  return (
    <>
      {/* ===== HERO ===== */}
      <section id="hero">
        <Hero />
      </section>

      {/* ===== SERVICES ===== */}
      <section id="tjenester">
        <EditorialFeatures />
      </section>

      {/* ===== AKTUELT — LATEST ARTICLES ===== */}
      <section id="aktuelt" className="bg-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            custom={0}
            viewport={{ once: true, amount: 0.3 }}
          >
            <SectionHeading
              title="Siste"
              highlight="Nytt"
              subtitle="Nyheter og arrangementer"
            />
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mt-10 md:mt-14"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            custom={0.15}
            viewport={{ once: true, amount: 0.2 }}
          >
            {latestNews.map((item) => (
              <NewsCard
                key={item.title}
                title={item.title}
                excerpt={item.excerpt}
                date={item.date}
                image={item.image}
              />
            ))}
          </motion.div>

          <motion.div
            className="mt-8 md:mt-12 text-center"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            custom={0.25}
            viewport={{ once: true, amount: 0.3 }}
          >
            <Link
              href="/sistenytt"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-accent font-heading font-medium rounded-full transition-all duration-300 btn-magnetic text-sm border-2 border-accent/25 hover:border-accent"
            >
              Se siste nytt
              <ArrowRight size={16} />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ===== OM OSS — BENTO + TESTIMONIALS ===== */}
      <section id="om-oss" className="bg-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            custom={0}
            viewport={{ once: true, amount: 0.3 }}
          >
            <SectionHeading
              title="Om"
              highlight="Oss"
              subtitle="Hvem vi er og hva andre sier"
            />
          </motion.div>

          <div className="mt-10 md:mt-14 grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6 items-stretch">
            {/* Left — bento grid (60%) */}
            <div className="lg:col-span-3">
              <AboutBentoGrid />
            </div>

            {/* Right — testimonials stacked (40%) */}
            <motion.div
              className="lg:col-span-2 flex flex-col gap-3"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.12 } },
              }}
            >
              {TESTIMONIALS.map((t) => (
                <motion.div
                  key={t.name}
                  className="flex-1 flex"
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.4, ease: "easeOut" },
                    },
                  }}
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
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== CTA BANNER & FOOTER ===== */}
      <section id="cta" className="bg-white py-20 md:py-28">
        <div className="flex flex-col items-center justify-center">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
            <motion.h2
              className="font-drama italic text-3xl md:text-4xl lg:text-5xl text-text leading-tight"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              custom={0.1}
              viewport={{ once: true, amount: 0.3 }}
            >
              Fokuser på det viktigste. <span className="text-primary">Bli med i Iqra i dag.</span>
            </motion.h2>

            <motion.p
              className="mt-4 md:mt-8 text-sm md:text-2xl text-text-muted max-w-2xl mx-auto font-body"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              custom={0.2}
              viewport={{ once: true, amount: 0.3 }}
            >
              Læring, mestring og moro — sammen. Meld deg inn i dag og gi familien din et fellesskap som varer.
            </motion.p>

            <motion.div
              className="mt-8 md:mt-14 flex flex-col sm:flex-row gap-4 md:gap-5 justify-center"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              custom={0.3}
              viewport={{ once: true, amount: 0.3 }}
            >
              <Link
                href="/bli-medlem"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 md:px-8 md:py-4 bg-primary hover:bg-primary-light text-white font-bold rounded-container transition-all duration-300 shadow-xl btn-magnetic text-sm md:text-base"
              >
                Bli medlem
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/kontakt"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 md:px-8 md:py-4 bg-white hover:border-accent text-accent font-heading font-medium rounded-full transition-all duration-300 btn-magnetic text-sm md:text-base border-2 border-accent/25"
              >
                Kontakt oss
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
