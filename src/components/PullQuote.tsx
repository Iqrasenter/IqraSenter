interface PullQuoteProps {
  text: string;
  accent?: boolean;
}

export function PullQuote({ text, accent = false }: PullQuoteProps) {
  return (
    <blockquote
      className={`border-l-2 ${accent ? "border-accent" : "border-primary"} pl-6 py-2`}
    >
      <p className="font-heading text-xl lg:text-2xl font-semibold text-text leading-snug italic">
        &ldquo;{text}&rdquo;
      </p>
    </blockquote>
  );
}
