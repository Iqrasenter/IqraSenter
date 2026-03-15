import { FadeIn } from "./FadeIn";

interface EditorialPageHeaderProps {
  label: string;
  title: string;
  subtitle?: string;
}

export function EditorialPageHeader({
  label,
  title,
  subtitle,
}: EditorialPageHeaderProps) {
  return (
    <section className="pt-24 pb-3 lg:pt-44 lg:pb-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted mb-5">
            {label}
          </p>
        </FadeIn>
        <FadeIn delay={0.05}>
          <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-extrabold text-text leading-[0.92] tracking-tight">
            {title}
          </h1>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="mt-5 w-16 h-px bg-border" />
        </FadeIn>
        {subtitle && (
          <FadeIn delay={0.15}>
            <p className="mt-4 text-lg lg:text-xl text-text-muted leading-relaxed max-w-xl">
              {subtitle}
            </p>
          </FadeIn>
        )}
      </div>
    </section>
  );
}
