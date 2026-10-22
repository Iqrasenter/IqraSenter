"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";

const FORMSPREE_ID = process.env.NEXT_PUBLIC_FORMSPREE_ID || "";

const DOORS = [
  { id: "skole", name: "Barnet mitt trenger skoleplass", sub: "Interessemelding til ventelisten" },
  { id: "medlem", name: "Familien vil bli medlem", sub: "Aktiviteter, kurs og arrangementer" },
  { id: "sporsmal", name: "Jeg har bare et spørsmål", sub: "Ring, skriv eller send en melding" },
] as const;

const GRADES = Array.from({ length: 10 }, (_, i) => `${i + 1}. klasse`);

type Status = "idle" | "sending" | "sent";

// Sends a form to Formspree, the same endpoint the old forms used.
function useFormspree(subject: string) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!FORMSPREE_ID) {
      setError("Skjemaet er ikke klart ennå. Ring eller send oss en e-post i stedet.");
      return;
    }
    setStatus("sending");
    setError("");
    const data = new FormData(e.currentTarget);
    data.append("_subject", subject);
    try {
      const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        setStatus("sent");
      } else {
        setStatus("idle");
        setError("Noe gikk galt. Vennligst prøv igjen eller kontakt oss direkte.");
      }
    } catch {
      setStatus("idle");
      setError("Kunne ikke sende skjemaet. Sjekk internettforbindelsen din og prøv igjen.");
    }
  }
  return { status, error, submit };
}

function Thanks({ title, text }: { title: string; text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="thanks" ref={ref} tabIndex={-1} role="status">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function Choice({ name, value, required, defaultChecked, onChange }: { name: string; value: string; required?: boolean; defaultChecked?: boolean; onChange?: () => void }) {
  return (
    <label className="choice">
      <input type="radio" name={name} value={value} required={required} defaultChecked={defaultChecked} onChange={onChange} />
      <span>{value}</span>
    </label>
  );
}

function Foot({ label, sending, error, note }: { label: string; sending: boolean; error: string; note: string }) {
  return (
    <>
      {error && (
        <p className="form-error wide" role="alert">
          {error}
        </p>
      )}
      <div className="form-foot">
        <button className="button" type="submit" disabled={sending}>
          {sending ? "Sender …" : label} <span aria-hidden="true">→</span>
        </button>
        <p className="form-note">{note}</p>
        <p className="privacy-note">
          Hva vi lagrer, står i <Link href="/personvern">personvern</Link>.
        </p>
      </div>
    </>
  );
}

function InterestForm() {
  const { status, error, submit } = useFormspree("Nytt interesseskjema for opptak — Iqra Senter");
  const [needs, setNeeds] = useState(false);
  const [otherTongue, setOtherTongue] = useState(false);
  if (status === "sent") return <Thanks title="Takk for din interesse!" text="Vi har registrert interessen din og kontakter deg når det blir ledige plasser." />;
  return (
    <form className="form-grid" onSubmit={submit}>
      <input type="text" name="_gotcha" className="trap" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <div className="field wide">
        <label htmlFor="barn-navn">Barnets fulle navn</label>
        <input className="input" id="barn-navn" name="child_name" maxLength={100} type="text" autoComplete="name" required />
      </div>
      <div className="field">
        <label htmlFor="barn-fodt">Fødselsdato</label>
        <input className="input" id="barn-fodt" name="date_of_birth" type="date" required />
      </div>
      <div className="field">
        <label htmlFor="barn-trinn">Klassetrinn</label>
        <select className="input" id="barn-trinn" name="grade" required defaultValue="">
          <option value="" disabled>
            Velg klassetrinn
          </option>
          {GRADES.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="for-epost">Foresattes e-post</label>
        <input className="input" id="for-epost" name="email" maxLength={254} type="email" autoComplete="email" spellCheck={false} placeholder="forelder@epost.no" required />
      </div>
      <div className="field">
        <label htmlFor="for-tlf">Foresattes telefon</label>
        <input className="input" id="for-tlf" name="parent_phone" maxLength={30} type="tel" autoComplete="tel" placeholder="+47 XXX XX XXX" required />
      </div>
      <div className="field wide">
        <label htmlFor="adresse">Adresse</label>
        <input className="input" id="adresse" name="address" maxLength={200} type="text" autoComplete="street-address" placeholder="Gateadresse, postnummer og sted" required />
      </div>
      <fieldset className="choice-group wide">
        <legend>Samtykker du til at barnet ditt kan bli fotografert eller filmet?</legend>
        <div className="choices">
          <Choice name="photo_consent" value="Ja" required />
          <Choice name="photo_consent" value="Nei" />
        </div>
      </fieldset>
      <fieldset className="choice-group wide">
        <legend>Har barnet ditt noen spesielle behov vi bør vite om?</legend>
        <div className="choices">
          <Choice name="has_special_needs" value="Ja" onChange={() => setNeeds(true)} />
          <Choice name="has_special_needs" value="Nei" defaultChecked onChange={() => setNeeds(false)} />
        </div>
        {needs && <textarea className="input extra" name="special_needs_details" maxLength={1000} rows={3} placeholder="Beskriv eventuelle behov her…" aria-label="Beskriv spesielle behov" />}
      </fieldset>
      <fieldset className="choice-group wide">
        <legend>Kan barnet ditt flytende arabisk?</legend>
        <div className="choices">
          <Choice name="fluent_arabic" value="Ja" required />
          <Choice name="fluent_arabic" value="Nei" />
        </div>
      </fieldset>
      <fieldset className="choice-group wide">
        <legend>Hva er morsmålet?</legend>
        <div className="choices">
          <Choice name="mother_tongue_type" value="Somali" defaultChecked onChange={() => setOtherTongue(false)} />
          <Choice name="mother_tongue_type" value="Annet" onChange={() => setOtherTongue(true)} />
        </div>
        {otherTongue && <input className="input extra" name="mother_tongue_other" type="text" placeholder="Skriv morsmålet her…" aria-label="Annet morsmål" />}
      </fieldset>
      <Foot label="Send interessemelding" sending={status === "sending"} error={error} note="Fødselsnummer gir dere oss ved innmelding, ikke her." />
    </form>
  );
}

function MembershipForm() {
  const { status, error, submit } = useFormspree("Ny medlemsregistrering — Iqra Senter");
  if (status === "sent") return <Thanks title="Takk for din registrering!" text="Vi har mottatt søknaden din og tar kontakt med deg snart." />;
  return (
    <form className="form-grid" onSubmit={submit}>
      <input type="text" name="_gotcha" className="trap" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <div className="field wide">
        <label htmlFor="m-navn">Fullt navn</label>
        <input className="input" id="m-navn" name="name" maxLength={100} type="text" autoComplete="name" required />
      </div>
      <div className="field">
        <label htmlFor="m-epost">E-postadresse</label>
        <input className="input" id="m-epost" name="email" maxLength={254} type="email" autoComplete="email" spellCheck={false} placeholder="din@epost.no" required />
      </div>
      <div className="field">
        <label htmlFor="m-tlf">Telefon</label>
        <input className="input" id="m-tlf" name="phone" maxLength={30} type="tel" autoComplete="tel" placeholder="+47 XXX XX XXX" required />
      </div>
      <div className="field wide">
        <label htmlFor="m-adresse">Adresse</label>
        <input className="input" id="m-adresse" name="address" maxLength={200} type="text" autoComplete="street-address" placeholder="Gateadresse, postnummer og sted" required />
      </div>
      <div className="field">
        <label htmlFor="m-antall">Antall familiemedlemmer</label>
        <input className="input" id="m-antall" name="family_members" type="number" min={1} max={20} placeholder="F.eks. 4" required />
      </div>
      <div className="field wide">
        <label htmlFor="m-melding">Melding (valgfritt)</label>
        <textarea className="input" id="m-melding" name="message" maxLength={2000} rows={3} placeholder="Er det noe du vil fortelle oss?" />
      </div>
      <Foot label="Send inn søknad" sending={status === "sending"} error={error} note="Fødselsnummer tas med ved oppmøte. Vi samler ikke inn sensitive opplysninger her." />
    </form>
  );
}

function Ask() {
  const rows: { href: string; small: string; value: string }[] = [
    { href: "tel:+4799864331", small: "Ring oss", value: "+47 998 64 331" },
    { href: "mailto:info@iqrasenter.net", small: "Skriv en e-post", value: "info@iqrasenter.net" },
    { href: "https://wa.me/4799864331", small: "Send en melding", value: "WhatsApp" },
  ];
  return (
    <div className="ask">
      {rows.map((r) => (
        <a key={r.href} href={r.href}>
          <span>
            <small>{r.small}</small>
            <span className="ask-value">{r.value}</span>
          </span>
          <span aria-hidden="true">↗</span>
        </a>
      ))}
    </div>
  );
}

const ROOMS: Record<(typeof DOORS)[number]["id"], { title: string; text: string; body: ReactNode }> = {
  skole: { title: "Interessemelding", text: "Barnet kommer på ventelisten. Vi tar kontakt når en plass blir ledig.", body: <InterestForm /> },
  medlem: { title: "Familiemedlemskap", text: "Hele husstanden blir med på aktiviteter, kurs og arrangementer.", body: <MembershipForm /> },
  sporsmal: { title: "Spør oss om alt", text: "Vi svarer så godt vi kan.", body: <Ask /> },
};

// "Hvilken dør er din?": three boxes side by side. The chosen one turns green and its room opens below.
// Any link on the page with data-open-door="<index>" opens that door too.
export function MemberDoors() {
  const [open, setOpen] = useState(0);
  const [entered, setEntered] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function choose(i: number, focus = false) {
    setOpen(i);
    setEntered((n) => n + 1);
    if (focus) tabs.current[i]?.focus();
  }

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest<HTMLElement>("[data-open-door]");
      if (link) choose(Number(link.dataset.openDoor) || 0);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const n = DOORS.length;
    const to = { ArrowRight: (i + 1) % n, ArrowDown: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, ArrowUp: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    choose(to, true);
  }

  return (
    <section className="doors-section" id="dorer" aria-labelledby="dorer-title">
      <div className="head">
        <h2 id="dorer-title">Hvilken dør er din?</h2>
        <p>En skoleplass og et medlemskap er to forskjellige ting.</p>
      </div>
      <div className="doors" role="tablist" aria-label="Hva trenger dere?">
        {DOORS.map((d, i) => (
          <button
            key={d.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            className="door"
            type="button"
            role="tab"
            id={`dor-${d.id}`}
            aria-controls={`rom-${d.id}`}
            aria-selected={open === i}
            tabIndex={open === i ? 0 : -1}
            onClick={() => choose(i)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <span className="door-name">{d.name}</span>
            <span className="door-sub">{d.sub}</span>
            <span className="door-arrow" aria-hidden="true">
              ↓
            </span>
          </button>
        ))}
      </div>
      <div className="rooms">
        {DOORS.map((d, i) => {
          const room = ROOMS[d.id];
          return (
            <div
              key={d.id}
              className={`room${entered && open === i ? " enter" : ""}`}
              role="tabpanel"
              id={`rom-${d.id}`}
              aria-labelledby={`dor-${d.id}`}
              tabIndex={0}
              hidden={open !== i}
            >
              <div className="room-side">
                <h3>{room.title}</h3>
                <p>{room.text}</p>
              </div>
              <div className="room-main">{room.body}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
