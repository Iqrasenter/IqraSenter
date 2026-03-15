import type { Metadata } from "next";
import Link from "next/link";
import {
  Smartphone,
  Landmark,
  HandHeart,
  ArrowRight,
} from "lucide-react";
import { EditorialPageHeader } from "@/components/EditorialPageHeader";
import { EditorialLabel } from "@/components/EditorialLabel";
import { FadeIn } from "@/components/FadeIn";

export const metadata: Metadata = {
  title: "Støtt oss",
  description: "Din støtte gjør en forskjell. Se hvordan du kan bidra til Iqra Læring og Aktivitetssenter gjennom Vipps, bankoverføring eller som frivillig.",
  openGraph: {
    title: "Støtt Iqra Senter",
    description: "Din støtte gjør en forskjell. Se hvordan du kan bidra til Iqra Læring og Aktivitetssenter i Oslo.",
    url: "https://www.iqrasenter.net/stott-oss",
  }
};

const IMPACT_STATS = [
  { value: "200+", label: "familier støttet" },
  { value: "50+", label: "arrangementer i året" },
  { value: "5+", label: "år med fellesskap" },
] as const;

export default function StottOssPage() {
  return (
    <>
      <EditorialPageHeader
        label="Støtt oss"
        title="Støtt oss"
        subtitle="Din støtte gjør en forskjell — sammen kan vi tilby flere kurs, bedre lokaler og et sterkere fellesskap."
      />

      {/* ===== DONATION OPTIONS — Three Distinct Styles ===== */}
      <section className="py-12 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <EditorialLabel>Hvordan støtte</EditorialLabel>
            <h2 className="font-heading text-3xl lg:text-4xl font-bold text-text mb-10">
              Velg din måte å bidra på
            </h2>
          </FadeIn>

          {/* Vipps — Full-width prominent block */}
          <FadeIn delay={0.1}>
            <div className="bg-primary/5 rounded-lg p-8 lg:p-12 mb-8">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                  <Smartphone className="text-primary mb-3" size={28} />
                  <h3 className="font-heading text-2xl font-bold text-text">
                    Vipps
                  </h3>
                  <p className="mt-2 text-text-muted">
                    Send enkelt din støtte via Vipps
                  </p>
                </div>
                <div className="text-center lg:text-right">
                  <p className="font-heading text-5xl lg:text-6xl font-extrabold text-primary">
                    21490
                  </p>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Bank + Volunteer — Side by side */}
          <FadeIn delay={0.2}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Bank — bordered block */}
              <div className="border border-border rounded-lg p-8">
                <Landmark className="text-primary mb-3" size={24} />
                <h3 className="font-heading text-xl font-bold text-text">
                  Bankoverføring
                </h3>
                <p className="mt-2 text-text-muted text-sm">
                  Overfør direkte til vår konto
                </p>
                <div className="mt-6 py-3 px-4 bg-primary/5 rounded-md inline-block">
                  <p className="font-heading text-lg font-bold text-primary">
                    1503.67.58535
                  </p>
                </div>
                <p className="mt-3 text-xs text-text-muted">
                  Merk betalingen med &laquo;Støtte&raquo;
                </p>
              </div>

              {/* Volunteer — accent-tinted interactive */}
              <Link
                href="/kontakt"
                className="group block bg-accent/5 border border-accent/20 rounded-lg p-8 hover:bg-accent/10 transition-colors"
              >
                <HandHeart className="text-accent mb-3" size={24} />
                <h3 className="font-heading text-xl font-bold text-text">
                  Bli frivillig
                </h3>
                <p className="mt-2 text-text-muted text-sm">
                  Vi trenger flere lærere, hjelpelærere og vikarer. Ta kontakt
                  for å bidra!
                </p>
                <div className="mt-6 flex items-center gap-2 text-accent font-semibold text-sm">
                  Ta kontakt
                  <ArrowRight
                    size={16}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </div>
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ===== IMPACT STATS — Large Typographic Numbers ===== */}
      <section className="py-12 lg:py-16 border-t border-border/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 lg:gap-16">
            {IMPACT_STATS.map((stat, index) => (
              <FadeIn key={stat.label} delay={index * 0.1}>
                <div className="text-center lg:text-left">
                  <p className="font-heading text-6xl lg:text-7xl font-extrabold text-text">
                    {stat.value}
                  </p>
                  <p className="mt-2 text-sm uppercase tracking-wider text-text-muted font-semibold">
                    {stat.label}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA — Light ===== */}
      <section className="py-12 lg:py-16 border-t border-border/50">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <h2 className="font-heading text-3xl lg:text-4xl font-bold text-text">
              Har du spørsmål?
            </h2>
            <p className="mt-4 text-lg text-text-muted max-w-2xl mx-auto">
              Vi er her for å hjelpe. Ta kontakt med oss for mer informasjon om
              hvordan du kan støtte Iqra Senter.
            </p>
            <div className="mt-8">
              <Link
                href="/kontakt"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-accent hover:bg-accent-light text-white font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl cursor-pointer text-base"
              >
                Kontakt oss for mer informasjon
                <ArrowRight size={18} />
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  );
}
