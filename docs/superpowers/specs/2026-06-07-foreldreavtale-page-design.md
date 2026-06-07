# Foreldreavtale (Parent Agreement) Page — Design Spec

**Date:** 2026-06-07
**Status:** Approved pending user spec review
**Author:** brainstorming session

## Purpose

Provide a dedicated page where **newly-admitted students' families** read the binding
parent agreement (Foreldreavtale) and then confirm it via an existing Google Form.
The agreement is currently only a PDF; this surfaces it on the website and routes
families to the confirmation form.

Two entry points drive families to the page:
1. A **rolling marquee banner** at the top of the homepage hero.
2. A **small text link** in the "Siste Nytt" section of the homepage.

## Scope

In scope:
- New route `/foreldreavtale` rendering the agreement as full on-page text + PDF download + confirm CTA.
- New `AnnouncementMarquee` client component, rendered only on the homepage.
- Small text link in the homepage "Siste Nytt" section.
- Copying the source PDF into `/public` for download.

Out of scope:
- Adding the page to the main navigation menu (explicitly declined).
- Any change to `/bli-medlem` or `/bli-medlem/opptak` (the separate interest form).
- Storing/processing confirmations ourselves — the Google Form owns that.

## Data / Content Contract

**Agreement content** (from `foreldreavtale_ny_260607_041748.pdf`), rendered as headed
sections, copy verbatim from the PDF (Norwegian):

1. **Innledning** — agreement is binding; breach allows the other party to terminate.
2. **Foresattes plikter** — bullet list (attendance, materials, daily Quran/Nuuraaniyah
   reading, homework, absence reporting, following Iqra's rules [3 areas: Fravær,
   Foreldrenes plikter, Orden- og oppførselsregler], parent meetings, cooperation,
   respect, damage liability, timely payment).
3. **Betaling** — kr 700/month/student; no sibling discount; Avtalegiro only; setup via
   Bank ID; pay to account until Avtalegiro ready (up to 4 weeks); existing Avtalegiro
   users raise the amount; due 1st of month; guardian responsible for the draw; invoice
   with 2-week deadline if no draw; annual CPI adjustment; paid Jan–Dec.
4. **Manglende betaling** — payment notice after the 15th; >2 months → 6-month
   prepayment + termination warning; >3 months → spot terminated; re-apply after arrears
   paid; keep spot by paying in full or agreeing to a repayment plan; broken repayment
   plan → spot given to waitlist.
5. **Innmeldingsgebyr** — new parents pay a kr 1500 enrollment fee (admin costs).
6. **Oppsigelse av skoleplassen** — 1 month notice from the 1st; fees due through the
   notice period even if the student leaves earlier.
7. **Opphør av kontrakten** — either party may terminate for valid cause without notice
   (serious breach; drugs/alcohol; suspicion of criminal acts; unpaid fees despite
   reminders; breakdown of trust between teachers/parents/student).

Signature lines from the PDF are omitted on-page (confirmation happens via Google Form);
the downloadable PDF retains them.

**Google Form (confirm):**
`https://docs.google.com/forms/d/e/1FAIpQLSfIx6QIDKrNGCkfhp5G0bqfY1HZmu0qWGxj0s5Pd_8WcP1QWg/viewform`
Opens in a new tab (`target="_blank"`, `rel="noopener noreferrer"`).

**PDF download:** copy to `public/foreldreavtale.pdf`, linked from the page.

## Architecture

Follows the existing editorial page pattern (mirrors `src/app/bli-medlem/page.tsx`).

### New files
- `src/app/foreldreavtale/page.tsx` — server component, page metadata + layout.
- `src/components/AnnouncementMarquee.tsx` — `"use client"` rolling banner.
- `public/foreldreavtale.pdf` — downloadable source document.

### Modified files
- `src/app/page.tsx` — render `<AnnouncementMarquee />` at the top; add small text link
  in the "Siste Nytt" section.

### Reused primitives
- `EditorialPageHeader`, `EditorialLabel`, `FadeIn`, `Footer`.
- Color tokens: `primary` (#1B6B4A), `accent` (#92400e), `text`, `text-muted`, `border`.
- Fonts: `font-heading` (Fraunces), `font-body` (Outfit).
- Existing `marquee` keyframe + `--animate-marquee` token in `globals.css`.

## Page Layout (`/foreldreavtale`)

1. `EditorialPageHeader` — title `Foreldreavtale /`, highlight `Bekreftelse`,
   subtitle "Gratulerer med skoleplassen. Les avtalen nøye og bekreft."
2. **Intro section** — `EditorialLabel` "Viktig" + paragraph: the agreement is binding
   and must be confirmed before the spot is finalized; download link to the PDF.
3. **Agreement sections** — the 7 sections above, each as a headed block
   (`font-heading` h2 + bullet/paragraph body), inside `max-w-7xl` container with
   `FadeIn` reveals. Full text, not an accordion.
4. **Confirm CTA** — card (`bg-primary/5` or bordered) with heading
   "Når du har lest avtalen, bekreft her" and an `accent` button
   "Bekreft foreldreavtalen →" linking to the Google Form (new tab).
5. `<Footer />`.

Responsive: same mobile/desktop scale pattern as `bli-medlem` (smaller type and spacing
on mobile, `lg:` upscaling).

## Rolling Banner (`AnnouncementMarquee`)

- Full-width thin strip, `bg-primary` with white text, placed at the very top of the
  homepage, above the hero. Because the navbar is `fixed` and transparent over the hero,
  the banner sits in normal flow at the top with appropriate top offset
  (`--navbar-h` = 80px) so it is not hidden behind the navbar.
- Content: repeated message
  *"Nye elever med opptak — les og bekreft foreldreavtalen →"* with separators.
- Entire strip is a `Link` to `/foreldreavtale`.
- Uses the existing `--animate-marquee` animation; duplicate the track for a seamless
  loop; set `--duration` (~25s) and `--gap`.
- Pauses on hover (`hover:[animation-play-state:paused]`).
- Respects `prefers-reduced-motion` (global rule already freezes animation; ensure text
  is still readable/static and the link still works).
- Rendered only in `src/app/page.tsx` (homepage), not in the global layout.

## Homepage "Siste Nytt" text link

In the existing `#aktuelt` ("Siste Nytt") section of `src/app/page.tsx`, add a small,
subtle line (e.g. under the section heading or near the "Se siste nytt" button):
*"Nye elever med opptak: les foreldreavtalen →"* linking to `/foreldreavtale`,
styled small (`text-sm`, `text-accent` / muted) so it doesn't compete with news cards.

## SEO / Metadata

- `metadata` for `/foreldreavtale`: title "Foreldreavtale", Norwegian description,
  canonical `https://www.iqrasenter.net/foreldreavtale`.
- Add the route to `src/app/sitemap.ts` if it enumerates routes (verify during impl).

## Accessibility

- Banner: real `<Link>` with descriptive text; animation pauses on hover and respects
  reduced motion; sufficient contrast (white on primary green).
- PDF link: descriptive label ("Last ned avtalen (PDF)").
- Google Form link: `rel="noopener noreferrer"`, descriptive text, new tab.
- Agreement headings use semantic `<h2>`/`<h3>`; lists use `<ul>`.

## Testing / Verification

Verify via dev server + preview tools (no unit test framework in repo for pages):
- `/foreldreavtale` renders all 7 sections, PDF download works, Google Form button opens
  the form in a new tab.
- Homepage shows the marquee at top (scrolling, pause-on-hover) and the "Siste Nytt" link.
- Responsive check (mobile + desktop), reduced-motion check.
- No console errors; `npm run build` / typecheck passes with zero TS errors.

## Open Questions

None. PDF text extracted; Google Form link confirmed; all design decisions resolved.
