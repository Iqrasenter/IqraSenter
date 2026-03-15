'use client'

import { motion } from 'framer-motion'
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/Hero";

// Existing Components
import { SectionHeading } from "@/components/SectionHeading";
import { EditorialFeatures } from "@/components/EditorialFeatures";
import AboutBentoGrid from "@/components/AboutBentoGrid";
import { AnimatedTestimonials } from "@/components/ui/animated-testimonials";
import { TestimonialCarousel } from "@/components/TestimonialCarousel";
import { Footer } from "@/components/Footer";

import { TEACHERS } from "@/lib/constants";

export default function HomePage() {
  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: (delay: number = 0) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut' as const, delay },
    }),
  }

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

      {/* ===== OM OSS — BENTO GRID ===== */}
      <section id="om-oss" className="bg-bg-warm py-16 md:py-24">
        <AboutBentoGrid />
      </section>

      {/* ===== TEACHERS ===== */}
      <section id="larere" className="bg-bg py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            custom={0}
            viewport={{ once: true, amount: 0.3 }}
          >
            <SectionHeading
              title="Våre Lærere"
            />
          </motion.div>
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            custom={0.15}
            viewport={{ once: true, amount: 0.3 }}
          >
            <AnimatedTestimonials testimonials={TEACHERS as unknown as { quote: string; name: string; designation: string; src: string }[]} autoplay />
          </motion.div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section id="testimonials" className="bg-bg-warm py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            custom={0.15}
            viewport={{ once: true, amount: 0.3 }}
          >
            <TestimonialCarousel />
          </motion.div>
        </div>
      </section>

      {/* ===== CTA BANNER & FOOTER ===== */}
      <section id="cta" className="bg-primary-dark py-20 md:py-28">
        <div className="relative flex flex-col items-center justify-center overflow-hidden">
          <div className="absolute inset-0 pattern-islamic opacity-20" />

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent/10 blur-[120px] rounded-full pointer-events-none" />

          <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
            <motion.h2
              className="font-drama italic text-3xl md:text-4xl lg:text-5xl text-white leading-tight"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              custom={0.1}
              viewport={{ once: true, amount: 0.3 }}
            >
              Fokuser på det viktigste. <span className="text-accent">Bli med i Iqra i dag.</span>
            </motion.h2>

            <motion.p
              className="mt-4 md:mt-8 text-sm md:text-2xl text-white/70 max-w-2xl mx-auto font-body"
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
                className="inline-flex items-center justify-center gap-2 px-6 py-3 md:px-8 md:py-4 bg-accent hover:bg-accent-light text-white font-bold rounded-container transition-all duration-300 shadow-xl btn-magnetic text-sm md:text-base"
              >
                Bli medlem
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/kontakt"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 md:px-8 md:py-4 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-container backdrop-blur-sm transition-all duration-300 btn-magnetic text-sm md:text-base border border-white/10"
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
