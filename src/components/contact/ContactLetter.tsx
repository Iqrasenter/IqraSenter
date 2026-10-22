"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";

const FORMSPREE_ID = process.env.NEXT_PUBLIC_FORMSPREE_ID || "";
const LOGO = "/images/logo-wide.webp";
const ERROR_TEXT = "Noe gikk galt. Prøv igjen, eller ring eller skriv til oss direkte.";

// The envelope, one sequence (design study docs/design/contact-study, "B2"):
//   Open:  it turns over, the flap lifts, the letter rises out and unfolds. The letter is the form.
//   Send:  the letter goes back in, the flap closes, the request goes to Formspree, and only when it
//          has succeeded does the envelope turn to the address side and the stamp land.
//          If the request fails, the flap lifts again and the letter comes back out with the error.
// Every move is a data attribute on .env; contact.css does the animating.
type Flags = {
  flip: "addr" | "flap";
  flap: "closed" | "open";
  letter: "in" | "peek" | "out";
  stamp: "off" | "on";
};
type Phase = "addr" | "opening" | "writing" | "sending" | "done";

const START: Flags = { flip: "addr", flap: "closed", letter: "in", stamp: "off" };

// Perforated edge of the stamp: black circles cut out of a white mask.
const PERF: { x: number; y: number }[] = [];
for (let i = 0; i < 10; i++) PERF.push({ x: (i + 0.5) * 10, y: 0 }, { x: (i + 0.5) * 10, y: 126 });
for (let j = 0; j < 12; j++) PERF.push({ x: 0, y: (j + 0.5) * 10.5 }, { x: 100, y: (j + 0.5) * 10.5 });

const FONT = { fontFamily: "'Iqra General Sans', Arial, sans-serif" } as const;

// The stamp: green perforated frame, white panel, the globe from the logo. The logo is cropped with a
// clip path (not a nested svg) so it stays inside the panel in every browser and at every size.
function Stamp({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 100 126" aria-hidden="true" focusable="false">
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="126">
          <rect width="100" height="126" fill="#fff" />
          <g fill="#000">
            {PERF.map((c, i) => (
              <circle key={i} cx={c.x} cy={c.y} r="2.7" />
            ))}
          </g>
        </mask>
        <clipPath id={`${id}-logo`}>
          <rect x="15" y="12" width="70" height="76" />
        </clipPath>
      </defs>
      <g mask={`url(#${id})`}>
        <rect width="100" height="126" fill="#153f32" />
        <rect x="6" y="6" width="88" height="114" fill="#fff" />
        <g clipPath={`url(#${id}-logo)`}>
          <image href={LOGO} x="15" y="12" width="267.5" height="75.5" preserveAspectRatio="none" />
        </g>
        <text x="50" y="106" textAnchor="middle" style={FONT} fontWeight="500" fontSize="16" letterSpacing="1.2" fill="#153f32">
          IQRA
        </text>
        <text x="50" y="115.5" textAnchor="middle" style={FONT} fontSize="5.4" letterSpacing=".9" fill="#153f32">
          OSLO · RYEN
        </text>
      </g>
    </svg>
  );
}

function Postmark({ day, year }: { day: string; year: string }) {
  const wave = (y: number) => <path d={`M2 ${y}q14-12 28 0t28 0t28 0t28 0t28 0`} />;
  return (
    <svg viewBox="0 0 340 200" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round">
        <circle cx="240" cy="100" r="92" />
        <circle cx="240" cy="100" r="58" strokeWidth="2.6" />
        {wave(62)}
        {wave(88)}
        {wave(114)}
        {wave(140)}
      </g>
      <defs>
        <path id="contact-pmc" d="M240 100m-75 0a75 75 0 1 1 150 0a75 75 0 1 1-150 0" />
      </defs>
      <text style={FONT} fill="currentColor" fontSize="15" fontWeight="500">
        <textPath href="#contact-pmc" textLength="468" lengthAdjust="spacing">
          IQRA LÆRING OG AKTIVITETSSENTER · OSLO ·
        </textPath>
      </text>
      <text style={FONT} fill="currentColor" x="240" y="93" textAnchor="middle" fontSize="21" fontWeight="500" letterSpacing="1">
        RYEN
      </text>
      <text style={FONT} fill="currentColor" x="240" y="116" textAnchor="middle" fontSize="19" fontWeight="500">
        {day}
      </text>
      <text style={FONT} fill="currentColor" x="240" y="136" textAnchor="middle" fontSize="15">
        {year}
      </text>
    </svg>
  );
}

export function ContactLetter() {
  const [env, setEnv] = useState<Flags>(START);
  const [phase, setPhase] = useState<Phase>("addr");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState({ day: "", year: "" });

  const mailRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const letterRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const thanksRef = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const phaseRef = useRef<Phase>("addr");
  const reduced = useRef(false);
  const focusFirst = useRef(false);

  const go = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };
  const flags = (patch: Partial<Flags>) => setEnv((e) => ({ ...e, ...patch }));
  // Waits between steps. With reduced motion every step happens at once.
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, reduced.current ? 0 : ms));

  useEffect(() => {
    alive.current = true;
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return () => {
      alive.current = false;
    };
  }, []);

  // The letter's height decides how tall the stage grows when it is open.
  const measure = useCallback(() => {
    const mail = mailRef.current;
    const stage = stageRef.current;
    const letter = letterRef.current;
    if (!mail || !stage || !letter) return;
    const w = stage.clientWidth;
    const eh = w / 1.6;
    const prev = letter.style.maxHeight;
    letter.style.maxHeight = "none";
    const lh = letter.scrollHeight;
    letter.style.maxHeight = prev;
    const room = parseFloat(getComputedStyle(mail).getPropertyValue("--flap-room")) || 1.6;
    mail.style.setProperty("--lh", `${lh}px`);
    mail.style.setProperty("--h-closed", `${Math.round(eh)}px`);
    mail.style.setProperty("--h-open", `${Math.round(Math.max(lh + eh * 0.07 + 20, eh * room))}px`);
  }, []);

  useLayoutEffect(() => {
    measure();
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    if (document.fonts?.ready) document.fonts.ready.then(measure);
    return () => observer.disconnect();
  }, [measure]);

  // The letter is inert until it is writable, so focus waits for the render that lifts that.
  useEffect(() => {
    if (phase === "writing" && focusFirst.current) {
      focusFirst.current = false;
      nameRef.current?.focus({ preventScroll: true });
    }
  }, [phase]);

  async function openLetter() {
    if (phaseRef.current !== "addr") return;
    go("opening");
    measure();
    setOpen(true);
    flags({ flip: "flap" });
    await wait(650);
    if (!alive.current) return;
    flags({ flap: "open" });
    await wait(500);
    if (!alive.current) return;
    flags({ letter: "peek" });
    await wait(500);
    if (!alive.current) return;
    flags({ letter: "out" });
    await wait(850);
    if (!alive.current) return;
    go("writing");
    setStatus("Brevet er åpent. Fyll ut skjemaet.");
    focusFirst.current = true;
    const rect = stageRef.current?.getBoundingClientRect();
    if (rect && (rect.top < 60 || rect.bottom > window.innerHeight)) {
      stageRef.current?.scrollIntoView({ behavior: reduced.current ? "auto" : "smooth", block: "center" });
    }
  }

  async function post(data: FormData): Promise<boolean> {
    if (!FORMSPREE_ID) return false;
    try {
      const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, { method: "POST", body: data, headers: { Accept: "application/json" } });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function sendLetter(form: HTMLFormElement) {
    const data = new FormData(form);
    data.append("_subject", "Ny henvendelse — Iqra Senter");
    go("sending");
    setError("");
    setStatus("Sender brevet.");
    const request = post(data);
    flags({ letter: "peek" });
    await wait(600);
    if (!alive.current) return;
    flags({ letter: "in" });
    await wait(250);
    if (!alive.current) return;
    flags({ flap: "closed" });
    await wait(800);
    const ok = await request;
    if (!alive.current) return;
    if (!ok) {
      // Roll the letter back out, with the message the old form showed.
      flags({ flap: "open" });
      await wait(500);
      if (!alive.current) return;
      flags({ letter: "peek" });
      await wait(500);
      if (!alive.current) return;
      flags({ letter: "out" });
      setError(ERROR_TEXT);
      setStatus(ERROR_TEXT);
      go("writing");
      return;
    }
    flags({ flip: "addr" });
    setOpen(false);
    await wait(900);
    if (!alive.current) return;
    // The postmark carries the day the letter was sent.
    const now = new Date();
    setDate({ day: now.toLocaleDateString("nb-NO", { day: "numeric", month: "short" }).replace(".", "").toUpperCase(), year: String(now.getFullYear()) });
    flags({ stamp: "on" });
    await wait(900);
    if (!alive.current) return;
    go("done");
    setStatus("Brevet er sendt. Takk for at du skrev til oss.");
    thanksRef.current?.focus({ preventScroll: true });
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (phaseRef.current !== "writing" || !form.reportValidity()) return;
    void sendLetter(form);
  }

  async function writeAnother() {
    if (phaseRef.current !== "done") return;
    formRef.current?.reset();
    flags({ stamp: "off" });
    setStatus("");
    go("addr");
    await wait(450);
    if (alive.current) void openLetter();
  }

  const done = phase === "done";
  const letterOpen = phase === "writing";

  return (
    <div className="mail" ref={mailRef}>
      <h1 id="hero-title">Et brev til Iqra.</h1>
      <div className="mid">
        {!done && <p className="lead">Spørsmål om skoleplass, medlemskap eller noe helt annet? Skriv til oss, så svarer vi så raskt vi kan.</p>}
        <div className="mail-thanks" ref={thanksRef} hidden={!done} tabIndex={-1}>
          <h2>Brevet er på vei.</h2>
          <p>Takk for at du skrev til oss. Vi svarer så raskt vi kan.</p>
          <button className="link" type="button" onClick={writeAnother}>
            Skriv et nytt brev <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      <div className="mail-stage" ref={stageRef} data-open={open ? "" : undefined}>
        <div className="env" data-flip={env.flip} data-flap={env.flap} data-letter={env.letter} data-stamp={env.stamp}>
          <div className="env-flip">
            {/* The address side */}
            <div className="face face-addr">
              <svg className="airmail" viewBox="0 0 160 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <defs>
                  <pattern id="contact-air" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="3.5" height="7" fill="#153f32" />
                    <rect x="3.5" width="3.5" height="7" fill="#faf8f4" />
                  </pattern>
                </defs>
                <path fill="url(#contact-air)" fillRule="evenodd" d="M0 0H160V100H0Z M3.2 3.2V96.8H156.8V3.2Z" />
              </svg>
              <div className="addr">
                <p className="addr-to">Iqra Læring og Aktivitetssenter</p>
                <p>Ryenstubben 2</p>
                <p>0679 Oslo</p>
              </div>
              <div className="stamp-slot">
                <Stamp id="contact-perf-slot" />
              </div>
              <div className="stamp">
                <Stamp id="contact-perf" />
              </div>
              <div className="postmark">
                <Postmark day={date.day} year={date.year} />
              </div>
              <button className="env-hit" type="button" onClick={openLetter} disabled={phase !== "addr"}>
                <span className="env-hint">
                  Åpne brevet <span aria-hidden="true">→</span>
                </span>
              </button>
            </div>

            {/* The flap side: lining, letter, pocket, flap */}
            <div className="face face-flap">
              <div className="env-in" />
              <div className="env-letter" ref={letterRef} inert={!letterOpen}>
                <form ref={formRef} onSubmit={onSubmit}>
                  <h2 className="letter-hi">Kjære Iqra,</h2>
                  <input className="gotcha" type="text" name="_gotcha" tabIndex={-1} autoComplete="off" aria-hidden="true" />
                  <div className="letter-fields">
                    <div className="field">
                      <label htmlFor="k-navn">Navn</label>
                      <input className="input" id="k-navn" name="name" maxLength={100} type="text" autoComplete="name" placeholder="Ditt fulle navn" required ref={nameRef} />
                    </div>
                    <div className="field">
                      <label htmlFor="k-epost">E-postadresse</label>
                      <input className="input" id="k-epost" name="email" maxLength={254} type="email" autoComplete="email" spellCheck={false} placeholder="din@epost.no" required />
                    </div>
                    <div className="field">
                      <label htmlFor="k-melding">Melding</label>
                      <textarea className="input" id="k-melding" name="message" maxLength={2000} rows={4} placeholder="Skriv det du lurer på …" required />
                    </div>
                  </div>
                  {error && (
                    <p className="letter-error" role="alert">
                      {error}
                    </p>
                  )}
                  <div className="letter-foot">
                    <button className="send" type="submit">
                      Send brevet <span aria-hidden="true">→</span>
                    </button>
                  </div>
                  <p className="privacy-note">
                    Hva vi lagrer, står i <Link href="/personvern">personvern</Link>.
                  </p>
                </form>
              </div>
              <div className="env-pocket">
                <i />
              </div>
              <div className="env-flap">
                <div className="flap-out" />
                <div className="flap-in" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="sr-only" role="status">
        {status}
      </p>
      <noscript>
        <p className="lead">Skriv til oss på info@iqrasenter.net eller ring +47 998 64 331.</p>
      </noscript>
    </div>
  );
}
