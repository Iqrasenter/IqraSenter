import type { ReactNode } from "react";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/SiteFooter";
import "@/components/home/home.css";
import "@/components/legal/legal.css";

// The shell shared by the privacy and terms pages: header, a title, one column of text, footer.
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="iqra-home legal-page" id="top">
      <a className="skip" href="#main">
        Gå til innhold
      </a>
      <SiteHeader variant="page" current="" />
      <main id="main">
        <h1>{title}</h1>
        <p className="legal-meta">Sist oppdatert {updated}</p>
        <div className="legal-body">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
