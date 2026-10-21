"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Navbar } from "./Navbar";

// Pages that bring their own header, footer and main element.
const OWN_CHROME = new Set(["/", "/sistenytt", "/nettbutikk", "/bli-medlem", "/kontakt"]);

export function SiteShell({ children, noise }: { children: ReactNode; noise: ReactNode }) {
  const pathname = usePathname();
  if (pathname && OWN_CHROME.has(pathname.replace(/\/$/, "") || "/")) return <>{children}</>;
  return <>{noise}<Navbar /><main id="main">{children}</main></>;
}
