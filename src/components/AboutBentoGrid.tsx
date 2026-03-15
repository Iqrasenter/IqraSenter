"use client";

import { motion, useSpring, useMotionValue, useInView } from "framer-motion";
import { useRef, useEffect } from "react";
import {
  Landmark,
  Heart,
  Globe,
  BookOpen,
  Users,
  Sparkles,
  MapPin,
  ArrowRight,
  Check,
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
    <div className="flex flex-col items-center gap-0 md:gap-1 py-0.5 md:py-3 px-0.5 md:px-2">
      <span
        ref={ref}
        className="font-heading text-sm md:text-2xl lg:text-3xl font-extrabold gradient-text"
      >
        0{suffix}
      </span>
      <span className="text-[7px] md:text-[11px] lg:text-xs text-text-muted font-medium text-center leading-tight">
        {label}
      </span>
    </div>
  );
}

/* ─── value pillar cards ─── */
const pillars = [
  { icon: Landmark, label: "Islamsk miljø", desc: "Trygt og verdibasert" },
  { icon: Heart, label: "Familievennlig", desc: "For hele familien" },
  { icon: Globe, label: "Inkluderende", desc: "Alle er velkomne" },
] as const;

const coreValues = [
  { icon: Heart, label: "Fellesskap" },
  { icon: BookOpen, label: "Læring" },
  { icon: Users, label: "Inkludering" },
  { icon: Sparkles, label: "Glede" },
];

/* ═══════════════════════════════════════════ */
export default function AboutBentoGrid() {
  return (
    <div className="relative h-full flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
      {/* ambient glow orbs */}
      <div className="pointer-events-none absolute -top-20 -left-20 w-[400px] h-[400px] rounded-full bg-primary/[0.03] blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-10 -right-10 w-[300px] h-[300px] rounded-full bg-accent/[0.03] blur-[80px]" />

      <motion.div
        className="relative mx-auto w-full max-w-7xl grid grid-cols-1 md:grid-cols-5 md:grid-rows-2 gap-2 md:gap-3 flex-1 min-h-0"
        variants={container}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        {/* ── [1] TITLE CARD  (col 1-3, row 1) ── */}
        <motion.div
          variants={card}
          className="relative md:col-span-3 md:row-span-1 rounded-container border border-primary/10
                     bg-white overflow-hidden p-4 md:p-6 lg:p-10 flex flex-col justify-center
                     transition-all duration-300
                     hover:border-primary/30 hover:shadow-xl"
        >
          {/* islamic pattern overlay */}
          <div className="pattern-islamic absolute inset-0 opacity-[0.02] pointer-events-none" />

          <span className="relative inline-block self-start mb-2 md:mb-3 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide">
            Om oss
          </span>

          <h2 className="relative font-heading text-base md:text-2xl lg:text-3xl xl:text-4xl font-bold gradient-text leading-tight">
            Mer enn en utdanningsinstitusjon
          </h2>

          <p className="relative mt-1 md:mt-3 text-text-muted text-[10px] md:text-sm lg:text-base leading-relaxed max-w-xl">
            Iqra Læring og Aktivitetssenter er et samlingspunkt for hele
            familien — der kunnskap, kultur og glede møtes i hjertet av Oslo.
          </p>

          {/* animated gradient underline */}
          <motion.div
            className="relative mt-3 md:mt-4 h-[3px] rounded-full bg-gradient-to-r from-primary via-primary-light to-accent/40"
            initial={{ width: "0%" }}
            whileInView={{ width: "60%" }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
          />
        </motion.div>

        {/* ── [4] STATS CARD  (col 4-5, row 1) ── */}
        <motion.div
          variants={card}
          className="md:col-span-2 md:row-span-1 rounded-container border border-primary/10
                     bg-gradient-to-br from-white to-accent/[0.02] overflow-hidden
                     flex flex-col justify-center
                     transition-all duration-300
                     hover:border-primary/30 hover:shadow-xl"
        >
          {/* Mobile: single compact row */}
          <div className="flex items-center justify-around divide-x divide-primary/10 md:hidden py-1">
            {STATS.map((s) => (
              <AnimatedStat key={s.label} value={s.value} label={s.label} />
            ))}
          </div>
          {/* Desktop: 2x2 grid */}
          <div className="hidden md:grid grid-cols-2 divide-x divide-primary/10">
            <div className="grid grid-rows-2 divide-y divide-primary/10">
              {STATS.slice(0, 2).map((s) => (
                <AnimatedStat key={s.label} value={s.value} label={s.label} />
              ))}
            </div>
            <div className="grid grid-rows-2 divide-y divide-primary/10">
              {STATS.slice(2, 4).map((s) => (
                <AnimatedStat key={s.label} value={s.value} label={s.label} />
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── [2a–2c] VALUE PILLAR CARDS  (3 in a row on mobile, columns on md) ── */}
        <div className="grid grid-cols-3 gap-2 md:contents">
          {pillars.map(({ icon: Icon, label, desc }) => (
            <motion.div
              key={label}
              variants={card}
              className="group md:col-span-1 md:row-span-1 rounded-container border border-primary/10
                         bg-white overflow-hidden
                         flex flex-col items-center justify-center gap-1.5 md:gap-3 p-3 md:p-5 lg:p-8 text-center
                         cursor-default transition-all duration-300
                         hover:border-primary/30 hover:shadow-xl btn-magnetic"
            >
              {/* icon container */}
              <div
                className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5
                            flex items-center justify-center
                            transition-transform duration-300 group-hover:-translate-y-1"
              >
                <Icon size={20} className="text-primary md:hidden" strokeWidth={1.6} />
                <Icon size={28} className="text-primary hidden md:block" strokeWidth={1.6} />
              </div>

              <div>
                <h3 className="font-heading text-xs md:text-sm lg:text-base font-bold text-text">
                  {label}
                </h3>
                <p className="text-[9px] md:text-[11px] lg:text-xs text-text-muted mt-0.5 hidden md:block">
                  {desc}
                </p>
              </div>

              {/* checkmark badge — hidden on mobile */}
              <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/8 text-primary text-[10px] font-semibold">
                <Check size={10} strokeWidth={2.5} />
                Verifisert
              </span>
            </motion.div>
          ))}
        </div>

        {/* ── [3] MISSION + VALUES + LOCATION  (col 4-5, row 2) ── */}
        <motion.div
          variants={card}
          className="relative md:col-span-2 md:row-span-1 rounded-container border border-primary/10
                     glass overflow-hidden p-4 md:p-6 lg:p-8 flex flex-col justify-between
                     transition-all duration-300
                     hover:border-primary/30 hover:shadow-xl"
        >
          <div className="pattern-islamic absolute inset-0 opacity-[0.02] pointer-events-none" />

          {/* blockquote */}
          <blockquote className="relative border-l-4 border-primary pl-3 md:pl-4 py-1 italic text-text text-[10px] md:text-sm lg:text-[15px] leading-relaxed">
            &ldquo;Vårt mål er å bygge et sterkt, inkluderende fellesskap der
            alle føler seg velkomne — uansett bakgrunn og alder.&rdquo;
          </blockquote>

          {/* core values row */}
          <div className="relative flex items-center justify-around mt-3 md:mt-4 pt-2 md:pt-3 border-t border-primary/10">
            {coreValues.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-0.5 md:gap-1">
                <Icon size={16} className="text-primary md:hidden" strokeWidth={1.8} />
                <Icon size={18} className="text-primary hidden md:block" strokeWidth={1.8} />
                <span className="text-[9px] md:text-[10px] lg:text-[11px] text-text-muted font-medium">
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
    </div>
  );
}
