# Hero "Living Frame" Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current dark-gradient hero with a clean, white-background editorial layout where the hero photo sits in a large rounded frame with text above and below it.

**Architecture:** Single component rewrite (`Hero.tsx`). The hero uses `next/image` for optimized photo loading inside a rounded container, with GSAP staggered animations for headline → photo → subtitle → info strip. All content is vertically stacked and centered. The component sits inside an existing `snap-section` (100dvh) on the homepage.

**Tech Stack:** React 19, Next.js 16 (App Router), Tailwind CSS 4, GSAP 3.14, Lucide React icons, `next/image`

---

### Task 1: Rewrite Hero.tsx — Complete Component

**Files:**
- Modify: `src/components/Hero.tsx` (complete rewrite, lines 1–80)

**Step 1: Replace the entire Hero.tsx file**

Replace all contents of `src/components/Hero.tsx` with:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import gsap from 'gsap';
import { ArrowRight, MapPin } from 'lucide-react';
import { SITE } from '@/lib/constants';

export function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const ctx = gsap.context(() => {
        // Headline fade up
        gsap.fromTo(
          '.hero-headline',
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.2 }
        );

        // Photo frame scale-in reveal
        gsap.fromTo(
          '.hero-photo',
          { scale: 0.97, opacity: 0 },
          { scale: 1, opacity: 1, duration: 1.0, ease: 'power2.out', delay: 0.5 }
        );

        // Subtitle + CTA fade up
        gsap.fromTo(
          '.hero-cta',
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', delay: 0.9 }
        );

        // Info strip fade in
        gsap.fromTo(
          '.hero-info',
          { opacity: 0 },
          { opacity: 1, duration: 0.4, ease: 'power2.out', delay: 1.2 }
        );
      }, containerRef);

      return () => ctx.revert();
    });

    return () => mm.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex flex-col items-center justify-center bg-white overflow-hidden px-4 sm:px-6 lg:px-8"
    >
      {/* Headline — above the photo */}
      <h1 className="hero-headline text-center leading-[0.95] mb-6 md:mb-8">
        <span className="block font-heading font-bold text-3xl sm:text-4xl md:text-6xl lg:text-7xl text-text tracking-tight">
          Et trygt sted
        </span>
        <span className="block font-drama italic text-4xl sm:text-5xl md:text-7xl lg:text-8xl text-accent mt-1 md:mt-2">
          å vokse sammen.
        </span>
      </h1>

      {/* Photo Frame — the centerpiece */}
      <div className="hero-photo w-[90%] md:w-[75%] lg:w-[70%] max-w-5xl aspect-[16/10] md:aspect-[16/9] relative rounded-container overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.08)]">
        <Image
          src="/images/hero-children.jpg"
          alt={`Barn og familier på utflukt med ${SITE.shortName}`}
          fill
          priority
          quality={90}
          className="object-cover saturate-[1.05] brightness-[1.02]"
          sizes="(max-width: 768px) 90vw, (max-width: 1024px) 75vw, 70vw"
        />
      </div>

      {/* Subtitle + CTA — below the photo */}
      <div className="hero-cta flex flex-col items-center gap-4 mt-6 md:mt-8">
        <p className="text-text-muted text-base sm:text-lg md:text-xl font-body text-center max-w-xl">
          {SITE.tagline}
        </p>
        <Link
          href="/bli-medlem"
          className="inline-flex items-center gap-2 px-8 py-4 bg-accent hover:bg-accent-light text-white font-bold rounded-full transition-all duration-300 shadow-xl btn-magnetic text-base sm:text-lg"
        >
          Bli en del av oss
          <ArrowRight size={18} />
        </Link>
      </div>

      {/* Bottom Info Strip */}
      <div className="hero-info absolute bottom-6 md:bottom-8 left-0 right-0 flex items-center justify-center gap-3 text-text-muted/60 text-xs sm:text-sm font-body">
        <span className="inline-flex items-center gap-1">
          <MapPin size={14} />
          Oslo
        </span>
        <span aria-hidden="true">·</span>
        <span>200+ familier</span>
        <span aria-hidden="true">·</span>
        <span>5+ år</span>
      </div>
    </div>
  );
}
```

**Step 2: Verify the dev server is running and check for compile errors**

Run: `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000`
Expected: `200` (server responding)

Check terminal output for any TypeScript or build errors.

**Step 3: Visual check — verify the hero renders correctly**

Open `http://localhost:3000` in a browser. Verify:
- White background (no dark overlay)
- Headline "Et trygt sted / å vokse sammen." visible in charcoal + terracotta
- Photo of children visible in rounded frame, centered
- "Læring og aktivitet for hele familien" subtitle + CTA button below photo
- Info strip at bottom: Oslo · 200+ familier · 5+ år
- GSAP animations play on load (headline → photo → cta → info strip)

**Step 4: Test mobile responsiveness**

Use browser DevTools → responsive mode at 375px width. Verify:
- Headline scales down to `text-3xl` / `text-4xl`
- Photo frame takes ~90% width
- CTA button is readable and tappable
- Info strip is visible at bottom
- Everything fits within 100dvh without overflow

**Step 5: Commit**

```bash
git add src/components/Hero.tsx
git commit -m "feat: redesign hero section — Living Frame editorial layout

Replace dark gradient overlay hero with clean white background.
Photo of children displayed in large rounded frame as centerpiece.
Full Norwegian text. GSAP staggered animations for each element.
Accessible: respects prefers-reduced-motion.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Fine-Tune Spacing for Snap-Section Fit

**Files:**
- Modify: `src/components/Hero.tsx` (adjust padding/spacing if needed)

**Step 1: Verify the hero content fits within 100dvh**

The hero lives inside a `.snap-section` which is `height: 100dvh; overflow: hidden;`. Open the site and check:
- Does any content get cut off at the bottom (info strip)?
- Is vertical spacing balanced (not too cramped, not too loose)?
- Test at common viewport heights: 768px (iPad), 900px (laptop), 1080px (desktop)

**Step 2: Adjust spacing if content overflows or feels unbalanced**

If the content is too tall for small viewports, reduce:
- `mb-6 md:mb-8` on headline → `mb-4 md:mb-6`
- `mt-6 md:mt-8` on CTA area → `mt-4 md:mt-6`
- Photo aspect ratio on mobile: `aspect-[16/10]` → `aspect-[16/9]` or `aspect-[3/2]`

If the content is too short (too much whitespace), increase spacing or photo size.

**Step 3: Test at edge viewport sizes and commit if changes were made**

```bash
git add src/components/Hero.tsx
git commit -m "fix: adjust hero spacing for snap-section viewport fit

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Verify Accessibility and Performance

**Files:**
- Read only: `src/components/Hero.tsx`

**Step 1: Check accessibility**

Verify in the code:
- `alt` text on Image is descriptive (not empty)
- `aria-hidden="true"` on decorative `·` separators (already in the code)
- Heading hierarchy: `h1` is the only heading (correct, since this is the page hero)
- Link has descriptive text ("Bli en del av oss")
- `prefers-reduced-motion` is handled via `gsap.matchMedia`

**Step 2: Check Lighthouse performance**

Run Lighthouse in browser DevTools (Performance tab). Verify:
- `next/image` with `priority` ensures hero photo is in LCP
- `sizes` attribute is set correctly for responsive loading
- No layout shift (CLS) from the image loading (it has a fixed aspect ratio container)

**Step 3: Run the build to catch any type errors**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 4: Commit build verification**

No commit needed — this is a verification step only. If any issues found, fix and commit with appropriate message.
