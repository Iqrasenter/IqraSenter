"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Smartphone,
  Landmark,
  ArrowRight,
  Copy,
  Check,
  BookOpen,
  Trophy,
  PartyPopper,
  Heart,
  Users,
  Star,
} from "lucide-react";
import { FadeIn } from "@/components/FadeIn";

const BANK_ACCOUNT = "1503.67.58535";
const AVTALEGIRO_URL =
  "https://nettbutikk.solidus.no/avtalestraks/D6E5B9EA-89CF-43F0-90F0-2BD4039EADD2";

const WHAT_YOU_SUPPORT = [
  {
    icon: BookOpen,
    title: "Madrasa & Helgeskole",
    description:
      "Ukentlig islamsk undervisning for barn og unge — Quran, arabisk og islamsk etikk i trygge rammer.",
    image: "/images/helgeskole.jpg",
  },
  {
    icon: Trophy,
    title: "Korankonkurranser",
    description:
      "Årlige konkurranser som motiverer barn til å memorere og forstå Quranens budskap.",
    image: "/images/koran-konkurranse.jpg",
  },
  {
    icon: PartyPopper,
    title: "Avslutninger & fester",
    description:
      "Fellesarrangementer som samler familier — Eid-feiringer, skoleavslutninger og sosiale kvelder.",
    image: "/images/iqrany1.jpg",
  },
  {
    icon: Heart,
    title: "Islam & tradisjon",
    description:
      "Bevaring av islamske verdier og norsk-muslimsk identitet — tro, moral og tilhørighet for neste generasjon.",
  },
  {
    icon: Users,
    title: "Fellesskap & tilhørighet",
    description:
      "Et trygt sted der familier møtes, barn leker og vennskap bygges på tvers av bakgrunn.",
  },
  {
    icon: Star,
    title: "Fritidsaktiviteter",
    description:
      "Leksehjelp, sport, turer og kreative aktiviteter som gir barn minner for livet.",
    image: "/images/fritid.jpg",
  },
];

const IMPACT_STATS = [
  { value: "200+", label: "familier støttet" },
  { value: "50+", label: "arrangementer i året" },
  { value: "5+", label: "år med fellesskap" },
] as const;

export default function StottOssPage() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(BANK_ACCOUNT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      {/* ===== HERO — Dramatic, emotional ===== */}
      <section className="relative flex items-end overflow-hidden" style={{ minHeight: "70vh" }}>
        {/* Background image */}
        <div className="absolute inset-0">
          <Image
            src="/images/hero-children.jpg"
            alt="Barn på aktivitet ved Iqra Senter"
            fill
            className="object-cover"
            priority
          />
          {/* Dark overlay gradient from bottom */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(15,77,52,0.92) 0%, rgba(15,77,52,0.70) 40%, rgba(15,77,52,0.45) 100%)",
            }}
          />
          {/* Islamic pattern overlay */}
          <div className="absolute inset-0 pattern-islamic opacity-30" />
        </div>

        <div className="text-on-dark relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" style={{ color: "#fff", paddingTop: "10rem", paddingBottom: "4rem" }}>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-4" style={{ color: "rgba(255,255,255,0.6)" }}>
            Støtt oss
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-7xl font-extrabold leading-[0.92] tracking-tight max-w-4xl" style={{ color: "#fff" }}>
            Sammen bygger vi{" "}
            <span style={{ color: "#2A9D6E" }}>fremtiden</span>
          </h1>
          <p className="mt-6 text-lg lg:text-xl max-w-2xl leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
            Din støtte gjør det mulig å bevare islamske verdier, styrke
            fellesskapet og gi barn en trygg plass å vokse opp — med tro,
            kunnskap og tilhørighet.
          </p>
          <a
            href="#stott"
            className="mt-8 inline-flex items-center gap-2 px-8 py-4 bg-white font-heading font-bold rounded-full transition-all duration-300 hover:bg-primary-light shadow-lg hover:shadow-xl btn-magnetic text-base cursor-pointer"
            style={{ color: "#1B6B4A" }}
          >
            Støtt Iqra Senter
            <ArrowRight size={18} />
          </a>
        </div>
      </section>

      {/* ===== WHAT YOUR SUPPORT MEANS ===== */}
      <section className="py-20 lg:py-28 bg-bg-warm relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-primary/10 text-primary mb-4">
                Hva du støtter
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-text leading-tight">
                Din gave gir{" "}
                <em className="text-primary not-italic">mening</em>
              </h2>
              <p className="mt-4 text-lg text-text-muted max-w-2xl mx-auto">
                Hver krone går til å styrke islam, fellesskap og kunnskap
                for barn og familier i Norge.
              </p>
            </div>
          </FadeIn>

          {/* Grid: alternating image + text cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHAT_YOU_SUPPORT.map((item, i) => (
              <FadeIn key={item.title} delay={i * 0.08}>
                <div className="group bg-white rounded-container-lg overflow-hidden card-pop h-full flex flex-col">
                  {/* Image (if exists) */}
                  {item.image && (
                    <div className="relative h-48 overflow-hidden">
                      <Image
                        src={item.image}
                        alt={item.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-6 flex-1 flex flex-col">
                    {!item.image && (
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                        <item.icon className="text-primary" size={22} />
                      </div>
                    )}
                    {item.image && (
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center -mt-8 relative z-10 mb-3 ml-1 border-2 border-white shadow-sm">
                        <item.icon className="text-primary" size={18} />
                      </div>
                    )}
                    <h3 className="font-heading text-lg font-bold text-text mb-2">
                      {item.title}
                    </h3>
                    <p className="text-sm text-text-muted leading-relaxed flex-1">
                      {item.description}
                    </p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ===== DONATION METHODS ===== */}
      <section id="stott" className="py-20 lg:py-28 scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-primary/10 text-primary mb-4">
                Gi din støtte
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-text leading-tight">
                Velg din måte å{" "}
                <em className="text-primary not-italic">bidra</em> på
              </h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* VIPPS — Hero card with QR */}
            <FadeIn delay={0}>
              <div className="relative bg-primary rounded-container-lg p-8 lg:p-10 text-center h-full flex flex-col overflow-hidden group">
                {/* Pattern overlay */}
                <div className="absolute inset-0 pattern-islamic opacity-10" />
                <div className="relative z-10 flex flex-col items-center flex-1">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-5">
                    <Smartphone className="text-white" size={22} />
                  </div>
                  <p className="text-xs tracking-[0.2em] font-bold text-white/60 uppercase mb-1">
                    Vipps
                  </p>
                  <p className="font-heading text-5xl lg:text-6xl font-extrabold text-white tabular-nums mb-2">
                    21490
                  </p>
                  <p className="text-sm text-white/70 leading-relaxed mb-6">
                    Åpne Vipps-appen, søk på nummeret
                    <br className="hidden sm:block" /> eller scan QR-koden
                    under.
                  </p>
                  {/* QR Code */}
                  <div className="w-[120px] h-[120px] bg-white rounded-2xl p-2 shadow-lg mx-auto transition-transform duration-300 group-hover:scale-105">
                    <Image
                      src="/images/qr-stott-oss.png"
                      alt="QR-kode for Vipps nummer 21490"
                      width={120}
                      height={120}
                      className="w-full h-full object-contain rounded-lg"
                    />
                  </div>
                  <p className="text-[11px] text-white/50 mt-3">
                    Scan med mobilen for å betale
                  </p>
                </div>
              </div>
            </FadeIn>

            {/* BANKOVERFØRING */}
            <FadeIn delay={0.1}>
              <div className="bg-white border-2 border-border/40 rounded-container-lg p-8 lg:p-10 text-center h-full flex flex-col">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
                  <Landmark className="text-primary" size={22} />
                </div>
                <p className="text-xs tracking-[0.2em] font-bold text-primary uppercase mb-1">
                  Bankoverføring
                </p>
                <p className="font-heading text-2xl font-bold text-text mb-1">
                  Overfør direkte
                </p>
                <p className="text-sm text-text-muted leading-relaxed mb-6 flex-1">
                  Send ditt bidrag rett til vår konto. Merk betalingen med
                  &laquo;Støtte&raquo;.
                </p>

                {/* Account number display */}
                <div className="bg-bg-warm rounded-xl py-4 px-6 mb-5">
                  <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1">
                    Kontonummer
                  </p>
                  <p className="font-data text-2xl font-extrabold text-text tracking-wider">
                    {BANK_ACCOUNT}
                  </p>
                </div>

                <button
                  onClick={handleCopy}
                  aria-label="Kopier kontonummer til utklippstavlen"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary/10 text-primary font-heading font-semibold rounded-full transition-all duration-300 hover:bg-primary hover:text-white btn-magnetic text-sm cursor-pointer"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? "Kopiert!" : "Kopier kontonummer"}
                </button>
              </div>
            </FadeIn>

            {/* AVTALEGIRO */}
            <FadeIn delay={0.2}>
              <div className="bg-accent/5 border-2 border-accent/20 rounded-container-lg p-8 lg:p-10 text-center h-full flex flex-col">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-5">
                  <Heart className="text-accent" size={22} />
                </div>
                <p className="text-xs tracking-[0.2em] font-bold text-accent uppercase mb-1">
                  Avtalegiro
                </p>
                <p className="font-heading text-2xl font-bold text-text mb-1">
                  Fast månedlig støtte
                </p>
                <p className="text-sm text-text-muted leading-relaxed mb-6 flex-1">
                  Den beste måten å hjelpe — sett opp et fast trekk og velg
                  beløp selv. Forutsigbar støtte gjør at vi kan planlegge
                  bedre.
                </p>

                {/* Benefits list */}
                <div className="text-left bg-white rounded-xl p-4 mb-6 space-y-2">
                  {[
                    "Velg beløp selv",
                    "Trekkes automatisk",
                    "Kanseller når som helst",
                  ].map((benefit) => (
                    <div key={benefit} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                        <Check size={12} className="text-accent" />
                      </div>
                      <p className="text-sm text-text-body">{benefit}</p>
                    </div>
                  ))}
                </div>

                <a
                  href={AVTALEGIRO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Opprett Avtalegiro (åpnes i ny fane)"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-accent hover:bg-accent-light text-white font-heading font-bold rounded-full transition-all duration-300 shadow-md hover:shadow-lg btn-magnetic text-sm cursor-pointer"
                >
                  Opprett Avtalegiro
                  <ArrowRight size={16} />
                </a>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ===== PHOTO BREAK — Full-width image strip ===== */}
      <section className="relative overflow-hidden" style={{ height: "24rem" }}>
        <div className="absolute inset-0 grid grid-cols-3">
          <div className="relative overflow-hidden">
            <Image
              src="/images/iqrany2.jpg"
              alt="Fellesskap ved Iqra Senter"
              fill
              className="object-cover"
            />
          </div>
          <div className="relative overflow-hidden">
            <Image
              src="/images/iqrany3.jpg"
              alt="Aktiviteter ved Iqra Senter"
              fill
              className="object-cover"
            />
          </div>
          <div className="relative overflow-hidden">
            <Image
              src="/images/iqrany4.jpg"
              alt="Arrangementer ved Iqra Senter"
              fill
              className="object-cover"
            />
          </div>
        </div>
        <div
          className="absolute inset-0"
          style={{ background: "rgba(15,77,52,0.55)" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <FadeIn>
            <div className="text-on-dark">
              <p className="font-heading text-3xl lg:text-5xl font-extrabold text-center leading-tight" style={{ color: "#fff" }}>
                Tro · Kunnskap · <span style={{ color: "#2A9D6E" }}>Fellesskap</span>
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ===== IMPACT STATS ===== */}
      <section className="py-20 lg:py-24 bg-bg-warm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="font-heading text-3xl lg:text-4xl font-bold text-text">
                Vår <em className="text-primary not-italic">påvirkning</em>
              </h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {IMPACT_STATS.map((stat, i) => (
              <FadeIn key={stat.label} delay={i * 0.1}>
                <div className="bg-white rounded-container-lg card-pop p-8 text-center">
                  <p className="font-heading text-6xl lg:text-7xl font-extrabold text-primary tabular-nums">
                    {stat.value}
                  </p>
                  <p className="mt-3 text-sm uppercase tracking-wider text-text-muted font-semibold">
                    {stat.label}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA — Warm, inviting ===== */}
      <section className="relative py-20 lg:py-28 overflow-hidden" style={{ backgroundColor: "#1B6B4A" }}>
        {/* Pattern */}
        <div className="absolute inset-0 pattern-islamic opacity-10" />

        <div className="text-on-dark relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center" style={{ color: "#fff" }}>
          <FadeIn>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight" style={{ color: "#fff" }}>
              Har du spørsmål?
            </h2>
            <p className="mt-5 text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
              Vi er her for å hjelpe. Ta kontakt med oss for mer informasjon
              om hvordan du kan støtte Iqra Læring og Aktivitetssenter.
            </p>
            <div className="mt-10">
              <Link
                href="/kontakt"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white font-heading font-bold rounded-full transition-all duration-300 hover:bg-primary-light shadow-lg hover:shadow-xl btn-magnetic text-base cursor-pointer"
                style={{ color: "#1B6B4A" }}
              >
                Kontakt oss
                <ArrowRight size={18} />
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  );
}
