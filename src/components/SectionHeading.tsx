interface SectionHeadingProps {
  badge?: string;
  title: string;
  subtitle?: string;
  centered?: boolean;
  light?: boolean;
}

export function SectionHeading({
  badge,
  title,
  subtitle,
  centered = true,
  light = false,
}: SectionHeadingProps) {
  return (
    <div className={centered ? "text-center" : ""}>
      {badge && (
        <span
          className={`inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-4 ${
            light
              ? "bg-white/10 text-white/80"
              : "bg-primary/10 text-primary"
          }`}
        >
          {badge}
        </span>
      )}
      <h2
        className={`font-heading text-lg sm:text-xl lg:text-2xl font-bold leading-tight ${
          light ? "text-white" : "text-text"
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={`mt-3 text-sm sm:text-base max-w-2xl leading-relaxed ${
            centered ? "mx-auto" : ""
          } ${light ? "text-white/70" : "text-text-muted"}`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
