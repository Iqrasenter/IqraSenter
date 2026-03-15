'use client'

import { useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/Hero";
import ScrollDots from "@/components/ScrollDots";
import { useScrollWriter } from "@/lib/scroll-context";

// Existing Components
import { SectionHeading } from "@/components/SectionHeading";
import { ServiceTabs } from "@/components/ServiceTabs";
import AboutBentoGrid from "@/components/AboutBentoGrid";
import { AnimatedTestimonials } from "@/components/ui/animated-testimonials";
import { TestimonialCarousel } from "@/components/TestimonialCarousel";
import { Footer } from "@/components/Footer";

import { TEACHERS } from "@/lib/constants";

export default function HomePage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<NodeJS.Timeout>(null)
  const { setActiveSection, setIsScrolling } = useScrollWriter()

  // Detect scroll start/stop on the snap container
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      setIsScrolling(true)

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }

      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false)
      }, 150)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [setIsScrolling])

  // Callback for ScrollDots to share active section with context
  const handleActiveChange = useCallback(
    (index: number) => setActiveSection(index),
    [setActiveSection]
  )

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
      <ScrollDots
        sectionIds={['hero', 'tjenester', 'om-oss', 'larere', 'testimonials', 'cta']}
        containerRef={containerRef}
        onActiveChange={handleActiveChange}
      />
      <div ref={containerRef} className="snap-container">

        {/* ===== HERO ===== */}
        <section id="hero" className="snap-section">
          <Hero />
        </section>

        {/* ===== SERVICES ===== */}
        <section id="tjenester" className="snap-section bg-gradient-to-b from-bg via-[#FDF8F3] to-bg pt-14 md:pt-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full flex flex-col h-full">
            <motion.div
              className="flex-1 min-h-0"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              custom={0}
              viewport={{ once: true, amount: 0.3 }}
            >
              <ServiceTabs />
            </motion.div>
          </div>
        </section>

        {/* ===== OM OSS — BENTO GRID ===== */}
        <section id="om-oss" className="snap-section bg-bg-warm pt-14 md:pt-20">
          <AboutBentoGrid />
        </section>

        {/* ===== TEACHERS ===== */}
        <section id="larere" className="snap-section bg-bg pt-14 md:pt-20 justify-center">
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
        <section id="testimonials" className="snap-section bg-bg-warm pt-14 md:pt-20 justify-center">
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
        <section id="cta" className="snap-section bg-primary-dark pt-14 md:pt-20" style={{ overflowY: 'auto' }}>
          <div className="relative flex-1 flex flex-col items-center justify-center overflow-hidden">
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
          <Footer />
        </section>

      </div>
    </>
  );
}
