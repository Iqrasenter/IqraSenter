"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { TESTIMONIALS } from "@/lib/constants";

const AUTO_INTERVAL = 5000;

export function TestimonialCarousel() {
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = right, -1 = left
  const [paused, setPaused] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const goTo = useCallback(
    (index: number, dir: number) => {
      setDirection(dir);
      setActive(index);
    },
    []
  );

  const goNext = useCallback(() => {
    goTo((active + 1) % TESTIMONIALS.length, 1);
  }, [active, goTo]);

  const goPrev = useCallback(() => {
    goTo(
      (active - 1 + TESTIMONIALS.length) % TESTIMONIALS.length,
      -1
    );
  }, [active, goTo]);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(goNext, AUTO_INTERVAL);
    return () => clearInterval(timer);
  }, [goNext, paused, resetKey]);

  const t = TESTIMONIALS[active];

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Blockquote slide area */}
      <div className="relative min-h-[240px] sm:min-h-[300px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.blockquote
            key={active}
            custom={direction}
            initial={{ x: 50 * direction, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50 * direction, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="relative max-w-4xl mx-auto pl-8 before:absolute before:inset-y-0 before:left-0 before:w-1.5 before:rounded-full before:bg-primary"
          >
            <p className="text-lg sm:text-2xl md:text-3xl text-text leading-relaxed">
              &ldquo;{t.quote}&rdquo;
            </p>

            <footer className="mt-8 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">
                  {t.initials}
                </span>
              </div>
              <div className="flex items-center gap-2 text-base">
                <cite className="not-italic font-semibold text-text">
                  {t.name}
                </cite>
                <span
                  aria-hidden
                  className="bg-text/15 size-1.5 rounded-full"
                />
                <span className="text-text-muted">{t.age} år</span>
              </div>
            </footer>
          </motion.blockquote>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-6 mt-6 md:mt-10">
        <button
          onClick={() => { goPrev(); setResetKey((k) => k + 1); }}
          className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center hover:bg-accent text-accent hover:text-white transition-colors cursor-pointer shadow-sm btn-magnetic"
          aria-label="Forrige"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="flex gap-2">
          {TESTIMONIALS.map((_, i) => (
            <button
              key={i}
              onClick={() => { goTo(i, i > active ? 1 : -1); setResetKey((k) => k + 1); }}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${i === active
                ? "bg-primary w-8"
                : "bg-border w-2 hover:bg-text-muted"
                }`}
              aria-label={`Gå til tilbakemelding ${i + 1}`}
            />
          ))}
        </div>

        <button
          onClick={() => { goNext(); setResetKey((k) => k + 1); }}
          className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center hover:bg-accent text-accent hover:text-white transition-colors cursor-pointer shadow-sm btn-magnetic"
          aria-label="Neste"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
