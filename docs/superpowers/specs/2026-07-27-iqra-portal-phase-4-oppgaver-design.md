# IQRA Skoleportal — Phase 4 (Lekser & oppgaver) Design

**Date:** 2026-07-27 · **Status:** Design spec, approved by user · **Branch target:** `feat/phase-4` cut from `real` (@ `5bb80c2` = Phase 0+1+2+3)

**Inputs:** master spec `2026-07-15-iqra-skoleportal-design.md` (§4 data model, §9 phase 4), roadmap `2026-07-22-iqra-portal-roadmap-and-transition.md` (§3 phase-4 row, standing rules 1–7), Phase-3 spec (house format + RLS idioms), demo branch `feat/demo-redesign` (`laerer/oppgaver`, `elev/lekser`, `forelder/lekser` — mined for vocabulary and screen shape), and **direct feature requests from IQRA's teachers (2026-07-27)**.

This phase is driven by teacher requests, not only by the roadmap one-liner. The teachers use Google Classroom and asked for its core loop. Where this spec departs from the master spec, §1 records it explicitly.

## 1. Decisions resolved this phase

| # | Decision | Rationale |
|---|---|---|
| **D1** | **Groups are class-level templates, copied onto each assignment.** `class_groups` is reusable ("Halaqa A"); creating a group assignment **copies** its membership into `assignment_group_members`. | Teachers said "make the groups *before* the assignments are sent" → groups pre-exist tasks. Copying (not referencing) means editing a template next month never rewrites who was in last month's task. Same discipline as the Phase-2/3 roster-as-of-date idiom. |
| **D2** | **Group size 2–4 pupils**, enforced app-side. | User decision. A group of 1 is an individual assignment. App-side matches the Phase-3 precedent (`points ≤ max_points`, grade scale) — no DB check, pinned by pgTAP instead. |
| **D3** | **Shared hand-in, per-pupil review.** One `submissions` row per group; `assignment_reviews` is always keyed `(assignment_id, student_id)`. | Group work is the differentiator (Google Classroom cannot do it at all). Keeping *assessment* per-child preserves the standing "parent A ↛ child B" rule where it matters most: a parent sees their own child's mark, never a sibling-of-a-stranger's. |
| **D4** | **Attachments allowed on assignments and submissions.** Types: images, documents, audio, video. Cap **50 MB**; resumable upload above 6 MB. | User: "we need attachments. allow it". Audio enables Quran-recitation hand-ins — a strong hifz fit at the cost of one MIME allowlist entry. **This overrides the master spec's v1 non-goal** ("Message attachments (text only in v1…)") — see D5. |
| **D5** | **Master-spec non-goal retired.** The "no message attachments in v1" line no longer holds. Attachments on **announcements/posts** are approved but land in **Phase 5** with the `announcements` table. | Announcements are Phase 5's schema. Phase 4 establishes the Storage pattern; Phase 5 adds a third bucket reusing it. Keeps this phase reviewable. |
| **D6** | **Three private buckets by audience**; Phase 4 creates **two** (`assignments`, `submissions`), Phase 5 adds `announcements`. | Each bucket's policy matches exactly one audience, so a policy bug cannot leak across audiences and the tightest wall (children's own work) stays isolated. Defensible in the DPIA. |
| **D7** | **Teacher-defined groups only this phase.** Pupil self-add to a group is deferred. | Pupil self-add opens a new RLS write wall where *children modify each other's* task membership, requiring safeguarding answers (unwanted adds, removals, teacher override, visible exclusion). The tables are identical either way, so it is purely additive later — **no migration**. Google keeps groups teacher-only for the same reason. |
| **D8** | **Submission status is DERIVED, never stored; no auto-zero.** `Ikke levert` / `Levert` / `Levert etter frist` / `Vurdert`, computed from `due_on` + submission + review. | Classroom's auto-"missing" with a draft score of 0 is a documented source of teacher–parent friction. A derived status carries the same information with none of the disputes, and cannot drift from reality. |
| **D9** | **`submissions` carries `student_id` XOR `assignment_group_id`** (DB CHECK, exactly one non-null). | One table serves individual and group hand-ins without a second near-identical table, while the CHECK makes "belongs to both / belongs to neither" unrepresentable. |
| **D10** | **Assignment reuse ("gjenbruk oppgave") is IN scope.** Copies title, instructions, subject and **attachments** onto a new assignment; the teacher re-picks class, `due_on` and targeting. Never copies submissions, reviews or frozen group membership. | User decision, 2026-07-27. Classroom's single biggest prep-time saver, and the fit here is unusually strong: the same curriculum re-runs every year with volunteer-teacher turnover. Re-picking targeting (rather than resurrecting a frozen roster) is what keeps D1's semantics intact — see §3.1. |

## 2. Data model (new — keyed to master spec §4)

Seed prefixes (free, confirmed non-colliding): **`fb`** = class/assignment groups, **`f8`** = assignments, **`f9`** = submissions & reviews.

```
class_groups (id, class_id → classes on delete cascade, name, sort, created_by,
              created_at, updated_at)                     unique (class_id, name)
class_group_members (group_id → class_groups on delete cascade,
                     student_id → students on delete cascade)   pk (group_id, student_id)

assignments (id, class_id → classes on delete restrict, subject_id → subjects on delete restrict,
             title, instructions, due_on date, submission_type ('digital'|'none'),
             created_by, created_at, updated_at)

assignment_groups (id, assignment_id → assignments on delete cascade, name,
                   source_group_id → class_groups on delete set null)  unique (assignment_id, name)
assignment_group_members (assignment_group_id → assignment_groups on delete cascade,
                          student_id → students on delete cascade)
                                                    pk (assignment_group_id, student_id)

submissions (id, assignment_id → assignments on delete cascade,
             student_id → students null, assignment_group_id → assignment_groups null,
             body text null, submitted_by, submitted_at)
             CHECK ((student_id is null) <> (assignment_group_id is null))
             unique (assignment_id, student_id), unique (assignment_id, assignment_group_id)

assignment_reviews (assignment_id → assignments on delete cascade,
                    student_id → students on delete cascade,
                    status ('godkjent'|'ny_innlevering'), points int null, feedback text,
                    reviewed_by, reviewed_at)          pk (assignment_id, student_id)

assignment_attachments (id, assignment_id → assignments on delete cascade,
                        path text unique, filename, mime, size_bytes bigint,
                        uploaded_by, created_at)
submission_attachments (id, submission_id → submissions on delete cascade,
                        path text unique, filename, mime, size_bytes bigint,
                        uploaded_by, created_at)
```

**Why two attachment tables, not one polymorphic table:** a polymorphic owner column cannot carry a foreign key, so the row's parent would be unverifiable at the database level and every policy would need a discriminator branch. One table per bucket keeps each policy a direct mirror of its parent's policy — the same reason D6 splits the buckets.

**`source_group_id` is provenance only** (nullable, `on delete set null`). It records which template a group was copied from so the UI can say "fra Halaqa A"; nothing reads it for access control. `assignment_group_members` is the sole authority on who is in an assignment's group.

**Nullable-unique note:** Postgres treats NULLs as distinct in unique indexes, so `unique (assignment_id, student_id)` does not constrain group rows (whose `student_id` is null), and vice versa. Each unique constrains exactly its own kind of row — which is the intent.

**Audit triggers** (`private.audit_row_change`) on the student-data tables: `submissions`, `assignment_reviews`, `submission_attachments`, `assignment_group_members`. Not on `assignments`, `class_groups`, `assignment_groups`, or `assignment_attachments` — these are teacher-managed school structure, matching the `lessons`/`tests` precedent.

## 3. Group snapshot semantics (D1 — the mechanic that makes history immutable)

Creating a group assignment is a **copy**, executed in one transaction:

1. Teacher picks class + subject + due date, and selects one or more `class_groups` (or "hele klassen").
2. For each selected template, insert an `assignment_groups` row (`source_group_id` = template) and copy its current `class_group_members` into `assignment_group_members`.
3. From that moment the assignment's roster is frozen. Editing, renaming, or deleting the template later cannot alter it.

A class-wide assignment creates **no** `assignment_groups` rows at all; its roster is the class roster as-of `due_on`. `private.student_in_assignment` (§4) resolves both shapes, so every downstream policy and read asks one question regardless of targeting.

**Copy-time validation** (app-side, per D2): each copied group must land 2–4 members. A template that has drifted outside that range blocks assignment creation with a mapped Norwegian error naming the group — it does not silently truncate.

**Left-the-school case:** a pupil who leaves keeps their `assignment_group_members` row (history survives, matching `teaches_lesson`'s no-enrollment-filter precedent). Their `students.protected` flag still governs teacher reach through the existing `*_unprotected` helper family.

### 3.1 Assignment reuse (D10)

"Gjenbruk" opens the create form pre-filled from an existing assignment — the teacher's own, from **any** class and **any** term (the parallel-class and next-year cases are the whole point).

| Copied | Re-picked by the teacher | Never copied |
|---|---|---|
| title, instructions, `subject_id`, `submission_type`, **attachments** | `class_id`, `due_on`, targeting (hele klassen / which templates) | submissions, reviews, `assignment_groups`, `assignment_group_members` |

**Targeting is re-picked, not copied — deliberately.** A frozen `assignment_group_members` snapshot belongs to the assignment that froze it; resurrecting it would re-attach last year's pupils to this year's task and quietly violate D1. Re-picking runs the normal §3 copy against *today's* templates. Google Classroom also resets targeting on reuse; here it falls out of the design rather than being a wart.

**Attachments are physically copied**, not shared. Because the storage path encodes the parent's UUID (§5), one object cannot serve two assignments without breaking the path-based policy. Reuse therefore issues a server-side `storage.copy()` per attachment into the new assignment's folder, then inserts fresh `assignment_attachments` rows pointing at the new paths. Consequences the plan must handle:

- **Partial-copy safety:** the new assignment and its attachment rows commit only after every object copy succeeds; a failed copy rolls the whole reuse back and reports a mapped Norwegian error. A half-attached assignment must never be publishable.
- **Re-validation is unnecessary** — the source objects passed the MIME/size allowlist when first uploaded, and copying cannot change their bytes. The size cap is *not* re-applied, so a reuse cannot fail on a file that was legal when uploaded.
- **Storage cost is real:** reuse duplicates bytes. With video allowed at 50 MB, a heavily-reused assignment multiplies. Acceptable, and the honest alternative (shared objects) would cost the path-based security model.

## 4. RLS model (both walls; new helpers)

**Reused unchanged:** `has_role`, `is_staff`, `teaches_class`, `is_guardian_of`, `is_linked_student`, `teaches_student`, `taught_student_ever_unprotected`.

**New `private` helpers** — all `language sql stable security definer set search_path = ''`, each followed by `revoke execute … from public` + `grant execute … to authenticated`, per house rule:

| Helper | Answers |
|---|---|
| `teaches_assignment(uid, aid)` | caller teaches the assignment's class (mirrors `teaches_test`) |
| `student_in_assignment(sid, aid)` | **the pivot.** Group-targeted → student has an `assignment_group_members` row for a group of this assignment. Class-wide (no groups exist) → student on the class roster as-of `due_on`. |
| `guardian_sees_assignment(uid, aid)` | caller guardians a student for whom `student_in_assignment` holds |
| `student_sees_assignment(uid, aid)` | caller's linked student row satisfies `student_in_assignment` |
| `can_write_submission(uid, aid, agid, sid)` | the hand-in wall: caller is the pupil (or their guardian) **and** that pupil is in this assignment **and**, for a group hand-in, is a member of *that specific* `assignment_group` |

**Standing rule 1 (double-bind) applied.** Every write carrying a `student_id` binds the actor to the context *and* the student to the same context, at both walls:

- **Pupil hand-in:** `is_linked_student(uid, sid)` **and** `student_in_assignment(sid, aid)`.
- **Guardian hand-in on behalf** (master spec: `submitted_by` may be the guardian): `is_guardian_of(uid, sid)` **and** `student_in_assignment(sid, aid)`.
- **Group hand-in:** additionally the acting pupil must be a member of the *targeted* group — not merely of some group on the assignment. This is the Phase-2 C-1 lesson transposed: class membership alone must never authorise writing a specific group's row.
- **Teacher review:** `teaches_assignment(uid, aid)` **and** `student_in_assignment(sid, aid)`.

**Author pinning.** `submissions.submitted_by` and `assignment_reviews.reviewed_by` are pinned to `auth.uid()` in the INSERT policy's `with check`, per the Phase-3 rider precedent — a forged author would otherwise hand off delete rights wherever deletion is author-gated.

**Policy naming** follows the house convention `<table>_<verb>_<qualifier>`: `_select_related`, `_insert_pupil_or_guardian`, `_insert_teacher_or_admin`, `_update_teacher_or_admin`, `_delete_admin`. **DELETE stays admin-only** on every table in this phase — a mis-created assignment is edited, not destroyed — except `submission_attachments`, where the submitting pupil/guardian may remove their own file **before** a review exists (after review, admin only).

**Grant firewall** per table, unchanged from house pattern: `revoke all … from anon, authenticated, service_role`, then narrow `grant`s to `authenticated`, and `select, delete` only to `service_role` (retention/erasure).

## 5. Storage (D4, D6 — the new wall)

Two private buckets, created by migration:

```
assignments/{assignment_id}/{uuid}-{filename}
submissions/{submission_id}/{uuid}-{filename}
```

**Path shape is load-bearing:** the first folder segment is the parent's UUID, so a `storage.objects` policy resolves the owner with `(storage.foldername(name))[1]::uuid` and then calls **the same `private` helpers as the table policies**. One source of truth — a table policy and its bucket policy cannot drift apart.

```sql
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
```

**Rules:**

- **No public URLs, ever.** Downloads are short-lived **signed URLs minted only after a DAL check**, matching master spec §8's Storage line.
- **The UUID filename prefix is a security control, not cosmetics** — it stops one pupil overwriting another's object through a colliding filename, and stops a crafted filename escaping its folder.
- **MIME + size validated server-side** in the action, never trusting the browser: allowlist covers images, documents (PDF and office), audio, video; hard cap 50 MB. Rejections return mapped Norwegian errors.
- **Resumable (TUS) upload above 6 MB** — required by Supabase Storage, and the realistic path for audio and video from a phone.
- **Orphan discipline:** the attachment row and the object are written in that order, and a failed upload deletes the row. A row whose object is missing renders as a mapped error, never a broken link.

**GDPR note (feeds the Phase-7 DPIA):** audio and video of children are markedly more sensitive than a photo of a worksheet. Retention rules, the Art. 30 record, and the DPIA must name these two buckets explicitly, and erasure must delete objects, not merely rows.

## 6. Teacher flows

**Create (the sub-minute loop):** class → subject → title → due date → *hele klassen* or pick groups → optional attachment → publish.

**Reuse (D10, the prep-time loop):** «Gjenbruk» → pick one of your own past assignments → the form opens pre-filled (title, instructions, subject, attachments) → set class, due date and targeting → publish. The recurring-curriculum case, and the parallel-class case, both collapse to a few taps.

**The review loop** is the phase's hero, and the gap the demo currently has: the teacher opens an assignment and sees **every** pupil on the roster, not only those who handed in.

## 7. Surfaces (per role; "C · Familie" system, phone-first)

| Route | Role | Content |
|---|---|---|
| `laerer/oppgaver` | teacher | Assignment list across own classes; per-row `Ikke levert` count as the attention signal. Hosts both entry points: «Ny oppgave» and «Gjenbruk» (D10) — the reuse picker lists the teacher's own past assignments across all classes and terms, newest first, searchable by title. |
| **`laerer/oppgaver/[assignmentId]`** | teacher | **Hero.** Roster-complete: `Ikke levert 7 · Levert 12 · Vurdert 5` as a segmented count-row, where **the count is the navigation** — selecting one filters to those names. Group tasks show one row per group with its members; non-submitters are rows, never an absence. Per-pupil review inline. |
| `laerer/klasser/[id]/grupper` | teacher | Manage `class_groups` templates for the class (2–4 members each) |
| `elev/lekser` | student | Own assignments with derived status, hand-in form + attachment. Group tasks show group-mates and the shared hand-in. |
| `forelder/lekser` | parent | Child's assignments (switcher when several children), hand-in on behalf, own child's review only |
| `admin` | admin | One-glance oppgaver block; full oversight |

Norwegian vocabulary (demo-mined, keep consistent): *Oppgaver, Lekser, Frist, Levert, Ikke levert, Levert etter frist, Vurdert, Til vurdering, Gruppe/Grupper, Vedlegg, Innlevering, Godkjent, Ny innlevering.*

Design law unchanged: the locked "C · Familie" system (tokens `src/app/globals.css`, primitives `src/components/ui/`, `DESIGN.md` is the fasit). Status tones use `success`/`neutral`/`warning` — **never `danger` for a pupil's own standing**; `danger` stays for destructive controls. Print chrome (`print:hidden`) already handled by the shell.

## 8. Testing strategy (per §8 — TDD, tests-first, CI-gated)

**pgTAP** — new files `20`–`23`, fixture prefixes `b8`, `b9`, `ba`, `bb` (next free; `b7` is the last in use):

- `20_class_groups_rls.sql` — template CRUD walls; teacher-of-class only; cross-class denial
- `21_assignments_rls.sql` — assignment walls; `student_in_assignment` across **both** targeting shapes (group-targeted and class-wide-as-of-`due_on`)
- `22_submissions_rls.sql` — hand-in double bind; the **group-member-A ≠ group-B** denial; author pinning; per-pupil review isolation
- `23_assignment_storage.sql` — `storage.objects` policies per bucket, including cross-bucket and cross-assignment denial

**`tests/api`** — new files for the DAL guards and the actions (create/copy-groups, hand-in, review, upload validation), following the existing harness (`signInAsAAL2`, seeded fixtures, real local Supabase). **Reuse (D10) gets its own coverage:** a teacher may reuse only their *own* assignments (a foreign assignment id is a quiet not-found, not an error leak); attachments land at new paths under the new assignment; submissions/reviews/groups are demonstrably **not** carried over; and a forced copy failure leaves **no** half-attached assignment behind.

**Unit** — pure logic only: derived status from `due_on` + submission + review; group-size validation; MIME/size allowlist.

**Fine-derived regressions re-pinned in this domain** (standing rule 7): parent A ↛ child B's submission; teacher X ↛ class Y's assignment; exports omit `protected`; and one new to this phase — **the guardian of group member A must not reach the review of group member B**, even though both touch the same shared submission. That last one is the sharpest consequence of D3 and must be pinned at both walls.

## 9. Scope boundaries (explicitly deferred — do not build this phase)

- **Announcements/posts and their attachments** → Phase 5 (D5). The bucket pattern is established here; Phase 5 adds `announcements/`.
- **Pupil self-add to groups** → post-Phase-4, additive, no migration (D7).
- **In-browser audio/video recorder** — upload only. Pupils record with their phone's own app.
- **Rubrics, originality reports, grading periods, engagement telemetry** — Classroom features judged overkill or GDPR-adverse for a volunteer-staffed supplementary school.
- **Auto-zero / stored "missing" flag** (D8).
- No economy, no messaging threads, no i18n.

## 10. Open items (non-blocking)

1. **Ledger riders due this phase** (roadmap §3, assigned to Phase 4): `class_students` PK re-enroll block (surrogate key vs PK-including-date) **and** `status`↔enrollment decoupling — both **must land before the second enrollment wave**; plus teacher class-list term scoping (`listMyTeachingClasses` mixes terms once a 2nd term exists). These are schema decisions with their own risk; sequence them as early tasks so the assignment work builds on the settled shape.
2. **Points scale for `assignment_reviews.points`** — free integer, or bounded by a setting like the Phase-3 grade scale? Defaulting to free integer with app-side non-negative validation; revisit if teachers want a cap.
3. **Storage retention job** — objects must be deleted on erasure, not orphaned. Belongs to Phase 7 retention automation; this phase only guarantees cascade-safe rows and records the requirement.
4. **`npm audit` CI gate** was unsatisfiable at spec time (no fixed `next` release exists; 7 of 12 findings need the deferred ESLint 10 major). Being reworked separately — production-scoped audit plus a dated exception list — so that by the time Phase 4 opens its PR, a red audit step means something again. If that work has not landed, do not diagnose the red step as a code defect.
5. **Storage cost ceiling** — D10 duplicates attachment bytes on every reuse and D4 permits 50 MB video. No quota exists yet. Worth a settings-driven per-class or per-term ceiling before pilot; not needed to build the phase.

## 11. Task shape (input to writing-plans)

Suggested decomposition, one commit per task, security-review lens on 2–6:

1. Ledger riders (§10.1) — enrollment schema decisions, ahead of everything else
2. `class_groups` + members: migration, firewall, policies, pgTAP 20
3. `assignments` + `assignment_groups` + members: migration, `student_in_assignment` and friends, pgTAP 21
4. `submissions` + `assignment_reviews`: XOR CHECK, double-bind policies, author pinning, pgTAP 22
5. Storage buckets + `storage.objects` policies + attachment tables, pgTAP 23
6. Upload/signed-URL server helpers (MIME + size + resumable), `tests/api`
7. DAL reads — assignment lists, the roster-complete view, per-role fremdrift
8. Actions — create+copy-groups, hand-in, review, attachment add/remove
9. Reuse (D10) — own-assignments picker read, the copy action incl. `storage.copy()` with all-or-nothing rollback
10. Teacher UI — list, hero roster screen, review inline
11. Teacher UI — «Gjenbruk» picker + pre-filled create form
12. Teacher UI — class group templates
13. Pupil + parent UI — hand-in, on-behalf, group-mates
14. Admin block + role-nav updates
15. Exit gate — full suite, design audit (`web-design-guidelines`), browser verification per role
