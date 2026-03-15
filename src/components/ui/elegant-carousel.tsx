'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface SlideData {
  title: string;
  subtitle: string;
  description: string;
  accent: string;
  imageUrl: string;
}

const slides: SlideData[] = [
  {
    title: 'Venetian Dusk',
    subtitle: 'Autumn / Winter Collection',
    description:
      'Where ancient architecture meets the dying light — a palette drawn from terracotta, aged stone, and the shimmering canals of Venice at twilight.',
    accent: '#047857',
    imageUrl: '/images/hero-children.jpg',
  },
  {
    title: 'Nordic Silence',
    subtitle: 'Spring / Summer Collection',
    description:
      'Inspired by the vast stillness of Scandinavian fjords — clean lines, muted tones, and the quiet power of unadorned beauty.',
    accent: '#D97706',
    imageUrl: '/images/bok1.png',
  },
  {
    title: 'Kyoto Garden',
    subtitle: 'Resort Collection',
    description:
      'Moss-covered pathways and paper lanterns — an ode to the meditative elegance of Japanese garden design and its timeless restraint.',
    accent: '#8BA7B8',
    imageUrl: '/images/bok2.png',
  },
  {
    title: 'Saharan Gold',
    subtitle: 'Capsule Collection',
    description:
      'The desert reveals its secrets at dawn — liquid gold spilling across endless dunes, textures carved by centuries of wind and time.',
    accent: '#C4956A',
    imageUrl: '/images/hero-bg.jpg',
  },
];

export default function ElegantCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [, setDirection] = useState<'next' | 'prev'>('next');
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const SLIDE_DURATION = 6000;
  const TRANSITION_DURATION = 800;

  const goToSlide = useCallback(
    (index: number, dir?: 'next' | 'prev') => {
      if (isTransitioning || index === currentIndex) return;
      setDirection(dir || (index > currentIndex ? 'next' : 'prev'));
      setIsTransitioning(true);
      setProgress(0);

      setTimeout(() => {
        setCurrentIndex(index);
        setTimeout(() => {
          setIsTransitioning(false);
        }, 50);
      }, TRANSITION_DURATION / 2);
    },
    [isTransitioning, currentIndex]
  );

  const goNext = useCallback(() => {
    const nextIndex = (currentIndex + 1) % slides.length;
    goToSlide(nextIndex, 'next');
  }, [currentIndex, goToSlide]);

  const goPrev = useCallback(() => {
    const prevIndex = (currentIndex - 1 + slides.length) % slides.length;
    goToSlide(prevIndex, 'prev');
  }, [currentIndex, goToSlide]);

  useEffect(() => {
    if (isPaused) return;

    progressRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + 100 / (SLIDE_DURATION / 50);
      });
    }, 50);

    intervalRef.current = setInterval(() => {
      goNext();
    }, SLIDE_DURATION);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [currentIndex, isPaused, goNext]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 60) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  const currentSlide = slides[currentIndex];

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-white"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background accent wash */}
      <div
        className="absolute inset-0 transition-all duration-700 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 70% 50%, ${currentSlide.accent}18 0%, transparent 70%)`,
        }}
      />

      <div className="relative h-full flex flex-col lg:flex-row">
        {/* Left: Text Content */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12 order-2 lg:order-1">
          <div className="max-w-lg space-y-4">
            {/* Collection number */}
            <div
              className={`flex items-center gap-3 transition-all duration-500 ${
                isTransitioning
                  ? 'opacity-0 translate-y-3'
                  : 'opacity-100 translate-y-0'
              }`}
            >
              <span className="w-8 h-px bg-text-muted" />
              <span className="text-xs tracking-[0.15em] text-text-muted uppercase font-medium">
                {String(currentIndex + 1).padStart(2, '0')} /{' '}
                {String(slides.length).padStart(2, '0')}
              </span>
            </div>

            {/* Title */}
            <h2
              className={`font-heading text-3xl lg:text-5xl font-bold text-text leading-tight transition-all duration-500 delay-75 ${
                isTransitioning
                  ? 'opacity-0 translate-y-4'
                  : 'opacity-100 translate-y-0'
              }`}
            >
              {currentSlide.title}
            </h2>

            {/* Subtitle */}
            <p
              className={`text-sm uppercase tracking-[0.2em] font-semibold transition-all duration-500 delay-100 ${
                isTransitioning
                  ? 'opacity-0 translate-y-3'
                  : 'opacity-100 translate-y-0'
              }`}
              style={{ color: currentSlide.accent }}
            >
              {currentSlide.subtitle}
            </p>

            {/* Description */}
            <p
              className={`text-text-muted text-sm lg:text-base leading-relaxed transition-all duration-500 delay-150 ${
                isTransitioning
                  ? 'opacity-0 translate-y-3'
                  : 'opacity-100 translate-y-0'
              }`}
            >
              {currentSlide.description}
            </p>

            {/* Navigation Arrows */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={goPrev}
                className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-primary hover:text-white hover:border-primary transition-all duration-200 cursor-pointer"
                aria-label="Previous slide"
              >
                <ArrowLeft size={18} />
              </button>
              <button
                onClick={goNext}
                className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-primary hover:text-white hover:border-primary transition-all duration-200 cursor-pointer"
                aria-label="Next slide"
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Image */}
        <div className="flex-1 relative p-4 lg:p-8 order-1 lg:order-2 min-h-0">
          <div
            className={`relative w-full h-full rounded-2xl overflow-hidden transition-all duration-500 ${
              isTransitioning
                ? 'opacity-0 scale-95'
                : 'opacity-100 scale-100'
            }`}
          >
            <Image
              src={currentSlide.imageUrl}
              alt={currentSlide.title}
              fill
              className="object-cover"
              priority={currentIndex === 0}
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${currentSlide.accent}22 0%, transparent 50%)`,
              }}
            />
          </div>

          {/* Decorative frame corners */}
          <div
            className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 rounded-tl-sm pointer-events-none"
            style={{ borderColor: currentSlide.accent }}
          />
          <div
            className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 rounded-br-sm pointer-events-none"
            style={{ borderColor: currentSlide.accent }}
          />
        </div>
      </div>

      {/* Progress Indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 z-10">
        {slides.map((slide, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`flex flex-col items-center gap-1 cursor-pointer group ${
              index === currentIndex ? 'opacity-100' : 'opacity-50 hover:opacity-75'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          >
            <div className="w-16 h-0.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-100"
                style={{
                  width:
                    index === currentIndex
                      ? `${progress}%`
                      : index < currentIndex
                        ? '100%'
                        : '0%',
                  backgroundColor:
                    index === currentIndex ? currentSlide.accent : undefined,
                }}
              />
            </div>
            <span className="text-[10px] text-text-muted hidden sm:block">
              {slide.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
