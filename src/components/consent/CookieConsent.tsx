"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { inject } from "@vercel/analytics";
import "./consent.css";

// The site sets no cookies of its own. The only optional thing is visitor statistics (Vercel Web Analytics),
// and it is loaded only after the visitor says yes. The answer is kept in this browser's localStorage.
const KEY = "iqra-samtykke";
export const CONSENT_EVENT = "iqra:cookie-settings";

type Choice = "alle" | "nodvendig";
// What the banner knows: nothing yet (server and first render), the saved answer, no answer saved, or "asked again".
type State = "unknown" | Choice | "ask" | "reopened";

function read(): Choice | null {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "alle" || value === "nodvendig" ? value : null;
  } catch {
    return null;
  }
}

let reopened = false;
let answeredInThisPage: Choice | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function subscribe(listener: () => void) {
  listeners.add(listener);
  const reopen = () => {
    reopened = true;
    notify();
  };
  window.addEventListener(CONSENT_EVENT, reopen);
  return () => {
    listeners.delete(listener);
    window.removeEventListener(CONSENT_EVENT, reopen);
  };
}

function snapshot(): State {
  if (reopened) return "reopened";
  return answeredInThisPage ?? read() ?? "ask";
}

let started = false;
function startStatistics() {
  if (started) return;
  started = true;
  inject();
}

function choose(choice: Choice) {
  try {
    window.localStorage.setItem(KEY, choice);
  } catch {
    // Private mode or blocked storage: the answer lasts until the page is closed.
  }
  answeredInThisPage = choice;
  reopened = false;
  if (choice === "alle") {
    startStatistics();
  } else if (started) {
    // The script is already running on this page; a reload is the only way to stop it.
    window.location.reload();
  }
  notify();
}

export function CookieConsent() {
  const state = useSyncExternalStore(subscribe, snapshot, () => "unknown" as State);

  useEffect(() => {
    if (state === "alle") startStatistics();
  }, [state]);

  if (state !== "ask" && state !== "reopened") return null;
  return (
    <div className="consent" role="dialog" aria-modal="false" aria-labelledby="consent-title">
      <h2 id="consent-title">Anonym besøksstatistikk?</h2>
      <p>
        Vi vil gjerne telle hvor mange som leser hver side. Det bruker ingen informasjonskapsler og følger deg ikke videre. Les mer i{" "}
        <Link href="/personvern">personvern</Link>.
      </p>
      <div className="consent-actions">
        <button type="button" className="consent-yes" onClick={() => choose("alle")}>
          Ja, det er greit
        </button>
        <button type="button" className="consent-no" onClick={() => choose("nodvendig")}>
          Nei takk
        </button>
      </div>
    </div>
  );
}
