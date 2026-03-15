import type { Metadata } from "next";
import Image from "next/image";
import {
  DoorOpen,
  Users,
  Coffee,
  Train,
  UtensilsCrossed,
  Clock,
  MapPin,
  Bus,
} from "lucide-react";
import { EditorialLabel } from "@/components/EditorialLabel";
import { FadeIn } from "@/components/FadeIn";
import { SITE } from "@/lib/constants";
import { BookingForm } from "./BookingForm";

export const metadata: Metadata = {
  title: "Leie rom",
  description: "Lei rom hos Iqra Læring og Aktivitetssenter. Vi har åtte rom med plass til 12–120 personer, perfekt for møter, undervisning og arrangementer.",
  openGraph: {
    title: "Leie rom - Iqra Senter",
    description: "Lei rom hos Iqra Læring og Aktivitetssenter. Vi har åtte rom med plass til 12–120 personer.",
    url: "https://www.iqrasenter.net/leie-rom",
  }
};

const FEATURES = [
  {
    icon: DoorOpen,
    title: "8 rom tilgjengelig",
    description:
      "Vi har åtte ulike rom i forskjellige størrelser som kan tilpasses ditt behov.",
  },
  {
    icon: Users,
    title: "12–120 personer",
    description:
      "Rommene har plass til alt fra små møter til store arrangementer og feiringer.",
  },
  {
    icon: Coffee,
    title: "Kjøkken med kaffemaskin og vannkoker",
    description:
      "Tilgang til kjøkken med fasiliteter for enkel servering og kaffepauser.",
  },
  {
    icon: Train,
    title: "5 min til Ryen T-bane",
    description:
      "Sentralt beliggende med kort gangavstand til Ryen T-banestasjon.",
  },
  {
    icon: UtensilsCrossed,
    title: "Medbragt mat og drikke tillatt",
    description:
      "Du kan ta med egen mat og drikke til arrangementet ditt uten ekstra kostnad.",
  },
  {
    icon: Clock,
    title: "Svar innen 1–4 arbeidsdager",
    description:
      "Vi behandler alle forespørsler raskt og gir deg svar så snart som mulig.",
  },
];

export default function LeieRomPage() {
  return (
    <>
      {/* ===== CUSTOM HEADER WITH IMAGE ===== */}
      <section className="pt-36 pb-6 lg:pt-44 lg:pb-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-end">
            <FadeIn>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted mb-5">
                Utleie av lokaler
              </p>
              <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-extrabold text-text leading-[0.92] tracking-tight">
                Leie rom
              </h1>
              <div className="mt-5 w-16 h-px bg-border" />
              <p className="mt-4 text-lg text-text-muted leading-relaxed max-w-md">
                Åtte rom til utleie med plass til 12–120 personer
              </p>
            </FadeIn>
            <FadeIn delay={0.1}>
              <div className="relative aspect-[4/3] rounded-lg overflow-hidden">
                <Image
                  src="/images/lokale.jpg"
                  alt="Lokaler hos Iqra Senter"
                  fill
                  className="object-cover"
                  priority
                  quality={90}
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ===== FEATURES — Sidebar Layout ===== */}
      <section className="py-12 lg:py-16 border-t border-border/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            <div className="lg:col-span-2">
              <FadeIn>
                <EditorialLabel>Fasiliteter</EditorialLabel>
                <h2 className="font-heading text-3xl font-bold text-text">
                  Alt du trenger
                </h2>
              </FadeIn>
            </div>
            <div className="lg:col-span-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-8">
                {FEATURES.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <FadeIn key={feature.title} delay={index * 0.08}>
                      <div className="flex items-start gap-4">
                        <Icon
                          size={20}
                          className="text-primary mt-1 shrink-0"
                        />
                        <div>
                          <h3 className="font-heading font-bold text-text">
                            {feature.title}
                          </h3>
                          <p className="mt-1 text-sm text-text-muted leading-relaxed">
                            {feature.description}
                          </p>
                        </div>
                      </div>
                    </FadeIn>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FULL-BLEED ROOM GALLERY ===== */}
      <FadeIn>
        <section className="py-12">
          <div className="relative w-full h-[50vh] lg:h-[60vh]">
            <Image
              src="/images/lokale.jpg"
              alt="Lokaler hos Iqra Senter"
              fill
              className="object-cover"
              quality={90}
              sizes="100vw"
            />
          </div>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="mt-6 text-sm text-text-muted">
              Kontakt oss for flere bilder av lokalene.
            </p>
          </div>
        </section>
      </FadeIn>

      {/* ===== BOOKING FORM — 40/60 Split ===== */}
      <section className="py-12 lg:py-16 border-t border-border/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16">
            <div className="lg:col-span-2">
              <FadeIn>
                <EditorialLabel>Booking</EditorialLabel>
                <h2 className="font-heading text-3xl font-bold text-text">
                  Send en forespørsel
                </h2>
                <p className="mt-4 text-text-muted leading-relaxed">
                  Fyll ut skjemaet under, så tar vi kontakt med deg for å avtale
                  detaljer og pris.
                </p>
                <div className="mt-8 w-12 h-px bg-border" />
                <p className="mt-6 text-sm text-text-muted">
                  Svar innen 1–4 arbeidsdager
                </p>
              </FadeIn>
            </div>
            <div className="lg:col-span-3">
              <FadeIn delay={0.1}>
                <BookingForm />
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      {/* ===== LOCATION — Map with Sidebar ===== */}
      <section className="py-12 lg:py-16 border-t border-border/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <EditorialLabel>Beliggenhet</EditorialLabel>
            <h2 className="font-heading text-3xl font-bold text-text mb-10">
              Finn oss her
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Info */}
            <div className="lg:col-span-5">
              <FadeIn delay={0.1}>
                <div className="border-t border-border pt-6 mb-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                    Adresse
                  </p>
                  <p className="text-text font-medium flex items-center gap-3">
                    <MapPin size={16} className="text-primary shrink-0" />
                    {SITE.address}
                  </p>
                </div>
              </FadeIn>

              <FadeIn delay={0.15}>
                <div className="border-t border-border pt-6 mb-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                    Kollektivtransport
                  </p>
                  <p className="text-text font-medium flex items-center gap-3">
                    <Bus size={16} className="text-primary shrink-0" />
                    5 minutters gange til Ryen T-banestasjon
                  </p>
                </div>
              </FadeIn>

              <FadeIn delay={0.2}>
                <div className="border-t border-border pt-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                    Kontakt oss
                  </p>
                  <p className="text-text">
                    E-post:{" "}
                    <a
                      href={`mailto:${SITE.email}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {SITE.email}
                    </a>
                  </p>
                  <p className="text-text mt-1">
                    Telefon:{" "}
                    <a
                      href={`tel:${SITE.phoneRaw}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {SITE.phone}
                    </a>
                  </p>
                </div>
              </FadeIn>
            </div>

            {/* Map */}
            <div className="lg:col-span-7">
              <FadeIn delay={0.25}>
                <div className="rounded-lg overflow-hidden h-80 lg:h-full lg:min-h-[380px]">
                  <iframe
                    src={SITE.mapUrl}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Iqra Senter lokasjon"
                  />
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
