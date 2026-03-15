'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import gsap from 'gsap';
import { ArrowRight } from 'lucide-react';
import { SITE } from '@/lib/constants';

export function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const ctx = gsap.context(() => {
        // Staggered sequential reveal for content
        gsap.fromTo(
          '.hero-element',
          { y: 40, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.2, stagger: 0.15, ease: 'power3.out', delay: 0.2 }
        );

        // Slow horizontal pan for the image and slight scale out
        gsap.fromTo(
          '.hero-bg-img',
          { scale: 1.1, x: '-2%' },
          { scale: 1, x: '0%', duration: 10, ease: 'power1.out' }
        );
      }, containerRef);

      return () => ctx.revert();
    });

    return () => mm.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[80dvh] md:h-[100dvh] bg-[var(--color-primary-dark)] flex flex-col justify-end overflow-hidden"
    >
      {/* Full-bleed background image */}
      <div className="absolute inset-0 -top-[80px] md:top-0 z-0 overflow-hidden">
        <Image
          src="/images/hero-children.jpg"
          alt={`Barn og familier på utflukt med ${SITE.shortName}`}
          fill
          priority
          quality={90}
          className="hero-bg-img object-cover object-bottom md:object-center opacity-100 transition-all duration-1000"
          sizes="100vw"
        />

        {/* Dynamic Heavy primary-to-black gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-primary-dark)]/60 via-[var(--color-primary-dark)]/20 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary-dark)]/40 via-transparent to-transparent z-10" />

        {/* Subtle glow using Accent color */}
        <div className="absolute top-1/4 right-0 w-[60vw] h-[60vw] bg-[var(--color-accent)]/10 rounded-full blur-[140px] pointer-events-none z-10 transform translate-x-1/4" />
        <div className="absolute bottom-1/4 left-0 w-[40vw] h-[40vw] bg-[var(--color-primary-light)]/10 rounded-full blur-[120px] pointer-events-none z-10 transform -translate-x-1/4" />
      </div>

      {/* Content wrapper - Bottom left third Layout */}
      <div className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 md:pb-24 flex flex-col items-start text-left">

        {/* Headline Pattern */}
        <h1 className="leading-[1.1] mb-6 max-w-5xl">
          <span className="hero-element block font-heading font-extrabold text-2xl sm:text-3xl md:text-5xl lg:text-6xl text-white tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] [text-shadow:_0_2px_4px_rgb(0_0_0_/_80%)]">
            Iqra Senter
          </span>
          <span className="hero-element block font-heading font-extrabold text-2xl sm:text-3xl md:text-5xl lg:text-6xl text-[var(--color-accent)] mt-1 tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] [text-shadow:_0_2px_10px_rgb(0_0_0_/_60%)]">
            Læring og aktivitet for hele familien.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="hero-element text-white text-sm sm:text-base md:text-xl font-body max-w-xl mb-6 md:mb-10 leading-relaxed font-medium drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)]">
          Et trygt fellesskap i Oslo der barn, unge og familier vokser sammen.
        </p>

        {/* CTAs */}
        <div className="hero-element flex flex-wrap gap-3 md:gap-4 items-center">
          <Link
            href="/bli-medlem"
            className="group relative inline-flex items-center gap-3 px-8 py-4 bg-[var(--color-accent)] text-white font-heading font-semibold rounded-full overflow-hidden transition-all duration-300 shadow-[0_4px_20px_rgba(204,88,51,0.4)] hover:shadow-[0_4px_30px_rgba(204,88,51,0.6)] btn-magnetic text-sm sm:text-base border border-[var(--color-accent-light)]/50"
          >
            <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
            <span className="relative z-10 flex items-center gap-2">
              Bli medlem i dag
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </span>
          </Link>

          <Link
            href="/kontakt"
            className="inline-flex items-center gap-3 px-8 py-4 bg-black/20 backdrop-blur-sm border border-white/30 hover:bg-black/40 text-white font-heading font-medium rounded-full transition-all duration-300 btn-magnetic text-sm sm:text-base"
          >
            Kontakt oss
          </Link>
        </div>
      </div>
    </div>
  );
}
