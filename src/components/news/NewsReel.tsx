"use client";

import Image from "next/image";
import { useRef, type KeyboardEvent } from "react";

export type ReelPhoto = { src: string; w: number; h: number; alt: string };

type Props = {
  title: string;
  dateIso: string;
  dateLabel: string;
  text: string;
  photos: readonly ReelPhoto[];
};

// The newest story with photographs: the text on a green panel, the photographs as a strip you
// scroll sideways. Buttons and arrow keys move it one photograph at a time.
export function NewsReel({ title, dateIso, dateLabel, text, photos }: Props) {
  const track = useRef<HTMLDivElement>(null);

  const smooth = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  const lefts = () =>
    Array.from(track.current?.children ?? []).map((figure) => (figure as HTMLElement).offsetLeft - 8);
  const current = () => {
    const x = track.current?.scrollLeft ?? 0;
    return lefts().reduce((n, left, i) => (left <= x + 40 ? i : n), 0);
  };
  const step = (dir: 1 | -1) => {
    const positions = lefts();
    const i = Math.max(0, Math.min(positions.length - 1, current() + dir));
    track.current?.scrollTo({ left: positions[i], behavior: smooth() });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    }
  };

  return (
    <article className="news-reel" aria-labelledby="reel-title">
      <div className="news-reel-panel">
        <div>
          <h2 id="reel-title">{title}</h2>
          <time dateTime={dateIso}>{dateLabel}</time>
          <p>{text}</p>
        </div>
        <div className="news-reel-ctrl">
          <button type="button" onClick={() => step(-1)} aria-label="Forrige bilde">
            ←
          </button>
          <button type="button" onClick={() => step(1)} aria-label="Neste bilde">
            →
          </button>
          <span>{photos.length} bilder</span>
        </div>
      </div>
      <div
        className="news-reel-track"
        ref={track}
        tabIndex={0}
        role="group"
        aria-label={`Bilder: ${title}. Bruk piltastene eller sveip.`}
        onKeyDown={onKeyDown}
      >
        {photos.map((photo, i) => (
          <figure key={photo.src}>
            <Image
              src={photo.src}
              alt={photo.alt}
              width={photo.w}
              height={photo.h}
              sizes={photo.w > photo.h ? "(max-width: 700px) 90vw, 1300px" : "(max-width: 700px) 70vw, 600px"}
              priority={i < 2}
            />
          </figure>
        ))}
      </div>
    </article>
  );
}
