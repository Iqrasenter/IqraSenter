import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EditorialPageHeader } from "@/components/EditorialPageHeader";
import { EditorialLabel } from "@/components/EditorialLabel";
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
        label="Om oss"
        title="Om Iqra Senter"
        subtitle="Et samlingspunkt for hele familien — med kunnskap, kultur og fellesskap i hjertet av Oslo."
      />

      {/* ===== STORY — 60/40 Split ===== */}
      <section className="py-6 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-16">
            <div className="lg:col-span-3">
              <FadeIn>
                <div className="space-y-3 lg:space-y-6 text-text-muted text-xs lg:text-lg leading-relaxed">
                  <p>
                    Iqra læring og aktivitetssenter er mer enn bare en
                    utdanningsinstitusjon; det er et samlingspunkt for hele
                    familien. Vi ligger sentralt i Oslo, i Ryenstubben 2, og
                    tilbyr et unikt læringsmiljø der islamske studier,
                    språkopplæring og kulturelle aktiviteter står i sentrum.
                  </p>
                  <p>
                    Vår helgeskole gir barn og unge muligheten til å lære om
                    språk, kultur og tradisjon på en engasjerende måte. I
                    tillegg arrangerer vi kurs, seminarer og fritidsaktiviteter
                    som utflukter, sosiale samlinger og familievennlige
                    arrangementer gjennom hele året.
                  </p>
                  <p>
                    Vårt mål er å bygge et sterkt, inkluderende fellesskap der
                    alle føler seg velkomne — uansett bakgrunn og alder. Vi tror
                    på kraften i læring, samhold og glede, og jobber hver dag
                    for å gi familier i Oslo et sted de kan kalle sitt eget.
                  </p>
                </div>
              </FadeIn>
            </div>
            <div className="lg:col-span-2 flex items-center">
              <FadeIn delay={0.15} direction="right">
                <PullQuote text="Vi tror på kraften i læring, samhold og glede." />
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FULL-BLEED IMAGE BREAK ===== */}
      <FadeIn>
        <section className="relative h-[25vh] lg:h-[50vh]">
          <Image
            src="/images/helgeskole.jpg"
            alt="Helgeskole hos Iqra Senter"
            fill
            className="object-cover"
            quality={90}
            sizes="100vw"
          />
        </section>
      </FadeIn>

      {/* ===== VALUES — Staggered Offset Grid ===== */}
      <section className="py-6 lg:py-16 border-t border-border/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <EditorialLabel>Våre verdier</EditorialLabel>
            <h2 className="font-heading text-2xl lg:text-4xl font-bold text-text mb-4 lg:mb-10">
              Det vi står for
            </h2>
          </FadeIn>

          <div className="grid grid-cols-2 md:grid-cols-2 gap-3 lg:gap-x-16 lg:gap-y-12">
            {VALUES.map((value, index) => (
              <FadeIn
                key={value.title}
                delay={index * 0.1}
                className={index % 2 === 1 ? "lg:mt-12" : ""}
              >
                <span className="text-2xl lg:text-5xl font-heading font-extrabold text-border/60">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-1 lg:mt-3 font-heading text-sm lg:text-xl font-bold text-text">
                  {value.title}
                </h3>
                <p className="mt-1 lg:mt-2 text-[10px] lg:text-base text-text-muted leading-relaxed">
                  {value.description}
                </p>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TIMELINE — Horizontal Grid ===== */}
      <section className="py-6 lg:py-16 border-t border-border/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <EditorialLabel>Milepæler</EditorialLabel>
            <h2 className="font-heading text-2xl lg:text-4xl font-bold text-text mb-4 lg:mb-10">
              Vår reise
            </h2>
          </FadeIn>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-8">
            {MILESTONES.map((milestone, index) => (
              <FadeIn key={milestone.label} delay={index * 0.1}>
                <div className="border-t border-border pt-3 lg:pt-6">
                  <span className="text-[10px] lg:text-xs font-semibold uppercase tracking-wider text-accent">
                    Steg {index + 1}
                  </span>
                  <h3 className="mt-1 lg:mt-3 font-heading text-xs lg:text-lg font-bold text-text">
                    {milestone.label}
                  </h3>
                  <p className="mt-1 lg:mt-2 text-[10px] lg:text-sm text-text-muted leading-relaxed">
                    {milestone.description}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA — Light ===== */}
      <section className="py-6 lg:py-16 border-t border-border/50">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
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
