"use client";

import Link from "next/link";
import { useRef, type KeyboardEvent, type MouseEvent } from "react";

export type MenuLink = { href: string; label: string; current?: boolean };

export function HomeMenu({ links }: { links: MenuLink[] }) {
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
        <span aria-hidden="true">+</span>
      </summary>
      <nav aria-label="Hovedmeny mobil">
        {links.map((link) => {
          const plain = link.href.startsWith("#") || link.href.startsWith("http");
          const aria = link.current ? ("page" as const) : undefined;
          return plain ? (
            <a key={link.label} href={link.href} aria-current={aria}>
              {link.label}
            </a>
          ) : (
            <Link key={link.label} href={link.href} aria-current={aria}>
              {link.label}
            </Link>
          );
        })}
      </nav>
    </details>
  );
}
