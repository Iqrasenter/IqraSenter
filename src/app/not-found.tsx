import Link from "next/link";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/SiteFooter";
import "@/components/home/home.css";
import "@/components/home/motion.css";
import "@/components/news/news.css";

export default function NotFound() {
  return (
    <div className="iqra-home news-page" id="top">
      <SiteHeader variant="page" current="" />
      <main id="main" style={{ padding: "96px var(--page-gutter) 120px" }}>
        <h1 style={{ fontSize: "clamp(40px, 6vw, 72px)" }}>Fant ikke siden.</h1>
        <p style={{ marginTop: 16 }}>
          Siden du lette etter finnes ikke lenger. <Link href="/">Gå til forsiden →</Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
