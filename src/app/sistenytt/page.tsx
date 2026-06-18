import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CalendarClock,
  Clock,
  Coins,
  MapPin,
  Users,
  type LucideIcon,
} from "lucide-react";
import { EditorialPageHeader } from "@/components/EditorialPageHeader";
import { EditorialLabel } from "@/components/EditorialLabel";
import { FadeIn } from "@/components/FadeIn";
import { NEWS } from "@/lib/constants";

const DETAIL_ICONS: Record<string, LucideIcon> = {
  Calendar,
  CalendarClock,
  Clock,
  Coins,
  MapPin,
  Users,
};

export const metadata: Metadata = {
  title: "Siste Nytt",
  description: "Hold deg oppdatert med siste nyheter, arrangementer og aktiviteter fra Iqra Læring og Aktivitetssenter i Oslo.",
  alternates: {
    canonical: "https://www.iqrasenter.net/sistenytt",
  },
  openGraph: {
    title: "Siste Nytt hos Iqra Senter",
    description: "Hold deg oppdatert med siste nyheter, arrangementer og aktiviteter fra Iqra Læring og Aktivitetssenter i Oslo.",
    url: "https://www.iqrasenter.net/sistenytt",
  }
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function AktueltPage() {
  const featured = NEWS[0];
  const rest = NEWS.slice(1);

  return (
    <>
      <EditorialPageHeader
        label="Siste Nytt"
        title="Siste"
        highlight="Nytt"
        subtitle="Nyheter og arrangementer fra Iqra Senter"
      />

      {/* ===== FEATURED ARTICLE ===== */}
      <section className="py-12 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              <div className="lg:col-span-7 relative aspect-[4/3] rounded-lg overflow-hidden">
                <Image
                  src={featured.image}
                  alt={featured.title}
                  fill
                  className="object-cover"
                  style={"imagePosition" in featured ? { objectPosition: featured.imagePosition as string } : undefined}
                  quality={90}
                  sizes="(max-width: 1024px) 100vw, 58vw"
                />
              </div>
              <div className="lg:col-span-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                  {formatDate(featured.date)}
                </span>
                <h2 className="mt-3 font-heading text-3xl lg:text-4xl font-bold text-text leading-tight">
                  {featured.title}
                </h2>
                <p className="mt-4 text-text-muted leading-relaxed text-lg">
                  {featured.excerpt}
                </p>

                {"details" in featured && (
                  <ul className="mt-6 space-y-3">
                    {(featured.details as readonly { icon: string; text: string }[]).map((d) => {
                      const Icon = DETAIL_ICONS[d.icon] ?? Calendar;
                      return (
                        <li key={d.text} className="flex items-start gap-3 text-text-muted">
                          <Icon size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                          <span className="leading-relaxed">{d.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {"cta" in featured ? (
                  <a
                    href={(featured.cta as { label: string; href: string }).href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-7 inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary-light text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer text-sm"
                  >
                    {(featured.cta as { label: string; href: string }).label}
                    <ArrowRight size={16} />
                  </a>
                ) : (
                  <div className="mt-6 w-12 h-px bg-border" />
                )}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ===== REMAINING ARTICLES — Alternating ===== */}
      <section className="py-12 lg:py-16 border-t border-border/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
          {rest.map((item, i) => {
            if ("gallery" in item) {
              const gallery = item.gallery as readonly {
                src: string;
                w: number;
                h: number;
                alt: string;
              }[];
              const [lead, ...thumbs] = gallery;
              return (
                <FadeIn key={item.title} delay={i * 0.1}>
                  <article>
                    <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                      {formatDate(item.date)}
                    </span>
                    <h3 className="mt-2 font-heading text-2xl lg:text-3xl font-bold text-text leading-snug">
                      {item.title}
                    </h3>
                    <p className="mt-3 max-w-3xl text-text-muted leading-relaxed">
                      {item.excerpt}
                    </p>

                    <div className="mt-8 relative aspect-[16/9] rounded-lg overflow-hidden">
                      <Image
                        src={lead.src}
                        alt={lead.alt}
                        fill
                        className="object-cover"
                        quality={85}
                        sizes="(max-width: 1024px) 100vw, 1152px"
                      />
                    </div>

                    <div className="mt-4 gap-4 [column-fill:_balance] columns-2 lg:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
                      {thumbs.map((photo) => (
                        <Image
                          key={photo.src}
                          src={photo.src}
                          alt={photo.alt}
                          width={photo.w}
                          height={photo.h}
                          className="w-full h-auto rounded-lg"
                          quality={80}
                          sizes="(max-width: 1024px) 50vw, 33vw"
                        />
                      ))}
                    </div>
                  </article>
                </FadeIn>
              );
            }

            return (
              <FadeIn key={item.title} delay={i * 0.1}>
                <article className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                  <div
                    className={`lg:col-span-5 relative aspect-[3/2] rounded-lg overflow-hidden ${i % 2 === 1 ? "lg:order-2" : ""
                      }`}
                  >
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      className="object-cover"
                      style={"imagePosition" in item ? { objectPosition: item.imagePosition as string } : undefined}
                      quality={90}
                      sizes="(max-width: 1024px) 100vw, 42vw"
                    />
                  </div>
                  <div
                    className={`lg:col-span-7 ${i % 2 === 1 ? "lg:order-1" : ""
                      }`}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                      {formatDate(item.date)}
                    </span>
                    <h3 className="mt-2 font-heading text-2xl font-bold text-text leading-snug">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-text-muted leading-relaxed">
                      {item.excerpt}
                    </p>
                  </div>
                </article>
              </FadeIn>
            );
          })}
        </div>
      </section>

      {/* ===== EVENTS — Sidebar Layout ===== */}
      <section className="py-12 lg:py-16 border-t border-border/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            <div className="lg:col-span-2">
              <FadeIn>
                <EditorialLabel>Arrangementer</EditorialLabel>
                <h2 className="font-heading text-3xl font-bold text-text">
                  Kommende arrangementer
                </h2>
              </FadeIn>
            </div>
            <div className="lg:col-span-3 lg:border-l lg:border-border/50 lg:pl-12">
              <FadeIn delay={0.1}>
                <p className="text-lg text-text-muted leading-relaxed">
                  Vi jobber med å planlegge nye arrangementer og aktiviteter for
                  våre medlemmer. Følg med på våre sosiale medier og denne siden
                  for oppdateringer.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/bli-medlem"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary-light text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer text-sm"
                  >
                    Bli medlem for oppdateringer
                    <ArrowRight size={16} />
                  </Link>
                  <Link
                    href="/kontakt"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border hover:border-primary text-text font-semibold rounded-xl transition-all duration-200 cursor-pointer text-sm"
                  >
                    Kontakt oss
                  </Link>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
