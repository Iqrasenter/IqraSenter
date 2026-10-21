"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

const VIPPS = "957045";
const ACCOUNT = "1503.67.58535";
const AVTALEGIRO_URL = "https://nettbutikk.solidus.no/avtalestraks/D6E5B9EA-89CF-43F0-90F0-2BD4039EADD2";

type Side = "once" | "monthly";
const CHOICES: { side: Side; title: string; note: string }[] = [
  { side: "once", title: "Én gang", note: "Vipps eller bankoverføring" },
  { side: "monthly", title: "Hver måned", note: "AvtaleGiro, du stopper når du vil" },
];

// The headline, the once/monthly choice and the card. "Hver måned" rolls the card over to its back.
export function SupportGive() {
  const [side, setSide] = useState<Side>("once");
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + CHOICES.length) % CHOICES.length;
    setSide(CHOICES[next].side);
    buttons.current[next]?.focus();
  };

  // Report success only once the clipboard has accepted the number.
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ACCOUNT.replace(/\./g, ""));
      setCopied(true);
      setStatus("Kontonummeret er kopiert.");
    } catch {
      setCopied(false);
      setStatus("Marker kontonummeret og kopier det selv.");
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2200);
  };

  return (
    <>
      <div className="give-intro">
        <h1 id="give-title">Gaven din, rett til Ryen.</h1>
        <p className="give-lead">Den holder helgeskolen åpen. Gi én gang, eller hver måned.</p>
        <div className="give-choose" role="group" aria-label="Hvor ofte vil du gi?">
          {CHOICES.map((choice, i) => (
            <button
              key={choice.side}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              aria-pressed={side === choice.side}
              aria-controls="give-card"
              onClick={() => setSide(choice.side)}
              onKeyDown={(event) => onKeyDown(event, i)}
            >
              <span className="give-choose-title">{choice.title}</span>
              <span className="give-choose-note">{choice.note}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="give-card" id="give-card" data-side={side}>
        {/* Front: once */}
        <div className="give-side give-front" inert={side !== "once"} aria-hidden={side !== "once"}>
          <h2 className="sr-only">Gi én gang</h2>
          <div className="give-stub">
            <Image className="give-qr" src="/images/qr-stott-oss.png" alt={`QR-kode for Vipps til nummer ${VIPPS}`} width={800} height={800} unoptimized priority />
            <p className="give-vipps">{VIPPS}</p>
            <p className="give-stub-note">Vipps. Skann koden, eller søk på nummeret.</p>
          </div>
          <svg className="give-perf" viewBox="0 0 10 400" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <defs>
              <pattern id="give-holes" width="10" height="14" patternUnits="userSpaceOnUse">
                <circle cx="5" cy="7" r="2.6" fill="#0e2d25" />
              </pattern>
            </defs>
            <rect width="10" height="400" fill="url(#give-holes)" />
          </svg>
          <div className="give-face">
            <figure className="give-hadith">
              <blockquote>
                <p>«Veldedighet minsker ikke rikdommen.»</p>
              </blockquote>
              <figcaption>Profeten Muhammad (fred være med ham), Sahih Muslim 2588</figcaption>
            </figure>
            <div className="give-acct">
              <p className="give-account">{ACCOUNT}</p>
              <button type="button" className={copied ? "give-copy copied" : "give-copy"} onClick={copy} aria-describedby="give-copy-status">
                {copied ? "Kopiert" : "Kopier"}
              </button>
            </div>
            <p id="give-copy-status" className="sr-only" role="status" aria-live="polite">
              {status}
            </p>
          </div>
        </div>

        {/* Back: every month */}
        <div className="give-side give-back" inert={side !== "monthly"} aria-hidden={side !== "monthly"}>
          <h2 className="sr-only">Gi hver måned</h2>
          <div className="give-face">
            <figure className="give-hadith">
              <blockquote>
                <p>«Den gjerningen Allah elsker mest, er den som gjøres jevnlig, selv om den er liten.»</p>
              </blockquote>
              <figcaption>Profeten Muhammad (fred være med ham), Sahih al-Bukhari 6464</figcaption>
            </figure>
            <div className="give-acct">
              <a className="give-button" href={AVTALEGIRO_URL} target="_blank" rel="noopener noreferrer">
                Opprett AvtaleGiro <span aria-hidden="true">↗</span>
                <span className="sr-only"> (åpnes i ny fane)</span>
              </a>
            </div>
          </div>
        </div>
      </div>
      {/* Without script the card cannot turn, so the monthly link is shown under it. */}
      <noscript>
        <p className="give-noscript">
          Fast hver måned:{" "}
          <a href={AVTALEGIRO_URL} target="_blank" rel="noopener noreferrer">
            Opprett AvtaleGiro ↗
          </a>
        </p>
      </noscript>
    </>
  );
}
