"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, Facebook, Instagram } from "lucide-react";
import { NAV_ITEMS, SITE } from "@/lib/constants";
import { useScrollReader } from "@/lib/scroll-context";


/**
 * Section-aware navbar backgrounds:
 * Index 0 = hero (transparent), 1-4 = white sections, 5 = CTA (dark green)
 */
const SECTION_BG: Record<number, string> = {
  0: "bg-transparent",
  1: "bg-bg border-b border-border/20 shadow-lg",
  2: "bg-bg border-b border-border/20 shadow-lg",
  3: "bg-bg border-b border-border/20 shadow-lg",
  4: "bg-bg border-b border-border/20 shadow-lg",
  5: "bg-primary-dark border-b border-primary-light/20 shadow-lg",
};

/** Whether text should be white on this section */
function useLightText(section: number, isScrolling: boolean) {
  // Hero, CTA, or while scrolling = white text
  return section === 0 || section === 5 || isScrolling;
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { activeSection, isScrolling } = useScrollReader();


  const isHomePage = pathname === "/";

  // On subpages, always use solid background with dark text
  const homeLightText = useLightText(activeSection, isScrolling);
  const lightText = isHomePage ? homeLightText : false;

  // Determine navbar background
  const navBg = !isHomePage
    ? "bg-bg border-b border-border/20 shadow-lg"
    : isScrolling
      ? "bg-transparent"
      : (SECTION_BG[activeSection] ?? "bg-bg border-b border-border/20 shadow-lg");

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navBg}`}
    >
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center cursor-pointer">
            <Image
              src="/images/logo-wide.jpg"
              alt={SITE.name}
              width={177}
              height={50}
              className="h-10 sm:h-12 w-auto object-contain"
              priority
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-200 cursor-pointer ${pathname === item.href
                  ? lightText
                    ? "bg-white/20 text-white font-semibold"
                    : "bg-primary/10 text-primary font-semibold"
                  : lightText
                    ? "text-white/80 hover:text-white hover:bg-white/10"
                    : "text-text-muted hover:text-primary hover:bg-primary/5"
                  }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Desktop Right Side (CTA + Socials) */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-3">
              <a
                href={SITE.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className={`transition-colors duration-200 cursor-pointer ${lightText
                  ? "text-white/80 hover:text-white"
                  : "text-text-muted hover:text-primary"
                  }`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
              <a
                href={SITE.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className={`transition-colors duration-200 cursor-pointer ${lightText
                  ? "text-white/80 hover:text-white"
                  : "text-text-muted hover:text-primary"
                  }`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </a>
            </div>
            {/* CTA button (desktop) */}
            <Link
              href="/stott-oss"
              className="inline-flex items-center px-6 py-2 bg-accent hover:bg-accent-light text-white font-semibold text-sm rounded-full transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer btn-magnetic"
            >
              Støtt oss
            </Link>
          </div>


          {/* Mobile Right Side (Socials + Menu Button) */}
          <div className="flex md:hidden items-center gap-3">
            <div className="flex items-center gap-2">
              <a
                href={SITE.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className={`transition-colors duration-200 cursor-pointer ${lightText ? "text-white/80 hover:text-white" : "text-text-muted hover:text-primary"
                  }`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
              <a
                href={SITE.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className={`transition-colors duration-200 cursor-pointer ${lightText ? "text-white/80 hover:text-white" : "text-text-muted hover:text-primary"
                  }`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </a>
            </div>
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className={`p-1.5 rounded-full cursor-pointer transition-colors ${lightText ? "text-white hover:bg-white/10" : "text-text hover:bg-black/5"
                }`}
              aria-label={mobileOpen ? "Lukk meny" : "Åpne meny"}
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 pt-2 border-t border-border/20 px-4 bg-bg/95 backdrop-blur-md">
            <div className="flex flex-col gap-2">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer ${pathname === item.href
                    ? "bg-primary/10 text-primary"
                    : "text-text hover:text-primary hover:bg-primary/5"
                    }`}
                >
                  {item.label}
                </Link>
              ))}

              <div className="flex justify-center border-t border-border/10 pt-4 mt-2">
                <Link
                  href="/stott-oss"
                  className="w-full text-center px-5 py-3 bg-accent hover:bg-accent-light text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer btn-magnetic"
                >
                  Støtt oss
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
