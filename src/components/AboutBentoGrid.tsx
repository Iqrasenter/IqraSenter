"use client";

import { motion, useSpring, useMotionValue, useInView } from "framer-motion";
import { useRef, useEffect } from "react";
import {
  Heart,
  BookOpen,
  Users,
  Sparkles,
  MapPin,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { STATS } from "@/lib/constants";

/* ─── animation variants ─── */
const container = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const card = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: "easeOut" as const },
  },
};

/* ─── animated stat number ─── */
function AnimatedStat({ value, label }: { value: string; label: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const num = parseInt(value);
  const suffix = value.replace(/\d+/, "");
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 50, damping: 20 });

  useEffect(() => {
    if (isInView) motionVal.set(num);
  }, [isInView, motionVal, num]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => {
      if (ref.current) ref.current.textContent = Math.round(v) + suffix;
    });
    return unsub;
  }, [spring, suffix]);

  return (
    <div className="flex flex-col items-center gap-0 md:gap-1 py-2 md:py-3 px-2">
      <span
        ref={ref}
        className="font-heading text-lg md:text-2xl lg:text-3xl font-extrabold gradient-text"
      >
        0{suffix}
      </span>
      <span className="text-[9px] md:text-[11px] lg:text-xs text-text-muted font-medium text-center leading-tight">
        {label}
      </span>
    </div>
  );
}

/* ─── core values ─── */
const coreValues = [
  { icon: Heart, label: "Fellesskap" },
  { icon: BookOpen, label: "Læring" },
  { icon: Users, label: "Inkludering" },
  { icon: Sparkles, label: "Glede" },
];

/* ═══════════════════════════════════════════ */
export default function AboutBentoGrid() {
  return (
    <motion.div
      className="flex flex-col gap-2 md:gap-3"
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
    >
      {/* ── TITLE CARD ── */}
      <motion.div
        variants={card}
        className="relative rounded-container bg-white overflow-hidden p-4 md:p-6 lg:p-8 flex flex-col justify-center card-pop"
      >
        <div className="pattern-islamic absolute inset-0 opacity-[0.02] pointer-events-none" />

        <h2 className="relative font-heading text-lg sm:text-xl lg:text-2xl font-bold gradient-text leading-tight">
          Mer enn en utdanningsinstitusjon
        </h2>

        <p className="relative mt-1 md:mt-3 text-text-muted text-[10px] md:text-sm lg:text-base leading-relaxed max-w-xl">
          Iqra Læring og Aktivitetssenter er et samlingspunkt for hele
          familien — der kunnskap, kultur og glede møtes i hjertet av Oslo.
        </p>

        <motion.div
          className="relative mt-3 md:mt-4 h-[3px] rounded-full bg-gradient-to-r from-primary via-primary-light to-accent/40"
          initial={{ width: "0%" }}
          whileInView={{ width: "60%" }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
        />
      </motion.div>

      {/* ── STATS CARD ── */}
      <motion.div
        variants={card}
        className="rounded-container bg-gradient-to-br from-white to-accent/[0.02] overflow-hidden card-pop"
      >
        <div className="flex items-center justify-around divide-x divide-primary/10 py-2 md:py-3">
          {STATS.map((s) => (
            <AnimatedStat key={s.label} value={s.value} label={s.label} />
          ))}
        </div>
      </motion.div>

      {/* ── MISSION + VALUES + LOCATION ── */}
      <motion.div
        variants={card}
        className="relative rounded-container bg-white overflow-hidden p-4 md:p-6 lg:p-8 flex flex-col justify-between card-pop"
      >
        <div className="pattern-islamic absolute inset-0 opacity-[0.02] pointer-events-none" />

        <blockquote className="relative border-l-4 border-primary pl-3 md:pl-4 py-1 italic text-text text-[10px] md:text-sm lg:text-[15px] leading-relaxed">
          &ldquo;Vårt mål er å bygge et sterkt, inkluderende fellesskap der
          alle føler seg velkomne — uansett bakgrunn og alder.&rdquo;
        </blockquote>

        {/* core values row — smaller icons */}
        <div className="relative flex items-center justify-around mt-3 md:mt-4 pt-2 md:pt-3 border-t border-primary/10">
          {coreValues.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-0.5">
              <Icon size={13} className="text-primary md:hidden" strokeWidth={1.8} />
              <Icon size={15} className="text-primary hidden md:block" strokeWidth={1.8} />
              <span className="text-[8px] md:text-[9px] lg:text-[10px] text-text-muted font-medium">
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* location + CTA */}
        <div className="relative flex items-center justify-between mt-2 md:mt-3 pt-2 md:pt-3 border-t border-primary/10">
          <div className="flex items-center gap-1.5 text-text-muted">
            <MapPin size={13} strokeWidth={2} />
            <span className="text-[10px] md:text-[11px] lg:text-xs">
              Ryenstubben 2, Oslo
            </span>
          </div>
          <Link
            href="/om-oss"
            className="inline-flex items-center gap-1 text-primary text-xs font-semibold
                       hover:gap-2 transition-all duration-200 cursor-pointer btn-magnetic"
          >
            Les mer
            <ArrowRight size={13} />
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
