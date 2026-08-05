# Phase 5 Plan 2 — Announcements and the Scheduled Publish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the school's notice board — school-wide and class announcements, published now or scheduled for later, with read-tracking the office can act on — where a family's entitlement is resolved **as of the moment of publication**, not as of today.

**Architecture:** One row-shaped SECURITY DEFINER predicate (`private.reads_announcement_row`) is the only authority on who reads an announcement; the SELECT policy calls it with the row's own columns, so `insert … returning id` cannot deadlock against it. The as-of roster is two new `private` helpers that spell the house's half-open enrolment interval a ninth and tenth time and are asserted where the other eight are. `published_at` is client-writable **forward only**, enforced by a two-column CHECK rather than by a policy no `with check` could express.

**Tech Stack:** Postgres 17.6 + Supabase (RLS, pgTAP), Next.js 16 App Router (server components, server actions), TypeScript strict, zod 4, vitest (unit + api), Tailwind v4.

---

## Scope of this plan

This is **plan 2 of 4** for Phase 5. It covers spec §11 items **2** and **3b**, plus the announcement halves of §7's four role surfaces.

**In scope:** `public.announcements` · `public.announcement_reads` · the as-of audience predicate (D9) · `published_at <= now()` and the draft/published boundary (D8) · read-tracking (D10) · the `fanned_out_at` claim that a scheduled publish needs (§11 3b) · teacher / parent / pupil / admin `oppslag` surfaces · the wall-1 api suite.

**Not in this plan** — each has its own plan:

- Plan 1 (**done**, `feat/phase-5-meldinger`, 12 commits): threads and messages.
- Plan 3: `notifications`, `private.email_pings`, the drain route, Resend, «Min profil», the varsel bell (§11 items 3, 8, 8b, 8c, 9, 9b, 13).
- Plan 4: the invite/credential flow (§11 15-series), document reconciliation (14), the exit gate (16-series).

⚠ **Do not add a notification fan-out in this plan.** `announcements` gets its `fanned_out_at` stamp trigger here and nothing else. A fan-out written here would reference `public.notifications`, which plan 3 creates. **Task 5's claim function is the extension point plan 3 uses** — read its comment before writing plan 3.

⚠ **Do not add announcements to `supabase/seed.sql`.** `announcements.class_id` is `on delete restrict`, and **23 pgTAP files run `delete from public.classes` in their teardown**. A single seeded announcement row would raise `23503` in all 23 and abort each file before assertion 1 — the same shape as the `assignments` trap the panel caught in plan 1, multiplied by 23. Data for the human walkthrough is created through the UI, which exercises the create path anyway.

### pgTAP file numbers and fixture prefixes — read before creating a file

Plan 1 took **35** and **36** with prefixes `be` and `bf`. This plan claims **37** with prefix **`c0`**. Plan 3 takes 38 with `c1`.

| File | Prefix | Plan |
|---|---|---|
| `supabase/tests/37_announcements_rls.sql` | `c0` | this plan, Tasks 1, 4, 5 |
| `supabase/tests/38_notifications.sql` | `c1` | plan 3 |

**Verified 2026-08-06:** highest existing file is `36_thread_counterparts.sql`; prefixes in use across `supabase/tests/*.sql` are `00, 11, 22, 44, 66, a5–a9, aa, ad–af, b1–bc, bd, be, bf, cc, cd, ce, f6, f8, f9, fb, fc, fe`; `c0`, `c1`, `c2`, `c3` are all free in both tests and migrations.

⚠ The spec's §8 has now been wrong about file numbers **twice**, both times because something landed between spec and execution. **Before creating the file, run `ls supabase/tests/ | tail -3` and confirm 37 is still free.** If it is not, take the next free one and correct this table rather than overwriting.

### Migration timestamps

Current head is `20260805123000` (`select max(version) from supabase_migrations.schema_migrations`). This plan adds three:

| File | Task |
|---|---|
| `supabase/migrations/20260806120000_announcements.sql` | 1 |
| `supabase/migrations/20260806121000_announcement_read_status.sql` | 4 |
| `supabase/migrations/20260806122000_announcement_fanout_claim.sql` | 5 |

If the head has moved past these, bump all three by a day and keep their relative order.

---

## The decisions this plan makes, and why

The spec left these open, contradicted itself, or is contradicted by the tree. Each is decided here, once, so no task has to invent it.

### A1 — `published_at` is client-writable at INSERT. Back-dating is closed by a CHECK, not by a grant.

**The contradiction.** Spec D8 buys scheduled publishing from `published_at <= now()` ("publiser lørdag 07:00"), §7 gives `admin/oppslag` "scheduling", and §11 3b is the scheduled-publish fan-out — while §2.2 says `published_at` is "server-defaulted and ungrantable" and T-19 asserts `has_column_privilege(…,'published_at','INSERT') = false`. **Both cannot be true: with no INSERT grant there is no way to set a future publication time, and scheduling is unbuildable.**

**The decision.** `grant insert (… published_at …)`, and add

```sql
constraint announcements_not_backdated check (published_at >= created_at)
```

`created_at` is `not null default now()` and is **not** granted, so it is always the true insert instant. The constraint therefore says exactly one thing: *an announcement may be scheduled forward, never back-dated.* Forward is the feature; backward is the only direction that changes who reads (it widens the as-of audience to families who have since left). **`published_at` remains ungrantable at UPDATE** — T-19's UPDATE half stands unchanged.

**What changes in the spec's test list.** T-19's INSERT half becomes a *behavioural* assertion — a past `published_at` raises **`23514`**, paired with a future one living — which is strictly stronger than the privilege probe it replaces, because the privilege probe could not distinguish the two directions at all.

⚠ **Consequence the action must handle:** for an *immediate* publish the client must **omit** `published_at` and let the default fire. Sending a client-computed `now()` races the server's by milliseconds and yields a `23514` on a legitimate publish.

### A2 — A scheduled announcement cannot be rescheduled. Its author may withdraw it.

`published_at` has no UPDATE grant (A1), so a mis-scheduled announcement cannot be moved. Postgres RLS cannot express "this column is editable only while the row is unpublished" — column-level authorization is the **grant** layer, and grants have no predicate.

Rather than add a BEFORE UPDATE trigger for it, this plan adds a second DELETE policy:

```sql
create policy "announcements_delete_own_unpublished" …
  using (created_by = auth.uid() and published_at > now() and writes_announcement(…))
```

A not-yet-published announcement has been read by nobody by construction, so withdrawing it destroys no record. A **published** one stays admin-delete-only, which is the spec's rule. Reschedule = withdraw and re-create.

### A3 — The read-tracking denominator is the as-of roster, not the live one.

«12 av 28 har lest» computed over today's roster counts families that `reads_announcement_row` refuses to show the row to. The denominator is the same set the read predicate admits: the roster **as of `published_at`**.

### A4 — Protected pupils are **included** in the read-tracking list, and the denominator is **not** reduced. This reverses spec §7.

§7 transposes the 2026-08-03 mate-name rule onto this list. The transposition is wrong, and the tree says so in two places:

- `20260717164230:4-6` — *"protected («skjermet») deliberately changes NO policy in this phase: every teacher/admin/family read that exists today already applies to protected students (own teacher's roster + admin + the child's own family…)"*.
- `20260803001000:29-31` — *"«Skjermet» stays the staff-only term on the six staff surfaces that use it. **Staff are entitled to know a child is protected; other families are not**, in any wording."*

The mate-name omission is a **cross-family** rule: it stops a parent learning that another family's child is under protection. The read-tracking list is reachable only through `private.writes_announcement`, i.e. **admin or that class's own teacher** — the people who already see the pupil on their roster and already see the «Skjermet» marker. Omitting the row there hides from the office precisely the family it most needs to phone, and buys no privacy from anyone.

**Pinned by a witness assertion** (a protected pupil is present in `announcement_read_status` for their class's teacher) so nobody "fixes" it back on the strength of §7's sentence.

### A5 — The read-tracking unit is the pupil (the family), not the user.

A read counts if **any** of the pupil's guardians, or the pupil's own login, has an `announcement_reads` row. Counting users would put a two-guardian family twice in the denominator and send the office chasing a parent who has already read.

### A6 — Read-tracking covers school-wide announcements too.

Same function, one extra clause: for `class_id is null` the roster is every pupil with an as-of enrolment in **any** class at `published_at`. The school-wide case is the one where "who has not seen it" is most valuable, and it is one `or` rather than a second function.

### A7 — What plan 2 delivers of §11 3b, what plan 3 must do with it, and what it must not do.

`announcements.fanned_out_at`, a BEFORE INSERT trigger that stamps it for rows published immediately, and `public.claim_due_announcements()` — a SECURITY DEFINER claim granted to `service_role` **only**. Nothing calls it yet.

⚠ **Plan 3 must put the notification INSERT inside that function's body**, not in the route handler that calls it. The claim stamps `fanned_out_at`; if the fan-out is a separate round-trip, a crash between them leaves an announcement marked as fanned out with no notifications, and the partial index will never serve it again. The function's own comment says this.

⚠ **The stamp at INSERT is what stops plan 3 retro-fanning.** Without it every announcement created between plan 2 and plan 3 has `fanned_out_at is null`, and the drain's first run would fan out the entire history in one statement.

★ **And one measured cost that plan 3 will hit and this plan will not — recorded here because this is where the predicate is defined.** These predicates are SECURITY DEFINER with `set search_path = ''`, which means PostgreSQL **cannot inline them**: the planner emits one function call per row scanned, at roughly 20 buffer hits and ~2 ms per candidate on the dev host. So D21's rule — *the fan-out must CALL the read predicate, not re-derive it* — must be implemented as **narrow first, then filter**: resolve the candidate set from the class roster as of `published_at` (plus admins), and let `reads_announcement_row` decide over that. A recipient query shaped as `select p.id from public.profiles p where private.reads_announcement(p.id, …)` is O(school roll) definer invocations **inside the announcement INSERT's own transaction**, which makes publishing a school-wide notice slow in proportion to the school. The predicate still decides; it just is not also the thing doing the scanning.

### A7b — the two tables plan 3 creates are safe from the `RETURNING` hazard, and must not be "hardened" into row forms.

Recorded here because plan 3 will be written by someone who has just read this plan's row-form argument and may over-apply it:

- **`notifications_select_own`** is `user_id = auth.uid()` — a plain column on the row — and rows are written **only** by a definer trigger owned by `postgres` (BYPASSRLS), so no policy runs at INSERT at all. Two independent reasons; neither needs a row form.
- **`private.email_pings`** has no RLS and is reachable only through `public` definer RPCs granted to `service_role`. There is no policy to be self-referential.

### A8 — The as-of cast is `(pub at time zone 'Europe/Oslo')::date`, inside the helper.

`published_at` is a `timestamptz`; `class_students.enrolled_on`/`left_on` are `date`. A bare `::date` casts in the **session** time zone, and production runs UTC — so an announcement published at 00:30 Oslo resolves to the *previous* calendar day, and a family whose `left_on` is that day reads a notice published after they left. Every other date/time decision in this repo pins Europe/Oslo (`src/lib/dates.ts` does it six times); the SQL must too.

File 34's own Phase-5 note asks for `published_at::date`. **That note is one clause short**, and this plan supplies the missing clause with an assertion that reddens without it.

### A9 — Two new `private` as-of helpers, not an inlined predicate.

`private.guardian_in_class_asof(uid, cid, pub)` and `private.student_in_class_asof(uid, cid, pub)`. `34_enrollment_boundary.sql` asserts **functions**; an inlined predicate could not be asserted beside the other eight, which is exactly what M3's note asks for.

### A10 — The read predicate is written in ROW form, and its parameters are deliberately misnamed.

`private.reads_announcement_row(uid, cls, pub, author)` is the source of truth and never queries `public.announcements`. `private.reads_announcement(uid, aid)` is a thin by-id lookup for the one policy that has only an id.

**Why.** Plan 1 lost a night to this: PostgreSQL applies a table's SELECT policies as an extra `WITH CHECK` when a statement returns a **column expression**, and PostgREST emits `RETURNING "tbl"."col"` the moment a client calls `.select(…)`. A SELECT policy that resolves the row by re-querying its own table cannot see the row its own command is inserting, so every create fails 42501 while the predicate evaluates true — and 737 pgTAP assertions stayed green over it, because every INSERT assertion in the suite was a bare `insert … values`.

`announcements_select_audience` therefore uses the **row form**. And **one pgTAP assertion in this plan uses `insert … returning id`**, not a bare insert (Task 1, §E).

⚠ **The parameters are named `cls`, `pub`, `author` — not `class_id`, `published_at`, `created_by` — on purpose.** `pg_get_functiondef` renders the parameter list, so a fingerprint marker matching a parameter name is satisfied by the header regardless of the body. That is finding F1 from plan 1's panel: the marker `'kind'` became unfailable the moment `kind` was a parameter name.

### A11 — A read is recorded in the DAL, on the read, for every reader.

The house precedent is `adminListAuditLog` (`src/lib/admin/audit-log.ts:27`) and `admin.threads.viewed` — a GET that writes, because the write **is** the record of the read. No client component, no extra server action.

Recorded for staff too, deliberately: one code path with no role branch to forget, and `announcement_read_status` derives the family signal from a guardian/login join, so a teacher's row is inert.

### A12 — Refusals are asserted by EFFECT, never by `throws_ok`, for DELETE and UPDATE.

Measured in plan 1: a guardian's refused DELETE returns `OK rows=0` — **DELETE refusals under RLS are filtered, not raised**, and an UPDATE whose `using` excludes the row is likewise a no-op. Assert the survivor count or the unchanged column. `throws_ok` is correct only for INSERT (`with check` raises) and for grant refusals.

### A13 — `okonomi` gets no announcement surface in this plan.

D17 includes economy in school-wide announcements, and the policy does admit them (`cls is null` admits any authenticated user). But `src/app/(portal)/okonomi/` is `layout.tsx` + `page.tsx` + `error.tsx` with **no nav component**, so there is nowhere to put a route without inventing one. The policy is right; the surface is missing. Recorded in «what this plan deliberately leaves broken».

---

## File structure

**Created:**

| File | Responsibility |
|---|---|
| `supabase/migrations/20260806120000_announcements.sql` | Both tables, indexes, comments, grants, RLS enable+force, the audit trigger, the `fanned_out_at` stamp trigger, five `private`/`public` predicates, seven policies. One file: RLS without policies denies everything, and policies without predicates do not compile. |
| `supabase/migrations/20260806121000_announcement_read_status.sql` | `public.announcement_read_status(uuid[])` — the read-tracking projection, caller bind inside the `where`. |
| `supabase/migrations/20260806122000_announcement_fanout_claim.sql` | `public.claim_due_announcements()` — the scheduled-publish claim, `service_role` only. |
| `supabase/tests/37_announcements_rls.sql` | The audience wall, the creation binds, the update pins, read-tracking, the claim, the delete pair. |
| `src/lib/dal/announcements.ts` | Every announcement read plus the read recording. One module: these reads share the class-name and read-status batching and must not drift. |
| `src/lib/validation/announcements.ts` | Zod schemas for the two write paths. |
| `src/lib/announcement-audience.ts` + `.test.ts` | `audienceLabel(classId, className)`. One function, two consumers, one test — because keying the «Hele skolen» label on the class *name* mislabels every past class notice the morning after a term rollover. |
| `src/components/announcements/AnnouncementList.tsx` | Shared list rendering; used by all four surfaces. |
| `src/components/announcements/AnnouncementBody.tsx` | Shared detail rendering (title, meta line, body). |
| `src/components/announcements/ReadStatus.tsx` | «N av M har lest» + the unread-family list. Staff surfaces only. |
| `src/app/(portal)/laerer/oppslag/page.tsx` + `[announcementId]/page.tsx` + `ny/page.tsx` + `ny/NewAnnouncementForm.tsx` + `actions.ts` | Teacher surface. |
| `src/app/(portal)/forelder/oppslag/page.tsx` + `[announcementId]/page.tsx` | Parent surface. |
| `src/app/(portal)/elev/oppslag/page.tsx` + `[announcementId]/page.tsx` | Pupil surface. |
| `src/app/(portal)/admin/oppslag/page.tsx` + `[announcementId]/page.tsx` + `ny/page.tsx` + `ny/NewSchoolAnnouncementForm.tsx` + `actions.ts` | Admin surface, including school-wide and scheduling. |
| `tests/api/announcements.test.ts` | Wall-1: creation entitlement with a positive control, the enumeration-quiet `null`, the read recording, the filtered delete. |

**Modified:** `supabase/tests/34_enrollment_boundary.sql` (Task 2) · `supabase/tests/31_column_locks.sql` (Task 3) · `supabase/tests/29_definer_fingerprints.sql` (Task 6) · `src/lib/supabase/database.types.ts` (regenerated, every migration task) · the four `*Nav.tsx` files · `src/app/action-guards.test.ts` (the action count, once per task that adds actions).

---

## Standing rules for every task in this plan

1. **Tests and implementation land in ONE commit.** The tables do not exist beforehand, so a test-only commit is a red build and violates "each commit compiles and passes tests" (spec §11). Red-first happens in the working tree and is evidenced by the mutation step, not by a committed red build.
2. **Every new assertion must be watched fail** under a named mutation of the code it guards, and pass again after restore. Phase 4 shipped four assertions that survived replacing the guarded function body with `select true`.
3. ★ **Verify every mutation restore by diffing the object definition**, not by trusting that the restore command ran. Three separate harness failure modes appeared in plan 1's execution, each producing output that read as a pass: a restore that silently no-opped (`psql -f <host path>` inside `docker exec` resolves **in the container**), a mangled file that produced no test lines at all, and a fix whose test flaked 1 run in 6. After every restore:
   ```bash
   docker exec supabase_db_iqra-portal psql -U postgres -q -t -A \
     -c "select md5(pg_get_functiondef('private.reads_announcement_row(uuid,uuid,timestamptz,uuid)'::regprocedure));"
   ```
   and compare against the pre-mutation value.
4. **Never count `plan()` by grep** — it undercounts multi-line calls. Let pgTAP tell you: a wrong count prints `Looks like you planned N but ran M`. Every `plan(N)` in this document is a **prediction**; if pgTAP reports a different number, set `plan()` to what pgTAP reports and correct this document.
5. **Run a single pgTAP file** with stdin redirection, never `-f <path>`:
   ```bash
   docker exec -i supabase_db_iqra-portal psql -U postgres -q -f - < supabase/tests/37_announcements_rls.sql
   ```
6. **Never write `information_schema` queries that filter `table_name` without `table_schema`.** Supabase ships a `realtime.messages` table, and four existing assertions in `31_column_locks.sql` are a live trap for exactly this reason. Use the `has_table_privilege` / `has_column_privilege` / `has_any_column_privilege` family, which takes a schema-qualified regclass and cannot collide. And note that **`has_table_privilege` is blind to column grants** — when the claim is "no privilege of any shape", use `has_any_column_privilege`.
7. **`db reset` and `test:api` wipe MFA enrolment.** Staff routes sit behind AAL2, so after any reset the human must re-enrol at `/mfa/registrer` before clicking anything. Budget it.
8. **Stage explicit paths, never `git add -A`.** `scripts/fiken-probe.mjs` and everything untracked under `docs/` belongs to a parallel economy track. ⚠ **Two sessions share this checkout and this Supabase stack.** While this plan was being written, another session committed `3f67907` on top of the branch and cleaned three files that were dirty when Task 0's baseline was drafted. Re-run `git log --oneline -3` and `git status` before every task, and treat any before/after measurement taken while a foreign `vitest` or `supabase` process is running as contaminated.
9. **Commit messages:** conventional subject + a substantial «why» body. **No AI trailers** — CLAUDE.md forbids them and overrides the harness default.
10. **`knip` fails unused exports at ERROR level** (`knip.json` downgrades only `types` and `enumMembers`). Every export lands in the same commit as its first consumer.
11. ⚠ **`private.is_staff` must never be used in this phase** — it admits `economy` (D17).
12. **zod is 4.4.3.** Use `uuidField` from `src/lib/validation/school.ts` (it is `z.guid`, not `z.uuid` — the seed's readable UUIDs fail the RFC variant nibble). Date helpers are in `src/lib/dates.ts`, **not** `format.ts`; `formatDateNb` throws on a timestamptz, so it is always `formatDateNb(osloDateOf(ts))` or `formatDateTimeNb(ts)`.
13. **There is no `audit()` helper.** Audit rows are a literal service-role insert, and `createServiceRoleClient` never leaves `src/lib/admin/` (`quarantine.ts`). This plan writes no audit rows from TypeScript; the `announcements` audit trigger covers the phase's needs.

---

## Task 0: baseline — measure it, do not inherit it

**Files:** none.

- [ ] **Step 1: Record the numbers this plan is measured against**

```bash
cd ~/dev/iqra-portal
git status --short
docker exec supabase_db_iqra-portal psql -U postgres -q -t -A -c "select max(version) from supabase_migrations.schema_migrations;"
ls supabase/tests/ | tail -3
supabase test db --local 2>&1 | tail -5
npm test 2>&1 | tail -5
npm run test:api 2>&1 | tail -5
```

Write the five numbers down: migration head, highest test file, pgTAP `Files=/Tests=`, unit `passed`, api `passed`. Every later task's expected total is *this baseline plus the delta stated in the task*.

⚠ Plan 1's ledger reports `pgTAP 37 files / 741 assertions` at its final gate, while the sum of the committed `plan(N)` values is **734**. The difference is the uncommitted edits to files 29/35/36. **Do not reconcile the two — measure.** A plan's counts are claims, and the last four review rounds on this project were all won by checking a claim against the repo.

- [ ] **Step 2: Confirm the three facts Task 1 depends on**

```bash
docker exec supabase_db_iqra-portal psql -U postgres -q -t -A -c "select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('has_role','teaches_class','audit_row_change','set_updated_at') order by 1;"
docker exec supabase_db_iqra-portal psql -U postgres -q -t -A -c "select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='public.class_students'::regclass;"
grep -n "student_user_id" supabase/tests/34_enrollment_boundary.sql | head
```

Expected: all four functions present · `class_students_one_active` is `UNIQUE (student_id) WHERE (left_on IS NULL)` · file 34's pupils do carry `student_user_id`. If the last is absent, Task 2's pupil-arm assertions need the column added to that file's fixture — say so rather than skipping them.

---

## Task 1: `announcements` + `announcement_reads` — schema, predicates, policies, pgTAP 37

**Files:**
- Create: `supabase/migrations/20260806120000_announcements.sql`
- Create: `supabase/tests/37_announcements_rls.sql`
- Modify: `src/lib/supabase/database.types.ts` (regenerated)

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260806120000_announcements.sql`:

```sql
-- Announcements — the school's notice board (D8, D9, D10, D17).
--
-- ONE nullable column carries both audience and authority: class_id null means
-- the whole school and is admin-only to write; a non-null class_id is writable
-- by that class's teachers and by admin.
--
-- ★ THE AUDIENCE IS RESOLVED AS OF published_at, NOT AS OF TODAY (D9). Live
-- membership would show a November joiner every September notice, and would
-- silently retract a family's own history the day the term rollover stamps
-- left_on. This is the NINTH and TENTH site of the house's half-open enrolment
-- interval [enrolled_on, left_on) — see 34_enrollment_boundary.sql, which
-- exists because widening that interval in all eight earlier sites at once
-- left 663 of 663 assertions green.
--
-- ★ AND THE CAST IS PINNED TO Europe/Oslo. published_at is a timestamptz;
-- enrolled_on/left_on are dates. A bare ::date casts in the SESSION time zone,
-- and production runs UTC — so a notice published at 00:30 Oslo would resolve
-- to the PREVIOUS calendar day, and a family whose left_on is that day would
-- read a notice published after they left. Every helper in src/lib/dates.ts
-- pins Europe/Oslo for the same reason.
--
-- ★ published_at IS CLIENT-WRITABLE AT INSERT, AND THAT IS DELIBERATE.
-- The spec asked for scheduled publishing AND for an ungrantable published_at;
-- those are mutually exclusive, because a future publication time can only be
-- set by writing the column. The risk the column actually carries is
-- BACK-dating — it is the only direction that changes who reads, by widening
-- the as-of audience to families who have since left. announcements_not_backdated
-- expresses exactly that, comparing published_at against created_at, which is
-- NOT granted and therefore always the true insert instant. No `with check`
-- predicate could do this: at INSERT it has no other timestamp to compare
-- against. published_at stays ungrantable at UPDATE.
--
-- audit_row_change writes ids and changed column NAMES only, never values
-- (verified in 20260717164230:139-168).

create table public.announcements (
  id            uuid primary key default gen_random_uuid(),
  -- ⚠ RESTRICT, not cascade: an announcement is a record of what the school
  -- told a family, and a class deletion must not silently take it. The cost is
  -- real and belongs in the ledger: deleting a class that has ever been
  -- announced to now raises 23503 in deleteClassAction
  -- (src/app/(portal)/admin/klasser/actions.ts:87).
  class_id      uuid references public.classes (id) on delete restrict,
  title         text not null check (char_length(title) between 1 and 140),
  body          text not null check (char_length(body) between 1 and 4000),
  published_at  timestamptz not null default now(),
  fanned_out_at timestamptz,
  created_by    uuid not null references public.profiles (id) on delete restrict,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint announcements_not_backdated check (published_at >= created_at)
);

create index announcements_class_published_idx
  on public.announcements (class_id, published_at desc);
create index announcements_published_idx
  on public.announcements (published_at desc);
-- The scheduled-publish queue (task 5). Partial, because the rows that matter
-- are the handful not yet announced, never the whole history.
create index announcements_pending_fanout_idx
  on public.announcements (published_at) where fanned_out_at is null;

comment on table public.announcements is
  'Oppslag. class_id null = hele skolen (admin only); non-null = that class (its teachers + admin). The read audience is resolved AS OF published_at (D9), not live — a family reads what was published while they were enrolled. Loosening that to live membership is one clause, and it would retract a family''s own history on term-rollover day.';
comment on column public.announcements.published_at is
  'Decides the READ AUDIENCE via private.reads_announcement_row, and is therefore the security-relevant column on this table. Client-writable at INSERT so an announcement can be SCHEDULED; announcements_not_backdated refuses any value earlier than created_at, which is the only direction that widens the audience. NOT writable at UPDATE — see 31_column_locks.sql.';
comment on column public.announcements.fanned_out_at is
  'Notification idempotence marker, owned by the trigger below and by public.claim_due_announcements(). Stamped at INSERT when the row is published immediately, left NULL when it is scheduled — so `fanned_out_at is null` means "scheduled and not yet announced" and the partial index above IS the queue. ⚠ It does NOT gate reading: a scheduled announcement becomes readable at published_at whether or not anything ever claims it.';

create table public.announcement_reads (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (announcement_id, user_id)
);
comment on table public.announcement_reads is
  'D10: read-tracking, not acknowledgement. There is no «jeg bekrefter» button and no requires_ack column — an acknowledgement the school does not chase is worse than none, and one it does chase is a job nobody has volunteered for. The row IS the record, so it carries no audit trigger.';

create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function private.set_updated_at();

-- ⚠ SCOPED to the columns that carry meaning, and deliberately unlike every
-- other audit trigger in this repo (all 13 are unscoped). An unscoped `or
-- update` would fire on every fanned_out_at stamp — one audit row per
-- announcement per drain run, whose only recorded change is a timestamp
-- nobody supervises. published_at is in the list as free defence: it has no
-- UPDATE grant today, and if that ever changes the change is on the record.
create trigger announcements_audit
  after insert or delete
     or update of class_id, title, body, published_at, created_by
  on public.announcements
  for each row execute function private.audit_row_change('id', 'class_id');

-- ★ A BEFORE INSERT trigger may assign a column the caller was never granted:
-- column privileges are checked against the columns named in the STATEMENT,
-- and this runs afterwards. That is why this needs no `security definer`.
--
-- ⚠ Do NOT reason from private.touch_thread(), which looks similar and works
-- for a different reason. That one is an AFTER trigger issuing a separate
-- UPDATE against a DIFFERENT row, so the NEW rule does not apply to it at all;
-- it works because it is SECURITY DEFINER owned by a BYPASSRLS role. Plan 1's
-- panel had to correct that comment twice. This one really is the NEW rule.
create or replace function private.stamp_announcement_fanout()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.fanned_out_at := case when new.published_at <= now() then now() else null end;
  return new;
end;
$$;
revoke execute on function private.stamp_announcement_fanout() from public;

create trigger announcements_stamp_fanout
  before insert on public.announcements
  for each row execute function private.stamp_announcement_fanout();

-- ── grants: revoke the TABLE, then grant the columns ────────────────
-- ⚠ The order is load-bearing. `revoke update (col) … from authenticated`
-- subtracts NOTHING when the role holds a table-level UPDATE grant — measured
-- 2026-08-03, where the first version of 20260803000000 closed nothing and
-- would have passed review.
revoke all on table public.announcements from anon, authenticated, service_role;
grant select on public.announcements to authenticated;
grant insert (class_id, title, body, published_at, created_by)
  on public.announcements to authenticated;
grant update (title, body) on public.announcements to authenticated;
--   published_at: INSERT only (A1). class_id: INSERT only — re-pointing it
--   would migrate the audience AND carry the announcement_reads rows with it.
--   created_by, created_at, updated_at, fanned_out_at: never client-writable.
grant delete on public.announcements to authenticated;  -- gated by two policies
grant select, delete on public.announcements to service_role;   -- erasure
--   ⚠ NO `grant update (fanned_out_at) to service_role`. The claim is a
--   SECURITY DEFINER function owned by a BYPASSRLS role, so service_role never
--   touches this table directly; granting the column would be a second write
--   path with no test behind it. (The spec's 2026-08-04-b correction assumed a
--   direct UPDATE from the drain, which task 5 does not do.)

revoke all on table public.announcement_reads from anon, authenticated, service_role;
grant select on public.announcement_reads to authenticated;
grant insert (announcement_id, user_id) on public.announcement_reads to authenticated;
--   read_at is server-defaulted and ungranted, so it cannot be forged.
grant select, delete on public.announcement_reads to service_role;

alter table public.announcements enable row level security;
alter table public.announcements force row level security;
alter table public.announcement_reads enable row level security;
alter table public.announcement_reads force row level security;

-- ── the as-of roster: the ninth and tenth copies of one interval ────
-- [enrolled_on, left_on) — enrolled_on INCLUSIVE, left_on EXCLUSIVE. Asserted
-- at both edges in 34_enrollment_boundary.sql beside the other eight, plus the
-- Europe/Oslo cast, which the earlier eight never needed because their anchors
-- are already dates.
create or replace function private.guardian_in_class_asof(uid uuid, cid uuid, pub timestamptz)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.class_students cs
    join public.guardian_student gs on gs.student_id = cs.student_id
    where cs.class_id = cid
      and gs.guardian_id = uid
      and cs.enrolled_on <= (pub at time zone 'Europe/Oslo')::date
      and (cs.left_on is null or (pub at time zone 'Europe/Oslo')::date < cs.left_on)
  );
$$;
revoke execute on function private.guardian_in_class_asof(uuid, uuid, timestamptz) from public;
grant execute on function private.guardian_in_class_asof(uuid, uuid, timestamptz) to authenticated;

create or replace function private.student_in_class_asof(uid uuid, cid uuid, pub timestamptz)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.class_students cs
    join public.students s on s.id = cs.student_id
    where cs.class_id = cid
      and s.student_user_id = uid
      and cs.enrolled_on <= (pub at time zone 'Europe/Oslo')::date
      and (cs.left_on is null or (pub at time zone 'Europe/Oslo')::date < cs.left_on)
  );
$$;
revoke execute on function private.student_in_class_asof(uuid, uuid, timestamptz) from public;
grant execute on function private.student_in_class_asof(uuid, uuid, timestamptz) to authenticated;

-- ── the read predicate, in ROW form ─────────────────────────────────
-- ★ ROW FORM, NOT BY-ID, AND THAT IS THE WHOLE POINT. PostgreSQL applies a
-- table's SELECT policies as an extra WITH CHECK whenever a statement returns
-- a COLUMN EXPRESSION, and PostgREST emits RETURNING "tbl"."col" the moment a
-- client calls .select(). A SELECT policy that resolved the row by re-querying
-- public.announcements could not see the row its own command is inserting, so
-- every create would fail 42501 while this predicate evaluated TRUE. That is
-- exactly what happened to thread creation on 2026-08-05, invisible to 737
-- pgTAP assertions because every INSERT assertion in the suite was a bare
-- `insert … values`. §E of 37_announcements_rls.sql uses `returning id`.
--
-- ⚠ THE PARAMETERS ARE NAMED cls / pub / author ON PURPOSE. pg_get_functiondef
-- renders the parameter list, so a fingerprint marker matching a parameter
-- name is satisfied by the HEADER regardless of the body — finding F1 of plan
-- 1's panel, where the marker 'kind' became unfailable the moment `kind` was a
-- parameter. Renaming these to class_id/published_at/created_by would make
-- three markers in 29_definer_fingerprints.sql vacuous.
--
-- ★★ AND THE ROW FORM CLOSES A SECOND, DIFFERENT HAZARD — measured, not
-- reasoned. Under `UPDATE … RETURNING`, a BY-ID predicate re-checks against
-- the PRE-UPDATE tuple, while the identical rule written as column references
-- re-checks against the NEW one. (Proved on threads: `update threads set
-- subject = 'NEW' … returning id` succeeds under the by-id spelling and fails
-- under the column spelling.) So a by-id SELECT policy on a table whose
-- predicate-relevant columns are updatable authorises the change against the
-- OLD values — an audience check run against the class the row used to be in.
--
-- ⛔ announcements is safe from that only because class_id is INSERT-only and
-- published_at is ungrantable at UPDATE. IF ANY LATER TASK GRANTS
-- `update (class_id)` OR `update (published_at)`, THIS BECOMES LIVE — and with
-- the row form above it fails closed instead, because the policy sees the
-- proposed row. Do not treat those two revokes as tidiness; they are half of
-- why this predicate is correct.
--
-- The arms, and what each is for:
--   author = uid       the author reads their own not-yet-published row, so a
--                      scheduled announcement is visible on the screen that
--                      scheduled it.
--   has_role(admin)    oversight, unbounded and with no time limit (D5, §4.1).
--   pub <= now()       the draft/published boundary, explicit rather than
--                      implied by a nullable timestamp a policy might forget.
--   cls is null        the whole school. Deliberately does not consult uid at
--                      all — "everyone at the school" is what it means. anon is
--                      kept out by the policy's `to authenticated` and by
--                      00_grant_firewall.sql, not by this clause.
create or replace function private.reads_announcement_row(
  uid uuid, cls uuid, pub timestamptz, author uuid
)
returns boolean language sql stable security definer set search_path = ''
as $$
  select
    author = uid
    or private.has_role(uid, 'admin')
    or (
      pub <= now()
      and (
        cls is null
        or private.teaches_class(uid, cls)
        or private.guardian_in_class_asof(uid, cls, pub)
        or private.student_in_class_asof(uid, cls, pub)
      )
    );
$$;
revoke execute on function private.reads_announcement_row(uuid, uuid, timestamptz, uuid) from public;
grant execute on function private.reads_announcement_row(uuid, uuid, timestamptz, uuid) to authenticated;

-- The by-id lookup, for the ONE policy that has only an id to work with
-- (announcement_reads_insert_own). It delegates rather than restating: two
-- copies of one rule disagree eventually, and the copy nobody tests wins.
-- ⚠ Safe here because it queries a DIFFERENT table from the one being written.
create or replace function private.reads_announcement(uid uuid, aid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.announcements a
    where a.id = aid
      and private.reads_announcement_row(uid, a.class_id, a.published_at, a.created_by)
  );
$$;
revoke execute on function private.reads_announcement(uuid, uuid) from public;
grant execute on function private.reads_announcement(uuid, uuid) to authenticated;

-- ⚠ The null branch is EXPLICIT. private.teaches_class(uid, null) is false, so
-- a single expression would silently make school-wide announcements writable
-- by nobody at all — including admin.
create or replace function private.writes_announcement(uid uuid, cid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case
    when cid is null then private.has_role(uid, 'admin')
    else private.has_role(uid, 'admin') or private.teaches_class(uid, cid)
  end;
$$;
revoke execute on function private.writes_announcement(uuid, uuid) from public;
grant execute on function private.writes_announcement(uuid, uuid) to authenticated;

-- The UI needs to know whether to render an edit control. ★ It must ASK, not
-- re-derive: a TypeScript copy of the update policy is the same defect D21
-- removed from the notification fan-out, and plan 1 shipped that mistake once
-- already (a canWrite that hid the composer from a parent who also holds admin).
create or replace function public.can_edit_announcement(aid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.announcements a
    where a.id = aid
      and a.created_by = (select auth.uid())
      and private.writes_announcement((select auth.uid()), a.class_id)
  );
$$;
-- ⚠ Name the roles. `revoke execute … from public` does NOT strip the explicit
-- anon/authenticated EXECUTE grants pg_default_acl gives to functions created
-- by supabase_admin, which is the CLOUD path. See 20260728200000:229.
revoke execute on function public.can_edit_announcement(uuid) from public;
revoke execute on function public.can_edit_announcement(uuid) from anon;
grant execute on function public.can_edit_announcement(uuid) to authenticated;
comment on function public.can_edit_announcement(uuid) is
  'Whether the CALLER may edit this announcement. A thin mirror of announcements_update_author so the UI never re-implements the policy.';

-- ── policies ────────────────────────────────────────────────────────
create policy "announcements_select_audience"
  on public.announcements for select to authenticated
  using (private.reads_announcement_row(
           (select auth.uid()), class_id, published_at, created_by));

create policy "announcements_insert_staff"
  on public.announcements for insert to authenticated
  with check (
    private.writes_announcement((select auth.uid()), class_id)
    and created_by = (select auth.uid())
  );

-- ⚠ created_by is pinned in `using` AS WELL AS in `with check`. With the pin in
-- `with check` only, teacher B updates teacher A's row SETTING created_by = B
-- and both clauses pass — B has taken the byline on a colleague's announcement.
-- That is the defect Phase 4 shipped, and the spec's own parenthetical cites it
-- while putting the pin in the wrong clause.
create policy "announcements_update_author"
  on public.announcements for update to authenticated
  using (created_by = (select auth.uid())
         and private.writes_announcement((select auth.uid()), class_id))
  with check (created_by = (select auth.uid())
              and private.writes_announcement((select auth.uid()), class_id));

create policy "announcements_delete_admin"
  on public.announcements for delete to authenticated
  using (private.has_role((select auth.uid()), 'admin'));

-- A2: published_at has no UPDATE grant, so a mis-scheduled announcement cannot
-- be moved — and RLS cannot express "this column is editable only while the row
-- is unpublished", because column-level authorization is the GRANT layer and
-- grants carry no predicate. This policy is the withdraw path instead. A
-- not-yet-published announcement has been read by nobody by construction, so
-- removing it destroys no record; a PUBLISHED one stays admin-only.
create policy "announcements_delete_own_unpublished"
  on public.announcements for delete to authenticated
  using (created_by = (select auth.uid())
         and published_at > now()
         and private.writes_announcement((select auth.uid()), class_id));

-- ⛔ THIS ONE IS SAFE AS WRITTEN AND MUST NOT BE "FIXED" INTO A ROW FORM.
-- The reasons, so nobody re-derives them at 6am:
--   · The FIRST arm is `user_id = auth.uid()` — a plain column on the row being
--     written, not a lookup — and announcement_reads_insert_own PINS that
--     column to the caller. So on every self-insert the first arm is true BY
--     CONSTRUCTION, and the policy short-circuits before reaching anything that
--     queries a table.
--   · The THIRD arm subqueries public.announcements, which is a DIFFERENT and
--     already-COMMITTED table. The RETURNING hazard is specifically a policy
--     resolving the row from the table its own command is inserting into.
-- An upsert with .select() on this table is therefore safe.
create policy "announcement_reads_select_own_or_staff"
  on public.announcement_reads for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_role((select auth.uid()), 'admin')
    or exists (
      select 1 from public.announcements a
      where a.id = announcement_id
        and private.writes_announcement((select auth.uid()), a.class_id)
    )
  );

-- The double bind: it must be your own row, AND about something you can read.
create policy "announcement_reads_insert_own"
  on public.announcement_reads for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and private.reads_announcement((select auth.uid()), announcement_id)
  );
-- Deliberately NO update policy and no UPDATE grant: read_at is when you read
-- it, and there is nothing to correct.
```

- [ ] **Step 2: Apply and regenerate types**

```bash
cd ~/dev/iqra-portal && supabase db reset && npm run db:types
```

Expected: reset completes; `select max(version)` returns `20260806120000`.

⚠ `supabase db reset` exits 1 on a storage-readiness race even when it worked — verify by the migration head and the seed counts, **not** by the exit code.

- [ ] **Step 3: Verify the BEFORE-INSERT stamp actually works from a client-shaped statement**

The claim in the migration comment — that a BEFORE trigger may assign a column the caller was never granted — is load-bearing for Task 5 and is asserted nowhere else. Prove it before writing 47 assertions on top of it:

```bash
docker exec supabase_db_iqra-portal psql -U postgres -q -c "
begin;
set local role authenticated;
select set_config('request.jwt.claims','{\"sub\":\"11111111-1111-1111-1111-111111111111\",\"role\":\"authenticated\"}', true);
insert into public.announcements (class_id, title, body, created_by)
values (null, 'stamp-probe', 'x', '11111111-1111-1111-1111-111111111111');
reset role;
select title, fanned_out_at is not null as stamped from public.announcements where title='stamp-probe';
rollback;"
```

Expected: one row, `stamped = t`. If it is `f` or the insert 42501s, **stop and report** — the trigger mechanism this plan assumes does not hold and Task 5's design needs revisiting.

- [ ] **Step 4: Write pgTAP 37**

Create `supabase/tests/37_announcements_rls.sql`. Fixture prefix `c0`, `plan(39)`.

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

-- Announcements: the AS-OF audience, the creation binds, the update pins and
-- the delete pair.
--
-- ★ Every → 0 rows negative below carries an ENTITLED-READER control over the
-- IDENTICAL row. Pairing a refusal with a second read by the SAME actor only
-- proves the actor has a session; it does not prove the withheld row exists.
-- That is the shape that let four Phase-4 assertions survive replacing the
-- guarded function body with `select true`.
--
-- ★ THE PUBLICATION INSTANT IS 00:30 OSLO, ON PURPOSE. At that time the Oslo
-- calendar day and the UTC calendar day DIFFER (00:30 CET = 23:30 UTC the day
-- before). Every fixture edge below is expressed against the OSLO day, so
-- dropping `at time zone 'Europe/Oslo'` from the as-of helpers flips two
-- assertions deterministically instead of only between 22:00 and 24:00 UTC.
--
-- ★ AND EVERY TIMESTAMP IS RELATIVE TO now(). The read predicate compares
-- against now(), so a fixed literal would silently become "not yet published"
-- if the suite ran before that date and "always published" after it.

-- Hermetic fixtures (seed independence): children before parents. ⚠ The
-- assignments delete is NOT optional and is not about this file's subject
-- matter: assignments.class_id is the one ON DELETE RESTRICT edge on the path
-- to classes, so the seed's assignments hold every seeded class alive and the
-- `delete from public.classes` below aborts the whole transaction before
-- assertion 1 ever runs. announcements.class_id is a SECOND such edge, which
-- is why the first two lines exist even though the seed creates no
-- announcements today — a seeded one later would abort this file and 22 others.
delete from public.announcement_reads;
delete from public.announcements;
delete from public.messages;
delete from public.threads;
delete from public.assignments;
delete from public.class_students;
delete from public.class_teachers;
delete from public.guardian_student;
delete from public.students;
delete from public.classes;
delete from public.terms;

insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.email, '{"provider":"email","providers":["email"]}',
       jsonb_build_object('full_name', u.full_name), now(), now()
from (values
  ('c0000000-0000-0000-0000-000000000001'::uuid, 'pgtap-op-admin@test.local',     'OP Admin'),
  ('c0000000-0000-0000-0000-000000000002'::uuid, 'pgtap-op-laerer1@test.local',   'OP Lærer En'),
  ('c0000000-0000-0000-0000-000000000003'::uuid, 'pgtap-op-laerer2@test.local',   'OP Lærer To'),
  ('c0000000-0000-0000-0000-000000000004'::uuid, 'pgtap-op-forelder1@test.local', 'OP Forelder Ordinær'),
  ('c0000000-0000-0000-0000-000000000005'::uuid, 'pgtap-op-forelder2@test.local', 'OP Forelder Etterpå'),
  ('c0000000-0000-0000-0000-000000000006'::uuid, 'pgtap-op-forelder3@test.local', 'OP Forelder Sluttet'),
  ('c0000000-0000-0000-0000-000000000007'::uuid, 'pgtap-op-elev1@test.local',     'OP Elev Ordinær'),
  ('c0000000-0000-0000-0000-000000000008'::uuid, 'pgtap-op-okonomi@test.local',   'OP Økonomi'),
  ('c0000000-0000-0000-0000-000000000009'::uuid, 'pgtap-op-forelderb@test.local', 'OP Forelder Klasse B'),
  ('c0000000-0000-0000-0000-000000000010'::uuid, 'pgtap-op-laerer3@test.local',   'OP Lærer Tre'),
  ('c0000000-0000-0000-0000-000000000012'::uuid, 'pgtap-op-forelder4@test.local', 'OP Forelder Startet'),
  ('c0000000-0000-0000-0000-000000000013'::uuid, 'pgtap-op-elev2@test.local',     'OP Elev Startet')
) as u(id, email, full_name);
insert into public.user_roles (user_id, role) values
  ('c0000000-0000-0000-0000-000000000001', 'admin'),
  ('c0000000-0000-0000-0000-000000000002', 'teacher'),
  ('c0000000-0000-0000-0000-000000000003', 'teacher'),
  ('c0000000-0000-0000-0000-000000000010', 'teacher'),
  ('c0000000-0000-0000-0000-000000000004', 'parent'),
  ('c0000000-0000-0000-0000-000000000005', 'parent'),
  ('c0000000-0000-0000-0000-000000000006', 'parent'),
  ('c0000000-0000-0000-0000-000000000009', 'parent'),
  ('c0000000-0000-0000-0000-000000000012', 'parent'),
  ('c0000000-0000-0000-0000-000000000007', 'student'),
  ('c0000000-0000-0000-0000-000000000013', 'student'),
  ('c0000000-0000-0000-0000-000000000008', 'economy');

insert into public.terms (id, name, starts_on, ends_on) values
  ('c0000000-0000-0000-0000-000000000011', 'OP Termin', '2026-01-10', '2027-06-20');
insert into public.classes (id, term_id, name) values
  ('c0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000011', 'OP Klasse A'),
  ('c0000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-000000000011', 'OP Klasse B');
-- l1 and l3 both teach A, so the update-pin assertions have a second teacher of
-- the SAME class who did not author the row. Without that, a refusal could be
-- explained by writes_announcement rather than by the created_by pin.
insert into public.class_teachers (class_id, teacher_id) values
  ('c0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000010'),
  ('c0000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-000000000003');

insert into public.students (id, first_name, last_name, birth_year, protected, student_user_id) values
  ('c0000000-0000-0000-0000-000000000031', 'OP', 'Ordinær',  2013, false, 'c0000000-0000-0000-0000-000000000007'),
  ('c0000000-0000-0000-0000-000000000032', 'OP', 'Etterpå',  2013, false, null),
  ('c0000000-0000-0000-0000-000000000033', 'OP', 'Sluttet',  2013, false, null),
  ('c0000000-0000-0000-0000-000000000034', 'OP', 'Klasse B', 2013, false, null),
  ('c0000000-0000-0000-0000-000000000035', 'OP', 'Skjermet', 2013, true,  null),
  ('c0000000-0000-0000-0000-000000000036', 'OP', 'Startet',  2013, false, 'c0000000-0000-0000-0000-000000000013');
insert into public.guardian_student (guardian_id, student_id) values
  ('c0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000031'),
  ('c0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000032'),
  ('c0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000033'),
  ('c0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000034'),
  ('c0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000036');

-- D = the OSLO calendar day 30 days ago. Four pupils differ in nothing but
-- their position relative to D:
--   Ordinær   enrolled D-60, open            → IN
--   Etterpå   enrolled D+20, open            → OUT (enrolled after publication)
--   Sluttet   enrolled D-60, left_on = D     → OUT (left_on is EXCLUSIVE)
--   Startet   enrolled D,     open           → IN  (enrolled_on is INCLUSIVE)
-- Skjermet sits alongside Ordinær and exists only for the read-status witness.
insert into public.class_students (class_id, student_id, enrolled_on, left_on) values
  ('c0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000031',
   ((now() - interval '90 days') at time zone 'Europe/Oslo')::date, null),
  ('c0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000032',
   ((now() - interval '10 days') at time zone 'Europe/Oslo')::date, null),
  ('c0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000033',
   ((now() - interval '90 days') at time zone 'Europe/Oslo')::date,
   ((now() - interval '30 days') at time zone 'Europe/Oslo')::date),
  ('c0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000035',
   ((now() - interval '90 days') at time zone 'Europe/Oslo')::date, null),
  ('c0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000036',
   ((now() - interval '30 days') at time zone 'Europe/Oslo')::date, null),
  ('c0000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-000000000034',
   ((now() - interval '90 days') at time zone 'Europe/Oslo')::date, null);

-- 00:30 OSLO on day D. In UTC that is 23:30 (CET) or 22:30 (CEST) on D-1, so
-- the two calendar days differ and the timezone of the ::date cast is testable.
--
-- ⚠ created_at is a WHOLE TEN DAYS earlier than published_at, not one. The
-- announcements_not_backdated CHECK compares the two, and at 00:30 the Oslo
-- day D can start almost 24 h before now()-30d — so `created_at = now() - 31
-- days` leaves a margin of about half an hour in the worst case. It never goes
-- negative, but a fixture whose validity depends on arithmetic that tight is a
-- fixture that will break for a reason nobody looks for.
insert into public.announcements (id, class_id, title, body, published_at, created_by, created_at) values
  ('c0000000-0000-0000-0000-000000000041', 'c0000000-0000-0000-0000-000000000021',
   'OP Klassebeskjed', 'Husk gymtøy.',
   ((((now() - interval '30 days') at time zone 'Europe/Oslo')::date + time '00:30') at time zone 'Europe/Oslo'),
   'c0000000-0000-0000-0000-000000000002', now() - interval '40 days'),
  ('c0000000-0000-0000-0000-000000000042', null,
   'OP Hele skolen', 'Ingen skole i uke 40.',
   ((((now() - interval '30 days') at time zone 'Europe/Oslo')::date + time '00:30') at time zone 'Europe/Oslo'),
   'c0000000-0000-0000-0000-000000000001', now() - interval '40 days'),
  ('c0000000-0000-0000-0000-000000000044', 'c0000000-0000-0000-0000-000000000022',
   'OP Klasse B', 'Bare klasse B.',
   now() - interval '5 days', 'c0000000-0000-0000-0000-000000000003', now() - interval '15 days'),
  ('c0000000-0000-0000-0000-000000000045', 'c0000000-0000-0000-0000-000000000021',
   'OP Fra laerer tre', 'Skrevet av en annen lærer i samme klasse.',
   now() - interval '5 days', 'c0000000-0000-0000-0000-000000000010', now() - interval '15 days'),
  ('c0000000-0000-0000-0000-000000000043', 'c0000000-0000-0000-0000-000000000021',
   'OP Planlagt', 'Publiseres om en uke.',
   now() + interval '7 days', 'c0000000-0000-0000-0000-000000000002', now()),
  -- §J's own rows, so the delete block can sit anywhere in the file without
  -- destroying fixtures the read-status and claim sections depend on.
  ('c0000000-0000-0000-0000-000000000046', 'c0000000-0000-0000-0000-000000000021',
   'OP For sletting publisert', 'x',
   now() - interval '5 days', 'c0000000-0000-0000-0000-000000000002', now() - interval '15 days'),
  ('c0000000-0000-0000-0000-000000000047', 'c0000000-0000-0000-0000-000000000021',
   'OP For sletting planlagt', 'x',
   now() + interval '9 days', 'c0000000-0000-0000-0000-000000000002', now());

-- ⚠ §J asserts that deleting an announcement takes its read rows with it. That
-- assertion is VACUOUS unless a read row exists to be taken — a count of 0 that
-- was 0 all along proves nothing, which is the exact shape that let four
-- Phase-4 assertions survive `select true`. This row is its witness, and §J's
-- middle assertion checks it is still there after the refused delete.
insert into public.announcement_reads (announcement_id, user_id) values
  ('c0000000-0000-0000-0000-000000000046', 'c0000000-0000-0000-0000-000000000004');

-- ── §A 01-04 shape ──────────────────────────────────────────────────
select ok((select relrowsecurity from pg_class where oid = 'public.announcements'::regclass),
  'RLS enabled on announcements');
select ok((select relforcerowsecurity from pg_class where oid = 'public.announcements'::regclass),
  'RLS FORCED on announcements (26_rls_force asserts three things per table, not two)');
select ok((select relrowsecurity from pg_class where oid = 'public.announcement_reads'::regclass),
  'RLS enabled on announcement_reads');
select ok((select relforcerowsecurity from pg_class where oid = 'public.announcement_reads'::regclass),
  'RLS FORCED on announcement_reads');

-- ── §B 05-13 the AS-OF audience (D9) ────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000041'), 1::bigint,
  'control: a guardian enrolled BEFORE publication and still enrolled reads it — every 0 below is over this same row');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000041'), 0::bigint,
  'D9: a family enrolled AFTER published_at does not read that announcement');
select is((select count(*) from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000042'), 1::bigint,
  'session control: that same guardian reads the school-wide announcement');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000041'), 0::bigint,
  'D9: left_on is EXCLUSIVE — a family whose enrolment closed ON the Oslo publication day does not read it');
select is((select count(*) from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000042'), 1::bigint,
  'session control: that same guardian reads the school-wide announcement');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000012","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000041'), 1::bigint,
  'D9: enrolled_on is INCLUSIVE — a family that started ON the Oslo publication day DOES read it');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000013","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000041'), 1::bigint,
  'the pupil arm resolves the same interval: a pupil enrolled ON the Oslo publication day reads it');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000041'), 0::bigint,
  'a teacher of another class reads nothing of class A''s announcement');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000041'), 1::bigint,
  'control: the class''s OWN teacher reads that identical announcement');
reset role;

-- ── §C 14-16 economy and the other family (D17) ─────────────────────
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000008","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000041'), 0::bigint,
  'D17: economy reads no CLASS announcement — «aldri pedagogikk»');
select is((select count(*) from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000042'), 1::bigint,
  'D17: and economy DOES read the school-wide one — a notice about closing week 40 is not pedagogy');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000009","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000041'), 0::bigint,
  'a guardian of another class''s pupil reads nothing of class A''s announcement');
reset role;

-- ── §D 17-20 the scheduled row (D8) ─────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000043'), 1::bigint,
  'the AUTHOR reads their own not-yet-published announcement — otherwise scheduling has no screen');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000043'), 1::bigint,
  'admin reads every announcement, published or scheduled (§4.1)');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000043'), 0::bigint,
  'a family does NOT read a scheduled announcement before published_at');
select is((select count(*) from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000041'), 1::bigint,
  'control: that same guardian reads the PUBLISHED announcement in the same class');
reset role;

-- ── §E 21-27 creation: back-dating, RETURNING, and the write wall ───
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.announcements (class_id, title, body, published_at, created_by)
     values ('c0000000-0000-0000-0000-000000000021', 'OP Tilbakedatert', 'x',
             now() - interval '1 day', 'c0000000-0000-0000-0000-000000000002') $$,
  '23514', null,
  'A1: published_at cannot be BACK-dated — the only direction that widens the as-of audience');
select lives_ok(
  $$ insert into public.announcements (class_id, title, body, published_at, created_by)
     values ('c0000000-0000-0000-0000-000000000021', 'OP Framdatert', 'x',
             now() + interval '1 day', 'c0000000-0000-0000-0000-000000000002') $$,
  'A1 positive control: and CAN be forward-dated — that is what scheduling is');
-- ★★ THE STATEMENT SHAPE THE SUITE WAS BLIND TO. PostgREST emits
-- RETURNING "tbl"."col" whenever the client calls .select(), which applies the
-- SELECT policy as an extra WITH CHECK. A by-id read predicate cannot see the
-- row its own command is inserting, and every create would 42501 while the
-- predicate evaluated true. Written `returning 1` this assertion would pass
-- against a BROKEN predicate — measured on 2026-08-05. It must return `id`.
select lives_ok(
  $$ insert into public.announcements (class_id, title, body, created_by)
     values ('c0000000-0000-0000-0000-000000000021', 'OP Med returnering', 'x',
             'c0000000-0000-0000-0000-000000000002')
     returning id $$,
  '★ RETURNING id: the app''s own statement shape, which a by-id SELECT policy would refuse');
select throws_ok(
  $$ insert into public.announcements (class_id, title, body, created_by)
     values ('c0000000-0000-0000-0000-000000000022', 'OP Feil klasse', 'x',
             'c0000000-0000-0000-0000-000000000002') $$,
  '42501', null,
  'a teacher cannot publish to a class she does not teach');
select throws_ok(
  $$ insert into public.announcements (class_id, title, body, created_by)
     values (null, 'OP Laerer hele skolen', 'x',
             'c0000000-0000-0000-0000-000000000002') $$,
  '42501', null,
  'D8: a teacher cannot publish to the whole school');
select throws_ok(
  $$ insert into public.announcements (class_id, title, body, created_by)
     values ('c0000000-0000-0000-0000-000000000021', 'OP Falsk forfatter', 'x',
             'c0000000-0000-0000-0000-000000000001') $$,
  '42501', null,
  'the author pin refuses a forged created_by at INSERT');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.announcements (class_id, title, body, created_by)
     values (null, 'OP Admin hele skolen', 'x',
             'c0000000-0000-0000-0000-000000000001') $$,
  'D8 positive control: admin DOES publish to the whole school');
reset role;

-- ── §F 28-30 the update pins ────────────────────────────────────────
-- ⚠ EFFECT, not throws_ok. An UPDATE whose `using` clause excludes the row is
-- a NO-OP, not an error — measured 2026-08-05 alongside the DELETE case.
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000010","role":"authenticated"}', true);
set local role authenticated;
update public.announcements set title = 'OP Kapret'
  where id = 'c0000000-0000-0000-0000-000000000041';
update public.announcements set title = 'OP Egen retittel'
  where id = 'c0000000-0000-0000-0000-000000000045';
reset role;
select is((select title from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000041'), 'OP Klassebeskjed',
  'the created_by pin in USING: a co-teacher cannot retitle a colleague''s announcement');
select is((select title from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000045'), 'OP Egen retittel',
  'control: the same teacher CAN retitle her own in the same class — so the refusal above is the pin, not the grant');
select is(has_column_privilege('authenticated', 'public.announcements', 'published_at', 'UPDATE'),
  false,
  'published_at cannot be MOVED after the fact — the audience is fixed at creation');

-- ── §G 31-34 announcement_reads ─────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.announcement_reads (announcement_id, user_id)
     values ('c0000000-0000-0000-0000-000000000041',
             'c0000000-0000-0000-0000-000000000004') $$,
  'positive control: an entitled reader records their own read');
select throws_ok(
  $$ insert into public.announcement_reads (announcement_id, user_id)
     values ('c0000000-0000-0000-0000-000000000041',
             'c0000000-0000-0000-0000-000000000005') $$,
  '42501', null,
  'the author pin refuses recording a read on someone else''s behalf');
select throws_ok(
  $$ insert into public.announcement_reads (announcement_id, user_id, read_at)
     values ('c0000000-0000-0000-0000-000000000042',
             'c0000000-0000-0000-0000-000000000004', now() - interval '400 days') $$,
  '42501', null,
  'read_at is server-defaulted and ungranted — a read cannot be backdated');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.announcement_reads (announcement_id, user_id)
     values ('c0000000-0000-0000-0000-000000000041',
             'c0000000-0000-0000-0000-000000000005') $$,
  '42501', null,
  'the double bind: you cannot record a read of something you cannot read');
reset role;

-- ── §J 35-39 the delete pair ────────────────────────────────────────
-- ⚠ EFFECT, not throws_ok. A DELETE that RLS filters returns `OK rows=0` —
-- measured 2026-08-05. throws_ok here would be a test that cannot fail, and
-- plan 1 proved that both delete policies on threads/messages could be set to
-- `using (true)` with the whole suite green.
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
delete from public.announcements where id = 'c0000000-0000-0000-0000-000000000047';
delete from public.announcements where id = 'c0000000-0000-0000-0000-000000000046';
reset role;
select is((select count(*) from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000047'), 0::bigint,
  'A2: the author withdraws her own SCHEDULED announcement — nobody has read it');
select is((select count(*) from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000046'), 1::bigint,
  'A2: and cannot delete her own PUBLISHED one — that is a record, and it survives');
select is((select count(*) from public.announcement_reads
           where announcement_id = 'c0000000-0000-0000-0000-000000000046'), 1::bigint,
  'control: and so does its read row — without this, the cascade assertion below would be 0 both before and after');
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
delete from public.announcements where id = 'c0000000-0000-0000-0000-000000000046';
reset role;
select is((select count(*) from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000046'), 0::bigint,
  'control: admin CAN delete a published announcement — so the survival above is the policy, not a missing grant');
select is((select count(*) from public.announcement_reads
           where announcement_id = 'c0000000-0000-0000-0000-000000000046'), 0::bigint,
  'and its read rows went with it — announcement_reads cascades, so erasure is complete');

select * from finish();
rollback;
```

- [ ] **Step 5: Run the file**

```bash
cd ~/dev/iqra-portal && docker exec -i supabase_db_iqra-portal psql -U postgres -q -f - < supabase/tests/37_announcements_rls.sql
```

Expected: 39 `ok`, no `not ok`, and **no** `Looks like you planned…` line. If the count differs, set `plan(N)` to what pgTAP reports and correct this document — never by counting `select` lines.

⚠ If assertion 4 or `26_rls_force.sql` fails, a new table is missing `force row level security` or a policy. That test asserts **four** things across all public tables and needs no edit to catch it.

- [ ] **Step 6: ★ Mutation pass — fourteen named mutations, each must redden ALONE**

Apply each with `create or replace` (functions) or `alter policy` / `alter table` (policies, constraints), re-run the file, then restore by re-running the migration's own block and **verify the restore with the md5 check in standing rule 3**.

| # | Mutation | Must redden | Must NOT redden |
|---|---|---|---|
| 1 | `guardian_in_class_asof`: `< cs.left_on` → `<= cs.left_on` | 08 (the family that left ON the publication day gains it) | 05 |
| 2 | `guardian_in_class_asof`: `cs.enrolled_on <=` → `cs.enrolled_on <` | 10 (the family that started ON the publication day loses it) | 05 |
| 3 | `guardian_in_class_asof`: drop **both** `at time zone 'Europe/Oslo'` (leave `pub::date`) | **08 and 10** — the Oslo day and the UTC day differ at 00:30 | 05 |
| 4 | `student_in_class_asof`: `cs.enrolled_on <=` → `<` | 11 (the pupil arm's inclusive edge) | 05 |
| 5 | `student_in_class_asof`: drop both `at time zone 'Europe/Oslo'` | 11 | 05 |
| 6 | `reads_announcement_row`: substitute `private.guardian_in_class` (the LIVE helper) for `guardian_in_class_asof` | 06 (a family enrolled after publication gains it) | 05 |
| 7 | `reads_announcement_row`: delete the `pub <= now()` conjunct | 19 (a family reads a scheduled announcement) | 17, 18 |
| 8 | `reads_announcement_row`: delete the `author = uid` arm | 17 (the author loses their own scheduled row) | 18 |
| 9 | `reads_announcement_row`: delete the `cls is null` arm | 15 (economy loses the school-wide announcement) | 14 |
| 10 | `announcements_update_author`: drop `created_by = (select auth.uid())` from **`using`**, keeping it in `with check` — the Phase-4 defect verbatim | 28 | 29 |
| 11 | drop the `announcements_not_backdated` CHECK | 21 | 22 |
| 12 | `announcements_select_audience`: replace the row form with `using (private.reads_announcement((select auth.uid()), id))` | ★ **23** — the `returning id` insert 42501s while the predicate is true | 05, 09, 12 (bare reads are unaffected) |
| 13 | `announcement_reads_insert_own`: drop the `private.reads_announcement(…)` conjunct | 34 | 31 |
| 14 | `announcements_delete_own_unpublished`: drop `published_at > now()` | **36 and 37** — the author's delete of the published announcement now succeeds, taking its read row with it | 35 |

⚠ Mutations 1–3 are **different clauses of the same function** — run them separately or one masks another. Same for 4–5 and 7–9.

⚠ Mutation 12 is the most valuable one in this plan. It reproduces, exactly, the defect that broke every thread creation in plan 1 and survived 737 assertions. If it does **not** redden assertion 23, the assertion is wrong — check that it really says `returning id` and not `returning 1`.

- [ ] **Step 7: Full suite from a clean database**

```bash
cd ~/dev/iqra-portal && supabase db reset && supabase test db --local && npm run typecheck && npm run lint
```

Expected: `Files=` baseline+1, `Tests=` baseline+39, `Result: PASS`; typecheck 0 errors; lint 0 errors and the pre-existing warnings only.

- [ ] **Step 8: Commit**

```bash
cd ~/dev/iqra-portal
git add supabase/migrations/20260806120000_announcements.sql supabase/tests/37_announcements_rls.sql src/lib/supabase/database.types.ts
git commit -m "feat(oppslag): announcements, with the audience resolved as of publication"
```

Body must state: that `published_at` is client-writable at INSERT and why the CHECK rather than the grant is the wall (A1); that the SELECT policy is the row form and which mutation proves it; that the read-tracking table carries no audit trigger and why; and the fourteen mutations run in step 6 with what each reddened.

---

## Task 2: the as-of interval, asserted where the other eight are

**Files:**
- Modify: `supabase/tests/34_enrollment_boundary.sql`

M3's own note in that file reserves this slot: *"Phase 5: D9 resolves an announcement's audience as of published_at. It is the ninth site of this idiom, and it must be written `published_at < cs.left_on` and asserted here (or beside here) at the same edge."* The note is one clause short — it does not mention the timezone of the cast — and this task supplies it.

- [ ] **Step 1: Read the file's fixture and its plan count**

```bash
cd ~/dev/iqra-portal && sed -n '1,120p' supabase/tests/34_enrollment_boundary.sql && grep -n "student_user_id\|bd000000-0000-0000-0000-0000000000[23]" supabase/tests/34_enrollment_boundary.sql | head -20
```

You need: the current `plan(N)` (expected **24**), the boundary date `D` the file uses (expected `2026-09-15`), the three guardians' ids and the three pupils' ids, the class id, and whether `students.student_user_id` is populated. **If any differs from what step 2 assumes, correct step 2 rather than the file.**

- [ ] **Step 2: Add the ninth and tenth copies, at both edges**

Bump `plan(24)` to `plan(30)` and append, immediately before `select * from finish();`:

```sql
-- ── The NINTH and TENTH copies of the interval: Phase 5's announcement
--    audience (D9). Both take a TIMESTAMPTZ rather than a date, which is new,
--    and that is the whole reason they need their own assertions here.
--
-- ★ PUB is 00:30 OSLO on D. In UTC that is 23:30 (CET) or 22:30 (CEST) on
--   D-1 — the two calendar days DIFFER. A helper that casts with a bare
--   ::date resolves D-1 in production (the server runs UTC) and reddens the
--   two edge assertions below, deterministically rather than only between
--   22:00 and 24:00. Every helper in src/lib/dates.ts pins Europe/Oslo for
--   exactly this reason; the SQL had no such assertion until now.
select is(private.guardian_in_class_asof(
    'bd000000-0000-0000-0000-000000000011',
    'bd000000-0000-0000-0000-000000000031',
    (('2026-09-15'::date + time '00:30') at time zone 'Europe/Oslo')),
  false,
  'guardian_in_class_asof: left_on = D is OUT — left_on is EXCLUSIVE, ninth site');
select is(private.guardian_in_class_asof(
    'bd000000-0000-0000-0000-000000000012',
    'bd000000-0000-0000-0000-000000000031',
    (('2026-09-15'::date + time '00:30') at time zone 'Europe/Oslo')),
  true,
  'control: left_on = D + 1 is IN — so the false above is the operator, not a broken fixture');
select is(private.guardian_in_class_asof(
    'bd000000-0000-0000-0000-000000000013',
    'bd000000-0000-0000-0000-000000000031',
    (('2026-09-15'::date + time '00:30') at time zone 'Europe/Oslo')),
  true,
  'guardian_in_class_asof: enrolled_on = D is IN — enrolled_on is INCLUSIVE, and this is also the Oslo-cast witness');
select is(private.student_in_class_asof(
    'bd000000-0000-0000-0000-000000000021',
    'bd000000-0000-0000-0000-000000000031',
    (('2026-09-15'::date + time '00:30') at time zone 'Europe/Oslo')),
  false,
  'student_in_class_asof: left_on = D is OUT, tenth site');
select is(private.student_in_class_asof(
    'bd000000-0000-0000-0000-000000000022',
    'bd000000-0000-0000-0000-000000000031',
    (('2026-09-15'::date + time '00:30') at time zone 'Europe/Oslo')),
  true,
  'control: left_on = D + 1 is IN');
select is(private.student_in_class_asof(
    'bd000000-0000-0000-0000-000000000023',
    'bd000000-0000-0000-0000-000000000031',
    (('2026-09-15'::date + time '00:30') at time zone 'Europe/Oslo')),
  true,
  'student_in_class_asof: enrolled_on = D is IN, and the Oslo-cast witness for the pupil arm');
```

⚠ **The uuids and the class id above are placeholders taken from the file's documented prefix scheme.** Step 1 tells you the real ones. If the file's class id is not `bd…031`, or the three guardians are not `…011/012/013`, substitute — do not invent a new fixture.

- [ ] **Step 3: Run it**

```bash
cd ~/dev/iqra-portal && docker exec -i supabase_db_iqra-portal psql -U postgres -q -f - < supabase/tests/34_enrollment_boundary.sql
```

Expected: 30 `ok`, no `not ok`.

- [ ] **Step 4: ★ Mutation pass**

| # | Mutation | Must redden | Must NOT redden |
|---|---|---|---|
| 1 | `guardian_in_class_asof`: `<` → `<=` on `left_on` | 25 | 26 |
| 2 | `guardian_in_class_asof`: `<=` → `<` on `enrolled_on` | 27 | 26 |
| 3 | `guardian_in_class_asof`: `(pub at time zone 'Europe/Oslo')::date` → `pub::date`, both occurrences | **25 and 27** | 26 |
| 4 | `student_in_class_asof`: `<` → `<=` on `left_on` | 28 | 29 |
| 5 | `student_in_class_asof`: `<=` → `<` on `enrolled_on` | 30 | 29 |
| 6 | `student_in_class_asof`: drop the Oslo cast, both occurrences | **28 and 30** | 29 |

(Assertion numbers assume the six land at 25–30. If step 3 numbered them differently, use what pgTAP printed.)

- [ ] **Step 5: Commit**

```bash
cd ~/dev/iqra-portal
git add supabase/tests/34_enrollment_boundary.sql
git commit -m "test(oppslag): pin the announcement audience at both edges of the enrolment interval"
```

Body must state that this is the ninth and tenth site of one interval, that the file's earlier note asked only for the `left_on` edge and the timezone of the cast was the missing half, and which mutations reddened which assertions.

---

## Task 3: column locks — assert the grant shape where it is already asserted

**Files:**
- Modify: `supabase/tests/31_column_locks.sql`

- [ ] **Step 1: Read the Phase-5 block and the plan count**

```bash
cd ~/dev/iqra-portal && grep -n "plan(" supabase/tests/31_column_locks.sql && sed -n '205,244p' supabase/tests/31_column_locks.sql
```

Expected: `plan(22)`, and a block of six `has_*_privilege` assertions for `threads`/`messages` with a comment explaining why they are **not** written in the `information_schema` style used earlier in the file.

- [ ] **Step 2: Add the announcements block**

Bump `plan(22)` to `plan(31)` and append, immediately before `select * from finish();`:

```sql
-- ── Phase 5 plan 2: announcements ───────────────────────────────────
-- Same instrument choice as the threads block above, for the same reason:
-- has_table_privilege is BLIND to column grants, so it is the right probe only
-- where a TABLE grant is the thing that would swallow the column revoke. Where
-- the claim is "no privilege of any shape", use has_any_column_privilege.
-- And none of these touch information_schema — those queries filter table_name
-- with no table_schema, and Supabase ships a realtime.messages table.
select is(has_table_privilege('authenticated', 'public.announcements', 'UPDATE'), false,
  'announcements holds no TABLE-level UPDATE grant — a column revoke subtracts nothing without this');
select is(has_column_privilege('authenticated', 'public.announcements', 'title', 'UPDATE'), true,
  'the author may fix a typo in the title');
select is(has_column_privilege('authenticated', 'public.announcements', 'body', 'UPDATE'), true,
  'and in the body');
select is(has_column_privilege('authenticated', 'public.announcements', 'published_at', 'UPDATE'), false,
  'published_at cannot be MOVED: it decides the read audience as of publication (D9), so a later edit would migrate who ever read it');
select is(has_column_privilege('authenticated', 'public.announcements', 'class_id', 'UPDATE'), false,
  'class_id is INSERT-only: re-pointing it would migrate the audience AND carry the announcement_reads rows with it');
select is(has_column_privilege('authenticated', 'public.announcements', 'created_by', 'UPDATE'), false,
  'created_by cannot be laundered — the Phase-4 authorship defect');
-- ⚠ THIS ONE IS DELIBERATELY TRUE, AND IT IS THE ONE MOST LIKELY TO BE
-- "CORRECTED" BY A LATER READER. The spec asked for an ungrantable
-- published_at AND for scheduled publishing; those are mutually exclusive,
-- because a future publication time can only be set by writing the column.
-- The wall against the one dangerous direction — BACK-dating, which widens the
-- as-of audience — is the announcements_not_backdated CHECK against created_at,
-- which is not granted. Revoking this grant does not harden anything; it
-- deletes scheduling. See the behavioural pair in 37_announcements_rls.sql.
select is(has_column_privilege('authenticated', 'public.announcements', 'published_at', 'INSERT'), true,
  'published_at IS insert-grantable — scheduling needs it, and the CHECK against created_at is what closes back-dating');
select is(has_column_privilege('authenticated', 'public.announcements', 'fanned_out_at', 'INSERT'), false,
  'fanned_out_at is trigger-owned: a client that could set it would skip its own announcement''s notifications');
select is(has_any_column_privilege('authenticated', 'public.announcement_reads', 'UPDATE'), false,
  'a read is when it happened — no table AND no column UPDATE grant');
```

- [ ] **Step 3: Run it and mutate**

```bash
cd ~/dev/iqra-portal && docker exec -i supabase_db_iqra-portal psql -U postgres -q -f - < supabase/tests/31_column_locks.sql
```

Expected: 31 `ok`.

| # | Mutation | Must redden |
|---|---|---|
| 1 | `grant update on public.announcements to authenticated` (table-level) | 23 |
| 2 | `grant update (published_at) on public.announcements to authenticated` | 26 |
| 3 | `grant update (created_by) on public.announcements to authenticated` | 28 |
| 4 | `grant update (read_at) on public.announcement_reads to authenticated` | 31 |
| 5 | `revoke insert (published_at) on public.announcements from authenticated` | 29 |

⚠ Mutation 1 must redden **23 only** — mutations 24–28 are column probes and `has_column_privilege` reports true when a table grant exists, so 24 and 25 stay green while 26–28 also flip. Record what actually happened: if 26–28 redden too, that is the asymmetry the block's comment describes and it is correct behaviour, not a defect.

Restore each with the inverse statement and re-run the migration's grant block; confirm with:

```bash
docker exec supabase_db_iqra-portal psql -U postgres -q -t -A -c "select relacl from pg_class where oid='public.announcements'::regclass;"
```

- [ ] **Step 4: Commit**

```bash
cd ~/dev/iqra-portal
git add supabase/tests/31_column_locks.sql
git commit -m "test(oppslag): pin the announcement column grants, including the one that is deliberately open"
```

Body must state why `published_at` is INSERT-grantable and what carries the wall instead, so the next reader does not "harden" scheduling away.

---

## Task 4: `announcement_read_status` — the read-tracking projection

**Files:**
- Create: `supabase/migrations/20260806121000_announcement_read_status.sql`
- Modify: `supabase/tests/37_announcements_rls.sql`
- Modify: `src/lib/supabase/database.types.ts` (regenerated)

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260806121000_announcement_read_status.sql`:

```sql
-- D10's read-tracking, as a projection rather than as a wider policy.
--
-- ★ WHY A PROJECTION AT ALL. «12 av 28 har lest» needs three things a teacher
-- cannot read directly: the as-of roster (public.class_students has no
-- teacher-facing as-of read), the pupils' guardians (public.guardian_student
-- is admin-or-own-family), and those guardians' read rows. Widening any of the
-- three is the change D14 exists to avoid — plan 1 measured that a guardian
-- reading class_teachers gets 0 rows and that the obvious fix hands over
-- public.profiles.phone with the row. So: a definer projection, four columns,
-- and the caller bind INSIDE THE WHERE, where it decides what EXISTS rather
-- than what is shown.
--
-- ★ THE UNIT IS THE PUPIL, NOT THE USER (A5). A read counts if ANY of the
-- pupil's guardians, or the pupil's own login, has a row. Counting users would
-- put a two-guardian family twice in the denominator and send the office
-- chasing a parent who has already read.
--
-- ★ THE ROSTER IS AS OF published_at (A3), the same set
-- private.reads_announcement_row admits. A live roster would count families
-- the announcement is invisible to, so «12 av 28» would be a number nobody
-- could act on.
--
-- ⛔ PROTECTED PUPILS ARE INCLUDED, AND THE DENOMINATOR IS NOT REDUCED.
-- The Phase-5 spec §7 says the opposite, transposing the 2026-08-03 mate-name
-- rule onto this list. That rule is CROSS-FAMILY: it stops a parent learning
-- that another family's child is under protection. This function is reachable
-- only through private.writes_announcement — admin, or that class's own
-- teacher — i.e. exactly the people 20260717164230:4-6 records as already
-- seeing protected pupils on their roster, and 20260803001000:29-31 records as
-- "entitled to know a child is protected". Omitting the row here would hide
-- from the office precisely the family it most needs to phone, and would buy
-- privacy from nobody. 37_announcements_rls.sql carries a witness so this
-- cannot be quietly "fixed" back on the strength of §7's sentence.
--
-- ⚠ THE SCHOOL-WIDE BRANCH IS ONE CLAUSE, NOT A SECOND FUNCTION. For
-- class_id null the roster is every pupil with an as-of enrolment in ANY
-- class. That is the case where "who has not seen it" is most valuable, since
-- announcements send no e-mail at all (D12) and the office's only instrument
-- is the phone.
create or replace function public.announcement_read_status(p_announcement_ids uuid[])
returns table (announcement_id uuid, student_id uuid, display_name text, has_read boolean)
language sql stable security definer set search_path = ''
as $$
  select a.id,
         s.id,
         s.first_name || ' ' || s.last_name,
         exists (
           select 1
           from public.announcement_reads ar
           where ar.announcement_id = a.id
             and (
               ar.user_id = s.student_user_id
               or exists (
                 select 1 from public.guardian_student gs
                 where gs.student_id = s.id and gs.guardian_id = ar.user_id
               )
             )
         )
  from public.announcements a
  -- distinct, because a pupil may hold two CLOSED enrolments whose intervals
  -- both contain published_at. class_students_one_active only forbids two OPEN
  -- ones, so the school-wide branch can legitimately match a pupil twice.
  join lateral (
    select distinct cs.student_id
    from public.class_students cs
    where (a.class_id is null or cs.class_id = a.class_id)
      and cs.enrolled_on <= (a.published_at at time zone 'Europe/Oslo')::date
      and (cs.left_on is null
           or (a.published_at at time zone 'Europe/Oslo')::date < cs.left_on)
  ) roster on true
  join public.students s on s.id = roster.student_id
  where a.id = any (coalesce(p_announcement_ids, array[]::uuid[]))
    -- ★ The caller bind. In the select list it would decide what to SHOW; here
    -- it decides which announcements the rest of the query can even see.
    and private.writes_announcement((select auth.uid()), a.class_id);
$$;
-- ⚠ Name the roles — `from public` does not strip the explicit anon grant
-- pg_default_acl gives to supabase_admin-created functions (the cloud path).
revoke execute on function public.announcement_read_status(uuid[]) from public;
revoke execute on function public.announcement_read_status(uuid[]) from anon;
grant execute on function public.announcement_read_status(uuid[]) to authenticated;
comment on function public.announcement_read_status(uuid[]) is
  'D10. Who, in the as-of roster at published_at, has read each announcement — one row per (announcement, pupil). Bound to admin or the class''s own teacher by private.writes_announcement inside the WHERE, so another class''s rows are ABSENT rather than filtered on display. Protected pupils are INCLUDED: this is a staff-only surface and staff already see them on the roster (see the migration header).';
```

- [ ] **Step 2: Apply and regenerate types**

```bash
cd ~/dev/iqra-portal && supabase db reset && npm run db:types
```

- [ ] **Step 3: Add §H to pgTAP 37**

Bump `plan(39)` to `plan(47)` and insert this block **immediately after §G** (it depends on the read row assertion 31 inserted) and **before §J**:

```sql
-- ── §H 35-42 read-tracking (D10) ────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.announcement_read_status(
             array['c0000000-0000-0000-0000-000000000041'::uuid])), 3::bigint,
  'A3: the roster is AS OF published_at — Ordinær, Skjermet and Startet, but not the family that joined later nor the one that left that day');
-- ⛔ The witness for A4. Spec §7 asks for this pupil to be omitted; the two
-- migration comments it was transposed from say staff are entitled to see her.
-- If this ever goes red, read the header of 20260806121000 before "fixing" it.
select is((select count(*) from public.announcement_read_status(
             array['c0000000-0000-0000-0000-000000000041'::uuid])
           where student_id = 'c0000000-0000-0000-0000-000000000035'), 1::bigint,
  'A4: a PROTECTED pupil is present in the read-tracking list — this is a staff-only surface, and hiding her hides the family most worth phoning');
-- ★ MEMBERSHIP, NOT ONLY THE COUNT, and the reason is measured rather than
-- stylistic: dropping the Europe/Oslo cast moves the resolved day to D-1, which
-- pushes «Startet» OUT of the roster and pulls «Sluttet» IN — so the count
-- stays at 3 and the assertion above cannot see the mutation at all. These two
-- name the pupils at the two edges, and either one alone would still miss it.
select is((select count(*) from public.announcement_read_status(
             array['c0000000-0000-0000-0000-000000000041'::uuid])
           where student_id = 'c0000000-0000-0000-0000-000000000036'), 1::bigint,
  'the roster''s INCLUSIVE edge: the family that started on the Oslo publication day is in the denominator');
select is((select count(*) from public.announcement_read_status(
             array['c0000000-0000-0000-0000-000000000041'::uuid])
           where student_id = 'c0000000-0000-0000-0000-000000000033'), 0::bigint,
  'the roster''s EXCLUSIVE edge: the family that left on that day is not — the office must not be told to phone them about a notice they never got');
select is((select count(*) from public.announcement_read_status(
             array['c0000000-0000-0000-0000-000000000041'::uuid])
           where has_read), 1::bigint,
  'A5: exactly one FAMILY has read it — the row assertion 31 inserted, counted once for the pupil and not once per guardian');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.announcement_read_status(
             array['c0000000-0000-0000-0000-000000000041'::uuid])), 0::bigint,
  'the caller bind: a teacher of another class gets NOTHING for the identical id array');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.announcement_read_status(
             array['c0000000-0000-0000-0000-000000000041'::uuid])), 0::bigint,
  'and a guardian gets nothing — read-tracking is who to phone, not something families see about each other');
reset role;

-- ⚠ NOT columns_are. That reads pg_attribute on a RELATION, and a `returns
-- table` function has no pg_class row — measured in plan 1 against the
-- identically-shaped assignment_group_mate_names: every column reported
-- missing, pg_class count 0. The assertion could never pass, so D14's central
-- claim would have shipped unpinned.
select is(pg_get_function_result(
    'public.announcement_read_status(uuid[])'::regprocedure),
  'TABLE(announcement_id uuid, student_id uuid, display_name text, has_read boolean)',
  'exactly four columns — a fifth is where a guardian''s name or a phone number would arrive');
```

- [ ] **Step 4: Run and mutate**

```bash
cd ~/dev/iqra-portal && docker exec -i supabase_db_iqra-portal psql -U postgres -q -f - < supabase/tests/37_announcements_rls.sql
```

Expected: 47 `ok`.

§H's assertions land at **35** (count = 3) · **36** (protected present) · **37** (inclusive edge present) · **38** (exclusive edge absent) · **39** (one family has read) · **40** (other teacher → 0) · **41** (guardian → 0) · **42** (return shape).

| # | Mutation | Must redden | Must NOT redden |
|---|---|---|---|
| 1 | delete `and private.writes_announcement(…)` from the `where` | **40 and 41** | 35 |
| 2 | move `private.writes_announcement(…)` out of the `where` and into the select list as a fifth column | 40, 41 **and 42** — the return type changes, which is what assertion 42 is for | — |
| 3 | add `and not s.protected` to the roster — the change §7 asks for | **35 and 36** (the count drops to 2) | 40 |
| 4 | `cs.enrolled_on <=` → `<` | **35 and 37** (Startet leaves the roster, count 2) | 40 |
| 5 | `< cs.left_on` → `<=` | **35 and 38** (Sluttet joins the roster, count 4) | 40 |
| 6 | drop the Oslo cast, both occurrences | ⚠ **37 and 38, NOT 35** — the resolved day moves to D-1, which pushes Startet out and pulls Sluttet in, so the count stays at 3 and the count assertion is blind to it | 35, 40 |
| 7 | replace the guardian arm of the `has_read` exists with `false` | 39 | 35 |

⚠ Mutation 6 is the one worth reading. The count assertion cannot see it — two pupils swap places and 3 stays 3. That is why 37 and 38 exist, and it is the same lesson as plan 1's «the fixture was hiding the defect it sat next to»: a count over a set is invisible to any mutation that preserves the set's size.

⚠ Mutation 3 is not a bug being introduced — it is **the specification's own instruction**, applied, so the reviewer can see exactly what §7 would have cost. Record the reddened assertions in the commit body.

- [ ] **Step 5: Commit**

```bash
cd ~/dev/iqra-portal
git add supabase/migrations/20260806121000_announcement_read_status.sql supabase/tests/37_announcements_rls.sql src/lib/supabase/database.types.ts
git commit -m "feat(oppslag): who has read it, through a projection rather than a wider policy"
```

Body must state the A4 reversal explicitly — that spec §7 asks for protected pupils to be omitted, that the two migrations it was transposed from say the opposite for staff surfaces, and that a witness assertion now pins the decision.

---

## Task 5: `claim_due_announcements` — the scheduled-publish claim (§11 3b)

**Files:**
- Create: `supabase/migrations/20260806122000_announcement_fanout_claim.sql`
- Modify: `supabase/tests/37_announcements_rls.sql`
- Modify: `src/lib/supabase/database.types.ts` (regenerated)

§5.1 calls the scheduled fan-out *"the single most likely thing to be got wrong in implementation"* and the spec assigned it to nobody until 3b was added. This task builds the half that can exist without `notifications`, and states precisely what plan 3 must do with it.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260806122000_announcement_fanout_claim.sql`:

```sql
-- The scheduled-publish claim (§11 3b).
--
-- ★ WHY THIS EXISTS AT ALL. An announcement's notifications must be created at
-- published_at, not at INSERT: a notification for a row the reader's own policy
-- still hides is both a leak signal ("something exists about my class that I
-- cannot open") and a dead end. So a scheduled announcement needs a SECOND
-- trigger point, and this is it.
--
-- ⛔ WHAT PLAN 3 MUST DO WITH IT, AND IT IS NOT WHAT LOOKS EASIEST.
-- Plan 3 must add its notification INSERT INSIDE THIS FUNCTION BODY — as
--   with claimed as (update … returning …) insert into public.notifications …
-- and NOT in the route handler that calls it. This function STAMPS
-- fanned_out_at. If the fan-out is a separate round trip, a crash between the
-- two leaves an announcement marked as announced with no notifications, and
-- the partial index will never serve it again. Idempotence is asserted below
-- precisely so nobody "repairs" such a row by re-running the claim.
--
-- ⛔ AND WHAT NOTHING HERE DOES. fanned_out_at does NOT gate reading. A
-- scheduled announcement becomes readable at published_at whether or not this
-- function ever runs — private.reads_announcement_row keys on published_at
-- alone. So if the scheduler never runs, the announcement still publishes; the
-- only thing missing is the ping. In this plan there is no scheduler and no
-- ping at all, so nothing calls this function yet.
--
-- ★ WHY THE OUT PARAMETERS ARE MISNAMED. A `returns table` function's OUT
-- names shadow column names inside its own body, and they are rendered into
-- pg_get_functiondef's header — so an OUT parameter called published_at would
-- make the fingerprint marker 'b.published_at <= now()' unfailable AND shadow
-- the column it reads. Both problems, one rename.
--
-- security definer, owned by a BYPASSRLS role, so it needs neither an RLS
-- exemption nor a column grant. It is granted to service_role and to nothing
-- else; there is no caller check in the body because there is no other caller.
create or replace function public.claim_due_announcements()
returns table (announcement_id uuid, audience_class_id uuid, publish_time timestamptz)
language sql volatile security definer set search_path = ''
as $$
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
  returning a.id, a.class_id, a.published_at;
$$;
-- ⚠ Name every role. `revoke execute … from public` does NOT strip the
-- explicit anon/authenticated EXECUTE grants pg_default_acl hands to functions
-- created by supabase_admin, which is the CLOUD path — the omission would leave
-- this callable by every logged-in parent in production only
-- (20260728200000:229). And this one is worse than most: any caller can burn
-- every pending announcement's fan-out with a single call.
revoke execute on function public.claim_due_announcements() from public;
revoke execute on function public.claim_due_announcements() from anon;
revoke execute on function public.claim_due_announcements() from authenticated;
grant execute on function public.claim_due_announcements() to service_role;
comment on function public.claim_due_announcements() is
  'Claims every announcement whose published_at has arrived and which has not been announced, stamping fanned_out_at in the same statement (for update skip locked, so two drain runs never claim the same row). service_role only. ⛔ Plan 3 must add its notifications INSERT INSIDE this body — a claim that stamps in one round trip and fans out in another loses the fan-out on any crash, and the partial index will never serve the row again.';
```

- [ ] **Step 2: Apply and regenerate types**

```bash
cd ~/dev/iqra-portal && supabase db reset && npm run db:types
```

- [ ] **Step 3: Add §I to pgTAP 37**

Bump `plan(47)` to `plan(52)` and insert **after §H, before §J**:

```sql
-- ── §I 43-47 the scheduled-publish claim (§11 3b) ───────────────────
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select * from public.claim_due_announcements() $$,
  '42501', null,
  'the claim is service_role only — a logged-in parent could otherwise burn every pending fan-out in one call');
reset role;

set local role service_role;
select is((select count(*) from public.claim_due_announcements()), 0::bigint,
  'nothing to claim: the BEFORE INSERT trigger already stamped every immediately-published row, so plan 3''s first drain will not retro-fan the whole history');
reset role;

-- Undo one stamp, which is the state a genuinely scheduled announcement
-- reaches the moment its published_at arrives.
update public.announcements set fanned_out_at = null
  where id = 'c0000000-0000-0000-0000-000000000041';
set local role service_role;
select is((select announcement_id from public.claim_due_announcements()),
  'c0000000-0000-0000-0000-000000000041'::uuid,
  'the claim returns exactly the due, unannounced announcement');
select is((select count(*) from public.claim_due_announcements()), 0::bigint,
  'and a second call returns nothing — the stamp is the idempotence, which is why plan 3 must not "repair" a lost fan-out by re-running');
reset role;
select is((select fanned_out_at from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000043'), null,
  'a FUTURE announcement is never claimed — its notifications belong at published_at, not at insert');
```

⚠ `set local role service_role` is deliberately **not** paired with a `request.jwt.claims` setting — the function takes no caller identity, and asserting one would mask a bind that does not exist.

- [ ] **Step 4: Run and mutate**

```bash
cd ~/dev/iqra-portal && docker exec -i supabase_db_iqra-portal psql -U postgres -q -f - < supabase/tests/37_announcements_rls.sql
```

Expected: 52 `ok`.

§I's assertions land at **43** (authenticated → 42501) · **44** (nothing to claim) · **45** (the claim returns exactly `…041`) · **46** (a second claim returns nothing) · **47** (`…043` is never claimed).

| # | Mutation | Must redden | Must NOT redden |
|---|---|---|---|
| 1 | delete `and b.fanned_out_at is null` | 46 (a second claim returns the row again) | 45 |
| 2 | delete `and b.published_at <= now()` | 47 (the scheduled row is claimed early) | 45 |
| 3 | `grant execute on function public.claim_due_announcements() to authenticated` | 43 | 45 |
| 4 | `stamp_announcement_fanout`: `return new;` with the assignment deleted | 44 (there is suddenly a backlog to claim) | 43 |

⚠ Mutation 4 belongs to Task 1's trigger but has no assertion there — assertion 44 is the only thing in the suite that can see it. Note that in the commit body.

- [ ] **Step 5: Commit**

```bash
cd ~/dev/iqra-portal
git add supabase/migrations/20260806122000_announcement_fanout_claim.sql supabase/tests/37_announcements_rls.sql src/lib/supabase/database.types.ts
git commit -m "feat(oppslag): claim the announcements whose publish time has arrived"
```

Body must state that nothing calls this yet, that plan 3 must put the notification INSERT inside the function body and why, and that `fanned_out_at` does not gate reading — a scheduled announcement publishes whether or not the drain ever runs.

---

## Task 6: definer fingerprints — the eight new functions

**Files:**
- Modify: `supabase/tests/29_definer_fingerprints.sql`

- [ ] **Step 1: Read the file's counter and one existing entry**

```bash
cd ~/dev/iqra-portal && git diff supabase/tests/29_definer_fingerprints.sql && tail -25 supabase/tests/29_definer_fingerprints.sql && sed -n '215,235p' supabase/tests/29_definer_fingerprints.sql
```

Expected: the final assertion is `is(count, 49, …)` — re-verified 2026-08-06 **after** `3f67907` landed, which touched this file's comments and left the counter alone. If it is not 49, a later commit has moved it; take the value in the file and recompute the delta, do not carry 49 forward from here.

⚠ **This counter counts (function, predicate) PAIRS, not functions.** The `lateral unnest` is the whole reason. A reviewer reading "eight new functions" and writing 57 has made the mistake the file's own comment warns about, twice already on this project.

- [ ] **Step 2: Add the eight entries**

Append to the `values` list, before the closing `) as f(sig, markers);`:

```sql
    ,
    -- The ninth and tenth copies of the enrolment interval. The two operators
    -- and the timezone are what 34_enrollment_boundary.sql asserts
    -- behaviourally; these markers stop them being DELETED without a diff.
    (
      'private.guardian_in_class_asof(uuid,uuid,timestamptz)',
      array[
        'cs.enrolled_on <=',
        'cs.left_on',
        'Europe/Oslo',
        'gs.guardian_id'
      ]
    ),
    (
      'private.student_in_class_asof(uuid,uuid,timestamptz)',
      array[
        'cs.enrolled_on <=',
        'cs.left_on',
        'Europe/Oslo',
        's.student_user_id'
      ]
    ),
    -- ★ The announcement read rule. Its parameters are named cls/pub/author
    -- precisely so these markers cannot be satisfied by the FUNCTION HEADER —
    -- finding F1 of plan 1's panel, where the marker 'kind' became unfailable
    -- the moment `kind` was a parameter name. If anyone renames these
    -- parameters to class_id/published_at/created_by, three of the six markers
    -- below go vacuous while still reporting green.
    (
      'private.reads_announcement_row(uuid,uuid,timestamptz,uuid)',
      array[
        'private.has_role',
        'private.teaches_class',
        'private.guardian_in_class_asof',
        'private.student_in_class_asof',
        'cls is null',
        'pub <= now()'
      ]
    ),
    -- The by-id lookup exists to DELEGATE. If it ever grows a body of its own,
    -- there are two copies of the read rule and the untested one wins.
    (
      'private.reads_announcement(uuid,uuid)',
      array[ 'private.reads_announcement_row' ]
    ),
    -- Stubbed to `select true`, this lets any authenticated user publish to
    -- every family in the school. The null branch is explicit for a reason:
    -- teaches_class(uid, null) is false, so a single expression would make
    -- school-wide announcements writable by nobody, including admin.
    (
      'private.writes_announcement(uuid,uuid)',
      array[
        'private.has_role',
        'private.teaches_class',
        'cid is null'
      ]
    ),
    -- The UI's edit control asks this instead of re-deriving the policy. It
    -- must stay a MIRROR of announcements_update_author, both conjuncts.
    (
      'public.can_edit_announcement(uuid)',
      array[
        'private.writes_announcement',
        'a.created_by = (select auth.uid())'
      ]
    ),
    -- A projection in `public`, i.e. on the PostgREST surface. The caller bind
    -- is the whole of its access control: losing it lets any authenticated user
    -- enumerate every class's roster, by name, with read state attached.
    (
      'public.announcement_read_status(uuid[])',
      array[
        'private.writes_announcement',
        'cs.enrolled_on <=',
        'cs.left_on',
        'Europe/Oslo'
      ]
    ),
    -- Both conjuncts are correctness, not access: without the first the drain
    -- announces the same notice every run; without the second it announces a
    -- scheduled one early, to an audience the read policy still hides.
    (
      'public.claim_due_announcements()',
      array[
        'b.fanned_out_at is null',
        'b.published_at <= now()'
      ]
    )
```

Then update the counter. **Expected new value: 49 + 26 = 75**, from these per-entry marker counts:

| entry | markers |
|---|---|
| `guardian_in_class_asof` | 4 |
| `student_in_class_asof` | 4 |
| `reads_announcement_row` | 6 |
| `reads_announcement` | 1 |
| `writes_announcement` | 3 |
| `can_edit_announcement` | 2 |
| `announcement_read_status` | 4 |
| `claim_due_announcements` | 2 |
| **added** | **26** |

⛔ **Do not take 75 on trust.** Apply the edit, run the file, and if assertion 1 reports a different number, **count the markers in the entries you actually wrote** and correct this document. Never nudge the counter to make a failure go away — that is the file's own standing instruction, and plan 1's ledger records the plan getting this arithmetic wrong twice (26 → "31", when the true value was 43).

Also update the comment above the counter, which currently narrates the 26 → 43 → 48 → 49 history, with the 49 → 75 step and the same "these are pairs, not functions" warning.

- [ ] **Step 3: Run it**

```bash
cd ~/dev/iqra-portal && docker exec -i supabase_db_iqra-portal psql -U postgres -q -f - < supabase/tests/29_definer_fingerprints.sql
```

Expected: 2 `ok`. If assertion 2 fails, it names the missing marker — the marker string is a **substring** match against `pg_get_functiondef`, so a whitespace difference is enough to fail it. Fix the marker to match the installed body verbatim, not the other way round.

- [ ] **Step 4: ★ Prove three of the new markers can actually fail**

A fingerprint catches a **deletion**, never a **rewrite** — this file's own comment says so, and plan 1 measured a one-token column swap defeating both the marker and all 13 behavioural assertions. Run these three and confirm assertion 2 goes red for each, then restore and re-verify with the md5 check in standing rule 3:

| # | Mutation | Marker it must catch |
|---|---|---|
| 1 | `reads_announcement_row`: delete the `cls is null` arm | `'cls is null'` |
| 2 | `announcement_read_status`: delete `and private.writes_announcement(…)` | `'private.writes_announcement'` |
| 3 | `guardian_in_class_asof`: replace `(pub at time zone 'Europe/Oslo')::date` with `pub::date` | `'Europe/Oslo'` |

⚠ **And run the F1 check.** Rename `reads_announcement_row`'s parameters to `(uid uuid, class_id uuid, published_at timestamptz, created_by uuid)` **and** delete the `cls is null` arm. It should redden, because `'cls is null'` then appears nowhere. If it does **not** redden, a marker is being satisfied by the header and must be rewritten — that is the whole content of finding F1.

- [ ] **Step 5: Commit**

```bash
cd ~/dev/iqra-portal
git add supabase/tests/29_definer_fingerprints.sql
git commit -m "test(oppslag): fingerprint the announcement predicates and the two projections"
```

Body must state the new counter value, that it counts pairs rather than functions, and that the parameter names of `reads_announcement_row` are load-bearing for three markers.

---

## Task 7: teacher announcement list — DAL slice + route + nav

⚠ **`knip` fails unused exports at ERROR level.** Every DAL export in this plan lands in the same commit as its first consumer. Do not create `announcements.ts` with six exports and one page.

**Files:**
- Create: `src/lib/dal/announcements.ts`
- Create: `src/components/announcements/AnnouncementList.tsx`
- Create: `src/app/(portal)/laerer/oppslag/page.tsx`
- Modify: `src/app/(portal)/laerer/LaererNav.tsx`

- [ ] **Step 1: Write the DAL slice**

Create `src/lib/dal/announcements.ts`:

```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { requireStaffRole } from './session';

export interface AnnouncementRow {
  id: string;
  title: string;
  classId: string | null;
  className: string | null;
  publishedAt: string;
  /** published_at has not arrived yet. Only the author and admin see these. */
  scheduled: boolean;
}

/**
 * Announcements for the caller, newest publication first.
 *
 * RLS decides the audience — this read applies NO predicate of its own beyond
 * the sort. Restating reads_announcement_row here is the drift D21 removed
 * from the notification fan-out, and the same argument applies to a DAL read:
 * two copies of one rule disagree eventually, and the copy nobody tests wins.
 *
 * ⚠ `scheduled` is derived from the row's own published_at, not from a second
 * query and not from fanned_out_at. fanned_out_at is about NOTIFICATIONS; a
 * scheduled announcement is readable at published_at whether or not anything
 * ever announced it.
 */
export async function listAnnouncements(): Promise<AnnouncementRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, class_id, published_at, classes(name)')
    .order('published_at', { ascending: false });
  if (error) throw new Error(`Kunne ikke lese oppslag: ${error.message}`);
  const now = Date.now();
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    classId: row.class_id,
    className: row.classes ? row.classes.name : null,
    publishedAt: row.published_at,
    scheduled: new Date(row.published_at).getTime() > now,
  }));
}

/** Teacher surface: role + AAL2 first, then the same unfiltered read. */
export async function listAnnouncementsForTeacher(): Promise<AnnouncementRow[]> {
  await requireStaffRole('teacher');
  return listAnnouncements();
}
```

⚠ Task 9 adds `listAnnouncementsForFamily`, which needs `requireRole`. **Do not import it in this commit** — an unused import is a lint error in its own right. Import and function land together in Task 9.

★★ **`className` IS NULL FOR A FAMILY WHOSE ENROLMENT HAS CLOSED, AND THAT IS NOT A BUG TO FIX HERE.** Measured 2026-08-06: `public.classes` carries three SELECT policies, and the two family arms are `classes_select_guardian` → `private.guardian_in_class` and `classes_select_student` → `private.student_in_class` — **both LIVE** (`cs.left_on is null`). The announcement's own audience is **as-of** (D9). So a family that has left the class still reads the announcement and can no longer read the class row: the embed returns `null`.

This is not rare. **On term-rollover day every enrolment closes at once**, so every family loses the class name on every past class announcement, simultaneously. It is the same shape as plan 1's `profiles(full_name)` embed, which returned NULL for every other sender in the school.

★ **The consequence, and the fix.** `className` must never be the discriminator between «Hele skolen» and a class notice — that is `classId`. A component keyed on the name would relabel every past class notice as school-wide the morning after a rollover, telling ~150 families that a message meant for one class went to everyone. **Step 2 puts the rule in one function with its own test.** Do **not** widen the `classes` policies to fix it: that hands every family the whole school's class list, which is the change D14 exists to avoid.

- [ ] **Step 2: Write the audience label, once**

Create `src/lib/announcement-audience.ts`:

```ts
/**
 * What to print as an announcement's audience.
 *
 * ★ THE DISCRIMINATOR IS class_id, NEVER THE CLASS NAME. classes carries
 * LIVE select policies for families (classes_select_guardian →
 * private.guardian_in_class, classes_select_student → private.student_in_class,
 * both filtering left_on is null), while an announcement's audience is resolved
 * AS OF published_at. So a family that has since left the class still reads the
 * notice and gets a NULL class name — and on term-rollover day that happens to
 * every family at once.
 *
 * Keyed on the name, «Hele skolen» would be printed over every past class
 * notice the morning after a rollover: the portal telling ~150 families that a
 * message meant for one class went to the whole school. Keyed on class_id it
 * degrades to a true, vaguer sentence instead.
 */
export function audienceLabel(classId: string | null, className: string | null): string {
  if (classId === null) return 'Hele skolen';
  return className ?? 'Klasseoppslag';
}
```

And its test, `src/lib/announcement-audience.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { audienceLabel } from './announcement-audience';

describe('audienceLabel', () => {
  it('names the class when the reader can see it', () => {
    expect(audienceLabel('c1', 'Klasse 3')).toBe('Klasse 3');
  });

  it('says «Hele skolen» only when there is no class at all', () => {
    expect(audienceLabel(null, null)).toBe('Hele skolen');
  });

  // ★ The regression this function exists for. A family whose enrolment closed
  // still reads the announcement (as-of, D9) but can no longer read the class
  // row (live policy) — so className is null while classId is not. Printing
  // «Hele skolen» here would tell the family a class notice went to everyone.
  it('does NOT say «Hele skolen» for a class whose name the reader cannot read', () => {
    expect(audienceLabel('c1', null)).not.toBe('Hele skolen');
    expect(audienceLabel('c1', null)).toBe('Klasseoppslag');
  });
});
```

- [ ] **Step 3: Write the shared list component**

Create `src/components/announcements/AnnouncementList.tsx`:

```tsx
import Link from 'next/link';
import { Chip } from '@/components/ui/Chip';
import { audienceLabel } from '@/lib/announcement-audience';
import { formatDateNb, formatDateTimeNb, osloDateOf } from '@/lib/dates';
import type { AnnouncementRow } from '@/lib/dal/announcements';

/**
 * `basePath` differs per surface (/laerer/oppslag, /forelder/oppslag, …) so the
 * same list serves all four without a role check of its own — the row set is
 * already whatever RLS returned to the caller.
 *
 * ⚠ The audience line goes through audienceLabel, which keys on classId rather
 * than on className. A family that has left the class still reads the notice
 * (as-of, D9) but can no longer read the class row (live policy), so className
 * is null — and on term-rollover day that is every family at once.
 *
 * ⚠ `publishedAt` is a TIMESTAMPTZ and must be narrowed to an Oslo calendar day
 * before formatDateNb sees it: that helper anchors its argument to UTC noon by
 * string concatenation, so a full timestamp builds an Invalid Date and Intl
 * THROWS. A scheduled row prints the time as well, because «7. nov.» is not
 * enough to check that «lørdag 07:00» is what you meant.
 */
export function AnnouncementList({
  announcements,
  basePath,
}: {
  announcements: AnnouncementRow[];
  basePath: string;
}) {
  return (
    <ul className="flex flex-col divide-y divide-hairline">
      {announcements.map((item) => (
        <li key={item.id}>
          <Link
            href={`${basePath}/${item.id}`}
            className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-4 transition-colors duration-200 ease-brand hover:bg-surface-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span className="flex flex-col gap-1">
              <span className="font-medium">{item.title}</span>
              <span className="text-sm text-ink/60">
                {audienceLabel(item.classId, item.className)}
              </span>
            </span>
            <span className="flex items-center gap-3">
              {item.scheduled ? <Chip tone="warning">Planlagt</Chip> : null}
              <span className="text-sm tabular-nums text-ink/60">
                {item.scheduled
                  ? formatDateTimeNb(item.publishedAt)
                  : formatDateNb(osloDateOf(item.publishedAt))}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Write the page**

Create `src/app/(portal)/laerer/oppslag/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';
import { PillLink } from '@/components/ui/PillLink';
import { AnnouncementList } from '@/components/announcements/AnnouncementList';
import { listAnnouncementsForTeacher } from '@/lib/dal/announcements';

export const metadata: Metadata = { title: 'Oppslag' };

export default async function LaererOppslagPage() {
  const announcements = await listAnnouncementsForTeacher();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold">Oppslag</h1>
        <div className="print:hidden">
          <PillLink href="/laerer/oppslag/ny" variant="primary">
            Nytt oppslag
          </PillLink>
        </div>
      </div>

      {announcements.length === 0 ? (
        <EmptyState
          title="Ingen oppslag ennå"
          description="Beskjeder til klassene dine vises her, med det nyeste øverst. Et oppslag går til alle foresatte som var påmeldt da det ble publisert."
          action={
            <PillLink href="/laerer/oppslag/ny" variant="primary">
              Skriv det første
            </PillLink>
          }
        />
      ) : (
        <AnnouncementList announcements={announcements} basePath="/laerer/oppslag" />
      )}
    </div>
  );
}
```

⚠ `/laerer/oppslag/ny` does not exist until Task 8. Between this commit and that one the link 404s — acceptable for an intermediate commit (the build passes, nothing crashes). If you prefer no dead link, land Tasks 7 and 8 as one commit.

- [ ] **Step 5: Add the nav entry**

In `src/app/(portal)/laerer/LaererNav.tsx`, add to `ITEMS` after «Meldinger»:

```ts
  { href: '/laerer/oppslag', label: 'Oppslag', exact: false },
```

⚠ `AdminNav.tsx` carries a comment saying «Meldinger» is *"Last, as on the other three navs"*. That becomes false in Task 10 — update the comment there, in that task, rather than leaving a stale one behind.

- [ ] **Step 6: Verify**

```bash
cd ~/dev/iqra-portal && npm run typecheck && npm run lint && npm run knip && npm test -- Nav announcement-audience
```

Expected: 0 type errors; 0 lint errors; knip reports only the pre-existing findings plus `scripts/fiken-probe.mjs`; the nav tests and the three `audienceLabel` tests pass. `LaererNav.test.tsx` exists — if it pins an item count or a list of labels, update it in this commit.

- [ ] **Step 7: Commit**

```bash
cd ~/dev/iqra-portal
git add src/lib/dal/announcements.ts src/lib/announcement-audience.ts src/lib/announcement-audience.test.ts \
        src/components/announcements/AnnouncementList.tsx "src/app/(portal)/laerer/oppslag/page.tsx" \
        "src/app/(portal)/laerer/LaererNav.tsx" "src/app/(portal)/laerer/LaererNav.test.tsx"
git commit -m "feat(oppslag): teacher announcement list"
```

Body must state why the audience label keys on `class_id` rather than on the class name: `classes` carries LIVE select policies for families while the announcement audience is as-of, so a departed family reads the notice and cannot read the class row — and on rollover day that is every family at once.

---

## Task 8: teacher create, edit, withdraw, and the read-tracking detail

**Files:**
- Create: `src/lib/validation/announcements.ts`
- Create: `src/components/announcements/AnnouncementBody.tsx`
- Create: `src/components/announcements/ReadStatus.tsx`
- Create: `src/app/(portal)/laerer/oppslag/ny/page.tsx`
- Create: `src/app/(portal)/laerer/oppslag/ny/NewAnnouncementForm.tsx`
- Create: `src/app/(portal)/laerer/oppslag/[announcementId]/page.tsx`
- Create: `src/app/(portal)/laerer/oppslag/actions.ts`
- Modify: `src/lib/dal/announcements.ts`
- Modify: `src/app/action-guards.test.ts` (73 → 76)

- [ ] **Step 1: Write the schemas**

Create `src/lib/validation/announcements.ts`:

```ts
import { z } from 'zod';
import { uuidField } from './school';

/**
 * Mirrors the DB CHECK constraints exactly (1..140, 1..4000) — one rule, two
 * layers, never two rules. uuidField is z.guid, not z.uuid: the seed's readable
 * UUIDs fail the RFC 9562 variant nibble and z.uuid() would reject every
 * fixture.
 */
const titleField = z
  .string()
  .trim()
  .min(1, 'Gi oppslaget en tittel.')
  .max(140, 'Tittelen kan ikke være lengre enn 140 tegn.');

const bodyField = z
  .string()
  .trim()
  .min(1, 'Skriv innholdet i oppslaget.')
  .max(4000, 'Oppslaget kan ikke være lengre enn 4000 tegn.');

/**
 * `publisertAt` is a datetime-local string («2026-11-07T07:00») or empty for
 * «publiser nå».
 *
 * ⚠ EMPTY MUST BECOME undefined, NOT a client-side Date. The database refuses a
 * published_at earlier than created_at (announcements_not_backdated), and a
 * client-computed «now» loses that race by however long the round trip takes —
 * so an immediate publish would 23514 intermittently. Omitting the column lets
 * the server default fire, which is the only value that cannot lose.
 *
 * The one-minute floor exists so the same Norwegian sentence covers both the
 * validation refusal and the 23514 a genuine race would still produce.
 */
export const announcementSchema = z.object({
  classId: z.union([uuidField, z.literal('')]).transform((v) => (v === '' ? null : v)),
  title: titleField,
  body: bodyField,
  publisertAt: z
    .string()
    .trim()
    .transform((v) => (v === '' ? undefined : v))
    .refine(
      (v) =>
        v === undefined ||
        (!Number.isNaN(Date.parse(v)) && Date.parse(v) > Date.now() + 60_000),
      'Publiseringstidspunktet må være minst ett minutt fram i tid.',
    ),
});

export const announcementEditSchema = z.object({
  id: uuidField,
  title: titleField,
  body: bodyField,
});
```

⚠ `classId: ''` maps to `null` = the whole school. A teacher's form never offers that option and `announcements_insert_staff` refuses it anyway — the transform exists so Task 10's admin form can share the schema.

- [ ] **Step 2: Extend the DAL**

Add to `src/lib/dal/announcements.ts` (and add `import { PG_ERROR } from '@/lib/pg-error';` plus a module-level `const nbCollator = new Intl.Collator('nb');`):

```ts
export interface AnnouncementDetail {
  id: string;
  title: string;
  body: string;
  classId: string | null;
  className: string | null;
  publishedAt: string;
  scheduled: boolean;
  canEdit: boolean;
}

/**
 * One announcement, and — as a side effect — the record that this user read it.
 *
 * ★ A GET THAT WRITES, DELIBERATELY. The write IS the record of the read, which
 * is the same argument adminListAuditLog makes for `admin.audit_log.viewed`
 * (audit-log.ts:27) and admin.threads.viewed makes for the oversight route.
 * There is no client component and no second server action, so there is no
 * role branch that can be forgotten on one of four surfaces.
 *
 * Recorded for STAFF too. announcement_read_status counts a read only when the
 * reader is one of the pupil's guardians or the pupil's own login, so a
 * teacher's row is inert — and one unconditional path beats a role test that
 * has to be right four times.
 *
 * ⚠ Enumeration-quiet: an announcement that exists but is not for this caller
 * is INDISTINGUISHABLE from one that does not exist. Both return null and the
 * page calls notFound().
 */
export async function getAnnouncement(id: string): Promise<AnnouncementDetail | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, body, class_id, published_at, classes(name)')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    if (error.code === PG_ERROR.INVALID_TEXT) return null;
    throw new Error(`Kunne ikke lese oppslaget: ${error.message}`);
  }
  if (!data) return null;

  // ⚠ ignoreDuplicates, not a plain insert: opening the same notice twice must
  // not 23505. And no .select() — nothing here needs the row back, and
  // `return=minimal` keeps the statement out of the RETURNING family entirely.
  const { error: readError } = await supabase
    .from('announcement_reads')
    .upsert(
      { announcement_id: data.id, user_id: user.id },
      { onConflict: 'announcement_id,user_id', ignoreDuplicates: true },
    );
  if (readError) throw new Error(`Kunne ikke registrere lesningen: ${readError.message}`);

  const { data: canEdit, error: editError } = await supabase.rpc('can_edit_announcement', {
    aid: data.id,
  });
  if (editError) throw new Error(`Kunne ikke lese redigeringsrett: ${editError.message}`);

  return {
    id: data.id,
    title: data.title,
    body: data.body,
    classId: data.class_id,
    className: data.classes ? data.classes.name : null,
    publishedAt: data.published_at,
    scheduled: new Date(data.published_at).getTime() > Date.now(),
    // ?? false closes rather than opens: an RPC that returned null must not
    // render an edit control.
    canEdit: canEdit ?? false,
  };
}

export interface ReadStatusRow {
  studentId: string;
  displayName: string;
  hasRead: boolean;
}

/**
 * Read-tracking for staff. Batched over an ARRAY, never per row: the list page
 * shows a count for every announcement on screen, and a per-row call is an N+1
 * whose per-call caller bind can be forgotten for one row.
 *
 * Returns nothing for a caller the projection refuses — absence, not a filtered
 * result, because the bind is inside its `where`.
 */
export async function getReadStatus(
  announcementIds: string[],
): Promise<Map<string, ReadStatusRow[]>> {
  const byAnnouncement = new Map<string, ReadStatusRow[]>();
  if (announcementIds.length === 0) return byAnnouncement;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('announcement_read_status', {
    p_announcement_ids: announcementIds,
  });
  if (error) throw new Error(`Kunne ikke lese lesestatus: ${error.message}`);

  for (const row of data ?? []) {
    const list = byAnnouncement.get(row.announcement_id) ?? [];
    list.push({
      studentId: row.student_id,
      displayName: row.display_name,
      hasRead: row.has_read,
    });
    byAnnouncement.set(row.announcement_id, list);
  }
  for (const list of byAnnouncement.values()) {
    list.sort((a, b) => nbCollator.compare(a.displayName, b.displayName));
  }
  return byAnnouncement;
}

/**
 * The classes this teacher may publish to. Mirrors writes_announcement's
 * non-null branch — a picker that offers a class the wall refuses produces a
 * 42501 the teacher cannot act on, and «Sjekk at klassen er din» is not advice
 * when the only control on the screen was a list we wrote.
 */
export async function listPublishableClasses(): Promise<{ id: string; name: string }[]> {
  const { user } = await requireStaffRole('teacher');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('class_teachers')
    .select('classes(id, name)')
    .eq('teacher_id', user.id);
  if (error) throw new Error(`Kunne ikke lese klassene dine: ${error.message}`);
  return (data ?? [])
    .flatMap((row) => (row.classes ? [{ id: row.classes.id, name: row.classes.name }] : []))
    .sort((a, b) => nbCollator.compare(a.name, b.name));
}
```

⚠ **Verify `listPublishableClasses` returns rows before building a form on it.** `class_teachers` carries exactly one select policy, `class_teachers_select_admin_or_own_class`, and plan 1 measured it returning **0 rows** for a guardian — the assumption that it "obviously" returns the caller's own rows was wrong once already and cost an unplanned migration. Check it in step 8's browser pass, or with a scratch query as `laerer@test.local`. If it is empty, **stop**: the fix is a definer projection mirroring `writes_announcement` in the shape of `public.guardian_thread_options()`, which is a schema + RLS change and needs the review panel.

- [ ] **Step 3: Write the actions**

Create `src/app/(portal)/laerer/oppslag/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaffRole } from '@/lib/dal/session';
import { PG_ERROR } from '@/lib/pg-error';
import { createClient } from '@/lib/supabase/server';
import { announcementEditSchema, announcementSchema } from '@/lib/validation/announcements';
import { firstIssue, type FormState } from '@/lib/validation/school';

/**
 * Publish or schedule an announcement to one of this teacher's classes.
 *
 * Wall 1 is requireStaffRole; wall 2 is announcements_insert_staff, whose
 * `with check` calls private.writes_announcement. The action does NOT re-ask
 * whether this teacher may publish here — the picker and the policy are the
 * same predicate, and a third opinion in TypeScript is the drift D21 removed.
 *
 * ⚠ published_at is OMITTED for an immediate publish. Sending a
 * client-computed now() races the server's default and trips
 * announcements_not_backdated (23514) on a perfectly legitimate publish.
 */
export async function createAnnouncementAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireStaffRole('teacher');
  const parsed = announcementSchema.safeParse({
    classId: formData.get('classId'),
    title: formData.get('title'),
    body: formData.get('body'),
    publisertAt: formData.get('publisertAt'),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  // D8: a teacher never publishes to the whole school. The policy refuses it
  // anyway; refusing it here makes the message precise instead of generic.
  if (parsed.data.classId === null) return { error: 'Velg en klasse.' };

  const supabase = await createClient();
  const { error } = await supabase.from('announcements').insert({
    class_id: parsed.data.classId,
    title: parsed.data.title,
    body: parsed.data.body,
    created_by: user.id,
    ...(parsed.data.publisertAt
      ? { published_at: new Date(parsed.data.publisertAt).toISOString() }
      : {}),
  });
  if (error) {
    if (error.code === PG_ERROR.CHECK) {
      return { error: 'Publiseringstidspunktet må være fram i tid.' };
    }
    // One sentence for every RLS refusal. Naming the class would confirm it
    // exists to anyone who guessed an id.
    return { error: 'Oppslaget ble ikke publisert. Sjekk at klassen er din.' };
  }

  revalidatePath('/laerer/oppslag');
  // ⚠ redirect() throws NEXT_REDIRECT. Last statement, outside any try/catch —
  // a catch around it swallows the control-flow signal and leaves the teacher
  // on a form that looks stuck.
  redirect('/laerer/oppslag');
}

/**
 * Fix a typo. title and body only — published_at has no UPDATE grant, so the
 * audience is fixed at creation and cannot be migrated by an edit.
 */
export async function updateAnnouncementAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaffRole('teacher');
  const parsed = announcementEditSchema.safeParse({
    id: formData.get('id'),
    title: formData.get('title'),
    body: formData.get('body'),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  // ⚠ count, not .select(). An UPDATE whose `using` clause excludes the row is
  // a NO-OP, not an error — so "no error" is not evidence that anything was
  // written. And .select() would put this in the RETURNING family for no gain.
  const { error, count } = await supabase
    .from('announcements')
    .update({ title: parsed.data.title, body: parsed.data.body }, { count: 'exact' })
    .eq('id', parsed.data.id);
  if (error) return { error: 'Oppslaget ble ikke lagret. Prøv igjen.' };
  if (count === 0) return { error: 'Bare den som skrev oppslaget kan endre det.' };

  revalidatePath('/laerer/oppslag');
  revalidatePath(`/laerer/oppslag/${parsed.data.id}`);
  return { error: null, success: true };
}

/**
 * Withdraw a SCHEDULED announcement (A2). announcements_delete_own_unpublished
 * refuses anything already published, and there is no reschedule path because
 * published_at has no UPDATE grant — moving a publication time would move who
 * ever gets to read it.
 */
export async function deleteAnnouncementAction(formData: FormData): Promise<void> {
  await requireStaffRole('teacher');
  const parsed = announcementEditSchema
    .pick({ id: true })
    .safeParse({ id: formData.get('id') });
  if (!parsed.success) throw new Error('Ugyldig oppslag.');

  const supabase = await createClient();
  // ⚠ Same reason as above, one step worse: a DELETE that RLS filters returns
  // OK with rows=0 and raises NOTHING (measured 2026-08-05). Without the count
  // this would report success for a delete that removed nothing.
  const { error, count } = await supabase
    .from('announcements')
    .delete({ count: 'exact' })
    .eq('id', parsed.data.id);
  if (error) throw new Error(`Kunne ikke slette oppslaget: ${error.message}`);
  if (count === 0) {
    throw new Error(
      'Oppslaget ble ikke slettet. Et publisert oppslag kan bare fjernes av skoleadministrasjonen.',
    );
  }

  revalidatePath('/laerer/oppslag');
  redirect('/laerer/oppslag');
}
```

- [ ] **Step 4: Write the form**

Create `src/app/(portal)/laerer/oppslag/ny/NewAnnouncementForm.tsx`:

```tsx
'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { useNoFormReset } from '@/lib/use-no-form-reset';
import { idleForm } from '@/lib/validation/school';
import { createAnnouncementAction } from '../actions';

/**
 * ⚠ THIS FORM HAS A <select>, SO IT MUST USE useNoFormReset. React 19
 * auto-resets a <form action={fn}> even when the action FAILS, and a
 * controlled <select> is NOT protected: form.reset() reverts the DOM to the
 * first <option> while React state keeps the chosen class, and React never
 * re-syncs the two. After a refused publish the box would read «Klasse 3»
 * while the form posted «Klasse 1» — a notice to the wrong families, with
 * nothing on screen looking wrong. Measured 2026-08-05; a post-commit effect
 * and a keyed remount both lose the same race, one run in six.
 */
export function NewAnnouncementForm({
  classes,
}: {
  classes: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createAnnouncementAction, idleForm);
  const formRef = useNoFormReset<HTMLFormElement>();
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [publisertAt, setPublisertAt] = useState('');

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-6">
      <Field label="Klasse" htmlFor="classId">
        <select
          id="classId"
          name="classId"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          required
          className="rounded-sm border border-border-input bg-canvas px-3 py-2"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Tittel" htmlFor="title">
        <Input
          id="title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={140}
          required
        />
      </Field>

      <Field label="Innhold" htmlFor="body">
        <textarea
          id="body"
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={4000}
          rows={8}
          required
          className="rounded-sm border border-border-input bg-canvas px-3 py-2"
        />
      </Field>

      <Field label="Publiser senere (valgfritt)" htmlFor="publisertAt">
        <Input
          id="publisertAt"
          name="publisertAt"
          type="datetime-local"
          value={publisertAt}
          onChange={(e) => setPublisertAt(e.target.value)}
        />
      </Field>
      <p className="text-sm text-ink/60">
        La feltet stå tomt for å publisere med én gang. Et planlagt oppslag kan ikke
        flyttes etterpå — det må trekkes tilbake og skrives på nytt, fordi
        publiseringstidspunktet bestemmer hvilke familier som får se det.
      </p>

      {state.error ? (
        <p role="alert" className="text-sm text-danger-ink">
          {state.error}
        </p>
      ) : null}

      <div>
        <Button type="submit" loading={pending}>
          Publiser
        </Button>
      </div>
    </form>
  );
}
```

⚠ **`ErrorPanel` is not the component for this.** It is the error-boundary body (`{digest, onRetry}`, renders its own `<h1>`) and takes no children. Plan 1 tried it and it did not compile.

- [ ] **Step 5: Write the two pages**

`src/app/(portal)/laerer/oppslag/ny/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { BackLink } from '@/components/ui/BackLink';
import { EmptyState } from '@/components/ui/EmptyState';
import { listPublishableClasses } from '@/lib/dal/announcements';
import { NewAnnouncementForm } from './NewAnnouncementForm';

export const metadata: Metadata = { title: 'Nytt oppslag' };

export default async function NyttOppslagPage() {
  const classes = await listPublishableClasses();

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <BackLink href="/laerer/oppslag">Oppslag</BackLink>
      <h1 className="text-2xl font-semibold">Nytt oppslag</h1>
      {classes.length === 0 ? (
        <EmptyState
          title="Du har ingen klasser"
          description="Et oppslag går til én klasse. Ta kontakt med skoleadministrasjonen hvis du skulle vært registrert på en klasse."
        />
      ) : (
        <NewAnnouncementForm classes={classes} />
      )}
    </div>
  );
}
```

`src/app/(portal)/laerer/oppslag/[announcementId]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BackLink } from '@/components/ui/BackLink';
import { AnnouncementBody } from '@/components/announcements/AnnouncementBody';
import { ReadStatus } from '@/components/announcements/ReadStatus';
import { getAnnouncement, getReadStatus } from '@/lib/dal/announcements';
import { requireStaffRole } from '@/lib/dal/session';

export const metadata: Metadata = { title: 'Oppslag' };

export default async function LaererOppslagDetailPage({
  params,
}: {
  params: Promise<{ announcementId: string }>;
}) {
  await requireStaffRole('teacher');
  const { announcementId } = await params;
  const announcement = await getAnnouncement(announcementId);
  if (!announcement) notFound();

  const readStatus = await getReadStatus([announcement.id]);

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <BackLink href="/laerer/oppslag">Oppslag</BackLink>
      <AnnouncementBody announcement={announcement} />
      <ReadStatus rows={readStatus.get(announcement.id) ?? []} />
    </div>
  );
}
```

- [ ] **Step 6: Write the two shared components**

`src/components/announcements/AnnouncementBody.tsx`:

```tsx
import { Chip } from '@/components/ui/Chip';
import { audienceLabel } from '@/lib/announcement-audience';
import { formatDateNb, formatDateTimeNb, osloDateOf } from '@/lib/dates';
import type { AnnouncementDetail } from '@/lib/dal/announcements';

export function AnnouncementBody({ announcement }: { announcement: AnnouncementDetail }) {
  return (
    <article className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{announcement.title}</h1>
        {announcement.scheduled ? <Chip tone="warning">Planlagt</Chip> : null}
      </div>
      <p className="text-sm text-ink/60">
        {audienceLabel(announcement.classId, announcement.className)} ·{' '}
        <span className="tabular-nums">
          {announcement.scheduled
            ? formatDateTimeNb(announcement.publishedAt)
            : formatDateNb(osloDateOf(announcement.publishedAt))}
        </span>
      </p>
      {/* whitespace-pre-wrap keeps the teacher's line breaks. The body is
          rendered as TEXT, never as markup: it is free text one member of
          staff typed and every family in the class then loads. */}
      <p className="whitespace-pre-wrap leading-relaxed">{announcement.body}</p>
    </article>
  );
}
```

`src/components/announcements/ReadStatus.tsx`:

```tsx
import type { ReadStatusRow } from '@/lib/dal/announcements';

/**
 * «12 av 28 har lest», plus who has not.
 *
 * ⚠ The numerator and the denominator come from the SAME rows, so they cannot
 * drift: `rows.length` is the roster as of publication and `filter(hasRead)` is
 * the subset. Computing either from a second query is how «12 av 28» ends up
 * counting families the announcement is invisible to.
 *
 * ⚠ Protected pupils are PRESENT here on purpose (A4). This surface is
 * reachable only by admin and the class's own teacher, who already see the
 * pupil on their roster; omitting her would hide the family most worth phoning.
 */
export function ReadStatus({ rows }: { rows: ReadStatusRow[] }) {
  if (rows.length === 0) return null;
  const unread = rows.filter((r) => !r.hasRead);
  const read = rows.length - unread.length;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface-tint/60 p-4">
      <h2 className="font-medium">
        <span className="tabular-nums">
          {read} av {rows.length}
        </span>{' '}
        familier har lest oppslaget
      </h2>
      {unread.length === 0 ? (
        <p className="text-sm text-ink/60">Alle har åpnet det.</p>
      ) : (
        <>
          <p className="text-sm text-ink/60">
            Oppslag sendes ikke på e-post, så disse må ringes hvis det haster:
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {unread.map((r) => (
              <li key={r.studentId}>{r.displayName}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 7: Bump the action count**

In `src/app/action-guards.test.ts`, change `expect(allActions.length).toBe(73);` to `toBe(76);` — three new actions in `laerer/oppslag/actions.ts`. Run `npm test -- action-guards`; if the failure reports a different number, use that and say so in the commit body. Every action must call a name from the `GUARDS` array, which `requireStaffRole` is.

- [ ] **Step 8: Verify, including in a browser**

```bash
cd ~/dev/iqra-portal && npm run typecheck && npm run lint && npm run knip && npm test && npm run build
```

⚠ Stop the dev server before `next build` — `next build` and `next dev` fight over `.next`.

Then start the dev server from the portal directory **via Bash, never `preview_start` name-mode** (name-mode serves the session-root repo, not the portal):

```bash
cd ~/dev/iqra-portal && npm run dev
```

A human logs in as `laerer@test.local` / `test-passord-123`, re-enrols MFA at `/mfa/registrer` if the last `db reset` wiped it, and checks:

1. `/laerer/oppslag` shows the empty state, «Oppslag» lit in the nav.
2. «Nytt oppslag» → publish immediately → the notice appears in the list, dated today. **This also proves `listPublishableClasses` returns rows** (step 2's open question).
3. Publish with a datetime one week out → the row shows «Planlagt» and the date **and time**.
4. ★ **The refusal path.** Blank the title and submit; when the error appears, confirm **the class select still shows the class you chose**. This is plan 1's wrong-child bug transposed to a wrong-class one, and it is the single most valuable thing to click.
5. Open the scheduled one → «Trekk tilbake» removes it. Open the published one → the same control refuses with the «skoleadministrasjonen» sentence.
6. The read-tracking block reads «0 av N familier har lest» with N = the class roster, and it lists the families by name.

⚠ Synthetic clicks do not fire this app's React handlers — a human clicks, you measure.

- [ ] **Step 9: Commit**

```bash
cd ~/dev/iqra-portal
git add src/lib/validation/announcements.ts src/lib/dal/announcements.ts \
        src/components/announcements/AnnouncementBody.tsx src/components/announcements/ReadStatus.tsx \
        "src/app/(portal)/laerer/oppslag/ny/page.tsx" "src/app/(portal)/laerer/oppslag/ny/NewAnnouncementForm.tsx" \
        "src/app/(portal)/laerer/oppslag/[announcementId]/page.tsx" "src/app/(portal)/laerer/oppslag/actions.ts" \
        src/app/action-guards.test.ts
git commit -m "feat(oppslag): publish, schedule, withdraw — and see who has read it"
```

Body must state: why `published_at` is omitted for an immediate publish; that both the update and the delete check `count` because RLS refusals in those commands are filtered rather than raised; and that the form uses `useNoFormReset` because it carries a `<select>`.

---

## Task 9: parent and pupil surfaces

**Files:**
- Create: `src/app/(portal)/forelder/oppslag/page.tsx` + `[announcementId]/page.tsx`
- Create: `src/app/(portal)/elev/oppslag/page.tsx` + `[announcementId]/page.tsx`
- Modify: `src/lib/dal/announcements.ts`
- Modify: `src/app/(portal)/forelder/ForelderNav.tsx`, `src/app/(portal)/elev/ElevNav.tsx`

No new actions here — a family only reads, and the read records itself in the DAL (A11). The action count does not move.

- [ ] **Step 1: Add the family read**

In `src/lib/dal/announcements.ts`, change the session import to `import { requireRole, requireStaffRole } from './session';` and add:

```ts
/**
 * Family surfaces: role only — parents and pupils are not behind AAL2.
 *
 * ⚠ Except when they are. src/proxy.ts:102 gates MFA on hasStaffRole(roles) —
 * the USER's roles, not the path — so a teacher who is also a parent is sent
 * through MFA on /forelder/oppslag too. That is existing behaviour, not
 * something this task introduces, but the walkthrough plan needs to know it.
 *
 * The row set is identical to the teacher's because the filtering is
 * reads_announcement_row's, not this function's: a scheduled announcement is
 * absent because the predicate excludes it, not because a role branch here
 * remembered to.
 */
export async function listAnnouncementsForFamily(
  role: 'parent' | 'student',
): Promise<AnnouncementRow[]> {
  await requireRole(role);
  return listAnnouncements();
}
```

- [ ] **Step 2: Write the four pages**

`src/app/(portal)/forelder/oppslag/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';
import { AnnouncementList } from '@/components/announcements/AnnouncementList';
import { listAnnouncementsForFamily } from '@/lib/dal/announcements';

export const metadata: Metadata = { title: 'Oppslag' };

export default async function ForelderOppslagPage() {
  const announcements = await listAnnouncementsForFamily('parent');

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Oppslag</h1>
      {announcements.length === 0 ? (
        <EmptyState
          title="Ingen oppslag ennå"
          description="Beskjeder fra skolen og fra barnas klasser vises her. Du får ikke e-post om oppslag, så se innom av og til."
        />
      ) : (
        <AnnouncementList announcements={announcements} basePath="/forelder/oppslag" />
      )}
    </div>
  );
}
```

⚠ The empty-state copy says out loud that no e-mail is sent. That is D12's accepted cost — *"a parent who does not open the portal will not learn there is no school in week 40"* — and the only mitigation this plan can offer is telling them.

`src/app/(portal)/forelder/oppslag/[announcementId]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BackLink } from '@/components/ui/BackLink';
import { AnnouncementBody } from '@/components/announcements/AnnouncementBody';
import { getAnnouncement } from '@/lib/dal/announcements';
import { requireRole } from '@/lib/dal/session';

export const metadata: Metadata = { title: 'Oppslag' };

export default async function ForelderOppslagDetailPage({
  params,
}: {
  params: Promise<{ announcementId: string }>;
}) {
  await requireRole('parent');
  const { announcementId } = await params;
  const announcement = await getAnnouncement(announcementId);
  if (!announcement) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <BackLink href="/forelder/oppslag">Oppslag</BackLink>
      <AnnouncementBody announcement={announcement} />
    </div>
  );
}
```

⚠ **No `<ReadStatus>` on a family surface.** `announcement_read_status` returns nothing to a guardian (assertion 40 pins it), so rendering it would be a permanently empty block — and read-tracking is who the office should phone, not something families see about each other.

`src/app/(portal)/elev/oppslag/page.tsx` and `[announcementId]/page.tsx` are the same two files with `'student'` for `'parent'`, `/elev/oppslag` for `/forelder/oppslag`, and this list description:

```
description="Beskjeder fra skolen og fra klassen din vises her."
```

- [ ] **Step 3: Add the two nav entries**

`ForelderNav.tsx` and `ElevNav.tsx`, after «Meldinger» in each `ITEMS`:

```ts
  { href: '/forelder/oppslag', label: 'Oppslag', exact: false },
```
```ts
  { href: '/elev/oppslag', label: 'Oppslag', exact: false },
```

- [ ] **Step 4: Verify, including in a browser**

```bash
cd ~/dev/iqra-portal && npm run typecheck && npm run lint && npm run knip && npm test && npm run build
```

A human, as `forelder@test.local` / `test-passord-123` and then `elev@test.local` / `test-passord-123`:

1. `/forelder/oppslag` lists the teacher's class notice from Task 8 **and** nothing that is still «Planlagt».
2. Opening one and returning to the teacher's detail page shows the read count go from «0 av N» to «1 av N».
3. `/elev/oppslag` shows the same class notice; there is **no** «Nytt oppslag» control anywhere on either family surface, and `/forelder/oppslag/ny` 404s.
4. Guess a real announcement id from another class in the URL → **404, not an error page**. The enumeration-quiet null is the point.
5. At 375 px, the list rows wrap without a horizontal scrollbar and the «Planlagt» chip does not collide with the date.

⚠ Every `db reset` wipes MFA enrolment, and `src/proxy.ts` gates MFA on the **user's** roles rather than the path — so if you test as `laererforelder@test.local` you will be sent to `/mfa/verifiser` on a parent route. That is existing behaviour; use `forelder@test.local` for the plain-parent pass.

- [ ] **Step 5: Commit**

```bash
cd ~/dev/iqra-portal
git add src/lib/dal/announcements.ts \
        "src/app/(portal)/forelder/oppslag/page.tsx" "src/app/(portal)/forelder/oppslag/[announcementId]/page.tsx" \
        "src/app/(portal)/elev/oppslag/page.tsx" "src/app/(portal)/elev/oppslag/[announcementId]/page.tsx" \
        "src/app/(portal)/forelder/ForelderNav.tsx" "src/app/(portal)/elev/ElevNav.tsx"
git commit -m "feat(oppslag): the family surfaces, and a read that records itself"
```

---

## Task 10: admin surface — the whole school, and scheduling

**Files:**
- Create: `src/app/(portal)/admin/oppslag/page.tsx` + `[announcementId]/page.tsx` + `ny/page.tsx` + `ny/NewSchoolAnnouncementForm.tsx` + `actions.ts`
- Modify: `src/lib/dal/announcements.ts`
- Modify: `src/app/(portal)/admin/AdminNav.tsx`
- Modify: `src/app/action-guards.test.ts` (76 → 79)

- [ ] **Step 1: Add the admin class list to the DAL**

```ts
/**
 * Every class, for the admin picker. Mirrors writes_announcement's admin
 * branch, which is unconditional — an admin publishes to any class or to the
 * whole school, and the «Hele skolen» option is the null class_id.
 */
export async function listAllClasses(): Promise<{ id: string; name: string }[]> {
  await requireStaffRole('admin');
  const supabase = await createClient();
  const { data, error } = await supabase.from('classes').select('id, name');
  if (error) throw new Error(`Kunne ikke lese klasser: ${error.message}`);
  return (data ?? []).sort((a, b) => nbCollator.compare(a.name, b.name));
}
```

- [ ] **Step 2: Write the actions**

Create `src/app/(portal)/admin/oppslag/actions.ts`. It is `laerer/oppslag/actions.ts` with four differences, and each one matters:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaffRole } from '@/lib/dal/session';
import { PG_ERROR } from '@/lib/pg-error';
import { createClient } from '@/lib/supabase/server';
import { announcementEditSchema, announcementSchema } from '@/lib/validation/announcements';
import { firstIssue, type FormState } from '@/lib/validation/school';

/**
 * The admin twin of laerer/oppslag's action. Four differences, all deliberate:
 *   1. the guard is requireStaffRole('admin') — an admin who does not teach
 *      would be redirected by the teacher guard;
 *   2. class_id may be null («Hele skolen»), which D8 makes admin-only and
 *      private.writes_announcement enforces;
 *   3. delete is unconditional rather than the withdraw-your-own-scheduled
 *      path — announcements_delete_admin;
 *   4. the file lives under admin/, which is what keeps the two guards
 *      auditable one route at a time.
 *
 * It is NOT a shared helper called with a role parameter. A single action
 * branching on role is one edit away from calling the wrong guard, and
 * action-guards.test.ts checks the body of each exported function separately.
 */
export async function createAnnouncementAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireStaffRole('admin');
  const parsed = announcementSchema.safeParse({
    classId: formData.get('classId'),
    title: formData.get('title'),
    body: formData.get('body'),
    publisertAt: formData.get('publisertAt'),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from('announcements').insert({
    class_id: parsed.data.classId,
    title: parsed.data.title,
    body: parsed.data.body,
    created_by: user.id,
    ...(parsed.data.publisertAt
      ? { published_at: new Date(parsed.data.publisertAt).toISOString() }
      : {}),
  });
  if (error) {
    if (error.code === PG_ERROR.CHECK) {
      return { error: 'Publiseringstidspunktet må være fram i tid.' };
    }
    return { error: 'Oppslaget ble ikke publisert. Prøv igjen.' };
  }

  revalidatePath('/admin/oppslag');
  redirect('/admin/oppslag');
}

export async function updateAnnouncementAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaffRole('admin');
  const parsed = announcementEditSchema.safeParse({
    id: formData.get('id'),
    title: formData.get('title'),
    body: formData.get('body'),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from('announcements')
    .update({ title: parsed.data.title, body: parsed.data.body }, { count: 'exact' })
    .eq('id', parsed.data.id);
  if (error) return { error: 'Oppslaget ble ikke lagret. Prøv igjen.' };
  // ⚠ Yes, even for an admin. announcements_update_author pins created_by in
  // its `using` clause with NO admin arm — editing is authorship, and an admin
  // who needs to correct a teacher's notice deletes it and writes their own,
  // which is visibly theirs. Without this count check the screen would report
  // success for an update that changed nothing.
  if (count === 0) {
    return { error: 'Bare den som skrev oppslaget kan endre det. Slett det heller, og skriv et nytt.' };
  }

  revalidatePath('/admin/oppslag');
  revalidatePath(`/admin/oppslag/${parsed.data.id}`);
  return { error: null, success: true };
}

/** announcements_delete_admin: unconditional, and the only way a PUBLISHED
 *  announcement is ever removed. */
export async function deleteAnnouncementAction(formData: FormData): Promise<void> {
  await requireStaffRole('admin');
  const parsed = announcementEditSchema
    .pick({ id: true })
    .safeParse({ id: formData.get('id') });
  if (!parsed.success) throw new Error('Ugyldig oppslag.');

  const supabase = await createClient();
  const { error, count } = await supabase
    .from('announcements')
    .delete({ count: 'exact' })
    .eq('id', parsed.data.id);
  if (error) throw new Error(`Kunne ikke slette oppslaget: ${error.message}`);
  if (count === 0) throw new Error('Oppslaget finnes ikke lenger.');

  revalidatePath('/admin/oppslag');
  redirect('/admin/oppslag');
}
```

★ **Note what the admin update policy actually says, because it is easy to read the other way.** `announcements_update_author` has no admin arm at all — `writes_announcement` admits an admin, but the `created_by = auth.uid()` conjunct does not. So an admin can **delete** anyone's announcement and cannot **edit** it. That is deliberate: an edit changes what the school said without changing whose name is on it, which is the impersonation shape D5 exists to prevent, one table over.

- [ ] **Step 3: Write the form**

`src/app/(portal)/admin/oppslag/ny/NewSchoolAnnouncementForm.tsx` is `NewAnnouncementForm.tsx` with one extra `<option>` at the top of the select:

```tsx
        <select
          id="classId"
          name="classId"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="rounded-sm border border-border-input bg-canvas px-3 py-2"
        >
          <option value="">Hele skolen</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
```

— initialised with `useState('')` rather than `classes[0]?.id`, importing `createAnnouncementAction` from `../actions` (the admin one), and **`useNoFormReset` again**. ⚠ The `required` attribute is dropped, because the empty string is now a meaningful value; the schema's transform turns it into `null`.

⚠ This is the higher-risk copy of the select bug: here the first `<option>` is «Hele skolen». A React reset that silently reverts the box would turn a class notice into a **school-wide** one on the next press of Publiser, in front of every family in the school.

Add a warning under the select:

```tsx
      {classId === '' ? (
        <p className="text-sm text-warning-ink">
          Dette oppslaget går til alle i skolen — foresatte, elever, lærere og økonomi.
        </p>
      ) : null}
```

- [ ] **Step 4: Write the three pages**

`src/app/(portal)/admin/oppslag/page.tsx` — the same shape as the teacher list, calling a new `listAnnouncementsForAdmin()` (`requireStaffRole('admin')` + `listAnnouncements()`), with the «Nytt oppslag» pill pointing at `/admin/oppslag/ny` and this empty-state description:

```
description="Beskjeder til hele skolen eller til en enkelt klasse. Et oppslag kan planlegges fram i tid, og går til alle som var påmeldt da det ble publisert."
```

`src/app/(portal)/admin/oppslag/ny/page.tsx` — `listAllClasses()` into `NewSchoolAnnouncementForm`. ⚠ Unlike the teacher's version there is **no empty-state branch**: an admin with zero classes can still publish to the whole school, so an empty list is a valid state and the form must render.

`src/app/(portal)/admin/oppslag/[announcementId]/page.tsx` — the teacher's detail page with `requireStaffRole('admin')` and `basePath` `/admin/oppslag`. It keeps `<ReadStatus>`: for a school-wide announcement the roster is every enrolled pupil at publication, which is exactly the «who do we phone» list D12's no-e-mail ruling makes the office's only instrument.

- [ ] **Step 5: Nav, and the stale comment**

In `AdminNav.tsx`, add after «Meldinger»:

```ts
  { href: '/admin/oppslag', label: 'Oppslag', exact: false },
```

and rewrite the comment above the «Meldinger» entry, which currently says it is *"Last, as on the other three navs"* — that stopped being true in Task 7. It should now say that Meldinger and Oppslag are the last two, in that order, on all four navs.

⚠ `AdminNav` is also the only one of the four whose `<nav>` lacks `className="print:hidden"`. Leave it — fixing it is unrelated to this plan and belongs in its own commit.

- [ ] **Step 6: Bump the action count and verify**

`toBe(76)` → `toBe(79)`.

```bash
cd ~/dev/iqra-portal && npm run typecheck && npm run lint && npm run knip && npm test && npm run build
```

A human, as `admin@test.local` / `test-passord-123` (re-enrol MFA first):

1. `/admin/oppslag` lists **every** announcement in the school, including the teacher's and every scheduled one.
2. «Nytt oppslag» → «Hele skolen» → the warning line appears → publish → it shows in the parent's and the pupil's lists too.
3. ★ Choose a class, blank the title, submit — and confirm the select still says that class, **not** «Hele skolen». This is the highest-severity refusal path in the plan.
4. Open a **teacher's** announcement as admin: the edit control refuses with the «Bare den som skrev oppslaget» sentence, and the delete control works.
5. The read-tracking block on the school-wide announcement lists every enrolled pupil.
6. `/admin/oppslag` and a detail page at **1280 and 375**.

- [ ] **Step 7: Commit**

```bash
cd ~/dev/iqra-portal
git add "src/app/(portal)/admin/oppslag" src/lib/dal/announcements.ts \
        "src/app/(portal)/admin/AdminNav.tsx" src/app/action-guards.test.ts
git commit -m "feat(oppslag): the whole school, and a publish time chosen in advance"
```

Body must state that an admin may delete but not edit another author's announcement, and why that is the same argument as D5.

---

## Task 11: the wall-1 api suite

**Files:**
- Create: `tests/api/announcements.test.ts`

pgTAP 37 proves the **database** refuses. This proves the TypeScript in front of it never hands the database a request that should not have been made, and never turns a refusal into something the caller cannot act on — a different failure mode, so a green pgTAP run does not imply it.

- [ ] **Step 1: Read the harness and the seed ids you need**

```bash
cd ~/dev/iqra-portal && sed -n '1,60p' tests/api/threads.test.ts && grep -n "fc000000\|Klasse" supabase/seed.sql | head -20
```

You need the exact class ids and which teacher teaches which. ⚠ **Do not guess them from this document** — plan 1's ledger records four separate defects that came from a plan asserting a repo fact it had not read.

The harness is `tests/api/harness.ts`: it **mocks** `@/lib/supabase/server` with `createServerClientMock` and calls actions and DAL functions **directly**. There is no `signIn()`, no `serviceClient()` export, and no PostgREST driving. Copy the four-`vi.mock` preamble from `threads.test.ts` verbatim.

- [ ] **Step 2: Write the suite**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Repeated per-file mock preamble (ledger #14) — mock factories are hoisted.
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock(
  '@/lib/supabase/server',
  async (): Promise<typeof import('@/lib/supabase/server')> => {
    const { createServerClientMock } = await import('./harness');
    return { createClient: createServerClientMock };
  },
);
vi.mock('next/navigation', async () => {
  const { redirectMock } = await import('./harness');
  return { redirect: redirectMock };
});

import { randomUUID } from 'node:crypto';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createAnnouncementAction } from '@/app/(portal)/laerer/oppslag/actions';
import { getAnnouncement, getReadStatus } from '@/lib/dal/announcements';
import { getPublicEnv } from '@/lib/env';
import type { Database } from '@/lib/supabase/database.types';
import { idleForm } from '@/lib/validation/school';
import { signInAs, signInAsAAL2, signOut } from './harness';

/**
 * Wall 1 for announcements (spec §8.1).
 *
 * ★ EVERY REFUSAL BLOCK HERE CARRIES A POSITIVE CONTROL, and that is finding
 * F6 from plan 1's panel: its entitlement block asserted only refusals, so
 * under a TOTAL creation outage both assertions still passed — including the
 * `count === 0` follow-ups. A refusal suite with no positive control cannot
 * tell "refused correctly" from "nothing works".
 */

const SCRATCH = 'api-test-oppslag:';

/** Test scaffolding only — never the code under test. */
function scaffoldingServiceClient() {
  const env = getPublicEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY mangler i miljøet.');
  return createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

beforeEach(() => {
  signOut();
});

/**
 * Teardown in a HOOK, not in a try/finally: when vitest times out a test it
 * abandons the body's continuation, and a `finally` after the await that timed
 * out provably never runs, while a hook does (measured 2026-07-29).
 */
afterEach(async () => {
  const service = scaffoldingServiceClient();
  await service.from('announcements').delete().like('title', `${SCRATCH}%`);
});

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}
```

Then five describe blocks. Fill in the class ids from step 1.

```ts
describe('creation entitlement', () => {
  it('publishes to a class the teacher actually teaches', async () => {
    await signInAsAAL2('laerer@test.local');
    const state = await createAnnouncementAction(
      idleForm,
      form({ classId: KLASSE_1, title: `${SCRATCH}ekte`, body: 'x', publisertAt: '' }),
    ).catch((e: Error) => e);
    // ★ THE POSITIVE CONTROL. createAnnouncementAction redirects on success, so
    // success is NEXT_REDIRECT — and asserting it is what stops a total outage
    // reading as four clean refusals below.
    expect(String(state)).toContain('NEXT_REDIRECT:/laerer/oppslag');

    const service = scaffoldingServiceClient();
    const { data } = await service
      .from('announcements')
      .select('id, class_id, fanned_out_at')
      .eq('title', `${SCRATCH}ekte`);
    expect(data).toHaveLength(1);
    expect(data![0].class_id).toBe(KLASSE_1);
    // A7: an immediately-published announcement is stamped at INSERT, so
    // plan 3's first drain will not retro-fan the whole history.
    expect(data![0].fanned_out_at).not.toBeNull();
  });

  it('refuses a class the teacher does not teach, with a sentence and no row', async () => {
    await signInAsAAL2('laererforelder@test.local'); // teaches Klasse 3 only
    const state = await createAnnouncementAction(
      idleForm,
      form({ classId: KLASSE_1, title: `${SCRATCH}fremmed`, body: 'x', publisertAt: '' }),
    );
    expect(state.error).toBe('Oppslaget ble ikke publisert. Sjekk at klassen er din.');
    const service = scaffoldingServiceClient();
    const { data } = await service.from('announcements').select('id').eq('title', `${SCRATCH}fremmed`);
    expect(data).toHaveLength(0);
  });

  it('refuses the whole school before it reaches the database', async () => {
    await signInAsAAL2('laerer@test.local');
    const state = await createAnnouncementAction(
      idleForm,
      form({ classId: '', title: `${SCRATCH}skole`, body: 'x', publisertAt: '' }),
    );
    expect(state.error).toBe('Velg en klasse.');
  });
});

describe('scheduling', () => {
  it('accepts a future time and leaves it unstamped and unreadable to the class', async () => {
    // one day out, ISO for the datetime-local input's shape
    const when = new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);
    await signInAsAAL2('laerer@test.local');
    await createAnnouncementAction(
      idleForm,
      form({ classId: KLASSE_1, title: `${SCRATCH}planlagt`, body: 'x', publisertAt: when }),
    ).catch(() => undefined);

    const service = scaffoldingServiceClient();
    const { data } = await service
      .from('announcements')
      .select('id, fanned_out_at')
      .eq('title', `${SCRATCH}planlagt`);
    expect(data).toHaveLength(1);
    expect(data![0].fanned_out_at).toBeNull();

    // A family cannot reach it before published_at — the same wall pgTAP 37
    // asserts, exercised through the DAL the pages actually call.
    signInAs('forelder@test.local');
    await expect(getAnnouncement(data![0].id)).resolves.toBeNull();
  });

  it('refuses a past time with the same sentence the CHECK would produce', async () => {
    const when = new Date(Date.now() - 86_400_000).toISOString().slice(0, 16);
    await signInAsAAL2('laerer@test.local');
    const state = await createAnnouncementAction(
      idleForm,
      form({ classId: KLASSE_1, title: `${SCRATCH}fortid`, body: 'x', publisertAt: when }),
    );
    expect(state.error).toBe('Publiseringstidspunktet må være minst ett minutt fram i tid.');
  });
});

describe('the enumeration-quiet null', () => {
  it('returns null for a foreign announcement and for a malformed id alike', async () => {
    await signInAsAAL2('laerer@test.local');
    await createAnnouncementAction(
      idleForm,
      form({ classId: KLASSE_1, title: `${SCRATCH}fremmedlesing`, body: 'x', publisertAt: '' }),
    ).catch(() => undefined);
    const service = scaffoldingServiceClient();
    const { data } = await service
      .from('announcements').select('id').eq('title', `${SCRATCH}fremmedlesing`);

    signInAs('forelder2@test.local'); // a family in another class
    // Both null, and neither throws: a real-but-unreadable id must be
    // indistinguishable from one that does not exist.
    await expect(getAnnouncement(data![0].id)).resolves.toBeNull();
    await expect(getAnnouncement(randomUUID())).resolves.toBeNull();
    await expect(getAnnouncement('ikke-en-uuid')).resolves.toBeNull();
  });
});

describe('the read records itself', () => {
  it('writes one row on the first open and does not throw on the second', async () => {
    await signInAsAAL2('laerer@test.local');
    await createAnnouncementAction(
      idleForm,
      form({ classId: KLASSE_1, title: `${SCRATCH}lest`, body: 'x', publisertAt: '' }),
    ).catch(() => undefined);
    const service = scaffoldingServiceClient();
    const { data } = await service.from('announcements').select('id').eq('title', `${SCRATCH}lest`);
    const id = data![0].id;

    signInAs('forelder@test.local');
    await expect(getAnnouncement(id)).resolves.not.toBeNull();
    await expect(getAnnouncement(id)).resolves.not.toBeNull(); // ignoreDuplicates

    const { data: reads } = await service
      .from('announcement_reads').select('user_id').eq('announcement_id', id);
    expect(reads).toHaveLength(1);
  });
});

describe('read-tracking is staff-only', () => {
  it('gives a guardian nothing and the class teacher the roster', async () => {
    await signInAsAAL2('laerer@test.local');
    await createAnnouncementAction(
      idleForm,
      form({ classId: KLASSE_1, title: `${SCRATCH}status`, body: 'x', publisertAt: '' }),
    ).catch(() => undefined);
    const service = scaffoldingServiceClient();
    const { data } = await service.from('announcements').select('id').eq('title', `${SCRATCH}status`);
    const id = data![0].id;

    signInAs('forelder@test.local');
    expect((await getReadStatus([id])).get(id)).toBeUndefined();

    // ★ The positive control. Without it, a projection that returned nothing to
    // ANYONE would pass the assertion above.
    await signInAsAAL2('laerer@test.local');
    expect((await getReadStatus([id])).get(id)!.length).toBeGreaterThan(0);
  });
});
```

⚠ `createAnnouncementAction` **redirects on success**, which the harness's `redirectMock` turns into a thrown `NEXT_REDIRECT:` error. Every success path above therefore either asserts the thrown string or uses `.catch(() => undefined)` when the redirect is incidental. **The first test must assert the string** — swallowing it there is exactly how F6's outage hid.

- [ ] **Step 3: Run it**

```bash
cd ~/dev/iqra-portal && eval "$(supabase status -o env | sed 's/^/export /')" && npm run test:api
```

Expected: the whole api suite green. Budget **21 minutes** and expect no output until it finishes. ⚠ The suite is **not flaky** — apparent flakiness is GoTrue session churn, and it resets between runs.

- [ ] **Step 4: ★ Prove the positive control does its job**

Break creation on purpose — set `announcements_insert_staff` to `with check (false)` — and re-run just this file. **Every test in it must fail, not only the positive ones.** If the refusal blocks stay green, they are asserting an outage rather than a wall, and that is F6 reproduced. Restore the policy by re-running the migration and confirm with:

```bash
docker exec supabase_db_iqra-portal psql -U postgres -q -t -A -c "select pg_get_expr(polwithcheck, polrelid) from pg_policy where polname='announcements_insert_staff';"
```

- [ ] **Step 5: Commit**

```bash
cd ~/dev/iqra-portal
git add tests/api/announcements.test.ts
git commit -m "test(oppslag): wall-1 assertions for publication, scheduling and the quiet null"
```

Body must state that every refusal block carries a positive control and that the whole file was watched fail under a `with check (false)` policy.

---

## Assertion numbering in file 37, across tasks

The file is written once in Task 1 and grown twice. **Inserting §H and §I renumbers §J**, so a mutation table written for an earlier task refers to §J at numbers that later move:

| after | §A | §B | §C | §D | §E | §F | §G | §H | §I | §J | `plan()` |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Task 1 | 1–4 | 5–13 | 14–16 | 17–20 | 21–27 | 28–30 | 31–34 | — | — | 35–39 | 39 |
| Task 4 | 1–4 | 5–13 | 14–16 | 17–20 | 21–27 | 28–30 | 31–34 | 35–42 | — | 43–47 | 47 |
| Task 5 | 1–4 | 5–13 | 14–16 | 17–20 | 21–27 | 28–30 | 31–34 | 35–42 | 43–47 | 48–52 | 52 |

Each task's mutation table uses the numbering **as of that task**. If you re-run Task 1's mutations after Task 5 has landed, its §J references (35, 36, 37) are now 48, 49 and 50.

⚠ **§H must be inserted after §G, and §I after §H, both before §J.** §H's «exactly one family has read it» depends on the read row §G's assertion 31 inserts. §J is order-independent by construction — it operates on `…046` and `…047`, which nothing else touches — but keeping it last keeps the table above true.

---

## Exit criteria for this plan

Not the phase's exit gate (that is plan 4) — these are the conditions for calling plan 2 done.

- [ ] `supabase db reset && supabase test db --local` → **one more file than the Task 0 baseline**, `Tests=` baseline + 52 (file 37) + 6 (file 34) + 9 (file 31), `Result: PASS`.
- [ ] `npm test` → all pass; the count has risen by the nav and component tests added here.
- [ ] `npm run test:api` → all pass (budget 21 min).
- [ ] `npm run typecheck` → 0 · `npm run lint` → 0 errors · `npm run knip` → only the pre-existing findings · `node scripts/audit-gate.mjs` → pass.
- [ ] `npm run build` → clean. Stop the dev server first.
- [ ] `action-guards.test.ts` asserts **79**, and the number was reached by two deliberate bumps (Tasks 8 and 10), each stated in its commit body.
- [ ] `29_definer_fingerprints.sql` asserts the value **measured** after Task 6, not the one predicted here, and the commit body says which.
- [ ] Every ★ mutation in Tasks 1–6 was run, each reddened **alone**, and each restore was verified by an object-definition diff — not merely issued. Record which, in the final commit body.
- [ ] A human has clicked all four surfaces at 1280 and 375, after re-enrolling MFA. Specifically: a teacher publishes and schedules; **a refused publish leaves both selects showing what was chosen**; a parent and a pupil see the published notice and not the scheduled one; the admin publishes school-wide and every role sees it; the admin can delete a teacher's notice but not edit it; the read count moves when a parent opens it.

---

## What this plan deliberately leaves broken

Say these out loud when handing over, so nobody reports them as defects.

- **Nothing notifies anyone.** No `notifications` row, no varsel bell, no e-mail. The only way to discover an announcement is to open the surface. Plan 3.
- **`public.claim_due_announcements()` has no caller.** It is built, granted and asserted, and nothing runs it — there is no drain until plan 3, and plan 3 must extend the function's body rather than call it and fan out separately.
- **A scheduled announcement still publishes if the scheduler never runs.** `reads_announcement_row` keys on `published_at`, not on `fanned_out_at`, so the notice appears on time; only the notification is missing. **In this plan, that is every scheduled announcement, because there are no notifications at all.** Nothing on any screen observes the size of that backlog — the health number belongs with the drain.
- **A scheduled announcement cannot be rescheduled.** `published_at` has no UPDATE grant, so the only correction is withdraw-and-rewrite. The author may withdraw their own unpublished one; a published one is admin-delete-only.
- **`okonomi` has no announcement surface.** The policy admits economy to school-wide notices (D17) and `reads_announcement_row`'s `cls is null` arm is unconditional — but `src/app/(portal)/okonomi/` has no nav component and one page, so there is nowhere to put the route. Building one means inventing an `OkonomiNav`, which belongs with whatever gives økonomi a real surface, not here.
- **Deleting a class that has ever been announced to now fails.** `announcements.class_id` is `on delete restrict`, so `deleteClassAction` (`src/app/(portal)/admin/klasser/actions.ts:87`) will raise `23503` and surface as «Kunne ikke slette klasse: …». That is the intended trade — an announcement is a record of what the school told a family — but the message is a raw database error and the admin flow has no branch for it. **Fixing the message is a one-line `PG_ERROR.FOREIGN_KEY` branch in that action and it is deliberately not done here**, because it touches a Phase-3 surface this plan otherwise leaves alone.
- **`announcements.body` is free text no pupil-keyed erasure reaches**, and `announcement_reads` rows keyed to a *pupil's own login* survive the `students` cascade, because `student_user_id` is `on delete set null`. Both are spec §10.11 items and both belong to Phase 7's retention job. This plan makes them possible to sweep (`service_role` holds `select, delete` on both tables) and sweeps nothing.
- **The announcement lists are unpaginated, and the read policy is not inlinable.** `listAnnouncements()` selects every announcement the caller may read, and `reads_announcement_row` is SECURITY DEFINER with `set search_path = ''`, so PostgreSQL calls it **once per row scanned** — measured at roughly 20 buffer hits and ~2 ms per candidate on the dev host, and each call may fan out to three more definer helpers. At this school's volume (a few notices a week) that is nothing; over several years of history it becomes a visibly slow parent page. The `(published_at desc)` index is there for it, and the fix when it bites is a `.limit()` plus «vis eldre», not a widened policy. **Plan 3 inherits the sharper version of this** — see A7's narrow-then-filter note, because its recipient query runs inside the announcement INSERT's own transaction.
- **A departed family sees «Klasseoppslag» instead of the class name.** `audienceLabel` degrades to a true, vaguer word rather than the false «Hele skolen» (see Task 7 step 2). Recovering the real name would need a definer projection over `classes` — the `thread_counterparts` pattern again — and that is a schema + RLS change this plan does not make.
- **No announcement is seeded.** `supabase/seed.sql` is untouched on purpose — see the scope note. The walkthrough creates its own.
- **The Norwegian copy is a draft.** §12 Q3 is answered only in part: the user has not edited these strings and the board has not seen them. The disclosure block's copy-and-policies-are-one-change rule (§4.2) applies to the empty-state sentence «Du får ikke e-post om oppslag» too — it is true only because of D12.

---

## Plan review ledger — 2026-08-06

Reviewed against the goal before any code, per CLAUDE.md. A single focused pass
in the main loop, plus one lens dispatched by the coordinator mid-write. **Seven
defects found in the plan**, six of them in material the plan had already
written and read as correct.

★ **Five of the seven came from running a query against the database rather than
from re-reading the plan.** That is now the fifth round on this project where
checking a claim against the repo, not against the plan's own consistency, is
what found the defect. Two came from tracing a mutation's *effect* by hand
rather than trusting the sentence that named it.

| # | Defect | How it was caught | Consequence if executed |
|---|---|---|---|
| 1 | ★★ **`classes` carries LIVE select policies for families, so the class-name embed is NULL for anyone whose enrolment has closed** | Read `pg_policy` for `public.classes`: `classes_select_guardian` → `private.guardian_in_class`, `classes_select_student` → `private.student_in_class`, both filtering `left_on is null`. The announcement audience is **as-of**. The two disagree by construction. | The list rendered `className ?? 'Hele skolen'`, so **on term-rollover day every family's past class notices would relabel themselves as school-wide, all at once** — the portal telling ~150 families that a message meant for one class went to everyone. Fixed with `audienceLabel(classId, className)`, one function, two consumers, and a test whose third case is exactly this. |
| 2 | ★ **The Oslo-cast mutation on `announcement_read_status` was invisible to the assertion that named it** | Traced the mutation by hand against the fixture: dropping the cast moves the resolved day to D−1, which pushes «Startet» **out** of the roster and pulls «Sluttet» **in** — so the count stays at 3. | The mutation table claimed assertion 35 would redden. It would not. A count over a set cannot see any mutation that preserves the set's size — the same lesson as plan 1's «the fixture was hiding the defect it sat next to». Fixed by adding two membership assertions at the two edges (37, 38) and correcting the table to say the count assertion is blind to it. |
| 3 | ★ **The cascade assertion in §J was vacuous** | Walked the fixture: no `announcement_reads` row was ever created for `…046`, so "0 read rows after the delete" was 0 before it too. | The assertion that erasure is complete could not fail. Fixed by seeding a read row for `…046` and adding a control assertion that it survives the *refused* delete — so the final 0 is attributable to the cascade and nothing else. |
| 4 | **The `announcements_not_backdated` fixture margin was about 30 minutes** | Worked the arithmetic: at 00:30 the Oslo day D can begin almost 24 h before `now() − 30 days`, while `created_at` was `now() − 31 days`. Positive, but by minutes. | Not a failure, a fragility: a fixture whose validity rests on arithmetic that tight breaks later for a reason nobody looks for. `created_at` moved to `now() − 40 days` (and `− 15 days` for the five-day-old rows). |
| 5 | ★★ **The `UPDATE … RETURNING` pre-update-tuple hazard was not in the plan at all** | Supplied by the coordinator's lens, measured on `threads`: a by-id predicate re-checks against the **pre-update** tuple, a column-reference predicate against the **new** one. | The plan already used the row form, so the hazard was closed **by accident** rather than on the record — which is exactly how the next person grants `update (class_id)` "because the policy checks it anyway" and re-opens it. Now stated in the migration comment, naming the two revokes that are half of why the predicate is correct. |
| 6 | **The three sibling tables' safety was undocumented** | Same lens. | `announcement_reads_select_own_or_staff`, and plan 3's `notifications_select_own` and `private.email_pings`, are all safe from the `RETURNING` hazard for three *different* reasons. A plan-3 author who has just read this plan's row-form argument would over-apply it. Now written out as **A7b**, with the reason per table. |
| 7 | **The definer-predicate cost was unrecorded, and it lands on plan 3 hardest** | Same lens, measured: SECURITY DEFINER + `set search_path = ''` blocks inlining, so the planner emits one call per row scanned (~20 buffer hits, ~2 ms per candidate). | D21 says the fan-out must **call** the read predicate. Read literally, that becomes `select p.id from profiles p where reads_announcement(p.id, …)` — O(school roll) definer invocations inside the announcement INSERT's own transaction. Now A7 says **narrow first, then filter**, and «leaves broken» records the milder version this plan does ship (unpaginated lists over a non-inlinable policy). |

**Verified sound and left unchanged** (checked by running the query, not assumed):

- `postgres` **is** a member of `service_role`, so §I's `set local role service_role` works — and five existing pgTAP files already do it.
- `students.first_name` and `last_name` are both `NOT NULL`, so `first_name || ' ' || last_name` cannot yield NULL.
- `class_teachers_select_admin_or_own_class` is `has_role(admin) or teaches_class(uid, class_id)` — **self-satisfying for a teacher's own rows**, so `listPublishableClasses` will return rows. Plan 1's measured 0-row result was for a **guardian**, and the distinction matters: the same query is safe here and was not there.
- `pg_get_function_result` really renders `TABLE(col type, …)`, verified against `thread_counterparts` and `guardian_thread_options`, so Task 4's return-shape assertion is written in a form that can pass.
- `29_definer_fingerprints.sql` really ends in `49`; `31_column_locks.sql` really is `plan(22)`; `34_enrollment_boundary.sql` really is `plan(24)` with D = 2026-09-15; `action-guards.test.ts` really asserts `73`; the migration head really is `20260805123000`; `37` and prefix `c0` are free in both tests and migrations.
- `26_rls_force.sql` sweeps **all** public tables and asserts three things per table, so the two new tables fail it by name if either verb is missed; `00_grant_firewall.sql` likewise sweeps every current and future public object, so a missing `revoke all … from anon` reddens with no edit to that file.
- ⚠ **Every count above was re-verified after the branch moved under this plan.** A concurrent session committed `3f67907` («the three policies that could be deleted with the suite green») while this document was being written, cleaning three files that were dirty when Task 0 was drafted. Re-measured afterwards: fingerprint counter still **49**, `action-guards` still **73**, migration head still `20260805123000`, highest test file still **36**, `31` still `plan(22)`, `34` still `plan(24)` — and `35`/`36` are `plan(41)`/`plan(14)`, which is where the previously-uncommitted work landed. Nothing this plan depends on moved, but **the branch is shared and it moved once during a two-hour write**; Task 0 exists because of that.
- The 21-line teardown named in the brief is **not** what shipped: `35_threads_rls.sql` and `36_thread_counterparts.sql` both carry a **9-line** block — the short one plus `delete from public.assignments`, which is the single ON DELETE RESTRICT edge on the path to `classes`. File 37 copies that block and adds the two announcement deletes ahead of it, because `announcements.class_id` is a **second** such edge. (File 34's 20-line version is a different file's history, not the house standard.)

⚠ **Not done, and it is the honest gap:** CLAUDE.md calls for the **full review
panel** on RLS plans. This was one focused pass plus one dispatched lens — and
that lens alone produced three of the seven findings, which is the argument for
the panel rather than against it. If you want it before execution, dispatch
independent escalation / assertion-vacuity / repo-integration lenses over Task
1's SQL, the way plan 1's overnight run did. This ledger is a floor, not a
ceiling.

⚠ **Two things this plan asserts that it could not verify by running them**, and
they should be attacked first:

1. **That a BEFORE INSERT trigger may assign `fanned_out_at` when the caller
   holds no grant on it.** The rule is well established and spec §2.2 records it
   as verified during Phase 4 — but it was not re-run here, and Task 5's entire
   design rests on it. **Task 1 step 3 is a probe that answers it in ten
   seconds**, deliberately placed before the 39 assertions that sit on top.
2. **That `for update skip locked` inside `where id in (…)` is accepted in a
   `language sql` function that `returns table`.** Standard queue idiom, not
   exercised in this repo. If it is refused, the shape is a plpgsql function
   with the same statement, and the fingerprint markers are unaffected.



