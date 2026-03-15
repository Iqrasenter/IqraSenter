import type { Metadata } from "next";
import Link from "next/link";
import {
  MapPin,
  Mail,
  Phone,
  MessageCircle,
  Facebook,
  Instagram,
} from "lucide-react";
import { EditorialPageHeader } from "@/components/EditorialPageHeader";
import { EditorialLabel } from "@/components/EditorialLabel";
import { FadeIn } from "@/components/FadeIn";
import { ContactForm } from "@/components/ContactForm";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Kontakt",
  description: "Ta kontakt med Iqra Læring og Aktivitetssenter. Vi svarer gjerne på dine spørsmål om våre tilbud, aktiviteter og medlemskap.",
  openGraph: {
    title: "Kontakt Iqra Senter",
    description: "Ta kontakt med Iqra Læring og Aktivitetssenter. Vi svarer gjerne på dine spørsmål om våre tilbud.",
    url: "https://www.iqrasenter.net/kontakt",
  }
};

export default function KontaktPage() {
  return (
    <>
      <EditorialPageHeader
        label="Kontakt"
        title="Kontakt oss"
        subtitle="Vi svarer gjerne på dine spørsmål!"
      />

      {/* ===== MAIN CONTENT ===== */}
      <section className="py-6 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-16">
            {/* Left — Form */}
            <div className="lg:col-span-7">
              <FadeIn>
                <EditorialLabel>Send melding</EditorialLabel>
                <h2 className="font-heading text-xl lg:text-2xl font-bold text-text mb-4 lg:mb-8">
                  Har du spørsmål?
                </h2>
              </FadeIn>
              <FadeIn delay={0.1}>
                <ContactForm />
              </FadeIn>
            </div>

            {/* Right — Info */}
            <div className="lg:col-span-5">
              {/* Mobile: compact 2-col grid | Desktop: stacked list */}
              <FadeIn delay={0.15}>
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 lg:gap-0">
                  {/* Address */}
                  <div className="border border-border lg:border-t lg:border-x-0 lg:border-b-0 rounded-lg lg:rounded-none p-2 lg:pt-6 lg:p-0 lg:pb-0">
                    <p className="text-[9px] lg:text-xs font-semibold uppercase tracking-wider text-text-muted mb-0.5 lg:mb-2">
                      Adresse
                    </p>
                    <p className="text-[10px] lg:text-base text-text font-medium flex items-center gap-1.5 lg:gap-3">
                      <MapPin size={12} className="text-primary shrink-0 lg:hidden" />
                      <MapPin size={16} className="text-primary shrink-0 hidden lg:block" />
                      {SITE.address}
                    </p>
                  </div>

                  {/* Email */}
                  <div className="border border-border lg:border-t lg:border-x-0 lg:border-b-0 rounded-lg lg:rounded-none p-2 lg:pt-6 lg:p-0 lg:mt-6 lg:pb-0">
                    <p className="text-[9px] lg:text-xs font-semibold uppercase tracking-wider text-text-muted mb-0.5 lg:mb-2">
                      E-post
                    </p>
                    <a
                      href={`mailto:${SITE.email}`}
                      className="text-[10px] lg:text-base text-text font-medium flex items-center gap-1.5 lg:gap-3 hover:text-primary transition-colors"
                    >
                      <Mail size={12} className="text-primary shrink-0 lg:hidden" />
                      <Mail size={16} className="text-primary shrink-0 hidden lg:block" />
                      {SITE.email}
                    </a>
                  </div>

                  {/* Phone */}
                  <div className="border border-border lg:border-t lg:border-x-0 lg:border-b-0 rounded-lg lg:rounded-none p-2 lg:pt-6 lg:p-0 lg:mt-6 lg:pb-0">
                    <p className="text-[9px] lg:text-xs font-semibold uppercase tracking-wider text-text-muted mb-0.5 lg:mb-2">
                      Telefon
                    </p>
                    <a
                      href={`tel:${SITE.phoneRaw}`}
                      className="text-[10px] lg:text-base text-text font-medium flex items-center gap-1.5 lg:gap-3 hover:text-primary transition-colors"
                    >
                      <Phone size={12} className="text-primary shrink-0 lg:hidden" />
                      <Phone size={16} className="text-primary shrink-0 hidden lg:block" />
                      {SITE.phone}
                    </a>
                  </div>

                  {/* WhatsApp */}
                  <div className="border border-border lg:border-t lg:border-x-0 lg:border-b-0 rounded-lg lg:rounded-none p-2 lg:pt-6 lg:p-0 lg:mt-6 lg:pb-0">
                    <p className="text-[9px] lg:text-xs font-semibold uppercase tracking-wider text-text-muted mb-0.5 lg:mb-2">
                      WhatsApp
                    </p>
                    <a
                      href={SITE.social.whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] lg:text-base text-text font-medium flex items-center gap-1.5 lg:gap-3 hover:text-primary transition-colors"
                    >
                      <MessageCircle size={12} className="text-primary shrink-0 lg:hidden" />
                      <MessageCircle size={16} className="text-primary shrink-0 hidden lg:block" />
                      Send melding
                    </a>
                  </div>

                  {/* Social — spans full width on mobile */}
                  <div className="col-span-2 lg:col-span-1 border border-border lg:border-t lg:border-x-0 lg:border-b-0 rounded-lg lg:rounded-none p-2 lg:pt-6 lg:p-0 lg:mt-6 lg:pb-0 flex items-center gap-2 lg:block">
                    <p className="text-[9px] lg:text-xs font-semibold uppercase tracking-wider text-text-muted mb-0 lg:mb-3">
                      Følg oss
                    </p>
                    <div className="flex items-center gap-2 lg:gap-3">
                      <Link
                        href={SITE.social.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-7 h-7 lg:w-10 lg:h-10 rounded-lg bg-primary/5 hover:bg-primary/10 flex items-center justify-center transition-colors"
                        aria-label="Facebook"
                      >
                        <Facebook size={14} className="text-primary lg:hidden" />
                        <Facebook size={18} className="text-primary hidden lg:block" />
                      </Link>
                      <Link
                        href={SITE.social.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-7 h-7 lg:w-10 lg:h-10 rounded-lg bg-primary/5 hover:bg-primary/10 flex items-center justify-center transition-colors"
                        aria-label="Instagram"
                      >
                        <Instagram size={14} className="text-primary lg:hidden" />
                        <Instagram size={18} className="text-primary hidden lg:block" />
                      </Link>
                      <Link
                        href={SITE.social.whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-7 h-7 lg:w-10 lg:h-10 rounded-lg bg-primary/5 hover:bg-primary/10 flex items-center justify-center transition-colors"
                        aria-label="WhatsApp"
                      >
                        <MessageCircle size={14} className="text-primary lg:hidden" />
                        <MessageCircle size={18} className="text-primary hidden lg:block" />
                      </Link>
                    </div>
                  </div>
                </div>
              </FadeIn>

              {/* Map — compact on mobile */}
              <FadeIn delay={0.4}>
                <div className="mt-3 lg:mt-6 lg:border-t lg:border-border lg:pt-6">
                  <div className="rounded-lg overflow-hidden h-36 lg:h-64">
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
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
