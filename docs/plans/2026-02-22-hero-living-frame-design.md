# Hero Section Overhaul — "The Living Frame"

**Date:** 2026-02-22
**Status:** Approved
**Replaces:** Current Hero.tsx (dark gradient overlay hero)

## Design Intent

Transform the hero from a dark, gradient-heavy cinematic layout into a clean, photo-forward editorial composition. The hero background image (`hero-children.jpg`) — kids at a park outing — becomes the emotional centerpiece, displayed in a large rounded frame on a clean white background. Text lives outside the photo for perfect legibility and modern magazine-editorial feel.

**Core emotion:** Warmth & belonging
**Language:** Full Norwegian
**CTA:** Single action

## Layout — Desktop (100dvh snap section)

```
White background, vertically centered content

1. Headline (above photo)
   "Et trygt sted"         — bold, charcoal, text-7xl
   "å vokse sammen."      — italic, accent terracotta, text-8xl

2. Photo Frame (center)
   - ~70% viewport width, ~55% height
   - border-radius: 2rem
   - box-shadow: 0 8px 40px rgba(0,0,0,0.08)
   - next/image with priority, object-cover, quality 90
   - filter: saturate(1.05) brightness(1.02)

3. Subtitle + CTA (below photo)
   "Læring og aktivitet for hele familien"  — muted text
   [ Bli en del av oss → ]                  — accent button, rounded-full

4. Bottom Info Strip
   MapPin Oslo  ·  200+ familier  ·  5+ år  — small, muted, centered
```

## Layout — Mobile (100dvh, stacked)

- Headline: text-3xl / text-4xl, same two-line structure
- Photo frame: ~90% width, shorter aspect
- CTA: full width below photo
- Bottom strip: simplified, smaller text

## Typography

| Element | Font | Weight | Size (desktop) | Color |
|---------|------|--------|-----------------|-------|
| Headline L1 | font-heading (Plus Jakarta Sans) | bold | text-4xl md:text-6xl lg:text-7xl | #1A1A1A |
| Headline L2 | font-drama (Plus Jakarta Sans italic) | normal | text-5xl md:text-7xl lg:text-8xl | #CC5833 |
| Subtitle | font-body | normal | text-lg md:text-xl | #4A4A4A |
| CTA | font-heading | bold | text-lg | white on #CC5833 |
| Info strip | font-body | normal | text-sm | #4A4A4A/60 |

- Headline line-height: `leading-[0.95]`
- Period at end of headline L2 — intentional, confident statement

## Color

- Background: `#FFFFFF` (white)
- Headline: `#1A1A1A` (charcoal) + `#CC5833` (accent)
- Subtitle: `#4A4A4A` (muted)
- CTA: `#CC5833` bg, `#E0673C` hover
- Info strip: `#4A4A4A` at 60% opacity
- Photo shadow: `rgba(0,0,0,0.08)`

## Photo Treatment

- No overlay/gradient on photo
- Subtle CSS enhancement: `saturate(1.05) brightness(1.02)` — makes greens and colors pop
- `next/image` component with `priority` flag for LCP optimization
- `object-cover` to fill frame without distortion

## GSAP Animation Sequence

| Delay | Element | Animation | Duration | Easing |
|-------|---------|-----------|----------|--------|
| 200ms | Headline | `y: 30→0, opacity: 0→1` | 0.8s | power3.out |
| 500ms | Photo frame | `scale: 0.97→1, opacity: 0→1` | 1.0s | power2.out |
| 900ms | Subtitle + CTA | `y: 20→0, opacity: 0→1` | 0.6s | power3.out |
| 1200ms | Info strip | `opacity: 0→1` | 0.4s | power2.out |

- Total: ~1.6s
- Respects `prefers-reduced-motion`: all elements instantly visible

## CTA Button

- Text: "Bli en del av oss"
- Arrow icon appended (→ or Lucide ArrowRight)
- Existing `btn-magnetic` hover effect (scale 1.03)
- `rounded-full`, `px-8 py-4`, `shadow-xl`

## Bottom Info Strip

- Three items: `MapPin icon + "Oslo"` · `"200+ familier"` · `"5+ år"`
- Lucide MapPin icon (not emoji)
- Separated by `·` (middle dot)
- Centered, small, muted — credibility without clutter

## Key Differences from Current Hero

| Aspect | Current | New |
|--------|---------|-----|
| Background | Dark gradient (90% opacity) over photo | Clean white, photo in frame |
| Photo visibility | ~10% visible through overlay | 100% visible, no overlay |
| Text placement | On top of photo | Separate from photo |
| Language | English + Norwegian mix | Full Norwegian |
| Emotional signal | Dark, cinematic | Warm, inviting, editorial |
| Text readability | Fights with photo for contrast | Perfect — dark text on white |
| Feel | Generic hero pattern | Magazine/editorial, unique |

## Files Changed

- `src/components/Hero.tsx` — Complete rewrite
- No new dependencies needed (GSAP + next/image already available)
- No new images needed (using existing `hero-children.jpg`)
