"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Navbar } from "./Navbar";

export function SiteShell({ children, noise }: { children: ReactNode; noise: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/") return <>{children}</>;
  return <>{noise}<Navbar /><main id="main">{children}</main></>;
}
