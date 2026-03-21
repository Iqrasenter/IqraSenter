import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface NewsCardProps {
  title: string;
  excerpt: string;
  date: string;
  image: string;
  href?: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function NewsCard({ title, excerpt, date, image, href = "/sistenytt" }: NewsCardProps) {
  return (
    <Link href={href} className="group">
      <article className="bg-card rounded-2xl overflow-hidden card-pop flex flex-col h-full">
        {/* Image */}
        <div className="relative aspect-[16/10] overflow-hidden">
          <Image
            src={image}
            alt={title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            quality={75}
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 flex flex-col flex-1">
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
    </Link>
  );
}
