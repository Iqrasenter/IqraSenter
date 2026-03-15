interface EditorialLabelProps {
  children: string;
  accent?: boolean;
}

export function EditorialLabel({ children, accent = false }: EditorialLabelProps) {
  return (
    <p
      className={`text-xs font-semibold uppercase tracking-[0.2em] mb-4 ${
        accent ? "text-accent" : "text-text-muted"
      }`}
    >
      {children}
    </p>
  );
}
