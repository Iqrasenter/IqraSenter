# IQRA Skoleportal — Phase 2 (Attendance) Design

> **Complements the master spec** (`docs/spec.md` §4 data model, §5 portals, §9 phases). This document captures only the decisions Phase 2 resolves that the one-line master entry left implicit, so the implementation plan can be written against a settled design. **Code lands in `/Users/daodilyas/dev/iqra-portal`** (branch `feat/phase-2`, cut from `main`); the task-by-task plan follows in `docs/superpowers/plans/2026-07-19-iqra-portal-phase-2.md`.

**Status of the ground it builds on:** Phase 0 (foundation) and Phase 1 (school core) are complete and merged to `main` (`f2d8036`). Terms, classes, subjects, students, guardians, enrollment, `class_schedule`, the two-wall model (DAL + RLS), the `private.*` relationship helpers, the adversarial suites (pgTAP + `tests/api`), the service-role admin quarantine, and the "C · Familie" design system all exist.

**Goal:** turn the weekly `class_schedule` slots into a live attendance loop — generate dated lessons per term, let teachers mark attendance one-tap from a "today" view, let parents pre-report absence, and give parents/students/admin the history and cockpit views — all under the same two walls, with both adversarial suites extended and the fine-derived regressions re-pinned for attendance.

---

## 1. Decisions resolved this phase

| # | Decision | Choice | Why |
|---|---|---|---|
| D1 | **Lesson generation** | Admin-triggered **idempotent batch** materialization | Matches the spec's "generated per term, individually editable"; real rows keep attendance FKs and queries trivial; per-lesson cancels (Eid/Ramadan) are natural edits; admin controls when the calendar exists. |
| D2 | **Historical roster** | **Preserve, interval-based** | A lesson's roster = students whose enrollment interval covers the lesson date; recorded attendance persists. Correct, complete attendance history rather than a current-enrollment snapshot that silently drops leavers. |
| D3 | **Former-student name visibility** | **Additive `students` RLS policy** via `private.taught_student_ever`; **protected students excluded** from the historical path | Idiomatic (mirrors the existing `teaches_student` predicate minus the `left_on` filter), RLS-native, avoids a PII-returning `security definer`. "Skjermet" is the most sensitive flag + "least privilege everywhere" is a spec rule, so historical teacher visibility stops at unenrollment for protected students only. |
| D4 | **Teacher entry point** | Dedicated **"I dag"** aggregate view | Spec §5 "Today → one-tap attendance". Aggregates today's lessons across all the teacher's classes; class-detail page links into the same marking screen. |
| D5 | **Pre-report ↔ attendance** | Shown as **prefill**; confirm → `excused` | Spec §5 "pre-reported absences shown". A covering `absence_notice` marks the student "Forhåndsmeldt fravær" and prefills `excused`; teacher confirms/overrides. Opening the lesson flips `seen_by_teacher`. |
| D6 | **Lesson cancellation/edit** | **Admin-only** | Spec §5 "class management incl. lesson cancellations". Teachers mark attendance; they do not cancel lessons. |
| D7 | **Surface scope** | Student read-only history **in**; economy **out**; admin cockpit **lightweight** | Student "R self" is cheap and completes the matrix. Economy sees no pedagogy. The admin cockpit ships a small "i dag / fraværsbilde" widget, not rich analytics (deferred). |

---

## 2. Data model (new — keyed to master spec §4)

Two new enum types and three new tables. All follow Phase-1 conventions: `created_at` on every table; `updated_at` (+ trigger) on mutating tables; `private.audit_row_change(...)` triggers on the student-data tables; the grant firewall (`revoke all from anon, authenticated, service_role` then narrow grants; `anon` gets nothing); Oslo-pinned dates.

```sql
create type public.lesson_status     as enum ('scheduled', 'cancelled');
create type public.attendance_status as enum ('present', 'absent', 'late', 'excused');
-- UI (bokmål): present=Til stede · absent=Fravær · late=For sent · excused=Gyldig fravær

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
  constraint lessons_unique_slot unique (class_id, date, starts_at)  -- idempotent generation
);

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
```

**FK lifecycle notes.** `lessons.class_id` cascades (a deleted class takes its lessons). `attendance` cascades from both `lessons` and `students` — a GDPR hard-erase of a student removes their attendance, and dropping a lesson drops its marks. `absence_notices.student_id` cascades. `recorded_by`/`created_by` reference `profiles` with default `restrict` (never orphan an audit trail of who marked). No sequences (all uuid/composite PKs) — grant firewall grants no sequence usage.

**Grants.** `authenticated` gets `select, insert, update` on `lessons` and `attendance` (no `delete` — lessons are *cancelled*, not deleted; attendance is *corrected via upsert*; student erasure cascades from `students`), and `select, insert, delete` on `absence_notices` (a mistaken notice is retracted, not edited — RLS scopes delete to its author/admin; no in-place UPDATE). `service_role` gets only `select, delete` on all three (future retention/erasure jobs); it is **not** the write path for attendance. `anon`: nothing.

---

## 3. Lesson generation semantics (D1)

A DAL function `generateLessonsForTerm(termId)` (admin-only, invoked from `/admin/terminer/[id]` via a server action, and offered for the current term from the admin cockpit):

- For each `class` in the term, for each `class_schedule` slot `(weekday, starts_at, ends_at)`, insert a `lesson` for **every date in `[term.starts_on, term.ends_on]` whose ISO weekday = `slot.weekday`** (weekday 1=mandag … 7=søndag, matching `class_schedule`'s CHECK). Dates computed in `Europe/Oslo`.
- `insert … on conflict (class_id, date, starts_at) do nothing` — **idempotent**. Re-running after adding a class or a schedule slot fills only the missing dates; it never overwrites a `cancelled` lesson, an edited `note`/time, or one that already has attendance.
- **Deliberate trade-off:** removing a `class_schedule` slot does **not** delete already-generated future lessons for that slot. The admin cancels those individually (the safe, auditable path) rather than a destructive bulk delete that could erase recorded attendance. The plan documents this in the ledger.
- Return a summary (`created`, `skipped`) for the confirmation UI. The whole run is one transaction.

**Edge cases the plan must cover:** generating a term already in progress creates past-dated `scheduled` lessons with no attendance (acceptable — they simply read as unmarked); a class with no schedule slots yields no lessons; a term with no classes is a no-op; regeneration is safe to run repeatedly.

---

## 4. RLS model (both walls; new helpers)

Default-deny on all three tables; permissive, OR-ed policies `to authenticated`, each delegating to a `private.` helper, `(select auth.uid())` wrapped. Writes are admin-or-relationship; the DAL adds the load-bearing `.eq`/relationship predicate on top (the `.eq` discipline) so dual-role users never over-read.

**New helpers (SECURITY DEFINER, `stable`, `set search_path=''`, execute revoked from public then granted to `authenticated`):**
- `private.teaches_lesson(uid, lesson_id)` → teacher of the lesson's class (`lessons` → `class_teachers`; no enrollment filter, so history survives).
- `private.taught_student_ever(uid, sid)` → `teaches_student` minus the `left_on is null` filter (any past/present enrollment in a class the caller teaches). **Used only where D3 applies.**
- `private.guardian_sees_lesson(uid, lesson_id)` / `private.student_sees_lesson(uid, lesson_id)` → guardian/own-student has an **attendance row or interval-covering enrollment** in the lesson, so a parent/student can read the lesson metadata behind a *past* attendance row even after leaving the class.

**Per-table policy intent:**

| Table | SELECT | INSERT / UPDATE / DELETE |
|---|---|---|
| `lessons` | `admin` OR `teaches_class(class_id)` OR `guardian_in_class(class_id)` OR `student_in_class(class_id)` (active — for schedules/next-lesson) OR `guardian_sees_lesson` OR `student_sees_lesson` (historical metadata) | generate/cancel/edit: **admin only** |
| `attendance` | `admin` OR `teaches_lesson` OR `is_guardian_of(student_id)` (no enrollment filter → parent keeps full child history) OR own student (`student_user_id`) | mark/correct: `admin` OR `teaches_lesson` |
| `absence_notices` | `admin` OR `is_guardian_of` OR `teaches_student` (active — notices are forward-looking) OR own student | INSERT/DELETE: `admin` OR `is_guardian_of`; no in-place UPDATE |

**D3 delta — one new additive `students` SELECT policy:**
```sql
create policy "students_select_taught_ever"
  on public.students for select to authenticated
  using (private.taught_student_ever((select auth.uid()), id) and protected = false);
```
This OR-s into the existing `students_select_related` (additive-policy pattern). Effect: a teacher can see the identity of a **non-protected** student they have ever taught, which is what makes the interval-based historical roster join resolve names. Protected students remain visible to a teacher only while actively enrolled (existing `teaches_student` path). Admin/parent/self visibility is unchanged.

**Interval-roster query (DAL, plain SQL under RLS):** a lesson's roster = `class_students` rows for the lesson's class where `enrolled_on <= lesson.date and (left_on is null or lesson.date < left_on)`. The teacher reads these via the existing `class_students_select_related` policy (already keyed to `teaches_class`, no enrollment filter) joined to `students` (now resolvable for non-protected leavers via the new policy).

---

## 5. Absence pre-report flow (D5)

1. Parent (or admin) files **Meld fravær** → `absence_notices` row over `[date_from, date_to]`, future dates allowed, optional note.
2. When a teacher opens a lesson, for each rostered student the DAL checks for an active notice covering `lesson.date`; a match renders a **"Forhåndsmeldt fravær"** chip and prefills that student's status to `excused`.
3. On save, the marking action upserts one `attendance` row per rostered student (`on conflict (lesson_id, student_id) do update`): default `present`, pre-reported → `excused`, teacher overrides win.
4. Opening the lesson flips the covering notices' `seen_by_teacher` to `true` (so the parent's report is acknowledged; admin cockpit can surface unseen notices).

---

## 6. Surfaces (per role; "C · Familie" system, phone-first)

- **Teacher `/laerer` — "I dag":** today's lessons across all their classes (time · class · room · marked/unmarked chip). Empty state when none today. Tap → **marking screen** `/laerer/timer/[lessonId]`: roster with tap-to-cycle status chips, pre-report chips, per-student note, one save. `/laerer/klasser/[id]` gains a lesson list linking to the same screen (replaces the current "Oppmøteregistrering kommer i neste fase" placeholder).
- **Parent `/forelder`:** child switcher → **attendance history** (per lesson: date, class, status, note) and **Meld fravær** form (date range + note). "Next lesson" line uses the active-class schedule.
- **Student `/elev`:** own attendance history, read-only.
- **Admin:** `/admin/terminer/[id]` "Generer timer for terminen" (with created/skipped confirmation); `/admin/klasser/[id]` lesson list with per-lesson **cancel/edit** (status + note + time); an **attendance block** on `/admin/elever/[id]` (one-glance student page); a cockpit **"i dag / fraværsbilde"** widget on `/admin` (today's lessons count, unseen absence notices, unmarked lessons).
- **Economy:** no attendance surface.

Accessibility per §7: `min-h-11` targets, visible focus rings, labels above inputs, `role="alert"` inline errors, `tabular-nums` for counts, full keyboard path through the marking flow, `prefers-reduced-motion` respected.

---

## 7. Testing strategy (per §8 — TDD, tests-first, CI-gated)

**Wall 2 (pgTAP):** new files for `lessons`, `attendance`, `absence_notices` RLS — every §3-matrix cell, allow **and** deny, as each seed role. Explicit pins:
- Teacher retains attendance history for a **non-protected** leaver via `teaches_class`/`taught_student_ever`; **cannot** see a **protected** leaver after `left_on` is stamped.
- Parent reads full child attendance across a *former* class (`is_guardian_of`, no enrollment filter); parent A cannot read child B's attendance (**fine-derived #1**).
- Teacher of class X cannot read class Y's lessons/attendance (**fine-derived #4**).
- Economy fully denied on all three tables.
- Any export/roster omits protected students unless admin (**fine-derived #2**), re-checked in the attendance context.

**Wall 1 (`tests/api`):** new attendance action/DAL tests (mark, correct, cancel lesson, generate lessons, file/delete absence notice) with forged inputs; extend `DENIED_CELLS` in `access-wall.test.ts` for the three new tables across every seed user; repeat the `vi.mock` preamble per new file.

**Seed:** generate one term's lessons, mark a sample lesson (mix of present/absent/late/excused), and add one parent absence notice, so every surface renders against real data.

---

## 8. Scope boundaries (explicitly deferred — do not build this phase)

- No attendance **analytics/reports** beyond the lightweight cockpit widget (rich dashboards are later).
- No **notifications** on absence/marking (Phase 5 communication owns pings).
- No **term rollover** automation (stamping `left_on` en masse) — Phase-1 ledger item, still deferred.
- No teacher-initiated lesson cancellation (admin-only, D6).
- No economy attendance access (matrix `—`).
- Online payment, self-service enrollment, i18n — out (master spec §10).

---

## 9. Open items (non-blocking)

- Real school calendar exceptions (Eid, Ramadan, holidays) are entered by the admin as per-lesson cancellations after generation — no hardcoded calendar. Collected from IQRA admin during the pilot.
- Whether the admin cockpit should also list *unmarked past lessons* as a nudge — included as a count now; a drill-down list can follow.

---

## 10. Task shape (input to writing-plans)

Roughly Phase-1 rhythm (one commit per task; TDD; fresh implementer per task; **Fable-5 security review on the RLS/generation/action tasks**; controller live-verifies before closing):

1. Migration: `lessons` + enums + generation function + pgTAP.
2. Migration: `attendance` + helpers (`teaches_lesson`) + pgTAP.
3. Migration: `absence_notices` + pgTAP.
4. RLS: historical-visibility policies + `taught_student_ever` + `guardian_sees_lesson`/`student_sees_lesson` + pgTAP (the D2/D3 core).
5. Seed + regenerated `Database` types + `access-wall` matrix growth.
6. Validation (`src/lib/validation/attendance.ts`) + Oslo date helpers for lesson expansion (unit-tested).
7. DAL reads (lessons/attendance/roster interval query; teacher "i dag"; parent/student history) + `tests/api`.
8. Server actions: generate lessons, cancel/edit lesson (admin).
9. Server actions: mark attendance (teacher), file/delete absence notice (parent) + `tests/api`.
10. Teacher "I dag" view.
11. Teacher marking screen + class-detail lesson list.
12. Parent history + Meld fravær.
13. Student history; admin student-page attendance block.
14. Admin term generation UI + class-detail lesson management.
15. Admin cockpit "i dag / fraværsbilde" widget.
16. Exit gate: full suite green, `rm -rf .next` browser pass on every new surface, docs + ledger, feature summary.

(~16 tasks; the plan finalizes ordering, security-review flags, and per-task step lists.)
