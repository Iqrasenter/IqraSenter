import type { Metadata } from "next";
import { Download, ArrowRight } from "lucide-react";
import avtale from "./avtale.json";
import { EditorialPageHeader } from "@/components/EditorialPageHeader";
import { EditorialLabel } from "@/components/EditorialLabel";
import { FadeIn } from "@/components/FadeIn";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Foreldreavtale",
  description:
    "Avtale mellom Iqra Læring og Aktivitetssenter og foresatte. Les avtalen og bekreft din skoleplass.",
  alternates: {
    canonical: "https://www.iqrasenter.net/foreldreavtale",
  },
  openGraph: {
    title: "Foreldreavtale - Iqra Senter",
    description:
      "Les foreldreavtalen og bekreft skoleplassen for ditt barn hos Iqra Senter.",
    url: "https://www.iqrasenter.net/foreldreavtale",
  },
};

const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSenPcdDjskImTmPErM670_QGbnw2jl4fbCWk2eDmk_MecjQ2A/viewform";

/**
 * The agreement text lives in ./avtale.json, not here.
 *
 * scripts/generate-foreldreavtale-pdf.mjs renders the printable PDF from that
 * same file. The PDF is what many parents actually read and keep, and it is the
 * wording an oppsigelse of a skoleplass would be argued against — so page and
 * PDF disagreeing is the one failure this document cannot have. One source.
 *
 * Bump `versjon` in avtale.json on every wording change: the Google Form records
 * WHEN a family accepted but not WHAT, so the stamp is the only thing tying an
 * acceptance to the terms that were on screen.
 */
type Section = {
  title: string;
  intro?: string;
  items?: string[];
};

const AVTALE_VERSJON: string = avtale.versjon;
const SECTIONS: Section[] = avtale.sections;

export default function ForeldreavtalePage() {
  return (
    <>
      <EditorialPageHeader
        title="Foreldreavtale /"
        highlight="Bekreftelse"
        subtitle="Gratulerer med skoleplassen. Les avtalen nøye og bekreft."
      />

      {/* ===== INTRO ===== */}
      <section className="py-4 lg:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-20 items-center">
            <FadeIn>
              <EditorialLabel accent>Viktig</EditorialLabel>
              <h2 className="font-heading text-lg lg:text-4xl font-bold text-text leading-tight">
                Avtale mellom Iqra og foresatte
              </h2>
            </FadeIn>
            <FadeIn delay={0.15}>
              <p className="text-xs lg:text-lg text-text-muted leading-relaxed">
                Denne avtalen er bindende og må leses og bekreftes før
                skoleplassen er endelig. Les hele avtalen under, og bekreft
                deretter via skjemaet nederst på siden. Du kan også laste ned
                avtalen som PDF.
              </p>
              <a
                href="/foreldreavtale.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 lg:mt-6 inline-flex items-center gap-2 px-4 lg:px-6 py-2 lg:py-3 text-sm lg:text-base border-2 border-border hover:border-primary text-text font-heading font-medium rounded-xl transition-colors duration-200"
              >
                <Download size={16} aria-hidden="true" />
                Last ned avtalen (PDF)
              </a>
              <p className="mt-3 lg:mt-5 text-xs lg:text-sm text-text-muted">
                Versjon{" "}
                <time dateTime={AVTALE_VERSJON} className="tabular-nums">
                  {AVTALE_VERSJON}
                </time>{" "}
                · gjelder fra skolestart høsten 2026
              </p>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ===== AGREEMENT SECTIONS ===== */}
      <section className="py-4 lg:py-12 border-t border-border/50">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-8 lg:space-y-14">
            {SECTIONS.map((section, i) => (
              <FadeIn key={section.title} delay={i === 0 ? 0 : 0.05}>
                <article>
                  <h2 className="font-heading text-xl lg:text-3xl font-bold text-text">
                    {section.title}
                  </h2>
                  <div className="mt-3 w-12 h-px bg-border" />
                  {section.intro && (
                    <p className="mt-4 text-sm lg:text-lg text-text-muted leading-relaxed">
                      {section.intro}
                    </p>
                  )}
                  {section.items && (
                    <ul className="mt-4 space-y-2.5">
                      {section.items.map((item, j) => (
                        <li
                          key={j}
                          className="flex gap-3 text-sm lg:text-base text-text-body leading-relaxed"
                        >
                          <span
                            aria-hidden
                            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CONFIRM CTA ===== */}
      <section className="py-8 lg:py-16 border-t border-border/50">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="rounded-2xl bg-primary/5 border border-border p-6 lg:p-10 text-center">
              <h2 className="font-heading text-xl lg:text-3xl font-bold text-text">
                Når du har lest avtalen, bekreft her
              </h2>
              <p className="mt-3 text-sm lg:text-lg text-text-muted leading-relaxed max-w-xl mx-auto">
                Ved å fylle ut skjemaet bekrefter du at du har lest og godtar
                foreldreavtalen.
              </p>
              <a
                href={GOOGLE_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 px-6 lg:px-8 py-3 lg:py-4 bg-accent hover:bg-accent-light text-white font-bold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg text-sm lg:text-base"
              >
                Bekreft foreldreavtalen
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      <Footer />
    </>
  );
}
