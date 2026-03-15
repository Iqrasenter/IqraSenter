# Landing Page Redesign — Design Spec

## Overview

Redesign the Iqra Senter landing page with three key changes: (1) a viewport-fit split hero, (2) emerald glassmorphism service cards, and (3) replace the teacher section with a latest articles section.

## 1. Hero — Split Layout

### Goal
The entire hero must be visible in one viewport — no scrolling required.

### Layout
- **Desktop** (lg+): Two-column flex — text left (55%), single image right (45%), `min-h-[100svh]`
- **Height**: Use `min-h-[100svh]` with `pt-20 md:pt-24` for navbar offset (navbar is ~64-80px)
- **Tablet** (md): Same split but 50/50, tighter padding
- **Mobile** (<md): Stack vertically — text top, image below with `aspect-[4/3]` and max-height cap (`max-h-[35vh]`). Total section uses `min-h-[100svh]` with `justify-center` to vertically center content. Reduce heading to `text-3xl`, tighter margins.
- **Landscape mobile**: Image hidden (`hidden landscape:md:block` or similar), text fills viewport

### Text Side (Left)
- Uppercase tracking badge: "Iqra Læring & Aktivitetssenter"
- Large Fraunces heading: "Læring for hele familien." (same copy as current)
- Subtitle paragraph (same copy as current)
- Two CTA buttons: "Bli medlem i dag" (primary, pill) + "Kontakt oss" (outline, pill)
- Vertically centered within the column

### Image Side (Right)
- Single image: `/images/hero-children.jpg`
- Fills the right column with `object-cover`
- `rounded-3xl` on all corners (the image container has uniform rounding, offset from the page edge by padding)
- Desktop: Image fills full height of the section naturally
- Mobile: `aspect-[4/3]`, `max-h-[35vh]`, `w-full`, `rounded-2xl`
- Remove the other two images (`helgeskole.jpg`, `fritid.jpg`) from the hero

### Animation
- Keep existing GSAP stagger pattern (respects `prefers-reduced-motion`)
- Text elements: fade-up with Y translation
- Image: scale-in with opacity

### What Changes
- **File**: `src/components/Hero.tsx` — rewrite layout from centered-with-3-images to split-with-1-image
- **Remove**: The bordered container wrapper, the three-image grid
- **Keep**: All text content, button links, GSAP animation approach

## 2. Services — Floating Glass on Emerald

### Goal
Replace the current light-green editorial rows with dramatic emerald glassmorphism cards that float with glow effects.

### Section Background
- Deep dark emerald gradient: `linear-gradient(160deg, #022c22 0%, #064E3B 40%, #0a3d2e 100%)`
- Decorative radial glow orbs positioned behind cards, `pointer-events-none`, `absolute`:
  - Orb 1: `top: 20%; left: 10%; width: 200px; height: 200px;` — `rgba(16,185,129,0.25)`
  - Orb 2: `bottom: 10%; right: 15%; width: 250px; height: 250px;` — `rgba(52,211,153,0.15)`
  - Both use `radial-gradient(circle, <color>, transparent 70%)` with `border-radius: 50%`
  - Mobile: Keep visible — they're behind content and won't cause overflow since parent is `overflow-hidden`

### Section Heading
- Heading "Våre Tjenester": white text (`text-white`)
- Emphasized word: `#34D399` (emerald green accent)
- Badge "Hva vi tilbyr": `bg-[#34D399]/20 text-[#34D399]` (emerald tinted background with emerald text) — replaces current `bg-primary text-white`

### Card Container (Each Row)
- Background: `rgba(255,255,255,0.06)`
- Backdrop filter: `blur(24px)`
- Border: `1px solid rgba(255,255,255,0.12)`
- Border radius: `20px`
- Box shadow: `0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)`
- Top-edge shimmer: absolute positioned gradient line across the top (`rgba(110,231,183,0.5)` center, transparent edges)

### Card Content
- **Image**: Bleeds to card edge (no internal padding on image side), with gradient overlay fading into the glass text side: `linear-gradient(to right, transparent 60%, rgba(6,78,59,0.6))` for image-left rows, `linear-gradient(to left, transparent 60%, rgba(6,78,59,0.6))` for image-right rows
- **Category label**: `#34D399`, uppercase, letter-spaced
- **Title**: White, Fraunces bold, ~20px
- **Description**: `rgba(255,255,255,0.6)`, body font
- **CTA button**: Gold gradient (`background: linear-gradient(135deg, #C8973E, #D4AD5A)`), pill shape (`rounded-full`), glow shadow: `box-shadow: 0 4px 12px rgba(200,151,62,0.3)`

### Layout
- Keep alternating image left/right pattern (same as current)
- Keep Framer Motion scroll-triggered animations

### What Changes
- **File**: `src/components/EditorialFeatures.tsx` — update `EditorialRow` styling from light-green cards to glass cards, update section heading colors, add glow orbs. The component owns its own background: wrap the existing content in a `relative` container that applies the emerald gradient and contains the glow orbs.
- **Parent section in page.tsx**: Remove `bg-white` from the services section wrapper — background is now owned by `EditorialFeatures`

## 3. Teacher Section — Removed

### What Changes
- **File**: `src/app/page.tsx` — delete the entire `<section id="larere">` block
- No other files need deletion (AnimatedTestimonials component may be used elsewhere)

## 4. Aktuelt — Latest Articles Section (New)

### Goal
Show the 3 most recent news articles as blog-style cards on the homepage, replacing the teacher section's position.

### Position in Page
Between About (Bento Grid) and Testimonials

### Section Background
- `bg-bg` (white) — provides contrast after the dark emerald services section and the warm bento grid

### Section Heading
- Reuse `SectionHeading` component or similar pattern
- Title: "Aktuelt" or "Siste Nytt"
- Optional subtitle: "Nyheter og arrangementer"

### Card Layout
- **Desktop**: 3 cards in a row (`grid-cols-1 md:grid-cols-3`, gap-6 or gap-8)
- **Mobile**: Stack vertically

### Card Style (Clean White)
- White background (`bg-card`), subtle border (`border border-border/50`), `rounded-3xl`, `overflow-hidden`
- Hover: `-translate-y-1` + `shadow-lg` transition (300ms)
- **Image**: Top of card, `aspect-[3/2]`, `object-cover`, hover zoom (`group-hover:scale-105`, 500ms)
- **Badge**: "Nyhet" overlaid on image (top-left, `absolute top-4 left-4`), `bg-accent text-white text-xs font-bold rounded-full px-3 py-1` (accent = `#C8973E` gold, already defined in theme)
- **Date**: `text-xs font-medium text-text-muted uppercase tracking-wider`
- **Title**: `font-heading text-base font-bold text-text line-clamp-2`, hover → `text-primary`
- **Excerpt**: `text-sm text-text-muted line-clamp-3`
- **Link**: "Les mer →" `text-primary font-semibold text-sm` with `ArrowRight` icon, hover translate-x
- **Full card**: Wrapped in `<Link href="/aktuelt">` so entire card is clickable
- **Alt text**: Use article title as image alt text
- **Edge case**: If `NEWS` has fewer than 3 items, render only what exists (`NEWS.slice(0, 3)` handles this naturally)

### Data Source
- Import `NEWS` from `@/lib/constants`
- Take first 3 items: `NEWS.slice(0, 3)`

### Footer Link
- Below the cards, centered: "Se alle nyheter →" link to `/aktuelt`
- Styled as text link: `text-primary font-heading font-semibold hover:text-primary-light` with `ArrowRight` icon

### What Changes
- **New section in** `src/app/page.tsx` — add between om-oss and testimonials sections
- **Reuse or adapt**: Existing `NewsCard` component from `src/components/NewsCard.tsx` (already has the right structure)
- **Animation**: Framer Motion fade-up with stagger, consistent with other sections

## 5. Final Page Order

1. Hero (split, viewport-fit)
2. Services (emerald glass editorial rows)
3. About (Bento Grid) — unchanged
4. **Aktuelt (3 latest articles)** — new
5. Testimonials — unchanged
6. CTA Banner — unchanged
7. Footer — unchanged

## Files to Modify

| File | Change |
|------|--------|
| `src/components/Hero.tsx` | Rewrite to split layout with single image |
| `src/components/EditorialFeatures.tsx` | Restyle to emerald glassmorphism |
| `src/app/page.tsx` | Remove teacher section, add Aktuelt section, update services section wrapper |
| `src/app/globals.css` | Add any new glass utility classes if needed |

## Files NOT Modified

- `src/components/AboutBentoGrid.tsx` — unchanged
- `src/components/TestimonialCarousel.tsx` — unchanged
- `src/components/Footer.tsx` — unchanged
- `src/lib/constants.ts` — unchanged (NEWS data already exists)
- `src/components/NewsCard.tsx` — reuse as-is or with minor tweaks
