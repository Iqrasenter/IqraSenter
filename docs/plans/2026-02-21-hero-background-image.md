# Hero Static Background Image Design

**Date:** 2026-02-21
**Status:** Approved

## Summary

Add a static nature photo as a full-bleed background behind the existing clip-path hero animation in `SmoothScrollHero`. This creates a layered depth effect where the nature backdrop is visible around the expanding "window" that reveals the children image.

## Architecture

The `SmoothScrollHero` component gains a new `backgroundImage` prop. A static `div` with this image renders behind the existing clipped `motion.div`:

```
<outer wrapper>
  <static background image>   ← NEW: full-bleed, no clip
  <clipped motion.div>        ← EXISTING: clip-path reveals hero-children.jpg
    <hero image>
    <dark overlay>
    <text content>
  </clipped motion.div>
</outer wrapper>
```

## Visual Behavior

1. On load: nature photo fills the hero; a small centered clip window shows children image
2. On scroll: clip expands, children image covers nature photo
3. Nature photo has a subtle dark overlay for depth separation
4. Nature photo is static (`background-size: cover`) — no zoom animation

## Changes

- `src/components/ui/smooth-scroll-hero.tsx` — add `backgroundImage` prop, render static background layer
- `src/app/page.tsx` — pass `backgroundImage="/images/hero-bg.jpg"` to `SmoothScrollHero`

## User Action Required

Save a landscape nature photo (at least 1920px wide) as `public/images/hero-bg.jpg`.
