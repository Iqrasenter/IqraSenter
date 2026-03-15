# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Iqra Senter landing page with a viewport-fit split hero, emerald glassmorphism service cards, removal of the teacher section, and a new Aktuelt articles section.

**Architecture:** Four independent UI changes to the homepage: Hero.tsx rewrite (split layout), EditorialFeatures.tsx restyle (glassmorphism), page.tsx surgery (remove teachers, add Aktuelt, update section wrappers). NewsCard component already exists and will be reused.

**Tech Stack:** Next.js 15, Tailwind CSS v4 (inline @theme), Framer Motion, GSAP, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-15-landing-page-redesign.md`

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `src/components/Hero.tsx` | Hero section — split layout, single image, viewport-fit | Rewrite |
| `src/components/EditorialFeatures.tsx` | Services section — emerald glassmorphism cards | Modify |
| `src/app/page.tsx` | Homepage assembly — section order, imports | Modify |
| `src/components/NewsCard.tsx` | Article card component | Minor modify (wrap in Link) |

---

## Chunk 1: Hero Rewrite

### Task 1: Rewrite Hero.tsx to split layout

**Files:**
- Modify: `src/components/Hero.tsx` (full rewrite, lines 1-127)

- [ ] **Step 1: Rewrite Hero.tsx with split layout**

Replace the entire contents of `src/components/Hero.tsx` with:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import gsap from 'gsap';
import { ArrowRight } from 'lucide-react';

export function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const ctx = gsap.context(() => {
        gsap.fromTo(
          '.hero-element',
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 1, stagger: 0.12, ease: 'power3.out', delay: 0.15 }
        );

        gsap.fromTo(
          '.hero-image',
          { scale: 0.92, opacity: 0 },
          { scale: 1, opacity: 1, duration: 1.2, ease: 'power2.out', delay: 0.5 }
        );
      }, containerRef);

      return () => ctx.revert();
    });

    return () => mm.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full min-h-[100svh] flex flex-col md:flex-row items-center justify-center bg-white pt-20 md:pt-24 px-4 sm:px-6 lg:px-8 gap-8 md:gap-12 lg:gap-16"
    >
      {/* Text side */}
      <div className="flex flex-col justify-center md:w-[55%] lg:w-[55%] max-w-2xl">
        <span className="hero-element inline-block text-xs tracking-[0.2em] uppercase text-text-muted font-medium font-body">
          Iqra Læring & Aktivitetssenter
        </span>

        <h1 className="hero-element font-heading font-[900] text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl text-text mt-5 leading-[1.05] tracking-tight">
          Læring for{' '}
          <em className="text-primary font-[300] not-italic">hele</em>
          <br />
          familien.
        </h1>

        <p className="hero-element text-text-body text-base md:text-lg max-w-xl mt-5 md:mt-6 leading-relaxed font-body">
          Et trygt fellesskap i Oslo der barn, unge og familier vokser sammen gjennom islamsk utdanning.
        </p>

        <div className="hero-element flex flex-wrap gap-3 md:gap-4 mt-8 md:mt-10">
          <Link
            href="/bli-medlem"
            className="group inline-flex items-center gap-2 px-7 py-3.5 bg-primary hover:bg-primary-dark text-white font-heading font-semibold rounded-full transition-all duration-300 shadow-md hover:shadow-lg btn-magnetic text-sm md:text-base"
          >
            <span>Bli medlem i dag</span>
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            href="/kontakt"
            className="inline-flex items-center gap-2 px-7 py-3.5 border-2 border-primary/25 hover:border-primary text-primary font-heading font-medium rounded-full transition-all duration-300 btn-magnetic text-sm md:text-base"
          >
            Kontakt oss
          </Link>
        </div>
      </div>

      {/* Image side */}
      <div className="hero-image md:w-[45%] lg:w-[45%] w-full max-h-[35vh] md:max-h-none md:h-[calc(100svh-6rem)] relative rounded-2xl md:rounded-3xl overflow-hidden">
        <Image
          src="/images/hero-children.jpg"
          alt="Barn og familier på utflukt med Iqra Senter"
          fill
          priority
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 45vw"
          quality={90}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the dev server builds without errors**

Run: `npm run dev` (or check existing dev server)
Expected: No build errors, page loads

- [ ] **Step 3: Visually verify hero fits in one viewport**

Check at desktop (1280px+) and mobile (375px) widths. The entire hero (text + image + buttons) should be visible without scrolling.

- [ ] **Step 4: Commit**

```bash
git add src/components/Hero.tsx
git commit -m "feat: rewrite hero to split layout with single image"
```

---

## Chunk 2: Emerald Glassmorphism Services

### Task 2: Restyle EditorialFeatures to glassmorphism

**Files:**
- Modify: `src/components/EditorialFeatures.tsx` (full restyle, lines 1-115)

- [ ] **Step 1: Rewrite EditorialFeatures.tsx with glassmorphism**

Replace the entire contents of `src/components/EditorialFeatures.tsx` with:

```tsx
'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SERVICES } from '@/lib/constants';

type ServiceTitle = (typeof SERVICES)[number]['title'];

const categoryMap: Record<ServiceTitle, string> = {
  Helgeskole: 'Utdanning',
  Fritidsaktiviteter: 'Aktiviteter',
  'Kurs og opplæring': 'Kurs',
};

const linkMap: Record<ServiceTitle, string> = {
  Helgeskole: '/om-oss',
  Fritidsaktiviteter: '/om-oss',
  'Kurs og opplæring': '/om-oss',
};

function EditorialRow({
  service,
  index,
  imageLeft,
}: {
  service: (typeof SERVICES)[number];
  index: number;
  imageLeft: boolean;
}) {
  return (
    <motion.div
      className="relative grid grid-cols-1 lg:grid-cols-2 items-stretch overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '20px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
      }}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: 'easeOut' }}
    >
      {/* Top-edge shimmer */}
      <div
        className="absolute top-0 left-[20%] right-[20%] h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(110,231,183,0.5), transparent)' }}
      />

      {/* Image */}
      <div
        className={`relative aspect-[4/3] lg:aspect-auto min-h-[200px] lg:min-h-[280px] ${
          imageLeft ? 'lg:order-1' : 'lg:order-2'
        }`}
      >
        <Image
          src={service.image}
          alt={service.title}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 50vw"
          quality={90}
        />
        {/* Gradient overlay fading into glass side */}
        <div
          className="absolute inset-0"
          style={{
            background: imageLeft
              ? 'linear-gradient(to right, transparent 60%, rgba(6,78,59,0.6))'
              : 'linear-gradient(to left, transparent 60%, rgba(6,78,59,0.6))',
          }}
        />
      </div>

      {/* Text content */}
      <div
        className={`flex flex-col gap-3 md:gap-4 p-6 sm:p-8 lg:p-10 justify-center ${
          imageLeft ? 'lg:order-2' : 'lg:order-1'
        }`}
      >
        <span className="inline-block w-fit px-3 py-1.5 rounded-full text-xs font-semibold font-body uppercase tracking-wider text-[#34D399]"
          style={{ background: 'rgba(52,211,153,0.15)' }}
        >
          {categoryMap[service.title]}
        </span>

        <h3 className="font-heading text-xl md:text-2xl lg:text-3xl font-bold text-white leading-tight">
          {service.title}
        </h3>

        <p className="leading-relaxed text-sm md:text-base lg:text-lg font-body" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {service.description}
        </p>

        <Link
          href={linkMap[service.title]}
          className="group inline-flex items-center gap-2 w-fit px-6 py-3 mt-1 text-white font-heading font-semibold rounded-full transition-all duration-300 btn-magnetic text-sm"
          style={{
            background: 'linear-gradient(135deg, #C8973E, #D4AD5A)',
            boxShadow: '0 4px 12px rgba(200,151,62,0.3)',
          }}
        >
          Les mer
          <ArrowRight
            size={16}
            className="transition-transform group-hover:translate-x-1"
          />
        </Link>
      </div>
    </motion.div>
  );
}

export function EditorialFeatures() {
  return (
    <div
      className="relative w-full overflow-hidden py-16 md:py-24 px-4 sm:px-6 lg:px-8"
      style={{ background: 'linear-gradient(160deg, #022c22 0%, #064E3B 40%, #0a3d2e 100%)' }}
    >
      {/* Glow orbs */}
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          top: '20%', left: '10%', width: '200px', height: '200px',
          background: 'radial-gradient(circle, rgba(16,185,129,0.25), transparent 70%)',
        }}
      />
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          bottom: '10%', right: '15%', width: '250px', height: '250px',
          background: 'radial-gradient(circle, rgba(52,211,153,0.15), transparent 70%)',
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl">
        {/* Section heading */}
        <div className="text-center mb-10 md:mb-14">
          <span
            className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold font-body uppercase tracking-wider mb-4 text-[#34D399]"
            style={{ background: 'rgba(52,211,153,0.2)' }}
          >
            Hva vi tilbyr
          </span>
          <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-[900] text-white">
            Våre <em className="not-italic" style={{ color: '#34D399' }}>Tjenester</em>
          </h2>
        </div>

        {/* Alternating rows */}
        <div className="space-y-6 md:space-y-8 lg:space-y-10">
          {SERVICES.map((service, index) => (
            <EditorialRow
              key={service.title}
              service={service}
              index={index}
              imageLeft={index % 2 === 0}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update services section wrapper in page.tsx**

In `src/app/page.tsx`, change the services section (line 36) from:

```tsx
<section id="tjenester" className="bg-white py-16 md:py-24">
  <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full">
    <EditorialFeatures />
  </div>
</section>
```

to:

```tsx
<section id="tjenester">
  <EditorialFeatures />
</section>
```

The component now owns its own background, padding, and max-width container.

- [ ] **Step 3: Verify build and visual output**

Run dev server. Check that:
- Dark emerald background fills the section
- Glass cards are visible with frosted effect
- Gold gradient CTA buttons render
- Glow orbs are subtly visible behind cards
- Alternating image left/right still works

- [ ] **Step 4: Commit**

```bash
git add src/components/EditorialFeatures.tsx src/app/page.tsx
git commit -m "feat: restyle services section with emerald glassmorphism"
```

---

## Chunk 3: Remove Teachers + Add Aktuelt + Final Page Assembly

### Task 3: Update page.tsx — remove teachers, add Aktuelt section

**Files:**
- Modify: `src/app/page.tsx` (lines 1-147)
- Modify: `src/components/NewsCard.tsx` (wrap in Link)

- [ ] **Step 1: Update NewsCard to accept an optional href and wrap in Link**

In `src/components/NewsCard.tsx`, add Link import and href prop. Replace entire file:

```tsx
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface NewsCardProps {
  title: string;
  excerpt: string;
  date: string;
  image: string;
  href?: string;
}

function formatDate(dateStr: string): string {
  const months = [
    "januar","februar","mars","april","mai","juni",
    "juli","august","september","oktober","november","desember",
  ];
  const d = new Date(dateStr);
  return `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function NewsCard({ title, excerpt, date, image, href = "/aktuelt" }: NewsCardProps) {
  return (
    <Link href={href} className="group">
      <article className="bg-card rounded-3xl overflow-hidden shadow-sm border border-border/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col h-full">
        {/* Image */}
        <div className="relative aspect-[3/2] overflow-hidden">
          <Image
            src={image}
            alt={title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            quality={90}
            sizes="(max-width: 768px) 100vw, 33vw"
          />
          <div className="absolute top-4 left-4">
            <span className="px-3 py-1 rounded-full bg-accent text-white text-xs font-bold shadow-md">
              Nyhet
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col flex-1">
          <time className="text-xs font-medium text-text-muted uppercase tracking-wider">
            {formatDate(date)}
          </time>
          <h3 className="mt-2 font-heading text-base font-bold text-text leading-snug group-hover:text-primary transition-colors duration-200 line-clamp-2">
            {title}
          </h3>
          <p className="mt-2 text-sm text-text-muted leading-relaxed line-clamp-3 flex-1">
            {excerpt}
          </p>
          <div className="mt-4 flex items-center gap-1 text-primary font-semibold text-sm">
            Les mer
            <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />
          </div>
        </div>
      </article>
    </Link>
  );
}
```

- [ ] **Step 2: Rewrite page.tsx — remove teachers, add Aktuelt, clean imports**

Replace the entire contents of `src/app/page.tsx`:

```tsx
'use client'

import { motion } from 'framer-motion'
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/Hero";

import { SectionHeading } from "@/components/SectionHeading";
import { EditorialFeatures } from "@/components/EditorialFeatures";
import AboutBentoGrid from "@/components/AboutBentoGrid";
import { TestimonialCarousel } from "@/components/TestimonialCarousel";
import { Footer } from "@/components/Footer";
import { NewsCard } from "@/components/NewsCard";

import { NEWS } from "@/lib/constants";

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

      {/* ===== OM OSS — BENTO GRID ===== */}
      <section id="om-oss" className="bg-bg-warm py-16 md:py-24">
        <AboutBentoGrid />
      </section>

      {/* ===== AKTUELT — LATEST ARTICLES ===== */}
      <section id="aktuelt" className="bg-bg py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            custom={0}
            viewport={{ once: true, amount: 0.3 }}
          >
            <SectionHeading
              title="Aktuelt"
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
              href="/aktuelt"
              className="inline-flex items-center gap-2 text-primary font-heading font-semibold hover:text-primary-light transition-colors duration-200"
            >
              Se alle nyheter
              <ArrowRight size={16} />
            </Link>
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
```

Key changes:
- Removed `AnimatedTestimonials` import
- Removed `TEACHERS` import
- Added `NewsCard` and `NEWS` imports
- Deleted entire `<section id="larere">` block
- Added `<section id="aktuelt">` with 3 NewsCards + "Se alle nyheter" link
- Simplified services section wrapper (no bg/padding — component owns it)

- [ ] **Step 3: Verify build and full page flow**

Run dev server. Check:
- Hero → Services → About → Aktuelt → Testimonials → CTA → Footer
- No teacher section visible
- 3 article cards render in Aktuelt section
- "Se alle nyheter" link points to `/aktuelt`
- No console errors

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/components/NewsCard.tsx
git commit -m "feat: remove teachers section, add Aktuelt articles to homepage"
```
