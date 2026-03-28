# Support Section + Nettbutikk QR Button — Design Spec

## Overview

Two additions to the Iqra website:

1. **"Støtt Oss" section on the landing page** — three card layout showing ways to support the organization
2. **QR code button on the Nettbutikk page** — reveals the store QR code for mobile scanning

## 1. Landing Page — Støtt Oss Section

### Placement

Between the "Om Oss" section and the CTA banner in `src/app/page.tsx`.

### Structure

- Uses existing `SectionHeading` component: title="Støtt", highlight="Oss", subtitle="Din støtte gjør en forskjell for familier og barn over hele Norge"
- Uses existing `FadeIn` component for scroll-triggered reveal
- Three cards in a responsive grid (`grid-cols-1 md:grid-cols-3`)
- Bottom link to `/stott-oss` page using existing accent outline button style

### Card Design

All three cards use:
- `bg-white rounded-container-lg card-pop` (existing utilities)
- Green gradient accent bar at top: 40px wide, 3px tall, `linear-gradient(90deg, primary, primary-light)`, centered
- Uppercase tracking-wider label in `text-primary`
- Instruction text in `text-text-muted`, `font-body`
- Padding: `p-8`, text centered

#### Card 1 — Vipps (left)
- Label: "VIPPS"
- Value: "21490" in `font-heading text-3xl font-extrabold`
- Instruction: "Åpne Vipps-appen på telefonen, søk på nummeret eller scan QR-koden."
- QR code: Støtt Oss QR image (`/public/images/qr-stott-oss.png`), 120x120, rounded-container border, subtle border

#### Card 2 — Avtalegiro (center)
- Label: "AVTALEGIRO"
- Value: "Fast støtte" in `font-heading text-2xl font-extrabold`
- Instruction: "Sett opp et fast månedlig trekk fra kontoen din — velg beløp selv, og støtt oss automatisk."
- CTA button: "Opprett Avtalegiro →" — primary green, rounded-container, `font-heading`, links to `https://nettbutikk.solidus.no/avtalestraks/D6E5B9EA-89CF-43F0-90F0-2BD4039EADD2` (opens in new tab)

#### Card 3 — Bankoverføring (right)
- Label: "BANKOVERFØRING"
- Value: "1503.67.58535" in `font-data text-xl font-extrabold`
- Instruction: "Overfør direkte fra nettbanken din. Merk betalingen med «Støtte»."
- Copy button: accent brown outline style (matches existing "Se siste nytt" button pattern), copies account number to clipboard with brief "Kopiert!" feedback

### Responsive Behavior

- Desktop: 3-column grid with 20px gap
- Mobile: single column stack, cards full width
- Cards maintain equal height via stretch alignment

### Animation

- Section fades in on scroll using existing `FadeIn` component
- Cards get staggered delay (0, 0.1, 0.2)

## 2. Nettbutikk Page — QR Code Button

### Placement

On the Nettbutikk page, positioned as a prominent element (exact placement TBD based on current page layout).

### Design

- Button: "Scan & handle i appen" — primary green, `rounded-container`, `font-heading`, `btn-magnetic`
- On click: toggles a panel below/beside the button showing the Nettbutikk QR code image (`/public/images/qr-nettbutikk.png`)
- Panel: white background, `rounded-container-lg`, `card-pop` shadow, contains QR image + "Scan for å åpne nettbutikken" label
- Uses React state for toggle, smooth height animation

## Assets Required

- Save Støtt Oss QR code image as `/public/images/qr-stott-oss.png`
- Save Nettbutikk QR code image as `/public/images/qr-nettbutikk.png`

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/SupportSection.tsx` | Create — new section component |
| `src/app/page.tsx` | Modify — add SupportSection between Om Oss and CTA |
| `src/app/nettbutikk/page.tsx` (or similar) | Modify — add QR button component |
| `public/images/qr-stott-oss.png` | Create — save QR image asset |
| `public/images/qr-nettbutikk.png` | Create — save QR image asset |

## Design Principles

- Cohesive with existing page: same heading component, same shadows, same typography, same button styles
- Green used as accent (bars, labels, icon fills) not as surface color
- No new CSS utilities needed — uses existing `card-pop`, `rounded-container-lg`, `btn-magnetic`
- Content-first: the QR code, bank number, and Avtalegiro button are the visual anchors, not decorative icons
