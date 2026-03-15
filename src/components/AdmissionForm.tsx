"use client";

import { useState, FormEvent } from "react";
import { Send, CheckCircle, AlertCircle } from "lucide-react";

const WEB3FORMS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_KEY || "";

const GRADE_OPTIONS = [
  "1. klasse",
  "2. klasse",
  "3. klasse",
  "4. klasse",
  "5. klasse",
  "6. klasse",
  "7. klasse",
  "8. klasse",
  "9. klasse",
  "10. klasse",
];

export function AdmissionForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSpecialNeeds, setHasSpecialNeeds] = useState(false);
  const [motherTongue, setMotherTongue] = useState<"somali" | "other">("somali");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = e.currentTarget;
    const data = new FormData(form);
    data.append("access_key", WEB3FORMS_KEY);
    data.append("subject", "Nytt interesseskjema for opptak — Iqra Senter");
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
          Takk for din interesse!
        </h3>
        <p className="mt-2 text-text-muted">
          Vi har registrert interessen din og kontakter deg når det blir ledige plasser.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full px-4 py-3 rounded-xl border border-border bg-white text-text placeholder:text-text-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Honeypot for spam */}
      <input type="checkbox" name="botcheck" className="hidden" />

      {/* Child's full name */}
      <div>
        <label htmlFor="admission-child-name" className="block text-sm font-medium text-text mb-1.5">
          Barnets fulle navn
        </label>
        <input
          type="text"
          id="admission-child-name"
          name="child_name"
          required
          autoComplete="name"
          className={inputClass}
          placeholder="Barnets fulle navn"
        />
      </div>

      {/* Date of birth + Grade */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="admission-dob" className="block text-sm font-medium text-text mb-1.5">
            Fødselsdato
          </label>
          <input
            type="date"
            id="admission-dob"
            name="date_of_birth"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="admission-grade" className="block text-sm font-medium text-text mb-1.5">
            Klassetrinn
          </label>
          <select
            id="admission-grade"
            name="grade"
            required
            className={inputClass}
            defaultValue=""
          >
            <option value="" disabled>
              Velg klassetrinn
            </option>
            {GRADE_OPTIONS.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Parent email + phone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="admission-email" className="block text-sm font-medium text-text mb-1.5">
            Foresattes e-post
          </label>
          <input
            type="email"
            id="admission-email"
            name="parent_email"
            required
            autoComplete="email"
            spellCheck={false}
            className={inputClass}
            placeholder="forelder@epost.no"
          />
        </div>
        <div>
          <label htmlFor="admission-phone" className="block text-sm font-medium text-text mb-1.5">
            Foresattes telefon
          </label>
          <input
            type="tel"
            id="admission-phone"
            name="parent_phone"
            required
            autoComplete="tel"
            className={inputClass}
            placeholder="+47 XXX XX XXX"
          />
        </div>
      </div>

      {/* Address */}
      <div>
        <label htmlFor="admission-address" className="block text-sm font-medium text-text mb-1.5">
          Adresse
        </label>
        <input
          type="text"
          id="admission-address"
          name="address"
          required
          autoComplete="street-address"
          className={inputClass}
          placeholder="Gateadresse, postnummer og sted"
        />
      </div>

      {/* Photo/video consent */}
      <fieldset>
        <legend className="block text-sm font-medium text-text mb-2">
          Samtykker du til at barnet ditt kan bli fotografert eller filmet?
        </legend>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="photo_consent"
              value="Ja"
              required
              className="w-4 h-4 text-primary accent-primary"
            />
            <span className="text-sm text-text">Ja</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="photo_consent"
              value="Nei"
              className="w-4 h-4 text-primary accent-primary"
            />
            <span className="text-sm text-text">Nei</span>
          </label>
        </div>
      </fieldset>

      {/* Special needs */}
      <fieldset>
        <legend className="block text-sm font-medium text-text mb-2">
          Har barnet ditt noen spesielle behov vi bør vite om?
        </legend>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="has_special_needs"
              value="Ja"
              onChange={() => setHasSpecialNeeds(true)}
              className="w-4 h-4 text-primary accent-primary"
            />
            <span className="text-sm text-text">Ja</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="has_special_needs"
              value="Nei"
              defaultChecked
              onChange={() => setHasSpecialNeeds(false)}
              className="w-4 h-4 text-primary accent-primary"
            />
            <span className="text-sm text-text">Nei</span>
          </label>
        </div>
        {hasSpecialNeeds && (
          <textarea
            name="special_needs_details"
            rows={3}
            className={`${inputClass} mt-3 resize-none`}
            placeholder="Beskriv eventuelle behov her\u2026"
            aria-label="Beskriv spesielle behov"
          />
        )}
      </fieldset>

      {/* Fluent Arabic */}
      <fieldset>
        <legend className="block text-sm font-medium text-text mb-2">
          Kan barnet ditt flytende arabisk?
        </legend>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="fluent_arabic"
              value="Ja"
              required
              className="w-4 h-4 text-primary accent-primary"
            />
            <span className="text-sm text-text">Ja</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="fluent_arabic"
              value="Nei"
              className="w-4 h-4 text-primary accent-primary"
            />
            <span className="text-sm text-text">Nei</span>
          </label>
        </div>
      </fieldset>

      {/* Mother tongue */}
      <fieldset>
        <legend className="block text-sm font-medium text-text mb-2">
          Hva er morsmålet?
        </legend>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="mother_tongue_type"
              value="Somali"
              defaultChecked
              onChange={() => setMotherTongue("somali")}
              className="w-4 h-4 text-primary accent-primary"
            />
            <span className="text-sm text-text">Somali</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="mother_tongue_type"
              value="Annet"
              onChange={() => setMotherTongue("other")}
              className="w-4 h-4 text-primary accent-primary"
            />
            <span className="text-sm text-text">Annet</span>
          </label>
        </div>
        {motherTongue === "other" && (
          <input
            type="text"
            name="mother_tongue_other"
            className={`${inputClass} mt-3`}
            placeholder="Skriv morsmålet her\u2026"
            aria-label="Annet morsmål"
          />
        )}
      </fieldset>

      {/* Error message */}
      {error && (
        <div aria-live="polite" className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-accent hover:bg-accent-light text-white font-bold rounded-xl transition-[background-color,box-shadow] duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {loading ? (
          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <Send size={18} />
            Send interessemelding
          </>
        )}
      </button>
    </form>
  );
}
