# Phase 5 plan 2 — independent review panel, 2026-08-05

**Why this is a separate file:** a concurrent session was actively rewriting
`2026-08-06-iqra-portal-phase-5-announcements.md` while this panel ran (3 558 →
4 040 lines, mid-renumber, uncommitted). Editing it would have corrupted that
work. **Merge these findings into the plan when that session is finished.**

Three lenses over the plan before execution — escalation · assertion vacuity ·
repo integration — dispatched because the plan's own ledger said plainly that
only "one focused pass plus one dispatched lens" had been run, and named these
three as what was missing.

---

## ✅ Already applied by the concurrent session — do not apply twice

Verified present in the working tree at 4 040 lines: the Task 2 term-vs-class
uuid fix (0 wrong occurrences, 6 correct) · the FILTERED-not-raised update
assertion · `announcement_reads_select_own_or_staff` witnesses · the scalar
subquery abort · the pupil-own-login witness · a forward-dating bound
(`published_at <= created_at + interval '120 days'`) · the protected-pupil
material.

**Its numbering has already moved** (file 37 was `plan(39)` at HEAD, the
worktree says `plan(47)`, and Tasks 4–5 were mid-renumber and self-inconsistent
when observed). Anyone merging the items below must re-derive numbering against
its final state — and **none of the items below change any assertion count**,
which is why they are safe to merge whenever.

---

## ⛔ THREE OPEN DECISIONS — proved by execution, not closed

### OD-1 — `announcement_read_status` discloses a **protected** pupil's name (HIGH)

`public.students` carries two SELECT policies (verified directly against
`pg_policy`):

- `students_select_related` → `private.teaches_student(uid, id)` — **live**
- `students_select_taught_ever` → `private.taught_student_ever(uid, id) **and protected = false**`

So the house rule is: a teacher sees her **current** roster including protected
pupils, and the **historical** roster of her classes **only for non-protected**
pupils.

`announcement_read_status` returns the **as-of** roster, binds on
`private.writes_announcement` (a *write* authority, live `teaches_class`), and
applies **no `protected` filter**.

Proved in a rolled-back transaction — one teacher, one session, three departed
pupils in a class she currently teaches:

| | rows |
|---|---|
| `students` row for the **protected** departed pupil | **0** — the policy refuses |
| `students` row for an ordinary departed pupil (control) | 1 — `taught_student_ever` admits |
| `announcement_read_status` names, same teacher | **all three, including the protected pupil** |

The control is what makes it precise: `taught_student_ever` has no temporal
bound, so for non-protected pupils the projection discloses nothing new. **The
entire delta is the protected pupil.**

The plan's justification A4 — "the people who already see the pupil on their
roster" — is true of the **live** roster and false of the **as-of** roster,
which is the one the function uses.

⚠ **Provenance correction.** An earlier note attributed the `protected = false`
clause to `20260803001000` and called it three days old. **That is wrong.** It is
`supabase/migrations/20260721120712_attendance_visibility.sql:79-84`, dated
**2026-07-21 — fifteen days old** — added under D3 with the comment "Protected
students stay teacher-visible only while actively enrolled".
`20260803001000_protected_mate_omission.sql` is a *different* change (the
mate-name projection's `and not s.protected`). The substance stands; only the
age does not.

**The witness is blind to the unsafe half.** Whatever the concurrent session has
added, check it: if the protected pupil is seeded with `left_on = null` she is on
the **live** roster, so the assertion pins the safe case and cannot see this one.
The fixture needs a protected pupil with `left_on` set **inside** the as-of
interval.

**Decide:** gate the name — `case when s.protected and not private.teaches_student((select auth.uid()), s.id) then <placeholder> else …` — keeping the row so the read-tracking denominator stays correct; **or** accept it and record in A4 that the projection deliberately widens the `protected = false` rule.

### OD-2 — school-wide announcements have **no audience bound at all**

`cls is null` short-circuits before any membership test, so the audience is
*every row in `auth.users`*. Proved:

| actor | class notice today | school-wide today |
|---|---|---|
| family that left 10 days ago | **0** (D9 correct) | **1** |
| user with **no role, no enrolment, no guardian link, ever** | — | **1**, and can record a read |

Since offboarding does not exist until plan 4, **every account ever created keeps
receiving school-wide notices permanently.**

⚠ **A3's stated invariant is provably false for `class_id is null`.** A3 says
"the denominator is the same set the read predicate admits". For school-wide the
denominator is the **as-of pupil roster** while the audience is **every
authenticated user** — so «12 av 28 har lest» is computed over a set that is not
the audience. **That is a factual error in the plan and should be corrected
regardless of the decision.**

Note the plan's assertions 09 and 15 both use a *departed* guardian as a session
control, so the suite currently asserts this behaviour as correct without ever
naming it.

**Decide:** impose a bound (live enrolment ∪ staff ∪ economy) — a product
decision — or accept and add a «leaves broken» entry.

### OD-3 — a published announcement is freely rewritable by its author

`announcements_update_author` carries no publication-state bound;
`announcements_delete_own_unpublished` carries `published_at > now()`. A2
justifies the delete bound and never mentions the update.

Proved: 30 days after publication the author rewrote both `title` and `body`;
the family's `announcement_reads` row **survived**, so read-tracking still
asserts they read it. The audit trigger records changed column **names** only, so
the prior text is unrecoverable. The migration justifies `on delete restrict`
with "an announcement is a record of what the school told a family" — and that
same record is rewritable at will.

**Decide:** add `and published_at > now()` to the update policy (consistent with
A2, but blocks fixing a typo after publication), or accept and state in «leaves
broken» that read-tracking means read-of-*a*-version.

---

## Fixes still to merge — none touch assertion numbering

### 1. A10's parameter-naming rationale is **backwards**
The plan claims naming the parameters `cls`/`pub`/`author` is what keeps three
markers non-vacuous, and that renaming them to `class_id`/`published_at`/
`created_by` would make those markers vacuous **while still reporting green**.

Measured: all 26 new markers matched against the function **header only** →
**0 rows**. Every marker is dot-qualified (`private.has_role`, `cs.left_on`),
operator-bearing (`cls is null`, `pub <= now()`), or a string literal
(`Europe/Oslo`). **Not one is a bare parameter name**, so none can match a
header. Renaming `cls` → `class_id` makes `'cls is null'` match **nowhere** — the
fingerprint goes **red**, which is loud and safe, not silently green.

Plan 1's F1 hazard was specific to the **bare-word** marker `'kind'`, which the
parameter list satisfied. That does not generalise. Reword: *the operators are
what keep these non-vacuous; the parameter names are incidental.*

★ **Bonus defect:** Task 6 Step 4's own "F1 check" is confounded — it renames the
parameters **and** deletes the `cls is null` arm in the same mutation, and the
deletion alone reddens it. It proves nothing about naming.

### 2. `src/enrollment-interval.test.ts` is an unnamed repo-wide invariant
It sweeps every `src/**/*.ts(x)` for `enrolled_on`/`left_on` and asserts **exact**
counts (`asOfLeft` 8, `asOfEnrolled` 8, `clamps` 2) plus a per-site operator
assertion.

Plan 2 adds **three** SQL sites, not the two it claims: `guardian_in_class_asof`,
`student_in_class_asof`, **and `public.announcement_read_status`** (whose own
Task-6 markers pin `cs.enrolled_on <=` / `cs.left_on` / `Europe/Oslo`).

No red build today — the plan adds **zero** TS-side sites, confirmed — but "ninth
and tenth" is off by one, and that file's header comment and
`34_enrollment_boundary.sql`'s header both become false. **Add it to the Modified
list** as "comment only; counts must not move — run it", and say ninth/tenth/
**eleventh**. If plan 3 ever puts an as-of filter in TypeScript, that file goes
red with no warning anywhere.

### 3. Two mutation tables under-report collateral reddening
Both matter under the plan's own "each must redden ALONE" bookkeeping.
- Task 1 mutation 9 (delete the `cls is null` arm) also reddens **07 and 09** —
  guardians `…005`/`…006` lose the school-wide row.
- Task 5 mutation 2 (delete `b.published_at <= now()`) also reddens **44**, not
  just 47.

### 4. Task 11 step 4's acceptance criterion is false
It says every test must fail under `with check (false)`. **Three of eight
correctly stay green**: the two zod-refusal tests never reach the database, and
"refuses a class the teacher does not teach" is still refused with the same
sentence. As written it will be observed false and invites "fixing" correct
tests. Restate: *the five create-then-read tests must fail; the three refusal
tests stay green, and that is why the positive control in test 1 exists.*

Also: the positive control is `expect(...length).toBeGreaterThan(0)` on the one
assertion whose entire job is to distinguish "correctly refused" from "nothing
works". Use the seed roster's exact size.

### 5. Coverage holes not yet closed
- **§H: the school-wide branch (A6) has no assertion.** Every §H call passes a
  class announcement. Delete `a.class_id is null or` from the roster lateral and
  all §H assertions stay green — silently killing read-tracking for the case A6
  calls the one where "who has not seen it" is most valuable. Add an admin-role
  assertion on the school-wide id.
- **§H: the `ar.announcement_id = a.id` correlation is untested and
  set-preserving.** Every call uses a one-element array over the only
  announcement with a read row; drop the correlation and `has_read` picks up the
  fixture row on `…046` — same guardian, same pupil — so the count is unchanged.
  Pass a two-element array and assert the second id's `has_read` → 0. This also
  exercises the batching contract, which no call currently does.
- **Standing rule 2 is violated for the insert wall.** Assertions 24/25/26 (a
  teacher publishing to a foreign class, to the whole school, forging
  `created_by`) have no named mutation, nor does the `teaches_class` read arm
  behind 12/13.
- **The `enrolled_on` upper edge is unpinned in both file 37 and file 34.** D →
  IN is asserted; D+1 → OUT is asserted nowhere (file 37's "after" pupil is at
  D+20). `cs.enrolled_on <= X` → `<= X + 1` reddens **nothing in the entire
  suite**.
- **`public.can_edit_announcement` has fingerprint markers but no behavioural
  assertion.** Dropping its `created_by = auth.uid()` conjunct shows an edit
  control to any teacher of the class — a UI lie rather than a hole, since the
  policy still refuses, but the mirror claim in its comment is untested.
- **The api suite's promised delete test is missing.** The plan's own file table
  says it covers "the filtered delete"; Task 11 contains no delete. Since RLS
  DELETE refusals are *filtered*, the TypeScript layer is the only place a silent
  "nothing happened" becomes a sentence — the whole point of wall 1.

### 6. «What this plan deliberately leaves broken» additions
- ★ **This repo has no scheduling mechanism of any kind.** `vercel.json` is
  `{"regions":["arn1"]}` — no `crons` key. `pg_cron` is available at 1.6.4 with
  `installed_version` **NULL**. `find src/app -name route.ts` returns **zero** —
  there is not one route handler in the app. So `claim_due_announcements()` has
  no caller, and **plan 3 must build the repo's first API route *and* its first
  cron entry.** Say so, so plan 3 budgets it.
- `announcements.created_by → profiles ON DELETE RESTRICT` blocks deleting any
  staff profile that has ever published. No live consequence today; plan 4's exit
  gate should know.
- Promote standing rule 8 to **"check `docker ps` first"** — a reviewer measured
  a plausible but **wrong** baseline because a sibling session's `db reset` was
  mid-flight and `supabase_migrations.schema_migrations` did not yet exist.

### 7. Three choices the findings leave open
Whoever merges must fix these explicitly **before** touching the numbering table,
or the drift recurs: whether the `enrolled_on` upper-edge fix adds one assertion
or two per file (guardian *and* pupil arms); where the `can_edit_announcement`
assertion lands (§E or §F); and whether the §G read-recording is one `lives_ok`
or more.

---

## Verified SOUND — so nobody re-litigates it

- ★ **The fingerprint counter is RIGHT: 49 → 75.** The eight new entries carry
  exactly 26 pairs by `lateral unnest` (4+4+6+1+3+2+4+2), and all 26 markers
  match the installed `pg_get_functiondef` bodies with **zero missing**. **This
  is the exact thing plan 1 got wrong** — it said 31 when the answer was 43.
- **pgTAP file 37 passes 52/52** assembled verbatim from the plan on its three
  migrations, no plan mismatch, and every §-to-number mapping in the cross-task
  table is correct.
- **Baseline measured `Files=37, Tests=748, PASS`**, and the sum of committed
  `plan(N)` is also **748** — no repeat of plan 1's discrepancy. Exit arithmetic
  748 + 52 + 6 + 9 = **815 / 38 files** is right.
- **All three migrations compile clean** run verbatim inside a rollback; every
  helper exists with the exact signature called; `audit_row_change('id','class_id')`
  matches `class_students_audit`'s house form; the trigger syntax compiles on
  **PostgreSQL 17.6**.
- **The teardown is correct.** Files 35 and 36 each carry **9** deletes (the
  ninth is `terms`), and file 37's 11-line block is complete against the full
  RESTRICT/NO-ACTION edge set into `classes`/`terms`/`subjects`/`profiles`.
  `term_grades` is cleared by the `students` cascade *before* `delete from
  public.terms` — that is why the block works. 23 test files run `delete from
  public.classes`; the plan's count is exact.
- **Every whole-schema invariant stays green** with the new tables applied:
  `00_grant_firewall` 6/6, `26_rls_force` 4/4, `01_schema` 13/13,
  `03_audit_log_rls` 15/15. A sweep of all 37 files found only `00` and `26`
  sweep all tables — **no unaccounted invariant**.
- **D17 (`economy` exclusion) is clean**, verified in both directions: INSERT to
  a class and school-wide both 42501; reads class 0, school-wide 1;
  `announcement_read_status` returns 0. `private.is_staff` appears **nowhere** in
  the plan except the standing rule forbidding it.
- **The `RETURNING` hazard is genuinely closed** — `insert … returning id`
  succeeds under the row-form policy.
- **The write boundary holds.** `has_column_privilege(authenticated, …)` is false
  for `class_id`/`published_at`/`created_by` UPDATE, `fanned_out_at` INSERT and
  `announcement_reads.read_at` INSERT. No retroactive audience widening, no
  back-dating, no read forging.
- **`claim_due_announcements` refuses an ordinary authenticated caller** (42501)
  and returns id/class_id/published_at only — no content.
- **No existence oracle on a scheduled announcement**: `with check` fires before
  the FK, so existing-but-unreadable and non-existent both return 42501.
- **The as-of interval spelling is byte-identical to all eight existing sites.**
- **§D (the scheduled row) covers both edges of D8** — the family cannot read the
  future-dated row, with the same guardian reading the published one as control,
  and the author reads it attributably. **The disclosure case is covered.**
- **The `announcement_reads` upsert is the right shape** —
  `ignoreDuplicates: true` → `ON CONFLICT DO NOTHING`, which needs no UPDATE
  privilege, correct for a table with neither an UPDATE grant nor policy.
- **Task 1 Step 3's stamp probe works verbatim.** Note the uuid
  `11111111-…-1111` it uses is **`admin@test.local`** in the seed — it reads like
  a fabricated value, and the plan tells the executor to stop if it 42501s.
- ★ **Two assumptions the plan flagged as unverified are now measured and both
  hold:** a BEFORE INSERT trigger **can** assign a column the caller holds no
  grant on, and `for update skip locked` inside `where id in (…)` in a
  `language sql` function that `returns table` **is** accepted.
