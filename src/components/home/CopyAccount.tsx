"use client";

import { useState } from "react";

const ACCOUNT = "1503.67.58535";

export function CopyAccount() {
  const [status, setStatus] = useState("");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ACCOUNT);
      setStatus("Kontonummer kopiert.");
    } catch {
      setStatus("Marker kontonummeret og kopier det manuelt.");
    }
  };
  return (
    <div className="copy-control">
      <button type="button" className="action" onClick={copy} aria-describedby="open-copy-status">
        Kopier kontonummer <span aria-hidden="true">↗</span>
      </button>
      <p id="open-copy-status" className="copy-status" role="status" aria-live="polite">{status}</p>
    </div>
  );
}
