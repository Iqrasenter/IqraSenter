"use client";

import { useState, FormEvent } from "react";
import { Send, CheckCircle, AlertCircle } from "lucide-react";

const WEB3FORMS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_KEY || "";

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = e.currentTarget;
    const data = new FormData(form);
    data.append("access_key", WEB3FORMS_KEY);
    data.append("subject", "Ny henvendelse — Iqra Senter");
    data.append("from_name", "Iqra Senter Nettside");

    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: data,
      });
      const json = await res.json();
      if (json.success) {
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
          Takk for din henvendelse!
        </h3>
        <p className="mt-2 text-text-muted">
          Vi svarer deg så raskt som mulig.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Honeypot for spam */}
      <input type="checkbox" name="botcheck" className="hidden" />

      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-text mb-1.5"
        >
          Navn
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          placeholder="Ditt fulle navn"
        />
      </div>
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-text mb-1.5"
        >
          E-postadresse
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          placeholder="din@epost.no"
        />
      </div>
      <div>
        <label
          htmlFor="message"
          className="block text-sm font-medium text-text mb-1.5"
        >
          Melding
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={4}
          className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
          placeholder="Skriv din melding her..."
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-primary hover:bg-primary-light text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {loading ? (
          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <Send size={18} />
            Send melding
          </>
        )}
      </button>
    </form>
  );
}
