# Full-Page Scroll Homepage — Design Doc

**Date:** 2026-02-21
**Status:** Approved

---

## Context

The homepage currently has 9 sections in a standard vertical scroll layout. The goal is to convert it to a **strict full-page snap scroll experience** where each section occupies exactly 100dvh, and content animates in with a fade+slide-up as each section snaps into view. The Bento grid must also be compacted to fit entirely within one screen.

---

## Architecture

**Scroll container:** `page.tsx` becomes a wrapper `div` with:
```css
height: 100dvh;
overflow-y: scroll;
scroll-snap-type: y mandatory;
```

Each section `<section>`:
```css
height: 100dvh;
scroll-snap-align: start;
overflow: hidden;
```

The Navbar remains fixed at top. Footer content is folded into the CTA page (section 6).

---

## The 6 Full-Screen Pages

| # | Section | Key Content |
|---|---------|-------------|
| 1 | **Hero** | Existing split-panel (unchanged) |
| 2 | **Tjenester** | Compact Bento grid (2×2 desktop, swipe carousel mobile) |
| 3 | **Om Oss** | About text + trust badges + stats bar merged |
| 4 | **Aktuelt** | 3 news cards + section header |
| 5 | **Testimonials** | Auto-rotating testimonial carousel |
| 6 | **CTA + Footer** | CTA banner + footer links/contact info merged |

---

## Animation Design

**Trigger:** Framer Motion `whileInView` with `viewport={{ once: true, amount: 0.3 }}`

**Per-section stagger:**
```
Heading:       delay 0ms,   duration 500ms,  y: 30→0, opacity: 0→1
Badge/sub:     delay 100ms
Body text:     delay 200ms
Cards/media:   delay 300ms + 80ms stagger per card
CTA buttons:   delay last
```

**Easing:** `easeOut` cubic-bezier for all motion.

---

## Scroll Navigation Dots

- Fixed right edge, vertically centered
- 6 dots (one per section)
- Active: filled circle in accent color (#D97706), 10px
- Inactive: 6px outline circle
- Click: smooth-scrolls container to target section
- Active state tracked via `IntersectionObserver` on each section

---

## Bento Grid Compact Layout

**Desktop:**
- Grid: `grid-template-columns: 1fr 1fr`, 2 rows
- Total grid height: `calc(100dvh - 80px - section-header-height)`
- Card image height: ~160px (reduced from ~240px)
- Card padding: `p-4` (tighter than current)
- All 4 cards visible without inner scroll

**Mobile:**
- Horizontal swipe carousel (CSS `overflow-x: scroll; scroll-snap-type: x mandatory`)
- Each card: `width: 85vw; scroll-snap-align: start`
- Swipe indicator dots below carousel

---

## Navbar Behavior

- Hero section: glass/transparent (white text)
- All other sections: light background + shadow
- Already handled via scroll detection — no change needed

---

## Files to Modify

| File | Change |
|------|--------|
| `src/app/page.tsx` | Wrap in scroll-snap container; ensure each section is 100dvh; add `<ScrollDots>` overlay |
| `src/components/BentoGrid.tsx` | Compact 2×2 layout; mobile swipe carousel |
| `src/app/globals.css` | Add `.snap-container` and `.snap-section` utilities |
| `src/components/ScrollDots.tsx` | **New** — vertical dot nav with IntersectionObserver |

---

## Verification

1. Open homepage — Hero fills 100dvh exactly
2. Scroll once — snaps to Tjenester, Bento grid fits entirely in view, fade+slide-up fires
3. Scroll again — snaps to Om Oss, stats bar animates in
4. Continue to News → Testimonials → CTA (all snap correctly)
5. Navigation dots update as you scroll
6. Clicking a dot jumps to correct section
7. On mobile: Bento cards swipe horizontally within the snap section
8. Resize window — all sections remain full-height, no overflow issues
9. Check `prefers-reduced-motion` — animations skip but snapping still works
