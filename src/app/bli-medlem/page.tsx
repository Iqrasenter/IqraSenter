import type { Metadata } from "next";
import {
  BookOpen,
  Mountain,
  GraduationCap,
  Users,
  Heart,
  Building,
  Phone,
  Mail,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { EditorialPageHeader } from "@/components/EditorialPageHeader";
import { EditorialLabel } from "@/components/EditorialLabel";
import { FadeIn } from "@/components/FadeIn";
import { MembershipForm } from "@/components/MembershipForm";
import { SITE } from "@/lib/constants";
import { FAQAccordion } from "./faq-accordion";

export const metadata: Metadata = {
  title: "Bli medlem / Opptak",
  description: "Bli medlem i Iqra Læring og Aktivitetssenter. Meld familien inn og få tilgang til helgeskole, kurs, fritidsaktiviteter og et sterkt fellesskap.",
  openGraph: {
    title: "Bli medlem - Iqra Senter",
    description: "Bli medlem i Iqra Læring og Aktivitetssenter. Meld familien inn i dag for tilgang til helgeskole og fellesskap.",
    url: "https://www.iqrasenter.net/bli-medlem",
  }
};

const BENEFITS = [
  {
    icon: BookOpen,
    title: "Helgeskole for barn og unge",
    description:
      "Strukturert undervisning i språk, kultur og tradisjon hver helg i et trygt og inspirerende miljø.",
  },
  {
    icon: Mountain,
    title: "Fritidsaktiviteter og utflukter",
    description:
      "Spennende turer, sport og sosiale aktiviteter som skaper minner og styrker fellesskapet.",
  },
  {
    icon: GraduationCap,
    title: "Kurs og opplæring",
    description:
      "Seminarer og kurs innen språk, barneoppdragelse, personlig utvikling og mer.",
  },
  {
    icon: Users,
    title: "Sosialt fellesskap",
    description:
      "Et inkluderende miljø der familier møtes, bygger nettverk og støtter hverandre.",
  },
  {
    icon: Heart,
    title: "Familievennlige arrangementer",
    description:
      "Feiring av høytider, kulturkvelder og samlinger som hele familien kan delta på.",
  },
  {
    icon: Building,
    title: "Tilgang til lokaler og ressurser",
    description:
      "Moderne lokaler med flere rom, kjøkken og tilgang til læringsressurser for alle aldersgrupper.",
  },
] as const;

export default function BliMedlemPage() {
  return (
    <>
      <EditorialPageHeader
        label="Bli medlem / Opptak"
        title="Bli medlem / Opptak"
        subtitle="Læring, fellesskap og muligheter for hele familien"
      />

      {/* ===== BENEFITS — Alternating Width Rows ===== */}
      <section className="py-6 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <EditorialLabel>Fordeler</EditorialLabel>
            <h2 className="font-heading text-2xl lg:text-4xl font-bold text-text mb-4 lg:mb-10">
              Hva kan Iqra Senter tilby?
            </h2>
          </FadeIn>

          {/* All 6 benefits: 2-col compact grid on mobile, alternating rows on desktop */}
          <FadeIn delay={0.1}>
            <div className="grid grid-cols-2 lg:hidden gap-3">
              {BENEFITS.map((benefit) => (
                <div
                  key={benefit.title}
                  className="border border-border rounded-xl p-3"
                >
                  <h3 className="font-heading text-sm font-bold text-text">
                    {benefit.title}
                  </h3>
                  <p className="mt-1 text-xs text-text-muted leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              ))}
            </div>
          </FadeIn>

          {/* Desktop: original alternating rows */}
          <div className="hidden lg:block">
            {/* Row 1: 70/30 */}
            <FadeIn delay={0.1}>
              <div className="grid lg:grid-cols-7 gap-8 mb-12">
                {BENEFITS.slice(0, 2).map((benefit, i) => {
                  const Icon = benefit.icon;
                  return (
                    <div
                      key={benefit.title}
                      className={`${i === 0 ? "lg:col-span-5" : "lg:col-span-2"} border-t border-border pt-8`}
                    >
                      <div className="flex items-start gap-5">
                        <Icon
                          size={24}
                          className="text-primary mt-1 shrink-0"
                        />
                        <div>
                          <h3 className="font-heading text-xl font-bold text-text">
                            {benefit.title}
                          </h3>
                          <p className="mt-2 text-text-muted leading-relaxed">
                            {benefit.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </FadeIn>

            {/* Row 2: 30/70 (reversed) */}
            <FadeIn delay={0.2}>
              <div className="grid lg:grid-cols-7 gap-8 mb-12">
                {BENEFITS.slice(2, 4).map((benefit, i) => {
                  const Icon = benefit.icon;
                  return (
                    <div
                      key={benefit.title}
                      className={`${i === 0 ? "lg:col-span-2" : "lg:col-span-5"} border-t border-border pt-8`}
                    >
                      <div className="flex items-start gap-5">
                        <Icon
                          size={24}
                          className="text-primary mt-1 shrink-0"
                        />
                        <div>
                          <h3 className="font-heading text-xl font-bold text-text">
                            {benefit.title}
                          </h3>
                          <p className="mt-2 text-text-muted leading-relaxed">
                            {benefit.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </FadeIn>

            {/* Row 3: 50/50 */}
            <FadeIn delay={0.3}>
              <div className="grid lg:grid-cols-2 gap-8">
                {BENEFITS.slice(4, 6).map((benefit) => {
                  const Icon = benefit.icon;
                  return (
                    <div
                      key={benefit.title}
                      className="border-t border-border pt-8"
                    >
                      <div className="flex items-start gap-5">
                        <Icon
                          size={24}
                          className="text-primary mt-1 shrink-0"
                        />
                        <div>
                          <h3 className="font-heading text-xl font-bold text-text">
                            {benefit.title}
                          </h3>
                          <p className="mt-2 text-text-muted leading-relaxed">
                            {benefit.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ===== MEMBERSHIP INFO — 50/50 Split ===== */}
      <section className="py-4 lg:py-16 border-t border-border/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-20 items-center">
            <FadeIn>
              <EditorialLabel accent>Medlemskap</EditorialLabel>
              <h2 className="font-heading text-lg lg:text-5xl font-bold text-text leading-tight">
                Familie&shy;medlemskap
              </h2>
            </FadeIn>
            <FadeIn delay={0.15}>
              <p className="text-xs lg:text-lg text-text-muted leading-relaxed">
                Hos Iqra Senter kan hele familien bli medlem. Med ett
                familiemedlemskap får alle i husstanden tilgang til våre
                aktiviteter, kurs og arrangementer. Vi tror på at læring og
                fellesskap er noe man opplever best sammen.
              </p>
              <div className="mt-3 lg:mt-8 inline-flex items-center gap-2 lg:gap-3 px-4 lg:px-6 py-2 lg:py-3 bg-primary/5 rounded-lg">
                <span className="font-heading text-xs lg:text-lg font-bold text-primary">
                  [Kontakt oss for priser]
                </span>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ===== ADMISSION / OPPTAK ===== */}
      <section className="py-4 lg:py-16 border-t border-border/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-20 items-center">
            <FadeIn>
              <EditorialLabel accent>Opptak</EditorialLabel>
              <h2 className="font-heading text-lg lg:text-5xl font-bold text-text leading-tight">
                Opptak til Helgeskolen
              </h2>
            </FadeIn>
            <FadeIn delay={0.15}>
              <p className="text-xs lg:text-lg text-text-muted leading-relaxed">
                For tiden er opptaket fullt, men vi tar imot interessemeldinger
                fortløpende. Når det blir ledige plasser, kontakter vi deg.
                Fyll ut interesseskjemaet for å vise at du ønsker plass til
                barnet ditt hos oss.
              </p>
              <Link
                href="/bli-medlem/opptak"
                className="mt-3 lg:mt-8 inline-flex items-center gap-2 px-4 lg:px-6 py-2 lg:py-3 text-sm lg:text-base bg-accent hover:bg-accent-light text-white font-bold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Vis interesse for opptak
                <ArrowRight size={14} />
              </Link>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ===== REGISTRATION FORM ===== */}
      <section className="py-6 lg:py-16 bg-primary/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-16">
            {/* Left — Form */}
            <div className="lg:col-span-7">
              <FadeIn>
                <EditorialLabel accent>Registrering</EditorialLabel>
                <h2 className="font-heading text-xl lg:text-4xl font-bold text-text mb-1 lg:mb-3">
                  Meld deg inn i dag
                </h2>
                <p className="text-xs lg:text-base text-text-muted mb-4 lg:mb-8">
                  Fyll ut skjemaet under, så tar vi kontakt med deg snart.
                </p>
              </FadeIn>
              <FadeIn delay={0.1}>
                <MembershipForm />
              </FadeIn>
            </div>

            {/* Right — Contact Info */}
            <div className="lg:col-span-5">
              <FadeIn delay={0.15}>
                <div className="rounded-2xl border border-border bg-white p-4 lg:p-8">
                  <h3 className="font-heading text-sm lg:text-xl font-bold text-text mb-3 lg:mb-6">
                    Foretrekker du å kontakte oss direkte?
                  </h3>
                  <div className="space-y-3 lg:space-y-5">
                    <a
                      href={`mailto:${SITE.email}`}
                      className="flex items-center gap-3 lg:gap-4 text-text hover:text-primary transition-colors"
                    >
                      <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                        <Mail size={14} className="text-primary lg:hidden" />
                        <Mail size={18} className="text-primary hidden lg:block" />
                      </div>
                      <div>
                        <p className="text-[10px] lg:text-xs font-semibold uppercase tracking-wider text-text-muted">
                          E-post
                        </p>
                        <p className="text-xs lg:text-base font-medium">{SITE.email}</p>
                      </div>
                    </a>
                    <a
                      href={`tel:${SITE.phoneRaw}`}
                      className="flex items-center gap-3 lg:gap-4 text-text hover:text-primary transition-colors"
                    >
                      <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                        <Phone size={14} className="text-primary lg:hidden" />
                        <Phone size={18} className="text-primary hidden lg:block" />
                      </div>
                      <div>
                        <p className="text-[10px] lg:text-xs font-semibold uppercase tracking-wider text-text-muted">
                          Telefon
                        </p>
                        <p className="text-xs lg:text-base font-medium">{SITE.phone}</p>
                      </div>
                    </a>
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAQ — Sidebar Layout ===== */}
      <section className="py-4 lg:py-16 border-t border-border/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 lg:gap-12">
            <div className="lg:col-span-2">
              <FadeIn>
                <EditorialLabel>Spørsmål?</EditorialLabel>
                <h2 className="font-heading text-xl lg:text-3xl font-bold text-text">
                  Ofte stilte spørsmål
                </h2>
              </FadeIn>
            </div>
            <div className="lg:col-span-3">
              <FadeIn delay={0.1}>
                <FAQAccordion />
              </FadeIn>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
