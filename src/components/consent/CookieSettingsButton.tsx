"use client";

import type { ReactNode } from "react";
import { CONSENT_EVENT } from "./CookieConsent";

// A button that opens the cookie banner again, so a visitor can change their answer.
export function CookieSettingsButton({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(CONSENT_EVENT))}>
      {children}
    </button>
  );
}
