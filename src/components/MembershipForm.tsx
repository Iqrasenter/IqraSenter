"use client";

import { useState, FormEvent } from "react";
import { Send, CheckCircle, AlertCircle } from "lucide-react";

const FORMSPREE_ID = process.env.NEXT_PUBLIC_FORMSPREE_ID || "";

export function MembershipForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = e.currentTarget;
    const data = new FormData(form);
    data.append("_subject", "Ny medlemsregistrering — Iqra Senter");

    try {
      const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError("Noe gikk galt. Vennligst prøv igjen eller kontakt oss direkte.");
      }
    } catch {
      setError("Kunne ikke sende skjemaet. Sjekk internettforbindelsen din og prøv igjen.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle size={48} className="text-primary mb-4" />
        <h3 className="font-heading text-xl font-bold text-text">
          Takk for din registrering!
        </h3>
        <p className="mt-2 text-text-muted">
          Vi har mottatt søknaden din og tar kontakt med deg snart.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 lg:space-y-5">
      {/* Honeypot for spam */}
      <input type="text" name="_gotcha" className="hidden" tabIndex={-1} autoComplete="off" />

      <div>
        <label
          htmlFor="member-name"
          className="block text-xs lg:text-sm font-medium text-text mb-1"
        >
          Fullt navn
        </label>
        <input
          type="text"
          id="member-name"
          name="name"
          required
          autoComplete="name"
          className="w-full px-3 lg:px-4 py-2 lg:py-3 rounded-xl border border-border bg-white text-sm lg:text-base text-text placeholder:text-text-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors shadow-sm"
          placeholder="Ditt fulle navn"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-5">
        <div>
          <label
            htmlFor="member-email"
            className="block text-xs lg:text-sm font-medium text-text mb-1"
          >
            E-postadresse
          </label>
          <input
            type="email"
            id="member-email"
            name="email"
            required
            autoComplete="email"
            spellCheck={false}
            className="w-full px-3 lg:px-4 py-2 lg:py-3 rounded-xl border border-border bg-white text-sm lg:text-base text-text placeholder:text-text-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors shadow-sm"
            placeholder="din@epost.no"
          />
        </div>
        <div>
          <label
            htmlFor="member-phone"
            className="block text-xs lg:text-sm font-medium text-text mb-1"
          >
            Telefon
          </label>
          <input
            type="tel"
            id="member-phone"
            name="phone"
            required
            autoComplete="tel"
            className="w-full px-3 lg:px-4 py-2 lg:py-3 rounded-xl border border-border bg-white text-sm lg:text-base text-text placeholder:text-text-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors shadow-sm"
            placeholder="+47 XXX XX XXX"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="member-address"
          className="block text-xs lg:text-sm font-medium text-text mb-1"
        >
          Adresse
        </label>
        <input
          type="text"
          id="member-address"
          name="address"
          required
          autoComplete="street-address"
          className="w-full px-3 lg:px-4 py-2 lg:py-3 rounded-xl border border-border bg-white text-sm lg:text-base text-text placeholder:text-text-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors shadow-sm"
          placeholder="Gateadresse, postnummer og sted"
        />
      </div>

      <div>
        <label
          htmlFor="member-family"
          className="block text-xs lg:text-sm font-medium text-text mb-1"
        >
          Antall familiemedlemmer
        </label>
        <input
          type="number"
          id="member-family"
          name="family_members"
          required
          min={1}
          max={20}
          className="w-full px-3 lg:px-4 py-2 lg:py-3 rounded-xl border border-border bg-white text-sm lg:text-base text-text placeholder:text-text-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors shadow-sm"
          placeholder="F.eks. 4"
        />
      </div>

      <div>
        <label
          htmlFor="member-message"
          className="block text-xs lg:text-sm font-medium text-text mb-1"
        >
          Melding <span className="text-text-muted font-normal">(valgfritt)</span>
        </label>
        <textarea
          id="member-message"
          name="message"
          rows={3}
          className="w-full px-3 lg:px-4 py-2 lg:py-3 rounded-xl border border-border bg-white text-sm lg:text-base text-text placeholder:text-text-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors shadow-sm resize-none"
          placeholder="Er det noe du vil fortelle oss?"
        />
      </div>

      <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 lg:p-4 text-xs lg:text-sm text-text-muted">
        <strong className="text-text">Merk:</strong> Fødselsnummer (personnummer) for
        familiemedlemmer tas med ved oppmøte eller leveres via sikker kanal. Vi samler
        ikke inn sensitive personopplysninger gjennom dette skjemaet.
      </div>

      {error && (
        <div aria-live="polite" className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-5 lg:px-6 py-2.5 lg:py-3.5 text-sm lg:text-base bg-accent hover:bg-accent-light text-white font-bold rounded-xl transition-[background-color,box-shadow] duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {loading ? (
          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <Send size={18} />
            Send inn søknad
          </>
        )}
      </button>
    </form>
  );
}
