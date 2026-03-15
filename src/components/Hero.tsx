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
