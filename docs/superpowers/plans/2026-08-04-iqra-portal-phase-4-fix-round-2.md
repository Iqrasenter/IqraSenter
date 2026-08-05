# Phase 4 Fix Round — Part 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four silent-failure paths, the two assertions that cannot fail, and the three visual-language defects that PR #15's review panel raised, so the Phase 4 branch can merge.

**Architecture:** Three independent strands that share one commit series. (1) Failure honesty: an app-wide error boundary, `catch` blocks on the two `void`-invoked async handlers, and a `private.storage_orphans` ledger so a Storage delete that fails after its row is gone can still be completed later. (2) Test integrity: two pgTAP detectors, each proven to redden under a named mutation of the code it guards. (3) Visual language: a shared `BackLink`, the segmented control demoted from the primary-action treatment to the same tint `PillLink` already uses for "you are here", and one `aria-current="page"` per page.

**Tech Stack:** Next.js 16 App Router (React 19, server actions), TypeScript, Supabase (Postgres 17 + RLS + Storage), pgTAP, Vitest + Testing Library, Tailwind v4.

**Repo:** `/Users/daodilyas/dev/iqra-portal`, branch `feat/phase-4-oppgaver`, base `f28b600` (pushed; CI green on all three jobs).

---

## Context an executor needs before starting

Read these before Task 1. They are the traps that cost time in part 1.

- **`revoke update (columns)` does nothing against a table-level grant.** Revoke the table verb first, then grant columns. Part 1's escalation survived a column revoke and still returned `UPDATE 1`.
- **Reproduce a SQL function from `pg_get_functiondef`, never from this plan.** Every function body quoted below was dumped live on 2026-08-04, but dump it again before editing — a plan is a claim, and part 1 caught a plan that had guessed a weaker predicate than the one shipped.
- **Prove each new assertion can fail.** Every test task below carries an explicit mutation step. An assertion that has never been seen red is not evidence.
- **A background task's "exit code 0" is the wrapper's, not the command's.** Read the log file.
- **`supabase db reset` exits 1 on a storage-readiness race even when it succeeded.** Verify `max(version)` and seed counts instead of re-running.
- **Never count `plan()` by grep** — it undercounts multi-line calls. Both files touched here have `plan(N)` on line 3, single-line; read the line.
- Run one pgTAP file with:
  ```bash
  docker exec -i supabase_db_iqra-portal psql -U postgres -q -f - < supabase/tests/22_submissions_rls.sql
  ```
- `psql` is not on PATH. Always go through `docker exec supabase_db_iqra-portal psql -U postgres`.
- **`db reset` and `test:api` both wipe MFA.** Re-enrol at `/mfa/registrer` after the last api run, or the user cannot log in to click anything.
- `next build` and `next dev` fight over `.next`. Stop the dev server before building.

---

## File Structure

**Created**

| Path | Responsibility |
|---|---|
| `src/components/ui/ErrorPanel.tsx` | The one rendered body of every error boundary — heading, digest, retry. Shared so three boundaries cannot drift. |
| `src/app/error.tsx` | Boundary for routes outside the portal shell (`/logg-inn`, `/mfa`). |
| `src/app/(portal)/error.tsx` | Boundary inside the portal shell, so nav survives a page crash. |
| `src/app/global-error.tsx` | Last resort — replaces the root layout, so it renders its own `<html>`/`<body>`. |
| `src/components/ui/BackLink.tsx` | The back link, once. Six copies of one className string exist today. |
| `supabase/migrations/20260804000000_storage_orphans.sql` | `private.storage_orphans` + `public.record_storage_orphan`. |
| `supabase/tests/32_storage_orphans.sql` | Grant shape and behaviour of the orphan ledger. |
| `src/components/ui/BackLink.test.tsx` | Pins the hit area that the last fix round missed. |

**Modified**

| Path | Change |
|---|---|
| `src/lib/storage/attachments.ts` | Add `removeObjectOrRecord` — the only place a Storage delete failure is handled. |
| `src/lib/dal/submissions.ts:215,244` | Route both swallow sites through the helper. |
| `src/app/(portal)/laerer/oppgaver/actions.ts:347,501,530` | Route all three swallow sites through the helper. |
| `src/components/assignments/AttachmentPicker.tsx:42-75` | `catch` — with a distinct message for a failure after the bytes landed. |
| `src/components/assignments/AttachmentList.tsx:76-112` | `catch` on `open` (closing the blank tab) and on `remove`. |
| `supabase/tests/30_retention_writability_backlog.sql` | M1 detector; `plan(21)` → `plan(23)`. |
| `supabase/tests/22_submissions_rls.sql` | M2 detector; `plan(58)` → `plan(59)`. |
| `src/components/ui/PillLink.tsx` | Export the `current` tint as `currentTint` so the segmented control cannot drift from it; correct the doc comment about `aria-current`. |
| `src/app/(portal)/laerer/oppgaver/[assignmentId]/RosterReview.tsx:28-33,94-101` | Pressed segment uses the tint, not the primary fill; font weight moves out of the shared base. |
| `supabase/tests/29_definer_fingerprints.sql:32-39` | The exclusion note claims file 30 covers `submissions_writable` behaviourally. It did not. |
| 6 page files | Use `BackLink`. |
| 4 page files | Switcher/filter pills carry `aria-current="true"`, not `"page"`. |

---

## Task 1: One error boundary, three mount points

Today there is **no `error.tsx` and no `global-error.tsx` anywhere under `src/app`** (verified by `find`). Every `throw new Error('Kunne ikke …')` in a server action reaches the user as an unstyled Next crash screen.

The load-bearing detail: **in production Next redacts server-side error messages** and replaces them with a generic string plus `error.digest`. The digest is the only token that ties what the user sees to a server log line, so the panel must show it. A boundary that prints `error.message` shows the user nothing useful in the only environment that matters.

**Files:**
- Create: `src/components/ui/ErrorPanel.tsx`
- Create: `src/app/error.tsx`
- Create: `src/app/(portal)/error.tsx`
- Create: `src/app/global-error.tsx`
- Test: `src/components/ui/ErrorPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/ErrorPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorPanel } from './ErrorPanel';

describe('ErrorPanel', () => {
  it('shows the digest, because production redacts the message', () => {
    render(<ErrorPanel digest="abc123def" onRetry={() => {}} />);
    expect(screen.getByText(/abc123def/)).toBeInTheDocument();
  });

  it('omits the reference line entirely when there is no digest', () => {
    render(<ErrorPanel onRetry={() => {}} />);
    expect(screen.queryByText(/Referanse/)).not.toBeInTheDocument();
  });

  it('is announced — a crash the screen reader misses is still a blank page', () => {
    render(<ErrorPanel onRetry={() => {}} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('retries through the boundary reset, not a page reload', () => {
    const onRetry = vi.fn();
    render(<ErrorPanel onRetry={onRetry} />);
    screen.getByRole('button', { name: 'Prøv igjen' }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/components/ui/ErrorPanel.test.tsx
```

Expected: FAIL — `Failed to resolve import "./ErrorPanel"`.

- [ ] **Step 3: Write `src/components/ui/ErrorPanel.tsx`**

```tsx
'use client';

import { Button } from '@/components/ui/Button';

/**
 * The rendered body of every error boundary in the app, in one place so the
 * three mount points cannot drift into three different apologies.
 *
 * ★ `digest`, not `message`. Next redacts server-side error messages in a
 * production build and substitutes a fixed string — by design, because a
 * message can carry a row id, a path or a constraint name. What survives is
 * `error.digest`, the hash Next also writes to the server log. Printing it is
 * what turns "noe gikk galt" into a report an operator can actually trace, and
 * it is the ONLY thing here that is useful in production.
 */
export function ErrorPanel({
  digest,
  onRetry,
}: {
  digest?: string;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-lg border border-hairline p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Noe gikk galt</h1>
        <p className="text-ink/60">
          Siden kunne ikke vises. Prøv igjen — hjelper det ikke, gi beskjed til
          en administrator.
        </p>
      </div>
      {digest ? (
        <p className="text-sm text-ink/45">
          Referanse: <code className="font-mono">{digest}</code>
        </p>
      ) : null}
      <Button onClick={onRetry}>Prøv igjen</Button>
    </div>
  );
}
```

- [ ] **Step 4: Run the test again**

```bash
npx vitest run src/components/ui/ErrorPanel.test.tsx
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Mount it at all three levels**

`src/app/(portal)/error.tsx` — the important one. It replaces only the page, so the shell and nav survive:

```tsx
'use client';

import { useEffect } from 'react';
import { ErrorPanel } from '@/components/ui/ErrorPanel';

/**
 * Scoped INSIDE the portal group on purpose: a boundary at src/app/ would take
 * the shell down with the page, and a crash that also removes the navigation
 * leaves the reader with no way out but the back button.
 */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The browser console is the only place the un-redacted message survives
    // on the client. On the server Next has already logged it against digest.
    console.error('[portal] ubehandlet feil', { digest: error.digest, error });
  }, [error]);

  return <ErrorPanel digest={error.digest} onRetry={reset} />;
}
```

`src/app/error.tsx` — identical body, for `/logg-inn` and `/mfa` which sit outside the portal group:

```tsx
'use client';

import { useEffect } from 'react';
import { ErrorPanel } from '@/components/ui/ErrorPanel';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] ubehandlet feil', { digest: error.digest, error });
  }, [error]);

  return (
    <div className="mx-auto max-w-xl p-6">
      <ErrorPanel digest={error.digest} onRetry={reset} />
    </div>
  );
}
```

`src/app/global-error.tsx` — replaces the root layout, so it must ship its own `<html>` and `<body>`. It cannot use `ErrorPanel`'s surrounding layout classes because no stylesheet from the layout is guaranteed to have loaded:

```tsx
'use client';

import { useEffect } from 'react';

/**
 * The root layout itself failed, so nothing above this rendered — no fonts, no
 * providers, and no guarantee the stylesheet loaded. Inline styles rather than
 * utility classes for exactly that reason, and no shared component: importing
 * one here would be importing from the tree that just broke.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global] rotoppsettet feilet', { digest: error.digest, error });
  }, [error]);

  return (
    <html lang="nb">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: '2rem' }}>
        <div role="alert">
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Noe gikk galt</h1>
          <p style={{ marginBottom: '1rem' }}>
            Siden kunne ikke lastes. Prøv igjen.
          </p>
          {error.digest ? (
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
              Referanse: <code>{error.digest}</code>
            </p>
          ) : null}
          <button type="button" onClick={reset} style={{ padding: '0.5rem 1rem', minHeight: 44 }}>
            Prøv igjen
          </button>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Verify the boundary actually catches**

Temporarily add `throw new Error('boundary-probe');` to the top of the component in `src/app/(portal)/laerer/oppgaver/page.tsx`, run `npm run dev`, load `/laerer/oppgaver`, and confirm the styled panel renders **with the sidebar still present**. Then remove the throw.

Expected: the panel, not Next's default overlay, and nav intact.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/ErrorPanel.tsx src/components/ui/ErrorPanel.test.tsx "src/app/error.tsx" "src/app/(portal)/error.tsx" src/app/global-error.tsx
git commit -m "feat(errors): give every crash a styled boundary that shows its digest"
```

---

## Task 2: The orphan ledger

The five `removeObject(...).catch(() => undefined)` sites split into two classes:

| Site | Row state when the delete fails | Reported to user |
|---|---|---|
| `dal/submissions.ts:215` | Insert failed — row never existed | An error **is** returned |
| `actions.ts:501` | Insert failed — row never existed | An error **is** returned |
| `dal/submissions.ts:244` | **Row already deleted** | `success: true` |
| `actions.ts:530` | **Row already deleted** | `success: true` |
| `actions.ts:347` | **Assignment row about to be deleted** | Reuse error returned |

The last three are the finding. Deleting the row first is deliberate and documented (a broken link on a pupil's screen is worse than a garbage object), and it is not being changed here — but it means that once the delete has run, **nothing in the database points at those bytes**, and `assignments_objects_delete` can no longer resolve the folder's owner, so no policy and no screen can reach them again.

This task adds the one thing that makes a failed erasure recoverable: a row that remembers the path.

**Files:**
- Create: `supabase/migrations/20260804000000_storage_orphans.sql`

- [ ] **Step 1: Confirm the next migration number is free**

```bash
ls /Users/daodilyas/dev/iqra-portal/supabase/migrations/ | tail -3
```

Expected: last entry is `20260803002000_submission_attachment_filenames.sql`. If anything `20260804*` already exists, bump to `20260804001000`.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/20260804000000_storage_orphans.sql`:

```sql
-- Storage objects whose row is already gone and whose delete failed.
--
-- Why this table exists: removeSubmissionAttachment and
-- removeAssignmentAttachment delete the ROW first, on purpose — a deleted row
-- with a surviving object is collectable garbage, a deleted object with a
-- surviving row is a permanently broken link on a pupil's screen. The cost of
-- that ordering is that if the Storage delete then fails, nothing points at
-- the bytes any more: assignments_objects_delete resolves a folder's owner
-- through teaches_assignment, so with the parent gone the object is
-- unreachable by every policy and invisible on every screen.
--
-- Until now that failure was swallowed with `.catch(() => undefined)` and the
-- action returned success. The erasure was reported complete and had not been
-- performed. This table is what makes it completable.
--
-- It lives in `private` because it is an operational ledger, not app data:
-- PostgREST exposes no private schema, so no client can read it, and the only
-- way in is the narrow definer function below.
--
-- ⚠ No RLS here, deliberately and verifiably: 26_rls_force.sql applies the
-- enable/force/has-a-policy floor to `n.nspname = 'public'` only, because in
-- `private` the wall is schema reachability rather than row policy —
-- authenticated holds no USAGE, so there is no session that could get far
-- enough for a policy to be consulted. Adding RLS here would be a policy no
-- caller can ever reach, which reads as protection and is not.
create table private.storage_orphans (
  id uuid primary key default gen_random_uuid(),
  bucket text not null check (bucket in ('assignments', 'submissions')),
  path text not null,
  -- Free text, written by the call site. Which of the five paths failed is the
  -- whole diagnostic value; a boolean would record that something broke and
  -- lose which thing.
  reason text not null,
  recorded_at timestamptz not null default now(),
  swept_at timestamptz
);

-- One live row per object. A retry that fails again must not add a second
-- entry, or the ledger's depth stops meaning "objects awaiting deletion".
-- Partial, so a swept row does not block re-recording the same path if the
-- object somehow returns.
create unique index storage_orphans_unswept_key
  on private.storage_orphans (bucket, path)
  where swept_at is null;

create index storage_orphans_unswept_idx
  on private.storage_orphans (recorded_at)
  where swept_at is null;

/**
 * The only way to write the ledger.
 *
 * SECURITY DEFINER because the caller is `authenticated` and the table is in
 * `private`, which no API role can reach. The surface this opens is
 * deliberately the narrowest that still works: INSERT only, no read path back,
 * bucket constrained by the table's CHECK, and idempotent on (bucket, path).
 *
 * Being honest about what it does NOT prevent: a determined authenticated
 * caller can insert rows for paths that were never orphaned, because the
 * function cannot verify a negative about an object it is being told failed to
 * delete. What that buys an attacker is noise in an operator's sweep list —
 * not a read, not a write, and not a delete. The alternative, verifying the
 * object is really gone, would require a Storage round trip from inside a SQL
 * function, which is not available and would fail exactly when Storage is the
 * thing that is broken.
 */
create or replace function public.record_storage_orphan(
  p_bucket text,
  p_path text,
  p_reason text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.storage_orphans (bucket, path, reason)
  values (p_bucket, p_path, left(p_reason, 200))
  on conflict (bucket, path) where swept_at is null do nothing;
$$;

-- Revoke-all then grant-narrow. A bare CREATE FUNCTION grants EXECUTE to
-- PUBLIC, which would hand it to anon.
revoke all on function public.record_storage_orphan(text, text, text) from public;
grant execute on function public.record_storage_orphan(text, text, text) to authenticated;
```

- [ ] **Step 3: Apply and verify against the live catalogue**

```bash
cd /Users/daodilyas/dev/iqra-portal && npx supabase db reset
```

Then confirm the shape live rather than from this plan:

```bash
docker exec supabase_db_iqra-portal psql -U postgres -c "\d private.storage_orphans" -c "select proname, prosecdef, proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='record_storage_orphan';"
```

Expected: the table with both indexes; `prosecdef = t`; `proconfig = {search_path=""}`.

- [ ] **Step 4: Verify the seed baseline is unchanged**

```bash
docker exec supabase_db_iqra-portal psql -U postgres -tAc "select (select count(*) from auth.users), (select count(*) from public.assignments), (select count(*) from public.submissions), (select count(*) from private.storage_orphans);"
```

Expected: `7|2|2|0`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260804000000_storage_orphans.sql
git commit -m "feat(storage): record objects whose delete failed after their row was gone"
```

---

## Task 3: pgTAP for the ledger

**Files:**
- Create: `supabase/tests/32_storage_orphans.sql`

- [ ] **Step 1: Write the test file**

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- private.storage_orphans + public.record_storage_orphan (fix round part 2).
--
-- The ledger's whole value is that it is writable by the app and readable by
-- nobody it serves. Both halves are asserted: a grant that leaked SELECT would
-- turn an operational list of paths into an enumeration of every file whose
-- deletion failed, keyed by the assignment uuid in segment 1.

-- 1-2  The table is unreachable by the API roles.
select is_empty(
  $$ select r.rolname, a.privilege_type
     from pg_class c
     cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
     join pg_roles r on r.oid = a.grantee
     where c.relnamespace = 'private'::regnamespace
       and c.relname = 'storage_orphans'
       and r.rolname in ('anon', 'authenticated') $$,
  'neither anon nor authenticated holds any privilege on private.storage_orphans');

select ok(
  not has_schema_privilege('authenticated', 'private', 'USAGE'),
  'authenticated cannot even reach the private schema');

-- 3-5  The function is the one narrow door.
select ok(not has_function_privilege('anon',
  'public.record_storage_orphan(text,text,text)', 'EXECUTE'),
  '★ anon cannot record an orphan');
select ok(has_function_privilege('authenticated',
  'public.record_storage_orphan(text,text,text)', 'EXECUTE'),
  'authenticated can record an orphan');
select ok(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'record_storage_orphan')
  and (select proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'record_storage_orphan')
      @> array['search_path='],
  'record_storage_orphan is SECURITY DEFINER with an empty search_path');

-- 6-7  Behaviour: it records once, and a retry does not double-count.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000aa","role":"authenticated"}', true);
set local role authenticated;
select public.record_storage_orphan('submissions', 'aa/bb/fil.pdf', 'fjern-innlevering');
select public.record_storage_orphan('submissions', 'aa/bb/fil.pdf', 'fjern-innlevering');
reset role;

select is(
  (select count(*)::int from private.storage_orphans
    where bucket = 'submissions' and path = 'aa/bb/fil.pdf' and swept_at is null),
  1,
  '★ a repeated failure records ONE row — the ledger depth means objects, not attempts');

select throws_ok(
  $$ select public.record_storage_orphan('vedlegg', 'aa/bb/fil.pdf', 'ukjent bøtte') $$,
  '23514', null,
  'an unknown bucket is refused by the CHECK rather than stored as a path nobody can sweep');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it**

```bash
docker exec -i supabase_db_iqra-portal psql -U postgres -q -f - < supabase/tests/32_storage_orphans.sql
```

Expected: `ok 1` … `ok 7`, no failures. If assertion 2 fails, check whether `private` USAGE is granted somewhere in the base schema — if it is deliberately granted, drop assertion 2 and lower `plan(7)` to `plan(6)` rather than weakening the schema.

- [ ] **Step 3: Prove assertion 6 can fail**

Temporarily change the migration's `on conflict … do nothing` to a bare `insert`, re-apply, re-run.

Expected: assertion 6 reddens with `have: 2, want: 1`. Restore the `on conflict`, re-apply, re-run — green.

- [ ] **Step 4: Confirm the new function did not trip the grant firewall**

```bash
docker exec -i supabase_db_iqra-portal psql -U postgres -q -f - < supabase/tests/00_grant_firewall.sql
```

Expected: 6/6 pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/tests/32_storage_orphans.sql
git commit -m "test(storage): pin the orphan ledger's grant shape and its idempotence"
```

---

## Task 4: One helper, five call sites

**Files:**
- Modify: `src/lib/storage/attachments.ts` (append after `removeObject`)
- Modify: `src/lib/dal/submissions.ts:215,244`
- Modify: `src/app/(portal)/laerer/oppgaver/actions.ts:347,501,530`

- [ ] **Step 1: Add the helper**

In `src/lib/storage/attachments.ts`, directly below `removeObject`:

```ts
/**
 * Delete an object, and if that fails, remember it.
 *
 * ★ This function NEVER throws, and that is the point rather than laziness.
 * Every caller reaches it at a moment when the database row is already gone or
 * is about to be — the deletes are ordered row-first on purpose — so there is
 * nothing left to roll back and nothing useful to tell the person who clicked.
 * What was wrong before was not the swallow; it was swallowing WITHOUT A
 * TRACE, which turned "we could not delete the file" into "deleted", with no
 * record anywhere and no path back to the bytes.
 *
 * `reason` is the call site's own name. Five sites share this helper and their
 * operational stories are different — a failed sweep during reuse rollback is
 * a half-copied assignment, a failed delete during «Fjern» is an erasure that
 * did not happen — so the ledger has to keep them apart.
 */
export async function removeObjectOrRecord(
  bucket: AttachmentBucket,
  path: string,
  reason: string,
): Promise<void> {
  try {
    await removeObject(bucket, path);
  } catch (cause) {
    console.error('[storage] kunne ikke slette objektet — registreres som foreldreløst', {
      bucket,
      path,
      reason,
      cause,
    });
    const supabase = await createClient();
    const { error } = await supabase.rpc('record_storage_orphan', {
      p_bucket: bucket,
      p_path: path,
      p_reason: reason,
    });
    if (error) {
      // Both halves failed. This log line is now the only surviving record
      // that these bytes exist, so it carries the full path deliberately.
      console.error('[storage] ⛔ KLARTE HELLER IKKE Å REGISTRERE det foreldreløse objektet', {
        bucket,
        path,
        reason,
        recordError: error,
        cause,
      });
    }
  }
}
```

- [ ] **Step 2: Regenerate the database types so the rpc name typechecks**

The script is `db:types` (not `gen:types`):

```bash
cd /Users/daodilyas/dev/iqra-portal && npm run db:types
```

Then confirm the rpc is known:

```bash
grep -n "record_storage_orphan" src/lib/supabase/database.types.ts | head -3
```

Expected: at least one hit under `Functions`.

- [ ] **Step 3: Replace all five call sites**

Each is a one-line swap. `dal/submissions.ts:215`:

```ts
    await removeObjectOrRecord('submissions', path, 'bekreft-innlevering-rullet-tilbake');
```

`dal/submissions.ts:244`:

```ts
    await removeObjectOrRecord('submissions', row.path, 'fjern-vedlegg-innlevering');
```

`actions.ts:347`:

```ts
      await removeObjectOrRecord('assignments', path, 'gjenbruk-rullet-tilbake');
```

`actions.ts:501`:

```ts
    await removeObjectOrRecord('assignments', path, 'bekreft-oppgavevedlegg-rullet-tilbake');
```

`actions.ts:530`:

```ts
    await removeObjectOrRecord('assignments', row.path, 'fjern-vedlegg-oppgave');
```

Update both import lists: `removeObject` → `removeObjectOrRecord` in `src/lib/dal/submissions.ts:15` and `src/app/(portal)/laerer/oppgaver/actions.ts:23`. Keep `removeObject` exported — the helper uses it.

- [ ] **Step 4: Fix the comment that Task 4 makes false**

`actions.ts` around line 340 still says the sweep failure is unrecoverable. It is now recorded. Replace the sentence beginning "All-or-nothing (§3.1). Objects FIRST…" through the end of that paragraph with:

```
    // All-or-nothing (§3.1). Objects FIRST, and the order is not a preference:
    // assignments_objects_delete resolves the folder's owner through
    // teaches_assignment, so once the assignment row is gone the teacher can no
    // longer delete its objects at all. A sweep that fails here therefore
    // strands the object beyond every policy — which is why the failure is now
    // RECORDED in private.storage_orphans rather than discarded. The teacher
    // still cannot fix it; an operator can.
```

- [ ] **Step 5: Verify nothing still swallows**

```bash
grep -rn "removeObject(" src --include=*.ts | grep -v "storage/attachments.ts"
grep -rn "catch(() => undefined)" src --include=*.ts
```

Expected: both empty.

- [ ] **Step 6: Typecheck and run the suites**

```bash
npm run typecheck && npx vitest run
```

Expected: 0 type errors; unit suite green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/storage/attachments.ts src/lib/dal/submissions.ts "src/app/(portal)/laerer/oppgaver/actions.ts" src/lib/supabase/database.types.ts
git commit -m "fix(storage): stop reporting an erasure that did not happen"
```

---

## Task 5: S1 — the picker's missing catch

`AttachmentPicker.upload` (lines 42-75) is `try`/`finally` with **no `catch`**, invoked as `void upload(file)` from the change handler (line 92). Any rejection is an unhandled promise rejection out of an event handler: no message, no log, and the button simply stops spinning.

The subtle half: if `onConfirm` (line 67) throws **after** the PUT succeeded, the bytes are in the bucket and no row references them. The browser cannot record that orphan — the ledger is server-side and this is a client component — so the honest move is to tell the user what state they are in, and specifically to stop them retrying blind, which would upload the same file a second time.

**Files:**
- Modify: `src/components/assignments/AttachmentPicker.tsx:42-75`
- Test: `src/components/assignments/AttachmentPicker.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `src/components/assignments/AttachmentPicker.test.tsx` (match the existing file's render helper and mock style — read it first):

```tsx
  it('surfaces a rejected ticket request instead of failing silently', async () => {
    const onRequest = vi.fn().mockRejectedValue(new Error('nettverk nede'));
    renderPicker({ onRequest });

    await uploadFile(new File(['x'], 'prove.pdf', { type: 'application/pdf' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Opplastingen kunne ikke fullføres. Prøv igjen.',
    );
  });

  it('tells the user the file LANDED when only the confirm threw', async () => {
    // The distinction is load-bearing: the bytes are in the bucket. A user who
    // retries here uploads the same file twice.
    const onConfirm = vi.fn().mockRejectedValue(new Error('handling feilet'));
    renderPicker({ onConfirm });

    await uploadFile(new File(['x'], 'prove.pdf', { type: 'application/pdf' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Filen ble lastet opp, men ble ikke lagt ved. Last inn siden på nytt før du prøver igjen.',
    );
  });

  it('stops the spinner even when the handler rejects', async () => {
    const onRequest = vi.fn().mockRejectedValue(new Error('nettverk nede'));
    renderPicker({ onRequest });

    await uploadFile(new File(['x'], 'prove.pdf', { type: 'application/pdf' }));

    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Legg ved fil' })).not.toBeDisabled();
  });
```

- [ ] **Step 2: Run and watch them fail**

```bash
npx vitest run src/components/assignments/AttachmentPicker.test.tsx
```

Expected: the two message tests FAIL — no `role="alert"` appears at all, because the rejection escapes.

- [ ] **Step 3: Add the catch**

Replace lines 42-75 of `src/components/assignments/AttachmentPicker.tsx`:

```tsx
  async function upload(file: File) {
    setBusy(true);
    setError(null);
    // ★ Tracks which side of the PUT a throw came from. Both are "the upload
    // failed" to the code and two different situations to the person: before
    // the PUT nothing exists and retrying is free; after it the bytes are in
    // the bucket with no row pointing at them, and a blind retry uploads the
    // same file again. The browser cannot record that orphan — the ledger is
    // server-side — so saying so is the whole remedy available here.
    let bytesLanded = false;
    try {
      const ticket = await onRequest({
        filename: file.name,
        // An empty type is what a browser reports for an extension it does not
        // know; naming it lets the server's allowlist refuse it by name.
        mime: file.type || 'application/octet-stream',
        size: file.size,
      });
      if (ticket.error || !ticket.path || !ticket.token) {
        setError(ticket.error ?? 'Kunne ikke klargjøre opplastingen.');
        return;
      }
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .uploadToSignedUrl(ticket.path, ticket.token, file);
      if (uploadError) {
        // The bucket refused the real bytes. Its allowlist and size limit are
        // the enforcement no browser can talk its way past.
        setError(`Filen ble avvist. Sjekk filtypen og at den er under ${MAX_MB} MB.`);
        return;
      }
      bytesLanded = true;
      const confirmed = await onConfirm(ticket.path, file.name);
      if (confirmed.error) setError(confirmed.error);
    } catch (cause) {
      // Was: nothing. `void upload(file)` in the change handler turned every
      // throw here into an unhandled rejection — no message, no log, and a
      // button that just stopped spinning.
      console.error('[vedlegg] opplastingen feilet', { bucket, bytesLanded, cause });
      setError(
        bytesLanded
          ? 'Filen ble lastet opp, men ble ikke lagt ved. Last inn siden på nytt før du prøver igjen.'
          : 'Opplastingen kunne ikke fullføres. Prøv igjen.',
      );
    } finally {
      setBusy(false);
      // Clearing it is what lets the same file be picked twice after a failure:
      // an unchanged value fires no change event.
      if (inputRef.current) inputRef.current.value = '';
    }
  }
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/components/assignments/AttachmentPicker.test.tsx
```

Expected: PASS, all tests including the pre-existing ones.

- [ ] **Step 5: Prove the second test can fail for the right reason**

Temporarily change the catch's ternary to always use the "Prøv igjen" branch.

Expected: **only** the `confirm threw` test reddens. If the first one also reddens, the two paths are not actually distinguished. Restore.

- [ ] **Step 6: Commit**

```bash
git add src/components/assignments/AttachmentPicker.tsx src/components/assignments/AttachmentPicker.test.tsx
git commit -m "fix(vedlegg): surface a failed upload instead of dropping the rejection"
```

---

## Task 6: S2 — the list's missing catch, and the tab left on `about:blank`

`AttachmentList.open` (lines 76-99) opens a blank tab **before** the round trip — deliberately, because Safari drops the user gesture across an `await` and would block the `window.open` afterwards. It closes that tab in the `!result.url` branch only. If `getUrl` **rejects**, the `finally` clears the spinner and the tab stays on `about:blank` forever.

`remove` (lines 101-112) has the same shape and the same `void remove(item)` invocation.

**Files:**
- Modify: `src/components/assignments/AttachmentList.tsx:76-112`
- Test: `src/components/assignments/AttachmentList.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `src/components/assignments/AttachmentList.test.tsx` (read the file first for its render helper and `items` fixture):

```tsx
  it('closes the blank tab when the URL lookup rejects', async () => {
    const close = vi.fn();
    vi.spyOn(window, 'open').mockReturnValue({ close, opener: null } as unknown as Window);
    const getUrl = vi.fn().mockRejectedValue(new Error('nettverk nede'));
    renderList({ getUrl });

    fireEvent.click(screen.getByRole('button', { name: /^Åpne/ }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    // ★ Without this the reader is left staring at about:blank with no way to
    // know the request failed.
    expect(close).toHaveBeenCalledOnce();
  });

  it('reports a rejected removal instead of dropping it', async () => {
    const onRemove = vi.fn().mockRejectedValue(new Error('handling feilet'));
    renderList({ onRemove });

    fireEvent.click(screen.getByRole('button', { name: /^Fjern/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Bekreft/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Kunne ikke fjerne');
  });
```

- [ ] **Step 2: Run and watch them fail**

```bash
npx vitest run src/components/assignments/AttachmentList.test.tsx
```

Expected: FAIL — no alert, and `close` was never called.

- [ ] **Step 3: Add both catches**

Replace lines 76-112 of `src/components/assignments/AttachmentList.tsx`:

```tsx
  async function open(item: AttachmentRow) {
    const tab = window.open('', '_blank');
    // The opened document is served from Storage and the bucket admits no
    // text/html, so it cannot script this page. Severing opener anyway costs
    // one line and does not depend on that allowlist staying as it is.
    if (tab) tab.opener = null;
    setOpeningId(item.id);
    setError(null);
    try {
      const result = await getUrl(item.id);
      if (!result.url) {
        tab?.close();
        setError(result.error ?? `Kunne ikke åpne ${describe(item)}.`);
        return;
      }
      if (!tab) {
        setError('Nettleseren blokkerte det nye vinduet. Tillat popup-vinduer og prøv igjen.');
        return;
      }
      tab.location.replace(result.url);
    } catch (cause) {
      // ★ The tab is opened BEFORE the round trip on purpose (Safari drops the
      // gesture across an await). That made a rejection here leave a tab
      // parked on about:blank with nothing to explain it — the mapped
      // !result.url branch closed it, a throw did not.
      tab?.close();
      console.error('[vedlegg] kunne ikke åpne', { attachmentId: item.id, cause });
      setError(`Kunne ikke åpne ${describe(item)}.`);
    } finally {
      setOpeningId(null);
    }
  }

  async function remove(item: AttachmentRow) {
    if (!onRemove) return;
    setRemovingId(item.id);
    setError(null);
    try {
      const result = await onRemove(item.id);
      setError(result.error);
      setConfirmingId(null);
    } catch (cause) {
      console.error('[vedlegg] kunne ikke fjerne', { attachmentId: item.id, cause });
      setError(`Kunne ikke fjerne ${describe(item)}.`);
      // Dropped back out of the confirm state for the same reason the mapped
      // error path does: leaving «Bekreft» showing after a failure invites a
      // second press that repeats it.
      setConfirmingId(null);
    } finally {
      setRemovingId(null);
    }
  }
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/components/assignments/AttachmentList.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Prove the tab assertion can fail**

Temporarily remove `tab?.close();` from the new catch.

Expected: **only** the blank-tab test reddens, on the `close` expectation. Restore.

- [ ] **Step 6: Commit**

```bash
git add src/components/assignments/AttachmentList.tsx src/components/assignments/AttachmentList.test.tsx
git commit -m "fix(vedlegg): close the blank tab when the signed URL never arrives"
```

---

## Task 7: M1 — an assertion that dies when `submissions_writable` is gutted

Live definition (dumped 2026-08-04 — re-dump before editing):

```sql
CREATE OR REPLACE FUNCTION public.submissions_writable(p_submission_ids uuid[])
 RETURNS TABLE(submission_id uuid, writable boolean)
 LANGUAGE sql STABLE SET search_path TO ''
AS $function$
  select s.id, private.writes_submission((select auth.uid()), s.id)
  from public.submissions s
  where s.id = any (coalesce(p_submission_ids, array[]::uuid[]));
$function$
```

`30_retention_writability_backlog.sql` exercises it four times, and **all four survive replacing the body with `select s.id, true`**:

| Line | Assertion | Why it survives |
|---|---|---|
| 215 | `writable = true` for submission 71 | It asserts `true` |
| 221 | `count = 1` | Shape, not predicate |
| 230 | `is_empty` for submission 75 | RLS removed the row |
| 235 | `is_empty` for a nonexistent id | The row does not exist |

The two negatives come from **row absence**, never from the predicate returning `false`. `29_definer_fingerprints.sql:32-39` deliberately excludes this function, arguing file 30 covers it behaviourally. It does not.

What is missing is the only interesting case: a submission the caller **can read** but **must not write**. The fixture already produces one — it just is not asserted. After line ~271 marks Amina `godkjent` on A_DEL, group 63 = {s31, s32} is **fully approved**, submission 73 sits on it, and parentA (`bb…0003`) is guardian of s31 and can read it.

**Files:**
- Modify: `supabase/tests/30_retention_writability_backlog.sql` (line 3, and after the A_DEL backlog assertion)

- [ ] **Step 1: Confirm the fixture state is what this plan claims**

```bash
docker exec -i supabase_db_iqra-portal psql -U postgres -q -f - < supabase/tests/30_retention_writability_backlog.sql | head -30
```

Expected: 21/21 pass. Then re-read lines 263-285 and confirm the `insert` marking `bb…032` `godkjent` on assignment `bb…053` sits before the point you are about to insert, and that `reset role` has run.

- [ ] **Step 2: Add the detector**

In `supabase/tests/30_retention_writability_backlog.sql`, immediately after the `is(public.assignments_awaiting_review(), 1, …)` assertion and its following `reset role`, insert:

```sql
-- ── M1: the writability predicate, asserted where it can be WRONG ───
-- ★ Every other writable assertion in this file survives replacing the
-- function body with `select s.id, true`: one asserts true, one counts rows,
-- and the two negatives come from RLS removing the row rather than from the
-- predicate. This is the missing case — a submission the caller CAN read and
-- must NOT write. It exists only after the insert above closed A_DEL: group 63
-- is {Yusuf, Amina} and both are now 'godkjent', so the shared artefact is
-- genuinely finished. parentA is Yusuf's guardian, so the row is readable.
select set_config('request.jwt.claims',
  '{"sub":"bb000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*)::int from public.submissions_writable(
     array['bb000000-0000-0000-0000-000000000073'::uuid])),
  1,
  'the fully-approved group hand-in is READABLE to this parent — so the verdict below is the predicate talking, not RLS');

select is(
  (select writable from public.submissions_writable(
     array['bb000000-0000-0000-0000-000000000073'::uuid])),
  false,
  '★ a group whose every member is approved is closed — the assertion that dies if submissions_writable is gutted to `select s.id, true`');

reset role;
```

- [ ] **Step 3: Bump the plan count**

`supabase/tests/30_retention_writability_backlog.sql` line 3: `select plan(21);` → `select plan(23);`

Read the line to confirm — do not grep-count.

- [ ] **Step 4: Run the file**

```bash
docker exec -i supabase_db_iqra-portal psql -U postgres -q -f - < supabase/tests/30_retention_writability_backlog.sql | tail -20
```

Expected: 23/23, no `# Looks like you planned` mismatch.

- [ ] **Step 5: ★ Prove it — the mutation this task exists for**

Apply the gutting mutation live, run the file, then restore:

```bash
docker exec supabase_db_iqra-portal psql -U postgres -c "
create or replace function public.submissions_writable(p_submission_ids uuid[])
returns table(submission_id uuid, writable boolean)
language sql stable set search_path to '' as \$\$
  select s.id, true from public.submissions s
  where s.id = any (coalesce(p_submission_ids, array[]::uuid[]));
\$\$;"

docker exec -i supabase_db_iqra-portal psql -U postgres -q -f - < supabase/tests/30_retention_writability_backlog.sql | grep -E "^(not ok|ok 2[0-3])"
```

Expected: the new `★` assertion reports **`not ok`** with `have: true, want: false`, and the readability assertion above it still passes. If the new assertion passes under the mutation, it is not a detector — stop and rework it.

Restore:

```bash
cd /Users/daodilyas/dev/iqra-portal && npx supabase db reset
docker exec -i supabase_db_iqra-portal psql -U postgres -q -f - < supabase/tests/30_retention_writability_backlog.sql | tail -5
```

Expected: 23/23 green.

- [ ] **Step 6: Update the exclusion note that this task makes false**

`29_definer_fingerprints.sql:32-39` argues file 30 covers `submissions_writable` behaviourally. That was not true when written. Replace the sentence "…and `30_retention_writability_backlog.sql` already catches that BEHAVIOURALLY, which is the right instrument for it." with:

```
-- and 30_retention_writability_backlog.sql catches that BEHAVIOURALLY, which
-- is the right instrument for it. ⚠ That claim was FALSE until the fix round:
-- every writable assertion in file 30 survived replacing the body with
-- `select s.id, true`, because its two negatives came from RLS removing the
-- row rather than from the predicate. File 30 now carries a case that is
-- readable AND not writable, which is what makes this exclusion honest.
```

- [ ] **Step 7: Commit**

```bash
git add supabase/tests/30_retention_writability_backlog.sql supabase/tests/29_definer_fingerprints.sql
git commit -m "test(rls): assert the writability predicate where it can actually be wrong"
```

---

## Task 8: M2 — the group's assignment bind, asserted

Live definition (dumped 2026-08-04 — re-dump before editing). The group branch:

```sql
    when agid is not null and sid is null then
      exists (
        select 1
        from public.assignment_group_members agm
        join public.assignment_groups ag on ag.id = agm.assignment_group_id
        where agm.assignment_group_id = agid
          and ag.assignment_id = aid            -- ← this line is untested
          and (
            private.is_linked_student(uid, agm.student_id)
            or private.is_guardian_of(uid, agm.student_id)
          )
      )
```

Delete `and ag.assignment_id = aid` and **every test in the repo still passes**. What it would allow: a pupil takes their own group's id and POSTs a hand-in against a *different* assignment. Nothing else stops it — there is no composite FK tying `submissions.assignment_id` to `assignment_group_id`, and the XOR CHECK only enforces student-or-group.

The reason no test catches it: file 22's two groups **both belong to assignment `ba…052`**, so no fixture anywhere pairs a submission's `assignment_id` with a group from a different assignment. The existing double-bind test at line 230 crosses G1→G2 on the *same* assignment, which the membership clause catches on its own.

The fixture needed already exists: `ba…051` is a class-wide assignment in the same class with no groups at all.

**Files:**
- Modify: `supabase/tests/22_submissions_rls.sql` (line 3, and inside the double-bind block)

- [ ] **Step 1: Add the detector**

In `supabase/tests/22_submissions_rls.sql`, immediately after the existing `throws_ok` ending `'★ a member of group A cannot hand in for group B on the same assignment'` and **before** the `reset role;` that follows it:

```sql
-- ★ The other half of the same bind, and the half nothing tested. Above, the
-- group is wrong and the assignment is right. Here the GROUP is the caller's
-- own — s1 really is in G1 — and the ASSIGNMENT is a stranger: ACW is the
-- class-wide task, which has no groups at all. What must refuse this is the
-- single clause `and ag.assignment_id = aid` in can_write_submission; delete
-- it and every other test in this repo still passes, while any pupil can post
-- a hand-in onto an assignment they were never grouped for.
select throws_ok(
  $$ insert into public.submissions
       (assignment_id, assignment_group_id, body, submitted_by)
     values ('ba000000-0000-0000-0000-000000000051',
             'ba000000-0000-0000-0000-000000000061',
             'Levert på feil oppgave.',
             'ba000000-0000-0000-0000-000000000006') $$,
  '42501', null,
  '★ a group of one assignment cannot authorise a hand-in onto another');
```

- [ ] **Step 2: Bump the plan count**

`supabase/tests/22_submissions_rls.sql` line 3: `select plan(58);` → `select plan(59);`

Read the line to confirm — do not grep-count.

- [ ] **Step 3: ⚠ Renumber the seven section headers that follow**

This file labels every block with its assertion range, and inserting an assertion inside block `12-13` shifts all seven blocks after it by one. Leaving them is how a file starts lying about itself. Change exactly these lines (verify each by reading, the line numbers will have drifted by the insert):

| Was | Becomes |
|---|---|
| `-- ── 12-13 The group double bind ───…` | `-- ── 12-14 The group double bind ───…` |
| `-- ── 14-17 Review: one shared hand-in…` | `-- ── 15-18 Review: one shared hand-in…` |
| `-- ── 18-19 ★ The sharpest consequence of D3 ──` | `-- ── 19-20 ★ The sharpest consequence of D3 ──` |
| `-- ── 20-23 SELECT matrix on the hand-ins…` | `-- ── 21-24 SELECT matrix on the hand-ins…` |
| `-- ── 24 Audit ───…` | `-- ── 25 Audit ───…` |
| `-- ── 25-26 Retention: a hand-in outlives the roster ──` | `-- ── 26-27 Retention: a hand-in outlives the roster ──` |
| `-- ── 27-28 The lock closes only genuinely CLOSED work ──` | `-- ── 28-29 The lock closes only genuinely CLOSED work ──` |
| `-- ── 29-52 ★ Group-mate NAMES (rider, 2026-07-29) ──` | `-- ── 30-53 ★ Group-mate NAMES (rider, 2026-07-29) ──` |

Keep the box-drawing rule (`───…`) padded to the same column it already occupies.

Verify afterwards that the last header's upper bound plus any trailing assertions equals 59:

```bash
grep -n "── [0-9]" supabase/tests/22_submissions_rls.sql
```

- [ ] **Step 4: Run the file**

```bash
docker exec -i supabase_db_iqra-portal psql -U postgres -q -f - < supabase/tests/22_submissions_rls.sql | tail -20
```

Expected: 59/59.

- [ ] **Step 5: ★ Prove it — apply the exact mutation the finding names**

```bash
docker exec supabase_db_iqra-portal psql -U postgres -c "
create or replace function private.can_write_submission(uid uuid, aid uuid, agid uuid, sid uuid)
returns boolean language sql stable security definer set search_path to '' as \$\$
  select case
    when sid is not null and agid is null then
      (private.is_linked_student(uid, sid) or private.is_guardian_of(uid, sid))
      and private.student_in_assignment(sid, aid)
    when agid is not null and sid is null then
      exists (
        select 1
        from public.assignment_group_members agm
        join public.assignment_groups ag on ag.id = agm.assignment_group_id
        where agm.assignment_group_id = agid
          and (
            private.is_linked_student(uid, agm.student_id)
            or private.is_guardian_of(uid, agm.student_id)
          )
      )
    else false
  end;
\$\$;"

docker exec -i supabase_db_iqra-portal psql -U postgres -q -f - < supabase/tests/22_submissions_rls.sql | grep -E "^not ok"
```

Expected: **exactly one** `not ok` — the new `★` assertion, reporting that the insert lived when it should have thrown. Any other file's assertions are unaffected.

If nothing reddens, the detector is wrong — most likely the caller is not in G1, or `ba…051` is not the class-wide assignment. Re-read lines 113-131 of the file and fix before continuing.

- [ ] **Step 6: Confirm the mutation reddens NOTHING ELSE**

This is the finding's actual claim and worth recording:

```bash
for f in supabase/tests/2*.sql supabase/tests/3*.sql; do
  echo "--- $f"; docker exec -i supabase_db_iqra-portal psql -U postgres -q -f - < "$f" | grep -cE "^not ok"
done
```

Expected: `1` for `22_submissions_rls.sql` and `0` everywhere else — i.e. the new assertion is the only thing in the repo that sees this bug.

- [ ] **Step 7: Restore and re-run**

```bash
cd /Users/daodilyas/dev/iqra-portal && npx supabase db reset
docker exec -i supabase_db_iqra-portal psql -U postgres -q -f - < supabase/tests/22_submissions_rls.sql | tail -5
```

Expected: 59/59 green.

- [ ] **Step 8: Commit**

```bash
git add supabase/tests/22_submissions_rls.sql
git commit -m "test(rls): pin the group-to-assignment bind that nothing was testing"
```

---

## Task 9: The back link, once, with a hit area

Six files repeat the same 200-character className for a link rendered `display: inline` with `padding: 0`. Measured on three of them: **81×18 and 68×18 px**. The WCAG 2.2 target-size minimum is 24×24; this codebase's own controls use `min-h-11` (44px). The previous fix round gave these links a hover state and never touched the target.

Six copies of one string is also why the last round could change the hover and miss the hit area — there was nothing to change once.

**Files:**
- Create: `src/components/ui/BackLink.tsx`, `src/components/ui/BackLink.test.tsx`
- Modify: `src/app/(portal)/admin/fag/[id]/page.tsx:24-29`, `src/app/(portal)/laerer/oppgaver/ny/page.tsx:40-45`, `src/app/(portal)/laerer/oppgaver/[assignmentId]/page.tsx:49-54`, `src/app/(portal)/laerer/elev/[studentId]/page.tsx:~37-42`, `src/app/(portal)/laerer/elev/[studentId]/rapport/page.tsx:~22-27`, `src/app/(portal)/laerer/klasser/[id]/grupper/page.tsx:39-44`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BackLink } from './BackLink';

describe('BackLink', () => {
  it('is a link to where it says it goes', () => {
    render(<BackLink href="/laerer/oppgaver">Oppgaver</BackLink>);
    // ★ The accessible name is 'Oppgaver', NOT '← Oppgaver': the arrow is
    // aria-hidden on purpose. A screen reader announcing "venstrepil Oppgaver"
    // is worse than a clean name, so the arrow is decoration and the assertion
    // has to reflect that rather than the other way round.
    expect(screen.getByRole('link', { name: 'Oppgaver' })).toHaveAttribute(
      'href',
      '/laerer/oppgaver',
    );
  });

  it('carries the arrow itself, so six call sites cannot each spell it differently', () => {
    render(<BackLink href="/x">Fag</BackLink>);
    expect(screen.getByRole('link').textContent).toBe('←Fag');
    expect(screen.getByRole('link').querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('★ reaches the 44px target the rest of the system uses — the defect the last round missed', () => {
    render(<BackLink href="/x">Fag</BackLink>);
    const link = screen.getByRole('link');
    expect(link.className).toContain('min-h-11');
    expect(link.className).toContain('inline-flex');
  });
});
```

⚠ `textContent` concatenates without the visual gap the `gap-1` class produces, so it is `'←Fag'` and not `'← Fag'`. Run the test and pin whichever the DOM actually yields rather than arguing with it — this assertion exists to catch a call site re-adding its own arrow, and either string does that.

- [ ] **Step 2: Run and watch it fail**

```bash
npx vitest run src/components/ui/BackLink.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

```tsx
import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/**
 * The "up one level" link, in one place. Six pages had hand-rolled the same
 * 200-character className, which is how the previous fix round managed to give
 * these links a hover state and still leave them 81×18 px: there was no single
 * thing to change.
 *
 * inline-flex + min-h-11 rather than the bare `inline` they had. WCAG 2.2 asks
 * 24×24 as a floor; every other control in this system is 44, and a back link
 * on a phone is pressed with a thumb like anything else. The negative inline
 * start margin keeps the TEXT optically aligned with the heading beneath it
 * while the padding that makes the target grows outward instead of shoving the
 * label right.
 *
 * The arrow lives here, not at the call sites, so it cannot become ← in five
 * places and «Tilbake til» in the sixth.
 */
export function BackLink({
  children,
  className,
  ...rest
}: ComponentProps<typeof Link>) {
  return (
    <Link
      {...rest}
      className={cn(
        'inline-flex min-h-11 items-center gap-1 -ms-2 px-2 text-sm font-medium text-primary',
        'underline-offset-4 transition-colors duration-200 ease-brand',
        'hover:text-primary-strong hover:underline',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
    >
      <span aria-hidden="true">←</span>
      {children}
    </Link>
  );
}
```

`cn` lives at `src/lib/cn.ts`. ⚠ It is **`parts.filter(Boolean).join(' ')` — dependency-free, NOT tailwind-merge.** Nothing here de-duplicates conflicting utilities, so never pass two classes from the same Tailwind family and expect the later one to win. This component passes each family once, which is why it is safe; Task 10 is where that constraint bites.

- [ ] **Step 4: Run the test**

```bash
npx vitest run src/components/ui/BackLink.test.tsx
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Replace all six call sites**

Each becomes, e.g. in `src/app/(portal)/laerer/oppgaver/ny/page.tsx`:

```tsx
      <BackLink href="/laerer/oppgaver">Oppgaver</BackLink>
```

Drop the now-unused `import Link from 'next/link'` wherever the file has no other `Link`. The six labels: `Fag`, `Oppgaver`, `Oppgaver`, `Vurdering`, `{report.student.first_name} {report.student.last_name}`, `{roster.class.name}`.

- [ ] **Step 6: Verify none were missed**

```bash
grep -rn "←" src/app --include=*.tsx
```

Expected: no hits — every arrow now lives in `BackLink`.

- [ ] **Step 7: Measure the result in a browser**

Start the dev server from the portal directory via Bash (never `preview_start` name-mode — it serves the wrong repo), open `/laerer/oppgaver/ny`, and measure:

```js
const r = document.querySelector('a[href="/laerer/oppgaver"]').getBoundingClientRect();
({ w: r.width, h: r.height });
```

Expected: height ≥ 44. It was 18.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/BackLink.tsx src/components/ui/BackLink.test.tsx "src/app/(portal)"
git commit -m "fix(a11y): give the back link a real target instead of six copies of a style"
```

---

## Task 10: A state that renders like an action

`RosterReview.tsx:94-101` renders the pressed filter segment as:

```tsx
pressed ? 'bg-primary text-on-primary' : 'bg-surface-tint text-ink hover:bg-hairline',
```

`Button`'s primary variant is `bg-primary text-on-primary hover:bg-primary-strong`. So the selected segment «Alle 2» and the page's primary action «Ny oppgave» compute the **same** background and text colour — measured `lab(36.2271 -29.988 11.7828)` on `lab(98.88…)`.

Meanwhile `PillLink`'s `active` — the same *kind* of thing, "you are here" — is the quiet tint introduced in `db8d0ed`, and its own doc comment gives the rule: *full-saturation accents do not belong on inactive states*, `active` is a state and gets a tint.

So one state renders identically to an action, while two states render differently from each other. `aria-pressed` is already correct, so this is visual language, not accessibility.

★ **The codebase already contains the correct precedent, which the walkthrough did not record.** `/admin/elever` renders *the same kind of control* — a status filter, `<nav aria-label="Filtrer på status">` — and builds it from `PillLink` with `active`, so it gets the tint. Two filter rows in one product, one tinted and one wearing the primary action's fill. This task is not inventing a treatment; it is carrying an existing one across.

**Files:**
- Modify: `src/components/ui/PillLink.tsx` (export the tint)
- Modify: `src/app/(portal)/laerer/oppgaver/[assignmentId]/RosterReview.tsx:94-101`
- Test: `src/app/(portal)/laerer/oppgaver/[assignmentId]/RosterReview.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `RosterReview.test.tsx`:

```tsx
  it('★ renders the selected segment as a STATE, not as the primary action', () => {
    renderRoster();
    const selected = screen.getByRole('button', { name: /^Alle/ });
    expect(selected).toHaveAttribute('aria-pressed', 'true');
    // The primary action's fill is bg-primary + text-on-primary. A selected
    // filter is where you are, not what to press next.
    expect(selected.className).not.toContain('text-on-primary');
    expect(selected.className).toContain('bg-primary/15');
  });

  it('★ applies exactly one font-weight class — cn() does not de-duplicate', () => {
    // src/lib/cn.ts is `parts.filter(Boolean).join(' ')`, NOT tailwind-merge.
    // Passing font-medium and font-semibold together leaves the winner to
    // stylesheet emission order, which is not a decision anyone made.
    renderRoster();
    for (const button of screen.getAllByRole('button', { pressed: true })) {
      expect(button.className.match(/\bfont-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/g)).toHaveLength(1);
    }
    for (const button of screen.getAllByRole('button', { pressed: false })) {
      expect(button.className.match(/\bfont-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/g)).toHaveLength(1);
    }
  });
```

- [ ] **Step 2: Run and watch it fail**

```bash
npx vitest run "src/app/(portal)/laerer/oppgaver/[assignmentId]/RosterReview.test.tsx"
```

Expected: FAIL — `className` contains `text-on-primary`.

- [ ] **Step 3: Export the tint from `PillLink.tsx`**

Change `const current = …` to:

```tsx
/**
 * The current page. Tinted rather than filled, per the pairing convention Chip
 * already uses for tinted surfaces (`bg-<color>/15`). Contrast measured, not
 * eyeballed: text-primary reads 6.28:1 at rest and 5.66:1 on hover, both
 * comfortably past AA. The weight step carries the rest of the signal.
 *
 * Exported because the segmented filter is the same idea in a different
 * element — "the one you are on" — and it shipped with the primary ACTION's
 * fill instead, so a selected filter was byte-identical to «Ny oppgave». Two
 * components spelling one state two ways is exactly how that happened; sharing
 * the string is what stops it recurring.
 */
export const currentTint = 'bg-primary/15 text-primary font-semibold hover:bg-primary/25';
```

Update its own use inside `PillLink` from `current` to `currentTint`.

- [ ] **Step 4: Use it in `Segment`, and move the font weight out of the shared base**

In `RosterReview.tsx`, add to the imports:

```tsx
import { currentTint } from '@/components/ui/PillLink';
```

⚠ **`segmentClasses` currently ends its first line with `text-sm font-medium`, and `currentTint` carries `font-semibold`.** Because `cn` is a plain join, both would land on the pressed button and the winner would be decided by Tailwind's stylesheet emission order rather than by this code. Drop `font-medium` from the shared base so exactly one weight is ever applied:

```tsx
const segmentClasses =
  // transition-colors, not transition-[transform,background-color]: the pressed
  // state swaps the TEXT colour too, and leaving that untransitioned snaps the
  // label to near-white while it still sits on the tinted surface. nowrap so
  // «Levert etter frist 3» never breaks across two lines inside a pill, which is
  // what it does on a phone, and the phone is the scene.
  //
  // ⚠ No font-weight here. The two branches below each set their own, because
  // cn() is a plain join (src/lib/cn.ts) — it does not de-duplicate Tailwind
  // families, so a weight in the base plus a weight in a branch leaves the
  // outcome to stylesheet order.
  'inline-flex min-h-11 items-center whitespace-nowrap rounded-pill px-4 text-sm ' +
  'transition-colors duration-200 ease-brand active:scale-[0.97] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
```

(Keep the third line exactly as it is in the file — copy it, do not retype it.)

Then the `className` in `Segment`:

```tsx
      className={cn(
        segmentClasses,
        // ★ The tint, not the fill. A pressed segment is a STATE — the same
        // thing PillLink's `active` marks, and the same thing /admin/elever's
        // status filter already renders this way. The fill it used to carry is
        // the primary ACTION's, which made «Alle 2» and «Ny oppgave» compute
        // an identical background while two states rendered differently.
        pressed ? currentTint : 'bg-surface-tint font-medium text-ink hover:bg-hairline',
      )}
```

- [ ] **Step 5: Run the tests**

```bash
npx vitest run "src/app/(portal)/laerer/oppgaver/[assignmentId]/RosterReview.test.tsx"
```

Expected: PASS, including the pre-existing `aria-pressed` tests — the a11y contract is untouched.

- [ ] **Step 6: Confirm in the browser**

Load `/laerer/oppgaver/[id]`, and compare computed styles:

```js
const seg = [...document.querySelectorAll('[aria-pressed="true"]')][0];
const cta = [...document.querySelectorAll('a,button')].find(e => e.textContent.trim() === 'Ny oppgave');
[getComputedStyle(seg).backgroundColor, cta && getComputedStyle(cta).backgroundColor];
```

Expected: the two values now **differ**. They were identical.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/PillLink.tsx "src/app/(portal)/laerer/oppgaver/[assignmentId]/RosterReview.tsx" "src/app/(portal)/laerer/oppgaver/[assignmentId]/RosterReview.test.tsx"
git commit -m "fix(design): stop the selected filter impersonating the primary action"
```

---

## Task 11: One `aria-current="page"` per page

`/forelder/lekser` emits `aria-current="page"` **twice**: `ForelderNav.tsx:26` marks «Lekser» in the nav, and `forelder/lekser/page.tsx:63` marks the selected child in the switcher. Two elements claiming to be the current page is ambiguous to anything that goes looking for it.

⚠ **This is wider than the walkthrough recorded, and the fourth site is a different control than it looks.** Three more pages emit a second `page` marker, each under a nav that already marks the active item:

| File | Line | The control | Nav that also marks the page |
|---|---|---|---|
| `src/app/(portal)/forelder/lekser/page.tsx` | 63 | child switcher | `ForelderNav.tsx:26` |
| `src/app/(portal)/forelder/page.tsx` | 59 | child switcher | `ForelderNav.tsx:26` |
| `src/app/(portal)/forelder/fremdrift/page.tsx` | 58 | child switcher | `ForelderNav.tsx:26` |
| `src/app/(portal)/admin/elever/page.tsx` | 63 | **status filter** (`<nav aria-label="Filtrer på status">`) | `AdminNav.tsx:28` |

Neither control is choosing a page. The switcher chooses *whose data is shown on this page*; the filter chooses *which rows are shown on this page*. Both are `aria-current="true"` — "the current item of a set" — which makes no claim about pages. The remedy is identical for all four; only the sentence in the comment differs.

- [ ] **Step 1: Verify the duplicate on each of the four routes**

Only the first was measured. Confirm the other three rather than assuming:

```js
document.querySelectorAll('[aria-current="page"]').length
```

Run on `/forelder`, `/forelder/lekser`, `/forelder/fremdrift`, `/admin/elever`.

Expected today: `2` on each. **If any returns 1, that route is already correct — leave it alone and record which.**

- [ ] **Step 2: Write the failing tests**

In `src/app/(portal)/forelder/lekser/page.test.tsx`, the existing tests at lines 138 and 158 assert `'page'` — those are the tests that encode the defect, so they change with the code. Replace the `aria-current` expectations:

```tsx
    expect(amira).toHaveAttribute('aria-current', 'true');
```

and add, in the same file:

```tsx
  it('★ claims to be the current PAGE exactly once — the nav does, the child switcher does not', () => {
    const { container } = renderPage();
    // The switcher picks whose data is shown, not which page you are on.
    // Two page claims is ambiguous to anything resolving "the" current page.
    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(0);
    expect(container.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
  });
```

(The page component under test renders the switcher but not the nav, hence 0 rather than 1 — the nav's own `page` marker is asserted in `ForelderNav.test.tsx` and is the one that stays.)

- [ ] **Step 3: Run and watch it fail**

```bash
npx vitest run "src/app/(portal)/forelder/lekser/page.test.tsx"
```

Expected: FAIL — one element still has `aria-current="page"`.

- [ ] **Step 4: Change all four switchers**

In each of the four files, change the switcher's line from:

```tsx
                    aria-current={active ? 'page' : undefined}
```

to:

```tsx
                    aria-current={active ? 'true' : undefined}
```

Leave `ForelderNav.tsx`, `AdminNav.tsx`, `LaererNav.tsx`, `ElevNav.tsx` and `RoleSwitcher.tsx` **untouched** — the nav is the thing that legitimately marks the page.

- [ ] **Step 5: Update the two comments this task makes false**

Part 1's lesson 4 — a comment becomes a lie when you change the code under it. Two say the wrong thing after Step 4.

`forelder/lekser/page.tsx:51` currently reads "`active` IS the current-page marker here, paired with aria-current". Replace with:

```tsx
      {/* `active` marks which child is on screen, paired with
          aria-current="true" — a current ITEM, not a current PAGE. The nav
          above already claims the page, and two elements claiming it leaves
          "the current page" ambiguous to anything that resolves it by role. */}
```

`src/components/ui/PillLink.tsx:28` states "Callers pair it with `aria-current="page"`", which after this task four of its callers no longer do. Replace that sentence with:

```
 * the place you already are. Callers pair it with an aria-current value they
 * choose: "page" when the pill really is a different page (RoleSwitcher), and
 * "true" when it selects a child or a filter WITHIN the current page — where
 * the nav has already claimed "page" and a second claim makes the answer
 * ambiguous.
```

- [ ] **Step 6: Run the affected suites**

```bash
npx vitest run "src/app/(portal)/forelder" "src/app/(portal)/admin/elever"
```

Expected: PASS.

- [ ] **Step 7: Re-measure all four routes**

Re-run Step 1's snippet on each of the four.

Expected: `1` everywhere.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(portal)/forelder" "src/app/(portal)/admin/elever"
git commit -m "fix(a11y): let one element per page claim to be the current page"
```

---

## Exit gate

Run in this order, from a database built from scratch. Do **not** report part 2 complete on a partial run.

- [ ] **Step 1: Rebuild the database and confirm the chain applied**

```bash
cd /Users/daodilyas/dev/iqra-portal && npx supabase db reset
```

`db reset` exits 1 on a storage-readiness race even when it worked. Verify by state, not exit code:

```bash
docker exec supabase_db_iqra-portal psql -U postgres -tAc "select max(version) from supabase_migrations.schema_migrations;"
docker exec supabase_db_iqra-portal psql -U postgres -tAc "select (select count(*) from auth.users), (select count(*) from public.assignments), (select count(*) from public.submissions), (select count(*) from public.assignment_reviews), (select count(*) from public.submission_attachments), (select count(*) from storage.objects), (select count(*) from private.storage_orphans);"
```

Expected: `20260804000000`, and `7|2|2|1|0|0|0`.

- [ ] **Step 2: Static gates**

```bash
npm run typecheck && npm run lint && npx knip
```

Expected: 0 type errors; 0 lint errors (5 pre-existing warnings); knip unchanged from base.

⚠ Three knip traps in this round, all new-file related:
- `currentTint` and `BackLink` are new **exports**. Both are used, so they should pass — a flag here means a call site was missed, which is a real finding, not a knip quirk.
- `error.tsx` / `global-error.tsx` have **no importer** — Next resolves them by filename convention. If knip's Next plugin is not configured, it will report all three as unused files. Confirm by checking whether the existing `layout.tsx` / `page.tsx` files are also flagged; if they are not, the plugin is active and the error files are fine. Do **not** silence a genuine unused-export finding to make this green.
- `ErrorPanel` is imported by two of the three boundaries but not by `global-error.tsx`, deliberately (it must not import from the tree that just failed). That is not a defect.

- [ ] **Step 3: Unit suite**

```bash
npx vitest run
```

Expected: ≥ 497 passing (baseline) + the ~13 added here, 0 failing.

- [ ] **Step 4: pgTAP, whole directory**

```bash
for f in supabase/tests/*.sql; do
  echo "=== $f"
  docker exec -i supabase_db_iqra-portal psql -U postgres -q -f - < "$f" | grep -E "^(not ok|# Looks like)" || echo "  clean"
done
```

Expected: `clean` for every file. Baseline was 640 assertions across 32 files; this round adds file 32 (7) plus 3 assertions, so **650 across 33 files**.

- [ ] **Step 5: API suite**

```bash
npm run test:api
```

Expected: 351/12 (baseline), 0 failing. Re-run once if GoTrue session churn produces a flake — that churn is measured and known, but a **repeatable** failure is real.

- [ ] **Step 6: Production build**

Stop the dev server first — `next build` and `next dev` fight over `.next`.

```bash
npm run build
```

Expected: clean. Watch for the new `error.tsx` files being picked up in the route list.

- [ ] **Step 7: ★ Re-run both part-1 exploit scripts**

These are the regression test for the entire fix round. Both must still be refused.

Expected: `permission denied for table submissions` / `... assignments`, then `NOT_YOURS`, including the `submitted_at` backdate.

- [ ] **Step 8: The production-build question part 1 left open**

`GROUP_SIZE_BOUND`'s refusal cannot be judged in dev, because the claim is about Next redacting server-action errors in production. With `npm run build && npm start` running, delete a grouped pupil and record what actually renders — this is also the first real test of Task 1's boundary under redaction.

- [ ] **Step 9: Re-enrol MFA**

`db reset` and `test:api` both wipe it. Do this **after** the last api run or the user cannot log in: `/mfa/registrer`.

- [ ] **Step 10: Push and update PR #15**

```bash
git push origin feat/phase-4-oppgaver
```

Then confirm CI is green on the new head before claiming the round is done.

---

## Deliberately NOT in this round

- **M3 / M4 / M5** — the `left_on` exclusive→inclusive widening, the backlog's `count(distinct …)`, and the retention bound whose behavioural test proves the wrong half (A_UTE's `due_on` falls outside *both* seeded terms, so `t.is_current` is not what removes it). Scoped out by decision on 2026-08-04; file as follow-ups against Phase 5.
- **An actual sweeper** for `private.storage_orphans`. The ledger makes a failed erasure *completable*; a job that completes it without a human needs a cron/route decision and its own tests.
- **`/admin/elever` roster link hit areas** (176×24 links inside a non-clickable 974×49 `<li>`). Pre-existing, not Phase 4 — do not gate the merge on it.
- **The pupil + parent visual re-walk at 1280 and 375.** Recommended *after* this round, because Tasks 5 and 6 touch the same components.

## Plan review ledger — 2026-08-04

The plan was reviewed against the goal before any code was written, per CLAUDE.md. A single focused pass rather than the full panel, because agent dispatch is disabled in this session — noted so a later reader knows the review's depth. Eight defects found **in the plan**, all fixed above. Five were caught by checking a claim against the repo instead of against the plan's own internal consistency, which is the rule that earned its keep three times in part 1.

| # | Defect in the plan | How it was caught | Consequence if executed |
|---|---|---|---|
| 1 | `cn` assumed to be tailwind-merge | Read `src/lib/cn.ts` — it is `filter(Boolean).join(' ')` | Task 10 would put `font-medium` *and* `font-semibold` on the pressed segment and let stylesheet emission order pick. Fixed by moving the weight out of the shared base; a test now pins exactly one weight class per branch. |
| 2 | `/admin/elever:63` called a "child switcher" | Read the file — it is a **status filter** under `<nav aria-label="Filtrer på status">` | The comment written into the code would have described the wrong control. It also surfaced the opposite finding: that filter already uses `PillLink`'s tint, so **Task 10 has a working precedent in-repo** rather than inventing a treatment. |
| 3 | Inserting an assertion mid-file in `22_submissions_rls.sql` | Grepped the section headers — there are **8**, seven of them after the insertion point | Every `-- ── NN-NN` header below the insert would silently start lying about its own range. Added an explicit renumbering step with the exact table. |
| 4 | `npm run gen:types` | Read `package.json` — the script is `db:types` | Task 4 Step 2 would fail, and the `rpc('record_storage_orphan')` call would not typecheck. |
| 5 | Task 9's first test asserted the accessible name `'← Oppgaver'` | Traced it against the component the same plan specifies — the arrow is `aria-hidden`, so the name is `'Oppgaver'` | The plan shipped a knowingly-wrong test and a later step telling you to fix it. A plan that hands you a broken test teaches you to distrust its tests. Rewritten correctly, with the reason inline. |
| 6 | No RLS on `private.storage_orphans`, unexamined | Read `26_rls_force.sql` — its floor is scoped to `n.nspname = 'public'` | Would have been either an unexplained gap or a wasted policy no caller can reach. The migration now states why schema reachability is the wall here. |
| 7 | knip's treatment of the three new `error.tsx` files unaddressed | Reasoned from the fact that Next resolves them by filename, so nothing imports them | The exit gate would have gone red on files that are correct, inviting someone to silence knip and hide a real unused-export finding alongside it. |
| 8 | `PillLink`'s doc comment left stale | Applied part 1's lesson 4 to this plan's own diff | The comment says callers pair `active` with `aria-current="page"`; after Task 11 four callers do not. |

**Verified sound and left unchanged** (checked, not assumed):

- **M1's detector.** Traced through the live `writes_submission` body: after file 30's A_DEL closing insert, group 63 = {Yusuf, Amina} are both `godkjent`, so the group branch's `not exists(member without godkjent)` is TRUE and the lock closes. parentA guards Yusuf, so the row is readable. `writable = false` on a **readable** row is exactly the case the file lacked.
- **M2's detector.** `ba…061` belongs to assignment `ba…052`; `ba…051` is class-wide with no groups; pupil `ba…0006` is linked to `s31 ∈ G1`. Today the WITH CHECK fails on `ag.assignment_id = aid`. There is no composite FK and the XOR CHECK only enforces student-or-group, so nothing else refuses it. If the mutation instead produces `23505`, the `throws_ok` still reddens on the wrong sqlstate — the detector survives that variation.
- **Reuse-rollback ordering.** `actions.ts:347` sweeps objects while the assignment row still exists, so routing it through the helper does not disturb the documented ordering the comment depends on.
- **The definer function needs no `private` USAGE grant** for `authenticated`, because it executes as its owner — which is also why pgTAP assertion 2 can assert the absence of that grant.

## Automation limits — read before planning any walkthrough

- **Synthetic clicks do not trigger this app's React handlers** in the Browser pane. Proven on three controls of two types. `form.requestSubmit()` does work. A "defect" reported from a synthetic click in part 1 had to be retracted — the handler never fired. Measurement works; interaction does not. Where a plan step above says "click", it means **ask the user to click**.
- `read_page` with `filter:interactive` is **viewport-scoped** — an element below the fold reads exactly like an element that is not there.
- The classifier **blocks a programmatic `.click()` on a delete control**. Do not route around it.
