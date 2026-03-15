import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EditorialPageHeader } from "@/components/EditorialPageHeader";
import { SectionHeading } from "@/components/SectionHeading";
import { PullQuote } from "@/components/PullQuote";
import { FadeIn } from "@/components/FadeIn";

export const metadata: Metadata = {
  title: "Om oss",
  description: "Lær mer om Iqra Læring og Aktivitetssenter — et samlingspunkt for hele familien med islamske studier, språkopplæring, kulturelle aktiviteter og fellesskap i Oslo.",
  openGraph: {
    title: "Om Iqra Senter",
    description: "Lær mer om Iqra Læring og Aktivitetssenter — et samlingspunkt for hele familien i Oslo.",
    url: "https://www.iqrasenter.net/om-oss",
  }
};

const VALUES = [
  {
    title: "Fellesskap",
    description:
      "Vi bygger et varmt og støttende fellesskap der familier kan møtes, dele erfaringer og skape varige relasjoner.",
  },
  {
    title: "Læring",
    description:
      "Gjennom helgeskole, kurs og seminarer gir vi barn, unge og voksne muligheten til å lære og vokse sammen.",
  },
  {
    title: "Inkludering",
    description:
      "Alle er velkomne hos oss, uansett bakgrunn og alder. Vi skaper et trygt rom der mangfold er en styrke.",
  },
  {
    title: "Glede",
    description:
      "Aktiviteter, utflukter og sosiale arrangementer fyller senteret med latter, energi og gode minner for hele familien.",
  },
];

const MILESTONES = [
  {
    label: "Grunnlagt",
    description:
      "Iqra Læring og Aktivitetssenter ble stiftet med en visjon om å skape et samlingspunkt for familier i Oslo.",
  },
  {
    label: "Første helgeskole",
    description:
      "Vi startet vår helgeskole med fokus på språk, kultur og islamske studier for barn og unge.",
  },
  {
    label: "Nye lokaler",
    description:
      "Vi flyttet inn i våre nåværende lokaler i Ryenstubben 2, med åtte rom og plass til hele fellesskapet.",
  },
  {
    label: "200+ medlemmer",
    description:
      "Et voksende fellesskap med over 200 medlemmer som deltar aktivt i våre programmer og arrangementer.",
  },
];

export default function OmOssPage() {
  return (
    <>
      <EditorialPageHeader
        title="Om"
        highlight="oss"
        subtitle="Et samlingspunkt for hele familien — med kunnskap, kultur og fellesskap i hjertet av Oslo."
      />

      {/* ===== INTRO — Bento Grid ===== */}
      <section className="py-4 lg:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
            {/* Card A — Intro text + PullQuote */}
            <FadeIn className="lg:col-span-2">
              <div className="relative rounded-2xl bg-white overflow-hidden p-5 lg:p-8 card-pop h-full flex flex-col">
                <div className="pattern-islamic absolute inset-0" />
                <p className="relative text-text-muted text-xs lg:text-lg leading-relaxed">
                  Iqra læring og aktivitetssenter er et samlingspunkt for hele
                  familien, sentralt i Oslo. Vi tilbyr helgeskole med språk,
                  kultur og tradisjon, samt kurs, seminarer og
                  fritidsaktiviteter gjennom hele året. Vårt mål er å bygge et
                  sterkt, inkluderende fellesskap der alle føler seg velkomne —
                  uansett bakgrunn og alder.
                </p>
                <div className="relative mt-4 lg:mt-6">
                  <PullQuote text="Vi tror på kraften i læring, samhold og glede." />
                </div>
              </div>
            </FadeIn>

            {/* Card B — Image */}
            <FadeIn delay={0.1} className="lg:col-span-1">
              <div className="relative rounded-2xl overflow-hidden aspect-[4/3] lg:aspect-auto lg:h-full min-h-[180px]">
                <Image
                  src="/images/helgeskole.jpg"
                  alt="Helgeskole hos Iqra Senter"
                  fill
                  className="object-cover"
                  quality={85}
                  sizes="(max-width: 1024px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ===== VALUES — Compact Icon Cards ===== */}
      <section className="py-6 lg:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <SectionHeading
              title="Det vi"
              highlight="står for"
              centered={false}
            />
          </FadeIn>

          <div className="mt-5 lg:mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {VALUES.map((value, index) => {
              return (
                <FadeIn key={value.title} delay={index * 0.05}>
                  <div className="rounded-2xl bg-white card-pop p-4 lg:p-6 h-full">
                    <h3 className="font-heading text-xs lg:text-lg font-bold text-text">
                      {value.title}
                    </h3>
                    <p className="mt-1 lg:mt-2 text-[10px] lg:text-sm text-text-muted leading-relaxed">
                      {value.description}
                    </p>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== TIMELINE — Connected Milestones ===== */}
      <section className="py-6 lg:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <h2 className="font-heading text-2xl lg:text-4xl font-bold text-text mb-6 lg:mb-10">
              Vår reise
            </h2>
          </FadeIn>

          {/* Desktop — horizontal timeline */}
          <div className="hidden lg:block">
            <div className="relative">
              <div className="absolute top-4 left-0 right-0 h-[2px] bg-border" />
              <div className="grid grid-cols-4 gap-6">
                {MILESTONES.map((milestone, index) => (
                  <FadeIn key={milestone.label} delay={index * 0.1}>
                    <div>
                      <div className="relative z-10 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold mb-4 shadow-md">
                        {index + 1}
                      </div>
                      <div className="rounded-2xl bg-white card-pop p-5">
                        <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                          Steg {index + 1}
                        </span>
                        <h3 className="mt-2 font-heading text-lg font-bold text-text">
                          {milestone.label}
                        </h3>
                        <p className="mt-2 text-sm text-text-muted leading-relaxed">
                          {milestone.description}
                        </p>
                      </div>
                    </div>
                  </FadeIn>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile — vertical timeline */}
          <div className="lg:hidden">
            <div className="relative pl-8">
              <div className="absolute left-[13px] top-0 bottom-0 w-[2px] bg-border" />
              <div className="space-y-3">
                {MILESTONES.map((milestone, index) => (
                  <FadeIn key={milestone.label} delay={index * 0.08}>
                    <div className="relative">
                      <div className="absolute -left-8 top-3 z-10 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold shadow-md">
                        {index + 1}
                      </div>
                      <div className="rounded-xl bg-white card-pop p-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">
                          Steg {index + 1}
                        </span>
                        <h3 className="mt-1 font-heading text-xs font-bold text-text">
                          {milestone.label}
                        </h3>
                        <p className="mt-1 text-[10px] text-text-muted leading-relaxed">
                          {milestone.description}
                        </p>
                      </div>
                    </div>
                  </FadeIn>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-6 lg:py-12 relative">
        <div className="pattern-islamic absolute inset-0 pointer-events-none" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <h2 className="font-heading text-2xl lg:text-5xl font-bold text-text">
              Bli en del av fellesskapet
            </h2>
            <p className="mt-2 lg:mt-4 text-xs lg:text-lg text-text-muted max-w-xl mx-auto">
              Meld deg inn og gi familien din et sted med læring, mestring og
              moro — sammen med andre.
            </p>
            <div className="mt-5 lg:mt-10 flex flex-col sm:flex-row gap-3 lg:gap-4 justify-center">
              <Link
                href="/bli-medlem"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-accent hover:bg-accent-light text-white font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl cursor-pointer text-base"
              >
                Bli medlem i dag
                <ArrowRight size={18} />
              </Link>
              <Link
                href="/kontakt"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-border hover:border-primary text-text font-semibold rounded-xl transition-all duration-200 cursor-pointer text-base"
              >
                Kontakt oss
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  );
}
