# Demo-UI-løft «Handling + hovedbok» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the IQRA portal demo (all 5 roles) to the approved «Handling + hovedbok» dashboard pattern, fix the mobile attendance layout bug, polish both hero flows, upgrade index/workspace screens, and make every screen responsive — per the approved spec `docs/superpowers/specs/2026-07-24-demo-ui-elevation-design.md` (marketing repo, main @ 233ba68).

**Architecture:** All work happens in the **portal repo `/Users/daodilyas/dev/iqra-portal`** on the existing branch **`feat/demo-redesign`**. New reusable primitives land in `src/components/ui/` (StatLedger, HeroAction, ButtonLink, StickyActionBar, MiniBar), role-specific pieces in `src/components/portal/` (AttentionFeed, AttendanceStatusPicker), pure derivations in `src/lib/` (teacher-overview aggregation, humanizeEvent). Dashboards are server components composing these; MarkingClient/HjemClient/FakturakjoringClient stay client components. No token/font/shell changes; no new data sources — everything derives from the existing demo DAL.

**Tech Stack:** Next 16 App Router, React 19, Tailwind v4 (`@theme` tokens in `src/app/globals.css`), vitest + Testing Library (colocated `*.test.tsx`), demo mode via `NEXT_PUBLIC_DEMO=1`.

---

## Ground rules (read once)

- **Repo:** `cd /Users/daodilyas/dev/iqra-portal` — verify `git branch --show-current` prints `feat/demo-redesign` before the first commit.
- **Gate per task:** `npx tsc --noEmit` → 0 errors, targeted `npx vitest run <file>` → pass, then commit. Full `npm run test` + `NEXT_PUBLIC_DEMO=1 npm run build` at each milestone end (the M-final tasks say so).
- **Commits:** Conventional Commits, Norwegian subjects matching repo style (`feat(shell): …`, `fix(oppmote): …`). NEVER mention Claude/AI. Do not push.
- **Design law (from DESIGN.md, enforced in review):** no eyebrow/kicker labels, no side-stripe borders, no gradient text, no emoji-as-icons, no purple, never `#000`/`#fff`, Fraunces only for ceremony (greeting, big figures), ink never on house surfaces, warning never carries text directly (use `warning-ink` on `warning/15` tints), tone colours on figures **only when the count > 0**.
- **Existing APIs you will reuse** (do not re-invent): `Card` (`padding`, `tone`, `title`, `href`, `action`), `Chip` (`tone`), `DataList`/`DataRow` (`href`, `meta`), `DashboardHeader` (`name`, `context`, `actions`), `StatTile` (`label`, `value`, `sublabel`, `tone`), `SegmentedControl`, `Button` (`variant`, `loading`), `Avatar` (`name`, `initial`, `size`), `MoneyAmount` (`ore`, `tone`, `weight`), `ProgressLadder` (`label`, `current`, `total`, `percent`), `AttendanceStatusPill` (`status`), `MurajaahCard` (`entries`, `today`) — already a 7-column week strip, reuse as-is, `InvoiceStatusChip` (`status`), `PillLink`, `EmptyState` (`title`, `description`), `useToast`, helpers in `@/lib/dates` (`formatDateNb`, `formatTimeRange`, `formatWeekdayDateNb`, `formatDateTimeNb`, `scheduleLabel`) and `@/lib/cn`.
- **Test style:** follow `src/components/ui/Button.test.tsx` / `primitives.test.tsx` conventions (vitest + `@testing-library/react`, `screen`, `userEvent`). No magic numbers from demo fixtures — assert *consistency* against the DAL's own outputs where fixture values are involved.

---

# Milestone 1 — Mobil-oppmøtefeilen (bug først)

### Task 1: Restructure the marking roster row (two-line mobile anatomy)

The row in `MarkingClient` currently lays out `Avatar · name-block(flex-1) · ms-auto controls` in one `flex-wrap` row; at 375px the 152px status control + 44px pencil squeeze the name to nothing (per-word wrapping, chip/note collisions). Restructure to an explicit grid: name-line and control-line stack below `sm`, sit on one line ≥`sm`.

**Files:**
- Modify: `src/app/(portal)/laerer/timer/[lessonId]/MarkingClient.tsx` (the `<li>` render, currently lines ~137–205)

Pure layout change — no logic, no state, nothing a unit test could fail on for a real defect. Existing tests must stay green; verification is visual (step 3).

- [ ] **Step 1: Replace the roster `<li>` layout**

In `MarkingClient.tsx`, replace the entire `<li key={entry.student_id} …>` block (from `<li className="px-4 py-3">` through the note `</div>` before `</li>`) with:

```tsx
<li key={entry.student_id} className="px-4 py-3">
  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]">
    <Avatar name={entry.first_name} />
    <div className="min-w-0">
      <div className="flex min-w-0 items-baseline gap-x-2">
        <span className="truncate font-medium text-ink">{name}</span>
        <span className="shrink-0 text-sm tabular-nums text-ink/60">
          f. {entry.birth_year}
        </span>
      </div>
      {entry.notice ? (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Chip tone="neutral" className="px-2.5 py-0.5 text-xs">
            Forhåndsmeldt fravær
          </Chip>
          <span className="text-sm text-ink/60">{entry.notice.reason}</span>
        </div>
      ) : null}
    </div>
    <button
      type="button"
      onClick={() => toggleNote(entry.student_id)}
      aria-expanded={noteOpen}
      aria-controls={noteOpen ? `note-${entry.student_id}` : undefined}
      aria-label={
        hasNote ? `Rediger notat for ${name}` : `Legg til notat for ${name}`
      }
      className={cn(
        'inline-grid size-11 shrink-0 place-items-center rounded-md',
        'transition-colors duration-200 ease-brand',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        hasNote || noteOpen ? 'text-primary' : 'text-ink/45 hover:text-ink',
      )}
    >
      <PencilIcon />
    </button>
    <div className="col-span-3 sm:col-span-1 sm:col-start-3 sm:row-start-1">
      <AttendanceStatusControl
        value={state.status}
        onValueChange={(next) => updateStatus(entry, next)}
        ariaLabel={`Oppmøte, ${name}`}
        className="w-full sm:w-auto"
      />
    </div>
  </div>
  {noteOpen ? (
    <div className="mt-3">
      <textarea
        id={`note-${entry.student_id}`}
        value={state.note}
        onChange={(event) => updateNote(entry.student_id, event.target.value)}
        rows={2}
        aria-label={`Notat for ${name}`}
        placeholder="Valgfritt notat, f.eks. årsak til fravær"
        className={cn(
          'w-full rounded-md border border-border-input bg-canvas px-4 py-2.5',
          'text-base text-ink placeholder:text-ink/45',
          'transition-colors duration-200 ease-brand',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
      />
    </div>
  ) : null}
</li>
```

Grid logic: mobile = 3 columns (avatar · name · pencil) with the status control on row 2 spanning all three (`col-span-3`, full width, easy thumb target); ≥sm = 4 columns with the control back on row 1 (`sm:col-start-3 sm:row-start-1`) between name and pencil. The pencil stays on row 1 in both.

- [ ] **Step 2: Typecheck + existing tests**

```bash
cd /Users/daodilyas/dev/iqra-portal
npx tsc --noEmit && npm run test
```
Expected: 0 type errors; all existing unit tests pass (118).

- [ ] **Step 3: Browser-verify at 375px**

Dev server: `NEXT_PUBLIC_DEMO=1 npm run dev -- -p 3100` (background, reuse if already running). Open `http://localhost:3100/laerer/timer/1a000000-0000-0000-0000-000000000014` at 375×812. Verify: names on one line (truncated, never word-wrapped), Sumaya's chip + «Syk – blir borte i dag.» on their own line with no overlap, status control full-width under the name, pencil 44px. Then at 1280: single-line rows as before.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(portal)/laerer/timer/[lessonId]/MarkingClient.tsx"
git commit -m "fix(oppmote): to-linjers mobilanatomi for elevrader — navn/chip/kontroll kolliderer aldri"
```

---

# Milestone 2 — Mønsterkomponenter + lærer-dashbordet (eksemplaret)

### Task 2: `ButtonLink` — link styled as a button (DRY for every hero CTA)

**Files:**
- Create: `src/components/ui/ButtonLink.tsx`
- Test: `src/components/ui/ButtonLink.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/ButtonLink.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ButtonLink } from './ButtonLink';

describe('ButtonLink', () => {
  it('renders an anchor with the button treatment and the given href', () => {
    render(<ButtonLink href="/laerer/timer/1">Før oppmøte</ButtonLink>);
    const link = screen.getByRole('link', { name: 'Før oppmøte' });
    expect(link).toHaveAttribute('href', '/laerer/timer/1');
    expect(link.className).toContain('bg-primary');
  });

  it('supports the small size and secondary variant', () => {
    render(
      <ButtonLink href="/x" size="sm" variant="secondary">
        Åpne
      </ButtonLink>,
    );
    const link = screen.getByRole('link', { name: 'Åpne' });
    expect(link.className).toContain('min-h-9');
    expect(link.className).toContain('border-border-input');
  });
});
```

- [ ] **Step 2: Run it — must fail**

```bash
npx vitest run src/components/ui/ButtonLink.test.tsx
```
Expected: FAIL — `Cannot find module './ButtonLink'`.

- [ ] **Step 3: Implement**

```tsx
// src/components/ui/ButtonLink.tsx
import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'sm';

const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium ' +
  'transition-[transform,background-color,border-color] duration-200 ease-brand ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
  'active:scale-[0.97]';

const sizes: Record<Size, string> = {
  md: 'min-h-11 px-5 text-base',
  sm: 'min-h-9 px-3.5 text-sm',
};

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-strong',
  secondary:
    'border border-border-input bg-surface-tint text-ink hover:border-primary/40',
  ghost: 'bg-transparent text-primary hover:bg-surface-tint',
};

export interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
}

/** `next/link` wearing the Button treatment — for CTAs that navigate. */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={cn(base, sizes[size], variants[variant], className)} {...rest}>
      {children}
    </Link>
  );
}
```

- [ ] **Step 4: Run test — pass; typecheck**

```bash
npx vitest run src/components/ui/ButtonLink.test.tsx && npx tsc --noEmit
```
Expected: PASS, 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ButtonLink.tsx src/components/ui/ButtonLink.test.tsx
git commit -m "feat(ui): ButtonLink — lenke med knappedrakt (primær/sekundær/ghost, md/sm)"
```

### Task 3: `StatLedger` — the hovedbok stripe with the no-coloured-zeros rule

**Files:**
- Create: `src/components/ui/StatLedger.tsx`
- Test: `src/components/ui/StatLedger.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/StatLedger.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatLedger } from './StatLedger';

const items = (unmarked: number) => [
  { label: 'Timer i dag', value: 1, qualifier: 'å føre', tone: 'warning' as const, active: unmarked > 0, href: '/laerer' },
  { label: 'Elever', value: 7, qualifier: 'Klasse 1' },
  { label: 'Å vurdere', value: 3, qualifier: 'innleveringer', tone: 'warning' as const, active: true },
  { label: 'Uleste', value: 2, qualifier: 'meldinger' },
];

describe('StatLedger', () => {
  it('renders one cell per item with label, figure and qualifier', () => {
    render(<StatLedger items={items(1)} />);
    expect(screen.getByText('Timer i dag')).toBeInTheDocument();
    expect(screen.getByText('Elever')).toBeInTheDocument();
    expect(screen.getByText('innleveringer')).toBeInTheDocument();
  });

  it('applies the attention tone only when active (no coloured zeros)', () => {
    const { rerender } = render(<StatLedger items={items(1)} />);
    expect(screen.getByText('å føre').className).toContain('text-warning-ink');
    rerender(<StatLedger items={items(0)} />);
    expect(screen.getByText('å føre').className).not.toContain('text-warning-ink');
  });

  it('makes a cell a link when it has an href', () => {
    render(<StatLedger items={items(1)} />);
    expect(
      screen.getByRole('link', { name: /Timer i dag/ }),
    ).toHaveAttribute('href', '/laerer');
  });
});
```

- [ ] **Step 2: Run it — must fail**

```bash
npx vitest run src/components/ui/StatLedger.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// src/components/ui/StatLedger.tsx
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface StatLedgerItem {
  label: string;
  /** Headline figure — number or rich node (e.g. MoneyAmount). */
  value: ReactNode;
  /** Short qualifier after the figure, e.g. "å føre" / "13 fakturaer". */
  qualifier?: string;
  /** Attention tone for the qualifier … */
  tone?: 'warning' | 'danger' | 'success';
  /** … applied only when true — the "no coloured zeros" rule. */
  active?: boolean;
  /** Makes the whole cell a link. */
  href?: string;
}

const qualifierTones = {
  warning: 'text-warning-ink',
  danger: 'text-danger-ink',
  success: 'text-success-ink',
} as const;

function CellBody({ item }: { item: StatLedgerItem }) {
  const toned = item.tone && item.active;
  return (
    <>
      <span className="text-sm text-ink/60">{item.label}</span>
      <span className="flex items-baseline gap-2">
        <span className="font-display text-3xl font-medium tracking-tight tabular-nums text-ink">
          {item.value}
        </span>
        {item.qualifier ? (
          <span
            className={cn(
              'text-sm',
              toned ? cn('font-semibold', qualifierTones[item.tone!]) : 'text-ink/55',
            )}
          >
            {item.qualifier}
          </span>
        ) : null}
      </span>
    </>
  );
}

/**
 * The hovedbok stripe: ONE bordered surface, hairline-divided cells, Fraunces
 * figures (spec: never a grid of identical small cards). 2×2 below `md`, one
 * row from `md`. Cells with `href` are links.
 */
const mdCols: Record<number, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
};

export function StatLedger({
  items,
  className,
}: {
  items: StatLedgerItem[];
  className?: string;
}) {
  const cellPad = 'flex flex-col gap-1 px-5 py-4 sm:px-6 sm:py-5';
  const borders =
    'border-hairline [&>*:nth-child(even)]:border-s [&>*:nth-child(n+3)]:border-t ' +
    'md:[&>*]:border-t-0 md:[&>*+*]:border-s';
  return (
    <div
      className={cn(
        'grid grid-cols-2 rounded-lg border border-hairline bg-surface shadow-card',
        mdCols[Math.min(Math.max(items.length, 2), 4)],
        borders,
        className,
      )}
    >
      {items.map((item) =>
        item.href ? (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              cellPad,
              'transition-colors duration-200 ease-brand hover:bg-surface-tint/60',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
              items.length === 3 && 'last:col-span-2 md:last:col-span-1',
            )}
          >
            <CellBody item={item} />
          </Link>
        ) : (
          <div
            key={item.label}
            className={cn(
              cellPad,
              items.length === 3 && 'last:col-span-2 md:last:col-span-1',
            )}
          >
            <CellBody item={item} />
          </div>
        ),
      )}
    </div>
  );
}
```

**Why the `mdCols` map:** Tailwind v4 only generates classes it can see statically — an interpolated `md:grid-cols-${n}` would silently produce no CSS. The static map keeps all three variants in the source text.

- [ ] **Step 4: Run test — pass; typecheck**

```bash
npx vitest run src/components/ui/StatLedger.test.tsx && npx tsc --noEmit
```
Expected: PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/StatLedger.tsx src/components/ui/StatLedger.test.tsx
git commit -m "feat(ui): StatLedger — hovedbok-stripe med null-toneregel, celle-lenker og 2x2-mobil"
```

### Task 4: `HeroAction` — the next-action card with the all-clear rule

**Files:**
- Create: `src/components/ui/HeroAction.tsx`
- Test: `src/components/ui/HeroAction.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/HeroAction.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Chip } from './Chip';
import { HeroAction } from './HeroAction';

describe('HeroAction', () => {
  it('renders figure, title, description, chip and CTA', () => {
    render(
      <HeroAction
        figure={{ primary: '10:00', secondary: '–13:00 · Rom 2' }}
        title="Klasse 1"
        description="7 elever · Sumaya har forhåndsmeldt fravær i dag"
        chip={<Chip tone="warning">Ikke ført</Chip>}
        action={{ href: '/laerer/timer/1', label: 'Før oppmøte' }}
      />,
    );
    expect(screen.getByText('10:00')).toBeInTheDocument();
    expect(screen.getByText('Klasse 1')).toBeInTheDocument();
    expect(screen.getByText('Ikke ført')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Før oppmøte' })).toHaveAttribute(
      'href',
      '/laerer/timer/1',
    );
  });

  it('all-clear state renders the quiet line and no CTA', () => {
    render(
      <HeroAction
        title="Alt ført"
        allClear="Neste time: lørdag 21. november"
      />,
    );
    expect(screen.getByText('Alt ført')).toBeInTheDocument();
    expect(screen.getByText('Neste time: lørdag 21. november')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it — must fail**

```bash
npx vitest run src/components/ui/HeroAction.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// src/components/ui/HeroAction.tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { ButtonLink } from './ButtonLink';

export interface HeroActionProps {
  /** Left tint block, e.g. { primary: '10:00', secondary: '–13:00 · Rom 2' }. */
  figure?: { primary: string; secondary?: string };
  title: string;
  description?: string;
  /** Status chip rendered above the CTA (e.g. «Ikke ført»). */
  chip?: ReactNode;
  /** The one primary action. Omitted in the all-clear state. */
  action?: { href: string; label: string };
  /**
   * All-clear: replaces chip+CTA with a quiet success line. The hero never
   * nags — when there is nothing urgent it says so and stops.
   */
  allClear?: string;
  className?: string;
}

/**
 * The dashboard hero: the role's single most urgent action, unmissable but on
 * a working surface (canvas-side card — house green stays a brand moment).
 * Stacks below `sm` with a full-width CTA.
 */
export function HeroAction({
  figure,
  title,
  description,
  chip,
  action,
  allClear,
  className,
}: HeroActionProps) {
  return (
    <section
      aria-label={title}
      className={cn(
        'flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:gap-6 sm:p-6',
        className,
      )}
    >
      {figure ? (
        <div className="flex shrink-0 flex-col items-center rounded-sm bg-surface-tint px-5 py-3 text-center">
          <span className="font-display text-2xl font-medium tracking-tight tabular-nums text-ink">
            {figure.primary}
          </span>
          {figure.secondary ? (
            <span className="text-xs text-ink/60">{figure.secondary}</span>
          ) : null}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-ink/65">{description}</p>
        ) : null}
        {allClear ? (
          <p className="mt-1 flex items-center gap-2 text-sm font-medium text-success-ink">
            <CheckIcon />
            {allClear}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          {chip ? <div className="self-start sm:self-end">{chip}</div> : null}
          <ButtonLink href={action.href} className="w-full sm:w-auto">
            {action.label}
          </ButtonLink>
        </div>
      ) : null}
    </section>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.2 2.4 2.4 4.6-5" />
    </svg>
  );
}
```

- [ ] **Step 4: Run test — pass; typecheck**

```bash
npx vitest run src/components/ui/HeroAction.test.tsx && npx tsc --noEmit
```
Expected: PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/HeroAction.tsx src/components/ui/HeroAction.test.tsx
git commit -m "feat(ui): HeroAction — neste-handling-kort med alt-i-orden-regel"
```

### Task 5: `AttentionFeed` — the «Trenger oppmerksomhet» stream

**Files:**
- Create: `src/components/portal/AttentionFeed.tsx`
- Test: `src/components/portal/AttentionFeed.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/portal/AttentionFeed.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AttentionFeed, type AttentionItem } from './AttentionFeed';

const items: AttentionItem[] = [
  {
    id: 'a',
    severity: 'warning',
    subject: 'Sumaya Hassan',
    detail: 'forhåndsmeldt fravær i dag: «Syk – blir borte i dag.»',
    href: '/laerer/timer/1',
  },
  { id: 'b', severity: 'neutral', subject: '3 innleveringer', detail: 'venter på vurdering' },
];

describe('AttentionFeed', () => {
  it('renders subject and detail per row; href rows are links', () => {
    render(<AttentionFeed items={items} />);
    expect(screen.getByText('Sumaya Hassan')).toBeInTheDocument();
    expect(screen.getByText(/venter på vurdering/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sumaya Hassan/ })).toHaveAttribute(
      'href',
      '/laerer/timer/1',
    );
  });

  it('renders nothing at all when the list is empty', () => {
    const { container } = render(<AttentionFeed items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run it — must fail**

```bash
npx vitest run src/components/portal/AttentionFeed.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// src/components/portal/AttentionFeed.tsx
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

export interface AttentionItem {
  id: string;
  /** warning = needs a decision soon; neutral = worth knowing. */
  severity: 'warning' | 'neutral';
  /** Bold lead, e.g. a student or family name. */
  subject: string;
  /** One explaining line. */
  detail: string;
  href?: string;
}

const dots = { warning: 'bg-warning', neutral: 'bg-ink/30' } as const;

function Row({ item }: { item: AttentionItem }) {
  const body = (
    <>
      <span
        aria-hidden
        className={cn('mt-[7px] size-1.5 shrink-0 rounded-full', dots[item.severity])}
      />
      <span className="min-w-0 text-sm leading-relaxed text-ink">
        <span className="font-semibold">{item.subject}</span> — {item.detail}
      </span>
    </>
  );
  const rowClass = 'flex items-start gap-2.5 py-2.5';
  return (
    <li className="border-t border-hairline first:border-t-0">
      {item.href ? (
        <Link
          href={item.href}
          className={cn(
            rowClass,
            '-mx-2 rounded-sm px-2 transition-colors duration-200 ease-brand hover:bg-surface-tint/60',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
          )}
        >
          {body}
        </Link>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  );
}

/**
 * «Trenger oppmerksomhet» — the dashboard's exception stream. Absent when
 * there are no exceptions (an empty alarm list is noise, not calm).
 */
export function AttentionFeed({
  items,
  className,
}: {
  items: AttentionItem[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <Card title="Trenger oppmerksomhet" className={className}>
      <ul>
        {items.slice(0, 5).map((item) => (
          <Row key={item.id} item={item} />
        ))}
      </ul>
    </Card>
  );
}
```

- [ ] **Step 4: Run test — pass; typecheck**

```bash
npx vitest run src/components/portal/AttentionFeed.test.tsx && npx tsc --noEmit
```
Expected: PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/portal/AttentionFeed.tsx src/components/portal/AttentionFeed.test.tsx
git commit -m "feat(portal): AttentionFeed — trenger-oppmerksomhet-strøm med severity-prikker"
```

### Task 6: Teacher overview aggregation (demo DAL)

The teacher dashboard needs counts and exceptions that exist in demo data but have no single accessor: pending reviews, unread messages, today's absence notices, repeteres flags, and the class's quran entries for the muraja'ah card.

**Files:**
- Create: `src/lib/dal/teacher-overview.ts`
- Test: `src/lib/dal/teacher-overview.test.ts`
- Read first (shapes/fixtures — do NOT modify): `src/lib/dal/messaging.ts` (ThreadListItemVM's unread field), `src/lib/dal/progress.ts` (demo assembly + QuranEntryView source), `src/lib/demo/data/progress.ts`, `src/lib/demo/data/messaging.ts`

- [ ] **Step 1: Read the four files above.** Note (a) the exact unread field on `ThreadListItemVM`, (b) how progress.ts's demo branch builds `QuranEntryView[]` per student and which students have entries, (c) fixture student/class ids. Adjust field names in the code below to what you find (the *contract* below is fixed; exact demo-internal imports may differ).

- [ ] **Step 2: Write the failing test** — consistency-based (no fixture magic numbers):

```ts
// src/lib/dal/teacher-overview.test.ts
import { describe, expect, it } from 'vitest';
import { getTeacherAssignments } from './assignments';
import { getTeacherDayOverview } from './attendance';
import { getTeacherOverviewExtras } from './teacher-overview';

describe('getTeacherOverviewExtras (demo)', () => {
  it('ledger counts agree with the underlying DAL views', async () => {
    const [extras, day, assignments] = await Promise.all([
      getTeacherOverviewExtras(),
      getTeacherDayOverview(),
      getTeacherAssignments(),
    ]);
    expect(extras.ledger.lessons_today).toBe(day.lessons.length);
    expect(extras.ledger.unmarked_today).toBe(
      day.lessons.filter((l) => !l.marked).length,
    );
    expect(extras.ledger.student_count).toBe(
      day.classes.reduce((sum, c) => sum + c.active_count, 0),
    );
    expect(extras.ledger.pending_reviews).toBe(assignments.pending_total);
    expect(extras.ledger.unread_messages).toBeGreaterThanOrEqual(0);
  });

  it('surfaces today\'s pre-reported absences as warning attention items', async () => {
    const extras = await getTeacherOverviewExtras();
    const noticeItems = extras.attention.filter((a) => a.severity === 'warning');
    for (const item of noticeItems) {
      expect(item.subject.length).toBeGreaterThan(0);
      expect(item.detail.length).toBeGreaterThan(0);
    }
  });

  it('returns the class quran entries for the muraja\'ah week', async () => {
    const extras = await getTeacherOverviewExtras();
    expect(Array.isArray(extras.murajaah_entries)).toBe(true);
  });
});
```

Run: `npx vitest run src/lib/dal/teacher-overview.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement the contract**

```ts
// src/lib/dal/teacher-overview.ts
import 'server-only';
import type { QuranEntryView } from '@/components/portal/quranProgress';
import type { AttentionItem } from '@/components/portal/AttentionFeed';
import { getTeacherAssignments } from './assignments';
import { getLessonForMarking, getTeacherDayOverview } from './attendance';
import { getTeacherMessaging } from './messaging';

export interface TeacherLedgerVM {
  lessons_today: number;
  unmarked_today: number;
  student_count: number;
  pending_reviews: number;
  unread_messages: number;
}

export interface TeacherOverviewExtras {
  ledger: TeacherLedgerVM;
  /** Exception stream, warning items first, max 5 consumed downstream. */
  attention: AttentionItem[];
  /** The class's memorisation log — feeds MurajaahCard on the dashboard. */
  murajaah_entries: QuranEntryView[];
}

export async function getTeacherOverviewExtras(): Promise<TeacherOverviewExtras> {
  const [day, assignments, messaging] = await Promise.all([
    getTeacherDayOverview(),
    getTeacherAssignments(),
    getTeacherMessaging(),
  ]);

  // Today's rosters → pre-reported absence notices + link target per lesson.
  const markings = await Promise.all(
    day.lessons.map((lesson) => getLessonForMarking(lesson.lesson_id)),
  );

  const attention: AttentionItem[] = [];
  for (const view of markings) {
    if (!view) continue;
    for (const entry of view.roster) {
      if (entry.notice) {
        attention.push({
          id: `notice-${entry.student_id}`,
          severity: 'warning',
          subject: `${entry.first_name} ${entry.last_name}`,
          detail: `forhåndsmeldt fravær i dag: «${entry.notice.reason}»`,
          href: `/laerer/timer/${view.lesson.id}`,
        });
      }
    }
  }

  // Repeteres flags from the class's memorisation log (latest entry per surah
  // with result 'repeat') — implementation reads the same demo progress source
  // progress.ts uses; adjust the import to the actual module found in Step 1.
  const murajaah_entries: QuranEntryView[] = await getClassQuranEntries();
  for (const entry of latestPerSurah(murajaah_entries)) {
    if (entry.result === 'repeat') {
      attention.push({
        id: `repeat-${entry.student_id}-${entry.surah_number}`,
        severity: 'warning',
        subject: entry.student_name,
        detail: `${entry.surah_name} repeteres${entry.note ? ` — ${entry.note}` : ''}`,
        href: `/laerer/elev/${entry.student_id}`,
      });
    }
  }

  if (assignments.pending_total > 0) {
    attention.push({
      id: 'pending-reviews',
      severity: 'neutral',
      subject: `${assignments.pending_total} innlevering${assignments.pending_total === 1 ? '' : 'er'}`,
      detail: 'venter på vurdering',
      href: '/laerer/oppgaver',
    });
  }

  const unread = countUnread(messaging); // sum the unread field found in Step 1

  return {
    ledger: {
      lessons_today: day.lessons.length,
      unmarked_today: day.lessons.filter((l) => !l.marked).length,
      student_count: day.classes.reduce((sum, c) => sum + c.active_count, 0),
      pending_reviews: assignments.pending_total,
      unread_messages: unread,
    },
    attention,
    murajaah_entries,
  };
}
```

`getClassQuranEntries`, `latestPerSurah`, `countUnread` are small local helpers you write against the real demo modules discovered in Step 1 (QuranEntryView may lack `student_id`/`student_name`/`note` — if so, extend the local item type by joining with the roster from progress demo data; do NOT change `QuranEntryView` itself). Keep the file `server-only` like the other DAL modules.

- [ ] **Step 4: Run test — pass; typecheck**

```bash
npx vitest run src/lib/dal/teacher-overview.test.ts && npx tsc --noEmit
```
Expected: PASS, 0 errors. (If the DAL tests need the demo env flag, run with `NEXT_PUBLIC_DEMO=1` — check how existing DAL tests in the repo set it; mirror that.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/dal/teacher-overview.ts src/lib/dal/teacher-overview.test.ts
git commit -m "feat(dal): getTeacherOverviewExtras — hovedbok-tall, oppmerksomhetsstrøm og murajaah-grunnlag for lærer"
```

### Task 7: Rewrite the teacher dashboard (the exemplar screen)

**Files:**
- Modify: `src/app/(portal)/laerer/page.tsx` (full rewrite below)

- [ ] **Step 1: Replace the whole file**

```tsx
// src/app/(portal)/laerer/page.tsx
import type { Metadata } from 'next';
import { AttentionFeed } from '@/components/portal/AttentionFeed';
import { MurajaahCard } from '@/components/portal/MurajaahCard';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import { DataList, DataRow } from '@/components/ui/DataList';
import { EmptyState } from '@/components/ui/EmptyState';
import { HeroAction } from '@/components/ui/HeroAction';
import { StatLedger } from '@/components/ui/StatLedger';
import { getTeacherDayOverview } from '@/lib/dal/attendance';
import { getTeacherOverviewExtras } from '@/lib/dal/teacher-overview';
import { getGreetingNameForRole } from '@/lib/dal/session';
import {
  formatTime,
  formatTimeRange,
  formatWeekdayDateNb,
  scheduleLabel,
} from '@/lib/dates';

export const metadata: Metadata = { title: 'I dag' };

export default async function LaererIDag() {
  const [{ date, lessons, classes }, extras, greetingName] = await Promise.all([
    getTeacherDayOverview(),
    getTeacherOverviewExtras(),
    getGreetingNameForRole('teacher'),
  ]);

  const nextUnmarked = lessons.find((l) => !l.marked);

  return (
    <div className="flex flex-col gap-8">
      <DashboardHeader
        name={greetingName}
        context={formatWeekdayDateNb(date)}
      />

      {nextUnmarked ? (
        <HeroAction
          figure={{
            primary: formatTime(nextUnmarked.starts_at),
            secondary: `–${formatTime(nextUnmarked.ends_at)}${nextUnmarked.room ? ` · ${nextUnmarked.room}` : ''}`,
          }}
          title={nextUnmarked.class_name}
          description={heroDescription(extras.attention)}
          chip={<Chip tone="warning">Ikke ført</Chip>}
          action={{
            href: `/laerer/timer/${nextUnmarked.lesson_id}`,
            label: 'Før oppmøte',
          }}
        />
      ) : (
        <HeroAction
          title={lessons.length > 0 ? 'Alt ført' : 'Ingen timer i dag'}
          allClear={nextLessonLine(classes)}
        />
      )}

      <StatLedger
        items={[
          {
            label: 'Timer i dag',
            value: extras.ledger.lessons_today,
            qualifier: 'å føre',
            tone: 'warning',
            active: extras.ledger.unmarked_today > 0,
          },
          {
            label: 'Elever',
            value: extras.ledger.student_count,
            qualifier: classes[0]?.name,
            href: '/laerer/klasser',
          },
          {
            label: 'Å vurdere',
            value: extras.ledger.pending_reviews,
            qualifier: 'innleveringer',
            tone: 'warning',
            active: extras.ledger.pending_reviews > 0,
            href: '/laerer/oppgaver',
          },
          {
            label: 'Uleste',
            value: extras.ledger.unread_messages,
            qualifier: 'meldinger',
            href: '/laerer/meldinger',
          },
        ]}
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.45fr_1fr]">
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-ink">Dagens timer</h2>
          {lessons.length === 0 ? (
            <EmptyState
              title="Ingen timer i dag"
              description="Du har ingen undervisning i dag. Timene dukker opp her på undervisningsdagene, klare for oppmøteregistrering."
            />
          ) : (
            <DataList>
              {lessons.map((lesson) => (
                <DataRow
                  key={lesson.lesson_id}
                  href={`/laerer/timer/${lesson.lesson_id}`}
                  meta={
                    lesson.marked ? (
                      <Chip tone="success">Ført</Chip>
                    ) : (
                      <Chip tone="warning">Ikke ført</Chip>
                    )
                  }
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-ink">{lesson.class_name}</span>
                    <span className="text-sm text-ink/60">
                      {formatTimeRange(lesson.starts_at, lesson.ends_at)}
                      {lesson.room ? ` · ${lesson.room}` : ''}
                    </span>
                  </div>
                </DataRow>
              ))}
            </DataList>
          )}
        </section>

        <AttentionFeed items={extras.attention} className="lg:mt-11" />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-ink">Mine klasser</h2>
          {classes.length === 0 ? (
            <EmptyState
              title="Ingen klasser ennå"
              description="Når administrasjonen har satt deg opp som lærer for en klasse, finner du den her."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {classes.map((cls) => (
                <Card key={cls.id} href={`/laerer/klasser/${cls.id}`} title={cls.name}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink/70">
                    <span>{cls.schedule.map(scheduleLabel).join(' · ')}</span>
                    {cls.room ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>{cls.room}</span>
                      </>
                    ) : null}
                    <span aria-hidden>·</span>
                    <span className="tabular-nums">{cls.active_count} elever</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <MurajaahCard entries={extras.murajaah_entries} today={date} className="lg:mt-11" />
      </div>
    </div>
  );
}

/** Hero context: student count + the first warning exception, if any. */
function heroDescription(attention: { severity: string; subject: string; detail: string }[]): string | undefined {
  const first = attention.find((a) => a.severity === 'warning');
  return first ? `${first.subject} — ${first.detail}` : undefined;
}

function nextLessonLine(
  classes: { schedule: { weekday: number; starts_at: string; ends_at: string }[] }[],
): string | undefined {
  const slot = classes[0]?.schedule[0];
  return slot
    ? `Neste time: ${scheduleLabel(slot)}`
    : undefined;
}
```

Check `formatTime` exists in `@/lib/dates` (it does, line 18). The `lg:mt-11` on the right-zone cards aligns their tops with the left sections' content (below the h2); verify visually and drop if EmptyState/heading heights make it off.

- [ ] **Step 2: Typecheck + full unit run**

```bash
npx tsc --noEmit && npm run test
```
Expected: 0 errors, all tests pass.

- [ ] **Step 3: Browser-verify** `http://localhost:3100/laerer` at 1280 (hero → ledger → two zones → classes+murajaah; no dead right half) and 375 (hero stacks with full-width CTA; ledger 2×2; zones stacked). Verify hero CTA navigates to the marking screen.

- [ ] **Step 4: Milestone gate + commit**

```bash
NEXT_PUBLIC_DEMO=1 npm run build
```
Expected: build succeeds, all routes static-generate.

```bash
git add "src/app/(portal)/laerer/page.tsx"
git commit -m "feat(laerer): dashbord på handling+hovedbok-mønsteret — hero, stripe, soner, murajaah-uke"
```

---

# Milestone 3 — Øvrige dashbord

### Task 8: Forelder dashboard — stacked child bands, payment hero

**Files:**
- Modify: `src/app/(portal)/forelder/HjemClient.tsx` (full rewrite below)
- Keep: `src/app/(portal)/forelder/page.tsx` unchanged (it just fetches `getGuardianHome`).

All data already exists on `GuardianHome` (children snapshots incl. `unread_count`, `outstanding`, `unread_total`). The child SegmentedControl disappears from this screen (both children render); it remains on subpages.

- [ ] **Step 1: Replace `HjemClient.tsx` entirely**

```tsx
// src/app/(portal)/forelder/HjemClient.tsx
import { AttendanceStatusPill } from '@/components/portal/AttendanceStatusPill';
import { AttentionFeed, type AttentionItem } from '@/components/portal/AttentionFeed';
import { MoneyAmount } from '@/components/portal/MoneyAmount';
import {
  QURAN_RESULT_META,
  quranPositionLabel,
} from '@/components/portal/quranProgress';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import { HeroAction } from '@/components/ui/HeroAction';
import { StatLedger } from '@/components/ui/StatLedger';
import { formatDateNb, formatTimeRange, formatWeekdayDateNb } from '@/lib/dates';
import type { ChildHomeSnapshot, GuardianHome } from '@/lib/dal/guardian';

/**
 * The parent home on the «handling + hovedbok» pattern: the family's single
 * most urgent action first (money due, else today's lesson), then BOTH
 * children as stacked bands — no toggle to discover; scanning beats switching.
 */
export function HjemClient({ home }: { home: GuardianHome }) {
  return (
    <div className="flex flex-col gap-8">
      <DashboardHeader
        name={home.guardian_name}
        context={formatWeekdayDateNb(home.today)}
      />

      <FamilyHero home={home} />

      {home.children.length === 0 ? (
        <Card>
          <p className="text-ink/70">
            Ingen barn er registrert på deg ennå. Ta kontakt med administrasjonen.
          </p>
        </Card>
      ) : (
        home.children.map((snapshot) => (
          <ChildBand key={snapshot.child.student_id} snapshot={snapshot} />
        ))
      )}

      <AttentionFeed items={familyAttention(home)} />
    </div>
  );
}

function FamilyHero({ home }: { home: GuardianHome }) {
  const { outstanding } = home;
  if (outstanding) {
    return (
      <HeroAction
        title={outstanding.title}
        description={
          outstanding.due_on
            ? `Forfall ${formatDateNb(outstanding.due_on)} · med KID og kontonummer på fakturaen`
            : 'Med KID og kontonummer på fakturaen'
        }
        figure={undefined}
        chip={
          outstanding.status === 'overdue' ? (
            <Chip tone="danger">Forfalt</Chip>
          ) : (
            <Chip tone="warning">Utestående</Chip>
          )
        }
        action={{
          href: `/forelder/okonomi/faktura/${outstanding.invoice_id}`,
          label: 'Se faktura og betal',
        }}
      />
    );
  }

  const todays = home.children.find((c) => c.next_lesson?.is_today)?.next_lesson;
  if (todays) {
    return (
      <HeroAction
        figure={{
          primary: todays.starts_at.slice(0, 5),
          secondary: todays.room ?? undefined,
        }}
        title="Undervisning i dag"
        description={`${formatTimeRange(todays.starts_at, todays.ends_at)}${todays.room ? ` · ${todays.room}` : ''}`}
        action={{ href: '/forelder/oppmote', label: 'Se oppmøte' }}
      />
    );
  }

  return <HeroAction title="Alt i orden" allClear="Ingen utestående — alt er betalt." />;
}

function ChildBand({ snapshot }: { snapshot: ChildHomeSnapshot }) {
  const { child, next_lesson, attendance, book, quran_current, unread_count } = snapshot;
  const presentPct = Math.round(attendance.present_rate * 100);

  return (
    <section
      aria-label={`Oversikt for ${child.first_name}`}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-xl font-semibold text-ink">
          {child.first_name} {child.last_name}
        </h2>
        {child.class_name ? (
          <span className="text-ink/60">{child.class_name}</span>
        ) : null}
        {unread_count > 0 ? (
          <Chip tone="success" className="px-2.5 py-0.5 text-xs">
            {unread_count} ny{unread_count === 1 ? '' : 'e'} melding{unread_count === 1 ? '' : 'er'}
          </Chip>
        ) : null}
      </div>

      <StatLedger
        items={[
          {
            label: 'Oppmøte',
            value: attendance.total > 0 ? `${presentPct}%` : '–',
            qualifier: attendance.total > 0 ? 'til stede i høst' : 'ingen registreringer',
            href: '/forelder/oppmote',
          },
          {
            label: book ? book.subject_name : 'Bok',
            value: book ? `${book.current}` : '–',
            qualifier: book ? `av ${book.total} enheter` : 'ikke i gang',
            href: '/forelder/fremdrift',
          },
          {
            label: 'Koran',
            value: quran_current ? quranPositionLabel(quran_current) : '–',
            qualifier: quran_current
              ? QURAN_RESULT_META[quran_current.result].label
              : 'ikke i gang',
            tone: 'warning',
            active: quran_current?.result === 'repeat',
            href: '/forelder/fremdrift',
          },
        ]}
      />

      <p className="text-sm text-ink/60">
        {next_lesson
          ? `Neste time: ${formatWeekdayDateNb(next_lesson.date)} · ${formatTimeRange(next_lesson.starts_at, next_lesson.ends_at)}${next_lesson.room ? ` · ${next_lesson.room}` : ''}`
          : 'Ingen kommende timer planlagt.'}
        {attendance.last_status ? (
          <span className="ms-2 inline-flex items-center gap-1.5 align-middle">
            · Siste: <AttendanceStatusPill status={attendance.last_status} />
          </span>
        ) : null}
      </p>
    </section>
  );
}

function familyAttention(home: GuardianHome): AttentionItem[] {
  const items: AttentionItem[] = [];
  if (home.outstanding && home.outstanding.status === 'overdue') {
    items.push({
      id: 'overdue',
      severity: 'warning',
      subject: home.outstanding.title,
      detail: 'har forfalt — betal snarest for å unngå purring',
      href: `/forelder/okonomi/faktura/${home.outstanding.invoice_id}`,
    });
  }
  for (const c of home.children) {
    if (c.quran_current?.result === 'repeat') {
      items.push({
        id: `repeat-${c.child.student_id}`,
        severity: 'neutral',
        subject: c.child.first_name,
        detail: `øver fortsatt på ${quranPositionLabel(c.quran_current)} — se muraja'ah-planen`,
        href: '/forelder/fremdrift',
      });
    }
  }
  if (home.unread_total > 0) {
    items.push({
      id: 'unread',
      severity: 'neutral',
      subject: `${home.unread_total} ulest${home.unread_total === 1 ? '' : 'e'} melding${home.unread_total === 1 ? '' : 'er'}`,
      detail: 'fra lærer eller kontor',
      href: '/forelder/meldinger',
    });
  }
  return items;
}
```

Notes: the `'use client'` directive is intentionally gone — the rewrite holds no state, so the file becomes a plain server-rendered component. `StatLedger.value` accepts ReactNode, so the Koran cell can carry a short position string — if `quranPositionLabel` runs long (e.g. «Al-Ikhlas 1–4»), it renders at text-3xl; verify visually and if it overflows, switch that cell's value to the surah name only.

- [ ] **Step 2: Typecheck + tests + browser-verify** (`/forelder` at 1280 + 375: hero first, both children as bands, no toggle, feed last; check invoice-detail route `/forelder/okonomi/faktura/[id]` exists — it does per the route tree).

```bash
npx tsc --noEmit && npm run test
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(portal)/forelder/HjemClient.tsx"
git commit -m "feat(forelder): hjem på mønsteret — betalingshero, stablede barnebånd, familie-obs"
```

### Task 9: Økonomi dashboard — overdue hero, ledger with % innbetalt

**Files:**
- Modify: `src/app/(portal)/okonomi/page.tsx`

- [ ] **Step 1: Rework the page top** — keep `InvoiceRowLabel`, the «Forfalt, krever handling» section and the grouped register, but: (a) insert a hero above the stat band; (b) replace the `Card padding="none"` + 3×`StatTile` band with `StatLedger`; (c) drop the per-row `InvoiceStatusChip` inside the grouped register (the group heading already says the status — keep the chip ONLY in the overdue section where it shows days over); (d) move the «Start fakturakjøring» CTA into the hero when there are no overdue invoices, keeping the header CTA otherwise. Replace the component body from the `return (` down to (but not including) the `overdue.length > 0` section with:

```tsx
  const overdueSum = overdue.reduce((sum, row) => sum + row.outstanding_ore, 0);
  const paidPct =
    stats.billed_ore > 0 ? Math.round((stats.paid_ore / stats.billed_ore) * 100) : 0;

  return (
    <div className="flex flex-col gap-8">
      <DashboardHeader
        name={greetingName}
        context={`Økonomi · ${term.name}`}
        actions={
          <ButtonLink href="/okonomi/fakturakjoring">Start fakturakjøring</ButtonLink>
        }
      />

      {stats.overdue_count > 0 ? (
        <HeroAction
          title={`${stats.overdue_count} forfalt${stats.overdue_count === 1 ? '' : 'e'} faktura${stats.overdue_count === 1 ? '' : 'er'}`}
          description="Send purringer, eller registrer innbetalinger via bankavstemming."
          figure={undefined}
          chip={<Chip tone="danger"><MoneyAmount ore={overdueSum} tone="danger" weight="semibold" /></Chip>}
          action={{ href: '/okonomi/purringer', label: 'Gå til purringer' }}
        />
      ) : (
        <HeroAction
          title="Ingen forfalte fakturaer"
          allClear={`${paidPct} % av terminen er innbetalt.`}
        />
      )}

      <StatLedger
        items={[
          {
            label: 'Fakturert',
            value: <MoneyAmount ore={stats.billed_ore} />,
            qualifier: `${stats.invoice_count} fakturaer`,
          },
          {
            label: 'Betalt',
            value: <MoneyAmount ore={stats.paid_ore} tone="success" />,
            qualifier: `${paidPct} % innbetalt`,
            tone: 'success',
            active: stats.paid_ore > 0,
          },
          {
            label: 'Utestående',
            value: <MoneyAmount ore={stats.outstanding_ore} tone="warning" />,
            qualifier: `${stats.overdue_count} forfalt`,
            tone: 'warning',
            active: stats.overdue_count > 0,
            href: '/okonomi/purringer',
          },
        ]}
      />
```

Then in the grouped register (`groups.map…`), change the row `meta` to drop the status chip:

```tsx
meta={
  <MoneyAmount
    ore={row.outstanding_ore > 0 ? row.outstanding_ore : row.gross_ore}
    tone={row.outstanding_ore > 0 ? 'default' : 'muted'}
    weight="medium"
  />
}
```

Add imports: `ButtonLink`, `HeroAction`, `StatLedger`; remove now-unused `StatTile` import (and `InvoiceStatusChip` if no usage remains — check; it may still be used in the overdue section? No — the overdue section uses `Chip tone="danger"` + `MoneyAmount`; delete the import if unused). NB `Chip` inside the hero wraps a `MoneyAmount` — verify the chip's `text-sm` doesn't fight MoneyAmount's own classes; if it looks off, use a plain `<MoneyAmount … />` as `chip` without wrapping.

- [ ] **Step 2: Typecheck, tests, browser-verify** `/okonomi` (1280 + 375: hero says «2 forfalte…» with sum chip, ledger 2×2 on mobile with Utestående spanning, register rows chip-free). `npx tsc --noEmit && npm run test`

- [ ] **Step 3: Commit**

```bash
git add "src/app/(portal)/okonomi/page.tsx"
git commit -m "feat(okonomi): dashbord på mønsteret — forfalt-hero, hovedbok med innbetalt-andel, chip-rydding"
```

### Task 10: humanizeEvent + Admin dashboard

**Files:**
- Create: `src/lib/admin/humanize-event.ts`
- Test: `src/lib/admin/humanize-event.test.ts`
- Modify: `src/app/(portal)/admin/page.tsx`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/admin/humanize-event.test.ts
import { describe, expect, it } from 'vitest';
import { humanizeEvent } from './humanize-event';

describe('humanizeEvent', () => {
  it.each([
    ['student.updated', 'students', 'Elev oppdatert'],
    ['student.created', 'students', 'Elev opprettet'],
    ['class.created', 'classes', 'Klasse opprettet'],
    ['subject.created', 'subjects', 'Fag opprettet'],
    ['term.updated', 'terms', 'Termin oppdatert'],
    ['class_students.enrolled', 'class_students', 'Elev meldt inn i klasse'],
  ])('maps %s → «%s»', (action, entity, expected) => {
    expect(humanizeEvent(action, entity)).toBe(expected);
  });

  it('falls back to a readable generic for unknown pairs', () => {
    expect(humanizeEvent('grade.deleted', 'grades')).toBe('grade slettet');
    expect(humanizeEvent('weird', 'stuff')).toBe('weird');
  });
});
```

Run `npx vitest run src/lib/admin/humanize-event.test.ts` — FAIL (module not found).

- [ ] **Step 2: Implement**

```ts
// src/lib/admin/humanize-event.ts
/**
 * Audit events arrive as machine names («student.updated» on table
 * «students»). The dashboard shows people-language; the raw name stays in the
 * full audit view (a later phase). Pure function — trivially testable.
 */
const SUBJECTS: Record<string, string> = {
  student: 'Elev',
  students: 'Elev',
  class: 'Klasse',
  classes: 'Klasse',
  subject: 'Fag',
  subjects: 'Fag',
  term: 'Termin',
  terms: 'Termin',
  class_students: 'Elev',
  guardian: 'Foresatt',
  guardians: 'Foresatt',
  invoice: 'Faktura',
  invoices: 'Faktura',
};

const VERBS: Record<string, string> = {
  created: 'opprettet',
  updated: 'oppdatert',
  deleted: 'slettet',
  enrolled: 'meldt inn i klasse',
  unenrolled: 'meldt ut av klasse',
};

export function humanizeEvent(action: string, entity: string): string {
  const [head, verbRaw] = action.split('.');
  const verb = verbRaw ? VERBS[verbRaw] : undefined;
  const subject = SUBJECTS[head ?? ''] ?? SUBJECTS[entity] ?? head ?? action;
  if (!verbRaw) return action;
  if (!verb) return `${subject === head ? head : subject.toLowerCase()} ${VERBS[verbRaw] ?? verbRaw}`;
  // class_students.enrolled reads as «Elev meldt inn i klasse» via the verb.
  if (head === 'class_students') return `Elev ${verb}`;
  return `${subject} ${verb}`;
}
```

Adjust until the test's exact expectations pass (the fallback case «grade slettet» exercises the lowercase-unknown-subject path: unknown head `grade` + known verb → `grade slettet`).

- [ ] **Step 3: Run test — pass.** `npx vitest run src/lib/admin/humanize-event.test.ts`

- [ ] **Step 4: Rebuild the admin dashboard on the pattern.** In `src/app/(portal)/admin/page.tsx`: keep `loadAuditEntries` and every DAL call; restructure the JSX to: `DashboardHeader` (context gains the term: `Administrasjon · ${formatWeekdayDateNb(today.today)}`, `actions={<><PillLink href="/admin/elever">Elevregisteret</PillLink><PillLink href="/admin/klasser">Klasser</PillLink></>}`) → hero → ledger → zones → hendelser.

Hero (first unmarked lesson, else all-clear):

```tsx
{today.unmarked_lessons.length > 0 ? (
  <HeroAction
    figure={{
      primary: formatTime(today.unmarked_lessons[0]!.starts_at),
      secondary: today.unmarked_lessons[0]!.room ?? undefined,
    }}
    title={`${today.unmarked_count} time${today.unmarked_count === 1 ? '' : 'r'} ikke ført`}
    description={`Først ute: ${today.unmarked_lessons[0]!.class_name} · ${formatTimeRange(today.unmarked_lessons[0]!.starts_at, today.unmarked_lessons[0]!.ends_at)}`}
    chip={<Chip tone="warning">Ikke ført</Chip>}
    action={{
      href: `/laerer/timer/${today.unmarked_lessons[0]!.lesson_id}`,
      label: 'Før oppmøte',
    }}
  />
) : (
  <HeroAction
    title="Alt ført"
    allClear={`${today.lessons_today} undervisningsøkt${today.lessons_today === 1 ? '' : 'er'} i dag — alle er ført.`}
  />
)}
```

Ledger (4 cells; replaces BOTH the StatTile band and the tinted `Aktive elever`-dl):

```tsx
<StatLedger
  items={[
    { label: 'Aktive elever', value: overview.active_students, qualifier: overview.current_term_name ?? undefined, href: '/admin/elever' },
    { label: 'Klasser', value: overview.current_term_classes, href: '/admin/klasser' },
    { label: 'Ikke ført', value: today.unmarked_count, qualifier: 'venter på oppmøte', tone: 'warning', active: today.unmarked_count > 0 },
    { label: 'Usette fravær', value: today.unseen_absence_count, qualifier: 'forhåndsmeldt', tone: 'warning', active: today.unseen_absence_count > 0 },
  ]}
/>
```

Zones: left = the existing «Timer som ikke er ført» DataList (unchanged) inside `grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.45fr_1fr]`; right = `AttentionFeed` built inline from the notices:

```tsx
<AttentionFeed
  items={today.absence_notices.map((n) => ({
    id: n.id,
    severity: 'warning' as const,
    subject: n.student_name,
    detail: `${n.class_name} · ${formatDateNb(n.date)} — ${n.reason}`,
  }))}
/>
```

(The old «Forhåndsmeldte fravær» DataList section is replaced by this feed; delete it and the now-unused `AttendanceStatusPill` import.)

Hendelser section: same structure/locked-state as today, but each row renders:

```tsx
<li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
  <span className="font-medium">{humanizeEvent(entry.action, entry.entity)}</span>
  <time dateTime={entry.created_at} className="ms-auto text-sm tabular-nums text-ink/60">
    {formatDateTimeNb(entry.created_at)}
  </time>
</li>
```

Imports to add: `AttentionFeed`, `HeroAction`, `StatLedger`, `humanizeEvent`, `formatTime`, `formatDateTimeNb`; remove unused `StatTile`, `AttendanceStatusPill`.

- [ ] **Step 5: Typecheck, tests, browser-verify** `/admin` (both breakpoints; hendelser now read «Elev oppdatert · 24.07.2026, 11:05»-style). `npx tsc --noEmit && npm run test`

- [ ] **Step 6: Commit**

```bash
git add src/lib/admin/humanize-event.ts src/lib/admin/humanize-event.test.ts "src/app/(portal)/admin/page.tsx"
git commit -m "feat(admin): dashbord på mønsteret — ikke-ført-hero, 4-cellers hovedbok, humaniserte hendelser"
```

### Task 11: Elev dashboard — gentlest application

**Files:**
- Modify: `src/app/(portal)/elev/page.tsx`

Changes (keep the page's calm; NO AttentionFeed here): (a) inline `<header>` → `DashboardHeader` (`name={home.first_name || 'du'}` `context={formatWeekdayDateNb(home.today)}`); (b) the tinted «Timen din i dag» Card → `HeroAction` (figure = start time, title = `home.next_lesson?.is_today ? 'Timen din i dag' : 'Neste time'`, description = time-range · room · class, action = `{ href: '/elev/oppmote', label: 'Se oppmøte' }` only when `is_today`, otherwise no action; when no `next_lesson` at all → `allClear` with the existing copy); (c) the Lekser/Oppmøte card pair → one 3-cell `StatLedger` (Lekser `value={home.open_assignments}` qualifier `å levere`, tone warning active when >0, href `/elev/lekser` · Oppmøte `value={presentPct + '%'}` href `/elev/oppmote` · Koran `value` = surah short label or '–', href `/elev/fremdrift`); (d) after Fremdrift add the muraja'ah practice card.

- [ ] **Step 1: Fetch progress for murajaah.** Add to imports `import { getStudentProgress } from '@/lib/dal/student';` and `import { MurajaahCard } from '@/components/portal/MurajaahCard';`, then read `src/lib/dal/student.ts` around `StudentProgressView` (line ~185) to find the quran entries field name (`quran` / `entries` — use what exists). Fetch in parallel:

```tsx
const [home, progress] = await Promise.all([getStudentHome(), getStudentProgress()]);
```

Render `<MurajaahCard entries={progress.<quran-entries-field>} today={home.today} />` between Fremdrift and Meldinger.

- [ ] **Step 2: Apply (a)–(c)** per the descriptions above, reusing exact prop shapes from Tasks 4/3. Lekser cell example:

```tsx
{ label: 'Lekser', value: home.open_assignments, qualifier: 'å levere', tone: 'warning', active: home.open_assignments > 0, href: '/elev/lekser' },
```

- [ ] **Step 3: Typecheck, tests, browser-verify** `/elev` (1280 + 375; the page should feel like today, just denser and with the practice week). `npx tsc --noEmit && npm run test`

- [ ] **Step 4: Milestone gate + commit**

```bash
NEXT_PUBLIC_DEMO=1 npm run build
git add "src/app/(portal)/elev/page.tsx"
git commit -m "feat(elev): min side på mønsteret — time-hero, tre-cellers stripe, øv-i-dag-murajaah"
```

---

# Milestone 4 — Heltflytene

### Task 12: `AttendanceStatusPicker` (visible 4-state control) + `StickyActionBar`

**Files:**
- Create: `src/components/portal/AttendanceStatusPicker.tsx`
- Test: `src/components/portal/AttendanceStatusPicker.test.tsx`
- Create: `src/components/ui/StickyActionBar.tsx` (presentational; covered by usage tests in Task 13)

- [ ] **Step 1: Write the failing picker test**

```tsx
// src/components/portal/AttendanceStatusPicker.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AttendanceStatusPicker } from './AttendanceStatusPicker';

describe('AttendanceStatusPicker', () => {
  it('renders a radiogroup with all four statuses, current checked', () => {
    render(
      <AttendanceStatusPicker value="present" onValueChange={() => {}} ariaLabel="Oppmøte, Yusuf Farah" />,
    );
    const group = screen.getByRole('radiogroup', { name: 'Oppmøte, Yusuf Farah' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Til stede' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Fravær' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'For sent' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Gyldig fravær' })).toBeInTheDocument();
  });

  it('click selects; arrow keys move selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AttendanceStatusPicker value="present" onValueChange={onChange} ariaLabel="Oppmøte, Yusuf Farah" />,
    );
    await user.click(screen.getByRole('radio', { name: 'Fravær' }));
    expect(onChange).toHaveBeenCalledWith('absent');
    screen.getByRole('radio', { name: 'Til stede' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('absent');
  });
});
```

Run — FAIL (module not found).

- [ ] **Step 2: Implement the picker.** Same roving-tabindex/arrow-key pattern as `SegmentedControl` (copy its `onKeyDown`/refs mechanics — 30 lines; a shared hook is not worth coupling the two while their item models differ), but items are the four `ATTENDANCE_STATUS_ORDER` statuses with status-tinted actives:

```tsx
// src/components/portal/AttendanceStatusPicker.tsx
'use client';

import type { KeyboardEvent } from 'react';
import { useRef } from 'react';
import { cn } from '@/lib/cn';
import {
  ATTENDANCE_STATUS_META,
  ATTENDANCE_STATUS_ORDER,
  type AttendanceStatus,
} from './attendanceStatus';

const activeSurface: Record<AttendanceStatus, string> = {
  present: 'bg-success/15 text-success-ink',
  absent: 'bg-danger/15 text-danger-ink',
  late: 'bg-warning/15 text-warning-ink',
  excused: 'bg-surface-tint text-ink',
};

export interface AttendanceStatusPickerProps {
  value: AttendanceStatus;
  onValueChange: (next: AttendanceStatus) => void;
  /** Group name, e.g. "Oppmøte, Yusuf Farah". */
  ariaLabel: string;
  className?: string;
}

/**
 * All four attendance states visible as one radiogroup — replaces the blind
 * tap-to-cycle pill. Full-width equal segments on mobile (the row gives it its
 * own line); intrinsic width ≥sm. Short labels keep it one line.
 */
export function AttendanceStatusPicker({
  value,
  onValueChange,
  ariaLabel,
  className,
}: AttendanceStatusPickerProps) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  function select(index: number) {
    const status = ATTENDANCE_STATUS_ORDER[index];
    if (!status) return;
    onValueChange(status);
    buttons.current[index]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = ATTENDANCE_STATUS_ORDER.length - 1;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        select(index === last ? 0 : index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        select(index === 0 ? last : index - 1);
        break;
      case 'Home':
        event.preventDefault();
        select(0);
        break;
      case 'End':
        event.preventDefault();
        select(last);
        break;
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'grid w-full grid-cols-4 items-center gap-1 rounded-pill bg-canvas p-1 ring-1 ring-inset ring-hairline sm:inline-flex sm:w-auto',
        className,
      )}
    >
      {ATTENDANCE_STATUS_ORDER.map((status, index) => {
        const active = status === value;
        const meta = ATTENDANCE_STATUS_META[status];
        return (
          <button
            key={status}
            ref={(el) => {
              buttons.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onValueChange(status)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-pill px-2 text-xs font-medium sm:px-3 sm:text-sm',
              'transition-[background-color,color,transform] duration-200 ease-brand',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              'active:scale-[0.97]',
              active ? activeSurface[status] : 'text-ink/55 hover:text-ink',
            )}
          >
            <span
              aria-hidden
              className={cn('size-1.5 shrink-0 rounded-full', active ? meta.dot : 'bg-ink/20')}
            />
            <span className="truncate">{shortLabel(status)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Mobile-width labels: full words don't fit four-up at 375px. */
function shortLabel(status: AttendanceStatus): string {
  switch (status) {
    case 'present':
      return 'Til stede';
    case 'absent':
      return 'Fravær';
    case 'late':
      return 'For sent';
    case 'excused':
      return 'Gyldig';
  }
}
```

NB the test queries by FULL names («Gyldig fravær») — reconcile: give each button `aria-label={meta.label}` so the accessible name stays canonical while the visual label is short. Add `aria-label={meta.label}` to the button and keep the test as written.

- [ ] **Step 3: Run picker test — pass.** `npx vitest run src/components/portal/AttendanceStatusPicker.test.tsx`

- [ ] **Step 4: Implement `StickyActionBar`**

```tsx
// src/components/ui/StickyActionBar.tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Bottom action bar for long flows. Sticky with safe-area padding below `sm`
 * (thumb reach on phones); a plain in-flow row from `sm`. Children = actions;
 * `summary` = the live tally («6 av 7 til stede», «12 familier · 36 000 kr»).
 */
export function StickyActionBar({
  summary,
  children,
  className,
}: {
  summary?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-4 border-t border-hairline bg-surface/95 px-4 py-3 backdrop-blur',
        'pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
        'sm:static sm:z-auto sm:mx-0 sm:border-t-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none',
        className,
      )}
    >
      <div className="min-w-0 text-sm text-ink/60">{summary}</div>
      <div className="flex shrink-0 items-center gap-3">{children}</div>
    </div>
  );
}
```

(`-mx-4` assumes the portal main gutter is `px-4` on mobile — check `PortalShell`'s main padding and match the negative margin to it.)

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/components/portal/AttendanceStatusPicker.tsx src/components/portal/AttendanceStatusPicker.test.tsx src/components/ui/StickyActionBar.tsx
git commit -m "feat(oppmote): synlig 4-status-velger (radiogroup) + StickyActionBar for lange flyter"
```

### Task 13: Wire the marking screen: picker, quiet zeros, sticky save

**Files:**
- Modify: `src/app/(portal)/laerer/timer/[lessonId]/MarkingClient.tsx`

- [ ] **Step 1: Swap the control.** Replace the `AttendanceStatusControl` import + usage with `AttendanceStatusPicker` (same `value`/`onValueChange`; prop `ariaLabel={`Oppmøte, ${name}`}` — picker requires it). The Task-1 grid keeps the control full-width on its own mobile line — exactly what the 4-segment grid needs.

- [ ] **Step 2: Quiet zeros in the summary.** The `SUMMARY` const maps fixed tones; make tone conditional at render:

```tsx
{SUMMARY.map(({ status, tone }) => (
  <StatTile
    key={status}
    label={ATTENDANCE_STATUS_META[status].label}
    value={counts[status]}
    tone={counts[status] > 0 ? tone : 'default'}
  />
))}
```

Update the helper copy under the summary to reflect the new control: `Alle er satt til «Til stede». Velg status per elev, eller legg til et notat.`

- [ ] **Step 3: Sticky save.** Replace the footer `div` («6 av 7 til stede» + Button) with:

```tsx
<StickyActionBar
  summary={
    saved ? 'Oppmøtet er lagret.' : `${counts.present} av ${roster.length} til stede`
  }
>
  <Button onClick={handleSave}>Lagre oppmøte</Button>
</StickyActionBar>
```

- [ ] **Step 4: Delete the orphan.** `grep -rn "AttendanceStatusControl" src/` — if the only remaining references are the component file itself, delete `src/components/portal/AttendanceStatusControl.tsx` (the cycle logic in `attendanceStatus.ts` — `nextAttendanceStatus`, `ATTENDANCE_STATUS_ORDER` — stays: the picker imports the ORDER; remove `nextAttendanceStatus` ONLY if unreferenced after the grep, and drop its test cases from any suite that exercised it).

- [ ] **Step 5: Typecheck + tests + browser-verify** at 375 (picker 4-up full-width per row, sticky bar above the home indicator, no colored zeros) and 1280 (picker intrinsic width right-aligned, in-flow footer). `npx tsc --noEmit && npm run test`

- [ ] **Step 6: Commit**

```bash
git add -A src/components/portal "src/app/(portal)/laerer/timer/[lessonId]/MarkingClient.tsx"
git commit -m "feat(oppmote): fire synlige statuser, stille nuller og klebrig lagre-linje på mobil"
```

### Task 14: Fakturakjøring — sticky summary through step 2

**Files:**
- Modify: `src/app/(portal)/okonomi/fakturakjoring/FakturakjoringClient.tsx` (517 lines — read it first)

- [ ] **Step 1: Read the file.** Locate: the step state, the step-2 family review render (checkbox rows + moderasjon lines per family), the current totals derivation (families/students/sum for the footer line), and the Forrige/Neste footer.

- [ ] **Step 2: Add the sticky bar on step 2.** Wrap the existing Forrige/Neste controls in `StickyActionBar` with a live summary, e.g.:

```tsx
<StickyActionBar
  summary={`${includedFamilies} familier · ${includedStudents} elever · ${formatKr(totalOre)}`}
>
  <Button variant="secondary" onClick={goBack}>Forrige</Button>
  <Button onClick={goNext}>Neste</Button>
</StickyActionBar>
```

using the client's ACTUAL state/handler names found in Step 1 (`formatKr` = however the file already formats øre — reuse its helper or `MoneyAmount`). The summary must react to exclusions (utelat) — derive from the same state the step-3 totals use. Apply the bar to steps 1 and 3's footers too so the wizard's actions sit consistently (step 3's primary label stays whatever it is today, e.g. «Opprett fakturaer»).

- [ ] **Step 3: Tighten family cards.** In the step-2 family card render: reduce row vertical padding to `py-2`, and merge multiple `Søskenmoderasjon…` lines into ONE muted line per family: `Søskenmoderasjon (−20 %): Rahma, Yahya · −600,00 kr` (join names, sum the øre — derive from the family's existing moderasjon rows).

- [ ] **Step 4: Typecheck + tests + browser-verify** the full wizard run-through at 375 and 1280 (bar visible while scrolling step 2; totals drop when a family is excluded; step 3 unchanged). `npx tsc --noEmit && npm run test`

- [ ] **Step 5: Milestone gate + commit**

```bash
NEXT_PUBLIC_DEMO=1 npm run build
git add "src/app/(portal)/okonomi/fakturakjoring/FakturakjoringClient.tsx"
git commit -m "feat(okonomi): klebrig oppsummeringslinje gjennom fakturakjøringen + strammere familiekort"
```

---

# Milestone 5 — Indeks- og arbeidsflater

### Task 15: `MiniBar` + signal-rich Vurdering index

**Files:**
- Create: `src/components/ui/MiniBar.tsx`
- Test: `src/components/ui/MiniBar.test.tsx`
- Modify: `src/lib/dal/progress.ts` (extend `AssessmentStudentRow` in the demo assembly)
- Test: extend `src/lib/dal/progress.test.ts` if it exists, else create `src/lib/dal/progress.vurdering.test.ts`
- Modify: `src/app/(portal)/laerer/vurdering/page.tsx`

- [ ] **Step 1: MiniBar test**

```tsx
// src/components/ui/MiniBar.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MiniBar } from './MiniBar';

describe('MiniBar', () => {
  it('clamps percent into [0,100] and exposes a progressbar', () => {
    render(<MiniBar percent={140} label="Arabisk" />);
    const bar = screen.getByRole('progressbar', { name: 'Arabisk' });
    expect(bar).toHaveAttribute('aria-valuenow', '100');
  });
});
```

Run — FAIL. Implement:

```tsx
// src/components/ui/MiniBar.tsx
import { cn } from '@/lib/cn';

/** Tiny inline progress bar for index rows (h-1.5); ProgressLadder's little sibling. */
export function MiniBar({
  percent,
  label,
  className,
}: {
  percent: number;
  label: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-1.5 w-24 overflow-hidden rounded-pill bg-surface-tint', className)}
    >
      <div className="h-full rounded-pill bg-primary" style={{ width: `${clamped}%` }} />
    </div>
  );
}
```

Run — PASS. Commit: `git add src/components/ui/MiniBar.* && git commit -m "feat(ui): MiniBar — liten fremdriftssøyle for indeksrader"`

- [ ] **Step 2: Extend the DAL row.** Read `src/lib/dal/progress.ts` fully. Extend the interface:

```ts
export interface AssessmentStudentRow {
  student_id: string;
  first_name: string;
  last_name: string;
  birth_year: number;
  protected: boolean;
  /** Current book standing for the row's MiniBar (null when not started). */
  book: { subject_name: string; percent: number } | null;
  /** Latest quran position (null when not started). */
  quran: { label: string; result: 'passed' | 'repeat' } | null;
  /** Newest registration date across book/quran/tests (null = never assessed). */
  last_assessed_on: string | null;
  /** repeteres OR never assessed → surfaces first in the index. */
  needs_attention: boolean;
}
```

(Reuse the exact result union progress.ts already uses for quran results — check `QuranEntryView['result']`; if it is `'passed' | 'repeat'` keep as above, otherwise mirror it.) Populate in the demo assembly for each student from the same sources `getStudentAssessment` uses (latest book entry → percent; latest quran entry → `quranPositionLabel`-style label + result; newest recorded_on across logs). Sort each class group: `needs_attention` first, then `last_name`/`first_name` alphabetical.

Consistency test (create `src/lib/dal/progress.vurdering.test.ts`):

```ts
import { describe, expect, it } from 'vitest';
import { getVurderingOverview, getStudentAssessment } from './progress';

describe('getVurderingOverview enrichment (demo)', () => {
  it('every row carries the enrichment fields and attention rows sort first', async () => {
    const overview = await getVurderingOverview();
    for (const group of overview.classes) {
      const flags = group.students.map((s) => s.needs_attention);
      const firstCalm = flags.indexOf(false);
      if (firstCalm !== -1) {
        expect(flags.slice(firstCalm)).not.toContain(true);
      }
    }
  });

  it("a student's row agrees with their assessment view", async () => {
    const overview = await getVurderingOverview();
    const row = overview.classes[0]?.students[0];
    expect(row).toBeDefined();
    const detail = await getStudentAssessment(row!.student_id);
    expect(detail).not.toBeNull();
    if (row!.quran && detail!.quran.current) {
      expect(row!.quran.result).toBe(detail!.quran.current.result);
    }
  });
});
```

Adjust the second assertion's property path to `StudentAssessment`'s real shape (read it — `progress.ts` line ~105). Run failing → implement → pass.

- [ ] **Step 3: Rewrite the index rows.** In `src/app/(portal)/laerer/vurdering/page.tsx`, render per student:

```tsx
<DataRow
  key={student.student_id}
  href={`/laerer/elev/${student.student_id}`}
  meta={
    <div className="flex items-center gap-3">
      {student.book ? (
        <div className="hidden items-center gap-2 sm:flex">
          <MiniBar percent={student.book.percent} label={student.book.subject_name} />
          <span className="text-xs tabular-nums text-ink/55">{Math.round(student.book.percent)}%</span>
        </div>
      ) : null}
      {student.quran ? (
        <Chip tone={student.quran.result === 'repeat' ? 'warning' : 'success'} className="px-2.5 py-0.5 text-xs">
          {student.quran.label}
        </Chip>
      ) : null}
    </div>
  }
>
  <div className="flex items-center gap-3">
    {student.needs_attention ? (
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-warning" />
    ) : null}
    <div className="flex flex-col gap-0.5">
      <span className="font-medium text-ink">
        {student.first_name} {student.last_name}
      </span>
      <span className="text-sm text-ink/60">
        {student.last_assessed_on
          ? `Sist vurdert ${formatDateNb(student.last_assessed_on)}`
          : 'Ingen vurderinger ennå'}
      </span>
    </div>
  </div>
</DataRow>
```

(Existing page wraps rows in Avatar-led rows — read the page first and keep its Avatar if present, inserting the attention dot before it.) Import `MiniBar`, `Chip`, `formatDateNb`.

- [ ] **Step 4: Typecheck, tests, browser-verify** `/laerer/vurdering` (rows now scannable; attention rows on top; mobile hides the MiniBar cleanly). `npx tsc --noEmit && npm run test`

- [ ] **Step 5: Commit**

```bash
git add src/lib/dal/progress.ts src/lib/dal/progress.vurdering.test.ts "src/app/(portal)/laerer/vurdering/page.tsx"
git commit -m "feat(vurdering): signalrader — koranposisjon, bok-minibar, sist-vurdert og oppmerksomhetsprikk"
```

### Task 16: Two-column workspaces (teacher student detail + fremdrift pages)

**Files:**
- Modify: `src/app/(portal)/laerer/elev/[studentId]/page.tsx`
- Modify: `src/app/(portal)/forelder/fremdrift/page.tsx` (and its client component if the sections live there — read first)
- Modify: `src/app/(portal)/elev/fremdrift/page.tsx` (same)

- [ ] **Step 1: Teacher student detail.** Read the page. Wrap its sections in a 2-col grid ≥lg: LEFT (the doing column) = Bokfremgang + Registrer koranfremgang; RIGHT (the seeing column) = Koran/mushaf + Muraja'ah + Nåværende posisjon + Siste registreringer + Prøver/Terminkarakterer. Concretely: keep the back-link + `h1` header full-width, then:

```tsx
<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_1.15fr]">
  <div className="flex flex-col gap-6">{/* Bokfremgang, Registrer koranfremgang */}</div>
  <div className="flex flex-col gap-6">{/* Mushaf, Muraja'ah, Nåværende posisjon, Siste registreringer, Prøver */}</div>
</div>
```

Mobile order must stay: header → bokfremgang → mushaf … as today? NO — spec: form-first on mobile. The grid above already renders the doing-column first in DOM = form first on mobile. Good.

- [ ] **Step 2: Fremdrift pages (forelder + elev).** Same treatment: mushaf/koran column left, prøver/terminkarakterer/rapport column right, `lg:grid-cols-[1.15fr_1fr]`, single column below. Keep each page's child-switcher (forelder) full-width above the grid.

- [ ] **Step 3: Typecheck, tests, browser-verify** all three at 1280 (two balanced columns, no dead flank) and 375 (unchanged stacking). `npx tsc --noEmit && npm run test`

- [ ] **Step 4: Commit**

```bash
git add "src/app/(portal)/laerer/elev/[studentId]/page.tsx" "src/app/(portal)/forelder/fremdrift" "src/app/(portal)/elev/fremdrift"
git commit -m "feat(fremdrift): to-kolonners arbeidsflater ≥lg — gjøre-kolonne og se-kolonne"
```

### Task 17: List anatomy pass — chevrons on link rows, meldinger unread signal

**Files:**
- Modify: `src/components/ui/DataList.tsx` (DataRow gains the chevron)
- Modify: `src/components/portal/ThreadListItem.tsx` (read first)

- [ ] **Step 1: Chevron on every link `DataRow`.** In `DataRow`'s link branch, after `<RowContent …>` add:

```tsx
<svg
  viewBox="0 0 24 24"
  aria-hidden
  className="ms-1 size-4 shrink-0 text-ink/35"
  fill="none"
  stroke="currentColor"
  strokeWidth="2"
  strokeLinecap="round"
  strokeLinejoin="round"
>
  <path d="m9 6 6 6-6 6" />
</svg>
```

(When `meta` exists it already sits `ms-auto`; the chevron lands after it. When no meta, add `ms-auto` to the svg: use `cn('size-4 shrink-0 text-ink/35', !meta && 'ms-auto')`.) Static rows get no chevron. Run `npm run test` — `primitives.test.tsx` covers DataRow; update its expectations ONLY if it asserts exact child counts (adding an aria-hidden svg must not break name-based queries).

- [ ] **Step 2: Thread rows.** Read `ThreadListItem.tsx`; ensure: unread dot (`size-2 rounded-full bg-primary`) before the subject when unread, preview line `truncate text-sm text-ink/60`, timestamp `tabular-nums`. Apply the minimal diffs to reach that anatomy.

- [ ] **Step 3: Typecheck, tests, browser-verify** any list screen + `/laerer/meldinger`. Commit:

```bash
git add src/components/ui/DataList.tsx src/components/portal/ThreadListItem.tsx
git commit -m "feat(ui): chevron-affordans på lenkerader + ulest-signal i meldingslister"
```

---

# Milestone 6 — Polish + responsiv feiing

### Task 18: Stretched-control fix + StoryBar safe-area + zero-tone sweep

**Files:**
- Modify: `src/components/ui/SegmentedControl.tsx`
- Modify: `src/components/demo/StoryBar.tsx`
- Audit-modify: any remaining colored-zero/chip-redundancy sites

- [ ] **Step 1: SegmentedControl intrinsic width.** The control is `inline-flex` but stretches to full width inside `flex-col` parents (align-items:stretch) — the forelder «tint band» bug. Add `self-start` to its root `cn(…)`. Verify `/forelder/oppmote` + `/forelder/fremdrift` (the child-switcher hugs its pills now).

- [ ] **Step 2: StoryBar safe-area.** Read `StoryBar.tsx`; on its fixed bottom container add `pb-[env(safe-area-inset-bottom)]` (or `bottom-[env(safe-area-inset-bottom)]` if it uses `bottom-0` positioning — match its structure).

- [ ] **Step 3: Zero/chip sweep.** `grep -rn "tone=\"danger\"\|tone=\"warning\"\|tone={" src/app src/components --include="*.tsx"` and audit each hit: does a figure/chip get an alarm tone regardless of value? Known remaining sites: forelder økonomi stat band (`MoneyAmount tone` on Utestående when 0? — check `/forelder/okonomi` page source), purringer page badges. Apply the `count > 0 ? tone : 'default'` guard wherever a zero can render toned. List every touched file in the commit body.

- [ ] **Step 4: Typecheck, tests, verify, commit**

```bash
npx tsc --noEmit && npm run test
git add -A src
git commit -m "fix(ui): egenbredde på segmenter, StoryBar safe-area og stille nuller overalt"
```

### Task 19: Responsive sweep — every screen at 375/768/1280

- [ ] **Step 1: Walk the matrix.** With the dev server running, visit EVERY route below at 375×812, 768×1024, 1280×800 and fix what breaks (record each fix):

`/` · `/forelder` · `/forelder/oppmote` · `/forelder/fremdrift` · `/forelder/fremdrift/rapport/[first-child]` · `/forelder/lekser` · `/forelder/meldinger` · `/forelder/okonomi` · `/forelder/okonomi/faktura/[id]` · `/laerer` · `/laerer/klasser` + detail · `/laerer/timer/[id]` · `/laerer/vurdering` · `/laerer/elev/[id]` · `/laerer/oppgaver` + detail · `/laerer/meldinger` + thread · `/admin` · `/admin/elever` (+ `/ny`) · `/admin/klasser` + detail · `/admin/fag` · `/admin/terminer` · `/admin/meldinger` · `/okonomi` · `/okonomi/fakturakjoring` (all 3 steps) · `/okonomi/faktura/[id]` · `/okonomi/purringer` · `/okonomi/avstemming` · `/elev` · `/elev/lekser` · `/elev/fremdrift` · `/elev/oppmote` · `/elev/meldinger`

Checks per screen: no horizontal scroll, no text collisions/truncation surprises, touch targets ≥44px, sticky bars clear of content, drawer opens/closes with focus handling, tables/lists degrade to readable stacks.

- [ ] **Step 2: Commit the fixes** (one commit, itemized body):

```bash
git add -A src
git commit -m "fix(responsiv): feiing av alle skjermer på 375/768/1280 — ingen kollisjoner eller sidescroll"
```

---

# Milestone 7 — Sluttrevisjon og gate

### Task 20: Design-law + web-guidelines audit, DESIGN.md addendum, full gate

- [ ] **Step 1: Self-audit against DESIGN.md's forbud-list** on every touched screen (no kickers, no side-stripes, no gradient text, Fraunces only ceremony, ink never on house, honor-gold only hifz, green ≤10 % on work screens, hover gated behind `(hover: hover)` where added).

- [ ] **Step 2: Run the `web-design-guidelines` skill** (per CLAUDE.md Phase 3) over the changed screens; fix real findings; note dismissed ones with reasons.

- [ ] **Step 3: DESIGN.md addendum (3. utgave-tillegg).** Append to `/Users/daodilyas/dev/iqra-portal/DESIGN.md` a section «Dashbordmønsteret (Handling + hovedbok)» codifying: the five layers, the all-clear hero rule, the null-tone rule, the sticky-bar rule (mobile-only stickiness + safe-area), the 2×2 ledger rule, AttentionFeed severity semantics, and that `AttendanceStatusPicker` replaced the cycle control. ≤40 lines, same voice as the rest of the file.

- [ ] **Step 4: Full gate**

```bash
npx tsc --noEmit && npm run test && NEXT_PUBLIC_DEMO=1 npm run build
```
Expected: 0 errors · all tests green (118 existing + every test added above) · build passes with all routes.

- [ ] **Step 5: Final commit**

```bash
git add DESIGN.md
git commit -m "docs: DESIGN.md — dashbordmønsteret handling+hovedbok, null-toneregel og klebrig-linje-regel"
```

- [ ] **Step 6: Report.** Summarize per milestone: what changed, screenshots of lærer/forelder/økonomi dashboards + mobile marking, the gate numbers, and the follow-ups deliberately NOT done (push, merge into feat/pitch-demo/main — both need explicit user OK per project policy).

---

## Plan self-review (done at write time)

- **Spec coverage:** §3 dashboards → Tasks 7–11; §4 oppmøte → Tasks 1, 12, 13; §4 fakturakjøring → Task 14; §5 → Tasks 15–17; §6 → Tasks 13 (zeros), 9 (chips), 10 (humanize), 18 (controls/StoryBar/sweep), 19 (responsive); §7 inventory → Tasks 2–6, 12, 15 (spec's `SegmentedStatus`+`StatusSheet` consolidated into ONE `AttendanceStatusPicker` — four short segments fit 375px full-width, so the mobile popover is unnecessary complexity; spec's «MurajaahCard kondensert variant» resolved as reuse — the card already renders 7-col on lg); §8 gates → per-task steps + Task 20.
- **Placeholders:** none — every code step carries real code; Tasks 6/14/15 include read-first steps because they integrate with demo-fixture internals that must be read, with contracts and tests fully specified here.
- **Type consistency:** `AttentionItem` defined once (Task 5) and imported by Task 6/8/10; `StatLedgerItem.active` gates tones everywhere; `ButtonLink` used by `HeroAction` (Task 4) and Task 9; picker keeps `AttendanceStatus` from `attendanceStatus.ts`.
