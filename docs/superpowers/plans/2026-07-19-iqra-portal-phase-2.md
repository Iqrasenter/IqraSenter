# IQRA Skoleportal — Phase 2 (Attendance) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn each class's weekly `class_schedule` into a live attendance loop — generate dated `lessons` per term, let teachers mark attendance one-tap from an "I dag" view, let parents pre-report absence, and give parents/students/admin the history and cockpit views — all under the two-wall model with both adversarial suites extended and the fine-derived regressions re-pinned for attendance.

**Architecture:** Three new tables (`lessons`, `attendance`, `absence_notices`) with default-deny RLS mirroring §3's matrix, plus SECURITY DEFINER relationship helpers in `private` (`teaches_lesson`, `taught_student_ever`, `guardian_sees_lesson`, `student_sees_lesson`) that preserve attendance history via `teaches_class` (never `teaches_student`) — the "interval-based preserve" decision. Lessons are materialized by an idempotent SQL function `public.generate_lessons_for_term` (admin-only, `on conflict do nothing`). Every DAL read carries its own scoping predicate (the `.eq`/relationship discipline); writes flow through the caller's own RLS-gated session (no service-role in the attendance write path). Design spec: `docs/superpowers/specs/2026-07-19-iqra-portal-phase-2-attendance-design.md`.

**Tech Stack:** Unchanged from Phase 1 — Next.js 16 (App Router, `src/`, Turbopack), React 19 (`useActionState`), TypeScript strict, Tailwind v4 tokens from `globals.css`, `@supabase/ssr` + `@supabase/supabase-js` v2, Zod, Vitest (+ `vitest.config.api.ts` live suite), Supabase CLI with SQL migrations + pgTAP. **Zero new npm dependencies.**

---

## Read this before starting

**The portal repo is `/Users/daodilyas/dev/iqra-portal`** — NOT the session cwd (the marketing site). Plans/specs live in the marketing repo under `docs/superpowers/`; ALL code work happens in the portal repo. Environment gotchas (this machine — all still true from Phase 0/1):

1. **Every Bash step must `cd /Users/daodilyas/dev/iqra-portal` explicitly.** Shell cwd resets between calls. Never rely on a previous step's directory.
2. **Work on branch `feat/phase-2`** — Task 1 creates it from `main` (Phase 1 is merged; `main` is the base).
3. **Docker + Supabase quirks:** if the stack is down, never plain `supabase start` — use `supabase start --ignore-health-check`, then wait until `docker ps` shows every container healthy (`rest`/`edge-runtime` have no healthcheck; plain `Up` is their healthy). `supabase db reset` completes all DB work even when it exits 1 in its final `Restarting containers...` phase — the `Applying migration .../Seeding data...` lines are the success signal; when it exits 1, do NOT re-run it: run the wait loop, then continue (the following `supabase test db` is the real verification).
4. **`supabase test db` runs pgTAP against the CURRENT local database.** Always `supabase db reset` after changing migrations/seeds, then `supabase test db`.
5. **Stale `.next` after `npm run build`:** running `npm run build` right before `npm run dev` leaves a manifest that 404s every route. Before browser-verifying after a build: `rm -rf .next`, then `npm run dev`.
6. **Commit messages:** Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). Never mention Claude/AI. **No Co-Authored-By trailers.**
7. **Norwegian UI, English code.** User-facing strings are bokmål; identifiers, comments, DB names are English. New URL paths this phase: `/laerer/timer/[lessonId]`; new admin/parent/student surfaces reuse existing paths (`/laerer`, `/laerer/klasser/[id]`, `/forelder`, `/elev`, `/admin`, `/admin/terminer/[id]`, `/admin/klasser/[id]`, `/admin/elever/[id]`).
8. **Design system is LOCKED (direction "C · Familie", spec §7).** Tokens in `src/app/globals.css`; primitives in `src/components/ui/` (`Button`, `Field`, `Input`, `Chip`, `Skeleton`, `EmptyState`, `PillLink`) and `src/components/shell/` (`PortalShell`, `RoleSwitcher`) — read them before writing UI. Bans: no kicker/eyebrow mini-labels, no emojis in UI, no purple, never `#000`/`#fff` (use `ink`/`canvas`), no gradient text, no identical-card grids. Interactive elements: `min-h-11`, visible focus ring (`focus-visible:ring-2 ring-ring ring-offset-2`), labels above inputs, teaching empty states, inline errors with `role="alert"`, `tabular-nums` for figures. All dates render via `Europe/Oslo`.
9. **Migrations own their privileges** (ENFORCED by `supabase/tests/00_grant_firewall.sql`). Every new table: `revoke all ... from anon, authenticated, service_role;` then grant back exactly the verbs its policies need. `anon` gets NOTHING. Every `create function` is followed by `revoke execute ... from public;` then a narrow grant. No sequences this phase (all PKs uuid or composite).
10. **FK lifecycle:** `lessons.class_id` → `classes` `on delete cascade`; `attendance` cascades from BOTH `lessons` and `students`; `absence_notices.student_id` → `students` cascade; `attendance.recorded_by`/`absence_notices.created_by` → `profiles` default `restrict` (never orphan the actor trail). No financial tables this phase.
11. **RLS helper pattern:** policies never subquery an RLS-protected table directly. Relationship checks go through SECURITY DEFINER `stable` functions in `private` with `set search_path = ''`, called as `private.helper((select auth.uid()), col)`. Always wrap uid as `(select auth.uid())` (init-plan optimization). Policies are permissive/OR-ed and ADDITIVE across migrations — later migrations ADD visibility with NEW named policies, never editing existing ones.
12. **Audit namespace ENFORCED:** trigger/DAL audit actions use `<table>.<verb>` (e.g. `attendance.update`); `admin.*`/`system.*` are reserved (SQLSTATE 42501) for the service-role module + migrations. Add `private.audit_row_change(<pk cols>)` triggers to `attendance` and `absence_notices` (student data).
13. **Seed UUID scheme (extend, never overlap):** existing — seed USERS `1…`–`7…`; seed school data `f1…` terms, `fa…` subjects, `fc…` classes, `fe…` students; pgTAP fixtures per-file `a5…`–`ad…`. **NEW this phase:** seed `lessons` `f6…`, seed `absence_notices` `f7…` (attendance rows use the composite PK `(lesson_id, student_id)` — no new uuid). pgTAP fixtures: `11_lessons_rls` uses `ae…`, `12_attendance_rls` uses `af…`, `13_absence_notices_rls` uses `b1…`, `14_attendance_history` uses `b2…`. See **Seed anchors** below for the exact cross-referenced UUIDs.
14. **`tests/api` growth rules:** every new table extends `DENIED_CELLS` in `access-wall.test.ts`; the `vi.mock` preamble must be repeated per NEW file (mock factories are hoisted; they cannot be shared). New Phase 2 API tests live in NEW files (`attendance-core.test.ts`, `attendance-actions.test.ts`). No new seed USERS this phase → `harness.ts` `SeedEmail` union is unchanged.
15. **`'use server'` files may export ONLY async functions.** All Zod schemas + label maps live in `src/lib/validation/attendance.ts` (pure, unit-tested) and are imported by action files.
16. **TOTP for manual browser checks:** staff logins bounce to `/mfa/registrer`/`/mfa/verifiser`; generate codes with the node snippet in the Phase 1 plan's gotcha 17 (`docs/superpowers/plans/2026-07-17-iqra-portal-phase-1.md`).

**Execution discipline (protect it):** fresh implementer per task (Sonnet) → spec review → quality review → fix loop → controller live-verifies before closing. **Security-critical tasks (Fable-5 review with live RLS probes): 1, 2, 3, 4, 5, 8, 9.** TDD everywhere: tests written and failing before implementation; tests + implementation committed together per task (one commit per task).

**Deliberate scope decisions (do not re-litigate — from the design spec §1/§8):**
- **D1 generation:** admin-triggered idempotent batch (`on conflict do nothing`); removing a schedule slot does NOT auto-delete generated future lessons (admin cancels individually — no destructive bulk delete).
- **D2/D3 history:** interval-based roster (`enrolled_on <= lesson.date and (left_on is null or lesson.date < left_on)`, `left_on` exclusive); a former student's NAME is visible to the teacher who taught them via the new `students_select_taught_ever` policy — **but protected (`skjermet`) students are excluded** from that historical path (teacher sees them only while actively enrolled). Full history always remains for admin/parent/self.
- **D5 pre-report:** a covering `absence_notice` shows "Forhåndsmeldt fravær" and prefills `excused`; the teacher confirms/overrides; **saving** the lesson (marking attendance) flips `seen_by_teacher` for covering notices (a refinement of the spec's 'on open' — keeps the read pure).
- **D6 cancellation:** admin-only lesson cancel/edit. Teachers mark attendance only.
- **D7 scope IN:** student read-only history; admin lightweight cockpit widget. **Scope OUT (deferred):** absence notifications (Phase 5), term-rollover automation, attendance analytics beyond the widget, any economy attendance access.

---

## Seed anchors (exact UUIDs referenced across tasks — Task 5 creates them)

The current term (`f1…`) already seeds `Høst 2026` with classes and enrolled students from Phase 1. Task 5 adds:

- **Lesson `L_PAST`** = `f6000000-0000-0000-0000-000000000001` — a past-dated `scheduled` lesson of a Phase-1 seed class the seed teacher teaches, with a full set of `attendance` rows (mix of statuses). Used to test teacher history + marking-persistence.
- **Lesson `L_TODAY`** = `f6000000-0000-0000-0000-000000000002` — an unmarked lesson for the teacher's "I dag" test (its `date` is seeded relative to the term, not `now()` — see Task 5 for the deterministic date choice).
- **Absence notice `N_FUTURE`** = `f7000000-0000-0000-0000-000000000001` — created by the Phase-1 seed guardian (`forelder`) for their child, covering a future range that overlaps a generated lesson, `seen_by_teacher=false`. Used to test the pre-report → prefill flow and the cockpit "unseen" count.

Exact seed teacher / guardian / student / class UUIDs are the Phase 1 seed values — Task 5 reads them from `supabase/seed.sql` and reuses them verbatim (do not invent new ones).

---

## Shared interfaces (THE CONTRACT — every task uses these exact names)

### Database objects
```sql
-- enums
public.lesson_status      = ('scheduled','cancelled')
public.attendance_status  = ('present','absent','late','excused')

-- tables (columns per design spec §2 — do not deviate)
public.lessons(id, class_id, date, starts_at, ends_at, status, note, created_at, updated_at)
public.attendance(lesson_id, student_id, status, note, recorded_by, recorded_at, created_at, updated_at)  -- pk (lesson_id, student_id)
public.absence_notices(id, student_id, date_from, date_to, note, created_by, seen_by_teacher, created_at)

-- generation function (SECURITY INVOKER: RLS on lessons INSERT [admin-only] still applies)
public.generate_lessons_for_term(p_term_id uuid) returns table(created integer, skipped integer)

-- private helpers (SECURITY DEFINER, stable, set search_path='', execute: revoke public → grant authenticated)
private.teaches_lesson(uid uuid, lid uuid) returns boolean          -- teacher of the lesson's class (no enrollment filter)
private.taught_student_ever(uid uuid, sid uuid) returns boolean     -- teaches_student minus the left_on filter
private.guardian_sees_lesson(uid uuid, lid uuid) returns boolean    -- guardian has attendance row OR interval enrollment in the lesson
private.student_sees_lesson(uid uuid, lid uuid) returns boolean     -- own student has attendance row OR interval enrollment in the lesson
```

### TypeScript types (declare in the DAL module that owns them; import elsewhere)
```ts
// src/lib/dal/lessons.ts
export type LessonStatus = 'scheduled' | 'cancelled';
export type TeacherTodayLesson = { id: string; class_id: string; class_name: string; room: string | null; starts_at: string; ends_at: string; status: LessonStatus; marked_count: number; roster_count: number };
export type AdminLesson = { id: string; date: string; starts_at: string; ends_at: string; status: LessonStatus; note: string | null; marked_count: number };

// src/lib/dal/attendance.ts
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type LessonRosterEntry = { student_id: string; first_name: string; last_name: string; protected: boolean; status: AttendanceStatus | null; note: string | null; pre_reported: boolean };
export type LessonForMarking = { lesson: { id: string; class_id: string; class_name: string; date: string; starts_at: string; ends_at: string; status: LessonStatus }; roster: LessonRosterEntry[] };
export type AttendanceHistoryRow = { lesson_id: string; date: string; class_name: string; status: AttendanceStatus; note: string | null };
export type AbsenceNotice = { id: string; student_id: string; date_from: string; date_to: string; note: string | null; seen_by_teacher: boolean };
```

### DAL function signatures
```ts
// src/lib/dal/lessons.ts
listTeacherToday(): Promise<TeacherTodayLesson[]>                          // requireStaffRole('teacher'); Oslo "today"; .eq teacher discipline
listClassLessonsForTeacher(classId: string): Promise<AdminLesson[] | null> // teacher of class; null if not
generateLessonsForTerm(termId: string): Promise<{ created: number; skipped: number }> // requireStaffRole('admin'); calls the SQL fn
listTermLessonsForAdmin(termId: string): Promise<AdminLesson[]>            // requireStaffRole('admin')
getLessonMetaForAdmin(lessonId: string): Promise<AdminLesson | null>

// src/lib/dal/attendance.ts
getLessonForMarking(lessonId: string): Promise<LessonForMarking | null>    // teaches_lesson; interval roster; prefill from notices (PURE read; seen flip is on save in markAttendance)
getChildAttendanceHistory(studentId: string): Promise<AttendanceHistoryRow[] | null> // is_guardian_of; null if not guardian
getOwnAttendanceHistory(): Promise<AttendanceHistoryRow[]>                 // requireRole('student')
getStudentAttendanceForAdmin(studentId: string): Promise<AttendanceHistoryRow[]>     // requireStaffRole('admin')
listAbsenceNoticesForChild(studentId: string): Promise<AbsenceNotice[] | null>

// src/lib/dal/dashboard.ts (EXTEND)
getCockpitToday(): Promise<{ lessons_today: number; unmarked_lessons: number; unseen_notices: number }> // requireStaffRole('admin')
```

### Server actions (all `'use server'`, return the house `FormState` `{ error: string | null; success?: boolean }` unless noted)
```ts
// src/app/(portal)/laerer/timer/[lessonId]/actions.ts
markAttendance(lessonId: string, prev, formData): mark[] parsed via attendanceMarkSchema; teaches_lesson; upsert on (lesson_id, student_id); revalidate

// src/app/(portal)/admin/klasser/[id]/actions.ts (EXTEND existing)
cancelLesson(lessonId, prev, formData) / editLesson(...)   // requireStaffRole('admin'); status/note/time
// src/app/(portal)/admin/terminer/[id]/actions.ts (EXTEND existing)
generateLessons(termId, prev, formData)                    // requireStaffRole('admin')

// src/app/(portal)/forelder/actions.ts (EXTEND existing or create)
fileAbsenceNotice(prev, formData): absenceNoticeSchema; is_guardian_of(student_id)
deleteAbsenceNotice(id, prev, formData): own author or admin
```

### Validation (`src/lib/validation/attendance.ts` — pure, unit-tested in `attendance.test.ts`)
```ts
export const attendanceStatusLabels: Record<AttendanceStatus, string>; // Til stede / Fravær / For sent / Gyldig fravær
export const lessonStatusLabels: Record<LessonStatus, string>;         // Planlagt / Avlyst
export const attendanceMarkSchema;   // { student_id: uuid, status: enum, note: optional <=500 }
export const attendanceMarksSchema;  // array of the above
export const absenceNoticeSchema;    // { student_id: uuid, date_from: date, date_to: date >= date_from, note?: <=500 }
export const lessonEditSchema;       // { status: lesson_status, note?: <=500, starts_at?, ends_at? with ends>starts }
```

---

## Task index

| # | Task | Primary files | Sec-review |
|---|---|---|---|
| 1 | `lessons` migration + generation fn + pgTAP | `migrations/<ts>_lessons.sql`, `tests/11_lessons_rls.sql` | ● |
| 2 | `attendance` migration + `teaches_lesson` + pgTAP | `migrations/<ts>_attendance.sql`, `tests/12_attendance_rls.sql` | ● |
| 3 | `absence_notices` migration + pgTAP | `migrations/<ts>_absence_notices.sql`, `tests/13_absence_notices_rls.sql` | ● |
| 4 | Historical-visibility helpers + policies + pgTAP | `migrations/<ts>_attendance_visibility.sql`, `tests/14_attendance_history.sql` | ● |
| 5 | Seed + regenerated types + `access-wall` matrix growth | `seed.sql`, `src/lib/supabase/database.types.ts`, `tests/api/access-wall.test.ts` | ● |
| 6 | Validation schemas + label maps + Oslo lesson-date helper | `src/lib/validation/attendance.ts(+test)`, `src/lib/dates.ts(+test)` | |
| 7 | DAL reads (lessons/attendance/roster/history/today) + `tests/api` | `src/lib/dal/lessons.ts`, `src/lib/dal/attendance.ts`, `tests/api/attendance-core.test.ts` | |
| 8 | Actions: generate + cancel/edit lesson (admin) + `tests/api` | `admin/terminer/[id]/actions.ts`, `admin/klasser/[id]/actions.ts`, `tests/api/attendance-actions.test.ts` | ● |
| 9 | Actions: mark attendance (teacher) + file/delete notice (parent) + `tests/api` | `laerer/timer/[lessonId]/actions.ts`, `forelder/actions.ts`, `tests/api/attendance-actions.test.ts` | ● |
| 10 | Teacher "I dag" view | `laerer/page.tsx` | |
| 11 | Teacher marking screen + class-detail lesson list | `laerer/timer/[lessonId]/page.tsx` + `MarkAttendance.tsx`, `laerer/klasser/[id]/page.tsx` | |
| 12 | Parent history + Meld fravær | `forelder/page.tsx` + `MeldFravaer.tsx` | |
| 13 | Student history + admin student-page attendance block | `elev/page.tsx`, `admin/elever/[id]/page.tsx` | |
| 14 | Admin term-generation UI + class lesson management | `admin/terminer/[id]/page.tsx` + forms, `admin/klasser/[id]/page.tsx` + `LessonManager.tsx` | |
| 15 | Admin cockpit "i dag / fraværsbilde" widget | `admin/page.tsx`, `src/lib/dal/dashboard.ts` | |
| 16 | Exit gate: full suite, browser pass, docs + ledger, feature summary | `docs/*`, `PRODUCT.md`/ledger | |

**Task order rationale:** 1–4 build wall 2 (migrations + pgTAP) bottom-up — tables before the historical policies that join them; 5 seeds + regenerates `Database` types + grows the matrix (everything downstream needs fixtures + types); 6 pure validation/date units (no DB); 7 DAL reads (wall-1 twins of the pgTAP proofs); 8–9 actions (writes, TDD against the live stack) — admin writes before teacher/parent writes so the marking flow has lessons to mark; 10–15 UI (teacher today → marking → parent → student/admin → cockpit); 16 exit gate.

---

<!-- EXPANDED TASKS APPENDED BELOW -->

<!--
EXPANDED TASKS 1–5 for docs/superpowers/plans/2026-07-19-iqra-portal-phase-2.md
Append this block under the "<!-- EXPANDED TASKS APPENDED BELOW -->" marker.
Wall 2 (migrations + pgTAP), bottom-up: lessons → attendance → absence_notices →
historical-visibility policies → seed + types + matrix. One commit per task.
Running pgTAP total starts at 177 (files 00–10). After: T1→198, T2→221, T3→243, T4→260.
-->

## Reconciliation applied (read before executing)

Three sections of this plan were drafted concurrently; the cross-task fixes below were applied on top. Honor them as you execute — they override any older wording left elsewhere:

- **R1 — form state:** every client component (Tasks 10–16) uses the house `FormState`: `useActionState(<action>, idleForm)` with `idleForm` imported from `@/lib/validation/school`, success read via `state.success`, errors via `state.error`. No bare empty-object initial state, and no `ok`-based success check remains. The generate form reads `state.created` / `state.skipped` when `state.success`.
- **R2 — `seen_by_teacher` flips on SAVE, not on open:** `markAttendance` (Task 9) performs the acknowledgment flip after the attendance upsert, via the column-scoped `update (seen_by_teacher)` grant + `absence_notices_teacher_mark_seen` policy added in Task 3. `getLessonForMarking` (Task 7) is a PURE read — it computes `pre_reported` but writes nothing.
- **R3 — `listClassLessonsForAdmin`:** defined in Task 7 (`lessons.ts`, admin-only, `.eq('class_id', …)` clone of `listTermLessonsForAdmin`, date-ordered) and consumed by Task 14.
- **R4 — marks transport:** `MarkAttendance` (Task 11) submits one hidden `marks` field = `JSON.stringify(marks)`; `markAttendance` (Task 9) parses that field via `attendanceMarksSchema` over `JSON.parse`. Field name and per-row `{ student_id, status, note? }` shape are aligned on both ends.
- **R5 — type path:** the generated Supabase types live at `src/lib/supabase/database.types.ts` everywhere; the earlier un-prefixed `src/lib/` variant is gone.

### Task 1: Migration — `lessons` + idempotent per-term generation function

The calendar substrate. Creates the `lesson_status` enum and the `lessons` table (one dated row per class per schedule slot), plus `public.generate_lessons_for_term(p_term_id)` — a **SECURITY INVOKER** function so the admin-only INSERT policy still gates who may materialize a term (D1). Lessons are *cancelled*, never deleted, so `authenticated` gets no DELETE. `lessons` carries no audit trigger (it is not student data — header gotcha 12 scopes audit to `attendance`/`absence_notices`).

**Files:**
- Create: `supabase/tests/11_lessons_rls.sql`
- Create: `supabase/migrations/<ts>_lessons.sql` (via `supabase migration new lessons`)

- [ ] **Step 0: Branch + stack sanity**

```bash
cd /Users/daodilyas/dev/iqra-portal
git checkout main && git pull --ff-only 2>/dev/null; git checkout -b feat/phase-2
docker ps --format '{{.Names}}\t{{.Status}}' | grep supabase | wc -l
supabase test db 2>&1 | tail -5
```

Expected: branch `feat/phase-2` created off `main`; 10 supabase containers up; `supabase test db` shows files `00`–`10` green (**177** pgTAP). If containers are missing, follow gotcha 3 (`supabase start --ignore-health-check`, wait for healthy).

- [ ] **Step 1: Write the failing pgTAP file**

Create `supabase/tests/11_lessons_rls.sql`. Fixtures use the `ae…` prefix (header gotcha 13); the term window `2026-08-15 … 2026-08-31` yields exactly 3 Saturdays (`08-15, 08-22, 08-29`, weekday 6) and 3 Sundays (`08-16, 08-23, 08-30`, weekday 7), so generation is a known **6** candidate lessons (3 per class).

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- Hermetic fixtures (seed independence): `supabase db reset` loads seed.sql —
-- which populates lessons from Task 5 on — BEFORE `supabase test db` runs. Clear
-- those rows first (as postgres, inside this rolled-back transaction) so the
-- fixtures below are the only rows and the absolute-count assertions stay
-- independent of seed content. Restored on rollback. FK-safe order: children
-- before parents (lessons before classes; deleting students/lessons cascades
-- the Task 5 attendance/notice rows added later).
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

-- ── Setup (as postgres): two classes/teachers, one family per class, a
--    student login and an economy user ────────────────────────────────
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.email, '{"provider":"email","providers":["email"]}',
       jsonb_build_object('full_name', u.full_name), now(), now()
from (values
  ('ae000000-0000-0000-0000-000000000001'::uuid, 'pgtap-le-admin@test.local',   'LE Admin'),
  ('ae000000-0000-0000-0000-000000000002'::uuid, 'pgtap-le-laerer1@test.local', 'LE Lærer En'),
  ('ae000000-0000-0000-0000-000000000003'::uuid, 'pgtap-le-laerer2@test.local', 'LE Lærer To'),
  ('ae000000-0000-0000-0000-000000000004'::uuid, 'pgtap-le-forelder@test.local','LE Forelder'),
  ('ae000000-0000-0000-0000-000000000006'::uuid, 'pgtap-le-elev@test.local',    'LE Elev'),
  ('ae000000-0000-0000-0000-000000000007'::uuid, 'pgtap-le-okonomi@test.local', 'LE Økonomi')
) as u(id, email, full_name);
insert into public.user_roles (user_id, role) values
  ('ae000000-0000-0000-0000-000000000001', 'admin'),
  ('ae000000-0000-0000-0000-000000000002', 'teacher'),
  ('ae000000-0000-0000-0000-000000000003', 'teacher'),
  ('ae000000-0000-0000-0000-000000000004', 'parent'),
  ('ae000000-0000-0000-0000-000000000006', 'student'),
  ('ae000000-0000-0000-0000-000000000007', 'economy');

insert into public.terms (id, name, starts_on, ends_on) values
  ('ae000000-0000-0000-0000-000000000011', 'LE Termin', '2026-08-15', '2026-08-31');
insert into public.classes (id, term_id, name) values
  ('ae000000-0000-0000-0000-000000000021', 'ae000000-0000-0000-0000-000000000011', 'LE Klasse 1'),
  ('ae000000-0000-0000-0000-000000000022', 'ae000000-0000-0000-0000-000000000011', 'LE Klasse 2');
insert into public.class_teachers (class_id, teacher_id) values
  ('ae000000-0000-0000-0000-000000000021', 'ae000000-0000-0000-0000-000000000002'),
  ('ae000000-0000-0000-0000-000000000022', 'ae000000-0000-0000-0000-000000000003');
insert into public.class_schedule (class_id, weekday, starts_at, ends_at) values
  ('ae000000-0000-0000-0000-000000000021', 6, '10:00', '13:00'),  -- lørdag
  ('ae000000-0000-0000-0000-000000000022', 7, '10:00', '13:00');  -- søndag
insert into public.students (id, first_name, last_name, birth_year, student_user_id) values
  ('ae000000-0000-0000-0000-000000000031', 'LE', 'Barn En', 2014, 'ae000000-0000-0000-0000-000000000006'),
  ('ae000000-0000-0000-0000-000000000032', 'LE', 'Barn To', 2015, null);
insert into public.guardian_student (guardian_id, student_id) values
  ('ae000000-0000-0000-0000-000000000004', 'ae000000-0000-0000-0000-000000000031');
insert into public.class_students (class_id, student_id, enrolled_on) values
  ('ae000000-0000-0000-0000-000000000021', 'ae000000-0000-0000-0000-000000000031', '2026-08-15'),
  ('ae000000-0000-0000-0000-000000000022', 'ae000000-0000-0000-0000-000000000032', '2026-08-15');

-- ── Schema shape ────────────────────────────────────────────────────
select has_table('public'::name, 'lessons'::name, 'lessons table exists');
select ok((select relrowsecurity from pg_class
           where oid = 'public.lessons'::regclass), 'RLS enabled on lessons');
select has_type('public'::name, 'lesson_status'::name, 'lesson_status enum exists');
select enum_has_labels('public'::name, 'lesson_status'::name,
  array['scheduled', 'cancelled'], 'lesson_status has exactly the two labels');
select has_function('public'::name, 'generate_lessons_for_term'::name, array['uuid'],
  'public.generate_lessons_for_term(uuid) exists');
select ok(not has_function_privilege('anon',
  'public.generate_lessons_for_term(uuid)', 'execute'),
  'anon cannot execute generate_lessons_for_term (revoked from public)');

-- ── Constraint invariant (as postgres): times check ─────────────────
select throws_ok(
  $$ insert into public.lessons (class_id, date, starts_at, ends_at)
     values ('ae000000-0000-0000-0000-000000000021', '2026-08-22', '13:00', '10:00') $$,
  '23514', null,
  'a lesson with ends_at before starts_at is rejected (lessons_times)');

-- ── Non-admin cannot generate (SECURITY INVOKER keeps admin-only INSERT
--    live) — run BEFORE admin generates so the INSERT truly attempts rows ──
select set_config('request.jwt.claims',
  '{"sub":"ae000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select * from public.generate_lessons_for_term('ae000000-0000-0000-0000-000000000011') $$,
  '42501', null,
  'a teacher cannot generate lessons (invoker RLS blocks the INSERT)');
reset role;

-- ── Admin generates, idempotently ───────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"ae000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select created, skipped from public.generate_lessons_for_term('ae000000-0000-0000-0000-000000000011') $$,
  $$ values (6, 0) $$,
  'admin generates 6 lessons (3 Saturdays + 3 Sundays), 0 skipped');
select results_eq(
  $$ select created, skipped from public.generate_lessons_for_term('ae000000-0000-0000-0000-000000000011') $$,
  $$ values (0, 6) $$,
  're-running is idempotent: 0 created, all 6 skipped');
select is((select count(*) from public.lessons), 6::bigint,
  'admin sees all 6 generated lessons');
reset role;

-- ── Read matrix ─────────────────────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"ae000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.lessons), 3::bigint,
  'teacher 1 sees exactly their own class''s 3 lessons (teaches_class)');
select is_empty(
  $$ select id from public.lessons
     where class_id = 'ae000000-0000-0000-0000-000000000022' $$,
  'fine-derived #4: teacher 1 cannot see class 2''s lessons');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"ae000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.lessons), 3::bigint,
  'the class-1 guardian sees the child''s class lessons (guardian_in_class)');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"ae000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.lessons), 3::bigint,
  'the class-1 student login sees its class lessons (student_in_class)');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"ae000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.lessons), 0::bigint,
  'economy sees zero lessons (no pedagogy surface, spec §3)');
reset role;

-- ── Unique-slot invariant (as postgres, against a now-existing slot) ─
select throws_ok(
  $$ insert into public.lessons (class_id, date, starts_at, ends_at)
     values ('ae000000-0000-0000-0000-000000000021', '2026-08-22', '10:00', '13:00') $$,
  '23505', null,
  'a duplicate (class, date, starts_at) slot is rejected (lessons_unique_slot)');

-- ── Write matrix ────────────────────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"ae000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.lessons (class_id, date, starts_at, ends_at)
     values ('ae000000-0000-0000-0000-000000000021', '2026-08-22', '15:00', '16:00') $$,
  '42501', null,
  'a teacher cannot insert a lesson directly (admin-only INSERT)');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"ae000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.lessons (class_id, date, starts_at, ends_at)
     values ('ae000000-0000-0000-0000-000000000021', '2026-08-22', '15:00', '16:00') $$,
  'admin inserts a lesson through their own session');
select lives_ok(
  $$ update public.lessons set status = 'cancelled'
     where class_id = 'ae000000-0000-0000-0000-000000000021'
       and date = '2026-08-22' and starts_at = '15:00' $$,
  'admin cancels (updates) a lesson');
select throws_ok(
  $$ delete from public.lessons
     where class_id = 'ae000000-0000-0000-0000-000000000021' $$,
  '42501', null,
  'no DELETE grant: lessons are cancelled, never deleted (even by admin)');
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Run pgTAP — expect 11 RED**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase test db 2>&1 | tail -12
```

Expected FAIL: `11_lessons_rls` errors immediately with `relation "public.lessons" does not exist` (the table/enum/function are all missing). Files `00`–`10` stay green. That IS the failing state.

- [ ] **Step 3: Create the migration**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase migration new lessons
```

Write the generated `supabase/migrations/<ts>_lessons.sql`:

```sql
-- Attendance substrate: the lesson_status enum and the lessons table — one
-- dated row per class per schedule slot (spec §4 / design §2). Lessons are the
-- FK anchor for attendance. Generated per term by an idempotent, admin-gated
-- function (D1). Cancelled, never deleted → no DELETE grant for app roles. Not
-- student data → no audit trigger (header gotcha 12 scopes audit to attendance
-- and absence_notices).

create type public.lesson_status as enum ('scheduled', 'cancelled');

create table public.lessons (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes (id) on delete cascade,
  date       date not null,
  starts_at  time not null,
  ends_at    time not null,
  status     public.lesson_status not null default 'scheduled',
  note       text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lessons_times check (ends_at > starts_at),
  constraint lessons_unique_slot unique (class_id, date, starts_at)
);
comment on table public.lessons is
  'One dated lesson per class schedule slot. Generated per term by public.generate_lessons_for_term (idempotent, on conflict do nothing). lessons_unique_slot makes regeneration safe; cancellation is a status flip, not a delete (no DELETE grant).';

create trigger lessons_set_updated_at
  before update on public.lessons
  for each row execute function private.set_updated_at();

-- ── Idempotent generation (D1) ──────────────────────────────────────
-- SECURITY INVOKER on purpose: the admin-only INSERT policy below still gates
-- who may materialize a term, so a teacher/parent calling this is denied at the
-- INSERT (42501). For each class in the term and each of its schedule slots,
-- insert a lesson for every date in [term.starts_on, term.ends_on] whose ISO
-- weekday matches the slot. Casting to ::timestamp forces the unambiguous
-- (timestamp, timestamp, interval) generate_series overload and steps by pure
-- calendar days (no DST/tz drift — Oslo-agnostic dates). on conflict do nothing
-- makes re-runs fill only missing dates: it never overwrites a cancelled lesson,
-- an edited note/time, or one that already has attendance. Returns (created,
-- skipped = candidate rows − created) for the confirmation UI.
create function public.generate_lessons_for_term(p_term_id uuid)
returns table (created integer, skipped integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expected integer;
begin
  insert into public.lessons (class_id, date, starts_at, ends_at)
  select c.id, d::date, cs.starts_at, cs.ends_at
  from public.classes c
  join public.terms t on t.id = c.term_id
  join public.class_schedule cs on cs.class_id = c.id
  cross join generate_series(t.starts_on::timestamp, t.ends_on::timestamp,
                             interval '1 day') as d
  where c.term_id = p_term_id
    and extract(isodow from d) = cs.weekday
  on conflict (class_id, date, starts_at) do nothing;
  get diagnostics created = row_count;

  select count(*)::integer into v_expected
  from public.classes c
  join public.terms t on t.id = c.term_id
  join public.class_schedule cs on cs.class_id = c.id
  cross join generate_series(t.starts_on::timestamp, t.ends_on::timestamp,
                             interval '1 day') as d
  where c.term_id = p_term_id
    and extract(isodow from d) = cs.weekday;

  skipped := v_expected - created;
  return next;
end;
$$;
revoke execute on function public.generate_lessons_for_term(uuid) from public;
grant execute on function public.generate_lessons_for_term(uuid) to authenticated;

-- ── Grant layer (wall 2a, header gotcha 9) ──────────────────────────
-- authenticated: select/insert/update (admin writes flow through the admin's
-- own session; RLS gates who). NO delete — lessons are cancelled. service_role:
-- select/delete only (future retention/erasure jobs), not the write path.
-- anon: nothing.
revoke all on table public.lessons from anon, authenticated, service_role;
grant select, insert, update on public.lessons to authenticated;
grant select, delete         on public.lessons to service_role;

-- ── RLS: default deny, then narrow policies ─────────────────────────
alter table public.lessons enable row level security;

create policy "lessons_select_related"
  on public.lessons for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_class((select auth.uid()), class_id)
    or private.guardian_in_class((select auth.uid()), class_id)
    or private.student_in_class((select auth.uid()), class_id)
  );
create policy "lessons_admin_insert"
  on public.lessons for insert to authenticated
  with check (private.has_role((select auth.uid()), 'admin'));
create policy "lessons_admin_update"
  on public.lessons for update to authenticated
  using (private.has_role((select auth.uid()), 'admin'))
  with check (private.has_role((select auth.uid()), 'admin'));
-- No DELETE policy: default-deny + no DELETE grant = lessons are never deleted
-- by an app role.
```

- [ ] **Step 4: Apply and verify GREEN**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase db reset 2>&1 | tail -4
supabase test db 2>&1 | tail -6
```

Expected: reset applies the new migration (gotcha 3 if it exits 1 in the restart phase — the `Applying migration …` line is the success signal); `supabase test db` shows all 11 files pass — `11_lessons_rls` **21/21**; the grant firewall (`00`) still green (it sweeps the new table). Total pgTAP: **198**.

- [ ] **Step 5: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add supabase/tests/11_lessons_rls.sql supabase/migrations/*_lessons.sql
git commit -m "feat: lessons table with idempotent per-term generation and default-deny RLS"
```

---

### Task 2: Migration — `attendance` + `private.teaches_lesson`

The mark table: one row per `(lesson, student)`, composite PK, cascading from both `lessons` and `students`. Adds `private.teaches_lesson` (teacher of the lesson's class, **no enrollment filter** so history survives a leaver) and the `attendance` audit trigger (student data, header gotcha 12). No DELETE for app roles — corrections are upserts; erasure cascades from `students`.

**Files:**
- Create: `supabase/tests/12_attendance_rls.sql`
- Create: `supabase/migrations/<ts>_attendance.sql` (via `supabase migration new attendance`)

- [ ] **Step 1: Write the failing pgTAP file**

Create `supabase/tests/12_attendance_rls.sql` (fixtures `af…`):

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

-- Hermetic fixtures (seed independence, header gotcha 13): clear seed rows
-- first, children before parents. attendance exists as of this task; deleting
-- lessons/students also cascades the Task 5 attendance seed.
delete from public.attendance;
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

-- ── Setup: parent A / child s1 in class 1 (teacher 1); parent B / child s2
--    in class 2 (teacher 2); s1 has a student login; one economy user ──────
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.email, '{"provider":"email","providers":["email"]}',
       jsonb_build_object('full_name', u.full_name), now(), now()
from (values
  ('af000000-0000-0000-0000-000000000001'::uuid, 'pgtap-at-admin@test.local',    'AT Admin'),
  ('af000000-0000-0000-0000-000000000002'::uuid, 'pgtap-at-laerer1@test.local',  'AT Lærer En'),
  ('af000000-0000-0000-0000-000000000003'::uuid, 'pgtap-at-laerer2@test.local',  'AT Lærer To'),
  ('af000000-0000-0000-0000-000000000004'::uuid, 'pgtap-at-forelderA@test.local','AT Forelder A'),
  ('af000000-0000-0000-0000-000000000005'::uuid, 'pgtap-at-forelderB@test.local','AT Forelder B'),
  ('af000000-0000-0000-0000-000000000006'::uuid, 'pgtap-at-elev@test.local',     'AT Elev'),
  ('af000000-0000-0000-0000-000000000007'::uuid, 'pgtap-at-okonomi@test.local',  'AT Økonomi')
) as u(id, email, full_name);
insert into public.user_roles (user_id, role) values
  ('af000000-0000-0000-0000-000000000001', 'admin'),
  ('af000000-0000-0000-0000-000000000002', 'teacher'),
  ('af000000-0000-0000-0000-000000000003', 'teacher'),
  ('af000000-0000-0000-0000-000000000004', 'parent'),
  ('af000000-0000-0000-0000-000000000005', 'parent'),
  ('af000000-0000-0000-0000-000000000006', 'student'),
  ('af000000-0000-0000-0000-000000000007', 'economy');

insert into public.terms (id, name, starts_on, ends_on) values
  ('af000000-0000-0000-0000-000000000011', 'AT Termin', '2026-08-15', '2026-08-31');
insert into public.classes (id, term_id, name) values
  ('af000000-0000-0000-0000-000000000021', 'af000000-0000-0000-0000-000000000011', 'AT Klasse 1'),
  ('af000000-0000-0000-0000-000000000022', 'af000000-0000-0000-0000-000000000011', 'AT Klasse 2');
insert into public.class_teachers (class_id, teacher_id) values
  ('af000000-0000-0000-0000-000000000021', 'af000000-0000-0000-0000-000000000002'),
  ('af000000-0000-0000-0000-000000000022', 'af000000-0000-0000-0000-000000000003');
insert into public.students (id, first_name, last_name, birth_year, student_user_id) values
  ('af000000-0000-0000-0000-000000000031', 'AT', 'Barn En', 2014, 'af000000-0000-0000-0000-000000000006'),
  ('af000000-0000-0000-0000-000000000032', 'AT', 'Barn To', 2015, null);
insert into public.guardian_student (guardian_id, student_id) values
  ('af000000-0000-0000-0000-000000000004', 'af000000-0000-0000-0000-000000000031'),
  ('af000000-0000-0000-0000-000000000005', 'af000000-0000-0000-0000-000000000032');
insert into public.class_students (class_id, student_id, enrolled_on) values
  ('af000000-0000-0000-0000-000000000021', 'af000000-0000-0000-0000-000000000031', '2026-08-15'),
  ('af000000-0000-0000-0000-000000000022', 'af000000-0000-0000-0000-000000000032', '2026-08-15');
insert into public.lessons (id, class_id, date, starts_at, ends_at) values
  ('af000000-0000-0000-0000-000000000051', 'af000000-0000-0000-0000-000000000021',
   '2026-08-22', '10:00', '13:00');

-- ── Schema shape ────────────────────────────────────────────────────
select has_table('public'::name, 'attendance'::name, 'attendance table exists');
select ok((select relrowsecurity from pg_class
           where oid = 'public.attendance'::regclass), 'RLS enabled on attendance');
select has_type('public'::name, 'attendance_status'::name, 'attendance_status enum exists');
select enum_has_labels('public'::name, 'attendance_status'::name,
  array['present', 'absent', 'late', 'excused'],
  'attendance_status has exactly the four labels');
select has_function('private'::name, 'teaches_lesson'::name, array['uuid', 'uuid'],
  'private.teaches_lesson(uuid,uuid) exists');
select col_is_pk('public'::name, 'attendance'::name,
  array['lesson_id', 'student_id'], 'attendance PK is (lesson_id, student_id)');

-- ── Write matrix ────────────────────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"af000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.attendance (lesson_id, student_id, status, recorded_by)
     values ('af000000-0000-0000-0000-000000000051',
             'af000000-0000-0000-0000-000000000031', 'present',
             'af000000-0000-0000-0000-000000000002') $$,
  'the class teacher marks attendance (teaches_lesson)');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"af000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.attendance (lesson_id, student_id, status, recorded_by)
     values ('af000000-0000-0000-0000-000000000051',
             'af000000-0000-0000-0000-000000000031', 'absent',
             'af000000-0000-0000-0000-000000000003') $$,
  '42501', null,
  'fine-derived #4: a teacher of another class cannot mark this lesson');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"af000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.attendance (lesson_id, student_id, status, recorded_by)
     values ('af000000-0000-0000-0000-000000000051',
             'af000000-0000-0000-0000-000000000031', 'present',
             'af000000-0000-0000-0000-000000000007') $$,
  '42501', null,
  'economy cannot mark attendance (no pedagogy surface)');
reset role;

-- ── Read matrix (the teacher's mark from above is the only row) ─────
select set_config('request.jwt.claims',
  '{"sub":"af000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.attendance), 1::bigint,
  'the class teacher reads the lesson''s attendance (teaches_lesson)');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"af000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.attendance), 0::bigint,
  'fine-derived #4: teacher 2 cannot read class 1''s attendance');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"af000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.attendance), 1::bigint,
  'parent A reads their own child''s attendance (is_guardian_of)');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"af000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is_empty(
  $$ select status from public.attendance
     where student_id = 'af000000-0000-0000-0000-000000000031' $$,
  'BERGEN #1: parent B gets an empty result for child A''s attendance');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"af000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.attendance), 1::bigint,
  'the student login reads its own attendance (is_linked_student)');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"af000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.attendance), 0::bigint,
  'economy reads zero attendance');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"af000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.attendance), 1::bigint,
  'admin reads all attendance');
reset role;

-- ── Correction (upsert-style UPDATE) ────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"af000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ update public.attendance set status = 'late'
     where lesson_id = 'af000000-0000-0000-0000-000000000051'
       and student_id = 'af000000-0000-0000-0000-000000000031' $$,
  'the class teacher corrects a mark (UPDATE)');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"af000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ update public.attendance set status = 'present'
     where lesson_id = 'af000000-0000-0000-0000-000000000051'
       and student_id = 'af000000-0000-0000-0000-000000000031' $$,
  'a parent UPDATE runs without matching any row (read-only via RLS USING)');
reset role;
select is(
  (select status::text from public.attendance
   where lesson_id = 'af000000-0000-0000-0000-000000000051'
     and student_id = 'af000000-0000-0000-0000-000000000031'),
  'late',
  'the mark is unchanged after the parent write attempt');

-- ── Audit triggers (student data) ───────────────────────────────────
select is(
  (select count(*) from public.audit_log
   where action = 'attendance.insert'
     and actor_id = 'af000000-0000-0000-0000-000000000002'
     and entity_id = 'af000000-0000-0000-0000-000000000051'
     and meta ->> 'student_id' = 'af000000-0000-0000-0000-000000000031'),
  1::bigint,
  'attendance.insert audit: actor pinned, entity=lesson_id, meta.student_id set');
select is(
  (select count(*) from public.audit_log
   where action = 'attendance.update'
     and entity_id = 'af000000-0000-0000-0000-000000000051'
     and (meta -> 'changed') ? 'status'
     and not ((meta -> 'changed') ? 'updated_at')),
  1::bigint,
  'attendance.update audit: changed lists status, updated_at filtered out');

-- ── Cascade from lessons (as postgres) ──────────────────────────────
select lives_ok(
  $$ delete from public.lessons
     where id = 'af000000-0000-0000-0000-000000000051' $$,
  'deleting a lesson runs (service-role/superuser path)');
select is((select count(*) from public.attendance), 0::bigint,
  'attendance cascades away when its lesson is deleted');

select * from finish();
rollback;
```

- [ ] **Step 2: Run pgTAP — expect 12 RED**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase test db 2>&1 | tail -12
```

Expected FAIL: `12_attendance_rls` errors with `relation "public.attendance" does not exist`; files `00`–`11` stay green.

- [ ] **Step 3: Create the migration**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase migration new attendance
```

Write `supabase/migrations/<ts>_attendance.sql`:

```sql
-- Attendance marks: one row per (lesson, student). Composite PK, cascading from
-- both lessons and students (a dropped lesson or a GDPR-erased student takes its
-- marks). recorded_by → profiles (default restrict) so the actor trail is never
-- orphaned. No DELETE for app roles: corrections are upserts. Audit trigger
-- (student data, header gotcha 12): entity_id = lesson_id, meta.student_id.

create type public.attendance_status as enum ('present', 'absent', 'late', 'excused');

create table public.attendance (
  lesson_id   uuid not null references public.lessons (id)  on delete cascade,
  student_id  uuid not null references public.students (id) on delete cascade,
  status      public.attendance_status not null,
  note        text check (note is null or char_length(note) <= 500),
  recorded_by uuid not null references public.profiles (id),
  recorded_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (lesson_id, student_id)
);
comment on table public.attendance is
  'One mark per (lesson, student). Corrections are upserts (on conflict do update) — no DELETE grant for app roles; student erasure cascades from students, a dropped lesson from lessons. recorded_by → profiles (restrict) keeps the who-marked trail.';

create trigger attendance_set_updated_at
  before update on public.attendance
  for each row execute function private.set_updated_at();

-- teaches_lesson: teacher of the lesson's class — NO enrollment filter, so a
-- teacher keeps reading marks after a student leaves (design §4). Resolves the
-- class through the lesson, then mirrors teaches_class.
create or replace function private.teaches_lesson(uid uuid, lid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.lessons l
    join public.class_teachers ct on ct.class_id = l.class_id
    where l.id = lid and ct.teacher_id = uid
  );
$$;
revoke execute on function private.teaches_lesson(uuid, uuid) from public;
grant execute on function private.teaches_lesson(uuid, uuid) to authenticated;

-- Audit (student data): entity_id = lesson_id, meta.student_id = student_id.
create trigger attendance_audit
  after insert or update or delete on public.attendance
  for each row execute function private.audit_row_change('lesson_id', 'student_id');

-- ── Grant layer (wall 2a) ───────────────────────────────────────────
-- authenticated: select/insert/update (no delete — corrections are upserts).
-- service_role: select/delete (retention/erasure). anon: nothing.
revoke all on table public.attendance from anon, authenticated, service_role;
grant select, insert, update on public.attendance to authenticated;
grant select, delete         on public.attendance to service_role;

alter table public.attendance enable row level security;

-- SELECT: admin, the lesson's teacher, the student's guardian (no enrollment
-- filter → parent keeps full child history), or the linked student login.
create policy "attendance_select_related"
  on public.attendance for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_lesson((select auth.uid()), lesson_id)
    or private.is_guardian_of((select auth.uid()), student_id)
    or private.is_linked_student((select auth.uid()), student_id)
  );
-- INSERT / UPDATE (mark / correct): admin or the lesson's teacher.
create policy "attendance_insert_teacher_or_admin"
  on public.attendance for insert to authenticated
  with check (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_lesson((select auth.uid()), lesson_id)
  );
create policy "attendance_update_teacher_or_admin"
  on public.attendance for update to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_lesson((select auth.uid()), lesson_id)
  )
  with check (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_lesson((select auth.uid()), lesson_id)
  );
-- No DELETE policy: default-deny + no DELETE grant for app roles.
```

- [ ] **Step 4: Apply and verify GREEN**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase db reset 2>&1 | tail -4
supabase test db 2>&1 | tail -6
```

Expected: all 12 files pass — `12_attendance_rls` **23/23**; firewall `00` still green. Total pgTAP: **221**.

- [ ] **Step 5: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add supabase/tests/12_attendance_rls.sql supabase/migrations/*_attendance.sql
git commit -m "feat: attendance table with teaches_lesson helper, audit trigger and relationship RLS"
```

---

### Task 3: Migration — `absence_notices`

Parent/admin pre-report of a coming absence over `[date_from, date_to]` (D5). Grants are `select, insert, delete` plus a **column-scoped `update (seen_by_teacher)`** for the student's active teacher — **no content UPDATE** (a mistaken notice is retracted, not edited; only the seen flag can flip); DELETE is scoped to the notice's author or admin. Audit trigger (student data). Teacher visibility uses the **active** `teaches_student` (notices are forward-looking).

> **Reconciliation R2 (resolved):** the design (§5 D5) flips a covering notice's `seen_by_teacher` to `true` on acknowledgment. This task grants a **column-scoped `update (seen_by_teacher)`** to `authenticated` plus the `absence_notices_teacher_mark_seen` policy (the student's active-class teacher only), so the flip is a narrow **client UPDATE in the caller's own session** — no `SECURITY DEFINER` path, not deferred. The flip runs on **save** (`markAttendance`, Task 9), not on open; `getLessonForMarking` (Task 7) stays a pure read. Content (note/dates/range) remains immutable — only the seen flag can change.

**Files:**
- Create: `supabase/tests/13_absence_notices_rls.sql`
- Create: `supabase/migrations/<ts>_absence_notices.sql` (via `supabase migration new absence_notices`)

- [ ] **Step 1: Write the failing pgTAP file**

Create `supabase/tests/13_absence_notices_rls.sql` (fixtures `b1…`):

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- Hermetic fixtures (seed independence, header gotcha 13). attendance and
-- absence_notices both exist as of this task; clear children before parents.
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

-- ── Setup: parent A / child s1 in class 1 (teacher 1); parent B / child s2
--    in class 2 (teacher 2); s1 has a login; one economy user ─────────────
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.email, '{"provider":"email","providers":["email"]}',
       jsonb_build_object('full_name', u.full_name), now(), now()
from (values
  ('b1000000-0000-0000-0000-000000000001'::uuid, 'pgtap-an-admin@test.local',    'AN Admin'),
  ('b1000000-0000-0000-0000-000000000002'::uuid, 'pgtap-an-laerer1@test.local',  'AN Lærer En'),
  ('b1000000-0000-0000-0000-000000000003'::uuid, 'pgtap-an-laerer2@test.local',  'AN Lærer To'),
  ('b1000000-0000-0000-0000-000000000004'::uuid, 'pgtap-an-forelderA@test.local','AN Forelder A'),
  ('b1000000-0000-0000-0000-000000000005'::uuid, 'pgtap-an-forelderB@test.local','AN Forelder B'),
  ('b1000000-0000-0000-0000-000000000006'::uuid, 'pgtap-an-elev@test.local',     'AN Elev'),
  ('b1000000-0000-0000-0000-000000000007'::uuid, 'pgtap-an-okonomi@test.local',  'AN Økonomi')
) as u(id, email, full_name);
insert into public.user_roles (user_id, role) values
  ('b1000000-0000-0000-0000-000000000001', 'admin'),
  ('b1000000-0000-0000-0000-000000000002', 'teacher'),
  ('b1000000-0000-0000-0000-000000000003', 'teacher'),
  ('b1000000-0000-0000-0000-000000000004', 'parent'),
  ('b1000000-0000-0000-0000-000000000005', 'parent'),
  ('b1000000-0000-0000-0000-000000000006', 'student'),
  ('b1000000-0000-0000-0000-000000000007', 'economy');

insert into public.terms (id, name, starts_on, ends_on) values
  ('b1000000-0000-0000-0000-000000000011', 'AN Termin', '2026-08-15', '2026-12-20');
insert into public.classes (id, term_id, name) values
  ('b1000000-0000-0000-0000-000000000021', 'b1000000-0000-0000-0000-000000000011', 'AN Klasse 1'),
  ('b1000000-0000-0000-0000-000000000022', 'b1000000-0000-0000-0000-000000000011', 'AN Klasse 2');
insert into public.class_teachers (class_id, teacher_id) values
  ('b1000000-0000-0000-0000-000000000021', 'b1000000-0000-0000-0000-000000000002'),
  ('b1000000-0000-0000-0000-000000000022', 'b1000000-0000-0000-0000-000000000003');
insert into public.students (id, first_name, last_name, birth_year, student_user_id) values
  ('b1000000-0000-0000-0000-000000000031', 'AN', 'Barn En', 2014, 'b1000000-0000-0000-0000-000000000006'),
  ('b1000000-0000-0000-0000-000000000032', 'AN', 'Barn To', 2015, null);
insert into public.guardian_student (guardian_id, student_id) values
  ('b1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000031'),
  ('b1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000032');
insert into public.class_students (class_id, student_id, enrolled_on) values
  ('b1000000-0000-0000-0000-000000000021', 'b1000000-0000-0000-0000-000000000031', '2026-08-20'),
  ('b1000000-0000-0000-0000-000000000022', 'b1000000-0000-0000-0000-000000000032', '2026-08-20');

-- ── Schema shape ────────────────────────────────────────────────────
select has_table('public'::name, 'absence_notices'::name, 'absence_notices table exists');
select ok((select relrowsecurity from pg_class
           where oid = 'public.absence_notices'::regclass), 'RLS enabled on absence_notices');
select throws_ok(
  $$ insert into public.absence_notices (student_id, date_from, date_to, created_by)
     values ('b1000000-0000-0000-0000-000000000031', '2026-09-10', '2026-09-05',
             'b1000000-0000-0000-0000-000000000004') $$,
  '23514', null,
  'date_to before date_from is rejected (absence_notices_range)');

-- ── INSERT matrix ───────────────────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.absence_notices (id, student_id, date_from, date_to, note, created_by)
     values ('b1000000-0000-0000-0000-000000000051',
             'b1000000-0000-0000-0000-000000000031', '2026-09-05', '2026-09-05',
             'Bortreist', 'b1000000-0000-0000-0000-000000000004') $$,
  'parent A files a notice for their own child (is_guardian_of)');
select throws_ok(
  $$ insert into public.absence_notices (student_id, date_from, date_to, created_by)
     values ('b1000000-0000-0000-0000-000000000032', '2026-09-05', '2026-09-05',
             'b1000000-0000-0000-0000-000000000004') $$,
  '42501', null,
  'BERGEN #1: parent A cannot file a notice for parent B''s child');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.absence_notices (student_id, date_from, date_to, created_by)
     values ('b1000000-0000-0000-0000-000000000031', '2026-09-05', '2026-09-05',
             'b1000000-0000-0000-0000-000000000002') $$,
  '42501', null,
  'a teacher cannot file a notice (INSERT is guardian-or-admin only)');
reset role;

-- ── Read matrix (parent A's notice from above is the only row) ─────
select set_config('request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.absence_notices), 1::bigint,
  'parent A reads their own notice (is_guardian_of)');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.absence_notices), 1::bigint,
  'the active-class teacher sees the notice (teaches_student, forward-looking)');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.absence_notices), 0::bigint,
  'BERGEN #1: parent B sees none of parent A''s notices');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.absence_notices), 1::bigint,
  'the student login sees its own notice (is_linked_student)');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.absence_notices), 0::bigint,
  'economy sees zero notices');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.absence_notices), 1::bigint,
  'admin sees every notice');
reset role;

-- ── Content is immutable except the seen_by_teacher acknowledgment ───
-- Only the student's ACTIVE-class teacher may flip seen_by_teacher, and ONLY
-- that column (column-scoped grant); note/dates can never be edited (R2).
select set_config('request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ update public.absence_notices set seen_by_teacher = true
     where id = 'b1000000-0000-0000-0000-000000000051' $$,
  'the active-class teacher flips seen_by_teacher (column grant + teacher policy)');
select throws_ok(
  $$ update public.absence_notices set note = 'x'
     where id = 'b1000000-0000-0000-0000-000000000051' $$,
  '42501', null,
  'the teacher cannot edit content — only seen_by_teacher is granted (column privilege)');
reset role;
select is(
  (select seen_by_teacher from public.absence_notices
   where id = 'b1000000-0000-0000-0000-000000000051'), true,
  'the acknowledgment flip persisted');

-- A different class's teacher is not the student's teacher: the policy USING
-- denies the row, so the UPDATE matches nothing (0 rows, no error, no change).
select set_config('request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ update public.absence_notices set seen_by_teacher = false
     where id = 'b1000000-0000-0000-0000-000000000051' $$,
  'a foreign-class teacher''s seen flip matches no row (policy USING denies)');
reset role;
select is(
  (select seen_by_teacher from public.absence_notices
   where id = 'b1000000-0000-0000-0000-000000000051'), true,
  'the foreign teacher did not change the flag');

-- ── DELETE scoping (author or admin) ────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ delete from public.absence_notices
     where id = 'b1000000-0000-0000-0000-000000000051' $$,
  'a non-author parent DELETE runs without matching any row (RLS USING)');
reset role;
select is((select count(*) from public.absence_notices), 1::bigint,
  'the notice survives the non-author delete attempt');

select set_config('request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ delete from public.absence_notices
     where id = 'b1000000-0000-0000-0000-000000000051' $$,
  'admin retracts the notice');
reset role;
select is((select count(*) from public.absence_notices), 0::bigint,
  'the notice is gone after the admin delete');

-- ── Audit trigger (student data) ────────────────────────────────────
select is(
  (select count(*) from public.audit_log
   where action = 'absence_notices.insert'
     and actor_id = 'b1000000-0000-0000-0000-000000000004'
     and entity_id = 'b1000000-0000-0000-0000-000000000051'),
  1::bigint,
  'absence_notices.insert audit: actor pinned to the filing parent, entity=id');

select * from finish();
rollback;
```

- [ ] **Step 2: Run pgTAP — expect 13 RED**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase test db 2>&1 | tail -12
```

Expected FAIL: `13_absence_notices_rls` errors with `relation "public.absence_notices" does not exist`; `00`–`12` stay green.

- [ ] **Step 3: Create the migration**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase migration new absence_notices
```

Write `supabase/migrations/<ts>_absence_notices.sql`:

```sql
-- Pre-reported absence (D5): a parent/admin flags a coming absence over
-- [date_from, date_to]. No updated_at and no CONTENT UPDATE — a mistaken
-- notice is retracted (DELETE, scoped to author/admin), never edited. Audit
-- trigger (student data, header gotcha 12): entity_id = id. created_by →
-- profiles (restrict). seen_by_teacher is the ONE mutable column: the student's
-- active-class teacher flips it on SAVE (markAttendance) through the
-- column-scoped update grant + policy below (R2) — a client UPDATE, no definer.

create table public.absence_notices (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.students (id) on delete cascade,
  date_from       date not null,
  date_to         date not null,
  note            text check (note is null or char_length(note) <= 500),
  created_by      uuid not null references public.profiles (id),
  seen_by_teacher boolean not null default false,
  created_at      timestamptz not null default now(),
  constraint absence_notices_range check (date_to >= date_from)
);
comment on table public.absence_notices is
  'Parent/admin pre-report of a coming absence over [date_from, date_to]. Retracted via DELETE (author or admin), never edited — no content UPDATE. seen_by_teacher is the one mutable column: the student active-class teacher flips it on save (markAttendance) via a column-scoped update grant + policy (D5/R2). created_by → profiles (restrict).';

-- Audit (student data): entity_id = the notice id. Fires on insert/update/delete
-- (the seen_by_teacher acknowledgment flip is the only UPDATE).
create trigger absence_notices_audit
  after insert or update or delete on public.absence_notices
  for each row execute function private.audit_row_change('id');

-- ── Grant layer (wall 2a) ───────────────────────────────────────────
-- authenticated: select/insert/delete + a column-scoped update(seen_by_teacher)
-- (the acknowledgment flip only). service_role: select/delete (retention/
-- erasure). anon: nothing.
revoke all on table public.absence_notices from anon, authenticated, service_role;
grant select, insert, delete on public.absence_notices to authenticated;
grant select, delete         on public.absence_notices to service_role;

-- A teacher may flip ONLY the seen_by_teacher acknowledgment flag. The column-scoped
-- grant means that even under the policy below they cannot alter note/dates/range.
grant update (seen_by_teacher) on public.absence_notices to authenticated;

alter table public.absence_notices enable row level security;

-- SELECT: admin, the child's guardian, the student's ACTIVE-class teacher
-- (notices are forward-looking), or the linked student login.
create policy "absence_notices_select_related"
  on public.absence_notices for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.is_guardian_of((select auth.uid()), student_id)
    or private.teaches_student((select auth.uid()), student_id)
    or private.is_linked_student((select auth.uid()), student_id)
  );
-- INSERT: admin or the child's guardian.
create policy "absence_notices_insert_guardian_or_admin"
  on public.absence_notices for insert to authenticated
  with check (
    private.has_role((select auth.uid()), 'admin')
    or private.is_guardian_of((select auth.uid()), student_id)
  );
-- DELETE: admin or the notice's author.
create policy "absence_notices_delete_author_or_admin"
  on public.absence_notices for delete to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or created_by = (select auth.uid())
  );
-- UPDATE: the ONLY update path — the student's active-class teacher flips the
-- seen_by_teacher acknowledgment flag (the column privilege above keeps content
-- immutable). Grouped here with the other policies for readability.
create policy "absence_notices_teacher_mark_seen"
  on public.absence_notices for update to authenticated
  using (private.teaches_student((select auth.uid()), student_id))
  with check (private.teaches_student((select auth.uid()), student_id));
```

- [ ] **Step 4: Apply and verify GREEN**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase db reset 2>&1 | tail -4
supabase test db 2>&1 | tail -6
```

Expected: all 13 files pass — `13_absence_notices_rls` **22/22**; firewall `00` still green. Total pgTAP: **243**.

- [ ] **Step 5: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add supabase/tests/13_absence_notices_rls.sql supabase/migrations/*_absence_notices.sql
git commit -m "feat: absence_notices with guardian-filed, author-retractable RLS"
```

---

### Task 4: Migration — historical-visibility helpers + additive policies (D2/D3)

The D2/D3 core: after a student's enrollment is stamped `left_on`, the class **teacher still reads their past `attendance` rows** (via `teaches_lesson`, no enrollment filter — Task 2) and **still sees the non-protected leaver's name** (new `students_select_taught_ever` policy) — but a **protected** leaver's name disappears once `left_on` passes. The family keeps the full record. Adds three `private.*` helpers and three **additive** SELECT policies (new named policies OR-ed into the existing ones — never editing a prior policy).

**Files:**
- Create: `supabase/tests/14_attendance_history.sql`
- Create: `supabase/migrations/<ts>_attendance_visibility.sql` (via `supabase migration new attendance_visibility`)

- [ ] **Step 1: Write the failing pgTAP file**

Create `supabase/tests/14_attendance_history.sql` (fixtures `b2…`). Two students in class 1 have **left** (`left_on` stamped), one visible + one protected; a third is still active; a lesson dated inside the enrollment interval carries a mark for each leaver:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- Hermetic fixtures (seed independence, header gotcha 13). Clear children
-- before parents; attendance/absence_notices/lessons all exist by this task.
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

-- ── Setup: teacher 1 teaches class 1; teacher 2 teaches class 2. In class 1:
--    s1 (non-protected, has login) LEFT 2026-09-15; s2 (protected) LEFT
--    2026-09-15; s3 (non-protected) still active. Lesson L on 2026-08-22 (inside
--    both intervals) has a mark for s1 and s2. parent A guardians s1; parent B
--    guardians s2. ───────────────────────────────────────────────────────────
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.email, '{"provider":"email","providers":["email"]}',
       jsonb_build_object('full_name', u.full_name), now(), now()
from (values
  ('b2000000-0000-0000-0000-000000000001'::uuid, 'pgtap-hi-admin@test.local',    'HI Admin'),
  ('b2000000-0000-0000-0000-000000000002'::uuid, 'pgtap-hi-laerer1@test.local',  'HI Lærer En'),
  ('b2000000-0000-0000-0000-000000000003'::uuid, 'pgtap-hi-laerer2@test.local',  'HI Lærer To'),
  ('b2000000-0000-0000-0000-000000000004'::uuid, 'pgtap-hi-forelderA@test.local','HI Forelder A'),
  ('b2000000-0000-0000-0000-000000000005'::uuid, 'pgtap-hi-forelderB@test.local','HI Forelder B'),
  ('b2000000-0000-0000-0000-000000000006'::uuid, 'pgtap-hi-elev@test.local',     'HI Elev')
) as u(id, email, full_name);
insert into public.user_roles (user_id, role) values
  ('b2000000-0000-0000-0000-000000000001', 'admin'),
  ('b2000000-0000-0000-0000-000000000002', 'teacher'),
  ('b2000000-0000-0000-0000-000000000003', 'teacher'),
  ('b2000000-0000-0000-0000-000000000004', 'parent'),
  ('b2000000-0000-0000-0000-000000000005', 'parent'),
  ('b2000000-0000-0000-0000-000000000006', 'student');

insert into public.terms (id, name, starts_on, ends_on) values
  ('b2000000-0000-0000-0000-000000000011', 'HI Termin', '2026-08-15', '2026-12-20');
insert into public.classes (id, term_id, name) values
  ('b2000000-0000-0000-0000-000000000021', 'b2000000-0000-0000-0000-000000000011', 'HI Klasse 1'),
  ('b2000000-0000-0000-0000-000000000022', 'b2000000-0000-0000-0000-000000000011', 'HI Klasse 2');
insert into public.class_teachers (class_id, teacher_id) values
  ('b2000000-0000-0000-0000-000000000021', 'b2000000-0000-0000-0000-000000000002'),
  ('b2000000-0000-0000-0000-000000000022', 'b2000000-0000-0000-0000-000000000003');
insert into public.students (id, first_name, last_name, birth_year, protected, student_user_id) values
  ('b2000000-0000-0000-0000-000000000031', 'HI', 'Synlig',   2013, false, 'b2000000-0000-0000-0000-000000000006'),
  ('b2000000-0000-0000-0000-000000000032', 'HI', 'Skjermet', 2014, true,  null),
  ('b2000000-0000-0000-0000-000000000033', 'HI', 'Aktiv',    2015, false, null);
insert into public.guardian_student (guardian_id, student_id) values
  ('b2000000-0000-0000-0000-000000000004', 'b2000000-0000-0000-0000-000000000031'),
  ('b2000000-0000-0000-0000-000000000005', 'b2000000-0000-0000-0000-000000000032');
insert into public.class_students (class_id, student_id, enrolled_on, left_on) values
  ('b2000000-0000-0000-0000-000000000021', 'b2000000-0000-0000-0000-000000000031', '2026-08-20', '2026-09-15'),
  ('b2000000-0000-0000-0000-000000000021', 'b2000000-0000-0000-0000-000000000032', '2026-08-20', '2026-09-15'),
  ('b2000000-0000-0000-0000-000000000021', 'b2000000-0000-0000-0000-000000000033', '2026-08-20', null);
insert into public.lessons (id, class_id, date, starts_at, ends_at) values
  ('b2000000-0000-0000-0000-000000000051', 'b2000000-0000-0000-0000-000000000021',
   '2026-08-22', '10:00', '13:00');
insert into public.attendance (lesson_id, student_id, status, recorded_by) values
  ('b2000000-0000-0000-0000-000000000051', 'b2000000-0000-0000-0000-000000000031',
   'present', 'b2000000-0000-0000-0000-000000000002'),
  ('b2000000-0000-0000-0000-000000000051', 'b2000000-0000-0000-0000-000000000032',
   'late', 'b2000000-0000-0000-0000-000000000002');

-- ── Helpers exist ───────────────────────────────────────────────────
select has_function('private'::name, 'taught_student_ever'::name, array['uuid', 'uuid'],
  'private.taught_student_ever(uuid,uuid) exists');
select has_function('private'::name, 'guardian_sees_lesson'::name, array['uuid', 'uuid'],
  'private.guardian_sees_lesson(uuid,uuid) exists');
select has_function('private'::name, 'student_sees_lesson'::name, array['uuid', 'uuid'],
  'private.student_sees_lesson(uuid,uuid) exists');

-- ── Teacher 1, POST-left_on (D2/D3 core) ────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"b2000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select id from public.students order by id $$,
  $$ values ('b2000000-0000-0000-0000-000000000031'::uuid),
            ('b2000000-0000-0000-0000-000000000033'::uuid) $$,
  'D3 + fine-derived #2: teacher sees the non-protected leaver + the active student, NOT the protected leaver');
select is((select count(*) from public.attendance), 2::bigint,
  'D2: teacher still reads BOTH leavers'' past marks (teaches_lesson, no enrollment filter)');
select is((select count(*) from public.lessons
           where id = 'b2000000-0000-0000-0000-000000000051'), 1::bigint,
  'teacher still sees the past lesson (teaches_class)');
reset role;

-- ── Parent A (non-protected leaver's family): full history preserved ─
select set_config('request.jwt.claims',
  '{"sub":"b2000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.attendance), 1::bigint,
  'parent A reads the child''s past mark across the FORMER class (is_guardian_of)');
select is((select count(*) from public.lessons
           where id = 'b2000000-0000-0000-0000-000000000051'), 1::bigint,
  'parent A still sees the lesson metadata (guardian_sees_lesson; guardian_in_class is false post-left)');
select is((select count(*) from public.students
           where id = 'b2000000-0000-0000-0000-000000000031'), 1::bigint,
  'parent A still sees their own child (own family always sees own)');
reset role;

-- ── Student login (the non-protected leaver): own history preserved ─
select set_config('request.jwt.claims',
  '{"sub":"b2000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.attendance), 1::bigint,
  'the former student reads its own past mark');
select is((select count(*) from public.lessons
           where id = 'b2000000-0000-0000-0000-000000000051'), 1::bigint,
  'the former student still sees the lesson metadata (student_sees_lesson)');
reset role;

-- ── Parent B (PROTECTED leaver's family): family keeps full history ─
select set_config('request.jwt.claims',
  '{"sub":"b2000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.attendance), 1::bigint,
  'parent B reads their protected child''s past mark (protected restricts the TEACHER, never the family)');
select is((select count(*) from public.lessons
           where id = 'b2000000-0000-0000-0000-000000000051'), 1::bigint,
  'parent B still sees the lesson metadata (guardian_sees_lesson)');
reset role;

-- ── Admin: sees everyone incl. protected ────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"b2000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.students), 3::bigint,
  'admin sees all three students, protected included');
select is((select count(*) from public.attendance), 2::bigint,
  'admin sees both marks');
reset role;

-- ── Teacher 2 (class 2, never taught these students) — fine-derived #4 ─
select set_config('request.jwt.claims',
  '{"sub":"b2000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.attendance), 0::bigint,
  'fine-derived #4: teacher 2 reads none of class 1''s marks');
select is_empty(
  $$ select id from public.students
     where id in ('b2000000-0000-0000-0000-000000000031',
                  'b2000000-0000-0000-0000-000000000032') $$,
  'teacher 2 never taught these students, so sees neither name');
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Run pgTAP — expect 14 RED**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase test db 2>&1 | tail -12
```

Expected FAIL: `14_attendance_history` errors on `function private.taught_student_ever(uuid, uuid) does not exist` (the helpers/policies are missing — the teacher's `results_eq` would also over-return the protected leaver without the policy). Files `00`–`13` stay green.

- [ ] **Step 3: Create the migration**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase migration new attendance_visibility
```

Write `supabase/migrations/<ts>_attendance_visibility.sql`:

```sql
-- Historical attendance visibility (D2/D3). Three SECURITY DEFINER helpers +
-- three ADDITIVE SELECT policies (new named policies OR-ed into the existing
-- ones — header gotcha 11: never edit a prior policy). Interval rule: a lesson
-- is in a student's history when enrolled_on <= lesson.date and (left_on is null
-- or lesson.date < left_on) — left_on EXCLUSIVE.

-- taught_student_ever = teaches_student minus the `left_on is null` filter: any
-- past OR present enrollment in a class the caller teaches. Used ONLY on the D3
-- students-name path.
create or replace function private.taught_student_ever(uid uuid, sid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.class_students cs
    join public.class_teachers ct on ct.class_id = cs.class_id
    where cs.student_id = sid and ct.teacher_id = uid
  );
$$;

-- guardian_sees_lesson: the caller guardians a student who has an attendance row
-- in the lesson OR whose enrollment interval covers the lesson date — so a
-- parent can read the lesson metadata behind a PAST mark after the child left.
create or replace function private.guardian_sees_lesson(uid uuid, lid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.attendance a
    join public.guardian_student gs on gs.student_id = a.student_id
    where a.lesson_id = lid and gs.guardian_id = uid
  ) or exists (
    select 1
    from public.lessons l
    join public.class_students cs on cs.class_id = l.class_id
    join public.guardian_student gs on gs.student_id = cs.student_id
    where l.id = lid and gs.guardian_id = uid
      and cs.enrolled_on <= l.date
      and (cs.left_on is null or l.date < cs.left_on)
  );
$$;

-- student_sees_lesson: same, for the linked student login.
create or replace function private.student_sees_lesson(uid uuid, lid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.attendance a
    join public.students s on s.id = a.student_id
    where a.lesson_id = lid and s.student_user_id = uid
  ) or exists (
    select 1
    from public.lessons l
    join public.class_students cs on cs.class_id = l.class_id
    join public.students s on s.id = cs.student_id
    where l.id = lid and s.student_user_id = uid
      and cs.enrolled_on <= l.date
      and (cs.left_on is null or l.date < cs.left_on)
  );
$$;

revoke execute on function
  private.taught_student_ever(uuid, uuid),
  private.guardian_sees_lesson(uuid, uuid),
  private.student_sees_lesson(uuid, uuid)
from public;
grant execute on function
  private.taught_student_ever(uuid, uuid),
  private.guardian_sees_lesson(uuid, uuid),
  private.student_sees_lesson(uuid, uuid)
to authenticated;

-- ── Additive policies (OR into the existing SELECT policies) ────────
-- D3: a teacher sees the identity of a NON-protected student they have EVER
-- taught (makes the interval-roster name join resolve for leavers). Protected
-- students stay teacher-visible only while actively enrolled (existing
-- teaches_student path in students_select_related).
create policy "students_select_taught_ever"
  on public.students for select to authenticated
  using (
    private.taught_student_ever((select auth.uid()), id)
    and protected = false
  );

-- Historical lesson metadata for the family/student behind a past mark.
create policy "lessons_select_guardian_history"
  on public.lessons for select to authenticated
  using (private.guardian_sees_lesson((select auth.uid()), id));
create policy "lessons_select_student_history"
  on public.lessons for select to authenticated
  using (private.student_sees_lesson((select auth.uid()), id));
```

- [ ] **Step 4: Apply and verify GREEN**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase db reset 2>&1 | tail -4
supabase test db 2>&1 | tail -6
```

Expected: all 14 files pass — `14_attendance_history` **17/17**; firewall `00` still green. Total pgTAP: **260**.

- [ ] **Step 5: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add supabase/tests/14_attendance_history.sql supabase/migrations/*_attendance_visibility.sql
git commit -m "feat: interval-based attendance history visibility for teacher, parent and student"
```

---

### Task 5: Seed + regenerated types + `access-wall` matrix growth

Populates the local fixture world so every attendance surface renders, regenerates the `Database` type (Task 6+ DAL imports it), and grows `tests/api/access-wall.test.ts` with a per-seed-user × per-new-table RLS sweep. No new seed **users** (header gotcha 14 — `SeedEmail` and `harness.ts` are unchanged); the three **Seed anchors** reuse the existing seed people/classes verbatim.

> **Seed anchor recap** (exact UUIDs from the plan header): `L_PAST` = `f6…0001` (Klasse 1, 2026-08-22, full mark set), `L_TODAY` = `f6…0002` (Klasse 1, 2026-08-29, unmarked), `N_FUTURE` = `f7…0001` (forelder@ files for Yusuf `fe…0001` over 2026-09-05). Dates are DETERMINISTIC and term-relative — never `now()`/`current_date` (see the seed comment for the fixed-date rationale).

> **Type-path note (R5):** the generated Supabase types live at **`src/lib/supabase/database.types.ts`** — the path the DAL imports (`@/lib/supabase/database.types`) and the `db:types` script both target. (Task-index row 5 now points here too.)

> **Matrix-shape note:** the existing `DENIED_CELLS` array is keyed by `[SeedEmail, Role]` (portal-entry denial, a different axis). This task ADDS a new table-row-visibility sweep (`NEW_TABLE_DENYS` / `NEW_TABLE_ALLOWS`) rather than pushing into that array — the two axes don't share a shape. This is the faithful reading of "extend `DENIED_CELLS` for the three new tables."

**Files:**
- Modify: `supabase/seed.sql`
- Modify: `src/lib/supabase/database.types.ts` (generated — never hand-edited)
- Modify: `tests/api/access-wall.test.ts` (new table-visibility sweep)

- [ ] **Step 1: Extend the seed header comment**

In `supabase/seed.sql`, replace the school-data prefix line:

```
-- f1 (terms), fa (subjects), fc (classes), fe (students); pgTAP tests
-- use per-file a5/a6/a7/a8/a9/ad prefixes — never overlap them.
```

with (adds the two new prefixes + the Phase-2 pgTAP prefixes):

```
-- f1 (terms), fa (subjects), fc (classes), fe (students), f6 (lessons),
-- f7 (absence notices); pgTAP tests use per-file a5/a6/a7/a8/a9/ad and
-- ae/af/b1/b2 prefixes — never overlap them.
```

- [ ] **Step 2: Append the Phase-2 attendance seed**

At the END of `supabase/seed.sql` (after the final `class_students` insert), append:

```sql
-- ═══════════════════════════════════════════════════════════════════
-- Phase 2 attendance. Anchor rows (fixed uuids, referenced by the plan's
-- Seed anchors), then the full term calendar via the generation function,
-- then a sample marked lesson and one parent absence notice — so every
-- attendance surface renders against real data.
--
-- DETERMINISTIC DATES (never now()/current_date — byte-stable fixtures for
-- CI + the RLS/row-shape suites): term "Høst 2026" runs 2026-08-15..2026-12-20;
-- Klasse 1 (fc…01) meets Saturdays (weekday 6), Klasse 3 (fc…02) Sundays (7).
-- "Past"/"today" are ROLE labels for the tests, NOT wall-clock relations (the
-- whole term post-dates the build date). L_PAST = 2026-08-22 (first Klasse-1
-- Saturday on/after the 2026-08-20 enrollments) carries a full mark set;
-- L_TODAY = 2026-08-29 stays unmarked. The "I dag" surface filters on the real
-- Oslo date, so L_TODAY is the stable fixture the RLS/DAL tests query by id —
-- the clock-dependent today view is exercised in the browser pass (Task 10/16).
-- Seed runs as postgres (BYPASSRLS), so the admin-only INSERT policy and the
-- SECURITY INVOKER function both apply against a superuser and insert freely;
-- audit triggers fire with actor_id null (expected, as with the Phase-1 seed).
-- ═══════════════════════════════════════════════════════════════════

-- Two anchor lessons FIRST so generate_lessons_for_term's on-conflict-do-nothing
-- skips their slots (no duplicate on the unique (class_id, date, starts_at)).
insert into public.lessons (id, class_id, date, starts_at, ends_at, status) values
  ('f6000000-0000-0000-0000-000000000001',  -- L_PAST (marked below)
   'fc000000-0000-0000-0000-000000000001', '2026-08-22', '10:00', '13:00', 'scheduled'),
  ('f6000000-0000-0000-0000-000000000002',  -- L_TODAY (left unmarked)
   'fc000000-0000-0000-0000-000000000001', '2026-08-29', '10:00', '13:00', 'scheduled');

-- Materialize the rest of the term (every other Klasse-1 Saturday + every
-- Klasse-3 Sunday). Fills 36 more lessons; skips the two anchor slots → 38 total.
select public.generate_lessons_for_term('f1000000-0000-0000-0000-000000000001');

-- A full mark set on L_PAST for Klasse 1's two students (Yusuf present, Bilal
-- late) — the marking-persistence + teacher-history fixture. recorded_by is the
-- class teacher laerer@ (2222…); recorded_at fixed (no now()).
insert into public.attendance (lesson_id, student_id, status, recorded_by, recorded_at) values
  ('f6000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001',
   'present', '22222222-2222-2222-2222-222222222222', '2026-08-22 13:05:00+02'),
  ('f6000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000003',
   'late',    '22222222-2222-2222-2222-222222222222', '2026-08-22 13:05:00+02');

-- One parent-filed absence notice: forelder@ (3333…) reports Yusuf (fe…01,
-- Klasse 1) absent on Saturday 2026-09-05 — a future term date that OVERLAPS a
-- generated Klasse-1 lesson. seen_by_teacher defaults false (drives the
-- pre-report prefill + the cockpit "uses seen" count).
insert into public.absence_notices
  (id, student_id, date_from, date_to, note, created_by, seen_by_teacher) values
  ('f7000000-0000-0000-0000-000000000001',
   'fe000000-0000-0000-0000-000000000001', '2026-09-05', '2026-09-05',
   'Bortreist – familiebesøk.', '33333333-3333-3333-3333-333333333333', false);
```

- [ ] **Step 3: Reset and regenerate types**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase db reset 2>&1 | tail -4
npm run db:types
git diff --stat src/lib/supabase/database.types.ts
npm run typecheck
```

Expected: reset seeds cleanly (`Seeding data …`); `database.types.ts` now contains `lessons`, `attendance`, `absence_notices`, the `lesson_status`/`attendance_status` enums, and the `generate_lessons_for_term` function signature; typecheck stays silent (generated types are additive — no existing DAL breaks).

- [ ] **Step 4: Grow the access-wall matrix**

In `tests/api/access-wall.test.ts`, add `createServerClientMock` to the harness import:

```ts
import {
  createServerClientMock,
  signInAs,
  signInAsAAL2,
  signOut,
  type SeedEmail,
} from './harness';
```

Then append this describe block after the existing ones (it queries the three new tables directly under each seed user's RLS session — the wall-1 twin of the `11`–`14` pgTAP proofs):

```ts
describe('wall 1: the three attendance tables under per-user RLS (spec §3 sweep)', () => {
  // Direct table reads under the caller's own RLS session (AAL1 is fine — RLS
  // never checks AAL; the staff-AAL2 gate lives in the DAL, not here). This is
  // the wall-1 sweep the plan's §3 matrix demands across EVERY seed user; the
  // exact per-user counts live in the Task 7 DAL suite, so the DENY side asserts
  // an empty read (the security-critical direction) and the ALLOW side asserts
  // existence. Seed anchors: L_PAST marks Yusuf + Bilal (Klasse 1); N_FUTURE is
  // Yusuf's notice.
  type NewTable = 'lessons' | 'attendance' | 'absence_notices';

  async function rowCount(email: SeedEmail, table: NewTable): Promise<number> {
    signInAs(email);
    const supabase = await createServerClientMock();
    const { data, error } =
      table === 'lessons'
        ? await supabase.from('lessons').select('id')
        : table === 'attendance'
          ? await supabase.from('attendance').select('lesson_id')
          : await supabase.from('absence_notices').select('id');
    if (error) {
      throw new Error(`Uventet RLS-feil for ${email} på ${table}: ${error.message}`);
    }
    return data?.length ?? 0;
  }

  // DENY: a user with no relationship to a table's rows reads exactly zero.
  // economy is walled from all pedagogy; forelder2's children (protected/
  // stopped) have no marks or notices; the dual-role user teaches Klasse 3 and
  // parents a Klasse-1 child but has no path to Yusuf's notice.
  const NEW_TABLE_DENYS: Array<[SeedEmail, NewTable]> = [
    ['okonomi@test.local', 'lessons'],
    ['okonomi@test.local', 'attendance'],
    ['okonomi@test.local', 'absence_notices'],
    ['forelder2@test.local', 'attendance'],
    ['forelder2@test.local', 'absence_notices'],
    ['laererforelder@test.local', 'absence_notices'],
  ];
  it.each(NEW_TABLE_DENYS)('denies %s every row of %s', async (email, table) => {
    expect(await rowCount(email, table)).toBe(0);
  });

  // ALLOW (the exceptions): admin all; the class teacher own-class + own marks;
  // the guardian own-child; the student self; forelder2 still sees Klasse-3
  // lessons via the active protected child; the dual-role user sees Klasse-1
  // marks via her own child Bilal.
  const NEW_TABLE_ALLOWS: Array<[SeedEmail, NewTable]> = [
    ['admin@test.local', 'lessons'],
    ['admin@test.local', 'attendance'],
    ['admin@test.local', 'absence_notices'],
    ['laerer@test.local', 'lessons'],
    ['laerer@test.local', 'attendance'],
    ['laerer@test.local', 'absence_notices'],
    ['forelder@test.local', 'lessons'],
    ['forelder@test.local', 'attendance'],
    ['forelder@test.local', 'absence_notices'],
    ['elev@test.local', 'lessons'],
    ['elev@test.local', 'attendance'],
    ['elev@test.local', 'absence_notices'],
    ['forelder2@test.local', 'lessons'],
    ['laererforelder@test.local', 'lessons'],
    ['laererforelder@test.local', 'attendance'],
  ];
  it.each(NEW_TABLE_ALLOWS)('lets %s read at least one row of %s', async (email, table) => {
    expect(await rowCount(email, table)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 5: Run every suite, then commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase test db 2>&1 | tail -6
npm run test:api 2>&1 | tail -8
npm run typecheck && npm run lint
```

Expected: **260** pgTAP unchanged (seed rows are cleared by every test's hermetic preamble); `test:api` grows by the **21** new access-wall cells (6 deny + 15 allow) and all pass; the whole prior `test:api` suite stays green; typecheck silent, lint clean. If `test:api` fails on a login, the local stack needs a fresh `supabase db reset`.

```bash
cd /Users/daodilyas/dev/iqra-portal
git add supabase/seed.sql src/lib/supabase/database.types.ts tests/api/access-wall.test.ts
git commit -m "feat: seed attendance fixtures, regenerated db types, grown access-wall matrix"
```

### Task 6: Validation schemas + label maps + Oslo lesson-date helpers

Pure, unit-tested foundations for the attendance write/read layer — no DB, no `server-only`. `src/lib/validation/attendance.ts` is the single home for every Zod schema + Norwegian label map the action files import (header gotcha 15). It also becomes the canonical declaration site for `AttendanceStatus`/`LessonStatus`: the DAL (Task 7) **re-exports** them so the contract's consumer import paths (`from '@/lib/dal/attendance'`, `from '@/lib/dal/lessons'`) still resolve — done this way because validation is authored before the DAL, is client-safe, and must not import the `server-only` DAL. `src/lib/dates.ts` gains the weekday + time-range helpers the lesson UI/DAL need; the existing `todayOsloISO()` already covers "today in Oslo" and is reused verbatim (no `osloToday()` duplicate).

**Files:**
- Create: `src/lib/validation/attendance.ts`
- Create: `src/lib/validation/attendance.test.ts`
- Modify: `src/lib/dates.ts` (add `isoWeekday`, `formatTimeRange`)
- Modify: `src/lib/dates.test.ts` (cover the two new helpers)

- [ ] **Step 1: Write the failing validation unit tests**

Create `src/lib/validation/attendance.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  absenceNoticeSchema,
  attendanceMarkSchema,
  attendanceMarksSchema,
  attendanceStatusLabels,
  lessonEditSchema,
  lessonStatusLabels,
} from './attendance';

const STUDENT = 'fe000000-0000-0000-0000-000000000001';

describe('label maps', () => {
  it('render the bokmål attendance labels', () => {
    expect(attendanceStatusLabels).toEqual({
      present: 'Til stede',
      absent: 'Fravær',
      late: 'For sent',
      excused: 'Gyldig fravær',
    });
  });
  it('render the bokmål lesson-status labels', () => {
    expect(lessonStatusLabels).toEqual({ scheduled: 'Planlagt', cancelled: 'Avlyst' });
  });
});

describe('attendanceMarkSchema', () => {
  it('accepts a valid mark and nulls an empty note', () => {
    const parsed = attendanceMarkSchema.safeParse({
      student_id: STUDENT,
      status: 'present',
      note: '',
    });
    expect(parsed.success && parsed.data.note).toBeNull();
  });
  it('accepts a mark with no note field at all', () => {
    const parsed = attendanceMarkSchema.safeParse({ student_id: STUDENT, status: 'late' });
    expect(parsed.success && parsed.data.note).toBeNull();
  });
  it.each([
    [{ student_id: STUDENT, status: 'skulk' }],
    [{ student_id: 'nope', status: 'present' }],
    [{ student_id: STUDENT, status: 'present', note: 'x'.repeat(501) }],
  ])('rejects %j', (input) => {
    expect(attendanceMarkSchema.safeParse(input).success).toBe(false);
  });
});

describe('attendanceMarksSchema', () => {
  it('accepts a non-empty array of marks', () => {
    const parsed = attendanceMarksSchema.safeParse([
      { student_id: STUDENT, status: 'present' },
      { student_id: 'fe000000-0000-0000-0000-000000000003', status: 'absent' },
    ]);
    expect(parsed.success && parsed.data).toHaveLength(2);
  });
  it('rejects an empty submission', () => {
    const parsed = attendanceMarksSchema.safeParse([]);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe('Ingen elever å registrere.');
    }
  });
});

describe('absenceNoticeSchema', () => {
  it('accepts a valid range', () => {
    const parsed = absenceNoticeSchema.safeParse({
      student_id: STUDENT,
      date_from: '2026-11-01',
      date_to: '2026-11-03',
    });
    expect(parsed.success).toBe(true);
  });
  it('accepts a single-day range (date_to == date_from, boundary)', () => {
    const parsed = absenceNoticeSchema.safeParse({
      student_id: STUDENT,
      date_from: '2026-11-01',
      date_to: '2026-11-01',
    });
    expect(parsed.success).toBe(true);
  });
  it.each([
    [
      { student_id: STUDENT, date_from: '2026-11-03', date_to: '2026-11-01' },
      'Til-dato må være lik eller etter fra-dato.',
    ],
    [
      { student_id: STUDENT, date_from: 'ikke-dato', date_to: '2026-11-01' },
      'Oppgi fra-dato.',
    ],
  ])('rejects %j', (input, message) => {
    const parsed = absenceNoticeSchema.safeParse(input);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe(message);
    }
  });
});

describe('lessonEditSchema', () => {
  it('accepts a status-only edit (no times)', () => {
    const parsed = lessonEditSchema.safeParse({ status: 'cancelled' });
    expect(parsed.success && parsed.data.status).toBe('cancelled');
  });
  it('accepts a time edit where ends_at > starts_at', () => {
    const parsed = lessonEditSchema.safeParse({
      status: 'scheduled',
      starts_at: '10:00',
      ends_at: '13:00',
    });
    expect(parsed.success).toBe(true);
  });
  it.each([
    [{ status: 'scheduled', starts_at: '13:00', ends_at: '10:00' }, 'Sluttid må være etter starttid.'],
    [{ status: 'scheduled', starts_at: '13:00', ends_at: '13:00' }, 'Sluttid må være etter starttid.'],
    [{ status: 'nei' }, 'Ugyldig timestatus.'],
    [{ status: 'scheduled', starts_at: '25:00', ends_at: '26:00' }, 'Ugyldig klokkeslett (tt:mm).'],
  ])('rejects %j', (input, message) => {
    const parsed = lessonEditSchema.safeParse(input);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe(message);
    }
  });
});
```

Run: `cd /Users/daodilyas/dev/iqra-portal && npm test -- src/lib/validation/attendance.test.ts`
**Expected: FAIL** — Vitest cannot resolve `./attendance` (module does not exist yet).

- [ ] **Step 2: Implement `src/lib/validation/attendance.ts`**

```ts
import { z } from 'zod';
import { uuidField } from './school';

// Canonical string-literal unions for the attendance domain. Declared here
// (pure, client-safe) and re-exported from the server-only DAL so the
// contract's `from '@/lib/dal/*'` import paths keep resolving.
const attendanceStatusValues = ['present', 'absent', 'late', 'excused'] as const;
export type AttendanceStatus = (typeof attendanceStatusValues)[number];

const lessonStatusValues = ['scheduled', 'cancelled'] as const;
export type LessonStatus = (typeof lessonStatusValues)[number];

/** UI label maps (bokmål) — DB values stay English (header gotcha 7). */
export const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  present: 'Til stede',
  absent: 'Fravær',
  late: 'For sent',
  excused: 'Gyldig fravær',
};

export const lessonStatusLabels: Record<LessonStatus, string> = {
  scheduled: 'Planlagt',
  cancelled: 'Avlyst',
};

// Optional free-text note: absent/null/'' all collapse to null; else trimmed,
// capped at 500. `.nullish()` so a JSON payload sending `note: null` is valid.
const optionalNote = z
  .string()
  .trim()
  .max(500, 'Maks 500 tegn.')
  .nullish()
  .transform((value) => (value == null || value === '' ? null : value));

const timeField = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Ugyldig klokkeslett (tt:mm).');

export const attendanceMarkSchema = z.object({
  student_id: uuidField,
  status: z.enum(attendanceStatusValues, { error: 'Ugyldig oppmøtestatus.' }),
  note: optionalNote,
});

export const attendanceMarksSchema = z
  .array(attendanceMarkSchema)
  .min(1, 'Ingen elever å registrere.')
  .max(200, 'For mange elever i én innsending.');

export const absenceNoticeSchema = z
  .object({
    student_id: uuidField,
    date_from: z.iso.date('Oppgi fra-dato.'),
    date_to: z.iso.date('Oppgi til-dato.'),
    note: optionalNote,
  })
  .refine((v) => v.date_to >= v.date_from, {
    message: 'Til-dato må være lik eller etter fra-dato.',
    path: ['date_to'],
  });

export const lessonEditSchema = z
  .object({
    status: z.enum(lessonStatusValues, { error: 'Ugyldig timestatus.' }),
    note: optionalNote,
    starts_at: timeField.optional(),
    ends_at: timeField.optional(),
  })
  .refine(
    (v) => v.starts_at == null || v.ends_at == null || v.ends_at > v.starts_at,
    { message: 'Sluttid må være etter starttid.', path: ['ends_at'] },
  );
```

Run: `cd /Users/daodilyas/dev/iqra-portal && npm test -- src/lib/validation/attendance.test.ts`
**Expected: PASS** — all label + schema cases green.

- [ ] **Step 3: Write the failing date-helper tests**

Edit the top import in `src/lib/dates.test.ts` to pull the two new helpers, and add two cases inside the existing `describe('dates', …)` block:

```ts
import { formatDateNb, formatTimeRange, isoWeekday, scheduleLabel, todayOsloISO } from './dates';
```

```ts
  it('maps an ISO date to its ISO weekday (Saturday = 6)', () => {
    expect(isoWeekday('2026-08-15')).toBe(6); // Saturday
    expect(isoWeekday('2026-08-16')).toBe(7); // Sunday
    expect(isoWeekday('2026-08-17')).toBe(1); // Monday
  });
  it('formats a lesson time range with an en dash', () => {
    expect(formatTimeRange('10:00:00', '13:00:00')).toBe('10:00–13:00');
  });
```

Run: `cd /Users/daodilyas/dev/iqra-portal && npm test -- src/lib/dates.test.ts`
**Expected: FAIL** — `isoWeekday`/`formatTimeRange` are not exported yet.

- [ ] **Step 4: Implement the date helpers**

Append to `src/lib/dates.ts` (after `todayOsloISO`):

```ts
/**
 * ISO weekday (1 = Monday … 7 = Sunday) for a date-only ISO string. The date
 * is anchored to UTC noon so the runner's timezone never shifts the calendar
 * day — the same trick formatDateNb uses. Matches class_schedule.weekday.
 */
export function isoWeekday(isoDate: string): number {
  const day = new Date(`${isoDate}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return day === 0 ? 7 : day;
}

/** '10:00:00' + '13:00:00' -> '10:00–13:00' (en dash), for lesson rows. */
export function formatTimeRange(startsAt: string, endsAt: string): string {
  return `${formatTime(startsAt)}–${formatTime(endsAt)}`;
}
```

Run: `cd /Users/daodilyas/dev/iqra-portal && npm test -- src/lib/dates.test.ts`
**Expected: PASS**

- [ ] **Step 5: Typecheck, lint, commit**

Run: `cd /Users/daodilyas/dev/iqra-portal && npm run typecheck && npm run lint`
**Expected: PASS** — zero TS errors, zero lint errors.

Run:
```
cd /Users/daodilyas/dev/iqra-portal && git add src/lib/validation/attendance.ts src/lib/validation/attendance.test.ts src/lib/dates.ts src/lib/dates.test.ts && git commit -m "feat: attendance validation schemas, labels, and Oslo lesson-date helpers"
```

---

### Task 7: DAL reads (`lessons.ts`, `attendance.ts`) + `tests/api/attendance-core.test.ts`

Wall-1 twins of the pgTAP proofs: every read carries its own `.eq`/relationship predicate and returns `null` for a foreign or nonexistent id (mirroring `getRosterForTeacher`). `listTeacherToday` filters to the Oslo day; `getLessonForMarking` builds the interval roster (`enrolled_on <= lesson.date and (left_on is null or lesson.date < left_on)`) and prefills covering absence notices as a **pure read** (the `seen_by_teacher` flip moved to `markAttendance` on save — R2); the history reads are scoped to guardian / own-student / admin.

**Preconditions (Tasks 1–5 already merged on `feat/phase-2`):**
- Tables `lessons`, `attendance`, `absence_notices`, the `generate_lessons_for_term` RPC, the `private` helpers, the D3 `students_select_taught_ever` policy, and the **regenerated `src/lib/supabase/database.types.ts`** all exist.
- Seed anchors present: `L_PAST` (`f6…01`, past `scheduled` Klasse-1 lesson with a full set of attendance rows — its **two** Klasse-1 members Yusuf + Bilal marked), `L_TODAY` (`f6…02`), `N_FUTURE` (`f7…01`), and the term's lessons generated.
- **Task 3 dependency (D5/R2):** `absence_notices` grants a **column-scoped `update (seen_by_teacher)`** to `authenticated` plus the `absence_notices_teacher_mark_seen` policy (teacher-of-the-student), so **`markAttendance`'s on-save acknowledge-flip (Task 9)** succeeds — `getLessonForMarking` itself no longer writes. (This refines §2's "no in-place UPDATE" to "no content update" + the narrow seen flag.)
- Stack up with fresh seeds: `supabase db reset` completed, all containers healthy.

**Files:**
- Create: `src/lib/dal/lessons.ts`
- Create: `src/lib/dal/attendance.ts`
- Create: `tests/api/attendance-core.test.ts`

- [ ] **Step 1: Write the failing API tests**

Create `tests/api/attendance-core.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock factories are hoisted and cannot be shared across files — the three
// blocks are repeated per new tests/api file (ledger #14). No next/cache mock:
// these are pure reads (no revalidate path).
vi.mock('server-only', () => ({}));
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
  generateLessonsForTerm,
  getLessonMetaForAdmin,
  listClassLessonsForAdmin,
  listClassLessonsForTeacher,
  listTeacherToday,
  listTermLessonsForAdmin,
} from '@/lib/dal/lessons';
import {
  getChildAttendanceHistory,
  getLessonForMarking,
  getOwnAttendanceHistory,
  getStudentAttendanceForAdmin,
  listAbsenceNoticesForChild,
} from '@/lib/dal/attendance';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getPublicEnv } from '@/lib/env';
import { todayOsloISO } from '@/lib/dates';
import { createServerClientMock, signInAs, signInAsAAL2, signOut } from './harness';

const FORELDER_ID = '33333333-3333-3333-3333-333333333333';
const HOST_2026 = 'f1000000-0000-0000-0000-000000000001';
const K1 = 'fc000000-0000-0000-0000-000000000001'; // Klasse 1, laerer@ teaches
const K3 = 'fc000000-0000-0000-0000-000000000002'; // Klasse 3, laererforelder@ teaches
const YUSUF = 'fe000000-0000-0000-0000-000000000001'; // K1, forelder@'s child, elev@ login
const BILAL = 'fe000000-0000-0000-0000-000000000003'; // K1
const ZAYNAB = 'fe000000-0000-0000-0000-000000000004'; // K3, PROTECTED, forelder2@'s child
const IDRIS = 'fe000000-0000-0000-0000-000000000005'; // stopped, no class, forelder2@'s child
const L_PAST = 'f6000000-0000-0000-0000-000000000001';

// Service role: sanctioned ONLY to tear down scratch `lessons` rows —
// authenticated has no DELETE on lessons (they are cancelled, not deleted),
// and lessons carry no audit trigger, so a service delete is clean. Never the
// code under test.
function serviceClient() {
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

describe('wall 1: listTeacherToday filters to the Oslo day and the caller’s class', () => {
  it('sends an AAL1 teacher to MFA before any data', async () => {
    signInAs('laerer@test.local');
    await expect(listTeacherToday()).rejects.toThrow('NEXT_REDIRECT:/mfa/registrer');
  });
  it('turns a parent away', async () => {
    signInAs('forelder@test.local');
    await expect(listTeacherToday()).rejects.toThrow('NEXT_REDIRECT:/ingen-tilgang');
  });
  it('shows only today’s own-class lessons', async () => {
    const service = serviceClient();
    let todayId = '';
    let otherId = '';
    try {
      await signInAsAAL2('admin@test.local');
      const admin = await createServerClientMock();
      const { data: a } = await admin
        .from('lessons')
        .insert({ class_id: K1, date: todayOsloISO(), starts_at: '09:00', ends_at: '10:00' })
        .select('id')
        .single();
      const { data: b } = await admin
        .from('lessons')
        .insert({ class_id: K1, date: '2026-09-05', starts_at: '09:00', ends_at: '10:00' })
        .select('id')
        .single();
      todayId = a!.id;
      otherId = b!.id;

      await signInAsAAL2('laerer@test.local');
      const dagens = await listTeacherToday();
      const ids = dagens.map((l) => l.id);
      expect(ids).toContain(todayId);
      expect(ids).not.toContain(otherId);
      const entry = dagens.find((l) => l.id === todayId)!;
      expect(entry.class_name).toBe('Klasse 1');
      expect(entry.status).toBe('scheduled');
      expect(entry.marked_count).toBe(0);
    } finally {
      if (todayId) await service.from('lessons').delete().eq('id', todayId);
      if (otherId) await service.from('lessons').delete().eq('id', otherId);
    }
  }, 30000);
});

describe('wall 1: getLessonForMarking (teaches_lesson, interval roster, D3/D5)', () => {
  it('opens a past own-class lesson; the seeded marks persist for the admin', async () => {
    await signInAsAAL2('laerer@test.local');
    const marking = await getLessonForMarking(L_PAST);
    expect(marking).not.toBeNull();
    expect(marking!.lesson.class_name).toBe('Klasse 1');
    expect(marking!.lesson.status).toBe('scheduled');

    await signInAsAAL2('admin@test.local');
    const meta = await getLessonMetaForAdmin(L_PAST);
    expect(meta!.marked_count).toBe(2); // Klasse 1's two seeded members
  }, 30000);

  it('includes a non-protected leaver but drops a protected leaver on a covered date', async () => {
    const service = serviceClient();
    const D = '2026-09-05'; // Saturday in Høst 2026, after the 2026-08-20 enrollments
    let lessonId = '';
    try {
      await signInAsAAL2('admin@test.local');
      const admin = await createServerClientMock();
      const { data: lesson } = await admin
        .from('lessons')
        .insert({ class_id: K1, date: D, starts_at: '08:00', ends_at: '09:00' })
        .select('id')
        .single();
      lessonId = lesson!.id;
      // Two former K1 members whose interval covers D (left_on exclusive, after
      // D). Both non-active (left_on set) so the one-active index is untouched.
      await admin.from('class_students').insert([
        { class_id: K1, student_id: IDRIS, enrolled_on: '2026-08-15', left_on: '2026-09-10' },
        { class_id: K1, student_id: ZAYNAB, enrolled_on: '2026-08-15', left_on: '2026-09-10' },
      ]);

      await signInAsAAL2('laerer@test.local');
      const marking = await getLessonForMarking(lessonId);
      const names = marking!.roster.map((r) => r.first_name);
      // Sorted by last name: Ali (Idris) < Farah (Yusuf) < Omar (Bilal).
      // Zaynab Ali (protected leaver) is invisible to the teacher -> dropped.
      expect(names).toEqual(['Idris', 'Yusuf', 'Bilal']);
      const idris = marking!.roster.find((r) => r.first_name === 'Idris')!;
      expect(idris.status).toBeNull();
      expect(idris.pre_reported).toBe(false);
    } finally {
      await signInAsAAL2('admin@test.local');
      const admin = await createServerClientMock();
      await admin.from('class_students').delete().eq('class_id', K1).eq('student_id', IDRIS);
      await admin.from('class_students').delete().eq('class_id', K1).eq('student_id', ZAYNAB);
      if (lessonId) await service.from('lessons').delete().eq('id', lessonId);
    }
  }, 45000);

  it('prefills a covering absence notice WITHOUT flipping seen_by_teacher (R2: flip is on save)', async () => {
    const service = serviceClient();
    const D = '2026-09-05';
    let lessonId = '';
    let noticeId = '';
    try {
      await signInAsAAL2('admin@test.local');
      const admin = await createServerClientMock();
      const { data: lesson } = await admin
        .from('lessons')
        .insert({ class_id: K1, date: D, starts_at: '08:00', ends_at: '09:00' })
        .select('id')
        .single();
      lessonId = lesson!.id;

      signInAs('forelder@test.local');
      const parent = await createServerClientMock();
      const { data: notice } = await parent
        .from('absence_notices')
        .insert({ student_id: YUSUF, date_from: '2026-09-04', date_to: '2026-09-06', created_by: FORELDER_ID })
        .select('id')
        .single();
      noticeId = notice!.id;

      await signInAsAAL2('laerer@test.local');
      const marking = await getLessonForMarking(lessonId);
      const yusuf = marking!.roster.find((r) => r.student_id === YUSUF)!;
      expect(yusuf.pre_reported).toBe(true);
      expect(yusuf.status).toBeNull();
      // getLessonForMarking is a PURE read (R2): opening the lesson prefills the
      // pre-report but must NOT acknowledge it — the seen flip is on save
      // (markAttendance), asserted in attendance-actions.test.ts.
      const teacher = await createServerClientMock();
      const { data: seen } = await teacher
        .from('absence_notices')
        .select('seen_by_teacher')
        .eq('id', noticeId)
        .single();
      expect(seen!.seen_by_teacher).toBe(false);
    } finally {
      if (noticeId) {
        signInAs('forelder@test.local');
        const parent = await createServerClientMock();
        await parent.from('absence_notices').delete().eq('id', noticeId);
      }
      if (lessonId) await service.from('lessons').delete().eq('id', lessonId);
    }
  }, 45000);

  it('is null for a malformed or foreign lesson id', async () => {
    await signInAsAAL2('laerer@test.local');
    await expect(getLessonForMarking('ikke-en-uuid')).resolves.toBeNull();
    await expect(getLessonForMarking('f6000000-0000-0000-0000-0000000000ff')).resolves.toBeNull();
  });
});

describe('wall 1: attendance history is relationship-scoped', () => {
  it('gives a parent their own child but null for another family or a bad id', async () => {
    signInAs('forelder@test.local');
    const own = await getChildAttendanceHistory(YUSUF);
    expect(own).not.toBeNull();
    expect(own!.some((r) => r.class_name === 'Klasse 1')).toBe(true);
    await expect(getChildAttendanceHistory(ZAYNAB)).resolves.toBeNull();
    await expect(getChildAttendanceHistory('ikke-en-uuid')).resolves.toBeNull();
  });
  it('turns a teacher away from the parent history read', async () => {
    await signInAsAAL2('laerer@test.local');
    await expect(getChildAttendanceHistory(YUSUF)).rejects.toThrow('NEXT_REDIRECT:/ingen-tilgang');
  });
  it('gives a student login its own history', async () => {
    signInAs('elev@test.local');
    const mine = await getOwnAttendanceHistory();
    expect(mine.some((r) => r.class_name === 'Klasse 1')).toBe(true);
  });
  it('gives an admin any student’s history and [] for a malformed id', async () => {
    await signInAsAAL2('admin@test.local');
    const yusuf = await getStudentAttendanceForAdmin(YUSUF);
    expect(yusuf.some((r) => r.class_name === 'Klasse 1')).toBe(true);
    await expect(getStudentAttendanceForAdmin('ikke-en-uuid')).resolves.toEqual([]);
  });
});

describe('wall 1: listAbsenceNoticesForChild is guardian-scoped', () => {
  it('returns own child’s notices, null for a foreign child or bad id', async () => {
    let noticeId = '';
    try {
      signInAs('forelder@test.local');
      const parent = await createServerClientMock();
      const { data: notice } = await parent
        .from('absence_notices')
        .insert({ student_id: YUSUF, date_from: '2026-11-01', date_to: '2026-11-03', created_by: FORELDER_ID })
        .select('id')
        .single();
      noticeId = notice!.id;
      const notices = await listAbsenceNoticesForChild(YUSUF);
      expect(notices).not.toBeNull();
      expect(notices!.some((n) => n.id === noticeId)).toBe(true);
      await expect(listAbsenceNoticesForChild(ZAYNAB)).resolves.toBeNull();
      await expect(listAbsenceNoticesForChild('ikke-en-uuid')).resolves.toBeNull();
    } finally {
      if (noticeId) {
        signInAs('forelder@test.local');
        const parent = await createServerClientMock();
        await parent.from('absence_notices').delete().eq('id', noticeId);
      }
    }
  }, 30000);
});

describe('wall 1: lesson lists', () => {
  it('lists own-class lessons incl. the seeded past lesson; null for a foreign class', async () => {
    await signInAsAAL2('laerer@test.local');
    const list = await listClassLessonsForTeacher(K1);
    expect(list).not.toBeNull();
    expect(list!.some((l) => l.id === L_PAST)).toBe(true);
    await expect(listClassLessonsForTeacher(K3)).resolves.toBeNull();
    await expect(listClassLessonsForTeacher('ikke-en-uuid')).resolves.toBeNull();
  }, 30000);
  it('lists all term lessons for an admin', async () => {
    await signInAsAAL2('admin@test.local');
    const list = await listTermLessonsForAdmin(HOST_2026);
    expect(list.some((l) => l.id === L_PAST)).toBe(true);
  });
  it('lists one class’s lessons for an admin, date-ordered, marks counted', async () => {
    await signInAsAAL2('admin@test.local');
    const list = await listClassLessonsForAdmin(K1);
    expect(list.some((l) => l.id === L_PAST)).toBe(true);
    const dates = list.map((l) => l.date);
    expect(dates).toEqual([...dates].sort());
    expect(list.find((l) => l.id === L_PAST)!.marked_count).toBe(2);
  });
  it('confines generateLessonsForTerm to admins', async () => {
    await signInAsAAL2('laerer@test.local');
    await expect(generateLessonsForTerm(HOST_2026)).rejects.toThrow('NEXT_REDIRECT:/ingen-tilgang');
    signInAs('forelder@test.local');
    await expect(generateLessonsForTerm(HOST_2026)).rejects.toThrow('NEXT_REDIRECT:/ingen-tilgang');
  });
});

describe('wall 1: economy is denied every attendance read (spec §3)', () => {
  it('refuses each read (the role check precedes AAL2, so AAL1 is enough)', async () => {
    signInAs('okonomi@test.local');
    await expect(listTeacherToday()).rejects.toThrow('NEXT_REDIRECT:/ingen-tilgang');
    await expect(getLessonForMarking(L_PAST)).rejects.toThrow('NEXT_REDIRECT:/ingen-tilgang');
    await expect(listClassLessonsForTeacher(K1)).rejects.toThrow('NEXT_REDIRECT:/ingen-tilgang');
    await expect(listTermLessonsForAdmin(HOST_2026)).rejects.toThrow('NEXT_REDIRECT:/ingen-tilgang');
    await expect(getLessonMetaForAdmin(L_PAST)).rejects.toThrow('NEXT_REDIRECT:/ingen-tilgang');
    await expect(getStudentAttendanceForAdmin(YUSUF)).rejects.toThrow('NEXT_REDIRECT:/ingen-tilgang');
    await expect(generateLessonsForTerm(HOST_2026)).rejects.toThrow('NEXT_REDIRECT:/ingen-tilgang');
    await expect(getChildAttendanceHistory(YUSUF)).rejects.toThrow('NEXT_REDIRECT:/ingen-tilgang');
    await expect(getOwnAttendanceHistory()).rejects.toThrow('NEXT_REDIRECT:/ingen-tilgang');
    await expect(listAbsenceNoticesForChild(YUSUF)).rejects.toThrow('NEXT_REDIRECT:/ingen-tilgang');
  }, 30000);
});
```

Run: `cd /Users/daodilyas/dev/iqra-portal && npm run test:api -- tests/api/attendance-core.test.ts`
**Expected: FAIL** — `@/lib/dal/lessons` and `@/lib/dal/attendance` do not exist yet (unresolved imports).

- [ ] **Step 2: Implement `src/lib/dal/lessons.ts`**

```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { todayOsloISO } from '@/lib/dates';
import { requireStaffRole } from './session';
import type { LessonStatus } from '@/lib/validation/attendance';

export type { LessonStatus } from '@/lib/validation/attendance';

const nbCollator = new Intl.Collator('nb');

export type TeacherTodayLesson = {
  id: string;
  class_id: string;
  class_name: string;
  room: string | null;
  starts_at: string;
  ends_at: string;
  status: LessonStatus;
  marked_count: number;
  roster_count: number;
};

export type AdminLesson = {
  id: string;
  date: string;
  starts_at: string;
  ends_at: string;
  status: LessonStatus;
  note: string | null;
  marked_count: number;
};

/**
 * Today's lessons across the CALLER's classes (Oslo day). The .eq on
 * teacher_id is load-bearing (the .eq discipline): RLS also lets admins read
 * every lesson, so a bare read would over-return for a dual-role admin+teacher.
 */
export async function listTeacherToday(): Promise<TeacherTodayLesson[]> {
  const { user } = await requireStaffRole('teacher');
  const supabase = await createClient();
  const today = todayOsloISO();

  const { data: links, error: linkError } = await supabase
    .from('class_teachers')
    .select('class_id')
    .eq('teacher_id', user.id);
  if (linkError) {
    throw new Error(`Kunne ikke lese egne klasser: ${linkError.message}`);
  }
  const classIds = (links ?? []).map((l) => l.class_id);
  if (classIds.length === 0) return [];

  const { data: lessons, error } = await supabase
    .from('lessons')
    .select('id, class_id, starts_at, ends_at, status, classes(name, room), attendance(lesson_id)')
    .in('class_id', classIds)
    .eq('date', today);
  if (error) {
    throw new Error(`Kunne ikke lese dagens timer: ${error.message}`);
  }

  // Interval roster head-count per class for today (left_on exclusive).
  const { data: rosterRows, error: rosterError } = await supabase
    .from('class_students')
    .select('class_id')
    .in('class_id', classIds)
    .lte('enrolled_on', today)
    .or(`left_on.is.null,left_on.gt.${today}`);
  if (rosterError) {
    throw new Error(`Kunne ikke telle elever for timene: ${rosterError.message}`);
  }
  const rosterCounts = new Map<string, number>();
  for (const row of rosterRows ?? []) {
    rosterCounts.set(row.class_id, (rosterCounts.get(row.class_id) ?? 0) + 1);
  }

  return (lessons ?? [])
    .map((l) => ({
      id: l.id,
      class_id: l.class_id,
      class_name: l.classes?.name ?? '',
      room: l.classes?.room ?? null,
      starts_at: l.starts_at,
      ends_at: l.ends_at,
      status: l.status,
      marked_count: (l.attendance ?? []).length,
      roster_count: rosterCounts.get(l.class_id) ?? 0,
    }))
    .sort(
      (a, b) =>
        a.starts_at.localeCompare(b.starts_at) ||
        nbCollator.compare(a.class_name, b.class_name),
    );
}

/**
 * Every lesson of ONE of the caller's own classes. Relationship check FIRST
 * (wall 1); enumeration-quiet null for a class that is not theirs / does not
 * exist / a malformed id.
 */
export async function listClassLessonsForTeacher(
  classId: string,
): Promise<AdminLesson[] | null> {
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
    .from('lessons')
    .select('id, date, starts_at, ends_at, status, note, attendance(lesson_id)')
    .eq('class_id', classId)
    .order('date', { ascending: false })
    .order('starts_at', { ascending: false });
  if (error) {
    throw new Error(`Kunne ikke lese timene for klassen: ${error.message}`);
  }
  return (data ?? []).map((l) => ({
    id: l.id,
    date: l.date,
    starts_at: l.starts_at,
    ends_at: l.ends_at,
    status: l.status,
    note: l.note,
    marked_count: (l.attendance ?? []).length,
  }));
}

/** Materialize the term's lessons (admin-only; idempotent SQL fn, D1). */
export async function generateLessonsForTerm(
  termId: string,
): Promise<{ created: number; skipped: number }> {
  await requireStaffRole('admin');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('generate_lessons_for_term', {
    p_term_id: termId,
  });
  if (error) {
    throw new Error(`Kunne ikke generere timer: ${error.message}`);
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { created: row?.created ?? 0, skipped: row?.skipped ?? 0 };
}

/** Every lesson in a term, for the admin term page (admin-only). */
export async function listTermLessonsForAdmin(
  termId: string,
): Promise<AdminLesson[]> {
  await requireStaffRole('admin');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('lessons')
    .select('id, date, starts_at, ends_at, status, note, attendance(lesson_id), classes!inner(term_id)')
    .eq('classes.term_id', termId)
    .order('date', { ascending: true })
    .order('starts_at', { ascending: true });
  if (error) {
    throw new Error(`Kunne ikke lese timene for terminen: ${error.message}`);
  }
  return (data ?? []).map((l) => ({
    id: l.id,
    date: l.date,
    starts_at: l.starts_at,
    ends_at: l.ends_at,
    status: l.status,
    note: l.note,
    marked_count: (l.attendance ?? []).length,
  }));
}

/** Every lesson of ONE class, for the admin class page (admin-only). */
export async function listClassLessonsForAdmin(
  classId: string,
): Promise<AdminLesson[]> {
  await requireStaffRole('admin');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('lessons')
    .select('id, date, starts_at, ends_at, status, note, attendance(lesson_id)')
    .eq('class_id', classId)
    .order('date', { ascending: true })
    .order('starts_at', { ascending: true });
  if (error) {
    throw new Error(`Kunne ikke lese timene for klassen: ${error.message}`);
  }
  return (data ?? []).map((l) => ({
    id: l.id,
    date: l.date,
    starts_at: l.starts_at,
    ends_at: l.ends_at,
    status: l.status,
    note: l.note,
    marked_count: (l.attendance ?? []).length,
  }));
}

/** One lesson's admin metadata; null for a malformed / unknown id. */
export async function getLessonMetaForAdmin(
  lessonId: string,
): Promise<AdminLesson | null> {
  await requireStaffRole('admin');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('lessons')
    .select('id, date, starts_at, ends_at, status, note, attendance(lesson_id)')
    .eq('id', lessonId)
    .maybeSingle();
  if (error) {
    if (error.code === '22P02') return null;
    throw new Error(`Kunne ikke lese timen: ${error.message}`);
  }
  if (!data) return null;
  return {
    id: data.id,
    date: data.date,
    starts_at: data.starts_at,
    ends_at: data.ends_at,
    status: data.status,
    note: data.note,
    marked_count: (data.attendance ?? []).length,
  };
}
```

- [ ] **Step 3: Implement `src/lib/dal/attendance.ts`**

```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { requireRole, requireStaffRole } from './session';
import type { LessonStatus } from './lessons';
import type { AttendanceStatus } from '@/lib/validation/attendance';

export type { AttendanceStatus } from '@/lib/validation/attendance';

const nbCollator = new Intl.Collator('nb');

export type LessonRosterEntry = {
  student_id: string;
  first_name: string;
  last_name: string;
  protected: boolean;
  status: AttendanceStatus | null;
  note: string | null;
  pre_reported: boolean;
};

export type LessonForMarking = {
  lesson: {
    id: string;
    class_id: string;
    class_name: string;
    date: string;
    starts_at: string;
    ends_at: string;
    status: LessonStatus;
  };
  roster: LessonRosterEntry[];
};

export type AttendanceHistoryRow = {
  lesson_id: string;
  date: string;
  class_name: string;
  status: AttendanceStatus;
  note: string | null;
};

export type AbsenceNotice = {
  id: string;
  student_id: string;
  date_from: string;
  date_to: string;
  note: string | null;
  seen_by_teacher: boolean;
};

/**
 * The marking screen for one lesson the caller teaches. Relationship check
 * FIRST (guards a dual-role admin+teacher over-read). Roster = class_students
 * whose interval covers the lesson date (left_on exclusive); a protected
 * leaver's students row is invisible (D3) so the join drops them. Covering
 * absence notices prefill "Forhåndsmeldt fravær" (D5). PURE read (R2): the
 * seen_by_teacher acknowledgment happens on save in markAttendance, not here.
 */
export async function getLessonForMarking(
  lessonId: string,
): Promise<LessonForMarking | null> {
  const { user } = await requireStaffRole('teacher');
  const supabase = await createClient();

  const { data: lesson, error } = await supabase
    .from('lessons')
    .select('id, class_id, date, starts_at, ends_at, status, classes(name)')
    .eq('id', lessonId)
    .maybeSingle();
  if (error) {
    if (error.code === '22P02') return null;
    throw new Error(`Kunne ikke lese timen: ${error.message}`);
  }
  if (!lesson) return null;

  const { data: link, error: linkError } = await supabase
    .from('class_teachers')
    .select('teacher_id')
    .eq('class_id', lesson.class_id)
    .eq('teacher_id', user.id)
    .maybeSingle();
  if (linkError) {
    throw new Error(`Kunne ikke verifisere timetilhørighet: ${linkError.message}`);
  }
  if (!link) return null;

  const { data: rosterRows, error: rosterError } = await supabase
    .from('class_students')
    .select('student_id, students(id, first_name, last_name, protected)')
    .eq('class_id', lesson.class_id)
    .lte('enrolled_on', lesson.date)
    .or(`left_on.is.null,left_on.gt.${lesson.date}`);
  if (rosterError) {
    throw new Error(`Kunne ikke lese klasselisten: ${rosterError.message}`);
  }

  const { data: marks, error: marksError } = await supabase
    .from('attendance')
    .select('student_id, status, note')
    .eq('lesson_id', lesson.id);
  if (marksError) {
    throw new Error(`Kunne ikke lese registrert oppmøte: ${marksError.message}`);
  }
  const markByStudent = new Map(
    (marks ?? []).map((m) => [m.student_id, { status: m.status, note: m.note }]),
  );

  const resolved = (rosterRows ?? []).filter(
    (r): r is typeof r & { students: NonNullable<(typeof r)['students']> } =>
      r.students !== null,
  );

  let preReported = new Set<string>();
  const studentIds = resolved.map((r) => r.student_id);
  if (studentIds.length > 0) {
    // Covering absence notices prefill "Forhåndsmeldt fravær". This is a PURE
    // read (R2): the seen_by_teacher acknowledgment happens on save
    // (markAttendance), not on open, so nothing is written here.
    const { data: notices, error: noticeError } = await supabase
      .from('absence_notices')
      .select('student_id')
      .in('student_id', studentIds)
      .lte('date_from', lesson.date)
      .gte('date_to', lesson.date);
    if (noticeError) {
      throw new Error(`Kunne ikke lese forhåndsmeldt fravær: ${noticeError.message}`);
    }
    preReported = new Set((notices ?? []).map((n) => n.student_id));
  }

  const roster: LessonRosterEntry[] = resolved
    .map((r) => {
      const mark = markByStudent.get(r.student_id);
      return {
        student_id: r.students.id,
        first_name: r.students.first_name,
        last_name: r.students.last_name,
        protected: r.students.protected,
        status: mark?.status ?? null,
        note: mark?.note ?? null,
        pre_reported: preReported.has(r.student_id),
      };
    })
    .sort(
      (a, b) =>
        nbCollator.compare(a.last_name, b.last_name) ||
        nbCollator.compare(a.first_name, b.first_name),
    );

  return {
    lesson: {
      id: lesson.id,
      class_id: lesson.class_id,
      class_name: lesson.classes?.name ?? '',
      date: lesson.date,
      starts_at: lesson.starts_at,
      ends_at: lesson.ends_at,
      status: lesson.status,
    },
    roster,
  };
}

/** A guardian's own child's attendance; null if not their child. */
export async function getChildAttendanceHistory(
  studentId: string,
): Promise<AttendanceHistoryRow[] | null> {
  const { user } = await requireRole('parent');
  const supabase = await createClient();
  const { data: link, error: linkError } = await supabase
    .from('guardian_student')
    .select('student_id')
    .eq('guardian_id', user.id)
    .eq('student_id', studentId)
    .maybeSingle();
  if (linkError) {
    if (linkError.code === '22P02') return null;
    throw new Error(`Kunne ikke verifisere foreldreansvar: ${linkError.message}`);
  }
  if (!link) return null;
  const { data, error } = await supabase
    .from('attendance')
    .select('lesson_id, status, note, lessons(date, classes(name))')
    .eq('student_id', studentId);
  if (error) {
    throw new Error(`Kunne ikke lese oppmøtehistorikk: ${error.message}`);
  }
  return (data ?? [])
    .filter((r) => r.lessons !== null)
    .map((r) => ({
      lesson_id: r.lesson_id,
      date: r.lessons!.date,
      class_name: r.lessons!.classes?.name ?? '',
      status: r.status,
      note: r.note,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** The student login's own attendance. */
export async function getOwnAttendanceHistory(): Promise<AttendanceHistoryRow[]> {
  const { user } = await requireRole('student');
  const supabase = await createClient();
  const { data: me, error: meError } = await supabase
    .from('students')
    .select('id')
    .eq('student_user_id', user.id)
    .maybeSingle();
  if (meError) {
    throw new Error(`Kunne ikke lese egen elevinformasjon: ${meError.message}`);
  }
  if (!me) return [];
  const { data, error } = await supabase
    .from('attendance')
    .select('lesson_id, status, note, lessons(date, classes(name))')
    .eq('student_id', me.id);
  if (error) {
    throw new Error(`Kunne ikke lese egen oppmøtehistorikk: ${error.message}`);
  }
  return (data ?? [])
    .filter((r) => r.lessons !== null)
    .map((r) => ({
      lesson_id: r.lesson_id,
      date: r.lessons!.date,
      class_name: r.lessons!.classes?.name ?? '',
      status: r.status,
      note: r.note,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Any student's attendance, for the admin student page. */
export async function getStudentAttendanceForAdmin(
  studentId: string,
): Promise<AttendanceHistoryRow[]> {
  await requireStaffRole('admin');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('attendance')
    .select('lesson_id, status, note, lessons(date, classes(name))')
    .eq('student_id', studentId);
  if (error) {
    if (error.code === '22P02') return [];
    throw new Error(`Kunne ikke lese oppmøtehistorikk: ${error.message}`);
  }
  return (data ?? [])
    .filter((r) => r.lessons !== null)
    .map((r) => ({
      lesson_id: r.lesson_id,
      date: r.lessons!.date,
      class_name: r.lessons!.classes?.name ?? '',
      status: r.status,
      note: r.note,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** A guardian's own child's absence notices; null if not their child. */
export async function listAbsenceNoticesForChild(
  studentId: string,
): Promise<AbsenceNotice[] | null> {
  const { user } = await requireRole('parent');
  const supabase = await createClient();
  const { data: link, error: linkError } = await supabase
    .from('guardian_student')
    .select('student_id')
    .eq('guardian_id', user.id)
    .eq('student_id', studentId)
    .maybeSingle();
  if (linkError) {
    if (linkError.code === '22P02') return null;
    throw new Error(`Kunne ikke verifisere foreldreansvar: ${linkError.message}`);
  }
  if (!link) return null;
  const { data, error } = await supabase
    .from('absence_notices')
    .select('id, student_id, date_from, date_to, note, seen_by_teacher')
    .eq('student_id', studentId)
    .order('date_from', { ascending: false });
  if (error) {
    throw new Error(`Kunne ikke lese fraværsmeldinger: ${error.message}`);
  }
  return data ?? [];
}
```

Run: `cd /Users/daodilyas/dev/iqra-portal && npm run test:api -- tests/api/attendance-core.test.ts`
**Expected: PASS** — every scoping, interval-roster, prefill/seen, history, and economy-denial case green.

- [ ] **Step 4: Typecheck, lint, commit**

Run: `cd /Users/daodilyas/dev/iqra-portal && npm run typecheck && npm run lint`
**Expected: PASS**

Run:
```
cd /Users/daodilyas/dev/iqra-portal && git add src/lib/dal/lessons.ts src/lib/dal/attendance.ts tests/api/attendance-core.test.ts && git commit -m "feat: attendance DAL reads (today, roster, history) with wall-1 scoping"
```

---

### Task 8: Admin lesson actions (generate, cancel, edit) + `tests/api/attendance-actions.test.ts`

Admin-only writes: `generateLessons` on the term page and `cancelLesson`/`editLesson` on the class page. All follow the house action shape — `requireStaffRole('admin')` first, Zod-validated, Norwegian error mapping, `revalidatePath`, house `FormState`. **These `[id]/actions.ts` files do not exist yet** (only top-level `admin/terminer/actions.ts` and `admin/klasser/actions.ts` and the `[id]/page.tsx` files do), so this task **creates** them at the contract's exact paths. Task 8 also **creates** the shared `tests/api/attendance-actions.test.ts`; Task 9 extends it.

**Files:**
- Create: `src/app/(portal)/admin/terminer/[id]/actions.ts`
- Create: `src/app/(portal)/admin/klasser/[id]/actions.ts`
- Create: `tests/api/attendance-actions.test.ts`

- [ ] **Step 1: Write the failing admin-action API tests**

Create `tests/api/attendance-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Repeated per-file mock preamble (ledger #14). next/cache is mocked because
// these actions call revalidatePath.
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

import { generateLessons } from '@/app/(portal)/admin/terminer/[id]/actions';
import { cancelLesson, editLesson } from '@/app/(portal)/admin/klasser/[id]/actions';
import { getLessonMetaForAdmin } from '@/lib/dal/lessons';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getPublicEnv } from '@/lib/env';
import { createServerClientMock, signInAs, signInAsAAL2, signOut } from './harness';

const HOST_2026 = 'f1000000-0000-0000-0000-000000000001';
const K1 = 'fc000000-0000-0000-0000-000000000001';
const L_TODAY = 'f6000000-0000-0000-0000-000000000002';

function form(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) fd.append(key, v);
  }
  return fd;
}

// Service role: only tears down scratch `lessons` rows (see attendance-core).
function serviceClient() {
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

describe('actions: generateLessons (admin-only, idempotent)', () => {
  it('turns a parent away and sends an AAL1 admin to MFA before doing anything', async () => {
    signInAs('forelder@test.local');
    await expect(
      generateLessons(HOST_2026, { error: null }, form({})),
    ).rejects.toThrow('NEXT_REDIRECT:/ingen-tilgang');
    signInAs('admin@test.local');
    await expect(
      generateLessons(HOST_2026, { error: null }, form({})),
    ).rejects.toThrow('NEXT_REDIRECT:/mfa/registrer');
  });

  it('rejects a malformed term id at the validation layer', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(
      generateLessons('ikke-en-uuid', { error: null }, form({})),
    ).resolves.toEqual({ error: 'Ugyldig termin.' });
  });

  it('is idempotent: a second run creates nothing and skips all of the first run', async () => {
    await signInAsAAL2('admin@test.local');
    const first = await generateLessons(HOST_2026, { error: null }, form({}));
    expect(first.success).toBe(true);
    const second = await generateLessons(HOST_2026, { error: null }, form({}));
    expect(second.created).toBe(0);
    expect(second.skipped).toBe((first.created ?? 0) + (first.skipped ?? 0));
  }, 30000);
});

describe('actions: cancelLesson / editLesson (admin-only)', () => {
  it('turns a teacher and a parent away (bound action)', async () => {
    await signInAsAAL2('laerer@test.local');
    await expect(
      cancelLesson(L_TODAY, { error: null }, form({})),
    ).rejects.toThrow('NEXT_REDIRECT:/ingen-tilgang');
    signInAs('forelder@test.local');
    await expect(
      editLesson(L_TODAY, { error: null }, form({ status: 'scheduled' })),
    ).rejects.toThrow('NEXT_REDIRECT:/ingen-tilgang');
  });

  it('cancels then edits a scratch lesson', async () => {
    const service = serviceClient();
    let lessonId = '';
    try {
      await signInAsAAL2('admin@test.local');
      const admin = await createServerClientMock();
      const { data: lesson } = await admin
        .from('lessons')
        .insert({ class_id: K1, date: '2026-09-05', starts_at: '09:00', ends_at: '12:00' })
        .select('id')
        .single();
      lessonId = lesson!.id;

      await expect(
        cancelLesson(lessonId, { error: null }, form({ note: 'Eid' })),
      ).resolves.toEqual({ error: null, success: true });
      expect((await getLessonMetaForAdmin(lessonId))!.status).toBe('cancelled');

      await expect(
        editLesson(
          lessonId,
          { error: null },
          form({ status: 'scheduled', note: 'Flyttet', starts_at: '08:00', ends_at: '10:00' }),
        ),
      ).resolves.toEqual({ error: null, success: true });
      const edited = await getLessonMetaForAdmin(lessonId);
      expect(edited).toMatchObject({
        status: 'scheduled',
        starts_at: '08:00:00',
        ends_at: '10:00:00',
        note: 'Flyttet',
      });

      await expect(
        editLesson(
          lessonId,
          { error: null },
          form({ status: 'scheduled', starts_at: '13:00', ends_at: '10:00' }),
        ),
      ).resolves.toEqual({ error: 'Sluttid må være etter starttid.' });
    } finally {
      if (lessonId) await service.from('lessons').delete().eq('id', lessonId);
    }
  }, 30000);

  it('maps a malformed and a missing lesson id', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(
      cancelLesson('ikke-en-uuid', { error: null }, form({})),
    ).resolves.toEqual({ error: 'Ugyldig time.' });
    await expect(
      cancelLesson('f6000000-0000-0000-0000-0000000000ff', { error: null }, form({})),
    ).resolves.toEqual({ error: 'Timen finnes ikke lenger.' });
  });
});
```

Run: `cd /Users/daodilyas/dev/iqra-portal && npm run test:api -- tests/api/attendance-actions.test.ts`
**Expected: FAIL** — the two `[id]/actions.ts` modules do not exist yet (unresolved imports).

- [ ] **Step 2: Implement `src/app/(portal)/admin/terminer/[id]/actions.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { requireStaffRole } from '@/lib/dal/session';
import { generateLessonsForTerm } from '@/lib/dal/lessons';
import { uuidField, type FormState } from '@/lib/validation/school';

export interface GenerateLessonsState extends FormState {
  created?: number;
  skipped?: number;
}

/** Materialize the term's lessons from every class's schedule (D1). Bound to
 *  the term id in the page: generateLessons.bind(null, termId). */
export async function generateLessons(
  termId: string,
  _prev: GenerateLessonsState,
  _formData: FormData,
): Promise<GenerateLessonsState> {
  await requireStaffRole('admin');
  const id = uuidField.safeParse(termId);
  if (!id.success) return { error: 'Ugyldig termin.' };
  const { created, skipped } = await generateLessonsForTerm(id.data);
  revalidatePath(`/admin/terminer/${id.data}`);
  revalidatePath('/admin');
  return { error: null, success: true, created, skipped };
}
```

- [ ] **Step 3: Implement `src/app/(portal)/admin/klasser/[id]/actions.ts`**

```ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireStaffRole } from '@/lib/dal/session';
import { createClient } from '@/lib/supabase/server';
import { lessonEditSchema, type LessonStatus } from '@/lib/validation/attendance';
import { firstIssue, uuidField, type FormState } from '@/lib/validation/school';

const cancelNoteField = z
  .string()
  .trim()
  .max(500, 'Maks 500 tegn.')
  .nullish()
  .transform((value) => (value == null || value === '' ? null : value));

/** Cancel one lesson (admin-only, D6). Bound: cancelLesson.bind(null, lessonId). */
export async function cancelLesson(
  lessonId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaffRole('admin');
  const id = uuidField.safeParse(lessonId);
  if (!id.success) return { error: 'Ugyldig time.' };
  const note = cancelNoteField.safeParse(formData.get('note') ?? undefined);
  if (!note.success) return { error: firstIssue(note.error) };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('lessons')
    .update({ status: 'cancelled', note: note.data })
    .eq('id', id.data)
    .select('id, class_id');
  if (error) {
    throw new Error(`Kunne ikke avlyse timen: ${error.message}`);
  }
  if (!data || data.length === 0) {
    return { error: 'Timen finnes ikke lenger.' };
  }
  revalidatePath(`/admin/klasser/${data[0].class_id}`);
  return { error: null, success: true };
}

/** Edit one lesson's status / note / time (admin-only, D6). */
export async function editLesson(
  lessonId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaffRole('admin');
  const id = uuidField.safeParse(lessonId);
  if (!id.success) return { error: 'Ugyldig time.' };
  const parsed = lessonEditSchema.safeParse({
    status: formData.get('status'),
    note: formData.get('note') ?? undefined,
    starts_at: formData.get('starts_at') || undefined,
    ends_at: formData.get('ends_at') || undefined,
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const update: {
    status: LessonStatus;
    note: string | null;
    starts_at?: string;
    ends_at?: string;
  } = { status: parsed.data.status, note: parsed.data.note };
  if (parsed.data.starts_at && parsed.data.ends_at) {
    update.starts_at = parsed.data.starts_at;
    update.ends_at = parsed.data.ends_at;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('lessons')
    .update(update)
    .eq('id', id.data)
    .select('id, class_id');
  if (error) {
    if (error.code === '23514') {
      return { error: 'Sluttid må være etter starttid.' };
    }
    throw new Error(`Kunne ikke oppdatere timen: ${error.message}`);
  }
  if (!data || data.length === 0) {
    return { error: 'Timen finnes ikke lenger.' };
  }
  revalidatePath(`/admin/klasser/${data[0].class_id}`);
  return { error: null, success: true };
}
```

Run: `cd /Users/daodilyas/dev/iqra-portal && npm run test:api -- tests/api/attendance-actions.test.ts`
**Expected: PASS** — guard order, idempotent generate, cancel/edit round-trip, reversed-time and stale-id mapping all green.

- [ ] **Step 4: Typecheck, lint, commit**

Run: `cd /Users/daodilyas/dev/iqra-portal && npm run typecheck && npm run lint`
**Expected: PASS**

Run:
```
cd /Users/daodilyas/dev/iqra-portal && git add "src/app/(portal)/admin/terminer/[id]/actions.ts" "src/app/(portal)/admin/klasser/[id]/actions.ts" tests/api/attendance-actions.test.ts && git commit -m "feat: admin lesson generation and cancel/edit actions"
```

---

### Task 9: Teacher marking + parent absence-notice actions (extend `tests/api/attendance-actions.test.ts`)

The two write paths that run through the caller's OWN RLS-gated session (no service-role in the attendance write path). `markAttendance` asserts `teaches_lesson` via a DAL guard, then upserts one `attendance` row per submitted student `on conflict (lesson_id, student_id) do update`. `fileAbsenceNotice`/`deleteAbsenceNotice` scope to `is_guardian_of(student_id)` (insert) and author/admin (delete) — RLS is the wall, the actions map its refusals to Norwegian. A small `requireTeacherOfLesson` guard is added to `dal/lessons.ts`.

**Files:**
- Modify: `src/lib/dal/lessons.ts` (add `requireTeacherOfLesson`)
- Create: `src/app/(portal)/laerer/timer/[lessonId]/actions.ts`
- Create: `src/app/(portal)/forelder/actions.ts`
- Modify: `tests/api/attendance-actions.test.ts` (extend imports + append describe blocks)

- [ ] **Step 1: Write the failing teacher/parent action tests**

Add these imports to the existing import group at the top of `tests/api/attendance-actions.test.ts`:

```ts
import { markAttendance } from '@/app/(portal)/laerer/timer/[lessonId]/actions';
import { deleteAbsenceNotice, fileAbsenceNotice } from '@/app/(portal)/forelder/actions';
import { getLessonForMarking, listAbsenceNoticesForChild } from '@/lib/dal/attendance';
```

Add these constants beside the existing ones:

```ts
const K3 = 'fc000000-0000-0000-0000-000000000002';
const FORELDER2_ID = '77777777-7777-7777-7777-777777777777';
const YUSUF = 'fe000000-0000-0000-0000-000000000001';
const BILAL = 'fe000000-0000-0000-0000-000000000003';
const ZAYNAB = 'fe000000-0000-0000-0000-000000000004';
```

Append these describe blocks to the end of the file:

```ts
describe('actions: markAttendance (teacher of the lesson only)', () => {
  it('denies a forged, malformed, or foreign-class lesson', async () => {
    const service = serviceClient();
    let k3LessonId = '';
    try {
      await signInAsAAL2('admin@test.local');
      const admin = await createServerClientMock();
      const { data: lesson } = await admin
        .from('lessons')
        .insert({ class_id: K3, date: '2026-09-06', starts_at: '09:00', ends_at: '10:00' })
        .select('id')
        .single();
      k3LessonId = lesson!.id;

      await signInAsAAL2('laerer@test.local'); // teaches K1, not K3
      const marks = JSON.stringify([{ student_id: YUSUF, status: 'present' }]);
      await expect(
        markAttendance(k3LessonId, { error: null }, form({ marks })),
      ).resolves.toEqual({ error: 'Du underviser ikke denne timen.' });
      await expect(
        markAttendance('f6000000-0000-0000-0000-0000000000ff', { error: null }, form({ marks })),
      ).resolves.toEqual({ error: 'Du underviser ikke denne timen.' });
      await expect(
        markAttendance('ikke-en-uuid', { error: null }, form({ marks })),
      ).resolves.toEqual({ error: 'Du underviser ikke denne timen.' });
    } finally {
      if (k3LessonId) await service.from('lessons').delete().eq('id', k3LessonId);
    }
  }, 30000);

  it('marks then corrects attendance on the teacher’s own lesson (upsert)', async () => {
    const service = serviceClient();
    let lessonId = '';
    try {
      await signInAsAAL2('admin@test.local');
      const admin = await createServerClientMock();
      const { data: lesson } = await admin
        .from('lessons')
        .insert({ class_id: K1, date: '2026-09-05', starts_at: '09:00', ends_at: '12:00' })
        .select('id')
        .single();
      lessonId = lesson!.id;

      await signInAsAAL2('laerer@test.local');
      await expect(
        markAttendance(
          lessonId,
          { error: null },
          form({
            marks: JSON.stringify([
              { student_id: YUSUF, status: 'present' },
              { student_id: BILAL, status: 'late', note: 'Kom 10 min for sent' },
            ]),
          }),
        ),
      ).resolves.toEqual({ error: null, success: true });

      let marking = await getLessonForMarking(lessonId);
      expect(marking!.roster.find((r) => r.student_id === YUSUF)!.status).toBe('present');
      const bilal = marking!.roster.find((r) => r.student_id === BILAL)!;
      expect(bilal.status).toBe('late');
      expect(bilal.note).toBe('Kom 10 min for sent');

      // On-conflict-do-update: a re-submission corrects the existing row.
      await expect(
        markAttendance(
          lessonId,
          { error: null },
          form({ marks: JSON.stringify([{ student_id: YUSUF, status: 'absent' }]) }),
        ),
      ).resolves.toEqual({ error: null, success: true });
      marking = await getLessonForMarking(lessonId);
      expect(marking!.roster.find((r) => r.student_id === YUSUF)!.status).toBe('absent');

      await expect(
        markAttendance(lessonId, { error: null }, form({ marks: '[]' })),
      ).resolves.toEqual({ error: 'Ingen elever å registrere.' });
    } finally {
      if (lessonId) await service.from('lessons').delete().eq('id', lessonId); // cascades attendance
    }
  }, 45000);

  it('sends an AAL1 teacher to MFA and turns a parent away', async () => {
    signInAs('laerer@test.local');
    await expect(
      markAttendance(L_TODAY, { error: null }, form({ marks: '[]' })),
    ).rejects.toThrow('NEXT_REDIRECT:/mfa/registrer');
    signInAs('forelder@test.local');
    await expect(
      markAttendance(L_TODAY, { error: null }, form({ marks: '[]' })),
    ).rejects.toThrow('NEXT_REDIRECT:/ingen-tilgang');
  });

  it('flips a covering pre-report on save (R2); a foreign-class teacher cannot', async () => {
    // N_FUTURE (f7…01): forelder@ reported Yusuf absent on 2026-09-05,
    // seen_by_teacher seeds false. The flip is on SAVE, so marking a Klasse-1
    // lesson that covers the date acknowledges it. A scratch 08:00 lesson avoids
    // the unique (class_id, date, starts_at) clash with the generated slot.
    const N_FUTURE = 'f7000000-0000-0000-0000-000000000001';
    const service = serviceClient();
    let lessonId = '';
    try {
      await signInAsAAL2('admin@test.local');
      const admin = await createServerClientMock();
      const { data: lesson } = await admin
        .from('lessons')
        .insert({ class_id: K1, date: '2026-09-05', starts_at: '08:00', ends_at: '09:00' })
        .select('id')
        .single();
      lessonId = lesson!.id;
      const marks = JSON.stringify([{ student_id: YUSUF, status: 'excused' }]);

      // laererforelder@ teaches K3, not this Klasse-1 lesson: the guard denies
      // the mark, so the flag stays false.
      await signInAsAAL2('laererforelder@test.local');
      await expect(
        markAttendance(lessonId, { error: null }, form({ marks })),
      ).resolves.toEqual({ error: 'Du underviser ikke denne timen.' });
      const { data: stillUnseen } = await service
        .from('absence_notices')
        .select('seen_by_teacher')
        .eq('id', N_FUTURE)
        .single();
      expect(stillUnseen!.seen_by_teacher).toBe(false);

      // The Klasse-1 teacher marks it -> the covering notice is acknowledged.
      await signInAsAAL2('laerer@test.local');
      await expect(
        markAttendance(lessonId, { error: null }, form({ marks })),
      ).resolves.toEqual({ error: null, success: true });
      const { data: seen } = await service
        .from('absence_notices')
        .select('seen_by_teacher')
        .eq('id', N_FUTURE)
        .single();
      expect(seen!.seen_by_teacher).toBe(true);
    } finally {
      await service.from('absence_notices').update({ seen_by_teacher: false }).eq('id', N_FUTURE);
      if (lessonId) await service.from('lessons').delete().eq('id', lessonId);
    }
  }, 45000);
});

describe('actions: fileAbsenceNotice / deleteAbsenceNotice (guardian scope)', () => {
  it('files for own child but not another family’s', async () => {
    let noticeId = '';
    try {
      signInAs('forelder@test.local');
      await expect(
        fileAbsenceNotice(
          { error: null },
          form({ student_id: YUSUF, date_from: '2026-11-01', date_to: '2026-11-03' }),
        ),
      ).resolves.toEqual({ error: null, success: true });
      const notices = await listAbsenceNoticesForChild(YUSUF);
      noticeId = notices!.find((n) => n.date_from === '2026-11-01')!.id;

      await expect(
        fileAbsenceNotice(
          { error: null },
          form({ student_id: ZAYNAB, date_from: '2026-11-01', date_to: '2026-11-03' }),
        ),
      ).resolves.toEqual({ error: 'Du kan bare melde fravær for egne barn.' });
    } finally {
      if (noticeId) {
        signInAs('forelder@test.local');
        await deleteAbsenceNotice(noticeId, { error: null }, form({}));
      }
    }
  }, 30000);

  it('rejects reversed dates and turns a teacher away', async () => {
    signInAs('forelder@test.local');
    await expect(
      fileAbsenceNotice(
        { error: null },
        form({ student_id: YUSUF, date_from: '2026-11-03', date_to: '2026-11-01' }),
      ),
    ).resolves.toEqual({ error: 'Til-dato må være lik eller etter fra-dato.' });
    await signInAsAAL2('laerer@test.local');
    await expect(
      fileAbsenceNotice(
        { error: null },
        form({ student_id: YUSUF, date_from: '2026-11-01', date_to: '2026-11-03' }),
      ),
    ).rejects.toThrow('NEXT_REDIRECT:/ingen-tilgang');
  }, 30000);

  it('scopes delete to the author: another parent cannot delete it', async () => {
    let noticeId = '';
    try {
      signInAs('forelder2@test.local');
      const parent2 = await createServerClientMock();
      const { data: notice } = await parent2
        .from('absence_notices')
        .insert({ student_id: ZAYNAB, date_from: '2026-11-10', date_to: '2026-11-11', created_by: FORELDER2_ID })
        .select('id')
        .single();
      noticeId = notice!.id;

      signInAs('forelder@test.local');
      await expect(
        deleteAbsenceNotice(noticeId, { error: null }, form({})),
      ).resolves.toEqual({ error: 'Fraværsmeldingen finnes ikke lenger, eller tilhører ikke deg.' });
    } finally {
      if (noticeId) {
        signInAs('forelder2@test.local');
        await deleteAbsenceNotice(noticeId, { error: null }, form({}));
      }
    }
  }, 30000);
});
```

Run: `cd /Users/daodilyas/dev/iqra-portal && npm run test:api -- tests/api/attendance-actions.test.ts`
**Expected: FAIL** — `@/app/(portal)/laerer/timer/[lessonId]/actions` and `@/app/(portal)/forelder/actions` do not exist yet.

- [ ] **Step 2: Add the `requireTeacherOfLesson` guard to `src/lib/dal/lessons.ts`**

Append to `src/lib/dal/lessons.ts`:

```ts
/**
 * DAL guard for the marking write path: gates teacher role + AAL2, then
 * confirms the caller teaches the lesson's class. Returns the caller id + the
 * lesson's class_id, or null for a malformed / unknown / foreign lesson
 * (enumeration-quiet). The role/AAL2 gate throws a redirect, so guard order
 * (role -> AAL2 -> work) is preserved when the action calls this first.
 */
export async function requireTeacherOfLesson(
  lessonId: string,
): Promise<{ userId: string; classId: string } | null> {
  const { user } = await requireStaffRole('teacher');
  const supabase = await createClient();
  const { data: lesson, error } = await supabase
    .from('lessons')
    .select('id, class_id')
    .eq('id', lessonId)
    .maybeSingle();
  if (error) {
    if (error.code === '22P02') return null;
    throw new Error(`Kunne ikke lese timen: ${error.message}`);
  }
  if (!lesson) return null;
  const { data: link, error: linkError } = await supabase
    .from('class_teachers')
    .select('teacher_id')
    .eq('class_id', lesson.class_id)
    .eq('teacher_id', user.id)
    .maybeSingle();
  if (linkError) {
    throw new Error(`Kunne ikke verifisere timetilhørighet: ${linkError.message}`);
  }
  if (!link) return null;
  return { userId: user.id, classId: lesson.class_id };
}
```

- [ ] **Step 3: Implement `src/app/(portal)/laerer/timer/[lessonId]/actions.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireTeacherOfLesson } from '@/lib/dal/lessons';
import { attendanceMarksSchema } from '@/lib/validation/attendance';
import { firstIssue, type FormState } from '@/lib/validation/school';

/**
 * Register attendance for one lesson (teacher of the lesson only). The roster
 * is submitted as a JSON `marks` field. Upserts one row per student
 * `on conflict (lesson_id, student_id) do update`, so re-saving corrects. On
 * save it also flips `seen_by_teacher` on any covering absence notice (R2 —
 * acknowledgment moved here from the read). Bound: markAttendance.bind(null, lessonId).
 */
export async function markAttendance(
  lessonId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await requireTeacherOfLesson(lessonId);
  if (!guard) return { error: 'Du underviser ikke denne timen.' };

  const raw = formData.get('marks');
  let payload: unknown;
  try {
    payload = JSON.parse(typeof raw === 'string' ? raw : '[]');
  } catch {
    return { error: 'Ugyldig innsending.' };
  }
  const parsed = attendanceMarksSchema.safeParse(payload);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const recordedAt = new Date().toISOString();
  const { error } = await supabase.from('attendance').upsert(
    parsed.data.map((mark) => ({
      lesson_id: lessonId,
      student_id: mark.student_id,
      status: mark.status,
      note: mark.note ?? null,
      recorded_by: guard.userId,
      recorded_at: recordedAt,
    })),
    { onConflict: 'lesson_id,student_id' },
  );
  if (error) {
    if (error.code === '23503') {
      return { error: 'Timen eller en elev finnes ikke lenger.' };
    }
    throw new Error(`Kunne ikke lagre oppmøte: ${error.message}`);
  }

  // R2: saving the lesson acknowledges any covering pre-report. The Task 3
  // column-scoped update(seen_by_teacher) grant + teacher policy let this run
  // in the caller's own session; .eq('seen_by_teacher', false) keeps it a no-op
  // once already seen. Load the lesson date first to bound the covering range.
  const { data: lessonRow } = await supabase
    .from('lessons')
    .select('date')
    .eq('id', lessonId)
    .single();
  const studentIds = parsed.data.map((mark) => mark.student_id);
  if (lessonRow) {
    await supabase
      .from('absence_notices')
      .update({ seen_by_teacher: true })
      .in('student_id', studentIds)
      .lte('date_from', lessonRow.date)
      .gte('date_to', lessonRow.date)
      .eq('seen_by_teacher', false);
  }

  revalidatePath(`/laerer/timer/${lessonId}`);
  revalidatePath('/laerer');
  return { error: null, success: true };
}
```

- [ ] **Step 4: Implement `src/app/(portal)/forelder/actions.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/dal/session';
import { createClient } from '@/lib/supabase/server';
import { absenceNoticeSchema } from '@/lib/validation/attendance';
import { firstIssue, uuidField, type FormState } from '@/lib/validation/school';

/** File a Meld fravær notice for one of the caller's own children (D5). RLS
 *  with_check (is_guardian_of) is the wall; a foreign child trips 42501. */
export async function fileAbsenceNotice(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireRole('parent');
  const parsed = absenceNoticeSchema.safeParse({
    student_id: formData.get('student_id'),
    date_from: formData.get('date_from'),
    date_to: formData.get('date_to'),
    note: formData.get('note') ?? undefined,
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from('absence_notices').insert({
    student_id: parsed.data.student_id,
    date_from: parsed.data.date_from,
    date_to: parsed.data.date_to,
    note: parsed.data.note,
    created_by: user.id,
  });
  if (error) {
    if (error.code === '42501') {
      return { error: 'Du kan bare melde fravær for egne barn.' };
    }
    if (error.code === '23503') {
      return { error: 'Fant ikke eleven.' };
    }
    if (error.code === '23514') {
      return { error: 'Til-dato må være lik eller etter fra-dato.' };
    }
    throw new Error(`Kunne ikke melde fravær: ${error.message}`);
  }
  revalidatePath('/forelder');
  return { error: null, success: true };
}

/** Retract a notice the caller authored (RLS scopes delete to author/admin).
 *  Bound in the page: deleteAbsenceNotice.bind(null, id). */
export async function deleteAbsenceNotice(
  id: string,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  await requireRole('parent');
  const parsed = uuidField.safeParse(id);
  if (!parsed.success) return { error: 'Ugyldig fraværsmelding.' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('absence_notices')
    .delete()
    .eq('id', parsed.data)
    .select('id');
  if (error) {
    throw new Error(`Kunne ikke slette fraværsmelding: ${error.message}`);
  }
  if (!data || data.length === 0) {
    return { error: 'Fraværsmeldingen finnes ikke lenger, eller tilhører ikke deg.' };
  }
  revalidatePath('/forelder');
  return { error: null, success: true };
}
```

Run: `cd /Users/daodilyas/dev/iqra-portal && npm run test:api -- tests/api/attendance-actions.test.ts`
**Expected: PASS** — teacher marks/corrects only their own lesson, forged/foreign lessons denied, parent files/deletes only for own child, non-guardian and reversed-date cases mapped, plus the Task 8 admin cases still green.

- [ ] **Step 5: Typecheck, lint, commit**

Run: `cd /Users/daodilyas/dev/iqra-portal && npm run typecheck && npm run lint`
**Expected: PASS**

Run:
```
cd /Users/daodilyas/dev/iqra-portal && git add src/lib/dal/lessons.ts "src/app/(portal)/laerer/timer/[lessonId]/actions.ts" "src/app/(portal)/forelder/actions.ts" tests/api/attendance-actions.test.ts && git commit -m "feat: teacher attendance marking and parent absence-notice actions"
```

<!-- PART 3 of the Phase 2 plan: Tasks 10–16 (UI + exit gate). Append after the Task index. -->

### Task 10: Teacher "I dag" landing

The teacher scene (spec §7): a volunteer in a bright Saturday classroom, on a phone. The landing now leads with **today's lessons** (one-tap into marking) and keeps "Mine klasser" reachable below.

**Files:**
- Modify: `src/app/(portal)/laerer/page.tsx`

- [ ] **Step 1: Rewrite the teacher landing**

Replace `src/app/(portal)/laerer/page.tsx` in full:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { listMyTeachingClasses } from '@/lib/dal/classes';
import { listTeacherToday } from '@/lib/dal/lessons';
import { formatDateNb, formatTime, scheduleLabel, todayOsloISO } from '@/lib/dates';

export const metadata: Metadata = { title: 'Lærer' };

export default async function LaererDashboard() {
  const [today, classes] = await Promise.all([
    listTeacherToday(),
    listMyTeachingClasses(),
  ]);
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h1 className="text-2xl font-semibold">I dag</h1>
          <p className="tabular-nums text-ink/60">{formatDateNb(todayOsloISO())}</p>
        </div>
        {today.length === 0 ? (
          <EmptyState
            title="Ingen timer i dag"
            description="Du har ingen timer i dag. Timene dukker opp her på undervisningsdagene — velg en klasse nedenfor for å se og føre alle timene."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {today.map((lesson) => (
              <li key={lesson.id}>
                <Link
                  href={`/laerer/timer/${lesson.id}`}
                  className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-hairline bg-canvas px-4 py-4 transition-colors duration-200 ease-brand hover:bg-surface-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <span className="min-w-24 font-medium tabular-nums">
                    {formatTime(lesson.starts_at)}–{formatTime(lesson.ends_at)}
                  </span>
                  <span className="text-lg font-semibold">{lesson.class_name}</span>
                  {lesson.room ? (
                    <span className="text-sm text-ink/60">{lesson.room}</span>
                  ) : null}
                  <span className="ms-auto">
                    {lesson.status === 'cancelled' ? (
                      <Chip tone="neutral">Avlyst</Chip>
                    ) : lesson.marked_count === 0 ? (
                      <Chip tone="warning">Ikke ført</Chip>
                    ) : lesson.marked_count >= lesson.roster_count ? (
                      <Chip tone="success">Ført</Chip>
                    ) : (
                      <Chip tone="warning">
                        <span className="tabular-nums">
                          {lesson.marked_count}/{lesson.roster_count}
                        </span>{' '}
                        ført
                      </Chip>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Mine klasser</h2>
        {classes.length === 0 ? (
          <EmptyState
            title="Ingen klasser ennå"
            description="Når administrasjonen har satt deg opp som lærer for en klasse, finner du klasselisten her."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {classes.map((cls) => (
              <li key={cls.id}>
                <Link
                  href={`/laerer/klasser/${cls.id}`}
                  className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-hairline bg-canvas px-4 py-4 transition-colors duration-200 ease-brand hover:bg-surface-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <span className="text-lg font-semibold">{cls.name}</span>
                  <span className="text-sm text-ink/60">
                    {cls.schedule
                      .map(scheduleLabel)
                      .concat(cls.room ? [cls.room] : [])
                      .join(' · ')}
                  </span>
                  <span className="ms-auto text-sm tabular-nums text-ink/70">
                    {cls.active_count} elever
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify + commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run lint
rm -rf .next && npm run dev
```

Browser check as `laerer@test.local` (AAL2 — header gotcha 16 for the TOTP code): `/laerer` leads with an **"I dag"** heading + today's Oslo date. On a date outside the Høst 2026 term (e.g. the current 2026-07-19) the teaching empty state «Ingen timer i dag …» shows; "Mine klasser" below still lists Klasse 1 («Lørdag 10:00–13:00 · Rom 2», 2 elever). If a seed lesson happens to fall on the machine's real "today", it appears as a tappable row with an «Ikke ført»/«Ført» chip → confirm it links to `/laerer/timer/<id>`. Resize to 375px: single column, targets ≥44px, visible focus ring on every row.

```bash
cd /Users/daodilyas/dev/iqra-portal
git add 'src/app/(portal)/laerer/page.tsx'
git commit -m "feat: teacher \"i dag\" landing with today's lessons"
```

---

### Task 11: Teacher marking screen + class lesson list

The core loop: tap a lesson → a roster of one-tap status chips → one save. Cancelled lessons render read-only. The class-detail page gains a lesson list (replacing the Phase-1 "kommer i neste fase" placeholder). The tap-to-cycle order is pure logic — unit-tested first (TDD).

**Files:**
- Create: `src/lib/attendance-ui.ts`
- Create: `src/app/(portal)/laerer/timer/[lessonId]/cycle.ts`
- Create: `src/app/(portal)/laerer/timer/[lessonId]/cycle.test.ts`
- Create: `src/app/(portal)/laerer/timer/[lessonId]/MarkAttendance.tsx`
- Create: `src/app/(portal)/laerer/timer/[lessonId]/page.tsx`
- Modify: `src/app/(portal)/laerer/klasser/[id]/page.tsx`

- [ ] **Step 1: The shared status-tone map**

Create `src/lib/attendance-ui.ts` (pure, client-safe; keeps Task 6's validation module limited to its contracted exports). `AttendanceStatus`/`ChipTone` are type-only imports — erased at build, so the `server-only` DAL never reaches the client bundle (same pattern as `import type { AdminStudentDetail }` in `StudentForms.tsx`):

```ts
import type { ChipTone } from '@/components/ui/Chip';
import type { AttendanceStatus } from '@/lib/dal/attendance';

/** Chip tone per attendance status (design §6 colour semantics). */
export const attendanceStatusTones: Record<AttendanceStatus, ChipTone> = {
  present: 'success',
  absent: 'danger',
  late: 'warning',
  excused: 'neutral',
};
```

- [ ] **Step 2: Failing unit test for the tap-to-cycle order (TDD)**

Create `src/app/(portal)/laerer/timer/[lessonId]/cycle.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { nextStatus, STATUS_CYCLE } from './cycle';

describe('nextStatus (tap-to-cycle marking)', () => {
  it('cycles present -> absent -> late -> excused -> present', () => {
    expect(nextStatus('present')).toBe('absent');
    expect(nextStatus('absent')).toBe('late');
    expect(nextStatus('late')).toBe('excused');
    expect(nextStatus('excused')).toBe('present');
  });

  it('visits every status exactly once before wrapping to the start', () => {
    const seen = new Set<string>();
    let status = STATUS_CYCLE[0];
    for (let i = 0; i < STATUS_CYCLE.length; i += 1) {
      seen.add(status);
      status = nextStatus(status);
    }
    expect(status).toBe(STATUS_CYCLE[0]);
    expect(seen).toEqual(new Set(STATUS_CYCLE));
  });
});
```

Run it — it MUST fail (module missing) before Step 3:

```bash
cd /Users/daodilyas/dev/iqra-portal
npm test -- --run cycle 2>&1 | tail -6   # positional arg filters test files by name
```

- [ ] **Step 3: The cycle logic**

Create `src/app/(portal)/laerer/timer/[lessonId]/cycle.ts`:

```ts
import type { AttendanceStatus } from '@/lib/dal/attendance';

/** Tap-to-cycle order for the marking chips (design §6). */
export const STATUS_CYCLE: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];

/** Next status when a marking chip is tapped; wraps excused -> present. */
export function nextStatus(current: AttendanceStatus): AttendanceStatus {
  const index = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(index + 1) % STATUS_CYCLE.length];
}
```

Re-run the test from Step 2 — it MUST pass now.

- [ ] **Step 4: The marking client component**

Create `src/app/(portal)/laerer/timer/[lessonId]/MarkAttendance.tsx`. Every field is CONTROLLED (survives React 19's post-action reset — the Phase-1 `GuardianCard`/`StudentForms` lesson); the roster's chosen statuses are serialised into one hidden `marks` field as JSON so a variable-length roster round-trips through `FormData` in a single, order-stable payload:

```tsx
'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { attendanceStatusTones } from '@/lib/attendance-ui';
import type { AttendanceStatus, LessonForMarking } from '@/lib/dal/attendance';
import { formatDateNb, formatTime } from '@/lib/dates';
import { attendanceStatusLabels } from '@/lib/validation/attendance';
import { idleForm } from '@/lib/validation/school';
import { markAttendance } from './actions';
import { nextStatus } from './cycle';

interface Mark {
  status: AttendanceStatus;
  note: string;
}

const noteClasses =
  'min-h-11 w-full rounded-md border border-border-input bg-canvas px-4 text-base text-ink ' +
  'placeholder:text-ink/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export function MarkAttendance({
  lesson,
  roster,
}: {
  lesson: LessonForMarking['lesson'];
  roster: LessonForMarking['roster'];
}) {
  // Local truth per student: null (never marked) defaults to the save default
  // 'present' (D5 — teacher taps only the exceptions); pre-reported rows arrive
  // prefilled to 'excused' with the "Forhåndsmeldt fravær" flag.
  const [marks, setMarks] = useState<Record<string, Mark>>(() =>
    Object.fromEntries(
      roster.map((entry) => [
        entry.student_id,
        { status: entry.status ?? 'present', note: entry.note ?? '' },
      ]),
    ),
  );
  const [openNotes, setOpenNotes] = useState<Set<string>>(
    () => new Set(roster.filter((entry) => entry.note).map((entry) => entry.student_id)),
  );
  const [state, formAction, pending] = useActionState(
    markAttendance.bind(null, lesson.id),
    idleForm,
  );
  const error = state.error;
  const saved = state.success ?? false;
  const cancelled = lesson.status === 'cancelled';

  function cycle(studentId: string) {
    setMarks((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], status: nextStatus(prev[studentId].status) },
    }));
  }
  function setNote(studentId: string, note: string) {
    setMarks((prev) => ({ ...prev, [studentId]: { ...prev[studentId], note } }));
  }
  function toggleNote(studentId: string) {
    setOpenNotes((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  const payload = JSON.stringify(
    roster.map((entry) => {
      const mark = marks[entry.student_id];
      const note = mark.note.trim();
      return {
        student_id: entry.student_id,
        status: mark.status,
        ...(note ? { note } : {}),
      };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{lesson.class_name}</h1>
        <p className="tabular-nums text-ink/60">
          {formatDateNb(lesson.date)} · {formatTime(lesson.starts_at)}–
          {formatTime(lesson.ends_at)}
        </p>
      </div>

      {cancelled ? (
        <p className="rounded-lg border border-hairline bg-surface-tint/60 px-4 py-3 text-sm leading-relaxed text-ink/70">
          Timen er avlyst — oppmøte kan ikke føres. Ta kontakt med administrasjonen
          hvis dette er feil.
        </p>
      ) : null}

      {roster.length === 0 ? (
        <p className="text-sm text-ink/60">
          Ingen elever var meldt inn i klassen på denne datoen.
        </p>
      ) : cancelled ? (
        <ul className="divide-y divide-hairline rounded-lg border border-hairline">
          {roster.map((entry) => (
            <li
              key={entry.student_id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
            >
              <span className="font-medium">
                {entry.first_name} {entry.last_name}
              </span>
              {entry.status ? (
                <Chip tone={attendanceStatusTones[entry.status]}>
                  {attendanceStatusLabels[entry.status]}
                </Chip>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="marks" value={payload} />
          <ul className="divide-y divide-hairline rounded-lg border border-hairline">
            {roster.map((entry) => {
              const mark = marks[entry.student_id];
              const noteOpen = openNotes.has(entry.student_id);
              return (
                <li key={entry.student_id} className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="min-w-40 font-medium">
                      {entry.first_name} {entry.last_name}
                    </span>
                    {entry.pre_reported ? (
                      <Chip tone="neutral">Forhåndsmeldt fravær</Chip>
                    ) : null}
                    <div className="ms-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => cycle(entry.student_id)}
                        aria-label={`Endre oppmøtestatus for ${entry.first_name} ${entry.last_name}. Nå: ${attendanceStatusLabels[mark.status]}`}
                        className="inline-flex min-h-11 items-center rounded-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <Chip tone={attendanceStatusTones[mark.status]}>
                          {attendanceStatusLabels[mark.status]}
                        </Chip>
                      </button>
                      <Button
                        variant="ghost"
                        onClick={() => toggleNote(entry.student_id)}
                        aria-expanded={noteOpen}
                      >
                        Notat
                      </Button>
                    </div>
                  </div>
                  {noteOpen ? (
                    <input
                      type="text"
                      value={mark.note}
                      onChange={(event) => setNote(entry.student_id, event.target.value)}
                      maxLength={500}
                      placeholder="Notat (valgfritt)"
                      aria-label={`Notat for ${entry.first_name} ${entry.last_name}`}
                      className={noteClasses}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
          {error ? (
            <p role="alert" className="text-sm text-danger-ink">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p role="status" className="text-sm text-success-ink">
              Oppmøtet er lagret.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={pending}>
              Lagre oppmøte
            </Button>
            <span className="text-sm text-ink/60">
              Trykk statusen for å endre: Til stede → Fravær → For sent → Gyldig fravær.
            </span>
          </div>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 5: The marking page (server)**

Create `src/app/(portal)/laerer/timer/[lessonId]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLessonForMarking } from '@/lib/dal/attendance';
import { MarkAttendance } from './MarkAttendance';

export const metadata: Metadata = { title: 'Oppmøte' };

/**
 * getLessonForMarking answers null for lessons the caller does not teach and
 * for non-existent ids alike (enumeration-quiet) — either way a plain 404.
 */
export default async function MarkLessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const data = await getLessonForMarking(lessonId);
  if (!data) notFound();
  return <MarkAttendance lesson={data.lesson} roster={data.roster} />;
}
```

- [ ] **Step 6: Replace the class-detail placeholder with a lesson list**

Rewrite `src/app/(portal)/laerer/klasser/[id]/page.tsx` in full (the trailing "Oppmøteregistrering kommer i neste fase" paragraph is gone; a "Timer" section links each lesson into the marking screen):

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { listClassLessonsForTeacher } from '@/lib/dal/lessons';
import { getRosterForTeacher } from '@/lib/dal/students';
import { formatDateNb, formatTime } from '@/lib/dates';
import { lessonStatusLabels } from '@/lib/validation/attendance';

export const metadata: Metadata = { title: 'Klasseliste' };

export default async function LaererKlassePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getRosterForTeacher(id);
  if (!result) notFound();
  const lessons = (await listClassLessonsForTeacher(id)) ?? [];
  const ordered = [...lessons].sort(
    (a, b) => b.date.localeCompare(a.date) || b.starts_at.localeCompare(a.starts_at),
  );

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold">{result.class.name}</h1>
        {result.class.room ? <p className="text-ink/60">{result.class.room}</p> : null}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Timer</h2>
        {ordered.length === 0 ? (
          <EmptyState
            title="Ingen timer ennå"
            description="Når administrasjonen har generert timer for terminen, fører du oppmøte herfra."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {ordered.map((lesson) => (
              <li key={lesson.id}>
                <Link
                  href={`/laerer/timer/${lesson.id}`}
                  className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-hairline bg-canvas px-4 py-4 transition-colors duration-200 ease-brand hover:bg-surface-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <span className="min-w-32 font-medium tabular-nums">
                    {formatDateNb(lesson.date)}
                  </span>
                  <span className="text-sm tabular-nums text-ink/70">
                    {formatTime(lesson.starts_at)}–{formatTime(lesson.ends_at)}
                  </span>
                  {lesson.status === 'cancelled' ? (
                    <Chip tone="neutral">{lessonStatusLabels.cancelled}</Chip>
                  ) : lesson.marked_count === 0 ? (
                    <Chip tone="warning">Ikke ført</Chip>
                  ) : (
                    <Chip tone="success">Ført</Chip>
                  )}
                  <span className="ms-auto text-sm tabular-nums text-ink/60">
                    {lesson.marked_count} ført
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          Elever <span className="tabular-nums text-ink/60">({result.roster.length})</span>
        </h2>
        {result.roster.length === 0 ? (
          <EmptyState
            title="Ingen elever i klassen ennå"
            description="Administrasjonen melder inn elever — listen dukker opp her."
          />
        ) : (
          <ul className="divide-y divide-hairline rounded-lg border border-hairline">
            {result.roster.map((student) => (
              <li
                key={student.student_id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
              >
                <span className="font-medium">
                  {student.first_name} {student.last_name}
                </span>
                <span className="text-sm tabular-nums text-ink/60">
                  f. {student.birth_year}
                </span>
                {student.protected ? <Chip tone="warning">Skjermet</Chip> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 7: Verify + commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run lint && npm test -- --run 2>&1 | tail -4
rm -rf .next && npm run dev
```

Browser check as `laerer@test.local` (AAL2): open `/laerer/klasser/<Klasse 1 id>` (reach it from `/laerer` → "Mine klasser" → Klasse 1) — the new "Timer" section lists the seed lessons; **L_PAST** (`f6000000-0000-0000-0000-000000000001`) shows «Ført» with a non-zero count, **L_TODAY** (`f6000000-0000-0000-0000-000000000002`) shows «Ikke ført». Open L_TODAY (`/laerer/timer/f6000000-0000-0000-0000-000000000002`): the roster renders, every student defaults to «Til stede»; tap Yusuf's chip and watch it cycle Fravær → For sent → Gyldig fravær → Til stede; open a note, type a reason; **Lagre oppmøte** → «Oppmøtet er lagret.» Re-open L_PAST — its previously-recorded mix of statuses persists. Open a **future** lesson in Klasse 1 whose date sits inside the seed notice **N_FUTURE** range: the covered child shows «Forhåndsmeldt fravær» prefilled to «Gyldig fravær». Hand-edit the URL to a lesson of a class you don't teach → 404. Keyboard-only: Tab to a status chip, press Enter/Space to cycle; every control has a visible ring; targets ≥44px at 375px.

```bash
cd /Users/daodilyas/dev/iqra-portal
git add src/lib/attendance-ui.ts \
  'src/app/(portal)/laerer/timer/' \
  'src/app/(portal)/laerer/klasser/[id]/page.tsx'
git commit -m "feat: teacher attendance marking screen and class lesson list"
```

---

### Task 12: Parent history + Meld fravær

The parent landing switches from "list of children" to a **child switcher** (searchParams pill, the Phase-1 filter-pill pattern) → the selected child's attendance history, a **Meld fravær** form, and their existing absence notices (retractable). A reusable read-only history list is extracted here (rule-of-three: parent, student, admin).

**Files:**
- Create: `src/components/attendance/AttendanceHistoryList.tsx`
- Create: `src/app/(portal)/forelder/MeldFravaer.tsx`
- Create: `src/app/(portal)/forelder/AbsenceNoticeList.tsx`
- Modify: `src/app/(portal)/forelder/page.tsx`

- [ ] **Step 1: The shared history list (server component)**

Create `src/components/attendance/AttendanceHistoryList.tsx` — a plain server component (renders only the non-empty list; each surface keeps its own teaching empty state):

```tsx
import { Chip } from '@/components/ui/Chip';
import { attendanceStatusTones } from '@/lib/attendance-ui';
import type { AttendanceHistoryRow } from '@/lib/dal/attendance';
import { formatDateNb } from '@/lib/dates';
import { attendanceStatusLabels } from '@/lib/validation/attendance';

/** Read-only attendance table shared by parent, student and admin surfaces. */
export function AttendanceHistoryList({ rows }: { rows: AttendanceHistoryRow[] }) {
  return (
    <ul className="divide-y divide-hairline rounded-lg border border-hairline">
      {rows.map((row) => (
        <li
          key={row.lesson_id}
          className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
        >
          <span className="min-w-32 text-sm tabular-nums text-ink/70">
            {formatDateNb(row.date)}
          </span>
          <span className="font-medium">{row.class_name}</span>
          <Chip tone={attendanceStatusTones[row.status]}>
            {attendanceStatusLabels[row.status]}
          </Chip>
          {row.note ? (
            <span className="w-full text-sm text-ink/60">{row.note}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: The Meld fravær form (client)**

Create `src/app/(portal)/forelder/MeldFravaer.tsx`. Field `name`s are the ENGLISH `absenceNoticeSchema` keys (`student_id`/`date_from`/`date_to`/`note`) so `fileAbsenceNotice` parses them directly; labels stay bokmål. Controlled fields survive React 19's post-action reset, and — since the action does not redirect — clear themselves on success (the `GuardianCard` prev-state pattern):

```tsx
'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { idleForm } from '@/lib/validation/school';
import { fileAbsenceNotice } from './actions';

const textareaClasses =
  'min-h-24 w-full rounded-md border border-border-input bg-canvas px-4 py-3 text-base text-ink ' +
  'placeholder:text-ink/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export function MeldFravaer({ studentId }: { studentId: string }) {
  const [state, formAction, pending] = useActionState(fileAbsenceNotice, idleForm);
  const [fra, setFra] = useState('');
  const [til, setTil] = useState('');
  const [notat, setNotat] = useState('');
  const [prev, setPrev] = useState(state);
  if (prev !== state) {
    setPrev(state);
    if (state.success) {
      setFra('');
      setTil('');
      setNotat('');
    }
  }
  const error = state.error;
  const saved = state.success ?? false;

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="student_id" value={studentId} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Fra dato" htmlFor="fravaer-fra">
          <Input
            id="fravaer-fra"
            name="date_from"
            type="date"
            required
            value={fra}
            onChange={(event) => setFra(event.target.value)}
          />
        </Field>
        <Field label="Til dato" htmlFor="fravaer-til">
          <Input
            id="fravaer-til"
            name="date_to"
            type="date"
            required
            value={til}
            onChange={(event) => setTil(event.target.value)}
          />
        </Field>
      </div>
      <Field label="Melding (valgfritt)" htmlFor="fravaer-notat">
        <textarea
          id="fravaer-notat"
          name="note"
          maxLength={500}
          value={notat}
          onChange={(event) => setNotat(event.target.value)}
          placeholder="F.eks. sykdom eller reise"
          className={textareaClasses}
        />
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-danger-ink">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-success-ink">
          Fraværet er meldt.
        </p>
      ) : null}
      <div>
        <Button type="submit" loading={pending}>
          Meld fravær
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: The notice list with retract (client)**

Create `src/app/(portal)/forelder/AbsenceNoticeList.tsx`. Delete is a two-step confirm (house pattern); `deleteAbsenceNotice` takes the id as its leading bound arg:

```tsx
'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import type { AbsenceNotice } from '@/lib/dal/attendance';
import { formatDateNb } from '@/lib/dates';
import { idleForm } from '@/lib/validation/school';
import { deleteAbsenceNotice } from './actions';

function NoticeRow({ notice }: { notice: AbsenceNotice }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(
    deleteAbsenceNotice.bind(null, notice.id),
    idleForm,
  );
  const error = state.error;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-44">
        <p className="font-medium tabular-nums">
          {formatDateNb(notice.date_from)}
          {notice.date_to !== notice.date_from
            ? ` – ${formatDateNb(notice.date_to)}`
            : ''}
        </p>
        {notice.note ? <p className="text-sm text-ink/60">{notice.note}</p> : null}
      </div>
      {notice.seen_by_teacher ? (
        <Chip tone="success">Sett av lærer</Chip>
      ) : (
        <Chip tone="warning">Ikke sett ennå</Chip>
      )}
      <div className="ms-auto flex items-center gap-2">
        {confirming ? (
          <>
            <form action={formAction}>
              <Button
                type="submit"
                variant="secondary"
                className="text-danger-ink"
                loading={pending}
              >
                Bekreft sletting
              </Button>
            </form>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Avbryt
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={() => setConfirming(true)}>
            Slett
          </Button>
        )}
      </div>
      {error ? (
        <p role="alert" className="w-full text-sm text-danger-ink">
          {error}
        </p>
      ) : null}
    </li>
  );
}

export function AbsenceNoticeList({ notices }: { notices: AbsenceNotice[] }) {
  if (notices.length === 0) {
    return (
      <p className="px-4 py-4 text-sm text-ink/60">Ingen fraværsmeldinger ennå.</p>
    );
  }
  return (
    <ul className="divide-y divide-hairline">
      {notices.map((notice) => (
        <NoticeRow key={notice.id} notice={notice} />
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Rewrite the parent landing**

Rewrite `src/app/(portal)/forelder/page.tsx` in full. Only own children's ids are ever queried (an unknown `?barn=` falls back to the first child), so the `| null` DAL returns never trigger:

```tsx
import type { Metadata } from 'next';
import { AttendanceHistoryList } from '@/components/attendance/AttendanceHistoryList';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { PillLink } from '@/components/ui/PillLink';
import {
  getChildAttendanceHistory,
  listAbsenceNoticesForChild,
} from '@/lib/dal/attendance';
import { listChildrenForGuardian } from '@/lib/dal/students';
import { scheduleLabel } from '@/lib/dates';
import { STATUS_LABELS } from '@/lib/validation/school';
import { AbsenceNoticeList } from './AbsenceNoticeList';
import { MeldFravaer } from './MeldFravaer';

export const metadata: Metadata = { title: 'Forelder' };

export default async function ForelderDashboard({
  searchParams,
}: {
  searchParams: Promise<{ barn?: string }>;
}) {
  const children = await listChildrenForGuardian();
  if (children.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <h1 className="text-2xl font-semibold">Mine barn</h1>
        <EmptyState
          title="Ingen barn registrert ennå"
          description="Når skolen har registrert barna dine, ser du oppmøte og timeplan her. Ta kontakt med administrasjonen hvis noe mangler."
        />
      </div>
    );
  }
  const { barn } = await searchParams;
  const selected = children.find((child) => child.student_id === barn) ?? children[0];
  const [history, notices] = await Promise.all([
    getChildAttendanceHistory(selected.student_id),
    listAbsenceNoticesForChild(selected.student_id),
  ]);
  const rows = history ?? [];
  const noticeRows = notices ?? [];

  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-2xl font-semibold">Mine barn</h1>

      {children.length > 1 ? (
        <nav aria-label="Velg barn">
          <ul className="flex flex-wrap gap-2">
            {children.map((child) => {
              const active = child.student_id === selected.student_id;
              return (
                <li key={child.student_id}>
                  <PillLink
                    href={`/forelder?barn=${child.student_id}`}
                    active={active}
                    aria-current={active ? 'page' : undefined}
                  >
                    {child.first_name}
                  </PillLink>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      <section className="flex flex-col gap-1 rounded-lg border border-hairline bg-canvas px-4 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-lg font-semibold">
            {selected.first_name} {selected.last_name}
          </p>
          {selected.status === 'stopped' ? <Chip>{STATUS_LABELS.stopped}</Chip> : null}
        </div>
        {selected.class_name ? (
          <p className="text-ink/70">
            {selected.class_name}
            {selected.schedule.length > 0
              ? ` · ${selected.schedule.map(scheduleLabel).join(' · ')}`
              : ''}
          </p>
        ) : (
          <p className="text-ink/60">Ikke meldt inn i noen klasse ennå.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Oppmøte</h2>
        {rows.length === 0 ? (
          <EmptyState
            title="Ingen oppmøteføringer ennå"
            description="Når læreren fører oppmøte for timene, ser du historikken her."
          />
        ) : (
          <AttendanceHistoryList rows={rows} />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Meld fravær</h2>
        <p className="text-sm text-ink/60">
          Meld fra om planlagt fravær for {selected.first_name}. Læreren ser meldingen
          når timen åpnes.
        </p>
        <MeldFravaer key={selected.student_id} studentId={selected.student_id} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Mine fraværsmeldinger</h2>
        <div className="rounded-lg border border-hairline">
          <AbsenceNoticeList notices={noticeRows} />
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Verify + commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run lint
rm -rf .next && npm run dev
```

Browser check as `forelder@test.local` (no MFA): `/forelder` shows a child switcher (Yusuf, Amira). Select **Yusuf** (Klasse 1) — "Oppmøte" lists his L_PAST row (date · Klasse 1 · status chip); "Mine fraværsmeldinger" lists the seed **N_FUTURE** with «Ikke sett ennå». File a Meld fravær (Fra/Til dates + a note) → «Fraværet er meldt.», the fields clear, and the new notice appears in the list. Try Til < Fra → inline `role="alert"` error, and the typed dates SURVIVE (controlled). Retract a notice: Slett → Bekreft sletting → it disappears. Switch to **Amira** → her own (likely empty) history + a fresh Meld fravær form. Resize to 375px: two date fields stack, nothing clipped.

```bash
cd /Users/daodilyas/dev/iqra-portal
git add src/components/attendance/AttendanceHistoryList.tsx \
  'src/app/(portal)/forelder/MeldFravaer.tsx' \
  'src/app/(portal)/forelder/AbsenceNoticeList.tsx' \
  'src/app/(portal)/forelder/page.tsx'
git commit -m "feat: parent attendance history and absence reporting"
```

---

### Task 13: Student history + admin student attendance block

Two small read-only surfaces reusing `AttendanceHistoryList` (Task 12): the student sees their own attendance; the admin one-glance student page gains an attendance block.

**Files:**
- Modify: `src/app/(portal)/elev/page.tsx`
- Modify: `src/app/(portal)/admin/elever/[id]/page.tsx`

- [ ] **Step 1: Student own-history**

Rewrite `src/app/(portal)/elev/page.tsx` in full (keeps the identity card; adds "Mitt oppmøte"):

```tsx
import type { Metadata } from 'next';
import { AttendanceHistoryList } from '@/components/attendance/AttendanceHistoryList';
import { EmptyState } from '@/components/ui/EmptyState';
import { getOwnAttendanceHistory } from '@/lib/dal/attendance';
import { getOwnStudentRecord } from '@/lib/dal/students';
import { scheduleLabel } from '@/lib/dates';

export const metadata: Metadata = { title: 'Elev' };

export default async function ElevDashboard() {
  const record = await getOwnStudentRecord();
  if (!record) {
    return (
      <div className="flex flex-col gap-8">
        <h1 className="text-2xl font-semibold">Min side</h1>
        <EmptyState
          title="Kontoen er ikke koblet til en elev ennå"
          description="Administrasjonen kobler kontoen din til elevregisteret — etterpå ser du klassen, timeplanen og oppmøtet ditt her."
        />
      </div>
    );
  }
  const history = await getOwnAttendanceHistory();
  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-2xl font-semibold">Min side</h1>
      <section className="flex flex-col gap-1 rounded-lg border border-hairline bg-canvas px-4 py-4">
        <p className="text-lg font-semibold">
          {record.first_name} {record.last_name}
        </p>
        {record.class_name ? (
          <p className="text-ink/70">
            {record.class_name}
            {record.schedule.length > 0
              ? ` · ${record.schedule.map(scheduleLabel).join(' · ')}`
              : ''}
          </p>
        ) : (
          <p className="text-ink/60">Ikke meldt inn i noen klasse ennå.</p>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Mitt oppmøte</h2>
        {history.length === 0 ? (
          <EmptyState
            title="Ingen oppmøteføringer ennå"
            description="Når læreren fører oppmøte for timene dine, ser du historikken her."
          />
        ) : (
          <AttendanceHistoryList rows={history} />
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Admin student attendance block**

Rewrite `src/app/(portal)/admin/elever/[id]/page.tsx` in full. `getStudentAttendanceForAdmin` is loaded alongside `listClassesForAdmin` (one `Promise.all`); the "Oppmøte" section sits between the relations grid and the note:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AttendanceHistoryList } from '@/components/attendance/AttendanceHistoryList';
import { Chip } from '@/components/ui/Chip';
import { PillLink } from '@/components/ui/PillLink';
import { getStudentAttendanceForAdmin } from '@/lib/dal/attendance';
import { listClassesForAdmin } from '@/lib/dal/classes';
import { getStudentForAdmin } from '@/lib/dal/students';
import { STATUS_LABELS } from '@/lib/validation/school';
import { EnrollCard } from '../EnrollCard';
import { GuardianCard } from '../GuardianCard';
import { LoginCard } from '../LoginCard';
import { DeleteStudentForm } from '../StudentForms';

export const metadata: Metadata = { title: 'Elev' };

export default async function ElevPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const student = await getStudentForAdmin(id);
  if (!student) notFound();
  const [classes, attendance] = await Promise.all([
    listClassesForAdmin(),
    getStudentAttendanceForAdmin(student.student_id),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center gap-3">
        <div className="me-auto">
          <h1 className="text-2xl font-semibold">
            {student.first_name} {student.last_name}
          </h1>
          <p className="text-ink/60">Født {student.birth_year}</p>
        </div>
        {student.protected ? <Chip tone="warning">Skjermet</Chip> : null}
        {student.status === 'stopped' ? <Chip>{STATUS_LABELS.stopped}</Chip> : null}
        <PillLink href={`/admin/elever/${student.student_id}/rediger`}>
          Rediger
        </PillLink>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <GuardianCard elevId={student.student_id} guardians={student.guardians} />
        <div className="flex flex-col gap-10">
          <EnrollCard
            elevId={student.student_id}
            enrollment={student.enrollment}
            classes={classes}
          />
          <LoginCard elevId={student.student_id} hasLogin={student.has_login} />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Oppmøte</h2>
        {attendance.length === 0 ? (
          <p className="text-sm text-ink/60">Ingen oppmøteføringer ennå.</p>
        ) : (
          <AttendanceHistoryList rows={attendance} />
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Notat</h2>
        <p className="max-w-2xl whitespace-pre-line leading-relaxed text-ink/80">
          {student.note ?? 'Ingen notater.'}
        </p>
      </section>

      <section className="border-t border-hairline pt-6">
        <DeleteStudentForm studentId={student.student_id} />
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Verify + commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run lint
rm -rf .next && npm run dev
```

Browser check: as `elev@test.local` (no MFA) `/elev` shows Yusuf's own card and a "Mitt oppmøte" list carrying his L_PAST status (read-only — no controls). As `admin@test.local` (AAL2), open Yusuf from `/admin/elever` → the detail page shows an "Oppmøte" block with the same L_PAST row between the relations grid and the note; a student with no marks (e.g. Idris) shows «Ingen oppmøteføringer ennå». 375px: single column, chips keep AA-contrast `-ink` text.

```bash
cd /Users/daodilyas/dev/iqra-portal
git add 'src/app/(portal)/elev/page.tsx' 'src/app/(portal)/admin/elever/[id]/page.tsx'
git commit -m "feat: student attendance history and admin student attendance block"
```

---

### Task 14: Admin term generation + class lesson management

Admins materialise the term's lessons from the class schedules (idempotent, with a created/skipped confirmation) and manage individual lessons on the class page — cancel (two-step) or edit time/status/note (for Eid, Ramadan, room changes).

**Files:**
- Create: `src/app/(portal)/admin/terminer/[id]/GenerateLessonsForm.tsx`
- Modify: `src/app/(portal)/admin/terminer/[id]/page.tsx`
- Create: `src/app/(portal)/admin/klasser/[id]/LessonManager.tsx`
- Modify: `src/app/(portal)/admin/klasser/[id]/page.tsx`

- [ ] **Step 1: The generate form (client)**

Create `src/app/(portal)/admin/terminer/[id]/GenerateLessonsForm.tsx`. `generateLessons` is bound to the term id and — as the "unless noted" exception to the house `FormState` shape — returns the `{ created, skipped }` counts on success (`GenerateLessonsState extends FormState`):

```tsx
'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { idleForm } from '@/lib/validation/school';
import { generateLessons } from './actions';

export function GenerateLessonsForm({ termId }: { termId: string }) {
  const [state, formAction, pending] = useActionState(
    generateLessons.bind(null, termId),
    idleForm,
  );
  const error = state.error;
  const result = state.success ? state : null;
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div>
        <Button type="submit" loading={pending}>
          Generer timer for terminen
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger-ink">
          {error}
        </p>
      ) : null}
      {result ? (
        <p role="status" className="text-sm text-ink/70">
          Ferdig — <span className="tabular-nums">{result.created}</span> nye timer
          opprettet, <span className="tabular-nums">{result.skipped}</span> fantes fra
          før.
        </p>
      ) : null}
    </form>
  );
}
```

- [ ] **Step 2: Add the generation section to the term edit page**

Rewrite `src/app/(portal)/admin/terminer/[id]/page.tsx` in full (the existing edit form stays; a "Timer" section with the current count + generate form is added):

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listTermLessonsForAdmin } from '@/lib/dal/lessons';
import { listTerms } from '@/lib/dal/terms';
import { TermEditForm } from '../TermForms';
import { GenerateLessonsForm } from './GenerateLessonsForm';

export const metadata: Metadata = { title: 'Rediger termin' };

export default async function RedigerTerminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const term = (await listTerms()).find((t) => t.id === id);
  if (!term) notFound();
  const lessons = await listTermLessonsForAdmin(term.id);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-8">
        <h1 className="text-2xl font-semibold">Rediger {term.name}</h1>
        <TermEditForm term={term} />
      </div>

      <section className="flex flex-col gap-3 border-t border-hairline pt-6">
        <h2 className="text-lg font-semibold">Timer</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-ink/60">
          Genererer én time for hver økt i klassenes timeplan gjennom hele terminen.
          Trygt å kjøre på nytt — timer som allerede finnes, avlyste timer og førte
          timer røres aldri.{' '}
          <span className="tabular-nums">{lessons.length}</span> timer er generert for
          terminen så langt.
        </p>
        <GenerateLessonsForm termId={term.id} />
      </section>
    </div>
  );
}
```

- [ ] **Step 3: The lesson manager (client)**

Create `src/app/(portal)/admin/klasser/[id]/LessonManager.tsx`. Each row owns its own edit action-state so the "close on success" adjustment happens on the same component (React forbids setState across components during render — the `GuardianCard` rule). Cancel is a two-step confirm; the edit form's `name`s are the ENGLISH `lessonEditSchema` keys (`status`/`starts_at`/`ends_at`/`note`):

```tsx
'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import type { AdminLesson, LessonStatus } from '@/lib/dal/lessons';
import { formatDateNb, formatTime } from '@/lib/dates';
import { lessonStatusLabels } from '@/lib/validation/attendance';
import { idleForm } from '@/lib/validation/school';
import { cancelLesson, editLesson } from './actions';

const selectClasses =
  'min-h-11 w-full rounded-md border border-border-input bg-canvas px-4 text-base text-ink ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
const textareaClasses =
  'min-h-20 w-full rounded-md border border-border-input bg-canvas px-4 py-3 text-base text-ink ' +
  'placeholder:text-ink/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

function CancelLessonForm({ lessonId }: { lessonId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(
    cancelLesson.bind(null, lessonId),
    idleForm,
  );
  const error = state.error;
  if (!confirming) {
    return (
      <Button variant="ghost" onClick={() => setConfirming(true)}>
        Avlys
      </Button>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <form action={formAction}>
          <Button
            type="submit"
            variant="secondary"
            className="text-danger-ink"
            loading={pending}
          >
            Bekreft avlysning
          </Button>
        </form>
        <Button variant="ghost" onClick={() => setConfirming(false)}>
          Avbryt
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function LessonRow({ lesson }: { lesson: AdminLesson }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    editLesson.bind(null, lesson.id),
    idleForm,
  );
  const [status, setStatus] = useState<LessonStatus>(lesson.status);
  const [start, setStart] = useState(formatTime(lesson.starts_at));
  const [end, setEnd] = useState(formatTime(lesson.ends_at));
  const [note, setNote] = useState(lesson.note ?? '');
  const [prev, setPrev] = useState(state);
  if (prev !== state) {
    setPrev(state);
    if (state.success) setEditing(false);
  }
  const error = state.error;

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="min-w-32 font-medium tabular-nums">
          {formatDateNb(lesson.date)}
        </span>
        <span className="text-sm tabular-nums text-ink/70">
          {formatTime(lesson.starts_at)}–{formatTime(lesson.ends_at)}
        </span>
        {lesson.status === 'cancelled' ? (
          <Chip tone="neutral">{lessonStatusLabels.cancelled}</Chip>
        ) : (
          <Chip tone="success">{lessonStatusLabels.scheduled}</Chip>
        )}
        <span className="text-sm tabular-nums text-ink/60">
          {lesson.marked_count} ført
        </span>
        <div className="ms-auto flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => setEditing((value) => !value)}
            aria-expanded={editing}
          >
            Rediger
          </Button>
          {lesson.status === 'scheduled' ? (
            <CancelLessonForm lessonId={lesson.id} />
          ) : null}
        </div>
      </div>
      {lesson.note ? <p className="text-sm text-ink/60">{lesson.note}</p> : null}
      {editing ? (
        <form action={formAction} className="flex flex-col gap-3 border-t border-hairline pt-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Status" htmlFor={`status-${lesson.id}`}>
              <select
                id={`status-${lesson.id}`}
                name="status"
                value={status}
                onChange={(event) => setStatus(event.target.value as LessonStatus)}
                className={selectClasses}
              >
                {(Object.entries(lessonStatusLabels) as [LessonStatus, string][]).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Fra" htmlFor={`start-${lesson.id}`}>
              <Input
                id={`start-${lesson.id}`}
                name="starts_at"
                type="time"
                required
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
            </Field>
            <Field label="Til" htmlFor={`end-${lesson.id}`}>
              <Input
                id={`end-${lesson.id}`}
                name="ends_at"
                type="time"
                required
                value={end}
                onChange={(event) => setEnd(event.target.value)}
              />
            </Field>
          </div>
          <Field label="Notat (valgfritt)" htmlFor={`note-${lesson.id}`}>
            <textarea
              id={`note-${lesson.id}`}
              name="note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              placeholder="F.eks. rombytte eller høytid"
              className={textareaClasses}
            />
          </Field>
          {error ? (
            <p role="alert" className="text-sm text-danger-ink">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" loading={pending}>
              Lagre endringer
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Avbryt
            </Button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

export function LessonManager({ lessons }: { lessons: AdminLesson[] }) {
  if (lessons.length === 0) {
    return (
      <p className="text-sm text-ink/60">
        Ingen timer generert for terminen ennå — generer dem fra terminsiden.
      </p>
    );
  }
  const ordered = [...lessons].sort(
    (a, b) => b.date.localeCompare(a.date) || b.starts_at.localeCompare(a.starts_at),
  );
  return (
    <ul className="divide-y divide-hairline rounded-lg border border-hairline">
      {ordered.map((lesson) => (
        <LessonRow key={lesson.id} lesson={lesson} />
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Add the lesson manager to the class page**

Rewrite `src/app/(portal)/admin/klasser/[id]/page.tsx` in full. `listClassLessonsForAdmin(id)` joins the existing `Promise.all`; a "Timer" section renders `LessonManager` between the schedule and the roster:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Chip } from '@/components/ui/Chip';
import { getClassForAdmin } from '@/lib/dal/classes';
import { listClassLessonsForAdmin } from '@/lib/dal/lessons';
import { listStudentsWithoutActiveClass } from '@/lib/dal/students';
import { listSubjects } from '@/lib/dal/subjects';
import { listUsersWithRole } from '@/lib/dal/users';
import { formatDateNb, scheduleLabel } from '@/lib/dates';
import {
  AddSlotForm,
  ClassMetaForm,
  ClassSubjectsForm,
  ClassTeachersForm,
  DeleteClassForm,
  EnrollForm,
  RemoveSlotForm,
  UnenrollForm,
} from '../ClassForms';
import { LessonManager } from './LessonManager';

export const metadata: Metadata = { title: 'Klasse' };

export default async function KlassePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getClassForAdmin(id);
  if (!detail) notFound();
  const [teachers, subjects, candidates, lessons] = await Promise.all([
    listUsersWithRole('teacher'),
    listSubjects(),
    listStudentsWithoutActiveClass(),
    listClassLessonsForAdmin(id),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold">{detail.name}</h1>
        <p className="text-ink/60">
          {detail.term_name}
          {detail.room ? ` · ${detail.room}` : ''}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Detaljer</h2>
        <ClassMetaForm klasseId={detail.id} name={detail.name} room={detail.room} />
      </section>

      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Lærere</h2>
          <ClassTeachersForm
            klasseId={detail.id}
            allTeachers={teachers}
            selectedIds={detail.teachers.map((t) => t.user_id)}
          />
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Fag</h2>
          <ClassSubjectsForm
            klasseId={detail.id}
            allSubjects={subjects}
            selectedIds={detail.subject_ids}
          />
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Timeplan</h2>
        {detail.schedule.length === 0 ? (
          <p className="text-sm text-ink/60">
            Ingen faste økter ennå — legg til den første nedenfor.
          </p>
        ) : (
          <ul className="divide-y divide-hairline rounded-lg border border-hairline">
            {detail.schedule.map((slot) => (
              <li
                key={`${slot.weekday}-${slot.starts_at}`}
                className="flex items-center gap-4 px-4 py-2"
              >
                <span>{scheduleLabel(slot)}</span>
                <div className="ms-auto">
                  <RemoveSlotForm
                    klasseId={detail.id}
                    weekday={slot.weekday}
                    startsAt={slot.starts_at}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        <AddSlotForm klasseId={detail.id} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Timer</h2>
        <p className="text-sm text-ink/60">
          Timer genereres per termin (under Terminer). Her kan du avlyse eller justere
          enkelttimer — for eksempel ved høytider eller rombytte.
        </p>
        <LessonManager lessons={lessons} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          Elever{' '}
          <span className="tabular-nums text-ink/60">
            ({detail.active_roster.length})
          </span>
        </h2>
        {detail.active_roster.length === 0 ? (
          <p className="text-sm text-ink/60">Ingen elever i klassen ennå.</p>
        ) : (
          <ul className="divide-y divide-hairline rounded-lg border border-hairline">
            {detail.active_roster.map((row) => (
              <li
                key={row.student_id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
              >
                <Link
                  href={`/admin/elever/${row.student_id}`}
                  className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {row.first_name} {row.last_name}
                </Link>
                <span className="text-sm tabular-nums text-ink/60">
                  f. {row.birth_year}
                </span>
                {row.protected ? <Chip tone="warning">Skjermet</Chip> : null}
                <div className="ms-auto">
                  <UnenrollForm klasseId={detail.id} elevId={row.student_id} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <EnrollForm klasseId={detail.id} candidates={candidates} />
        {detail.former_roster.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-ink/60">Tidligere elever</h3>
            <ul className="flex flex-col gap-1">
              {detail.former_roster.map((row) => (
                <li key={row.student_id} className="text-sm text-ink/60">
                  {row.first_name} {row.last_name} — sluttet{' '}
                  {formatDateNb(row.left_on ?? row.enrolled_on)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-3 border-t border-hairline pt-6">
        <DeleteClassForm klasseId={detail.id} />
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Verify + commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run lint
rm -rf .next && npm run dev
```

Browser check as `admin@test.local` (AAL2): from `/admin/terminer` → «Rediger» on Høst 2026 → the new "Timer" section shows the generated-count line + **Generer timer for terminen**. Click it — because the seed already generated the term, the confirmation reads «0 nye timer opprettet, N fantes fra før» (idempotency proven). Open `/admin/klasser/<Klasse 1 id>` → the "Timer" manager lists Klasse 1's lessons with «Ført» counts; **Avlys** a scheduled lesson (two-step: Avlys → Bekreft avlysning) → its chip flips to «Avlyst» and the Avlys button disappears; **Rediger** another → change the end time and add a note → «Lagre endringer» closes the editor and the row reflects the new time/note. Return to the term page, regenerate → the cancelled lesson is NOT resurrected (still «Avlyst», skipped). 375px: the 3-column edit grid stacks.

```bash
cd /Users/daodilyas/dev/iqra-portal
git add 'src/app/(portal)/admin/terminer/[id]/GenerateLessonsForm.tsx' \
  'src/app/(portal)/admin/terminer/[id]/page.tsx' \
  'src/app/(portal)/admin/klasser/[id]/LessonManager.tsx' \
  'src/app/(portal)/admin/klasser/[id]/page.tsx'
git commit -m "feat: admin lesson generation and per-lesson management"
```

---

### Task 15: Admin cockpit "I dag / fraværsbilde" widget

A lightweight cockpit strip on `/admin`: today's lessons, unmarked past/today lessons, and unseen absence notices. This task also EXTENDS `dashboard.ts` with the contract's `getCockpitToday`. The widget matches the overview's figure treatment but is one distinct panel (not an identical-card grid — design ban).

**Files:**
- Modify: `src/lib/dal/dashboard.ts`
- Modify: `tests/api/attendance-core.test.ts`
- Modify: `src/app/(portal)/admin/page.tsx`

- [ ] **Step 1: Failing wall-1 test for the cockpit read**

Append to `tests/api/attendance-core.test.ts` (the Task-7 file already carries the `vi.mock` preamble; import `getCockpitToday` from `@/lib/dal/dashboard` and the harness helpers it uses). The counts are clock-relative to a static seed, so the deterministic pins are the admin-only gate (strong) and the return shape:

```ts
describe('wall 1: the admin cockpit read', () => {
  it('returns three numeric counters for an admin', async () => {
    await signInAsAAL2('admin@test.local');
    const cockpit = await getCockpitToday();
    expect(cockpit).toEqual({
      lessons_today: expect.any(Number),
      unmarked_lessons: expect.any(Number),
      unseen_notices: expect.any(Number),
    });
    // The seed's unseen future notice (N_FUTURE) is always counted.
    expect(cockpit.unseen_notices).toBeGreaterThanOrEqual(1);
  });

  it('turns non-admins away', async () => {
    signInAs('laerer@test.local');
    await expect(getCockpitToday()).rejects.toThrow('NEXT_REDIRECT:/ingen-tilgang');
  });
});
```

Run it — it MUST fail (`getCockpitToday` missing) before Step 2.

- [ ] **Step 2: Extend the dashboard DAL**

Append to `src/lib/dal/dashboard.ts` (add `import { todayOsloISO } from '@/lib/dates';` to the imports). `unmarked_lessons` is an anti-join computed in JS (one school's term is small); every read is admin-gated and RLS-scoped:

```ts
export interface CockpitToday {
  lessons_today: number;
  unmarked_lessons: number;
  unseen_notices: number;
}

/**
 * Admin cockpit counters (design §6). Oslo "today". unmarked_lessons counts
 * scheduled lessons dated today-or-earlier with zero attendance rows (the
 * "still needs marking" nudge, §9); unseen_notices counts absence notices a
 * teacher has not yet acknowledged whose window has not fully passed.
 */
export async function getCockpitToday(): Promise<CockpitToday> {
  await requireStaffRole('admin');
  const supabase = await createClient();
  const today = todayOsloISO();

  const { count: lessonsToday, error: todayError } = await supabase
    .from('lessons')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'scheduled')
    .eq('date', today);
  if (todayError) {
    throw new Error(`Kunne ikke telle dagens timer: ${todayError.message}`);
  }

  const { data: due, error: dueError } = await supabase
    .from('lessons')
    .select('id')
    .eq('status', 'scheduled')
    .lte('date', today);
  if (dueError) {
    throw new Error(`Kunne ikke lese timer for føring: ${dueError.message}`);
  }
  const dueIds = (due ?? []).map((lesson) => lesson.id);
  let unmarked = 0;
  if (dueIds.length > 0) {
    const { data: marked, error: markedError } = await supabase
      .from('attendance')
      .select('lesson_id')
      .in('lesson_id', dueIds);
    if (markedError) {
      throw new Error(`Kunne ikke lese føringer: ${markedError.message}`);
    }
    const markedSet = new Set((marked ?? []).map((row) => row.lesson_id));
    unmarked = dueIds.filter((lessonId) => !markedSet.has(lessonId)).length;
  }

  const { count: unseen, error: noticeError } = await supabase
    .from('absence_notices')
    .select('id', { count: 'exact', head: true })
    .eq('seen_by_teacher', false)
    .gte('date_to', today);
  if (noticeError) {
    throw new Error(`Kunne ikke telle uleste fraværsmeldinger: ${noticeError.message}`);
  }

  return {
    lessons_today: lessonsToday ?? 0,
    unmarked_lessons: unmarked,
    unseen_notices: unseen ?? 0,
  };
}
```

Re-run the Step-1 test — it MUST pass now.

- [ ] **Step 3: The cockpit widget on the admin dashboard**

Rewrite `src/app/(portal)/admin/page.tsx` in full. `getCockpitToday` joins the `Promise.all`; a distinct bordered "I dag" panel (no tint — differs from the tinted overview strip) renders the three figures + a contextual nudge:

```tsx
import type { Metadata } from 'next';
import { PillLink } from '@/components/ui/PillLink';
import { AdminAccessDenied } from '@/lib/admin/quarantine';
import { adminListAuditLog, type AuditLogEntry } from '@/lib/admin/audit-log';
import { getAdminOverview, getCockpitToday } from '@/lib/dal/dashboard';
import { formatDateNb, todayOsloISO } from '@/lib/dates';

export const metadata: Metadata = { title: 'Administrasjon' };

/**
 * The audit list demands AAL2 (the admin module re-verifies the caller's own
 * session). Until the MFA gate and pages exist (T13/T14), an admin session is
 * AAL1, so a denial here is EXPECTED — show it as a locked state. Every other
 * error keeps propagating (fail fast).
 */
async function loadAuditEntries(): Promise<AuditLogEntry[] | 'locked'> {
  try {
    return await adminListAuditLog(5);
  } catch (error) {
    if (error instanceof AdminAccessDenied) return 'locked';
    throw error;
  }
}

export default async function AdminDashboard() {
  const [overview, cockpit, entries] = await Promise.all([
    getAdminOverview(),
    getCockpitToday(),
    loadAuditEntries(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Administrasjon</h1>

      <section className="flex flex-wrap items-baseline gap-x-8 gap-y-3 rounded-lg border border-hairline bg-surface-tint/60 px-5 py-4">
        <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
          <div>
            <dt className="text-sm text-ink/60">Aktive elever</dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {overview.active_students}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink/60">Klasser</dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {overview.current_term_classes}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink/60">Termin</dt>
            <dd className="text-2xl font-semibold">
              {overview.current_term_name ?? 'Ikke satt'}
            </dd>
          </div>
        </dl>
        <div className="ms-auto flex flex-wrap gap-2">
          <PillLink href="/admin/elever">Elevregisteret</PillLink>
          <PillLink href="/admin/klasser">Klasser</PillLink>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-hairline px-5 py-4">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-lg font-semibold">I dag</h2>
          <p className="text-sm tabular-nums text-ink/60">{formatDateNb(todayOsloISO())}</p>
        </div>
        <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
          <div>
            <dt className="text-sm text-ink/60">Timer i dag</dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {cockpit.lessons_today}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink/60">Uførte timer</dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {cockpit.unmarked_lessons}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink/60">Uleste fraværsmeldinger</dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {cockpit.unseen_notices}
            </dd>
          </div>
        </dl>
        <p className="text-sm text-ink/60">
          {cockpit.unmarked_lessons > 0
            ? 'Noen timer mangler oppmøteføring — lærerne fører dem fra sine klasser.'
            : 'Alt oppmøte er ført så langt.'}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Siste hendelser</h2>
        {entries === 'locked' ? (
          <p className="rounded-lg border border-hairline bg-surface-tint/60 px-4 py-3 text-sm leading-relaxed text-ink/70">
            Revisjonsloggen krever bekreftet to-faktor. Den låses opp når to-faktor er
            satt opp og bekreftet for kontoen din.
          </p>
        ) : (
          <ul className="divide-y divide-hairline rounded-lg border border-hairline">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3"
              >
                <span className="font-medium">{entry.action}</span>
                <span className="text-sm text-ink/60">{entry.entity}</span>
                <time
                  dateTime={entry.created_at}
                  className="ms-auto text-sm text-ink/60"
                >
                  {new Date(entry.created_at).toLocaleString('nb-NO', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                    timeZone: 'Europe/Oslo',
                  })}
                </time>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-ink/60">
          Alle sensitive handlinger logges. Full revisjonslogg med filtrering kommer i
          en senere fase.
        </p>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Verify + commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run lint
npm run test:api 2>&1 | tail -6   # local stack up + reseeded; the two cockpit cases pass
rm -rf .next && npm run dev
```

Browser check as `admin@test.local` (AAL2): `/admin` shows the "I dag" panel below the overview strip with three `tabular-nums` figures. On the current date (before Høst 2026) «Timer i dag» = 0, «Uførte timer» = 0, «Uleste fraværsmeldinger» ≥ 1 (the seed N_FUTURE), and the nudge line reads «Alt oppmøte er ført så langt.» Confirm the panel is visually distinct from the tinted overview (plain border, "I dag" heading) — not a second identical card row. 375px: figures wrap, nothing clipped.

```bash
cd /Users/daodilyas/dev/iqra-portal
git add src/lib/dal/dashboard.ts tests/api/attendance-core.test.ts 'src/app/(portal)/admin/page.tsx'
git commit -m "feat: admin cockpit today/attendance widget"
```

---

### Task 16: Exit gate — full suite, browser pass, docs + ledger, feature summary

Closing `docs:`-style task: prove the whole phase green across both walls and every surface, record the deferred ledger, and land the feature summary. No code changes beyond docs.

- [ ] **Step 1: The full exit gate (understand every number — never adjust an expectation to match output)**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck                       # silent
npm run lint                            # clean
npm test -- --run 2>&1 | tail -3        # unit: Phase-1 baseline + attendance validation/date units (T6) + the cycle reducer (T11)
npm run build 2>&1 | tail -6            # every route compiles, incl. /laerer/timer/[lessonId]
supabase db reset 2>&1 | tail -4        # all migrations + Phase-2 seed apply (see header gotcha 3: exit 1 in the final "Restarting…" phase is benign — the "Applying migration…/Seeding data…" lines are the success signal; do NOT re-run, run the wait loop then continue)
supabase test db 2>&1 | tail -16        # pgTAP: Phase-1 files + 11_lessons_rls, 12_attendance_rls, 13_absence_notices_rls, 14_attendance_history
npm run test:api 2>&1 | tail -6         # live wall-1: Phase-1 + attendance-core + attendance-actions
npm audit --audit-level=high            # exit 0 (zero new deps this phase)
git log --oneline main..feat/phase-2    # one feat/test/docs commit per task + review-fix commits — nothing stray/foreign
```

Any mismatch (a count lower than the last green run, a failing case) is a defect to fix BEFORE proceeding.

- [ ] **Step 2: Design self-audit (spec §7 + web-interface-guidelines pass)**

Walk every new/changed surface at 375px and desktop, keyboard-only, confirming: visible focus ring on every link/button/chip-button/input; `min-h-11` targets (incl. the marking status chips and note toggles); labels above inputs; single `role="alert"` line per form; teaching empty states on every list that can be empty; `tabular-nums` on all figures/times/dates; every date via `formatDateNb`/`scheduleLabel` (Oslo); chips carry AA-contrast `-ink` text on `/15` tints; NO kicker labels, emojis, purple, `#000`/`#fff`, gradient text, or identical-card grids (the cockpit panel is deliberately one panel, not a card row). Fix findings under a `fix:` commit.

- [ ] **Step 3: Browser pass on every new surface (TOTP per header gotcha 16 → Phase-1 gotcha 17 node snippet for staff logins)**

Reseed first (`supabase db reset`), then `rm -rf .next && npm run dev`, and verify each:

| URL | Login (role) | Verify |
|---|---|---|
| `/laerer` | `laerer@test.local` (AAL2) | "I dag" heading + Oslo date; empty state off-term, else today's lessons with marked chip; "Mine klasser" lists Klasse 1 |
| `/laerer/klasser/<Klasse 1 id>` | `laerer@test.local` | "Timer" list (L_PAST «Ført», L_TODAY «Ikke ført»); roster below; placeholder gone |
| `/laerer/timer/f6000000-0000-0000-0000-000000000002` | `laerer@test.local` | roster defaults «Til stede»; tap cycles status; note toggle; **Lagre oppmøte** → «lagret» |
| `/laerer/timer/f6000000-0000-0000-0000-000000000001` | `laerer@test.local` | L_PAST recorded status mix persists; a future lesson inside N_FUTURE shows «Forhåndsmeldt fravær» + «Gyldig fravær» prefill; foreign-class lesson id → 404 |
| `/forelder` | `forelder@test.local` (no MFA) | child switcher (Yusuf/Amira); Yusuf's history (L_PAST); N_FUTURE listed; Meld fravær files + clears; retract (two-step); Til<Fra inline error |
| `/elev` | `elev@test.local` (no MFA) | Yusuf's own read-only "Mitt oppmøte" (L_PAST); no controls |
| `/admin/elever/<Yusuf id>` | `admin@test.local` (AAL2) | "Oppmøte" block (L_PAST) between relations grid and note; markless student shows empty line |
| `/admin/terminer/<Høst 2026 id>` | `admin@test.local` | "Timer" section + count; Generer → «0 nye … N fantes fra før» (idempotent) |
| `/admin/klasser/<Klasse 1 id>` | `admin@test.local` | LessonManager: Avlys (two-step) → «Avlyst»; Rediger time/note → saved; regenerate does not resurrect the cancelled lesson |
| `/admin` | `admin@test.local` | "I dag" cockpit panel: 3 figures (unseen notices ≥1) + nudge; distinct from overview strip |

- [ ] **Step 4: README + Phase-2 deferred ledger**

In `README.md`, extend the feature list («Funksjoner») with:

```markdown
- **Fase 2 — oppmøte:** genererte timer per termin, lærerens «I dag»-visning
  med ett-trykks oppmøteføring (til stede / fravær / for sent / gyldig fravær)
  og forhåndsmeldt fravær, foreldrenes oppmøtehistorikk + «Meld fravær», elevens
  egen historikk, admin-timeadministrasjon (generer/avlys/rediger) og et
  «i dag / fraværsbilde»-panel. Alle nye tabeller står bak RLS med
  relasjonssjekker i begge murer og revisjonstriggere på elevdata; læreren
  beholder historikk for tidligere (ikke-skjermede) elever via `teaches_class`.
```

Append a **Deferred ledger (Phase 2)** section to this plan document capturing what Tasks 10–16 surfaced (merge with the ledger items from Tasks 1–9):

1. **`listClassLessonsForAdmin(classId)`** — Task 14's class-page manager needs an admin, class-scoped lesson list; it is the "`listClassLessonsForTeacher`-admin equivalent" the task calls for. `Promise<AdminLesson[]>`, `requireStaffRole('admin')`, date-ordered. Now defined in Task 7 (`src/lib/dal/lessons.ts`) with `tests/api/attendance-core.test.ts` coverage (R3).
2. **`generateLessons` return shape** — `GenerateLessonsState extends FormState` carries `{ error: null; success: true; created; skipped }` (the "unless noted" exception to the house `FormState`) so the confirmation UI can report counts. Task 8's action returns them (R1).
3. **Marks transport** — `MarkAttendance` submits one hidden `marks` field = `JSON.stringify(Array<{ student_id, status, note? }>)`; Task 9's `markAttendance` parses `attendanceMarksSchema.parse(JSON.parse(formData.get('marks')))`. Field-name coupling recorded so both ends stay aligned.
4. **English form field names** — `MeldFravaer` (`student_id`/`date_from`/`date_to`/`note`) and the lesson editor (`status`/`starts_at`/`ends_at`/`note`) use the Phase-2 schema keys directly (unlike Phase-1's Norwegian field names), so Tasks 8/9 parse them verbatim.
5. **Cockpit drill-down (design §9)** — the widget ships counts only; a click-through list of unmarked past lessons / unseen notices is deferred.
6. **`getCockpitToday` clock-coupling** — `lessons_today`/`unmarked_lessons`/`unseen_notices` are relative to the real Oslo clock, so exact counts can't be pinned against the static seed; the wall-1 test asserts the admin-only gate (strong) + shape + `unseen_notices ≥ 1`. Revisit if a clock-injectable search date is introduced for deterministic counts.
7. **Student status chip on `/elev`** — still omitted (Phase-1 ledger #12a stands; student logins are password-less pre-cloud).

- [ ] **Step 5: Commit docs + push the branch**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add README.md
git commit -m "docs: phase 2 feature summary"
git push -u origin feat/phase-2
gh run watch --repo daodiii/iqra-portal || true
```

Expected: CI green (typecheck/lint/unit/build + pgTAP jobs; `test:api` stays out of CI — needs the local stack, the Phase-0/1 decision stands). **STOP here: merging `feat/phase-2` into `main` is the user's call.**

---

## Coverage self-check (spec §9 Phase 2: «attendance loop — generate, mark, pre-report, history, cockpit»)

| Spec item | Wall 2 (RLS + pgTAP) | Wall 1 (DAL + tests/api) | UI |
|---|---|---|---|
| Lesson generation (idempotent) | T1 / 11 | T8 actions | T14 |
| Mark / correct attendance | T2 / 12 | T9 actions | T11 |
| Pre-report → prefill (`seen_by_teacher`) | T3 / 13 | T7 roster + T9 | T11, T12 |
| Teacher "I dag" | T2 / 12 | T7 `listTeacherToday` | T10 |
| Historical roster (interval, non-protected leaver) | T4 / 14 | T7 roster | T11 |
| Parent history + notices | T2–3 / 12–13 | T7 / T9 | T12 |
| Student own history | T2 / 12 | T7 | T13 |
| Admin student block + lesson mgmt | T1–2 / 11–12 | T7 / T8 | T13, T14 |
| Admin cockpit | — | T15 `getCockpitToday` | T15 |
| Fine-derived #1 (parent A vs B) | 12 | attendance-core | — |
| Fine-derived #4 (teacher X vs class Y) | 11–12 | attendance-core | T11 (404) |
| Fine-derived #2 (protected excluded from history) | 14 | attendance-core | T11 roster |
| Audit on attendance/notice writes | T2–3 / 12–13 | T9 lifecycle | — |
