import Link from "next/link";

const MESSAGE = "Nye elever med opptak — les og bekreft foreldreavtalen";

function MarqueeTrack({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return (
    <div
      aria-hidden={ariaHidden || undefined}
      className="flex shrink-0 items-center animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none"
    >
      {[...Array(4)].map((_, i) => (
        <span
          key={i}
          className="flex items-center whitespace-nowrap py-2 text-xs sm:text-sm font-medium tracking-wide"
        >
          <span className="px-5">{MESSAGE}</span>
          <span aria-hidden className="text-white/70">→</span>
          <span aria-hidden className="px-5 text-white/40">•</span>
        </span>
      ))}
    </div>
  );
}

export function AnnouncementMarquee() {
  return (
    <Link
      href="/foreldreavtale"
      aria-label="Nye elever med opptak: les og bekreft foreldreavtalen"
      className="group relative z-30 block w-full overflow-hidden bg-primary text-white transition-colors duration-200 hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white touch-manipulation"
      style={{ marginTop: "var(--navbar-h)" }}
    >
      <div className="flex overflow-hidden [--gap:0px] [--duration:30s]">
        <MarqueeTrack />
        <MarqueeTrack ariaHidden />
      </div>
    </Link>
  );
}
