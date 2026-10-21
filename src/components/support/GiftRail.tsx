"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const ITEMS = [
  { title: "Helgeskolen", text: "Koran, arabisk og islamsk etikk hver helg.", src: "/images/home/kurs-editorial.webp", width: 1299, height: 1211 },
  { title: "Korankonkurranser", text: "Barna lærer, øver og leser foran alle.", src: "/images/stottoss2.webp", width: 1200, height: 900 },
  { title: "Fester", text: "Eid og skoleavslutning, med hele familien.", src: "/images/home/stage-editorial.webp", width: 1672, height: 941 },
  { title: "Turer", text: "Skogen om vinteren, parken om sommeren.", src: "/images/home/winter-editorial.webp", width: 1448, height: 1086 },
  { title: "Fellesskap", text: "Et trygt sted der barna får venner.", src: "/images/home/portrait-editorial.webp", width: 1086, height: 1448 },
  { title: "Fritid", text: "Sport, leksehjelp og aktiviteter når skolen har fri.", src: "/images/home/summer-editorial.webp", width: 1086, height: 1448 },
];

// "Dette støtter du": one row that runs past the right edge. The arrows move it one item at a time
// and fade at the ends; swipe, trackpad and keyboard scroll it too, with or without script.
export function GiftRail() {
  const rail = useRef<HTMLUListElement>(null);
  const [ends, setEnds] = useState({ start: true, end: false });

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      setEnds({ start: el.scrollLeft <= 2, end: el.scrollLeft >= el.scrollWidth - el.clientWidth - 2 });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    el.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  const move = (direction: number) => {
    const el = rail.current;
    if (!el) return;
    const items = el.children;
    const step = items.length > 1 ? (items[1] as HTMLElement).offsetLeft - (items[0] as HTMLElement).offsetLeft : el.clientWidth;
    el.scrollBy({ left: step * direction, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return (
    <div className="goes" aria-labelledby="goes-title">
      <div className="goes-head">
        <h2 id="goes-title">Dette støtter du</h2>
        <div className="goes-nav">
          <button type="button" aria-label="Forrige" aria-controls="goes-rail" disabled={ends.start} onClick={() => move(-1)}>
            <span aria-hidden="true">←</span>
          </button>
          <button type="button" aria-label="Neste" aria-controls="goes-rail" disabled={ends.end} onClick={() => move(1)}>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      <ul className="goes-rail" id="goes-rail" ref={rail} tabIndex={0} aria-label="Det gaven holder i gang">
        {ITEMS.map((item) => (
          <li key={item.title}>
            <Image src={item.src} alt="" width={item.width} height={item.height} sizes="136px" />
            <div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
