# Support Section + Nettbutikk QR Button — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Støtt Oss" support section to the landing page and a QR code toggle button to the Nettbutikk page.

**Architecture:** Two new `"use client"` components (`SupportSection.tsx`, `NettbutikkQRToggle.tsx`) imported into existing server-rendered pages. Uses existing design system utilities (`card-pop`, `SectionHeading`, `FadeIn`, `btn-magnetic`). QR images saved as static assets.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Framer Motion, Lucide React icons

**Spec:** `docs/superpowers/specs/2026-03-28-support-section-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `public/images/qr-stott-oss.png` | Vipps Støtt Oss QR code image (user-provided) |
| `public/images/qr-nettbutikk.png` | Nettbutikk store QR code image (user-provided) |
| `src/components/SupportSection.tsx` | `"use client"` — three support cards with copy-to-clipboard, QR image, and Avtalegiro link |
| `src/components/NettbutikkQRToggle.tsx` | `"use client"` — toggle button that reveals Nettbutikk QR code |
| `src/app/page.tsx` | Import SupportSection, place between Om Oss and CTA |
| `src/app/nettbutikk/page.tsx` | Import NettbutikkQRToggle inside "Slik bestiller du" block |

---

## Chunk 1: Assets + SupportSection Component

### Task 1: Save QR Code Assets

The user provided two QR code images as attachments in the conversation. They need to be saved to the public directory.

**Files:**
- Create: `public/images/qr-stott-oss.png`
- Create: `public/images/qr-nettbutikk.png`

- [ ] **Step 1: Save the Støtt Oss QR code image**

The user attached two QR code images. The first one (Støtt Oss / supporters page QR) should be saved as `public/images/qr-stott-oss.png`. The second one (Nettbutikk QR) should be saved as `public/images/qr-nettbutikk.png`.

Both images are identical-looking QR codes with an orange Vipps smiley logo in the center, but they encode different URLs. The user specified: "one is for the nettbutikk and the other one is for the supporters page."

Since the images were provided as conversation attachments, the implementing agent should ask the user to confirm which image is which, or copy them from the conversation context.

- [ ] **Step 2: Verify images exist**

Run: `ls -la public/images/qr-stott-oss.png public/images/qr-nettbutikk.png`
Expected: Both files present, reasonable file sizes (50KB-500KB)

- [ ] **Step 3: Commit assets**

```bash
git add public/images/qr-stott-oss.png public/images/qr-nettbutikk.png
git commit -m "feat: add QR code images for støtt oss and nettbutikk"
```

---

### Task 2: Create SupportSection Component

**Files:**
- Create: `src/components/SupportSection.tsx`

**References to read first:**
- `src/components/SectionHeading.tsx` — heading pattern (props: title, highlight, subtitle)
- `src/components/FadeIn.tsx` — scroll reveal (props: delay, className, direction)
- `src/app/globals.css` — `card-pop` utility, color tokens
- `src/app/page.tsx:51-59` — example of section structure with SectionHeading + FadeIn (Aktuelt section)

- [ ] **Step 1: Create the component file**

Create `src/components/SupportSection.tsx` with this content:

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Copy, Check } from "lucide-react";
import { SectionHeading } from "@/components/SectionHeading";
import { FadeIn } from "@/components/FadeIn";

const BANK_ACCOUNT = "1503.67.58535";
const AVTALEGIRO_URL =
  "https://nettbutikk.solidus.no/avtalestraks/D6E5B9EA-89CF-43F0-90F0-2BD4039EADD2";

export function SupportSection() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(BANK_ACCOUNT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section id="stott-oss" className="bg-bg-warm py-10 md:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <SectionHeading
            title="Støtt"
            highlight="Oss"
            subtitle="Din støtte gjør en forskjell for familier og barn over hele Norge"
          />
        </FadeIn>

        <div className="mt-8 md:mt-10 grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 items-stretch">
          {/* Vipps Card */}
          <FadeIn delay={0}>
            <div className="bg-white rounded-container-lg card-pop p-8 text-center h-full">
              <div className="w-10 h-[3px] bg-gradient-to-r from-primary to-primary-light rounded-full mx-auto mb-4" />
              <p className="text-xs tracking-widest font-bold text-primary uppercase mb-1">
                Vipps
              </p>
              <p className="font-heading text-3xl font-extrabold text-text mb-2">
                21490
              </p>
              <p className="text-sm text-text-muted leading-relaxed mb-5">
                Åpne Vipps-appen på telefonen, søk på nummeret eller scan
                QR-koden.
              </p>
              <div className="w-[120px] h-[120px] mx-auto rounded-container border border-border/30 overflow-hidden">
                <Image
                  src="/images/qr-stott-oss.png"
                  alt="QR-kode for Vipps nummer 21490"
                  width={120}
                  height={120}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </FadeIn>

          {/* Avtalegiro Card */}
          <FadeIn delay={0.1}>
            <div className="bg-white rounded-container-lg card-pop p-8 text-center h-full flex flex-col">
              <div className="w-10 h-[3px] bg-gradient-to-r from-primary to-primary-light rounded-full mx-auto mb-4" />
              <p className="text-xs tracking-widest font-bold text-primary uppercase mb-1">
                Avtalegiro
              </p>
              <p className="font-heading text-2xl font-extrabold text-text mb-2">
                Fast støtte
              </p>
              <p className="text-sm text-text-muted leading-relaxed mb-6 flex-1">
                Sett opp et fast månedlig trekk fra kontoen din — velg beløp
                selv, og støtt oss automatisk.
              </p>
              <a
                href={AVTALEGIRO_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Opprett Avtalegiro (åpnes i ny fane)"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary-light text-white font-heading font-semibold rounded-container transition-colors duration-300 shadow-lg btn-magnetic text-sm"
              >
                Opprett Avtalegiro
                <ArrowRight size={16} />
              </a>
            </div>
          </FadeIn>

          {/* Bank Card */}
          <FadeIn delay={0.2}>
            <div className="bg-white rounded-container-lg card-pop p-8 text-center h-full flex flex-col">
              <div className="w-10 h-[3px] bg-gradient-to-r from-primary to-primary-light rounded-full mx-auto mb-4" />
              <p className="text-xs tracking-widest font-bold text-primary uppercase mb-1">
                Bankoverføring
              </p>
              <p className="font-data text-xl font-extrabold text-text tracking-wide mb-2">
                {BANK_ACCOUNT}
              </p>
              <p className="text-sm text-text-muted leading-relaxed mb-6 flex-1">
                Overfør direkte fra nettbanken din. Merk betalingen med
                «Støtte».
              </p>
              <button
                onClick={handleCopy}
                aria-label="Kopier kontonummer til utklippstavlen"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-accent font-heading font-medium rounded-full transition-[border-color] duration-300 btn-magnetic text-sm border-2 border-accent/25 hover:border-accent"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Kopiert!" : "Kopier kontonummer"}
              </button>
            </div>
          </FadeIn>
        </div>

        <FadeIn delay={0.25}>
          <div className="mt-6 md:mt-8 text-center">
            <Link
              href="/stott-oss"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-accent font-heading font-medium rounded-full transition-[border-color] duration-300 btn-magnetic text-sm border-2 border-accent/25 hover:border-accent"
            >
              Se alle måter å støtte oss på
              <ArrowRight size={16} />
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors related to SupportSection.tsx

- [ ] **Step 3: Commit**

```bash
git add src/components/SupportSection.tsx
git commit -m "feat: create SupportSection component with Vipps, Avtalegiro, and bank cards"
```

---

### Task 3: Add SupportSection to Landing Page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Import SupportSection**

At the top of `src/app/page.tsx`, add after the existing component imports (after line 11):

```tsx
import { SupportSection } from "@/components/SupportSection";
```

- [ ] **Step 2: Add section between Om Oss and CTA**

In `src/app/page.tsx`, insert the `<SupportSection />` between the closing `</section>` of `id="om-oss"` (line 130) and the comment `{/* ===== CTA BANNER & FOOTER ===== */}` (line 132). Place it before the CTA comment:

```tsx
      {/* ===== STØTT OSS ===== */}
      <SupportSection />

      {/* ===== CTA BANNER & FOOTER ===== */}
```

- [ ] **Step 3: Verify build compiles**

Run: `npm run build` (or `npx next build`)
Expected: Build succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add support section to landing page between Om Oss and CTA"
```

---

## Chunk 2: NettbutikkQRToggle Component

### Task 4: Create NettbutikkQRToggle Component

**Files:**
- Create: `src/components/NettbutikkQRToggle.tsx`

**References to read first:**
- `src/app/nettbutikk/page.tsx` — current page structure, especially the "Slik bestiller du" block (lines 44-68)
- `src/app/globals.css` — button styles, `card-pop`, `rounded-container`

- [ ] **Step 1: Create the component file**

Create `src/components/NettbutikkQRToggle.tsx`:

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { Smartphone, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export function NettbutikkQRToggle() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-5 flex flex-col items-center">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-light text-white font-heading font-semibold rounded-container transition-colors duration-300 shadow-lg btn-magnetic text-sm"
      >
        <Smartphone size={16} />
        Scan & handle i appen
        <ChevronDown
          size={14}
          className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-4 bg-white rounded-container-lg card-pop p-5 text-center">
              <div className="w-[150px] h-[150px] mx-auto rounded-container border border-border/30 overflow-hidden">
                <Image
                  src="/images/qr-nettbutikk.png"
                  alt="QR-kode for Iqra nettbutikk"
                  width={150}
                  height={150}
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="mt-3 text-sm text-text-muted">
                Scan for å åpne nettbutikken
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors related to NettbutikkQRToggle.tsx

- [ ] **Step 3: Commit**

```bash
git add src/components/NettbutikkQRToggle.tsx
git commit -m "feat: create NettbutikkQRToggle component with animated reveal"
```

---

### Task 5: Add QR Toggle to Nettbutikk Page

**Files:**
- Modify: `src/app/nettbutikk/page.tsx`

- [ ] **Step 1: Import the component**

At the top of `src/app/nettbutikk/page.tsx`, add:

```tsx
import { NettbutikkQRToggle } from "@/components/NettbutikkQRToggle";
```

- [ ] **Step 2: Add toggle inside the "Slik bestiller du" block**

In `src/app/nettbutikk/page.tsx`, insert `<NettbutikkQRToggle />` after the closing `</ol>` tag (line 66) and before the closing `</div>` of the instruction card (line 67):

```tsx
                </ol>
                <NettbutikkQRToggle />
              </div>
```

- [ ] **Step 3: Verify build compiles**

Run: `npm run build` (or `npx next build`)
Expected: Build succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/nettbutikk/page.tsx
git commit -m "feat: add QR code toggle button to nettbutikk page"
```

---

## Chunk 3: Visual Verification

### Task 6: Verify Both Features Visually

- [ ] **Step 1: Start dev server and verify landing page support section**

Run: `npm run dev`
Navigate to `http://localhost:3000`
Scroll to the section between "Om Oss" and the CTA banner.

Verify:
- Section heading shows "Støtt Oss" with green highlight
- Three cards display with card-pop shadows
- Green accent bars visible at top of each card
- Vipps card shows "21490" and the QR code image
- Avtalegiro card shows "Fast støtte" and green CTA button
- Bank card shows "1503.67.58535" in monospace
- Copy button changes to "Kopiert!" on click
- Avtalegiro button opens Solidus URL in new tab
- Bottom link goes to /stott-oss
- Cards stack vertically on mobile
- FadeIn animation works on scroll

- [ ] **Step 2: Verify Nettbutikk QR toggle**

Navigate to `http://localhost:3000/nettbutikk`

Verify:
- "Scan & handle i appen" button appears inside the "Slik bestiller du" card
- Clicking the button reveals the QR code with smooth animation
- Clicking again hides it
- QR code image displays correctly
- Chevron icon rotates on toggle

- [ ] **Step 3: Fix any visual issues found**

If any issues are found, fix them and commit.

- [ ] **Step 4: Final commit if any fixes were made**

```bash
git add -A
git commit -m "fix: visual adjustments to support section and nettbutikk QR toggle"
```
