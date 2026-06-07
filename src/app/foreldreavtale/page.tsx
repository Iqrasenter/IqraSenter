import type { Metadata } from "next";
import { Download, ArrowRight } from "lucide-react";
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
  "https://docs.google.com/forms/d/e/1FAIpQLSfIx6QIDKrNGCkfhp5G0bqfY1HZmu0qWGxj0s5Pd_8WcP1QWg/viewform";

type Section = {
  title: string;
  intro?: string;
  items?: string[];
};

const SECTIONS: Section[] = [
  {
    title: "Innledning",
    intro:
      "Denne avtalen er bindende og skal regulere de forpliktelsene partene har til hverandre. Dersom en av partene bryter ett eller flere av vilkårene i avtalen, kan den andre parten kreve avtalen hevet.",
  },
  {
    title: "Foresattes plikter",
    items: [
      "Sørge for at eleven møter opp til undervisning til riktig tid",
      "Sørge for at eleven har med seg skrivesaker, oppfølgingshefter og pensumbøker",
      "Sitte med eleven hver dag for å lese Quran og/eller Nuuraaniyah",
      "Sørge for at eleven gjør lekser og leverer inn oppgaver",
      "Melde fra om fravær så snart som mulig og senest en halv time før undervisninger starter",
      "Gjøre seg kjent med og følge alle Iqras retningslinjer og regler. Disse reglene omfatter tre hovedområder: 1) Fravær, 2) Foreldrenes plikter, 3) Orden- og oppførselsregler",
      "Møte opp til foreldresamtaler og foreldremøter",
      "Samarbeide med læreren om elevens læring og utvikling",
      "Vise respekt overfor lærere, foreldre og andre han/hun kommer i kontakt med i Iqra",
      "Erstatte eventuelle skader eleven påfører Iqras inventar eller utstyr",
      "Betale skolepengene i tide slik at Iqra blir i stand til å møte sine forpliktelser overfor utleier og dekke andre faste utgifter",
    ],
  },
  {
    title: "Betaling",
    items: [
      "Pris for en skoleplass er kr. 700 per måned per elev",
      "Det gis ikke søskenrabatt",
      "Vi tilbyr kun Avtalegiro som eneste betalingsmåte",
      "Foresatte som ikke allerede betaler med Avtalegiro må tegne en avtalegiro. Linken kan dere få tilsendt i egen melding. Du må signere med Bank ID for å identifisere deg",
      "For de som ikke allerede bruker Avtalegiro som betalingsmetode, må skoleavgiften betales til Iqra sin konto ettersom det kan ta inntil 4 uker før avtalen er klar",
      "De som allerede betaler med Avtalegiro må øke terminbeløpet iht. de nye satsene",
      "Betalingsfristen er den 1. hver måned",
      "Foresatt er selv ansvarlig for å påse at skolepengene trekkes fra konto hver måned",
      "Dersom det av ulike grunner ikke skjer trekk, blir det sendt en faktura med en betalingsfrist på 2 uker",
      "Skolepengene justeres hvert år i henhold til konsumprisindeksen",
      "Skolepengene betales alle måneder gjennom hele året fra januar til desember",
    ],
  },
  {
    title: "Manglende betaling",
    items: [
      "Det blir sendt ut et betalingsvarsel ved manglende betaling etter den 15. i måneden",
      "Ved manglende betaling ut over 2 måneder vil det bli sendt ut et varsel om forskuddsbetaling på 6 måneder og oppsigelse av skoleplassen",
      "Ved manglende betaling ut over 3 måneder vil skoleplassen bli sagt opp",
      "Det kan søkes om skoleplass på nytt etter at det utestående er betalt",
      "Foresatte som har mottatt varsel om oppsigelse av skoleplassen kan beholde skoleplassen ved å betale det utestående i sin helhet, eller inngå en nedbetalingsavtale med skolen",
      "Skoleplassen blir sagt opp dersom en inngått nedbetalingsavtale ikke følges, og plassen gis til neste elev fra ventelista",
    ],
  },
  {
    title: "Innmeldingsgebyr",
    intro:
      "Nye foreldre skal betale et innmeldingsgebyr på kr. 1500 som skal dekke administrasjonskostnader.",
  },
  {
    title: "Oppsigelse av skoleplassen",
    items: [
      "Det er 1 måneds oppsigelse regnet fra den 1. hver måned. Skolepengene må betales i oppsigelsestiden regnet fra den 1. hver måned. Skolepengene må betales selv om eleven slutter før oppsigelsestidens utløp",
    ],
  },
  {
    title: "Opphør av kontrakten",
    intro:
      "Dersom det foreligger gyldig grunn, kan begge parter si opp skolekontrakten uten at oppsigelsesfristen må overholdes. Slik grunn foreligger for skolen spesielt ved:",
    items: [
      "Alvorlig brudd på denne kontrakten eller på skolens reglement",
      "Medbringelse, nytelse eller distribusjon av narkotika, alkohol eller rusmidler",
      "Tilstrekkelig mistanke om straffbare handlinger på skolen eller utenfor denne",
      "Utestående betaling av skolepenger eller andre gebyrer eller utlegg til tross for purring",
      "Dersom et tillitsfullt samarbeid mellom lærere, foreldre/foresatte og eleven ikke lenger er mulig",
    ],
  },
];

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
                  <h3 className="font-heading text-xl lg:text-3xl font-bold text-text">
                    {section.title}
                  </h3>
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
