# IQRA Skoleportal — Phase 4 (Lekser & oppgaver) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give teachers the Google-Classroom loop they asked for — create an assignment (whole class *or* picked groups of 2–4), attach files up to 50 MB (incl. audio for Quran recitation), reuse a past assignment in a few taps — and give them the one screen Classroom is loved for: **every pupil on the roster, non-submitters as named rows**, with per-pupil review. Pupils and parents hand in (shared hand-in for group tasks) and see only their own child's mark. All of it under the two-wall model, with a **new third wall — Storage object policies** — that reuses the very same `private` helpers as the table policies.

**Architecture:** Seven new tables (`class_groups`, `class_group_members`, `assignments`, `assignment_groups`, `assignment_group_members`, `submissions`, `assignment_reviews`) plus two attachment tables (`assignment_attachments`, `submission_attachments`) and two private Storage buckets. Groups are **class-level templates copied onto each assignment** (D1) so editing a template never rewrites history — the same roster-as-of-date discipline as Phases 2/3. Submission status is **derived, never stored** (D8). `submissions` carries `student_id` **XOR** `assignment_group_id` (D9, DB CHECK) so one table serves both hand-in shapes; `assignment_reviews` stays keyed `(assignment_id, student_id)` so a shared group hand-in still produces a **per-pupil** mark (D3) — which is what keeps "parent A ↛ child B" intact where it matters most. Five new SECURITY DEFINER helpers pivot on **`private.student_in_assignment`**, which resolves group-targeted *and* class-wide-as-of-`due_on` in one question, so every downstream policy, Storage policy and DAL read asks the same thing regardless of targeting. Design spec: `docs/superpowers/specs/2026-07-27-iqra-portal-phase-4-oppgaver-design.md`.

**Tech Stack:** Unchanged — Next.js 16 (App Router, `src/`, Turbopack), React 19 (`useActionState`), TypeScript strict, Tailwind v4 tokens from `globals.css`, `@supabase/ssr` + `@supabase/supabase-js` v2, Zod v4, Vitest (+ `vitest.config.api.ts` live suite), Supabase CLI with SQL migrations + pgTAP. **Zero new npm dependencies** (see refinement R1 — this is why TUS/Uppy is deferred).

---

## Read this before starting

**The portal repo is `/Users/daodilyas/dev/iqra-portal`** — NOT the session cwd (the marketing site). Plans/specs live in the marketing repo under `docs/superpowers/`; ALL code work happens in the portal repo. Every environment gotcha from Phases 0–3 still holds:

1. **Every Bash step must `cd /Users/daodilyas/dev/iqra-portal` explicitly.** Shell cwd resets between calls.
2. **Branch topology.** `main` = the **public** demo at https://iqra-portal-six.vercel.app — NEVER commit to it. The real line is **`real`** (currently `b32f4da` = Phases 0+1+2+3 + the supply-chain gate, CI green). **Work on `feat/phase-4`, cut from `real`.** The phase lands by PR `feat/phase-4 → real`. Exit-gate commit list is `git log real..feat/phase-4`.
3. **Docker + Supabase quirks:** if the stack is down, never plain `supabase start` — use `supabase start --ignore-health-check`, then wait until `docker ps` shows every container healthy (`rest`/`edge-runtime` have no healthcheck; plain `Up` is their healthy). `supabase db reset` completes all DB work even when it exits 1 in its final `Restarting containers...` phase — the `Applying migration .../Seeding data...` lines are the success signal; do NOT re-run: wait, then continue (`supabase test db` is the real verification). If `test:api` mass-fails in ~20 s, it is ALWAYS environment (schema-less db / GoTrue race / Postgres restart) — `db reset`, verify seeds, re-run; never chase it as a code bug.
4. **`supabase test db` runs pgTAP against the CURRENT local database.** Always `supabase db reset` after changing migrations/seeds, then `supabase test db`.
5. **Stale `.next` after `npm run build`:** before browser-verifying after a build: `rm -rf .next`, then `npm run dev`.
6. **Commit messages:** Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). Never mention Claude/AI. No Co-Authored-By trailers.
7. **Norwegian UI, English code.** User-facing strings are bokmål; identifiers, comments, DB names are English. New URL paths this phase: `/laerer/oppgaver`, `/laerer/oppgaver/ny`, `/laerer/oppgaver/[assignmentId]`, `/laerer/klasser/[id]/grupper`, `/elev/lekser`, `/forelder/lekser`.
8. **Design system is LOCKED ("C · Familie").** Tokens in `src/app/globals.css`; primitives in `src/components/ui/` (`Button`, `Field`, `Input`, `Chip`, `Skeleton`, `EmptyState`, `PillLink`) + `src/components/shell/`. Bans: no kicker labels, no emojis, no purple, never `#000`/`#fff`, no gradient text, no identical-card grids. Interactive: `min-h-11`, `focus-visible:ring-2 ring-ring ring-offset-2`, labels above inputs, teaching empty states, `role="alert"` inline errors, `tabular-nums` for figures, dates via `Europe/Oslo` helpers. **Status tones (design law):** `Levert`/`Vurdert` = `success`, `Ikke levert` = `neutral`, `Levert etter frist` = `warning` — **never `danger` for a pupil's own standing**; `danger` is reserved for destructive controls.
9. **Migrations own their privileges** (ENFORCED by `supabase/tests/00_grant_firewall.sql`). Every new table: `revoke all ... from anon, authenticated, service_role;` then grant back exactly what the policies need. `anon` gets NOTHING. Every `create function`: `revoke execute ... from public;` then a narrow grant to `authenticated`.
10. **FK lifecycle this phase:** `assignments.class_id` → `restrict` (an assignment is history; deleting a class must not silently erase it — this deliberately differs from `tests.class_id`, which cascades, because assignments carry pupil hand-ins and files); `assignments.subject_id` → `restrict`; everything under an assignment cascades (`assignment_groups`, members, `submissions`, `assignment_reviews`, both attachment tables); `class_groups.class_id` → cascade (a template is not history); `assignment_groups.source_group_id` → `set null` (provenance only); every actor column (`created_by`/`submitted_by`/`reviewed_by`/`uploaded_by`) → `profiles`, default restrict.
11. **RLS helper pattern:** policies never subquery an RLS-protected table directly. Relationship checks go through SECURITY DEFINER `stable sql` functions in `private` with `set search_path = ''`, called as `private.helper((select auth.uid()), col)`. Policies are permissive/OR-ed and ADDITIVE across migrations. **Double-bind rule (standing, from Phase-2 C-1):** any INSERT/UPDATE whose row carries a `student_id` binds the actor to the context AND the student to that same context, at both walls.
12. **Audit namespace ENFORCED:** trigger/DAL audit actions use `<table>.<verb>`; `admin.`/`system.` are reserved (42501). Audit triggers this phase go on the **student-data** tables only: `submissions` → `private.audit_row_change('assignment_id')`, `assignment_reviews` → `('assignment_id', 'student_id')`, `submission_attachments` → `('submission_id')`, `assignment_group_members` → `('assignment_group_id', 'student_id')`. **No** audit trigger on `assignments`, `class_groups`, `class_group_members`, `assignment_groups` or `assignment_attachments` — teacher-managed school structure, matching the `lessons`/`tests` precedent.
13. **Seed UUID scheme (extend, never overlap):** existing — users `1…`–`7…`; `f1…` terms, `fa…` subjects, `fc…` classes, `fe…` students, `f6…` lessons, `f7…` absence notices, `f2…` books, `f3…` progress, `f4…` quran, `f5…` tests; pgTAP fixtures `a5…`–`b7…`. **NEW this phase:** seed `class_groups` + `assignment_groups` `fb…`, `assignments` `f8…`, `submissions` `f9…`. pgTAP fixtures: `20_class_groups_rls` uses `b8…`, `21_assignments_rls` `b9…`, `22_submissions_rls` `ba…`, `23_assignment_storage` `bb…`, `24_enrollment_riders` `bc…`.
14. **`tests/api` growth rules:** every new table extends the RLS deny-sweep in `access-wall.test.ts`; the `vi.mock` preamble must be repeated per NEW file (mock factories are hoisted). New Phase-4 API tests live in `assignments-core.test.ts` and `assignments-actions.test.ts`. No new seed users → `harness.ts` `SeedEmail` unchanged.
15. **`'use server'` files may export ONLY async functions.** Schemas, label maps and pure derivations live in `src/lib/validation/assignments.ts` and `src/lib/assignments.ts` (pure, unit-tested).
16. **`z.guid`, not `z.uuid`:** seed UUIDs fail Zod v4's RFC variant check. Use the exported `uuidField` from `@/lib/validation/school`.
17. **Controlled fields on EVERY new form** (React 19 auto-resets uncontrolled fields after every completed action, including error replies). Pattern: `useState` per field + the prev-state render-adjust clear on success (`MeldFravaer` is the house reference). No `useEffect` state machines.
18. **TOTP for manual browser checks:** staff logins bounce to `/mfa/registrer`/`/mfa/verifiser`; generate codes with the node snippet in the Phase-1 plan's gotcha 17 (`docs/superpowers/plans/2026-07-17-iqra-portal-phase-1.md`).
19. **Write-confirmation pattern:** success-reporting UPDATEs `.select()` and map 0 rows to a Norwegian «…finnes ikke lenger.» error; idempotent DELETEs stay unconfirmed; map `23503` (stale ref) and `23505` (dup) to friendly messages; `22P02` (malformed uuid) → enumeration-quiet null in reads.

**Execution discipline (protect it):** fresh implementer per task → spec review (byte-exact) → quality review → fix loop → controller live-verifies before closing. **Security-critical tasks (focused security-lens review with live RLS probes): 1, 2, 3, 4, 5, 6, 8, 9.** The phase PR gets the **full multi-agent panel** — Storage and child-data RLS are new walls (per the 2026-07-21 review policy). TDD everywhere: tests written and failing before implementation; tests + implementation committed together per task (one commit per task).

---

## Refinements to the design spec (decided at planning time — read before Task 5)

The spec is approved and D1–D10 are **not** re-litigated here. Four things the spec left as sketches needed a concrete engineering answer:

**R1 — Uploads go through a server-minted *signed upload URL*, not through the server action's body.** The spec (§5) says "MIME + size validated server-side in the action, never trusting the browser". Taken literally that routes 50 MB of bytes through a Next.js server action — which **cannot work on Vercel**, where a serverless function request body caps at 4.5 MB. The architecture that preserves the spec's *intent* is:

1. The teacher/pupil picks a file. A server action (`requestAssignmentUpload` / `requestSubmissionUpload`) authorizes the caller via the DAL guard, validates the **declared** filename/MIME/size against the allowlist, computes the path `{parent_id}/{uuid}-{safeFilename}`, and mints a signed upload URL with `createSignedUploadUrl(path)`.
2. The browser PUTs directly to Storage with `uploadToSignedUrl`. **The bucket itself enforces the real bytes** — `storage.buckets.allowed_mime_types` and `.file_size_limit` are columns set by migration, checked by the Storage service, not by the browser.
3. A second server action (`confirmAssignmentUpload` / `confirmSubmissionUpload`) re-reads the object's **actual** size and MIME from Storage (`.list()` on the parent folder) and only then inserts the attachment row.

So there are now **three** server-side checks (action allowlist → bucket enforcement → confirm-time re-read) instead of one, and none of them trusts the browser. The signed URL is scoped to exactly one path the server chose, so a caller cannot redirect the upload into someone else's folder.

**R2 — TUS/resumable upload is deferred, and that is a scope reduction the user should know about.** Supabase's own docs describe standard uploads as supported to 5 GB and recommend TUS above 6 MB for *reliability*, not as a hard requirement. Implementing TUS means adding `tus-js-client` or Uppy (a new dependency, against the phase's zero-dependency rule) plus a chunked-progress UI. Signed-URL PUT handles the full 50 MB cap; the only thing lost is *resume after a dropped connection*. Recorded as an open item at the exit gate (Task 15) — revisit if pilot teachers report failed phone uploads.

**R3 — `class_students` gets a surrogate primary key** (the spec left "surrogate key vs PK incl. date" open). Chosen: `id uuid primary key default gen_random_uuid()`, old PK `(class_id, student_id)` dropped, plus `unique (class_id, student_id, enrolled_on)` so re-enrolment stays idempotent and the partial `class_students_one_active` index still forbids two live placements. A surrogate key beats a PK including the date because it keeps `enrolled_on` **correctable** (fixing a typo'd enrolment date under a date-bearing PK is a primary-key update) and gives later phases a stable FK target.

**R4 — `students.status` and enrolment are decoupled by making enrolment the single source of truth.** Setting a student to `stopped` now stamps `left_on` on their active enrolment inside the same admin action, instead of leaving a stopped pupil sitting on live rosters. No read path changes — every roster in the codebase already filters on `left_on`, so this fixes the class of bug at the write end rather than in twenty reads. Re-activating does **not** auto-enrol; the admin re-enrols explicitly, which R3 has now made possible.

---

## File structure

**Migrations (create, in this order):**

| File | Responsibility |
|---|---|
| `supabase/migrations/20260728090000_enrollment_riders.sql` | R3: `class_students` surrogate PK + interval unique index |
| `supabase/migrations/20260728091000_class_groups.sql` | `class_groups` + `class_group_members`, firewall, policies |
| `supabase/migrations/20260728092000_assignments.sql` | `assignments`, `assignment_groups`, `assignment_group_members`, the five helpers, policies |
| `supabase/migrations/20260728093000_submissions_reviews.sql` | `submissions` (XOR CHECK) + `assignment_reviews`, double-bind policies, author pinning |
| `supabase/migrations/20260728094000_assignment_storage.sql` | Two buckets w/ MIME+size limits, `storage.objects` policies, both attachment tables |

**pgTAP (create):** `supabase/tests/20_class_groups_rls.sql`, `21_assignments_rls.sql`, `22_submissions_rls.sql`, `23_assignment_storage.sql`, `24_enrollment_riders.sql`.

**Library code (create):**

| File | Responsibility |
|---|---|
| `src/lib/assignments.ts` | Pure derivations: `deriveStatus`, `statusLabel`, `statusTone`, `groupSizeOk`, `safeStorageName` — no I/O, unit-tested |
| `src/lib/validation/assignments.ts` | Zod schemas + the MIME/size allowlist (`assignmentSchema`, `submissionSchema`, `reviewSchema`, `classGroupSchema`, `uploadRequestSchema`, `ATTACHMENT_MIME`, `MAX_ATTACHMENT_BYTES`) |
| `src/lib/dal/assignments.ts` | All reads + the guards (`requireTeacherOfAssignment`, `getAssignmentReview`, `listAssignmentsForTeacher`, `listAssignmentsForStudent`, `listAssignmentsForChild`, `listReusableAssignments`, `listClassGroups`) |
| `src/lib/storage/attachments.ts` | Signed upload/download URL helpers + the confirm-time metadata re-read |

**Actions (create):** `src/app/(portal)/laerer/oppgaver/actions.ts` (create, reuse, upload request/confirm/remove), `src/app/(portal)/laerer/oppgaver/[assignmentId]/actions.ts` (review), `src/app/(portal)/laerer/klasser/[id]/grupper/actions.ts` (templates), `src/app/(portal)/elev/lekser/actions.ts` (hand-in), `src/app/(portal)/forelder/lekser/actions.ts` (hand-in on behalf).

**Pages/components (create):** `laerer/oppgaver/page.tsx` + `AssignmentList.tsx`, `laerer/oppgaver/ny/page.tsx` + `NewAssignmentForm.tsx` + `ReusePicker.tsx`, `laerer/oppgaver/[assignmentId]/page.tsx` + `RosterReview.tsx` (the hero), `laerer/klasser/[id]/grupper/page.tsx` + `GroupTemplates.tsx`, `elev/lekser/page.tsx` + `HandInForm.tsx`, `forelder/lekser/page.tsx`, and the shared `src/components/assignments/AttachmentPicker.tsx` + `AttachmentList.tsx` + `StatusChip.tsx`.

**Modify:** `src/lib/dal/classes.ts` (R4 term scoping), `src/app/(portal)/admin/elever/actions.ts` (R4 status→`left_on`), `src/app/(portal)/admin/klasser/actions.ts` (R3 error mapping), `src/app/(portal)/laerer/LaererNav.tsx`, `src/app/(portal)/elev/ElevNav.tsx`, `src/app/(portal)/forelder/ForelderNav.tsx`, `src/app/(portal)/admin/page.tsx`, `supabase/seed.sql`, `tests/api/access-wall.test.ts`.

---

## Seed anchors (exact UUIDs — Task 5 creates the Phase-4 ones)

Reused verbatim from Phases 1–3 (**do not invent new ones**): term `HOST_2026` = `f1000000-0000-0000-0000-000000000001` (current) · subjects `ARABISK` = `fa000000-0000-0000-0000-000000000001`, `KORAN` = `fa…02`, `ISLAMKUNNSKAP` = `fa…03` · classes `K1` = `fc000000-0000-0000-0000-000000000001` (teacher `laerer@` = `22222222-…`), `K3` = `fc…02` (teacher `laererforelder@` = `66666666-…`) · students `YUSUF` = `fe000000-0000-0000-0000-000000000001` (K1, child of `forelder@` = `33333333-…`, login `elev@` = `44444444-…`), `AMIRA` = `fe…02` (K3, child of `forelder@`), `BILAL` = `fe…03` (K1, child of `laererforelder@`), `ZAYNAB` = `fe…04` (K3, **protected**, child of `forelder2@` = `77777777-…`), `IDRIS` = `fe…05` (stopped, unenrolled).

**New Phase-4 anchors (Task 5 adds them to `supabase/seed.sql`):**

- `class_groups`: `G_HALAQA_A` = `fb000000-0000-0000-0000-000000000001` («Halaqa A», K1, sort 1) with members YUSUF + BILAL.
- `assignments`: `A_ALFABET` = `f8000000-0000-0000-0000-000000000001` («Skriv det arabiske alfabetet», K1, ARABISK, `due_on` 2026-09-12, `submission_type` `digital`, created_by `laerer@`) — **class-wide** (no `assignment_groups` rows), so `student_in_assignment` resolves it through the roster branch. `A_GRUPPE` = `f8…02` («Gruppeoppgave: presenter en surah», K1, KORAN, `due_on` 2026-09-19, `digital`, created_by `laerer@`) — **group-targeted**, with one `assignment_groups` row `AG_HALAQA_A` = `fb000000-0000-0000-0000-000000000011` (`source_group_id` = `G_HALAQA_A`, name «Halaqa A») and frozen members YUSUF + BILAL.
- `submissions`: `S_YUSUF_ALFABET` = `f9000000-0000-0000-0000-000000000001` (individual: `A_ALFABET` × YUSUF, body «Jeg har skrevet hele alfabetet.», submitted_by `elev@`). `S_HALAQA_A` = `f9…02` (group: `A_GRUPPE` × `AG_HALAQA_A`, body «Vi har valgt Al-Fatiha.», submitted_by `elev@`).
- `assignment_reviews`: exactly one — `A_ALFABET` × YUSUF, `godkjent`, 9 points, «Fin håndskrift — øv på siste bokstavene.», reviewed_by `laerer@`. **`A_GRUPPE` gets no review rows**, so the api suite can prove per-pupil review across a shared hand-in from a clean start.
- **No seeded attachment rows** — an attachment row without its Storage object is exactly the orphan the design forbids, and no seed can create objects. Attachment coverage is api-test-only (Task 6).
- ZAYNAB (protected, K3) and IDRIS (stopped) deliberately get **zero** Phase-4 rows; pgTAP builds its own protected/leaver scenarios hermetically under `b8`–`bc`.

---

## The canonical pgTAP teardown (used verbatim by files 20–24)

Every pgTAP file is hermetic: it wipes the seed rows, builds its own fixtures, and rolls back. pgTAP runs against the **fully migrated** database, so every file can use the identical block below regardless of which migration introduced which table.

**Order is load-bearing.** `tests.subject_id` and — new this phase — `assignments.subject_id` **and** `assignments.class_id` are `on delete restrict`, so `assignments` and `tests` must be gone before `subjects` and `classes` can be deleted. A file that skips them fails at the first `delete from public.subjects` with a 23503, not with a useful message. Paste this block verbatim into each of `20`–`24` immediately after `select plan(N);`:

**Two things discovered while executing this, both load-bearing:**

- **`storage.objects` carries a `BEFORE DELETE FOR EACH STATEMENT` trigger (`storage.protect_delete`)** that raises 42501 on *any* direct delete — including one matching zero rows. Precede the storage delete with `select set_config('storage.allow_delete_query', 'true', true);`. That GUC is the guard's own escape hatch and, being `set local`, dies with the transaction. Do **not** disable RLS to work around it.
- **14 pre-existing pgTAP files (`06`–`20`, `24`) needed `delete from public.assignments;` added** to their own teardowns once the seed started carrying assignments — `assignments.class_id` and `.subject_id` are `RESTRICT` by design, so any file deleting `classes`/`subjects` fails with 23503 without it. One line suffices; assignments cascades to groups, hand-ins, reviews and attachments.

```sql
-- Hermetic fixtures (seed independence, header gotcha 13): children before
-- parents. assignments/tests come out before subjects and classes because
-- their subject_id/class_id are RESTRICT — history must not be silently
-- shredded by a cascade.
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where bucket_id in ('assignments', 'submissions');
delete from public.submission_attachments;
delete from public.assignment_attachments;
delete from public.assignment_reviews;
delete from public.submissions;
delete from public.assignment_group_members;
delete from public.assignment_groups;
delete from public.assignments;
delete from public.class_group_members;
delete from public.class_groups;
delete from public.term_grades;
delete from public.test_results;
delete from public.tests;
delete from public.attendance;
delete from public.absence_notices;
delete from public.lessons;
delete from public.class_students;
delete from public.class_schedule;
delete from public.class_subjects;
delete from public.class_teachers;
delete from public.guardian_student;
delete from public.students;
delete from public.classes;
delete from public.subjects;
delete from public.terms;
```

Each task below shows an abbreviated teardown for readability — **use this full block instead** in every case.

---

## Task 1: Ledger riders — enrolment schema, status decoupling, term scoping

The spec (§10.1) assigns three accumulated ledger items to this phase and says they must land **before** the assignment work, because assignments build on the enrolment shape. R3/R4 above are the decisions; this task implements them.

**Files:**
- Create: `supabase/migrations/20260728090000_enrollment_riders.sql`
- Create: `supabase/tests/24_enrollment_riders.sql`
- Modify: `src/app/(portal)/admin/klasser/actions.ts:256-264` (23505 mapping), `src/app/(portal)/admin/elever/actions.ts` (`updateStudentAction`), `src/lib/dal/classes.ts:52-77` (`listMyTeachingClasses`), `src/app/(portal)/admin/elever/EnrollCard.tsx:12-17` (stale comment)
- Modify: `tests/api/school-actions.test.ts`, `tests/api/school-core.test.ts`

- [ ] **Step 1: Cut the branch**

```bash
cd /Users/daodilyas/dev/iqra-portal && git checkout real && git pull --ff-only && git checkout -b feat/phase-4
```

Expected: `Switched to a new branch 'feat/phase-4'` from `b32f4da` (or later, if `real` moved).

- [ ] **Step 2: Write the failing pgTAP file**

Create `supabase/tests/24_enrollment_riders.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- Phase-4 ledger rider (R3): class_students moves from PK (class_id,
-- student_id) to a surrogate id, so a pupil who left a class can be
-- re-enrolled in THAT SAME class later — previously a PK collision, which is
-- why the admin UI carried a two-step "this is permanent" confirm. The two
-- guards that must survive the change: at most one ACTIVE placement per pupil
-- (class_students_one_active, unchanged), and no duplicate interval for the
-- same (class, pupil, enrolled_on) (class_students_interval_unique, new).

-- Hermetic fixtures (seed independence, header gotcha 13): children first.
delete from public.class_students;
delete from public.guardian_student;
delete from public.students;
delete from public.classes;
delete from public.terms;

insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.email, '{"provider":"email","providers":["email"]}',
       jsonb_build_object('full_name', u.full_name), now(), now()
from (values
  ('bc000000-0000-0000-0000-000000000001'::uuid, 'pgtap-er-admin@test.local', 'ER Admin')
) as u(id, email, full_name);
insert into public.user_roles (user_id, role) values
  ('bc000000-0000-0000-0000-000000000001', 'admin');

insert into public.terms (id, name, starts_on, ends_on) values
  ('bc000000-0000-0000-0000-000000000011', 'ER Termin', '2026-08-15', '2026-12-20');
insert into public.classes (id, term_id, name) values
  ('bc000000-0000-0000-0000-000000000021', 'bc000000-0000-0000-0000-000000000011', 'ER Klasse A');
insert into public.students (id, first_name, last_name, birth_year) values
  ('bc000000-0000-0000-0000-000000000031', 'ER', 'Elev En', 2014);

-- ── Schema shape ────────────────────────────────────────────────────
select has_column('public'::name, 'class_students'::name, 'id'::name,
  'class_students has the surrogate id column');
select col_is_pk('public'::name, 'class_students'::name, 'id'::name,
  'class_students'' primary key is the surrogate id (R3)');

-- ── The rider itself: leave, then re-enrol in the SAME class ────────
select set_config('request.jwt.claims',
  '{"sub":"bc000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.class_students (class_id, student_id, enrolled_on, left_on)
     values ('bc000000-0000-0000-0000-000000000021',
             'bc000000-0000-0000-0000-000000000031', '2026-08-20', '2026-09-01') $$,
  'a closed placement is recorded');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"bc000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.class_students (class_id, student_id, enrolled_on)
     values ('bc000000-0000-0000-0000-000000000021',
             'bc000000-0000-0000-0000-000000000031', '2026-09-15') $$,
  'R3: the pupil is re-enrolled in the SAME class after leaving it');
reset role;

-- ── The two guards that must survive ────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"bc000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.class_students (class_id, student_id, enrolled_on)
     values ('bc000000-0000-0000-0000-000000000021',
             'bc000000-0000-0000-0000-000000000031', '2026-10-01') $$,
  '23505', null,
  'one active placement per pupil still holds (class_students_one_active)');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"bc000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.class_students (class_id, student_id, enrolled_on, left_on)
     values ('bc000000-0000-0000-0000-000000000021',
             'bc000000-0000-0000-0000-000000000031', '2026-08-20', '2026-09-05') $$,
  '23505', null,
  'a duplicate (class, pupil, enrolled_on) interval is rejected');
reset role;

select * from finish();
rollback;
```

- [ ] **Step 3: Run it to verify it fails**

```bash
cd /Users/daodilyas/dev/iqra-portal && supabase test db
```

Expected: FAIL — `24_enrollment_riders.sql` reports `has_column` and `col_is_pk` failures and the re-enrol `lives_ok` failing with a duplicate-key error, because the surrogate PK does not exist yet.

- [ ] **Step 4: Write the migration**

Create `supabase/migrations/20260728090000_enrollment_riders.sql`:

```sql
-- Phase-4 ledger riders (design spec §10.1, plan refinements R3/R4). These
-- land FIRST because assignments build on the enrolment shape: every roster
-- read in Phases 2-4 is "class_students AS OF a date", and a pupil who
-- re-joins a class they once left must produce a SECOND interval, not a
-- constraint violation.
--
-- R3: the PK (class_id, student_id) made same-class re-enrolment impossible.
-- Replaced by a surrogate id — chosen over a PK including enrolled_on so that
-- a mistyped enrolment date stays correctable with an ordinary UPDATE, and so
-- later phases have a stable FK target. The two real invariants move to
-- indexes: at most one ACTIVE placement per pupil (unchanged), and no
-- duplicate interval per (class, pupil, enrolled_on) (new).

alter table public.class_students
  add column id uuid not null default gen_random_uuid();

alter table public.class_students drop constraint class_students_pkey;
alter table public.class_students add constraint class_students_pkey primary key (id);

create unique index class_students_interval_unique
  on public.class_students (class_id, student_id, enrolled_on);

comment on column public.class_students.id is
  'Surrogate key (R3). Enrolment is an INTERVAL, not a membership flag: one pupil may hold several rows for the same class over time. class_students_one_active forbids two live placements; class_students_interval_unique forbids two identical intervals.';
comment on table public.class_students is
  'Enrolment intervals. left_on null = active. Moving a pupil = stamp left_on on the old row, insert a new one. Re-joining a class previously left is supported (R3). A pupil set to status = ''stopped'' has left_on stamped by the admin action in the same write (R4) — enrolment, not students.status, is what every roster reads.';
```

- [ ] **Step 5: Reset the database and verify pgTAP passes**

```bash
cd /Users/daodilyas/dev/iqra-portal && supabase db reset && supabase test db
```

Expected: all pgTAP files pass, including `24_enrollment_riders.sql ..... ok`.

- [ ] **Step 6: Write the failing api tests for R4 (status → `left_on`) and term scoping**

Append to `tests/api/school-actions.test.ts`, inside the existing top-level `describe` block structure (add as a new `describe` at the end of the file):

```ts
describe('R4: stopping a pupil ends their active enrolment in the same write', () => {
  it('stamps left_on when status flips to stopped, and leaves it alone otherwise', async () => {
    await signInAsAAL2('admin@test.local');
    const service = createSupabaseClient<Database>(
      getPublicEnv().NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    let studentId: string | null = null;
    try {
      const target = await expectRedirect(
        createStudentAction(
          { error: null },
          form({ fornavn: 'Stoppet', etternavn: 'Testelev', fodselsaar: '2014', notat: '' }),
        ),
      );
      studentId = target.replace('/admin/elever/', '');

      await expect(
        enrollStudentAction({ error: null }, form({ elevId: studentId, klasseId: K1 })),
      ).resolves.toEqual({ error: null, success: true });

      // Still active: left_on stays null.
      const before = await service
        .from('class_students')
        .select('left_on')
        .eq('student_id', studentId)
        .is('left_on', null);
      expect(before.data).toHaveLength(1);

      await expectRedirect(
        updateStudentAction(
          { error: null },
          form({
            id: studentId,
            fornavn: 'Stoppet',
            etternavn: 'Testelev',
            fodselsaar: '2014',
            notat: '',
            status: 'stopped',
          }),
        ),
      );

      const after = await service
        .from('class_students')
        .select('left_on')
        .eq('student_id', studentId);
      expect(after.data).toHaveLength(1);
      expect(after.data?.[0].left_on).not.toBeNull();
    } finally {
      if (studentId) {
        await service.from('class_students').delete().eq('student_id', studentId);
        await service.from('students').delete().eq('id', studentId);
      }
    }
  });
});
```

Add the imports this needs at the top of the file if they are not already there: `enrollStudentAction` from `@/app/(portal)/admin/klasser/actions`, and the `K1` constant `const K1 = 'fc000000-0000-0000-0000-000000000001';`.

Append to `tests/api/school-core.test.ts`:

```ts
describe('R4/rider 3: the teacher class list is scoped to the current term', () => {
  it('omits a class belonging to a non-current term', async () => {
    const service = createSupabaseClient<Database>(
      getPublicEnv().NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const oldTermId = randomUUID();
    const oldClassId = randomUUID();
    try {
      await service
        .from('terms')
        .insert({ id: oldTermId, name: 'Vår 2026', starts_on: '2026-01-10', ends_on: '2026-06-20' });
      await service
        .from('classes')
        .insert({ id: oldClassId, term_id: oldTermId, name: 'Gammel klasse' });
      await service
        .from('class_teachers')
        .insert({ class_id: oldClassId, teacher_id: '22222222-2222-2222-2222-222222222222' });

      await signInAsAAL2('laerer@test.local');
      const classes = await listMyTeachingClasses();
      expect(classes.map((c) => c.id)).not.toContain(oldClassId);
      expect(classes.map((c) => c.id)).toContain('fc000000-0000-0000-0000-000000000001');
    } finally {
      await service.from('class_teachers').delete().eq('class_id', oldClassId);
      await service.from('classes').delete().eq('id', oldClassId);
      await service.from('terms').delete().eq('id', oldTermId);
    }
  });
});
```

Add `import { listMyTeachingClasses } from '@/lib/dal/classes';` and `import { randomUUID } from 'node:crypto';` at the top of `school-core.test.ts` if absent.

- [ ] **Step 7: Run the api tests to verify they fail**

```bash
cd /Users/daodilyas/dev/iqra-portal && npm run test:api -- school-actions school-core
```

Expected: FAIL — the status test fails because `left_on` is still `null` after stopping; the term test fails because `listMyTeachingClasses` returns the old-term class.

- [ ] **Step 8: Implement R4 — stopping a pupil ends the enrolment**

In `src/app/(portal)/admin/elever/actions.ts`, inside `updateStudentAction`, immediately after the `if (!data || data.length === 0) return { error: 'Eleven finnes ikke lenger.' };` line and before `revalidatePath`, insert:

```ts
  // R4 (ledger rider): enrolment is the single source of truth for every
  // roster read, so a pupil marked "stopped" must not stay on live rosters.
  // Same left_on rule as unenrollStudentAction: a placement that has not
  // started yet closes on its own start date, never before it.
  if (parsed.data.status === 'stopped') {
    const { data: active, error: activeError } = await supabase
      .from('class_students')
      .select('id, enrolled_on')
      .eq('student_id', id.data)
      .is('left_on', null)
      .maybeSingle();
    if (activeError) {
      throw new Error(`Kunne ikke avslutte klasseplassen: ${activeError.message}`);
    }
    if (active) {
      const today = todayOsloISO();
      const leftOn = active.enrolled_on > today ? active.enrolled_on : today;
      const { error: closeError } = await supabase
        .from('class_students')
        .update({ left_on: leftOn })
        .eq('id', active.id);
      if (closeError) {
        throw new Error(`Kunne ikke avslutte klasseplassen: ${closeError.message}`);
      }
    }
  }
```

Add `import { todayOsloISO } from '@/lib/dates';` to that file if it is not already imported.

- [ ] **Step 9: Implement rider 3 — term-scope the teacher class list**

In `src/lib/dal/classes.ts`, replace the body of `listMyTeachingClasses` (lines 52–77) with:

```ts
export async function listMyTeachingClasses(): Promise<TeachingClass[]> {
  const { user } = await requireStaffRole('teacher');
  const term = await getCurrentTerm();
  if (!term) return [];
  const supabase = await createClient();
  // Ledger rider: scoped to the CURRENT term. Without this the list mixes
  // terms the moment a second one exists, and a teacher's "my classes" screen
  // silently grows a year of history. `!inner` is required — a filter on an
  // embedded table only narrows rows when the embed is an inner join.
  const { data, error } = await supabase
    .from('class_teachers')
    .select(
      'classes!inner(id, name, room, term_id, terms(name), class_schedule(weekday, starts_at, ends_at))',
    )
    .eq('teacher_id', user.id)
    .eq('classes.term_id', term.id);
  if (error) {
    throw new Error(`Kunne ikke lese egne klasser: ${error.message}`);
  }
  const classes = (data ?? [])
    .map((row) => row.classes)
    .filter((c): c is NonNullable<typeof c> => c !== null);
  const counts = await activeCounts(classes.map((c) => c.id));
  return classes
    .map((c) => ({
      id: c.id,
      name: c.name,
      room: c.room,
      term_name: c.terms?.name ?? '',
      active_count: counts.get(c.id) ?? 0,
      schedule: sortSlots(c.class_schedule ?? []),
    }))
    .sort((a, b) => nbCollator.compare(a.name, b.name));
}
```

Add `import { getCurrentTerm } from './terms';` to the top of `src/lib/dal/classes.ts`.

- [ ] **Step 10: Implement the R3 error mapping and clear the stale comment**

In `src/app/(portal)/admin/klasser/actions.ts`, replace the 23505 branch of `enrollStudentAction` (lines 256–259) with:

```ts
  if (error) {
    if (error.code === '23505') {
      // Two different uniques now (R3): the interval index means "this exact
      // placement already exists", the one-active index means "the pupil is
      // already placed somewhere". Reporting the wrong one sends the admin
      // hunting through the wrong class.
      return {
        error: error.message.includes('class_students_interval_unique')
          ? 'Eleven er allerede meldt inn i denne klassen fra denne datoen.'
          : 'Eleven er allerede i en klasse.',
      };
    }
```

In `src/app/(portal)/admin/elever/EnrollCard.tsx`, replace the doc comment at lines 12–17 with:

```tsx
/**
 * Two-step confirm (spec §7) — mirrors klasser/ClassForms' UnenrollForm.
 * Since R3 an unenrolment is reversible (the pupil can be re-enrolled in the
 * same class), but it still stamps a dated interval that assignment and
 * attendance history read as-of, so a stray single click stays costly.
 */
```

- [ ] **Step 11: Run every suite to verify green**

```bash
cd /Users/daodilyas/dev/iqra-portal && npm run typecheck && npm run test && npm run test:api && supabase test db
```

Expected: typecheck clean, unit suite passing, api suite passing (including the two new tests), all 25 pgTAP files ok.

- [ ] **Step 12: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal && git add supabase/migrations/20260728090000_enrollment_riders.sql supabase/tests/24_enrollment_riders.sql src/lib/dal/classes.ts "src/app/(portal)/admin/elever/actions.ts" "src/app/(portal)/admin/elever/EnrollCard.tsx" "src/app/(portal)/admin/klasser/actions.ts" tests/api/school-actions.test.ts tests/api/school-core.test.ts && git commit -m "feat(enrollment): surrogate key, status-enrollment decoupling and term-scoped class list"
```

---
## Task 2: `class_groups` + `class_group_members` — the reusable templates

D1: groups are **class-level templates**. They pre-exist assignments (teachers said "make the groups *before* the assignments are sent"), and an assignment **copies** them rather than referencing them. This task builds the template side only; the copy happens in Task 3.

**Files:**
- Create: `supabase/migrations/20260728091000_class_groups.sql`
- Create: `supabase/tests/20_class_groups_rls.sql`

- [ ] **Step 1: Write the failing pgTAP file**

Create `supabase/tests/20_class_groups_rls.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- class_groups + class_group_members (D1): reusable per-class templates.
-- Teacher-managed school structure — no audit trigger, same as lessons/tests.
-- Walls: only the class's own teacher (or admin) may create/edit/delete a
-- template; a foreign teacher's USING clause matches nothing (silent no-op,
-- not an error); parents and pupils never see templates at all — D7 keeps
-- group membership a teacher-only concern, and Google hides group names from
-- pupils for the same safeguarding reason.
-- Group SIZE (2-4, D2) is deliberately NOT a db constraint: it is validated
-- app-side at copy time, exactly like points <= max_points in Phase 3. This
-- file pins that absence so nobody "helpfully" adds a check constraint that
-- would make a half-built template unsaveable.

delete from public.class_group_members;
delete from public.class_groups;
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
  ('b8000000-0000-0000-0000-000000000001'::uuid, 'pgtap-cg-admin@test.local',   'CG Admin'),
  ('b8000000-0000-0000-0000-000000000002'::uuid, 'pgtap-cg-laerer1@test.local', 'CG Lærer En'),
  ('b8000000-0000-0000-0000-000000000003'::uuid, 'pgtap-cg-laerer2@test.local', 'CG Lærer To'),
  ('b8000000-0000-0000-0000-000000000004'::uuid, 'pgtap-cg-forelder@test.local','CG Forelder'),
  ('b8000000-0000-0000-0000-000000000005'::uuid, 'pgtap-cg-elev@test.local',    'CG Elev'),
  ('b8000000-0000-0000-0000-000000000006'::uuid, 'pgtap-cg-okonomi@test.local', 'CG Økonomi')
) as u(id, email, full_name);
insert into public.user_roles (user_id, role) values
  ('b8000000-0000-0000-0000-000000000001', 'admin'),
  ('b8000000-0000-0000-0000-000000000002', 'teacher'),
  ('b8000000-0000-0000-0000-000000000003', 'teacher'),
  ('b8000000-0000-0000-0000-000000000004', 'parent'),
  ('b8000000-0000-0000-0000-000000000005', 'student'),
  ('b8000000-0000-0000-0000-000000000006', 'economy');

insert into public.terms (id, name, starts_on, ends_on) values
  ('b8000000-0000-0000-0000-000000000011', 'CG Termin', '2026-08-15', '2026-12-20');
insert into public.classes (id, term_id, name) values
  ('b8000000-0000-0000-0000-000000000021', 'b8000000-0000-0000-0000-000000000011', 'CG Klasse A'),
  ('b8000000-0000-0000-0000-000000000022', 'b8000000-0000-0000-0000-000000000011', 'CG Klasse B');
insert into public.class_teachers (class_id, teacher_id) values
  ('b8000000-0000-0000-0000-000000000021', 'b8000000-0000-0000-0000-000000000002'),
  ('b8000000-0000-0000-0000-000000000022', 'b8000000-0000-0000-0000-000000000003');
insert into public.students (id, first_name, last_name, birth_year, protected, student_user_id) values
  ('b8000000-0000-0000-0000-000000000031', 'CG', 'Elev En', 2014, false, 'b8000000-0000-0000-0000-000000000005'),
  ('b8000000-0000-0000-0000-000000000032', 'CG', 'Elev To', 2015, false, null),
  ('b8000000-0000-0000-0000-000000000033', 'CG', 'Elev Tre', 2015, false, null);
insert into public.guardian_student (guardian_id, student_id) values
  ('b8000000-0000-0000-0000-000000000004', 'b8000000-0000-0000-0000-000000000031');
insert into public.class_students (class_id, student_id, enrolled_on) values
  ('b8000000-0000-0000-0000-000000000021', 'b8000000-0000-0000-0000-000000000031', '2026-08-20'),
  ('b8000000-0000-0000-0000-000000000021', 'b8000000-0000-0000-0000-000000000032', '2026-08-20'),
  ('b8000000-0000-0000-0000-000000000022', 'b8000000-0000-0000-0000-000000000033', '2026-08-20');

-- ── Schema shape ────────────────────────────────────────────────────
select has_table('public'::name, 'class_groups'::name, 'class_groups table exists');
select ok((select relrowsecurity from pg_class
           where oid = 'public.class_groups'::regclass), 'RLS enabled on class_groups');
select has_table('public'::name, 'class_group_members'::name, 'class_group_members table exists');
select ok((select relrowsecurity from pg_class
           where oid = 'public.class_group_members'::regclass),
          'RLS enabled on class_group_members');
select hasnt_trigger('public'::name, 'class_groups'::name, 'class_groups_audit'::name,
  'templates are school structure: no audit trigger (lessons/tests precedent)');

-- ── INSERT: the class's own teacher builds a template ───────────────
select set_config('request.jwt.claims',
  '{"sub":"b8000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.class_groups (id, class_id, name, sort, created_by)
     values ('b8000000-0000-0000-0000-000000000041',
             'b8000000-0000-0000-0000-000000000021', 'Halaqa A', 1,
             'b8000000-0000-0000-0000-000000000002') $$,
  'the class teacher creates a group template');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b8000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.class_groups (class_id, name, sort, created_by)
     values ('b8000000-0000-0000-0000-000000000021', 'Kapret gruppe', 2,
             'b8000000-0000-0000-0000-000000000003') $$,
  '42501', null,
  'fine-derived #4: a foreign teacher cannot create templates in the class');
reset role;

-- ── Members: the double bind (teacher of the group AND pupil on the
--    class roster) ────────────────────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"b8000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.class_group_members (group_id, student_id) values
       ('b8000000-0000-0000-0000-000000000041', 'b8000000-0000-0000-0000-000000000031'),
       ('b8000000-0000-0000-0000-000000000041', 'b8000000-0000-0000-0000-000000000032') $$,
  'the teacher adds two rostered pupils to the template');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b8000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.class_group_members (group_id, student_id)
     values ('b8000000-0000-0000-0000-000000000041',
             'b8000000-0000-0000-0000-000000000033') $$,
  '42501', null,
  'C-1 regression class: a pupil from another class cannot be added at wall 2');
reset role;

-- ── D2 is app-side: the db accepts a one-member template ────────────
select set_config('request.jwt.claims',
  '{"sub":"b8000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.class_groups (id, class_id, name, sort, created_by)
     values ('b8000000-0000-0000-0000-000000000042',
             'b8000000-0000-0000-0000-000000000021', 'Halaqa B', 2,
             'b8000000-0000-0000-0000-000000000002') $$,
  'D2 (size 2-4) is validated app-side at copy time, never by a db check');
reset role;

-- ── SELECT matrix: teachers and admin only (D7) ─────────────────────
select set_config('request.jwt.claims',
  '{"sub":"b8000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.class_groups), 2::bigint,
  'the class teacher sees own-class templates');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b8000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.class_groups), 0::bigint,
  'a foreign teacher sees no templates of a class they do not teach');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b8000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.class_group_members), 0::bigint,
  'D7: a parent never reads group membership');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b8000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.class_group_members), 0::bigint,
  'D7: a pupil never reads template membership (Google hides group names too)');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b8000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.class_groups), 0::bigint,
  'economy sees no templates');
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /Users/daodilyas/dev/iqra-portal && supabase test db
```

Expected: FAIL — `20_class_groups_rls.sql` errors at the first fixture `delete from public.class_group_members;` because the table does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260728091000_class_groups.sql`:

```sql
-- Reusable per-class group templates (D1). Teachers build groups BEFORE
-- assignments exist; creating a group assignment COPIES a template's current
-- membership into assignment_group_members (Task 3), so editing or deleting a
-- template later can never rewrite who was in last month's task. That copy is
-- the whole point of the two-table split — the same immutability discipline as
-- the roster-as-of-date reads in Phases 2 and 3.
--
-- Templates are teacher-managed school structure: no audit trigger (the
-- lessons/tests precedent), and DELETE is allowed to the class's own teacher
-- here — unlike every student-data table in this phase — because a template
-- carries no pupil work. Deleting one is undoing a plan, not destroying
-- history: the assignments already copied from it keep their frozen members.
--
-- D7 (pupil self-add deferred) is why there is no parent/pupil SELECT policy:
-- membership is a teacher-only concern this phase. Google Classroom hides
-- group names from students for the same safeguarding reason (visible
-- exclusion). Adding pupil reads later is purely additive — no migration.

-- ── class_groups ────────────────────────────────────────────────────
create table public.class_groups (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  sort       integer not null default 0,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_groups_name_unique unique (class_id, name)
);
comment on table public.class_groups is
  'Reusable group templates per class (D1). Copied onto an assignment at creation time — never referenced by one, so template edits never rewrite history. Group size 2-4 (D2) is validated app-side at copy time, deliberately NOT a db check: a half-built template must stay saveable.';

create trigger class_groups_set_updated_at
  before update on public.class_groups
  for each row execute function private.set_updated_at();

revoke all on table public.class_groups from anon, authenticated, service_role;
grant select, insert, update, delete on public.class_groups to authenticated;
grant select, delete on public.class_groups to service_role;

alter table public.class_groups enable row level security;

-- ── class_group_members ─────────────────────────────────────────────
create table public.class_group_members (
  group_id   uuid not null references public.class_groups (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, student_id)
);
comment on table public.class_group_members is
  'Template membership. No audit trigger: this is a teacher''s draft plan, not pupil work — the audited row is assignment_group_members, the frozen copy an assignment actually acts on.';

revoke all on table public.class_group_members from anon, authenticated, service_role;
grant select, insert, update, delete on public.class_group_members to authenticated;
grant select, delete on public.class_group_members to service_role;

alter table public.class_group_members enable row level security;

-- ── Helper ──────────────────────────────────────────────────────────
-- Ordering note (the Phase-3 lesson): `language sql` bodies are validated
-- against the catalog at CREATE FUNCTION time, so both tables must exist
-- before this function, and the policies calling it come last.
create or replace function private.teaches_class_group(uid uuid, gid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.class_groups cg
    join public.class_teachers ct on ct.class_id = cg.class_id
    where cg.id = gid and ct.teacher_id = uid
  );
$$;
revoke execute on function private.teaches_class_group(uuid, uuid) from public;
grant execute on function private.teaches_class_group(uuid, uuid) to authenticated;

-- ── class_groups policies ───────────────────────────────────────────
create policy "class_groups_select_teacher_or_admin"
  on public.class_groups for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_class((select auth.uid()), class_id)
  );
create policy "class_groups_insert_teacher_or_admin"
  on public.class_groups for insert to authenticated
  with check (
    (
      private.has_role((select auth.uid()), 'admin')
      or private.teaches_class((select auth.uid()), class_id)
    )
    -- Author pinning (Phase-3 rider precedent): a forged created_by would
    -- otherwise hand off rights wherever authorship is read.
    and created_by = (select auth.uid())
  );
create policy "class_groups_update_teacher_or_admin"
  on public.class_groups for update to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_class((select auth.uid()), class_id)
  )
  with check (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_class((select auth.uid()), class_id)
  );
create policy "class_groups_delete_teacher_or_admin"
  on public.class_groups for delete to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_class((select auth.uid()), class_id)
  );

-- ── class_group_members policies (the double bind) ──────────────────
create policy "class_group_members_select_teacher_or_admin"
  on public.class_group_members for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_class_group((select auth.uid()), group_id)
  );
create policy "class_group_members_insert_teacher_or_admin"
  on public.class_group_members for insert to authenticated
  with check (
    private.has_role((select auth.uid()), 'admin')
    or (
      -- Standing rule 1: the actor is bound to the group AND the pupil is
      -- bound to that group's class. Teaching the class alone must never be
      -- enough to place an arbitrary pupil into a group (Phase-2 C-1).
      private.teaches_class_group((select auth.uid()), group_id)
      and exists (
        select 1
        from public.class_groups cg
        join public.class_students cs on cs.class_id = cg.class_id
        where cg.id = group_id
          and cs.student_id = class_group_members.student_id
          and cs.left_on is null
      )
    )
  );
create policy "class_group_members_delete_teacher_or_admin"
  on public.class_group_members for delete to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_class_group((select auth.uid()), group_id)
  );
```

Note there is deliberately **no UPDATE policy** on `class_group_members`: the table is (group, pupil) and nothing else, so membership changes are insert/delete. The `grant ... update` above is the house firewall shape; with no UPDATE policy, RLS denies every update regardless.

- [ ] **Step 4: Reset and verify pgTAP passes**

```bash
cd /Users/daodilyas/dev/iqra-portal && supabase db reset && supabase test db
```

Expected: `20_class_groups_rls.sql ..... ok` with 14/14, and every other file still ok.

- [ ] **Step 5: Verify the grant firewall still passes**

```bash
cd /Users/daodilyas/dev/iqra-portal && supabase test db 2>&1 | grep -A3 "00_grant_firewall"
```

Expected: `00_grant_firewall.sql ..... ok` — the new tables revoke from `anon` and grant nothing to it.

- [ ] **Step 6: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal && git add supabase/migrations/20260728091000_class_groups.sql supabase/tests/20_class_groups_rls.sql && git commit -m "feat(oppgaver): class group templates with teacher-only walls"
```

---

## Task 3: `assignments` + frozen groups + the `student_in_assignment` pivot

The heart of the phase. `student_in_assignment` answers "is this pupil part of this assignment?" for **both** targeting shapes — group-targeted and class-wide-as-of-`due_on` — so every downstream policy, Storage policy and DAL read asks exactly one question and cannot drift between the two shapes.

**Files:**
- Create: `supabase/migrations/20260728092000_assignments.sql`
- Create: `supabase/tests/21_assignments_rls.sql`

- [ ] **Step 1: Write the failing pgTAP file**

Create `supabase/tests/21_assignments_rls.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- assignments + assignment_groups + assignment_group_members, and the pivot
-- helper student_in_assignment. The two targeting shapes must resolve through
-- ONE question:
--   * group-targeted  -> the pupil has an assignment_group_members row
--   * class-wide      -> no assignment_groups rows exist AND the pupil was on
--                        the class roster AS OF due_on (left_on exclusive)
-- The sharp case this file pins: a pupil who IS on the class roster but is NOT
-- in any of a group-targeted assignment's groups must be OUT. Getting that
-- backwards would hand every classmate access to another group's work.

delete from public.assignment_group_members;
delete from public.assignment_groups;
delete from public.assignments;
delete from public.class_group_members;
delete from public.class_groups;
delete from public.class_students;
delete from public.class_subjects;
delete from public.class_teachers;
delete from public.guardian_student;
delete from public.students;
delete from public.classes;
delete from public.subjects;
delete from public.terms;

insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.email, '{"provider":"email","providers":["email"]}',
       jsonb_build_object('full_name', u.full_name), now(), now()
from (values
  ('b9000000-0000-0000-0000-000000000001'::uuid, 'pgtap-as-admin@test.local',    'AS Admin'),
  ('b9000000-0000-0000-0000-000000000002'::uuid, 'pgtap-as-laerer1@test.local',  'AS Lærer En'),
  ('b9000000-0000-0000-0000-000000000003'::uuid, 'pgtap-as-laerer2@test.local',  'AS Lærer To'),
  ('b9000000-0000-0000-0000-000000000004'::uuid, 'pgtap-as-forelderA@test.local','AS Forelder A'),
  ('b9000000-0000-0000-0000-000000000005'::uuid, 'pgtap-as-forelderB@test.local','AS Forelder B'),
  ('b9000000-0000-0000-0000-000000000006'::uuid, 'pgtap-as-elev@test.local',     'AS Elev'),
  ('b9000000-0000-0000-0000-000000000007'::uuid, 'pgtap-as-okonomi@test.local',  'AS Økonomi')
) as u(id, email, full_name);
insert into public.user_roles (user_id, role) values
  ('b9000000-0000-0000-0000-000000000001', 'admin'),
  ('b9000000-0000-0000-0000-000000000002', 'teacher'),
  ('b9000000-0000-0000-0000-000000000003', 'teacher'),
  ('b9000000-0000-0000-0000-000000000004', 'parent'),
  ('b9000000-0000-0000-0000-000000000005', 'parent'),
  ('b9000000-0000-0000-0000-000000000006', 'student'),
  ('b9000000-0000-0000-0000-000000000007', 'economy');

insert into public.terms (id, name, starts_on, ends_on) values
  ('b9000000-0000-0000-0000-000000000011', 'AS Termin', '2026-08-15', '2026-12-20');
insert into public.classes (id, term_id, name) values
  ('b9000000-0000-0000-0000-000000000021', 'b9000000-0000-0000-0000-000000000011', 'AS Klasse A'),
  ('b9000000-0000-0000-0000-000000000022', 'b9000000-0000-0000-0000-000000000011', 'AS Klasse B');
insert into public.class_teachers (class_id, teacher_id) values
  ('b9000000-0000-0000-0000-000000000021', 'b9000000-0000-0000-0000-000000000002'),
  ('b9000000-0000-0000-0000-000000000022', 'b9000000-0000-0000-0000-000000000003');
insert into public.subjects (id, name) values
  ('b9000000-0000-0000-0000-000000000041', 'AS Fag A');
insert into public.class_subjects (class_id, subject_id) values
  ('b9000000-0000-0000-0000-000000000021', 'b9000000-0000-0000-0000-000000000041');

-- s1 (has a login, child of parentA), s2 (child of parentA), s3 (child of
-- parentB) all in class A. s4 in class B. s5 left class A on 2026-09-01.
insert into public.students (id, first_name, last_name, birth_year, protected, student_user_id) values
  ('b9000000-0000-0000-0000-000000000031', 'AS', 'Elev En',   2014, false, 'b9000000-0000-0000-0000-000000000006'),
  ('b9000000-0000-0000-0000-000000000032', 'AS', 'Elev To',   2015, false, null),
  ('b9000000-0000-0000-0000-000000000033', 'AS', 'Elev Tre',  2015, false, null),
  ('b9000000-0000-0000-0000-000000000034', 'AS', 'Elev Fire', 2015, false, null),
  ('b9000000-0000-0000-0000-000000000035', 'AS', 'Sluttet',   2013, false, null);
insert into public.guardian_student (guardian_id, student_id) values
  ('b9000000-0000-0000-0000-000000000004', 'b9000000-0000-0000-0000-000000000031'),
  ('b9000000-0000-0000-0000-000000000004', 'b9000000-0000-0000-0000-000000000032'),
  ('b9000000-0000-0000-0000-000000000005', 'b9000000-0000-0000-0000-000000000033');
insert into public.class_students (class_id, student_id, enrolled_on, left_on) values
  ('b9000000-0000-0000-0000-000000000021', 'b9000000-0000-0000-0000-000000000031', '2026-08-20', null),
  ('b9000000-0000-0000-0000-000000000021', 'b9000000-0000-0000-0000-000000000032', '2026-08-20', null),
  ('b9000000-0000-0000-0000-000000000021', 'b9000000-0000-0000-0000-000000000033', '2026-08-20', null),
  ('b9000000-0000-0000-0000-000000000022', 'b9000000-0000-0000-0000-000000000034', '2026-08-20', null),
  -- s5 leaves BEFORE the class-wide assignment's due_on (2026-08-28), which
  -- is what makes the as-of-due_on assertion below actually test something.
  ('b9000000-0000-0000-0000-000000000021', 'b9000000-0000-0000-0000-000000000035', '2026-08-20', '2026-08-25');

-- ── Schema shape + helpers ──────────────────────────────────────────
select has_table('public'::name, 'assignments'::name, 'assignments table exists');
select ok((select relrowsecurity from pg_class
           where oid = 'public.assignments'::regclass), 'RLS enabled on assignments');
select has_table('public'::name, 'assignment_groups'::name, 'assignment_groups table exists');
select has_table('public'::name, 'assignment_group_members'::name,
  'assignment_group_members table exists');
select has_function('private'::name, 'teaches_assignment'::name,
  array['uuid', 'uuid'], 'private.teaches_assignment(uuid,uuid) exists');
select has_function('private'::name, 'student_in_assignment'::name,
  array['uuid', 'uuid'], 'private.student_in_assignment(uuid,uuid) exists');
select has_function('private'::name, 'guardian_sees_assignment'::name,
  array['uuid', 'uuid'], 'private.guardian_sees_assignment(uuid,uuid) exists');
select has_function('private'::name, 'student_sees_assignment'::name,
  array['uuid', 'uuid'], 'private.student_sees_assignment(uuid,uuid) exists');

-- ── INSERT: the class's teacher creates both shapes ─────────────────
select set_config('request.jwt.claims',
  '{"sub":"b9000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.assignments
       (id, class_id, subject_id, title, instructions, due_on, submission_type, created_by)
     values ('b9000000-0000-0000-0000-000000000051',
             'b9000000-0000-0000-0000-000000000021',
             'b9000000-0000-0000-0000-000000000041',
             'AS Klasseoppgave', 'Skriv alfabetet.', '2026-08-28', 'digital',
             'b9000000-0000-0000-0000-000000000002') $$,
  'the class teacher creates a class-wide assignment');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b9000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.assignments
       (class_id, subject_id, title, due_on, submission_type, created_by)
     values ('b9000000-0000-0000-0000-000000000021',
             'b9000000-0000-0000-0000-000000000041',
             'AS Kapret oppgave', '2026-08-28', 'digital',
             'b9000000-0000-0000-0000-000000000003') $$,
  '42501', null,
  'fine-derived #4: a foreign teacher cannot create assignments in the class');
reset role;

-- Group-targeted assignment: only s1 + s2 are in the frozen group; s3 is on
-- the class roster but in NO group.
select set_config('request.jwt.claims',
  '{"sub":"b9000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.assignments
       (id, class_id, subject_id, title, due_on, submission_type, created_by)
     values ('b9000000-0000-0000-0000-000000000052',
             'b9000000-0000-0000-0000-000000000021',
             'b9000000-0000-0000-0000-000000000041',
             'AS Gruppeoppgave', '2026-08-29', 'digital',
             'b9000000-0000-0000-0000-000000000002');
     insert into public.assignment_groups (id, assignment_id, name, source_group_id)
     values ('b9000000-0000-0000-0000-000000000061',
             'b9000000-0000-0000-0000-000000000052', 'Halaqa A', null);
     insert into public.assignment_group_members (assignment_group_id, student_id) values
       ('b9000000-0000-0000-0000-000000000061', 'b9000000-0000-0000-0000-000000000031'),
       ('b9000000-0000-0000-0000-000000000061', 'b9000000-0000-0000-0000-000000000032') $$,
  'the teacher creates a group-targeted assignment and freezes its members');
reset role;

-- ── The pivot: student_in_assignment across both shapes ─────────────
select ok(
  private.student_in_assignment('b9000000-0000-0000-0000-000000000033',
                                'b9000000-0000-0000-0000-000000000051'),
  'class-wide: a rostered pupil is in the assignment');
select ok(
  not private.student_in_assignment('b9000000-0000-0000-0000-000000000034',
                                    'b9000000-0000-0000-0000-000000000051'),
  'class-wide: a pupil of another class is out');
select ok(
  not private.student_in_assignment('b9000000-0000-0000-0000-000000000035',
                                    'b9000000-0000-0000-0000-000000000051'),
  'class-wide is AS OF due_on: a pupil who left before the due date is out');
select ok(
  private.student_in_assignment('b9000000-0000-0000-0000-000000000031',
                                'b9000000-0000-0000-0000-000000000052'),
  'group-targeted: a frozen group member is in');
select ok(
  not private.student_in_assignment('b9000000-0000-0000-0000-000000000033',
                                    'b9000000-0000-0000-0000-000000000052'),
  '★ group-targeted: a classmate in NO group is OUT (class membership is not enough)');

-- ── SELECT matrix ───────────────────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"b9000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.assignments), 1::bigint,
  'parentB sees only the class-wide assignment: their child is in no group');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b9000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.assignments), 2::bigint,
  'the pupil login sees both: rostered for one, grouped into the other');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b9000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.assignments), 0::bigint,
  'economy sees no assignments');
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /Users/daodilyas/dev/iqra-portal && supabase test db
```

Expected: FAIL — `21_assignments_rls.sql` errors on the missing `assignment_group_members` table.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260728092000_assignments.sql`:

```sql
-- Assignments (lekser & oppgaver) and their FROZEN group targeting (D1).
--
-- Two targeting shapes, one question. A class-wide assignment creates NO
-- assignment_groups rows at all and its roster is the class roster AS OF
-- due_on; a group-targeted assignment carries one or more assignment_groups
-- whose membership was COPIED from a class_groups template at creation time.
-- private.student_in_assignment resolves both, so every downstream policy,
-- Storage policy and DAL read asks the same thing and the two shapes cannot
-- drift apart.
--
-- class_id is `on delete restrict`, NOT cascade — deliberately unlike
-- tests.class_id. An assignment accumulates pupil hand-ins and Storage
-- objects; deleting the class must fail loudly (23503) rather than quietly
-- shredding a term of children's work and orphaning the files behind it.
--
-- source_group_id is PROVENANCE ONLY (nullable, on delete set null): it lets
-- the UI say "fra Halaqa A" and nothing reads it for access control.
-- assignment_group_members is the sole authority on who is in a group.
--
-- No audit trigger on assignments/assignment_groups (teacher-managed school
-- structure, the lessons/tests precedent); assignment_group_members DOES get
-- one — it decides which children can reach a shared hand-in.

-- ── assignments ─────────────────────────────────────────────────────
create table public.assignments (
  id              uuid primary key default gen_random_uuid(),
  class_id        uuid not null references public.classes (id) on delete restrict,
  subject_id      uuid not null references public.subjects (id) on delete restrict,
  title           text not null check (char_length(title) between 1 and 120),
  instructions    text check (instructions is null or char_length(instructions) <= 4000),
  due_on          date not null,
  submission_type text not null default 'digital'
                  check (submission_type in ('digital', 'none')),
  created_by      uuid not null references public.profiles (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table public.assignments is
  'Lekser & oppgaver (D8: status is DERIVED from due_on + submission + review, never stored — no auto-zero, no stored "missing" flag). class_id is restrict, not cascade: an assignment carries pupil hand-ins and Storage objects, so deleting its class must fail loudly instead of shredding history.';
comment on column public.assignments.submission_type is
  '''digital'' = pupils hand in through the portal; ''none'' = done on paper / in class, the assignment is a notice with a due date.';

create trigger assignments_set_updated_at
  before update on public.assignments
  for each row execute function private.set_updated_at();

revoke all on table public.assignments from anon, authenticated, service_role;
grant select, insert, update, delete on public.assignments to authenticated;
grant select, delete on public.assignments to service_role;

alter table public.assignments enable row level security;

-- ── assignment_groups ───────────────────────────────────────────────
create table public.assignment_groups (
  id              uuid primary key default gen_random_uuid(),
  assignment_id   uuid not null references public.assignments (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 60),
  source_group_id uuid references public.class_groups (id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint assignment_groups_name_unique unique (assignment_id, name)
);
comment on table public.assignment_groups is
  'The FROZEN copy of a class_groups template onto one assignment (D1). Its existence is also the targeting switch: zero rows for an assignment means class-wide.';
comment on column public.assignment_groups.source_group_id is
  'Provenance only — lets the UI say "fra Halaqa A". Nullable and set null on delete; NOTHING reads it for access control. assignment_group_members is the sole authority on membership.';

revoke all on table public.assignment_groups from anon, authenticated, service_role;
-- No `update`: the frozen copy is immutable by design (see the policy note).
grant select, insert, delete on public.assignment_groups to authenticated;
grant select, delete on public.assignment_groups to service_role;

alter table public.assignment_groups enable row level security;

-- ── assignment_group_members ────────────────────────────────────────
create table public.assignment_group_members (
  assignment_group_id uuid not null references public.assignment_groups (id) on delete cascade,
  student_id          uuid not null references public.students (id) on delete cascade,
  created_at          timestamptz not null default now(),
  primary key (assignment_group_id, student_id)
);
comment on table public.assignment_group_members is
  'Frozen group membership — the authority on who may reach a group''s shared hand-in, hence the audit trigger (unlike the class_group_members draft). A pupil who later leaves the school KEEPS their row: history survives, matching the teaches_lesson precedent. students.protected still governs teacher reach through the *_unprotected helper family.';

create trigger assignment_group_members_audit
  after insert or update or delete on public.assignment_group_members
  for each row execute function private.audit_row_change('assignment_group_id', 'student_id');

revoke all on table public.assignment_group_members from anon, authenticated, service_role;
grant select, insert, update, delete on public.assignment_group_members to authenticated;
grant select, delete on public.assignment_group_members to service_role;

alter table public.assignment_group_members enable row level security;

-- ── Helpers ─────────────────────────────────────────────────────────
create or replace function private.teaches_assignment(uid uuid, aid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.assignments a
    join public.class_teachers ct on ct.class_id = a.class_id
    where a.id = aid and ct.teacher_id = uid
  );
$$;
revoke execute on function private.teaches_assignment(uuid, uuid) from public;
grant execute on function private.teaches_assignment(uuid, uuid) to authenticated;

-- ★ THE PIVOT. Group-targeted assignments resolve through the frozen member
-- rows; class-wide ones (no assignment_groups at all) resolve through the
-- class roster AS OF due_on, left_on exclusive — the same interval idiom as
-- student_in_test_class. The `not exists` guard is what makes a classmate who
-- is in no group come out FALSE for a group-targeted assignment: without it,
-- class membership would silently grant reach into another group's work.
create or replace function private.student_in_assignment(sid uuid, aid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.assignment_groups ag
    join public.assignment_group_members agm on agm.assignment_group_id = ag.id
    where ag.assignment_id = aid and agm.student_id = sid
  ) or (
    not exists (select 1 from public.assignment_groups where assignment_id = aid)
    and exists (
      select 1
      from public.assignments a
      join public.class_students cs on cs.class_id = a.class_id
      where a.id = aid
        and cs.student_id = sid
        and cs.enrolled_on <= a.due_on
        and (cs.left_on is null or a.due_on < cs.left_on)
    )
  );
$$;
revoke execute on function private.student_in_assignment(uuid, uuid) from public;
grant execute on function private.student_in_assignment(uuid, uuid) to authenticated;

create or replace function private.guardian_sees_assignment(uid uuid, aid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.guardian_student gs
    where gs.guardian_id = uid
      and private.student_in_assignment(gs.student_id, aid)
  );
$$;
revoke execute on function private.guardian_sees_assignment(uuid, uuid) from public;
grant execute on function private.guardian_sees_assignment(uuid, uuid) to authenticated;

create or replace function private.student_sees_assignment(uid uuid, aid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.students s
    where s.student_user_id = uid
      and private.student_in_assignment(s.id, aid)
  );
$$;
revoke execute on function private.student_sees_assignment(uuid, uuid) from public;
grant execute on function private.student_sees_assignment(uuid, uuid) to authenticated;

-- ── assignments policies ────────────────────────────────────────────
create policy "assignments_select_related"
  on public.assignments for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_class((select auth.uid()), class_id)
    or private.guardian_sees_assignment((select auth.uid()), id)
    or private.student_sees_assignment((select auth.uid()), id)
  );
create policy "assignments_insert_teacher_or_admin"
  on public.assignments for insert to authenticated
  with check (
    (
      private.has_role((select auth.uid()), 'admin')
      or private.teaches_class((select auth.uid()), class_id)
    )
    and created_by = (select auth.uid())
  );
create policy "assignments_update_teacher_or_admin"
  on public.assignments for update to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_assignment((select auth.uid()), id)
  )
  with check (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_assignment((select auth.uid()), id)
  );
-- DELETE stays admin-only across this phase: a mis-created assignment is
-- edited, not destroyed, once pupils may have handed in against it.
create policy "assignments_delete_admin"
  on public.assignments for delete to authenticated
  using (private.has_role((select auth.uid()), 'admin'));

-- ── assignment_groups policies ──────────────────────────────────────
-- Pupils and guardians DO read group rows (unlike class_groups templates):
-- the pupil surface shows "du er i gruppe Halaqa A med …", which is the point
-- of group work. They read only groups of assignments they are part of.
create policy "assignment_groups_select_related"
  on public.assignment_groups for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_assignment((select auth.uid()), assignment_id)
    or private.guardian_sees_assignment((select auth.uid()), assignment_id)
    or private.student_sees_assignment((select auth.uid()), assignment_id)
  );
create policy "assignment_groups_insert_teacher_or_admin"
  on public.assignment_groups for insert to authenticated
  with check (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_assignment((select auth.uid()), assignment_id)
  );
-- NO UPDATE policy, and no `update` in the grant above. This is D1 enforced
-- rather than merely intended: an updatable assignment_id lets a teacher of
-- two classes re-point a frozen group at the OTHER class's assignment and
-- carry its whole pupil set across — and since student_in_assignment is the
-- single question every downstream policy asks, that reaches the shared
-- hand-in and its Storage objects too. Nothing in Phase 4 ever updates this
-- table (Task 8 inserts, Task 9 creates fresh, Task 12 renames class_groups
-- templates instead), so removing it is pure subtraction. Consequence,
-- accepted: a mis-targeted assignment is discarded and re-created
-- (discard_empty_assignment, Task 9), never repaired in place.
create policy "assignment_groups_delete_admin"
  on public.assignment_groups for delete to authenticated
  using (private.has_role((select auth.uid()), 'admin'));

-- ── assignment_group_members policies ───────────────────────────────
create or replace function private.teaches_assignment_group(uid uuid, agid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.assignment_groups ag
    join public.assignments a on a.id = ag.assignment_id
    join public.class_teachers ct on ct.class_id = a.class_id
    where ag.id = agid and ct.teacher_id = uid
  );
$$;
revoke execute on function private.teaches_assignment_group(uuid, uuid) from public;
grant execute on function private.teaches_assignment_group(uuid, uuid) to authenticated;

create policy "assignment_group_members_select_related"
  on public.assignment_group_members for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_assignment_group((select auth.uid()), assignment_group_id)
    or exists (
      select 1
      from public.assignment_groups ag
      where ag.id = assignment_group_members.assignment_group_id
        and (
          private.guardian_sees_assignment((select auth.uid()), ag.assignment_id)
          or private.student_sees_assignment((select auth.uid()), ag.assignment_id)
        )
    )
  );
create policy "assignment_group_members_insert_teacher_or_admin"
  on public.assignment_group_members for insert to authenticated
  with check (
    private.has_role((select auth.uid()), 'admin')
    or (
      -- Double bind: the actor teaches this group's assignment AND the pupil
      -- is on that assignment's class roster as of due_on.
      private.teaches_assignment_group((select auth.uid()), assignment_group_id)
      and exists (
        select 1
        from public.assignment_groups ag
        join public.assignments a on a.id = ag.assignment_id
        join public.class_students cs on cs.class_id = a.class_id
        where ag.id = assignment_group_members.assignment_group_id
          and cs.student_id = assignment_group_members.student_id
          and cs.enrolled_on <= a.due_on
          and (cs.left_on is null or a.due_on < cs.left_on)
      )
    )
  );
create policy "assignment_group_members_delete_teacher_or_admin"
  on public.assignment_group_members for delete to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_assignment_group((select auth.uid()), assignment_group_id)
  );
```

**Why `guardian_sees_assignment` may call `student_in_assignment`:** both are SECURITY DEFINER in `private` with `set search_path = ''`, and the inner one is created earlier in the same file, so the catalog check at CREATE FUNCTION time passes. Keeping the pivot in exactly one place is the whole design.

- [ ] **Step 4: Reset and verify pgTAP passes**

```bash
cd /Users/daodilyas/dev/iqra-portal && supabase db reset && supabase test db
```

Expected: `21_assignments_rls.sql ..... ok` with 18/18. Pay attention to the starred test — `group-targeted: a classmate in NO group is OUT` is the one that proves the `not exists` guard.

- [ ] **Step 5: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal && git add supabase/migrations/20260728092000_assignments.sql supabase/tests/21_assignments_rls.sql && git commit -m "feat(oppgaver): assignments with frozen group targeting and the student_in_assignment pivot"
```

---
## Task 4: `submissions` (XOR) + `assignment_reviews` — the double bind and per-pupil review

D3 + D9. One `submissions` row per hand-in, individual **or** group, enforced by a CHECK. `assignment_reviews` is always `(assignment_id, student_id)` — so a shared group hand-in still produces a mark per child, which is what keeps "parent A ↛ child B" intact exactly where a shared artefact would otherwise leak it.

**Decision made (raised by Task 3's review, settled at planning time):** add a **submission-based retention branch** to `private.student_in_assignment`, via `create or replace` **in this task's migration** — the pivot lives in Task 3's migration but cannot reference `submissions` there, so replacing it after the table exists is the correct sequencing. The branch is `exists (select 1 from public.submissions s where s.assignment_id = aid and s.student_id = sid)`. It is strictly additive and cannot bootstrap access: writing the first submission still requires `can_write_submission`, which requires the pivot to be true already by roster or group membership. Group hand-ins carry `student_id = null`, so they are covered by the membership branch, not here. The reasoning below is why: `guardian_sees_test`/`student_sees_test` each begin with "a result row exists for my child", so access survives an enrolment change. Here, because `due_on` is mutable and the class-wide roster is *derived* from it, a teacher editing a due date past a pupil's `left_on` silently revokes that pupil's access to work they already handed in — their own submission becomes unreadable to them. Now that `submissions` exists, decide explicitly: either add an `exists (select 1 from public.submissions …)` branch to the pivot mirroring the Phase-3 precedent, or accept the revocation and document why. Do not leave it undecided — a pupil losing sight of their own hand-in is a real user-visible failure, and the Phase-3 precedent says the answer is retention.

**Files:**
- Create: `supabase/migrations/20260728093000_submissions_reviews.sql`
- Create: `supabase/tests/22_submissions_rls.sql`

- [ ] **Step 1: Write the failing pgTAP file**

Create `supabase/tests/22_submissions_rls.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- submissions + assignment_reviews (D3, D8, D9).
--
-- The three walls this file exists to pin:
--  1. XOR (D9) — a submission belongs to a pupil or to a group, never both,
--     never neither. Unrepresentable, not merely discouraged.
--  2. The group double bind — being in SOME group of an assignment must never
--     authorise writing ANOTHER group's row. This is the Phase-2 C-1 lesson
--     transposed from classes to groups.
--  3. ★ Per-pupil review across a shared hand-in — the guardian of group
--     member A must not reach the review of group member B, even though both
--     children touch the same submissions row. This is the sharpest
--     consequence of D3 and the single most important test in the phase.

delete from public.assignment_reviews;
delete from public.submissions;
delete from public.assignment_group_members;
delete from public.assignment_groups;
delete from public.assignments;
delete from public.class_group_members;
delete from public.class_groups;
delete from public.class_students;
delete from public.class_subjects;
delete from public.class_teachers;
delete from public.guardian_student;
delete from public.students;
delete from public.classes;
delete from public.subjects;
delete from public.terms;

insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.email, '{"provider":"email","providers":["email"]}',
       jsonb_build_object('full_name', u.full_name), now(), now()
from (values
  ('ba000000-0000-0000-0000-000000000001'::uuid, 'pgtap-sb-admin@test.local',    'SB Admin'),
  ('ba000000-0000-0000-0000-000000000002'::uuid, 'pgtap-sb-laerer1@test.local',  'SB Lærer En'),
  ('ba000000-0000-0000-0000-000000000003'::uuid, 'pgtap-sb-laerer2@test.local',  'SB Lærer To'),
  ('ba000000-0000-0000-0000-000000000004'::uuid, 'pgtap-sb-forelderA@test.local','SB Forelder A'),
  ('ba000000-0000-0000-0000-000000000005'::uuid, 'pgtap-sb-forelderB@test.local','SB Forelder B'),
  ('ba000000-0000-0000-0000-000000000006'::uuid, 'pgtap-sb-elev@test.local',     'SB Elev'),
  ('ba000000-0000-0000-0000-000000000007'::uuid, 'pgtap-sb-okonomi@test.local',  'SB Økonomi')
) as u(id, email, full_name);
insert into public.user_roles (user_id, role) values
  ('ba000000-0000-0000-0000-000000000001', 'admin'),
  ('ba000000-0000-0000-0000-000000000002', 'teacher'),
  ('ba000000-0000-0000-0000-000000000003', 'teacher'),
  ('ba000000-0000-0000-0000-000000000004', 'parent'),
  ('ba000000-0000-0000-0000-000000000005', 'parent'),
  ('ba000000-0000-0000-0000-000000000006', 'student'),
  ('ba000000-0000-0000-0000-000000000007', 'economy');

insert into public.terms (id, name, starts_on, ends_on) values
  ('ba000000-0000-0000-0000-000000000011', 'SB Termin', '2026-08-15', '2026-12-20');
insert into public.classes (id, term_id, name) values
  ('ba000000-0000-0000-0000-000000000021', 'ba000000-0000-0000-0000-000000000011', 'SB Klasse A');
insert into public.class_teachers (class_id, teacher_id) values
  ('ba000000-0000-0000-0000-000000000021', 'ba000000-0000-0000-0000-000000000002');
insert into public.subjects (id, name) values
  ('ba000000-0000-0000-0000-000000000041', 'SB Fag A');
insert into public.class_subjects (class_id, subject_id) values
  ('ba000000-0000-0000-0000-000000000021', 'ba000000-0000-0000-0000-000000000041');

-- s1 (login, parentA), s2 (parentA), s3 (parentB), s4 (parentB), s5 (parentA,
-- deliberately in NO group). Groups G1 = {s1, s3} MIXES the two families —
-- that is what makes the per-pupil review test meaningful. G2 = {s2, s4}.
insert into public.students (id, first_name, last_name, birth_year, protected, student_user_id) values
  ('ba000000-0000-0000-0000-000000000031', 'SB', 'Elev En',   2014, false, 'ba000000-0000-0000-0000-000000000006'),
  ('ba000000-0000-0000-0000-000000000032', 'SB', 'Elev To',   2015, false, null),
  ('ba000000-0000-0000-0000-000000000033', 'SB', 'Elev Tre',  2015, false, null),
  ('ba000000-0000-0000-0000-000000000034', 'SB', 'Elev Fire', 2015, false, null),
  ('ba000000-0000-0000-0000-000000000035', 'SB', 'Elev Fem',  2015, false, null);
insert into public.guardian_student (guardian_id, student_id) values
  ('ba000000-0000-0000-0000-000000000004', 'ba000000-0000-0000-0000-000000000031'),
  ('ba000000-0000-0000-0000-000000000004', 'ba000000-0000-0000-0000-000000000032'),
  ('ba000000-0000-0000-0000-000000000004', 'ba000000-0000-0000-0000-000000000035'),
  ('ba000000-0000-0000-0000-000000000005', 'ba000000-0000-0000-0000-000000000033'),
  ('ba000000-0000-0000-0000-000000000005', 'ba000000-0000-0000-0000-000000000034');
insert into public.class_students (class_id, student_id, enrolled_on) values
  ('ba000000-0000-0000-0000-000000000021', 'ba000000-0000-0000-0000-000000000031', '2026-08-20'),
  ('ba000000-0000-0000-0000-000000000021', 'ba000000-0000-0000-0000-000000000032', '2026-08-20'),
  ('ba000000-0000-0000-0000-000000000021', 'ba000000-0000-0000-0000-000000000033', '2026-08-20'),
  ('ba000000-0000-0000-0000-000000000021', 'ba000000-0000-0000-0000-000000000034', '2026-08-20'),
  ('ba000000-0000-0000-0000-000000000021', 'ba000000-0000-0000-0000-000000000035', '2026-08-20');

-- ACW = class-wide, AG = group-targeted with G1 and G2.
insert into public.assignments
  (id, class_id, subject_id, title, due_on, submission_type, created_by) values
  ('ba000000-0000-0000-0000-000000000051', 'ba000000-0000-0000-0000-000000000021',
   'ba000000-0000-0000-0000-000000000041', 'SB Klasseoppgave', '2026-08-28', 'digital',
   'ba000000-0000-0000-0000-000000000002'),
  ('ba000000-0000-0000-0000-000000000052', 'ba000000-0000-0000-0000-000000000021',
   'ba000000-0000-0000-0000-000000000041', 'SB Gruppeoppgave', '2026-08-29', 'digital',
   'ba000000-0000-0000-0000-000000000002');
insert into public.assignment_groups (id, assignment_id, name) values
  ('ba000000-0000-0000-0000-000000000061', 'ba000000-0000-0000-0000-000000000052', 'Halaqa A'),
  ('ba000000-0000-0000-0000-000000000062', 'ba000000-0000-0000-0000-000000000052', 'Halaqa B');
insert into public.assignment_group_members (assignment_group_id, student_id) values
  ('ba000000-0000-0000-0000-000000000061', 'ba000000-0000-0000-0000-000000000031'),
  ('ba000000-0000-0000-0000-000000000061', 'ba000000-0000-0000-0000-000000000033'),
  ('ba000000-0000-0000-0000-000000000062', 'ba000000-0000-0000-0000-000000000032'),
  ('ba000000-0000-0000-0000-000000000062', 'ba000000-0000-0000-0000-000000000034');

-- ── Schema shape ────────────────────────────────────────────────────
select has_table('public'::name, 'submissions'::name, 'submissions table exists');
select ok((select relrowsecurity from pg_class
           where oid = 'public.submissions'::regclass), 'RLS enabled on submissions');
select has_table('public'::name, 'assignment_reviews'::name, 'assignment_reviews table exists');
select ok((select relrowsecurity from pg_class
           where oid = 'public.assignment_reviews'::regclass),
          'RLS enabled on assignment_reviews');
select has_function('private'::name, 'can_write_submission'::name,
  array['uuid', 'uuid', 'uuid', 'uuid'],
  'private.can_write_submission(uuid,uuid,uuid,uuid) exists');

-- ── D9: the XOR is unrepresentable, not merely discouraged ──────────
select throws_ok(
  $$ insert into public.submissions (assignment_id, submitted_by)
     values ('ba000000-0000-0000-0000-000000000051',
             'ba000000-0000-0000-0000-000000000006') $$,
  '23514', null,
  'D9: a submission belonging to NEITHER a pupil nor a group is rejected');

select throws_ok(
  $$ insert into public.submissions
       (assignment_id, student_id, assignment_group_id, submitted_by)
     values ('ba000000-0000-0000-0000-000000000052',
             'ba000000-0000-0000-0000-000000000031',
             'ba000000-0000-0000-0000-000000000061',
             'ba000000-0000-0000-0000-000000000006') $$,
  '23514', null,
  'D9: a submission belonging to BOTH a pupil and a group is rejected');

-- ── Individual hand-in: the double bind ─────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"ba000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.submissions (id, assignment_id, student_id, body, submitted_by)
     values ('ba000000-0000-0000-0000-000000000071',
             'ba000000-0000-0000-0000-000000000051',
             'ba000000-0000-0000-0000-000000000031',
             'Levert av eleven selv.', 'ba000000-0000-0000-0000-000000000006') $$,
  'the pupil hands in their own work');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"ba000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.submissions (assignment_id, student_id, body, submitted_by)
     values ('ba000000-0000-0000-0000-000000000051',
             'ba000000-0000-0000-0000-000000000033',
             'Levert på vegne av en annen elev.',
             'ba000000-0000-0000-0000-000000000006') $$,
  '42501', null,
  'a pupil cannot hand in under another pupil''s name');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"ba000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.submissions (id, assignment_id, student_id, body, submitted_by)
     values ('ba000000-0000-0000-0000-000000000072',
             'ba000000-0000-0000-0000-000000000051',
             'ba000000-0000-0000-0000-000000000032',
             'Levert av forelder på vegne av barnet.',
             'ba000000-0000-0000-0000-000000000004') $$,
  'a guardian hands in on behalf of their own child');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"ba000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.submissions (assignment_id, student_id, body, submitted_by)
     values ('ba000000-0000-0000-0000-000000000051',
             'ba000000-0000-0000-0000-000000000035',
             'Forfalsket avsender.',
             'ba000000-0000-0000-0000-000000000002') $$,
  '42501', null,
  'author pinning: submitted_by must be the caller');
reset role;

-- ── Group hand-in: membership of THIS group, not merely of the
--    assignment (the C-1 lesson transposed) ──────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"ba000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.submissions
       (id, assignment_id, assignment_group_id, body, submitted_by)
     values ('ba000000-0000-0000-0000-000000000073',
             'ba000000-0000-0000-0000-000000000052',
             'ba000000-0000-0000-0000-000000000061',
             'Felles innlevering fra Halaqa A.',
             'ba000000-0000-0000-0000-000000000006') $$,
  'a group member hands in for their OWN group');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"ba000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.submissions
       (assignment_id, assignment_group_id, body, submitted_by)
     values ('ba000000-0000-0000-0000-000000000052',
             'ba000000-0000-0000-0000-000000000062',
             'Kapret annen gruppes innlevering.',
             'ba000000-0000-0000-0000-000000000006') $$,
  '42501', null,
  '★ a member of group A cannot hand in for group B on the same assignment');
reset role;

-- ── Reviews: teacher double bind + author pinning ───────────────────
select set_config('request.jwt.claims',
  '{"sub":"ba000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.assignment_reviews
       (assignment_id, student_id, status, points, feedback, reviewed_by) values
       ('ba000000-0000-0000-0000-000000000052', 'ba000000-0000-0000-0000-000000000031',
        'godkjent', 9, 'God presentasjon.', 'ba000000-0000-0000-0000-000000000002'),
       ('ba000000-0000-0000-0000-000000000052', 'ba000000-0000-0000-0000-000000000033',
        'ny_innlevering', 4, 'Mangler kilder.', 'ba000000-0000-0000-0000-000000000002') $$,
  'D3: the teacher reviews EACH pupil of the shared group hand-in separately');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"ba000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.assignment_reviews
       (assignment_id, student_id, status, reviewed_by)
     values ('ba000000-0000-0000-0000-000000000052',
             'ba000000-0000-0000-0000-000000000035', 'godkjent',
             'ba000000-0000-0000-0000-000000000002') $$,
  '42501', null,
  'the pivot at the write wall: a classmate in no group cannot be reviewed');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"ba000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.assignment_reviews
       (assignment_id, student_id, status, reviewed_by)
     values ('ba000000-0000-0000-0000-000000000051',
             'ba000000-0000-0000-0000-000000000031', 'godkjent',
             'ba000000-0000-0000-0000-000000000003') $$,
  '42501', null,
  'a foreign teacher cannot review');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"ba000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.assignment_reviews
       (assignment_id, student_id, status, reviewed_by)
     values ('ba000000-0000-0000-0000-000000000051',
             'ba000000-0000-0000-0000-000000000031', 'godkjent',
             'ba000000-0000-0000-0000-000000000001') $$,
  '42501', null,
  'review author pinning: reviewed_by must be the caller');
reset role;

-- ── ★ The phase's sharpest rule: per-pupil review across a shared
--    hand-in. parentA and parentB EACH have a child in Halaqa A. ─────
select set_config('request.jwt.claims',
  '{"sub":"ba000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.assignment_reviews
           where assignment_id = 'ba000000-0000-0000-0000-000000000052'), 1::bigint,
  '★ parentA sees exactly ONE review of the shared group task');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"ba000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select is((select student_id from public.assignment_reviews
           where assignment_id = 'ba000000-0000-0000-0000-000000000052'),
          'ba000000-0000-0000-0000-000000000031'::uuid,
  '★ and it is their OWN child''s — never the group-mate''s from another family');
reset role;

-- ── Shared submission IS shared; reviews are not ────────────────────
select set_config('request.jwt.claims',
  '{"sub":"ba000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.submissions
           where assignment_id = 'ba000000-0000-0000-0000-000000000052'), 1::bigint,
  'parentB reads the shared hand-in their child is part of');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"ba000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.submissions), 3::bigint,
  'the pupil login reads own individual hand-in, the sibling-family group one it is in, and the guardian-made one for its sibling');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"ba000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.submissions), 0::bigint,
  'economy reads no hand-ins');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"ba000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.assignment_reviews), 0::bigint,
  'economy reads no reviews');
reset role;

-- ── Audit trigger (student data) ────────────────────────────────────
select is(
  (select count(*) from public.audit_log
   where action = 'submissions.insert'
     and actor_id = 'ba000000-0000-0000-0000-000000000006'
     and entity_id = 'ba000000-0000-0000-0000-000000000051'),
  1::bigint,
  'submissions.insert audit: actor pinned to the handing-in pupil');

select * from finish();
rollback;
```

**Note on the pupil-login count of 3:** `elev` is `s1`. It reads its own individual hand-in on ACW, the shared Halaqa A hand-in (it is a member), and — because `submissions_select_related` grants pupils only their own rows — *not* `s2`'s. Verify against the actual policy when the test runs; if the count differs, the policy is wrong, not the test. The three rows the pupil must see are `…071` (own), `…073` (own group). The guardian-made row `…072` belongs to `s2` and **must not** be visible to the pupil login. **Set this assertion to `2::bigint`** and word it «the pupil login reads own individual hand-in and its own group's — never a sibling's».

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /Users/daodilyas/dev/iqra-portal && supabase test db
```

Expected: FAIL — `22_submissions_rls.sql` errors on the missing `assignment_reviews` table.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260728093000_submissions_reviews.sql`:

```sql
-- Hand-ins and per-pupil review (D3, D8, D9).
--
-- ONE table serves both hand-in shapes: student_id XOR assignment_group_id,
-- a db CHECK, so "belongs to both" and "belongs to neither" are
-- unrepresentable rather than merely discouraged. Postgres treats NULLs as
-- distinct in unique indexes, so unique (assignment_id, student_id) constrains
-- only individual rows and unique (assignment_id, assignment_group_id) only
-- group rows — each constrains exactly its own kind, which is the intent.
--
-- Review stays keyed (assignment_id, student_id) even when the hand-in is
-- shared (D3). That split is the whole reason group work is safe here: the
-- artefact is shared, the ASSESSMENT is not, so a parent reads their own
-- child's mark and never a group-mate's from another family.
--
-- D8: status is DERIVED (Ikke levert / Levert / Levert etter frist / Vurdert)
-- from due_on + submission + review. There is deliberately no status column
-- and no auto-zero — Classroom's stored "missing" flag with a draft 0 is a
-- documented source of teacher-parent friction and can drift from reality.

-- ── submissions ─────────────────────────────────────────────────────
create table public.submissions (
  id                  uuid primary key default gen_random_uuid(),
  assignment_id       uuid not null references public.assignments (id) on delete cascade,
  student_id          uuid references public.students (id) on delete cascade,
  assignment_group_id uuid references public.assignment_groups (id) on delete cascade,
  body                text check (body is null or char_length(body) <= 4000),
  submitted_by        uuid not null references public.profiles (id),
  submitted_at        timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint submissions_owner_xor
    check ((student_id is null) <> (assignment_group_id is null)),
  constraint submissions_student_unique unique (assignment_id, student_id),
  constraint submissions_group_unique unique (assignment_id, assignment_group_id)
);
comment on table public.submissions is
  'One hand-in per pupil OR per group (D9 — the XOR CHECK makes the alternative unrepresentable). submitted_by may be the pupil or their guardian (hand-in on behalf), pinned to auth.uid() in the INSERT policy.';

create trigger submissions_set_updated_at
  before update on public.submissions
  for each row execute function private.set_updated_at();

create trigger submissions_audit
  after insert or update or delete on public.submissions
  for each row execute function private.audit_row_change('assignment_id');

revoke all on table public.submissions from anon, authenticated, service_role;
grant select, insert, update, delete on public.submissions to authenticated;
grant select, delete on public.submissions to service_role;

alter table public.submissions enable row level security;

-- ── assignment_reviews ──────────────────────────────────────────────
create table public.assignment_reviews (
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id    uuid not null references public.students (id) on delete cascade,
  status        text not null check (status in ('godkjent', 'ny_innlevering')),
  points        integer check (points is null or points >= 0),
  feedback      text check (feedback is null or char_length(feedback) <= 2000),
  reviewed_by   uuid not null references public.profiles (id),
  reviewed_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (assignment_id, student_id)
);
comment on table public.assignment_reviews is
  'Per-pupil review (D3) — keyed by pupil even when the hand-in is a shared group row, which is what keeps parent A from reading child B''s mark. points is a free non-negative integer (design spec §10.2): no cap this phase, validated app-side; revisit if teachers ask for a scale.';

create trigger assignment_reviews_set_updated_at
  before update on public.assignment_reviews
  for each row execute function private.set_updated_at();

create trigger assignment_reviews_audit
  after insert or update or delete on public.assignment_reviews
  for each row execute function private.audit_row_change('assignment_id', 'student_id');

revoke all on table public.assignment_reviews from anon, authenticated, service_role;
grant select, insert, update, delete on public.assignment_reviews to authenticated;
grant select, delete on public.assignment_reviews to service_role;

alter table public.assignment_reviews enable row level security;

-- ── The hand-in wall ────────────────────────────────────────────────
-- Standing rule 1 in one function. Individual: the caller is the pupil or
-- their guardian AND that pupil is in the assignment. Group: the caller is a
-- member of THAT SPECIFIC group (or a guardian of one) AND the group belongs
-- to that assignment — being in some other group of the same assignment is
-- explicitly not enough (the Phase-2 C-1 lesson transposed to groups).
create or replace function private.can_write_submission(
  uid uuid, aid uuid, agid uuid, sid uuid
)
returns boolean
language sql stable security definer set search_path = ''
as $$
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
          and ag.assignment_id = aid
          and (
            private.is_linked_student(uid, agm.student_id)
            or private.is_guardian_of(uid, agm.student_id)
          )
      )
    else false
  end;
$$;
revoke execute on function private.can_write_submission(uuid, uuid, uuid, uuid) from public;
grant execute on function private.can_write_submission(uuid, uuid, uuid, uuid) to authenticated;

-- Read side of the same question — used by the SELECT policies here and, in
-- the next migration, by the Storage object policies, so a bucket policy and
-- its table policy cannot drift apart.
create or replace function private.reads_submission(uid uuid, sub_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.submissions s
    where s.id = sub_id
      and (
        private.has_role(uid, 'admin')
        or private.teaches_assignment(uid, s.assignment_id)
        or (
          s.student_id is not null
          and (
            private.is_guardian_of(uid, s.student_id)
            or private.is_linked_student(uid, s.student_id)
          )
        )
        or (
          s.assignment_group_id is not null
          and exists (
            select 1
            from public.assignment_group_members agm
            where agm.assignment_group_id = s.assignment_group_id
              and (
                private.is_guardian_of(uid, agm.student_id)
                or private.is_linked_student(uid, agm.student_id)
              )
          )
        )
      )
  );
$$;
revoke execute on function private.reads_submission(uuid, uuid) from public;
grant execute on function private.reads_submission(uuid, uuid) to authenticated;

-- Write side keyed by an existing submission — "may this caller still change
-- this hand-in?". Locked only when the work is genuinely CLOSED: individually,
-- that pupil is 'godkjent'; for a group, EVERY member is. A single
-- 'ny_innlevering' anywhere in the group re-opens the shared artefact —
-- locking on ANY approval would freeze the very row the teacher just asked a
-- member to redo, which is what that status exists to request. Accepted
-- consequence: re-editing changes work another member may already have had
-- approved; that is inherent to one shared artefact.
create or replace function private.writes_submission(uid uuid, sub_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.submissions s
    where s.id = sub_id
      and private.can_write_submission(uid, s.assignment_id,
                                       s.assignment_group_id, s.student_id)
      and not exists (
        select 1
        from public.assignment_reviews r
        where r.assignment_id = s.assignment_id
          and r.status = 'godkjent'
          and (
            (s.student_id is not null and r.student_id = s.student_id)
            or (
              s.assignment_group_id is not null
              and exists (
                select 1
                from public.assignment_group_members agm
                where agm.assignment_group_id = s.assignment_group_id
                  and agm.student_id = r.student_id
              )
            )
          )
      )
  );
$$;
revoke execute on function private.writes_submission(uuid, uuid) from public;
grant execute on function private.writes_submission(uuid, uuid) to authenticated;

-- ── submissions policies ────────────────────────────────────────────
create policy "submissions_select_related"
  on public.submissions for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_assignment((select auth.uid()), assignment_id)
    or (
      student_id is not null
      and (
        private.is_guardian_of((select auth.uid()), student_id)
        or private.is_linked_student((select auth.uid()), student_id)
      )
    )
    or (
      assignment_group_id is not null
      and exists (
        select 1
        from public.assignment_group_members agm
        where agm.assignment_group_id = submissions.assignment_group_id
          and (
            private.is_guardian_of((select auth.uid()), agm.student_id)
            or private.is_linked_student((select auth.uid()), agm.student_id)
          )
      )
    )
  );
create policy "submissions_insert_pupil_or_guardian"
  on public.submissions for insert to authenticated
  with check (
    private.can_write_submission(
      (select auth.uid()), assignment_id, assignment_group_id, student_id
    )
    and submitted_by = (select auth.uid())
  );
create policy "submissions_update_pupil_or_guardian"
  on public.submissions for update to authenticated
  using (private.writes_submission((select auth.uid()), id))
  with check (
    private.writes_submission((select auth.uid()), id)
    and submitted_by = (select auth.uid())
  );
create policy "submissions_delete_admin"
  on public.submissions for delete to authenticated
  using (private.has_role((select auth.uid()), 'admin'));

-- ── assignment_reviews policies ─────────────────────────────────────
create policy "assignment_reviews_select_related"
  on public.assignment_reviews for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_assignment((select auth.uid()), assignment_id)
    or private.is_guardian_of((select auth.uid()), student_id)
    or private.is_linked_student((select auth.uid()), student_id)
  );
create policy "assignment_reviews_insert_teacher_or_admin"
  on public.assignment_reviews for insert to authenticated
  with check (
    (
      private.has_role((select auth.uid()), 'admin')
      or (
        private.teaches_assignment((select auth.uid()), assignment_id)
        and private.student_in_assignment(student_id, assignment_id)
      )
    )
    and reviewed_by = (select auth.uid())
  );
create policy "assignment_reviews_update_teacher_or_admin"
  on public.assignment_reviews for update to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_assignment((select auth.uid()), assignment_id)
  )
  with check (
    (
      private.has_role((select auth.uid()), 'admin')
      or private.teaches_assignment((select auth.uid()), assignment_id)
    )
    and reviewed_by = (select auth.uid())
  );
create policy "assignment_reviews_delete_admin"
  on public.assignment_reviews for delete to authenticated
  using (private.has_role((select auth.uid()), 'admin'));
```

- [ ] **Step 4: Fix the one assertion flagged in Step 1, then reset and verify**

Change the pupil-login submission count in `22_submissions_rls.sql` to:

```sql
select is((select count(*) from public.submissions), 2::bigint,
  'the pupil login reads own individual hand-in and its own group''s — never a sibling''s');
```

```bash
cd /Users/daodilyas/dev/iqra-portal && supabase db reset && supabase test db
```

Expected: `22_submissions_rls.sql ..... ok` with 22/22.

- [ ] **Step 5: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal && git add supabase/migrations/20260728093000_submissions_reviews.sql supabase/tests/22_submissions_rls.sql && git commit -m "feat(oppgaver): shared hand-ins with per-pupil review and the group double bind"
```

---

## Task 5: Storage buckets, object policies, attachment tables — and the seed

D4 + D6. The third wall. Every `storage.objects` policy resolves its owner from the path's first folder segment and then asks **the same `private` helpers** the table policies ask, so a bucket policy and its table policy cannot drift apart.

**Files:**
- Create: `supabase/migrations/20260728094000_assignment_storage.sql`
- Create: `supabase/tests/23_assignment_storage.sql`
- Modify: `supabase/seed.sql`, `tests/api/access-wall.test.ts`

- [ ] **Step 1: Write the failing pgTAP file**

Create `supabase/tests/23_assignment_storage.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Storage buckets + storage.objects policies (D4, D6) and the two attachment
-- tables. The load-bearing idea: the FIRST folder segment of every object path
-- is its parent's UUID, so a bucket policy resolves ownership with
-- (storage.foldername(name))[1]::uuid and then calls the SAME private helpers
-- the table policies call. One source of truth for "may this person touch this
-- assignment / this hand-in".
--
-- Bucket separation (D6) is what makes a policy bug non-catastrophic: each
-- bucket's policy serves exactly one audience, so a mistake cannot leak
-- ACROSS audiences, and the tightest wall (children's own work) stays isolated.

delete from storage.objects where bucket_id in ('assignments', 'submissions');
delete from public.submission_attachments;
delete from public.assignment_attachments;
delete from public.assignment_reviews;
delete from public.submissions;
delete from public.assignment_group_members;
delete from public.assignment_groups;
delete from public.assignments;
delete from public.class_students;
delete from public.class_subjects;
delete from public.class_teachers;
delete from public.guardian_student;
delete from public.students;
delete from public.classes;
delete from public.subjects;
delete from public.terms;

insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.email, '{"provider":"email","providers":["email"]}',
       jsonb_build_object('full_name', u.full_name), now(), now()
from (values
  ('bb000000-0000-0000-0000-000000000001'::uuid, 'pgtap-st-admin@test.local',    'ST Admin'),
  ('bb000000-0000-0000-0000-000000000002'::uuid, 'pgtap-st-laerer1@test.local',  'ST Lærer En'),
  ('bb000000-0000-0000-0000-000000000003'::uuid, 'pgtap-st-laerer2@test.local',  'ST Lærer To'),
  ('bb000000-0000-0000-0000-000000000004'::uuid, 'pgtap-st-forelderA@test.local','ST Forelder A'),
  ('bb000000-0000-0000-0000-000000000005'::uuid, 'pgtap-st-forelderB@test.local','ST Forelder B'),
  ('bb000000-0000-0000-0000-000000000006'::uuid, 'pgtap-st-elev@test.local',     'ST Elev'),
  ('bb000000-0000-0000-0000-000000000007'::uuid, 'pgtap-st-okonomi@test.local',  'ST Økonomi')
) as u(id, email, full_name);
insert into public.user_roles (user_id, role) values
  ('bb000000-0000-0000-0000-000000000001', 'admin'),
  ('bb000000-0000-0000-0000-000000000002', 'teacher'),
  ('bb000000-0000-0000-0000-000000000003', 'teacher'),
  ('bb000000-0000-0000-0000-000000000004', 'parent'),
  ('bb000000-0000-0000-0000-000000000005', 'parent'),
  ('bb000000-0000-0000-0000-000000000006', 'student'),
  ('bb000000-0000-0000-0000-000000000007', 'economy');

insert into public.terms (id, name, starts_on, ends_on) values
  ('bb000000-0000-0000-0000-000000000011', 'ST Termin', '2026-08-15', '2026-12-20');
insert into public.classes (id, term_id, name) values
  ('bb000000-0000-0000-0000-000000000021', 'bb000000-0000-0000-0000-000000000011', 'ST Klasse A'),
  ('bb000000-0000-0000-0000-000000000022', 'bb000000-0000-0000-0000-000000000011', 'ST Klasse B');
insert into public.class_teachers (class_id, teacher_id) values
  ('bb000000-0000-0000-0000-000000000021', 'bb000000-0000-0000-0000-000000000002'),
  ('bb000000-0000-0000-0000-000000000022', 'bb000000-0000-0000-0000-000000000003');
insert into public.subjects (id, name) values
  ('bb000000-0000-0000-0000-000000000041', 'ST Fag A');
insert into public.class_subjects (class_id, subject_id) values
  ('bb000000-0000-0000-0000-000000000021', 'bb000000-0000-0000-0000-000000000041');
insert into public.students (id, first_name, last_name, birth_year, protected, student_user_id) values
  ('bb000000-0000-0000-0000-000000000031', 'ST', 'Elev En', 2014, false, 'bb000000-0000-0000-0000-000000000006'),
  ('bb000000-0000-0000-0000-000000000032', 'ST', 'Elev To', 2015, false, null);
insert into public.guardian_student (guardian_id, student_id) values
  ('bb000000-0000-0000-0000-000000000004', 'bb000000-0000-0000-0000-000000000031'),
  ('bb000000-0000-0000-0000-000000000005', 'bb000000-0000-0000-0000-000000000032');
insert into public.class_students (class_id, student_id, enrolled_on) values
  ('bb000000-0000-0000-0000-000000000021', 'bb000000-0000-0000-0000-000000000031', '2026-08-20'),
  ('bb000000-0000-0000-0000-000000000022', 'bb000000-0000-0000-0000-000000000032', '2026-08-20');

-- A1 belongs to class A (teacher1, pupil s1); A2 belongs to class B.
insert into public.assignments
  (id, class_id, subject_id, title, due_on, submission_type, created_by) values
  ('bb000000-0000-0000-0000-000000000051', 'bb000000-0000-0000-0000-000000000021',
   'bb000000-0000-0000-0000-000000000041', 'ST Oppgave A', '2026-08-28', 'digital',
   'bb000000-0000-0000-0000-000000000002');
insert into public.assignments
  (id, class_id, subject_id, title, due_on, submission_type, created_by) values
  ('bb000000-0000-0000-0000-000000000052', 'bb000000-0000-0000-0000-000000000022',
   'bb000000-0000-0000-0000-000000000041', 'ST Oppgave B', '2026-08-28', 'digital',
   'bb000000-0000-0000-0000-000000000003');
insert into public.submissions (id, assignment_id, student_id, body, submitted_by) values
  ('bb000000-0000-0000-0000-000000000071', 'bb000000-0000-0000-0000-000000000051',
   'bb000000-0000-0000-0000-000000000031', 'ST innlevering', 'bb000000-0000-0000-0000-000000000006');

-- ── Buckets exist, are PRIVATE, and enforce size + MIME server-side ──
select is((select public from storage.buckets where id = 'assignments'), false,
  'the assignments bucket is private (no public URLs, ever)');
select is((select public from storage.buckets where id = 'submissions'), false,
  'the submissions bucket is private');
select is((select file_size_limit from storage.buckets where id = 'submissions'),
  52428800::bigint,
  'the 50 MB cap is enforced by the bucket, not by the browser');
select ok(
  (select allowed_mime_types from storage.buckets where id = 'submissions')
    @> array['audio/mpeg'],
  'audio is allowed: a pupil can hand in a Quran recitation (D4)');
select ok(
  not ((select allowed_mime_types from storage.buckets where id = 'submissions')
       @> array['application/x-msdownload']),
  'the MIME allowlist is an allowlist, not a denylist');

-- ── Attachment tables ───────────────────────────────────────────────
select has_table('public'::name, 'assignment_attachments'::name,
  'assignment_attachments table exists');
select has_table('public'::name, 'submission_attachments'::name,
  'submission_attachments table exists');
select col_is_unique('public'::name, 'assignment_attachments'::name, 'path'::name,
  'one row per object: path is unique');

-- ── storage.objects: the assignments bucket ─────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"bb000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('assignments',
             'bb000000-0000-0000-0000-000000000051/aaaa1111-0000-0000-0000-000000000001-oppgave.pdf',
             'bb000000-0000-0000-0000-000000000002') $$,
  'the assignment''s teacher uploads an attachment into its folder');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"bb000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('assignments',
             'bb000000-0000-0000-0000-000000000051/aaaa1111-0000-0000-0000-000000000002-kapret.pdf',
             'bb000000-0000-0000-0000-000000000003') $$,
  '42501', null,
  'a foreign teacher cannot write into another assignment''s folder');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"bb000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from storage.objects where bucket_id = 'assignments'), 1::bigint,
  'the pupil in the assignment reads its attachment');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"bb000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from storage.objects where bucket_id = 'assignments'), 0::bigint,
  'a parent of another class''s pupil reads nothing in the assignments bucket');
reset role;

-- ── storage.objects: the submissions bucket ─────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"bb000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('submissions',
             'bb000000-0000-0000-0000-000000000071/bbbb2222-0000-0000-0000-000000000001-resitasjon.m4a',
             'bb000000-0000-0000-0000-000000000006') $$,
  'the pupil uploads into their OWN hand-in''s folder');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"bb000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('submissions',
             'bb000000-0000-0000-0000-000000000071/bbbb2222-0000-0000-0000-000000000002-fremmed.m4a',
             'bb000000-0000-0000-0000-000000000005') $$,
  '42501', null,
  'BERGEN #1: another family cannot write into a child''s hand-in folder');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"bb000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from storage.objects where bucket_id = 'submissions'), 0::bigint,
  'BERGEN #1: nor read it');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"bb000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from storage.objects), 0::bigint,
  'economy reads no objects in either bucket');
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /Users/daodilyas/dev/iqra-portal && supabase test db
```

Expected: FAIL — `23_assignment_storage.sql` errors on the missing `public.submission_attachments` table.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260728094000_assignment_storage.sql`:

```sql
-- Storage: two private buckets and the tables that index their objects
-- (D4, D6). Phase 5 adds a third bucket ('announcements') reusing this exact
-- pattern.
--
-- Three buckets by AUDIENCE rather than one shared bucket, because each
-- bucket's policy then serves exactly one audience: a policy bug cannot leak
-- across audiences, and the tightest wall — children's own work — stays
-- isolated. That separation is what makes the arrangement defensible in the
-- DPIA.
--
-- PATH SHAPE IS LOAD-BEARING:
--   assignments/{assignment_id}/{uuid}-{filename}
--   submissions/{submission_id}/{uuid}-{filename}
-- The first folder segment is the parent's UUID, so a storage.objects policy
-- resolves the owner with (storage.foldername(name))[1]::uuid and then calls
-- THE SAME private helpers as the table policies. The uuid filename prefix is
-- a security control, not cosmetics: it stops one pupil overwriting another's
-- object through a colliding filename.
--
-- Two attachment tables, not one polymorphic table: a polymorphic owner column
-- cannot carry a foreign key, so the row's parent would be unverifiable at the
-- database level and every policy would need a discriminator branch. One table
-- per bucket keeps each policy a direct mirror of its parent's policy.
--
-- GDPR (feeds the Phase-7 DPIA): audio and video of children are markedly more
-- sensitive than a photo of a worksheet. Retention rules, the Art. 30 record
-- and the DPIA must name these two buckets explicitly, and erasure must delete
-- OBJECTS, not merely rows.

-- ── Buckets (MIME + size enforced by Storage itself, server-side) ───
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('assignments', 'assignments', false, 52428800, array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif',
    'application/pdf', 'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]),
  ('submissions', 'submissions', false, 52428800, array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif',
    'application/pdf', 'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm',
    'video/mp4', 'video/quicktime', 'video/webm'
  ])
on conflict (id) do nothing;

-- ── assignment_attachments ──────────────────────────────────────────
create table public.assignment_attachments (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  path          text not null unique,
  filename      text not null check (char_length(filename) between 1 and 255),
  mime          text not null check (char_length(mime) between 1 and 255),
  size_bytes    bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  uploaded_by   uuid not null references public.profiles (id),
  created_at    timestamptz not null default now()
);
comment on table public.assignment_attachments is
  'Teacher-attached files on an assignment. No audit trigger: school structure, like the assignment itself. Reuse (D10) COPIES the objects to new paths rather than sharing them — the path encodes the parent UUID, so one object cannot legitimately serve two assignments.';

revoke all on table public.assignment_attachments from anon, authenticated, service_role;
grant select, insert, delete on public.assignment_attachments to authenticated;
grant select, delete on public.assignment_attachments to service_role;

alter table public.assignment_attachments enable row level security;

-- ── submission_attachments ──────────────────────────────────────────
create table public.submission_attachments (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  path          text not null unique,
  filename      text not null check (char_length(filename) between 1 and 255),
  mime          text not null check (char_length(mime) between 1 and 255),
  size_bytes    bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  uploaded_by   uuid not null references public.profiles (id),
  created_at    timestamptz not null default now()
);
comment on table public.submission_attachments is
  'Pupil-attached files on a hand-in (student data — audit trigger). The one DELETE exception in this phase: the submitting pupil/guardian may remove their own file while the hand-in is still open; once the work is approved, admin only.';

create trigger submission_attachments_audit
  after insert or update or delete on public.submission_attachments
  for each row execute function private.audit_row_change('submission_id');

revoke all on table public.submission_attachments from anon, authenticated, service_role;
grant select, insert, delete on public.submission_attachments to authenticated;
grant select, delete on public.submission_attachments to service_role;

alter table public.submission_attachments enable row level security;

-- ── Attachment table policies (direct mirrors of the parents') ──────
create policy "assignment_attachments_select_related"
  on public.assignment_attachments for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_assignment((select auth.uid()), assignment_id)
    or private.guardian_sees_assignment((select auth.uid()), assignment_id)
    or private.student_sees_assignment((select auth.uid()), assignment_id)
  );
create policy "assignment_attachments_insert_teacher_or_admin"
  on public.assignment_attachments for insert to authenticated
  with check (
    (
      private.has_role((select auth.uid()), 'admin')
      or private.teaches_assignment((select auth.uid()), assignment_id)
    )
    and uploaded_by = (select auth.uid())
  );
create policy "assignment_attachments_delete_teacher_or_admin"
  on public.assignment_attachments for delete to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_assignment((select auth.uid()), assignment_id)
  );

create policy "submission_attachments_select_related"
  on public.submission_attachments for select to authenticated
  using (private.reads_submission((select auth.uid()), submission_id));
create policy "submission_attachments_insert_pupil_or_guardian"
  on public.submission_attachments for insert to authenticated
  with check (
    private.writes_submission((select auth.uid()), submission_id)
    and uploaded_by = (select auth.uid())
  );
create policy "submission_attachments_delete_own_while_open"
  on public.submission_attachments for delete to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.writes_submission((select auth.uid()), submission_id)
  );

-- ── storage.objects policies — the same helpers, one folder segment
--    away. Note (storage.foldername(name))[1] is the parent UUID. ────
create policy "assignments_objects_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'assignments'
    and (
      private.has_role((select auth.uid()), 'admin')
      or private.teaches_assignment((select auth.uid()), (storage.foldername(name))[1]::uuid)
      or private.guardian_sees_assignment((select auth.uid()), (storage.foldername(name))[1]::uuid)
      or private.student_sees_assignment((select auth.uid()), (storage.foldername(name))[1]::uuid)
    )
  );
create policy "assignments_objects_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'assignments'
    and (
      private.has_role((select auth.uid()), 'admin')
      or private.teaches_assignment((select auth.uid()), (storage.foldername(name))[1]::uuid)
    )
  );
create policy "assignments_objects_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'assignments'
    and (
      private.has_role((select auth.uid()), 'admin')
      or private.teaches_assignment((select auth.uid()), (storage.foldername(name))[1]::uuid)
    )
  );

create policy "submissions_objects_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'submissions'
    and private.reads_submission((select auth.uid()), (storage.foldername(name))[1]::uuid)
  );
create policy "submissions_objects_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'submissions'
    and private.writes_submission((select auth.uid()), (storage.foldername(name))[1]::uuid)
  );
create policy "submissions_objects_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'submissions'
    and (
      private.has_role((select auth.uid()), 'admin')
      or private.writes_submission((select auth.uid()), (storage.foldername(name))[1]::uuid)
    )
  );
```

**If `storage.foldername(name)` on a path without a `/` returns an empty array,** `[1]` is NULL and the `::uuid` cast yields NULL, so the policy denies — the safe direction. No object this phase is ever written at a bucket's root.

- [ ] **Step 4: Reset and verify the pgTAP file passes**

```bash
cd /Users/daodilyas/dev/iqra-portal && supabase db reset && supabase test db
```

Expected: `23_assignment_storage.sql ..... ok` with 16/16.

- [ ] **Step 5: Add the Phase-4 seed rows**

Append to `supabase/seed.sql`, after the existing Phase-3 blocks:

```sql
-- ── Phase 4: lekser & oppgaver ──────────────────────────────────────
-- fb = groups (class templates AND their frozen assignment copies),
-- f8 = assignments, f9 = submissions. A_ALFABET is CLASS-WIDE (no
-- assignment_groups rows at all) so student_in_assignment resolves it through
-- the roster branch; A_GRUPPE is group-targeted so it resolves through the
-- frozen-member branch. Having both in the seed is what lets the api suite
-- exercise the pivot's two shapes against real data.
-- No attachment rows: an attachment row without its Storage object is exactly
-- the orphan the design forbids, and a seed cannot create objects.
insert into public.class_groups (id, class_id, name, sort, created_by) values
  ('fb000000-0000-0000-0000-000000000001', 'fc000000-0000-0000-0000-000000000001',
   'Halaqa A', 1, '22222222-2222-2222-2222-222222222222');
insert into public.class_group_members (group_id, student_id) values
  ('fb000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001'),
  ('fb000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000003');

insert into public.assignments
  (id, class_id, subject_id, title, instructions, due_on, submission_type, created_by) values
  ('f8000000-0000-0000-0000-000000000001', 'fc000000-0000-0000-0000-000000000001',
   'fa000000-0000-0000-0000-000000000001', 'Skriv det arabiske alfabetet',
   'Skriv alle bokstavene tre ganger. Ta bilde av arket og lever her.',
   '2026-09-12', 'digital', '22222222-2222-2222-2222-222222222222'),
  ('f8000000-0000-0000-0000-000000000002', 'fc000000-0000-0000-0000-000000000001',
   'fa000000-0000-0000-0000-000000000002', 'Gruppeoppgave: presenter en surah',
   'Velg en kort surah sammen. Ta opp resitasjonen og skriv tre setninger om innholdet.',
   '2026-09-19', 'digital', '22222222-2222-2222-2222-222222222222');

insert into public.assignment_groups (id, assignment_id, name, source_group_id) values
  ('fb000000-0000-0000-0000-000000000011', 'f8000000-0000-0000-0000-000000000002',
   'Halaqa A', 'fb000000-0000-0000-0000-000000000001');
insert into public.assignment_group_members (assignment_group_id, student_id) values
  ('fb000000-0000-0000-0000-000000000011', 'fe000000-0000-0000-0000-000000000001'),
  ('fb000000-0000-0000-0000-000000000011', 'fe000000-0000-0000-0000-000000000003');

insert into public.submissions
  (id, assignment_id, student_id, assignment_group_id, body, submitted_by) values
  ('f9000000-0000-0000-0000-000000000001', 'f8000000-0000-0000-0000-000000000001',
   'fe000000-0000-0000-0000-000000000001', null,
   'Jeg har skrevet hele alfabetet.', '44444444-4444-4444-4444-444444444444'),
  ('f9000000-0000-0000-0000-000000000002', 'f8000000-0000-0000-0000-000000000002',
   null, 'fb000000-0000-0000-0000-000000000011',
   'Vi har valgt Al-Fatiha.', '44444444-4444-4444-4444-444444444444');

-- Exactly ONE review, on the individual hand-in. A_GRUPPE stays unreviewed so
-- the api suite can prove per-pupil review across a shared hand-in from a
-- clean start.
insert into public.assignment_reviews
  (assignment_id, student_id, status, points, feedback, reviewed_by) values
  ('f8000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001',
   'godkjent', 9, 'Fin håndskrift — øv på de siste bokstavene.',
   '22222222-2222-2222-2222-222222222222');
```

Also extend the seed's UUID-prefix header comment (around line 11) to list the new prefixes:

```sql
-- f1 (terms), fa (subjects), fc (classes), fe (students), f6 (lessons),
-- f7 (absence notices), f2 (books), f3 (progress), f4 (quran), f5 (tests),
-- fb (groups), f8 (assignments), f9 (submissions); pgTAP tests use per-file
-- a5/a6/a7/a8/a9/ad/ae/af/b1/b2/b3/b4/b5/b6/b7/b8/b9/ba/bb/bc prefixes —
-- never overlap them.
```

- [ ] **Step 6: Extend the api access-wall deny sweep**

Append to `tests/api/access-wall.test.ts`:

```ts
describe('wall 1: the phase-4 assignment tables under per-user RLS', () => {
  // DENY side only (the ALLOW side and exact per-user counts live in the
  // Task 7 DAL suite). economy holds no teaching/guardian/pupil relationship,
  // so it has no RLS path into any of them. forelder2's cells are structural
  // zeros: Zaynab (protected, K3) and Idris (stopped) carry no Phase-4 rows,
  // and K3 has no assignments at all.
  type AssignmentTable =
    | 'class_groups'
    | 'assignments'
    | 'assignment_groups'
    | 'submissions'
    | 'assignment_reviews';

  async function assignmentRowCount(
    email: SeedEmail,
    table: AssignmentTable,
  ): Promise<number> {
    signInAs(email);
    const supabase = await createServerClientMock();
    const { data, error } =
      table === 'class_groups'
        ? await supabase.from('class_groups').select('id')
        : table === 'assignments'
          ? await supabase.from('assignments').select('id')
          : table === 'assignment_groups'
            ? await supabase.from('assignment_groups').select('id')
            : table === 'submissions'
              ? await supabase.from('submissions').select('id')
              : await supabase.from('assignment_reviews').select('assignment_id');
    if (error) {
      throw new Error(`Uventet RLS-feil for ${email} på ${table}: ${error.message}`);
    }
    return data?.length ?? 0;
  }

  const ASSIGNMENT_TABLE_DENYS: Array<[SeedEmail, AssignmentTable]> = [
    ['okonomi@test.local', 'class_groups'],
    ['okonomi@test.local', 'assignments'],
    ['okonomi@test.local', 'assignment_groups'],
    ['okonomi@test.local', 'submissions'],
    ['okonomi@test.local', 'assignment_reviews'],
    ['forelder2@test.local', 'assignments'],
    ['forelder2@test.local', 'submissions'],
    ['forelder2@test.local', 'assignment_reviews'],
    // D7: templates are teacher-only. A parent and a pupil both read zero.
    ['forelder@test.local', 'class_groups'],
    ['elev@test.local', 'class_groups'],
  ];
  it.each(ASSIGNMENT_TABLE_DENYS)('denies %s every row of %s', async (email, table) => {
    expect(await assignmentRowCount(email, table)).toBe(0);
  });
});
```

- [ ] **Step 7: Reset and run everything**

```bash
cd /Users/daodilyas/dev/iqra-portal && supabase db reset && supabase test db && npm run test:api
```

Expected: all 26 pgTAP files ok; api suite green including the ten new deny cells.

- [ ] **Step 8: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal && git add supabase/migrations/20260728094000_assignment_storage.sql supabase/tests/23_assignment_storage.sql supabase/seed.sql tests/api/access-wall.test.ts && git commit -m "feat(oppgaver): private storage buckets, object policies and attachment tables"
```

---
## Task 6: Pure logic, the MIME/size allowlist, and the signed-URL Storage helpers

Everything in this task is either pure (unit-tested, no I/O) or a thin, single-purpose wrapper over Supabase Storage. **Refinement R1** is implemented here: the server never carries the bytes, it mints a path-pinned upload ticket and re-reads the object's real metadata afterwards.

**Files:**
- Create: `src/lib/assignments.ts`, `src/lib/assignments.test.ts`
- Create: `src/lib/validation/assignments.ts`, `src/lib/validation/assignments.test.ts`
- Create: `src/lib/storage/attachments.ts`
- Create: `tests/api/assignments-storage.test.ts`
- Modify: `src/lib/dates.ts`

- [ ] **Step 1: Write the failing unit tests**

Create `src/lib/assignments.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  attachmentPath,
  deriveStatus,
  groupSizeOk,
  safeStorageName,
  STATUS_LABELS,
  STATUS_TONES,
} from './assignments';

describe('deriveStatus (D8 — derived, never stored, never auto-zero)', () => {
  const DUE = '2026-09-12';

  it.each([
    ['no hand-in before the due date', null, false, 'ikke_levert'],
    ['no hand-in long after the due date', null, false, 'ikke_levert'],
    ['handed in the day before', '2026-09-11', false, 'levert'],
    ['handed in exactly on the due date', '2026-09-12', false, 'levert'],
    ['handed in the day after', '2026-09-13', false, 'levert_etter_frist'],
  ] as const)('%s', (_name, submittedOn, reviewed, expected) => {
    expect(deriveStatus({ dueOn: DUE, submittedOn, reviewed })).toBe(expected);
  });

  it('a review outranks every hand-in state, including a late one', () => {
    expect(deriveStatus({ dueOn: DUE, submittedOn: '2026-09-30', reviewed: true })).toBe(
      'vurdert',
    );
  });

  it('never invents a hand-in: a reviewed pupil with no submission is still vurdert', () => {
    // A teacher may mark work seen on paper (submission_type 'none').
    expect(deriveStatus({ dueOn: DUE, submittedOn: null, reviewed: true })).toBe('vurdert');
  });

  it('has a Norwegian label and a non-danger tone for every status', () => {
    for (const status of Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[]) {
      expect(STATUS_LABELS[status].length).toBeGreaterThan(0);
      // Design law: a pupil's own standing is never rendered as an error.
      expect(STATUS_TONES[status]).not.toBe('danger');
    }
  });
});

describe('groupSizeOk (D2 — 2 to 4, app-side)', () => {
  it.each([
    [0, false],
    [1, false],
    [2, true],
    [3, true],
    [4, true],
    [5, false],
  ])('a group of %i is %s', (count, expected) => {
    expect(groupSizeOk(count)).toBe(expected);
  });

  it('rejects a non-integer count rather than rounding it', () => {
    expect(groupSizeOk(2.5)).toBe(false);
  });
});

describe('safeStorageName (the uuid prefix is a control; so is this)', () => {
  it('strips directory traversal', () => {
    expect(safeStorageName('../../etc/passwd')).toBe('passwd');
    expect(safeStorageName('..\\..\\windows\\system.ini')).toBe('system.ini');
  });

  it('refuses to produce a leading dot (no hidden files, no bare ..)', () => {
    expect(safeStorageName('..')).toBe('vedlegg');
    expect(safeStorageName('.env')).toBe('env');
  });

  it('keeps Norwegian letters and the extension readable', () => {
    expect(safeStorageName('Åpen oppgave (ferdig).pdf')).toBe('Åpen-oppgave-ferdig-.pdf');
  });

  it('never returns an empty name', () => {
    expect(safeStorageName('???')).toBe('vedlegg');
    expect(safeStorageName('')).toBe('vedlegg');
  });

  it('caps the length so a crafted name cannot blow the path limit', () => {
    expect(safeStorageName(`${'a'.repeat(400)}.pdf`)).toHaveLength(100);
  });
});

describe('attachmentPath', () => {
  it('puts the parent uuid first — the whole storage policy depends on it', () => {
    expect(
      attachmentPath(
        'f8000000-0000-0000-0000-000000000001',
        'aaaa1111-2222-3333-4444-555555555555',
        'oppgave.pdf',
      ),
    ).toBe(
      'f8000000-0000-0000-0000-000000000001/aaaa1111-2222-3333-4444-555555555555-oppgave.pdf',
    );
  });

  it('cannot be escaped by a crafted filename', () => {
    const path = attachmentPath(
      'f8000000-0000-0000-0000-000000000001',
      'aaaa1111-2222-3333-4444-555555555555',
      '../f8000000-0000-0000-0000-000000000002/stolen.pdf',
    );
    expect(path.split('/')).toHaveLength(2);
    expect(path.startsWith('f8000000-0000-0000-0000-000000000001/')).toBe(true);
  });
});
```

Create `src/lib/validation/assignments.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  ATTACHMENT_MIME,
  MAX_ATTACHMENT_BYTES,
  assignmentSchema,
  classGroupSchema,
  mimeAllowed,
  reviewSchema,
  uploadRequestSchema,
} from './assignments';

const CLASS = 'fc000000-0000-0000-0000-000000000001';
const SUBJECT = 'fa000000-0000-0000-0000-000000000001';

describe('mimeAllowed', () => {
  it('accepts an audio type — a Quran recitation hand-in (D4)', () => {
    expect(mimeAllowed('audio/mpeg')).toBe(true);
  });

  it('is an allowlist: an executable is refused whatever its name says', () => {
    expect(mimeAllowed('application/x-msdownload')).toBe(false);
    expect(mimeAllowed('application/octet-stream')).toBe(false);
  });

  it('ignores parameters a browser may append to the type', () => {
    expect(mimeAllowed('text/plain; charset=utf-8')).toBe(true);
  });

  it('is case-insensitive, as MIME types are', () => {
    expect(mimeAllowed('IMAGE/PNG')).toBe(true);
  });

  it('exposes the same cap the bucket enforces', () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(52_428_800);
    expect(ATTACHMENT_MIME).toContain('video/mp4');
  });
});

describe('uploadRequestSchema', () => {
  it('accepts a legal file', () => {
    const parsed = uploadRequestSchema.safeParse({
      filename: 'resitasjon.m4a',
      mime: 'audio/mp4',
      size: 8_000_000,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a file over the cap with a Norwegian message', () => {
    const parsed = uploadRequestSchema.safeParse({
      filename: 'film.mp4',
      mime: 'video/mp4',
      size: MAX_ATTACHMENT_BYTES + 1,
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toBe('Filen kan være maks 50 MB.');
  });

  it('rejects a zero-byte file', () => {
    expect(
      uploadRequestSchema.safeParse({ filename: 'tom.pdf', mime: 'application/pdf', size: 0 })
        .success,
    ).toBe(false);
  });

  it('rejects a disallowed type', () => {
    const parsed = uploadRequestSchema.safeParse({
      filename: 'virus.exe',
      mime: 'application/x-msdownload',
      size: 100,
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toBe(
      'Filtypen støttes ikke. Legg ved bilde, dokument, lyd eller video.',
    );
  });
});

describe('assignmentSchema', () => {
  const valid = {
    class_id: CLASS,
    subject_id: SUBJECT,
    title: 'Skriv alfabetet',
    instructions: 'Tre ganger.',
    due_on: '2026-09-12',
    submission_type: 'digital',
    group_ids: [],
  };

  it('accepts a class-wide assignment with no groups', () => {
    expect(assignmentSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts up to eight picked groups', () => {
    const groups = Array.from({ length: 8 }, (_, i) =>
      `fb000000-0000-0000-0000-00000000000${i}`,
    );
    expect(assignmentSchema.safeParse({ ...valid, group_ids: groups }).success).toBe(true);
  });

  it('demands a title', () => {
    expect(assignmentSchema.safeParse({ ...valid, title: '  ' }).success).toBe(false);
  });

  it('demands a real due date', () => {
    expect(assignmentSchema.safeParse({ ...valid, due_on: '12.09.2026' }).success).toBe(false);
  });
});

describe('classGroupSchema (D2 is enforced here, not in the database)', () => {
  it('accepts a group of three', () => {
    const parsed = classGroupSchema.safeParse({
      name: 'Halaqa A',
      student_ids: [
        'fe000000-0000-0000-0000-000000000001',
        'fe000000-0000-0000-0000-000000000002',
        'fe000000-0000-0000-0000-000000000003',
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a group of one with the reason spelled out', () => {
    const parsed = classGroupSchema.safeParse({
      name: 'Alene',
      student_ids: ['fe000000-0000-0000-0000-000000000001'],
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toBe('En gruppe må ha 2–4 elever.');
  });

  it('rejects a group of five', () => {
    const parsed = classGroupSchema.safeParse({
      name: 'For stor',
      student_ids: Array.from({ length: 5 }, (_, i) =>
        `fe000000-0000-0000-0000-00000000000${i}`,
      ),
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects the same pupil twice', () => {
    const parsed = classGroupSchema.safeParse({
      name: 'Duplikat',
      student_ids: [
        'fe000000-0000-0000-0000-000000000001',
        'fe000000-0000-0000-0000-000000000001',
      ],
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toBe('En elev kan bare stå én gang i en gruppe.');
  });
});

describe('reviewSchema', () => {
  it('accepts a review with no points (feedback only)', () => {
    expect(
      reviewSchema.safeParse({
        student_id: 'fe000000-0000-0000-0000-000000000001',
        status: 'godkjent',
        points: '',
        feedback: 'Bra jobbet.',
      }).success,
    ).toBe(true);
  });

  it('rejects negative points', () => {
    expect(
      reviewSchema.safeParse({
        student_id: 'fe000000-0000-0000-0000-000000000001',
        status: 'godkjent',
        points: '-1',
        feedback: '',
      }).success,
    ).toBe(false);
  });

  it('only knows the two review outcomes', () => {
    expect(
      reviewSchema.safeParse({
        student_id: 'fe000000-0000-0000-0000-000000000001',
        status: 'stryk',
        points: '',
        feedback: '',
      }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

```bash
cd /Users/daodilyas/dev/iqra-portal && npm run test -- assignments
```

Expected: FAIL — `Cannot find module './assignments'` / `'./validation/assignments'`.

- [ ] **Step 3: Write the pure module**

Create `src/lib/assignments.ts`:

```ts
import type { ChipTone } from '@/components/ui/Chip';

export type SubmissionStatus =
  | 'ikke_levert'
  | 'levert'
  | 'levert_etter_frist'
  | 'vurdert';

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  ikke_levert: 'Ikke levert',
  levert: 'Levert',
  levert_etter_frist: 'Levert etter frist',
  vurdert: 'Vurdert',
};

/**
 * Design law: a pupil's own standing is NEVER `danger`. A missing hand-in is
 * neutral information the teacher acts on, not an error the child is shown in
 * red. `danger` stays reserved for destructive controls.
 */
export const STATUS_TONES: Record<SubmissionStatus, ChipTone> = {
  ikke_levert: 'neutral',
  levert: 'success',
  levert_etter_frist: 'warning',
  vurdert: 'success',
};

export const STATUS_ORDER: SubmissionStatus[] = [
  'ikke_levert',
  'levert',
  'levert_etter_frist',
  'vurdert',
];

/**
 * D8: status is DERIVED and never stored — no auto-zero, no stored "missing"
 * flag that can drift from reality. Both arguments are date-only ISO strings
 * (YYYY-MM-DD), so a lexicographic comparison IS a chronological one.
 * `submittedOn` is the hand-in's Oslo calendar date, computed by the DAL with
 * `osloDateOf` — comparing a UTC timestamp against an Oslo due date would mark
 * late anything handed in after 01:00 local on the final day.
 */
export function deriveStatus(input: {
  dueOn: string;
  submittedOn: string | null;
  reviewed: boolean;
}): SubmissionStatus {
  if (input.reviewed) return 'vurdert';
  if (input.submittedOn === null) return 'ikke_levert';
  return input.submittedOn > input.dueOn ? 'levert_etter_frist' : 'levert';
}

export const MIN_GROUP_SIZE = 2;
export const MAX_GROUP_SIZE = 4;

/** D2, app-side by design (the Phase-3 `points <= max_points` precedent). */
export function groupSizeOk(count: number): boolean {
  return Number.isInteger(count) && count >= MIN_GROUP_SIZE && count <= MAX_GROUP_SIZE;
}

/**
 * Reduce a user-supplied filename to something that cannot escape its folder,
 * cannot collide meaningfully, and cannot become a dotfile. This runs on the
 * SERVER before the path is signed — the browser never chooses a path.
 */
export function safeStorageName(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? '';
  const cleaned = base
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^[.-]+/, '')
    .replace(/-{2,}/g, '-');
  return (cleaned === '' ? 'vedlegg' : cleaned).slice(0, 100);
}

/**
 * `{parent_id}/{object_id}-{safe name}`. The first segment being the parent's
 * UUID is what every storage.objects policy resolves ownership from, and the
 * uuid prefix stops one pupil overwriting another's object through a colliding
 * filename.
 */
export function attachmentPath(
  parentId: string,
  objectId: string,
  filename: string,
): string {
  return `${parentId}/${objectId}-${safeStorageName(filename)}`;
}
```

Create `src/lib/validation/assignments.ts`:

```ts
import { z } from 'zod';
import { MAX_GROUP_SIZE, MIN_GROUP_SIZE } from '@/lib/assignments';
import { uuidField } from './school';

/** Mirrors the two buckets' allowed_mime_types exactly (migration 094000). */
export const ATTACHMENT_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'video/mp4',
  'video/quicktime',
  'video/webm',
] as const;

export const MAX_ATTACHMENT_BYTES = 52_428_800; // 50 MiB — the bucket's limit

/**
 * The action's own check. It is the FIRST of three server-side gates: this
 * one, then the bucket's allowed_mime_types when the bytes actually land, then
 * the confirm step's re-read of the stored object's real type. The browser is
 * trusted at none of them.
 */
export function mimeAllowed(mime: string): boolean {
  const bare = mime.split(';')[0].trim().toLowerCase();
  return (ATTACHMENT_MIME as readonly string[]).includes(bare);
}

export const uploadRequestSchema = z.object({
  filename: z
    .string()
    .trim()
    .min(1, 'Filen mangler navn.')
    .max(255, 'Filnavnet er for langt.'),
  mime: z
    .string()
    .trim()
    .min(1, 'Filtypen mangler.')
    .refine(mimeAllowed, 'Filtypen støttes ikke. Legg ved bilde, dokument, lyd eller video.'),
  size: z.coerce
    .number('Filstørrelsen mangler.')
    .int()
    .positive('Filen er tom.')
    .max(MAX_ATTACHMENT_BYTES, 'Filen kan være maks 50 MB.'),
});

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === '' ? null : value))
    .nullish();

export const assignmentSchema = z.object({
  class_id: uuidField,
  subject_id: uuidField,
  title: z
    .string()
    .trim()
    .min(1, 'Skriv en tittel.')
    .max(120, 'Tittelen kan være maks 120 tegn.'),
  instructions: optionalText(4000, 'Beskrivelsen kan være maks 4000 tegn.'),
  due_on: z.iso.date('Oppgi en gyldig frist.'),
  submission_type: z.enum(['digital', 'none'], 'Velg innleveringsform.'),
  // Empty = hele klassen. The cap is a sanity bound, not a rule from the spec.
  group_ids: z.array(uuidField).max(8, 'Velg maks åtte grupper.'),
});

export const classGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Gi gruppen et navn.')
    .max(60, 'Navnet kan være maks 60 tegn.'),
  student_ids: z
    .array(uuidField)
    .min(MIN_GROUP_SIZE, 'En gruppe må ha 2–4 elever.')
    .max(MAX_GROUP_SIZE, 'En gruppe må ha 2–4 elever.')
    .refine(
      (ids) => new Set(ids).size === ids.length,
      'En elev kan bare stå én gang i en gruppe.',
    ),
});

export const submissionSchema = z.object({
  body: optionalText(4000, 'Teksten kan være maks 4000 tegn.'),
});

export const reviewSchema = z.object({
  student_id: uuidField,
  status: z.enum(['godkjent', 'ny_innlevering'], 'Velg vurdering.'),
  points: z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : value))
    .pipe(
      z.coerce
        .number('Poeng må være et tall.')
        .int('Poeng må være et helt tall.')
        .min(0, 'Poeng kan ikke være negative.')
        .max(1000, 'Poeng kan være maks 1000.')
        .nullable(),
    ),
  feedback: optionalText(2000, 'Tilbakemeldingen kan være maks 2000 tegn.'),
});

export const reuseSchema = z.object({
  source_id: uuidField,
});
```

- [ ] **Step 4: Add the Oslo-date helper**

Append to `src/lib/dates.ts`:

```ts
/**
 * The Oslo calendar date of a timestamp, as YYYY-MM-DD. Hand-in lateness
 * compares a timestamptz against a date-only frist: doing that in UTC would
 * mark "late" anything handed in after 01:00 Oslo time on the final day
 * (02:00 in summer). The T12 audit-timestamp lesson, applied to lekser.
 */
export function osloDateOf(isoTimestamp: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Oslo',
  }).format(new Date(isoTimestamp));
}
```

- [ ] **Step 5: Run the unit tests to verify they pass**

```bash
cd /Users/daodilyas/dev/iqra-portal && npm run test -- assignments
```

Expected: PASS — both new unit files green.

- [ ] **Step 6: Write the Storage helper module**

Create `src/lib/storage/attachments.ts`:

```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type AttachmentBucket = 'assignments' | 'submissions';

export interface StoredObjectMeta {
  size: number;
  mime: string;
}

/**
 * Refinement R1. A 50 MB file cannot travel through a server action — a
 * Vercel serverless request body caps at 4.5 MB — so the server mints a
 * signed ticket for ONE path it chose itself and the browser PUTs straight to
 * Storage. Authorization is unchanged: the storage.objects INSERT policy still
 * runs on the caller's own JWT, so an unauthorized upload fails at the bucket
 * even if a ticket leaked.
 */
export async function createUploadTicket(
  bucket: AttachmentBucket,
  path: string,
): Promise<{ path: string; token: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error) {
    throw new Error(`Kunne ikke klargjøre opplastingen: ${error.message}`);
  }
  return { path: data.path, token: data.token };
}

/**
 * Confirm-time re-read: the SIZE AND TYPE THE BROWSER CLAIMED ARE NOT WHAT WE
 * STORE. This asks Storage what actually landed, and the attachment row is
 * written from that. Returns null when no object exists at the path — which is
 * how a cancelled or failed upload is told apart from a completed one.
 */
export async function readObjectMeta(
  bucket: AttachmentBucket,
  path: string,
): Promise<StoredObjectMeta | null> {
  const slash = path.lastIndexOf('/');
  const folder = path.slice(0, slash);
  const name = path.slice(slash + 1);
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).list(folder, {
    limit: 100,
    search: name,
  });
  if (error) {
    throw new Error(`Kunne ikke lese opp filen: ${error.message}`);
  }
  const found = (data ?? []).find((entry) => entry.name === name);
  if (!found) return null;
  const size = Number(found.metadata?.size ?? 0);
  const mime = String(found.metadata?.mimetype ?? '');
  if (size <= 0 || mime === '') return null;
  return { size, mime };
}

/** Short-lived download URL, minted ONLY after a DAL check (master spec §8). */
export async function signedDownloadUrl(
  bucket: AttachmentBucket,
  path: string,
  expiresInSeconds = 120,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  // A missing object is a mapped empty state, never a broken link.
  if (error) return null;
  return data.signedUrl;
}

export async function removeObject(
  bucket: AttachmentBucket,
  path: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    throw new Error(`Kunne ikke slette filen: ${error.message}`);
  }
}

/**
 * Server-side object copy for reuse (D10). Attachments are physically copied,
 * never shared: the path encodes the parent's UUID, so one object cannot serve
 * two assignments without breaking the path-based policy.
 */
export async function copyObject(
  bucket: AttachmentBucket,
  fromPath: string,
  toPath: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.storage.from(bucket).copy(fromPath, toPath);
  if (error) {
    throw new Error(`Kunne ikke kopiere vedlegget: ${error.message}`);
  }
}
```

- [ ] **Step 7: Write the live Storage api test**

Create `tests/api/assignments-storage.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { attachmentPath } from '@/lib/assignments';
import {
  copyObject,
  createUploadTicket,
  readObjectMeta,
  removeObject,
  signedDownloadUrl,
} from '@/lib/storage/attachments';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getPublicEnv } from '@/lib/env';
import { signInAs, signInAsAAL2, signOut } from './harness';

const A_ALFABET = 'f8000000-0000-0000-0000-000000000001';
const S_YUSUF = 'f9000000-0000-0000-0000-000000000001';
const OBJ = 'cccc3333-4444-5555-6666-777777777777';

function anonClient() {
  const env = getPublicEnv();
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function uploadWithTicket(
  bucket: 'assignments' | 'submissions',
  path: string,
  token: string,
  body: Blob,
) {
  return anonClient().storage.from(bucket).uploadToSignedUrl(path, token, body);
}

beforeEach(() => {
  signOut();
});

describe('R1: the signed-ticket upload path', () => {
  it('lets the assignment teacher mint a ticket, upload, read back real metadata and sign a download', async () => {
    await signInAsAAL2('laerer@test.local');
    const path = attachmentPath(A_ALFABET, OBJ, 'oppgaveark.pdf');
    const ticket = await createUploadTicket('assignments', path);
    expect(ticket.path).toBe(path);

    const bytes = new Blob(['%PDF-1.4 lorem'], { type: 'application/pdf' });
    const { error } = await uploadWithTicket('assignments', path, ticket.token, bytes);
    expect(error).toBeNull();

    try {
      const meta = await readObjectMeta('assignments', path);
      expect(meta).not.toBeNull();
      expect(meta?.mime).toBe('application/pdf');
      expect(meta?.size).toBe(bytes.size);

      const url = await signedDownloadUrl('assignments', path);
      expect(url).toContain('/object/sign/assignments/');
    } finally {
      await removeObject('assignments', path);
    }
  });

  it('reports a path with no object as null instead of inventing metadata', async () => {
    await signInAsAAL2('laerer@test.local');
    const meta = await readObjectMeta(
      'assignments',
      attachmentPath(A_ALFABET, OBJ, 'finnes-ikke.pdf'),
    );
    expect(meta).toBeNull();
  });

  it('★ the BUCKET rejects a disallowed type even with a valid ticket', async () => {
    await signInAsAAL2('laerer@test.local');
    const path = attachmentPath(A_ALFABET, OBJ, 'skadelig.exe');
    const ticket = await createUploadTicket('assignments', path);
    const { error } = await uploadWithTicket(
      'assignments',
      path,
      ticket.token,
      new Blob(['MZ'], { type: 'application/x-msdownload' }),
    );
    // Server-side enforcement that owes nothing to the browser or the action.
    expect(error).not.toBeNull();
    expect(await readObjectMeta('assignments', path)).toBeNull();
  });

  it('★ refuses a ticket for a foreign assignment folder', async () => {
    // laererforelder@ teaches K3, not K1 — A_ALFABET is not theirs.
    await signInAsAAL2('laererforelder@test.local');
    await expect(
      createUploadTicket('assignments', attachmentPath(A_ALFABET, OBJ, 'kapret.pdf')),
    ).rejects.toThrow('Kunne ikke klargjøre opplastingen');
  });

  it('★ BERGEN #1: another family cannot mint a ticket into a pupil''s hand-in folder', async () => {
    signInAs('forelder2@test.local');
    await expect(
      createUploadTicket('submissions', attachmentPath(S_YUSUF, OBJ, 'fremmed.m4a')),
    ).rejects.toThrow('Kunne ikke klargjøre opplastingen');
  });

  it('copies an object to a new parent folder without touching the original (D10)', async () => {
    await signInAsAAL2('laerer@test.local');
    const from = attachmentPath(A_ALFABET, OBJ, 'kilde.pdf');
    const ticket = await createUploadTicket('assignments', from);
    await uploadWithTicket(
      'assignments',
      from,
      ticket.token,
      new Blob(['%PDF-1.4 kilde'], { type: 'application/pdf' }),
    );
    const A_GRUPPE = 'f8000000-0000-0000-0000-000000000002';
    const to = attachmentPath(A_GRUPPE, OBJ, 'kilde.pdf');
    try {
      await copyObject('assignments', from, to);
      expect(await readObjectMeta('assignments', to)).not.toBeNull();
      expect(await readObjectMeta('assignments', from)).not.toBeNull();
    } finally {
      await removeObject('assignments', from);
      await removeObject('assignments', to);
    }
  });
});
```

Note the apostrophe inside the fifth test name — write it as `"★ BERGEN #1: another family cannot mint a ticket into a pupil's hand-in folder"` with double quotes, not the escaped form shown above.

- [ ] **Step 8: Run the api test**

```bash
cd /Users/daodilyas/dev/iqra-portal && npm run test:api -- assignments-storage
```

Expected: PASS, 6/6. If the "disallowed type" test passes the upload, the bucket's `allowed_mime_types` did not apply — re-check migration `20260728094000` before continuing; that assertion is the only proof the bucket enforces anything.

> **Execution ledger — corrected during Task 6 (2026-07-29).** Two defects in the
> text above were found by the implementer and confirmed against the seed and the
> live stack before being fixed.
>
> 1. **"★ BERGEN #1" was over-determined and could not fail.** The fixture
>    `f9000000-…0001` is Yusuf's individual hand-in, and `seed.sql:293-297` gives
>    him a `godkjent` review on `f8000000-…0001` — so `private.writes_submission`
>    is false for *everyone*, and the ticket is denied by the approval lock long
>    before the family check is reached. Probed empirically: the plan's fixture
>    denies **both** the own family and the foreign one, so the assertion would
>    have passed identically with the family check deleted from
>    `can_write_submission`. Fixed by moving to the unreviewed group hand-in
>    `f9000000-…0002` (open, so the family check is the only variable) and adding
>    a **positive control** on the same path: `forelder@` mints, `forelder2@` is
>    refused. The api file is therefore 7 tests, not 6. Contrast "★ refuses a
>    ticket for a foreign assignment folder", which was already sound —
>    `laererforelder@` teaches Klasse 3, the assignments policy has no lock
>    concept, and test 1 is its positive control on the same folder.
> 2. **`reviewSchema` did not typecheck as written.** `z.coerce.number()` defaults
>    its *input* type to `unknown`, and Zod 4's `.pipe()` demands a target that
>    accepts the source's output (`string | null`). Runtime was always correct —
>    the unit tests pass either way. Pinned to `z.coerce.number<string>(...)`; the
>    type parameter is erased, so behaviour is unchanged.
>
> **Not a defect: knip fails after this task, deliberately.** `STATUS_ORDER`,
> `osloDateOf`, `submissionSchema` and `reuseSchema` have no consumer until
> Tasks 7, 7, 8 and 9 respectively. knip is a CI/PR gate here, not a per-task one,
> and this branch is not pushed per task — so the exports stay and no ignore entry
> is added. Re-check at Task 9's close: anything still flagged there is new.

- [ ] **Step 9: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal && git add src/lib/assignments.ts src/lib/assignments.test.ts src/lib/validation/assignments.ts src/lib/validation/assignments.test.ts src/lib/storage/attachments.ts src/lib/dates.ts tests/api/assignments-storage.test.ts && git commit -m "feat(oppgaver): derived status, attachment allowlist and signed-ticket storage helpers"
```

---

## Task 7: DAL reads — the roster-complete view and the per-role lists

The hero read is `getAssignmentForReview`: **every pupil the assignment targets**, not only those who handed in. The counts it returns are what the UI turns into navigation.

**Files:**
- Create: `src/lib/dal/assignments.ts`
- Create: `tests/api/assignments-core.test.ts`

- [ ] **Step 1: Write the failing api test**

Create `tests/api/assignments-core.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import {
  getAssignmentForReview,
  listAssignmentsForChild,
  listAssignmentsForStudent,
  listAssignmentsForTeacher,
  listClassGroups,
  listReusableAssignments,
  requireTeacherOfAssignment,
} from '@/lib/dal/assignments';
import { signInAs, signInAsAAL2, signOut } from './harness';

const A_ALFABET = 'f8000000-0000-0000-0000-000000000001'; // class-wide, K1
const A_GRUPPE = 'f8000000-0000-0000-0000-000000000002'; // group-targeted, K1
const K1 = 'fc000000-0000-0000-0000-000000000001';
const K3 = 'fc000000-0000-0000-0000-000000000002';
const YUSUF = 'fe000000-0000-0000-0000-000000000001';
const AMIRA = 'fe000000-0000-0000-0000-000000000002';
const BILAL = 'fe000000-0000-0000-0000-000000000003';

beforeEach(() => {
  signOut();
});

describe('the guard', () => {
  it('admits the assignment''s own teacher', async () => {
    await signInAsAAL2('laerer@test.local');
    const guard = await requireTeacherOfAssignment(A_ALFABET);
    expect(guard).not.toBeNull();
    expect(guard?.classId).toBe(K1);
    expect(guard?.dueOn).toBe('2026-09-12');
  });

  it('is enumeration-quiet for a foreign teacher and for nonsense ids', async () => {
    await signInAsAAL2('laererforelder@test.local');
    expect(await requireTeacherOfAssignment(A_ALFABET)).toBeNull();
    expect(await requireTeacherOfAssignment('ikke-en-uuid')).toBeNull();
  });
});

describe('★ the roster-complete review view (the phase''s hero)', () => {
  it('lists EVERY pupil of a class-wide assignment, not only those who handed in', async () => {
    await signInAsAAL2('laerer@test.local');
    const view = await getAssignmentForReview(A_ALFABET);
    expect(view).not.toBeNull();
    // K1 holds Yusuf and Bilal. Only Yusuf handed in — Bilal must be a ROW.
    expect(view!.entries.map((e) => e.student_id).sort()).toEqual([YUSUF, BILAL].sort());
    const bilal = view!.entries.find((e) => e.student_id === BILAL)!;
    expect(bilal.status).toBe('ikke_levert');
    expect(bilal.submission_id).toBeNull();
  });

  it('derives vurdert for the reviewed pupil and exposes the counts as data', async () => {
    await signInAsAAL2('laerer@test.local');
    const view = await getAssignmentForReview(A_ALFABET);
    const yusuf = view!.entries.find((e) => e.student_id === YUSUF)!;
    expect(yusuf.status).toBe('vurdert');
    expect(yusuf.review?.points).toBe(9);
    expect(view!.counts.ikke_levert).toBe(1);
    expect(view!.counts.vurdert).toBe(1);
    expect(view!.counts.levert).toBe(0);
  });

  it('groups a group-targeted assignment and hangs the shared hand-in on every member', async () => {
    await signInAsAAL2('laerer@test.local');
    const view = await getAssignmentForReview(A_GRUPPE);
    expect(view!.entries).toHaveLength(2);
    for (const entry of view!.entries) {
      expect(entry.group_name).toBe('Halaqa A');
      expect(entry.submission_id).toBe('f9000000-0000-0000-0000-000000000002');
      // Shared artefact, no review yet -> both read Levert, per D3.
      expect(entry.status).toBe('levert');
      expect(entry.review).toBeNull();
    }
  });

  it('turns a foreign teacher away with null, not with a partial view', async () => {
    await signInAsAAL2('laererforelder@test.local');
    expect(await getAssignmentForReview(A_ALFABET)).toBeNull();
  });
});

describe('per-role lists', () => {
  it('gives the teacher both assignments with an ikke-levert count each', async () => {
    await signInAsAAL2('laerer@test.local');
    const rows = await listAssignmentsForTeacher();
    expect(rows.map((r) => r.id).sort()).toEqual([A_ALFABET, A_GRUPPE].sort());
    expect(rows.find((r) => r.id === A_ALFABET)?.not_submitted_count).toBe(1);
    expect(rows.find((r) => r.id === A_GRUPPE)?.not_submitted_count).toBe(0);
  });

  it('gives the pupil their own two assignments with derived status', async () => {
    signInAs('elev@test.local');
    const rows = await listAssignmentsForStudent();
    expect(rows.map((r) => r.id).sort()).toEqual([A_ALFABET, A_GRUPPE].sort());
    expect(rows.find((r) => r.id === A_ALFABET)?.status).toBe('vurdert');
    expect(rows.find((r) => r.id === A_GRUPPE)?.status).toBe('levert');
  });

  it('shows a parent their own child and refuses another family''s', async () => {
    signInAs('forelder@test.local');
    const own = await listAssignmentsForChild(YUSUF);
    expect(own).not.toBeNull();
    expect(own!.map((r) => r.id).sort()).toEqual([A_ALFABET, A_GRUPPE].sort());
    // Amira is in K3, which has no assignments — a real empty, not a denial.
    expect(await listAssignmentsForChild(AMIRA)).toEqual([]);
    // Zaynab belongs to forelder2.
    expect(await listAssignmentsForChild('fe000000-0000-0000-0000-000000000004')).toBeNull();
  });

  it('★ a group-mate''s review never reaches the other family''s parent', async () => {
    signInAs('laererforelder@test.local');
    const rows = await listAssignmentsForChild(BILAL);
    const gruppe = rows!.find((r) => r.id === A_GRUPPE)!;
    // Bilal shares the hand-in with Yusuf but has no review of his own.
    expect(gruppe.status).toBe('levert');
    expect(gruppe.review).toBeNull();
  });

  it('lists the class''s group templates for its teacher only', async () => {
    await signInAsAAL2('laerer@test.local');
    const groups = await listClassGroups(K1);
    expect(groups).not.toBeNull();
    expect(groups![0].name).toBe('Halaqa A');
    expect(groups![0].members).toHaveLength(2);
    expect(await listClassGroups(K3)).toBeNull();
  });

  it('offers the teacher their own past assignments for reuse, newest first', async () => {
    await signInAsAAL2('laerer@test.local');
    const rows = await listReusableAssignments();
    expect(rows.map((r) => r.id)).toEqual([A_GRUPPE, A_ALFABET]);
    expect(rows[0].class_name).toBe('Klasse 1');
  });
});
```

Replace the escaped apostrophes in the test names above with plain apostrophes inside double-quoted strings.

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /Users/daodilyas/dev/iqra-portal && npm run test:api -- assignments-core
```

Expected: FAIL — `Cannot find module '@/lib/dal/assignments'`.

- [ ] **Step 3: Write the DAL**

Create `src/lib/dal/assignments.ts`:

```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { deriveStatus, STATUS_ORDER, type SubmissionStatus } from '@/lib/assignments';
import { osloDateOf } from '@/lib/dates';
import { getCurrentTerm } from '@/lib/dal/terms';
import { requireRole, requireStaffRole } from './session';

export interface AttachmentRow {
  id: string;
  path: string;
  filename: string;
  mime: string;
  size_bytes: number;
}

export interface ReviewRow {
  status: 'godkjent' | 'ny_innlevering';
  points: number | null;
  feedback: string | null;
}

export interface AssignmentListRow {
  id: string;
  class_id: string;
  class_name: string;
  subject_name: string;
  title: string;
  due_on: string;
  submission_type: 'digital' | 'none';
  is_group: boolean;
  target_count: number;
  not_submitted_count: number;
}

export interface RosterEntry {
  student_id: string;
  first_name: string;
  last_name: string;
  protected: boolean;
  group_id: string | null;
  group_name: string | null;
  submission_id: string | null;
  submitted_at: string | null;
  body: string | null;
  status: SubmissionStatus;
  review: ReviewRow | null;
  attachments: AttachmentRow[];
}

export interface AssignmentReviewView {
  assignment: {
    id: string;
    class_id: string;
    class_name: string;
    subject_name: string;
    title: string;
    instructions: string | null;
    due_on: string;
    submission_type: 'digital' | 'none';
    is_group: boolean;
  };
  attachments: AttachmentRow[];
  entries: RosterEntry[];
  counts: Record<SubmissionStatus, number>;
}

export interface StudentAssignmentRow {
  id: string;
  title: string;
  instructions: string | null;
  subject_name: string;
  due_on: string;
  submission_type: 'digital' | 'none';
  status: SubmissionStatus;
  group_name: string | null;
  group_mates: string[];
  submission_id: string | null;
  body: string | null;
  review: ReviewRow | null;
  attachments: AttachmentRow[];
  submission_attachments: AttachmentRow[];
}

export interface ClassGroupRow {
  id: string;
  name: string;
  sort: number;
  members: { student_id: string; first_name: string; last_name: string }[];
}

export interface ReusableAssignmentRow {
  id: string;
  title: string;
  subject_name: string;
  class_name: string;
  term_name: string;
  due_on: string;
  attachment_count: number;
}

const nbCollator = new Intl.Collator('nb');

function emptyCounts(): Record<SubmissionStatus, number> {
  return { ikke_levert: 0, levert: 0, levert_etter_frist: 0, vurdert: 0 };
}

function byName(
  a: { last_name: string; first_name: string },
  b: { last_name: string; first_name: string },
): number {
  return (
    nbCollator.compare(a.last_name, b.last_name) ||
    nbCollator.compare(a.first_name, b.first_name)
  );
}

/**
 * DAL guard for every assignment write path: teacher role + AAL2, then the
 * caller teaches the assignment's class. Enumeration-quiet null otherwise —
 * a foreign assignment id is indistinguishable from a nonexistent one.
 */
export async function requireTeacherOfAssignment(
  assignmentId: string,
): Promise<{ userId: string; classId: string; dueOn: string; title: string } | null> {
  const { user } = await requireStaffRole('teacher');
  const supabase = await createClient();
  const { data: assignment, error } = await supabase
    .from('assignments')
    .select('id, class_id, due_on, title')
    .eq('id', assignmentId)
    .maybeSingle();
  if (error) {
    if (error.code === '22P02') return null;
    throw new Error(`Kunne ikke lese oppgaven: ${error.message}`);
  }
  if (!assignment) return null;
  const { data: link, error: linkError } = await supabase
    .from('class_teachers')
    .select('teacher_id')
    .eq('class_id', assignment.class_id)
    .eq('teacher_id', user.id)
    .maybeSingle();
  if (linkError) {
    throw new Error(`Kunne ikke verifisere oppgavetilhørighet: ${linkError.message}`);
  }
  if (!link) return null;
  return {
    userId: user.id,
    classId: assignment.class_id,
    dueOn: assignment.due_on,
    title: assignment.title,
  };
}

/**
 * The targeting resolution, in ONE place on the read side — the mirror of
 * private.student_in_assignment. Group-targeted assignments resolve through
 * the frozen member rows; class-wide ones through the class roster as of
 * due_on. Everything downstream treats the result identically, which is what
 * stops the two shapes drifting apart in the UI.
 */
async function resolveTargets(
  assignmentId: string,
  classId: string,
  dueOn: string,
): Promise<
  {
    student_id: string;
    first_name: string;
    last_name: string;
    protected: boolean;
    group_id: string | null;
    group_name: string | null;
  }[]
> {
  const supabase = await createClient();
  const { data: groups, error: groupsError } = await supabase
    .from('assignment_groups')
    .select(
      'id, name, assignment_group_members(student_id, students!inner(id, first_name, last_name, protected))',
    )
    .eq('assignment_id', assignmentId);
  if (groupsError) {
    throw new Error(`Kunne ikke lese gruppene: ${groupsError.message}`);
  }

  if ((groups ?? []).length > 0) {
    return (groups ?? [])
      .flatMap((group) =>
        (group.assignment_group_members ?? []).map((member) => ({
          student_id: member.students.id,
          first_name: member.students.first_name,
          last_name: member.students.last_name,
          protected: member.students.protected,
          group_id: group.id,
          group_name: group.name,
        })),
      )
      .sort((a, b) => nbCollator.compare(a.group_name!, b.group_name!) || byName(a, b));
  }

  const { data: roster, error: rosterError } = await supabase
    .from('class_students')
    .select('student_id, students!inner(id, first_name, last_name, protected)')
    .eq('class_id', classId)
    .lte('enrolled_on', dueOn)
    .or(`left_on.is.null,left_on.gt.${dueOn}`);
  if (rosterError) {
    throw new Error(`Kunne ikke lese klasselisten: ${rosterError.message}`);
  }
  return (roster ?? [])
    .map((row) => ({
      student_id: row.students.id,
      first_name: row.students.first_name,
      last_name: row.students.last_name,
      protected: row.students.protected,
      group_id: null,
      group_name: null,
    }))
    .sort(byName);
}

/**
 * ★ The hero read. Every targeted pupil is a ROW — a non-submitter is never
 * an absence. This is the gap the demo had and the single feature teachers
 * named as the reason they like Classroom.
 */
export async function getAssignmentForReview(
  assignmentId: string,
): Promise<AssignmentReviewView | null> {
  const guard = await requireTeacherOfAssignment(assignmentId);
  if (!guard) return null;
  const supabase = await createClient();

  const { data: assignment, error: assignmentError } = await supabase
    .from('assignments')
    .select(
      'id, class_id, title, instructions, due_on, submission_type, classes(name), subjects(name)',
    )
    .eq('id', assignmentId)
    .single();
  if (assignmentError) {
    throw new Error(`Kunne ikke lese oppgaven: ${assignmentError.message}`);
  }

  const targets = await resolveTargets(assignmentId, guard.classId, guard.dueOn);

  const { data: submissions, error: submissionsError } = await supabase
    .from('submissions')
    .select(
      'id, student_id, assignment_group_id, body, submitted_at, submission_attachments(id, path, filename, mime, size_bytes)',
    )
    .eq('assignment_id', assignmentId);
  if (submissionsError) {
    throw new Error(`Kunne ikke lese innleveringene: ${submissionsError.message}`);
  }
  const byStudent = new Map(
    (submissions ?? []).filter((s) => s.student_id).map((s) => [s.student_id!, s]),
  );
  const byGroup = new Map(
    (submissions ?? [])
      .filter((s) => s.assignment_group_id)
      .map((s) => [s.assignment_group_id!, s]),
  );

  const { data: reviews, error: reviewsError } = await supabase
    .from('assignment_reviews')
    .select('student_id, status, points, feedback')
    .eq('assignment_id', assignmentId);
  if (reviewsError) {
    throw new Error(`Kunne ikke lese vurderingene: ${reviewsError.message}`);
  }
  const reviewByStudent = new Map((reviews ?? []).map((r) => [r.student_id, r]));

  const { data: attachments, error: attachmentsError } = await supabase
    .from('assignment_attachments')
    .select('id, path, filename, mime, size_bytes')
    .eq('assignment_id', assignmentId)
    .order('created_at', { ascending: true });
  if (attachmentsError) {
    throw new Error(`Kunne ikke lese vedleggene: ${attachmentsError.message}`);
  }

  const counts = emptyCounts();
  const entries: RosterEntry[] = targets.map((target) => {
    const submission = target.group_id
      ? byGroup.get(target.group_id)
      : byStudent.get(target.student_id);
    const review = reviewByStudent.get(target.student_id) ?? null;
    const status = deriveStatus({
      dueOn: guard.dueOn,
      submittedOn: submission ? osloDateOf(submission.submitted_at) : null,
      reviewed: review !== null,
    });
    counts[status] += 1;
    return {
      student_id: target.student_id,
      first_name: target.first_name,
      last_name: target.last_name,
      protected: target.protected,
      group_id: target.group_id,
      group_name: target.group_name,
      submission_id: submission?.id ?? null,
      submitted_at: submission?.submitted_at ?? null,
      body: submission?.body ?? null,
      status,
      review: review
        ? { status: review.status, points: review.points, feedback: review.feedback }
        : null,
      attachments: submission?.submission_attachments ?? [],
    };
  });

  return {
    assignment: {
      id: assignment.id,
      class_id: assignment.class_id,
      class_name: assignment.classes?.name ?? '',
      subject_name: assignment.subjects?.name ?? '',
      title: assignment.title,
      instructions: assignment.instructions,
      due_on: assignment.due_on,
      submission_type: assignment.submission_type as 'digital' | 'none',
      is_group: targets.some((t) => t.group_id !== null),
    },
    attachments: attachments ?? [],
    entries,
    counts,
  };
}

/** The teacher's list across own classes in the current term; the
 *  ikke-levert count per row IS the attention signal. */
export async function listAssignmentsForTeacher(): Promise<AssignmentListRow[]> {
  const { user } = await requireStaffRole('teacher');
  const term = await getCurrentTerm();
  if (!term) return [];
  const supabase = await createClient();
  // The explicit .eq on teacher_id is load-bearing (the .eq discipline): RLS
  // also admits admins, so a bare select over-returns for dual-role users.
  const { data: taught, error: taughtError } = await supabase
    .from('class_teachers')
    .select('class_id, classes!inner(id, name, term_id)')
    .eq('teacher_id', user.id)
    .eq('classes.term_id', term.id);
  if (taughtError) {
    throw new Error(`Kunne ikke lese egne klasser: ${taughtError.message}`);
  }
  const classIds = (taught ?? []).map((row) => row.class_id);
  if (classIds.length === 0) return [];

  const { data, error } = await supabase
    .from('assignments')
    .select(
      'id, class_id, title, due_on, submission_type, classes(name), subjects(name), ' +
        'assignment_groups(id, assignment_group_members(student_id)), ' +
        'submissions(student_id, assignment_group_id)',
    )
    .in('class_id', classIds)
    .order('due_on', { ascending: false });
  if (error) {
    throw new Error(`Kunne ikke lese oppgavene: ${error.message}`);
  }

  const rows: AssignmentListRow[] = [];
  for (const assignment of data ?? []) {
    const groups = assignment.assignment_groups ?? [];
    const isGroup = groups.length > 0;
    let targetCount: number;
    let notSubmitted: number;
    if (isGroup) {
      targetCount = groups.reduce(
        (sum, g) => sum + (g.assignment_group_members ?? []).length,
        0,
      );
      const handedIn = new Set(
        (assignment.submissions ?? [])
          .map((s) => s.assignment_group_id)
          .filter((id): id is string => id !== null),
      );
      notSubmitted = groups
        .filter((g) => !handedIn.has(g.id))
        .reduce((sum, g) => sum + (g.assignment_group_members ?? []).length, 0);
    } else {
      const { count, error: countError } = await supabase
        .from('class_students')
        .select('student_id', { count: 'exact', head: true })
        .eq('class_id', assignment.class_id)
        .lte('enrolled_on', assignment.due_on)
        .or(`left_on.is.null,left_on.gt.${assignment.due_on}`);
      if (countError) {
        throw new Error(`Kunne ikke telle klasselisten: ${countError.message}`);
      }
      targetCount = count ?? 0;
      const handedIn = new Set(
        (assignment.submissions ?? [])
          .map((s) => s.student_id)
          .filter((id): id is string => id !== null),
      );
      notSubmitted = Math.max(0, targetCount - handedIn.size);
    }
    rows.push({
      id: assignment.id,
      class_id: assignment.class_id,
      class_name: assignment.classes?.name ?? '',
      subject_name: assignment.subjects?.name ?? '',
      title: assignment.title,
      due_on: assignment.due_on,
      submission_type: assignment.submission_type as 'digital' | 'none',
      is_group: isGroup,
      target_count: targetCount,
      not_submitted_count: notSubmitted,
    });
  }
  return rows;
}

/**
 * One pupil's assignments, shaped for the pupil/parent surfaces. RLS has
 * already narrowed `assignments` to what this caller may see, so the read is
 * "everything visible, resolved for THIS pupil".
 */
async function readAssignmentsForStudent(
  studentId: string,
): Promise<StudentAssignmentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('assignments')
    .select(
      'id, title, instructions, due_on, submission_type, subjects(name), ' +
        'assignment_attachments(id, path, filename, mime, size_bytes), ' +
        'assignment_groups(id, name, assignment_group_members(student_id, students(first_name, last_name))), ' +
        'submissions(id, student_id, assignment_group_id, body, submitted_at, submission_attachments(id, path, filename, mime, size_bytes)), ' +
        'assignment_reviews(student_id, status, points, feedback)',
    )
    .order('due_on', { ascending: false });
  if (error) {
    throw new Error(`Kunne ikke lese leksene: ${error.message}`);
  }

  const rows: StudentAssignmentRow[] = [];
  for (const assignment of data ?? []) {
    const groups = assignment.assignment_groups ?? [];
    const myGroup = groups.find((g) =>
      (g.assignment_group_members ?? []).some((m) => m.student_id === studentId),
    );
    // Group-targeted assignments this pupil is not part of never reach here
    // (RLS), but a guardian of two children in the same class could see the
    // row through the sibling — resolve strictly for the requested pupil.
    if (groups.length > 0 && !myGroup) continue;

    const submission = myGroup
      ? (assignment.submissions ?? []).find((s) => s.assignment_group_id === myGroup.id)
      : (assignment.submissions ?? []).find((s) => s.student_id === studentId);
    const review =
      (assignment.assignment_reviews ?? []).find((r) => r.student_id === studentId) ?? null;

    rows.push({
      id: assignment.id,
      title: assignment.title,
      instructions: assignment.instructions,
      subject_name: assignment.subjects?.name ?? '',
      due_on: assignment.due_on,
      submission_type: assignment.submission_type as 'digital' | 'none',
      status: deriveStatus({
        dueOn: assignment.due_on,
        submittedOn: submission ? osloDateOf(submission.submitted_at) : null,
        reviewed: review !== null,
      }),
      group_name: myGroup?.name ?? null,
      group_mates: (myGroup?.assignment_group_members ?? [])
        .filter((m) => m.student_id !== studentId)
        .map((m) => `${m.students?.first_name ?? ''} ${m.students?.last_name ?? ''}`.trim()),
      submission_id: submission?.id ?? null,
      body: submission?.body ?? null,
      review: review
        ? { status: review.status, points: review.points, feedback: review.feedback }
        : null,
      attachments: assignment.assignment_attachments ?? [],
      submission_attachments: submission?.submission_attachments ?? [],
    });
  }
  return rows;
}

/** The pupil's own lekser (their login is linked to exactly one student row). */
export async function listAssignmentsForStudent(): Promise<StudentAssignmentRow[]> {
  const { user } = await requireRole('student');
  const supabase = await createClient();
  const { data: student, error } = await supabase
    .from('students')
    .select('id')
    .eq('student_user_id', user.id)
    .maybeSingle();
  if (error) {
    throw new Error(`Kunne ikke lese eleven: ${error.message}`);
  }
  if (!student) return [];
  return readAssignmentsForStudent(student.id);
}

/** A guardian's view of ONE of their own children; null for anyone else's. */
export async function listAssignmentsForChild(
  studentId: string,
): Promise<StudentAssignmentRow[] | null> {
  const { user } = await requireRole('parent');
  const supabase = await createClient();
  const { data: link, error } = await supabase
    .from('guardian_student')
    .select('student_id')
    .eq('guardian_id', user.id)
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) {
    if (error.code === '22P02') return null;
    throw new Error(`Kunne ikke verifisere foresattforhold: ${error.message}`);
  }
  if (!link) return null;
  return readAssignmentsForStudent(studentId);
}

/** Group templates for ONE of the caller's own classes; null for a foreign one. */
export async function listClassGroups(classId: string): Promise<ClassGroupRow[] | null> {
  const { user } = await requireStaffRole('teacher');
  const supabase = await createClient();
  const { data: link, error: linkError } = await supabase
    .from('class_teachers')
    .select('class_id')
    .eq('class_id', classId)
    .eq('teacher_id', user.id)
    .maybeSingle();
  if (linkError) {
    if (linkError.code === '22P02') return null;
    throw new Error(`Kunne ikke verifisere klassetilhørighet: ${linkError.message}`);
  }
  if (!link) return null;

  const { data, error } = await supabase
    .from('class_groups')
    .select(
      'id, name, sort, class_group_members(student_id, students(first_name, last_name))',
    )
    .eq('class_id', classId)
    .order('sort', { ascending: true });
  if (error) {
    throw new Error(`Kunne ikke lese gruppene: ${error.message}`);
  }
  return (data ?? []).map((group) => ({
    id: group.id,
    name: group.name,
    sort: group.sort,
    members: (group.class_group_members ?? [])
      .map((m) => ({
        student_id: m.student_id,
        first_name: m.students?.first_name ?? '',
        last_name: m.students?.last_name ?? '',
      }))
      .sort(byName),
  }));
}

/**
 * D10: the reuse picker. The teacher's OWN past assignments across ANY class
 * and ANY term — the parallel-class and next-year cases are the whole point.
 * The .eq on created_by is what makes a foreign assignment a quiet not-found
 * rather than an error leak.
 */
export async function listReusableAssignments(): Promise<ReusableAssignmentRow[]> {
  const { user } = await requireStaffRole('teacher');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('assignments')
    .select(
      'id, title, due_on, subjects(name), classes(name, terms(name)), assignment_attachments(id)',
    )
    .eq('created_by', user.id)
    .order('due_on', { ascending: false })
    .limit(100);
  if (error) {
    throw new Error(`Kunne ikke lese tidligere oppgaver: ${error.message}`);
  }
  return (data ?? []).map((assignment) => ({
    id: assignment.id,
    title: assignment.title,
    subject_name: assignment.subjects?.name ?? '',
    class_name: assignment.classes?.name ?? '',
    term_name: assignment.classes?.terms?.name ?? '',
    due_on: assignment.due_on,
    attachment_count: (assignment.assignment_attachments ?? []).length,
  }));
}

export { STATUS_ORDER };
```

- [ ] **Step 4: Run the api test to verify it passes**

```bash
cd /Users/daodilyas/dev/iqra-portal && npm run test:api -- assignments-core && npm run typecheck
```

Expected: PASS, 11/11, typecheck clean. If a nested-select type mismatch appears, regenerate types first: `npm run db:types`.

> **Execution ledger — corrected during Task 7 (2026-07-29).** The count above is
> wrong: the file ends at **13 tests** (the plan's 11 was already wrong at 12
> before the Oslo-boundary test was added), confirmed by the runner and by
> `grep -c "  it("`. `database.types.ts` needed no regeneration.
>
> ### ★ The DAL above leaked one child's assignments onto another child's screen
>
> `readAssignmentsForStudent` re-resolved targeting for the **group** shape only
> (`if (groups.length > 0 && !myGroup) continue;`). But RLS narrows `assignments`
> to what the **caller** may see, and for a guardian that is the UNION across
> every child they have — so the visible set is not the requested pupil's set. A
> **class-wide** assignment in a sibling's class passed the filter untouched and
> rendered on this pupil's screen as *Ikke levert*: homework they were never set,
> shown as missing, on the most sensitive surface in the app. The plan's own
> comment claimed the property the code did not deliver. Caught by the plan's own
> `listAssignmentsForChild(AMIRA)` test on the first run — Yusuf's Klasse 1
> assignment surfaced for Amira in Klasse 3.
>
> Fixed by mirroring `private.student_in_assignment` (as redefined at
> `20260728093000_submissions_reviews.sql:115`) **branch for branch**: frozen
> group membership → own hand-in (the retention branch) → class roster as of
> `due_on` with `left_on` exclusive. Group hand-ins carry `student_id = null`, so
> they fall to branch 1 and never to the retention branch. Verified against the
> SQL by the controller, not just by the passing test.
>
> **Standing rule this generalises to:** any DAL read that takes a `studentId`
> must re-resolve targeting itself. RLS answers "may the caller see this row?",
> never "does this row belong to the pupil being asked about". Every remaining
> per-child read in Tasks 8–13 owes the same check.
>
> **The same defect then turned up a second time, in the other direction.**
> Review caught that `resolveTargets` — the hero read's own roster builder —
> mirrored branches 1 and 3 but **not** the retention branch, so the two reads in
> one file disagreed about who is in an assignment. A pupil who handed in and
> whose enrolment later stopped covering `due_on` (the teacher pushes the frist,
> or an admin stamps `left_on`) had their submission **fetched and then silently
> dropped**: no roster row, no count, unreachable from the only screen the teacher
> reviews from — while the pupil still saw their own work, because RLS retains
> them. Worse than the leak in one respect: not "a non-submitter is missing" but
> "a pupil who *did* hand in is missing", in a read whose entire premise is that
> nobody is silently absent. **Fixing one call site of a mirrored predicate is not
> fixing the mirror — grep for every site.**
>
> ### `group_mates` returns `['']` — always, for every pupil
>
> `students` RLS gives a pupil only their own row and a guardian only their own
> children (`20260717164230:201-208`); `students_select_taught_ever` is
> teacher-only. A group mate is by definition another family's child, so the
> nested `students` embed is `null` and the name interpolates to `''`. Verified
> against the live stack. No test asserted the field, which is why it shipped.
> The `assignment_groups` policy comment (`20260728092000:212-214`) states the
> intent it serves — the pupil surface showing «du er i gruppe Halaqa A med …» —
> so Tasks 12–13 would have rendered blank chips.
>
> Interim fix: the field became `{ student_id: string; name: string | null }[]`,
> which is honest and forward-compatible. **Showing mates' names needs a new RLS
> policy on `students`, i.e. exposing one family's child's name to another
> family — a child-data privacy expansion and a new security wall. That is the
> user's decision, deliberately not taken by an implementer.** If approved it
> should follow the `students_select_taught_ever` precedent, including its
> `and protected = false` guard, and the phase PR's full review panel covers it.
>
> ### Other corrections
>
> - **The `'…' + '…'` select strings do not typecheck** — 41 `GenericStringError`
>   / implicit-any errors. TypeScript does not constant-fold `+` on string
>   literals, so postgrest-js's type parser receives `string`. Use multi-line
>   **template literals**; postgrest-js strips unquoted whitespace before the
>   request (`PostgrestQueryBuilder.ts:933-949`), so newlines cost nothing.
> - **`ReviewRow.status` needs narrowing.** `assignment_reviews.status` is `text`
>   + CHECK, so the generated type is `string`. A `toReviewRow()` helper shared by
>   both readers, matching the plan's own `submission_type as 'digital' | 'none'`
>   idiom.
> - **Use `PG_ERROR.INVALID_TEXT`, not a bare `'22P02'`** — `src/lib/pg-error.ts`
>   exists to keep SQLSTATE literals out of the DAL.
> - **`export { STATUS_ORDER };` at the end of this task is dead code — delete it.**
>   Task 11 imports `STATUS_ORDER` from `@/lib/assignments` directly, so the
>   re-export has no consumer anywhere in the plan. knip resolves re-export
>   chains, so a pass-through never reduces the unused count — it only relocates
>   the entry to the re-export site. Consume `STATUS_ORDER` in `emptyCounts()`
>   instead, which also stops a hand-written status list there from drifting.
>
> ### Assertions that cannot fail — two accepted, one closed
>
> Thirteen mutants were run against this task; ten were killed. Of the three
> survivors:
> - **Closed:** substituting the raw `submitted_at` for `osloDateOf(...)` changed
>   nothing, because every seeded hand-in is months from its due date. Closed in
>   the test by temporarily moving one hand-in's `submitted_at` across the Oslo
>   day boundary and restoring it. **Use the unreviewed group hand-in** — a review
>   makes `deriveStatus` return `vurdert` regardless, which would re-create the
>   very problem being fixed.
> - **Accepted:** dropping `.eq('created_by', user.id)` from the reuse picker
>   changes nothing, since both seeded assignments are that teacher's and RLS
>   already scopes her. It bites only for a dual-role admin+teacher, and proving
>   it needs a temporary role grant that mutates shared auth state.
> - **Accepted, moved to Task 8:** `expect(gruppe.review).toBeNull()` cannot fail,
>   because A_GRUPPE has no review rows — deliberately, per Task 4's seed comment.
>   See the rider on Task 8.

- [ ] **Step 5: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal && git add src/lib/dal/assignments.ts tests/api/assignments-core.test.ts src/lib/supabase/database.types.ts && git commit -m "feat(oppgaver): roster-complete review read and per-role assignment lists"
```

---

## Task 8: Actions — create with frozen groups, hand-in, review, attachments

Creating a group assignment is **one transaction** (§3). Doing it as three sequential PostgREST calls has a specific, dangerous failure: if the assignment row lands and the group rows do not, the result is an assignment with zero `assignment_groups` — which is the encoding for **class-wide**. A half-failed group task would silently become visible to the whole class. That is why this task adds an RPC.

> ⚠ **Riders carried forward from Task 7's review (2026-07-29).**
>
> 1. **D3 owes a real per-pupil review assertion, and this is the task that can
>    pay it.** Task 7's `expect(gruppe.review).toBeNull()` cannot fail: A_GRUPPE
>    has no review rows, deliberately — Task 4's seed comment keeps the group
>    assignment unreviewed so per-pupil review across a shared hand-in can be
>    proven from a clean start, and seeding a mark would pre-decide it. Now that
>    reviews can be **created**, assert the thing itself: review member A of a
>    shared group hand-in, then read member B and prove B's review is still null
>    and B's status is unchanged. That is D3's headline claim and nothing has
>    tested it yet.
> 2. **Every per-child read must re-resolve targeting itself.** Task 7 shipped a
>    cross-child leak because RLS answers "may the caller see this row?", never
>    "does this row belong to the pupil being asked about" — and for a guardian
>    the visible set is the union across all their children. Any action or read
>    added here that takes a `studentId` owes the same
>    `private.student_in_assignment` mirror. See the Task 7 ledger.
> 3. **A group assignment must never acquire an individual hand-in.**
>    `can_write_submission` permits `sid` non-null with `agid` null whenever
>    `student_in_assignment` is true, and branch 1 makes that true for every group
>    member — so the row is reachable today and `submissions_owner_xor` allows it.
>    Task 7 resolved it *read-tolerantly* (`byGroup.get(gid) ?? byStudent.get(sid)`,
>    so a stray row is visible rather than silently dropped). **This task owes the
>    strict half:** the hand-in action must attach to the pupil's frozen group when
>    one exists, never to the pupil, and a test must prove it. Read tolerantly,
>    write strictly — the read cannot be the only guard, because before Task 7's
>    fix the list and the detail screen disagreed (`not_submitted_count: 1` against
>    `ikke_levert: 2`) with the actual hand-in rendered nowhere.
> 4. **Validate `due_on` inside the class's term at creation.** `assignments.due_on`
>    is a bare `date not null` (`20260728092000:32`) with no CHECK against
>    `classes.term_id`'s range, and Task 7's two reads now scope by **different
>    things** — `listAssignmentsForTeacher` by `classes.term_id`, the pupil/parent
>    read by a `due_on` window (it cannot join `classes`; see the Task 7 ledger).
>    So holiday homework due 2027-01-05 against a term ending 2026-12-20 stays on
>    the teacher's list while vanishing from the pupil's and parent's entirely,
>    taking any already-submitted work with it. Validating at creation makes the
>    two scopings equivalent by construction, which a CHECK constraint cannot do
>    (it would need a join). Reject with a Norwegian message naming the term's
>    dates.

**Files:**
- Create: `supabase/migrations/20260728095000_create_assignment_rpc.sql`
- Create: `src/app/(portal)/laerer/oppgaver/actions.ts`
- Create: `src/app/(portal)/laerer/oppgaver/[assignmentId]/actions.ts`
- Create: `src/app/(portal)/laerer/klasser/[id]/grupper/actions.ts`
- Create: `src/app/(portal)/elev/lekser/actions.ts`
- Create: `src/app/(portal)/forelder/lekser/actions.ts`
- Create: `tests/api/assignments-actions.test.ts`

- [ ] **Step 1: Write the failing api test**

Create `tests/api/assignments-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { createAssignment } from '@/app/(portal)/laerer/oppgaver/actions';
import { saveReview } from '@/app/(portal)/laerer/oppgaver/[assignmentId]/actions';
import { saveClassGroup } from '@/app/(portal)/laerer/klasser/[id]/grupper/actions';
import { submitOwnHandIn } from '@/app/(portal)/elev/lekser/actions';
import { submitChildHandIn } from '@/app/(portal)/forelder/lekser/actions';
import { getAssignmentForReview } from '@/lib/dal/assignments';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getPublicEnv } from '@/lib/env';
import { signInAs, signInAsAAL2, signOut } from './harness';

const K1 = 'fc000000-0000-0000-0000-000000000001';
const K3 = 'fc000000-0000-0000-0000-000000000002';
const ARABISK = 'fa000000-0000-0000-0000-000000000001';
const G_HALAQA_A = 'fb000000-0000-0000-0000-000000000001';
const A_ALFABET = 'f8000000-0000-0000-0000-000000000001';
const A_GRUPPE = 'f8000000-0000-0000-0000-000000000002';
const YUSUF = 'fe000000-0000-0000-0000-000000000001';
const BILAL = 'fe000000-0000-0000-0000-000000000003';
const ZAYNAB = 'fe000000-0000-0000-0000-000000000004';

const idle = { error: null };

function form(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) fd.append(key, v);
  }
  return fd;
}

function service() {
  return createSupabaseClient<Database>(
    getPublicEnv().NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

beforeEach(() => {
  signOut();
});

describe('createAssignment', () => {
  it('creates a class-wide assignment with no group rows at all', async () => {
    await signInAsAAL2('laerer@test.local');
    const state = await createAssignment(
      idle,
      form({
        class_id: K1,
        subject_id: ARABISK,
        title: 'Klasseoppgave fra test',
        instructions: 'Gjør oppgave 1-5.',
        due_on: '2026-10-01',
        submission_type: 'digital',
      }),
    );
    expect(state.error).toBeNull();
    const created = await service()
      .from('assignments')
      .select('id, assignment_groups(id)')
      .eq('title', 'Klasseoppgave fra test')
      .single();
    try {
      expect(created.data?.assignment_groups).toHaveLength(0);
    } finally {
      await service().from('assignments').delete().eq('id', created.data!.id);
    }
  });

  it('★ freezes the template members onto the assignment, so later template edits cannot rewrite it', async () => {
    await signInAsAAL2('laerer@test.local');
    const state = await createAssignment(
      idle,
      form({
        class_id: K1,
        subject_id: ARABISK,
        title: 'Gruppeoppgave fra test',
        instructions: '',
        due_on: '2026-10-02',
        submission_type: 'digital',
        group_ids: [G_HALAQA_A],
      }),
    );
    expect(state.error).toBeNull();
    const created = await service()
      .from('assignments')
      .select('id, assignment_groups(id, name, source_group_id, assignment_group_members(student_id))')
      .eq('title', 'Gruppeoppgave fra test')
      .single();
    try {
      const group = created.data!.assignment_groups[0];
      expect(group.name).toBe('Halaqa A');
      expect(group.source_group_id).toBe(G_HALAQA_A);
      expect(group.assignment_group_members.map((m) => m.student_id).sort()).toEqual(
        [YUSUF, BILAL].sort(),
      );

      // Shrink the TEMPLATE to one pupil; the frozen copy must not move.
      await service().from('class_group_members').delete().eq('group_id', G_HALAQA_A).eq('student_id', BILAL);
      const after = await service()
        .from('assignment_group_members')
        .select('student_id')
        .eq('assignment_group_id', group.id);
      expect(after.data).toHaveLength(2);
    } finally {
      await service().from('assignments').delete().eq('id', created.data!.id);
      await service()
        .from('class_group_members')
        .upsert({ group_id: G_HALAQA_A, student_id: BILAL });
    }
  });

  it('refuses a class the teacher does not teach', async () => {
    await signInAsAAL2('laerer@test.local');
    const state = await createAssignment(
      idle,
      form({
        class_id: K3,
        subject_id: ARABISK,
        title: 'Fremmed klasse',
        instructions: '',
        due_on: '2026-10-03',
        submission_type: 'digital',
      }),
    );
    expect(state.error).toBe('Du underviser ikke denne klassen.');
  });

  it('refuses a template whose size has drifted outside 2-4, naming the group', async () => {
    await signInAsAAL2('laerer@test.local');
    await service().from('class_group_members').delete().eq('group_id', G_HALAQA_A).eq('student_id', BILAL);
    try {
      const state = await createAssignment(
        idle,
        form({
          class_id: K1,
          subject_id: ARABISK,
          title: 'Skal feile',
          instructions: '',
          due_on: '2026-10-04',
          submission_type: 'digital',
          group_ids: [G_HALAQA_A],
        }),
      );
      expect(state.error).toBe('Gruppen «Halaqa A» har 1 elev. En gruppe må ha 2–4 elever.');
      const leftovers = await service()
        .from('assignments')
        .select('id')
        .eq('title', 'Skal feile');
      expect(leftovers.data).toHaveLength(0);
    } finally {
      await service()
        .from('class_group_members')
        .upsert({ group_id: G_HALAQA_A, student_id: BILAL });
    }
  });
});

describe('saveClassGroup', () => {
  it('rejects a group of one before it reaches the database', async () => {
    await signInAsAAL2('laerer@test.local');
    const state = await saveClassGroup(
      K1,
      idle,
      form({ name: 'Alene', student_ids: [YUSUF] }),
    );
    expect(state.error).toBe('En gruppe må ha 2–4 elever.');
  });

  it('refuses a pupil from another class', async () => {
    await signInAsAAL2('laerer@test.local');
    const state = await saveClassGroup(
      K1,
      idle,
      form({ name: 'Blandet', student_ids: [YUSUF, ZAYNAB] }),
    );
    expect(state.error).toBe('En eller flere elever tilhører ikke klassen.');
  });
});

describe('hand-in', () => {
  it('lets a pupil hand in and re-edit while unreviewed', async () => {
    signInAs('elev@test.local');
    const state = await submitOwnHandIn(
      A_GRUPPE,
      idle,
      form({ body: 'Vi har valgt Al-Fatiha og øvd tre ganger.' }),
    );
    expect(state.error).toBeNull();
    const row = await service()
      .from('submissions')
      .select('body')
      .eq('id', 'f9000000-0000-0000-0000-000000000002')
      .single();
    expect(row.data?.body).toBe('Vi har valgt Al-Fatiha og øvd tre ganger.');
    await service()
      .from('submissions')
      .update({ body: 'Vi har valgt Al-Fatiha.' })
      .eq('id', 'f9000000-0000-0000-0000-000000000002');
  });

  it('★ refuses a parent handing in for a child who is not in the assignment', async () => {
    signInAs('forelder2@test.local');
    const state = await submitChildHandIn(
      A_ALFABET,
      ZAYNAB,
      idle,
      form({ body: 'Skal avvises.' }),
    );
    expect(state.error).toBe('Eleven har ikke denne oppgaven.');
  });
});

describe('saveReview (D3 — per pupil, even on a shared hand-in)', () => {
  it('marks one group member without touching the other', async () => {
    await signInAsAAL2('laerer@test.local');
    const state = await saveReview(
      A_GRUPPE,
      idle,
      form({ student_id: YUSUF, status: 'godkjent', points: '8', feedback: 'Tydelig resitasjon.' }),
    );
    expect(state.error).toBeNull();
    try {
      const view = await getAssignmentForReview(A_GRUPPE);
      const yusuf = view!.entries.find((e) => e.student_id === YUSUF)!;
      const bilal = view!.entries.find((e) => e.student_id === BILAL)!;
      expect(yusuf.status).toBe('vurdert');
      expect(yusuf.review?.points).toBe(8);
      // Same submission row, different standing — the whole point of D3.
      expect(bilal.submission_id).toBe(yusuf.submission_id);
      expect(bilal.status).toBe('levert');
      expect(bilal.review).toBeNull();
    } finally {
      await service()
        .from('assignment_reviews')
        .delete()
        .eq('assignment_id', A_GRUPPE)
        .eq('student_id', YUSUF);
    }
  });

  it('refuses to review a pupil the assignment does not target', async () => {
    await signInAsAAL2('laerer@test.local');
    const state = await saveReview(
      A_GRUPPE,
      idle,
      form({ student_id: ZAYNAB, status: 'godkjent', points: '', feedback: '' }),
    );
    expect(state.error).toBe('Eleven har ikke denne oppgaven.');
  });

  it('refuses a foreign teacher', async () => {
    await signInAsAAL2('laererforelder@test.local');
    const state = await saveReview(
      A_ALFABET,
      idle,
      form({ student_id: YUSUF, status: 'godkjent', points: '', feedback: '' }),
    );
    expect(state.error).toBe('Du underviser ikke denne oppgaven.');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /Users/daodilyas/dev/iqra-portal && npm run test:api -- assignments-actions
```

Expected: FAIL — the action modules do not exist.

- [ ] **Step 3: Write the atomic-create RPC**

Create `supabase/migrations/20260728095000_create_assignment_rpc.sql`:

```sql
-- Creating a group assignment is ONE transaction (design spec §3), and the
-- reason is sharper than tidiness: zero assignment_groups rows is the
-- ENCODING for "class-wide". If the assignment row committed and the group
-- rows did not, a task meant for four pupils would silently become visible to
-- the whole class — a quiet privacy failure with no error anywhere.
--
-- security INVOKER (the default, stated for the reader): every statement in
-- here runs under the caller's own RLS, so this function grants nothing. It
-- buys atomicity, not privilege. set search_path = '' means every reference is
-- schema-qualified.
--
-- D2 (2-4 members) is re-checked here as a backstop against the read-then-
-- write race: the action validates sizes from what it displayed, this catches
-- a template edited in between. The message carries the group name so the
-- caller can map it to Norwegian without a second query.
create or replace function public.create_assignment_with_groups(
  p_id              uuid,
  p_class_id        uuid,
  p_subject_id      uuid,
  p_title           text,
  p_instructions    text,
  p_due_on          date,
  p_submission_type text,
  p_group_ids       uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_template   record;
  v_group_id   uuid;
  v_member_cnt integer;
begin
  insert into public.assignments
    (id, class_id, subject_id, title, instructions, due_on, submission_type, created_by)
  values
    (p_id, p_class_id, p_subject_id, p_title, p_instructions, p_due_on,
     p_submission_type, (select auth.uid()));

  foreach v_group_id in array coalesce(p_group_ids, array[]::uuid[]) loop
    select cg.id, cg.name, cg.class_id
      into v_template
      from public.class_groups cg
      where cg.id = v_group_id;

    if v_template.id is null then
      raise exception 'GROUP_MISSING' using errcode = 'P0001';
    end if;
    if v_template.class_id <> p_class_id then
      raise exception 'GROUP_FOREIGN' using errcode = 'P0001';
    end if;

    insert into public.assignment_groups (assignment_id, name, source_group_id)
    values (p_id, v_template.name, v_template.id)
    returning id into v_group_id;

    insert into public.assignment_group_members (assignment_group_id, student_id)
    select v_group_id, cgm.student_id
      from public.class_group_members cgm
      where cgm.group_id = v_template.id;

    get diagnostics v_member_cnt = row_count;
    if v_member_cnt < 2 or v_member_cnt > 4 then
      raise exception 'GROUP_SIZE|%|%', v_template.name, v_member_cnt
        using errcode = 'P0001';
    end if;
  end loop;

  return p_id;
end;
$$;

revoke execute on function public.create_assignment_with_groups(
  uuid, uuid, uuid, text, text, date, text, uuid[]
) from public, anon;
grant execute on function public.create_assignment_with_groups(
  uuid, uuid, uuid, text, text, date, text, uuid[]
) to authenticated;
```

**Careful:** `v_group_id` is reused as both the loop variable and the `returning` target. Rename the inserted group's id to a separate variable `v_new_group_id` and use it in the member insert, or the next loop iteration reads the wrong template. Write it with two variables:

```sql
declare
  v_template     record;
  v_group_id     uuid;
  v_new_group_id uuid;
  v_member_cnt   integer;
```

and inside the loop use `returning id into v_new_group_id;` then `insert into public.assignment_group_members (assignment_group_id, student_id) select v_new_group_id, ...`.

- [ ] **Step 4: Write the teacher actions**

Create `src/app/(portal)/laerer/oppgaver/actions.ts`:

```ts
'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaffRole } from '@/lib/dal/session';
import { requireTeacherOfAssignment } from '@/lib/dal/assignments';
import { attachmentPath, groupSizeOk } from '@/lib/assignments';
import {
  assignmentSchema,
  uploadRequestSchema,
} from '@/lib/validation/assignments';
import { firstIssue, type FormState } from '@/lib/validation/school';
import {
  createUploadTicket,
  readObjectMeta,
  removeObject,
} from '@/lib/storage/attachments';

/** Maps the RPC's structured raises to Norwegian (see migration 095000). */
function mapCreateError(message: string): string {
  if (message.includes('GROUP_SIZE|')) {
    const [, name, count] = message.split('GROUP_SIZE|')[1].split('|').length === 2
      ? ['', ...message.split('GROUP_SIZE|')[1].split('|')]
      : ['', 'gruppen', '0'];
    return `Gruppen «${name}» har ${count} ${count === '1' ? 'elev' : 'elever'}. En gruppe må ha 2–4 elever.`;
  }
  if (message.includes('GROUP_FOREIGN')) {
    return 'En av gruppene tilhører en annen klasse.';
  }
  if (message.includes('GROUP_MISSING')) {
    return 'En av gruppene finnes ikke lenger.';
  }
  return `Kunne ikke opprette oppgaven: ${message}`;
}

export async function createAssignment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireStaffRole('teacher');
  const parsed = assignmentSchema.safeParse({
    class_id: formData.get('class_id'),
    subject_id: formData.get('subject_id'),
    title: formData.get('title'),
    instructions: formData.get('instructions'),
    due_on: formData.get('due_on'),
    submission_type: formData.get('submission_type'),
    group_ids: formData.getAll('group_ids').map(String).filter((v) => v !== ''),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  // Wall 1: the caller must teach this class. RLS would refuse anyway, but a
  // mapped Norwegian sentence beats a raw 42501 for the teacher.
  const { data: link, error: linkError } = await supabase
    .from('class_teachers')
    .select('class_id')
    .eq('class_id', parsed.data.class_id)
    .eq('teacher_id', user.id)
    .maybeSingle();
  if (linkError) return { error: `Kunne ikke verifisere klassen: ${linkError.message}` };
  if (!link) return { error: 'Du underviser ikke denne klassen.' };

  // Pre-validate group sizes so the teacher gets the group's NAME, not a
  // constraint message. The RPC re-checks — this read can go stale.
  if (parsed.data.group_ids.length > 0) {
    const { data: templates, error: templateError } = await supabase
      .from('class_groups')
      .select('id, name, class_id, class_group_members(student_id)')
      .in('id', parsed.data.group_ids);
    if (templateError) return { error: `Kunne ikke lese gruppene: ${templateError.message}` };
    for (const id of parsed.data.group_ids) {
      const template = (templates ?? []).find((t) => t.id === id);
      if (!template) return { error: 'En av gruppene finnes ikke lenger.' };
      if (template.class_id !== parsed.data.class_id) {
        return { error: 'En av gruppene tilhører en annen klasse.' };
      }
      const size = (template.class_group_members ?? []).length;
      if (!groupSizeOk(size)) {
        return {
          error: `Gruppen «${template.name}» har ${size} ${size === 1 ? 'elev' : 'elever'}. En gruppe må ha 2–4 elever.`,
        };
      }
    }
  }

  const assignmentId = randomUUID();
  const { error } = await supabase.rpc('create_assignment_with_groups', {
    p_id: assignmentId,
    p_class_id: parsed.data.class_id,
    p_subject_id: parsed.data.subject_id,
    p_title: parsed.data.title,
    p_instructions: parsed.data.instructions ?? null,
    p_due_on: parsed.data.due_on,
    p_submission_type: parsed.data.submission_type,
    p_group_ids: parsed.data.group_ids,
  });
  if (error) return { error: mapCreateError(error.message) };

  revalidatePath('/laerer/oppgaver');
  revalidatePath(`/laerer/klasser/${parsed.data.class_id}`);
  return { error: null, success: true, assignmentId };
}

/**
 * R1 step 1: authorize, validate what the browser DECLARED, choose the path
 * ourselves, and hand back a ticket for exactly that path. The browser never
 * picks a path and never carries authority.
 */
export async function requestAssignmentUpload(
  assignmentId: string,
  declared: { filename: string; mime: string; size: number },
): Promise<{ error: string | null; path?: string; token?: string }> {
  const guard = await requireTeacherOfAssignment(assignmentId);
  if (!guard) return { error: 'Du underviser ikke denne oppgaven.' };
  const parsed = uploadRequestSchema.safeParse(declared);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const path = attachmentPath(assignmentId, randomUUID(), parsed.data.filename);
  try {
    const ticket = await createUploadTicket('assignments', path);
    return { error: null, path: ticket.path, token: ticket.token };
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : 'Opplastingen feilet.' };
  }
}

/**
 * R1 step 3: the row is written from what Storage ACTUALLY holds, never from
 * what the browser claimed. Orphan discipline runs the other way here — if the
 * row cannot be written we delete the object, so a stored file is always
 * reachable through a row.
 */
export async function confirmAssignmentUpload(
  assignmentId: string,
  path: string,
  filename: string,
): Promise<FormState> {
  const guard = await requireTeacherOfAssignment(assignmentId);
  if (!guard) return { error: 'Du underviser ikke denne oppgaven.' };
  if (!path.startsWith(`${assignmentId}/`)) return { error: 'Ugyldig filsti.' };

  const meta = await readObjectMeta('assignments', path);
  if (!meta) return { error: 'Filen ble ikke lastet opp. Prøv igjen.' };

  const supabase = await createClient();
  const { error } = await supabase.from('assignment_attachments').insert({
    assignment_id: assignmentId,
    path,
    filename: filename.slice(0, 255),
    mime: meta.mime,
    size_bytes: meta.size,
    uploaded_by: guard.userId,
  });
  if (error) {
    await removeObject('assignments', path).catch(() => undefined);
    if (error.code === '23505') return { error: 'Filen er allerede lagt ved.' };
    return { error: `Kunne ikke lagre vedlegget: ${error.message}` };
  }
  revalidatePath(`/laerer/oppgaver/${assignmentId}`);
  return { error: null, success: true };
}

export async function removeAssignmentAttachment(
  assignmentId: string,
  attachmentId: string,
): Promise<FormState> {
  const guard = await requireTeacherOfAssignment(assignmentId);
  if (!guard) return { error: 'Du underviser ikke denne oppgaven.' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('assignment_attachments')
    .delete()
    .eq('id', attachmentId)
    .eq('assignment_id', assignmentId)
    .select('path');
  if (error) return { error: `Kunne ikke fjerne vedlegget: ${error.message}` };
  for (const row of data ?? []) {
    await removeObject('assignments', row.path).catch(() => undefined);
  }
  revalidatePath(`/laerer/oppgaver/${assignmentId}`);
  return { error: null, success: true };
}
```

Note: `FormState` gains an optional `assignmentId`. Extend the interface in `src/lib/validation/school.ts`:

```ts
export interface FormState {
  error: string | null;
  success?: boolean;
  /** Set by createAssignment/reuseAssignment so the client can navigate. */
  assignmentId?: string;
}
```

Create `src/app/(portal)/laerer/oppgaver/[assignmentId]/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireTeacherOfAssignment } from '@/lib/dal/assignments';
import { reviewSchema } from '@/lib/validation/assignments';
import { firstIssue, type FormState } from '@/lib/validation/school';

/**
 * D3: one review per PUPIL, even when the hand-in is a shared group row.
 * The double bind is re-derived here (wall 1) before the write: teaches the
 * assignment AND the pupil is actually targeted by it.
 */
export async function saveReview(
  assignmentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await requireTeacherOfAssignment(assignmentId);
  if (!guard) return { error: 'Du underviser ikke denne oppgaven.' };

  const parsed = reviewSchema.safeParse({
    student_id: formData.get('student_id'),
    status: formData.get('status'),
    points: String(formData.get('points') ?? ''),
    feedback: formData.get('feedback'),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  // Wall 1 half of the double bind: ask the same question the policy asks.
  const { data: targeted, error: targetError } = await supabase.rpc(
    'student_in_assignment_check',
    { p_student_id: parsed.data.student_id, p_assignment_id: assignmentId },
  );
  if (targetError) {
    return { error: `Kunne ikke verifisere eleven: ${targetError.message}` };
  }
  if (!targeted) return { error: 'Eleven har ikke denne oppgaven.' };

  const { error } = await supabase.from('assignment_reviews').upsert(
    {
      assignment_id: assignmentId,
      student_id: parsed.data.student_id,
      status: parsed.data.status,
      points: parsed.data.points,
      feedback: parsed.data.feedback ?? null,
      reviewed_by: guard.userId,
      reviewed_at: new Date().toISOString(),
    },
    { onConflict: 'assignment_id,student_id' },
  );
  if (error) {
    if (error.code === '23503') return { error: 'Oppgaven eller eleven finnes ikke lenger.' };
    return { error: `Kunne ikke lagre vurderingen: ${error.message}` };
  }
  revalidatePath(`/laerer/oppgaver/${assignmentId}`);
  revalidatePath('/laerer/oppgaver');
  return { error: null, success: true };
}
```

This needs a thin SQL wrapper so wall 1 can ask the private pivot. Append to `supabase/migrations/20260728095000_create_assignment_rpc.sql`:

```sql
-- Wall 1 needs to ask the same question wall 2 asks, and private.* is not
-- reachable through PostgREST. This is a read-only echo of the pivot: it
-- exposes a boolean the caller could already derive by reading the rows RLS
-- lets them see, so it leaks nothing new.
create or replace function public.student_in_assignment_check(
  p_student_id uuid, p_assignment_id uuid
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.student_in_assignment(p_student_id, p_assignment_id);
$$;
revoke execute on function public.student_in_assignment_check(uuid, uuid) from public, anon;
grant execute on function public.student_in_assignment_check(uuid, uuid) to authenticated;
```

Create `src/app/(portal)/laerer/klasser/[id]/grupper/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaffRole } from '@/lib/dal/session';
import { classGroupSchema } from '@/lib/validation/assignments';
import { firstIssue, type FormState } from '@/lib/validation/school';

async function requireTeacherOfClass(classId: string): Promise<string | null> {
  const { user } = await requireStaffRole('teacher');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('class_teachers')
    .select('class_id')
    .eq('class_id', classId)
    .eq('teacher_id', user.id)
    .maybeSingle();
  if (error) {
    if (error.code === '22P02') return null;
    throw new Error(`Kunne ikke verifisere klassen: ${error.message}`);
  }
  return data ? user.id : null;
}

/** Create or replace a template. Membership is insert/delete, so an edit
 *  clears the old rows and writes the new set. */
export async function saveClassGroup(
  classId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireTeacherOfClass(classId);
  if (!userId) return { error: 'Du underviser ikke denne klassen.' };

  const parsed = classGroupSchema.safeParse({
    name: formData.get('name'),
    student_ids: formData.getAll('student_ids').map(String).filter((v) => v !== ''),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const groupId = String(formData.get('group_id') ?? '') || null;

  const supabase = await createClient();
  // Wall 1 double bind: every pupil must be actively enrolled in THIS class.
  const { data: roster, error: rosterError } = await supabase
    .from('class_students')
    .select('student_id')
    .eq('class_id', classId)
    .is('left_on', null);
  if (rosterError) return { error: `Kunne ikke lese klasselisten: ${rosterError.message}` };
  const enrolled = new Set((roster ?? []).map((r) => r.student_id));
  if (parsed.data.student_ids.some((id) => !enrolled.has(id))) {
    return { error: 'En eller flere elever tilhører ikke klassen.' };
  }

  let targetId = groupId;
  if (targetId) {
    const { data, error } = await supabase
      .from('class_groups')
      .update({ name: parsed.data.name })
      .eq('id', targetId)
      .eq('class_id', classId)
      .select('id');
    if (error) {
      if (error.code === '23505') return { error: 'Klassen har allerede en gruppe med dette navnet.' };
      return { error: `Kunne ikke lagre gruppen: ${error.message}` };
    }
    if ((data ?? []).length === 0) return { error: 'Gruppen finnes ikke lenger.' };
    const { error: clearError } = await supabase
      .from('class_group_members')
      .delete()
      .eq('group_id', targetId);
    if (clearError) return { error: `Kunne ikke oppdatere medlemmene: ${clearError.message}` };
  } else {
    const { data, error } = await supabase
      .from('class_groups')
      .insert({ class_id: classId, name: parsed.data.name, created_by: userId })
      .select('id')
      .single();
    if (error) {
      if (error.code === '23505') return { error: 'Klassen har allerede en gruppe med dette navnet.' };
      return { error: `Kunne ikke opprette gruppen: ${error.message}` };
    }
    targetId = data.id;
  }

  const { error: memberError } = await supabase.from('class_group_members').insert(
    parsed.data.student_ids.map((studentId) => ({
      group_id: targetId!,
      student_id: studentId,
    })),
  );
  if (memberError) {
    return { error: `Kunne ikke lagre medlemmene: ${memberError.message}` };
  }
  revalidatePath(`/laerer/klasser/${classId}/grupper`);
  return { error: null, success: true };
}

export async function deleteClassGroup(
  classId: string,
  groupId: string,
): Promise<FormState> {
  const userId = await requireTeacherOfClass(classId);
  if (!userId) return { error: 'Du underviser ikke denne klassen.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('class_groups')
    .delete()
    .eq('id', groupId)
    .eq('class_id', classId);
  if (error) return { error: `Kunne ikke slette gruppen: ${error.message}` };
  revalidatePath(`/laerer/klasser/${classId}/grupper`);
  return { error: null, success: true };
}
```

- [ ] **Step 5: Write the hand-in actions**

Create `src/app/(portal)/elev/lekser/actions.ts`:

```ts
'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/dal/session';
import { attachmentPath } from '@/lib/assignments';
import { submissionSchema, uploadRequestSchema } from '@/lib/validation/assignments';
import { firstIssue, type FormState } from '@/lib/validation/school';
import {
  createUploadTicket,
  readObjectMeta,
  removeObject,
} from '@/lib/storage/attachments';

/**
 * Shared hand-in writer for both the pupil and the parent surface. The
 * submission row is created BEFORE any attachment, because the storage path is
 * `{submission_id}/…` and the object policy resolves the parent from it — an
 * attachment cannot exist before the hand-in it belongs to.
 */
export async function writeHandIn(
  assignmentId: string,
  studentId: string,
  userId: string,
  body: string | null,
): Promise<{ error: string | null; submissionId?: string }> {
  const supabase = await createClient();

  const { data: targeted, error: targetError } = await supabase.rpc(
    'student_in_assignment_check',
    { p_student_id: studentId, p_assignment_id: assignmentId },
  );
  if (targetError) return { error: `Kunne ikke verifisere oppgaven: ${targetError.message}` };
  if (!targeted) return { error: 'Eleven har ikke denne oppgaven.' };

  // Which shape? A group the pupil belongs to on THIS assignment, else
  // individual. Mirrors private.can_write_submission's two branches.
  const { data: groups, error: groupError } = await supabase
    .from('assignment_groups')
    .select('id, assignment_group_members!inner(student_id)')
    .eq('assignment_id', assignmentId)
    .eq('assignment_group_members.student_id', studentId);
  if (groupError) return { error: `Kunne ikke lese gruppen: ${groupError.message}` };
  const groupId = (groups ?? [])[0]?.id ?? null;

  const existingQuery = supabase
    .from('submissions')
    .select('id')
    .eq('assignment_id', assignmentId);
  const { data: existing, error: existingError } = await (groupId
    ? existingQuery.eq('assignment_group_id', groupId)
    : existingQuery.eq('student_id', studentId)
  ).maybeSingle();
  if (existingError) return { error: `Kunne ikke lese innleveringen: ${existingError.message}` };

  if (existing) {
    const { data, error } = await supabase
      .from('submissions')
      .update({ body, submitted_by: userId, submitted_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select('id');
    if (error) return { error: `Kunne ikke lagre innleveringen: ${error.message}` };
    if ((data ?? []).length === 0) {
      // The UPDATE policy's USING clause matched nothing: the work is approved.
      return { error: 'Innleveringen er vurdert og kan ikke endres.' };
    }
    return { error: null, submissionId: existing.id };
  }

  const submissionId = randomUUID();
  const { error } = await supabase.from('submissions').insert({
    id: submissionId,
    assignment_id: assignmentId,
    student_id: groupId ? null : studentId,
    assignment_group_id: groupId,
    body,
    submitted_by: userId,
  });
  if (error) {
    if (error.code === '23505') return { error: 'Oppgaven er allerede levert.' };
    return { error: `Kunne ikke levere: ${error.message}` };
  }
  return { error: null, submissionId };
}

export async function submitOwnHandIn(
  assignmentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireRole('student');
  const parsed = submissionSchema.safeParse({ body: formData.get('body') });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data: student, error } = await supabase
    .from('students')
    .select('id')
    .eq('student_user_id', user.id)
    .maybeSingle();
  if (error) return { error: `Kunne ikke lese eleven: ${error.message}` };
  if (!student) return { error: 'Fant ingen elev knyttet til denne kontoen.' };

  const result = await writeHandIn(assignmentId, student.id, user.id, parsed.data.body ?? null);
  if (result.error) return { error: result.error };
  revalidatePath('/elev/lekser');
  return { error: null, success: true };
}

export async function requestOwnSubmissionUpload(
  submissionId: string,
  declared: { filename: string; mime: string; size: number },
): Promise<{ error: string | null; path?: string; token?: string }> {
  await requireRole('student');
  const parsed = uploadRequestSchema.safeParse(declared);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const path = attachmentPath(submissionId, randomUUID(), parsed.data.filename);
  try {
    // Authorization is the bucket's: writes_submission runs on the caller's
    // JWT, so a ticket for a hand-in that is not theirs simply never mints.
    const ticket = await createUploadTicket('submissions', path);
    return { error: null, path: ticket.path, token: ticket.token };
  } catch {
    return { error: 'Du kan ikke legge ved filer på denne innleveringen.' };
  }
}

export async function confirmSubmissionUpload(
  submissionId: string,
  path: string,
  filename: string,
): Promise<FormState> {
  const { user } = await requireRole('student');
  return confirmSubmissionUploadFor(submissionId, path, filename, user.id, '/elev/lekser');
}

/** Shared by the pupil and parent surfaces (same wall, different revalidate). */
export async function confirmSubmissionUploadFor(
  submissionId: string,
  path: string,
  filename: string,
  userId: string,
  revalidate: string,
): Promise<FormState> {
  if (!path.startsWith(`${submissionId}/`)) return { error: 'Ugyldig filsti.' };
  const meta = await readObjectMeta('submissions', path);
  if (!meta) return { error: 'Filen ble ikke lastet opp. Prøv igjen.' };

  const supabase = await createClient();
  const { error } = await supabase.from('submission_attachments').insert({
    submission_id: submissionId,
    path,
    filename: filename.slice(0, 255),
    mime: meta.mime,
    size_bytes: meta.size,
    uploaded_by: userId,
  });
  if (error) {
    await removeObject('submissions', path).catch(() => undefined);
    if (error.code === '23505') return { error: 'Filen er allerede lagt ved.' };
    return { error: `Kunne ikke lagre vedlegget: ${error.message}` };
  }
  revalidatePath(revalidate);
  return { error: null, success: true };
}

export async function removeOwnSubmissionAttachment(
  submissionId: string,
  attachmentId: string,
): Promise<FormState> {
  await requireRole('student');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('submission_attachments')
    .delete()
    .eq('id', attachmentId)
    .eq('submission_id', submissionId)
    .select('path');
  if (error) return { error: `Kunne ikke fjerne vedlegget: ${error.message}` };
  if ((data ?? []).length === 0) {
    return { error: 'Vedlegget kan ikke fjernes etter at oppgaven er vurdert.' };
  }
  for (const row of data) {
    await removeObject('submissions', row.path).catch(() => undefined);
  }
  revalidatePath('/elev/lekser');
  return { error: null, success: true };
}
```

Create `src/app/(portal)/forelder/lekser/actions.ts`:

```ts
'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/dal/session';
import { attachmentPath } from '@/lib/assignments';
import { submissionSchema, uploadRequestSchema } from '@/lib/validation/assignments';
import { firstIssue, type FormState } from '@/lib/validation/school';
import { createUploadTicket, removeObject } from '@/lib/storage/attachments';
import { confirmSubmissionUploadFor, writeHandIn } from '../../elev/lekser/actions';

/** Hand-in on behalf of one's own child (master spec: submitted_by may be
 *  the guardian). Both halves of the double bind are re-derived here. */
export async function submitChildHandIn(
  assignmentId: string,
  studentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireRole('parent');
  const parsed = submissionSchema.safeParse({ body: formData.get('body') });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data: link, error } = await supabase
    .from('guardian_student')
    .select('student_id')
    .eq('guardian_id', user.id)
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) return { error: `Kunne ikke verifisere foresattforhold: ${error.message}` };
  if (!link) return { error: 'Dette er ikke ditt barn.' };

  const result = await writeHandIn(assignmentId, studentId, user.id, parsed.data.body ?? null);
  if (result.error) return { error: result.error };
  revalidatePath('/forelder/lekser');
  return { error: null, success: true };
}

export async function requestChildSubmissionUpload(
  submissionId: string,
  declared: { filename: string; mime: string; size: number },
): Promise<{ error: string | null; path?: string; token?: string }> {
  await requireRole('parent');
  const parsed = uploadRequestSchema.safeParse(declared);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const path = attachmentPath(submissionId, randomUUID(), parsed.data.filename);
  try {
    const ticket = await createUploadTicket('submissions', path);
    return { error: null, path: ticket.path, token: ticket.token };
  } catch {
    return { error: 'Du kan ikke legge ved filer på denne innleveringen.' };
  }
}

export async function confirmChildSubmissionUpload(
  submissionId: string,
  path: string,
  filename: string,
): Promise<FormState> {
  const { user } = await requireRole('parent');
  return confirmSubmissionUploadFor(
    submissionId,
    path,
    filename,
    user.id,
    '/forelder/lekser',
  );
}

export async function removeChildSubmissionAttachment(
  submissionId: string,
  attachmentId: string,
): Promise<FormState> {
  await requireRole('parent');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('submission_attachments')
    .delete()
    .eq('id', attachmentId)
    .eq('submission_id', submissionId)
    .select('path');
  if (error) return { error: `Kunne ikke fjerne vedlegget: ${error.message}` };
  if ((data ?? []).length === 0) {
    return { error: 'Vedlegget kan ikke fjernes etter at oppgaven er vurdert.' };
  }
  for (const row of data) {
    await removeObject('submissions', row.path).catch(() => undefined);
  }
  revalidatePath('/forelder/lekser');
  return { error: null, success: true };
}
```

- [ ] **Step 6: Run everything**

```bash
cd /Users/daodilyas/dev/iqra-portal && supabase db reset && supabase test db && npm run typecheck && npm run test:api -- assignments
```

Expected: pgTAP all ok; typecheck clean; `assignments-actions` 11/11, `assignments-core` and `assignments-storage` still green.

> **Execution ledger — corrected during Task 8 (2026-07-29).** The count above is
> wrong: the file ends at **30 tests**, not 11 — the riders and the review's
> additions roughly tripled it. Shipped as two commits, not one. Final gate:
> pgTAP **560** (29 files, up from 531/28) · `test:api` **303** · typecheck 0 ·
> lint 0 errors · knip 1 (`reuseSchema`, Task 9's).
>
> ### ★ The plan's `student_in_assignment_check` was an oracle over other families' children
>
> The plan specified a bare `security definer` wrapper and a comment asserting it
> "exposes a boolean the caller could already derive… so it leaks nothing new".
> That comment was **false**, and the function is reachable by every
> `authenticated` role. `private.student_in_assignment(sid, aid)` answers for
> *any* pair, and a `definer` wrapper runs as `postgres`, which carries
> `rolbypassrls` — so RLS never narrows it. A guardian can already read their own
> child's group mates' student ids through `assignment_group_members_select_related`,
> so they hold real ids to probe with, and could then ask the wrapper about any
> assignment id they encountered. Verified caller-by-caller against the live
> stack: as `forelder@`, the bare pivot returns **true** for another family's
> child; the bound wrapper returns **false**.
>
> Fixed by binding the answer to the caller's own relationship — admin, teaches
> the assignment, is the linked pupil, or is the guardian. All three call sites
> have already established exactly one of those links before calling, so the bind
> costs them nothing. It fails closed on a null `auth.uid()` (`NULL and …` → NULL
> → rejected).
>
> **The bind then shipped proven by nothing.** Deleting those six lines left the
> entire suite green: both negative tests reject on the *pivot* half and never
> reach the bind. This is discipline #0 exactly — the fixture you need is one
> where the pivot says **true** and your code must say **false**, and no such
> fixture existed. Now pinned by `supabase/tests/28_assignment_rpc.sql`;
> re-verified by the controller, not just claimed — stripping the bind fails
> assertions **17** and **20** and nothing else.
>
> **Standing rule:** `00_grant_firewall.sql` sweeps only `relkind in ('r','p','v','m','S')` —
> tables and sequences, **never functions**. A forgotten `revoke … from anon` on a
> new function therefore fails no test. Every function a task adds owes its own
> `prosecdef`, `proconfig` (`search_path=""`) and `anon`-has-no-EXECUTE assertions,
> with the `authenticated` positive half so an over-broad revoke cannot hide.
>
> ### `saveClassGroup` walked back into the replace-set data loss the repo had already fixed
>
> Membership was maintained as update → DELETE-all → INSERT across three
> autocommitting PostgREST round trips — the exact defect `25_replace_set_atomicity.sql`
> and `replace_class_teachers` / `replace_class_subjects` exist to prevent. One
> rejected insert (a pupil whose `left_on` was stamped between the roster read and
> the insert trips `class_group_members_insert_teacher_or_admin`, and it is one
> statement so one bad id loses all of them) leaves the template **empty**, with no
> UPDATE policy and no recovery but re-entering the names. A dropped connection
> does the same with no race at all. Fixed as the third member of that family,
> `public.replace_class_group`, with the **stored count** as the success signal —
> the action rejects `stored !== student_ids.length` rather than trusting "no
> error". That count is also what proves the action goes *through* the function
> rather than alongside it.
>
> ### A retried upload-confirm deleted the file and kept the row
>
> Inherited verbatim from the plan (Steps 4 and 5): `removeObject` ran **before**
> the 23505 branch. Both attachment tables have `UNIQUE (path)`, so a double-click
> or a retry after a slow first response deleted the object the first call had
> already recorded — row surviving, child's recording gone, permanently broken
> link. Three comments in the plan's own code stated the opposite invariant, one
> of them describing precisely the rule the code two functions above broke.
>
> ### Two things the plan asserts that are simply wrong
>
> - The `FOREACH` "careful" note (reusing `v_group_id` as loop variable and
>   `returning` target) describes a bug that does not exist: `FOREACH` re-assigns
>   the loop variable at the top of every iteration. Settled with a plpgsql probe
>   that clobbers it mid-body, not by reading the manual. The two-variable form is
>   still what shipped, because it is clearer.
> - `mapCreateError`'s `split('|')` ternary was dropped entirely rather than
>   fixed. The RPC's raise already carries the group/term name, so an action-side
>   copy of the size/foreign/term rules renders the same sentence from the same
>   payload — a check no test could distinguish and no mutant could reveal.
>
> ### Scope notes
>
> - **Rider 4 lives in the RPC, and it is a consistency gate, not a security
>   control.** `assignments_insert_teacher_or_admin` has no `due_on` term, so a
>   teacher can still POST any frist straight to `/rest/v1/assignments`. The
>   comment says so; per ledger rule, a comment that overstated it would be worse
>   than none.
> - `writeHandIn` and the attachment helpers live in `src/lib/dal/submissions.ts`,
>   not in the action files: `'use server'` makes every export a public endpoint,
>   and these take an already-authorized `userId`. `action-guards.test.ts` (now 60)
>   refuses them in an action file, correctly.
> - **Deferred to the exit gate:** `'Du underviser ikke denne oppgaven.'` is not
>   idiomatic bokmål — one teaches a class or a subject, not an assignment. The
>   string is shared with Task 7, so it is a cross-task sweep, not a Task 8 patch.

- [ ] **Step 7: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal && git add supabase/migrations/20260728095000_create_assignment_rpc.sql "src/app/(portal)/laerer/oppgaver/actions.ts" "src/app/(portal)/laerer/oppgaver/[assignmentId]/actions.ts" "src/app/(portal)/laerer/klasser/[id]/grupper/actions.ts" "src/app/(portal)/elev/lekser/actions.ts" "src/app/(portal)/forelder/lekser/actions.ts" src/lib/validation/school.ts tests/api/assignments-actions.test.ts && git commit -m "feat(oppgaver): atomic assignment creation, hand-in and per-pupil review actions"
```

---

## Task 9: Reuse («gjenbruk») — D10, all-or-nothing across Storage

The prep-time saver, and the one place where a database transaction is not enough: `storage.copy()` is an HTTP call outside the transaction. The rule from §3.1 is that **a half-attached assignment must never be publishable**, so the copy runs after creation and a failure discards the whole new assignment.

> ⚠ **Path-shape rider — carried forward from Task 6's review (2026-07-29).** This
> task is where new object paths are *constructed* rather than merely read, so
> the hazard lands here. Task 5 established that a path with no `/` is safe:
> `storage.foldername(name)` returns an empty array, `[1]` is NULL, the `::uuid`
> cast yields NULL and the policy denies. **A segment-1 that exists but is not a
> uuid is not safe** — `(storage.foldername(name))[1]::uuid` *raises* 22P02
> rather than returning false, and because `service_role` bypasses RLS entirely,
> a single malformed object name written with the service key would break SELECTs
> over that bucket **for every user**. `attachmentPath` sanitizes its filename but
> trusts `parentId` (deliberately — Task 6's review flagged it and it was left
> alone rather than growing defensive code the plan had not asked for). Every
> Task-9 call site must therefore pass a `parentId` that came from a database row,
> never from form input, and the reuse path should be asserted to be uuid-shaped
> before any copy is issued.

**Files:**
- Create: `supabase/migrations/20260728096000_assignment_reuse.sql`
- Modify: `src/app/(portal)/laerer/oppgaver/actions.ts`
- Modify: `supabase/tests/21_assignments_rls.sql` (add the discard guard's tests)
- Modify: `tests/api/assignments-actions.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/api/assignments-actions.test.ts`:

```ts
describe('reuseAssignment (D10)', () => {
  it('copies title, instructions, subject and type — and deliberately NOT targeting', async () => {
    await signInAsAAL2('laerer@test.local');
    const state = await reuseAssignment(
      idle,
      form({
        source_id: A_GRUPPE,
        class_id: K1,
        due_on: '2026-11-01',
        // Targeting is re-picked: hele klassen this time.
      }),
    );
    expect(state.error).toBeNull();
    const created = await service()
      .from('assignments')
      .select('id, title, instructions, subject_id, submission_type, assignment_groups(id)')
      .eq('id', state.assignmentId!)
      .single();
    try {
      expect(created.data?.title).toBe('Gruppeoppgave: presenter en surah');
      expect(created.data?.instructions).toContain('Velg en kort surah');
      // ★ The frozen roster of the ORIGINAL is never resurrected (§3.1).
      expect(created.data?.assignment_groups).toHaveLength(0);
    } finally {
      await service().from('assignments').delete().eq('id', state.assignmentId!);
    }
  });

  it('never carries submissions or reviews across', async () => {
    await signInAsAAL2('laerer@test.local');
    const state = await reuseAssignment(
      idle,
      form({ source_id: A_ALFABET, class_id: K1, due_on: '2026-11-02' }),
    );
    try {
      const subs = await service()
        .from('submissions')
        .select('id')
        .eq('assignment_id', state.assignmentId!);
      const reviews = await service()
        .from('assignment_reviews')
        .select('assignment_id')
        .eq('assignment_id', state.assignmentId!);
      expect(subs.data).toHaveLength(0);
      expect(reviews.data).toHaveLength(0);
    } finally {
      await service().from('assignments').delete().eq('id', state.assignmentId!);
    }
  });

  it('★ treats a foreign assignment as a quiet not-found, never an error leak', async () => {
    await signInAsAAL2('laererforelder@test.local');
    const state = await reuseAssignment(
      idle,
      form({ source_id: A_ALFABET, class_id: K3, due_on: '2026-11-03' }),
    );
    expect(state.error).toBe('Fant ikke oppgaven.');
  });

  it('★ leaves NO half-attached assignment behind when an object copy fails', async () => {
    await signInAsAAL2('laerer@test.local');
    // An attachment row whose object was never written: the copy must fail.
    await service().from('assignment_attachments').insert({
      id: 'f8000000-0000-0000-0000-0000000000ff',
      assignment_id: A_ALFABET,
      path: `${A_ALFABET}/dddd4444-0000-0000-0000-000000000001-mangler.pdf`,
      filename: 'mangler.pdf',
      mime: 'application/pdf',
      size_bytes: 1024,
      uploaded_by: '22222222-2222-2222-2222-222222222222',
    });
    try {
      const state = await reuseAssignment(
        idle,
        form({ source_id: A_ALFABET, class_id: K1, due_on: '2026-11-04' }),
      );
      expect(state.error).toBe('Kunne ikke kopiere vedleggene. Oppgaven ble ikke opprettet.');
      const leftovers = await service()
        .from('assignments')
        .select('id')
        .eq('due_on', '2026-11-04');
      expect(leftovers.data).toHaveLength(0);
    } finally {
      await service()
        .from('assignment_attachments')
        .delete()
        .eq('id', 'f8000000-0000-0000-0000-0000000000ff');
    }
  });
});
```

Add `reuseAssignment` to the import list at the top of the file.

Append to `supabase/tests/21_assignments_rls.sql` — raise `plan(20)` to `plan(23)` and add before `select * from finish();`:

```sql
-- ── discard_empty_assignment: the reuse rollback path (D10) ─────────
select has_function('public'::name, 'discard_empty_assignment'::name,
  array['uuid'], 'public.discard_empty_assignment(uuid) exists');

select set_config('request.jwt.claims',
  '{"sub":"b9000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.discard_empty_assignment('b9000000-0000-0000-0000-000000000051') $$,
  'the teacher discards an assignment nobody has handed in against');
reset role;

-- Now give the group assignment a hand-in and prove the guard holds.
insert into public.submissions (assignment_id, assignment_group_id, submitted_by)
values ('b9000000-0000-0000-0000-000000000052',
        'b9000000-0000-0000-0000-000000000061',
        'b9000000-0000-0000-0000-000000000006');

select set_config('request.jwt.claims',
  '{"sub":"b9000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.discard_empty_assignment('b9000000-0000-0000-0000-000000000052') $$,
  'P0001', null,
  '★ an assignment with pupil work can never be discarded, only edited');
reset role;
```

- [ ] **Step 2: Run to verify both fail**

```bash
cd /Users/daodilyas/dev/iqra-portal && supabase test db; npm run test:api -- assignments-actions
```

Expected: pgTAP `21_…` fails on the missing function; the api tests fail on the missing `reuseAssignment` export.

- [ ] **Step 3: Write the rollback RPC**

Create `supabase/migrations/20260728096000_assignment_reuse.sql`:

```sql
-- The reuse rollback path (D10, design spec §3.1).
--
-- Reuse cannot be one transaction: storage.copy() is an HTTP call to the
-- Storage service, outside the database. The order is forced — the object
-- path is `{assignment_id}/…` and the bucket policy resolves the owner from
-- it, so the assignment must EXIST before its objects can be written. That
-- leaves exactly one way to honour "a half-attached assignment must never be
-- publishable": create, copy, and on any copy failure discard the whole thing.
--
-- assignments DELETE is admin-only by policy, and stays that way — a
-- mis-created assignment is edited, not destroyed. This function is the one
-- narrow exception, and its guard is what makes it safe: the caller must teach
-- the assignment, and it must carry NO pupil work whatsoever. An assignment
-- with a single hand-in or review is untouchable here.
create or replace function public.discard_empty_assignment(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.teaches_assignment((select auth.uid()), p_assignment_id) then
    raise exception 'NOT_YOURS' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.submissions
             where assignment_id = p_assignment_id) then
    raise exception 'HAS_WORK' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.assignment_reviews
             where assignment_id = p_assignment_id) then
    raise exception 'HAS_WORK' using errcode = 'P0001';
  end if;
  delete from public.assignments where id = p_assignment_id;
end;
$$;
revoke execute on function public.discard_empty_assignment(uuid) from public, anon;
grant execute on function public.discard_empty_assignment(uuid) to authenticated;
```

- [ ] **Step 4: Write the reuse action**

Append to `src/app/(portal)/laerer/oppgaver/actions.ts`:

```ts
import { copyObject } from '@/lib/storage/attachments';
import { reuseSchema } from '@/lib/validation/assignments';
import { listReusableAssignments } from '@/lib/dal/assignments';

/**
 * D10. Copies title, instructions, subject and attachments; the teacher
 * re-picks class, frist and targeting.
 *
 * Targeting is re-picked, NOT copied, and that is deliberate: a frozen
 * assignment_group_members snapshot belongs to the assignment that froze it.
 * Resurrecting it would re-attach last year's pupils to this year's task and
 * quietly violate D1. Re-picking runs the normal copy against TODAY's
 * templates — the create path this function delegates to.
 *
 * Attachments are physically copied, never shared: the path encodes the
 * parent's UUID, so one object cannot serve two assignments without breaking
 * the path-based policy. Size and MIME are NOT re-validated — the source
 * objects passed the allowlist when first uploaded and copying cannot change
 * their bytes, so a reuse can never fail on a file that was legal before.
 */
export async function reuseAssignment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireStaffRole('teacher');
  const source = reuseSchema.safeParse({ source_id: formData.get('source_id') });
  if (!source.success) return { error: firstIssue(source.error) };

  const supabase = await createClient();
  // Own assignments only. The .eq on created_by is what turns a foreign id
  // into a quiet not-found instead of an error that confirms it exists.
  const { data: original, error: readError } = await supabase
    .from('assignments')
    .select(
      'id, subject_id, title, instructions, submission_type, assignment_attachments(id, path, filename, mime, size_bytes)',
    )
    .eq('id', source.data.source_id)
    .eq('created_by', user.id)
    .maybeSingle();
  if (readError) {
    if (readError.code === '22P02') return { error: 'Fant ikke oppgaven.' };
    return { error: `Kunne ikke lese oppgaven: ${readError.message}` };
  }
  if (!original) return { error: 'Fant ikke oppgaven.' };

  const created = await createAssignment(_prev, buildCreateForm(formData, original));
  if (created.error || !created.assignmentId) return created;
  const newId = created.assignmentId;

  const copied: string[] = [];
  try {
    for (const attachment of original.assignment_attachments ?? []) {
      const objectId = randomUUID();
      const toPath = attachmentPath(newId, objectId, attachment.filename);
      await copyObject('assignments', attachment.path, toPath);
      copied.push(toPath);
    }
    if (copied.length > 0) {
      const { error } = await supabase.from('assignment_attachments').insert(
        (original.assignment_attachments ?? []).map((attachment, index) => ({
          assignment_id: newId,
          path: copied[index],
          filename: attachment.filename,
          mime: attachment.mime,
          size_bytes: attachment.size_bytes,
          uploaded_by: user.id,
        })),
      );
      if (error) throw new Error(error.message);
    }
  } catch {
    // All-or-nothing (§3.1): drop every object we copied, then discard the
    // assignment itself. discard_empty_assignment refuses if any pupil work
    // exists, which cannot here — the assignment is seconds old.
    for (const path of copied) {
      await removeObject('assignments', path).catch(() => undefined);
    }
    await supabase.rpc('discard_empty_assignment', { p_assignment_id: newId });
    return { error: 'Kunne ikke kopiere vedleggene. Oppgaven ble ikke opprettet.' };
  }

  revalidatePath('/laerer/oppgaver');
  return { error: null, success: true, assignmentId: newId };
}

/** The reuse form carries class/frist/targeting; the rest comes from source. */
function buildCreateForm(
  formData: FormData,
  original: { subject_id: string; title: string; instructions: string | null; submission_type: string },
): FormData {
  const next = new FormData();
  next.set('class_id', String(formData.get('class_id') ?? ''));
  next.set('subject_id', original.subject_id);
  next.set('title', original.title);
  next.set('instructions', original.instructions ?? '');
  next.set('due_on', String(formData.get('due_on') ?? ''));
  next.set('submission_type', original.submission_type);
  for (const groupId of formData.getAll('group_ids')) {
    next.append('group_ids', String(groupId));
  }
  return next;
}

export { listReusableAssignments };
```

Remove the trailing `export { listReusableAssignments };` if it triggers the `'use server'` rule — a `'use server'` file may export only async functions, and a re-export of an async function is fine, but the simplest course is to import `listReusableAssignments` directly in the page instead. **Do that: delete the re-export and the matching import.**

- [ ] **Step 5: Run everything**

```bash
cd /Users/daodilyas/dev/iqra-portal && supabase db reset && supabase test db && npm run typecheck && npm run test:api -- assignments
```

Expected: `21_assignments_rls.sql` 21/21, all api assignment suites green.

> **Execution ledger — corrected during Task 9 (2026-07-29).** The expected count
> is wrong twice over: `21_assignments_rls.sql` was at `plan(20)`, not 21, and
> ends at **`plan(27)`**. Shipped as two commits. Final gate: pgTAP **573**
> (29 files) · `test:api` **314** (11 files) · `assignments-actions` **41** ·
> unit 311 · typecheck 0 · lint 0 · knip **0**.
>
> ### ★ CI would have failed on first push, and not for a legible reason
>
> Found while the task was in flight, fixed in a separate commit. `ci.yml` started
> the stack with `-x …,storage-api,…` under a comment saying the API suite "never
> uses Storage" — true when written, **false since Task 5**. Both
> `assignments-storage.test.ts` and this task's reuse tests drive the Storage HTTP
> API. Measured against a stack started with the job's exact flags rather than
> reasoned about: old list → no storage container, **7 of 9 storage tests fail**
> with `StorageApiError 503 "name resolution failed"`; corrected list → **68/68**
> across all three assignments files.
>
> **The CLI trap that hid it, worth keeping:** `supabase start --help` advertises
> one set of excludable names (`analytics, db, functions, inbucket, meta, rest,
> storage, …`) and the **runtime validator accepts a different set**
> (`edge-runtime, gotrue, logflare, mailpit, postgres-meta, postgrest,
> storage-api, supavisor, …`). An unrecognised name is a **WARNING with exit 0**,
> never an error. So a name copied from the help text silently *starts* the
> container it was meant to stop, while only a validator name stops anything.
> `inbucket` and `pg-meta` had been no-ops all along; `storage-api` was real.
> `23_assignment_storage.sql` is why nobody noticed — it asserts against the
> storage **schema** in Postgres, which exists whether or not the container runs,
> so `supabase test db` stayed green throughout.
>
> ### The rollback test could hollow itself out, and the obvious fix was vacuous too
>
> The all-or-nothing assertion only bites if the good attachment is copied before
> the orphan, which held solely because of an `.order('created_at')` on the source
> read — a line nothing asserted. Deleting it left the suite green while the test
> proved nothing about `removeObject` (measured: the mutant **survived**). The
> reviewer's suggested fix — read the attachments again in a check query and
> assert their order — was **also** vacuous, because a separate query carries its
> own `ORDER BY` and cannot observe the action's. Fixed instead by building the
> fixture so heap order and `created_at` order deliberately **disagree** (orphan
> row inserted first, stamped a day later) and asserting the sweep count from the
> action's own diagnostic. The test now carries a `★★ DO NOT "TIDY"` comment, since
> the natural simplification restores the vacuity.
>
> This is the seventh unfailable assertion on this branch and the second where the
> *proposed* fix would also have been unfailable. **Mutate the fix, not just the
> original.**
>
> ### `discard_empty_assignment` guards were raceable
>
> The four `exists` guards read at READ COMMITTED while the `delete` ran on a
> later snapshot, and every child FK is `ON DELETE CASCADE` — so a hand-in
> committing in that window was destroyed, and the function is granted to
> `authenticated` and takes an arbitrary uuid, so it is not confined to
> seconds-old reuse leftovers. Closed with `perform 1 … for update` before the
> guards: a child INSERT takes `FOR KEY SHARE` on the parent, which conflicts.
> ⚠ Its pgTAP assertion is **a pin, not proof** — the race needs two sessions
> committing in a controlled order, which neither pgTAP (one session, one
> transaction) nor the PostgREST harness can stage. Labelled as such in the file.
>
> ### Shipped unproven, deliberately
>
> The attachment-row cleanup before the discard (closing the case where the row
> insert commits but its response is lost) **cannot be tested here** — supabase-js
> cannot produce that state, so no fixture distinguishes the cleanup from its
> absence. Shipped with the gap stated rather than dressed up; the alternative was
> shipping the hole it closes. Likewise the uuid half of `pathBelongsTo` fires
> nowhere today (both call sites take `parentId` from a uuid column or
> `randomUUID()`), so it is pinned by unit tests only, and the code says so.
>
> ### Two incidental facts now recorded in code
>
> - `assignment_attachments.created_at` is **teacher-writable through PostgREST** —
>   the insert policy constrains only `assignment_id` and `uploaded_by`, so every
>   other column is client-supplied. Harmless today, and it is the sole mechanism
>   that lets the rebuilt fixture make heap order and timestamp order disagree.
> - A well-formed uuid that is not a subject reached the teacher as a raw English
>   FK violation through `mapCreateError`'s fallback. **Pre-existing**, not
>   introduced by reuse; now mapped, because reuse is the first path that can hit
>   it without a hand-crafted request (`class_subjects` is app-enforced per §4).

- [ ] **Step 6: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal && git add supabase/migrations/20260728096000_assignment_reuse.sql supabase/tests/21_assignments_rls.sql "src/app/(portal)/laerer/oppgaver/actions.ts" tests/api/assignments-actions.test.ts && git commit -m "feat(oppgaver): assignment reuse with all-or-nothing attachment copying"
```

---
## Task 10: Teacher UI — the list and the roster-complete hero screen

`/laerer/oppgaver/[assignmentId]` is the phase's hero and the gap the demo had. **The counts ARE the navigation**: `Ikke levert 4 · Levert 12 · Vurdert 5` is a segmented control, and selecting a segment filters to those *names*. A non-submitter is a row, never an absence.

**Files:**
- Create: `src/components/assignments/StatusChip.tsx`, `src/components/assignments/AttachmentList.tsx`, `src/components/assignments/AttachmentPicker.tsx`
- Create: `src/app/(portal)/vedlegg/actions.ts`
- Create: `src/app/(portal)/laerer/oppgaver/page.tsx`, `AssignmentList.tsx`
- Create: `src/app/(portal)/laerer/oppgaver/[assignmentId]/page.tsx`, `RosterReview.tsx`

- [ ] **Step 1: Write the shared attachment components and the download actions**

Create `src/app/(portal)/vedlegg/actions.ts`:

```ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/dal/session';
import { signedDownloadUrl } from '@/lib/storage/attachments';

/**
 * Downloads are short-lived SIGNED URLs minted only after a read the RLS
 * policy allowed — never public URLs (master spec §8). This also keeps the
 * accepted sharp/libvips advisory honest: attachments are served straight from
 * Storage and never pass through next/image's optimiser, so user-supplied
 * images never reach libvips (design spec §10.4).
 */
export async function assignmentAttachmentUrl(
  attachmentId: string,
): Promise<{ url: string | null; error: string | null }> {
  await requireAnyRole();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('assignment_attachments')
    .select('path')
    .eq('id', attachmentId)
    .maybeSingle();
  if (error) return { url: null, error: `Kunne ikke lese vedlegget: ${error.message}` };
  if (!data) return { url: null, error: 'Vedlegget finnes ikke lenger.' };
  const url = await signedDownloadUrl('assignments', data.path);
  return url
    ? { url, error: null }
    : { url: null, error: 'Filen finnes ikke lenger.' };
}

export async function submissionAttachmentUrl(
  attachmentId: string,
): Promise<{ url: string | null; error: string | null }> {
  await requireAnyRole();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('submission_attachments')
    .select('path')
    .eq('id', attachmentId)
    .maybeSingle();
  if (error) return { url: null, error: `Kunne ikke lese vedlegget: ${error.message}` };
  if (!data) return { url: null, error: 'Vedlegget finnes ikke lenger.' };
  const url = await signedDownloadUrl('submissions', data.path);
  return url
    ? { url, error: null }
    : { url: null, error: 'Filen finnes ikke lenger.' };
}
```

If `requireAnyRole` does not exist in `src/lib/dal/session.ts`, add it there — a guard that only demands a signed-in user with at least one role, since the RLS `select` above is what actually decides visibility:

```ts
/** Signed-in with any role. The row-level policy decides what is visible;
 *  this only refuses anonymous callers. */
export async function requireAnyRole(): Promise<{ user: User }> {
  return requireSession();
}
```

Match the existing export names in that file — reuse whatever the file already calls its "signed-in, no specific role" guard rather than inventing a second one.

Create `src/components/assignments/StatusChip.tsx`:

```tsx
import { Chip } from '@/components/ui/Chip';
import { STATUS_LABELS, STATUS_TONES, type SubmissionStatus } from '@/lib/assignments';

export function StatusChip({ status }: { status: SubmissionStatus }) {
  return <Chip tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Chip>;
}
```

Create `src/components/assignments/AttachmentList.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';

export interface AttachmentItem {
  id: string;
  filename: string;
  mime: string;
  size_bytes: number;
}

function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

function kindLabel(mime: string): string {
  if (mime.startsWith('image/')) return 'Bilde';
  if (mime.startsWith('audio/')) return 'Lyd';
  if (mime.startsWith('video/')) return 'Video';
  return 'Dokument';
}

/**
 * Files open through a freshly minted signed URL on click, never through a
 * stored link: a URL in the markup would outlive the reader's right to it.
 */
export function AttachmentList({
  items,
  getUrl,
  onRemove,
}: {
  items: AttachmentItem[];
  getUrl: (attachmentId: string) => Promise<{ url: string | null; error: string | null }>;
  onRemove?: (attachmentId: string) => Promise<{ error: string | null }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (items.length === 0) return null;

  function open(attachmentId: string) {
    startTransition(async () => {
      const result = await getUrl(attachmentId);
      if (result.url) {
        setError(null);
        window.open(result.url, '_blank', 'noopener,noreferrer');
      } else {
        setError(result.error ?? 'Kunne ikke åpne filen.');
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-hairline px-3 py-2"
          >
            <span className="text-sm text-ink/60">{kindLabel(item.mime)}</span>
            <span className="font-medium break-all">{item.filename}</span>
            <span className="text-sm tabular-nums text-ink/60">
              {readableSize(item.size_bytes)}
            </span>
            <div className="ms-auto flex items-center gap-2">
              <Button variant="ghost" onClick={() => open(item.id)} loading={pending}>
                Åpne
              </Button>
              {onRemove ? (
                <Button
                  variant="ghost"
                  onClick={() =>
                    startTransition(async () => {
                      const result = await onRemove(item.id);
                      setError(result.error);
                    })
                  }
                >
                  Fjern
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-sm text-danger-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
```

Create `src/components/assignments/AttachmentPicker.tsx`:

```tsx
'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { MAX_ATTACHMENT_BYTES } from '@/lib/validation/assignments';

type Ticket = { error: string | null; path?: string; token?: string };

/**
 * Refinement R1's three steps, in order: ask the server for a ticket, PUT the
 * bytes straight to Storage, then ask the server to confirm and record what
 * actually landed. The 50 MB cap cannot go through a server action — a Vercel
 * serverless request body stops at 4.5 MB — so the file never touches our
 * server. Authorization is unaffected: the bucket policy runs on the caller's
 * own session, and the server chose the path.
 */
export function AttachmentPicker({
  bucket,
  onRequest,
  onConfirm,
  onDone,
  disabled = false,
  label = 'Legg ved fil',
}: {
  bucket: 'assignments' | 'submissions';
  onRequest: (declared: { filename: string; mime: string; size: number }) => Promise<Ticket>;
  onConfirm: (path: string, filename: string) => Promise<{ error: string | null }>;
  onDone?: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError('Filen kan være maks 50 MB.');
        return;
      }
      const ticket = await onRequest({
        filename: file.name,
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
        // The bucket refused the real bytes — its allowlist and size limit are
        // the enforcement the browser cannot talk its way past.
        setError('Filen ble avvist. Sjekk filtype og at den er under 50 MB.');
        return;
      }
      const confirmed = await onConfirm(ticket.path, file.name);
      if (confirmed.error) {
        setError(confirmed.error);
        return;
      }
      onDone?.();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <div>
        <Button
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          loading={busy}
          disabled={disabled}
        >
          {label}
        </Button>
      </div>
      <p className="text-sm text-ink/60">
        Bilde, dokument, lyd eller video. Maks 50 MB.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-danger-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Write the assignment list page**

Create `src/app/(portal)/laerer/oppgaver/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { listAssignmentsForTeacher } from '@/lib/dal/assignments';
import { EmptyState } from '@/components/ui/EmptyState';
import { PillLink } from '@/components/ui/PillLink';
import { AssignmentList } from './AssignmentList';

export const metadata: Metadata = { title: 'Oppgaver' };

export default async function OppgaverPage() {
  const assignments = await listAssignmentsForTeacher();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold">Oppgaver og lekser</h1>
        <div className="flex flex-wrap gap-2 print:hidden">
          <PillLink href="/laerer/oppgaver/ny" active>
            Ny oppgave
          </PillLink>
          <PillLink href="/laerer/oppgaver/ny?gjenbruk=1">Gjenbruk</PillLink>
        </div>
      </div>

      {assignments.length === 0 ? (
        <EmptyState
          title="Ingen oppgaver ennå"
          description="Når du oppretter en oppgave, dukker den opp her med en teller som viser hvor mange elever som ikke har levert. Du kan gi oppgaven til hele klassen eller til utvalgte grupper."
          action={<PillLink href="/laerer/oppgaver/ny" active>Lag den første oppgaven</PillLink>}
        />
      ) : (
        <AssignmentList assignments={assignments} />
      )}
    </div>
  );
}
```

Create `src/app/(portal)/laerer/oppgaver/AssignmentList.tsx`:

```tsx
import Link from 'next/link';
import { Chip } from '@/components/ui/Chip';
import type { AssignmentListRow } from '@/lib/dal/assignments';
import { formatDateNb } from '@/lib/dates';

export function AssignmentList({ assignments }: { assignments: AssignmentListRow[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {assignments.map((assignment) => (
        <li key={assignment.id}>
          <Link
            href={`/laerer/oppgaver/${assignment.id}`}
            className="flex flex-col gap-2 rounded-lg border border-hairline px-4 py-4 transition-colors duration-200 ease-brand hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-lg font-semibold">{assignment.title}</span>
              {assignment.is_group ? <Chip>Gruppeoppgave</Chip> : null}
            </div>
            <p className="text-sm tabular-nums text-ink/60">
              {assignment.class_name} · {assignment.subject_name} · frist{' '}
              {formatDateNb(assignment.due_on)}
            </p>
            <p className="text-sm tabular-nums">
              {assignment.not_submitted_count > 0 ? (
                <span className="font-medium">
                  {assignment.not_submitted_count} av {assignment.target_count} har ikke
                  levert
                </span>
              ) : (
                <span className="text-success-ink">Alle har levert</span>
              )}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Write the hero screen**

Create `src/app/(portal)/laerer/oppgaver/[assignmentId]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAssignmentForReview } from '@/lib/dal/assignments';
import { RosterReview } from './RosterReview';

export const metadata: Metadata = { title: 'Oppgave' };

export default async function OppgavePage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const view = await getAssignmentForReview(assignmentId);
  if (!view) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div className="print:hidden">
        <Link
          href="/laerer/oppgaver"
          className="text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          ← Oppgaver
        </Link>
      </div>
      <RosterReview view={view} />
    </div>
  );
}
```

Create `src/app/(portal)/laerer/oppgaver/[assignmentId]/RosterReview.tsx`:

```tsx
'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { AttachmentList } from '@/components/assignments/AttachmentList';
import { AttachmentPicker } from '@/components/assignments/AttachmentPicker';
import { StatusChip } from '@/components/assignments/StatusChip';
import type { AssignmentReviewView, RosterEntry } from '@/lib/dal/assignments';
import { STATUS_LABELS, STATUS_ORDER, type SubmissionStatus } from '@/lib/assignments';
import { formatDateNb } from '@/lib/dates';
import { idleForm } from '@/lib/validation/school';
import {
  assignmentAttachmentUrl,
  submissionAttachmentUrl,
} from '../../../vedlegg/actions';
import {
  confirmAssignmentUpload,
  removeAssignmentAttachment,
  requestAssignmentUpload,
} from '../actions';
import { saveReview } from './actions';

const inputClasses =
  'min-h-11 w-full rounded-md border border-border-input bg-canvas px-4 text-base text-ink ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

/**
 * The count IS the navigation (the Classroom behaviour teachers named). Each
 * segment is a real button with aria-pressed, so the filter is reachable and
 * announced — a bare number would be neither.
 */
function CountRow({
  counts,
  active,
  onSelect,
}: {
  counts: Record<SubmissionStatus, number>;
  active: SubmissionStatus | null;
  onSelect: (status: SubmissionStatus | null) => void;
}) {
  const total = STATUS_ORDER.reduce((sum, status) => sum + counts[status], 0);
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button
        type="button"
        aria-pressed={active === null}
        onClick={() => onSelect(null)}
        className={`min-h-11 rounded-pill px-4 text-sm font-medium tabular-nums transition-colors duration-200 ease-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          active === null ? 'bg-primary text-on-primary' : 'bg-surface-tint text-ink'
        }`}
      >
        Alle {total}
      </button>
      {STATUS_ORDER.filter((status) => counts[status] > 0).map((status) => (
        <button
          key={status}
          type="button"
          aria-pressed={active === status}
          onClick={() => onSelect(active === status ? null : status)}
          className={`min-h-11 rounded-pill px-4 text-sm font-medium tabular-nums transition-colors duration-200 ease-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
            active === status ? 'bg-primary text-on-primary' : 'bg-surface-tint text-ink'
          }`}
        >
          {STATUS_LABELS[status]} {counts[status]}
        </button>
      ))}
    </div>
  );
}

function ReviewForm({
  assignmentId,
  entry,
}: {
  assignmentId: string;
  entry: RosterEntry;
}) {
  const [state, formAction, pending] = useActionState(
    saveReview.bind(null, assignmentId),
    idleForm,
  );
  // Controlled fields: React 19 resets uncontrolled inputs after every
  // completed action, including error replies (ledger #17).
  const [status, setStatus] = useState(entry.review?.status ?? 'godkjent');
  const [points, setPoints] = useState(
    entry.review?.points === null || entry.review?.points === undefined
      ? ''
      : String(entry.review.points),
  );
  const [feedback, setFeedback] = useState(entry.review?.feedback ?? '');

  return (
    <form action={formAction} className="flex flex-col gap-3 pt-2">
      <input type="hidden" name="student_id" value={entry.student_id} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label
            className="text-sm font-medium"
            htmlFor={`status-${entry.student_id}`}
          >
            Vurdering
          </label>
          <select
            id={`status-${entry.student_id}`}
            name="status"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as 'godkjent' | 'ny_innlevering')
            }
            className={`${inputClasses} w-48`}
          >
            <option value="godkjent">Godkjent</option>
            <option value="ny_innlevering">Ny innlevering</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor={`points-${entry.student_id}`}>
            Poeng (valgfritt)
          </label>
          <input
            id={`points-${entry.student_id}`}
            name="points"
            type="number"
            min={0}
            inputMode="numeric"
            value={points}
            onChange={(event) => setPoints(event.target.value)}
            placeholder="–"
            className={`${inputClasses} w-28 tabular-nums`}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor={`feedback-${entry.student_id}`}>
          Tilbakemelding til {entry.first_name}
        </label>
        <textarea
          id={`feedback-${entry.student_id}`}
          name="feedback"
          rows={2}
          maxLength={2000}
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          className={`${inputClasses} py-2`}
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-danger-ink">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm text-success-ink">
          Vurderingen er lagret.
        </p>
      ) : null}
      <div>
        <Button type="submit" loading={pending}>
          Lagre vurdering
        </Button>
      </div>
    </form>
  );
}

export function RosterReview({ view }: { view: AssignmentReviewView }) {
  const [filter, setFilter] = useState<SubmissionStatus | null>(null);
  const [openEntry, setOpenEntry] = useState<string | null>(null);
  const entries = filter
    ? view.entries.filter((entry) => entry.status === filter)
    : view.entries;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold">{view.assignment.title}</h1>
          {view.assignment.is_group ? <Chip>Gruppeoppgave</Chip> : null}
        </div>
        <p className="tabular-nums text-ink/60">
          {view.assignment.class_name} · {view.assignment.subject_name} · frist{' '}
          {formatDateNb(view.assignment.due_on)}
        </p>
        {view.assignment.instructions ? (
          <p className="max-w-prose whitespace-pre-line leading-relaxed">
            {view.assignment.instructions}
          </p>
        ) : null}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Vedlegg fra deg</h2>
        <AttachmentList
          items={view.attachments}
          getUrl={assignmentAttachmentUrl}
          onRemove={(attachmentId) =>
            removeAssignmentAttachment(view.assignment.id, attachmentId)
          }
        />
        <AttachmentPicker
          bucket="assignments"
          onRequest={(declared) => requestAssignmentUpload(view.assignment.id, declared)}
          onConfirm={(path, filename) =>
            confirmAssignmentUpload(view.assignment.id, path, filename)
          }
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Elever</h2>
        <CountRow counts={view.counts} active={filter} onSelect={setFilter} />

        {entries.length === 0 ? (
          <p className="text-sm text-ink/60">
            Ingen elever med denne statusen akkurat nå.
          </p>
        ) : (
          <ul className="divide-y divide-hairline rounded-lg border border-hairline">
            {entries.map((entry) => {
              const open = openEntry === entry.student_id;
              return (
                <li key={entry.student_id} className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="min-w-40 font-medium">
                      {entry.first_name} {entry.last_name}
                    </span>
                    {entry.group_name ? (
                      <span className="text-sm text-ink/60">{entry.group_name}</span>
                    ) : null}
                    <div className="ms-auto flex items-center gap-3">
                      <StatusChip status={entry.status} />
                      <Button
                        variant="ghost"
                        aria-expanded={open}
                        onClick={() => setOpenEntry(open ? null : entry.student_id)}
                      >
                        {open ? 'Lukk' : 'Vurder'}
                      </Button>
                    </div>
                  </div>

                  {open ? (
                    <div className="flex flex-col gap-3 border-s-2 border-hairline ps-4">
                      {entry.body ? (
                        <p className="whitespace-pre-line leading-relaxed">{entry.body}</p>
                      ) : (
                        <p className="text-sm text-ink/60">
                          {entry.submission_id
                            ? 'Levert uten tekst.'
                            : 'Ingen innlevering ennå.'}
                        </p>
                      )}
                      <AttachmentList
                        items={entry.attachments}
                        getUrl={submissionAttachmentUrl}
                      />
                      <ReviewForm assignmentId={view.assignment.id} entry={entry} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Verify in the browser**

```bash
cd /Users/daodilyas/dev/iqra-portal && npm run typecheck && npm run lint && npm run dev
```

Sign in as `laerer@test.local` (TOTP per gotcha 18), open `/laerer/oppgaver`, then the alfabet assignment. Confirm: Bilal appears as **Ikke levert** even though he handed nothing in; clicking «Ikke levert 1» filters to him alone; the group assignment shows both members with «Halaqa A» and the same shared body.

- [ ] **Step 5: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal && git add src/components/assignments "src/app/(portal)/vedlegg" "src/app/(portal)/laerer/oppgaver/page.tsx" "src/app/(portal)/laerer/oppgaver/AssignmentList.tsx" "src/app/(portal)/laerer/oppgaver/[assignmentId]/page.tsx" "src/app/(portal)/laerer/oppgaver/[assignmentId]/RosterReview.tsx" src/lib/dal/session.ts && git commit -m "feat(oppgaver): roster-complete review screen where the counts are the navigation"
```

---

> **Execution ledger — corrected during Task 10 (2026-07-29).** Shipped as two
> commits (`1b1c5e5`, `dd01d86`). Final gate: unit **373 / 27 files** (from
> 311/22) · api **321 / 11** · pgTAP 573/29 (no SQL touched) · typecheck 0 ·
> lint 0 · build clean, both routes `ƒ` · CSP-nonce guard ✓ · knip 0 · actions
> 61 → 63.
>
> ### ★ The counts lied for a pupil in two groups — and the fix is split across two tasks
>
> The whole premise is that the counts are the navigation. `resolveTargets`
> flatMaps every frozen group, so a pupil in two groups of one assignment appeared
> in `entries` twice and `counts[status] += 1` fired twice: «Alle 5» for four
> pupils. `key={student_id}` also collided, duplicating `panelId`/`statusId`/
> `pointsId`/`feedbackId`, so `aria-controls` was ambiguous, a `<label>` click
> focused the wrong control, and «Vurder» opened both panels with two forms
> upserting the same `(assignment_id, student_id)`.
>
> Task 10 fixed the **rendering** half: row identity is `${group_id ?? 'ingen'}-${student_id}`,
> while the *draft* stays keyed on `student_id` alone — deliberately, because
> `assignment_reviews` is keyed `(assignment_id, student_id)`, so two rows are one
> review and must share one draft. The **real** fix is a rider on Task 11, which
> builds the picker that makes overlapping picks reachable.
>
> ### Reviewing under a selected count destroyed its own confirmation
>
> Pressing «Ikke levert 2» and saving a review made the reviewed pupil leave the
> filtered set in the same response (`revalidatePath` returns with the action), so
> the `<ul>` and `ReviewForm` unmounted, `useActionState`'s success state died with
> the component, «Vurderingen er lagret.» never painted, and focus fell to `<body>`
> mid-flow. The draft had carried this reasoning through for the *segment* — which
> deliberately stays on screen at zero — but not for the row underneath it. Fixed
> by always admitting the **open** row to the filter, which repairs the
> confirmation and the focus together with no extra state.
>
> Related, and the deferral that was genuinely load-bearing: `ReviewForm`'s state
> lived inside the conditionally-rendered panel, so «Lukk», opening another pupil,
> or changing the filter silently discarded typed feedback. Drafts are now hoisted
> to `RosterReview`, seeded lazily so an untouched pupil still reflects revalidated
> data. (Task 10's own report had named URL-synced filter state as the notable
> deferral; review disagreed, and the URL deferral's stated reason was also wrong —
> `router.replace` does not push a history entry. It stands on the real cost
> instead: `replace` re-fetches the RSC payload, so every count press is a network
> round trip on a classroom phone.)
>
> ### A 22-mutant sweep still left six single-line deletions uncaught
>
> The sweep was genuine and thorough; review found six more, including the
> **empty-roster branch** (no fixture rendered an empty roster) and — the sharpest
> — the `getUrl` closures. Both arguments are `string`, every attachment fixture
> was `[]`, so **swapping them typechecked and passed the entire unit and api
> suite.** It fails closed, so a coverage hole rather than a leak, but it is the
> one line joining a carefully-proven server action to the UI that calls it. Four
> fixtures closed all six.
>
> ### ⚠ A mutation harness silently reverted a real edit
>
> Task 10 reported `whitespace-nowrap` as shipped; it appeared nowhere in `src`.
> Cause: the harness's `restore()` copied a pre-edit snapshot back over
> `RosterReview.tsx` *after* the edit was made. **A mutation harness can undo real
> work, and the report will not know.** Mitigation adopted: diff the tree against
> the pre-sweep snapshot and grep for every intended edit after the sweep
> finishes. This is a new failure mode for the branch's discipline — mutation
> testing is now itself something to verify.
>
> ### ★ Why the api suite "flakes": GoTrue churn, not concurrency
>
> Repeated full runs left `auth.sessions` at **2069** rows and
> `auth.refresh_tokens` at **2212**; GoTrue queries both on every sign-in, so
> later files start failing `Test timed out` at `signInAsAAL2` — in files the task
> never touched, which reads exactly like a regression elsewhere. Quantified:
> after `supabase db reset`, **321/321 in 757 s** against **1619 s with 4
> failures** — a 2.1× speedup that measures the diagnosis. An earlier run in this
> task had been attributed to concurrent load; that explanation was wrong, and this
> one is measured. **Reset the local stack between repeated full api runs.** Churn
> accumulates ~400 sessions per full run.
>
> ⚠ **One orphan `auth.users` row (`elev-<uuid>@test.local`) was also found, and
> the reported cause is WRONG** — worth recording so nobody "fixes" coverage that
> already exists. `school-actions.test.ts` **does** register every provisioned
> login (`onCleanupLogin(loginEmail)` at both call sites, before the write). The
> plausible mechanism is instead that the reclaim **hook itself timed out**:
> `vitest.config.api.ts` sets `testTimeout: 15000` but **no `hookTimeout`**, so the
> `afterEach` gets vitest's 10 s default, and against a stack carrying 2000+
> sessions a lookup-plus-`deleteUser` can exceed it. The hook fires — it just does
> not finish. Unconfirmed; setting an explicit `hookTimeout` is the cheap test.
>
> ### Design pipeline — what it actually changed
>
> Phase 1 was already anchored: `DESIGN.md` is binding and `design-md-references`
> was deliberately not loaded. `impeccable` earned its place — it caught a
> **DESIGN.md violation shipped in the plan's own draft** (`border-s-2
> border-hairline ps-4`, a banned side-stripe frame) and its no-em-dash rule
> reshaped the Norwegian copy. `emil-design-eng` is why the disclosure has no
> animation at all. `taste-skill`'s variance/motion dials were **overruled by
> DESIGN.md and changed nothing**, and `vercel-react-best-practices` changed
> nothing concrete — both reported honestly rather than implied.
> `/ui-ux-pro-max` and `/frontend-design` were **not loaded**, a real departure
> from CLAUDE.md's mandatory pipeline, disclosed rather than hidden.
> `web-design-guidelines` produced 9 fixes, and its first live-region fix
> introduced a regression (two `role="status"`) that shipped in `1b1c5e5` — the
> claim "caught by its own test" did not hold for the committed code, because the
> test could not see the second region while `saveReview` was mocked.
>
> ### Deliberately unproven
>
> **No browser walkthrough under a real session**, on either commit: signing in
> requires typing a password, which the agent's operating rules prohibit outright.
> Substituted — production build clean, CSP guard green with both routes dynamic,
> `/laerer/oppgaver` returning 307 → `/logg-inn` under the nonce CSP from
> `npm run start`, and React hydrated with 14/14 nonce'd scripts and zero console
> errors. That covers the CSP/hydration class specifically. **It is not a human
> looking at the screen, and this screen is the phase's hero — it wants one.**
> Also unproven: whether the attachment list repaints after an upload without an
> explicit `router.refresh()`.

## Task 11: Teacher UI — the create form and the «Gjenbruk» picker

One route serves both: `/laerer/oppgaver/ny` creates from scratch, `?gjenbruk=1` opens the picker first and then pre-fills the same form. Targeting starts **deliberately blank** on reuse, and the form enforces that.

> ⚠ **Riders carried forward from Task 10's review (2026-07-29).**
>
> 1. **★ Overlapping group templates make the hero screen's counts lie, and this
>    task builds the picker that makes it reachable.** `assignment_group_members`'
>    PK is `(assignment_group_id, student_id)`, and
>    `create_assignment_with_groups` copies each picked template **independently
>    with no overlap guard** — so picking two templates that share a pupil creates
>    two `assignment_groups` rows both containing them. `resolveTargets` flatMaps
>    both, the pupil lands in `entries` twice, and `counts[status] += 1` fires
>    twice: «Alle 5» for four pupils. That is the counts-are-the-navigation claim
>    breaking, on the phase's hero screen. Task 10 fixed the *rendering* half
>    (rows and field ids keyed on `${group_id}-${student_id}`, so React keys and
>    `aria-controls` no longer collide); **this task owes the real fix.** Either
>    refuse overlapping picks — in the RPC, so every caller inherits it, with a
>    Norwegian message naming the two groups — or `distinct on (student_id)` the
>    resolved targets. Prefer refusing: silently de-duplicating would leave the
>    teacher with an assignment whose targeting is not what they picked. A test
>    must prove the refusal, and the fixture is cheap — the seed's Halaqa A plus a
>    second template sharing one pupil.
> 2. **`/laerer/oppgaver/ny` must exist before this task closes, and Task 10's
>    already-shipped links must be verified live.** Task 10 added `Oppgaver` to
>    `LaererNav` and three CTAs («Ny oppgave», «Gjenbruk», «Lag den første
>    oppgaven») that currently 404 because this route does not exist yet. That was
>    accepted as sequencing rather than patched with throwaway placeholders, so
>    **this task owes the verification**: after building the route, confirm all
>    three entry points resolve, and that `?gjenbruk=1` opens the picker rather
>    than the blank form.

**Files:**
- Create: `src/app/(portal)/laerer/oppgaver/ny/page.tsx`, `NewAssignmentForm.tsx`, `ReusePicker.tsx`

- [ ] **Step 1: Write the page**

Create `src/app/(portal)/laerer/oppgaver/ny/page.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { listMyTeachingClasses } from '@/lib/dal/classes';
import { listClassGroups, listReusableAssignments } from '@/lib/dal/assignments';
import { listSubjectsForClass } from '@/lib/dal/subjects';
import { EmptyState } from '@/components/ui/EmptyState';
import { NewAssignmentForm } from './NewAssignmentForm';
import { ReusePicker } from './ReusePicker';

export const metadata: Metadata = { title: 'Ny oppgave' };

export default async function NyOppgavePage({
  searchParams,
}: {
  searchParams: Promise<{ gjenbruk?: string; kilde?: string }>;
}) {
  const { gjenbruk, kilde } = await searchParams;
  const classes = await listMyTeachingClasses();

  if (classes.length === 0) {
    return (
      <EmptyState
        title="Ingen klasser denne terminen"
        description="Oppgaver hører til en klasse. Når administrator har satt deg som lærer i en klasse i inneværende termin, kan du opprette oppgaver her."
      />
    );
  }

  // Groups and subjects for every class the teacher has, so switching class in
  // the form never needs a round trip.
  const groupsByClass = Object.fromEntries(
    await Promise.all(
      classes.map(async (klasse) => [klasse.id, (await listClassGroups(klasse.id)) ?? []] as const),
    ),
  );
  const subjectsByClass = Object.fromEntries(
    await Promise.all(
      classes.map(async (klasse) => [klasse.id, await listSubjectsForClass(klasse.id)] as const),
    ),
  );

  if (gjenbruk === '1' && !kilde) {
    const reusable = await listReusableAssignments();
    return (
      <div className="flex flex-col gap-8">
        <div className="print:hidden">
          <Link
            href="/laerer/oppgaver"
            className="text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            ← Oppgaver
          </Link>
        </div>
        <ReusePicker assignments={reusable} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="print:hidden">
        <Link
          href="/laerer/oppgaver"
          className="text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          ← Oppgaver
        </Link>
      </div>
      <NewAssignmentForm
        classes={classes.map((k) => ({ id: k.id, name: k.name }))}
        groupsByClass={groupsByClass}
        subjectsByClass={subjectsByClass}
        reuseSourceId={kilde ?? null}
      />
    </div>
  );
}
```

If `listSubjectsForClass` does not exist in `src/lib/dal/subjects.ts`, add it, mirroring the existing subject reads in that file:

```ts
/** The subjects taught in one class (class_subjects), for the assignment form. */
export async function listSubjectsForClass(
  classId: string,
): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('class_subjects')
    .select('subject_id, subjects(id, name)')
    .eq('class_id', classId);
  if (error) throw new Error(`Kunne ikke lese fagene: ${error.message}`);
  return (data ?? [])
    .map((row) => row.subjects)
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .map((s) => ({ id: s.id, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'nb'));
}
```

- [ ] **Step 2: Write the reuse picker**

Create `src/app/(portal)/laerer/oppgaver/ny/ReusePicker.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { PillLink } from '@/components/ui/PillLink';
import type { ReusableAssignmentRow } from '@/lib/dal/assignments';
import { formatDateNb } from '@/lib/dates';

export function ReusePicker({ assignments }: { assignments: ReusableAssignmentRow[] }) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? assignments.filter((a) => a.title.toLowerCase().includes(needle))
    : assignments;

  if (assignments.length === 0) {
    return (
      <EmptyState
        title="Ingen tidligere oppgaver ennå"
        description="Gjenbruk lar deg hente fram en oppgave du har laget før — tittel, beskrivelse, fag og vedlegg følger med. Du velger selv klasse, frist og hvem den gjelder for."
        action={<PillLink href="/laerer/oppgaver/ny" active>Lag en ny oppgave</PillLink>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Gjenbruk en oppgave</h1>
        <p className="max-w-prose text-ink/70">
          Tittel, beskrivelse, fag og vedlegg kopieres. Klasse, frist og hvem oppgaven
          gjelder for velger du på nytt.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="reuse-search">
          Søk i tittel
        </label>
        <Input
          id="reuse-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="For eksempel «alfabet»"
        />
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-ink/60">Ingen tidligere oppgaver matcher søket.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((assignment) => (
            <li key={assignment.id}>
              <Link
                href={`/laerer/oppgaver/ny?kilde=${assignment.id}`}
                className="flex flex-col gap-1 rounded-lg border border-hairline px-4 py-4 transition-colors duration-200 ease-brand hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className="text-lg font-semibold">{assignment.title}</span>
                <span className="text-sm tabular-nums text-ink/60">
                  {assignment.class_name} · {assignment.term_name} ·{' '}
                  {assignment.subject_name} · {formatDateNb(assignment.due_on)}
                </span>
                {assignment.attachment_count > 0 ? (
                  <span className="text-sm text-ink/60">
                    {assignment.attachment_count}{' '}
                    {assignment.attachment_count === 1 ? 'vedlegg' : 'vedlegg'} følger med
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write the create form**

Create `src/app/(portal)/laerer/oppgaver/ny/NewAssignmentForm.tsx`:

```tsx
'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import type { ClassGroupRow } from '@/lib/dal/assignments';
import { idleForm } from '@/lib/validation/school';
import { createAssignment, reuseAssignment } from '../actions';

const controlClasses =
  'min-h-11 w-full rounded-md border border-border-input bg-canvas px-4 text-base text-ink ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export function NewAssignmentForm({
  classes,
  groupsByClass,
  subjectsByClass,
  reuseSourceId,
}: {
  classes: { id: string; name: string }[];
  groupsByClass: Record<string, ClassGroupRow[]>;
  subjectsByClass: Record<string, { id: string; name: string }[]>;
  reuseSourceId: string | null;
}) {
  const router = useRouter();
  const action = reuseSourceId ? reuseAssignment : createAssignment;
  const [state, formAction, pending] = useActionState(action, idleForm);

  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const [subjectId, setSubjectId] = useState(subjectsByClass[classes[0]?.id ?? '']?.[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueOn, setDueOn] = useState('');
  const [submissionType, setSubmissionType] = useState<'digital' | 'none'>('digital');
  const [groupIds, setGroupIds] = useState<string[]>([]);

  // Render-adjust navigation on success (no useEffect state machine).
  const [handled, setHandled] = useState<string | null>(null);
  if (state.success && state.assignmentId && handled !== state.assignmentId) {
    setHandled(state.assignmentId);
    router.push(`/laerer/oppgaver/${state.assignmentId}`);
  }

  const groups = groupsByClass[classId] ?? [];
  const subjects = subjectsByClass[classId] ?? [];

  function switchClass(next: string) {
    setClassId(next);
    // Targeting and subject belong to a class; carrying them across would
    // offer groups of the wrong class.
    setGroupIds([]);
    setSubjectId(subjectsByClass[next]?.[0]?.id ?? '');
  }

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <h1 className="text-2xl font-semibold">
        {reuseSourceId ? 'Gjenbruk oppgave' : 'Ny oppgave'}
      </h1>
      {reuseSourceId ? (
        <>
          <input type="hidden" name="source_id" value={reuseSourceId} />
          <p className="max-w-prose text-ink/70">
            Tittel, beskrivelse, fag og vedlegg hentes fra oppgaven du valgte. Velg klasse,
            frist og hvem den gjelder for.
          </p>
        </>
      ) : null}

      <Field label="Klasse" htmlFor="class_id">
        <select
          id="class_id"
          name="class_id"
          value={classId}
          onChange={(event) => switchClass(event.target.value)}
          className={controlClasses}
        >
          {classes.map((klasse) => (
            <option key={klasse.id} value={klasse.id}>
              {klasse.name}
            </option>
          ))}
        </select>
      </Field>

      {reuseSourceId ? null : (
        <>
          <Field label="Fag" htmlFor="subject_id">
            <select
              id="subject_id"
              name="subject_id"
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              className={controlClasses}
            >
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Tittel" htmlFor="title">
            <Input
              id="title"
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              required
            />
          </Field>

          <Field label="Beskrivelse (valgfritt)" htmlFor="instructions">
            <textarea
              id="instructions"
              name="instructions"
              rows={4}
              maxLength={4000}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              className={`${controlClasses} py-2`}
            />
          </Field>

          <Field label="Innlevering" htmlFor="submission_type">
            <select
              id="submission_type"
              name="submission_type"
              value={submissionType}
              onChange={(event) =>
                setSubmissionType(event.target.value as 'digital' | 'none')
              }
              className={controlClasses}
            >
              <option value="digital">Elevene leverer i portalen</option>
              <option value="none">Gjøres på papir / i timen</option>
            </select>
          </Field>
        </>
      )}

      <Field label="Frist" htmlFor="due_on">
        <Input
          id="due_on"
          name="due_on"
          type="date"
          value={dueOn}
          onChange={(event) => setDueOn(event.target.value)}
          required
        />
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-ink">Hvem gjelder oppgaven for?</legend>
        <p className="text-sm text-ink/60">
          Uten valgte grupper gjelder oppgaven hele klassen.
        </p>
        {groups.length === 0 ? (
          <p className="text-sm text-ink/60">
            Klassen har ingen grupper ennå. Du kan lage grupper under klassen.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {groups.map((group) => {
              const checked = groupIds.includes(group.id);
              return (
                <li key={group.id}>
                  <label className="flex min-h-11 items-center gap-3 rounded-md border border-hairline px-3">
                    <input
                      type="checkbox"
                      name="group_ids"
                      value={group.id}
                      checked={checked}
                      onChange={(event) =>
                        setGroupIds((prev) =>
                          event.target.checked
                            ? [...prev, group.id]
                            : prev.filter((id) => id !== group.id),
                        )
                      }
                      className="size-5"
                    />
                    <span className="font-medium">{group.name}</span>
                    <span className="text-sm text-ink/60">
                      {group.members.map((m) => m.first_name).join(', ')}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      {state.error ? (
        <p role="alert" className="text-sm text-danger-ink">
          {state.error}
        </p>
      ) : null}

      <div>
        <Button type="submit" loading={pending}>
          {reuseSourceId ? 'Opprett kopi' : 'Opprett oppgave'}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Verify and commit**

```bash
cd /Users/daodilyas/dev/iqra-portal && npm run typecheck && npm run lint && npm run test:api -- assignments
```

In the browser: create a class-wide assignment, then a group one; then «Gjenbruk» the group one and confirm the new form opens with the title carried over and **no groups pre-selected**.

```bash
cd /Users/daodilyas/dev/iqra-portal && git add "src/app/(portal)/laerer/oppgaver/ny" src/lib/dal/subjects.ts && git commit -m "feat(oppgaver): create form and gjenbruk picker with deliberately blank targeting"
```

---

> **Execution ledger — corrected during Task 11 (2026-07-29).** Shipped as two
> commits (`ea90d73`, `34ae6f7`). Final gate: pgTAP **577 / 29** ·
> api **326 / 11** · unit **407 / 31** · typecheck 0 · lint 0 · build clean with
> `/laerer/oppgaver/ny` in the route table · CSP guard ✓ · knip 0 · actions 63.
> Both riders paid.
>
> ### ★★ The defect was live for two tasks, and the test suite was concealing it
>
> Rider 1's overlap bug was not hypothetical. The **pre-existing** test
> *«copies every chosen template, not just the first»* built its fixture from
> `{Yusuf, Bilal}` and `{Bilal, Idris}` — **Bilal in both** — and passed. It had
> been creating assignments with a pupil in two frozen groups since Task 8, which
> is exactly the state that makes the hero screen's counts over-report. Confirmed
> by the controller against `1b1c5e5` and `dd01d86` before the fix was accepted.
> **A test whose fixture accidentally contains the defect it is adjacent to will
> pass, and its name will read as coverage.**
>
> Fixed by refusal, not de-duplication (`GROUP_OVERLAP|<a>|<b>`), in a new
> migration `…097000` via `create or replace` — one migration per task is the
> convention, and a new file makes the delta legible instead of hiding it inside a
> diff of shipped code. Review verified: 097000 sorts last of the three migrations
> touching the function so `db reset` ends on the guarded version; the live ACL
> carries no `public`/`anon`; and the function body is **byte-identical** to
> 095000's from the first insert to `end;` with comments stripped, so Task 8/9's
> term, size, class, enrolment and subject rules survived untouched. The predicate
> was replayed against seven synthetic fixtures (3 templates overlapping only
> 1st↔3rd, all-disjoint, same template twice, single, zero-member, empty, NULL) —
> a full pairwise scan with `(name, id)` as a strict total order, no evasion found.
> The form disables conflicting groups as the affordance in front of the wall.
>
> ### An "unproven" item closed by argument instead of a fixture
>
> The implementer flagged the guard's `class_id = p_class_id` scoping as untestable,
> since the fixture would need a pupil actively enrolled in two classes and
> `class_students_one_active` (a partial unique index on `(student_id) WHERE
> left_on IS NULL`) forbids it. **No fixture is needed:** for two groups to be
> frozen at all, both must already pass `v_template.class_id <> p_class_id →
> GROUP_FOREIGN` in the loop, so any pair that can reach the copy is inside the
> guard's scope. The filter is redundant-but-harmless and cannot produce a false
> negative. **Worth generalising — when a fixture is forbidden by a constraint,
> ask whether the constraint itself is the proof.**
>
> ### ★ Two new failure modes in mutation testing itself
>
> 1. **A surviving mutant can be a defect in the harness, not a gap in the tests.**
>    N9 first came back SURVIVED; the mutant had been written to add an inert
>    `.neq` rather than to remove the `created_by` narrowing. Rewritten to actually
>    drop the filter, it dies. That was the **second** time in this task that a
>    survivor was a harness bug. Interrogate a survivor before believing it.
> 2. **A naive string-replace inverse corrupts files.** An empty-string mutant made
>    the inverse *prepend* instead of restore, and a mutant whose text already
>    occurred earlier in the file made the inverse restore the wrong occurrence.
>    Both aborted loudly and were restored from pre-sweep copies with sha verified
>    — the sha check added after Task 10 silently lost an edit, earning its place
>    on its first outing. The harness now refuses empty mutants and mutants whose
>    text already occurs.
>
> ### Why the guidelines audit missed two of its own rules
>
> `web-design-guidelines` was run and still missed a `disabled` that removed a
> blocked group from the tab order (in a file arguing the opposite principle 200
> lines earlier) and three render branches with no `<h1>`. The implementer's own
> diagnosis, worth keeping: **single-branch reasoning applied to a multi-branch
> component** — the ruleset was read against the file as written, in one pass, so
> "does this page have an `h1`" was checked on the branch in view and generalised
> to branches never enumerated. The re-run **enumerated 16 render branches first,
> then applied the rules per branch**, and immediately surfaced a further miss (the
> new subject warning was visible-only, now `role="status"`). Audit multi-branch
> components branch-by-branch, not file-by-file.
>
> ### Still unproven
>
> **Nobody has clicked this feature under a real session** — entering a password is
> prohibited, so no implementer on this phase can do it. Also: a `|` typed inside
> the *second* group name misplaces a quote in one sentence (cannot turn a refusal
> into a pass; disclosed at both ends).

## Task 12: Teacher UI — class group templates

**Files:**
- Create: `src/app/(portal)/laerer/klasser/[id]/grupper/page.tsx`, `GroupTemplates.tsx`
- Modify: `src/app/(portal)/laerer/klasser/[id]/page.tsx` (link to the new route)

- [ ] **Step 1: Write the page**

Create `src/app/(portal)/laerer/klasser/[id]/grupper/page.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listClassGroups } from '@/lib/dal/assignments';
import { getClassRosterForTeacher } from '@/lib/dal/classes';
import { GroupTemplates } from './GroupTemplates';

export const metadata: Metadata = { title: 'Grupper' };

export default async function GrupperPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const groups = await listClassGroups(id);
  if (!groups) notFound();
  const roster = await getClassRosterForTeacher(id);

  return (
    <div className="flex flex-col gap-8">
      <div className="print:hidden">
        <Link
          href={`/laerer/klasser/${id}`}
          className="text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          ← Klassen
        </Link>
      </div>
      <GroupTemplates classId={id} groups={groups} roster={roster ?? []} />
    </div>
  );
}
```

Reuse whatever the class page already calls to fetch its active roster — check `src/lib/dal/classes.ts` for the existing function name and use it verbatim rather than adding a near-duplicate. It must return `{ student_id, first_name, last_name }[]` for actively enrolled pupils; adapt the shape in the page if it differs.

- [ ] **Step 2: Write the client component**

Create `src/app/(portal)/laerer/klasser/[id]/grupper/GroupTemplates.tsx`:

```tsx
'use client';

import { useActionState, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import type { ClassGroupRow } from '@/lib/dal/assignments';
import { MAX_GROUP_SIZE, MIN_GROUP_SIZE } from '@/lib/assignments';
import { idleForm } from '@/lib/validation/school';
import { deleteClassGroup, saveClassGroup } from './actions';

interface RosterMember {
  student_id: string;
  first_name: string;
  last_name: string;
}

function GroupForm({
  classId,
  roster,
  editing,
  onDone,
}: {
  classId: string;
  roster: RosterMember[];
  editing: ClassGroupRow | null;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    saveClassGroup.bind(null, classId),
    idleForm,
  );
  const [name, setName] = useState(editing?.name ?? '');
  const [picked, setPicked] = useState<string[]>(
    editing?.members.map((m) => m.student_id) ?? [],
  );
  const [handled, setHandled] = useState(false);
  if (state.success && !handled) {
    setHandled(true);
    onDone();
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg border border-hairline p-4">
      {editing ? <input type="hidden" name="group_id" value={editing.id} /> : null}
      <Field label="Gruppenavn" htmlFor="group-name">
        <Input
          id="group-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          placeholder="For eksempel «Halaqa A»"
          required
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">
          Elever ({MIN_GROUP_SIZE}–{MAX_GROUP_SIZE})
        </legend>
        <ul className="flex flex-col gap-2">
          {roster.map((member) => {
            const checked = picked.includes(member.student_id);
            return (
              <li key={member.student_id}>
                <label className="flex min-h-11 items-center gap-3 rounded-md border border-hairline px-3">
                  <input
                    type="checkbox"
                    name="student_ids"
                    value={member.student_id}
                    checked={checked}
                    onChange={(event) =>
                      setPicked((prev) =>
                        event.target.checked
                          ? [...prev, member.student_id]
                          : prev.filter((id) => id !== member.student_id),
                      )
                    }
                    className="size-5"
                  />
                  <span>
                    {member.first_name} {member.last_name}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="text-sm tabular-nums text-ink/60">{picked.length} valgt</p>
      </fieldset>

      {state.error ? (
        <p role="alert" className="text-sm text-danger-ink">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>
          {editing ? 'Lagre gruppen' : 'Opprett gruppen'}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Avbryt
        </Button>
      </div>
    </form>
  );
}

/**
 * Two-step delete. The confirm button is KEYED separately from the trigger so
 * React cannot reconcile them into the same DOM node — the demo audit found a
 * real data-loss path where a reused, still-focused button was rewired to the
 * destructive handler and a second Enter deleted a group unseen.
 */
function DeleteGroup({ classId, groupId }: { classId: string; groupId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <Button key="ask" variant="ghost" onClick={() => setConfirming(true)}>
        Slett
      </Button>
    );
  }
  return (
    <div key="confirm" className="flex flex-wrap items-center gap-2">
      <span className="text-sm">Slette gruppen?</span>
      <Button
        key="confirm-yes"
        variant="secondary"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await deleteClassGroup(classId, groupId);
            setError(result.error);
            if (!result.error) setConfirming(false);
          })
        }
      >
        Ja, slett
      </Button>
      <Button key="confirm-no" variant="ghost" onClick={() => setConfirming(false)}>
        Avbryt
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-danger-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function GroupTemplates({
  classId,
  groups,
  roster,
}: {
  classId: string;
  groups: ClassGroupRow[];
  roster: RosterMember[];
}) {
  const [editing, setEditing] = useState<ClassGroupRow | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Grupper</h1>
        <p className="max-w-prose text-ink/70">
          Grupper lages her og brukes når du oppretter en oppgave. Når oppgaven er sendt,
          ligger gruppen fast på den — senere endringer her påvirker bare nye oppgaver.
        </p>
      </div>

      {groups.length === 0 && !creating ? (
        <EmptyState
          title="Ingen grupper ennå"
          description="Lag grupper på 2–4 elever på forhånd, så kan du sende en oppgave til akkurat de gruppene du vil i stedet for hele klassen."
          action={<Button onClick={() => setCreating(true)}>Lag den første gruppen</Button>}
        />
      ) : null}

      {groups.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {groups.map((group) => (
            <li key={group.id} className="flex flex-col gap-2 rounded-lg border border-hairline px-4 py-3">
              {editing?.id === group.id ? (
                <GroupForm
                  classId={classId}
                  roster={roster}
                  editing={group}
                  onDone={() => setEditing(null)}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="font-medium">{group.name}</span>
                  <span className="text-sm text-ink/60">
                    {group.members.map((m) => `${m.first_name} ${m.last_name}`).join(', ')}
                  </span>
                  <div className="ms-auto flex items-center gap-2">
                    <Button variant="ghost" onClick={() => setEditing(group)}>
                      Endre
                    </Button>
                    <DeleteGroup classId={classId} groupId={group.id} />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {creating ? (
        <GroupForm
          classId={classId}
          roster={roster}
          editing={null}
          onDone={() => setCreating(false)}
        />
      ) : groups.length > 0 ? (
        <div>
          <Button onClick={() => setCreating(true)}>Ny gruppe</Button>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Link it from the class page**

In `src/app/(portal)/laerer/klasser/[id]/page.tsx`, add a `PillLink` to `/laerer/klasser/{id}/grupper` labelled «Grupper» alongside the existing class actions, matching that page's current link styling.

- [ ] **Step 4: Verify and commit**

```bash
cd /Users/daodilyas/dev/iqra-portal && npm run typecheck && npm run lint && npm run test:api -- assignments-actions
```

```bash
cd /Users/daodilyas/dev/iqra-portal && git add "src/app/(portal)/laerer/klasser/[id]/grupper" "src/app/(portal)/laerer/klasser/[id]/page.tsx" && git commit -m "feat(oppgaver): class group template management"
```

---

## Task 13: Pupil and parent surfaces

The pupil hands in; the parent hands in on behalf. Group tasks show group-mates and the shared hand-in. A parent sees **only their own child's** review — the wall proven in pgTAP 22 made visible.

**Files:**
- Create: `src/app/(portal)/elev/lekser/page.tsx`, `HandInForm.tsx`
- Create: `src/app/(portal)/forelder/lekser/page.tsx`, `ChildHandIn.tsx`
- **Rider below:** create `supabase/migrations/2026_________group_comember_names.sql`; modify `src/lib/dal/assignments.ts`, `src/lib/assignments.ts` (+ its test), `supabase/tests/22_*.sql`

> ### ⚠ Rider — group-mate names (user decision, 2026-07-29: **first name + last initial**)
>
> Task 7 shipped `group_mates` as an array of empty strings and nobody noticed,
> because `students` RLS gives a pupil only their own row and a guardian only
> their own children — a group mate is by definition another family's child. The
> interim fix made the field `{ student_id: string; name: string | null }[]`,
> which is honest but still renders nothing. **This rider makes it render, and it
> must land before the pupil/parent surfaces are built on top of a blank field.**
>
> **The decision, and why it is not the privacy expansion it looks like.**
> `private.reads_submission` (`20260728093000:184-215`) already grants **every
> group member and every member's guardian** read access to the shared hand-in
> row *including its `body`* — that is D3, deliberate and already shipped. Family
> B can therefore already read text family A's child wrote. Withholding the name
> leaves the absurd result that they read the work but cannot know who wrote it.
> A first name plus a last initial is **strictly less** exposure than what is
> already in production, and is the minimum that lets a nine-year-old work out
> who they are recording an ayah with. Full surnames were considered and rejected
> under Art. 5(1)(c) data minimisation; the initial disambiguates two pupils
> sharing a first name, which a bare first name does not.
>
> **Migration — one policy, tightly scoped:**
> - `students_select_group_comember`, `for select to authenticated`.
> - Admits a `students` row only when the caller is a member of, or a guardian of
>   a member of, **the same frozen `assignment_group`** as that row's pupil. Not
>   the class. Not the school. The group is teacher-created, 2–4 pupils, and
>   frozen at creation, so the exposure set cannot drift after the fact.
> - **`and protected = false`**, following the `students_select_taught_ever`
>   precedent (`20260721120712_attendance_visibility.sql:79`). A protected child
>   stays invisible even to their own group. Non-negotiable.
> - Resolve membership through a `private.` helper, not an inline subquery on
>   `assignment_group_members` — that table is RLS-protected and the house rule
>   forbids inlining it (the same correction Task 4's review made to `submissions`).
>
> **DAL + formatting:**
> - `readAssignmentsForStudent` selects `first_name, last_name` for members and
>   formats through a new pure `shortName(firstName, lastName)` in
>   `src/lib/assignments.ts`, unit-tested beside `safeStorageName`.
> - `shortName('Yusuf', 'Ahmed')` → `'Yusuf A.'`. An empty or whitespace-only
>   surname yields the first name alone with **no trailing period**. A hyphenated
>   or particled surname takes the first letter as written (`'Al-Hassan'` → `'A.'`).
> - ⚠ Take the initial with `[...lastName][0]`, **not** `lastName[0]` — the Task 6
>   lone-surrogate trap, one file over. Uppercase it (`'å'` → `'Å'`).
> - `name` stays `string | null`: null is what a **protected** mate resolves to,
>   and the surfaces must render a placeholder for that case rather than a blank.
>
> **pgTAP (append to the Task 4 file, and fix its `plan()` count — count with
> grep):** all three directions, each mutation-tested. A co-member's guardian
> reads the row; a family in the same *class* but not the same *group* does not;
> a `protected` pupil is invisible **even to their own group mates**. If deleting
> the `protected = false` clause does not turn a test red, that test is not
> testing it — this branch has already shipped four assertions that could not
> fail, and a new RLS wall is the last place to add a fifth.

- [ ] **Step 1: Write the pupil surface**

Create `src/app/(portal)/elev/lekser/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { listAssignmentsForStudent } from '@/lib/dal/assignments';
import { EmptyState } from '@/components/ui/EmptyState';
import { HandInForm } from './HandInForm';

export const metadata: Metadata = { title: 'Lekser' };

export default async function LekserPage() {
  const assignments = await listAssignmentsForStudent();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Lekser og oppgaver</h1>
      {assignments.length === 0 ? (
        <EmptyState
          title="Ingen lekser akkurat nå"
          description="Når læreren din gir en oppgave, dukker den opp her med frist. Du kan levere tekst og legge ved bilde, lyd eller dokument."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {assignments.map((assignment) => (
            <li key={assignment.id}>
              <HandInForm assignment={assignment} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

Create `src/app/(portal)/elev/lekser/HandInForm.tsx`:

```tsx
'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { AttachmentList } from '@/components/assignments/AttachmentList';
import { AttachmentPicker } from '@/components/assignments/AttachmentPicker';
import { StatusChip } from '@/components/assignments/StatusChip';
import type { StudentAssignmentRow } from '@/lib/dal/assignments';
import { formatDateNb } from '@/lib/dates';
import { idleForm } from '@/lib/validation/school';
import {
  assignmentAttachmentUrl,
  submissionAttachmentUrl,
} from '../../vedlegg/actions';
import {
  confirmSubmissionUpload,
  removeOwnSubmissionAttachment,
  requestOwnSubmissionUpload,
  submitOwnHandIn,
} from './actions';

export function HandInForm({ assignment }: { assignment: StudentAssignmentRow }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    submitOwnHandIn.bind(null, assignment.id),
    idleForm,
  );
  const [body, setBody] = useState(assignment.body ?? '');
  const locked = assignment.review?.status === 'godkjent';

  return (
    <article className="flex flex-col gap-4 rounded-lg border border-hairline px-4 py-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="text-lg font-semibold">{assignment.title}</h2>
          <StatusChip status={assignment.status} />
          {assignment.group_name ? <Chip>{assignment.group_name}</Chip> : null}
        </div>
        <p className="text-sm tabular-nums text-ink/60">
          {assignment.subject_name} · frist {formatDateNb(assignment.due_on)}
        </p>
        {assignment.instructions ? (
          <p className="max-w-prose whitespace-pre-line leading-relaxed">
            {assignment.instructions}
          </p>
        ) : null}
        {assignment.group_mates.length > 0 ? (
          <p className="text-sm text-ink/70">
            Du er i gruppe med {assignment.group_mates.join(', ')}. Dere leverer sammen —
            én innlevering gjelder for hele gruppa.
          </p>
        ) : null}
      </div>

      {assignment.attachments.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Fra læreren</h3>
          <AttachmentList items={assignment.attachments} getUrl={assignmentAttachmentUrl} />
        </section>
      ) : null}

      {assignment.review ? (
        <section className="flex flex-col gap-1 rounded-md bg-surface-tint px-4 py-3">
          <h3 className="text-sm font-medium">
            {assignment.review.status === 'godkjent' ? 'Godkjent' : 'Ny innlevering ønskes'}
            {assignment.review.points !== null ? ` · ${assignment.review.points} poeng` : ''}
          </h3>
          {assignment.review.feedback ? (
            <p className="leading-relaxed">{assignment.review.feedback}</p>
          ) : null}
        </section>
      ) : null}

      {assignment.submission_type === 'none' ? (
        <p className="text-sm text-ink/60">
          Denne oppgaven gjøres på papir eller i timen — du trenger ikke levere her.
        </p>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor={`body-${assignment.id}`}>
              Svaret ditt
            </label>
            <textarea
              id={`body-${assignment.id}`}
              name="body"
              rows={3}
              maxLength={4000}
              value={body}
              disabled={locked}
              onChange={(event) => setBody(event.target.value)}
              className="min-h-11 w-full rounded-md border border-border-input bg-canvas px-4 py-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
            />
          </div>

          {assignment.submission_id ? (
            <AttachmentList
              items={assignment.submission_attachments}
              getUrl={submissionAttachmentUrl}
              onRemove={
                locked
                  ? undefined
                  : (attachmentId) =>
                      removeOwnSubmissionAttachment(assignment.submission_id!, attachmentId)
              }
            />
          ) : null}

          {assignment.submission_id && !locked ? (
            <AttachmentPicker
              bucket="submissions"
              onRequest={(declared) =>
                requestOwnSubmissionUpload(assignment.submission_id!, declared)
              }
              onConfirm={(path, filename) =>
                confirmSubmissionUpload(assignment.submission_id!, path, filename)
              }
              onDone={() => router.refresh()}
              label="Legg ved fil"
            />
          ) : null}

          {!assignment.submission_id ? (
            <p className="text-sm text-ink/60">
              Lever først, så kan du legge ved bilde, lyd eller dokument.
            </p>
          ) : null}

          {state.error ? (
            <p role="alert" className="text-sm text-danger-ink">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p role="status" className="text-sm text-success-ink">
              Innleveringen er lagret.
            </p>
          ) : null}

          {locked ? (
            <p className="text-sm text-ink/60">
              Oppgaven er godkjent og kan ikke endres.
            </p>
          ) : (
            <div>
              <Button type="submit" loading={pending}>
                {assignment.submission_id ? 'Lagre innlevering' : 'Lever'}
              </Button>
            </div>
          )}
        </form>
      )}
    </article>
  );
}
```

- [ ] **Step 2: Write the parent surface**

Create `src/app/(portal)/forelder/lekser/page.tsx`. It mirrors the pupil page, with a child switcher when the guardian has several children. Read the guardian's children with the existing DAL function the other `forelder` pages use (`src/app/(portal)/forelder/fremdrift/page.tsx` is the reference for the switcher markup — copy its pattern rather than inventing a second one), then call `listAssignmentsForChild(activeChildId)`.

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listAssignmentsForChild } from '@/lib/dal/assignments';
import { listOwnChildren } from '@/lib/dal/students';
import { EmptyState } from '@/components/ui/EmptyState';
import { PillLink } from '@/components/ui/PillLink';
import { ChildHandIn } from './ChildHandIn';

export const metadata: Metadata = { title: 'Lekser' };

export default async function ForelderLekserPage({
  searchParams,
}: {
  searchParams: Promise<{ barn?: string }>;
}) {
  const { barn } = await searchParams;
  const children = await listOwnChildren();
  if (children.length === 0) {
    return (
      <EmptyState
        title="Ingen barn registrert"
        description="Når skolen har knyttet barnet ditt til kontoen din, ser du leksene deres her."
      />
    );
  }
  const activeId = barn && children.some((c) => c.id === barn) ? barn : children[0].id;
  const assignments = await listAssignmentsForChild(activeId);
  if (!assignments) notFound();
  const active = children.find((c) => c.id === activeId)!;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Lekser og oppgaver</h1>

      {children.length > 1 ? (
        <nav aria-label="Velg barn" className="print:hidden">
          <ul className="flex flex-wrap gap-2">
            {children.map((child) => (
              <li key={child.id}>
                <PillLink
                  href={`/forelder/lekser?barn=${child.id}`}
                  active={child.id === activeId}
                  aria-current={child.id === activeId ? 'page' : undefined}
                >
                  {child.first_name}
                </PillLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {assignments.length === 0 ? (
        <EmptyState
          title={`Ingen lekser for ${active.first_name} akkurat nå`}
          description="Når læreren gir en oppgave, ser du den her med frist og status. Du kan levere på vegne av barnet ditt hvis det trengs."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {assignments.map((assignment) => (
            <li key={assignment.id}>
              <ChildHandIn assignment={assignment} studentId={activeId} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

Use whatever `src/lib/dal/students.ts` already exports for "this guardian's children" instead of `listOwnChildren` if the name differs — the file already has such a read (it powers `/forelder/fremdrift`).

Create `src/app/(portal)/forelder/lekser/ChildHandIn.tsx` as a copy of `HandInForm` with three changes: it takes an extra `studentId` prop, binds `submitChildHandIn.bind(null, assignment.id, studentId)`, and imports the parent-side upload actions (`requestChildSubmissionUpload`, `confirmChildSubmissionUpload`, `removeChildSubmissionAttachment`). Change the label «Svaret ditt» to «Svar» and the group note to «{name} er i gruppe med …».

- [ ] **Step 3: Verify and commit**

```bash
cd /Users/daodilyas/dev/iqra-portal && npm run typecheck && npm run lint
```

In the browser: as `elev@test.local`, hand in on the group task and confirm the group-mate note names Bilal. As `laererforelder@test.local` (Bilal's parent), open `/forelder/lekser` and confirm the shared hand-in is visible but **no review** shows for Bilal after the teacher has reviewed only Yusuf.

```bash
cd /Users/daodilyas/dev/iqra-portal && git add "src/app/(portal)/elev/lekser" "src/app/(portal)/forelder/lekser" && git commit -m "feat(oppgaver): pupil and parent hand-in surfaces with shared group submissions"
```

---

## Task 14: Navigation and the admin block

**Files:**
- Modify: `src/app/(portal)/laerer/LaererNav.tsx`, `src/app/(portal)/elev/ElevNav.tsx`, `src/app/(portal)/forelder/ForelderNav.tsx`, `src/app/(portal)/admin/page.tsx`

- [ ] **Step 1: Add the nav entries**

In `LaererNav.tsx`, add `{ href: '/laerer/oppgaver', label: 'Oppgaver', exact: false }` to `ITEMS` after «I dag». In `ElevNav.tsx` and `ForelderNav.tsx`, add `{ href: '/elev/lekser', label: 'Lekser' }` and `{ href: '/forelder/lekser', label: 'Lekser' }` respectively, matching each file's existing item shape.

- [ ] **Step 2: Add the admin oversight block**

Add a read to `src/lib/dal/assignments.ts`:

```ts
export interface AdminAssignmentSummary {
  total: number;
  due_soon: number;
  awaiting_review: number;
}

/** One-glance oversight for the admin dashboard (spec §7). */
export async function getAssignmentSummaryForAdmin(): Promise<AdminAssignmentSummary> {
  await requireStaffRole('admin');
  const supabase = await createClient();
  const today = todayOsloISO();
  const { data, error } = await supabase
    .from('assignments')
    .select('id, due_on, submissions(id), assignment_reviews(assignment_id)');
  if (error) {
    throw new Error(`Kunne ikke lese oppgavene: ${error.message}`);
  }
  const rows = data ?? [];
  return {
    total: rows.length,
    due_soon: rows.filter((row) => row.due_on >= today).length,
    awaiting_review: rows.filter(
      (row) => (row.submissions ?? []).length > (row.assignment_reviews ?? []).length,
    ).length,
  };
}
```

Add `import { todayOsloISO } from '@/lib/dates';` to that file.

In `src/app/(portal)/admin/page.tsx`, add a block matching the dashboard's existing card markup:

```tsx
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Oppgaver</h2>
        <p className="tabular-nums text-ink/70">
          {oppgaver.total} oppgaver · {oppgaver.due_soon} med frist framover ·{' '}
          {oppgaver.awaiting_review} venter på vurdering
        </p>
      </section>
```

with `const oppgaver = await getAssignmentSummaryForAdmin();` alongside the page's other reads.

- [ ] **Step 3: Verify and commit**

```bash
cd /Users/daodilyas/dev/iqra-portal && npm run typecheck && npm run lint && npm run build
```

```bash
cd /Users/daodilyas/dev/iqra-portal && git add "src/app/(portal)/laerer/LaererNav.tsx" "src/app/(portal)/elev/ElevNav.tsx" "src/app/(portal)/forelder/ForelderNav.tsx" "src/app/(portal)/admin/page.tsx" src/lib/dal/assignments.ts && git commit -m "feat(oppgaver): role navigation entries and admin oversight block"
```

---

## Task 15: Exit gate

- [ ] **Step 1: Full suite from a clean database**

```bash
cd /Users/daodilyas/dev/iqra-portal && supabase db reset && supabase test db && npm run typecheck && npm run lint && npm run test && npm run test:api && npm run build
```

Expected: 26 pgTAP files ok; typecheck 0 errors; lint no new problems beyond the pre-existing ones; unit + api suites green; `next build` succeeds.

- [ ] **Step 2: Run the design audit**

Invoke the `web-design-guidelines` skill against every file created in Tasks 10–13. Fix what it finds; **every behavioural fix needs a test verified to fail without it** (the demo audit's group-delete data-loss path is the precedent — that bug was invisible to typecheck and lint).

- [ ] **Step 3: Verify the sharp/libvips obligation (design spec §10.4)**

```bash
cd /Users/daodilyas/dev/iqra-portal && grep -rn "next/image\|<Image" src/components/assignments src/app/\(portal\)/laerer/oppgaver src/app/\(portal\)/elev/lekser src/app/\(portal\)/forelder/lekser
```

Expected: **no matches.** Attachments must be served by signed URL straight from Storage, never through `next/image` — routing user-supplied images through the optimiser would put them in front of libvips and collapse the justification for the accepted `sharp` advisory. If a match appears, replace it with a plain link or `<img>` on a signed URL, and re-run.

```bash
cd /Users/daodilyas/dev/iqra-portal && node scripts/audit-gate.mjs
```

Expected: pass. If a new advisory has appeared or an acceptance has expired, resolve it before the PR — that gate is what caught the nine unpatched Next advisories before the demo went public.

- [ ] **Step 4: Browser-verify each role at 1280 and 375**

Teacher: list → hero (counts filter to names; non-submitters are rows) → create → gjenbruk → grupper. Pupil: hand in, attach a file, see group-mates. Parent: switch child, hand in on behalf, see only own child's review. Admin: the oppgaver block. Check focus rings, 44 px targets, `role="alert"` errors, and that nothing scrolls horizontally at 375.

- [ ] **Step 5: Confirm the commit list and open the PR**

> ⚠ **The branch is `feat/phase-4-oppgaver`, not `feat/phase-4`.** PR #14 (the
> audit-hardening series) merged into `real` with `--rebase` on 2026-07-28 22:07Z,
> giving every commit a new SHA, so the original `feat/phase-4` became a
> stale-SHA duplicate of work already in `real`. Tasks 6 and 7 were cherry-picked
> onto a fresh branch off `origin/real` @ `f873430` on 2026-07-29 — a clean
> replay, since `git diff` between the two bases was empty. The old branch and
> `origin/feat/phase-4` still exist; delete them once this PR is open.

```bash
cd /Users/daodilyas/dev/iqra-portal && git log --oneline real..feat/phase-4-oppgaver
```

Expected: 10 commits — Tasks 6–15, one per task. (Tasks 1–5b shipped in `real`
via PR #14, so they are not in this range.)

```bash
cd /Users/daodilyas/dev/iqra-portal && git push -u origin feat/phase-4-oppgaver
```

Open the PR `feat/phase-4-oppgaver → real`. **This PR gets the full multi-agent review panel** — Storage and child-data RLS are new walls (2026-07-21 review policy).

- [ ] **Step 6: Record what this phase leaves open**

Add to the PR description:

- **R2:** TUS/resumable upload deferred. Signed-URL PUT covers the full 50 MB; what is missing is resume-after-dropped-connection. Revisit if pilot teachers report failed phone uploads.
- **Storage retention:** erasure must delete objects, not just rows (Phase 7). Both new buckets must be named in the Art. 30 record and the DPIA — audio and video of children are markedly more sensitive than a worksheet photo.
- **Storage cost:** reuse duplicates bytes and video is allowed at 50 MB. No quota exists. Worth a settings-driven per-class ceiling before pilot.
- **`assignment_reviews.points`:** free non-negative integer, no scale. Revisit if teachers ask for a cap.
- **D7:** pupil self-add to groups stays deferred — purely additive, no migration.

**Ledger items found during Task 1's review (record, do not fix this phase):**

- **Same-day re-enrolment is still blocked.** R3 made same-class re-enrolment *possible*, but the classic mis-click — enrol today, unenrol today — still cannot be undone until tomorrow: `left_on` becomes today, `enrollStudentAction` always inserts `enrolled_on = today`, and that collides with `class_students_interval_unique`. There is no UI to edit or delete a `class_students` row. The schema affords the fix (that is the surrogate key's whole rationale); nothing in the app performs it. Wants either an editable `enrolled_on` or a same-day unenrol that deletes rather than stamps.
- **Overlapping intervals are not prevented.** `class_students_interval_unique` forbids *identical* intervals, not *overlapping* ones, and R3 makes multiple rows per (class, pupil) possible for the first time. Unreachable today — `enrolled_on` is never set explicitly anywhere in `src/`, it always takes the DB default. But if back-dating is ever introduced, an as-of-date roster read returns the same pupil twice, inflating counts in `lessons.ts` and duplicating rows in `attendance.ts`, `assessment.ts` and both marking actions. **This matters more after Phase 4**, because assignments read rosters as-of `due_on` too. The real fix is an exclusion constraint (`daterange` + `btree_gist`), not another unique index.
- **`tests/api` still does not run in CI** (pre-existing, Phase-7 ledger). R4 and the term filter are therefore proven only by a local run; `24_enrollment_riders.sql` does run in CI via the `db` job. Worth remembering when judging how much the green suite actually guarantees.

---

## Self-review

**Spec coverage.** §1 D1–D10: D1 Task 3 + Task 8 (frozen copy, proven by the template-shrink test); D2 Tasks 6/8/12; D3 Task 4 + the two starred pgTAP assertions; D4/D6 Task 5; D5 out of scope by design (Phase 5); D7 Task 2 (no pupil/parent SELECT on templates); D8 Task 6 `deriveStatus`; D9 Task 4 XOR CHECK; D10 Task 9. §2 data model → Tasks 2–5. §3 snapshot semantics → Task 8's RPC. §3.1 reuse → Task 9. §4 RLS incl. all five named helpers → Tasks 2–4 (`teaches_assignment`, `student_in_assignment`, `guardian_sees_assignment`, `student_sees_assignment`, `can_write_submission`). §5 Storage → Task 5 + R1. §6 flows → Tasks 10–13. §7 surfaces → all six routes. §8 testing: pgTAP 20–23 ✔ (plus 24 for the riders), `tests/api` ✔, unit ✔, and the four standing regressions re-pinned — parent A ↛ child B (pgTAP 22), teacher X ↛ class Y (pgTAP 21), and the new one, guardian of member A ↛ review of member B (pgTAP 22, starred). §9 deferrals honoured. §10.1 riders → Task 1; §10.4 sharp obligation → Task 15 Step 3.

**Not covered, deliberately:** §8's "exports omit `protected`" regression — there is no export path in this phase; it stays pinned where it lives (Phase 7).

**Type consistency.** `SubmissionStatus` and `deriveStatus({dueOn, submittedOn, reviewed})` are used identically in `src/lib/assignments.ts`, the DAL, and every component. `FormState` gains one optional field (`assignmentId`) declared in Task 8 and consumed in Tasks 9 and 11. `AttachmentRow` (DAL) and `AttachmentItem` (component) are structurally compatible — the component takes the narrower shape on purpose so it never receives a `path`.

**Two things the implementer must not skip:** the `v_new_group_id` variable fix flagged inside Task 8 Step 3 (reusing the loop variable silently corrupts the second group), and the pupil-count correction flagged in Task 4 Step 1 (write `2::bigint`, not 3).
