# Support Section + Nettbutikk QR Button — Design Spec

## Overview

Two additions to the Iqra website:

1. **"Støtt Oss" section on the landing page** — three card layout showing ways to support the organization
2. **QR code button on the Nettbutikk page** — reveals the store QR code for mobile scanning

## 1. Landing Page — Støtt Oss Section

### Placement

Between the "Om Oss" section (`id="om-oss"`) and the CTA banner (`id="cta"`) in `src/app/page.tsx`.

Section attributes: `id="stott-oss"`, `className="bg-bg-warm py-10 md:py-16"` (uses the warm off-white `#F4F7F2` to provide visual separation from the adjacent white sections).

### Structure

- Uses existing `SectionHeading` component: title="Støtt", highlight="Oss", subtitle="Din støtte gjør en forskjell for familier og barn over hele Norge"
- Uses existing `FadeIn` component for scroll-triggered reveal
- Three cards in a responsive grid (`grid-cols-1 lg:grid-cols-3`) — uses `lg` breakpoint (1024px) to ensure cards have enough width for QR code + text
- Bottom link to `/stott-oss` page using existing accent outline button style

### Card Design

All three cards use:
- `bg-white rounded-container-lg card-pop` (existing utilities)
- Green gradient accent bar at top: 40px wide, 3px tall, `bg-gradient-to-r from-primary to-primary-light`, centered with `mx-auto`
- Uppercase `text-xs tracking-widest font-bold` label in `text-primary`
- Instruction text in `text-text-muted text-sm`, `font-body`, `leading-relaxed`
- Padding: `p-8`, text centered

#### Card 1 — Vipps (left)
- Label: "VIPPS"
- Value: "21490" in `font-heading text-3xl font-extrabold`
- Instruction: "Åpne Vipps-appen på telefonen, søk på nummeret eller scan QR-koden."
- QR code: Støtt Oss QR image via Next.js `Image` component, 120x120, `rounded-container`, subtle `border border-border/30`
- Alt text: `"QR-kode for Vipps nummer 21490"`

#### Card 2 — Avtalegiro (center)
- Label: "AVTALEGIRO"
- Value: "Fast støtte" in `font-heading text-2xl font-extrabold`
- Instruction: "Sett opp et fast månedlig trekk fra kontoen din — velg beløp selv, og støtt oss automatisk."
- CTA button: "Opprett Avtalegiro →" — `bg-primary hover:bg-primary-light text-white rounded-container font-heading font-semibold shadow-lg btn-magnetic`
- Links to `https://nettbutikk.solidus.no/avtalestraks/D6E5B9EA-89CF-43F0-90F0-2BD4039EADD2`
- Attributes: `target="_blank" rel="noopener noreferrer"`

#### Card 3 — Bankoverføring (right)
- Label: "BANKOVERFØRING"
- Value: "1503.67.58535" in `font-data text-xl font-extrabold`
- Instruction: "Overfør direkte fra nettbanken din. Merk betalingen med «Støtte»."
- Copy button: accent brown outline style (`border-2 border-accent/25 hover:border-accent text-accent rounded-full font-heading font-medium`), uses `navigator.clipboard.writeText()`
- Copy feedback: button text changes to "Kopiert!" for 2 seconds, then reverts to "Kopier kontonummer"

### Responsive Behavior

- Desktop (lg+): 3-column grid with `gap-5`
- Tablet/Mobile (<1024px): single column stack, cards full width, `gap-4`
- Cards maintain equal height via `items-stretch` on the grid

### Animation

- Section fades in on scroll using existing `FadeIn` component
- Cards get staggered delay (0, 0.1, 0.2)

### Accessibility

- QR code images have descriptive `alt` text
- Copy button has `aria-label="Kopier kontonummer til utklippstavlen"`
- Avtalegiro link has `aria-label="Opprett Avtalegiro (åpnes i ny fane)"`
- All interactive elements are keyboard-accessible

## 2. Nettbutikk Page — QR Code Button

### Placement

Inside the existing "Slik bestiller du" instruction card in `src/app/nettbutikk/page.tsx` (lines 44-68), added as a 5th step or as a separate block immediately after the `<ol>` grid. This is the natural location since QR scanning is an alternative to the 4-step manual Vipps process.

### Architecture

The nettbutikk page is a **Server Component** (exports `metadata`). The QR toggle requires client-side state, so it must be a separate `"use client"` component: `src/components/NettbutikkQRToggle.tsx`. This component is imported into the server page as a child.

### Design

- Button: "Scan & handle i appen" — `bg-primary hover:bg-primary-light text-white rounded-container font-heading font-semibold btn-magnetic shadow-lg`
- On click: toggles a panel below the button showing the Nettbutikk QR code image
- Panel: `bg-white rounded-container-lg card-pop` shadow, contains QR image (150x150) + "Scan for å åpne nettbutikken" label
- Toggle animation: smooth height transition via `overflow-hidden` + `max-height` or Framer Motion `AnimatePresence`
- QR image alt text: `"QR-kode for Iqra nettbutikk"`

## Assets Required

The user has provided both QR code images directly in the conversation. These are screenshots that need to be saved:

- **Støtt Oss QR**: Save as `public/images/qr-stott-oss.png` — this is the Vipps supporters QR code
- **Nettbutikk QR**: Save as `public/images/qr-nettbutikk.png` — this is the store/book-buying QR code

Both images feature the orange Vipps smiley logo in the center of the QR pattern.

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/SupportSection.tsx` | Create — new `"use client"` section component (needs client for copy-to-clipboard) |
| `src/components/NettbutikkQRToggle.tsx` | Create — new `"use client"` component for QR toggle |
| `src/app/page.tsx` | Modify — import and add `SupportSection` between Om Oss and CTA sections |
| `src/app/nettbutikk/page.tsx` | Modify — import `NettbutikkQRToggle` inside the "Slik bestiller du" block |
| `public/images/qr-stott-oss.png` | Create — save QR image asset from user-provided image |
| `public/images/qr-nettbutikk.png` | Create — save QR image asset from user-provided image |

## Design Principles

- Cohesive with existing page: same heading component, same shadows, same typography, same button styles
- Green used as accent (bars, labels) not as surface color
- `bg-bg-warm` section background for visual rhythm between white sections
- No new CSS utilities needed — uses existing `card-pop`, `rounded-container-lg`, `btn-magnetic`
- Content-first: the QR code, bank number, and Avtalegiro button are the visual anchors
- Server/client boundary respected: interactive parts are isolated `"use client"` components
