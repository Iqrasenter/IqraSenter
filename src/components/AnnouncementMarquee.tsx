import Link from "next/link";

const MESSAGE = "Nye elever med opptak — les og bekreft foreldreavtalen";

export function AnnouncementMarquee() {
  return (
    <Link
      href="/foreldreavtale"
      aria-label="Nye elever med opptak: les og bekreft foreldreavtalen"
      className="group relative z-30 block w-full overflow-hidden bg-primary text-white"
      style={{ marginTop: "var(--navbar-h)" }}
    >
      <div className="flex overflow-hidden [--gap:0px] [gap:var(--gap)] [--duration:30s]">
        <div className="flex shrink-0 items-center [gap:var(--gap)] animate-marquee group-hover:[animation-play-state:paused] motion-reduce:[animation-play-state:paused]">
          {[...Array(4)].map((_, setIndex) => (
            <span
              key={setIndex}
              className="flex items-center whitespace-nowrap py-2 text-xs sm:text-sm font-medium tracking-wide"
            >
              <span className="px-5">{MESSAGE}</span>
              <span aria-hidden className="text-white/70">→</span>
              <span aria-hidden className="px-5 text-white/40">•</span>
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
