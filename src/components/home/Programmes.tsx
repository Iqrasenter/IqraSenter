"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const choices = {
  "school": {
    "src": "/images/home/kurs-editorial.webp",
    "alt": "Bøker og notater i en undervisningssituasjon",
    "caption": "Fra undervisningen på helgeskolen.",
    "category": "Helgeskole",
    "width": 800,
    "height": 746
  },
  "activities": {
    "src": "/images/home/forest-editorial.webp",
    "alt": "Barn på skogstur med Iqra",
    "caption": "På tur i skogen.",
    "category": "Fritidsaktiviteter",
    "width": 768,
    "height": 1024
  },
  "courses": {
    "src": "/images/home/stage-editorial.webp",
    "alt": "Unge deltakere på scenen under et arrangement hos Iqra",
    "caption": "På scenen under et arrangement.",
    "category": "Kurs og seminarer",
    "width": 1600,
    "height": 900
  }
} as const;

export function Programmes() {
  const [active, setActive] = useState<keyof typeof choices>("school");
  const choice = choices[active];
  return (
    <div className="programmes-piece">
      <section className="offering" id="tilbud" aria-labelledby="offering-title">
        <div className="section-intro">
          <h2 id="offering-title">
            Dette tilbyr vi.
          </h2>
          <p className="intro-copy">
            Helgeskole, språkopplæring, turer og kurs for barn, unge og voksne.
          </p>
        </div>
        <div className="programme-explorer">
          <div className="programme-list" aria-label="Våre tilbud">
            <details className="programme" name="iqra-programmes" data-programme="school" open={active === "school"} onToggle={(event) => { if (event.currentTarget.open) setActive("school"); }}>
              <summary>
                <span>
                  Helgeskole
                </span>
                <span className="toggle" aria-hidden="true">

                </span>
              </summary>
              <div className="programme-content">
                <p>
                  Språk, kultur og islamske studier for barn og unge. Her kan de stille spørsmål og bli kjent med andre.
                </p>
                <Image className="inline-photo" src="/images/home/kurs-editorial.webp" width={800} height={746} alt="Bøker og notater i en undervisningssituasjon" loading="lazy" sizes="(max-width: 700px) 100vw, 60vw" />
                <Link href="/om-oss">
                  Bli kjent med helgeskolen
                  <span aria-hidden="true">
                    →
                  </span>
                </Link>
              </div>
            </details>
            <details className="programme" name="iqra-programmes" data-programme="activities" open={active === "activities"} onToggle={(event) => { if (event.currentTarget.open) setActive("activities"); }}>
              <summary>
                <span>
                  Fritidsaktiviteter
                </span>
                <span className="toggle" aria-hidden="true">

                </span>
              </summary>
              <div className="programme-content">
                <p>
                  Turer, lek og aktiviteter utenfor klasserommet, med plass til vennskap og nye interesser.
                </p>
                <Image className="inline-photo" src="/images/home/forest-editorial.webp" width={768} height={1024} alt="Barn på skogstur med Iqra" loading="lazy" sizes="(max-width: 700px) 100vw, 60vw" />
                <Link href="/om-oss">
                  Utforsk fritidsaktivitetene
                  <span aria-hidden="true">
                    →
                  </span>
                </Link>
              </div>
            </details>
            <details className="programme" name="iqra-programmes" data-programme="courses" open={active === "courses"} onToggle={(event) => { if (event.currentTarget.open) setActive("courses"); }}>
              <summary>
                <span>
                  Kurs og seminarer
                </span>
                <span className="toggle" aria-hidden="true">

                </span>
              </summary>
              <div className="programme-content">
                <p>
                  Kurs og seminarer om blant annet språk, kultur og barneoppdragelse.
                </p>
                <Image className="inline-photo" src="/images/home/stage-editorial.webp" width={900} height={675} alt="Unge deltakere på scenen under et arrangement hos Iqra" loading="lazy" sizes="(max-width: 700px) 100vw, 60vw" />
                <Link href="/kontakt">
                  Spør oss om kurs
                  <span aria-hidden="true">
                    →
                  </span>
                </Link>
              </div>
            </details>
            <Link className="admissions-link" href="/bli-medlem">
              Slik blir du medlem
              <span aria-hidden="true">
                →
              </span>
            </Link>
          </div>
          <figure className="programme-photo" aria-label="Et innblikk i tilbudet">
            <div className="photo-frame">
              <Image id="programme-image" data-key={active} key={active} src={choice.src} alt={choice.alt} width={choice.width} height={choice.height} sizes="(max-width: 700px) 100vw, 60vw" className="photo-changing" />
            </div>
            <figcaption>
              <span id="photo-caption">{choice.caption}</span>
              <span id="photo-category">{choice.category}</span>
            </figcaption>
          </figure>
        </div>
      </section>
    </div>
  );
}
