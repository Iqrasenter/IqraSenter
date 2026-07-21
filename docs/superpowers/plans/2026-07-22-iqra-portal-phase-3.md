# IQRA Skoleportal — Phase 3 (Vurdering & fremdrift) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give teachers a sub-minute per-student logging flow (book position, Quran memorisation, notes), class tests with per-student results, and term-end grades + feedback per subject — and give parents/students/admin the fremdrift picture (ladders, Quran position, test results, term grades, printable term report) — under the two-wall model, with both adversarial suites extended and the fine-derived regressions re-pinned for assessment data.

**Architecture:** Six new tables (`curriculum_books`, `progress_entries`, `quran_entries`, `tests`, `test_results`, `term_grades`) + a `settings.grade_scale` column. The two entry logs are **append-only** (retract-and-relog, no UPDATE grant); current standing is **derived** (latest-per-book, latest Quran entry, weak spot = surah whose latest entry is `repeat`). Seven new SECURITY DEFINER helpers mirror the Phase-2 set; **every INSERT/UPDATE carrying a `student_id` is double-bound** (actor→context AND student→context) at both walls — the Phase-2 C-1 lesson, now a standing rule. Test results get their own entry screen `/laerer/prover/[testId]` mirroring the attendance marking screen (interval roster as of `held_on`, one save, upsert corrections). Design spec: `docs/superpowers/specs/2026-07-22-iqra-portal-phase-3-vurdering-design.md`.

**Tech Stack:** Unchanged — Next.js 16 (App Router, `src/`, Turbopack), React 19 (`useActionState`), TypeScript strict, Tailwind v4 tokens from `globals.css`, `@supabase/ssr` + `@supabase/supabase-js` v2, Zod v4, Vitest (+ `vitest.config.api.ts` live suite), Supabase CLI with SQL migrations + pgTAP. **Zero new npm dependencies.**

---

## Read this before starting

**The portal repo is `/Users/daodilyas/dev/iqra-portal`** — NOT the session cwd (the marketing site). Plans/specs live in the marketing repo under `docs/superpowers/`; ALL code work happens in the portal repo. Environment gotchas (all still true from Phase 0/1/2):

1. **Every Bash step must `cd /Users/daodilyas/dev/iqra-portal` explicitly.** Shell cwd resets between calls.
2. **Branch topology (NEW this phase — the demo→real transition, roadmap §2):** `main` = the frozen pitch demo (`bc318b5`) — NEVER commit to it. The real line is the **`real`** branch (created in Task 1 at `a0dee22`, the reviewed Phase-2 tip). **Work on `feat/phase-3`, cut from `real`.** The phase lands by PR `feat/phase-3 → real`. Exit-gate commit-list check is `git log real..feat/phase-3`.
3. **Docker + Supabase quirks:** if the stack is down, never plain `supabase start` — use `supabase start --ignore-health-check`, then wait until `docker ps` shows every container healthy (`rest`/`edge-runtime` have no healthcheck; plain `Up` is their healthy). `supabase db reset` completes all DB work even when it exits 1 in its final `Restarting containers...` phase — the `Applying migration .../Seeding data...` lines are the success signal; do NOT re-run: run the wait loop, then continue (`supabase test db` is the real verification). If `test:api` mass-fails in ~20s, it is ALWAYS environment (schema-less db / GoTrue race / Postgres restart) — `db reset`, verify seeds, re-run; never chase it as a code bug.
4. **`supabase test db` runs pgTAP against the CURRENT local database.** Always `supabase db reset` after changing migrations/seeds, then `supabase test db`.
5. **Stale `.next` after `npm run build`:** before browser-verifying after a build: `rm -rf .next`, then `npm run dev`.
6. **Commit messages:** Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). Never mention Claude/AI. No Co-Authored-By trailers.
7. **Norwegian UI, English code.** User-facing strings are bokmål; identifiers, comments, DB names are English. New URL paths this phase: `/laerer/vurdering`, `/laerer/elev/[studentId]`, `/laerer/elev/[studentId]/rapport`, `/laerer/prover/[testId]`, `/forelder/fremdrift`, `/elev/fremdrift`, `/admin/fag/[id]`.
8. **Design system is LOCKED ("C · Familie", spec §7).** Tokens in `src/app/globals.css`; primitives in `src/components/ui/` (`Button`, `Field`, `Input`, `Chip`, `Skeleton`, `EmptyState`, `PillLink`) + `src/components/shell/`. Bans: no kicker labels, no emojis, no purple, never `#000`/`#fff`, no gradient text, no identical-card grids. Interactive: `min-h-11`, `focus-visible:ring-2 ring-ring ring-offset-2`, labels above inputs, teaching empty states, `role="alert"` inline errors, `tabular-nums` for figures, dates via `Europe/Oslo` helpers. **Grade tones (design law from the demo):** Utmerket/Meget god = `success`, God = `neutral`, Under arbeid = `warning` — **never `danger`** (a pupil in progress is not an error).
9. **Migrations own their privileges** (ENFORCED by `supabase/tests/00_grant_firewall.sql`). Every new table: `revoke all ... from anon, authenticated, service_role;` then grant back exactly what the policies need. `anon` gets NOTHING. Every `create function`: `revoke execute ... from public;` then a narrow grant. No sequences this phase (uuid/composite PKs only).
10. **FK lifecycle:** student data cascades from `students`; `subject_id` on student-data tables is `restrict` (a subject in use maps to 23503, never a silent history erase); `curriculum_books.subject_id` cascades; `progress_entries.book_id` and both `lesson_id` columns are `set null`; `tests.class_id` cascades (and `test_results` cascade from `tests`); `term_grades.term_id` restrict; every actor column (`recorded_by`/`set_by`) → `profiles` default restrict.
11. **RLS helper pattern:** policies never subquery an RLS-protected table directly. Relationship checks go through SECURITY DEFINER `stable sql` functions in `private` with `set search_path = ''`, called as `private.helper((select auth.uid()), col)`. Policies are permissive/OR-ed and ADDITIVE across migrations. **Double-bind rule (standing, from Phase-2 C-1):** any INSERT/UPDATE whose row carries a `student_id` binds the actor to the context AND the student to that same context, at both walls.
12. **Audit namespace ENFORCED:** trigger/DAL audit actions use `<table>.<verb>`; `admin.`/`system.` are reserved (42501). Audit triggers on the four student-data tables: `progress_entries`/`quran_entries` → `private.audit_row_change('id')`; `test_results` → `('test_id', 'student_id')`; `term_grades` → `('student_id', 'term_id', 'subject_id')`. `curriculum_books` and `tests` carry NO audit trigger (school structure, like `lessons`).
13. **Seed UUID scheme (extend, never overlap):** existing — users `1…`–`7…`; `f1…` terms, `fa…` subjects, `fc…` classes, `fe…` students, `f6…` lessons, `f7…` absence notices; pgTAP fixtures `a5…`–`b2…`. **NEW this phase:** seed `curriculum_books` `f2…`, `progress_entries` `f3…`, `quran_entries` `f4…`, `tests` `f5…` (`test_results`/`term_grades` have composite PKs — no new uuids). pgTAP fixtures: `15_curriculum_books_rls` uses `b3…`, `16_progress_entries_rls` `b4…`, `17_quran_entries_rls` `b5…`, `18_tests_rls` `b6…`, `19_term_grades_rls` `b7…`.
14. **`tests/api` growth rules:** every new table extends `DENIED_CELLS` in `access-wall.test.ts`; the `vi.mock` preamble must be repeated per NEW file (mock factories are hoisted). New Phase 3 API tests live in `assessment-core.test.ts` and `assessment-actions.test.ts`. No new seed users → `harness.ts` `SeedEmail` unchanged.
15. **`'use server'` files may export ONLY async functions.** Schemas + label maps live in `src/lib/validation/assessment.ts` (pure, unit-tested); tone maps in `src/lib/assessment-ui.ts`; the surah table in `src/lib/quran.ts`.
16. **`z.guid`, not `z.uuid`:** seed UUIDs fail Zod v4's RFC variant check. Use the exported `uuidField` from `@/lib/validation/school`.
17. **Controlled fields on EVERY new form** (React 19 auto-resets uncontrolled fields after every completed action, including error replies). Pattern: `useState` per field + the prev-state render-adjust clear on success (`MeldFravaer` is the house reference). No `useEffect` state machines.
18. **TOTP for manual browser checks:** staff logins bounce to `/mfa/registrer`/`/mfa/verifiser`; generate codes with the node snippet in the Phase 1 plan's gotcha 17 (`docs/superpowers/plans/2026-07-17-iqra-portal-phase-1.md`).
19. **Write-confirmation pattern:** success-reporting UPDATEs `.select()` and map 0 rows to a Norwegian «…finnes ikke lenger.» error; idempotent DELETEs stay unconfirmed; map `23503` (stale ref) and `23505` (dup) to friendly messages; `22P02` (malformed uuid) → enumeration-quiet null in reads.

**Execution discipline (protect it):** fresh implementer per task (Sonnet) → spec review (byte-exact) → quality review → fix loop → controller live-verifies before closing. **Security-critical tasks (focused security-lens review with live RLS probes): 1, 2, 3, 4, 5, 6, 10, 11.** The phase PR gets the full multi-agent panel (RLS-heavy, per the 2026-07-21 review policy). TDD everywhere: tests written and failing before implementation; tests + implementation committed together per task (one commit per task).

**Deliberate scope decisions (do not re-litigate — design spec §1/§8):**
- **D1/D2:** append-only logs; retract = author/admin DELETE; standing is derived (weak spot = surah whose LATEST entry is `repeat` — a later `pass` clears it).
- **D4:** tests are teacher-created and teacher-edited; test DELETE is admin-only; results entry = `/laerer/prover/[testId]` one-save upsert over the interval roster as of `held_on`.
- **D5:** grade is TEXT validated app-side against `settings.grade_scale` (current scale at entry time); stored grades survive scale edits; NO DB check against the scale (pinned by pgTAP so nobody adds one).
- **D7:** `lesson_id` columns stay NULL in v1 actions; the marking screen links each row to `/laerer/elev/[studentId]` («Loggfør»).
- **D10 scope OUT:** admin entry UI, weak-spot analytics, PDF pipeline, grade-scale admin UI, lesson deep-linking, notifications (Phase 5), assignments (Phase 4), economy access (never).

---

## Seed anchors (exact UUIDs referenced across tasks — Task 6 creates them)

Phase-1/2 seed identities reused verbatim (do not invent): term `HOST_2026` = `f1000000-0000-0000-0000-000000000001` (current); subjects `ARABISK` = `fa000000-0000-0000-0000-000000000001`, `KORAN` = `fa…02` (`quran_tracking=true`), `ISLAMKUNNSKAP` = `fa…03`; classes `K1` = `fc000000-0000-0000-0000-000000000001` (Arabisk+Koran, teacher `laerer@` = `22222222-…`), `K3` = `fc…02` (all three subjects, teacher `laererforelder@` = `66666666-…`); students `YUSUF` = `fe000000-0000-0000-0000-000000000001` (K1, child of `forelder@` = `33333333-…`, login `elev@`), `AMIRA` = `fe…02` (K3, child of `forelder@`), `BILAL` = `fe…03` (K1), `ZAYNAB` = `fe…04` (K3, **protected**), `IDRIS` = `fe…05` (stopped, unenrolled). Lessons `L_PAST` = `f6…01` (2026-08-22), `L_TODAY` = `f6…02` (2026-08-29).

**New Phase-3 anchors (Task 6):**

- Books: `B_ALFABET` = `f2000000-0000-0000-0000-000000000001` («Alfabet og lyder», Arabisk, level 1, `side`, 30 units) · `B_ORD` = `f2…02` («Ord og setninger», Arabisk, level 2, `side`, 40) · `B_ISLAM` = `f2…03` («Grunnleggende islamkunnskap», Islamkunnskap, level 1, `leksjon`, 24).
- Progress entries (`recorded_at` staggered so latest-per-book is deterministic): `f3…01`–`03` = Yusuf on `B_ALFABET`, units 6 → 12 → 18 with notes «God start på alfabetet.» / «Mestrer korte lyder.» / «Jobber godt med sammensatte lyder.» (recorded_by `laerer@`); `f3…04` = Bilal on `B_ALFABET`, unit 9; `f3…05` = Amira on `B_ISLAM`, unit 5 (recorded_by `laererforelder@`).
- Quran entries: `f4…01` = Yusuf surah 114 (An-Nas) 1–6 `longterm`/`pass` (2026-08-22) · `f4…02` = Yusuf surah 113 (Al-Falaq) 1–5 `recent`/`pass` (2026-08-29) · `f4…03` = Yusuf surah 112 (Al-Ikhlas) 1–4 `new`/`repeat` (2026-09-05, note «Repeteres – litt usikker på ayah 3–4.») · `f4…04` = Amira surah 114 1–6 `new`/`pass` (recorded_by `laererforelder@`).
- Test `T_ALFABET` = `f5000000-0000-0000-0000-000000000001` («Prøve: Det arabiske alfabetet», K1, Arabisk, held_on 2026-08-29, max 20) with results Yusuf 18 «Meget bra, litt å finpusse.» / Bilal 14 «Bra jobbet – øv på det vanskeligste.».
- Term grades (current term, set_by `laerer@`): Yusuf×Koran «Utmerket» «Solid innsats gjennom hele terminen.» · Yusuf×Arabisk «Meget god» «Leser stadig bedre – fortsett med høytlesing hjemme.».
- Zaynab (protected) and Idris (stopped) deliberately get **zero** assessment rows — pgTAP fixtures (`b3`–`b7`) build their own protected/leaver scenarios hermetically.

---

## Shared interfaces (THE CONTRACT — every task uses these exact names)

### Database objects
```sql
-- enums
public.quran_kind   = ('new','recent','longterm')
public.quran_result = ('pass','repeat')

-- settings (Task 2 extends)
public.settings.grade_scale text[] not null default array['Utmerket','Meget god','God','Under arbeid']

-- tables (columns per design spec §2 — do not deviate)
public.curriculum_books(id, subject_id, title, level, unit_label, total_units, created_at, updated_at)
public.progress_entries(id, student_id, subject_id, book_id, lesson_id, unit_reached, note, recorded_by, recorded_at, created_at)
public.quran_entries(id, student_id, lesson_id, date, kind, surah, ayah_from, ayah_to, result, note, recorded_by, created_at)
public.tests(id, class_id, subject_id, title, held_on, max_points, created_at, updated_at)
public.test_results(test_id, student_id, points, feedback, recorded_by, recorded_at, created_at, updated_at)  -- pk (test_id, student_id)
public.term_grades(student_id, term_id, subject_id, grade, feedback, set_by, set_at, created_at, updated_at)  -- pk (student_id, term_id, subject_id)

-- private helpers (SECURITY DEFINER, stable sql, set search_path=''; revoke public → grant authenticated)
private.taught_student_ever_unprotected(uid uuid, sid uuid) returns boolean
private.teaches_student_subject(uid uuid, sid uuid, subj uuid) returns boolean
private.teaches_student_term_subject(uid uuid, sid uuid, tid uuid, subj uuid) returns boolean
private.teaches_test(uid uuid, tid uuid) returns boolean
private.student_in_test_class(sid uuid, tid uuid) returns boolean
private.guardian_sees_test(uid uuid, tid uuid) returns boolean
private.student_sees_test(uid uuid, tid uuid) returns boolean
```

### TypeScript types (declared in the module that owns them; import elsewhere)
```ts
// src/lib/quran.ts
export type Surah = { number: number; name: string; ayah_count: number };
export const SURAHS: readonly Surah[];                    // all 114, Hafs counts
export function surahByNumber(n: number): Surah | null;
export function surahLabel(n: number): string;            // "112. Al-Ikhlas"
export function quranPositionLabel(e: { surah: number; ayah_from: number; ayah_to: number }): string; // "Al-Ikhlas 1–4"

// src/lib/validation/assessment.ts (values + labels; schemas below)
export type QuranKind = 'new' | 'recent' | 'longterm';
export type QuranResult = 'pass' | 'repeat';
export const quranKindLabels: Record<QuranKind, string>;     // Under innlæring / Nylig lært / Sitter godt
export const quranResultLabels: Record<QuranResult, string>; // Bestått / Repeteres
export const UNIT_LABELS: Record<'side' | 'leksjon' | 'enhet', string>; // Side / Leksjon / Enhet

// src/lib/assessment-ui.ts
export const quranResultTones: Record<QuranResult, ChipTone>; // pass→success, repeat→warning
export function gradeTone(grade: string): ChipTone;           // Utmerket/Meget god→success, God→neutral, Under arbeid→warning, else neutral

// src/lib/dal/curriculum.ts
export type Book = { id: string; subject_id: string; subject_name: string; title: string; level: number; unit_label: 'side' | 'leksjon' | 'enhet'; total_units: number };

// src/lib/dal/progress.ts
export type BookStanding = { book_id: string; title: string; level: number; unit_label: 'side' | 'leksjon' | 'enhet'; total_units: number; subject_id: string; subject_name: string; current_unit: number; percent: number; recorded_at: string };
export type ProgressLogEntry = { id: string; book_id: string | null; book_title: string | null; subject_name: string; unit_reached: number; note: string | null; recorded_at: string };
export type QuranLogEntry = { id: string; date: string; kind: QuranKind; surah: number; ayah_from: number; ayah_to: number; result: QuranResult; note: string | null };
export type QuranStanding = { position: QuranLogEntry | null; weak_spots: QuranLogEntry[]; recent: QuranLogEntry[] };
export type StudentHeader = { student_id: string; first_name: string; last_name: string; birth_year: number; protected: boolean; class_id: string; class_name: string; subjects: { id: string; name: string; quran_tracking: boolean }[] };
export type StudentFremdrift = { books: BookStanding[]; quran: QuranStanding | null; progress_log: ProgressLogEntry[] };

// src/lib/dal/assessment.ts
export type ClassTest = { id: string; subject_id: string; subject_name: string; title: string; held_on: string; max_points: number; result_count: number };
export type TestRosterEntry = { student_id: string; first_name: string; last_name: string; protected: boolean; points: number | null; feedback: string | null };
export type TestForEntry = { test: { id: string; class_id: string; class_name: string; subject_name: string; title: string; held_on: string; max_points: number }; roster: TestRosterEntry[] };
export type TestResultRow = { test_id: string; title: string; subject_name: string; held_on: string; points: number; max_points: number; feedback: string | null };
export type TermGradeRow = { subject_id: string; subject_name: string; grade: string; feedback: string | null; set_at: string };
export type AttendanceSummary = { present: number; absent: number; late: number; excused: number; total: number };
export type TermReport = { student: { first_name: string; last_name: string; birth_year: number }; term_name: string; class_name: string; grades: TermGradeRow[]; books: BookStanding[]; quran_position: QuranLogEntry | null; attendance: AttendanceSummary };
```

### DAL function signatures
```ts
// src/lib/dal/settings.ts (MODIFY: add grade_scale to the select — Task 8)
getSettings(): … // now also returns grade_scale: string[]

// src/lib/dal/curriculum.ts (Task 8)
listBooks(): Promise<Book[]>                                  // any authenticated portal role except economy (RLS); ordered subject sort → level → title
listBooksForSubject(subjectId: string): Promise<Book[]>       // filter of the above

// src/lib/dal/progress.ts (Task 8)
requireTeacherOfStudent(studentId: string): Promise<{ userId: string; header: StudentHeader } | null>
                                                               // requireStaffRole('teacher'); ACTIVE teaches_student via class link re-check; enumeration-quiet null
getStudentFremdriftForTeacher(studentId: string): Promise<{ header: StudentHeader; fremdrift: StudentFremdrift; tests: TestResultRow[]; grades: TermGradeRow[] } | null>
getChildFremdrift(studentId: string): Promise<{ fremdrift: StudentFremdrift; tests: TestResultRow[]; grades: TermGradeRow[] } | null>   // requireRole('parent'); guardian link re-check
getOwnFremdrift(): Promise<{ fremdrift: StudentFremdrift; tests: TestResultRow[]; grades: TermGradeRow[] } | null>                      // requireRole('student'); null when unlinked
getStudentAssessmentForAdmin(studentId: string): Promise<{ books: BookStanding[]; quran_position: QuranLogEntry | null; grades: TermGradeRow[] }>

// src/lib/dal/assessment.ts (Task 9)
listClassTestsForTeacher(classId: string): Promise<ClassTest[] | null>   // own class; null otherwise
requireTeacherOfTest(testId: string): Promise<{ userId: string; classId: string; heldOn: string; maxPoints: number } | null>
getTestForEntry(testId: string): Promise<TestForEntry | null>            // interval roster as of held_on (mirrors getLessonForMarking)
getTermReportForTeacher(studentId: string): Promise<TermReport | null>   // active teaches_student
getTermReportForChild(studentId: string): Promise<TermReport | null>     // guardian
```

### Server actions (all `'use server'`, returning the house `FormState` unless noted)
```ts
// src/app/(portal)/laerer/elev/[studentId]/actions.ts (Task 10)
logProgress(studentId, prev, formData)        // progressEntrySchema; requireTeacherOfStudent + subject∈header.subjects + book∈subject (wall 1)
logQuran(studentId, prev, formData)           // quranEntrySchema; requireTeacherOfStudent + class must offer a quran_tracking subject
deleteProgressEntry(entryId, prev, formData)  // author-or-admin (RLS); write-confirmation via .select()
deleteQuranEntry(entryId, prev, formData)     // author-or-admin (RLS); write-confirmation via .select()
setTermGrade(studentId, prev, formData)       // termGradeSchema; grade ∈ settings.grade_scale; term = CURRENT term server-derived; upsert on pk

// src/app/(portal)/laerer/klasser/[id]/actions.ts (Task 11 — NEW file)
createTest(classId, prev, formData)           // testSchema; teacher of class; subject ∈ class_subjects (wall 1 re-check)

// src/app/(portal)/laerer/prover/[testId]/actions.ts (Task 11)
saveTestResults(testId, prev, formData)       // hidden `results` JSON → testResultsSchema; roster-as-of-held_on re-derivation (double bind); points ≤ max_points; upsert on (test_id, student_id)
editTest(testId, prev, formData)              // testEditSchema; teacher of test; write-confirmation

// src/app/(portal)/admin/fag/[id]/actions.ts (Task 10)
createBook(subjectId, prev, formData)         // bookSchema; requireStaffRole('admin'); 23505 → «Boken finnes allerede.»
updateBook(bookId, prev, formData)            // bookSchema; write-confirmation
deleteBook(bookId, prev, formData)            // idempotent delete (positions survive via set null)
```

### Validation (`src/lib/validation/assessment.ts` — pure, unit-tested in `assessment.test.ts` next to it)
```ts
export const progressEntrySchema;  // { subject_id: uuid, book_id: uuid | '' → null, unit_reached: int 0..1000, note?: ≤500 }
export const quranEntrySchema;     // { date: iso date, kind, surah: int 1..114, ayah_from ≥1, ayah_to ≥ ayah_from, result, note?: ≤500 } + superRefine: ayah_to ≤ SURAHS[surah].ayah_count
export const testSchema;           // { subject_id: uuid, title: 1..80, held_on: iso date, max_points: int 1..1000 }
export const testEditSchema;       // { title: 1..80, held_on: iso date, max_points: int 1..1000 }
export const testResultSchema;     // { student_id: uuid, points: int ≥0, feedback?: ≤1000 }
export const testResultsSchema;    // array(testResultSchema).min(1).max(200)
export const termGradeSchema;      // { subject_id: uuid, grade: 1..40, feedback?: ≤2000 }
export const bookSchema;           // { title: 1..80, level: int 1..20, unit_label: enum side/leksjon/enhet, total_units: int 1..1000 }
```

### Derivations (`src/lib/assessment.ts` — pure, unit-tested)
```ts
export function latestPerBook(entries: Array<{ book_id: string | null; unit_reached: number; recorded_at: string }>): Map<string, { unit_reached: number; recorded_at: string }>;
export function bookPercent(unit: number, total: number): number;   // round(100*unit/total) clamped 0..100
export function quranStanding(entries: QuranLogEntry[]): QuranStanding; // position = latest by (date, then id-insertion order as tiebreak recency), weak_spots = surahs whose LATEST entry is repeat (most recent first), recent = latest 10
```

### Shared components (`src/components/assessment/` — Task 13/14 create, later tasks reuse)
```ts
ProgressLadder({ label, current, total, percent, unitLabel }): server-safe progressbar (role="progressbar", quartile notches)
QuranPositionCard({ position, weakSpots }): «Nåværende posisjon» + «Å repetere»
GradeBadge({ grade }): Chip with gradeTone(grade)
TermReport({ report }): print-friendly report body (Task 14)
```

---

## Task index

| # | Task | Primary files | Sec-review |
|---|---|---|---|
| 1 | Transition ceremony (`real`, tag, CI) + Phase-2 riders | `.github/workflows/ci.yml`, `migrations/<ts>_absence_notice_author_pin.sql`, `tests/13_…​.sql`, `src/lib/dal/{lessons,attendance}.ts` | ● |
| 2 | Migration: `curriculum_books` + `settings.grade_scale` + pgTAP 15 | `migrations/<ts>_curriculum_books.sql`, `tests/15_curriculum_books_rls.sql` | ● |
| 3 | Migration: `progress_entries` + `quran_entries` + 2 helpers + pgTAP 16/17 | `migrations/<ts>_progress_quran_entries.sql`, `tests/16_…​.sql`, `tests/17_…​.sql` | ● |
| 4 | Migration: `tests` + `test_results` + 4 helpers + pgTAP 18 | `migrations/<ts>_tests_results.sql`, `tests/18_tests_rls.sql` | ● |
| 5 | Migration: `term_grades` + 1 helper + pgTAP 19 | `migrations/<ts>_term_grades.sql`, `tests/19_term_grades_rls.sql` | ● |
| 6 | Seed + regenerated types + `access-wall` matrix growth | `seed.sql`, `database.types.ts`, `tests/api/access-wall.test.ts` | ● |
| 7 | `SURAHS` + validation schemas + label/tone maps + derivations (pure units) | `src/lib/quran.ts(+test)`, `src/lib/validation/assessment.ts(+test)`, `src/lib/assessment.ts(+test)`, `src/lib/assessment-ui.ts` | |
| 8 | DAL: curriculum + progress/fremdrift reads + `assessment-core` | `src/lib/dal/{curriculum,progress,settings}.ts`, `tests/api/assessment-core.test.ts` | |
| 9 | DAL: tests/report reads + `assessment-core` growth | `src/lib/dal/assessment.ts`, `tests/api/assessment-core.test.ts` | |
| 10 | Actions: log/retract progress & quran, term grade, books CRUD + `assessment-actions` | `laerer/elev/[studentId]/actions.ts`, `admin/fag/[id]/actions.ts`, `tests/api/assessment-actions.test.ts` | ● |
| 11 | Actions: create/edit test + save results + `assessment-actions` growth | `laerer/klasser/[id]/actions.ts`, `laerer/prover/[testId]/actions.ts`, `tests/api/assessment-actions.test.ts` | ● |
| 12 | Teacher: vurdering overview + per-student assessment page | `laerer/vurdering/page.tsx`, `laerer/elev/[studentId]/{page,LogProgressForm,LogQuranForm,TermGradeEditor,EntryLists}.tsx`, `components/assessment/{ProgressLadder,QuranPositionCard,GradeBadge}.tsx` | |
| 13 | Teacher: klasser «Prøver» section + `/laerer/prover/[testId]` entry screen | `laerer/klasser/[id]/{page.tsx,NewTestForm.tsx}`, `laerer/prover/[testId]/{page,TestEntry,EditTestForm}.tsx` | |
| 14 | Report: `TermReport` + teacher print view + parent fremdrift (incl. toggle) | `components/assessment/TermReport.tsx`, `laerer/elev/[studentId]/rapport/page.tsx`, `forelder/fremdrift/{page.tsx,ReportToggle.tsx}` | |
| 15 | Student fremdrift + admin: books manager + elevside «Vurdering» block | `elev/fremdrift/page.tsx`, `admin/fag/[id]/{page.tsx,BookForms.tsx}`, `admin/fag/page.tsx`, `admin/elever/[id]/page.tsx` | |
| 16 | Role navs + entry links (marking-screen «Loggfør», forelder teaser) | `laerer/LaererNav.tsx`, `forelder/ForelderNav.tsx`, `elev/ElevNav.tsx`, 3 layouts, `MarkAttendance.tsx`, `forelder/page.tsx` | |
| 17 | Exit gate: full suite, browser pass, docs + ledger, feature summary | `README.md`, this plan's ledger | |

**Task order rationale:** 1 settles the branch topology and clears the Phase-2 review riders before any Phase-3 code; 2–5 build wall 2 bottom-up (catalog → logs → tests → grades; each migration ships its helpers and pgTAP twins); 6 seeds + regenerates `Database` types + grows the matrix (everything downstream needs fixtures + types); 7 pure units (no DB); 8–9 DAL reads (wall-1 twins); 10–11 actions (writes, TDD against the live stack) — log/grade/book writes before test writes so the entry screen has data shapes to consume; 12–16 UI teacher-first (vurdering core → tests → report/parent → student/admin → navs LAST so no link ever 404s during a walkthrough); 17 exit gate.

**pgTAP running total:** 280 (Phase 2) → T1 **281** → T2 **299** → T3 **344** → T4 **374** → T5 **395**. `tests/api`: 173 → T6 **181** → T8 **195** → T9 **207** → T10 **219** → T11 **231**. Unit: 119 → T7 **151**.

---

<!-- EXPANDED TASKS APPENDED BELOW -->

### Task 1: Transition ceremony (`real`, tag, CI) + Phase-2 review riders

Settles the demo→real branch topology (roadmap §2) and clears the three carry-forward riders from the Phase-2 review before any Phase-3 code. The ceremony's pushes are **outward-facing: STOP and get the user's explicit OK** before running Step 1's push block — everything after it is local branch work.

**Files:**
- Modify: `.github/workflows/ci.yml` (one line)
- Create: `supabase/migrations/<ts>_absence_notice_author_pin.sql`
- Modify: `supabase/tests/13_absence_notices_rls.sql` (plan 22 → 23, one new test)
- Modify: `src/lib/dal/lessons.ts` (empty-RPC throw)
- Modify: `src/lib/dal/attendance.ts` (three history reads → `lessons!inner`)

- [ ] **Step 1: The ceremony (pin the demo, create `real`, cut `feat/phase-3`)**

```bash
cd /Users/daodilyas/dev/iqra-portal
git status --short              # expect: clean tree on feat/phase-2
git rev-parse feat/phase-2      # expect: a0dee22…
git tag demo-pitch-2026-07 bc318b5
git branch real a0dee22
```

**⛔ STOP — user OK required for the pushes (outward-facing, first write to origin this phase):**

```bash
cd /Users/daodilyas/dev/iqra-portal
git push origin demo-pitch-2026-07
git push -u origin real
gh repo edit daodiii/iqra-portal --default-branch real   # optional but recommended (roadmap §2.1.4)
```

Then cut the phase branch (local, no approval needed):

```bash
cd /Users/daodilyas/dev/iqra-portal
git checkout -b feat/phase-3 real
```

Expected: `git branch --show-current` → `feat/phase-3`; `git log --oneline -1` → `a0dee22`.

- [ ] **Step 2: CI on the real line**

In `.github/workflows/ci.yml`, change:

```yaml
on:
  push:
    branches: [main]
  pull_request:
```

to:

```yaml
on:
  push:
    branches: [main, real]
  pull_request:
```

- [ ] **Step 3: Write the failing pgTAP test (author pin)**

In `supabase/tests/13_absence_notices_rls.sql`: change `select plan(22);` to `select plan(23);`, and insert this test directly after the existing `'BERGEN #1: parent A cannot file a notice for parent B''s child'` `throws_ok` block (inside the same parent-A session, before its `reset role;`):

```sql
select throws_ok(
  $$ insert into public.absence_notices (student_id, date_from, date_to, created_by)
     values ('b1000000-0000-0000-0000-000000000031', '2026-09-06', '2026-09-06',
             'b1000000-0000-0000-0000-000000000005') $$,
  '42501', null,
  'a parent cannot forge created_by to another profile (author pin)');
```

- [ ] **Step 4: Run pgTAP — expect exactly this test RED**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase test db 2>&1 | tail -8
```

Expected FAIL: file `13` reports the new test failing (the forged insert currently succeeds — the policy has no author constraint); all other files green.

- [ ] **Step 5: The migration**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase migration new absence_notice_author_pin
```

Write `supabase/migrations/<ts>_absence_notice_author_pin.sql`:

```sql
-- Phase-2 review rider: pin the notice author. The INSERT policy verified the
-- guardian/admin RELATIONSHIP but let the row claim any created_by profile —
-- harmless through the DAL (which sets user.id) but forgeable via direct
-- PostgREST. Defense-in-depth: the author column must be the caller.
alter policy "absence_notices_insert_guardian_or_admin"
  on public.absence_notices
  with check (
    (
      private.has_role((select auth.uid()), 'admin')
      or private.is_guardian_of((select auth.uid()), student_id)
    )
    and created_by = (select auth.uid())
  );
```

- [ ] **Step 6: Apply and verify GREEN**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase db reset 2>&1 | tail -4
supabase test db 2>&1 | tail -6
```

Expected: all 15 files pass — `13` now **23/23**. Total pgTAP: **281**.

- [ ] **Step 7: Rider — `generateLessonsForTerm` throws on an empty RPC reply**

In `src/lib/dal/lessons.ts`, replace:

```ts
  const row = Array.isArray(data) ? data[0] : data;
  return { created: row?.created ?? 0, skipped: row?.skipped ?? 0 };
```

with:

```ts
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    // The SQL function always returns exactly one row; an empty reply means a
    // driver/protocol anomaly — fail loud instead of reporting a cheerful 0/0.
    throw new Error('Kunne ikke generere timer: tomt svar fra databasen.');
  }
  return { created: row.created, skipped: row.skipped };
```

(No new test: the live function cannot return zero rows, so the guard is unreachable against the real stack — documented here instead, per the Phase-2 review note.)

- [ ] **Step 8: Rider — history reads use `lessons!inner` (no silent client-side drop)**

In `src/lib/dal/attendance.ts`, in **each** of `getChildAttendanceHistory`, `getOwnAttendanceHistory`, and `getStudentAttendanceForAdmin`: change the select string

```ts
    .select('lesson_id, status, note, lessons(date, classes(name))')
```

to

```ts
    .select('lesson_id, status, note, lessons!inner(date, classes(name))')
```

and replace each mapping chain

```ts
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
```

with

```ts
  return (data ?? [])
    .map((r) => ({
      lesson_id: r.lesson_id,
      date: r.lessons.date,
      class_name: r.lessons.classes?.name ?? '',
      status: r.status,
      note: r.note,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
```

(The inner join expresses the same semantics in the query — a row whose lesson is invisible never arrives — instead of a silent client filter over a non-null assertion.)

- [ ] **Step 9: Verify walls 1**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck
npm run lint
npx vitest run --config vitest.config.api.ts tests/api/attendance-core.test.ts tests/api/attendance-actions.test.ts 2>&1 | tail -4
```

Expected: typecheck/lint silent; both attendance API files green (same counts as Phase 2 — the riders change no observable behavior).

- [ ] **Step 10: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add .github/workflows/ci.yml supabase/migrations/*_absence_notice_author_pin.sql supabase/tests/13_absence_notices_rls.sql src/lib/dal/lessons.ts src/lib/dal/attendance.ts
git commit -m "fix: phase-2 review riders — author-pinned notices, strict history joins, CI on real"
```

---

### Task 2: Migration — `curriculum_books` + `settings.grade_scale`

The curriculum catalog (school structure, like `lessons`: no audit trigger) and the settings-driven grade scale (D5). Books are admin-managed; the catalog is readable by every portal role **except economy** (mirror of the `subjects` SELECT policy — "economy sees no pedagogy"). The `grade_scale` column backfills the single settings row with the demo-mined default.

**Files:**
- Create: `supabase/tests/15_curriculum_books_rls.sql`
- Create: `supabase/migrations/<ts>_curriculum_books.sql` (via `supabase migration new curriculum_books`)

- [ ] **Step 1: Write the failing pgTAP file**

Create `supabase/tests/15_curriculum_books_rls.sql` (fixtures `b3…`):

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- Hermetic fixtures (header gotcha 13): clear seed rows, children before parents.
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

insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.email, '{"provider":"email","providers":["email"]}',
       jsonb_build_object('full_name', u.full_name), now(), now()
from (values
  ('b3000000-0000-0000-0000-000000000001'::uuid, 'pgtap-cb-admin@test.local',   'CB Admin'),
  ('b3000000-0000-0000-0000-000000000002'::uuid, 'pgtap-cb-laerer@test.local',  'CB Lærer'),
  ('b3000000-0000-0000-0000-000000000004'::uuid, 'pgtap-cb-forelder@test.local','CB Forelder'),
  ('b3000000-0000-0000-0000-000000000006'::uuid, 'pgtap-cb-elev@test.local',    'CB Elev'),
  ('b3000000-0000-0000-0000-000000000007'::uuid, 'pgtap-cb-okonomi@test.local', 'CB Økonomi')
) as u(id, email, full_name);
insert into public.user_roles (user_id, role) values
  ('b3000000-0000-0000-0000-000000000001', 'admin'),
  ('b3000000-0000-0000-0000-000000000002', 'teacher'),
  ('b3000000-0000-0000-0000-000000000004', 'parent'),
  ('b3000000-0000-0000-0000-000000000006', 'student'),
  ('b3000000-0000-0000-0000-000000000007', 'economy');

insert into public.subjects (id, name) values
  ('b3000000-0000-0000-0000-000000000041', 'CB Fag A'),
  ('b3000000-0000-0000-0000-000000000042', 'CB Fag B');

-- ── Schema shape ────────────────────────────────────────────────────
select has_table('public'::name, 'curriculum_books'::name, 'curriculum_books table exists');
select ok((select relrowsecurity from pg_class
           where oid = 'public.curriculum_books'::regclass), 'RLS enabled on curriculum_books');
select has_column('public'::name, 'settings'::name, 'grade_scale'::name, 'settings.grade_scale exists');
select is(
  (select grade_scale from public.settings),
  array['Utmerket', 'Meget god', 'God', 'Under arbeid'],
  'grade_scale backfilled with the default scale');
select throws_ok(
  $$ insert into public.curriculum_books (subject_id, title, total_units)
     values ('b3000000-0000-0000-0000-000000000041', 'CB Tom bok', 0) $$,
  '23514', null,
  'total_units below 1 is rejected');
select throws_ok(
  $$ insert into public.curriculum_books (subject_id, title, unit_label, total_units)
     values ('b3000000-0000-0000-0000-000000000041', 'CB Rar enhet', 'kapittel', 10) $$,
  '23514', null,
  'unit_label outside side/leksjon/enhet is rejected');

-- ── Write matrix ────────────────────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"b3000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.curriculum_books (id, subject_id, title, level, unit_label, total_units)
     values ('b3000000-0000-0000-0000-000000000051',
             'b3000000-0000-0000-0000-000000000041', 'CB Bok 1', 1, 'side', 30) $$,
  'admin creates a book');
select throws_ok(
  $$ insert into public.curriculum_books (subject_id, title, total_units)
     values ('b3000000-0000-0000-0000-000000000041', 'CB Bok 1', 30) $$,
  '23505', null,
  'duplicate (subject, title) is rejected');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b3000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.curriculum_books (subject_id, title, total_units)
     values ('b3000000-0000-0000-0000-000000000041', 'CB Lærerbok', 20) $$,
  '42501', null,
  'a teacher cannot create books (admin-only writes)');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b3000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.curriculum_books (subject_id, title, total_units)
     values ('b3000000-0000-0000-0000-000000000041', 'CB Økonomibok', 20) $$,
  '42501', null,
  'economy cannot create books');
reset role;

-- ── Read matrix (the one admin-created book) ────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"b3000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.curriculum_books), 1::bigint,
  'the teacher reads the catalog');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b3000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.curriculum_books), 1::bigint,
  'a parent reads the catalog');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b3000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.curriculum_books), 1::bigint,
  'a student login reads the catalog');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b3000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.curriculum_books), 0::bigint,
  'economy sees zero books (no pedagogy)');
reset role;

-- ── UPDATE / cascade ────────────────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"b3000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ update public.curriculum_books set total_units = 32
     where id = 'b3000000-0000-0000-0000-000000000051' $$,
  'admin edits a book');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b3000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ update public.curriculum_books set title = 'CB Kapret'
     where id = 'b3000000-0000-0000-0000-000000000051' $$,
  'a teacher UPDATE matches no row (policy USING denies)');
reset role;
select is(
  (select title from public.curriculum_books
   where id = 'b3000000-0000-0000-0000-000000000051'), 'CB Bok 1',
  'the teacher did not change the title');

select lives_ok(
  $$ delete from public.subjects where id = 'b3000000-0000-0000-0000-000000000041' $$,
  'deleting the subject cascades its catalog (no student data attached yet)');

select * from finish();
rollback;
```

- [ ] **Step 2: Run pgTAP — expect 15 RED**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase test db 2>&1 | tail -10
```

Expected FAIL: `15_curriculum_books_rls` errors with `relation "public.curriculum_books" does not exist`; `00`–`14` stay green.

- [ ] **Step 3: Create the migration**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase migration new curriculum_books
```

Write `supabase/migrations/<ts>_curriculum_books.sql`:

```sql
-- Curriculum catalog (D3) + the settings-driven grade scale (D5). Books are
-- school structure like lessons: no audit trigger, admin-managed, readable by
-- every portal role EXCEPT economy (subjects-policy mirror — "economy sees no
-- pedagogy"). No Koran books: quran_tracking subjects use the Quran tracker.

-- Grade scale (term_grades validates against the CURRENT scale app-side at
-- entry time; stored grades survive later scale edits — deliberately NO db
-- check referencing this column, pinned by pgTAP in 19_term_grades_rls).
alter table public.settings
  add column grade_scale text[] not null
    default array['Utmerket', 'Meget god', 'God', 'Under arbeid'];

create table public.curriculum_books (
  id          uuid primary key default gen_random_uuid(),
  subject_id  uuid not null references public.subjects (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 80),
  level       integer not null default 1 check (level between 1 and 20),
  unit_label  text not null default 'side' check (unit_label in ('side', 'leksjon', 'enhet')),
  total_units integer not null check (total_units between 1 and 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint curriculum_books_unique_title unique (subject_id, title)
);
comment on table public.curriculum_books is
  'Curriculum catalog per subject (Alfabet og lyder, …). level orders a subject''s book ladder; unit_label is the counting noun (side/leksjon/enhet); progress_entries reference books with on delete set null so history survives catalog surgery. Admin-managed; readable by every portal role except economy.';

create trigger curriculum_books_set_updated_at
  before update on public.curriculum_books
  for each row execute function private.set_updated_at();

-- ── Grant layer (wall 2a) ───────────────────────────────────────────
revoke all on table public.curriculum_books from anon, authenticated, service_role;
grant select, insert, update, delete on public.curriculum_books to authenticated;
grant select on public.curriculum_books to service_role;

alter table public.curriculum_books enable row level security;

-- SELECT: every portal role except economy (subjects mirror).
create policy "curriculum_books_select_portal_roles"
  on public.curriculum_books for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.has_role((select auth.uid()), 'teacher')
    or private.has_role((select auth.uid()), 'parent')
    or private.has_role((select auth.uid()), 'student')
  );
-- Writes: admin only.
create policy "curriculum_books_insert_admin"
  on public.curriculum_books for insert to authenticated
  with check (private.has_role((select auth.uid()), 'admin'));
create policy "curriculum_books_update_admin"
  on public.curriculum_books for update to authenticated
  using (private.has_role((select auth.uid()), 'admin'))
  with check (private.has_role((select auth.uid()), 'admin'));
create policy "curriculum_books_delete_admin"
  on public.curriculum_books for delete to authenticated
  using (private.has_role((select auth.uid()), 'admin'));
```

- [ ] **Step 4: Apply and verify GREEN**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase db reset 2>&1 | tail -4
supabase test db 2>&1 | tail -6
```

Expected: all 16 files pass — `15_curriculum_books_rls` **18/18**; firewall `00` still green (the new table's grants are narrow). Total pgTAP: **299**.

- [ ] **Step 5: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add supabase/tests/15_curriculum_books_rls.sql supabase/migrations/*_curriculum_books.sql
git commit -m "feat: curriculum book catalog and settings-driven grade scale"
```

---

### Task 3: Migration — `progress_entries` + `quran_entries` + the log-table helpers

The two append-only pedagogy logs (D1) and the two helpers their walls need: `taught_student_ever_unprotected` (D6 — the `protected = false` qualifier must live in the helper because `protected` is not a local column here) and `teaches_student_subject` (the **double-bind**: a teacher may only log progress in a subject actually offered to that student's active class — the C-1 regression class, closed at wall 2). Both tables: no UPDATE grant at all (append-only for *everyone*, admin included); retract = author-or-admin DELETE; audit triggers (student data).

**Simplification vs the contract table:** `teaches_student_subject` already implies an active `teaches_student` (it joins the open enrollment + the teacher link + the subject), so the `progress_entries` INSERT policy is simply `admin OR teaches_student_subject(...)`.

**Files:**
- Create: `supabase/tests/16_progress_entries_rls.sql`
- Create: `supabase/tests/17_quran_entries_rls.sql`
- Create: `supabase/migrations/<ts>_progress_quran_entries.sql` (via `supabase migration new progress_quran_entries`)

- [ ] **Step 1: Write the failing pgTAP file for `progress_entries`**

Create `supabase/tests/16_progress_entries_rls.sql` (fixtures `b4…`; teacher1/class A + subject SA, teacher2/class B + subject SB, one non-protected leaver `s3` and one protected leaver `s4` both formerly in class A):

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

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

insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.email, '{"provider":"email","providers":["email"]}',
       jsonb_build_object('full_name', u.full_name), now(), now()
from (values
  ('b4000000-0000-0000-0000-000000000001'::uuid, 'pgtap-pe-admin@test.local',    'PE Admin'),
  ('b4000000-0000-0000-0000-000000000002'::uuid, 'pgtap-pe-laerer1@test.local',  'PE Lærer En'),
  ('b4000000-0000-0000-0000-000000000003'::uuid, 'pgtap-pe-laerer2@test.local',  'PE Lærer To'),
  ('b4000000-0000-0000-0000-000000000004'::uuid, 'pgtap-pe-forelderA@test.local','PE Forelder A'),
  ('b4000000-0000-0000-0000-000000000005'::uuid, 'pgtap-pe-forelderB@test.local','PE Forelder B'),
  ('b4000000-0000-0000-0000-000000000006'::uuid, 'pgtap-pe-elev@test.local',     'PE Elev'),
  ('b4000000-0000-0000-0000-000000000007'::uuid, 'pgtap-pe-okonomi@test.local',  'PE Økonomi')
) as u(id, email, full_name);
insert into public.user_roles (user_id, role) values
  ('b4000000-0000-0000-0000-000000000001', 'admin'),
  ('b4000000-0000-0000-0000-000000000002', 'teacher'),
  ('b4000000-0000-0000-0000-000000000003', 'teacher'),
  ('b4000000-0000-0000-0000-000000000004', 'parent'),
  ('b4000000-0000-0000-0000-000000000005', 'parent'),
  ('b4000000-0000-0000-0000-000000000006', 'student'),
  ('b4000000-0000-0000-0000-000000000007', 'economy');

insert into public.terms (id, name, starts_on, ends_on) values
  ('b4000000-0000-0000-0000-000000000011', 'PE Termin', '2026-08-15', '2026-12-20');
insert into public.classes (id, term_id, name) values
  ('b4000000-0000-0000-0000-000000000021', 'b4000000-0000-0000-0000-000000000011', 'PE Klasse A'),
  ('b4000000-0000-0000-0000-000000000022', 'b4000000-0000-0000-0000-000000000011', 'PE Klasse B');
insert into public.class_teachers (class_id, teacher_id) values
  ('b4000000-0000-0000-0000-000000000021', 'b4000000-0000-0000-0000-000000000002'),
  ('b4000000-0000-0000-0000-000000000022', 'b4000000-0000-0000-0000-000000000003');
insert into public.subjects (id, name) values
  ('b4000000-0000-0000-0000-000000000041', 'PE Fag A'),
  ('b4000000-0000-0000-0000-000000000042', 'PE Fag B');
insert into public.class_subjects (class_id, subject_id) values
  ('b4000000-0000-0000-0000-000000000021', 'b4000000-0000-0000-0000-000000000041'),
  ('b4000000-0000-0000-0000-000000000022', 'b4000000-0000-0000-0000-000000000042');
insert into public.students (id, first_name, last_name, birth_year, protected, student_user_id) values
  ('b4000000-0000-0000-0000-000000000031', 'PE', 'Elev En',   2014, false, 'b4000000-0000-0000-0000-000000000006'),
  ('b4000000-0000-0000-0000-000000000032', 'PE', 'Elev To',   2015, false, null),
  ('b4000000-0000-0000-0000-000000000033', 'PE', 'Sluttet',   2013, false, null),
  ('b4000000-0000-0000-0000-000000000034', 'PE', 'Skjermet',  2013, true,  null);
insert into public.guardian_student (guardian_id, student_id) values
  ('b4000000-0000-0000-0000-000000000004', 'b4000000-0000-0000-0000-000000000031'),
  ('b4000000-0000-0000-0000-000000000004', 'b4000000-0000-0000-0000-000000000033'),
  ('b4000000-0000-0000-0000-000000000005', 'b4000000-0000-0000-0000-000000000032');
insert into public.class_students (class_id, student_id, enrolled_on, left_on) values
  ('b4000000-0000-0000-0000-000000000021', 'b4000000-0000-0000-0000-000000000031', '2026-08-20', null),
  ('b4000000-0000-0000-0000-000000000022', 'b4000000-0000-0000-0000-000000000032', '2026-08-20', null),
  ('b4000000-0000-0000-0000-000000000021', 'b4000000-0000-0000-0000-000000000033', '2026-08-20', '2026-09-01'),
  ('b4000000-0000-0000-0000-000000000021', 'b4000000-0000-0000-0000-000000000034', '2026-08-20', '2026-09-01');

-- ── Schema shape + helpers ──────────────────────────────────────────
select has_table('public'::name, 'progress_entries'::name, 'progress_entries table exists');
select ok((select relrowsecurity from pg_class
           where oid = 'public.progress_entries'::regclass), 'RLS enabled on progress_entries');
select has_function('private'::name, 'taught_student_ever_unprotected'::name,
  array['uuid', 'uuid'], 'taught_student_ever_unprotected exists');
select has_function('private'::name, 'teaches_student_subject'::name,
  array['uuid', 'uuid', 'uuid'], 'teaches_student_subject exists');

-- ── INSERT matrix (the double bind) ─────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"b4000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.progress_entries (id, student_id, subject_id, unit_reached, recorded_by)
     values ('b4000000-0000-0000-0000-000000000051',
             'b4000000-0000-0000-0000-000000000031',
             'b4000000-0000-0000-0000-000000000041', 6,
             'b4000000-0000-0000-0000-000000000002') $$,
  'the teacher logs progress for an own active student in an offered subject');
select throws_ok(
  $$ insert into public.progress_entries (student_id, subject_id, unit_reached, recorded_by)
     values ('b4000000-0000-0000-0000-000000000031',
             'b4000000-0000-0000-0000-000000000042', 3,
             'b4000000-0000-0000-0000-000000000002') $$,
  '42501', null,
  'DOUBLE BIND: the subject must be offered to the student''s class (foreign subject rejected)');
select throws_ok(
  $$ insert into public.progress_entries (student_id, subject_id, unit_reached, recorded_by)
     values ('b4000000-0000-0000-0000-000000000032',
             'b4000000-0000-0000-0000-000000000041', 3,
             'b4000000-0000-0000-0000-000000000002') $$,
  '42501', null,
  'DOUBLE BIND: a foreign-class student is rejected (fine-derived #4 write-side)');
select throws_ok(
  $$ insert into public.progress_entries (student_id, subject_id, unit_reached, recorded_by)
     values ('b4000000-0000-0000-0000-000000000033',
             'b4000000-0000-0000-0000-000000000041', 3,
             'b4000000-0000-0000-0000-000000000002') $$,
  '42501', null,
  'writes require an ACTIVE enrollment — a leaver cannot be logged');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b4000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.progress_entries (student_id, subject_id, unit_reached, recorded_by)
     values ('b4000000-0000-0000-0000-000000000031',
             'b4000000-0000-0000-0000-000000000041', 3,
             'b4000000-0000-0000-0000-000000000004') $$,
  '42501', null,
  'a parent never writes progress');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b4000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.progress_entries (student_id, subject_id, unit_reached, recorded_by)
     values ('b4000000-0000-0000-0000-000000000031',
             'b4000000-0000-0000-0000-000000000041', 3,
             'b4000000-0000-0000-0000-000000000007') $$,
  '42501', null,
  'economy never writes progress');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b4000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.progress_entries (id, student_id, subject_id, unit_reached, recorded_by)
     values ('b4000000-0000-0000-0000-000000000052',
             'b4000000-0000-0000-0000-000000000031',
             'b4000000-0000-0000-0000-000000000041', 8,
             'b4000000-0000-0000-0000-000000000001') $$,
  'admin may log directly (matrix RW all)');
reset role;

-- ── Append-only: no UPDATE for anyone (D1) ──────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"b4000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ update public.progress_entries set unit_reached = 7
     where id = 'b4000000-0000-0000-0000-000000000051' $$,
  '42501', null,
  'the log is append-only — even the author cannot UPDATE (no grant)');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"b4000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ update public.progress_entries set unit_reached = 7
     where id = 'b4000000-0000-0000-0000-000000000051' $$,
  '42501', null,
  'append-only holds for admin too');
reset role;

-- ── Read matrix (2 rows on student En) ──────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"b4000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.progress_entries), 2::bigint,
  'the teacher reads their student''s log');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b4000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.progress_entries), 2::bigint,
  'the guardian reads their child''s log');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b4000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.progress_entries), 2::bigint,
  'the student login reads its own log');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b4000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.progress_entries), 0::bigint,
  'BERGEN #1: the other family''s parent sees nothing');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b4000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.progress_entries), 0::bigint,
  'fine-derived #4: the other class''s teacher sees nothing');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b4000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.progress_entries), 0::bigint,
  'economy sees zero pedagogy');
reset role;

-- ── History: leavers (D6) — rows planted past RLS as superuser ──────
insert into public.progress_entries (id, student_id, subject_id, unit_reached, recorded_by) values
  ('b4000000-0000-0000-0000-000000000053', 'b4000000-0000-0000-0000-000000000033',
   'b4000000-0000-0000-0000-000000000041', 10, 'b4000000-0000-0000-0000-000000000002'),
  ('b4000000-0000-0000-0000-000000000054', 'b4000000-0000-0000-0000-000000000034',
   'b4000000-0000-0000-0000-000000000041', 10, 'b4000000-0000-0000-0000-000000000002');

select set_config('request.jwt.claims',
  '{"sub":"b4000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*) from public.progress_entries
   where student_id = 'b4000000-0000-0000-0000-000000000033'), 1::bigint,
  'the teacher keeps a NON-protected leaver''s history (taught_student_ever_unprotected)');
select is(
  (select count(*) from public.progress_entries
   where student_id = 'b4000000-0000-0000-0000-000000000034'), 0::bigint,
  'fine-derived #2: the PROTECTED leaver''s history is gone for the teacher');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b4000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*) from public.progress_entries
   where student_id = 'b4000000-0000-0000-0000-000000000033'), 1::bigint,
  'the guardian keeps the child''s history after unenrollment (no enrollment filter)');
reset role;

-- ── Retract (author-or-admin DELETE) + audit ────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"b4000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ delete from public.progress_entries
     where id = 'b4000000-0000-0000-0000-000000000051' $$,
  'the author retracts their own entry');
reset role;

select is(
  (select count(*) from public.audit_log
   where action = 'progress_entries.insert'
     and actor_id = 'b4000000-0000-0000-0000-000000000002'
     and entity_id = 'b4000000-0000-0000-0000-000000000051'),
  1::bigint,
  'progress_entries.insert audit: actor pinned to the logging teacher');

select * from finish();
rollback;
```

- [ ] **Step 2: Write the failing pgTAP file for `quran_entries`**

Create `supabase/tests/17_quran_entries_rls.sql` (fixtures `b5…`). Same graph shape as file 16 **minus subjects/class_subjects** (Quran entries carry no subject_id — the actor→student bind is the whole write wall) and with the structural checks swapped for the surah/ayah constraints. Fixture ids: users `b5…01`–`07` (emails `pgtap-qe-…@test.local`, names prefixed `QE`), term `b5…11`, classes `b5…21`/`22`, students `b5…31` (active class A, guardian `…04`, login `…06`), `…32` (active class B, guardian `…05`), `…33` (non-protected leaver of class A, guardian `…04`), `…34` (protected leaver of class A); class_teachers `…21`→`…02`, `…22`→`…03`; enrollment intervals identical to file 16.

The test sequence (plan **21**):

```sql
select plan(21);
```

1–2: `has_table` / RLS enabled for `quran_entries`.
3–4: `throws_ok` `23514` — surah `115` rejected; `ayah_to < ayah_from` rejected (both as superuser, before any `set role`).
5: teacher1 logs on student `…31` **lives** (`id` `b5000000-0000-0000-0000-000000000051`, surah 114, ayah 1–6, `new`/`pass`, `recorded_by` `…02`).
6–7: teacher1 → foreign-class student `…32` **42501**; teacher1 → leaver `…33` **42501** (active-enrollment write wall).
8–9: parentA insert **42501**; economy insert **42501**.
10: admin insert **lives** (`id` `b5…52` on `…31`, surah 113, 1–5, `recent`/`pass`).
11–12: author UPDATE **42501**; admin UPDATE **42501** (append-only, no grant).
13–15: teacher1 count = 2; parentA count = 2; student login count = 2.
16–18: parentB count = 0 (**BERGEN #1**); teacher2 count = 0 (**fine-derived #4**); economy count = 0.
Then superuser plants leaver rows `b5…53` (student `…33`) and `b5…54` (student `…34`):
19–20: teacher1 sees the non-protected leaver's row (count 1 for `…33`); sees **zero** for the protected leaver `…34` (**fine-derived #2**).
21: audit pin — `quran_entries.insert` row with `actor_id = b5…02` and `entity_id = b5…51`.

Follow file 16's exact session/`set_config` rhythm; every test string states the wall it proves.

- [ ] **Step 3: Run pgTAP — expect 16 and 17 RED**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase test db 2>&1 | tail -10
```

Expected FAIL: both new files error with `relation … does not exist`; `00`–`15` stay green.

- [ ] **Step 4: Create the migration**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase migration new progress_quran_entries
```

Write `supabase/migrations/<ts>_progress_quran_entries.sql`:

```sql
-- The two append-only pedagogy logs (D1/D2): book-position entries and Quran
-- memorisation entries. Current standing is DERIVED (latest per book; latest
-- entry = position; weak spot = surah whose latest entry is repeat) — no
-- mutable "current" column. A mistaken entry is retracted (author/admin
-- DELETE) and re-logged; there is NO update grant for anyone. Audit triggers
-- (student data). lesson_id is reserved (nullable, set null) — v1 writes NULL.

-- ── Helpers ─────────────────────────────────────────────────────────
-- D6: taught_student_ever minus protected students. The students-table policy
-- spells "protected = false" inline (local column); assessment tables must
-- carry the exclusion INSIDE the helper.
create or replace function private.taught_student_ever_unprotected(uid uuid, sid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.class_students cs
    join public.class_teachers ct on ct.class_id = cs.class_id
    join public.students s on s.id = cs.student_id
    where cs.student_id = sid
      and ct.teacher_id = uid
      and s.protected = false
  );
$$;
revoke execute on function private.taught_student_ever_unprotected(uuid, uuid) from public;
grant execute on function private.taught_student_ever_unprotected(uuid, uuid) to authenticated;

-- The double bind for subject-scoped logging: uid teaches an ACTIVE class of
-- the student that offers the subject. Implies teaches_student.
create or replace function private.teaches_student_subject(uid uuid, sid uuid, subj uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.class_students cs
    join public.class_teachers ct on ct.class_id = cs.class_id
    join public.class_subjects csub on csub.class_id = cs.class_id
    where cs.student_id = sid
      and ct.teacher_id = uid
      and cs.left_on is null
      and csub.subject_id = subj
  );
$$;
revoke execute on function private.teaches_student_subject(uuid, uuid, uuid) from public;
grant execute on function private.teaches_student_subject(uuid, uuid, uuid) to authenticated;

-- ── progress_entries ────────────────────────────────────────────────
create table public.progress_entries (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students (id) on delete cascade,
  subject_id   uuid not null references public.subjects (id) on delete restrict,
  book_id      uuid references public.curriculum_books (id) on delete set null,
  lesson_id    uuid references public.lessons (id) on delete set null,
  unit_reached integer not null check (unit_reached between 0 and 1000),
  note         text check (note is null or char_length(note) <= 500),
  recorded_by  uuid not null references public.profiles (id),
  recorded_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
comment on table public.progress_entries is
  'Append-only book/position log (D1/D2): latest row per (student, book) is the current standing. No UPDATE grant for anyone; a mistaken entry is retracted (author/admin DELETE) and re-logged. subject_id restrict (a subject in use cannot be deleted); book_id/lesson_id set null (history survives catalog/calendar surgery).';

create trigger progress_entries_audit
  after insert or update or delete on public.progress_entries
  for each row execute function private.audit_row_change('id');

revoke all on table public.progress_entries from anon, authenticated, service_role;
grant select, insert, delete on public.progress_entries to authenticated;
grant select, delete         on public.progress_entries to service_role;

alter table public.progress_entries enable row level security;

create policy "progress_entries_select_related"
  on public.progress_entries for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_student((select auth.uid()), student_id)
    or private.taught_student_ever_unprotected((select auth.uid()), student_id)
    or private.is_guardian_of((select auth.uid()), student_id)
    or private.is_linked_student((select auth.uid()), student_id)
  );
create policy "progress_entries_insert_teacher_or_admin"
  on public.progress_entries for insert to authenticated
  with check (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_student_subject((select auth.uid()), student_id, subject_id)
  );
create policy "progress_entries_delete_author_or_admin"
  on public.progress_entries for delete to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or recorded_by = (select auth.uid())
  );

-- ── quran_entries ───────────────────────────────────────────────────
create table public.quran_entries (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students (id) on delete cascade,
  lesson_id   uuid references public.lessons (id) on delete set null,
  date        date not null,
  kind        public.quran_kind not null,
  surah       smallint not null check (surah between 1 and 114),
  ayah_from   smallint not null check (ayah_from >= 1),
  ayah_to     smallint not null,
  result      public.quran_result not null,
  note        text check (note is null or char_length(note) <= 500),
  recorded_by uuid not null references public.profiles (id),
  created_at  timestamptz not null default now(),
  constraint quran_entries_ayah_range check (ayah_to >= ayah_from)
);
comment on table public.quran_entries is
  'Append-only Quran memorisation log (D1/D2): kind = stream (new/recent/longterm), result = pass/repeat. Position and weak spots derive from history. Per-surah ayah bounds are validated app-side against the static SURAHS table; the db holds the structural checks only. No UPDATE grant; retract = author/admin DELETE.';

create trigger quran_entries_audit
  after insert or update or delete on public.quran_entries
  for each row execute function private.audit_row_change('id');

revoke all on table public.quran_entries from anon, authenticated, service_role;
grant select, insert, delete on public.quran_entries to authenticated;
grant select, delete         on public.quran_entries to service_role;

alter table public.quran_entries enable row level security;

create policy "quran_entries_select_related"
  on public.quran_entries for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_student((select auth.uid()), student_id)
    or private.taught_student_ever_unprotected((select auth.uid()), student_id)
    or private.is_guardian_of((select auth.uid()), student_id)
    or private.is_linked_student((select auth.uid()), student_id)
  );
create policy "quran_entries_insert_teacher_or_admin"
  on public.quran_entries for insert to authenticated
  with check (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_student((select auth.uid()), student_id)
  );
create policy "quran_entries_delete_author_or_admin"
  on public.quran_entries for delete to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or recorded_by = (select auth.uid())
  );
```

Note the enum types `quran_kind`/`quran_result` are created here too — prepend, before the tables:

```sql
create type public.quran_kind   as enum ('new', 'recent', 'longterm');
create type public.quran_result as enum ('pass', 'repeat');
```

- [ ] **Step 5: Apply and verify GREEN**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase db reset 2>&1 | tail -4
supabase test db 2>&1 | tail -8
```

Expected: all 18 files pass — `16` **24/24**, `17` **21/21**; firewall `00` green. Total pgTAP: **344**.

- [ ] **Step 6: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add supabase/tests/16_progress_entries_rls.sql supabase/tests/17_quran_entries_rls.sql supabase/migrations/*_progress_quran_entries.sql
git commit -m "feat: append-only progress and quran logs with double-bound teacher writes"
```

---

### Task 4: Migration — `tests` + `test_results` + the test-anchored helpers

Class tests (school structure, teacher-created/edited, admin-deleted — D4) and per-student results (student data, upsert-corrected like attendance). Results are **test-anchored** the way attendance is lesson-anchored: `teaches_test` mirrors `teaches_lesson` (no enrollment filter — history survives), and the INSERT double bind uses `student_in_test_class` — the roster **as of `held_on`** (interval, `left_on` exclusive), NOT current enrollment. Guardian/student visibility of test *metadata* behind old results comes from `guardian_sees_test`/`student_sees_test` (mirrors of the lesson pair).

> **Enumerated pgTAP form (here and in later tasks):** where a test sequence is enumerated instead of spelled as SQL, the implementer authors the SQL following the *sibling file's exact rhythm* (session `set_config`/`set local role`/`reset role` blocks, `lives_ok`/`throws_ok`/`is` shapes); the enumeration pins ids, error codes, expected counts, and the test description strings. Spec review verifies every pin.

**Files:**
- Create: `supabase/tests/18_tests_rls.sql`
- Create: `supabase/migrations/<ts>_tests_results.sql` (via `supabase migration new tests_results`)

- [ ] **Step 1: Write the failing pgTAP file**

Create `supabase/tests/18_tests_rls.sql` (fixtures `b6…`, emails `pgtap-ts-…@test.local`, names prefixed `TS`). Fixture graph: users `b6…01` admin, `…02` teacher1, `…03` teacher2, `…04` parentA, `…05` parentB, `…06` elev (login of s1), `…07` economy; term `b6…11`; classes `b6…21` (A, teacher1) + `…22` (B, teacher2); subjects `b6…41` SA → class A, `…42` SB → class B (via `class_subjects`); students `b6…31` s1 (active A, guardian parentA, login `…06`), `…32` s2 (active B, guardian parentB), `…33` s3 (**leaver** of A: enrolled 2026-08-20, left 2026-09-01, guardian parentA), `…34` s4 (protected leaver of A, same interval). The interval semantics hang on two test dates: `T1` = `b6000000-0000-0000-0000-000000000061` held **2026-08-25** (inside s3/s4's interval) and `T2` = `b6…62` held **2026-09-10** (after s3 left).

The sequence (`select plan(30);`):

1–4: `has_table` + RLS-enabled for `tests` and `test_results`.
5–8: `has_function` for `private.teaches_test(uuid,uuid)`, `student_in_test_class(uuid,uuid)`, `guardian_sees_test(uuid,uuid)`, `student_sees_test(uuid,uuid)`.
9: teacher1 **creates T1** (`lives_ok` — class A, SA, held_on 2026-08-25, max_points 20) — 'the class teacher creates a test'.
10: teacher2 creating a test **in class A** → `42501` — 'fine-derived #4: a foreign teacher cannot create tests in the class'.
11: parentA creating a test → `42501` — 'a parent never creates tests'.
12: teacher1 **creates T2** (`lives_ok` — class A, SA, held_on 2026-09-10, max_points 10).
13: teacher1 edits T1's title (`lives_ok`, `teaches_test` UPDATE path) — 'the test''s teacher edits it'.
14–15: teacher2 UPDATE on T1 matches no row (`lives_ok`) + title unchanged (`is`) — 'a foreign teacher''s edit matches no row (policy USING denies)'.
16–17: teacher1 DELETE on T1 matches no row (`lives_ok`) + T1 still exists (`is` count 1) — 'test DELETE is admin-only (D4); the teacher''s delete matches nothing'.
18: teacher1 upserts a result for **s1 on T1** (`lives_ok` — points 18, recorded_by `…02`) — 'the teacher enters a result for a rostered student'.
19: **DOUBLE BIND** — teacher1 inserts a result on T1 for **s2** (never in class A) → `42501` — 'C-1 regression class: an off-roster student is rejected at wall 2'.
20: **INTERVAL** — teacher1 inserts a result on **T2** for **s3** (left 2026-09-01 < held_on 2026-09-10) → `42501` — 'the roster is as-of held_on: a student who left before the test is off-roster'.
21: **INTERVAL** — teacher1 inserts a result on **T1** for **s3** (`lives_ok` — enrolled on 2026-08-25) — 'a student enrolled on the test date is rostered even after leaving later'.
22: teacher2 inserting a result on T1 for s1 → `42501` — 'a foreign teacher cannot write results'.
23: economy inserting a result → `42501`.
24: teacher1 UPDATEs s1's T1 result to points 19 (`lives_ok`) — 'corrections are upserts by the test''s teacher'.
25: parentA reads results: count **2** (s1@T1 + s3@T1) — 'the guardian reads all own-children results (incl. after unenrollment)'.
26: parentA reads `tests`: count **2** (T1+T2 via `guardian_in_class` for active s1) — 'the guardian sees the class''s tests'.
27: the student login reads results: count **1** (own only).
28: parentB reads results: count **0** — 'BERGEN #1: the other family sees nothing'.
29: economy reads results: count **0**.
30: audit pin — one `audit_log` row `action='test_results.insert'`, `actor_id=b6…02`, `entity_id='b6000000-0000-0000-0000-000000000061'` (first trigger arg is `test_id`) — 'test_results.insert audit: actor pinned to the entering teacher'.

- [ ] **Step 2: Run pgTAP — expect 18 RED**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase test db 2>&1 | tail -8
```

Expected FAIL: `18_tests_rls` errors with `relation "public.tests" does not exist`; `00`–`17` stay green.

- [ ] **Step 3: Create the migration**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase migration new tests_results
```

Write `supabase/migrations/<ts>_tests_results.sql`:

```sql
-- Class tests + per-student results (D4). tests = school structure (like
-- lessons: teacher-managed, no audit trigger); test_results = student data
-- (audit trigger, upsert-corrected like attendance). Results are test-anchored:
-- teaches_test mirrors teaches_lesson (no enrollment filter — history
-- survives); the INSERT double bind pins the student to the test's roster AS OF
-- held_on (student_in_test_class, interval, left_on exclusive).

-- ── Helpers ─────────────────────────────────────────────────────────
create or replace function private.teaches_test(uid uuid, tid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.tests t
    join public.class_teachers ct on ct.class_id = t.class_id
    where t.id = tid and ct.teacher_id = uid
  );
$$;
revoke execute on function private.teaches_test(uuid, uuid) from public;
grant execute on function private.teaches_test(uuid, uuid) to authenticated;

create or replace function private.student_in_test_class(sid uuid, tid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.tests t
    join public.class_students cs on cs.class_id = t.class_id
    where t.id = tid
      and cs.student_id = sid
      and cs.enrolled_on <= t.held_on
      and (cs.left_on is null or t.held_on < cs.left_on)
  );
$$;
revoke execute on function private.student_in_test_class(uuid, uuid) from public;
grant execute on function private.student_in_test_class(uuid, uuid) to authenticated;

-- Guardian/student visibility of test METADATA behind old results (mirrors
-- guardian_sees_lesson/student_sees_lesson): a result row for my child/me, OR
-- an enrollment interval covering the test date.
create or replace function private.guardian_sees_test(uid uuid, tid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.test_results tr
    join public.guardian_student gs on gs.student_id = tr.student_id
    where tr.test_id = tid and gs.guardian_id = uid
  ) or exists (
    select 1
    from public.tests t
    join public.class_students cs on cs.class_id = t.class_id
    join public.guardian_student gs on gs.student_id = cs.student_id
    where t.id = tid
      and gs.guardian_id = uid
      and cs.enrolled_on <= t.held_on
      and (cs.left_on is null or t.held_on < cs.left_on)
  );
$$;
revoke execute on function private.guardian_sees_test(uuid, uuid) from public;
grant execute on function private.guardian_sees_test(uuid, uuid) to authenticated;

create or replace function private.student_sees_test(uid uuid, tid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.test_results tr
    join public.students s on s.id = tr.student_id
    where tr.test_id = tid and s.student_user_id = uid
  ) or exists (
    select 1
    from public.tests t
    join public.class_students cs on cs.class_id = t.class_id
    join public.students s on s.id = cs.student_id
    where t.id = tid
      and s.student_user_id = uid
      and cs.enrolled_on <= t.held_on
      and (cs.left_on is null or t.held_on < cs.left_on)
  );
$$;
revoke execute on function private.student_sees_test(uuid, uuid) from public;
grant execute on function private.student_sees_test(uuid, uuid) to authenticated;

-- ── tests ───────────────────────────────────────────────────────────
create table public.tests (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  title      text not null check (char_length(title) between 1 and 80),
  held_on    date not null,
  max_points integer not null check (max_points between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.tests is
  'Class tests (D4): teacher-created and teacher-edited; DELETE is admin-only (a mis-created test is edited, not destroyed — results are student data). subject_id restrict; class cascade takes the class''s tests (and results via test_results cascade). The results roster is AS OF held_on (student_in_test_class).';

create trigger tests_set_updated_at
  before update on public.tests
  for each row execute function private.set_updated_at();

revoke all on table public.tests from anon, authenticated, service_role;
grant select, insert, update, delete on public.tests to authenticated;
grant select, delete on public.tests to service_role;

alter table public.tests enable row level security;

create policy "tests_select_related"
  on public.tests for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_class((select auth.uid()), class_id)
    or private.guardian_in_class((select auth.uid()), class_id)
    or private.student_in_class((select auth.uid()), class_id)
    or private.guardian_sees_test((select auth.uid()), id)
    or private.student_sees_test((select auth.uid()), id)
  );
create policy "tests_insert_teacher_or_admin"
  on public.tests for insert to authenticated
  with check (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_class((select auth.uid()), class_id)
  );
create policy "tests_update_teacher_or_admin"
  on public.tests for update to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_test((select auth.uid()), id)
  )
  with check (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_test((select auth.uid()), id)
  );
create policy "tests_delete_admin"
  on public.tests for delete to authenticated
  using (private.has_role((select auth.uid()), 'admin'));

-- ── test_results ────────────────────────────────────────────────────
create table public.test_results (
  test_id     uuid not null references public.tests (id) on delete cascade,
  student_id  uuid not null references public.students (id) on delete cascade,
  points      integer not null check (points >= 0),
  feedback    text check (feedback is null or char_length(feedback) <= 1000),
  recorded_by uuid not null references public.profiles (id),
  recorded_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (test_id, student_id)
);
comment on table public.test_results is
  'Per-student test results (student data, audit trigger). Corrections are upserts by the test''s teacher (teaches_test); the INSERT double bind additionally requires the student on the test''s roster AS OF held_on (student_in_test_class). points ≤ max_points is validated app-side against the test row (no cross-table db check).';

create trigger test_results_set_updated_at
  before update on public.test_results
  for each row execute function private.set_updated_at();

create trigger test_results_audit
  after insert or update or delete on public.test_results
  for each row execute function private.audit_row_change('test_id', 'student_id');

revoke all on table public.test_results from anon, authenticated, service_role;
grant select, insert, update, delete on public.test_results to authenticated;
grant select, delete on public.test_results to service_role;

alter table public.test_results enable row level security;

create policy "test_results_select_related"
  on public.test_results for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_test((select auth.uid()), test_id)
    or private.is_guardian_of((select auth.uid()), student_id)
    or private.is_linked_student((select auth.uid()), student_id)
  );
create policy "test_results_insert_teacher_or_admin"
  on public.test_results for insert to authenticated
  with check (
    private.has_role((select auth.uid()), 'admin')
    or (
      private.teaches_test((select auth.uid()), test_id)
      and private.student_in_test_class(student_id, test_id)
    )
  );
create policy "test_results_update_teacher_or_admin"
  on public.test_results for update to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_test((select auth.uid()), test_id)
  )
  with check (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_test((select auth.uid()), test_id)
  );
create policy "test_results_delete_admin"
  on public.test_results for delete to authenticated
  using (private.has_role((select auth.uid()), 'admin'));
```

- [ ] **Step 4: Apply and verify GREEN**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase db reset 2>&1 | tail -4
supabase test db 2>&1 | tail -6
```

Expected: all 19 files pass — `18_tests_rls` **30/30**. Total pgTAP: **374**.

- [ ] **Step 5: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add supabase/tests/18_tests_rls.sql supabase/migrations/*_tests_results.sql
git commit -m "feat: class tests and held_on-rostered results with interval double bind"
```

---

### Task 5: Migration — `term_grades` + `teaches_student_term_subject`

The term-end grade + feedback per (student, term, subject) — composite PK, upserted (D5). The write wall is the **triple bind** `teaches_student_term_subject`: the teacher must actively teach the student, in a class of *that term*, offering *that subject*. Grade is TEXT with **no db check against `settings.grade_scale`** — validated app-side at entry time so stored grades survive later scale edits; pinned here so nobody "helpfully" adds the check.

**Files:**
- Create: `supabase/tests/19_term_grades_rls.sql`
- Create: `supabase/migrations/<ts>_term_grades.sql` (via `supabase migration new term_grades`)

- [ ] **Step 1: Write the failing pgTAP file**

Create `supabase/tests/19_term_grades_rls.sql` (fixtures `b7…`, emails `pgtap-tg-…@test.local`, names prefixed `TG`). Fixture graph: the 7 users (`b7…01` admin, `…02` teacher1, `…03` teacher2, `…04` parentA, `…05` parentB, `…06` elev = s1's login, `…07` economy); **two terms** `b7…11` (T-A) and `…12` (T-B — deliberately without classes, the term-bind negative); classes `b7…21` (term T-A, teacher1, subject SA `b7…41`) + `…22` (term T-A, teacher2, subject SB `…42`); students `b7…31` s1 (active in 21, guardian parentA, login), `…32` s2 (active in 22, guardian parentB), `…33` s3 (leaver of 21: 2026-08-20 → 2026-09-01, guardian parentA).

The sequence (`select plan(21);`):

1–2: `has_table` / RLS enabled.
3: `has_function` `private.teaches_student_term_subject(uuid,uuid,uuid,uuid)`.
4: teacher1 sets s1 × T-A × SA = «Meget god» (`lives_ok`) — 'the teacher grades an own student in the class''s term and subject'.
5: the same insert again → `23505` — 'one grade per (student, term, subject) — corrections are upserts'.
6: **TERM BIND** — teacher1 sets s1 × **T-B** × SA → `42501` — 'the grade''s term must be the class''s term'.
7: **SUBJECT BIND** — teacher1 sets s1 × T-A × **SB** → `42501` — 'the subject must be offered to the student''s class'.
8: **STUDENT BIND** — teacher1 sets **s2** × T-A × SB → `42501` — 'a foreign student is rejected (fine-derived #4 write-side)'.
9: teacher1 sets **s3** (leaver) × T-A × SA → `42501` — 'grading requires an ACTIVE enrollment'.
10: parentA insert → `42501`; 11: economy insert → `42501`.
12: admin sets s2 × T-A × SB = «Helt egen skala» (`lives_ok`) — 'admin path works AND the grade text is free at the db wall (D5: the scale is app-enforced; stored grades survive scale edits)'.
13: teacher1 UPDATEs s1's grade to «Utmerket» (`lives_ok`) — 'the teacher re-sets during the term (upsert semantics)'.
14–15: teacher2 UPDATE on s1's grade matches no row (`lives_ok`) + grade still «Utmerket» (`is`) — 'a foreign teacher''s update matches no row'.
16–17: teacher1 DELETE on s1's grade matches no row (`lives_ok`) + row still exists (`is` count 1) — 'grade DELETE is admin-only'.
18: parentA reads count **1** (s1's grade) — 'the guardian reads the child''s grades'.
19: the student login reads count **1** (own).
20: parentB reads s1-filtered count **0** — 'BERGEN #1: the other family sees nothing'.
21: audit pin — `audit_log` row `action='term_grades.insert'`, `actor_id=b7…02`, `entity_id='b7000000-0000-0000-0000-000000000031'` (first trigger arg is `student_id`).

- [ ] **Step 2: Run pgTAP — expect 19 RED**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase test db 2>&1 | tail -8
```

Expected FAIL: `19_term_grades_rls` errors with `relation "public.term_grades" does not exist`; `00`–`18` green.

- [ ] **Step 3: Create the migration**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase migration new term_grades
```

Write `supabase/migrations/<ts>_term_grades.sql`:

```sql
-- Term-end grade + feedback per (student, term, subject) — composite PK,
-- upsert-corrected (D5). Write wall = the TRIPLE bind teaches_student_term_
-- subject (active student, class of that term, subject of that class). Grade
-- is free TEXT at this wall: validation against settings.grade_scale is
-- app-side AT ENTRY TIME so stored grades survive later scale edits —
-- deliberately no db check referencing settings (pinned by 19_term_grades_rls).

create or replace function private.teaches_student_term_subject(uid uuid, sid uuid, tid uuid, subj uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.class_students cs
    join public.class_teachers ct on ct.class_id = cs.class_id
    join public.class_subjects csub on csub.class_id = cs.class_id
    join public.classes c on c.id = cs.class_id
    where cs.student_id = sid
      and ct.teacher_id = uid
      and cs.left_on is null
      and csub.subject_id = subj
      and c.term_id = tid
  );
$$;
revoke execute on function private.teaches_student_term_subject(uuid, uuid, uuid, uuid) from public;
grant execute on function private.teaches_student_term_subject(uuid, uuid, uuid, uuid) to authenticated;

create table public.term_grades (
  student_id uuid not null references public.students (id) on delete cascade,
  term_id    uuid not null references public.terms (id) on delete restrict,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  grade      text not null check (char_length(grade) between 1 and 40),
  feedback   text check (feedback is null or char_length(feedback) <= 2000),
  set_by     uuid not null references public.profiles (id),
  set_at     timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (student_id, term_id, subject_id)
);
comment on table public.term_grades is
  'Term grade + written feedback per (student, term, subject) — upserted from the teacher''s term-end flow. grade text validates against settings.grade_scale APP-SIDE at entry time; stored grades survive scale edits (no db check, by design — D5). term_id/subject_id restrict: grades pin their term and subject.';

create trigger term_grades_set_updated_at
  before update on public.term_grades
  for each row execute function private.set_updated_at();

create trigger term_grades_audit
  after insert or update or delete on public.term_grades
  for each row execute function private.audit_row_change('student_id', 'term_id', 'subject_id');

revoke all on table public.term_grades from anon, authenticated, service_role;
grant select, insert, update, delete on public.term_grades to authenticated;
grant select, delete on public.term_grades to service_role;

alter table public.term_grades enable row level security;

create policy "term_grades_select_related"
  on public.term_grades for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_student((select auth.uid()), student_id)
    or private.taught_student_ever_unprotected((select auth.uid()), student_id)
    or private.is_guardian_of((select auth.uid()), student_id)
    or private.is_linked_student((select auth.uid()), student_id)
  );
create policy "term_grades_insert_teacher_or_admin"
  on public.term_grades for insert to authenticated
  with check (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_student_term_subject((select auth.uid()), student_id, term_id, subject_id)
  );
create policy "term_grades_update_teacher_or_admin"
  on public.term_grades for update to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_student_term_subject((select auth.uid()), student_id, term_id, subject_id)
  )
  with check (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_student_term_subject((select auth.uid()), student_id, term_id, subject_id)
  );
create policy "term_grades_delete_admin"
  on public.term_grades for delete to authenticated
  using (private.has_role((select auth.uid()), 'admin'));
```

- [ ] **Step 4: Apply and verify GREEN**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase db reset 2>&1 | tail -4
supabase test db 2>&1 | tail -6
```

Expected: all 20 files pass — `19_term_grades_rls` **21/21**. Total pgTAP: **395**. This is the phase's full wall-2 count — carried through to the exit gate.

- [ ] **Step 5: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add supabase/tests/19_term_grades_rls.sql supabase/migrations/*_term_grades.sql
git commit -m "feat: term grades with triple-bound teacher writes and app-side scale"
```

---

### Task 6: Seed + regenerated types + `access-wall` matrix growth

Plants the demo-mined hero narrative (header **Seed anchors**) so every Phase-3 surface renders real data on first boot, regenerates the `Database` types, and grows the wall-1 denial matrix. Zaynab (protected) and Idris (stopped) get **zero** assessment rows on purpose — their structural zeros are what the new `DENIED_CELLS` for `forelder2@` assert.

**Files:**
- Modify: `supabase/seed.sql` (append the Phase-3 block at the end)
- Modify: `src/lib/supabase/database.types.ts` (regenerated, not hand-edited)
- Modify: `tests/api/access-wall.test.ts` (DENIED_CELLS growth)

- [ ] **Step 1: Append the Phase-3 seed block**

Append to `supabase/seed.sql`:

```sql
-- ── Phase 3: assessment fixtures (f2 books · f3 progress · f4 quran · f5 tests) ──
-- Yusuf is the hero trail (mined from the pitch demo): a 6→12→18 book climb,
-- and a Quran arc ending in a repeat (the weak-spot story). Zaynab (protected)
-- and Idris (stopped) get NO assessment rows — access-wall asserts their zeros.

insert into public.curriculum_books (id, subject_id, title, level, unit_label, total_units) values
  ('f2000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000001', 'Alfabet og lyder',            1, 'side',    30),
  ('f2000000-0000-0000-0000-000000000002', 'fa000000-0000-0000-0000-000000000002', 'Ord og setninger',            2, 'side',    40),
  ('f2000000-0000-0000-0000-000000000003', 'fa000000-0000-0000-0000-000000000003', 'Grunnleggende islamkunnskap', 1, 'leksjon', 24);

insert into public.progress_entries (id, student_id, subject_id, book_id, unit_reached, note, recorded_by, recorded_at) values
  ('f3000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001',  6, 'God start på alfabetet.',              '22222222-2222-2222-2222-222222222222', '2026-08-22 13:00:00+02'),
  ('f3000000-0000-0000-0000-000000000002', 'fe000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001', 12, 'Mestrer korte lyder.',                 '22222222-2222-2222-2222-222222222222', '2026-08-29 13:00:00+02'),
  ('f3000000-0000-0000-0000-000000000003', 'fe000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001', 18, 'Jobber godt med sammensatte lyder.',   '22222222-2222-2222-2222-222222222222', '2026-09-05 13:00:00+02'),
  ('f3000000-0000-0000-0000-000000000004', 'fe000000-0000-0000-0000-000000000003', 'fa000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001',  9, null,                                   '22222222-2222-2222-2222-222222222222', '2026-08-29 13:05:00+02'),
  ('f3000000-0000-0000-0000-000000000005', 'fe000000-0000-0000-0000-000000000002', 'fa000000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000003',  5, null,                                   '66666666-6666-6666-6666-666666666666', '2026-08-30 12:00:00+02');

insert into public.quran_entries (id, student_id, date, kind, surah, ayah_from, ayah_to, result, note, recorded_by) values
  ('f4000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', '2026-08-22', 'longterm', 114, 1, 6, 'pass',   null,                                        '22222222-2222-2222-2222-222222222222'),
  ('f4000000-0000-0000-0000-000000000002', 'fe000000-0000-0000-0000-000000000001', '2026-08-29', 'recent',   113, 1, 5, 'pass',   null,                                        '22222222-2222-2222-2222-222222222222'),
  ('f4000000-0000-0000-0000-000000000003', 'fe000000-0000-0000-0000-000000000001', '2026-09-05', 'new',      112, 1, 4, 'repeat', 'Repeteres – litt usikker på ayah 3–4.',     '22222222-2222-2222-2222-222222222222'),
  ('f4000000-0000-0000-0000-000000000004', 'fe000000-0000-0000-0000-000000000002', '2026-08-30', 'new',      114, 1, 6, 'pass',   null,                                        '66666666-6666-6666-6666-666666666666');

insert into public.tests (id, class_id, subject_id, title, held_on, max_points) values
  ('f5000000-0000-0000-0000-000000000001', 'fc000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000001', 'Prøve: Det arabiske alfabetet', '2026-08-29', 20);

insert into public.test_results (test_id, student_id, points, feedback, recorded_by) values
  ('f5000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', 18, 'Meget bra, litt å finpusse.',          '22222222-2222-2222-2222-222222222222'),
  ('f5000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000003', 14, 'Bra jobbet – øv på det vanskeligste.', '22222222-2222-2222-2222-222222222222');

insert into public.term_grades (student_id, term_id, subject_id, grade, feedback, set_by) values
  ('fe000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000002', 'Utmerket',  'Solid innsats gjennom hele terminen.',                        '22222222-2222-2222-2222-222222222222'),
  ('fe000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000001', 'Meget god', 'Leser stadig bedre – fortsett med høytlesing hjemme.',        '22222222-2222-2222-2222-222222222222');
```

**Consistency guard before writing:** Yusuf's `term_grades` rows require Klasse 1 to offer *both* Arabisk and Koran in `class_subjects` (it does, per Phase-1 seed) — the seed runs as postgres so RLS doesn't gate it, but the *story* must match the walls or wall-1 tests written against the seed will contradict the policies.

- [ ] **Step 2: Reset + regenerate types**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase db reset 2>&1 | tail -4
npm run db:types
npm run typecheck
```

Expected: reset applies migrations + the new seed block cleanly (verify: `docker exec supabase_db_iqra-portal psql -U postgres -d postgres -tAc "select (select count(*) from public.curriculum_books), (select count(*) from public.progress_entries), (select count(*) from public.quran_entries), (select count(*) from public.test_results), (select count(*) from public.term_grades)"` → `3|5|4|2|2`). `database.types.ts` gains the six tables + two enums; typecheck stays silent.

- [ ] **Step 3: Grow the wall-1 denial matrix**

In `tests/api/access-wall.test.ts`, extend `DENIED_CELLS` with eight cells (follow the array's existing entry shape exactly):

| table | as | expect |
|---|---|---|
| `curriculum_books` | `okonomi@test.local` | 0 rows |
| `progress_entries` | `okonomi@test.local` | 0 rows |
| `quran_entries` | `okonomi@test.local` | 0 rows |
| `tests` | `okonomi@test.local` | 0 rows |
| `test_results` | `okonomi@test.local` | 0 rows |
| `term_grades` | `okonomi@test.local` | 0 rows |
| `progress_entries` | `forelder2@test.local` | 0 rows |
| `quran_entries` | `forelder2@test.local` | 0 rows |

(The `forelder2@` zeros are structural — Zaynab/Idris have no assessment rows by seed design — and they double as the BERGEN cell at wall 1: another family's parent reads nothing.)

- [ ] **Step 4: Run the matrix**

```bash
cd /Users/daodilyas/dev/iqra-portal
npx vitest run --config vitest.config.api.ts tests/api/access-wall.test.ts 2>&1 | tail -4
```

Expected: the file grows by 8 passing cells. `tests/api` running total: **181**.

- [ ] **Step 5: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add supabase/seed.sql src/lib/supabase/database.types.ts tests/api/access-wall.test.ts
git commit -m "feat: phase-3 assessment seed, regenerated types, denial-matrix growth"
```

---

### Task 7: `SURAHS` + validation schemas + label/tone maps + derivations (pure units)

Everything pure and DB-free: the full 114-surah reference (Hafs/Kufan ayah counts), the Zod schemas with per-surah ayah clamping, the bokmål label maps (demo-mined vocabulary), the Chip tone maps (grade tones per the design law), and the standing derivations (latest-per-book, percent clamp, Quran position/weak spots).

**Files:**
- Create: `src/lib/quran.ts` + `src/lib/quran.test.ts`
- Create: `src/lib/validation/assessment.ts` + `src/lib/validation/assessment.test.ts`
- Create: `src/lib/assessment.ts` + `src/lib/assessment.test.ts`
- Create: `src/lib/assessment-ui.ts`

- [ ] **Step 1: The surah reference**

Create `src/lib/quran.ts`:

```ts
/**
 * Static Quran reference: all 114 surahs with Hafs/Kufan ayah counts.
 * Validation clamps ayah ranges against this table APP-SIDE (the db holds only
 * structural checks — design spec §3). Names use the transliteration style the
 * demo established (An-Nas, Al-Ikhlas, …).
 */
export type Surah = { number: number; name: string; ayah_count: number };

export const SURAHS: readonly Surah[] = [
  { number: 1, name: 'Al-Fatiha', ayah_count: 7 },
  { number: 2, name: 'Al-Baqara', ayah_count: 286 },
  { number: 3, name: 'Aal-Imran', ayah_count: 200 },
  { number: 4, name: 'An-Nisa', ayah_count: 176 },
  { number: 5, name: "Al-Ma'ida", ayah_count: 120 },
  { number: 6, name: "Al-An'am", ayah_count: 165 },
  { number: 7, name: "Al-A'raf", ayah_count: 206 },
  { number: 8, name: 'Al-Anfal', ayah_count: 75 },
  { number: 9, name: 'At-Tawba', ayah_count: 129 },
  { number: 10, name: 'Yunus', ayah_count: 109 },
  { number: 11, name: 'Hud', ayah_count: 123 },
  { number: 12, name: 'Yusuf', ayah_count: 111 },
  { number: 13, name: "Ar-Ra'd", ayah_count: 43 },
  { number: 14, name: 'Ibrahim', ayah_count: 52 },
  { number: 15, name: 'Al-Hijr', ayah_count: 99 },
  { number: 16, name: 'An-Nahl', ayah_count: 128 },
  { number: 17, name: 'Al-Isra', ayah_count: 111 },
  { number: 18, name: 'Al-Kahf', ayah_count: 110 },
  { number: 19, name: 'Maryam', ayah_count: 98 },
  { number: 20, name: 'Ta-Ha', ayah_count: 135 },
  { number: 21, name: 'Al-Anbiya', ayah_count: 112 },
  { number: 22, name: 'Al-Hajj', ayah_count: 78 },
  { number: 23, name: "Al-Mu'minun", ayah_count: 118 },
  { number: 24, name: 'An-Nur', ayah_count: 64 },
  { number: 25, name: 'Al-Furqan', ayah_count: 77 },
  { number: 26, name: "Ash-Shu'ara", ayah_count: 227 },
  { number: 27, name: 'An-Naml', ayah_count: 93 },
  { number: 28, name: 'Al-Qasas', ayah_count: 88 },
  { number: 29, name: 'Al-Ankabut', ayah_count: 69 },
  { number: 30, name: 'Ar-Rum', ayah_count: 60 },
  { number: 31, name: 'Luqman', ayah_count: 34 },
  { number: 32, name: 'As-Sajda', ayah_count: 30 },
  { number: 33, name: 'Al-Ahzab', ayah_count: 73 },
  { number: 34, name: 'Saba', ayah_count: 54 },
  { number: 35, name: 'Fatir', ayah_count: 45 },
  { number: 36, name: 'Ya-Sin', ayah_count: 83 },
  { number: 37, name: 'As-Saffat', ayah_count: 182 },
  { number: 38, name: 'Sad', ayah_count: 88 },
  { number: 39, name: 'Az-Zumar', ayah_count: 75 },
  { number: 40, name: 'Ghafir', ayah_count: 85 },
  { number: 41, name: 'Fussilat', ayah_count: 54 },
  { number: 42, name: 'Ash-Shura', ayah_count: 53 },
  { number: 43, name: 'Az-Zukhruf', ayah_count: 89 },
  { number: 44, name: 'Ad-Dukhan', ayah_count: 59 },
  { number: 45, name: 'Al-Jathiya', ayah_count: 37 },
  { number: 46, name: 'Al-Ahqaf', ayah_count: 35 },
  { number: 47, name: 'Muhammad', ayah_count: 38 },
  { number: 48, name: 'Al-Fath', ayah_count: 29 },
  { number: 49, name: 'Al-Hujurat', ayah_count: 18 },
  { number: 50, name: 'Qaf', ayah_count: 45 },
  { number: 51, name: 'Adh-Dhariyat', ayah_count: 60 },
  { number: 52, name: 'At-Tur', ayah_count: 49 },
  { number: 53, name: 'An-Najm', ayah_count: 62 },
  { number: 54, name: 'Al-Qamar', ayah_count: 55 },
  { number: 55, name: 'Ar-Rahman', ayah_count: 78 },
  { number: 56, name: "Al-Waqi'a", ayah_count: 96 },
  { number: 57, name: 'Al-Hadid', ayah_count: 29 },
  { number: 58, name: 'Al-Mujadila', ayah_count: 22 },
  { number: 59, name: 'Al-Hashr', ayah_count: 24 },
  { number: 60, name: 'Al-Mumtahana', ayah_count: 13 },
  { number: 61, name: 'As-Saff', ayah_count: 14 },
  { number: 62, name: "Al-Jumu'a", ayah_count: 11 },
  { number: 63, name: 'Al-Munafiqun', ayah_count: 11 },
  { number: 64, name: 'At-Taghabun', ayah_count: 18 },
  { number: 65, name: 'At-Talaq', ayah_count: 12 },
  { number: 66, name: 'At-Tahrim', ayah_count: 12 },
  { number: 67, name: 'Al-Mulk', ayah_count: 30 },
  { number: 68, name: 'Al-Qalam', ayah_count: 52 },
  { number: 69, name: 'Al-Haqqa', ayah_count: 52 },
  { number: 70, name: "Al-Ma'arij", ayah_count: 44 },
  { number: 71, name: 'Nuh', ayah_count: 28 },
  { number: 72, name: 'Al-Jinn', ayah_count: 28 },
  { number: 73, name: 'Al-Muzzammil', ayah_count: 20 },
  { number: 74, name: 'Al-Muddaththir', ayah_count: 56 },
  { number: 75, name: 'Al-Qiyama', ayah_count: 40 },
  { number: 76, name: 'Al-Insan', ayah_count: 31 },
  { number: 77, name: 'Al-Mursalat', ayah_count: 50 },
  { number: 78, name: 'An-Naba', ayah_count: 40 },
  { number: 79, name: "An-Nazi'at", ayah_count: 46 },
  { number: 80, name: 'Abasa', ayah_count: 42 },
  { number: 81, name: 'At-Takwir', ayah_count: 29 },
  { number: 82, name: 'Al-Infitar', ayah_count: 19 },
  { number: 83, name: 'Al-Mutaffifin', ayah_count: 36 },
  { number: 84, name: 'Al-Inshiqaq', ayah_count: 25 },
  { number: 85, name: 'Al-Buruj', ayah_count: 22 },
  { number: 86, name: 'At-Tariq', ayah_count: 17 },
  { number: 87, name: "Al-A'la", ayah_count: 19 },
  { number: 88, name: 'Al-Ghashiya', ayah_count: 26 },
  { number: 89, name: 'Al-Fajr', ayah_count: 30 },
  { number: 90, name: 'Al-Balad', ayah_count: 20 },
  { number: 91, name: 'Ash-Shams', ayah_count: 15 },
  { number: 92, name: 'Al-Layl', ayah_count: 21 },
  { number: 93, name: 'Ad-Duha', ayah_count: 11 },
  { number: 94, name: 'Ash-Sharh', ayah_count: 8 },
  { number: 95, name: 'At-Tin', ayah_count: 8 },
  { number: 96, name: 'Al-Alaq', ayah_count: 19 },
  { number: 97, name: 'Al-Qadr', ayah_count: 5 },
  { number: 98, name: 'Al-Bayyina', ayah_count: 8 },
  { number: 99, name: 'Az-Zalzala', ayah_count: 8 },
  { number: 100, name: 'Al-Adiyat', ayah_count: 11 },
  { number: 101, name: "Al-Qari'a", ayah_count: 11 },
  { number: 102, name: 'At-Takathur', ayah_count: 8 },
  { number: 103, name: 'Al-Asr', ayah_count: 3 },
  { number: 104, name: 'Al-Humaza', ayah_count: 9 },
  { number: 105, name: 'Al-Fil', ayah_count: 5 },
  { number: 106, name: 'Quraysh', ayah_count: 4 },
  { number: 107, name: "Al-Ma'un", ayah_count: 7 },
  { number: 108, name: 'Al-Kawthar', ayah_count: 3 },
  { number: 109, name: 'Al-Kafirun', ayah_count: 6 },
  { number: 110, name: 'An-Nasr', ayah_count: 3 },
  { number: 111, name: 'Al-Masad', ayah_count: 5 },
  { number: 112, name: 'Al-Ikhlas', ayah_count: 4 },
  { number: 113, name: 'Al-Falaq', ayah_count: 5 },
  { number: 114, name: 'An-Nas', ayah_count: 6 },
];

export function surahByNumber(n: number): Surah | null {
  return SURAHS.find((s) => s.number === n) ?? null;
}

/** Option label for selects: "112. Al-Ikhlas". */
export function surahLabel(n: number): string {
  const surah = surahByNumber(n);
  return surah ? `${surah.number}. ${surah.name}` : String(n);
}

/** Position label used everywhere: "Al-Ikhlas 1–4". */
export function quranPositionLabel(entry: {
  surah: number;
  ayah_from: number;
  ayah_to: number;
}): string {
  const surah = surahByNumber(entry.surah);
  const name = surah ? surah.name : `Surah ${entry.surah}`;
  return `${name} ${entry.ayah_from}–${entry.ayah_to}`;
}
```

Create `src/lib/quran.test.ts` — 5 `it` blocks: (1) `SURAHS.length === 114`; (2) total ayah count `SURAHS.reduce((sum, s) => sum + s.ayah_count, 0) === 6236` (the Kufan total — a typo in any row fails this); (3) numbers are exactly 1..114 in order (`SURAHS.every((s, i) => s.number === i + 1)`); (4) spot checks `toEqual`: Al-Fatiha 7, Al-Baqara 286, Ya-Sin 83, Al-Ikhlas 4, An-Nas 6; (5) labels: `surahLabel(112) === '112. Al-Ikhlas'`, `quranPositionLabel({ surah: 112, ayah_from: 1, ayah_to: 4 }) === 'Al-Ikhlas 1–4'`, and `surahByNumber(115) === null`.

- [ ] **Step 2: Validation schemas + label maps**

Create `src/lib/validation/assessment.ts`:

```ts
import { z } from 'zod';
import { surahByNumber } from '@/lib/quran';
import { uuidField } from './school';

export type QuranKind = 'new' | 'recent' | 'longterm';
export type QuranResult = 'pass' | 'repeat';

export const quranKindLabels: Record<QuranKind, string> = {
  new: 'Under innlæring',
  recent: 'Nylig lært',
  longterm: 'Sitter godt',
};

export const quranResultLabels: Record<QuranResult, string> = {
  pass: 'Bestått',
  repeat: 'Repeteres',
};

export const UNIT_LABELS: Record<'side' | 'leksjon' | 'enhet', string> = {
  side: 'Side',
  leksjon: 'Leksjon',
  enhet: 'Enhet',
};

const optionalNote = z
  .string()
  .trim()
  .max(500, 'Notatet kan være maks 500 tegn.')
  .transform((value) => (value === '' ? null : value))
  .nullish();

export const progressEntrySchema = z.object({
  subject_id: uuidField,
  book_id: z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : value))
    .pipe(uuidField.nullable()),
  unit_reached: z.coerce
    .number('Oppgi hvor langt eleven har kommet.')
    .int('Posisjonen må være et helt tall.')
    .min(0, 'Posisjonen kan ikke være negativ.')
    .max(1000, 'Posisjonen kan være maks 1000.'),
  note: optionalNote,
});

export const quranEntrySchema = z
  .object({
    date: z.iso.date('Oppgi en gyldig dato.'),
    kind: z.enum(['new', 'recent', 'longterm'], 'Velg hvilken del av leksen dette er.'),
    surah: z.coerce
      .number('Velg en surah.')
      .int()
      .min(1, 'Velg en surah.')
      .max(114, 'Velg en surah.'),
    ayah_from: z.coerce.number('Oppgi fra-ayah.').int().min(1, 'Fra-ayah må være minst 1.'),
    ayah_to: z.coerce.number('Oppgi til-ayah.').int().min(1, 'Til-ayah må være minst 1.'),
    result: z.enum(['pass', 'repeat'], 'Velg resultat.'),
    note: optionalNote,
  })
  .superRefine((value, ctx) => {
    if (value.ayah_to < value.ayah_from) {
      ctx.addIssue({
        code: 'custom',
        path: ['ayah_to'],
        message: 'Til-ayah kan ikke være før fra-ayah.',
      });
      return;
    }
    const surah = surahByNumber(value.surah);
    if (surah && value.ayah_to > surah.ayah_count) {
      ctx.addIssue({
        code: 'custom',
        path: ['ayah_to'],
        message: `${surah.name} har ${surah.ayah_count} ayat.`,
      });
    }
  });

export const testSchema = z.object({
  subject_id: uuidField,
  title: z
    .string()
    .trim()
    .min(1, 'Skriv en tittel.')
    .max(80, 'Tittelen kan være maks 80 tegn.'),
  held_on: z.iso.date('Oppgi en gyldig dato.'),
  max_points: z.coerce
    .number('Oppgi maks poeng.')
    .int('Maks poeng må være et helt tall.')
    .min(1, 'Maks poeng må være minst 1.')
    .max(1000, 'Maks poeng kan være maks 1000.'),
});

export const testEditSchema = testSchema.omit({ subject_id: true });

export const testResultSchema = z.object({
  student_id: uuidField,
  points: z.coerce
    .number('Oppgi poeng.')
    .int('Poeng må være et helt tall.')
    .min(0, 'Poeng kan ikke være negative.'),
  feedback: z
    .string()
    .trim()
    .max(1000, 'Tilbakemeldingen kan være maks 1000 tegn.')
    .transform((value) => (value === '' ? null : value))
    .nullish(),
});

export const testResultsSchema = z
  .array(testResultSchema)
  .min(1, 'Ingen resultater å lagre.')
  .max(200, 'For mange rader.');

export const termGradeSchema = z.object({
  subject_id: uuidField,
  grade: z
    .string()
    .trim()
    .min(1, 'Velg en karakter.')
    .max(40, 'Karakteren kan være maks 40 tegn.'),
  feedback: z
    .string()
    .trim()
    .max(2000, 'Tilbakemeldingen kan være maks 2000 tegn.')
    .transform((value) => (value === '' ? null : value))
    .nullish(),
});

export const bookSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Skriv en tittel.')
    .max(80, 'Tittelen kan være maks 80 tegn.'),
  level: z.coerce
    .number('Oppgi nivå.')
    .int('Nivået må være et helt tall.')
    .min(1, 'Nivået må være minst 1.')
    .max(20, 'Nivået kan være maks 20.'),
  unit_label: z.enum(['side', 'leksjon', 'enhet'], 'Velg enhet.'),
  total_units: z.coerce
    .number('Oppgi antall enheter.')
    .int('Antall enheter må være et helt tall.')
    .min(1, 'Antall enheter må være minst 1.')
    .max(1000, 'Antall enheter kan være maks 1000.'),
});
```

Create `src/lib/validation/assessment.test.ts` — 14 `it` blocks (parameterize, strong `toEqual` assertions): progress accepts a full valid entry and empty-string `book_id` → `null`; progress rejects unit 1001 and a malformed subject id; quran accepts the seed hero entry (112, 1–4, repeat); quran rejects `ayah_to < ayah_from` (message «Til-ayah kan ikke være før fra-ayah.»), rejects `ayah_to` beyond the surah («Al-Ikhlas har 4 ayat.»), rejects surah 115; test schema accepts/rejects (max_points 0); results array rejects empty; term grade accepts + empty feedback → null; term grade rejects empty grade; book schema accepts the seed book + rejects `unit_label: 'kapittel'`; label maps are total (`Object.keys(quranKindLabels).length === 3`, `quranResultLabels` covers both, `UNIT_LABELS` covers all three).

- [ ] **Step 3: Derivations + tones**

Create `src/lib/assessment.ts`:

```ts
import type { QuranKind, QuranResult } from '@/lib/validation/assessment';

export type QuranLogEntry = {
  id: string;
  date: string;
  kind: QuranKind;
  surah: number;
  ayah_from: number;
  ayah_to: number;
  result: QuranResult;
  note: string | null;
};

export type QuranStanding = {
  position: QuranLogEntry | null;
  weak_spots: QuranLogEntry[];
  recent: QuranLogEntry[];
};

/** Latest entry per book (by recorded_at, then insertion order for ties). */
export function latestPerBook<
  T extends { book_id: string | null; recorded_at: string },
>(entries: readonly T[]): Map<string, T> {
  const latest = new Map<string, T>();
  for (const entry of entries) {
    if (!entry.book_id) continue;
    const current = latest.get(entry.book_id);
    if (!current || entry.recorded_at >= current.recorded_at) {
      latest.set(entry.book_id, entry);
    }
  }
  return latest;
}

/** round(100 * unit / total), clamped 0–100 (a shrunk book cannot exceed 100). */
export function bookPercent(unit: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((100 * unit) / total)));
}

/**
 * Standing from the log (design spec §3): entries ordered oldest→newest by
 * (date, insertion order). Position = the newest entry. Weak spot = a surah
 * whose NEWEST entry has result 'repeat' (a later pass clears it), newest
 * first. Recent = the newest 10, newest first.
 */
export function quranStanding(entries: readonly QuranLogEntry[]): QuranStanding {
  const ordered = [...entries]
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) =>
        a.entry.date.localeCompare(b.entry.date) || a.index - b.index,
    )
    .map(({ entry }) => entry);

  const latestPerSurah = new Map<number, QuranLogEntry>();
  for (const entry of ordered) {
    latestPerSurah.set(entry.surah, entry);
  }
  const weakSpots = [...latestPerSurah.values()]
    .filter((entry) => entry.result === 'repeat')
    .reverse();

  const newestFirst = [...ordered].reverse();
  return {
    position: newestFirst[0] ?? null,
    weak_spots: weakSpots,
    recent: newestFirst.slice(0, 10),
  };
}
```

Create `src/lib/assessment-ui.ts`:

```ts
import type { ChipTone } from '@/components/ui/Chip';
import type { QuranResult } from '@/lib/validation/assessment';

export const quranResultTones: Record<QuranResult, ChipTone> = {
  pass: 'success',
  repeat: 'warning',
};

const GRADE_TONES: Record<string, ChipTone> = {
  Utmerket: 'success',
  'Meget god': 'success',
  God: 'neutral',
  'Under arbeid': 'warning',
};

/**
 * Tone for a grade label. Known default-scale labels map to their tone; any
 * off-scale text (an edited scale, historical grades) falls back to neutral.
 * NEVER danger — a pupil in progress is not an error (design law, spec §7).
 */
export function gradeTone(grade: string): ChipTone {
  return GRADE_TONES[grade] ?? 'neutral';
}
```

Create `src/lib/assessment.test.ts` — 13 `it` blocks: `latestPerBook` picks the newest per book across interleaved books, skips `book_id: null` rows, and lets an equal-timestamp later row win; `bookPercent` → `toEqual` table `[6,30]→20`, `[18,30]→60`, `[40,40]→100`, `[45,40]→100` (clamp), `[0,30]→0`, `[5,0]→0`; `quranStanding` on the seed hero trail (114 pass → 113 pass → 112 repeat) yields position surah 112, `weak_spots` exactly `[112]`, recent newest-first; a later `pass` on 112 **clears** the weak spot (`weak_spots` empty — the D2 refinement); same-date entries resolve by insertion order (later insertion wins position); empty log → `{ position: null, weak_spots: [], recent: [] }`; `gradeTone` maps the four defaults and falls back to `neutral` for «Helt egen skala»; `quranResultTones` is total.

- [ ] **Step 4: Run the units**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm test -- --run 2>&1 | tail -4
npm run typecheck && npm run lint
```

Expected: unit total **151** (119 + 5 quran + 14 validation + 13 derivations/tones — the 13 count includes the two tone tests). Typecheck/lint silent.

- [ ] **Step 5: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add src/lib/quran.ts src/lib/quran.test.ts src/lib/validation/assessment.ts src/lib/validation/assessment.test.ts src/lib/assessment.ts src/lib/assessment.test.ts src/lib/assessment-ui.ts
git commit -m "feat: surah reference, assessment validation and standing derivations"
```

---

### Task 8: DAL — curriculum + per-student fremdrift reads

Wall-1 twins of the pgTAP proofs. One private assembler builds a student's fremdrift (book standings, Quran standing, recent log, current-term tests + grades) and each public function runs it **after its own guard + relationship re-check** (the `.eq` discipline — RLS also admits admins, so a bare read would over-return for dual-role users). All queries run in the caller's session; the assembler works for teacher/parent/student/admin alike because RLS grants each exactly the rows they may see.

**Contract note (supersedes the header contract where they differ):** `TestResultRow` and `TermGradeRow` are declared in `src/lib/dal/progress.ts` (this task) — `assessment.ts` (Task 9) imports them. `BookStanding.recorded_at` is `string | null` (a class book nobody has logged yet renders as a zero-standing log target with `current_unit: 0`).

**Files:**
- Modify: `src/lib/dal/settings.ts` (add `grade_scale` to the select)
- Create: `src/lib/dal/curriculum.ts`
- Create: `src/lib/dal/progress.ts`
- Create: `tests/api/assessment-core.test.ts`

- [ ] **Step 1: Write the failing API tests**

Create `tests/api/assessment-core.test.ts` with the standard preamble (repeated per file — mock factories are hoisted): the three `vi.mock` blocks from `attendance-core.test.ts` verbatim (`server-only` → `{}`; `@/lib/supabase/server` → harness `createServerClientMock`; `next/navigation` → harness `redirectMock`), then imports from `@/lib/dal/curriculum` (`listBooks`, `listBooksForSubject`), `@/lib/dal/progress` (`requireTeacherOfStudent`, `getStudentFremdriftForTeacher`, `getChildFremdrift`, `getOwnFremdrift`, `getStudentAssessmentForAdmin`), the harness (`signInAs`, `signInAsAAL2`, `signOut`), and seed constants:

```ts
const ARABISK = 'fa000000-0000-0000-0000-000000000001';
const KORAN = 'fa000000-0000-0000-0000-000000000002';
const YUSUF = 'fe000000-0000-0000-0000-000000000001';
const AMIRA = 'fe000000-0000-0000-0000-000000000002'; // K3 — laererforelder's class
const BILAL = 'fe000000-0000-0000-0000-000000000003';
const ZAYNAB = 'fe000000-0000-0000-0000-000000000004'; // protected, K3
const B_ALFABET = 'f2000000-0000-0000-0000-000000000001';
```

`beforeEach(signOut)`. The 14 `it` blocks (each names its wall; ≥25s timeouts on multi-login cases):

1. `getStudentFremdriftForTeacher` as AAL1 `laerer@` → rejects `NEXT_REDIRECT:/mfa/registrer` (guard order).
2. As `forelder@` → rejects `NEXT_REDIRECT:/ingen-tilgang` (role wall).
3. As AAL2 `laerer@`, `getStudentFremdriftForTeacher(YUSUF)`: `header.class_name === 'Klasse 1'`; the `B_ALFABET` standing is `{ current_unit: 18, percent: 60 }` with `recorded_at` non-null; `fremdrift.quran.position.surah === 112` with `result 'repeat'`; `weak_spots.map(w => w.surah)` `toEqual([112])`; `progress_log` has 3 rows, newest (`unit_reached: 18`) first.
4. `getStudentFremdriftForTeacher(AMIRA)` as `laerer@` → `null` (foreign class — fine-derived #4).
5. `getStudentFremdriftForTeacher('ikke-en-uuid')` → `null` (enumeration-quiet `22P02`).
6. `requireTeacherOfStudent(YUSUF)` as AAL2 `laerer@`: header subjects contain Koran with `quran_tracking: true` and Arabisk with `false`.
7. As `forelder@`, `getChildFremdrift(YUSUF)`: `grades` has 2 rows, the Koran row `{ grade: 'Utmerket' }`; `tests` `toEqual` one row with `points: 18, max_points: 20, title: 'Prøve: Det arabiske alfabetet'`.
8. As `forelder@`, `getChildFremdrift(ZAYNAB)` → `null` (**BERGEN #1** — not their child).
9. As `elev@`, `getOwnFremdrift()`: `fremdrift.quran.position` label fields `{ surah: 112, ayah_from: 1, ayah_to: 4 }`.
10. As `okonomi@`, `getChildFremdrift(YUSUF)` → rejects `NEXT_REDIRECT:/ingen-tilgang` (economy never reaches pedagogy).
11. As AAL2 `admin@`, `getStudentAssessmentForAdmin(YUSUF)`: 2 grades + `quran_position.surah === 112` + one book standing.
12. As AAL2 `laerer@`, `listBooks()` returns the 3 seeded books ordered subject-sort → level (Alfabet og lyder, Ord og setninger, Grunnleggende islamkunnskap).
13. `listBooksForSubject(ARABISK)` → exactly the two Arabisk books, level 1 then 2.
14. `getStudentFremdriftForTeacher(BILAL)` as `laerer@`: `B_ALFABET` standing `{ current_unit: 9 }`; `quran` is non-null (K1 offers Koran) with `position: null` and `weak_spots: []` (an empty log renders, not crashes).

- [ ] **Step 2: Run — expect RED**

```bash
cd /Users/daodilyas/dev/iqra-portal
npx vitest run --config vitest.config.api.ts tests/api/assessment-core.test.ts 2>&1 | tail -4
```

Expected FAIL: cannot resolve `@/lib/dal/curriculum` / `@/lib/dal/progress`.

- [ ] **Step 3: Extend `getSettings`**

In `src/lib/dal/settings.ts`, change the select line:

```ts
    .select('school_name, retention_months, purring_fee_ore')
```

to:

```ts
    .select('school_name, retention_months, purring_fee_ore, grade_scale')
```

- [ ] **Step 4: The curriculum DAL**

Create `src/lib/dal/curriculum.ts`:

```ts
import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export interface Book {
  id: string;
  subject_id: string;
  subject_name: string;
  title: string;
  level: number;
  unit_label: 'side' | 'leksjon' | 'enhet';
  total_units: number;
}

/**
 * The whole catalog, ordered subject sort → level → title. RLS scopes it: every
 * portal role reads it except economy (subjects mirror). Cached per request —
 * several fremdrift surfaces read it in one render.
 */
export const listBooks = cache(async (): Promise<Book[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('curriculum_books')
    .select('id, subject_id, title, level, unit_label, total_units, subjects(name, sort)')
    .order('level', { ascending: true })
    .order('title', { ascending: true });
  if (error) {
    throw new Error(`Kunne ikke lese bokkatalogen: ${error.message}`);
  }
  return (data ?? [])
    .sort((a, b) => (a.subjects?.sort ?? 0) - (b.subjects?.sort ?? 0))
    .map((b) => ({
      id: b.id,
      subject_id: b.subject_id,
      subject_name: b.subjects?.name ?? '',
      title: b.title,
      level: b.level,
      unit_label: b.unit_label as Book['unit_label'],
      total_units: b.total_units,
    }));
});

/** The catalog for one subject (level order). */
export async function listBooksForSubject(subjectId: string): Promise<Book[]> {
  const books = await listBooks();
  return books.filter((b) => b.subject_id === subjectId);
}
```

(The `.sort` on subject sort happens client-side because PostgREST cannot order a many-to-one join column without a computed view — the catalog is tens of rows, not thousands.)

- [ ] **Step 5: The progress DAL**

Create `src/lib/dal/progress.ts`:

```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { bookPercent, latestPerBook, quranStanding } from '@/lib/assessment';
import type { QuranLogEntry, QuranStanding } from '@/lib/assessment';
import { getCurrentTerm } from '@/lib/dal/terms';
import { requireRole, requireStaffRole } from './session';

export type { QuranLogEntry, QuranStanding } from '@/lib/assessment';

export interface BookStanding {
  book_id: string;
  title: string;
  level: number;
  unit_label: 'side' | 'leksjon' | 'enhet';
  total_units: number;
  subject_id: string;
  subject_name: string;
  current_unit: number;
  percent: number;
  recorded_at: string | null;
}

export interface ProgressLogEntry {
  id: string;
  book_id: string | null;
  book_title: string | null;
  subject_name: string;
  unit_reached: number;
  note: string | null;
  recorded_at: string;
}

export interface TestResultRow {
  test_id: string;
  title: string;
  subject_name: string;
  held_on: string;
  points: number;
  max_points: number;
  feedback: string | null;
}

export interface TermGradeRow {
  subject_id: string;
  subject_name: string;
  grade: string;
  feedback: string | null;
  set_at: string;
}

export interface StudentHeader {
  student_id: string;
  first_name: string;
  last_name: string;
  birth_year: number;
  protected: boolean;
  class_id: string;
  class_name: string;
  subjects: { id: string; name: string; quran_tracking: boolean }[];
}

export interface StudentFremdrift {
  books: BookStanding[];
  quran: QuranStanding | null;
  progress_log: ProgressLogEntry[];
}

type Db = SupabaseClient<Database>;

/**
 * The fremdrift assembler. Runs in the CALLER's session — RLS gives each role
 * exactly its rows, and every public wrapper has already re-checked the
 * relationship (wall 1). classSubjects seeds zero-standings for unlogged class
 * books (the teacher's log targets); when null (no active class resolvable),
 * standings are entries-driven only.
 */
async function assembleFremdrift(
  supabase: Db,
  studentId: string,
  classSubjects: { id: string; quran_tracking: boolean }[] | null,
): Promise<StudentFremdrift> {
  const [{ data: entries, error: entriesError }, { data: quranRows, error: quranError }, { data: books, error: booksError }] =
    await Promise.all([
      supabase
        .from('progress_entries')
        .select('id, book_id, subject_id, unit_reached, note, recorded_at, subjects(name), curriculum_books(title)')
        .eq('student_id', studentId)
        .order('recorded_at', { ascending: true }),
      supabase
        .from('quran_entries')
        .select('id, date, kind, surah, ayah_from, ayah_to, result, note')
        .eq('student_id', studentId)
        .order('date', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('curriculum_books')
        .select('id, subject_id, title, level, unit_label, total_units, subjects(name)'),
    ]);
  if (entriesError) throw new Error(`Kunne ikke lese fremdrift: ${entriesError.message}`);
  if (quranError) throw new Error(`Kunne ikke lese koranfremgang: ${quranError.message}`);
  if (booksError) throw new Error(`Kunne ikke lese bokkatalogen: ${booksError.message}`);

  const latest = latestPerBook(entries ?? []);
  const bookById = new Map((books ?? []).map((b) => [b.id, b]));

  const standingIds = new Set<string>(latest.keys());
  if (classSubjects) {
    const subjectIds = new Set(classSubjects.map((s) => s.id));
    for (const book of books ?? []) {
      if (subjectIds.has(book.subject_id)) standingIds.add(book.id);
    }
  }

  const standings: BookStanding[] = [...standingIds]
    .map((bookId) => {
      const book = bookById.get(bookId);
      if (!book) return null;
      const entry = latest.get(bookId) ?? null;
      return {
        book_id: book.id,
        title: book.title,
        level: book.level,
        unit_label: book.unit_label as BookStanding['unit_label'],
        total_units: book.total_units,
        subject_id: book.subject_id,
        subject_name: book.subjects?.name ?? '',
        current_unit: entry?.unit_reached ?? 0,
        percent: bookPercent(entry?.unit_reached ?? 0, book.total_units),
        recorded_at: entry?.recorded_at ?? null,
      };
    })
    .filter((s): s is BookStanding => s !== null)
    .sort((a, b) => a.subject_name.localeCompare(b.subject_name, 'nb') || a.level - b.level);

  const tracksQuran = classSubjects
    ? classSubjects.some((s) => s.quran_tracking)
    : (quranRows ?? []).length > 0;
  const quran = tracksQuran ? quranStanding((quranRows ?? []) as QuranLogEntry[]) : null;

  const progress_log: ProgressLogEntry[] = (entries ?? [])
    .map((e) => ({
      id: e.id,
      book_id: e.book_id,
      book_title: e.curriculum_books?.title ?? null,
      subject_name: e.subjects?.name ?? '',
      unit_reached: e.unit_reached,
      note: e.note,
      recorded_at: e.recorded_at,
    }))
    .reverse()
    .slice(0, 10);

  return { books: standings, quran, progress_log };
}

/** Current-term test results for one student (held_on inside the term). */
async function readTestResults(supabase: Db, studentId: string): Promise<TestResultRow[]> {
  const term = await getCurrentTerm();
  if (!term) return [];
  const { data, error } = await supabase
    .from('test_results')
    .select('test_id, points, feedback, tests!inner(title, held_on, max_points, subjects(name))')
    .eq('student_id', studentId)
    .gte('tests.held_on', term.starts_on)
    .lte('tests.held_on', term.ends_on)
    .order('tests(held_on)', { ascending: false });
  if (error) throw new Error(`Kunne ikke lese prøveresultater: ${error.message}`);
  return (data ?? []).map((r) => ({
    test_id: r.test_id,
    title: r.tests.title,
    subject_name: r.tests.subjects?.name ?? '',
    held_on: r.tests.held_on,
    points: r.points,
    max_points: r.tests.max_points,
    feedback: r.feedback,
  }));
}

/** Current-term grades for one student. */
async function readTermGrades(supabase: Db, studentId: string): Promise<TermGradeRow[]> {
  const term = await getCurrentTerm();
  if (!term) return [];
  const { data, error } = await supabase
    .from('term_grades')
    .select('subject_id, grade, feedback, set_at, subjects(name, sort)')
    .eq('student_id', studentId)
    .eq('term_id', term.id);
  if (error) throw new Error(`Kunne ikke lese terminkarakterer: ${error.message}`);
  return (data ?? [])
    .sort((a, b) => (a.subjects?.sort ?? 0) - (b.subjects?.sort ?? 0))
    .map((g) => ({
      subject_id: g.subject_id,
      subject_name: g.subjects?.name ?? '',
      grade: g.grade,
      feedback: g.feedback,
      set_at: g.set_at,
    }));
}

/**
 * DAL guard for the teacher's per-student surfaces and write path: teacher role
 * + AAL2, then an ACTIVE shared class (the .eq discipline — enumeration-quiet
 * null for foreign/former/unknown/malformed ids). Returns the header the page
 * renders, incl. the class's subjects (the log targets).
 */
export async function requireTeacherOfStudent(
  studentId: string,
): Promise<{ userId: string; header: StudentHeader } | null> {
  const { user } = await requireStaffRole('teacher');
  const supabase = await createClient();
  const { data: links, error: linkError } = await supabase
    .from('class_teachers')
    .select('class_id')
    .eq('teacher_id', user.id);
  if (linkError) throw new Error(`Kunne ikke lese egne klasser: ${linkError.message}`);
  const classIds = (links ?? []).map((l) => l.class_id);
  if (classIds.length === 0) return null;

  const { data: enrollment, error } = await supabase
    .from('class_students')
    .select(
      'class_id, students!inner(id, first_name, last_name, birth_year, protected), classes!inner(name, class_subjects(subjects(id, name, quran_tracking, sort)))',
    )
    .eq('student_id', studentId)
    .is('left_on', null)
    .in('class_id', classIds)
    .maybeSingle();
  if (error) {
    if (error.code === '22P02') return null;
    throw new Error(`Kunne ikke verifisere elevtilhørighet: ${error.message}`);
  }
  if (!enrollment) return null;

  const subjects = (enrollment.classes.class_subjects ?? [])
    .map((cs) => cs.subjects)
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => a.sort - b.sort)
    .map((s) => ({ id: s.id, name: s.name, quran_tracking: s.quran_tracking }));

  return {
    userId: user.id,
    header: {
      student_id: enrollment.students.id,
      first_name: enrollment.students.first_name,
      last_name: enrollment.students.last_name,
      birth_year: enrollment.students.birth_year,
      protected: enrollment.students.protected,
      class_id: enrollment.class_id,
      class_name: enrollment.classes.name,
      subjects,
    },
  };
}

/** The teacher's per-student assessment page read. */
export async function getStudentFremdriftForTeacher(studentId: string): Promise<{
  header: StudentHeader;
  fremdrift: StudentFremdrift;
  tests: TestResultRow[];
  grades: TermGradeRow[];
} | null> {
  const guard = await requireTeacherOfStudent(studentId);
  if (!guard) return null;
  const supabase = await createClient();
  const [fremdrift, tests, grades] = await Promise.all([
    assembleFremdrift(supabase, studentId, guard.header.subjects),
    readTestResults(supabase, studentId),
    readTermGrades(supabase, studentId),
  ]);
  return { header: guard.header, fremdrift, tests, grades };
}

/** A guardian's own child's fremdrift; null if not their child. */
export async function getChildFremdrift(studentId: string): Promise<{
  fremdrift: StudentFremdrift;
  tests: TestResultRow[];
  grades: TermGradeRow[];
} | null> {
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
  const subjects = await resolveActiveClassSubjects(supabase, studentId);
  const [fremdrift, tests, grades] = await Promise.all([
    assembleFremdrift(supabase, studentId, subjects),
    readTestResults(supabase, studentId),
    readTermGrades(supabase, studentId),
  ]);
  return { fremdrift, tests, grades };
}

/** The student login's own fremdrift; null while unlinked. */
export async function getOwnFremdrift(): Promise<{
  fremdrift: StudentFremdrift;
  tests: TestResultRow[];
  grades: TermGradeRow[];
} | null> {
  const { user } = await requireRole('student');
  const supabase = await createClient();
  const { data: me, error: meError } = await supabase
    .from('students')
    .select('id')
    .eq('student_user_id', user.id)
    .maybeSingle();
  if (meError) throw new Error(`Kunne ikke lese egen elevinformasjon: ${meError.message}`);
  if (!me) return null;
  const subjects = await resolveActiveClassSubjects(supabase, me.id);
  const [fremdrift, tests, grades] = await Promise.all([
    assembleFremdrift(supabase, me.id, subjects),
    readTestResults(supabase, me.id),
    readTermGrades(supabase, me.id),
  ]);
  return { fremdrift, tests, grades };
}

/** The admin one-glance block (compact: standings, position, grades). */
export async function getStudentAssessmentForAdmin(studentId: string): Promise<{
  books: BookStanding[];
  quran_position: QuranLogEntry | null;
  grades: TermGradeRow[];
}> {
  await requireStaffRole('admin');
  const supabase = await createClient();
  const [fremdrift, grades] = await Promise.all([
    assembleFremdrift(supabase, studentId, null),
    readTermGrades(supabase, studentId),
  ]);
  return {
    books: fremdrift.books,
    quran_position: fremdrift.quran?.position ?? null,
    grades,
  };
}

/** The student's active class subjects, readable by guardian/self under RLS. */
async function resolveActiveClassSubjects(
  supabase: Db,
  studentId: string,
): Promise<{ id: string; quran_tracking: boolean }[] | null> {
  const { data, error } = await supabase
    .from('class_students')
    .select('classes!inner(class_subjects(subjects(id, quran_tracking)))')
    .eq('student_id', studentId)
    .is('left_on', null)
    .maybeSingle();
  if (error) {
    if (error.code === '22P02') return null;
    throw new Error(`Kunne ikke lese klassefag: ${error.message}`);
  }
  if (!data) return null;
  return (data.classes.class_subjects ?? [])
    .map((cs) => cs.subjects)
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .map((s) => ({ id: s.id, quran_tracking: s.quran_tracking }));
}
```

- [ ] **Step 6: Run — expect GREEN**

```bash
cd /Users/daodilyas/dev/iqra-portal
npx vitest run --config vitest.config.api.ts tests/api/assessment-core.test.ts 2>&1 | tail -4
npm run typecheck && npm run lint
```

Expected: 14/14; typecheck/lint silent. (If PostgREST rejects the `order('tests(held_on)')` embedded-order syntax on this version, sort the mapped rows client-side by `held_on` descending instead — same observable contract, note it for spec review.) `tests/api` running total: **195**.

- [ ] **Step 7: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add src/lib/dal/settings.ts src/lib/dal/curriculum.ts src/lib/dal/progress.ts tests/api/assessment-core.test.ts
git commit -m "feat: curriculum and per-student fremdrift DAL reads"
```

---

### Task 9: DAL — tests entry + term report assembly

The test-entry twin of `getLessonForMarking` (interval roster **as of `held_on`**, existing results prefilled) and the term-report assembler (grades + achieved book standings + Quran position + a current-term attendance summary) with one guarded wrapper per audience.

**Files:**
- Create: `src/lib/dal/assessment.ts`
- Modify: `tests/api/assessment-core.test.ts` (append a new `describe` block)

- [ ] **Step 1: Append the failing API tests**

Append to `tests/api/assessment-core.test.ts` (constants already at top; add `const K1 = 'fc000000-0000-0000-0000-000000000001';`, `const K3 = 'fc000000-0000-0000-0000-000000000002';`, `const T_ALFABET = 'f5000000-0000-0000-0000-000000000001';` and a `serviceClient()` helper exactly like `attendance-core.test.ts`'s — sanctioned ONLY to tear down scratch `tests` rows). The 12 `it` blocks:

1. As AAL2 `laerer@`, `listClassTestsForTeacher(K1)`: one test — `{ title: 'Prøve: Det arabiske alfabetet', max_points: 20, result_count: 2 }`.
2. `listClassTestsForTeacher(K3)` as `laerer@` → `null` (foreign class).
3. `getTestForEntry(T_ALFABET)`: roster is Yusuf + Bilal (protokoll order: Farah before Omar), Yusuf prefilled `{ points: 18 }`, Bilal `{ points: 14 }`, `test.subject_name === 'Arabisk'`.
4. As AAL2 `laererforelder@`, `getTestForEntry(T_ALFABET)` → `null` (foreign test — fine-derived #4).
5. `getTestForEntry('ikke-en-uuid')` → `null`.
6. **Interval wall-1:** as AAL2 `admin@` create a scratch K1 test dated `2026-08-19` (before every seed enrollment: 2026-08-20) via the mocked server client; as `laerer@`, `getTestForEntry(scratch)` roster `toEqual([])`; `finally` service-delete the scratch test.
7. As AAL2 `laerer@`, `getTermReportForTeacher(YUSUF)`: `term_name 'Høst 2026'`, `class_name 'Klasse 1'`, 2 grades, `attendance` `toEqual({ present: 1, absent: 0, late: 0, excused: 0, total: 1 })` (Yusuf's single L_PAST mark), `books` has exactly 1 achieved standing (report = achieved positions, not zero-targets), `quran_position.surah === 112`.
8. `getTermReportForTeacher(AMIRA)` as `laerer@` → `null`.
9. As `forelder@`, `getTermReportForChild(YUSUF)`: same `attendance` object and `grades.length === 2`.
10. As `forelder@`, `getTermReportForChild(ZAYNAB)` → `null` (**BERGEN #1**).
11. As `okonomi@`, `getTermReportForChild(YUSUF)` → rejects `NEXT_REDIRECT:/ingen-tilgang`.
12. As AAL1 `laerer@`, `getTestForEntry(T_ALFABET)` → rejects `NEXT_REDIRECT:/mfa/registrer` (guard order).

- [ ] **Step 2: Run — expect the new block RED**

```bash
cd /Users/daodilyas/dev/iqra-portal
npx vitest run --config vitest.config.api.ts tests/api/assessment-core.test.ts 2>&1 | tail -4
```

- [ ] **Step 3: The assessment DAL**

Create `src/lib/dal/assessment.ts`:

```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getCurrentTerm } from '@/lib/dal/terms';
import {
  getChildFremdrift,
  getStudentFremdriftForTeacher,
  requireTeacherOfStudent,
} from '@/lib/dal/progress';
import type { BookStanding, QuranLogEntry, TermGradeRow } from '@/lib/dal/progress';
import { requireRole, requireStaffRole } from './session';

export interface ClassTest {
  id: string;
  subject_id: string;
  subject_name: string;
  title: string;
  held_on: string;
  max_points: number;
  result_count: number;
}

export interface TestRosterEntry {
  student_id: string;
  first_name: string;
  last_name: string;
  protected: boolean;
  points: number | null;
  feedback: string | null;
}

export interface TestForEntry {
  test: {
    id: string;
    class_id: string;
    class_name: string;
    subject_name: string;
    title: string;
    held_on: string;
    max_points: number;
  };
  roster: TestRosterEntry[];
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
}

export interface TermReport {
  student: { first_name: string; last_name: string; birth_year: number };
  term_name: string;
  class_name: string;
  grades: TermGradeRow[];
  books: BookStanding[];
  quran_position: QuranLogEntry | null;
  attendance: AttendanceSummary;
}

type Db = SupabaseClient<Database>;

/** Every test of ONE of the caller's own classes; null for a foreign class. */
export async function listClassTestsForTeacher(classId: string): Promise<ClassTest[] | null> {
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
    .from('tests')
    .select('id, subject_id, title, held_on, max_points, subjects(name), test_results(test_id)')
    .eq('class_id', classId)
    .order('held_on', { ascending: false });
  if (error) throw new Error(`Kunne ikke lese prøvene: ${error.message}`);
  return (data ?? []).map((t) => ({
    id: t.id,
    subject_id: t.subject_id,
    subject_name: t.subjects?.name ?? '',
    title: t.title,
    held_on: t.held_on,
    max_points: t.max_points,
    result_count: (t.test_results ?? []).length,
  }));
}

/**
 * DAL guard for the results write path: teacher role + AAL2, then the caller
 * teaches the test's class. Enumeration-quiet null otherwise.
 */
export async function requireTeacherOfTest(
  testId: string,
): Promise<{ userId: string; classId: string; heldOn: string; maxPoints: number } | null> {
  const { user } = await requireStaffRole('teacher');
  const supabase = await createClient();
  const { data: test, error } = await supabase
    .from('tests')
    .select('id, class_id, held_on, max_points')
    .eq('id', testId)
    .maybeSingle();
  if (error) {
    if (error.code === '22P02') return null;
    throw new Error(`Kunne ikke lese prøven: ${error.message}`);
  }
  if (!test) return null;
  const { data: link, error: linkError } = await supabase
    .from('class_teachers')
    .select('teacher_id')
    .eq('class_id', test.class_id)
    .eq('teacher_id', user.id)
    .maybeSingle();
  if (linkError) throw new Error(`Kunne ikke verifisere prøvetilhørighet: ${linkError.message}`);
  if (!link) return null;
  return { userId: user.id, classId: test.class_id, heldOn: test.held_on, maxPoints: test.max_points };
}

/**
 * The results-entry read: test meta + the interval roster AS OF held_on with
 * existing results prefilled (the marking-screen twin — one screen, one save).
 */
export async function getTestForEntry(testId: string): Promise<TestForEntry | null> {
  const guard = await requireTeacherOfTest(testId);
  if (!guard) return null;
  const supabase = await createClient();

  const { data: test, error: testError } = await supabase
    .from('tests')
    .select('id, class_id, title, held_on, max_points, classes(name), subjects(name)')
    .eq('id', testId)
    .single();
  if (testError) throw new Error(`Kunne ikke lese prøven: ${testError.message}`);

  const { data: rosterRows, error: rosterError } = await supabase
    .from('class_students')
    .select('student_id, students!inner(id, first_name, last_name, protected)')
    .eq('class_id', guard.classId)
    .lte('enrolled_on', guard.heldOn)
    .or(`left_on.is.null,left_on.gt.${guard.heldOn}`);
  if (rosterError) throw new Error(`Kunne ikke lese prøvelisten: ${rosterError.message}`);

  const { data: results, error: resultsError } = await supabase
    .from('test_results')
    .select('student_id, points, feedback')
    .eq('test_id', testId);
  if (resultsError) throw new Error(`Kunne ikke lese resultatene: ${resultsError.message}`);
  const byStudent = new Map((results ?? []).map((r) => [r.student_id, r]));

  const roster: TestRosterEntry[] = (rosterRows ?? [])
    .map((row) => ({
      student_id: row.students.id,
      first_name: row.students.first_name,
      last_name: row.students.last_name,
      protected: row.students.protected,
      points: byStudent.get(row.students.id)?.points ?? null,
      feedback: byStudent.get(row.students.id)?.feedback ?? null,
    }))
    .sort(
      (a, b) =>
        a.last_name.localeCompare(b.last_name, 'nb') ||
        a.first_name.localeCompare(b.first_name, 'nb'),
    );

  return {
    test: {
      id: test.id,
      class_id: test.class_id,
      class_name: test.classes?.name ?? '',
      subject_name: test.subjects?.name ?? '',
      title: test.title,
      held_on: test.held_on,
      max_points: test.max_points,
    },
    roster,
  };
}

/** Current-term attendance summary for one student (report block). */
async function readAttendanceSummary(supabase: Db, studentId: string): Promise<AttendanceSummary> {
  const term = await getCurrentTerm();
  const summary: AttendanceSummary = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
  if (!term) return summary;
  const { data, error } = await supabase
    .from('attendance')
    .select('status, lessons!inner(date)')
    .eq('student_id', studentId)
    .gte('lessons.date', term.starts_on)
    .lte('lessons.date', term.ends_on);
  if (error) throw new Error(`Kunne ikke lese oppmøtesammendrag: ${error.message}`);
  for (const row of data ?? []) {
    summary[row.status] += 1;
    summary.total += 1;
  }
  return summary;
}

/** Report body from an already-authorized fremdrift read (audience-agnostic). */
async function buildReport(
  supabase: Db,
  studentId: string,
  student: { first_name: string; last_name: string; birth_year: number },
  className: string,
  grades: TermGradeRow[],
  books: BookStanding[],
  quranPosition: QuranLogEntry | null,
): Promise<TermReport> {
  const term = await getCurrentTerm();
  const attendance = await readAttendanceSummary(supabase, studentId);
  return {
    student,
    term_name: term?.name ?? '',
    class_name: className,
    grades,
    // The report shows ACHIEVED positions only — zero-standings are log
    // targets for the entry UI, not report content.
    books: books.filter((b) => b.recorded_at !== null),
    quran_position: quranPosition,
    attendance,
  };
}

/** The teacher's printable term report (active students of own classes). */
export async function getTermReportForTeacher(studentId: string): Promise<TermReport | null> {
  const read = await getStudentFremdriftForTeacher(studentId);
  if (!read) return null;
  const supabase = await createClient();
  return buildReport(
    supabase,
    studentId,
    {
      first_name: read.header.first_name,
      last_name: read.header.last_name,
      birth_year: read.header.birth_year,
    },
    read.header.class_name,
    read.grades,
    read.fremdrift.books,
    read.fremdrift.quran?.position ?? null,
  );
}

/** The guardian's report view of their own child. */
export async function getTermReportForChild(studentId: string): Promise<TermReport | null> {
  const read = await getChildFremdrift(studentId);
  if (!read) return null;
  const { user: _user } = await requireRole('parent');
  const supabase = await createClient();
  const { data: child, error } = await supabase
    .from('students')
    .select('first_name, last_name, birth_year, class_students(classes(name))')
    .eq('id', studentId)
    .is('class_students.left_on', null)
    .single();
  if (error) throw new Error(`Kunne ikke lese eleven: ${error.message}`);
  const className = child.class_students[0]?.classes?.name ?? '';
  return buildReport(
    supabase,
    studentId,
    { first_name: child.first_name, last_name: child.last_name, birth_year: child.birth_year },
    className,
    read.grades,
    read.fremdrift.books,
    read.fremdrift.quran?.position ?? null,
  );
}
```

The unused-looking `requireTeacherOfStudent` import is deliberate ballast **only if** typecheck flags it — then remove it (the guard already runs inside `getStudentFremdriftForTeacher`). Keep imports minimal and lint-clean.

- [ ] **Step 4: Run — expect GREEN**

```bash
cd /Users/daodilyas/dev/iqra-portal
npx vitest run --config vitest.config.api.ts tests/api/assessment-core.test.ts 2>&1 | tail -4
npm run typecheck && npm run lint
```

Expected: **26/26** in the file (14 + 12); typecheck/lint silent. `tests/api` running total: **207**.

- [ ] **Step 5: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add src/lib/dal/assessment.ts tests/api/assessment-core.test.ts
git commit -m "feat: test-entry roster and term-report DAL reads"
```

---

### Task 10: Actions — log/retract progress & quran, set term grade, books CRUD

The teacher write path for the two logs and the term grade (guard → zod → **wall-1 double bind** → write → revalidate) and the admin books CRUD. Retracts follow the absence-notice precedent: idempotent, unconfirmed (RLS author-scoping makes a non-author's delete a silent no-op — pinned by a test that proves the row survives).

**Contract note (supersedes the header contract):** the book actions are double-bound like the lesson actions — `updateBook(subjectId, bookId, prev, formData)` and `deleteBook(subjectId, bookId, prev, formData)` (the leading `subjectId` scopes `revalidatePath`).

**Files:**
- Create: `src/app/(portal)/laerer/elev/[studentId]/actions.ts`
- Create: `src/app/(portal)/admin/fag/[id]/actions.ts`
- Create: `tests/api/assessment-actions.test.ts`

- [ ] **Step 1: Write the failing API tests**

Create `tests/api/assessment-actions.test.ts` with the **four** `vi.mock` blocks exactly as `attendance-actions.test.ts` (`server-only`, `@/lib/supabase/server`, `next/navigation`, **and `next/cache`** — the actions revalidate). Service client helper as in `attendance-core.test.ts` — sanctioned ONLY to clean scratch `progress_entries`/`quran_entries` rows (service_role holds delete there); scratch books are cleaned through the `deleteBook` action itself (service_role deliberately has **no** delete on `curriculum_books`). Scratch log entries carry the note marker `'API-TEST-RYDD'` and are service-deleted by that marker in `finally`. Seed constants as in `assessment-core` plus `const ISLAMKUNNSKAP = 'fa000000-0000-0000-0000-000000000003';`.

The 12 `it` blocks:

1. **logProgress happy:** AAL2 `laerer@` logs Yusuf on `B_ALFABET` (`subject_id` ARABISK, `unit_reached: 19`, note `'API-TEST-RYDD'`) → `{ error: null, success: true }`; `finally` service-deletes by marker.
2. **logProgress foreign student:** AMIRA → `{ error: 'Du underviser ikke denne eleven.' }`.
3. **logProgress off-subject (double bind, wall 1):** Yusuf + `subject_id` ISLAMKUNNSKAP → `{ error: 'Faget tilhører ikke elevens klasse.' }`.
4. **Guard order:** AAL1 `laerer@` submitting garbage → rejects `NEXT_REDIRECT:/mfa/registrer` (role → AAL2 before validation).
5. **logQuran happy:** Yusuf surah 111, 1–5, `new`/`pass`, note `'API-TEST-RYDD'` → success; service cleanup by marker.
6. **logQuran ayah clamp:** surah 112, ayah 1–9 → `{ error: 'Al-Ikhlas har 4 ayat.' }`.
7. **setTermGrade upsert (self-cleaning):** Yusuf × ARABISK → `'God'` → success; then re-set to `'Meget god'` (the seed value) → success (correction path proven, seed restored — no service client needed).
8. **setTermGrade off-scale:** grade `'Toppers'` → `{ error: 'Karakteren må være en av skalaens verdier.' }`.
9. **setTermGrade foreign student:** ZAYNAB → `{ error: 'Du underviser ikke denne eleven.' }`.
10. **Books CRUD round-trip:** AAL2 `admin@` `createBook(ISLAMKUNNSKAP, …)` title `'API-testbok'`, level 1, `enhet`, 12 → success; a second identical create → `{ error: 'En bok med denne tittelen finnes allerede for faget.' }`; `deleteBook(ISLAMKUNNSKAP, <id from a listBooksForSubject lookup>, …)` → success.
11. **Books admin-gate:** `createBook` as AAL2 `laerer@` → rejects `NEXT_REDIRECT:/ingen-tilgang`.
12. **Retract is author-scoped:** AAL2 `laererforelder@` calls `deleteProgressEntry('f3000000-0000-0000-0000-000000000001', …)` (Yusuf's seed entry, authored by `laerer@`) → `{ error: null, success: true }` (idempotent surface), and a service count for that id is still **1** — the row survived (RLS author scope held; the UI never offers foreign rows).

- [ ] **Step 2: Run — expect RED**

```bash
cd /Users/daodilyas/dev/iqra-portal
npx vitest run --config vitest.config.api.ts tests/api/assessment-actions.test.ts 2>&1 | tail -4
```

- [ ] **Step 3: The teacher log/grade actions**

Create `src/app/(portal)/laerer/elev/[studentId]/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentTerm } from '@/lib/dal/terms';
import { requireTeacherOfStudent } from '@/lib/dal/progress';
import { getSettings } from '@/lib/dal/settings';
import { requireStaffRole } from '@/lib/dal/session';
import {
  progressEntrySchema,
  quranEntrySchema,
  termGradeSchema,
} from '@/lib/validation/assessment';
import { firstIssue, type FormState } from '@/lib/validation/school';

/** Append one book-position entry (D1: log, never update). */
export async function logProgress(
  studentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await requireTeacherOfStudent(studentId);
  if (!guard) return { error: 'Du underviser ikke denne eleven.' };

  const parsed = progressEntrySchema.safeParse({
    subject_id: formData.get('subject_id'),
    book_id: formData.get('book_id') ?? '',
    unit_reached: formData.get('unit_reached'),
    note: formData.get('note') ?? '',
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  // Wall 1 double bind: the subject must be one of the class's subjects, and a
  // chosen book must belong to that subject (RLS re-proves both at wall 2).
  if (!guard.header.subjects.some((s) => s.id === parsed.data.subject_id)) {
    return { error: 'Faget tilhører ikke elevens klasse.' };
  }
  const supabase = await createClient();
  if (parsed.data.book_id) {
    const { data: book, error: bookError } = await supabase
      .from('curriculum_books')
      .select('id, subject_id')
      .eq('id', parsed.data.book_id)
      .maybeSingle();
    if (bookError) {
      return { error: `Kunne ikke verifisere boken: ${bookError.message}` };
    }
    if (!book || book.subject_id !== parsed.data.subject_id) {
      return { error: 'Boken tilhører ikke faget.' };
    }
  }

  const { error } = await supabase.from('progress_entries').insert({
    student_id: studentId,
    subject_id: parsed.data.subject_id,
    book_id: parsed.data.book_id,
    lesson_id: null,
    unit_reached: parsed.data.unit_reached,
    note: parsed.data.note ?? null,
    recorded_by: guard.userId,
  });
  if (error) {
    if (error.code === '23503') return { error: 'Faget eller boken finnes ikke lenger.' };
    return { error: `Kunne ikke lagre fremgangen: ${error.message}` };
  }
  revalidatePath(`/laerer/elev/${studentId}`);
  return { error: null, success: true };
}

/** Append one Quran memorisation entry. */
export async function logQuran(
  studentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await requireTeacherOfStudent(studentId);
  if (!guard) return { error: 'Du underviser ikke denne eleven.' };
  if (!guard.header.subjects.some((s) => s.quran_tracking)) {
    return { error: 'Klassen har ikke koranundervisning.' };
  }

  const parsed = quranEntrySchema.safeParse({
    date: formData.get('date'),
    kind: formData.get('kind'),
    surah: formData.get('surah'),
    ayah_from: formData.get('ayah_from'),
    ayah_to: formData.get('ayah_to'),
    result: formData.get('result'),
    note: formData.get('note') ?? '',
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from('quran_entries').insert({
    student_id: studentId,
    lesson_id: null,
    date: parsed.data.date,
    kind: parsed.data.kind,
    surah: parsed.data.surah,
    ayah_from: parsed.data.ayah_from,
    ayah_to: parsed.data.ayah_to,
    result: parsed.data.result,
    note: parsed.data.note ?? null,
    recorded_by: guard.userId,
  });
  if (error) {
    return { error: `Kunne ikke lagre koranfremgangen: ${error.message}` };
  }
  revalidatePath(`/laerer/elev/${studentId}`);
  return { error: null, success: true };
}

/** Retract an own mis-entry (idempotent; RLS scopes to author-or-admin). */
export async function deleteProgressEntry(
  entryId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  void formData;
  await requireStaffRole('teacher');
  const supabase = await createClient();
  const { error } = await supabase.from('progress_entries').delete().eq('id', entryId);
  if (error) {
    if (error.code === '22P02') return { error: 'Ugyldig id.' };
    return { error: `Kunne ikke fjerne registreringen: ${error.message}` };
  }
  revalidatePath('/laerer');
  return { error: null, success: true };
}

/** Retract an own Quran mis-entry (idempotent; author-or-admin at wall 2). */
export async function deleteQuranEntry(
  entryId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  void formData;
  await requireStaffRole('teacher');
  const supabase = await createClient();
  const { error } = await supabase.from('quran_entries').delete().eq('id', entryId);
  if (error) {
    if (error.code === '22P02') return { error: 'Ugyldig id.' };
    return { error: `Kunne ikke fjerne registreringen: ${error.message}` };
  }
  revalidatePath('/laerer');
  return { error: null, success: true };
}

/** Set/overwrite the CURRENT term's grade for one subject (upsert, D5). */
export async function setTermGrade(
  studentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await requireTeacherOfStudent(studentId);
  if (!guard) return { error: 'Du underviser ikke denne eleven.' };

  const parsed = termGradeSchema.safeParse({
    subject_id: formData.get('subject_id'),
    grade: formData.get('grade'),
    feedback: formData.get('feedback') ?? '',
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  if (!guard.header.subjects.some((s) => s.id === parsed.data.subject_id)) {
    return { error: 'Faget tilhører ikke elevens klasse.' };
  }
  const settings = await getSettings();
  if (!settings.grade_scale.includes(parsed.data.grade)) {
    return { error: 'Karakteren må være en av skalaens verdier.' };
  }
  const term = await getCurrentTerm();
  if (!term) return { error: 'Ingen termin er satt som aktiv.' };

  const supabase = await createClient();
  const { error } = await supabase.from('term_grades').upsert(
    {
      student_id: studentId,
      term_id: term.id,
      subject_id: parsed.data.subject_id,
      grade: parsed.data.grade,
      feedback: parsed.data.feedback ?? null,
      set_by: guard.userId,
      set_at: new Date().toISOString(),
    },
    { onConflict: 'student_id,term_id,subject_id' },
  );
  if (error) {
    if (error.code === '23503') return { error: 'Faget eller terminen finnes ikke lenger.' };
    return { error: `Kunne ikke lagre karakteren: ${error.message}` };
  }
  revalidatePath(`/laerer/elev/${studentId}`);
  revalidatePath(`/laerer/elev/${studentId}/rapport`);
  return { error: null, success: true };
}
```

- [ ] **Step 4: The books actions**

Create `src/app/(portal)/admin/fag/[id]/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaffRole } from '@/lib/dal/session';
import { bookSchema } from '@/lib/validation/assessment';
import { firstIssue, type FormState } from '@/lib/validation/school';

function parseBook(formData: FormData) {
  return bookSchema.safeParse({
    title: formData.get('title'),
    level: formData.get('level'),
    unit_label: formData.get('unit_label'),
    total_units: formData.get('total_units'),
  });
}

/** Add a book to the subject's ladder (admin). */
export async function createBook(
  subjectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaffRole('admin');
  const parsed = parseBook(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from('curriculum_books').insert({
    subject_id: subjectId,
    ...parsed.data,
  });
  if (error) {
    if (error.code === '23505') {
      return { error: 'En bok med denne tittelen finnes allerede for faget.' };
    }
    if (error.code === '23503' || error.code === '22P02') {
      return { error: 'Faget finnes ikke lenger.' };
    }
    return { error: `Kunne ikke opprette boken: ${error.message}` };
  }
  revalidatePath(`/admin/fag/${subjectId}`);
  return { error: null, success: true };
}

/** Edit a book (write-confirmed — a vanished book reports, not pretends). */
export async function updateBook(
  subjectId: string,
  bookId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaffRole('admin');
  const parsed = parseBook(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('curriculum_books')
    .update(parsed.data)
    .eq('id', bookId)
    .select('id');
  if (error) {
    if (error.code === '23505') {
      return { error: 'En bok med denne tittelen finnes allerede for faget.' };
    }
    if (error.code === '22P02') return { error: 'Ugyldig id.' };
    return { error: `Kunne ikke oppdatere boken: ${error.message}` };
  }
  if ((data ?? []).length === 0) return { error: 'Boken finnes ikke lenger.' };
  revalidatePath(`/admin/fag/${subjectId}`);
  return { error: null, success: true };
}

/** Remove a book (idempotent; progress history survives via set null). */
export async function deleteBook(
  subjectId: string,
  bookId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  void formData;
  await requireStaffRole('admin');
  const supabase = await createClient();
  const { error } = await supabase.from('curriculum_books').delete().eq('id', bookId);
  if (error) {
    if (error.code === '22P02') return { error: 'Ugyldig id.' };
    return { error: `Kunne ikke fjerne boken: ${error.message}` };
  }
  revalidatePath(`/admin/fag/${subjectId}`);
  return { error: null, success: true };
}
```

- [ ] **Step 5: Run — expect GREEN**

```bash
cd /Users/daodilyas/dev/iqra-portal
npx vitest run --config vitest.config.api.ts tests/api/assessment-actions.test.ts 2>&1 | tail -4
npm run typecheck && npm run lint
```

Expected: 12/12; typecheck/lint silent (the `void formData;` lines keep the bound-action signatures uniform without unused-param warnings). `tests/api` running total: **219**.

- [ ] **Step 6: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add "src/app/(portal)/laerer/elev/[studentId]/actions.ts" "src/app/(portal)/admin/fag/[id]/actions.ts" tests/api/assessment-actions.test.ts
git commit -m "feat: teacher log and grade actions plus admin books CRUD"
```

---

### Task 11: Actions — create/edit test + save results

The test write path. `saveTestResults` is `markAttendance`'s twin: guard → parse the hidden `results` JSON → **re-derive the interval roster as of `held_on`** (wall-1 double bind) → validate `points ≤ max_points` against the guard's test row → upsert → revalidate.

**Files:**
- Create: `src/app/(portal)/laerer/klasser/[id]/actions.ts`
- Create: `src/app/(portal)/laerer/prover/[testId]/actions.ts`
- Modify: `tests/api/assessment-actions.test.ts` (append a `describe` block)

- [ ] **Step 1: Append the failing API tests**

Append 12 `it` blocks to `tests/api/assessment-actions.test.ts` (scratch tests are created fresh per case as AAL2 `laerer@` through `createTest` + a `listClassTestsForTeacher` lookup by title, and torn down in `finally` with the service client — service_role holds delete on `tests`, and `test_results` cascade):

1. **createTest happy:** K1, ARABISK, `'API-prøve'`, `2026-09-12`, max 10 → `{ error: null, success: true }` and the test appears in `listClassTestsForTeacher(K1)`.
2. **createTest foreign class:** K3 as `laerer@` → `{ error: 'Du underviser ikke denne klassen.' }`.
3. **createTest off-subject:** ISLAMKUNNSKAP in K1 → `{ error: 'Faget tilhører ikke klassen.' }`.
4. **Guard order:** AAL1 `laerer@` → rejects `NEXT_REDIRECT:/mfa/registrer`.
5. **saveTestResults happy:** on a scratch K1 test — Yusuf 9 + Bilal 7 → success; `getTestForEntry` prefills `{ 9, 7 }`.
6. **Off-roster forgery (C-1 twin):** results payload smuggles AMIRA → `{ error: 'En eller flere elever tilhører ikke prøven.' }`.
7. **Points cap:** Yusuf 11 on the max-10 scratch → `{ error: 'Poeng kan ikke overstige maks poeng (10).' }`.
8. **Foreign teacher:** AAL2 `laererforelder@` saving on the K1 scratch → `{ error: 'Du underviser ikke denne prøven.' }`.
9. **Malformed JSON:** `results` = `'ikke-json'` → `{ error: 'Ugyldige resultater.' }`.
10. **editTest happy:** retitle the scratch to `'API-prøve 2'` → success; `getTestForEntry` shows the new title.
11. **editTest foreign:** `laererforelder@` → `{ error: 'Du underviser ikke denne prøven.' }`.
12. **Correction upsert:** re-save Yusuf 10 → success; prefill now 10 (the one-save correction model).

- [ ] **Step 2: Run — expect the new block RED**

```bash
cd /Users/daodilyas/dev/iqra-portal
npx vitest run --config vitest.config.api.ts tests/api/assessment-actions.test.ts 2>&1 | tail -4
```

- [ ] **Step 3: The class-page action**

Create `src/app/(portal)/laerer/klasser/[id]/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaffRole } from '@/lib/dal/session';
import { testSchema } from '@/lib/validation/assessment';
import { firstIssue, type FormState } from '@/lib/validation/school';

/** Create a class test (teacher of the class; subject must be the class's). */
export async function createTest(
  classId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireStaffRole('teacher');
  const supabase = await createClient();
  const { data: link, error: linkError } = await supabase
    .from('class_teachers')
    .select('class_id')
    .eq('class_id', classId)
    .eq('teacher_id', user.id)
    .maybeSingle();
  if (linkError && linkError.code !== '22P02') {
    return { error: `Kunne ikke verifisere klassetilhørighet: ${linkError.message}` };
  }
  if (!link) return { error: 'Du underviser ikke denne klassen.' };

  const parsed = testSchema.safeParse({
    subject_id: formData.get('subject_id'),
    title: formData.get('title'),
    held_on: formData.get('held_on'),
    max_points: formData.get('max_points'),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  // Wall 1 double bind: the subject must belong to the class (RLS re-proves
  // the teacher link; class_subjects membership is app-enforced — see spec §4).
  const { data: subjectLink, error: subjectError } = await supabase
    .from('class_subjects')
    .select('subject_id')
    .eq('class_id', classId)
    .eq('subject_id', parsed.data.subject_id)
    .maybeSingle();
  if (subjectError) {
    return { error: `Kunne ikke verifisere faget: ${subjectError.message}` };
  }
  if (!subjectLink) return { error: 'Faget tilhører ikke klassen.' };

  const { error } = await supabase.from('tests').insert({
    class_id: classId,
    subject_id: parsed.data.subject_id,
    title: parsed.data.title,
    held_on: parsed.data.held_on,
    max_points: parsed.data.max_points,
  });
  if (error) {
    if (error.code === '23503') return { error: 'Klassen eller faget finnes ikke lenger.' };
    return { error: `Kunne ikke opprette prøven: ${error.message}` };
  }
  revalidatePath(`/laerer/klasser/${classId}`);
  return { error: null, success: true };
}
```

- [ ] **Step 4: The results-entry actions**

Create `src/app/(portal)/laerer/prover/[testId]/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireTeacherOfTest } from '@/lib/dal/assessment';
import { testEditSchema, testResultsSchema } from '@/lib/validation/assessment';
import { firstIssue, type FormState } from '@/lib/validation/school';

/** Save the whole results sheet in one upsert (corrections re-save). */
export async function saveTestResults(
  testId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await requireTeacherOfTest(testId);
  if (!guard) return { error: 'Du underviser ikke denne prøven.' };

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get('results') ?? ''));
  } catch {
    return { error: 'Ugyldige resultater.' };
  }
  const parsed = testResultsSchema.safeParse(raw);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const overMax = parsed.data.find((r) => r.points > guard.maxPoints);
  if (overMax) {
    return { error: `Poeng kan ikke overstige maks poeng (${guard.maxPoints}).` };
  }

  // Wall 1 double bind (the attendance C-1 lesson): re-derive the interval
  // roster AS OF held_on and reject any smuggled student before writing.
  const supabase = await createClient();
  const { data: rosterRows, error: rosterError } = await supabase
    .from('class_students')
    .select('student_id')
    .eq('class_id', guard.classId)
    .lte('enrolled_on', guard.heldOn)
    .or(`left_on.is.null,left_on.gt.${guard.heldOn}`);
  if (rosterError) {
    return { error: `Kunne ikke lese prøvelisten: ${rosterError.message}` };
  }
  const roster = new Set((rosterRows ?? []).map((r) => r.student_id));
  if (parsed.data.some((r) => !roster.has(r.student_id))) {
    return { error: 'En eller flere elever tilhører ikke prøven.' };
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from('test_results').upsert(
    parsed.data.map((r) => ({
      test_id: testId,
      student_id: r.student_id,
      points: r.points,
      feedback: r.feedback ?? null,
      recorded_by: guard.userId,
      recorded_at: now,
    })),
    { onConflict: 'test_id,student_id' },
  );
  if (error) {
    if (error.code === '23503') return { error: 'Prøven eller en elev finnes ikke lenger.' };
    return { error: `Kunne ikke lagre resultatene: ${error.message}` };
  }
  revalidatePath(`/laerer/prover/${testId}`);
  revalidatePath(`/laerer/klasser/${guard.classId}`);
  return { error: null, success: true };
}

/** Edit the test's meta (its teacher; write-confirmed). */
export async function editTest(
  testId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await requireTeacherOfTest(testId);
  if (!guard) return { error: 'Du underviser ikke denne prøven.' };

  const parsed = testEditSchema.safeParse({
    title: formData.get('title'),
    held_on: formData.get('held_on'),
    max_points: formData.get('max_points'),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tests')
    .update(parsed.data)
    .eq('id', testId)
    .select('id');
  if (error) {
    return { error: `Kunne ikke oppdatere prøven: ${error.message}` };
  }
  if ((data ?? []).length === 0) return { error: 'Prøven finnes ikke lenger.' };
  revalidatePath(`/laerer/prover/${testId}`);
  revalidatePath(`/laerer/klasser/${guard.classId}`);
  return { error: null, success: true };
}
```

- [ ] **Step 5: Run — expect GREEN**

```bash
cd /Users/daodilyas/dev/iqra-portal
npx vitest run --config vitest.config.api.ts tests/api/assessment-actions.test.ts 2>&1 | tail -4
npm run typecheck && npm run lint
```

Expected: **24/24** in the file (12 + 12). `tests/api` running total: **231** — the phase's full wall-1 count, carried to the exit gate.

- [ ] **Step 6: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add "src/app/(portal)/laerer/klasser/[id]/actions.ts" "src/app/(portal)/laerer/prover/[testId]/actions.ts" tests/api/assessment-actions.test.ts
git commit -m "feat: test creation and interval-rostered results entry actions"
```

---

### Task 12: Teacher UI — vurdering overview + per-student assessment page

The teacher core: `/laerer/vurdering` (class-grouped roster picker, the demo screen on real data) and `/laerer/elev/[studentId]` (the five demo-mined sections: Bokfremgang · Koran · Prøver · Terminkarakter · Terminrapport-link). All forms controlled (gotcha 17); every figure `tabular-nums`; retracts are two-step. **Known accepted edge (ledger):** the retract button renders on all listed entries, but RLS no-ops a delete of another teacher's row (idempotent success, row stays) — acceptable while classes have one teacher; revisit with co-teachers.

**Files:**
- Create: `src/components/assessment/ProgressLadder.tsx`
- Create: `src/components/assessment/QuranPositionCard.tsx`
- Create: `src/components/assessment/GradeBadge.tsx`
- Create: `src/app/(portal)/laerer/vurdering/page.tsx`
- Create: `src/app/(portal)/laerer/elev/[studentId]/page.tsx`
- Create: `src/app/(portal)/laerer/elev/[studentId]/LogProgressForm.tsx`
- Create: `src/app/(portal)/laerer/elev/[studentId]/LogQuranForm.tsx`
- Create: `src/app/(portal)/laerer/elev/[studentId]/TermGradeEditor.tsx`
- Create: `src/app/(portal)/laerer/elev/[studentId]/EntryLists.tsx`

- [ ] **Step 1: The shared assessment components**

Create `src/components/assessment/ProgressLadder.tsx` (server-safe):

```tsx
/**
 * Thick rounded progress ladder (spec §7) with quartile notches. Values are
 * server-derived (bookPercent) — this renders, it does not compute.
 */
export function ProgressLadder({
  label,
  current,
  total,
  percent,
  unitLabel,
}: {
  label: string;
  current: number;
  total: number;
  percent: number;
  unitLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="font-medium">{label}</p>
        <p className="ms-auto text-sm tabular-nums text-ink/60">
          {unitLabel} <span className="font-medium text-ink">{current}</span> av {total}
        </p>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label}
        className="relative h-3 overflow-hidden rounded-pill bg-surface-tint"
      >
        <div
          className="h-full rounded-pill bg-primary transition-transform duration-200 ease-brand"
          style={{ width: `${percent}%` }}
        />
        {[25, 50, 75].map((notch) => (
          <span
            key={notch}
            aria-hidden
            className="absolute top-0 h-full w-px bg-canvas/70"
            style={{ left: `${notch}%` }}
          />
        ))}
      </div>
      <p className="text-sm tabular-nums font-medium text-primary">{percent} %</p>
    </div>
  );
}
```

Create `src/components/assessment/QuranPositionCard.tsx` (server-safe):

```tsx
import { Chip } from '@/components/ui/Chip';
import { quranResultTones } from '@/lib/assessment-ui';
import type { QuranLogEntry } from '@/lib/assessment';
import { formatDateNb } from '@/lib/dates';
import { quranPositionLabel } from '@/lib/quran';
import { quranKindLabels, quranResultLabels } from '@/lib/validation/assessment';

/** «Nåværende posisjon» + «Å repetere» — the memorisation standing card. */
export function QuranPositionCard({
  position,
  weakSpots,
}: {
  position: QuranLogEntry | null;
  weakSpots: QuranLogEntry[];
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface-tint/60 px-4 py-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium text-ink/70">Nåværende posisjon</h3>
        {position ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-lg font-semibold">{quranPositionLabel(position)}</p>
            <Chip tone={quranResultTones[position.result]}>
              {quranResultLabels[position.result]}
            </Chip>
            <span className="text-sm text-ink/60">{quranKindLabels[position.kind]}</span>
            <span className="ms-auto text-sm tabular-nums text-ink/60">
              {formatDateNb(position.date)}
            </span>
          </div>
        ) : (
          <p className="text-ink/60">
            Ingen koranfremgang registrert ennå. Registrer første surah nedenfor.
          </p>
        )}
        {position?.note ? <p className="text-sm text-ink/60">{position.note}</p> : null}
      </div>
      {weakSpots.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-ink/70">Å repetere</h3>
          <ul className="flex flex-wrap gap-2">
            {weakSpots.map((entry) => (
              <li key={entry.id}>
                <Chip tone="warning">{quranPositionLabel(entry)}</Chip>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
```

Create `src/components/assessment/GradeBadge.tsx` (server-safe):

```tsx
import { Chip } from '@/components/ui/Chip';
import { gradeTone } from '@/lib/assessment-ui';

/** A term grade as a toned chip (never danger — spec §7 design law). */
export function GradeBadge({ grade }: { grade: string }) {
  return <Chip tone={gradeTone(grade)}>{grade}</Chip>;
}
```

- [ ] **Step 2: The vurdering overview**

Create `src/app/(portal)/laerer/vurdering/page.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { listMyTeachingClasses } from '@/lib/dal/classes';
import { getRosterForTeacher } from '@/lib/dal/students';

export const metadata: Metadata = { title: 'Vurdering' };

export default async function VurderingPage() {
  const classes = await listMyTeachingClasses();
  const rosters = await Promise.all(
    classes.map(async (cls) => ({ cls, roster: await getRosterForTeacher(cls.id) })),
  );
  const nonEmpty = rosters.filter((r) => r.roster !== null);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Vurdering</h1>
        <p className="max-w-2xl text-ink/60">
          Følg fremgangen til hver elev: bok- og koranfremgang, prøver og
          terminkarakter. Velg en elev for å se og oppdatere vurderingen.
        </p>
      </div>
      {nonEmpty.length === 0 ? (
        <EmptyState
          title="Ingen elever ennå"
          description="Når administrasjonen har satt deg opp som lærer for en klasse med elever, finner du dem her, klare for vurdering."
        />
      ) : (
        nonEmpty.map(({ cls, roster }) => (
          <section key={cls.id} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">
              {cls.name}{' '}
              <span className="tabular-nums text-ink/60">
                ({roster!.roster.length} elever)
              </span>
            </h2>
            {roster!.roster.length === 0 ? (
              <p className="text-sm text-ink/60">Ingen elever i klassen ennå.</p>
            ) : (
              <ul className="divide-y divide-hairline rounded-lg border border-hairline">
                {roster!.roster.map((student) => (
                  <li key={student.student_id}>
                    <Link
                      href={`/laerer/elev/${student.student_id}`}
                      className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors duration-200 ease-brand hover:bg-surface-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      <span className="font-medium">
                        {student.first_name} {student.last_name}
                      </span>
                      <span className="text-sm tabular-nums text-ink/60">
                        f. {student.birth_year}
                      </span>
                      {student.protected ? <Chip tone="warning">Skjermet</Chip> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 3: The per-student page (server shell)**

Create `src/app/(portal)/laerer/elev/[studentId]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GradeBadge } from '@/components/assessment/GradeBadge';
import { ProgressLadder } from '@/components/assessment/ProgressLadder';
import { QuranPositionCard } from '@/components/assessment/QuranPositionCard';
import { Chip } from '@/components/ui/Chip';
import { PillLink } from '@/components/ui/PillLink';
import { getStudentFremdriftForTeacher } from '@/lib/dal/progress';
import { getSettings } from '@/lib/dal/settings';
import { formatDateNb } from '@/lib/dates';
import { UNIT_LABELS } from '@/lib/validation/assessment';
import { ProgressLogList, QuranLogList } from './EntryLists';
import { LogProgressForm } from './LogProgressForm';
import { LogQuranForm } from './LogQuranForm';
import { TermGradeEditor } from './TermGradeEditor';

export const metadata: Metadata = { title: 'Elevvurdering' };

export default async function LaererElevPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const [read, settings] = await Promise.all([
    getStudentFremdriftForTeacher(studentId),
    getSettings(),
  ]);
  if (!read) notFound();
  const { header, fremdrift, tests, grades } = read;
  const gradeBySubject = new Map(grades.map((g) => [g.subject_id, g]));

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Link
          href="/laerer/vurdering"
          className="text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          ← Vurdering
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {header.first_name} {header.last_name}
          </h1>
          {header.protected ? <Chip tone="warning">Skjermet</Chip> : null}
        </div>
        <p className="tabular-nums text-ink/60">
          {header.class_name} · f. {header.birth_year}
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Bokfremgang</h2>
          <p className="text-sm text-ink/60">
            Registrer hvor langt eleven har kommet — hver lagring blir en ny rad i
            loggen.
          </p>
        </div>
        {fremdrift.books.length === 0 ? (
          <p className="text-sm text-ink/60">
            Ingen bøker i klassens fag ennå. Administrasjonen legger inn bokstigen
            under Fag.
          </p>
        ) : (
          <ul className="flex flex-col gap-6">
            {fremdrift.books.map((book) => (
              <li
                key={book.book_id}
                className="flex flex-col gap-3 rounded-lg border border-hairline bg-canvas px-4 py-4"
              >
                <ProgressLadder
                  label={`${book.subject_name} · ${book.title}`}
                  current={book.current_unit}
                  total={book.total_units}
                  percent={book.percent}
                  unitLabel={UNIT_LABELS[book.unit_label]}
                />
                <LogProgressForm
                  studentId={header.student_id}
                  subjectId={book.subject_id}
                  bookId={book.book_id}
                  currentUnit={book.current_unit}
                  totalUnits={book.total_units}
                  unitLabel={UNIT_LABELS[book.unit_label]}
                />
              </li>
            ))}
          </ul>
        )}
        <ProgressLogList studentId={header.student_id} entries={fremdrift.progress_log} />
      </section>

      {fremdrift.quran ? (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">Koran</h2>
            <p className="text-sm text-ink/60">
              Nåværende posisjon, svake punkter og registrering av ny fremgang.
            </p>
          </div>
          <QuranPositionCard
            position={fremdrift.quran.position}
            weakSpots={fremdrift.quran.weak_spots}
          />
          <LogQuranForm studentId={header.student_id} />
          <QuranLogList studentId={header.student_id} entries={fremdrift.quran.recent} />
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Prøver</h2>
        {tests.length === 0 ? (
          <p className="text-sm text-ink/60">Ingen prøveresultater registrert ennå.</p>
        ) : (
          <ul className="divide-y divide-hairline rounded-lg border border-hairline">
            {tests.map((row) => (
              <li
                key={row.test_id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
              >
                <span className="font-medium">{row.title}</span>
                <span className="text-sm text-ink/60">{row.subject_name}</span>
                <span className="text-sm tabular-nums text-ink/60">
                  {formatDateNb(row.held_on)}
                </span>
                <span className="ms-auto tabular-nums font-medium">
                  {row.points} / {row.max_points} poeng
                </span>
                {row.feedback ? (
                  <span className="w-full text-sm text-ink/60">{row.feedback}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Terminkarakter</h2>
          <p className="text-sm text-ink/60">
            Sett karakter og skriv en kort tilbakemelding per fag.
          </p>
        </div>
        <ul className="flex flex-col gap-4">
          {header.subjects.map((subject) => {
            const grade = gradeBySubject.get(subject.id);
            return (
              <li
                key={subject.id}
                className="flex flex-col gap-3 rounded-lg border border-hairline bg-canvas px-4 py-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-medium">{subject.name}</p>
                  {grade ? (
                    <GradeBadge grade={grade.grade} />
                  ) : (
                    <span className="text-sm text-ink/60">Ikke satt ennå</span>
                  )}
                </div>
                {grade?.feedback ? (
                  <p className="text-sm text-ink/60">{grade.feedback}</p>
                ) : null}
                <TermGradeEditor
                  studentId={header.student_id}
                  subjectId={subject.id}
                  subjectName={subject.name}
                  scale={settings.grade_scale}
                  currentGrade={grade?.grade ?? null}
                  currentFeedback={grade?.feedback ?? null}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Terminrapport</h2>
        <p className="text-sm text-ink/60">
          En samlet, utskriftsvennlig rapport for terminen.
        </p>
        <div>
          <PillLink href={`/laerer/elev/${header.student_id}/rapport`}>
            Åpne terminrapport
          </PillLink>
        </div>
      </section>
    </div>
  );
}
```

(The rapport route lands in Task 14 — until then the pill 404s locally; the Task 12 walkthrough checks everything above it, and Task 14's walkthrough closes the loop.)

- [ ] **Step 4: The log forms (controlled, gotcha 17)**

Create `src/app/(portal)/laerer/elev/[studentId]/LogProgressForm.tsx`:

```tsx
'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { idleForm } from '@/lib/validation/school';
import { logProgress } from './actions';

export function LogProgressForm({
  studentId,
  subjectId,
  bookId,
  currentUnit,
  totalUnits,
  unitLabel,
}: {
  studentId: string;
  subjectId: string;
  bookId: string;
  currentUnit: number;
  totalUnits: number;
  unitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(
    logProgress.bind(null, studentId),
    idleForm,
  );
  const [unit, setUnit] = useState(String(currentUnit));
  const [notat, setNotat] = useState('');
  const [prev, setPrev] = useState(state);
  if (prev !== state) {
    setPrev(state);
    if (state.success) setNotat('');
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="subject_id" value={subjectId} />
      <input type="hidden" name="book_id" value={bookId} />
      <Field label={`Ny posisjon (${unitLabel.toLowerCase()})`} htmlFor={`unit-${bookId}`}>
        <Input
          id={`unit-${bookId}`}
          name="unit_reached"
          type="number"
          min={0}
          max={totalUnits}
          required
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
          className="w-28"
        />
      </Field>
      <Field label="Notat (valgfritt)" htmlFor={`unit-notat-${bookId}`}>
        <Input
          id={`unit-notat-${bookId}`}
          name="note"
          value={notat}
          onChange={(event) => setNotat(event.target.value)}
          maxLength={500}
          placeholder="F.eks. hva som gikk bra"
        />
      </Field>
      <Button type="submit" loading={pending}>
        Lagre fremgang
      </Button>
      {state.error ? (
        <p role="alert" className="w-full text-sm text-danger-ink">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="w-full text-sm text-success-ink">
          Fremgangen er lagret.
        </p>
      ) : null}
    </form>
  );
}
```

Create `src/app/(portal)/laerer/elev/[studentId]/LogQuranForm.tsx`:

```tsx
'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { todayOsloISO } from '@/lib/dates';
import { SURAHS } from '@/lib/quran';
import { quranKindLabels, quranResultLabels } from '@/lib/validation/assessment';
import { idleForm } from '@/lib/validation/school';
import { logQuran } from './actions';

const selectClasses =
  'min-h-11 w-full rounded-md border border-border-input bg-canvas px-4 text-base text-ink ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export function LogQuranForm({ studentId }: { studentId: string }) {
  const [state, formAction, pending] = useActionState(
    logQuran.bind(null, studentId),
    idleForm,
  );
  const [dato, setDato] = useState(todayOsloISO());
  const [kind, setKind] = useState('new');
  const [surah, setSurah] = useState('114');
  const [fra, setFra] = useState('1');
  const [til, setTil] = useState('1');
  const [result, setResult] = useState('pass');
  const [notat, setNotat] = useState('');
  const [prev, setPrev] = useState(state);
  if (prev !== state) {
    setPrev(state);
    if (state.success) {
      setNotat('');
    }
  }
  const maxAyah = SURAHS.find((s) => s.number === Number(surah))?.ayah_count ?? 286;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border border-hairline bg-canvas px-4 py-4"
    >
      <h3 className="font-medium">Registrer koranfremgang</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Dato" htmlFor={`quran-dato-${studentId}`}>
          <Input
            id={`quran-dato-${studentId}`}
            name="date"
            type="date"
            required
            value={dato}
            onChange={(event) => setDato(event.target.value)}
          />
        </Field>
        <Field label="Del av leksen" htmlFor={`quran-kind-${studentId}`}>
          <select
            id={`quran-kind-${studentId}`}
            name="kind"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            className={selectClasses}
          >
            {Object.entries(quranKindLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Surah" htmlFor={`quran-surah-${studentId}`}>
          <select
            id={`quran-surah-${studentId}`}
            name="surah"
            value={surah}
            onChange={(event) => setSurah(event.target.value)}
            className={selectClasses}
          >
            {SURAHS.map((s) => (
              <option key={s.number} value={s.number}>
                {s.number}. {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fra ayah" htmlFor={`quran-fra-${studentId}`}>
          <Input
            id={`quran-fra-${studentId}`}
            name="ayah_from"
            type="number"
            min={1}
            max={maxAyah}
            required
            value={fra}
            onChange={(event) => setFra(event.target.value)}
          />
        </Field>
        <Field label="Til ayah" htmlFor={`quran-til-${studentId}`}>
          <Input
            id={`quran-til-${studentId}`}
            name="ayah_to"
            type="number"
            min={1}
            max={maxAyah}
            required
            value={til}
            onChange={(event) => setTil(event.target.value)}
          />
        </Field>
        <Field label="Resultat" htmlFor={`quran-result-${studentId}`}>
          <select
            id={`quran-result-${studentId}`}
            name="result"
            value={result}
            onChange={(event) => setResult(event.target.value)}
            className={selectClasses}
          >
            {Object.entries(quranResultLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Notat (valgfritt)" htmlFor={`quran-notat-${studentId}`}>
        <Input
          id={`quran-notat-${studentId}`}
          name="note"
          value={notat}
          onChange={(event) => setNotat(event.target.value)}
          maxLength={500}
          placeholder="F.eks. hvilke ayat som trenger mer øving"
        />
      </Field>
      {state.error ? (
        <p role="alert" className="text-sm text-danger-ink">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm text-success-ink">
          Koranfremgangen er lagret.
        </p>
      ) : null}
      <div>
        <Button type="submit" loading={pending}>
          Registrer
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 5: The grade editor + retractable log lists**

Create `src/app/(portal)/laerer/elev/[studentId]/TermGradeEditor.tsx`:

```tsx
'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { idleForm } from '@/lib/validation/school';
import { setTermGrade } from './actions';

const selectClasses =
  'min-h-11 w-full max-w-xs rounded-md border border-border-input bg-canvas px-4 text-base text-ink ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
const textareaClasses =
  'min-h-24 w-full rounded-md border border-border-input bg-canvas px-4 py-3 text-base text-ink ' +
  'placeholder:text-ink/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export function TermGradeEditor({
  studentId,
  subjectId,
  subjectName,
  scale,
  currentGrade,
  currentFeedback,
}: {
  studentId: string;
  subjectId: string;
  subjectName: string;
  scale: string[];
  currentGrade: string | null;
  currentFeedback: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    setTermGrade.bind(null, studentId),
    idleForm,
  );
  const [grade, setGrade] = useState(currentGrade ?? scale[0] ?? '');
  const [feedback, setFeedback] = useState(currentFeedback ?? '');
  const [prev, setPrev] = useState(state);
  if (prev !== state) {
    setPrev(state);
    if (state.success) setOpen(false);
  }

  if (!open) {
    return (
      <div>
        <Button variant="ghost" onClick={() => setOpen(true)}>
          {currentGrade ? 'Rediger karakter' : 'Sett karakter'}
        </Button>
      </div>
    );
  }
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="subject_id" value={subjectId} />
      <Field label={`Karakter i ${subjectName}`} htmlFor={`grade-${subjectId}`}>
        <select
          id={`grade-${subjectId}`}
          name="grade"
          value={grade}
          onChange={(event) => setGrade(event.target.value)}
          className={selectClasses}
        >
          {scale.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tilbakemelding (valgfritt)" htmlFor={`grade-feedback-${subjectId}`}>
        <textarea
          id={`grade-feedback-${subjectId}`}
          name="feedback"
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          maxLength={2000}
          placeholder="Kort tilbakemelding til hjemmet"
          className={textareaClasses}
        />
      </Field>
      {state.error ? (
        <p role="alert" className="text-sm text-danger-ink">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={pending}>
          Lagre karakter
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Avbryt
        </Button>
      </div>
    </form>
  );
}
```

Create `src/app/(portal)/laerer/elev/[studentId]/EntryLists.tsx` — one file, two lists («Siste registreringer»), each row with a two-step retract (`Fjern` → `Bekreft fjerning`/`Avbryt`) driven by `useActionState(deleteProgressEntry.bind(null, entry.id), idleForm)` / `deleteQuranEntry`. Rows render: progress — `formatDateNb(recorded_at)` (date part), `book_title ?? subject_name`, `unit_reached` (`tabular-nums`), note; quran — `formatDateNb(date)`, `quranPositionLabel(entry)`, kind label, result `Chip` with `quranResultTones`, note. Both lists cap at their given entries (the DAL already caps at 10) and render nothing (`null`) when empty — the sections above them carry the teaching empty states. Follow `AbsenceNoticeList.tsx`'s two-step confirm structure verbatim (state `confirming`, `ms-auto` action cluster, error line `role="alert"`).

- [ ] **Step 6: Typecheck, lint, build, walkthrough**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run lint
npm run build 2>&1 | tail -4
rm -rf .next && npm run dev
```

Browser (TOTP gotcha 18): as `laerer@` — `/laerer/vurdering` lists Klasse 1 (Yusuf, Bilal); `/laerer/elev/<YUSUF>`: ladder «Arabisk · Alfabet og lyder» 18/30 60 %, log unit 19 → «Fremgangen er lagret.» + ladder updates; Koran card «Al-Ikhlas 1–4» + «Repeteres» + «Å repetere»-chip, register surah 111 1–5 Bestått → card position flips to An-Nasr (wait — 111 is Al-Masad; 110 is An-Nasr: register **111. Al-Masad**) and the new row tops «Siste registreringer»; retract the two scratch rows (two-step) → standing back to Al-Ikhlas; Prøver shows 18/20; set Arabisk grade to «God» then back to «Meget god»; foreign student `/laerer/elev/<AMIRA>` → 404; 375 px pass on both pages.

- [ ] **Step 7: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add src/components/assessment "src/app/(portal)/laerer/vurdering" "src/app/(portal)/laerer/elev/[studentId]/page.tsx" "src/app/(portal)/laerer/elev/[studentId]/LogProgressForm.tsx" "src/app/(portal)/laerer/elev/[studentId]/LogQuranForm.tsx" "src/app/(portal)/laerer/elev/[studentId]/TermGradeEditor.tsx" "src/app/(portal)/laerer/elev/[studentId]/EntryLists.tsx"
git commit -m "feat: teacher vurdering overview and per-student assessment page"
```

---

### Task 13: Teacher UI — klasser «Prøver» section + results-entry screen

The class page gains a «Prøver» section (list + «Ny prøve» form) and `/laerer/prover/[testId]` becomes the marking screen's sibling: the interval roster as of `held_on`, one points input + optional feedback per row, one save. **Subject options** in «Ny prøve» come from the cached `listSubjects()` (readable by every portal role) — a wrong pick is rejected server-side («Faget tilhører ikke klassen.»); class-scoped options are a ledger item (needs a teacher class-subjects read — rule-of-three watch).

**Files:**
- Modify: `src/app/(portal)/laerer/klasser/[id]/page.tsx`
- Create: `src/app/(portal)/laerer/klasser/[id]/NewTestForm.tsx`
- Create: `src/app/(portal)/laerer/prover/[testId]/page.tsx`
- Create: `src/app/(portal)/laerer/prover/[testId]/TestEntry.tsx`
- Create: `src/app/(portal)/laerer/prover/[testId]/EditTestForm.tsx`

- [ ] **Step 1: Splice the «Prøver» section into the class page**

In `src/app/(portal)/laerer/klasser/[id]/page.tsx`: add to the imports `import { listSubjects } from '@/lib/dal/subjects';`, `import { listClassTestsForTeacher } from '@/lib/dal/assessment';`, `import { NewTestForm } from './NewTestForm';` — and extend the data fetch:

```ts
  const lessons = (await listClassLessonsForTeacher(id)) ?? [];
```

becomes

```ts
  const lessons = (await listClassLessonsForTeacher(id)) ?? [];
  const [tests, subjects] = await Promise.all([
    listClassTestsForTeacher(id),
    listSubjects(),
  ]);
  const testRows = tests ?? [];
```

Then insert this section **between** the «Timer» section's closing `</section>` and the «Elever» section's opening `<section className="flex flex-col gap-3">`:

```tsx
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Prøver</h2>
        {testRows.length === 0 ? (
          <p className="text-sm text-ink/60">
            Ingen prøver ennå. Opprett den første nedenfor — resultater føres per
            elev etterpå.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {testRows.map((test) => (
              <li key={test.id}>
                <Link
                  href={`/laerer/prover/${test.id}`}
                  className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-hairline bg-canvas px-4 py-4 transition-colors duration-200 ease-brand hover:bg-surface-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <span className="font-medium">{test.title}</span>
                  <span className="text-sm text-ink/60">{test.subject_name}</span>
                  <span className="text-sm tabular-nums text-ink/60">
                    {formatDateNb(test.held_on)}
                  </span>
                  {test.result_count === 0 ? (
                    <Chip tone="warning">Ikke ført</Chip>
                  ) : (
                    <Chip tone="success">
                      <span className="tabular-nums">{test.result_count}</span> ført
                    </Chip>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <NewTestForm classId={id} subjects={subjects} />
      </section>
```

- [ ] **Step 2: The «Ny prøve» form**

Create `src/app/(portal)/laerer/klasser/[id]/NewTestForm.tsx` (controlled; collapsible like the house two-step pattern):

```tsx
'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import type { Subject } from '@/lib/dal/subjects';
import { todayOsloISO } from '@/lib/dates';
import { idleForm } from '@/lib/validation/school';
import { createTest } from './actions';

const selectClasses =
  'min-h-11 w-full rounded-md border border-border-input bg-canvas px-4 text-base text-ink ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export function NewTestForm({
  classId,
  subjects,
}: {
  classId: string;
  subjects: Subject[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createTest.bind(null, classId),
    idleForm,
  );
  const [tittel, setTittel] = useState('');
  const [fag, setFag] = useState(subjects[0]?.id ?? '');
  const [dato, setDato] = useState(todayOsloISO());
  const [maks, setMaks] = useState('20');
  const [prev, setPrev] = useState(state);
  if (prev !== state) {
    setPrev(state);
    if (state.success) {
      setTittel('');
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={() => setOpen(true)}>
          Ny prøve
        </Button>
        {state.success ? (
          <p role="status" className="text-sm text-success-ink">
            Prøven er opprettet.
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border border-hairline bg-canvas px-4 py-4"
    >
      <h3 className="font-medium">Ny prøve</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Tittel" htmlFor="test-tittel">
          <Input
            id="test-tittel"
            name="title"
            required
            maxLength={80}
            value={tittel}
            onChange={(event) => setTittel(event.target.value)}
            placeholder="F.eks. Prøve: Det arabiske alfabetet"
          />
        </Field>
        <Field label="Fag" htmlFor="test-fag">
          <select
            id="test-fag"
            name="subject_id"
            value={fag}
            onChange={(event) => setFag(event.target.value)}
            className={selectClasses}
          >
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Dato" htmlFor="test-dato">
          <Input
            id="test-dato"
            name="held_on"
            type="date"
            required
            value={dato}
            onChange={(event) => setDato(event.target.value)}
          />
        </Field>
        <Field label="Maks poeng" htmlFor="test-maks">
          <Input
            id="test-maks"
            name="max_points"
            type="number"
            min={1}
            max={1000}
            required
            value={maks}
            onChange={(event) => setMaks(event.target.value)}
            className="w-28"
          />
        </Field>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-danger-ink">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={pending}>
          Opprett prøve
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Avbryt
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: The results-entry screen**

Create `src/app/(portal)/laerer/prover/[testId]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTestForEntry } from '@/lib/dal/assessment';
import { EditTestForm } from './EditTestForm';
import { TestEntry } from './TestEntry';

export const metadata: Metadata = { title: 'Prøve' };

export default async function ProvePage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  const entry = await getTestForEntry(testId);
  if (!entry) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href={`/laerer/klasser/${entry.test.class_id}`}
          className="text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          ← {entry.test.class_name}
        </Link>
      </div>
      <TestEntry test={entry.test} roster={entry.roster} />
      <EditTestForm test={entry.test} />
    </div>
  );
}
```

Create `src/app/(portal)/laerer/prover/[testId]/TestEntry.tsx` — the marking screen's sibling (controlled per-row state, one hidden `results` JSON payload, one save):

```tsx
'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { TestForEntry } from '@/lib/dal/assessment';
import { formatDateNb } from '@/lib/dates';
import { idleForm } from '@/lib/validation/school';
import { saveTestResults } from './actions';

const inputClasses =
  'min-h-11 w-24 rounded-md border border-border-input bg-canvas px-4 text-base text-ink ' +
  'tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
const feedbackClasses =
  'min-h-11 w-full rounded-md border border-border-input bg-canvas px-4 text-base text-ink ' +
  'placeholder:text-ink/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

interface RowState {
  points: string;
  feedback: string;
}

export function TestEntry({
  test,
  roster,
}: {
  test: TestForEntry['test'];
  roster: TestForEntry['roster'];
}) {
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      roster.map((entry) => [
        entry.student_id,
        {
          points: entry.points === null ? '' : String(entry.points),
          feedback: entry.feedback ?? '',
        },
      ]),
    ),
  );
  const [state, formAction, pending] = useActionState(
    saveTestResults.bind(null, test.id),
    idleForm,
  );

  function setRow(studentId: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...patch } }));
  }

  // Only rows with entered points are submitted — an empty field means "not
  // assessed", never a zero.
  const payload = JSON.stringify(
    roster
      .filter((entry) => rows[entry.student_id].points.trim() !== '')
      .map((entry) => {
        const row = rows[entry.student_id];
        const feedback = row.feedback.trim();
        return {
          student_id: entry.student_id,
          points: Number(row.points),
          ...(feedback ? { feedback } : {}),
        };
      }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{test.title}</h1>
        <p className="tabular-nums text-ink/60">
          {test.subject_name} · {formatDateNb(test.held_on)} · maks {test.max_points}{' '}
          poeng
        </p>
      </div>

      {roster.length === 0 ? (
        <p className="text-sm text-ink/60">
          Ingen elever var meldt inn i klassen på prøvedatoen.
        </p>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="results" value={payload} />
          <ul className="divide-y divide-hairline rounded-lg border border-hairline">
            {roster.map((entry) => {
              const row = rows[entry.student_id];
              return (
                <li key={entry.student_id} className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="min-w-40 font-medium">
                      {entry.first_name} {entry.last_name}
                    </span>
                    <div className="ms-auto flex items-center gap-2">
                      <label className="sr-only" htmlFor={`points-${entry.student_id}`}>
                        Poeng for {entry.first_name} {entry.last_name}
                      </label>
                      <input
                        id={`points-${entry.student_id}`}
                        type="number"
                        min={0}
                        max={test.max_points}
                        value={row.points}
                        onChange={(event) =>
                          setRow(entry.student_id, { points: event.target.value })
                        }
                        placeholder="–"
                        className={inputClasses}
                      />
                      <span className="text-sm tabular-nums text-ink/60">
                        / {test.max_points}
                      </span>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={row.feedback}
                    onChange={(event) =>
                      setRow(entry.student_id, { feedback: event.target.value })
                    }
                    maxLength={1000}
                    placeholder="Tilbakemelding (valgfritt)"
                    aria-label={`Tilbakemelding til ${entry.first_name} ${entry.last_name}`}
                    className={feedbackClasses}
                  />
                </li>
              );
            })}
          </ul>
          {state.error ? (
            <p role="alert" className="text-sm text-danger-ink">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p role="status" className="text-sm text-success-ink">
              Resultatene er lagret.
            </p>
          ) : null}
          <div>
            <Button type="submit" loading={pending}>
              Lagre resultater
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
```

Create `src/app/(portal)/laerer/prover/[testId]/EditTestForm.tsx` — a collapsed «Rediger prøven»-toggle mirroring `NewTestForm`'s open/closed structure and field set **minus** the subject select (subject is immutable — `testEditSchema`), bound to `editTest.bind(null, test.id)`, fields seeded from `test.title`/`test.held_on`/`test.max_points` (controlled), success closes the editor. Reuse `NewTestForm`'s class strings verbatim.

- [ ] **Step 4: Typecheck, lint, walkthrough**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run lint && npm run build 2>&1 | tail -4
rm -rf .next && npm run dev
```

Browser as `laerer@`: `/laerer/klasser/<K1>` shows «Prøver» with the seed test («1 ført»… **wait — seed has 2 results**: chip reads «2 ført»); create «Ny prøve» (Arabisk, today, max 10) → appears «Ikke ført»; open it → roster Yusuf+Bilal empty inputs; enter 9/7 → «Resultatene er lagret.»; correction: change 9→10, save, persists; Rediger prøven → retitle → header updates; back-link returns to the class; the seed test page prefills 18/14; picking Islamkunnskap in «Ny prøve» → «Faget tilhører ikke klassen.» inline; foreign test id → 404; 375 px pass. Clean up the scratch test as admin?? — **no admin delete UI this phase**: instead re-run `supabase db reset` after the walkthrough (the T14 walkthrough reseeds anyway).

- [ ] **Step 5: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add "src/app/(portal)/laerer/klasser/[id]/page.tsx" "src/app/(portal)/laerer/klasser/[id]/NewTestForm.tsx" "src/app/(portal)/laerer/prover/[testId]"
git commit -m "feat: class tests section and one-save results entry screen"
```

---

### Task 14: Report — `TermReport` + teacher print view + parent fremdrift

The shared report body (grades + achieved ladders + Quran position + attendance summary — «calm on paper», print-styled), the teacher's printable route, and the parent's fremdrift view with the demo's «Forhåndsvis terminrapport» toggle.

**Files:**
- Create: `src/components/assessment/TermReport.tsx`
- Create: `src/app/(portal)/laerer/elev/[studentId]/rapport/page.tsx`
- Create: `src/app/(portal)/laerer/elev/[studentId]/rapport/PrintButton.tsx`
- Create: `src/app/(portal)/forelder/fremdrift/page.tsx`
- Create: `src/app/(portal)/forelder/fremdrift/ReportToggle.tsx`

- [ ] **Step 1: The report body (server-safe, print-friendly)**

Create `src/components/assessment/TermReport.tsx`:

```tsx
import { GradeBadge } from '@/components/assessment/GradeBadge';
import { ProgressLadder } from '@/components/assessment/ProgressLadder';
import type { TermReport as TermReportData } from '@/lib/dal/assessment';
import { quranPositionLabel } from '@/lib/quran';
import { UNIT_LABELS } from '@/lib/validation/assessment';
import { attendanceStatusLabels } from '@/lib/validation/attendance';

/**
 * The assembled term report — calm on paper: no status colours beyond the
 * grade badges, generous whitespace, print-clean (no interactive elements).
 */
export function TermReport({ report }: { report: TermReportData }) {
  const attendanceCells = [
    { label: attendanceStatusLabels.present, value: report.attendance.present },
    { label: attendanceStatusLabels.absent, value: report.attendance.absent },
    { label: attendanceStatusLabels.late, value: report.attendance.late },
    { label: attendanceStatusLabels.excused, value: report.attendance.excused },
  ];
  return (
    <article className="flex flex-col gap-8 rounded-lg border border-hairline bg-canvas px-6 py-6 print:border-0 print:px-0">
      <header className="flex flex-col gap-1 border-b border-hairline pb-4">
        <h2 className="text-xl font-semibold">
          Terminrapport — {report.student.first_name} {report.student.last_name}
        </h2>
        <p className="tabular-nums text-ink/60">
          {report.term_name} · {report.class_name} · f. {report.student.birth_year}
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h3 className="font-semibold">Terminkarakterer</h3>
        {report.grades.length === 0 ? (
          <p className="text-sm text-ink/60">Ingen terminkarakterer satt ennå.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {report.grades.map((grade) => (
              <li key={grade.subject_id} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-32 font-medium">{grade.subject_name}</span>
                  <GradeBadge grade={grade.grade} />
                </div>
                {grade.feedback ? (
                  <p className="text-sm leading-relaxed text-ink/70">{grade.feedback}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="font-semibold">Faglig fremgang</h3>
        {report.books.length === 0 ? (
          <p className="text-sm text-ink/60">Ingen bokfremgang registrert ennå.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {report.books.map((book) => (
              <li key={book.book_id}>
                <ProgressLadder
                  label={`${book.subject_name} · ${book.title}`}
                  current={book.current_unit}
                  total={book.total_units}
                  percent={book.percent}
                  unitLabel={UNIT_LABELS[book.unit_label]}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {report.quran_position ? (
        <section className="flex flex-col gap-2">
          <h3 className="font-semibold">Koran</h3>
          <p>
            Nåværende posisjon:{' '}
            <span className="font-medium">
              {quranPositionLabel(report.quran_position)}
            </span>
          </p>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h3 className="font-semibold">Oppmøte</h3>
        {report.attendance.total === 0 ? (
          <p className="text-sm text-ink/60">Ingen oppmøteføringer denne terminen.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4">
            {attendanceCells.map((cell) => (
              <div key={cell.label} className="flex flex-col">
                <dt className="text-sm text-ink/60">{cell.label}</dt>
                <dd className="text-lg font-semibold tabular-nums">{cell.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </article>
  );
}
```

- [ ] **Step 2: The teacher print route**

Create `src/app/(portal)/laerer/elev/[studentId]/rapport/PrintButton.tsx`:

```tsx
'use client';

import { Button } from '@/components/ui/Button';

export function PrintButton() {
  return (
    <Button variant="ghost" onClick={() => window.print()}>
      Skriv ut
    </Button>
  );
}
```

Create `src/app/(portal)/laerer/elev/[studentId]/rapport/page.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TermReport } from '@/components/assessment/TermReport';
import { getTermReportForTeacher } from '@/lib/dal/assessment';
import { PrintButton } from './PrintButton';

export const metadata: Metadata = { title: 'Terminrapport' };

export default async function RapportPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const report = await getTermReportForTeacher(studentId);
  if (!report) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link
          href={`/laerer/elev/${studentId}`}
          className="text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          ← {report.student.first_name} {report.student.last_name}
        </Link>
        <div className="ms-auto">
          <PrintButton />
        </div>
      </div>
      <TermReport report={report} />
    </div>
  );
}
```

- [ ] **Step 3: The parent fremdrift view**

Create `src/app/(portal)/forelder/fremdrift/ReportToggle.tsx`:

```tsx
'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

/** The demo's «Forhåndsvis terminrapport» reveal — content renders server-side. */
export function ReportToggle({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" onClick={() => setOpen((value) => !value)}>
          {open ? 'Skjul forhåndsvisning' : 'Forhåndsvis terminrapport'}
        </Button>
      </div>
      {open ? children : null}
    </div>
  );
}
```

Create `src/app/(portal)/forelder/fremdrift/page.tsx` (the house `?barn=` switcher — `forelder/page.tsx`'s exact pattern):

```tsx
import type { Metadata } from 'next';
import { GradeBadge } from '@/components/assessment/GradeBadge';
import { ProgressLadder } from '@/components/assessment/ProgressLadder';
import { QuranPositionCard } from '@/components/assessment/QuranPositionCard';
import { TermReport } from '@/components/assessment/TermReport';
import { EmptyState } from '@/components/ui/EmptyState';
import { PillLink } from '@/components/ui/PillLink';
import { getTermReportForChild } from '@/lib/dal/assessment';
import { getChildFremdrift } from '@/lib/dal/progress';
import { listChildrenForGuardian } from '@/lib/dal/students';
import { formatDateNb } from '@/lib/dates';
import { UNIT_LABELS } from '@/lib/validation/assessment';
import { ReportToggle } from './ReportToggle';

export const metadata: Metadata = { title: 'Fremdrift' };

export default async function ForelderFremdriftPage({
  searchParams,
}: {
  searchParams: Promise<{ barn?: string }>;
}) {
  const children = await listChildrenForGuardian();
  if (children.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <h1 className="text-2xl font-semibold">Fremdrift</h1>
        <EmptyState
          title="Ingen barn registrert ennå"
          description="Når skolen har registrert barna dine, ser du faglig utvikling, Koran og terminkarakterer her."
        />
      </div>
    );
  }
  const { barn } = await searchParams;
  const selected = children.find((child) => child.student_id === barn) ?? children[0];
  const [read, report] = await Promise.all([
    getChildFremdrift(selected.student_id),
    getTermReportForChild(selected.student_id),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Fremdrift</h1>
        <p className="text-ink/60">Faglig utvikling, Koran og terminkarakterer.</p>
      </div>

      {children.length > 1 ? (
        <nav aria-label="Velg barn">
          <ul className="flex flex-wrap gap-2">
            {children.map((child) => {
              const active = child.student_id === selected.student_id;
              return (
                <li key={child.student_id}>
                  <PillLink
                    href={`/forelder/fremdrift?barn=${child.student_id}`}
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

      {!read ? (
        <EmptyState
          title="Ingen fremgang registrert ennå"
          description="Når læreren registrerer arbeid, prøver og karakterer, ser du det her."
        />
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Faglig fremgang</h2>
            {read.fremdrift.books.filter((b) => b.recorded_at !== null).length === 0 ? (
              <p className="text-sm text-ink/60">Ingen bokfremgang registrert ennå.</p>
            ) : (
              <ul className="flex flex-col gap-4 rounded-lg border border-hairline bg-canvas px-4 py-4">
                {read.fremdrift.books
                  .filter((book) => book.recorded_at !== null)
                  .map((book) => (
                    <li key={book.book_id}>
                      <ProgressLadder
                        label={`${book.subject_name} · ${book.title}`}
                        current={book.current_unit}
                        total={book.total_units}
                        percent={book.percent}
                        unitLabel={UNIT_LABELS[book.unit_label]}
                      />
                    </li>
                  ))}
              </ul>
            )}
          </section>

          {read.fremdrift.quran ? (
            <section className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold">Koran</h2>
              <QuranPositionCard
                position={read.fremdrift.quran.position}
                weakSpots={read.fremdrift.quran.weak_spots}
              />
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Prøver</h2>
            {read.tests.length === 0 ? (
              <p className="text-sm text-ink/60">Ingen prøveresultater ennå.</p>
            ) : (
              <ul className="divide-y divide-hairline rounded-lg border border-hairline">
                {read.tests.map((row) => (
                  <li
                    key={row.test_id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
                  >
                    <span className="font-medium">{row.title}</span>
                    <span className="text-sm tabular-nums text-ink/60">
                      {formatDateNb(row.held_on)}
                    </span>
                    <span className="ms-auto tabular-nums font-medium">
                      {row.points} / {row.max_points} poeng
                    </span>
                    {row.feedback ? (
                      <span className="w-full text-sm text-ink/60">{row.feedback}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Terminkarakterer</h2>
            {read.grades.length === 0 ? (
              <p className="text-sm text-ink/60">Ingen terminkarakterer satt ennå.</p>
            ) : (
              <ul className="flex flex-col gap-3 rounded-lg border border-hairline bg-canvas px-4 py-4">
                {read.grades.map((grade) => (
                  <li key={grade.subject_id} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="min-w-32 font-medium">{grade.subject_name}</span>
                      <GradeBadge grade={grade.grade} />
                    </div>
                    {grade.feedback ? (
                      <p className="text-sm leading-relaxed text-ink/70">
                        {grade.feedback}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {report ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">Terminrapport</h2>
              <ReportToggle>
                <TermReport report={report} />
              </ReportToggle>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck, lint, walkthrough**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run lint && npm run build 2>&1 | tail -4
supabase db reset 2>&1 | tail -3
rm -rf .next && npm run dev
```

Browser: as `laerer@` — `/laerer/elev/<YUSUF>/rapport`: header «Terminrapport — Yusuf Farah», grades incl. Koran «Utmerket», one ladder (18/30), «Nåværende posisjon: Al-Ikhlas 1–4», Oppmøte 1/0/0/0; «Skriv ut» opens the print dialog with chrome hidden (`print:hidden` row gone in preview). As `forelder@` (no MFA) — `/forelder/fremdrift`: switcher Yusuf/Amira; Yusuf shows ladder + Koran card + 18/20 + two grades; «Forhåndsvis terminrapport» reveals the same report; Amira shows her Islamkunnskap ladder (5/24) and «Ingen terminkarakterer satt ennå.»; `?barn=<ZAYNAB>` (forged) falls back to the first own child — and `getChildFremdrift`'s null path can't be reached via the switcher (only own children are offered). 375 px pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add src/components/assessment/TermReport.tsx "src/app/(portal)/laerer/elev/[studentId]/rapport" "src/app/(portal)/forelder/fremdrift"
git commit -m "feat: term report with teacher print view and parent fremdrift"
```

---

### Task 15: Student fremdrift + admin books manager + elevside «Vurdering» block

The student's read view (the parent view minus switcher and report — demo parity), the admin book-ladder manager under `/admin/fag/[id]`, and the one-glance «Vurdering» block on the admin student page.

**Files:**
- Create: `src/app/(portal)/elev/fremdrift/page.tsx`
- Create: `src/app/(portal)/admin/fag/[id]/page.tsx`
- Create: `src/app/(portal)/admin/fag/[id]/BookForms.tsx`
- Modify: `src/app/(portal)/admin/fag/page.tsx` (a «Bokstiger» link section)
- Modify: `src/app/(portal)/admin/elever/[id]/page.tsx` (the Vurdering block)

- [ ] **Step 1: The student view**

Create `src/app/(portal)/elev/fremdrift/page.tsx` — structurally `forelder/fremdrift/page.tsx`'s per-child body with: `getOwnFremdrift()` instead of the child read; H1 «Fremdrift», intro `Slik ligger du an denne terminen.`; the same four sections (Faglig fremgang achieved-only ladders · Koran `QuranPositionCard` · Prøver list · Terminkarakterer with `GradeBadge`); **no** child switcher, **no** report toggle. `getOwnFremdrift()` returning `null` (unlinked login) renders the EmptyState `«Kontoen er ikke koblet til en elev ennå»` / `«Administrasjonen kobler kontoen din til elevregisteret — etterpå ser du fremdriften din her.»`. Copy the section JSX from the parent page verbatim, swapping `read.` for the own-read binding.

- [ ] **Step 2: The books manager**

Create `src/app/(portal)/admin/fag/[id]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listBooksForSubject } from '@/lib/dal/curriculum';
import { listSubjects } from '@/lib/dal/subjects';
import { BookCreateForm, BookRow } from './BookForms';

export const metadata: Metadata = { title: 'Fag' };

export default async function FagDetaljPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const subjects = await listSubjects();
  const subject = subjects.find((s) => s.id === id);
  if (!subject) notFound();
  const books = await listBooksForSubject(subject.id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/admin/fag"
          className="text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          ← Fag
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{subject.name}</h1>
        <p className="text-ink/60">
          Bokstigen for faget — lærerne registrerer fremgang mot disse bøkene.
        </p>
      </div>
      {books.length === 0 ? (
        <p className="text-sm text-ink/60">
          Ingen bøker ennå. Legg til den første nedenfor.
        </p>
      ) : (
        <ul className="divide-y divide-hairline rounded-lg border border-hairline">
          {books.map((book) => (
            <BookRow key={book.id} subjectId={subject.id} book={book} />
          ))}
        </ul>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Ny bok</h2>
        <BookCreateForm subjectId={subject.id} />
      </section>
    </div>
  );
}
```

Create `src/app/(portal)/admin/fag/[id]/BookForms.tsx` (`'use client'`, controlled, house patterns): **`BookCreateForm({ subjectId })`** — fields `title` (Input), `level` (number Input, default `'1'`), `unit_label` (select over `UNIT_LABELS` entries), `total_units` (number Input); `useActionState(createBook.bind(null, subjectId), idleForm)`; success clears title/total via the prev-state pattern; error/status lines. **`BookRow({ subjectId, book })`** — an `<li>` showing `«Nivå {level} · {title}»` (`tabular-nums` on figures) + `{total_units} {UNIT_LABELS[book.unit_label].toLowerCase()}r`-style count + an `ms-auto` cluster: «Rediger» toggle (opens the same field set seeded from the book, bound to `updateBook.bind(null, subjectId, book.id)`) and a **two-step** delete («Fjern» → «Bekreft fjerning»/«Avbryt», bound to `deleteBook.bind(null, subjectId, book.id)`) following `AbsenceNoticeList.tsx`'s confirm structure. All fields controlled.

- [ ] **Step 3: Link the manager from the fag index**

In `src/app/(portal)/admin/fag/page.tsx`: add `import { PillLink } from '@/components/ui/PillLink';` and insert this section **between** the subjects list/EmptyState and the «Nytt fag» section:

```tsx
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Bokstiger</h2>
        <ul className="flex flex-wrap gap-2">
          {subjects.map((subject) => (
            <li key={subject.id}>
              <PillLink href={`/admin/fag/${subject.id}`}>{subject.name}</PillLink>
            </li>
          ))}
        </ul>
      </section>
```

(Rendered only when `subjects.length > 0` — wrap in `{subjects.length > 0 ? … : null}`.)

- [ ] **Step 4: The elevside «Vurdering» block**

In `src/app/(portal)/admin/elever/[id]/page.tsx`:

Imports — add:

```ts
import { GradeBadge } from '@/components/assessment/GradeBadge';
import { getStudentAssessmentForAdmin } from '@/lib/dal/progress';
import { quranPositionLabel } from '@/lib/quran';
import { UNIT_LABELS } from '@/lib/validation/assessment';
```

Extend the parallel fetch:

```ts
  const [classes, attendance] = await Promise.all([
    listClassesForAdmin(),
    getStudentAttendanceForAdmin(student.student_id),
  ]);
```

becomes

```ts
  const [classes, attendance, assessment] = await Promise.all([
    listClassesForAdmin(),
    getStudentAttendanceForAdmin(student.student_id),
    getStudentAssessmentForAdmin(student.student_id),
  ]);
```

Insert this section **between** the «Oppmøte» section's closing `</section>` and the «Notat» section:

```tsx
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Vurdering</h2>
        {assessment.grades.length === 0 &&
        assessment.books.filter((b) => b.recorded_at !== null).length === 0 &&
        !assessment.quran_position ? (
          <p className="text-sm text-ink/60">Ingen vurderinger registrert ennå.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {assessment.grades.length > 0 ? (
              <ul className="flex flex-wrap gap-x-6 gap-y-2">
                {assessment.grades.map((grade) => (
                  <li key={grade.subject_id} className="flex items-center gap-2">
                    <span className="text-sm text-ink/70">{grade.subject_name}</span>
                    <GradeBadge grade={grade.grade} />
                  </li>
                ))}
              </ul>
            ) : null}
            {assessment.books
              .filter((book) => book.recorded_at !== null)
              .map((book) => (
                <p key={book.book_id} className="text-sm text-ink/70">
                  {book.subject_name} · {book.title}:{' '}
                  <span className="font-medium tabular-nums text-ink">
                    {UNIT_LABELS[book.unit_label].toLowerCase()} {book.current_unit} av{' '}
                    {book.total_units} ({book.percent} %)
                  </span>
                </p>
              ))}
            {assessment.quran_position ? (
              <p className="text-sm text-ink/70">
                Koran:{' '}
                <span className="font-medium text-ink">
                  {quranPositionLabel(assessment.quran_position)}
                </span>
              </p>
            ) : null}
          </div>
        )}
      </section>
```

- [ ] **Step 5: Typecheck, lint, walkthrough**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run lint && npm run build 2>&1 | tail -4
rm -rf .next && npm run dev
```

Browser: as `elev@` (no MFA) — `/elev/fremdrift` shows Yusuf's ladder, Koran card, 18/20, two grades; no switcher, no report. As `admin@` (AAL2) — `/admin/fag` shows «Bokstiger» pills; `/admin/fag/<ARABISK>` lists both books; create «Testbok» (nivå 3, enhet, 12) → appears; edit to 14 units → updates; two-step remove → gone; `/admin/elever/<YUSUF>` shows the Vurdering block (two grade chips, «side 18 av 30 (60 %)», «Koran: Al-Ikhlas 1–4») between Oppmøte and Notat. 375 px pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add "src/app/(portal)/elev/fremdrift" "src/app/(portal)/admin/fag/[id]/page.tsx" "src/app/(portal)/admin/fag/[id]/BookForms.tsx" "src/app/(portal)/admin/fag/page.tsx" "src/app/(portal)/admin/elever/[id]/page.tsx"
git commit -m "feat: student fremdrift view, admin book ladders and one-glance vurdering"
```

---

### Task 16: Role navs + entry links

The portals grow beyond one page for the first time — teacher/parent/student get `AdminNav`-mirror tab navs (demo vocabulary), the marking screen gets its per-student «Loggfør» link (D7: attendance → assessment in one tap), and the parent landing links each child's fremdrift. Navs land LAST so no link ever 404s in a walkthrough.

**Files:**
- Create: `src/app/(portal)/laerer/LaererNav.tsx`
- Create: `src/app/(portal)/forelder/ForelderNav.tsx`
- Create: `src/app/(portal)/elev/ElevNav.tsx`
- Modify: `src/app/(portal)/laerer/layout.tsx`, `forelder/layout.tsx`, `elev/layout.tsx`
- Modify: `src/app/(portal)/laerer/timer/[lessonId]/MarkAttendance.tsx`
- Modify: `src/app/(portal)/forelder/page.tsx`

- [ ] **Step 1: The three navs**

Create `src/app/(portal)/laerer/LaererNav.tsx` — `AdminNav.tsx`'s exact structure with:

```tsx
const ITEMS = [
  { href: '/laerer', label: 'I dag', exact: true },
  { href: '/laerer/vurdering', label: 'Vurdering', exact: false },
];
```

…and one delta: the Vurdering pill is also active on the per-student pages — compute `const active = item.exact ? pathname === item.href : pathname.startsWith(item.href) || (item.href === '/laerer/vurdering' && pathname.startsWith('/laerer/elev'));` `nav` `aria-label="Lærer"`. (`/laerer/klasser/*` and `/laerer/prover/*` are drill-ins from «I dag» and deliberately carry no active pill.)

Create `src/app/(portal)/forelder/ForelderNav.tsx` — items `Hjem` (`/forelder`, exact) + `Fremdrift` (`/forelder/fremdrift`), `aria-label="Forelder"`. Create `src/app/(portal)/elev/ElevNav.tsx` — items `Min side` (`/elev`, exact) + `Fremdrift` (`/elev/fremdrift`), `aria-label="Elev"`. Both are the plain `AdminNav` pattern (no delta).

- [ ] **Step 2: Mount them**

In each of the three layouts, mirror `admin/layout.tsx` exactly: import the nav, and wrap `{children}`:

```tsx
      <div className="flex flex-col gap-6">
        <LaererNav />
        {children}
      </div>
```

(`ForelderNav`/`ElevNav` in theirs. The `PortalShell` props are untouched.)

- [ ] **Step 3: «Loggfør» from the marking screen**

In `src/app/(portal)/laerer/timer/[lessonId]/MarkAttendance.tsx`: add `import Link from 'next/link';` and, inside the roster row's `ms-auto` action cluster, insert **after** the `Notat` `Button`:

```tsx
                      <Link
                        href={`/laerer/elev/${entry.student_id}`}
                        className="inline-flex min-h-11 items-center rounded-pill px-3 text-sm font-medium text-primary transition-colors duration-200 ease-brand hover:bg-surface-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        Loggfør
                      </Link>
```

- [ ] **Step 4: The parent teaser**

In `src/app/(portal)/forelder/page.tsx`: add `import Link from 'next/link';` and, inside the child header `<section>` (after the class/schedule `<p>`), append:

```tsx
        <p className="mt-1">
          <Link
            href={`/forelder/fremdrift?barn=${selected.student_id}`}
            className="text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Se fremdrift for {selected.first_name} →
          </Link>
        </p>
```

- [ ] **Step 5: Typecheck, lint, walkthrough**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run lint && npm run build 2>&1 | tail -4
rm -rf .next && npm run dev
```

Browser: `laerer@` sees «I dag · Vurdering» pills on every teacher page (Vurdering active on `/laerer/elev/<YUSUF>`); the marking screen (`/laerer/timer/f6000000-0000-0000-0000-000000000002`) rows carry «Loggfør» → lands on the student page; `forelder@` sees «Hjem · Fremdrift» + the teaser link under the child header; `elev@` sees «Min side · Fremdrift». Keyboard-tab through each nav (visible rings, `aria-current` on the active pill). 375 px: pills wrap cleanly.

- [ ] **Step 6: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add "src/app/(portal)/laerer/LaererNav.tsx" "src/app/(portal)/forelder/ForelderNav.tsx" "src/app/(portal)/elev/ElevNav.tsx" "src/app/(portal)/laerer/layout.tsx" "src/app/(portal)/forelder/layout.tsx" "src/app/(portal)/elev/layout.tsx" "src/app/(portal)/laerer/timer/[lessonId]/MarkAttendance.tsx" "src/app/(portal)/forelder/page.tsx"
git commit -m "feat: role navigation for teacher, parent and student portals"
```

---

### Task 17: Exit gate — full suite, browser pass, docs + ledger, feature summary

Closing task: prove the phase green across both walls and every surface, record the deferred ledger, land the feature summary, push, open the PR **against `real`**. No code changes beyond docs (fix findings under `fix:` commits first).

- [ ] **Step 1: The full exit gate (understand every number — never adjust an expectation to match output)**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck                       # silent
npm run lint                            # clean (benign _-prefix warnings only)
npm test -- --run 2>&1 | tail -3        # unit: 151 (119 + quran 5 + validation 14 + derivations/tones 13)
npm run build 2>&1 | tail -6            # every route compiles, incl. /laerer/prover/[testId] and /laerer/elev/[studentId]/rapport
supabase db reset 2>&1 | tail -4        # migrations + Phase-3 seed apply (gotcha 3: exit-1 in the final restart phase is benign)
supabase test db 2>&1 | tail -20        # pgTAP 395 across files 00–19
npm run test:api 2>&1 | tail -6         # 231 (173 + matrix 8 + core 26 + actions 24) — if a ~20s mass-failure: environment, reset + rerun (gotcha 3)
npm audit --audit-level=high            # exit 0 (zero new deps this phase)
git log --oneline real..feat/phase-3    # one feat/fix/test/docs commit per task + review-fix commits — nothing stray/foreign
```

- [ ] **Step 2: Design self-audit (spec §7 + web-interface-guidelines pass)**

Walk every new surface at 375 px and desktop, keyboard-only: focus rings on every pill/link/button/select/stepper input; `min-h-11` targets (incl. the points inputs and retract buttons); labels above inputs (or `sr-only`/`aria-label` where visual labels would drown the sheet — points/feedback rows); one `role="alert"` per form; teaching empty states; `tabular-nums` on every figure (units, percent, points, dates); grade tones per the design law (no danger anywhere in assessment); ladders carry `role="progressbar"` + labels; the report prints clean (no nav, no buttons — `print:hidden` verified in print preview). Fix findings under one `fix:` commit.

- [ ] **Step 3: Browser pass on every new surface (TOTP per gotcha 18)**

Reseed first (`supabase db reset`), then `rm -rf .next && npm run dev`:

| URL | Login | Verify |
|---|---|---|
| `/laerer/vurdering` | `laerer@` (AAL2) | Klasse 1 with Yusuf + Bilal; skjermet chip logic n/a (K1 has none); rows link |
| `/laerer/elev/<YUSUF>` | `laerer@` | 5 sections; ladder 18/30 60 %; Koran card Al-Ikhlas 1–4 «Repeteres» + «Å repetere»; log + retract round-trips; grades editable; rapport pill |
| `/laerer/elev/<AMIRA>` | `laerer@` | 404 (foreign class) |
| `/laerer/elev/<YUSUF>/rapport` | `laerer@` | report renders; print preview hides chrome |
| `/laerer/klasser/<K1>` | `laerer@` | «Prøver» section: seed test «2 ført»; Ny prøve round-trip |
| `/laerer/prover/<T_ALFABET>` | `laerer@` | prefills 18/14; correction saves; Rediger prøven works; foreign id → 404 |
| `/laerer/timer/<L_TODAY>` | `laerer@` | «Loggfør» per row → student page |
| `/forelder/fremdrift` | `forelder@` | switcher Yusuf/Amira; 4 sections + report toggle; teaser link on `/forelder` |
| `/elev/fremdrift` | `elev@` | read-only 4 sections; no report toggle |
| `/admin/fag/<ARABISK>` | `admin@` (AAL2) | 2 books; create/edit/two-step-delete round-trip; «Bokstiger» pills on `/admin/fag` |
| `/admin/elever/<YUSUF>` | `admin@` | «Vurdering» block between Oppmøte and Notat |
| Navs | all four | correct pills + `aria-current`; economy portal untouched (no assessment nav/surface) |

- [ ] **Step 4: README + Phase-3 deferred ledger**

In `README.md`, extend «Funksjoner» with:

```markdown
- **Fase 3 — vurdering og fremdrift:** bokstiger per fag med lærerlogget fremgang
  (append-only med angre), korantracker med tre lekse-strømmer (Under innlæring /
  Nylig lært / Sitter godt), posisjon og «Å repetere», klasseprøver med
  resultatføring på ett skjermbilde (interval-liste per prøvedato), terminkarakterer
  på en innstillingsstyrt skala med skriftlig tilbakemelding, utskriftsvennlig
  terminrapport, og fremdriftsvisninger for foresatte, elever og admin. Alle nye
  tabeller står bak RLS med dobbeltbundne skriveregler i begge murer og
  revisjonstriggere på elevdata.
```

Append a **Deferred ledger (Phase 3)** section to this plan:

1. Retract renders on all listed entries; RLS silently no-ops a non-author delete (idempotent success, row survives) — acceptable single-teacher-per-class; revisit with co-teachers.
2. «Ny prøve» subject options are all subjects (`listSubjects`); a wrong pick is server-rejected — class-scoped options need a teacher class-subjects read (rule-of-three watch with the vurdering overview's per-class fetches).
3. Freeform (bookless) progress entries: schema + walls support `book_id null`; no UI offers it yet.
4. `lesson_id` deep-linking of entries (D7) — columns reserved, always NULL.
5. Admin assessment *entry* UI (RLS admits admin; no UI) and grade-scale settings UI (service-role path only).
6. Parent-side print ceremony (parents preview in-app; only the teacher route is print-styled).
7. Teacher read-only page for FORMER (non-protected) students — walls exist (`taught_student_ever_unprotected`, pgTAP-pinned); no UI reaches them.
8. `/laerer/klasser/*` and `/laerer/prover/*` carry no active nav pill (drill-ins; nav has no Klasser index route).
9. Vurdering overview N+1 (`getRosterForTeacher` per class) — fine at 2–4 classes; revisit at scale.
10. `getTermReportForChild` re-reads the student header (one extra query per report render) — merge into the fremdrift read if it ever matters.

- [ ] **Step 5: Commit docs + push + PR (⛔ the push + PR are outward-facing — confirm with the user)**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add README.md
git commit -m "docs: phase 3 feature summary"
git push -u origin feat/phase-3
gh pr create --repo daodiii/iqra-portal --base real --head feat/phase-3 \
  --title "Phase 3 — Vurdering & fremdrift (books, Quran tracker, tests, term grades, report)" \
  --body "Assessment loop over the two-wall model: append-only progress/quran logs with double-bound teacher writes, held_on-rostered test results, settings-driven term grades, printable term report, fremdrift views for parent/student/admin. pgTAP 395 · test:api 231 · unit 151."
gh pr checks --watch
```

Expected: CI green (app + pgTAP jobs; `test:api` stays local by design). **Then STOP — this is an RLS-heavy PR: per the 2026-07-21 review policy it gets the full multi-agent `review-pr` panel before merge, and merging `feat/phase-3 → real` is the user's call.**

---

## Reconciliation applied (read before executing)

Cross-task fixes applied over the drafted tasks — these override any older wording elsewhere in the plan:

- **R1 — type ownership:** `TestResultRow`, `TermGradeRow` are declared in `src/lib/dal/progress.ts` (Task 8), imported by `assessment.ts`; `BookStanding.recorded_at` is `string | null` (zero-standings are unlogged class books). The header contract's `assessment.ts` listing is superseded on these two types.
- **R2 — book actions are double-bound:** `updateBook(subjectId, bookId, …)`, `deleteBook(subjectId, bookId, …)` (leading `subjectId` scopes `revalidatePath`).
- **R3 — `progress_entries` INSERT policy** is `admin OR teaches_student_subject(...)` — the helper implies active `teaches_student`, so the redundant conjunct from the design-spec table is dropped (Task 3).
- **R4 — «Ny prøve» subject options** come from the cached `listSubjects()`; class membership is enforced server-side in `createTest` («Faget tilhører ikke klassen.») and at rest by app-validation only (tests carry no student_id — the double-bind rule targets student-carrying rows).
- **R5 — pgTAP file 18** runs `plan(30)` with the audit pin as test 30 (the structural `23514` check was dropped — the pattern is already pinned in file 15).
- **R6 — totals:** pgTAP 280 → **395** (T1 281 · T2 299 · T3 344 · T4 374 · T5 395); `tests/api` 173 → **231** (T6 181 · T8 195 · T9 207 · T10 219 · T11 231); unit 119 → **151** (T7). The exit gate cites these; never adjust an expectation to match output — diagnose instead.

---

## Coverage self-check (master spec §9 Phase 3: «Books + progress, Quran tracker, tests + results, term grades + feedback, generated term report»)

| Spec item | Wall 2 (RLS + pgTAP) | Wall 1 (DAL + tests/api) | UI |
|---|---|---|---|
| Books catalog (admin-managed, economy-excluded) | T2 / 15 | T8 `listBooks*` + T10 CRUD | T15 fag/[id] |
| Book progress (append-only, latest = standing) | T3 / 16 | T8 assembler + T10 `logProgress` | T12 |
| Quran tracker (streams, position, «Å repetere») | T3 / 17 | T8 + T10 `logQuran` | T12 |
| Retract (author-or-admin) | T3 / 16–17 | T10 + survival test | T12 two-step |
| Tests + results (held_on interval roster) | T4 / 18 | T9 `getTestForEntry` + T11 actions | T13 |
| Term grades (scale-validated, upsert) | T5 / 19 | T10 `setTermGrade` | T12 editor |
| Term report (grades+progress+quran+attendance) | — (assembled read) | T9 report fns | T14 (+ parent toggle) |
| Parent/student fremdrift | T3–T5 SELECT paths | T8 child/own reads | T14 / T15 |
| Admin one-glance + grade-scale setting | T2 (settings) | T8 admin read | T15 block |
| Double-bind writes (C-1 class) | 16/18/19 negatives | T10/T11 forgery tests | — |
| Fine-derived #1 (parent A ↛ child B) | 16/17/19 | core 8/10 + matrix | — |
| Fine-derived #2 (protected leaver hidden from teacher) | 16/17 | — (RLS-only path, no UI) | — |
| Fine-derived #4 (teacher X ↛ class Y) | 16/17/18/19 | core 4 + actions 2/8 | 404s |
| Economy sees no pedagogy | 15–19 economy cells | matrix + core 10 | no surfaces |
| Audit on student-data writes | 16/17/18/19 pins | — | — |
| Role navigation (portals grow multi-page) | — | — | T16 |

