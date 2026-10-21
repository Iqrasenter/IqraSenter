"use client";

import { useState } from "react";

const QUESTIONS = [
  { tab: "Ventetid", q: "Hvor lenge må vi vente?", a: "Det kan vi dessverre ikke love. Vi vet ikke når neste plass blir ledig, men vi tar kontakt så snart det skjer." },
  { tab: "Hvem", q: "Hvem kan få plass?", a: "Jenter og gutter fra 1. til 10. klasse." },
  { tab: "Når", q: "Når er helgeskolen?", a: "Hver lørdag og søndag. Spør oss gjerne om timeplanen." },
  { tab: "Medlemskap", q: "Er medlemskap det samme som skoleplass?", a: "Nei. Skoleplassen får dere gjennom ventelisten. Medlemskap gir hele husstanden tilgang til aktiviteter, kurs og arrangementer." },
  { tab: "Mens dere venter", q: "Kan barnet være med på noe før det får plass?", a: "Sommerskolen i 2026 var åpen også for barn på ventelisten. Spør oss om hva som skjer neste gang." },
] as const;

// "Det dere lurer på": cards with arched tabs, filed like a drawer. One open at a time.
export function MemberFaq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="cards">
      {QUESTIONS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q} className={`card${isOpen ? " open" : ""}`} style={{ ["--i" as string]: i }}>
            <h3>
              <button type="button" id={`q${i}`} aria-expanded={isOpen} aria-controls={`a${i}`} onClick={() => setOpen(isOpen ? null : i)}>
                <span className="tab">{item.tab}</span>
                <span className="q">{item.q}</span>
                <span className="pm" aria-hidden="true" />
              </button>
            </h3>
            <div className="a" id={`a${i}`} role="region" aria-labelledby={`q${i}`} hidden={!isOpen}>
              <p>{item.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
