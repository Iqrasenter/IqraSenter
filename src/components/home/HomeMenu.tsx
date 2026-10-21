"use client";

import Link from "next/link";
import { useRef, type KeyboardEvent, type MouseEvent } from "react";

export function HomeMenu() {
  const menu = useRef<HTMLDetailsElement>(null);
  const onKeyDown = (event: KeyboardEvent<HTMLDetailsElement>) => {
    if (event.key !== "Escape" || !menu.current) return;
    menu.current.open = false;
    menu.current.querySelector("summary")?.focus();
  };
  const closeOnNavigation = (event: MouseEvent<HTMLDetailsElement>) => {
    if (event.target instanceof Element && event.target.closest("a") && menu.current) menu.current.open = false;
  };
  return (
    <details className="mobile-menu" ref={menu} onKeyDown={onKeyDown} onClick={closeOnNavigation}>
      <summary>
        Meny
        <span aria-hidden="true">
          +
        </span>
      </summary>
      <nav aria-label="Hovedmeny mobil">
        <a href="#nyheter">
          Siste nytt
        </a>
        <Link href="/nettbutikk">
          Nettbutikk
        </Link>
        <Link href="/bli-medlem">
          Bli medlem / opptak
        </Link>
        <a href="#om-iqra">
          Om oss
        </a>
        <a href="#kontakt">
          Kontakt oss
        </a>
        <a href="https://portal.iqrasenter.no">
          Logg inn ↗
        </a>
        <a href="#stott-iqra">
          Støtt oss ↓
        </a>
      </nav>
    </details>
  );
}
