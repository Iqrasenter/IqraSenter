"use client";

import { useState, FormEvent } from "react";
import { Send, CheckCircle } from "lucide-react";

export function BookingForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    // Simulate form submission — replace with real endpoint later
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle size={48} className="text-primary mb-4" />
        <h3 className="font-heading text-xl font-bold text-text">
          Takk for din forespørsel!
        </h3>
        <p className="mt-2 text-text-muted">
          Vi svarer deg innen 1–4 arbeidsdager.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label
            htmlFor="booking-name"
            className="block text-sm font-medium text-text mb-1.5"
          >
            Navn <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="booking-name"
            name="name"
            required
            className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            placeholder="Ditt fulle navn"
          />
        </div>
        <div>
          <label
            htmlFor="booking-email"
            className="block text-sm font-medium text-text mb-1.5"
          >
            E-post <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="booking-email"
            name="email"
            required
            className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            placeholder="din@epost.no"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div>
          <label
            htmlFor="booking-phone"
            className="block text-sm font-medium text-text mb-1.5"
          >
            Telefon
          </label>
          <input
            type="tel"
            id="booking-phone"
            name="phone"
            className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            placeholder="+47 000 00 000"
          />
        </div>
        <div>
          <label
            htmlFor="booking-guests"
            className="block text-sm font-medium text-text mb-1.5"
          >
            Antall personer <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            id="booking-guests"
            name="guests"
            required
            min={1}
            max={120}
            className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            placeholder="f.eks. 30"
          />
        </div>
        <div>
          <label
            htmlFor="booking-date"
            className="block text-sm font-medium text-text mb-1.5"
          >
            Ønsket dato <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="booking-date"
            name="date"
            required
            className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="booking-purpose"
          className="block text-sm font-medium text-text mb-1.5"
        >
          Formål / Hva skal lokalet brukes til?{" "}
          <span className="text-red-500">*</span>
        </label>
        <textarea
          id="booking-purpose"
          name="purpose"
          required
          rows={4}
          className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
          placeholder="Beskriv hva lokalet skal brukes til, f.eks. bursdag, seminar, kurs..."
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-accent hover:bg-accent-light text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {loading ? (
          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <Send size={18} />
            Send forespørsel
          </>
        )}
      </button>
    </form>
  );
}
