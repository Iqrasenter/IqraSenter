"use client";

import Image from "next/image";
import { useRef, useState, type KeyboardEvent } from "react";

// The four chapters of the Om oss page. Picking one swaps the hero photo and caption,
// and tints the frame in that chapter's field colour further down the page.
const CHAPTERS = [
  { id: "school", label: "Helgeskolen", caption: "Helgeskolen. Språk, kultur og Koran.", src: "/images/fritid.webp", width: 800, height: 600, alt: "Elever fra helgeskolen går sammen utenfor en solrik dag" },
  { id: "trips", label: "Turene", caption: "Turene. Niste i snøen.", src: "/images/home/winter-editorial.webp", width: 1448, height: 1086, alt: "Barn sitter i snøen og spiser niste på tur i skogen" },
  { id: "courses", label: "Kursene", caption: "Kursene. For barn og voksne.", src: "/images/stottoss2.webp", width: 1200, height: 900, alt: "Elever fremfører for hverandre i salen" },
  { id: "party", label: "Festene", caption: "Festene. Hele familien samlet.", src: "/images/home/hero-children-editorial.webp", width: 1448, height: 1086, alt: "Elever sitter på et teppe i parken og vinker" },
] as const;

export function AboutFrame() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const n = CHAPTERS.length;
    const next = { ArrowRight: (i + 1) % n, ArrowDown: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, ArrowUp: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className="frame-box" data-tint={CHAPTERS[active].id}>
      {CHAPTERS.map((c, i) => (
        <div className="frame" key={c.id} id={`frame-${c.id}`} role="tabpanel" aria-labelledby={`tab-${c.id}`} hidden={i !== active}>
          <figure>
            <Image src={c.src} alt={c.alt} width={c.width} height={c.height} sizes="(max-width: 1340px) 96vw, 1260px" priority={i === 0} />
            <figcaption>{c.caption}</figcaption>
          </figure>
        </div>
      ))}
      <div className="picker" role="tablist" aria-label="Velg hva du vil se">
        {CHAPTERS.map((c, i) => (
          <button
            key={c.id}
            ref={(el) => { tabs.current[i] = el; }}
            type="button"
            role="tab"
            id={`tab-${c.id}`}
            aria-controls={`frame-${c.id}`}
            aria-selected={i === active}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
