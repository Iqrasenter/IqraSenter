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
    <section id="stott-oss" className="bg-white py-8 md:py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <SectionHeading
            title="Støtt"
            highlight="Oss"
            subtitle="Din støtte gjør en forskjell for familier og barn over hele Norge"
          />
        </FadeIn>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
          {/* Vipps Card */}
          <FadeIn delay={0}>
            <div className="bg-white rounded-container-lg card-pop px-5 py-4 text-center h-full">
              <div className="w-8 h-[2px] bg-gradient-to-r from-primary to-primary-light rounded-full mx-auto mb-1.5" />
              <p className="text-[10px] tracking-widest font-bold text-primary uppercase mb-0.5">
                Vipps
              </p>
              <p className="font-heading text-xl font-extrabold text-text mb-0.5">
                21490
              </p>
              <p className="text-sm text-text-muted leading-snug mb-3">
                Åpne Vipps-appen, søk på nummeret eller scan QR-koden.
              </p>
              <div className="w-[80px] h-[80px] mx-auto rounded-lg border border-border/30 overflow-hidden">
                <Image
                  src="/images/qr-stott-oss.png"
                  alt="QR-kode for Vipps nummer 21490"
                  width={80}
                  height={80}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </FadeIn>

          {/* Avtalegiro Card */}
          <FadeIn delay={0.1}>
            <div className="bg-white rounded-container-lg card-pop px-5 py-4 text-center h-full flex flex-col">
              <div className="w-8 h-[2px] bg-gradient-to-r from-primary to-primary-light rounded-full mx-auto mb-1.5" />
              <p className="text-[10px] tracking-widest font-bold text-primary uppercase mb-0.5">
                Avtalegiro
              </p>
              <p className="font-heading text-lg font-extrabold text-text mb-0.5">
                Fast støtte
              </p>
              <p className="text-sm text-text-muted leading-snug mb-3 flex-1">
                Sett opp et fast månedlig trekk — velg beløp selv.
              </p>
              <a
                href={AVTALEGIRO_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Opprett Avtalegiro (åpnes i ny fane)"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-light text-white font-heading font-semibold rounded-container transition-colors duration-300 shadow-md btn-magnetic text-xs"
              >
                Opprett Avtalegiro
                <ArrowRight size={14} />
              </a>
            </div>
          </FadeIn>

          {/* Bank Card */}
          <FadeIn delay={0.2}>
            <div className="bg-white rounded-container-lg card-pop px-5 py-4 text-center h-full flex flex-col">
              <div className="w-8 h-[2px] bg-gradient-to-r from-primary to-primary-light rounded-full mx-auto mb-1.5" />
              <p className="text-[10px] tracking-widest font-bold text-primary uppercase mb-0.5">
                Bankoverføring
              </p>
              <p className="font-data text-base font-extrabold text-text tracking-wide mb-0.5">
                {BANK_ACCOUNT}
              </p>
              <p className="text-sm text-text-muted leading-snug mb-3 flex-1">
                Overfør fra nettbanken. Merk med «Støtte».
              </p>
              <button
                onClick={handleCopy}
                aria-label="Kopier kontonummer til utklippstavlen"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white text-accent font-heading font-medium rounded-full transition-[border-color] duration-300 btn-magnetic text-xs border-2 border-accent/25 hover:border-accent"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Kopiert!" : "Kopier kontonummer"}
              </button>
            </div>
          </FadeIn>
        </div>

        <FadeIn delay={0.25}>
          <div className="mt-4 text-center">
            <Link
              href="/stott-oss"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-accent font-heading font-medium rounded-full transition-[border-color] duration-300 btn-magnetic text-xs border-2 border-accent/25 hover:border-accent"
            >
              Se hva du støtter
              <ArrowRight size={14} />
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
