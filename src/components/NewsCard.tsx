import Image from "next/image";
import { ArrowRight } from "lucide-react";

interface NewsCardProps {
  title: string;
  excerpt: string;
  date: string;
  image: string;
}

function formatDate(dateStr: string): string {
  const months = [
    "januar","februar","mars","april","mai","juni",
    "juli","august","september","oktober","november","desember",
  ];
  const d = new Date(dateStr);
  return `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function NewsCard({ title, excerpt, date, image }: NewsCardProps) {
  return (
    <article className="group bg-card rounded-3xl overflow-hidden shadow-sm border border-border/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col">
      {/* Image */}
      <div className="relative h-52 overflow-hidden">
        <Image
          src={image}
          alt={title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          quality={90}
          sizes="(max-width: 768px) 100vw, 33vw"
        />
        {/* Category badge */}
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 rounded-full bg-accent text-white text-xs font-bold shadow-md">
            Nyhet
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col flex-1">
        <time className="text-xs font-medium text-text-muted uppercase tracking-wider">
          {formatDate(date)}
        </time>
        <h3 className="mt-2 font-heading text-base font-bold text-text leading-snug group-hover:text-primary transition-colors duration-200 line-clamp-2">
          {title}
        </h3>
        <p className="mt-2 text-sm text-text-muted leading-relaxed line-clamp-3 flex-1">
          {excerpt}
        </p>
        <div className="mt-4 flex items-center gap-1 text-primary font-semibold text-sm">
          Les mer
          <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />
        </div>
      </div>
    </article>
  );
}
