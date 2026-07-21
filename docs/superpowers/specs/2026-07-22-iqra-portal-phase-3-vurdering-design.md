# IQRA Skoleportal — Phase 3 (Vurdering & fremdrift) Design

> **Complements the master spec** (`docs/spec.md` §4 data model, §5 portals, §9 phases) and the roadmap decision record (`2026-07-22-iqra-portal-roadmap-and-transition.md`). This document captures the decisions Phase 3 resolves beyond the master entry «Assessment: Books + progress, Quran tracker, tests + results, term grades + feedback, generated term report», so the implementation plan can be written against a settled design. **Code lands in `/Users/daodilyas/dev/iqra-portal`** (branch `feat/phase-3`, cut from `real` @ `a0dee22`); the task-by-task plan follows in `docs/superpowers/plans/2026-07-22-iqra-portal-phase-3.md`.

**Status of the ground it builds on:** Phases 0–2 are complete on the `real` line (`a0dee22`): identity/roles/MFA, school core, and the full attendance loop, with the two-wall model (DAL + RLS), `private.*` relationship helpers, adversarial suites (pgTAP 280 · test:api 173 · unit 119), the audit namespace guard, and the "C · Familie" design system. `subjects.quran_tracking` already exists (Phase 1 comment even marks it "Phase 3"). The pitch demo (`main` @ `bc318b5`) prototyped this whole feature area — **its screens, Norwegian vocabulary, and view-models are the design reference** and are mined into this spec; the real build follows real-line conventions (server actions + RLS, not client state).

**Goal:** give teachers a sub-minute per-student logging flow (book position, Quran memorisation, notes), class tests with per-student results, and a term-end grade + feedback per subject — and give parents/students the "how is my child doing" picture (fremdrift ladders, Quran position, test results, term grades, printable term report) — all under the same two walls, with both adversarial suites extended and the fine-derived regressions re-pinned for assessment data.

---

## 1. Decisions resolved this phase

| # | Decision | Choice | Why |
|---|---|---|---|
| D1 | **Entry model** | `progress_entries` + `quran_entries` are **append-only logs** (no UPDATE); a mistaken entry is **retracted** (DELETE by its author or admin) and re-logged | Matches master §4 ("append-only; latest entry = current position") and the demo's model; history doubles as the audit trail of the pedagogy; mirrors the absence-notice retract pattern. |
| D2 | **Current standing = derivation, not state** | Latest entry per (student, book) = book position; latest `quran_entries` row = memorisation front; **weak spot = a surah whose *latest* entry has `result='repeat'`** | No mutable "current" column to drift; derivations are pure, unit-tested DAL functions. (Refines the demo, which listed every historical repeat as a weak spot — a later `pass` now clears the surah.) |
| D3 | **Books** | `curriculum_books` admin-managed per subject (`level`, `unit_label` side/leksjon/enhet, `total_units`); **no Koran book** — subjects with `quran_tracking=true` use the Quran tracker instead | Demo-confirmed IA (Koran progress is surah-based, not page-based); `level` orders a subject's book ladder; catalog is school structure, not student data. |
| D4 | **Tests** | `tests` (class + subject + title + `held_on` + `max_points`) teacher-created; `test_results` upserted per student on a **results-entry screen `/laerer/prover/[testId]` mirroring the attendance marking screen** (interval roster as of `held_on`, one save); test DELETE is admin-only | The demo showed tests read-only and never designed entry; the marking screen is the proven one-screen-per-event pattern — same roster semantics, same upsert correction model. A mis-created test is edited (title/date/points), not deleted; admin cleans up true mistakes. |
| D5 | **Term grades** | `term_grades` upserted per (student, term, subject); **grade is TEXT validated app-side against `settings.grade_scale`** (new column, default `{Utmerket, Meget god, God, Under arbeid}`); stored grades survive later scale edits | Master §4: "grade scale is a school setting (labels, not hardcoded)". No DB check against the scale — historical grades must outlive scale changes; the UI tone-maps known labels and falls back to neutral (the demo's `gradeTone` fallback, kept deliberately). |
| D6 | **History & skjermet** | Teacher reads for **left** students via `taught_student_ever` — **excluding protected students**, encapsulated in one new helper `private.taught_student_ever_unprotected`; guardians/own student read their child/self **always** (student-scoped, no enrollment filter); test metadata stays readable behind old results via `guardian_sees_test`/`student_sees_test` | Extends Phase 2's D2/D3 to assessment. `protected` isn't a local column on assessment tables, so the exclusion must live in the helper (Phase 2 spelled it inline on `students`). |
| D7 | **Lesson linkage** | `lesson_id` columns exist (nullable, master §4) but v1 actions always write NULL; the marking screen links each roster row to the student's assessment page (no param) | Keeps the sub-minute post-lesson flow (tap name → log) without a second double-bind surface for lesson ids this phase. Deep lesson-binding is a ledger item. |
| D8 | **Term report** | One shared server component (grades + book ladders + Quran position + attendance summary for the current term) rendered at **`/laerer/elev/[studentId]/rapport`** (print-styled) and embedded behind a toggle on the **parent** fremdrift view | Master §5 "report preview"; the demo promised parents the preview (`Forhåndsvis terminrapport`) — kept. Browser print = the "generated" report; no PDF pipeline. |
| D9 | **Role navigation** | Phase 3 introduces per-role tab navs (`LaererNav`, `ForelderNav`, `ElevNav`) mirroring `AdminNav` | Teacher/parent/student portals grow beyond one page for the first time; the demo's nav vocabulary is adopted (Lærer: I dag · Vurdering — Forelder: Hjem · Fremdrift — Elev: Min side · Fremdrift). |
| D10 | **Surface scope** | Teacher entry + parent/student read + admin **read blocks** (one-glance) and **books CRUD** (`/admin/fag/[id]`) are in; admin grade/progress *entry* UI, weak-spot analytics, and any economy access are **out** | Matrix row "Progress/tests/grades: economy —"; admin RW exists at the RLS wall (matrix) but ships no entry UI this phase (cockpit restraint, Phase-2 D7 precedent). |

---

## 2. Data model (new — keyed to master spec §4)

Two new enum types, six new tables, one `settings` column. All follow the house conventions: `created_at` everywhere; `updated_at` (+ `private.set_updated_at` trigger) only on mutable tables; `private.audit_row_change(...)` on student-data tables; grant firewall (revoke-all → narrow grants; `anon` nothing); Oslo-pinned dates; policies never subquery RLS tables (SECURITY DEFINER `private.*` helpers only).

```sql
create type public.quran_kind   as enum ('new', 'recent', 'longterm');
-- UI (bokmål): new=Under innlæring · recent=Nylig lært · longterm=Sitter godt
create type public.quran_result as enum ('pass', 'repeat');
-- UI (bokmål): pass=Bestått · repeat=Repeteres

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
```

**FK lifecycle.** Student data cascades from `students` (GDPR hard-erase takes the pedagogy trail). `subject_id` is `restrict` on the student-data tables — deleting a subject in use surfaces a mapped 23503 («Faget er i bruk …»), never a silent history erase; `curriculum_books.subject_id` cascades (catalog follows its subject) and `progress_entries.book_id` is `set null` (history survives a deleted book). `lesson_id` is `set null` (entries outlive calendar surgery). `tests.class_id` cascades (a deleted class takes its tests, and `test_results` cascade from `tests`); `term_grades.term_id` is `restrict` (grades pin their term). Every actor column (`recorded_by`/`set_by`) → `profiles` default restrict. No sequences (uuid/composite PKs only).

**Grants.** `authenticated`: `select, insert, update, delete` on `curriculum_books`, `tests`, `test_results`, `term_grades` (policies gate who; upsert-corrected tables need update; delete is policy-scoped to admin — and author for the log tables); `select, insert, delete` on `progress_entries` and `quran_entries` (**no UPDATE — append-only, D1**). `service_role`: `select, delete` on the five student/pedagogy tables (retention/erasure jobs), `select` only on `curriculum_books`. `anon`: nothing.

**Audit triggers (student data):** `progress_entries`, `quran_entries` → `private.audit_row_change('id')`; `test_results` → `('test_id', 'student_id')`; `term_grades` → `('student_id', 'term_id', 'subject_id')` (first arg = entity id, rest land in meta — the attendance convention). `curriculum_books` and `tests` carry **no** audit trigger (school structure, like `lessons`).

---

## 3. Derivation semantics (D2 — pure, unit-tested)

- **Book position:** for each (student, book): the entry with the latest `recorded_at` wins; `percent = round(100 * unit_reached / total_units)`, clamped 0–100 (an entry may exceed a later-shrunk book — display clamps, history keeps the raw number).
- **Quran position:** the student's latest entry overall (by `date`, then `created_at`) = «Nåværende posisjon», labelled `«{surah_name} {ayah_from}–{ayah_to}»`.
- **Weak spots («Å repetere»):** surahs whose **latest** entry (same ordering) has `result='repeat'` — a later `pass` on that surah clears it. Ordered by most recent first.
- **Term scoping:** fremdrift views show *current standing* (positions are cumulative across terms) but list only the **current term's** tests and grades; «Siste registreringer» lists cap at the 10 most recent entries.
- **Surah reference:** a static `SURAHS` table (`src/lib/quran.ts`): all 114 surahs `{ number, name, ayah_count }` (Hafs/Kufan counts). Validation clamps `ayah_from`/`ayah_to` to the surah's count app-side; the DB holds only the structural checks (§2). Unit tests pin `length === 114`, `sum(ayah_count) === 6236`, and spot-check An-Nas (6), Al-Ikhlas (4), Ya-Sin (83), Al-Baqara (286).

---

## 4. RLS model (both walls; new helpers)

Default-deny on all six tables; permissive OR-ed policies `to authenticated`, each delegating to a `private.` helper with `(select auth.uid())`; the DAL re-checks the relationship on top (the `.eq` discipline). **Every INSERT/UPDATE that carries a `student_id` is double-bound** (roadmap standing rule 1): the actor must own the *context* AND the student must belong to that same context — at both walls.

**New helpers (SECURITY DEFINER, `stable sql`, `set search_path = ''`, revoke-public → grant-authenticated — the Phase-2 ritual):**

- `private.taught_student_ever_unprotected(uid, sid)` → `taught_student_ever(uid, sid)` **and** the student is not `protected` (D6; the students-table policy spelled `protected = false` inline — here it must live in the helper).
- `private.teaches_student_subject(uid, sid, subj)` → uid teaches an **active** class of the student that offers the subject (`class_students` interval-open ∧ `class_teachers` ∧ `class_subjects`). Double-bind for progress/quran writes.
- `private.teaches_student_term_subject(uid, sid, tid, subj)` → as above, with the class belonging to term `tid`. Double-bind for `term_grades` writes.
- `private.teaches_test(uid, test_id)` → teacher of the test's class (mirrors `teaches_lesson`; no enrollment filter — history survives).
- `private.student_in_test_class(sid, test_id)` → student enrolled in the test's class **as of `held_on`** (interval, `left_on` exclusive; mirrors `student_in_lesson_class`). Double-bind for `test_results` writes.
- `private.guardian_sees_test(uid, test_id)` / `private.student_sees_test(uid, test_id)` → child/self has a `test_results` row on the test OR an interval-covering enrollment in the test's class (mirrors `guardian_sees_lesson`/`student_sees_lesson`).

**Per-table policy intent:**

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `curriculum_books` | admin OR teacher OR parent OR student (mirror `subjects`; economy excluded) | admin | admin | admin |
| `progress_entries` | admin OR `teaches_student` OR `taught_student_ever_unprotected` OR `is_guardian_of` OR `is_linked_student` | admin OR (`teaches_student` AND `teaches_student_subject`) | — (no grant, D1) | admin OR author (`recorded_by = uid`) |
| `quran_entries` | same as `progress_entries` | admin OR `teaches_student` *(subject axis n/a — Quran entries carry no subject_id)* | — (no grant, D1) | admin OR author |
| `tests` | admin OR `teaches_class(class_id)` OR `guardian_in_class(class_id)` OR `student_in_class(class_id)` OR `guardian_sees_test` OR `student_sees_test` | admin OR `teaches_class(class_id)` | admin OR `teaches_test` | admin |
| `test_results` | admin OR `teaches_test(test_id)` OR `is_guardian_of(student_id)` OR `is_linked_student(student_id)` | admin OR (`teaches_test` AND `student_in_test_class`) | admin OR `teaches_test` | admin |
| `term_grades` | admin OR `teaches_student` OR `taught_student_ever_unprotected` OR `is_guardian_of` OR `is_linked_student` | admin OR `teaches_student_term_subject` | admin OR `teaches_student_term_subject` | admin |

Notes: the guardian/student paths are student-scoped with **no enrollment filter** — a parent keeps the full trail after a class move or unenrollment (Phase-2 precedent). `quran_entries` INSERT needs no subject bind (no `subject_id` column) — the actor→student bind (`teaches_student`, active) is the whole wall, same strength as attendance's. `progress_entries` INSERT additionally pins the subject to a shared active class (`teaches_student_subject`), closing the "teacher logs Arabic progress on a student they only teach Koran" cell — pgTAP pins it. Author-scoped DELETE mirrors `absence_notices_delete_author_or_admin`.

---

## 5. Teacher flows (the sub-minute loop)

1. **From attendance to assessment:** each roster row on the marking screen (`/laerer/timer/[lessonId]`) links to `/laerer/elev/[studentId]` («Loggfør») — post-lesson logging is one tap from the screen the teacher already has open (D7).
2. **The per-student page** `/laerer/elev/[studentId]` (guarded by **active** `teaches_student`; a foreign *or former* student → 404 — the D6 history paths exist at the RLS wall, a read-only historical page is a ledger item): identity header (name, class, birth year, «Skjermet» chip) then the five demo-mined sections — **Bokfremgang** (per book of the class's non-Quran subjects: ladder + unit stepper + «Lagre fremgang»), **Koran** (only when the class offers a `quran_tracking` subject: position card + «Registrer koranfremgang» form: surah select from `SURAHS`, ayah range, result, note), **Prøver** (read-only list), **Terminkarakter** (per subject: grade select from `settings.grade_scale` + feedback textarea + save), **Terminrapport** (link to the print view). «Siste registreringer» lists under the two log sections with author-retract (two-step, house pattern).
3. **Vurdering overview** `/laerer/vurdering`: class-grouped roster (name, birth year, skjermet chip) linking into the per-student pages — the demo screen verbatim, real data.
4. **Tests:** `/laerer/klasser/[id]` gains a «Prøver» section (list + «Ny prøve» form: title, subject from the class's subjects, date, max points) → **`/laerer/prover/[testId]`** results entry: interval roster as of `held_on`, one points input + optional feedback per row, one save (upsert; corrections re-save), plus admin-style test edit for its teacher (title/date/points).

---

## 6. Surfaces (per role; "C · Familie" system, phone-first)

- **Teacher:** new `LaererNav` (I dag · Vurdering); `/laerer/vurdering`; `/laerer/elev/[studentId]` (+ `/rapport` print view); «Prøver» on `/laerer/klasser/[id]`; `/laerer/prover/[testId]`; «Loggfør» links on the marking screen.
- **Parent:** new `ForelderNav` (Hjem · Fremdrift); `/forelder/fremdrift` with the house `?barn=` switcher: **Faglig fremgang** (ladders), **Koran** (position + weak spots + recent), **Prøver**, **Terminkarakterer**, **Terminrapport** (toggle-revealed inline report, D8). `/forelder` landing gets one «Fremdrift»-teaser line per child linking over.
- **Student:** new `ElevNav` (Min side · Fremdrift); `/elev/fremdrift` — same four read sections, no report toggle (demo parity).
- **Admin:** «Vurdering» block on `/admin/elever/[id]` (term grades chips + current book positions + Quran position — read-only one-glance); `/admin/fag/[id]` (new page): subject header + books manager (create/edit/delete `curriculum_books`); `/admin/fag` rows link to it. No cockpit change.
- **Economy:** nothing.

Shared components (ported from the demo, restyled to real primitives): `ProgressLadder` (role="progressbar", quartile notches), `QuranPositionCard` («Nåværende posisjon» + «Å repetere»), `GradeBadge` (tone map with neutral fallback), `TermReport` (grades + ladders + Quran + attendance summary; print stylesheet). Vocab modules: `src/lib/assessment-ui.ts` (tones) + label maps in `src/lib/validation/assessment.ts`; surah table `src/lib/quran.ts`.

Accessibility per §7: `min-h-11` targets, visible focus rings, labels above inputs, `role="alert"` inline errors, `tabular-nums` on figures, keyboard path through stepper/forms, `prefers-reduced-motion` respected; controlled fields on every new form (React 19 reset rule).

---

## 7. Testing strategy (per §8 — TDD, tests-first, CI-gated)

**Wall 2 (pgTAP, files `15`–`19`, fixtures `b3`–`b7`):** every §4-matrix cell allow **and** deny as each seed role, plus: the two **double-bind negatives** (own-teacher inserts a `progress_entries` row for an off-subject student → 42501; own-teacher inserts a `test_results` row for an off-roster/late-leaver student as of `held_on` → 42501 — the C-1 regression class, pinned at wall 2); append-only (UPDATE on the log tables → 42501 even as admin); author-vs-foreign retract; protected-leaver invisibility on the `taught_student_ever_unprotected` path vs plain `taught_student_ever` visibility for the non-protected leaver; guardian keeps reading after `left_on`; economy zero across all six; audit rows for insert/upsert/delete on the four student-data tables; grade text is free at the DB wall (scale is app-enforced — pinned so nobody "helpfully" adds a DB check later).

**Wall 1 (`tests/api`):** `assessment-core.test.ts` (DAL reads: vurdering overview scoping, per-student assessment for own/foreign/protected-leaver students, parent/student/admin fremdrift reads, books catalog, report assembly incl. attendance summary) + `assessment-actions.test.ts` (log/retract progress + quran with forged student/subject ids, test create/edit + results upsert with off-roster forgeries, term-grade set with off-scale grade and foreign term, books CRUD admin-gate) — every action also probed for the guard order role → AAL2 → validation. `DENIED_CELLS` in `access-wall.test.ts` grows by the six new tables for every seed user.

**Unit:** `src/lib/quran.test.ts` (114/6236/spot checks, option formatting), `src/lib/validation/assessment.test.ts` (schemas, label maps, grade-scale validation incl. scale-drift tolerance), derivation functions (`latest-per-book`, weak-spot clearing, percent clamp) in `src/lib/assessment.test.ts`.

**Seed:** books (the demo's three: «Alfabet og lyder» 30 · «Ord og setninger» 40 · «Grunnleggende islamkunnskap» 24), Yusuf's demo-mined hero trail (book positions 6→12→18 of 30 with the three Norwegian notes; Quran: An-Nas longterm/pass → Al-Falaq recent/pass → Al-Ikhlas new/**repeat** «Repeteres – litt usikker på ayah 3–4.»), one K1 test («Prøve: Det arabiske alfabetet», 2026-08-29, max 20; Yusuf 18, Bilal 14) and one term grade set (Yusuf: Koran «Utmerket», Arabisk «Meget god») — so every surface renders against real data on first boot.

---

## 8. Scope boundaries (explicitly deferred — do not build this phase)

- No **admin entry UI** for grades/progress (RLS admits admin; UI is teacher-only this phase).
- No **weak-spot analytics/dashboards** beyond the «Å repetere» card; no per-ayah mistake tracking.
- No **PDF pipeline** — the report is a print-styled page; no archival snapshot of reports (renders live data).
- No **grade-scale admin UI** (seeded default; edits go through the service-role settings path until the settings screen lands, ~Phase 7).
- No **lesson deep-linking** of entries (D7 — columns reserved, always NULL v1).
- No **notifications** on new grades/results (Phase 5 owns pings).
- No assignment/innlevering surfaces (Phase 4), no economy access, no i18n.

---

## 9. Open items (non-blocking)

- Real book list, grade-scale labels, and whether IQRA wants the three-stream Quran vocabulary tuned (Under innlæring / Nylig lært / Sitter godt) — collected from IQRA admin during the pilot; seeds unblock development.
- Whether the report should also list absence **notes** (currently: counts only) — decide with the pilot teachers.
- Teacher term-scoping of `listMyTeachingClasses` (Phase-1 ledger) starts to matter when a second term exists — assigned to Phase 4 in the roadmap.

---

## 10. Task shape (input to writing-plans)

Phase-2 rhythm (one commit per task; TDD; fresh implementer per task; security review on the RLS/action tasks; controller live-verifies before closing):

1. Branch ceremony verification + carry-forward riders (ci.yml `real`, `created_by` pin, generate-throw, history guard).
2. Migration: `curriculum_books` + `settings.grade_scale` + pgTAP 15.
3. Migration: `progress_entries` + `quran_entries` + helpers (`taught_student_ever_unprotected`, `teaches_student_subject`) + pgTAP 16/17.
4. Migration: `tests` + `test_results` + helpers (`teaches_test`, `student_in_test_class`, `guardian_sees_test`, `student_sees_test`) + pgTAP 18.
5. Migration: `term_grades` + `teaches_student_term_subject` + pgTAP 19.
6. Seed + regenerated types + `access-wall` matrix growth.
7. `SURAHS` + validation schemas + label maps + derivation functions (pure units).
8. DAL: curriculum + progress/quran reads + `assessment-core` tests.
9. DAL: tests/grades/report assembly + `assessment-core` growth.
10. Actions: progress/quran log + retract; books CRUD.
11. Actions: tests create/edit + results upsert; term-grade set.
12. Role navs (Laerer/Forelder/Elev) + marking-screen «Loggfør» links.
13. Teacher: vurdering overview + per-student assessment page.
14. Teacher: klasser «Prøver» section + `/laerer/prover/[testId]` entry screen.
15. Parent: fremdrift view + landing teaser; **Student:** fremdrift view.
16. Admin: elevside «Vurdering» block + `/admin/fag/[id]` books manager; **report** print view + parent toggle.
17. Exit gate: full suite, browser pass, docs + ledger, feature summary.

(~17 tasks; the plan finalizes ordering, security-review flags, and per-task step lists.)
