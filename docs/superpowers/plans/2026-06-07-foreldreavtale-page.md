# Foreldreavtale Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/foreldreavtale` page where newly-admitted families read the binding parent agreement and confirm via Google Form, plus a homepage rolling banner and a "Siste Nytt" text link pointing to it.

**Architecture:** Server-rendered Next.js App Router page mirroring the existing editorial pattern of `src/app/bli-medlem/page.tsx` (reusing `EditorialPageHeader`, `EditorialLabel`, `FadeIn`, `Footer`). A pure-CSS `AnnouncementMarquee` (no client JS) reuses the existing `marquee` keyframe + `--animate-marquee` token. Homepage (`src/app/page.tsx`) renders the marquee and a small link.

**Tech Stack:** Next.js (App Router, RSC), TypeScript, Tailwind CSS v4 (`@theme` tokens), lucide-react icons.

**Note (visual work):** Per project CLAUDE.md, the visual components (Tasks 1–3) extend the *existing* Iqra editorial design system — that established style is the chosen direction (no new Phase-1 design direction needed). When writing/adjusting the JSX, load Phase-2 build skills (`taste-skill`, `impeccable`, `emil-design-eng`) and run the Phase-3 audit (`web-design-guidelines`) before declaring done (Task 6).

**Verification model:** This repo has no unit-test framework for pages. "Tests" here = TypeScript typecheck, `npm run build`, and browser verification via preview tools.

---

### Task 1: Add the agreement PDF and create the `/foreldreavtale` page

**Files:**
- Create: `public/foreldreavtale.pdf` (copied from the source download)
- Create: `src/app/foreldreavtale/page.tsx`

- [ ] **Step 1: Copy the source PDF into `public/`**

Run:
```bash
cp "/Users/daodilyas/Downloads/foreldreavtale_ny_260607_041748.pdf" "/Users/daodilyas/Desktop/iqra/public/foreldreavtale.pdf"
ls -la /Users/daodilyas/Desktop/iqra/public/foreldreavtale.pdf
```
Expected: file listed (~160 KB).

- [ ] **Step 2: Create the page file**

Create `src/app/foreldreavtale/page.tsx` with the full agreement text (verbatim Norwegian from the PDF), PDF download, and Google Form confirm CTA:

```tsx
import type { Metadata } from "next";
import { Download, ArrowRight } from "lucide-react";
import { EditorialPageHeader } from "@/components/EditorialPageHeader";
import { EditorialLabel } from "@/components/EditorialLabel";
import { FadeIn } from "@/components/FadeIn";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Foreldreavtale",
  description:
    "Avtale mellom Iqra Læring og Aktivitetssenter og foresatte. Les avtalen og bekreft din skoleplass.",
  alternates: {
    canonical: "https://www.iqrasenter.net/foreldreavtale",
  },
  openGraph: {
    title: "Foreldreavtale - Iqra Senter",
    description:
      "Les foreldreavtalen og bekreft skoleplassen for ditt barn hos Iqra Senter.",
    url: "https://www.iqrasenter.net/foreldreavtale",
  },
};

const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSfIx6QIDKrNGCkfhp5G0bqfY1HZmu0qWGxj0s5Pd_8WcP1QWg/viewform";

type Section = {
  title: string;
  intro?: string;
  items?: string[];
  outro?: string;
};

const SECTIONS: Section[] = [
  {
    title: "Innledning",
    intro:
      "Denne avtalen er bindende og skal regulere de forpliktelsene partene har til hverandre. Dersom en av partene bryter ett eller flere av vilkårene i avtalen, kan den andre parten kreve avtalen hevet.",
  },
  {
    title: "Foresattes plikter",
    items: [
      "Sørge for at eleven møter opp til undervisning til riktig tid",
      "Sørge for at eleven har med seg skrivesaker, oppfølgingshefter og pensumbøker",
      "Sitte med eleven hver dag for å lese Quran og/eller Nuuraaniyah",
      "Sørge for at eleven gjør lekser og leverer inn oppgaver",
      "Melde fra om fravær så snart som mulig og senest en halv time før undervisninger starter",
      "Gjøre seg kjent med og følge alle Iqras retningslinjer og regler. Disse reglene omfatter tre hovedområder: 1) Fravær, 2) Foreldrenes plikter, 3) Orden- og oppførselsregler",
      "Møte opp til foreldresamtaler og foreldremøter",
      "Samarbeide med læreren om elevens læring og utvikling",
      "Vise respekt overfor lærere, foreldre og andre han/hun kommer i kontakt med i Iqra",
      "Erstatte eventuelle skader eleven påfører Iqras inventar eller utstyr",
      "Betale skolepengene i tide slik at Iqra blir i stand til å møte sine forpliktelser overfor utleier og dekke andre faste utgifter",
    ],
  },
  {
    title: "Betaling",
    items: [
      "Pris for en skoleplass er kr. 700 per måned per elev",
      "Det gis ikke søskenrabatt",
      "Vi tilbyr kun Avtalegiro som eneste betalingsmåte",
      "Foresatte som ikke allerede betaler med Avtalegiro må tegne en avtalegiro. Linken kan dere få tilsendt i egen melding. Du må signere med Bank ID for å identifisere deg",
      "For de som ikke allerede bruker Avtalegiro som betalingsmetode, må skoleavgiften betales til Iqra sin konto ettersom det kan ta inntil 4 uker før avtalen er klar",
      "De som allerede betaler med Avtalegiro må øke terminbeløpet iht. de nye satsene",
      "Betalingsfristen er den 1. hver måned",
      "Foresatt er selv ansvarlig for å påse at skolepengene trekkes fra konto hver måned",
      "Dersom det av ulike grunner ikke skjer trekk, blir det sendt en faktura med en betalingsfrist på 2 uker",
      "Skolepengene justeres hvert år i henhold til konsumprisindeksen",
      "Skolepengene betales alle måneder gjennom hele året fra januar til desember",
    ],
  },
  {
    title: "Manglende betaling",
    items: [
      "Det blir sendt ut et betalingsvarsel ved manglende betaling etter den 15. i måneden",
      "Ved manglende betaling ut over 2 måneder vil det bli sendt ut et varsel om forskuddsbetaling på 6 måneder og oppsigelse av skoleplassen",
      "Ved manglende betaling ut over 3 måneder vil skoleplassen bli sagt opp",
      "Det kan søkes om skoleplass på nytt etter at det utestående er betalt",
      "Foresatte som har mottatt varsel om oppsigelse av skoleplassen kan beholde skoleplassen ved å betale det utestående i sin helhet, eller inngå en nedbetalingsavtale med skolen",
      "Skoleplassen blir sagt opp dersom en inngått nedbetalingsavtale ikke følges, og plassen gis til neste elev fra ventelista",
    ],
  },
  {
    title: "Innmeldingsgebyr",
    intro:
      "Nye foreldre skal betale et innmeldingsgebyr på kr. 1500 som skal dekke administrasjonskostnader.",
  },
  {
    title: "Oppsigelse av skoleplassen",
    items: [
      "Det er 1 måneds oppsigelse regnet fra den 1. hver måned. Skolepengene må betales i oppsigelsestiden regnet fra den 1. hver måned. Skolepengene må betales selv om eleven slutter før oppsigelsestidens utløp",
    ],
  },
  {
    title: "Opphør av kontrakten",
    intro:
      "Dersom det foreligger gyldig grunn, kan begge parter si opp skolekontrakten uten at oppsigelsesfristen må overholdes. Slik grunn foreligger for skolen spesielt ved:",
    items: [
      "Alvorlig brudd på denne kontrakten eller på skolens reglement",
      "Medbringelse, nytelse eller distribusjon av narkotika, alkohol eller rusmidler",
      "Tilstrekkelig mistanke om straffbare handlinger på skolen eller utenfor denne",
      "Utestående betaling av skolepenger eller andre gebyrer eller utlegg til tross for purring",
      "Dersom et tillitsfullt samarbeid mellom lærere, foreldre/foresatte og eleven ikke lenger er mulig",
    ],
  },
];

export default function ForeldreavtalePage() {
  return (
    <>
      <EditorialPageHeader
        title="Foreldreavtale /"
        highlight="Bekreftelse"
        subtitle="Gratulerer med skoleplassen. Les avtalen nøye og bekreft."
      />

      {/* ===== INTRO ===== */}
      <section className="py-4 lg:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-20 items-center">
            <FadeIn>
              <EditorialLabel accent>Viktig</EditorialLabel>
              <h2 className="font-heading text-lg lg:text-4xl font-bold text-text leading-tight">
                Avtale mellom Iqra og foresatte
              </h2>
            </FadeIn>
            <FadeIn delay={0.15}>
              <p className="text-xs lg:text-lg text-text-muted leading-relaxed">
                Denne avtalen er bindende og må leses og bekreftes før
                skoleplassen er endelig. Les hele avtalen under, og bekreft
                deretter via skjemaet nederst på siden. Du kan også laste ned
                avtalen som PDF.
              </p>
              <a
                href="/foreldreavtale.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 lg:mt-6 inline-flex items-center gap-2 px-4 lg:px-6 py-2 lg:py-3 text-sm lg:text-base border-2 border-border hover:border-primary text-text font-heading font-medium rounded-xl transition-colors duration-200"
              >
                <Download size={16} />
                Last ned avtalen (PDF)
              </a>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ===== AGREEMENT SECTIONS ===== */}
      <section className="py-4 lg:py-12 border-t border-border/50">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-8 lg:space-y-14">
            {SECTIONS.map((section, i) => (
              <FadeIn key={section.title} delay={i === 0 ? 0 : 0.05}>
                <article>
                  <h2 className="font-heading text-xl lg:text-3xl font-bold text-text">
                    {section.title}
                  </h2>
                  <div className="mt-3 w-12 h-px bg-border" />
                  {section.intro && (
                    <p className="mt-4 text-sm lg:text-lg text-text-muted leading-relaxed">
                      {section.intro}
                    </p>
                  )}
                  {section.items && (
                    <ul className="mt-4 space-y-2.5">
                      {section.items.map((item, j) => (
                        <li
                          key={j}
                          className="flex gap-3 text-sm lg:text-base text-text-body leading-relaxed"
                        >
                          <span
                            aria-hidden
                            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CONFIRM CTA ===== */}
      <section className="py-8 lg:py-16 border-t border-border/50">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="rounded-2xl bg-primary/5 border border-border p-6 lg:p-10 text-center">
              <h2 className="font-heading text-xl lg:text-3xl font-bold text-text">
                Når du har lest avtalen, bekreft her
              </h2>
              <p className="mt-3 text-sm lg:text-lg text-text-muted leading-relaxed max-w-xl mx-auto">
                Ved å fylle ut skjemaet bekrefter du at du har lest og godtar
                foreldreavtalen.
              </p>
              <a
                href={GOOGLE_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 px-6 lg:px-8 py-3 lg:py-4 bg-accent hover:bg-accent-light text-white font-bold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg text-sm lg:text-base"
              >
                Bekreft foreldreavtalen
                <ArrowRight size={16} />
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      <Footer />
    </>
  );
}
```

- [ ] **Step 3: Verify `EditorialLabel` supports the `accent` prop**

Run:
```bash
grep -n "accent" /Users/daodilyas/Desktop/iqra/src/components/EditorialLabel.tsx
```
Expected: an `accent` prop exists (it is used in `bli-medlem/page.tsx`). If the prop name differs, adjust the JSX above to match.

- [ ] **Step 4: Typecheck**

Run:
```bash
cd /Users/daodilyas/Desktop/iqra && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/daodilyas/Desktop/iqra
git add public/foreldreavtale.pdf src/app/foreldreavtale/page.tsx
git commit -m "feat: add foreldreavtale page with agreement text and confirm CTA"
```

---

### Task 2: Create the `AnnouncementMarquee` component

**Files:**
- Create: `src/components/AnnouncementMarquee.tsx`

- [ ] **Step 1: Create the component**

Pure-CSS marquee (no client JS) mirroring the working pattern in `src/components/ui/testimonials-with-marquee.tsx` (`group` + `animate-marquee` + `group-hover:[animation-play-state:paused]`, items repeated 4×). Links the whole strip to `/foreldreavtale` and clears the fixed navbar via `--navbar-h`.

Create `src/components/AnnouncementMarquee.tsx`:

```tsx
import Link from "next/link";

const MESSAGE = "Nye elever med opptak — les og bekreft foreldreavtalen";

export function AnnouncementMarquee() {
  return (
    <Link
      href="/foreldreavtale"
      aria-label="Nye elever med opptak: les og bekreft foreldreavtalen"
      className="group relative z-30 block w-full overflow-hidden bg-primary text-white"
      style={{ marginTop: "var(--navbar-h)" }}
    >
      <div className="flex overflow-hidden [--gap:0px] [gap:var(--gap)] [--duration:30s]">
        <div className="flex shrink-0 items-center [gap:var(--gap)] animate-marquee group-hover:[animation-play-state:paused] motion-reduce:[animation-play-state:paused]">
          {[...Array(4)].map((_, setIndex) => (
            <span
              key={setIndex}
              className="flex items-center whitespace-nowrap py-2 text-xs sm:text-sm font-medium tracking-wide"
            >
              <span className="px-5">{MESSAGE}</span>
              <span aria-hidden className="text-white/70">→</span>
              <span aria-hidden className="px-5 text-white/40">•</span>
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
cd /Users/daodilyas/Desktop/iqra && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/daodilyas/Desktop/iqra
git add src/components/AnnouncementMarquee.tsx
git commit -m "feat: add AnnouncementMarquee banner component"
```

---

### Task 3: Wire the marquee and the "Siste Nytt" link into the homepage

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Import the marquee**

In `src/app/page.tsx`, add to the import block (near the other component imports, e.g. after the `Hero` import on line 5):

```tsx
import { AnnouncementMarquee } from "@/components/AnnouncementMarquee";
```

- [ ] **Step 2: Render the marquee above the hero**

Replace the opening of the returned fragment:

```tsx
  return (
    <>
      {/* ===== HERO ===== */}
      <section id="hero">
        <Hero />
      </section>
```

with:

```tsx
  return (
    <>
      {/* ===== ANNOUNCEMENT BANNER ===== */}
      <AnnouncementMarquee />

      {/* ===== HERO ===== */}
      <section id="hero">
        <Hero />
      </section>
```

- [ ] **Step 3: Remove the now-duplicated top offset on the hero**

Because the marquee now sits below the fixed navbar (via `--navbar-h`) and the hero follows it, the hero no longer needs to reserve navbar space at the very top. In `src/components/Hero.tsx`, change the hero wrapper padding from `pt-20 md:pt-24` to a smaller `pt-6 md:pt-10` so there is not an oversized gap between banner and hero content.

Find in `src/components/Hero.tsx`:
```tsx
      className="relative w-full h-[100svh] flex flex-col md:flex-row items-center justify-center bg-white pt-20 md:pt-24 pb-4 md:pb-0 px-4 sm:px-6 lg:px-8 gap-4 md:gap-12 lg:gap-16 overflow-hidden"
```
Replace `pt-20 md:pt-24` with `pt-6 md:pt-10`. Leave the rest unchanged.

NOTE: Verify visually in Task 5 — if the hero feels too tight on mobile, nudge back up. (This is a judgment step; the preview check confirms it.)

- [ ] **Step 4: Add the small "Siste Nytt" text link**

In `src/app/page.tsx`, inside the `#aktuelt` section, just after the `SectionHeading` `FadeIn` block (after the closing `</FadeIn>` that wraps `SectionHeading`, before the news grid `FadeIn`), add:

```tsx
          <FadeIn delay={0.1}>
            <p className="mt-3 text-sm text-text-muted">
              Nye elever med opptak:{" "}
              <Link
                href="/foreldreavtale"
                className="text-accent font-medium underline underline-offset-4 hover:text-accent-light transition-colors"
              >
                les foreldreavtalen
              </Link>
              <span aria-hidden> →</span>
            </p>
          </FadeIn>
```

(`Link` is already imported in `page.tsx`.)

- [ ] **Step 5: Typecheck**

Run:
```bash
cd /Users/daodilyas/Desktop/iqra && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/daodilyas/Desktop/iqra
git add src/app/page.tsx src/components/Hero.tsx
git commit -m "feat: add foreldreavtale banner and Siste Nytt link to homepage"
```

---

### Task 4: Add the route to the sitemap

**Files:**
- Modify: `src/app/sitemap.ts`

- [ ] **Step 1: Add the sitemap entry**

In `src/app/sitemap.ts`, add a new entry to the returned array (e.g. after the `/bli-medlem/opptak` entry):

```tsx
    {
      url: `${baseUrl}/foreldreavtale`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.7,
    },
```

- [ ] **Step 2: Typecheck**

Run:
```bash
cd /Users/daodilyas/Desktop/iqra && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/daodilyas/Desktop/iqra
git add src/app/sitemap.ts
git commit -m "feat: add foreldreavtale to sitemap"
```

---

### Task 5: Build and browser verification

**Files:** none (verification only)

- [ ] **Step 1: Production build**

Run:
```bash
cd /Users/daodilyas/Desktop/iqra && npm run build
```
Expected: build succeeds, `/foreldreavtale` appears in the route list, no type/lint errors.

- [ ] **Step 2: Start the dev server via preview tools and verify the page**

Use `preview_start`, then `preview_snapshot` on `/foreldreavtale`:
- All 7 sections render with correct headings and bullet lists.
- "Last ned avtalen (PDF)" opens `/foreldreavtale.pdf`.
- "Bekreft foreldreavtalen" links to the Google Form URL with `target="_blank"`.

Check `preview_console_logs` for errors (expect none).

- [ ] **Step 3: Verify the homepage banner + link**

`preview_snapshot` on `/`:
- Marquee strip visible at the top, below the navbar, scrolling, pauses on hover.
- "Siste Nytt" section shows the "les foreldreavtalen →" link.
- `preview_resize` to mobile width: banner and hero look correct (no clipped navbar, no oversized gap).

- [ ] **Step 4: Capture proof**

`preview_screenshot` of `/foreldreavtale` and of the homepage top (banner). Share with the user.

---

### Task 6: Design audit (CLAUDE.md Phase 3)

**Files:** none (review only; apply fixes if found)

- [ ] **Step 1: Run the web-design-guidelines audit**

Load the `web-design-guidelines` skill and review the new/changed UI code
(`src/app/foreldreavtale/page.tsx`, `src/components/AnnouncementMarquee.tsx`, the homepage
edits) for accessibility, contrast, responsive behavior, and anti-patterns.

- [ ] **Step 2: Apply any fixes and re-verify**

Fix issues found, re-run `npx tsc --noEmit` and re-check the preview. Commit any fixes:
```bash
cd /Users/daodilyas/Desktop/iqra
git add -A && git commit -m "fix: address design audit findings on foreldreavtale page"
```

---

## Self-Review

**Spec coverage:**
- New `/foreldreavtale` route, full text, PDF download, confirm CTA → Task 1. ✓
- Agreement = 7 sections verbatim → Task 1 `SECTIONS`. ✓
- Rolling banner, homepage only, links to page → Tasks 2 & 3. ✓
- Small "Siste Nytt" text link → Task 3 Step 4. ✓
- Not added to main nav → respected (no `NAV_ITEMS` change). ✓
- PDF copied to `/public` → Task 1 Step 1. ✓
- Sitemap → Task 4. ✓
- Accessibility (semantic headings/lists, link rels, reduced motion) → built into Task 1/2 code; audited Task 6. ✓
- Verification (build, typecheck, preview) → Task 5. ✓

**Placeholder scan:** No TBD/TODO; all code blocks complete. The only judgment step (Hero padding in Task 3 Step 3) is explicitly flagged for visual confirmation in Task 5.

**Type consistency:** `SECTIONS`/`Section` type used consistently in Task 1; `AnnouncementMarquee` named export matches the import in Task 3; `EditorialLabel accent` prop verified in Task 1 Step 3 before use.
