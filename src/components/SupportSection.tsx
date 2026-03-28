"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Copy, Check } from "lucide-react";
import { SectionHeading } from "@/components/SectionHeading";
import { FadeIn } from "@/components/FadeIn";

const BANK_ACCOUNT = "1503.67.58535";
const AVTALEGIRO_URL =
  "https://nettbutikk.solidus.no/avtalestraks/D6E5B9EA-89CF-43F0-90F0-2BD4039EADD2";

export function SupportSection() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(BANK_ACCOUNT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section id="stott-oss" className="bg-bg-warm py-10 md:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <SectionHeading
            title="Støtt"
            highlight="Oss"
            subtitle="Din støtte gjør en forskjell for familier og barn over hele Norge"
          />
        </FadeIn>

        <div className="mt-8 md:mt-10 grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 items-stretch">
          {/* Vipps Card */}
          <FadeIn delay={0}>
            <div className="bg-white rounded-container-lg card-pop p-8 text-center h-full">
              <div className="w-10 h-[3px] bg-gradient-to-r from-primary to-primary-light rounded-full mx-auto mb-4" />
              <p className="text-xs tracking-widest font-bold text-primary uppercase mb-1">
                Vipps
              </p>
              <p className="font-heading text-3xl font-extrabold text-text mb-2">
                21490
              </p>
              <p className="text-sm text-text-muted leading-relaxed mb-5">
                Åpne Vipps-appen på telefonen, søk på nummeret eller scan
                QR-koden.
              </p>
              <div className="w-[120px] h-[120px] mx-auto rounded-container border border-border/30 overflow-hidden">
                <Image
                  src="/images/qr-stott-oss.png"
                  alt="QR-kode for Vipps nummer 21490"
                  width={120}
                  height={120}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </FadeIn>

          {/* Avtalegiro Card */}
          <FadeIn delay={0.1}>
            <div className="bg-white rounded-container-lg card-pop p-8 text-center h-full flex flex-col">
              <div className="w-10 h-[3px] bg-gradient-to-r from-primary to-primary-light rounded-full mx-auto mb-4" />
              <p className="text-xs tracking-widest font-bold text-primary uppercase mb-1">
                Avtalegiro
              </p>
              <p className="font-heading text-2xl font-extrabold text-text mb-2">
                Fast støtte
              </p>
              <p className="text-sm text-text-muted leading-relaxed mb-6 flex-1">
                Sett opp et fast månedlig trekk fra kontoen din — velg beløp
                selv, og støtt oss automatisk.
              </p>
              <a
                href={AVTALEGIRO_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Opprett Avtalegiro (åpnes i ny fane)"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary-light text-white font-heading font-semibold rounded-container transition-colors duration-300 shadow-lg btn-magnetic text-sm"
              >
                Opprett Avtalegiro
                <ArrowRight size={16} />
              </a>
            </div>
          </FadeIn>

          {/* Bank Card */}
          <FadeIn delay={0.2}>
            <div className="bg-white rounded-container-lg card-pop p-8 text-center h-full flex flex-col">
              <div className="w-10 h-[3px] bg-gradient-to-r from-primary to-primary-light rounded-full mx-auto mb-4" />
              <p className="text-xs tracking-widest font-bold text-primary uppercase mb-1">
                Bankoverføring
              </p>
              <p className="font-data text-xl font-extrabold text-text tracking-wide mb-2">
                {BANK_ACCOUNT}
              </p>
              <p className="text-sm text-text-muted leading-relaxed mb-6 flex-1">
                Overfør direkte fra nettbanken din. Merk betalingen med
                «Støtte».
              </p>
              <button
                onClick={handleCopy}
                aria-label="Kopier kontonummer til utklippstavlen"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-accent font-heading font-medium rounded-full transition-[border-color] duration-300 btn-magnetic text-sm border-2 border-accent/25 hover:border-accent"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Kopiert!" : "Kopier kontonummer"}
              </button>
            </div>
          </FadeIn>
        </div>

        <FadeIn delay={0.25}>
          <div className="mt-6 md:mt-8 text-center">
            <Link
              href="/stott-oss"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-accent font-heading font-medium rounded-full transition-[border-color] duration-300 btn-magnetic text-sm border-2 border-accent/25 hover:border-accent"
            >
              Se alle måter å støtte oss på
              <ArrowRight size={16} />
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
