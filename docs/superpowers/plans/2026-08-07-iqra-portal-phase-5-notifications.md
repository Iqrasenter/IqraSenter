# IQRA Skoleportal — Phase 5, Plan 3: Varsler + e-postping

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the in-app notification substrate, fan it out from both message and announcement writes, and drain a coalesced content-free e-mail ping through the repo's first API route and first cron entry.

**Architecture:** `public.notifications` is state, not an event log — one row per `(user_id, entity, entity_id)`, upserted, so a ten-message thread is one bell entry. Every recipient set is produced by **calling** the read predicate (`private.reads_thread` / `private.reads_announcement`) over a candidate set, never by restating it. Mail is coalesced to **one permanent row per user** in `private.email_pings` (D22) and drained by a Vercel Cron → `src/app/api/varsler/drain/route.ts`, which reaches the database only through three `security definer` RPCs granted to `service_role` alone.

**Tech Stack:** PostgreSQL 15 + RLS/pgTAP · Next.js 15 App Router · TypeScript · Vitest · Resend (injected client; no account yet — see D28)

---

## Where this sits

Plan 1 (threads) and plan 2 (announcements) are code-complete on `feat/phase-5-meldinger`, HEAD `8ba293e`, **nothing pushed**. This plan continues on that branch.

Spec: `docs/phase-5-communication-spec-DRAFT.md` on branch `docs/phase-5-decisions` (§5, §7, §11 tasks 3, 3b, 5, 8, 8b, 8c, 9, 9b, and the notification halves of 12 and 13).

**This plan does NOT cover:** the invite/credential flow (15-series), document reconciliation (task 14), or the exit gate (16-series). Those are plan 4.

---

## ⛔ Five claims in the spec that are STALE against the tree — verified 2026-08-05

The spec orders work, and the work invalidates the spec's own numbers. Every one of these was checked against `feat/phase-5-meldinger` @ `8ba293e`:

| Spec says | Tree says | Where |
|---|---|---|
| `expect(allActions.length).toBe(67)` | **79** | `src/app/action-guards.test.ts:214` |
| fingerprints cover **26** pairs | **83** | `supabase/tests/29_definer_fingerprints.sql:411` |
| new pgTAP files **35–38** | 35, 36, 37 taken → this plan writes **38** | `supabase/tests/` |
| pgTAP fixture prefixes `be`/`bf`/`c0` | **all three taken** — file 37 alone carries 200 `c0…` ids incl. 001–014 → this plan uses **`c1`**, measured free across `supabase/tests/*` and `seed.sql` | `supabase/tests/35–37` |
| «no `app/api/` route» | still true — **`find src/app -name route.ts` returns 0** | verified |

★ Two of these counters are hard-coded literals that redden on every addition. Bump each **once, deliberately**, in the task that causes it, and state the new number in the commit message.

⚠ **The npm scripts are NOT what an earlier draft of this plan assumed.** Measured 2026-08-05 against `package.json` — `npm run test:db` and `npm run test:unit` **do not exist** and fail with `Missing script`. The real set is:

| Purpose | Command |
|---|---|
| pgTAP suite | `npx supabase test db` (no npm script wraps it) |
| one pgTAP file | `npx supabase test db --file supabase/tests/NN_name.sql` |
| unit suite | `npm test` (= `vitest run`) |
| api suite | `npm run test:api` |
| typecheck | `npm run typecheck` (= `tsc --noEmit`) |
| lint · knip | `npm run lint` · `npm run knip` |

## ⛔⛔ TWO THINGS THAT MUST BE DONE IN EVERY TASK THAT TOUCHES THEM

Both were absent from the first draft, and each one alone stops execution dead.

**1. Regenerate `database.types.ts` after every migration that adds a function or a table.**
`createServiceRoleClient()` returns `SupabaseClient<Database>`, and postgrest-js constrains `.rpc()` to `keyof Schema['Functions']` and `.from()` to `keyof Schema['Tables']`. The committed `src/lib/supabase/database.types.ts` knows none of the five new RPCs and not `notifications`. So `npx tsc --noEmit` goes red at Task 8 and **stays** red — `next.config.ts` sets no `ignoreBuildErrors`, so Task 10's own `npm run build` gate can never pass, and CI is red from that commit onward. That violates "each commit compiles and passes tests."

After Tasks 1, 2, 3, 4, 5 and 13 — i.e. every migration task — run, with the local stack up:

```bash
cd ~/dev/iqra-portal && npm run db:types && git add src/lib/supabase/database.types.ts
```

and include that file in the task's commit.

**2. `vi.mock('server-only', () => ({}))` at the top of every new unit test.**
`node_modules/server-only` is a bare `throw`, and its `exports` map only resolves to the empty module under the `react-server` condition, which Vitest does not set. The repo already does this in **ten** files (e.g. `src/lib/env.server.test.ts:7`). This plan puts `import 'server-only'` at the head of `ping-email.ts`, `resend.ts`, `drain.ts` and `queries.ts`. Without the mock, `ping-email.test.ts` and `drain.test.ts` fail to import at all — and the red-first step then reports a *different* error than the one documented, which is how a harness bug gets "fixed" by editing the assertion.

Every new `*.test.ts` in this plan begins:

```typescript
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
```

**Verified as still TRUE** (do not re-check, but do not loosen):
- `public.profiles` holds `grant update (full_name, phone, locale) on public.profiles to authenticated` and **no table-level UPDATE grant** (`20260716170230_core_identity.sql:122`). A new column is therefore **not** writable by default.
- `service_role` carries **BYPASSRLS** (`20260716170230_core_identity.sql:115`), so no table needs a service_role policy — only grants.
- `src/proxy.ts`'s matcher covers **everything** except Next internals and static-file extensions. The drain route **is** gated unless explicitly excluded.
- `vercel.json` is `{"regions": ["arn1"]}` — no `crons` key.
- No mail dependency in `package.json`.

---

## Decisions taken for this plan

**D25 — `notifications` is state per `(user_id, entity, entity_id)`, not one row per event.**
A unique index makes the fan-out an upsert: a second message in a thread refreshes `created_at` and clears `read_at` rather than adding a row. Consequences, all wanted: the bell counts *conversations with something new* (which is what a parent acts on); the table is bounded by (users × entities) instead of by message volume; and **the announcement fan-out is idempotent for free**, which is what lets the claim be retried safely.

**D26 — the immediate-announcement fan-out is an `after insert` TRIGGER, not a call from the publish action.**
The user chose «fan out inline at publish, one function two callers». This delivers exactly that, with the trigger as the second caller instead of the action. Why the trigger is the correct reading:
- There are **two** publish actions (`laerer/oppslag/actions.ts` and `admin/oppslag/actions.ts`). An action-level call must be added to both and can drift; a trigger cannot be forgotten.
- `claim_due_announcements()` is granted to `service_role` **only**. Calling it from a teacher's action would require either a new grant to `authenticated` (which would let any parent burn every pending fan-out — the exact hazard its own comment warns about) or a service-role round trip from a non-quarantined module.
- The trigger runs **in the insert's transaction**, so an announcement can never be committed without its notifications.
`private.stamp_announcement_fanout` already stamps `fanned_out_at` at INSERT when `published_at <= now()`, so `new.fanned_out_at is not null` is exactly «published immediately». The scheduled ones stay with the drain.

**D27 — the e-mail keeps the count** (spec Q10 = (a)). «Du har 3 nye varsler.» Nothing else varies.

**D29 — the fan-outs write `notifications` on the strength of `BYPASSRLS`, and that is a standing dependency worth naming.**
`notifications` has **no INSERT policy at all** — deliberately, since `authenticated` holds no INSERT grant either. The two fan-outs write it as `security definer` functions owned by `postgres`, which carries `BYPASSRLS`, and BYPASSRLS is evaluated *before* the owner/FORCE rule. That is the repo's established pattern (`private.touch_thread` works the same way), so this plan follows it rather than inventing a second one.
⚠ **But `20260728181000_force_row_level_security.sql:13` explicitly contemplates revoking BYPASSRLS from `postgres` as "a hardening step worth taking".** If that ever happens, every fan-out in this plan starts failing — and because a trigger's failure aborts the write that fired it, the visible symptom is *sending a message stops working*, not *notifications stop appearing*. Whoever does that hardening must add an INSERT policy to `notifications` in the same commit. Recorded here because nothing in the test suite can see it coming.

**D28 — no Resend account yet; build against an injected client.**
The `SendPing` function type is a parameter, defaulted to the real Resend caller and replaced by a fake in tests. Real sending is gated on `RESEND_API_KEY` being present; absent, the drain logs and treats the send as a **failure with a retryable error code**, never as a success. ⚠ **Exit-gate debt, carried to plan 4:** §11 task 9 requires confirming against a *real delivered message* that Resend's link-rewriting and open-tracking are OFF. `T-16` asserts over the template *before* the provider touches it and structurally cannot catch this. It cannot be discharged until IQRA's account and `varsler.iqrasenter.no` exist.

---

## File structure

**Migrations** (head is `20260806122000`; these follow in order):

| File | Responsibility |
|---|---|
| `supabase/migrations/20260807120000_notifications.sql` | the table, its grant firewall, two policies, the unread index |
| `supabase/migrations/20260807121000_email_ping_opt_out.sql` | `profiles.email_pings_enabled` + **its column grant** |
| `supabase/migrations/20260807122000_email_pings.sql` | `private.email_pings` (D22 one-row shape) + the three `public` definer RPCs |
| `supabase/migrations/20260807123000_thread_fanout.sql` | `private.thread_recipients` + the `messages` fan-out trigger |
| `supabase/migrations/20260807124000_announcement_fanout.sql` | `private.fan_out_announcement`, the `after insert` trigger, and `claim_due_announcements` rewritten to fan out inside its own statement |

**Tests:**

| File | Responsibility |
|---|---|
| `supabase/tests/38_notifications_rls.sql` | new — the read/write walls, both recipient resolvers, the `notified ⊆ readers` invariant |
| `supabase/tests/31_column_locks.sql` | extend — the `notifications` and `profiles` grant shapes |
| `supabase/tests/29_definer_fingerprints.sql` | extend — 5 new functions, counter 83 → 95 (markers, not rows) |
| `src/app/route-guards.test.ts` | **new static wall** for `src/app/api/**/route.ts` |
| `src/lib/varsler/ping-email.test.ts` | the template's omissions, as assertions |
| `src/lib/varsler/drain.test.ts` | claim → send → outcome, backoff, the attempts ceiling |
| `tests/api/notifications.test.ts` | wall-3: the fan-out through the real app path |

**Application code:**

| File | Responsibility |
|---|---|
| `src/lib/varsler/ping-email.ts` | subject + body, pure, no provider |
| `src/lib/varsler/resend.ts` | the `SendPing` type and the real Resend caller |
| `src/lib/varsler/drain.ts` | the drain loop — pure over an injected client and an injected sender |
| `src/lib/varsler/queries.ts` | DAL: unread count + the bell list |
| `src/app/api/varsler/drain/route.ts` | the repo's first route handler; secret gate only |
| `src/app/(portal)/varsler/actions.ts` | mark-read |
| `src/app/(portal)/profil/page.tsx` + `actions.ts` | «Min profil» + the opt-out toggle |
| `src/app/(portal)/admin/varsler/page.tsx` | failed pings + the drain-health number |
| `src/components/portal/VarselBell.tsx` | the shell bell |
| `src/lib/env.server.ts` | extend — `getCronSecret()`, `getResendApiKey()` |
| `src/proxy.ts` | extend — the one-path exclusion, **before the `!user` branch** |
| `vercel.json` | extend — the repo's first `crons` entry |

---

## Task 0: Baseline, and prove the stack is not contaminated

**Files:** none — this task commits nothing.

⚠ A second Claude Code session has shared this checkout and the one Supabase docker stack since 2026-08-04. A `supabase db reset` mid-measurement gives plausible-looking wrong numbers. Establish the baseline before touching anything.

- [ ] **Step 1: Confirm the branch and that nothing is dirty**

```bash
cd ~/dev/iqra-portal && git status --short && git log --oneline -1
```

Expected: HEAD `8ba293e`, and the only untracked file is `scripts/fiken-probe.mjs` (the user's economy probe — **never stage it**; it is also why `knip` fails locally but passes in CI).

- [ ] **Step 2: Confirm no foreign vitest is running against the stack**

```bash
ps aux | grep "[v]itest" | grep -v grep || echo "clear"
```

Expected: `clear`. If not, wait — do not reset the database.

- [ ] **Step 3: Record the baseline**

```bash
cd ~/dev/iqra-portal && npx supabase test db 2>&1 | tail -5
```

Expected: `Files=38, Tests=842, PASS`. Any other number means the tree is not what this plan was written against — stop and reconcile.

- [ ] **Step 4: Record the unit and typecheck baseline**

```bash
cd ~/dev/iqra-portal && npm test 2>&1 | tail -4 && npx tsc --noEmit && echo "TSC OK"
```

Expected: 54 files / 600 tests passing, then `TSC OK`.

---

## Task 1: `public.notifications` — the table, the firewall, the walls

**Files:**
- Create: `supabase/migrations/20260807120000_notifications.sql`
- Create: `supabase/tests/38_notifications_rls.sql`

The tests and the migration land in **one commit** — the table does not exist beforehand, so a red commit would break "each commit compiles and passes tests". Red-first happens in the working tree and is evidenced by the mutation pass, not by a committed red build.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260807120000_notifications.sql`:

```sql
-- Varsler — the in-app notification substrate (D11, spec §5.1).
--
-- ★ THIS TABLE IS STATE, NOT AN EVENT LOG (D25). One row per
-- (user_id, entity, entity_id), enforced by a unique index, and the fan-out is
-- an UPSERT. A thread that receives ten messages is ONE bell entry whose
-- created_at moves and whose read_at clears. Three things fall out of that and
-- all three are wanted:
--   · the bell counts CONVERSATIONS WITH SOMETHING NEW, which is the number a
--     parent can act on; "17 varsler" from one chatty teacher is noise.
--   · the table is bounded by (users × entities), not by message volume.
--   · the announcement fan-out becomes IDEMPOTENT for free, which is what
--     lets public.claim_due_announcements() be retried after a crash.
--
-- ★ entity_id IS DELIBERATELY NOT A FOREIGN KEY (D11 / spec Q13(a)). A real FK
-- invites a join that skips the read predicate, and the polymorphism is the
-- point: one badge count, one list, two entity kinds. ⛔ THE COST IS REAL AND
-- PHASE 7 OWNS IT: these rows SURVIVE their entity. Deleting a students row
-- cascades to threads and thence to messages, but nothing reaches a
-- notification whose entity_id names the deleted thread. The retention job
-- must sweep them explicitly — this is the one orphan shape this plan creates
-- and it is the analogue of Phase 4's private.storage_orphans.
--
-- ★ SCHEMA-AS-CONTROL: `authenticated` gets NO INSERT GRANT AT ALL. A forged
-- notification is refused at the privilege layer (42501) before RLS is even
-- consulted, so there is no policy to get wrong. The only writers are the two
-- SECURITY DEFINER fan-outs.

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  entity     text not null check (entity in ('thread', 'announcement')),
  -- NOT a foreign key. See the header.
  entity_id  uuid not null,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

-- The upsert target for both fan-outs. D25 is enforced HERE — drop this index
-- and the fan-outs silently start appending duplicates.
create unique index notifications_one_per_entity_idx
  on public.notifications (user_id, entity, entity_id);

-- What makes the badge count cheap. Partial, because the only question the
-- shell asks on every render is "how many unread".
create index notifications_unread_idx
  on public.notifications (user_id, created_at desc) where read_at is null;

comment on table public.notifications is
  'Varsler. ONE row per (user_id, entity, entity_id) — state, not events (D25); the fan-outs upsert. entity_id is deliberately NOT a foreign key, so rows SURVIVE their entity and Phase 7''s retention job must sweep them explicitly.';
comment on column public.notifications.entity_id is
  'The thread or announcement this points at. No FK by design (D11/Q13) — a real FK invites a join that skips the read predicate. Resolve it THROUGH RLS: an unreachable entity is simply absent from the result, which is a stronger guarantee than a per-row check because it cannot be forgotten for one row.';

-- ── grants: revoke the TABLE, then grant the columns ────────────────
-- ⚠ Order is load-bearing: a column-level revoke subtracts NOTHING from a
-- table-level grant (measured 2026-08-03, 31_column_locks.sql).
revoke all on table public.notifications from anon, authenticated, service_role;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
--   ⛔ NO INSERT GRANT for authenticated, and no DELETE either. Rows exist
--   only because a definer trigger made them, and a user who could delete a
--   notification could hide the school's message to them from themselves.
grant select, delete on public.notifications to service_role;  -- erasure + orphan sweep

alter table public.notifications enable row level security;
alter table public.notifications force row level security;

-- service_role carries BYPASSRLS (20260716170230:115), so it needs grants but
-- no policy. Everything below is the authenticated surface.
create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

-- ⚠ BOTH using AND with check name the owner. `using` alone would let a user
-- move their own row to another user_id — the authorship-laundering shape
-- Phase 4 shipped. The column grant already limits the write to read_at, but
-- pinning it in the policy too costs nothing and survives a grant widening.
create policy "notifications_update_own_read"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
```

- [ ] **Step 2: Write the failing pgTAP file**

Create `supabase/tests/38_notifications_rls.sql`. Start with only the section below; later tasks extend it and bump `plan()`.

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- Varsler: the read wall, the write wall, and the two grant shapes that make
-- the write wall unnecessary.
--
-- ⚠ 15, counted by hand. NEVER count plan() by grep — it undercounts
-- multi-line calls, measured at 17 against a correct plan(20).
--
-- ★ Every → 0 rows negative carries an ENTITLED-READER control over the
-- IDENTICAL row. Pairing a refusal with a second read by the SAME actor proves
-- only that the actor has a session — the shape that let four Phase-4
-- assertions survive replacing a guarded body with `select true`.
--
-- Fixture prefix c1 — MEASURED free 2026-08-05.

delete from public.notifications;

insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.email, '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
from (values
  ('c1000000-0000-0000-0000-000000000001'::uuid, 'c1-eier@test.no'),
  ('c1000000-0000-0000-0000-000000000002'::uuid, 'c1-annen@test.no')
) as u(id, email)
on conflict (id) do nothing;

insert into public.profiles (id, full_name)
values ('c1000000-0000-0000-0000-000000000001', 'C1 Eier'),
       ('c1000000-0000-0000-0000-000000000002', 'C1 Annen')
on conflict (id) do nothing;

-- Written as the table owner, because no client role may insert here at all —
-- which is itself assertion 5.
insert into public.notifications (id, user_id, entity, entity_id)
values ('c1000000-0000-0000-0000-0000000000a1', 'c1000000-0000-0000-0000-000000000001',
        'thread', 'c1000000-0000-0000-0000-0000000000f1');

-- ── 1. the owner reads their own varsel ─────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::int from public.notifications where id = 'c1000000-0000-0000-0000-0000000000a1'),
  1, 'eieren leser sitt eget varsel');

-- ── 2. another user does not — with the owner as the control ────────
set local request.jwt.claims = '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  (select count(*)::int from public.notifications where id = 'c1000000-0000-0000-0000-0000000000a1'),
  0, 'en annen bruker ser ikke varselet');

select is(
  (select count(*)::int from public.notifications),
  0, 'og ser ingen varsler i det hele tatt');

-- The entitled-reader control over the IDENTICAL row: assertion 2 is only
-- meaningful if the row is actually there for someone.
set local request.jwt.claims = '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select user_id from public.notifications where id = 'c1000000-0000-0000-0000-0000000000a1'),
  'c1000000-0000-0000-0000-000000000001'::uuid,
  'kontroll: raden finnes for den berettigede leseren');

-- ── 3. nobody may forge a varsel — 42501, not a policy refusal ──────
select throws_ok(
  $$insert into public.notifications (user_id, entity, entity_id)
    values ('c1000000-0000-0000-0000-000000000001', 'thread', gen_random_uuid())$$,
  '42501',
  'permission denied for table notifications',
  'authenticated har ingen INSERT-rett — avvist i rettighetslaget, før RLS');

-- ── 4. nor delete one ───────────────────────────────────────────────
select throws_ok(
  $$delete from public.notifications where id = 'c1000000-0000-0000-0000-0000000000a1'$$,
  '42501',
  'permission denied for table notifications',
  'ingen DELETE-rett — et varsel kan ikke skjules for seg selv');

-- ── 5. the owner may mark it read ───────────────────────────────────
update public.notifications set read_at = now()
 where id = 'c1000000-0000-0000-0000-0000000000a1';
select is(
  (select (read_at is not null) from public.notifications where id = 'c1000000-0000-0000-0000-0000000000a1'),
  true, 'eieren kan markere som lest');

-- ── 6. but may not move it to someone else ──────────────────────────
-- ⚠ This is the column grant refusing, not the policy: user_id has no UPDATE
-- grant. Assertion 8 pins the policy half separately, so widening the grant
-- later cannot silently take both.
select throws_ok(
  $$update public.notifications set user_id = 'c1000000-0000-0000-0000-000000000002'
     where id = 'c1000000-0000-0000-0000-0000000000a1'$$,
  '42501',
  'permission denied for table notifications',
  'user_id har ingen UPDATE-rett — et varsel kan ikke overdras');

-- ── 7. and may not mark ANOTHER user's varsel read ──────────────────
-- ⛔ `reset role` FIRST. `set local role authenticated` is still in force from
-- section 1, and assertion 5 two statements ago PROVED that authenticated has
-- no INSERT grant. Unwrapped, this fixture insert raises 42501 — and that is
-- not one red assertion, it ABORTS THE TRANSACTION: every later statement is
-- 25P02, finish() never runs, and all 53 assertions are lost.
-- ★ Perversely, under Task 1 Step 5's mutation (`grant insert … to
-- authenticated`) this insert SUCCEEDS — so the mutated run would get further
-- than the clean one, which is how a fixture bug gets diagnosed as a code bug.
reset role;
insert into public.notifications (id, user_id, entity, entity_id)
values ('c1000000-0000-0000-0000-0000000000a2', 'c1000000-0000-0000-0000-000000000002',
        'announcement', 'c1000000-0000-0000-0000-0000000000f2');

set local role authenticated;
set local request.jwt.claims = '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}';
update public.notifications set read_at = now()
 where id = 'c1000000-0000-0000-0000-0000000000a2';

-- ⚠ THE CHECK MUST RUN AS SOMEONE WHO CAN SEE THE ROW. Read back as user 001
-- and the select returns NO ROWS — the policy hides it — so `is(null, true)`
-- fails and the assertion looks like a policy bug when it is a test bug. Drop
-- to the owner to observe the row's actual state.
reset role;
select is(
  (select (read_at is null) from public.notifications where id = 'c1000000-0000-0000-0000-0000000000a2'),
  true, 'en annens varsel er urørt — UPDATE traff null rader, ikke en feil');

-- ── 8. the grant SHAPE, which is what assertions 3-7 stand on ───────
-- ★ These are the load-bearing ones. A future `grant insert on
-- public.notifications to authenticated` would turn 3 green→red silently and
-- take the whole forging story with it.
reset role;

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'notifications'
      and grantee = 'authenticated' and privilege_type = 'INSERT'),
  0, 'authenticated har ingen INSERT-rett på notifications, verken tabell eller kolonne');

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'notifications'
      and grantee = 'authenticated' and privilege_type = 'DELETE'),
  0, 'authenticated har ingen DELETE-rett på notifications');

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'notifications'
      and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  0, 'authenticated har ingen TABELL-vid UPDATE-rett (bare kolonnen read_at)');

select is(
  (select array_agg(column_name::text order by column_name)
     from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'notifications'
      and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  array['read_at'],
  'og nøyaktig én kolonne er skrivbar: read_at');

-- ── 9. RLS is on AND forced ─────────────────────────────────────────
select is(
  (select relrowsecurity and relforcerowsecurity from pg_class
    where oid = 'public.notifications'::regclass),
  true, 'RLS er både enable og force på notifications');

-- ── 10. D25's uniqueness, which the fan-outs depend on ──────────────
select throws_ok(
  $$insert into public.notifications (user_id, entity, entity_id)
    values ('c1000000-0000-0000-0000-000000000001', 'thread',
            'c1000000-0000-0000-0000-0000000000f1')$$,
  '23505',
  null,
  'ett varsel per (bruker, entitet) — det er denne indeksen fan-out-ene upserter mot');

select * from finish();
rollback;
```

- [ ] **Step 3: Run it and watch it fail**

```bash
cd ~/dev/iqra-portal && npx supabase test db --file supabase/tests/38_notifications_rls.sql 2>&1 | tail -20
```

Expected: FAIL — `relation "public.notifications" does not exist`.

- [ ] **Step 4: Apply the migration and run again**

```bash
cd ~/dev/iqra-portal && npx supabase db reset && npx supabase test db 2>&1 | tail -5
```

Expected: `Files=39, Tests=857, PASS` (842 + 15).

⚠ `supabase db reset` **wipes MFA enrolment**. Re-enrol at `/mfa/registrer` before any browser click.

- [ ] **Step 5: Watch assertion 3 fail under a named mutation**

Temporarily add `grant insert on public.notifications to authenticated;` at the end of the migration, `npx supabase db reset`, and re-run file 38.

Expected two failures, and **neither is the one an earlier draft named**:
- the section-3 `throws_ok` — the insert is now refused by **RLS**, not by the privilege layer, so it raises `new row violates row-level security policy` and the expected `'permission denied for table notifications'` message no longer matches;
- the **first grant-shape assertion in section 8** (`authenticated har ingen INSERT-rett`).

⚠ The old wording said *"assertions 3 and 9"*. There is no red 9 under either numbering — 9 is the RLS enable/force assertion by section, and `en annens varsel er urørt` by assertion index, and neither moves. Hunting for it wastes the mutation.

Then remove the line, reset, and confirm green. This is the evidence that the schema-as-control claim is tested rather than asserted.

- [ ] **Step 6: Commit**

```bash
cd ~/dev/iqra-portal && git add supabase/migrations/20260807120000_notifications.sql supabase/tests/38_notifications_rls.sql && git commit -m "feat(varsler): notifications as state, with no way to forge one

One row per (user_id, entity, entity_id), upserted — a ten-message thread is
one bell entry. authenticated gets no INSERT and no DELETE grant at all, so a
forged notification is refused in the privilege layer before RLS is consulted;
the four grant-shape assertions are what that story stands on.

pgTAP 842 -> 857."
```

---

## Task 2: `profiles.email_pings_enabled` — and the grant that makes it savable

**Files:**
- Create: `supabase/migrations/20260807121000_email_ping_opt_out.sql`
- Modify: `supabase/tests/31_column_locks.sql` (`plan(31)` → `plan(33)`)

⚠ **This must land before Task 4** — the message fan-out filters on this column.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260807121000_email_ping_opt_out.sql`:

```sql
-- The e-mail-ping opt-out (spec §5.4). ONE boolean, not a per-kind matrix —
-- two notification kinds do not justify a preferences screen, and only one of
-- them ever sends mail at all.
--
-- ⛔ THE GRANT IS THE WHOLE POINT OF THIS MIGRATION. public.profiles does NOT
-- hold a table-level UPDATE grant for authenticated — it already uses the
-- column-grant idiom, `grant update (full_name, phone, locale)`
-- (20260716170230:122). So a new column is NOT writable by default, and
-- without the grant below the toggle in «Min profil» fails with a 42501 that
-- the user experiences as a form that silently does nothing.
--
-- authenticated DOES hold a table-wide SELECT on profiles, which is why the
-- counterpart name in a thread comes from the D14 projection and not from a
-- profiles read.

alter table public.profiles
  add column email_pings_enabled boolean not null default true;

comment on column public.profiles.email_pings_enabled is
  'Spec §5.4. Owner-editable opt-out for the content-free e-mail ping. Read by private.fan_out_thread_message BEFORE writing private.email_pings — opting out stops the MAIL, never the in-app varsel, which is the source of truth.';

grant update (email_pings_enabled) on public.profiles to authenticated;
```

- [ ] **Step 2: Extend the column-lock test**

In `supabase/tests/31_column_locks.sql`, change `select plan(31);` to `select plan(33);` and append before `select * from finish();`:

```sql
-- ── profiles: the opt-out column is writable, and nothing else moved ──
-- ★ The first assertion would pass with no grant at all if it only counted
-- rows; it names the exact column set, so BOTH failure directions are covered:
-- a missing grant (the toggle never saves) and a widened one (a user renames
-- themselves into another family's thread header).
select is(
  (select array_agg(column_name::text order by column_name)
     from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  array['email_pings_enabled', 'full_name', 'locale', 'phone'],
  'profiles: nøyaktig fire kolonner er skrivbare for eieren');

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'profiles'
      and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  0, 'profiles har fortsatt ingen TABELL-vid UPDATE-rett — kolonneidiomet holder');
```

- [ ] **Step 3: Run and watch it fail**

```bash
cd ~/dev/iqra-portal && npx supabase test db --file supabase/tests/31_column_locks.sql 2>&1 | tail -15
```

Expected: FAIL — the array is `{full_name,locale,phone}`, missing `email_pings_enabled`.

- [ ] **Step 4: Apply and re-run**

```bash
cd ~/dev/iqra-portal && npx supabase db reset && npx supabase test db 2>&1 | tail -5
```

Expected: `Files=39, Tests=859, PASS`.

- [ ] **Step 5: Watch it fail under the mutation that matters**

Comment out the `grant update (email_pings_enabled) …` line, `npx supabase db reset`, re-run file 31. Expected: the first new assertion **FAILS**. Restore, reset, green. This is the exact defect the spec warned about — a form that saves nothing — and it is now impossible to ship it silently.

- [ ] **Step 6: Commit**

```bash
cd ~/dev/iqra-portal && git add supabase/migrations/20260807121000_email_ping_opt_out.sql supabase/tests/31_column_locks.sql && git commit -m "feat(varsler): the ping opt-out, and the column grant it dies without

profiles uses the column-grant idiom and holds no table-level UPDATE, so a new
column is not writable by default. Without the grant the toggle is a form that
silently does nothing — asserted by naming the exact writable column set, which
fails in both directions.

pgTAP 857 -> 859."
```

---

## Task 3: `private.email_pings` + the three RPCs

**Files:**
- Create: `supabase/migrations/20260807122000_email_pings.sql`
- Modify: `supabase/tests/38_notifications_rls.sql` (`plan(15)` → `plan(27)`)

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260807122000_email_pings.sql`:

```sql
-- The e-mail ping queue (D22, spec §5.2).
--
-- ★ ONE PERMANENT ROW PER USER. Created once by the fan-out's upsert, never
-- deleted. A burst of ten messages produces ONE e-mail because there is ONE
-- ROW — not because a partial unique index forbade a second.
--
-- ⛔ WHY THE OLD SHAPE IS GONE, BECAUSE IT WILL LOOK LIKE AN OMISSION.
-- The design this replaces was one row per event with
-- `unique (user_id) where status = 'pending'`. That index was doing the
-- coalescing AND it was what made retry unrepresentable: a failed row that
-- wanted to try again had nothing to transition to without colliding with the
-- row that superseded it — a 23505 in BOTH directions. This is the third
-- attempt at this mechanism. With one permanent row there is nothing to
-- collide with, so "failed → try again" is CLEARING A CLAIM rather than a
-- state change the schema forbids. There is no status column, no
-- `on conflict do nothing`, and no `sending` state; all three belonged to the
-- shape D22 replaced.
--
-- ★ THE WATERMARK IS WHAT STOPS A MID-SEND MESSAGE BEING SWALLOWED.
-- queued_seq is bumped by every fan-out. The claim copies it into claimed_seq.
-- On success, pending is cleared ONLY IF queued_seq = claimed_seq — if a
-- message arrived while the send was in flight, queued_seq has moved, pending
-- stays true, and the next drain picks it up.
--
-- ⚠ private is not a PostgREST-exposed schema and service_role has no USAGE on
-- it (config.toml:16, 20260716170230:11). Everything the drain touches is
-- therefore a `public` SECURITY DEFINER function granted to service_role ONLY.

create table private.email_pings (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  pending         boolean     not null default false,
  queued_seq      bigint      not null default 0,
  claimed_seq     bigint      not null default 0,
  claimed_at      timestamptz,
  sent_at         timestamptz,
  attempts        integer     not null default 0,
  next_attempt_at timestamptz not null default now(),
  failed          boolean     not null default false,
  last_error_code text,
  constraint email_pings_attempts_bound check (attempts between 0 and 5),
  -- A failed row must carry a reason, and a live one must not.
  constraint email_pings_failure_has_code
    check ((failed and last_error_code is not null) or (not failed))
);

comment on table private.email_pings is
  'D22: ONE permanent row per user. Coalescing comes from the row being singular, not from an index. No status column — "nothing to send" is pending = false. The queued_seq/claimed_seq watermark is what stops a message that arrives mid-send from being swallowed.';

-- The drain's queue. Partial: the rows that matter are the handful actually due.
create index email_pings_due_idx
  on private.email_pings (next_attempt_at)
  where pending and not failed and claimed_at is null;

-- The admin health screen's queue (task 13).
create index email_pings_failed_idx
  on private.email_pings (user_id) where failed;

-- ── RPC 1: claim ────────────────────────────────────────────────────
-- ★ CLAIM AND STAMP IN ONE STATEMENT. `for update skip locked` inside the
-- subquery means two concurrent drains never claim the same row, and the
-- claimed_seq copy happens in the same statement as the claimed_at stamp, so
-- there is no window in which a row is claimed without a watermark.
--
-- ⛔ attempts IS NOT INCREMENTED HERE. The 2026-08-04-b review found the
-- ceiling was really 2–3 sends because the counter rose at claim time AND at
-- outcome time. It rises at EXACTLY ONE POINT: record_email_ping_outcome.
create or replace function public.claim_email_pings(batch_size integer default 100)
returns table (user_id uuid, unread_count integer)
language sql volatile security definer set search_path = ''
as $$
  with claimed as (
    update private.email_pings p
       set claimed_at = now(), claimed_seq = p.queued_seq
     where p.user_id in (
             select q.user_id
               from private.email_pings q
               join public.profiles pr on pr.id = q.user_id
              where q.pending
                and not q.failed
                -- ⛔ A LEASE, NOT `claimed_at is null` (panel finding B1/E-4).
                -- With the strict test, a drain killed mid-batch — a serverless
                -- duration limit, a deploy swapping the instance, an OOM —
                -- leaves every remaining row `pending, claimed_at set,
                -- failed = false` FOREVER: invisible to every future claim,
                -- invisible to the admin screen (which lists only `failed`),
                -- and untouchable by reset_failed_ping (which requires
                -- `failed`). Those users never receive another ping. Worse,
                -- each stranded row then inflates oldest_pending_minutes
                -- without bound, permanently breaking the ONE number that is
                -- supposed to mean "the cron is dead". The trigger is not
                -- exotic — it is the first busy drain.
                and (q.claimed_at is null or q.claimed_at < now() - interval '15 minutes')
                and q.next_attempt_at <= now()
                -- Opting out removes you from the queue at the claim, so a
                -- pending row cannot age into a false «kom ikke fram» entry
                -- (panel finding B6).
                and pr.email_pings_enabled
              order by q.next_attempt_at
              limit batch_size
                for update skip locked
           )
    returning p.user_id
  )
  select c.user_id,
         -- ★ THREAD NOTIFICATIONS ONLY, AND ONLY REACHABLE ONES.
         -- Two panel findings meet here.
         -- B7: announcements deliberately never queue mail (D12), yet an
         -- unfiltered count let a stale unread class notice both inflate the
         -- number and DEFEAT THE SKIP PATH — so after any school-wide notice,
         -- every pending ping mailed someone about something they had already
         -- read. The count must describe what the mail is about.
         -- D-2/C-F2: `notifications` has no FK, so a row outlives its entity's
         -- REACHABILITY — guardianship removed, teacher unassigned, term
         -- rollover, pupil erased, login disabled. An unfiltered count is then
         -- an exact measure of what the reader may no longer see, mailed to
         -- them. 20260803001000 exists to abolish exactly that arithmetic.
         (select count(*)::int
            from public.notifications n
           where n.user_id = c.user_id
             and n.read_at is null
             and n.entity = 'thread'
             and private.reads_thread(n.user_id, n.entity_id))
  from claimed c;
$$;

revoke execute on function public.claim_email_pings(integer) from public;
revoke execute on function public.claim_email_pings(integer) from anon;
revoke execute on function public.claim_email_pings(integer) from authenticated;
grant execute on function public.claim_email_pings(integer) to service_role;

comment on function public.claim_email_pings(integer) is
  'Claims due pings and returns each user''s CURRENT unread count. A count of 0 means the user already read everything in the portal — the drain clears pending with no send. attempts is NOT incremented here; it rises at exactly one point, in record_email_ping_outcome.';

-- ── RPC 2: record the outcome ───────────────────────────────────────
-- ⚠ Name every role on the revoke. `revoke execute … from public` does NOT
-- strip the explicit anon/authenticated EXECUTE grants pg_default_acl hands to
-- functions created by supabase_admin — which is the CLOUD path, so an
-- omission here leaves this callable by every logged-in parent in PRODUCTION
-- ONLY (20260728200000:229).
-- ★ `retryable` SEPARATES A PROVIDER PROBLEM FROM A RECIPIENT PROBLEM, and it
-- is what stops D28 from destroying the queue on day one (panel finding B5).
-- With every error class equal, a missing RESEND_API_KEY — the EXPECTED state
-- until IQRA's account exists — burned the ceiling in five ticks: 75 minutes
-- after deploy, every pending user is `failed`, the admin screen is a wall of
-- red, and each row needs an individual manual reset before the mechanism
-- works at all. The same shape hits Resend's 2 req/s free-tier limit against
-- 100 unpaced sends. A rate limit is the most retryable error there is.
--   retryable  → back off and try again, attempts UNCHANGED, never `failed`.
--                The row stays visible in oldest_pending_minutes, which is the
--                correct signal: "the drain runs but does not deliver".
--   permanent  → a fact about this recipient (bad address, 422). Burn one
--                attempt; at 5, stop and tell a human.
create or replace function public.record_email_ping_outcome(
  target uuid, succeeded boolean, error_code text default null,
  retryable boolean default false)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if succeeded then
    update private.email_pings p
       set -- ★ ONLY A REAL SEND STAMPS sent_at. The drain also calls this with
           -- succeeded = true on the SKIP path — the user already read
           -- everything in the portal, so there is nothing to send. Stamping
           -- sent_at there would record a delivery that never happened, in the
           -- one ledger the admin health screen reads. The skip passes
           -- error_code = 'SKIPPED' precisely so this line can tell them apart.
           sent_at    = case when error_code is null then now() else p.sent_at end,
           claimed_at = null,
           attempts   = 0,
           -- ★ THE WATERMARK TEST. If a message arrived while the send was in
           -- flight, queued_seq has moved past the claim and pending STAYS
           -- TRUE. Clearing it unconditionally is how the mid-send message
           -- gets swallowed.
           pending    = (p.queued_seq <> p.claimed_seq),
           last_error_code = null
     where p.user_id = target;
  elsif retryable then
    -- No attempts increment, no `failed`. Just try again later.
    update private.email_pings p
       set claimed_at      = null,
           next_attempt_at = now() + interval '5 minutes',
           last_error_code = error_code
     where p.user_id = target
       and p.claimed_at is not null;
  else
    update private.email_pings p
       set claimed_at      = null,
           -- ⛔ `least(…, 5)` IS NOT BELT-AND-BRACES — panel finding B4,
           -- MEASURED reaching 6 and aborting on email_pings_attempts_bound.
           -- The path is entirely internal: the RPC commits, its response is
           -- lost (socket reset, a duration-boundary abort, a gateway 5xx
           -- after commit), the drain's catch calls this a second time. One
           -- lost HTTP response would otherwise take out the whole remaining
           -- batch, because that throw escapes the loop and strands every row
           -- not yet recorded.
           attempts        = least(p.attempts + 1, 5),
           -- Exponential backoff: 2, 4, 8, 16, 32 minutes.
           next_attempt_at = now() + (interval '1 minute' * power(2, least(p.attempts + 1, 5))),
           failed          = (least(p.attempts + 1, 5) >= 5),
           last_error_code = error_code
     -- ★ AND ONLY A ROW THAT IS ACTUALLY CLAIMED. Without this, a late or
     -- duplicated outcome — the same lost-response path, or an operator
     -- re-invoking the route by curl — releases a claim another in-flight
     -- drain still believes it holds, opening a window for a second send.
     where p.user_id = target
       and p.claimed_at is not null;
  end if;
end;
$$;

revoke execute on function public.record_email_ping_outcome(uuid, boolean, text) from public;
revoke execute on function public.record_email_ping_outcome(uuid, boolean, text) from anon;
revoke execute on function public.record_email_ping_outcome(uuid, boolean, text) from authenticated;
grant execute on function public.record_email_ping_outcome(uuid, boolean, text) to service_role;

comment on function public.record_email_ping_outcome(uuid, boolean, text) is
  'The ONLY place attempts is incremented. On success, pending is cleared only if the watermark has not moved. On the 5th failure the row goes failed and stops — nothing retries forever and nothing is swallowed (D13). ⚠ Never set failed on a hard bounce: the webhook that would detect one is out of scope.';

-- ── RPC 3: resolve the address ──────────────────────────────────────
-- ★ THE ADDRESS IS NEVER COPIED INTO A public TABLE. It is read here, under
-- service_role, from auth.users, at send time, and discarded. A public mirror
-- would be a second source of truth for the one datum that decides where a
-- school's message about a child goes.
create or replace function public.resolve_ping_address(target uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select u.email::text
    from auth.users u
    join public.profiles pr on pr.id = u.id
   where u.id = target
     and pr.email_pings_enabled
     and u.deleted_at is null
     and u.banned_until is null;
$$;

revoke execute on function public.resolve_ping_address(uuid) from public;
revoke execute on function public.resolve_ping_address(uuid) from anon;
revoke execute on function public.resolve_ping_address(uuid) from authenticated;
grant execute on function public.resolve_ping_address(uuid) to service_role;

-- ── RPC 4: keep the queue consistent with the preference ────────────
-- ★ CALLER-SCOPED, so it is safe to grant to `authenticated` — unlike every
-- other function in this file. It keys on auth.uid() and takes no user
-- parameter, so it cannot be pointed at anybody else.
create or replace function public.sync_email_ping_preference(enabled boolean)
returns void
language sql volatile security definer set search_path = ''
as $$
  update private.email_pings p
     set pending    = case when enabled then p.pending else false end,
         claimed_at = case when enabled then p.claimed_at else null end,
         -- Opting back in clears the ceiling. Without this, `failed` survives
         -- the round trip and the claim excludes the row FOREVER: a live,
         -- opted-in user whose mail is silently dead.
         failed     = case when enabled then false else p.failed end,
         attempts   = case when enabled then 0 else p.attempts end,
         last_error_code = case when enabled then null else p.last_error_code end
   where p.user_id = (select auth.uid());
$$;

revoke execute on function public.sync_email_ping_preference(boolean) from public;
revoke execute on function public.sync_email_ping_preference(boolean) from anon;
grant execute on function public.sync_email_ping_preference(boolean) to authenticated;

comment on function public.sync_email_ping_preference(boolean) is
  'Keeps private.email_pings consistent with profiles.email_pings_enabled, in BOTH directions: opting out drops the queued ping (so it cannot age into a false «kom ikke fram» entry for someone who asked not to be mailed), and opting back in clears `failed`, which would otherwise exclude the row from every future claim forever. Caller-scoped via auth.uid(), which is why this one is authenticated-callable.';

comment on function public.resolve_ping_address(uuid) is
  'Resolves a recipient address at SEND TIME from auth.users, never from a public mirror. Re-checks email_pings_enabled so a user who opts out between fan-out and drain is not sent to, and refuses deleted or banned accounts.';
```

- [ ] **Step 2: Extend file 38 with the queue's assertions**

In `supabase/tests/38_notifications_rls.sql` change `select plan(15);` to `select plan(27);` (12 new assertions, counted by hand) and append before `select * from finish();`:

```sql
-- ── 11. the three RPCs are reachable by service_role and NOBODY else ─
-- ★ Naming each role individually is not belt-and-braces. In CLOUD,
-- pg_default_acl grants EXECUTE on supabase_admin-created public functions to
-- anon and authenticated explicitly, and `revoke … from public` does not strip
-- an explicit grant. A local-only test of `from public` would pass while
-- production shipped a parent-callable claim.
reset role;

-- ⛔ THE LIST IS EXHAUSTIVE AND MUST STAY THAT WAY. There is no global "no
-- public function is authenticated-callable" wall in this suite — every such
-- assertion is per-function (27_login_rate_limit.sql:38-48,
-- 10_admin_lookup.sql:15-18). An earlier draft named three names while the
-- plan went on to add three more in Task 13, so email_ping_health,
-- reset_failed_ping and failed_email_pings had NO grant assertion anywhere.
-- A later migration re-creating any of them without repeating the revokes
-- brings it back authenticated-callable IN CLOUD ONLY, and reset_failed_ping
-- MUTATES STATE — any parent could re-queue arbitrary families' mail.
select is(
  (select count(*)::int
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('claim_email_pings', 'record_email_ping_outcome',
                        'resolve_ping_address', 'email_ping_health',
                        'reset_failed_ping', 'failed_email_pings')
      and (has_function_privilege('authenticated', p.oid, 'EXECUTE')
        or has_function_privilege('anon', p.oid, 'EXECUTE'))),
  0, 'ingen av de seks drift-RPC-ene er kallbare for anon eller authenticated');

select is(
  (select count(*)::int
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('claim_email_pings', 'record_email_ping_outcome',
                        'resolve_ping_address', 'email_ping_health',
                        'reset_failed_ping', 'failed_email_pings')
      and has_function_privilege('service_role', p.oid, 'EXECUTE')),
  6, 'og alle seks er kallbare for service_role');

-- ★ The ONE deliberate exception, asserted so it reads as a decision rather
-- than an oversight. sync_email_ping_preference is caller-scoped — it keys on
-- auth.uid() and takes no user parameter — so it cannot be pointed at anyone
-- else, which is why it is the only authenticated-callable function here.
select is(
  (select has_function_privilege('authenticated',
            'public.sync_email_ping_preference(boolean)', 'EXECUTE')),
  true, 'sync_email_ping_preference ER kallbar for authenticated — den er caller-scoped');

select is(
  (select count(*)::int from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'sync_email_ping_preference'
      and p.prosrc like '%auth.uid()%'),
  1, 'og den henter brukeren fra auth.uid(), ikke fra en parameter');

-- ── 12. the claim skips a row that is not due ───────────────────────
insert into private.email_pings (user_id, pending, queued_seq, next_attempt_at)
values ('c1000000-0000-0000-0000-000000000001', true, 1, now() + interval '1 hour');

select is(
  (select count(*)::int from public.claim_email_pings()),
  0, 'en ping med next_attempt_at i framtida blir ikke plukket');

-- ── 13. a due row is claimed, stamped, and carries its unread count ──
update private.email_pings set next_attempt_at = now() - interval '1 minute'
 where user_id = 'c1000000-0000-0000-0000-000000000001';

-- ⚠ Assertion 7 marked this user's only notification READ, so without the line
-- below the count here is 0 and the assertion fails for a reason that has
-- nothing to do with the claim. Make the fixture say what the assertion means.
update public.notifications set read_at = null
 where user_id = 'c1000000-0000-0000-0000-000000000001';

select is(
  (select unread_count from public.claim_email_pings()
    where user_id = 'c1000000-0000-0000-0000-000000000001'),
  1, 'claim returnerer brukerens faktiske antall uleste');

select is(
  (select (claimed_at is not null and claimed_seq = queued_seq)
     from private.email_pings where user_id = 'c1000000-0000-0000-0000-000000000001'),
  true, 'claimed_at og vannmerket settes i samme setning');

-- ── 14. a claimed row is invisible to the next drain ────────────────
select is(
  (select count(*)::int from public.claim_email_pings()),
  0, 'en allerede claimet rad plukkes ikke to ganger');

-- ── 15. ★ attempts does NOT rise at claim time ──────────────────────
-- The 2026-08-04-b defect: the counter rose in both places, so the real
-- ceiling was 2-3 sends rather than 5.
select is(
  (select attempts from private.email_pings where user_id = 'c1000000-0000-0000-0000-000000000001'),
  0, 'claim øker ikke attempts — den stiger på nøyaktig ett punkt');

-- ── 16. ★ the watermark: a message mid-send is not swallowed ────────
update private.email_pings set queued_seq = queued_seq + 1
 where user_id = 'c1000000-0000-0000-0000-000000000001';
select public.record_email_ping_outcome('c1000000-0000-0000-0000-000000000001', true);

select is(
  (select pending from private.email_pings where user_id = 'c1000000-0000-0000-0000-000000000001'),
  true, 'meldingen som kom mens sendingen pågikk holder pending = true');

-- And the ordinary case: nothing arrived, so pending clears.
update private.email_pings set claimed_seq = queued_seq, claimed_at = now()
 where user_id = 'c1000000-0000-0000-0000-000000000001';
select public.record_email_ping_outcome('c1000000-0000-0000-0000-000000000001', true);
select is(
  (select pending from private.email_pings where user_id = 'c1000000-0000-0000-0000-000000000001'),
  false, 'uten nye meldinger klareres pending');

-- ── 17. failure backs off, and the fifth stops for good ─────────────
update private.email_pings set pending = true, attempts = 4, failed = false
 where user_id = 'c1000000-0000-0000-0000-000000000001';
select public.record_email_ping_outcome('c1000000-0000-0000-0000-000000000001', false, '535');

select is(
  (select (failed and attempts = 5 and last_error_code = '535')
     from private.email_pings where user_id = 'c1000000-0000-0000-0000-000000000001'),
  true, 'femte forsøk gir failed med en feilkode — ingenting prøver i det uendelige');

select is(
  (select count(*)::int from public.claim_email_pings()),
  0, 'og en failed rad plukkes aldri igjen');

-- ── 18. opting out makes the address unresolvable ───────────────────
update public.profiles set email_pings_enabled = false
 where id = 'c1000000-0000-0000-0000-000000000001';
select is(
  public.resolve_ping_address('c1000000-0000-0000-0000-000000000001'),
  null, 'en bruker som har slått av e-postvarsel har ingen adresse å sende til');
```

- [ ] **Step 3: Run and watch it fail**

```bash
cd ~/dev/iqra-portal && npx supabase test db --file supabase/tests/38_notifications_rls.sql 2>&1 | tail -20
```

Expected: FAIL — `relation "private.email_pings" does not exist`.

- [ ] **Step 4: Apply and re-run**

```bash
cd ~/dev/iqra-portal && npx supabase db reset && npx supabase test db 2>&1 | tail -5
```

Expected: `Files=39, Tests=871, PASS`.

- [ ] **Step 5: Watch the two assertions that carry the real defects fail**

Two named mutations, run one at a time — reset and restore between them:

1. In `claim_email_pings`, add `attempts = p.attempts + 1,` to the update. Expected: assertion 15 **FAILS**.
2. In `record_email_ping_outcome`, change `pending = (p.queued_seq <> p.claimed_seq)` to `pending = false`. Expected: assertion 16's first half **FAILS**.

Both are the exact defects the review found in earlier drafts of this mechanism. Restore and confirm green.

- [ ] **Step 6: Commit**

```bash
cd ~/dev/iqra-portal && git add supabase/migrations/20260807122000_email_pings.sql supabase/tests/38_notifications_rls.sql && git commit -m "feat(varsler): one permanent ping row per user, and three RPCs behind it

D22's shape: coalescing comes from the row being singular, not from a partial
index — which is also what makes retry representable, since a failed row has
nothing to collide with. attempts rises at exactly one point. The watermark
keeps a message that arrives mid-send from being swallowed, and that is
asserted rather than argued.

pgTAP 859 -> 871."
```

---

## Task 4: The message fan-out — calling the predicate, never restating it

**Files:**
- Create: `supabase/migrations/20260807123000_thread_fanout.sql`
- Modify: `supabase/tests/38_notifications_rls.sql` (`plan(27)` → `plan(41)`)

⛔ **D21 is the whole content of this task.** The spec's earlier draft hand-copied the recipient rule as «`teaches_student` ∪ guardians ∪ pupil-login, minus the sender» — and **it had already drifted from the wall in two places**: it pinged teachers a `kontor` thread excludes (telling them an office conversation about their pupil exists), and it pinged no admin ever. A restatement here is the defect, not the style. This function builds a **candidate set** and then filters every candidate through `private.reads_thread`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260807123000_thread_fanout.sql`:

```sql
-- The message fan-out (D21, spec §5.1).
--
-- ⛔ THE RULE: BUILD A CANDIDATE SET, THEN CALL private.reads_thread ON EACH.
-- Never restate the wall. The spec's first draft restated it and had already
-- drifted in two directions — it pinged teachers that a 'kontor' thread
-- excludes (disclosing that an office conversation about their pupil exists)
-- and it pinged no admin ever. The candidate set below is allowed to be too
-- WIDE, because the predicate narrows it; it must never be too NARROW, because
-- nothing widens it back.
--
-- ★ WHY ADMINS ARE NOT SIMPLY CANDIDATES. reads_thread admits every admin, to
-- every thread, by disclosed oversight (§4.1). Fanning that out would mail the
-- whole admin roster on every message in the school. So admins are added only
-- for the two reasons D21 names:
--   · the admin who IS the thread's staff_id — they are the counterpart, and
--     a 'kontor' thread has no other staff reader;
--   · EVERY admin when the thread has no staff reader other than bare
--     oversight — the rollover case, where the teacher has left and a family's
--     message would otherwise reach nobody.
-- ⚠ «no staff reader OTHER THAN bare oversight», never «no staff reader at
-- all». The literal form is never true, because oversight makes every admin a
-- reader of every thread, so the clause would silently never fire. I wrote it
-- the wrong way round first (D21's own ledger records it).

create or replace function private.thread_recipients(tid uuid)
returns table (recipient uuid)
language sql stable security definer set search_path = ''
as $$
  with t as (
    select th.id, th.student_id, th.kind, th.staff_id
      from public.threads th where th.id = tid
  ),
  -- Candidates, deliberately wide. Each is filtered by reads_thread below.
  family as (
    select gs.guardian_id as uid from public.guardian_student gs join t on true
     where gs.student_id = t.student_id
    union
    select s.student_user_id from public.students s join t on true
     where s.id = t.student_id and s.student_user_id is not null
  ),
  teachers as (
    -- The LIVE teaching relationship (D4). Note `cs.left_on is null`: this is
    -- the house's live spelling, matching private.teaches_student. It is NOT
    -- the as-of interval — a thread is a conversation happening now, not a
    -- record resolved against a publication instant.
    --
    -- ⛔⛔ `t.kind = 'laerer'` IS LOAD-BEARING AND IT IS NOT REDUNDANT WITH THE
    -- FILTER BELOW. Panel finding C-F1, measured on the live stack.
    -- private.reads_thread_row's FIRST arm is a bare private.has_role(uid,
    -- 'admin') (20260805123000:49). So the `where private.reads_thread(…)`
    -- filter admits a candidate for ANY reason — it cannot tell "reads because
    -- they teach" from "reads because they are an admin". A person holding
    -- teacher+admin — a TEACHING REKTOR, which 20260805120000:22-26 says is a
    -- real person at this school, not a hypothetical — therefore enters this
    -- CTE as a teacher and survives the filter as an admin.
    -- Two things then go wrong at once, and they are the two the design exists
    -- to prevent:
    --   1. On a 'kontor' thread they are notified AND MAILED that an office
    --      conversation about their own pupil exists. That is the family's
    --      complaint reaching the teacher it may be about.
    --   2. They also land in staff_substantive, so `not exists (…)` is false
    --      and the rollover fallback NEVER FIRES — the only other admin gets
    --      nothing, and the message reaches exactly the wrong person and
    --      nobody else.
    -- `kind` is precisely what decides whether teachers read at all: both
    -- teacher arms of reads_thread_row are kind = 'laerer'-gated. This clause
    -- is NARROWING-ONLY, so it cannot admit anyone the wall would refuse.
    select ct.teacher_id as uid
      from public.class_teachers ct
      join public.class_students cs on cs.class_id = ct.class_id
      join t on t.student_id = cs.student_id
     where cs.left_on is null
       and t.kind = 'laerer'
  ),
  named_staff as (select t.staff_id as uid from t),
  -- ⚠ NOT "everyone who reads for a substantive reason" — an earlier draft
  -- said that and it was FALSE, for the reason spelled out in `teachers`.
  -- This is: every CANDIDATE the wall admits. What makes the set substantive
  -- is how the candidate arms are built, not this filter.
  substantive as (
    select c.uid
      from (select uid from family
            union select uid from teachers
            union select uid from named_staff) c
     where private.reads_thread(c.uid, tid)
  ),
  -- The staff half of that set. If it is EMPTY, nobody on the school's side
  -- can see the family's message, and the fallback below fires.
  staff_substantive as (
    select s.uid from substantive s
     where s.uid in (select uid from teachers)
        or s.uid in (select uid from named_staff)
  )
  select uid from substantive
  union
  select ur.user_id
    from public.user_roles ur
   where ur.role = 'admin'
     and not exists (select 1 from staff_substantive)
     and private.reads_thread(ur.user_id, tid);
$$;

revoke execute on function private.thread_recipients(uuid) from public;

comment on function private.thread_recipients(uuid) is
  'D21. A WIDE candidate set narrowed by CALLING private.reads_thread on each member — never a restatement of the wall. Admins are excluded by default (bare oversight would mail the whole roster on every message) and re-admitted only as the thread''s own staff_id, or wholesale when no staff reader other than bare oversight remains.';

-- ── the trigger ─────────────────────────────────────────────────────
-- ★ The upsert is what makes a ten-message thread ONE bell entry (D25):
-- created_at moves forward and read_at clears, so an already-read conversation
-- becomes unread again when something new arrives.
--
-- ★ THE RECIPIENT SET IS RESOLVED EXACTLY ONCE (panel finding B9, measured).
-- An earlier draft called thread_recipients() twice — once per insert. Those
-- are two statements inside a VOLATILE plpgsql function, so under READ
-- COMMITTED each takes a FRESH SNAPSHOT, and the lens measured the two calls
-- returning different counts with a concurrent commit between them (2, then
-- 3). The sets diverging means a ping queued for someone with no bell entry —
-- mailed a count that does not include the thread — or the mirror. Resolving
-- into an array once also halves the reads_thread cost on the phase's hottest
-- write.
--
-- ⛔ THE PING WRITE MUST NEVER ABORT THE MESSAGE (panel finding B10). This
-- trigger runs inside the teacher's INSERT transaction, so before the
-- exception block below, ANY failure of the queue write — a lock-wait, a
-- statement timeout, a deadlock between two concurrent messages with
-- overlapping recipients, a constraint violation — ROLLED BACK THE MESSAGE.
-- The architecture says the in-app varsel is the source of truth and the mail
-- is a content-free nicety; the schema was giving the nicety a veto over the
-- source of truth, and the symptom is «sending a message stops working».
-- The notifications insert is deliberately NOT wrapped: that one IS the source
-- of truth, and a message nobody is told about is worth failing for.
--
-- ⛔ PUPILS ARE NEVER MAILED (user decision, 2026-08-05; panel finding D-5).
-- A 'laerer' thread admits the pupil's own login, pupil accounts are real auth
-- users with real addresses, and email_pings_enabled defaults true — so
-- without this clause a 13-year-old is e-mailed about parent–teacher exchanges
-- concerning themselves, and their address goes into Resend's US-held logs
-- (databehandleravtale-iqra.md:150). «Ingen alarmstrøm til barn» was enforced
-- in the bell and nowhere else. They still get the varsel; only the mail stops.
create or replace function private.fan_out_thread_message()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  recipients uuid[];
begin
  select array_agg(r.recipient)
    into recipients
    from private.thread_recipients(new.thread_id) r
   where r.recipient <> new.sender_id;

  if recipients is null then
    return null;
  end if;

  insert into public.notifications (user_id, entity, entity_id)
  select u, 'thread', new.thread_id
    from unnest(recipients) u
  on conflict (user_id, entity, entity_id)
    do update set created_at = now(), read_at = null;

  begin
    insert into private.email_pings (user_id, pending, queued_seq)
    select u, true, 1
      from unnest(recipients) u
      join public.profiles p on p.id = u
     where p.email_pings_enabled
       -- The pupil's own login is not a mail recipient. Keyed on the
       -- relationship (students.student_user_id), never on a role.
       and not exists (
         select 1 from public.students s where s.student_user_id = u
       )
    on conflict (user_id)
      do update set pending    = true,
                    queued_seq = private.email_pings.queued_seq + 1;
  exception
    -- ⚠ A BARE `when others` IS DELIBERATE HERE and it is the only one in this
    -- plan. Every failure mode of the queue write is a reason to skip the
    -- ping, never a reason to lose the message. It is logged as a WARNING so
    -- the failure is visible in the Postgres log rather than silent — the
    -- house rule is "never swallow an exception", and this is the exception to
    -- it, so it says why in the code and it still leaves a trace.
    -- ⛔ Note this block wraps ONLY the email_pings insert. Widening it to
    -- cover the notifications insert would turn a message nobody is told about
    -- into a silent success.
    when others then
      raise warning '[fan_out] e-postping kunne ikke køes for tråd %: % (%)',
        new.thread_id, sqlerrm, sqlstate;
  end;

  return null;
end;
$$;

revoke execute on function private.fan_out_thread_message() from public;

-- AFTER, because the message must exist before anyone is told about it, and
-- FOR EACH ROW because the recipient set depends on the thread.
create trigger messages_fan_out
  after insert on public.messages
  for each row execute function private.fan_out_thread_message();
```

- [ ] **Step 2: Extend file 38**

Change `select plan(27);` to `select plan(41);` (14 new assertions, counted by hand). Append before `select * from finish();`:

```sql
-- ── 19-25. the fan-out, over a real thread with a real family ───────
-- ★ THE INVARIANT THIS SECTION EXISTS FOR (spec §8 T-12): no notifications row
-- may exist whose (user_id, entity_id) pair fails the corresponding read
-- predicate. A ping to someone who cannot open the thing is both a leak signal
-- and a dead end.
reset role;

delete from public.notifications;
delete from private.email_pings;
delete from public.messages;
delete from public.threads;
-- ⛔ THESE THREE ARE NOT OPTIONAL AND ARE NOT ABOUT THIS FILE'S SUBJECT.
-- assignments.class_id (20260728092000:27) and announcements.class_id are the
-- two ON DELETE RESTRICT edges on the path to classes, and seed.sql:258 seeds
-- assignments on the seeded class. Without these, `delete from public.classes`
-- raises 23503 and ABORTS THE WHOLE TRANSACTION — taking the 27 assertions
-- from Tasks 1–3 that were already green. File 37:25-31 states this verbatim
-- and file 35:23 carries the same line. (announcement_reads/announcements are
-- latent today, since the seed creates none; 37 includes them anyway because a
-- seeded one later would abort this file and 22 others.)
delete from public.announcement_reads;
delete from public.announcements;
delete from public.assignments;
delete from public.class_students;
delete from public.class_teachers;
delete from public.guardian_student;
delete from public.students;
delete from public.classes;
delete from public.terms;

insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.email, '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
from (values
  ('c1000000-0000-0000-0000-000000000011'::uuid, 'c1-laerer@test.no'),
  ('c1000000-0000-0000-0000-000000000012'::uuid, 'c1-forelder@test.no'),
  ('c1000000-0000-0000-0000-000000000013'::uuid, 'c1-admin@test.no'),
  ('c1000000-0000-0000-0000-000000000014'::uuid, 'c1-fremmed@test.no')
) as u(id, email)
on conflict (id) do nothing;

insert into public.profiles (id, full_name) values
  ('c1000000-0000-0000-0000-000000000011', 'C1 Lærer'),
  ('c1000000-0000-0000-0000-000000000012', 'C1 Forelder'),
  ('c1000000-0000-0000-0000-000000000013', 'C1 Admin'),
  ('c1000000-0000-0000-0000-000000000014', 'C1 Fremmed')
on conflict (id) do nothing;

insert into public.user_roles (user_id, role) values
  ('c1000000-0000-0000-0000-000000000011', 'teacher'),
  ('c1000000-0000-0000-0000-000000000012', 'parent'),
  ('c1000000-0000-0000-0000-000000000013', 'admin'),
  ('c1000000-0000-0000-0000-000000000014', 'teacher')
on conflict do nothing;

insert into public.terms (id, name, starts_on, ends_on, is_current)
values ('c1000000-0000-0000-0000-0000000000e1', 'C1-termin',
        current_date - 30, current_date + 60, false);
insert into public.classes (id, term_id, name)
values ('c1000000-0000-0000-0000-0000000000c1', 'c1000000-0000-0000-0000-0000000000e1', 'C1-klasse');
-- ⚠ birth_year is `not null` with NO DEFAULT (20260717164230:15). Omitting it
-- is 23502 and the transaction aborts before assertion 19 runs.
insert into public.students (id, first_name, last_name, birth_year, status)
values ('c1000000-0000-0000-0000-0000000000d1', 'C1', 'Elev', 2014, 'active');
insert into public.class_students (class_id, student_id, enrolled_on)
values ('c1000000-0000-0000-0000-0000000000c1', 'c1000000-0000-0000-0000-0000000000d1', current_date - 20);
insert into public.class_teachers (class_id, teacher_id)
values ('c1000000-0000-0000-0000-0000000000c1', 'c1000000-0000-0000-0000-000000000011');
insert into public.guardian_student (guardian_id, student_id)
values ('c1000000-0000-0000-0000-000000000012', 'c1000000-0000-0000-0000-0000000000d1');

insert into public.threads (id, student_id, staff_id, kind, subject, created_by)
values ('c1000000-0000-0000-0000-0000000000b1', 'c1000000-0000-0000-0000-0000000000d1',
        'c1000000-0000-0000-0000-000000000011', 'laerer', 'C1-tråd',
        'c1000000-0000-0000-0000-000000000011');

-- The teacher writes. The parent should be told; the teacher should not.
insert into public.messages (thread_id, sender_id, body)
values ('c1000000-0000-0000-0000-0000000000b1', 'c1000000-0000-0000-0000-000000000011', 'Hei');

select is(
  (select count(*)::int from public.notifications
    where entity_id = 'c1000000-0000-0000-0000-0000000000b1'),
  1, 'læreren skriver: nøyaktig én mottaker varsles');

-- ⛔ array_agg, NOT a scalar subquery. Under mutation 3 (remove the
-- sender-exclusion) this returns TWO rows, and a scalar subquery then raises
-- 21000 «more than one row returned by a subquery used as an expression» —
-- which is not a red assertion, it ABORTS THE TRANSACTION. The mutation that
-- matters most in this section would have read as a broken file rather than as
-- a caught defect. File 37 documents this exact trap.
select is(
  (select array_agg(user_id order by user_id) from public.notifications
    where entity_id = 'c1000000-0000-0000-0000-0000000000b1'),
  array['c1000000-0000-0000-0000-000000000012'::uuid], 'og det er forelderen');

select is(
  (select count(*)::int from public.notifications
    where user_id = 'c1000000-0000-0000-0000-000000000011'),
  0, 'avsenderen varsles aldri om sin egen melding');

-- ★ The admin is a reader of this thread by oversight, and is NOT pinged.
select is(
  (select count(*)::int from public.notifications
    where user_id = 'c1000000-0000-0000-0000-000000000013'),
  0, 'bar oversikt utløser ikke varsel — ellers får hele admin-rosteret post om hver melding');

-- Control over the IDENTICAL thread: the admin really can read it, so
-- assertion 22 is about the fan-out and not about a missing relationship.
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1000000-0000-0000-0000-000000000013","role":"authenticated"}';
select is(
  (select count(*)::int from public.threads where id = 'c1000000-0000-0000-0000-0000000000b1'),
  1, 'kontroll: admin leser tråden — varselet mangler ved regel, ikke ved manglende tilgang');
reset role;

-- ── 24. ★ D25: ten messages, one bell entry ─────────────────────────
insert into public.messages (thread_id, sender_id, body)
select 'c1000000-0000-0000-0000-0000000000b1', 'c1000000-0000-0000-0000-000000000011',
       'Melding ' || g
  from generate_series(1, 9) g;

select is(
  (select count(*)::int from public.notifications
    where entity_id = 'c1000000-0000-0000-0000-0000000000b1'),
  1, 'ti meldinger gir ett varsel — det er raden som koalescerer, ikke en indeks');

select is(
  (select queued_seq from private.email_pings
    where user_id = 'c1000000-0000-0000-0000-000000000012'),
  10, 'men vannmerket har talt alle ti');

-- ── 25. an unrelated teacher is never a recipient ───────────────────
select is(
  (select count(*)::int from public.notifications
    where user_id = 'c1000000-0000-0000-0000-000000000014'),
  0, 'en lærer uten undervisningsforhold til eleven varsles ikke');

-- ── 26. ★ the 'kontor' wall: the pupil's teachers are NOT told ──────
-- This is one of the two drifts the spec's hand-written recipient list had.
insert into public.threads (id, student_id, staff_id, kind, subject, created_by)
values ('c1000000-0000-0000-0000-0000000000b2', 'c1000000-0000-0000-0000-0000000000d1',
        'c1000000-0000-0000-0000-000000000013', 'kontor', 'C1-kontor',
        'c1000000-0000-0000-0000-000000000012');
insert into public.messages (thread_id, sender_id, body)
values ('c1000000-0000-0000-0000-0000000000b2', 'c1000000-0000-0000-0000-000000000012', 'Klage');

select is(
  (select count(*)::int from public.notifications
    where entity_id = 'c1000000-0000-0000-0000-0000000000b2'
      and user_id = 'c1000000-0000-0000-0000-000000000011'),
  0, 'kontortråd: elevens lærer får ikke vite at samtalen finnes');

select is(
  (select count(*)::int from public.notifications
    where entity_id = 'c1000000-0000-0000-0000-0000000000b2'
      and user_id = 'c1000000-0000-0000-0000-000000000013'),
  1, 'men admin som er trådens staff_id varsles — hen er motparten');

-- ── 26b. ★★ THE TEACHING REKTOR — panel finding C-F1 ────────────────
-- ⛔ ASSERTION 26 ABOVE IS STRUCTURALLY BLIND TO THIS. Its teacher holds only
-- `teacher`, so it cannot see that reads_thread_row's FIRST arm is a bare
-- has_role(uid,'admin'). Give 011 the admin role too — 20260805120000:22-26
-- says a person who both teaches and administers is real here — and without
-- `t.kind = 'laerer'` on the teachers CTE they enter as a teacher, survive the
-- filter as an admin, and are told an office thread about their own pupil
-- exists. This is the assertion that actually guards the rule.
insert into public.user_roles (user_id, role)
values ('c1000000-0000-0000-0000-000000000011', 'admin')
on conflict do nothing;

delete from public.notifications where entity_id = 'c1000000-0000-0000-0000-0000000000b2';
insert into public.messages (thread_id, sender_id, body)
values ('c1000000-0000-0000-0000-0000000000b2', 'c1000000-0000-0000-0000-000000000012', 'Klage 2');

select is(
  (select count(*)::int from public.notifications
    where entity_id = 'c1000000-0000-0000-0000-0000000000b2'
      and user_id = 'c1000000-0000-0000-0000-000000000011'),
  0, 'kontortråd: en lærer som OGSÅ er admin får fortsatt ikke vite at samtalen finnes');

-- The control: they genuinely read the thread, so assertion 26b is about the
-- fan-out rule and not about a missing relationship.
select is(
  private.reads_thread('c1000000-0000-0000-0000-000000000011',
                       'c1000000-0000-0000-0000-0000000000b2'),
  true, 'kontroll: den undervisende rektoren KAN lese tråden — varselet mangler ved regel');

-- ★ And the second half of C-F1: they must not suppress the fallback either.
select is(
  (select count(*)::int from public.notifications
    where entity_id = 'c1000000-0000-0000-0000-0000000000b2'
      and user_id = 'c1000000-0000-0000-0000-000000000013'),
  1, 'og motparten varsles fortsatt — rektoren fyller ikke staff_substantive');

delete from public.user_roles
 where user_id = 'c1000000-0000-0000-0000-000000000011' and role = 'admin';

-- ── 26c. ★ PUPILS GET THE VARSEL, NEVER THE MAIL ────────────────────
-- User decision 2026-08-05 (panel finding D-5). A 'laerer' thread admits the
-- pupil's own login; without the carve-out they are e-mailed about their own
-- parent–teacher exchanges and their address reaches a US-held provider log.
update public.students set student_user_id = 'c1000000-0000-0000-0000-000000000014'
 where id = 'c1000000-0000-0000-0000-0000000000d1';
delete from private.email_pings;
delete from public.notifications where entity_id = 'c1000000-0000-0000-0000-0000000000b1';

insert into public.messages (thread_id, sender_id, body)
values ('c1000000-0000-0000-0000-0000000000b1', 'c1000000-0000-0000-0000-000000000012', 'Til eleven');

select is(
  (select count(*)::int from public.notifications
    where entity_id = 'c1000000-0000-0000-0000-0000000000b1'
      and user_id = 'c1000000-0000-0000-0000-000000000014'),
  1, 'eleven får varselet i appen — «ingen alarmstrøm» gjelder utformingen, ikke tilgangen');

select is(
  (select count(*)::int from private.email_pings
    where user_id = 'c1000000-0000-0000-0000-000000000014'),
  0, 'men eleven køes aldri for e-post — adressen når aldri Resend');

-- The control over the IDENTICAL message: an adult recipient IS queued, so the
-- assertion above is about the pupil carve-out and not about a dead mail path.
select is(
  (select count(*)::int from private.email_pings
    where user_id = 'c1000000-0000-0000-0000-000000000011'),
  1, 'kontroll: den voksne mottakeren av samme melding køes');

update public.students set student_user_id = null
 where id = 'c1000000-0000-0000-0000-0000000000d1';

-- ── 27. ★ the rollover fallback ─────────────────────────────────────
-- The teacher leaves. The family writes. With no staff reader other than bare
-- oversight, EVERY admin is admitted — otherwise the message reaches nobody.
delete from public.class_teachers
 where class_id = 'c1000000-0000-0000-0000-0000000000c1';

-- ⛔ NO `delete from public.notifications` HERE. An earlier draft wiped the
-- table one line after removing the teaching relationship, which made the T-12
-- invariant below scan exactly ONE row — everything the fan-out produced for
-- b1 and for the kontor thread b2 was already gone — while its comment claimed
-- «a scan over EVERY notification row this file produced». Worse, it deleted
-- precisely the rows that the relationship change had just made STALE, which
-- is the one failure mode the invariant exists to observe. Scope the counts by
-- entity_id instead, and let the rows accumulate.
insert into public.messages (thread_id, sender_id, body)
values ('c1000000-0000-0000-0000-0000000000b1', 'c1000000-0000-0000-0000-000000000012', 'Er du der?');

select is(
  (select count(*)::int from public.notifications
    where entity_id = 'c1000000-0000-0000-0000-0000000000b1'
      and user_id = 'c1000000-0000-0000-0000-000000000013'),
  1, 'uten gjenværende ansatt-leser varsles admin likevel — meldingen når noen');

-- ── 28. ★ THE INVARIANT (T-12), stated as a query ───────────────────
-- Not an example: a scan over EVERY notification row this file produced.
select is(
  (select count(*)::int from public.notifications n
    where n.entity = 'thread'
      and not private.reads_thread(n.user_id, n.entity_id)),
  0, 'invariant: ingen varsler om en tråd mottakeren ikke kan åpne');

-- ── 29. opting out stops the MAIL and not the varsel ────────────────
update public.profiles set email_pings_enabled = false
 where id = 'c1000000-0000-0000-0000-000000000012';
delete from public.notifications;
delete from private.email_pings;

insert into public.messages (thread_id, sender_id, body)
values ('c1000000-0000-0000-0000-0000000000b1', 'c1000000-0000-0000-0000-000000000013', 'Fra admin');

select is(
  (select count(*)::int from public.notifications
    where user_id = 'c1000000-0000-0000-0000-000000000012'),
  1, 'avmelding stopper ikke varselet i appen — det er sannhetskilden');

select is(
  (select count(*)::int from private.email_pings
    where user_id = 'c1000000-0000-0000-0000-000000000012'),
  0, 'men ingen e-postping køes');
```

- [ ] **Step 3: Run and watch it fail**

```bash
cd ~/dev/iqra-portal && npx supabase test db --file supabase/tests/38_notifications_rls.sql 2>&1 | tail -20
```

Expected: FAIL — `function private.thread_recipients(uuid) does not exist`.

- [ ] **Step 4: Apply and re-run the whole suite**

```bash
cd ~/dev/iqra-portal && npx supabase db reset && npx supabase test db 2>&1 | tail -5
```

Expected: `Files=39, Tests=885, PASS`.

- [ ] **Step 5: Three named mutations — run one at a time, reset between**

1. Delete the `and private.reads_thread(c.uid, tid)` filter from `substantive`. Expected: assertion 26 (`kontor`: the teacher is not told) **FAILS** — the drift the spec's hand-written list actually had.
2. ★ **Delete `and t.kind = 'laerer'` from the `teachers` CTE.** Expected: assertion **26b FAILS** (the teaching rektor is told about the office thread) **and 26b's third assertion FAILS** (the counterpart stops being notified, because the rektor now fills `staff_substantive` and suppresses the fallback). This is panel finding C-F1 and it is the most important mutation in this plan — two assertions, one line.
3. Change the admin fallback's `not exists (select 1 from staff_substantive)` to `not exists (select 1 from substantive)`. Expected: assertion 27 **FAILS** — the «no staff reader at all» wording that can never fire.
4. Remove the `where r.recipient <> new.sender_id` clause from the array_agg. Expected: assertion 21 (`og det er forelderen`) **FAILS** with a two-element array. ⚠ It must **fail**, not abort — if you see `21000: more than one row returned by a subquery`, the assertion was left as a scalar subquery and the mutation is telling you nothing.
5. ★ Delete the `not exists (select 1 from public.students s where s.student_user_id = u)` clause. Expected: assertion **26c's second FAILS** — the pupil is queued for mail.
6. Delete the `exception when others` block around the `email_pings` insert, then force a failure inside it (temporarily add `insert into private.email_pings (user_id, pending, queued_seq) values (gen_random_uuid(), true, 1);` before it, which violates the FK). Expected: **the message INSERT itself fails** — which is the veto B10 describes. With the block restored, the message lands and only a WARNING is logged.

Restore after each and confirm green. Record all six results in the commit body — and per §8's binding rule, state any you skipped and why, rather than letting silence read as coverage.

- [ ] **Step 6: Commit**

```bash
cd ~/dev/iqra-portal && git add supabase/migrations/20260807123000_thread_fanout.sql supabase/tests/38_notifications_rls.sql && git commit -m "feat(varsler): fan out a message by calling the wall, not by copying it

thread_recipients builds a deliberately wide candidate set and filters every
member through private.reads_thread. The spec's hand-written version had
already drifted twice — it pinged teachers a kontor thread excludes, and it
pinged no admin ever. Both drifts now have an assertion that goes red under the
mutation that reintroduces them.

Admins are excluded by default (bare oversight would mail the whole roster on
every message) and re-admitted only as the thread's staff_id or, wholesale,
when no staff reader other than oversight remains.

pgTAP 871 -> 885."
```

---

## Task 5: The announcement fan-out — one routine, two trigger points

**Files:**
- Create: `supabase/migrations/20260807124000_announcement_fanout.sql`
- Modify: `supabase/tests/38_notifications_rls.sql` (`plan(41)` → `plan(53)`)

⛔ `supabase/migrations/20260806122000_announcement_fanout_claim.sql` is **applied** — never edit it. `claim_due_announcements` is replaced here with `create or replace`, and its own header says exactly what must happen: *«Plan 3 must add its notification INSERT INSIDE THIS FUNCTION BODY … If the fan-out is a separate round trip, a crash between the two leaves an announcement marked as announced with no notifications, and the partial index will never serve it again.»*

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260807124000_announcement_fanout.sql`:

```sql
-- The announcement fan-out (D26, spec §5.1).
--
-- ★ ONE ROUTINE, TWO TRIGGER POINTS.
--   · published immediately  → an AFTER INSERT trigger, in the same transaction
--   · scheduled              → public.claim_due_announcements(), from the drain
-- Both call private.fan_out_announcement. There is no third copy of the rule.
--
-- ⛔ WHY A TRIGGER AND NOT A CALL FROM THE PUBLISH ACTION (D26). There are TWO
-- publish actions — laerer/oppslag/actions.ts and admin/oppslag/actions.ts — so
-- an action-level call must be added twice and can drift. A trigger cannot be
-- forgotten by a third publish path written later. It also runs INSIDE the
-- insert's transaction, so an announcement can never be committed without its
-- notifications; and claim_due_announcements is granted to service_role only,
-- so calling it from a teacher's action would need a grant to authenticated —
-- which would let any logged-in parent burn every pending fan-out in the
-- school with a single call.
--
-- private.stamp_announcement_fanout already sets fanned_out_at at INSERT when
-- published_at <= now(), so `new.fanned_out_at is not null` IS "published
-- immediately". Nothing new decides that question here.
--
-- ★ THE CANDIDATE SET IS THE WHOLE ROLE-HOLDING POPULATION, narrowed by
-- private.reads_announcement. One predicate call per account per announcement —
-- a few hundred, in a background statement, on the phase's rarest write.
--
-- ⛔ AND IT SUBTRACTS BARE OVERSIGHT, EXACTLY AS THE THREAD FAN-OUT DOES.
-- ⚠ VERIFIED 2026-08-05, and it is the opposite of what the spec assumed:
-- private.reads_announcement_row's SECOND clause is
-- `or private.has_role(uid, 'admin')` (20260806120000_announcements.sql:301, fn declared at :294), so an admin reads
-- EVERY announcement in the school. Filtering on the predicate alone would
-- therefore bell every admin on every class notice — at ten classes that is
-- ~ten a week nobody asked for, diluting the one surface D12 made
-- load-bearing. The spec said announcements had "no analogue of bare oversight
-- to subtract"; the tree says they do.
--
-- ★ THE CARVE-OUT KEYS ON THE RELATIONSHIP, NEVER ON THE ROLE — D24's lesson.
-- Asking "are you an admin?" would silence an admin who is ALSO a guardian in
-- that class, about their own child. So the clause below asks whether this
-- person has a relationship to THIS announcement: school-wide (addressed to
-- every adult at the school), or a live teaching relationship, or a family
-- bound as of publication.
--
-- ⚠ AND YES, THAT LIST RESTATES reads_announcement_row's non-admin arms. It is
-- a restatement in the NARROWING direction only: it is ANDed with the
-- predicate, which still decides admission, so drift here can only ever notify
-- FEWER people — never someone who cannot open the thing. That is a different
-- and much safer class of restatement than the thread case, where the spec's
-- hand-written copy drifted WIDER. Assertion 34's invariant still holds by
-- construction.

create or replace function private.fan_out_announcement(aid uuid, author uuid)
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  fanned integer;
begin
  -- ⛔ THE CANDIDATE SET IS THE ROLE HOLDERS **UNION THE ROSTER**, and the
  -- union is not belt-and-braces. Panel finding C-F3, measured: user_roles is
  -- NARROWER than the read predicate, because reads_announcement_row's family
  -- and pupil arms key on class_students/guardian_student and never consult
  -- user_roles at all. A guardian with a live enrolment and no user_roles row
  -- CAN READ both a class notice and a school-wide one — and was notified of
  -- neither. That is the forbidden direction: a candidate set may be too wide,
  -- never too narrow, because nothing widens it back. It is latent today only
  -- because the admin path grants `parent` before creating the link; roles are
  -- the one thing nothing currently revokes, and plan 4's offboarding starts
  -- revoking them. The failure is silent in the worst way — the notice is
  -- visible, so nobody reports a bug.
  insert into public.notifications (user_id, entity, entity_id)
  select distinct cand.user_id, 'announcement', aid
    from (
      select ur.user_id from public.user_roles ur
      union
      select gs.guardian_id from public.guardian_student gs
        join public.class_students cs on cs.student_id = gs.student_id
      union
      select s.student_user_id from public.students s
        join public.class_students cs on cs.student_id = s.id
       where s.student_user_id is not null
    ) cand
    cross join lateral (
      select a.class_id, a.published_at from public.announcements a where a.id = aid
    ) ann
   where cand.user_id <> author
     and private.reads_announcement(cand.user_id, aid)
     and (
       ann.class_id is null
       or private.teaches_class(cand.user_id, ann.class_id)
       or private.guardian_in_class_asof(cand.user_id, ann.class_id, ann.published_at)
       or private.student_in_class_asof(cand.user_id, ann.class_id, ann.published_at)
     )
  on conflict (user_id, entity, entity_id)
    do update set created_at = now(), read_at = null;
  get diagnostics fanned = row_count;
  return fanned;
end;
$$;

revoke execute on function private.fan_out_announcement(uuid, uuid) from public;

comment on function private.fan_out_announcement(uuid, uuid) is
  'D21/D26. The candidate set is every role-holding account, narrowed by CALLING private.reads_announcement. ⛔ It writes public.notifications ONLY — never private.email_pings. That is the decision that keeps this phase inside a free sending tier: one school-wide notice to ~300 guardians is three days of Resend''s 100/day in a single statement, and it would take the economy module''s invoice reminders down with it.';

-- ── trigger point 1: published immediately ──────────────────────────
create or replace function private.fan_out_new_announcement()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  -- Scheduled rows leave fanned_out_at NULL and belong to the drain.
  if new.fanned_out_at is not null then
    perform private.fan_out_announcement(new.id, new.created_by);
  end if;
  return null;
end;
$$;

revoke execute on function private.fan_out_new_announcement() from public;

create trigger announcements_fan_out
  after insert on public.announcements
  for each row execute function private.fan_out_new_announcement();

-- ── trigger point 2: the scheduled claim ────────────────────────────
-- ★ THE INSERT IS INSIDE THIS FUNCTION BODY, in the same statement as the
-- fanned_out_at stamp. A separate round trip would let a crash between the two
-- leave an announcement marked as announced with no notifications, and the
-- partial index would never serve it again.
--
-- ⚠ The OUT parameter names stay misnamed on purpose: a `returns table`
-- function's OUT names shadow column names inside its own body AND are
-- rendered into pg_get_functiondef's header, so an OUT parameter called
-- published_at would make the fingerprint marker 'b.published_at <= now()'
-- unfailable and shadow the column it reads.
create or replace function public.claim_due_announcements()
returns table (announcement_id uuid, audience_class_id uuid, publish_time timestamptz)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  claimed_row record;
begin
  -- ⛔ AN EXPLICIT LOOP, NOT A SIDE EFFECT IN A WHERE CLAUSE. The obvious
  -- spelling is `select … from claimed c where fan_out_announcement(…) >= 0`,
  -- and it is WRONG: a volatile function in a WHERE clause carries no
  -- guarantee of being evaluated exactly once per row. The planner may skip it
  -- for rows it can eliminate otherwise, or re-evaluate it — so an
  -- announcement could be stamped fanned_out_at with nobody notified, and the
  -- partial index would never serve it again. The stamp and the fan-out must
  -- both happen, once, per row.
  for claimed_row in
    with claimed as (
      update public.announcements a
         set fanned_out_at = now()
       where a.id in (
               select b.id
                 from public.announcements b
                where b.fanned_out_at is null
                  and b.published_at <= now()
                order by b.published_at
                  for update skip locked
             )
      returning a.id, a.class_id, a.published_at, a.created_by
    )
    select * from claimed
  loop
    perform private.fan_out_announcement(claimed_row.id, claimed_row.created_by);
    announcement_id   := claimed_row.id;
    audience_class_id := claimed_row.class_id;
    publish_time      := claimed_row.published_at;
    return next;
  end loop;
end;
$$;

revoke execute on function public.claim_due_announcements() from public;
revoke execute on function public.claim_due_announcements() from anon;
revoke execute on function public.claim_due_announcements() from authenticated;
grant execute on function public.claim_due_announcements() to service_role;
```

- [ ] **Step 2: Extend file 38**

Change `select plan(41);` to `select plan(53);` (12 new assertions, counted by hand). Append before `select * from finish();`:

```sql
-- ── 30-37. the announcement fan-out, both trigger points ────────────
reset role;
delete from public.notifications;
delete from public.announcement_reads;
delete from public.announcements;

-- Immediate publish by the teacher, to the class the parent's child is in.
-- ⚠ class_teachers was emptied by assertion 27, so restore it: the teacher
-- must be able to author here.
insert into public.class_teachers (class_id, teacher_id)
values ('c1000000-0000-0000-0000-0000000000c1', 'c1000000-0000-0000-0000-000000000011')
on conflict do nothing;

insert into public.announcements (id, class_id, title, body, created_by)
values ('c1000000-0000-0000-0000-0000000000a5', 'c1000000-0000-0000-0000-0000000000c1',
        'Gymtøy', 'Husk gymtøy i morgen', 'c1000000-0000-0000-0000-000000000011');

select is(
  (select (fanned_out_at is not null) from public.announcements
    where id = 'c1000000-0000-0000-0000-0000000000a5'),
  true, 'et oppslag publisert nå er stemplet ved INSERT');

-- ★ D26: the bell lights in the same transaction, not 15 minutes later.
select is(
  (select count(*)::int from public.notifications
    where entity_id = 'c1000000-0000-0000-0000-0000000000a5'
      and user_id = 'c1000000-0000-0000-0000-000000000012'),
  1, 'forelderen varsles med én gang — utløseren står i samme transaksjon');

select is(
  (select count(*)::int from public.notifications
    where entity_id = 'c1000000-0000-0000-0000-0000000000a5'
      and user_id = 'c1000000-0000-0000-0000-000000000011'),
  0, 'forfatteren varsles ikke om sitt eget oppslag');

-- ⛔ D12: announcements never touch the mail path, at any scope.
select is(
  (select count(*)::int from private.email_pings where pending),
  0, 'et oppslag køer ingen e-post — det er denne regelen som holder fasen innenfor gratisnivået');

-- ── 31. a scheduled oppslag notifies NOBODY until it is due ─────────
-- ⚠ created_at IS BACK-DATED A DAY, and it has to be. Assertion 32 moves
-- published_at into the past to make the row due — but
-- announcements_not_backdated (20260806120000:76) requires
-- published_at >= created_at, and the whole pgTAP file is ONE transaction, so
-- now() is transaction_timestamp() and a default created_at would be EXACTLY
-- now(). `published_at = now() - 1 minute` is then a guaranteed 23514 that
-- aborts the file. File 37 uses the same device («created_at is a WHOLE TEN
-- DAYS earlier than published_at»). created_at has no grant, so this insert is
-- possible only as the table owner — which is what this section already is.
insert into public.announcements (id, class_id, title, body, published_at, created_at, created_by)
values ('c1000000-0000-0000-0000-0000000000a6', 'c1000000-0000-0000-0000-0000000000c1',
        'Senere', 'Kommer senere', now() + interval '2 hours', now() - interval '1 day',
        'c1000000-0000-0000-0000-000000000011');

select is(
  (select count(*)::int from public.notifications
    where entity_id = 'c1000000-0000-0000-0000-0000000000a6'),
  0, 'et planlagt oppslag varsler ingen ennå — ellers finnes varselet før raden er lesbar');

select is(
  (select count(*)::int from public.claim_due_announcements()),
  0, 'og claimen plukker det ikke');

-- ── 32. when it falls due, the claim fans it out ────────────────────
-- published_at has no UPDATE grant, so move it as the owner.
update public.announcements set published_at = now() - interval '1 minute'
 where id = 'c1000000-0000-0000-0000-0000000000a6';

select is(
  (select count(*)::int from public.claim_due_announcements()),
  1, 'når tida er inne plukkes det ett oppslag');

select is(
  (select count(*)::int from public.notifications
    where entity_id = 'c1000000-0000-0000-0000-0000000000a6'
      and user_id = 'c1000000-0000-0000-0000-000000000012'),
  1, 'og forelderen varsles av claimen, ikke av utløseren');

-- ── 33. ★ idempotence: a second claim does nothing ──────────────────
select is(
  (select count(*)::int from public.claim_due_announcements()),
  0, 'claimen er idempotent — fanned_out_at er brent');

-- ── 35. ★ BARE OVERSIGHT IS SUBTRACTED HERE TOO ─────────────────────
-- reads_announcement_row's second clause is `or private.has_role(uid,'admin')`,
-- so an admin READS every class notice in the school. Belling them on each one
-- would dilute the surface D12 made load-bearing. The admin above is not a
-- guardian and does not teach this class, so they get nothing — while the
-- school-wide notice below reaches them, because that one IS addressed to them.
select is(
  (select count(*)::int from public.notifications
    where entity = 'announcement'
      and user_id = 'c1000000-0000-0000-0000-000000000013'),
  0, 'admin belles ikke på et klasseoppslag — bar oversikt trekkes fra her også');

-- ⛔ THE ENTITLED-READER CONTROL. Without it the assertion above is passed
-- equally by "the carve-out worked" and by "reads_announcement is broken for
-- admins entirely" — a 0 for the opposite reason. This file's own header
-- demands the control, and Task 4 does it correctly two sections earlier.
select is(
  private.reads_announcement('c1000000-0000-0000-0000-000000000013',
                             'c1000000-0000-0000-0000-0000000000a5'),
  true, 'kontroll: admin KAN lese klasseoppslaget — bjella mangler ved regel, ikke ved tilgang');

insert into public.announcements (id, class_id, title, body, created_by)
values ('c1000000-0000-0000-0000-0000000000a7', null,
        'Hele skolen', 'Fri på fredag', 'c1000000-0000-0000-0000-000000000013');

select is(
  (select count(*)::int from public.notifications
    where entity_id = 'c1000000-0000-0000-0000-0000000000a7'
      and user_id = 'c1000000-0000-0000-0000-000000000011'),
  1, 'men et skoleomfattende oppslag når læreren — det er adressert til dem');

-- ── 36. ★ THE INVARIANT, over announcements ─────────────────────────
-- ⛔ IT SITS HERE, AFTER a7, AND THAT POSITION IS THE WHOLE POINT.
-- Placed before the school-wide notice it scanned only {012→a5, 012→a6} —
-- two class-scoped rows, both trivially readable — and the panel measured that
-- replacing reads_announcement with `true` left the recipient set BYTE
-- IDENTICAL, so the mutation reddened nothing anywhere in the file. a7 is the
-- only announcement whose audience is resolved by reads_announcement_row's
-- `cls is null` branch, i.e. the only one that reaches the seeded population
-- beyond this file's own fixtures. The invariant is worth having only once
-- that row exists.
select is(
  (select count(*)::int from public.notifications n
    where n.entity = 'announcement'
      and not private.reads_announcement(n.user_id, n.entity_id)),
  0, 'invariant: ingen varsler om et oppslag mottakeren ikke kan åpne');
```

- [ ] **Step 3: Run and watch it fail**

```bash
cd ~/dev/iqra-portal && npx supabase db reset && npx supabase test db --file supabase/tests/38_notifications_rls.sql 2>&1 | tail -20
```

Expected: FAIL at assertion 31 — the immediate publish produces no notification, because nothing fans out yet.

- [ ] **Step 4: Apply and run the whole suite**

```bash
cd ~/dev/iqra-portal && npx supabase db reset && npx supabase test db 2>&1 | tail -5
```

Expected: `Files=39, Tests=897, PASS`.

- [ ] **Step 5: Three named mutations**

⛔ **Two of these were DEAD in an earlier draft and the panel traced both.** Do not restore the old wording; a mutation that reddens nothing is worse than none, because the ledger then records coverage this file does not have.

1. ★ In `private.fan_out_new_announcement`, drop the `if new.fanned_out_at is not null` guard so it fans out at every INSERT. Expected: **assertion 32's first half FAILS** — `claim_due_announcements()` returns 1 but the parent already holds the notification, so `og forelderen varsles av claimen, ikke av utløseren` is satisfied by the wrong writer.
   ⚠ **The old wording named assertion 31 and it could not fail.** With the guard dropped, `fan_out_announcement(a6)` does run — and produces **zero rows**, because `a6.published_at` is `now() + 2 hours` and every non-author arm of `reads_announcement_row` requires `pub <= now()`. The count stayed 0 and the assertion stayed green. It was testing `published_at` gating, which file 37:380 already covers.
2. ★ In `private.fan_out_announcement`, replace `private.reads_announcement(ur.user_id, aid)` with `true`. Expected: **assertion 36's invariant FAILS**, via the school-wide `a7` — `class_id is null` opens the carve-out to every role-holder, including seeded parents with no live enrolment, whom the predicate refuses.
   ⚠ **This only works because assertion 36 now sits AFTER a7.** In the earlier ordering the surviving carve-out alone still yielded exactly `{012}` for `a5` and `a6` — a byte-identical recipient set — so the mutation reddened nothing in the entire file.
3. In `private.fan_out_announcement`, delete the whole `and ( ann.class_id is null or … )` carve-out. Expected: **assertion 35 FAILS** — the defect the tree disagreed with the spec about, which would otherwise have shipped as ten unwanted bells a week.

Restore after each; confirm green. Record all three outcomes in the commit body.

- [ ] **Step 6: Commit**

```bash
cd ~/dev/iqra-portal && git add supabase/migrations/20260807124000_announcement_fanout.sql supabase/tests/38_notifications_rls.sql && git commit -m "feat(oppslag): fan out at publish and at the claim, through one routine

Two trigger points, one rule: an after-insert trigger for an announcement
published now, and claim_due_announcements for a scheduled one. The insert
lives inside the claim's own statement, so a crash cannot leave a row marked
announced with nobody notified.

A trigger rather than a call from the publish action, because there are two
publish actions and a third could be written; because the trigger shares the
insert's transaction; and because the claim is service_role-only, so an
action-level call would need a grant that lets any parent burn every pending
fan-out.

pgTAP 885 -> 897."
```

---

## Task 6: Definer fingerprints — 83 → 95

**Files:**
- Modify: `supabase/tests/29_definer_fingerprints.sql`

Five new `security definer` functions exist. Each is a function whose stubbing to `select true` (or to a no-op) is an **escalation, not a refactor**:

| Function | What stubbing it does |
|---|---|
| `private.thread_recipients` | mails the whole school about one family's message |
| `private.fan_out_thread_message` | silently notifies nobody, forever |
| `private.fan_out_announcement` | school-wide name-and-notice disclosure |
| `public.claim_email_pings` | claims every row with no watermark |
| `public.resolve_ping_address` | resolves an address for someone who opted out |

⚠ `record_email_ping_outcome` is deliberately **not** fingerprinted for a predicate — its markers are covered behaviourally by assertions 15–17 in file 38, and a fingerprint over a plpgsql body this branchy would pin formatting rather than meaning.

- [ ] **Step 1: Add the five rows to the fingerprint table**

⚠ **The table's shape is NOT `(function, predicate)` pairs** — verified 2026-08-05. It is `('schema.function(argtypes)', array[…markers…])`, the function name carries its **signature**, and the counter counts **markers** (`count(*) from definer_markers d, lateral unnest(d.markers)`), not rows. `plan(2)` stays `plan(2)`; only the literal moves.

In `supabase/tests/29_definer_fingerprints.sql`, add these entries to the `definer_markers` values list, matching the file's existing formatting:

```sql
    -- D21's whole content: a wide candidate set narrowed by CALLING the wall.
    -- Stubbing this mails the whole school about one family's message.
    --
    -- ⛔ EVERY MARKER HERE IS A FULL CALL OR A DEFINITION, NEVER A BARE NAME,
    -- and that is not style. File 29 tests `position(m in pg_get_functiondef(…))
    -- = 0`, so a marker that appears TWICE in the body cannot detect the
    -- deletion of one occurrence. The panel measured exactly that:
    --   · 'private.reads_thread' also appears in the admin fallback, so
    --     deleting the substantive filter left file 29 GREEN;
    --   · 'staff_substantive' also appears as the CTE definition, so Task 4's
    --     mutation 2 — which rewrites only the `not exists` body — could not
    --     fire it either.
    -- Both markers below are unique to the line they guard.
    (
      'private.thread_recipients(uuid)',
      array[
        'private.reads_thread(c.uid, tid)',
        'not exists (select 1 from staff_substantive)',
        't.kind = ''laerer'''
      ]
    ),
    -- The sender exclusion, the opt-out filter, and the pupil mail carve-out.
    (
      'private.fan_out_thread_message()',
      array[
        'r.recipient <> new.sender_id',
        'p.email_pings_enabled',
        's.student_user_id = u'
      ]
    ),
    -- Stubbed, this is a school-wide notice-and-name disclosure. The three
    -- relationship markers are the bare-oversight carve-out — drop them and
    -- every admin is belled on every class notice.
    (
      'private.fan_out_announcement(uuid,uuid)',
      array[
        'private.reads_announcement',
        'private.teaches_class',
        'private.guardian_in_class_asof'
      ]
    ),
    -- Without skip locked, two drains claim the same row and send twice.
    (
      'public.claim_email_pings(integer)',
      array[
        'for update skip locked'
      ]
    ),
    -- Stubbed, this resolves an address for someone who opted out.
    -- ⚠ NO TRAILING COMMA — this is the new last entry, and the block closes
    -- `) as f(sig, markers);`. The existing final entry
    -- ('public.claim_due_announcements()') loses its comma to this one.
    (
      'public.resolve_ping_address(uuid)',
      array[
        'pr.email_pings_enabled',
        'u.deleted_at is null'
      ]
    )
```

- [ ] **Step 2: Bump the counter**

That is **12 new markers** (3+3+3+1+2), so change the literal from `83` to `95`:

```sql
  93,
  'the fingerprint table still covers 95 (function, predicate) pairs'
```

⚠ **Count the markers, do not reconcile the two numbers by adjusting either one** — the file's own comment records that this mistake has been made twice already, once by reading "five new functions" and writing 31. Confirm the arithmetic against the actual arrays you paste: 2 + 2 + 3 + 1 + 2 = 10.

⚠ `plan(2)` is **unchanged** — this file asserts a count and an `is_empty`, not one assertion per pair. The suite total does not move.

- [ ] **Step 3: Run**

```bash
cd ~/dev/iqra-portal && npx supabase test db --file supabase/tests/29_definer_fingerprints.sql 2>&1 | tail -10
```

Expected: PASS, with the literal at 95. `plan(2)` is unchanged, so the suite total does not move.

- [ ] **Step 4: Verify a fingerprint can actually fail**

Delete the `and private.reads_thread(c.uid, tid)` line from `substantive` in `private.thread_recipients`, `npx supabase db reset`, re-run file 29. Expected: **FAIL** naming that marker.

⛔ **This mutation was DEAD in an earlier draft** and the panel traced it: the marker was the bare name `private.reads_thread`, which also appears in the admin fallback, so deleting one occurrence left the other and file 29 stayed green. The marker above is the full call `private.reads_thread(c.uid, tid)` — unique to the filter — which is why it can now fail. Restore, reset, green.

★ A fingerprint that has never been watched fail is a claim, not a test — and file 29 has shipped pairs whose marker was a word that appeared in a comment.

- [ ] **Step 5: Commit**

```bash
cd ~/dev/iqra-portal && git add supabase/tests/29_definer_fingerprints.sql && git commit -m "test(varsler): fingerprint the five definers whose stubbing is an escalation

83 -> 95 markers (3+3+3+1+2). thread_recipients stubbed mails the whole school about one
family's message; fan_out_announcement stubbed is a school-wide disclosure;
resolve_ping_address stubbed sends to someone who opted out. Each pair was
watched fail under deletion of the line it names."
```

---

## Task 7: The e-mail template — assertions over its omissions

**Files:**
- Create: `src/lib/varsler/ping-email.ts`
- Create: `src/lib/varsler/ping-email.test.ts`

Pure, provider-free, and landed **with** its consumer's type so `knip` stays green. ⚠ `knip` fails unused exports at error level, so no export in this plan may sit more than one task away from its importer.

- [ ] **Step 1: Write the failing test**

Create `src/lib/varsler/ping-email.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';

// ⛔ REQUIRED. ping-email.ts imports 'server-only', which is a bare throw
// outside the react-server condition Vitest does not set. Ten files in this
// repo carry this line; without it the suite fails to import at all.
vi.mock('server-only', () => ({}));

import { buildPingEmail } from './ping-email';

describe('the content-free ping', () => {
  it('names the count and nothing else that varies', () => {
    const mail = buildPingEmail({ unreadCount: 3, portalUrl: 'https://portal.iqrasenter.no' });
    expect(mail.subject).toBe('Nytt varsel i IQRA-portalen');
    expect(mail.text).toContain('3 nye meldinger');
  });

  // ★ THE SUBJECT IS A FIXED STRING, NEVER TEMPLATED. A subject line is the one
  // part of an e-mail that shows on a lock screen, unopened, to whoever is
  // holding the phone.
  it('uses the same subject regardless of count', () => {
    const one = buildPingEmail({ unreadCount: 1, portalUrl: 'https://x.no' });
    const many = buildPingEmail({ unreadCount: 40, portalUrl: 'https://x.no' });
    expect(one.subject).toBe(many.subject);
  });

  it('links the root, never a deep link', () => {
    const mail = buildPingEmail({ unreadCount: 1, portalUrl: 'https://portal.iqrasenter.no' });
    expect(mail.text).toContain('https://portal.iqrasenter.no');
    // A URL is not private: it travels through Resend, the recipient's mail
    // provider, their client's history and any forward. A thread id in a link
    // is content about who is talking to whom.
    // ⚠ `\/.` — ANY path character. The earlier `\/[a-z]` missed a UUID
    // beginning with a DIGIT (…iqrasenter.no/7f3c…) and any uppercase path,
    // which is most of the deep links this could accidentally grow.
    expect(mail.text).not.toMatch(/portal\.iqrasenter\.no\/./);
  });

  // ★★ THE OMISSION TEST. ⛔ AN EARLIER VERSION OF THIS TEST WAS VACUOUS AND
  // THE PANEL MEASURED IT: it spread `{ [_label]: secret }` where `_label` was
  // the HUMAN DESCRIPTION ('a pupil name'), not a field name — so the builder
  // would have had to read a property literally called "a pupil name" for the
  // assertion to bite. A reviewer copied it verbatim, wrote a builder that put
  // a teacher's name in the SUBJECT and a pupil's name in the BODY, and got
  // 6/6 GREEN. This repo has already shipped one privacy wall whose test could
  // not fail; this is the only assertion anywhere that the mail carries no
  // child data.
  //
  // The keys below are REAL field names. `buildPingEmail`'s parameter type does
  // not declare them, so TypeScript rejects them at compile time — which is
  // half the wall — and the cast forces them through at runtime so the test
  // still proves the OUTPUT ignores them. Both halves are needed: the type
  // alone would not catch a builder that reads `(input as any).pupilName`.
  it.each([
    ['pupilName', 'Yusuf'],
    ['teacherName', 'Leila'],
    ['className', '3A'],
    ['subject', 'Om leksene'],
    ['body', 'Han var ikke på skolen'],
    ['recipientName', 'Fatima'],
    ['threadId', '7f3c1b2a-0000-4000-8000-000000000001'],
  ])('never carries %s even when the caller passes one', (field, secret) => {
    const mail = buildPingEmail({
      unreadCount: 2,
      portalUrl: 'https://portal.iqrasenter.no',
      ...({ [field]: secret } as Record<string, unknown>),
    } as Parameters<typeof buildPingEmail>[0]);
    expect(mail.text).not.toContain(secret);
    expect(mail.subject).not.toContain(secret);
  });

  it('refuses to build a ping for nothing', () => {
    expect(() => buildPingEmail({ unreadCount: 0, portalUrl: 'https://x.no' })).toThrow(
      /aldri sendes/,
    );
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd ~/dev/iqra-portal && npx vitest run src/lib/varsler/ping-email.test.ts 2>&1 | tail -10
```

Expected: FAIL — `Failed to resolve import "./ping-email"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/varsler/ping-email.ts`:

```typescript
import 'server-only';

/**
 * The content-free e-mail ping (spec §5.3, D27).
 *
 * ★ THE COUNT IS THE ONLY VARIABLE, and it is not about a child. Everything
 * else is a fixed string. The subject in particular is never templated: it is
 * the one part of an e-mail that appears on a lock screen, unopened, to
 * whoever is holding the phone.
 *
 * ⚠ THIS FILE CANNOT PROTECT THE WHOLE PROMISE. Any provider that rewrites
 * links through a per-recipient tracking domain, or injects an open pixel,
 * reintroduces exactly the identifier we refuse to put in the URL — and it
 * does so AFTER this function has returned. ping-email.test.ts structurally
 * cannot catch that. Confirm link-rewriting and open-tracking are OFF against
 * a real delivered message before the pilot (carried to plan 4, D28).
 */
export type PingEmail = { subject: string; text: string };

const SUBJECT = 'Nytt varsel i IQRA-portalen';

export function buildPingEmail(input: { unreadCount: number; portalUrl: string }): PingEmail {
  if (input.unreadCount < 1) {
    // A ping for nothing is a bug upstream — the drain clears `pending` with no
    // send when the count is 0. Throwing here means that bug can never be
    // delivered to a parent as "Du har 0 nye varsler".
    throw new Error('En ping uten uleste varsler skal aldri sendes.');
  }
  // ⚠ «meldinger», not «varsler» — panel finding B7. The mail path exists for
  // thread messages ALONE (D12: announcements never queue mail), and the count
  // the drain passes is now thread-scoped for exactly that reason. Saying
  // «varsler» would name a set larger than the one being counted, and it was
  // that mismatch which let an unread class notice inflate the number. D27's
  // decision — keep the count — is unchanged; only the noun is corrected.
  const plural = input.unreadCount === 1 ? 'ny melding' : 'nye meldinger';
  return {
    subject: SUBJECT,
    text: [
      'Hei,',
      '',
      `Du har ${input.unreadCount} ${plural} i IQRA skoleportal.`,
      `Logg inn for å lese dem: ${input.portalUrl}`,
      '',
      'Denne e-posten sendes automatisk og inneholder aldri opplysninger om barnet ditt.',
      'Du kan slå av varsel-e-post under «Min profil» i portalen.',
    ].join('\n'),
  };
}
```

- [ ] **Step 4: Run and confirm**

```bash
cd ~/dev/iqra-portal && npx vitest run src/lib/varsler/ping-email.test.ts 2>&1 | tail -6
```

Expected: PASS, 11 tests.

- [ ] **Step 4b: ★★ WATCH THE OMISSION TEST FAIL — this step is not optional**

⛔ Task 7 previously had **no mutation step at all**, and that is exactly how a vacuous version of this test survived review. The omission assertions are the only place in the entire plan where the content-free promise is checked. A privacy wall that has never been watched fail is decoration, and this repo has shipped one.

Temporarily replace `buildPingEmail`'s body with a deliberately leaking version:

```typescript
export function buildPingEmail(input: { unreadCount: number; portalUrl: string }): PingEmail {
  const leak = input as unknown as Record<string, string>;
  return {
    subject: `${SUBJECT} fra ${leak.teacherName ?? ''}`,
    text: `Du har ${input.unreadCount} nye meldinger om ${leak.pupilName ?? ''}. ${input.portalUrl}/${leak.threadId ?? ''}`,
  };
}
```

```bash
cd ~/dev/iqra-portal && npx vitest run src/lib/varsler/ping-email.test.ts 2>&1 | tail -12
```

Expected: **FAIL** — at minimum `never carries pupilName`, `never carries teacherName`, `never carries threadId`, and `links the root, never a deep link`. If any of those stay green, the test is still vacuous and must be fixed before the real implementation goes back.

Restore the real implementation and confirm 11 green.

- [ ] **Step 5: Commit**

```bash
cd ~/dev/iqra-portal && git add src/lib/varsler/ping-email.ts src/lib/varsler/ping-email.test.ts && git commit -m "feat(varsler): the ping, and assertions over what it must never carry

The count is the only variable and the subject is a fixed string — it is the
part that shows on a lock screen unopened. The omission test is parameterised
over the six things spec 5.3 deliberately leaves out, and building a ping for
zero unread throws rather than delivering 'Du har 0 nye varsler'."
```

---

## Task 8: The drain — the repo's first route handler

**Files:**
- Create: `src/lib/varsler/resend.ts`
- Create: `src/lib/varsler/drain.ts`
- Create: `src/lib/varsler/drain.test.ts`
- Create: `src/app/api/varsler/drain/route.ts`
- Modify: `src/lib/env.server.ts`
- Modify: `src/proxy.ts`

⚠ **Four repo-specific traps, each verified against the tree:**
1. `src/proxy.ts`'s matcher covers everything but Next internals and static extensions — the drain **is** gated, and its exclusion must sit **before the `!user` branch** (line 81) or an unauthenticated cron GET is redirected to `/logg-inn` and the drain silently never runs.
2. `timingSafeEqual` **throws** on a length mismatch. Compare SHA-256 digests of both sides, which are always 32 bytes.
3. Neither secret may appear in `NEXT_PUBLIC_*`.
4. The address is read under `service_role` from `auth.users` and never copied into a `public` table.

- [ ] **Step 1: Extend `src/lib/env.server.ts`**

Append to `src/lib/env.server.ts`:

```typescript
/**
 * The cron shared secret. Validated and throwing, like every other server
 * secret in this file. ⛔ Never NEXT_PUBLIC_ — a public var is inlined into
 * the client bundle, and this one is the ONLY thing standing in front of the
 * app's first unauthenticated endpoint.
 */
export function getCronSecret(): string {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'CRON_SECRET mangler eller er for kort (minst 32 tegn). Sett den i .env.local og i Vercel.',
    );
  }
  return secret;
}

/**
 * Resend's API key. Returns null when unset, and that is DELIBERATE (D28):
 * no account exists yet. The drain treats a missing key as a RETRYABLE
 * FAILURE, never as a success — so the ledger shows pings that never went out
 * instead of a queue that looks drained.
 */
export function getResendApiKey(): string | null {
  return process.env.RESEND_API_KEY ?? null;
}
```

- [ ] **Step 2: Write the sender seam**

Create `src/lib/varsler/resend.ts`:

```typescript
import 'server-only';
import { getResendApiKey } from '@/lib/env.server';
import type { PingEmail } from './ping-email';

/**
 * The seam the drain is tested through (D28). The real caller is the default;
 * drain.test.ts passes a fake. There is no Resend SDK dependency — the
 * transactional endpoint is one POST, and a dependency here would be a
 * sub-processor's code running in our server bundle for no benefit.
 */
/**
 * ★ `retryable` is the difference between "the provider is having a bad day"
 * and "this address is wrong", and getting it wrong destroys the queue.
 * Without it, a missing API key — the EXPECTED state until IQRA's Resend
 * account exists (D28) — marks every pending user permanently `failed` within
 * five cron ticks. A rate limit is the most retryable error there is; a 422 on
 * a malformed recipient is the least.
 */
export type SendResult =
  | { ok: true }
  | { ok: false; errorCode: string; retryable: boolean };
export type SendPing = (to: string, mail: PingEmail) => Promise<SendResult>;

/** 4xx that are facts about the recipient, not about the provider. */
const PERMANENT_STATUSES = new Set([400, 401, 403, 404, 422]);

const ENDPOINT = 'https://api.resend.com/emails';
const FROM = 'IQRA skoleportal <varsler@varsler.iqrasenter.no>';

export const sendViaResend: SendPing = async (to, mail) => {
  const key = getResendApiKey();
  // ⛔ Not a success — the ping must stay in the ledger as unsent. But
  // RETRYABLE: this is a configuration state that a human will fix, not a fact
  // about the recipient, and burning the attempts ceiling on it would leave
  // every family needing an individual manual reset the day the key arrives.
  if (!key) return { ok: false, errorCode: 'NO_API_KEY', retryable: true };

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject: mail.subject, text: mail.text }),
    });
    if (!response.ok) {
      return {
        ok: false,
        errorCode: String(response.status),
        // 429 and every 5xx are the provider's problem. Everything in
        // PERMANENT_STATUSES is ours or the recipient's.
        retryable: !PERMANENT_STATUSES.has(response.status),
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, errorCode: 'NETWORK', retryable: true };
  }
};
```

- [ ] **Step 3: Write the failing drain test**

Create `src/lib/varsler/drain.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';

// ⛔ REQUIRED — see ping-email.test.ts. drain.ts imports 'server-only'.
vi.mock('server-only', () => ({}));

import { drainPings, type DrainDeps } from './drain';

function deps(overrides: Partial<DrainDeps> = {}): DrainDeps {
  return {
    claim: vi.fn(async () => [{ user_id: 'u1', unread_count: 2 }]),
    resolveAddress: vi.fn(async () => 'forelder@test.no'),
    recordOutcome: vi.fn(async () => {}),
    send: vi.fn(async () => ({ ok: true as const })),
    portalUrl: 'https://portal.iqrasenter.no',
    ...overrides,
  };
}

describe('the ping drain', () => {
  it('sends one mail per claimed user and records success', async () => {
    const d = deps();
    const result = await drainPings(d);
    expect(d.send).toHaveBeenCalledTimes(1);
    expect(d.recordOutcome).toHaveBeenCalledWith('u1', true, null, false);
    expect(result).toEqual({ claimed: 1, sent: 1, skipped: 0, failed: 0, abandoned: 0, unrecorded: 0 });
  });

  // ★ A notification you have already seen should not follow you into your
  // inbox. This is the old `superseded` status, which no longer exists as a
  // value: "nothing to send" is simply pending = false.
  it('clears a claim with no send when the user has already read everything', async () => {
    const d = deps({ claim: vi.fn(async () => [{ user_id: 'u1', unread_count: 0 }]) });
    const result = await drainPings(d);
    expect(d.send).not.toHaveBeenCalled();
    expect(d.recordOutcome).toHaveBeenCalledWith('u1', true, 'SKIPPED', false);
    expect(result).toEqual({ claimed: 1, sent: 0, skipped: 1, failed: 0, abandoned: 0, unrecorded: 0 });
  });

  // ★ An unresolvable address is a FAILURE, not a skip. Skipping it would
  // clear pending and swallow the message; failing it puts the row in the
  // ledger the admin screen reads.
  it('records a failure when the address will not resolve', async () => {
    const d = deps({ resolveAddress: vi.fn(async () => null) });
    const result = await drainPings(d);
    expect(d.send).not.toHaveBeenCalled();
    expect(d.recordOutcome).toHaveBeenCalledWith('u1', false, 'NO_ADDRESS', false);
    expect(result.failed).toBe(1);
  });

  it('passes the provider error code through to the ledger', async () => {
    const d = deps({ send: vi.fn(async () => ({ ok: false as const, errorCode: '422', retryable: false })) });
    await drainPings(d);
    expect(d.recordOutcome).toHaveBeenCalledWith('u1', false, '422', false);
  });

  // ★ One user's failure must not abandon the rest of the batch. The first
  // draft of this loop used Promise.all and a single throw lost every
  // outcome that had not yet been recorded.
  it('keeps draining after one recipient throws', async () => {
    const d = deps({
      claim: vi.fn(async () => [
        { user_id: 'u1', unread_count: 1 },
        { user_id: 'u2', unread_count: 1 },
      ]),
      send: vi
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({ ok: true as const }),
    });
    const result = await drainPings(d);
    expect(result).toEqual({ claimed: 2, sent: 1, skipped: 0, failed: 1, abandoned: 0, unrecorded: 0 });
    expect(d.recordOutcome).toHaveBeenCalledWith('u1', false, 'THREW', true);
    expect(d.recordOutcome).toHaveBeenCalledWith('u2', true, null, false);
  });

  // ⛔ THE CASE THE SUITE NEVER HAD. An earlier version tested `send`
  // rejecting but never `recordOutcome` rejecting — so the unguarded await
  // inside the catch was invisible to the tests, and a DB blip would have
  // stranded every remaining row in the batch.
  it('keeps draining when even the failure cannot be recorded', async () => {
    const d = deps({
      claim: vi.fn(async () => [
        { user_id: 'u1', unread_count: 1 },
        { user_id: 'u2', unread_count: 1 },
      ]),
      send: vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue({ ok: true }),
      recordOutcome: vi
        .fn()
        .mockRejectedValueOnce(new Error('db gone'))
        .mockResolvedValue(undefined),
    });
    const result = await drainPings(d);
    expect(result.unrecorded).toBe(1);
    expect(result.sent).toBe(1);
    // u2 was still attempted — the point of the whole test.
    expect(d.send).toHaveBeenCalledTimes(2);
  });

  // ★ The wall-clock budget. Abandoned rows are delayed, not lost: the
  // 15-minute lease in claim_email_pings reclaims them.
  it('stops claiming new work when the budget is spent', async () => {
    let clock = 0;
    const d = deps({
      claim: vi.fn(async () => [
        { user_id: 'u1', unread_count: 1 },
        { user_id: 'u2', unread_count: 1 },
        { user_id: 'u3', unread_count: 1 },
      ]),
      send: vi.fn(async () => {
        clock += 1000;
        return { ok: true as const };
      }),
      deadlineMs: 1500,
      now: () => clock,
    });
    const result = await drainPings(d);
    expect(result.sent).toBe(2);
    expect(result.abandoned).toBe(1);
  });

  it('does nothing at all when nothing is due', async () => {
    const d = deps({ claim: vi.fn(async () => []) });
    const result = await drainPings(d);
    expect(d.send).not.toHaveBeenCalled();
    expect(result).toEqual({ claimed: 0, sent: 0, skipped: 0, failed: 0, abandoned: 0, unrecorded: 0 });
  });
});
```

- [ ] **Step 4: Run and watch it fail**

```bash
cd ~/dev/iqra-portal && npx vitest run src/lib/varsler/drain.test.ts 2>&1 | tail -8
```

Expected: FAIL — `Failed to resolve import "./drain"`.

- [ ] **Step 5: Write the drain**

Create `src/lib/varsler/drain.ts`:

```typescript
import 'server-only';
import { buildPingEmail } from './ping-email';
import type { SendPing } from './resend';

export type ClaimedPing = { user_id: string; unread_count: number };

export type DrainDeps = {
  claim: () => Promise<ClaimedPing[]>;
  resolveAddress: (userId: string) => Promise<string | null>;
  recordOutcome: (
    userId: string,
    succeeded: boolean,
    errorCode: string | null,
    retryable: boolean,
  ) => Promise<void>;
  send: SendPing;
  portalUrl: string;
  /** Wall-clock budget. The loop stops claiming new work when it is spent. */
  deadlineMs?: number;
  now?: () => number;
};

export type DrainResult = {
  claimed: number;
  sent: number;
  skipped: number;
  failed: number;
  /** Claimed but not attempted — the budget ran out. The lease recovers them. */
  abandoned: number;
  /** Attempted, but even the failure could not be written down. */
  unrecorded: number;
};

/**
 * One drain pass. Pure over its dependencies so every branch is testable
 * without a database or a provider (D28).
 *
 * ★ SEQUENTIAL, AND ON PURPOSE. Promise.all would let one rejection abandon
 * outcomes that had not yet been recorded, leaving those rows claimed forever
 * — claimed_at is set and nothing clears it, so the next drain skips them and
 * the ping is lost silently. The batch is capped at 100 by the claim RPC, and
 * the drain runs on a schedule; serial is fast enough and cannot strand a row.
 */
export async function drainPings(deps: DrainDeps): Promise<DrainResult> {
  const claimed = await deps.claim();
  const result: DrainResult = {
    claimed: claimed.length,
    sent: 0,
    skipped: 0,
    failed: 0,
    abandoned: 0,
    unrecorded: 0,
  };

  const now = deps.now ?? Date.now;
  const startedAt = now();

  for (const ping of claimed) {
    // ★ A WALL-CLOCK BUDGET. The claim hands out up to 100 rows and each is a
    // provider round trip; at 200–500 ms that is 20–50 s against a serverless
    // duration limit measured in tens of seconds. Stopping early leaves the
    // remaining rows claimed — but the 15-minute LEASE in claim_email_pings
    // reclaims them, so they are delayed, never lost. Without the lease this
    // would be the stranding bug; with it, this is just backpressure.
    if (deps.deadlineMs !== undefined && now() - startedAt > deps.deadlineMs) {
      result.abandoned = claimed.length - (result.sent + result.skipped + result.failed);
      break;
    }

    try {
      // Already read in the portal — clear the claim with no send.
      // ⚠ 'SKIPPED' is not decoration: record_email_ping_outcome stamps
      // sent_at only when error_code is null, so this is what keeps the ledger
      // from recording a delivery that never happened.
      if (ping.unread_count < 1) {
        await deps.recordOutcome(ping.user_id, true, 'SKIPPED', false);
        result.skipped += 1;
        continue;
      }

      const address = await deps.resolveAddress(ping.user_id);
      if (!address) {
        // A failure, not a skip: clearing pending here would swallow the ping.
        // Permanent — an unresolvable address is a fact about the account, and
        // opted-out users never reach this point (the claim excludes them).
        await deps.recordOutcome(ping.user_id, false, 'NO_ADDRESS', false);
        result.failed += 1;
        continue;
      }

      const outcome = await deps.send(
        address,
        buildPingEmail({ unreadCount: ping.unread_count, portalUrl: deps.portalUrl }),
      );
      if (outcome.ok) {
        await deps.recordOutcome(ping.user_id, true, null, false);
        result.sent += 1;
      } else {
        await deps.recordOutcome(ping.user_id, false, outcome.errorCode, outcome.retryable);
        result.failed += 1;
      }
    } catch {
      // ⛔ THE RECOVERY ITSELF MUST NOT THROW. An earlier version awaited
      // recordOutcome here unguarded — and recordOutcome throws on any
      // PostgREST error, whose realistic causes (DB unreachable, connection
      // reset, pool exhaustion, a 5xx) are exactly the ones that fail
      // REPEATEDLY. That throw escaped the loop, escaped drainPings, and the
      // route had no try/catch, so every row claimed in the pass and not yet
      // recorded was left claimed. The comment above it asserted the invariant
      // the code did not enforce.
      try {
        await deps.recordOutcome(ping.user_id, false, 'THREW', true);
      } catch {
        // Nothing further is available. The lease is what recovers this row.
        result.unrecorded += 1;
      }
      result.failed += 1;
    }
  }

  return result;
}
```

- [ ] **Step 6: Run and confirm**

```bash
cd ~/dev/iqra-portal && npx vitest run src/lib/varsler/drain.test.ts 2>&1 | tail -6
```

Expected: PASS, 8 tests.

- [ ] **Step 7: Write the route handler**

Create `src/app/api/varsler/drain/route.ts`:

```typescript
import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCronSecret } from '@/lib/env.server';
// ⚠ The service-role client lives in the QUARANTINED module, and that quarantine
// is the point: `src/lib/admin/quarantine.ts` imports 'server-only', so any
// client-reachable import of it is a build-time error. This route is the first
// non-admin consumer — keep the import path exactly this, and never re-export
// the client from somewhere more convenient.
import { createServiceRoleClient } from '@/lib/admin/quarantine';
import { drainPings } from '@/lib/varsler/drain';
import { sendViaResend } from '@/lib/varsler/resend';

export const dynamic = 'force-dynamic';
// ★ AN EXPLICIT BUDGET. Without it the platform default applies and a busy
// batch is killed mid-loop. The drain's own deadlineMs is set below it so the
// loop stops itself first and records what it did.
export const maxDuration = 60;

class CronConfigError extends Error {}

/**
 * The app's FIRST route handler, and its first unauthenticated endpoint.
 *
 * ★ THE SECRET GATE IS THE ONLY WALL HERE, so it is asserted statically by
 * src/app/route-guards.test.ts as well as behaviourally below. It is named
 * `assertCronSecret` and that name is what the static wall looks for.
 *
 * ⛔ IT THROWS RATHER THAN RETURNING false, DELIBERATELY. A boolean can be
 * called and ignored — `assertCronSecret(request);` on its own line satisfies
 * any static check that looks for the call, while gating nothing. The panel
 * confirmed that evasion passes a name-based wall. Throwing makes the
 * ignore-the-result failure mode unrepresentable.
 *
 * ⚠ timingSafeEqual THROWS on a length mismatch, so a naive call is itself a
 * length oracle AND a 500. Both sides are hashed to a fixed 32 bytes first.
 *
 * ⚠ RFC 7235 makes the auth SCHEME TOKEN CASE-INSENSITIVE, so `bearer x` is a
 * valid rendering of `Bearer x`. Comparing the raw header byte-for-byte would
 * give a permanent 401 with no local symptom if Vercel — or any edge proxy in
 * front of it — normalises the scheme differently from this literal. The
 * scheme is compared case-insensitively and only the TOKEN is hashed.
 */
function assertCronSecret(request: Request): void {
  let expected: string;
  try {
    expected = getCronSecret();
  } catch (cause) {
    // Misconfiguration, not a failed authentication. Distinguishing them stops
    // the endpoint from being a 500-vs-401 oracle, and — more practically —
    // stops an executor reading "500" as "my secret is wrong".
    throw new CronConfigError(String(cause));
  }

  const header = request.headers.get('authorization') ?? '';
  const [scheme, ...rest] = header.split(' ');
  const token = rest.join(' ');
  if ((scheme ?? '').toLowerCase() !== 'bearer') {
    throw new Error('unauthorized');
  }
  const presented = createHash('sha256').update(token).digest();
  const wanted = createHash('sha256').update(expected).digest();
  if (!timingSafeEqual(presented, wanted)) {
    throw new Error('unauthorized');
  }
}

export async function GET(request: Request) {
  try {
    assertCronSecret(request);
  } catch (cause) {
    if (cause instanceof CronConfigError) {
      console.error('[drain] CRON_SECRET mangler eller er ugyldig:', cause.message);
      return new NextResponse(null, { status: 503 });
    }
    // No body, no hint about which half was wrong.
    return new NextResponse(null, { status: 401 });
  }

  const admin = createServiceRoleClient();

  // Scheduled announcements first: their notifications must exist before the
  // ping counts them, or a parent is mailed a count that the portal does not
  // yet show.
  const { error: announceError } = await admin.rpc('claim_due_announcements');
  if (announceError) {
    // ⛔ AND IT MUST REACH THE STATUS CODE. Logging and returning 200 made a
    // permanently broken scheduled fan-out read as a healthy cron forever:
    // Vercel's dashboard keys on the status, and NEITHER health number sees it
    // either, because an announcement that never fans out never queues a ping.
    console.error('[drain] claim_due_announcements feilet:', announceError.message);
    return NextResponse.json(
      { error: 'claim_due_announcements', message: announceError.message },
      { status: 500 },
    );
  }

  const result = await drainPings({
    claim: async () => {
      const { data, error } = await admin.rpc('claim_email_pings', { batch_size: 100 });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    resolveAddress: async (userId) => {
      const { data, error } = await admin.rpc('resolve_ping_address', { target: userId });
      if (error) throw new Error(error.message);
      return data ?? null;
    },
    recordOutcome: async (userId, succeeded, errorCode, retryable) => {
      const { error } = await admin.rpc('record_email_ping_outcome', {
        target: userId,
        succeeded,
        error_code: errorCode,
        retryable,
      });
      if (error) throw new Error(error.message);
    },
    send: sendViaResend,
    portalUrl: 'https://portal.iqrasenter.no',
    // Comfortably inside maxDuration, so the loop stops itself and reports
    // rather than being killed with nothing written down.
    deadlineMs: 45_000,
  });

  // A pass that could not write down what it did is not a healthy pass.
  return NextResponse.json(result, { status: result.unrecorded > 0 ? 500 : 200 });
}
```

✅ Verified 2026-08-05: `createServiceRoleClient` is exported from `src/lib/admin/quarantine.ts:45`. There is no `src/lib/admin/client.ts`.

- [ ] **Step 8: Exclude the route in `src/proxy.ts`**

In `src/proxy.ts`, insert **immediately after** the `DENIED_PATH` early return and **before** `if (!user) {`:

```typescript
  // ⛔ MUST SIT BEFORE THE !user BRANCH. The matcher covers every path but
  // Next internals, so an unauthenticated cron GET would otherwise be 307'd to
  // /logg-inn and the drain would silently never run — a queue that looks
  // drained because nothing ever claimed it.
  //
  // ⚠ ONE EXACT PATH, never a prefix. `startsWith('/api')` would exempt every
  // future route handler from the session gate by default.
  if (path === '/api/varsler/drain') return respond();
```

- [ ] **Step 9: Verify the gate behaves**

```bash
cd ~/dev/iqra-portal && (npm run dev > /tmp/iqra-dev.log 2>&1 &) && sleep 12 && \
  echo "--- no secret ---" && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/varsler/drain && \
  echo "--- wrong secret ---" && curl -s -o /dev/null -w "%{http_code}\n" -H "authorization: Bearer wrong" http://localhost:3000/api/varsler/drain && \
  echo "--- right secret ---" && curl -s -w "\n%{http_code}\n" -H "authorization: Bearer $(grep '^CRON_SECRET=' .env.local | cut -d= -f2-)" http://localhost:3000/api/varsler/drain
```

Expected: `401`, `401`, then a JSON body and `200`.

⛔ **`401` and not `307` is the assertion that matters.** A `307` means the proxy exclusion is in the wrong place — the request never reached the handler, and the drain would never have run in production either. Set `CRON_SECRET` in `.env.local` first (any 32+ char string).

- [ ] **Step 10: Commit**

```bash
cd ~/dev/iqra-portal && git add src/lib/varsler/resend.ts src/lib/varsler/drain.ts src/lib/varsler/drain.test.ts src/app/api/varsler/drain/route.ts src/lib/env.server.ts src/proxy.ts && git commit -m "feat(varsler): the drain, behind the repo's first route handler

The proxy matcher covers every path, so the exclusion sits before the !user
branch — otherwise an unauthenticated cron GET is 307'd to /logg-inn and the
queue looks drained because nothing ever claimed it. One exact path, never a
prefix.

timingSafeEqual throws on a length mismatch, so both sides are hashed to 32
bytes first. A missing RESEND_API_KEY is a retryable failure and never a
success: with no account yet, the ledger must show pings that did not go out.

The loop is sequential because Promise.all lets one rejection strand rows as
claimed forever, and claimed_at is what the next drain skips on."
```

---

## Task 9: The static wall for route handlers

**Files:**
- Create: `src/app/route-guards.test.ts`
- Create: `src/app/__fixtures__/evasion-routes.ts.txt`

⚠ **`src/app/action-guards.test.ts` collects only files literally named `actions.ts`** (`:169`). A `route.ts` is invisible to it — so the allowlist entry the spec budgeted for protects nothing, and the app's first unauthenticated public endpoint would ship with **no static assertion at all**. This task closes that.

- [ ] **Step 1: Extract the existing parser instead of writing a second, weaker one**

⛔ **An earlier draft wrote its own parser, and the panel defeated it six ways** by executing it: a handler declared without `async` was invisible; a **block-commented** gated handler sitting above a live ungated one *passed*; calling the gate and **ignoring its return value** passed; a gate inside a never-called closure passed; the gate name inside a **string literal** passed; and `export const GET = withCron(drain)` was invisible. Four of those are regressions against `src/app/action-guards.test.ts` sitting in the same directory, which already handles them: `(?:async\s+)?`, `^…` with the `m` flag, a global `while` loop over **all** matches rather than a single `exec`, and a brace scanner that skips strings and comments.

Do not copy it — **extract it**, so there is one parser and it cannot drift.

Create `src/app/__testlib__/export-parser.ts` by moving `parseActions`, `takeBalancedBody` and `stripComments` out of `src/app/action-guards.test.ts` verbatim, generalising only the name filter:

```typescript
/**
 * Shared static-analysis helpers for the two export walls
 * (action-guards.test.ts and route-guards.test.ts).
 *
 * ⚠ This file is TEST INFRASTRUCTURE, not app code. It lives under src/app so
 * both suites can import it, and it is imported by exactly those two.
 *
 * Every regex quirk here was earned. `(?:async\s+)?` — Next accepts a
 * non-async handler. `^` with `m` — an unanchored match fires inside comments.
 * The global `while` loop — a single `exec` returns the FIRST match, so a
 * commented-out gated handler above a live ungated one wins. And
 * takeBalancedBody skips strings and comments, so a brace inside either does
 * not end the body early.
 */
export function stripComments(body: string): string {
  return body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

export type ParsedExport = { key: string; name: string; body: string };

/**
 * @param names when given, only exports whose name is in this set are returned
 *              (route handlers: GET/POST/…). Omitted, every exported async
 *              function is returned (server actions).
 */
export function parseExports(
  file: string,
  source: string,
  names?: readonly string[],
): ParsedExport[] { /* moved verbatim from action-guards.test.ts */ }
```

Then update `src/app/action-guards.test.ts` to import from it. That file's `expect(allActions.length).toBe(81)` must not move — this step is a pure refactor, and if the number changes the extraction was not faithful.

- [ ] **Step 2: Write the evasion fixture, including all six defeats**

Create `src/app/__fixtures__/evasion-routes.ts.txt` (stored as `.txt` so it is never compiled, linted, or collected):

```text
export async function GET(request: Request) {}

export async function POST(request: Request) {
  assertCronSecret(request);
  return Response.json({});
}

export function PUT(request: Request) {
  return Response.json({});
}

/*
export async function PATCH(request: Request) {
  assertCronSecret(request);
}
*/
export async function PATCH(request: Request) {
  return Response.json({});
}

export const DELETE = async (request: Request) => {
  const check = () => assertCronSecret(request);
  return Response.json({});
};

export async function HEAD(request: Request) {
  const todo = "assertCronSecret(request)";
  return Response.json({});
}
```

- [ ] **Step 3: Write the wall**

Create `src/app/route-guards.test.ts`:

```typescript
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseExports, stripComments } from './__testlib__/export-parser';

/**
 * The static wall for route handlers.
 *
 * ⚠ WHY IT EXISTS SEPARATELY. action-guards.test.ts collects only files
 * literally named `actions.ts` (:169), so a route.ts is invisible to it and the
 * app's first unauthenticated endpoint would ship with no static assertion.
 *
 * ⛔ IT SCANS src/app, NOT src/app/api. Next allows a route handler ANYWHERE in
 * the app directory, so scoping to /api would let src/app/rapport/route.ts open
 * a second public endpoint that this wall never sees.
 */
const APP_DIR = 'src/app';
const REQUIRED_GATE = 'assertCronSecret';
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
const ROUTE_FILE = /^route\.(ts|tsx|js|jsx)$/;

function routeFiles(dir: string): string[] {
  let found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found = found.concat(routeFiles(full));
    else if (ROUTE_FILE.test(entry)) found.push(full);
  }
  return found;
}

const files = routeFiles(APP_DIR);
const allHandlers = files.flatMap((file) =>
  parseExports(file, readFileSync(file, 'utf8'), HTTP_METHODS),
);

describe('the parser, against every evasion that defeated the first version', () => {
  const fixture = readFileSync('src/app/__fixtures__/evasion-routes.ts.txt', 'utf8');
  const parsed = parseExports('fixture.ts', fixture, HTTP_METHODS);
  const byName = new Map(parsed.map((h) => [h.name, h]));

  it('finds every method form, including non-async and arrow', () => {
    expect([...byName.keys()].sort()).toEqual(
      ['DELETE', 'GET', 'HEAD', 'PATCH', 'POST', 'PUT'],
    );
  });

  it.each([
    ['an empty body does not swallow its neighbour', 'GET'],
    ['a non-async handler is not invisible', 'PUT'],
    ['a block-commented handler does not shadow the live one below it', 'PATCH'],
    ['a gate inside a never-called closure does not count', 'DELETE'],
    ['the gate name inside a string literal does not count', 'HEAD'],
  ])('%s', (_label, method) => {
    expect(stripComments(byName.get(method)!.body)).not.toContain(`${REQUIRED_GATE}(`);
  });

  it('still recognises a genuinely gated handler', () => {
    expect(stripComments(byName.get('POST')!.body)).toContain(`${REQUIRED_GATE}(`);
  });
});

describe('route handler authorization', () => {
  // ⛔ A CROSS-CHECK WITH TEETH, not a hard-coded total. `toBe(1)` counted
  // PARSED handlers, so a parser regression that made a real endpoint
  // invisible left the count at 1 and read as green. This counts method
  // exports by an INDEPENDENT means and requires the two to agree, so an
  // unparsed handler fails loudly instead of vanishing.
  it.each(files)('%s: every exported method is parsed', (file) => {
    const source = readFileSync(file, 'utf8');
    const declared = HTTP_METHODS.filter((m) =>
      new RegExp(`^export\\s+(?:async\\s+)?(?:function\\s+${m}\\b|const\\s+${m}\\b)`, 'm')
        .test(stripComments(source)),
    );
    const parsed = parseExports(file, source, HTTP_METHODS).map((h) => h.name);
    expect(parsed.sort()).toEqual([...declared].sort());
  });

  it.each(allHandlers.map((h) => [h.key, h] as const))(
    '%s calls the secret gate',
    (_key, handler) => {
      expect(stripComments(handler.body)).toContain(`${REQUIRED_GATE}(`);
    },
  );
});
```

⚠ `assertCronSecret` **throws** (Task 8), so the ignore-the-result evasion is unrepresentable in the real route as well as caught here. Both halves matter: the wall catches a handler that never calls it, the throw catches one that calls it and discards the answer.

- [ ] **Step 4: Run — the refactor and the wall together**

```bash
cd ~/dev/iqra-portal && npx vitest run src/app/route-guards.test.ts src/app/action-guards.test.ts 2>&1 | tail -10
```

Expected: both PASS, and **action-guards still reports 81 actions**. If that number moved, the parser extraction in Step 1 was not faithful — fix the extraction, never the number.

- [ ] **Step 5: ★ Watch the wall fail, three ways**

Each is a distinct evasion class, and the first version of this wall survived all three.

1. Delete the `assertCronSecret(request);` call from `GET` in `src/app/api/varsler/drain/route.ts`. Expected: **FAIL** — `…/route.ts:GET calls the secret gate`.
2. Restore it, then wrap it so the result is discarded but the call remains — replace the `try { assertCronSecret(request); } catch …` block with a bare `assertCronSecret(request);` on its own line and no try/catch. Expected: the wall **PASSES** — and that is correct, because `assertCronSecret` **throws**, so discarding the result still gates. This is the step that proves the throw-not-boolean decision is what closes the class; a boolean-returning gate here would be a live hole with a green wall.
3. Add a second, ungated handler at `src/app/rapport/route.ts` containing `export async function GET() { return Response.json({}); }`. Expected: **FAIL**. ⚠ Under the earlier `src/app/api`-scoped version this file was outside the scan entirely and the wall stayed green. Delete the file afterwards.

Restore after each and confirm green.

⛔ A wall that has never been watched fail is decoration. This project has shipped one whose test could not fail, and the first draft of *this* wall was defeated six ways by a reviewer who simply ran it.

- [ ] **Step 6: Commit**

```bash
cd ~/dev/iqra-portal && git add src/app/route-guards.test.ts src/app/__fixtures__/evasion-routes.ts.txt src/app/__testlib__/export-parser.ts src/app/action-guards.test.ts && git commit -m "test(varsler): a static wall for route handlers, built on the parser that already works

action-guards.test.ts collects only files named actions.ts, so the app's first
unauthenticated endpoint was invisible to it.

The first draft of this wall wrote a second parser and a reviewer defeated it
six ways by executing it: a non-async handler was invisible, a block-commented
gated handler shadowed a live ungated one, calling the gate and ignoring the
result passed, so did a gate in a dead closure and one inside a string literal,
and an arrow-with-wrapper form was invisible. Four were regressions against the
parser sitting in the same directory. So that parser is now extracted and
shared rather than copied.

It scans src/app, not src/app/api — Next allows a route handler anywhere — and
the count assertion is a per-file cross-check against an independent scan, so
an unparsed handler fails instead of leaving the total unchanged."
```

---
## Task 10: The cron entry — the repo's first

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Verify the minimum interval before writing it**

⚠ The spec settled that Vercel Pro is required by Vercel's own terms for this project, so a sub-daily schedule carries no plan risk — but **verify the current minimum cron interval against Vercel's documentation** before committing a value. Use `/firecrawl` per the repo's tooling rules; if it is out of credits, record that the value is unverified rather than asserting it.

- [ ] **Step 2: Write the cron entry**

Replace `vercel.json` with:

```json
{
  "regions": ["arn1"],
  "crons": [
    {
      "path": "/api/varsler/drain",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

- [ ] **Step 3: Confirm the build still passes**

```bash
cd ~/dev/iqra-portal && npm run build 2>&1 | tail -20
```

Expected: clean build, and `/api/varsler/drain` listed among the routes as a Dynamic (server) function.

- [ ] **Step 4: Commit**

```bash
cd ~/dev/iqra-portal && git add vercel.json && git commit -m "feat(varsler): the repo's first cron entry

Every 15 minutes against /api/varsler/drain. Vercel injects its own
authorization header from CRON_SECRET, which is the same secret the handler
gates on — so the schedule and the wall share one value and there is no second
place for it to drift.

⚠ CRON_SECRET and RESEND_API_KEY must be set in Vercel's project environment
before the first deploy; the drain 401s without the first and ledgers every
ping as NO_API_KEY without the second."
```

---

## Task 11: The DAL and the mark-read action

**Files:**
- Create: `src/lib/varsler/queries.ts`
- Create: `src/app/(portal)/varsler/actions.ts`
- Modify: `src/app/action-guards.test.ts` (counter **79 → 81**)

⚠ **Land the DAL WITH its consumer.** `knip` fails unused exports at error level, so an export whose importer is a task away turns the gate red for reasons unrelated to correctness. Task 12 imports both files below, so tasks 11 and 12 may be committed together if the gate complains.

⛔ **D11's «resolve through RLS», read correctly.** A notification's `entity_id` has no foreign key, so the label must be resolved by reading the entity — and **an unreachable entity is simply absent from the result**. That is a stronger guarantee than a per-row permission check, because it cannot be forgotten for one row. Read the labels in **two batched `.in()` queries**, never per row: the literal reading of "resolve through RLS" is an N+1.

- [ ] **Step 1: Write the DAL**

Create `src/lib/varsler/queries.ts`:

```typescript
import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type VarselRow = {
  id: string;
  entity: 'thread' | 'announcement';
  entityId: string;
  label: string;
  href: string;
  createdAt: string;
  unread: boolean;
};

/**
 * The badge number.
 *
 * ⛔ IT MUST COUNT EXACTLY WHAT listVarsler RENDERS. An earlier version counted
 * every unread row with no reachability filter, and three panel lenses landed
 * on the same consequence: `notifications` has no FK, so a row outlives its
 * entity's REACHABILITY — guardianship removed, a teacher unassigned, term
 * rollover, a pupil erased, a login disabled. The bell then reads «Varsler (4)»
 * over a list of one, and the difference is an EXACT COUNT OF WHAT THE READER
 * IS NO LONGER ALLOWED TO SEE. A parent who loses guardianship of one child
 * learns by subtraction how many conversations about that child had new
 * activity. `20260803001000_protected_mate_omission.sql` exists to abolish
 * precisely that arithmetic — «omitting the row from the projection while the
 * policy still exposes the set leaves the omission recoverable by arithmetic».
 *
 * So this reuses listVarsler's own resolution rather than counting rows: the
 * two numbers cannot drift, because there is only one of them.
 */
export async function unreadCount(roleHome: string): Promise<number> {
  const rows = await listVarsler(roleHome, UNREAD_COUNT_CAP);
  return rows.filter((r) => r.unread).length;
}

/**
 * The bell shows a capped count. A school-wide notice plus a busy week is still
 * a small number; anything past this is «99+» in the UI, and capping keeps the
 * badge from becoming its own unbounded query.
 */
const UNREAD_COUNT_CAP = 99;

/**
 * The bell list.
 *
 * ⛔ TWO BATCHED READS, NEVER PER ROW. Both run under the caller's own RLS, so
 * an entity the reader cannot open is ABSENT from the label map and its
 * notification is dropped below. That absence IS the permission check — there
 * is no per-row test to forget.
 */
export async function listVarsler(roleHome: string, limit = 20): Promise<VarselRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('notifications')
    .select('id, entity, entity_id, created_at, read_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Kunne ikke hente varsler: ${error.message}`);
  const rows = data ?? [];

  const threadIds = rows.filter((r) => r.entity === 'thread').map((r) => r.entity_id);
  const announcementIds = rows.filter((r) => r.entity === 'announcement').map((r) => r.entity_id);

  const labels = new Map<string, string>();
  if (threadIds.length > 0) {
    const { data: threads } = await supabase
      .from('threads')
      .select('id, subject')
      .in('id', threadIds);
    for (const t of threads ?? []) labels.set(t.id, t.subject);
  }
  if (announcementIds.length > 0) {
    const { data: announcements } = await supabase
      .from('announcements')
      .select('id, title')
      .in('id', announcementIds);
    for (const a of announcements ?? []) labels.set(a.id, a.title);
  }

  return rows
    // An entity the reader cannot reach never entered the map. Dropping it here
    // is the whole access check for this surface.
    .filter((r) => labels.has(r.entity_id))
    .map((r) => ({
      id: r.id,
      entity: r.entity as 'thread' | 'announcement',
      entityId: r.entity_id,
      label: labels.get(r.entity_id)!,
      href:
        r.entity === 'thread'
          ? `${roleHome}/meldinger/${r.entity_id}`
          : `${roleHome}/oppslag`,
      createdAt: r.created_at,
      unread: r.read_at === null,
    }));
}
```

⚠ Confirm the server-client factory's name and path against an existing DAL file (e.g. `src/lib/announcement-audience.ts` or any `src/lib/dal/*`); use whatever those import rather than the name written here.

- [ ] **Step 1b: Add the multi-role guard the repo does not have**

⚠ **Verified 2026-08-05 — `requireRole` is not what an earlier draft assumed.** It lives at `src/lib/dal/session.ts:47`, **not** `@/lib/auth/guards` (which does not exist), and its signature is:

```typescript
export async function requireRole(role: Role): Promise<{ user: User; roles: Role[] }>
```

**One** role, and it returns an object. The draft passed an array and destructured a bare user — so `roles.includes(['admin', …])` would never be true and every caller would redirect to `/ingen-tilgang`; and `user.id` would be `undefined`, making `setEmailPingsAction` do `.eq('id', undefined)`, i.e. **the opt-out toggle silently saves nothing**. That is the exact failure Task 2's column grant exists to prevent, reintroduced one layer up.

The bell serves all five roles, and no multi-role guard exists. Add one to `src/lib/dal/session.ts`, beside `requireRole`:

```typescript
/**
 * Wall-1 guard for surfaces every signed-in role reaches — the varsel bell and
 * «Min profil». requireRole takes exactly one role, and the alternative at each
 * call site is a chain of five, which is both unreadable and easy to get
 * partially wrong.
 *
 * ⚠ It must be added to GUARDS in src/app/action-guards.test.ts, or every
 * action using it fails the static wall.
 */
export async function requireAnyRole(
  allowed: readonly Role[],
): Promise<{ user: User; roles: Role[] }> {
  const user = await requireUser();
  const roles = await getSessionRoles();
  if (!roles.some((role) => allowed.includes(role))) redirect('/ingen-tilgang');
  return { user, roles };
}
```

And add `'requireAnyRole'` to the `GUARDS` array in `src/app/action-guards.test.ts`.

- [ ] **Step 2: Write the action**

Create `src/app/(portal)/varsler/actions.ts`:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { requireAnyRole } from '@/lib/dal/session';
import { createClient } from '@/lib/supabase/server';

/**
 * Mark one varsel read.
 *
 * The guard is requireRole over every role that has a bell — economy included,
 * because economy receives school-wide announcements (D17 withholds messaging
 * from them, not notices). The row wall is the policy: an UPDATE naming
 * someone else's id touches zero rows and reports success, which is correct —
 * there is nothing to tell the caller about a row they cannot see.
 */
export async function markVarselReadAction(notificationId: string): Promise<void> {
  await requireAnyRole(['admin', 'teacher', 'parent', 'student', 'economy']);
  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);
  if (error) throw new Error(`Kunne ikke markere varselet som lest: ${error.message}`);
  revalidatePath('/', 'layout');
}

/**
 * «Marker alle som lest». One statement, bounded by the policy to the caller's
 * own rows.
 */
export async function markAllVarslerReadAction(): Promise<void> {
  await requireAnyRole(['admin', 'teacher', 'parent', 'student', 'economy']);
  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw new Error(`Kunne ikke markere varslene som lest: ${error.message}`);
  revalidatePath('/', 'layout');
}
```

✅ Verified 2026-08-05: `requireAnyRole` is the helper added in Step 1b; `requireRole` (one role, returns `{user, roles}`) is at `src/lib/dal/session.ts:47`. The existing multi-file precedent is `src/app/(portal)/forelder/meldinger/actions.ts:5`, which imports from `@/lib/dal/session`. ⚠ There is no `forelder/oppslag/actions.ts` — only `admin/` and `laerer/` have one.

- [ ] **Step 3: Bump the action counter**

In `src/app/action-guards.test.ts`, change `expect(allActions.length).toBe(79);` to `expect(allActions.length).toBe(81);`.

★ Bump it **once**, here, with the number in the commit message. Two more land in Task 12 and one in Task 13 — each bumps it again, deliberately, in its own task.

- [ ] **Step 4: Run the guards and typecheck**

```bash
cd ~/dev/iqra-portal && npx vitest run src/app/action-guards.test.ts 2>&1 | tail -6 && npx tsc --noEmit && echo "TSC OK"
```

Expected: PASS with 81 actions, then `TSC OK`.

- [ ] **Step 5: Commit**

```bash
cd ~/dev/iqra-portal && git add src/lib/varsler/queries.ts "src/app/(portal)/varsler/actions.ts" src/app/action-guards.test.ts && git commit -m "feat(varsler): the bell's DAL and its two actions

Labels resolve in two batched .in() reads under the caller's own RLS, never per
row — the literal reading of 'resolve through RLS' is an N+1. An entity the
reader cannot open is absent from the label map and its notification is
dropped, and that absence IS the access check: there is no per-row test to
forget for one row.

action-guards 79 -> 81."
```

---

## Task 12: The shell — the bell, the badge, and «Min profil»

**Files:**
- Create: `src/components/portal/VarselBell.tsx`
- Create: `src/app/(portal)/profil/page.tsx`
- Create: `src/app/(portal)/profil/actions.ts`
- Modify: `src/components/shell/PortalShell.tsx` (the ONE place all five roles pass through — not the four `*Nav.tsx` files; økonomi has none)
- Modify: `src/app/action-guards.test.ts` (counter **81 → 82**)

⛔ **«Ingen alarmstrøm til barn»** — locked in the demo-UI design spec and binding here: the **pupil** surface shows a quiet count, **never a red badge, never an interstitial**. This is a product rule, not a styling preference; a child opening a school app must not be met with an alarm.

Design law is unchanged: the locked "C · Familie" system (`src/app/globals.css`, `src/components/ui/`, `DESIGN.md` is the fasit).

⚠ **There is no existing unread-dot to reuse — measured 2026-08-05: zero matches for `size-2`, `h-2 w-2` or `rounded-full bg-` anywhere under `src/`.** An earlier draft said «reuse the existing unread-dot anatomy rather than inventing a badge», which resolved to «invent a badge» — the thing the same sentence forbade. The demo-UI elevation spec *specifies* that anatomy but nothing in the real build has needed it yet, so this is the first implementation: `size-2 rounded-full bg-primary`, defined here and reused later. Do use `PillLink` for nav entries — that one does exist (`src/components/ui/PillLink.tsx:77`).

- [ ] **Step 1: Write the bell**

Create `src/components/portal/VarselBell.tsx` as a **server** component reading `unreadCount()` and `listVarsler()`, rendering a link to the role's home with the count. Follow the existing list-row anatomy: truncated label, `tabular-nums` timestamp, chevron on every clickable row.

```tsx
import Link from 'next/link';
import { listVarsler, unreadCount } from '@/lib/varsler/queries';
import { formatDateTimeNb } from '@/lib/dates';

/**
 * ⛔ `quiet` is the pupil variant and it is a PRODUCT RULE, not a style knob:
 * «ingen alarmstrøm til barn». No red, no count-as-alarm, no interstitial —
 * a child opening a school app is not met with a warning colour.
 */
export async function VarselBell({ roleHome, quiet = false }: { roleHome: string; quiet?: boolean }) {
  const [count, varsler] = await Promise.all([unreadCount(), listVarsler(roleHome, 5)]);

  return (
    <section aria-label="Varsler" className="print:hidden">
      <h2 className="text-sm font-medium text-muted-foreground">
        Varsler{count > 0 ? ` (${count})` : ''}
      </h2>
      {varsler.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Ingen varsler nå.</p>
      ) : (
        <ul className="mt-2 divide-y">
          {varsler.map((v) => (
            <li key={v.id}>
              <Link href={v.href} className="flex items-center gap-3 py-2">
                {v.unread && !quiet ? (
                  <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                ) : null}
                <span className="min-w-0 flex-1 truncate">{v.label}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatDateTimeNb(v.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

✅ **Resolved, not left to the executor.** `src/lib/dates.ts:8` — `formatDateNb(isoDate)` builds `` `${isoDate}T12:00:00Z` ``, so a timestamptz yields an **Invalid Date and `Intl` throws**; the file says so itself at `:19-23`. `notifications.created_at` is a timestamptz, so the helper is **`formatDateTimeNb`** (`dates.ts:30`), which takes an instant. The earlier draft called `formatDateNb` and pointed at `dates.test.ts` to work out which was which — but that file asserts only the happy path for a bare date and says nothing about either question. ⚠ Still confirm the rendering under `TZ=UTC` (exit gate step 2).

- [ ] **Step 2: Write «Min profil»**

Create `src/app/(portal)/profil/actions.ts`:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { requireAnyRole } from '@/lib/dal/session';
import { createClient } from '@/lib/supabase/server';

/**
 * The e-mail-ping opt-out (spec §5.4).
 *
 * ⚠ This save is the reason 20260807121000 exists: profiles holds no
 * table-level UPDATE grant, so without `grant update (email_pings_enabled)`
 * this returns a 42501 that the user experiences as a form that does nothing.
 * 31_column_locks.sql asserts the grant, and it was watched fail without it.
 */
export async function setEmailPingsAction(enabled: boolean): Promise<void> {
  const { user } = await requireAnyRole(['admin', 'teacher', 'parent', 'student', 'economy']);
  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ email_pings_enabled: enabled })
    .eq('id', user.id);
  if (error) throw new Error(`Kunne ikke lagre varselinnstillingen: ${error.message}`);

  // ⛔ THE QUEUE MUST FOLLOW THE PREFERENCE, IN BOTH DIRECTIONS.
  // Writing only the profile column left two defects, both found by the panel:
  //   · opting OUT with a ping already queued → the claim still picked it up,
  //     the address would not resolve, and after five attempts the row was
  //     listed to an admin as «varsler som ikke kom fram» — a communications
  //     failure manufactured for someone who asked not to be mailed;
  //   · and it was ONE-WAY. `failed` survived opting back in, and a failed row
  //     is excluded from the claim forever, so a live opted-in user's mail was
  //     permanently dead with no signal anywhere. Turning a preference off and
  //     on again must never need an administrator.
  // The claim now also excludes opted-out users, so this call is what clears
  // the state they leave behind.
  const { error: queueError } = await supabase.rpc('sync_email_ping_preference', {
    enabled,
  });
  if (queueError) {
    throw new Error(`Kunne ikke oppdatere varselkøen: ${queueError.message}`);
  }
  revalidatePath('/profil');
}
```

✅ `requireAnyRole` returns `{ user, roles }`, so `user.id` is real here. ⚠ This is the line an earlier draft got wrong: with the old `requireRole([...])` it destructured a bare user, `user.id` was `undefined`, and the update matched zero rows — a toggle that saves nothing, which is exactly what Task 2's grant assertion exists to make impossible.

Create `src/app/(portal)/profil/page.tsx` — a server component reading the caller's own `email_pings_enabled` and rendering a form that posts `setEmailPingsAction`. Copy, verbatim:

> **Varsel på e-post**
> Vi sender en kort e-post når du har nye varsler i portalen. E-posten inneholder aldri opplysninger om barnet ditt — bare hvor mange varsler du har.
> Varsler i portalen slås ikke av. Denne innstillingen gjelder bare e-post.

- [ ] **Step 3: Put the bell and «Min profil» in the SHELL, not in the nav files**

⛔ **An earlier draft said «add the entry to each of the four `*Nav.tsx` files» with a trailing conditional about økonomi — and that conditional silently resolved to "no".** `src/app/(portal)/okonomi/` contains only `error.tsx`, `layout.tsx` and `page.tsx`; there is **no `OkonomiNav.tsx`**. So økonomi would have got no «Min profil» and no bell, contradicting the sentence two lines above it, which says they should. A conditional that quietly answers "no" is how a role gets dropped.

✅ **Measured 2026-08-05: all five layouts already render `@/components/shell/PortalShell`** — `admin`, `laerer`, `elev` and `forelder` pass a Nav as a child; `okonomi` passes none. That component is the one place every signed-in role passes through, so it is where a surface that belongs to every role goes.

Add `<VarselBell />` and the «Min profil» link inside `PortalShell` itself. Determine `roleHome` from the caller's roles there, so no per-role layout has to pass it.

⚠ **økonomi gets no *messaging* nav (D17) but does get the bell**, because economy receives school-wide announcements. Putting it in the shell makes that automatic rather than a thing to remember.

⛔ The pupil variant stays quiet: `PortalShell` passes `quiet` when the caller holds `student`. «Ingen alarmstrøm til barn» is a product rule, and it now has exactly one implementation site.

- [ ] **Step 4: Bump the counter and run the gate**

Change `expect(allActions.length).toBe(81);` to `82`.

```bash
cd ~/dev/iqra-portal && npx vitest run src/app/action-guards.test.ts 2>&1 | tail -5 && npx tsc --noEmit && npm run lint 2>&1 | tail -5
```

Expected: PASS with 82 actions, `TSC OK`, and lint clean (5 pre-existing warnings are the baseline).

- [ ] **Step 5: Verify it in the browser**

⚠ **Re-enrol MFA at `/mfa/registrer` first** — every `db reset` and `test:api` wipes it.
⚠ **Open the enrolment window or family lists are empty for the wrong reason (A14):**

```bash
cd ~/dev/iqra-portal && npx supabase db reset >/dev/null 2>&1 && psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -c "update public.class_students set enrolled_on = current_date - 7 where class_id = 'fc000000-0000-0000-0000-000000000001';"
```

⛔ **Put it back to `'2026-08-20'` before the next `npm run test:api`.**

Then, with `npm run dev` running: log in as the teacher, publish an announcement, log in as the parent, and confirm the bell shows it **immediately** (D26 — not after 15 minutes). Check 1280 and 375 widths, and confirm the pupil surface shows no red dot.

- [ ] **Step 6: Commit**

```bash
cd ~/dev/iqra-portal && git add src/components/portal/VarselBell.tsx "src/app/(portal)/profil" src/components/shell/PortalShell.tsx src/app/action-guards.test.ts src/lib/supabase/database.types.ts && git commit -m "feat(varsler): the bell and the opt-out, in the one shell all five roles share

Placed in PortalShell rather than in the four *Nav.tsx files, because okonomi
has no Nav file — so the per-nav version silently gave economy no bell and no
«Min profil», contradicting the rule that they receive school-wide
announcements.

The pupil variant is quiet by product rule — «ingen alarmstrøm til barn» — so
no red dot and no interstitial, which is a decision and not a style knob. In
the shell it has exactly one implementation site.

«Min profil» is the surface the ping opt-out lives on, and the copy says the
part that matters: turning it off stops the e-mail, never the varsel in the
portal, which is the source of truth.

action-guards 81 -> 82."
```

---

## Task 13: The admin health screen — «varsler som ikke kom fram»

**Files:**
- Create: `src/app/(portal)/admin/varsler/page.tsx`
- Create: `src/app/(portal)/admin/varsler/actions.ts`
- Create: `supabase/migrations/20260807125000_ping_health.sql`
- Modify: `src/app/(portal)/admin/AdminNav.tsx`
- Modify: `src/app/action-guards.test.ts` (counter **82 → 83**)

⛔ **Nothing currently observes whether the drain ran at all.** A cron that silently stops is indistinguishable from a quiet week — so this screen carries **two** numbers, not one: the failed ledger, and the **age of the oldest pending ping**. The second is the one that catches a dead cron.

- [ ] **Step 1: Write the health RPC**

Create `supabase/migrations/20260807125000_ping_health.sql`:

```sql
-- The admin health surface (D13, spec §11 task 12).
--
-- ★ TWO NUMBERS, BECAUSE ONE OF THEM CANNOT CATCH A DEAD CRON. A failed
-- ledger tells you which sends went wrong; it says NOTHING when the drain
-- stopped running, because a drain that never claims anything never fails
-- anything. oldest_pending_minutes is the number that goes up on its own when
-- nothing is draining, and it is the only observation in this phase that can
-- distinguish "a quiet week" from "the cron is dead".
--
-- private is not PostgREST-exposed, so this is a public definer projection.
-- It returns COUNTS AND AN AGE — never an address, never a name.
create or replace function public.email_ping_health()
returns table (failed_count integer, pending_count integer, oldest_pending_minutes integer)
language sql stable security definer set search_path = ''
as $$
  select
    (select count(*)::int from private.email_pings where failed),
    (select count(*)::int from private.email_pings where pending and not failed),
    (select coalesce(
       max(extract(epoch from (now() - p.next_attempt_at)) / 60)::int, 0)
       from private.email_pings p
      where p.pending and not p.failed and p.next_attempt_at <= now());
$$;

revoke execute on function public.email_ping_health() from public;
revoke execute on function public.email_ping_health() from anon;
revoke execute on function public.email_ping_health() from authenticated;
grant execute on function public.email_ping_health() to service_role;

comment on function public.email_ping_health() is
  'Counts and an age for the admin health screen — never an address, never a name. oldest_pending_minutes is the number that catches a DEAD CRON: a drain that never runs never fails anything, so the failed ledger alone cannot distinguish a quiet week from a stopped schedule.';

-- ── the failed ledger itself ────────────────────────────────────────
-- ⛔ TASK 13 PREVIOUSLY SPECIFIED A SCREEN THAT COULD NOT BE BUILT. It called
-- for a «Prøv igjen» button per failed row, and reset_failed_ping takes a
-- user_id — but nothing returned the user_ids, and `private` is not
-- PostgREST-exposed. Execution would have improvised an RPC under time
-- pressure, and the obvious improvisation ("the admin needs to know whom to
-- chase") returns the name or the address — exactly what the health function's
-- own comment forbids, on what is a per-family communications-failure ledger.
--
-- ★ SO THE SHAPE IS FIXED HERE, DELIBERATELY MINIMAL: an opaque user_id, an
-- error code and a timestamp. No name, no address, no pupil. An admin who
-- needs to identify the family resolves the id through the existing AUDITED
-- admin lookup, which leaves a record of having done so — rather than this
-- screen handing out identities to anyone who opens it.
create or replace function public.failed_email_pings()
returns table (user_id uuid, last_error_code text, attempts integer, failed_since timestamptz)
language sql stable security definer set search_path = ''
as $$
  select p.user_id, p.last_error_code, p.attempts, p.next_attempt_at
    from private.email_pings p
   where p.failed
   order by p.next_attempt_at desc;
$$;

revoke execute on function public.failed_email_pings() from public;
revoke execute on function public.failed_email_pings() from anon;
revoke execute on function public.failed_email_pings() from authenticated;
grant execute on function public.failed_email_pings() to service_role;

comment on function public.failed_email_pings() is
  'The admin ledger, deliberately minimal: an opaque user_id, an error code, an attempt count and a timestamp. NEVER a name, an address or a pupil — this is a per-family communications-failure list, and an admin who needs an identity must resolve it through the audited admin lookup so that the resolution itself is recorded.';

-- Clearing a failed ping so a corrected address gets one more chance.
-- ⚠ attempts resets to 0 and failed to false — this is the ONLY path back from
-- the ceiling, and it is a deliberate human act, never automatic.
create or replace function public.reset_failed_ping(target uuid)
returns void
language sql volatile security definer set search_path = ''
as $$
  update private.email_pings
     set failed = false, attempts = 0, last_error_code = null,
         next_attempt_at = now(), claimed_at = null, pending = true
   where user_id = target and failed;
$$;

revoke execute on function public.reset_failed_ping(uuid) from public;
revoke execute on function public.reset_failed_ping(uuid) from anon;
revoke execute on function public.reset_failed_ping(uuid) from authenticated;
grant execute on function public.reset_failed_ping(uuid) to service_role;
```

- [ ] **Step 2: Write the action and the page**

Create `src/app/(portal)/admin/varsler/actions.ts`:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminActor } from '@/lib/admin/quarantine';
import { createServiceRoleClient } from '@/lib/admin/quarantine';

/**
 * «Prøv igjen» for a ping that hit the attempts ceiling.
 *
 * requireAdminActor, not requireRole('admin') — the RPCs below are
 * service_role-only, so this action steps outside the caller's RLS and needs
 * the stronger guard the repo reserves for exactly that.
 */
export async function resetFailedPingAction(userId: string): Promise<void> {
  const actorId = await requireAdminActor();
  const admin = createServiceRoleClient();

  const { error } = await admin.rpc('reset_failed_ping', { target: userId });
  if (error) throw new Error(`Kunne ikke nullstille varselet: ${error.message}`);

  // ⛔ THE AUDIT ENTRY IS PART OF THE CONTRACT, NOT POLISH.
  // quarantine.ts:17-23 states it explicitly for anything acting FOR an admin:
  // re-verify AAL2, re-verify the role, and «write an audit entry describing
  // what was done». Every existing consumer does — src/lib/admin/users.ts:59,
  // 95 and 125 each insert into audit_log and THROW if the audit write fails.
  // This action re-queues school e-mail to a named family and is the only path
  // back from the attempts ceiling; without this, an admin can do it
  // repeatedly with no trace of who did it or to whom.
  // ⚠ Throwing on a failed audit write matches the house pattern: an action
  // that happened but was not recorded is worse than one that did not happen.
  const { error: auditError } = await admin.from('audit_log').insert({
    actor_id: actorId,
    action: 'admin.email_ping.reset',
    entity: 'email_ping',
    entity_id: userId,
  });
  if (auditError) {
    throw new Error(`Nullstillingen ble ikke revisjonslogget: ${auditError.message}`);
  }

  revalidatePath('/admin/varsler');
}
```

Create `src/app/(portal)/admin/varsler/page.tsx` — a server component that calls `email_ping_health()` through the service-role client, renders the three numbers, and lists failed rows with a «Prøv igjen» button per row. Include this sentence on the page, because it is what makes the second number actionable:

> Hvis «eldste ventende» vokser forbi et kvarter, kjører ikke jobben som sender varsler. Sjekk cron-loggen i Vercel.

- [ ] **Step 3: Bump the counter, run the gate**

Change `expect(allActions.length).toBe(82);` to `83`, and add the nav entry `{ href: '/admin/varsler', label: 'Varsler', exact: false }` to `AdminNav.tsx`.

```bash
cd ~/dev/iqra-portal && npx supabase db reset && npx supabase test db 2>&1 | tail -4 && npx vitest run src/app/action-guards.test.ts 2>&1 | tail -4 && npx tsc --noEmit && echo OK
```

Expected: pgTAP `Files=39, Tests=897, PASS`, action-guards PASS with 83, `OK`.

- [ ] **Step 4: Commit**

```bash
cd ~/dev/iqra-portal && git add supabase/migrations/20260807125000_ping_health.sql "src/app/(portal)/admin/varsler" "src/app/(portal)/admin/AdminNav.tsx" src/app/action-guards.test.ts && git commit -m "feat(varsler): the failed ledger, and the number that catches a dead cron

Two numbers, because the failed ledger alone cannot tell a quiet week from a
stopped schedule — a drain that never runs never fails anything. The age of the
oldest pending ping is the one that rises on its own, and the page says what to
do when it passes a quarter of an hour.

reset_failed_ping is the only path back from the attempts ceiling and it is a
deliberate human act, never automatic.

action-guards 82 -> 83."
```

---

## Task 14: Wall-3 — the fan-out through the real app path

**Files:**
- Create: `tests/api/notifications.test.ts`

⛔ **This is the task that exists because of plan 1's defect.** pgTAP inserts with bare `insert … values`; the app inserts through PostgREST, which emits `RETURNING "tbl"."col"` whenever the client calls `.select(...)` — and **PostgreSQL applies a table's SELECT policies as an extra `WITH CHECK` when a statement returns a column expression.** In plan 1 that made thread creation fail for *every* actor while **737 pgTAP assertions were green over it**, because the app's real statement shape was untested anywhere.

★ **The positive control is not optional.** In plan 2's api suite, under a total creation outage, seven of nine tests failed — including *«refuses a class the teacher does not teach»*, which would have stayed green without an in-test positive control. A negative assertion that passes because **nothing works at all** is the failure mode this file must be immune to.

- [ ] **Step 1: Write the suite**

Create `tests/api/notifications.test.ts` following `tests/api/threads.test.ts`'s structure exactly (`signInAsAAL2`, the seed emails, the cleanup discipline).

Cover, at minimum:

1. **Positive control, first in the file:** a teacher sends a message through the real path and the insert **succeeds**. If this fails, every negative below is meaningless — say so in the test name.
2. The parent's `notifications` row exists after that message, read **as the parent**, through PostgREST.
3. The sender has **no** row.
4. The parent marks it read through `markVarselReadAction`'s shape (`.update({read_at}).eq('id', …)`) and the row updates.
5. The parent's attempt to mark **another user's** notification read touches **0 rows** — paired with an entitled-reader control proving that row exists.
6. A forged `insert` into `notifications` from an authenticated client fails with **42501**.
7. An announcement published by a teacher produces the parent's notification **in the same request** (D26) — this is the assertion that proves the trigger fires through PostgREST, where the `RETURNING` shape is what plan 1 tripped on.
8. `GET /api/varsler/drain` with no `authorization` header returns **401 and not 307** — the proxy-exclusion assertion, which no pgTAP file can make.

- [ ] **Step 2: Restore the enrolment window before running**

⛔ If Task 12's browser pass moved `enrolled_on`, put it back first or this suite fails for the wrong reason:

```bash
cd ~/dev/iqra-portal && npx supabase db reset && npm run test:api 2>&1 | tail -12
```

Expected: the full api suite green, ~21 minutes, **silent until it finishes**. Baseline was 14 files / 369 tests; expect 15 files and 369 + your count.

⚠ The api suite is **not flaky — it is GoTrue session churn** (measured 2.2×), and it resets between runs. A single re-run is legitimate; a third is a real failure.

- [ ] **Step 3: ★ The positive control's own mutation**

Break creation deliberately — in `20260807123000_thread_fanout.sql`, change the notifications insert's `on conflict … do update` to `on conflict … do nothing` **and** drop the `where r.recipient <> new.sender_id` clause. Re-run.

Expected: test 2 fails, test 3 fails, and **test 1 still passes** — which is what proves test 1 is a control over creation and not a duplicate of the others. Restore and confirm green.

- [ ] **Step 4: Commit**

```bash
cd ~/dev/iqra-portal && git add tests/api/notifications.test.ts && git commit -m "test(varsler): the fan-out through PostgREST, with a positive control first

pgTAP inserts bare; the app inserts through PostgREST, which emits RETURNING
with a column expression — and Postgres then applies the SELECT policy as an
extra WITH CHECK. That is what made every thread creation fail in plan 1 under
737 green assertions, because no test used the app's real statement shape.

The positive control leads the file because in plan 2 a total creation outage
left 'refuses a class the teacher does not teach' green. A negative that passes
because nothing works at all is the failure this file is built against."
```

---

## Exit gate for plan 3

- [ ] **Step 1: Full suite from a clean database**

```bash
cd ~/dev/iqra-portal && npx supabase db reset && npx supabase test db 2>&1 | tail -4 && npm test 2>&1 | tail -4 && npx tsc --noEmit && npm run lint 2>&1 | tail -4 && npm run build 2>&1 | tail -8
```

Expected: pgTAP `Files=39, Tests=897` · unit 600 + the new files · typecheck 0 · lint 0 errors (5 pre-existing warnings) · build clean with `/api/varsler/drain` listed.

- [ ] **Step 2: ★ Run the timezone-sensitive tests under `TZ=UTC`**

```bash
cd ~/dev/iqra-portal && TZ=UTC npx vitest run src/lib/varsler src/lib/dates.test.ts 2>&1 | tail -6
```

⛔ **This machine is Europe/Oslo and production is UTC.** Plan 2 measured a mutation that was **green here and red under `TZ=UTC`** — a defect that ships invisibly on exactly the machine where the feature gets clicked. Anything touching `created_at` rendering must pass here.

- [ ] **Step 3: `knip`**

```bash
cd ~/dev/iqra-portal && npx knip 2>&1 | tail -10
```

Expected: at baseline. ⚠ `scripts/fiken-probe.mjs` is untracked and is why knip fails locally but passes in CI — ignore only that entry.

- [ ] **Step 4: The mutation ledger**

Every mutation named in tasks 1–14 must have been **watched fail and watched restore**. Record the table in the final commit message, and **state explicitly which were skipped and why** — a silent omission reads as coverage.

- [ ] **Step 5: `web-design-guidelines` audit**

Run the audit skill over `VarselBell.tsx`, `profil/page.tsx` and `admin/varsler/page.tsx` before declaring the visual work done.

- [ ] **Step 6: Human walkthrough**

⚠ **MFA enrolment is wiped by every `db reset` and every `test:api` run.** Re-enrol at `/mfa/registrer` first. Then, per role:

| Check | Why it is on this list |
|---|---|
| Teacher publishes an announcement; parent's bell shows it **immediately** | D26 — the whole point of the trigger over the drain |
| Teacher sends a message; parent's bell shows the thread, **teacher's own does not** | the sender-exclusion, the most obvious thing to get wrong |
| Ten messages in one thread → **one** bell entry | D25's coalescing, visible only here |
| Pupil surface has **no red dot** | «ingen alarmstrøm til barn» is a product rule |
| «Min profil» toggle **saves and survives a reload** | the 42501-that-looks-like-nothing the column grant exists to prevent |
| Admin health screen at 1280 **and** 375 | the two widths the design system is checked at |
| `curl` the drain with no header → **401, not 307** | the proxy exclusion, again, in the deployed shape |

---

## ⛔ Carried to plan 4 — do not lose these

1. **The real-delivery check (D28).** Confirm against a genuine delivered message that Resend's link-rewriting and open-tracking are **off**. `ping-email.test.ts` asserts over the template *before* the provider touches it and **structurally cannot** catch this. Needs IQRA's account and `varsler.iqrasenter.no`.
2. **`CRON_SECRET` and `RESEND_API_KEY` in Vercel** before the first deploy. Without the first the drain 401s forever; without the second every ping ledgers as `NO_API_KEY`.
3. **The `notifications` orphan sweep.** `entity_id` has no FK, so rows survive their entity. Phase 7's retention job must sweep them explicitly — the analogue of `private.storage_orphans`.
4. **`private.email_pings` has no retention rule at all.** One permanent row per user, forever, including for users who leave.
5. **The Phase-2/3/4 emitters still do not exist** (absence → teacher, grade → family, assignment → family). Both phases deferred their pings to «Phase 5 owns pings»; plan 3 built the substrate and the two emitters this phase owns. That is a **partial delivery of what two earlier phases promised** — say it out loud rather than let it be discovered.
6. **`.delete().select(…)` fails SILENTLY** (0 rows, no error) and is live at four sites — still unfixed, still its own task.
7. **Rate limiting.** Nothing stops a parent sending 500 messages, and each one now bumps a watermark. `private.login_attempts` is the precedent if it becomes real.

---

## Review ledger — 2026-08-05, author's own pass

CLAUDE.md requires a review of the plan itself before a line is executed, on the reasoning that a design bug in a plan is copied faithfully into every task that follows it. This pass ran cold against the tree, not against the plan's internal consistency. **Seven defects, all fixed above.**

| # | Defect | Why it mattered |
|---|---|---|
| **R1** | `plan(14)` in Task 1 against **15** hand-counted assertions, and every downstream `plan()` and running total wrong in cascade | pgTAP fails the file on a plan mismatch, so Task 1 would not have committed. The spec's own rule — *never count `plan()` by grep* — was written for exactly this. |
| **R2** | Task 1's «en annens varsel er urørt» read the row back **as the user the policy hides it from** | `select` returns no rows → `is(null, true)` fails. It would have read as an RLS bug in code that was correct, and the likely "fix" is loosening the policy. |
| **R3** | Task 3 asserted `unread_count = 1` for a user whose only notification **assertion 7 had already marked read** | The count is 0. A fixture that does not say what the assertion means. |
| **R4** | `claim_due_announcements` called the side-effecting fan-out **from a `WHERE` clause** | A volatile function in `WHERE` carries no guarantee of one evaluation per row. An announcement could be stamped `fanned_out_at` with nobody notified — and the partial index would never serve it again. Now an explicit `for … loop`. |
| **R5** | Task 6's fingerprint entries used a `(function, predicate)` **pair** shape | The real table is `('schema.fn(argtypes)', array[…markers…])`, the name carries its signature, and the counter counts **markers**, not rows. The five entries as written would not have compiled; the counter arithmetic (83 → 88) was also wrong — it is **93**. |
| **R6** | ★ **The announcement fan-out belled every admin on every class notice** | `private.reads_announcement_row`'s second clause is `or private.has_role(uid, 'admin')`, so an admin reads *everything*. The spec asserted announcements had «no analogue of bare oversight to subtract»; **the tree says the opposite**. At ten classes that is ~ten unwanted bells a week, diluting the one surface D12 made load-bearing. Fixed with a carve-out that keys on the **relationship, not the role** (D24's lesson), so an admin who is also a guardian still hears about their own child. |

| **R7** | Every verification command used `npm run test:db` and `npm run test:unit` — **neither script exists** | Measured: `npm error Missing script: "test:db"`. Ten occurrences, including Task 0's baseline step. An executor would have hit it on the first command of the first task. The pgTAP suite has no npm wrapper at all; it is `npx supabase test db`, and the unit suite is plain `npm test`. ⚠ I wrote these from memory of the project rather than from `package.json` — the exact failure this ledger's other six entries are about, committed while writing the ledger about them. |

★ **Five of the seven are the same species: a claim about the repo that was true of the spec and false of the tree.** R6 is the one that would have shipped — it is behaviour, not a test error, and no assertion existed that could have caught it because the plan had not thought to write one. Assertion 35 now exists and has a named mutation.

★ **R4 is the one worth generalising.** It reads correctly, it would pass every test in this plan on most runs, and it fails only under a planner decision nobody controls. The class — *a side effect placed where SQL only promises a value* — is invisible to both review-by-reading and test-by-running.

**Not fixed, recorded instead:** D29 (the fan-outs depend on `postgres` holding `BYPASSRLS`, which a contemplated hardening step would remove) and the announcement-invariant restatement, which drifts only in the narrowing direction and is stated as such.
