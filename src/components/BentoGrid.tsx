import Image from "next/image";
import Link from "next/link";
import { BookOpen, Users, GraduationCap, Building, ArrowRight } from "lucide-react";
import { SERVICES } from "@/lib/constants";

type ServiceTitle = (typeof SERVICES)[number]["title"];

const iconMap = { BookOpen, Users, GraduationCap, Building } as const;

const linkMap: Record<ServiceTitle, string> = {
  Helgeskole: "/om-oss",
  Fritidsaktiviteter: "/om-oss",
  "Kurs og opplæring": "/om-oss",
};

const categoryMap: Record<ServiceTitle, string> = {
  Helgeskole: "Utdanning",
  Fritidsaktiviteter: "Aktiviteter",
  "Kurs og opplæring": "Kurs",
};

export function BentoGrid() {
  return (
    <>
      {/* Desktop: 2x2 compact grid */}
      <div
        className="hidden md:grid grid-cols-2 gap-3"
        style={{ gridTemplateRows: "1fr 1fr", height: "calc(100dvh - 80px - 140px)" }}
      >
        {SERVICES.map((service) => {
          const Icon = iconMap[service.icon];
          return (
            <Link
              key={service.title}
              href={linkMap[service.title]}
              className="group relative overflow-hidden rounded-3xl cursor-pointer h-full"
            >
              <Image
                src={service.image}
                alt={service.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                quality={90}
                sizes="(max-width: 768px) 82vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-accent/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                  <Icon size={15} className="text-white" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-widest text-white/70 bg-black/20 backdrop-blur-sm px-2 py-0.5 rounded-full">
                  {categoryMap[service.title]}
                </span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-4 lg:p-5">
                <h3 className="font-heading text-lg lg:text-xl font-bold text-white leading-tight">
                  {service.title}
                </h3>
                <p className="mt-1 text-xs text-white/70 leading-relaxed line-clamp-2">
                  {service.description}
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-accent font-semibold text-sm opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                  Les mer
                  <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              </div>
              <div className="absolute inset-0 rounded-3xl ring-2 ring-accent/0 group-hover:ring-accent/40 transition-all duration-300 pointer-events-none" />
            </Link>
          );
        })}
      </div>

      {/* Mobile: horizontal swipe carousel */}
      <div
        className="md:hidden flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 -mx-1 px-1"
        style={{ scrollbarWidth: "none" }}
      >
        {SERVICES.map((service) => {
          const Icon = iconMap[service.icon];
          return (
            <Link
              key={service.title}
              href={linkMap[service.title]}
              className="group relative overflow-hidden rounded-3xl cursor-pointer snap-start shrink-0 w-[82vw]"
              style={{ height: "calc(100dvh - 220px)" }}
            >
              <Image
                src={service.image}
                alt={service.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                quality={90}
                sizes="(max-width: 768px) 82vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-accent/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                  <Icon size={15} className="text-white" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-widest text-white/70 bg-black/20 backdrop-blur-sm px-2 py-0.5 rounded-full">
                  {categoryMap[service.title]}
                </span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-4 lg:p-5">
                <h3 className="font-heading text-lg lg:text-xl font-bold text-white leading-tight">
                  {service.title}
                </h3>
                <p className="mt-1 text-xs text-white/70 leading-relaxed line-clamp-2">
                  {service.description}
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-accent font-semibold text-sm opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                  Les mer
                  <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              </div>
              <div className="absolute inset-0 rounded-3xl ring-2 ring-accent/0 group-hover:ring-accent/40 transition-all duration-300 pointer-events-none" />
            </Link>
          );
        })}
      </div>

      {/* Swipe dots indicator */}
      <div className="md:hidden flex justify-center gap-1.5 mt-3">
        {SERVICES.map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary/30" />
        ))}
      </div>
    </>
  );
}
