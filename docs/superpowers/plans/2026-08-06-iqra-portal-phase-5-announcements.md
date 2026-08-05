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

**Verified 2026-08-06:** highest existing file is `36_thread_counterparts.sql`, and **`c0` appears nowhere under `supabase/`** — tests, migrations or seed (`grep -rl "c0000000-0000" supabase/` returns nothing). `c1`, `c2`, `c3` are free too.

⚠ The prefix inventory in the first draft was incomplete — it listed `00, 11, 22, 44, 66, a5–a9, aa, ad–af, b1–bc, bd, be, bf, cc, cd, ce, f6, f8, f9, fb, fc, fe` and **omitted `33, 55, 77, f1–f5, f7, fa`**. The conclusion survives (none of the omitted ones is `c0`), but do not treat that list as the census. The grep above is the census, and it takes a second.

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

## ✅ THREE DECISIONS TAKEN — 2026-08-05, by the user

A **third** review panel ran over this document after the two rounds in the
ledger at the bottom, with the three lenses those rounds named as missing:
escalation · assertion vacuity · repo integration. It found three things that
were **product decisions rather than defects** — each proved by executed SQL
against the live database, on this plan's own fixture. **All three were put to
the user on 2026-08-05 and all three are now closed.** The executed proof is
kept under each one, because it is *why* the decision was needed.

⚠ **These were decided BEFORE execution, which is the whole reason they were
cheap.** Plan 1 could only pin its open decisions with an assertion because its
code was already running. Nothing here is built yet, so each answer below is
written into the migration, the fixture and the assertions **before** anything
is assembled around it — one conjunct in one policy, one `case` in one
projection, and the witnesses that stop either being deleted later.

| | question | answer | what moved |
|---|---|---|---|
| **D-A** | a protected pupil the caller no longer teaches is **named** by `announcement_read_status` | **gate the name, keep the row** | `20260806121000` select list · §H fixture +2 pupils · assertions 49, 50, 51, 64 · Task 4 mutations 15–18 |
| **D-B** | a school-wide announcement reaches **every role-holder**, and nothing revokes a role until plan 4 | **bound it to live enrolment ∪ staff ∪ economy** | `reads_announcement_row`'s `cls is null` arm · assertion 10 **flipped** · assertions 11, 18 added · Task 1 mutations 25–28 |
| **D-C** | a **published** announcement is freely rewritable by its author | **accept — a typo must be fixable** | no code change; A2 and «leaves broken» now say read-tracking means read-of-*a*-version |

### D-A — the protected pupil: **gate the name, keep the row** (was OD-1, HIGH)

> **The user's words:** *"this school does not have a protected student. if this isnt bound by law, just remove it."*

**The answer given back, which they did not contest:** the feature is **not**
legally mandated, but Norwegian *beskyttet identitet* (kode 6/7) makes the
underlying obligation real, and it arrives without warning — a pupil is flagged
between one week and the next. The mechanism already exists, is CI-green, and
costs nothing while no pupil carries the flag. **So nothing is removed.**

⛔ **The removal question is DEFERRED as its own scoped task, not folded into
this plan.** Removing `protected` wholesale would mean surgery on shipped,
CI-green Phase-4 code — `20260721120712_attendance_visibility.sql` (the
`students_select_taught_ever` policy's `and protected = false`) and
`20260803001000_protected_mate_omission.sql` (the mate-name projection's `and
not s.protected`), plus their pgTAP coverage — and it is exactly the kind of
change that looks like a deletion and behaves like a policy rewrite. Whoever
picks it up: it is a separate task with its own review, and **this plan removes
nothing**.

**What was decided instead:** in `announcement_read_status`, when the pupil is
`protected` **and** the caller is neither admin nor still teaching her, return
the Norwegian placeholder **«Skjermet elev»** instead of the name — **and keep
the row**, so the read-tracking denominator stays correct.

```sql
case
  when s.protected
   and not (private.has_role((select auth.uid()), 'admin')
            or private.teaches_student((select auth.uid()), s.id))
  then 'Skjermet elev'
  else s.first_name || ' ' || s.last_name
end
```

⚠ **It is a two-arm mirror of a four-arm policy, and the two it drops fail
CLOSED.** `students_select_related` also admits `is_guardian_of(uid, sid)` and
`student_user_id = uid`. Neither can be a *caller* here — the projection is
bound by `private.writes_announcement`, i.e. admin or the class's current
teacher — with one reachable exception: **a teacher who still teaches the class
and whose own protected child has left it** would read «Skjermet elev» for her
own child. The seed has exactly that shape of account (`laererforelder@`), so it
is not hypothetical, only rare. It withholds a name from someone entitled to it
rather than disclosing one, and closing it means a third conjunct with a third
fixture actor and a third mutation. **Recorded rather than built** — if a
teacher-parent ever reports it, `or private.is_guardian_of((select auth.uid()),
s.id)` is the one-line fix and it needs its own witness.

★ **The admin arm is in the gate deliberately, and it is not what a literal
reading of the decision would produce.** `students_select_related` is
`has_role(admin) or teaches_student(…) or is_guardian_of(…) or student_user_id
= uid`, so **admin already reads every protected pupil's row by name**. Gating
admin would withhold from the office the one list read-tracking exists for —
«hvem ringer vi» — while withholding nothing from anybody, since admin can open
the pupil's own page in the next tab. The gate mirrors what `public.students`
would already disclose **to that caller**, which is the only shape that buys
privacy rather than inconvenience. Assertion 64 is its witness.

⚠ **What this does NOT close, said out loud.** The row survives, so a teacher
who no longer teaches the class still learns that *one of the pupils on that
as-of roster is protected* — and still receives her `student_id`. That is
strictly less than the name, and strictly more than `students_select_taught_ever`
gives her today. The alternative — omitting the row, which is what
`20260803001000` does for the **cross-family** mate list — was rejected here
because it breaks the denominator, and the denominator is the number the office
acts on. Recorded in «what this plan deliberately leaves broken».

**The witness was fixed too, and that is half of this decision.** See «the
executed proof» below: the fixture's protected pupil is on the **live** roster,
which pins only the safe case. §H now carries **three** pupils in one story —
a protected pupil the teacher still teaches (named), a protected pupil who has
**left inside the as-of window** (placeholder), and an **ordinary** pupil who
left on the very same day (named). The ordinary leaver is the control that
isolates the whole delta to `protected`; without her, the placeholder could be
explained by the leaving.

#### The executed proof — why this decision was needed at all

`public.students` carries two SELECT policies, verified directly against
`pg_policy` on 2026-08-05:

- `students_select_related` → `has_role(admin) or private.teaches_student(uid, id) or is_guardian_of(…) or student_user_id = uid`, and `teaches_student` is **live** (`cs.left_on is null`);
- `students_select_taught_ever` → `private.taught_student_ever(uid, id) **and protected = false**`.

So the house rule is: a teacher sees her **current** roster including protected
pupils, and the **historical** roster of her classes **only for non-protected**
ones.

`announcement_read_status` returns the **as-of** roster, binds on
`private.writes_announcement` (a *write* authority, live `teaches_class`), and
applies **no `protected` filter** — by design, that is A4.

Proved in a rolled-back transaction against this plan's own file-37 fixture,
with «Skjermet» given a `left_on` twenty days **after** the publication day —
so she was enrolled when the notice went out and has since left — and the
class's own teacher as the actor:

| | rows |
|---|---|
| `public.students` row for the **protected** departed pupil | **0** — the policy refuses |
| `public.students` row for an ordinary departed pupil (control, «Sluttet») | **1** — `taught_student_ever` admits |
| `announcement_read_status` for the same teacher | **all three, «OP Skjermet» by name** |

The control is what makes it precise: `taught_student_ever` has no temporal
bound at all, so for **non-protected** pupils the projection discloses nothing
the teacher could not already read. **The entire delta is the protected pupil.**

A4's justification — "the people who already see the pupil on their roster" —
is true of the **live** roster and false of the **as-of** roster, which is the
one this function uses.

⚠ **Provenance, because an earlier note in this project got it wrong.** The
`protected = false` clause is
`supabase/migrations/20260721120712_attendance_visibility.sql:79-84`, dated
**2026-07-21 — fifteen days old**, added under D3 with the comment "Protected
students stay teacher-visible only while actively enrolled".
`20260803001000_protected_mate_omission.sql` is a **different** change (the
mate-name projection's `and not s.protected`). The substance is unaffected;
only the age is.

⚠ **The A4 witness was blind to the unsafe half.** In the fixture as first
written, «Skjermet» has `left_on = null`, so she is on the **live** roster and
the A4 assertion pinned only the safe case.

**How the fixture was fixed — and why not by moving «Skjermet».** Giving *her* a
`left_on` would have closed the blind spot and opened another: with no
protected pupil left on the live roster, `private.teaches_student` could be
deleted from the gate and **nothing would redden**. So §H keeps her where she
is and adds two pupils in the same class, both enrolled D−90 and both departing
at **D+20** — inside `…041`'s as-of window, outside `…045`'s, and outside the
live roster `teaches_student` asks about:

| pupil | `protected` | in `…041`'s as-of roster | still taught | `display_name` to her teacher |
|---|---|---|---|---|
| `…035` «OP Skjermet» | **true** | yes | **yes** | `OP Skjermet` — assertion **49** |
| `…037` «OP Vernet Sluttet» | **true** | yes | no | **`Skjermet elev`** — assertion **50** |
| `…038` «OP Ordinaer Sluttet» | false | yes | no | `OP Ordinaer Sluttet` — assertion **51** |

Each of the gate's three parts therefore has exactly one witness, **measured**:
deleting the whole `case` reddens **50 alone**; dropping `s.protected` reddens
**51 alone**; dropping `private.teaches_student` reddens **49 alone**; dropping
the admin arm reddens **64 alone**. Task 4 mutations 15–18.

⚠ **And the two new pupils move two counts, which is the cost of the decision:**
§H's class roster goes **3 → 5** and the school-wide roster **4 → 6**. `…045`'s
batch count stays **4** — both new pupils left ten days before it was published,
which is the same fact that makes them untaught.

### D-B — school-wide reach: **bounded to live enrolment ∪ staff ∪ economy** (was OD-2)

> **The user chose to bound it** rather than accept unbounded reach.

⚠ **The framing below is partly stale and is kept as the proof, not as the
description.** A15 landed between the panel and the decision, so the arm was
already narrowed from *every authenticated account* to *every account holding a
`user_roles` row*. What A15 did not close is the residual: **nothing revokes a
role until plan 4**, so a departed family keeps its `parent` row and keeps
reading. The live-enrolment requirement on the family arm is what closes that.

**What was decided.** `cls is null` now means: the adults who work here, plus
the families who are still here.

```sql
(cls is null
 and (
   exists (select 1 from public.user_roles ur
            where ur.user_id = uid
              and ur.role in ('admin', 'teacher', 'economy'))
   or exists (select 1 from public.class_students cs
                join public.guardian_student gs on gs.student_id = cs.student_id
               where gs.guardian_id = uid and cs.left_on is null)
   or exists (select 1 from public.class_students cs
                join public.students s on s.id = cs.student_id
               where s.student_user_id = uid and cs.left_on is null)
 ))
```

★ **`economy` is named, because D17 puts it in school-wide announcements and out
of class ones** — it holds no enrolment, so the family arms could never admit
it. `admin` is in the list for self-containment even though the predicate's
first arm already short-circuits for admin; a clause whose correctness depends
on a short-circuit three lines above it is a clause the next reader deletes.

★★ **`left_on is null` is the HOUSE's live spelling, and choosing it rather than
a true as-of-today test is a decision inside a decision.** `private.guardian_in_class`
is `… where cs.class_id = cid and gs.guardian_id = uid and cs.left_on is null`
— it never looks at `enrolled_on` at all (A14 records this, and it is why plan
1's thread tests pass over a seed whose enrolments all start on 2026-08-20).
Spelling it the same way here buys two things and costs one:

- **buys** byte-consistency with the eight existing sites, so «still at the
  school» means one thing in this repo rather than two;
- **buys** a school-wide surface that is not empty out of the box — every
  seeded family is `left_on is null` today, so Task 10's walkthrough and the
  parent/pupil lists work **without** A14's enrolment window. Only the *class*
  arm needs it;
- **costs** admitting a family whose enrolment starts next month. Assertion 08
  is that family, and it is now a **witness for this choice** rather than a
  bare session control.

⚠ **What changed in the assertions, and it is the opposite of what they used to
say.** Assertion **10** asserted a **departed** guardian reading the school-wide
notice. It now expects **0**, and is the witness for the bound. Assertion **08**
(the *not-yet-joined* guardian) stays **1** — she is live by the house spelling.
Two assertions were added: **11**, the same departed family still reading the
**class** notice published while they were enrolled (D9's as-of arm is
untouched, and that asymmetry is the decision's whole shape), and **18**, a
pupil reading the school-wide notice on her **own login**, without which the
pupil arm of the new guard could be deleted with the file green.

⚠ **A3 is fixed rather than re-explained** — see A3 below. The sentence «the
denominator is the same set the read predicate admits» is still false, and now
false in a *different* way: the denominator is the as-of **pupil** roster and
the audience is the **live** family set plus staff. A3 says exactly where they
diverge instead of implying they converge.

#### The executed proof — what «holds any role» actually admitted

`cls is null` short-circuits before any membership test. A15 already narrowed
that arm from *every authenticated account* to *every account holding a
`user_roles` row* — the role-less account is its witness (assertion 17 at the
numbering of the time, **19** today) and mutation 15 is what proves the clause
carries weight. What A15 does **not** close is the other half of the same
measurement:

| actor | class notice today | school-wide today |
|---|---|---|
| a family that left the class 30 days ago | **0** (D9 correct) | **1** |
| an account with a profile and no role at all | — | **0** *(closed by A15)* |

**Offboarding does not exist until plan 4**, and nothing in Phase 5 revokes a
role. So **every account that has ever been given a role keeps receiving
school-wide notices for as long as it exists** — the departed family included.

⚠ **This was already asserted as correct, twice, without ever being named.**
Assertions 08 and 10 used a not-yet-joined and a **departed** guardian as
school-wide *session controls* — the suite pinned the behaviour while the plan
never discussed it. That is what the decision above reverses for 10 and
deliberately keeps for 08.

⚠ **And it sharpens A3.** For `class_id is null` the read-tracking denominator
is the **as-of pupil roster across all classes** while the audience is a
different set entirely. A3 already recorded that the denominator is not the set
the read predicate admits, for a different reason (the projection counts
*pupils*, the predicate admits *users*). The school-wide case is the sharper
instance, and bounding the audience does **not** make the two sets agree — it
narrows the audience while the denominator stays as-of. A3 now says so.

### D-C — editing after publication: **accepted, and documented** (was OD-3)

> **The user's decision:** keep editing open. A school needs to fix a typo or a
> wrong time after sending, and taking that away to protect a version history
> nobody can read is a bad trade.

**No policy changes.** `announcements_update_author` keeps its two conjuncts and
no publication-state bound. What changes is that the consequence is now written
down in three places instead of nowhere: **A2**, «what this plan deliberately
leaves broken», and this entry.

**Read-tracking therefore means read-of-*a*-version.** An `announcement_reads`
row records that a family opened *that announcement*, not that they read the
words it says now. The author may rewrite `title` and `body` after publication
and the read rows survive, so «12 av 28 har lest» can be true of text 12 people
never saw.

**And the audit log cannot recover the difference.** `audit_row_change` records
ids and changed column **names** only (`20260717164230:139-168`), so the log
says *an edit happened, to `title` and `body`, by this person, at this time* and
can never say what the previous text was. That is a deliberate house rule about
never copying content into the audit table, not an oversight — and it is the
reason this decision has to be recorded rather than merely allowed.

⚠ **The one thing to build if this ever bites:** a version row, not a policy
bound. Locking the update after publication would make `title`/`body`'s UPDATE
grants dead for every published row and leave withdraw-and-rewrite — which
destroys the read rows too — as the only way to fix a typo.

#### The executed proof — what «freely rewritable» actually means

`announcements_update_author` carries **no publication-state bound**;
`announcements_delete_own_unpublished` carries `published_at > now()`. A2
justified the delete bound at length and never mentioned the update.

Proved on the fixture: the author of a five-day-old **published** announcement,
which a family had already read, rewrote both `title` and `body` in one
statement — and the family's `announcement_reads` row **survived**, so
read-tracking still asserts they read it. `audit_row_change` records ids and
changed column **names** only (`20260717164230:139-168`), so the prior text is
unrecoverable. The migration justifies `on delete restrict` with "an
announcement is a record of what the school told a family" — and that same
record is rewritable at will.

★ **The proof is what makes the acceptance honest rather than lazy.** The
alternative was one conjunct in one policy; it was measured, costed, and turned
down on product grounds by the person who runs the school, not skipped because
nobody looked.

---

## The decisions this plan makes, and why

The spec left these open, contradicted itself, or is contradicted by the tree. Each is decided here, once, so no task has to invent it.

### A1 — `published_at` is client-writable at INSERT. **Both** directions are bounded, by two CHECKs rather than by a grant.

**The contradiction.** Spec D8 buys scheduled publishing from `published_at <= now()` ("publiser lørdag 07:00"), §7 gives `admin/oppslag` "scheduling", and §11 3b is the scheduled-publish fan-out — while §2.2 says `published_at` is "server-defaulted and ungrantable" and T-19 asserts `has_column_privilege(…,'published_at','INSERT') = false`. **Both cannot be true: with no INSERT grant there is no way to set a future publication time, and scheduling is unbuildable.**

**The decision.** `grant insert (… published_at …)`, and add **two** constraints:

```sql
constraint announcements_not_backdated check (published_at >= created_at),
constraint announcements_schedule_bound check (published_at <= created_at + interval '120 days')
```

`created_at` is `not null default now()` and is **not** granted, so it is always the true insert instant. Together they say: *an announcement may be scheduled forward, by at most about a term, and never back-dated.* **`published_at` remains ungrantable at UPDATE** — T-19's UPDATE half stands unchanged.

⛔ **The first draft of this plan said "forward is the feature; backward is the only direction that changes who reads". That sentence is FALSE, and it was written into a migration comment before the review panel measured it.** D9 is why. Executed against the live database:

| | published now | published at `now() + 90 d` |
|---|---|---|
| a guardian enrolled today, `left_on` in 30 days | reads it | **does not** |
| a guardian who joins in 60 days | does not | **reads it** |

Choosing `published_at` selects a **different set of families in both directions**. A teacher of class A can, in a single INSERT, address families she cannot address today and may never meet — and (measured) she **cannot take it back**: once she leaves the class her scheduled row still SELECTs through the `author = uid` arm, while her DELETE filters to zero rows. Back-dating is not "the dangerous direction"; it is merely the direction that reaches families who have **left**, i.e. the one nobody can fix by waiting.

Which is why forward needs a bound too — with none, an admin's `published_at = '2999-01-01'` was accepted. And why A2 drops `writes_announcement` from the withdraw policy: the author must be able to remove her own unpublished row after she stops teaching the class.

★ **`120 days` is a PRODUCT decision as much as a technical one, and the school may revisit it.** It is a little over one term, so «publiser første skoledag etter jul», chosen in September, still fits — while an announcement scheduled beyond the horizon in which the roster is recognisable is refused at INSERT instead of delivered to strangers. If IQRA wants a school year, change the interval **and** the zod bound in `src/lib/validation/announcements.ts` together: they are one rule in two layers, and only the zod half produces a sentence the teacher can act on. If IQRA wants no bound at all, record that in the ledger rather than deleting the line, because the table above is what the bound buys.

**What changes in the spec's test list.** T-19's INSERT half becomes a *behavioural* pair of assertions — a past `published_at` raises **`23514`**, a 200-day one raises `23514`, and a one-day-forward one lives — which is strictly stronger than the privilege probe it replaces, because the privilege probe could not distinguish the directions at all.

⚠ **Consequence the action must handle:** for an *immediate* publish the client must **omit** `published_at` and let the default fire. Sending a client-computed `now()` races the server's by milliseconds and yields a `23514` on a legitimate publish.

### A2 — A scheduled announcement cannot be rescheduled. Its author may withdraw it.

`published_at` has no UPDATE grant (A1), so a mis-scheduled announcement cannot be moved. Postgres RLS cannot express "this column is editable only while the row is unpublished" — column-level authorization is the **grant** layer, and grants have no predicate.

Rather than add a BEFORE UPDATE trigger for it, this plan adds a second DELETE policy:

```sql
create policy "announcements_delete_own_unpublished" …
  using (created_by = auth.uid() and published_at > now())
```

A not-yet-published announcement has been read by nobody by construction, so withdrawing it destroys no record. A **published** one stays admin-delete-only, which is the spec's rule. Reschedule = withdraw and re-create.

⚠ **The UPDATE policy has no matching bound, and that is D-C — decided by the user on 2026-08-05, not an oversight.** `announcements_update_author` lets the author rewrite `title` and `body` after publication, on purpose: a school must be able to fix a typo or a wrong time in a notice it has already sent. Two consequences follow and both are load-bearing:

- **Read-tracking means read-of-*a*-version.** `announcement_reads` records that a family opened the announcement, not that they read the words currently in it. Measured: an already-read published row was rewritten in one statement and every read row survived, so «12 av 28 har lest» can be true of text those twelve never saw.
- **The audit log cannot supply the difference.** `audit_row_change` writes ids and changed column *names* only (`20260717164230:139-168`), so it records *that* `title`/`body` changed, by whom and when — never the previous text. The fix, if this ever bites, is a version row; it is **not** `and published_at > now()` on the update policy, which would make the `title`/`body` grants dead for every published row.

⚠ **`private.writes_announcement(…)` is deliberately NOT a third conjunct here, and that is a change the review panel made to this plan.** Measured: with it, a teacher who schedules an announcement and then stops teaching that class can still *see* the row (the `author = uid` arm of the read predicate) but her `delete` filters to zero rows — the withdraw path A2 promises evaporates exactly when it is needed, and only an admin who happens to notice can remove it. `created_by = auth.uid() and published_at > now()` is already strictly narrower than the insert wall it mirrors: nothing reaches `created_by = <you>` without having passed `announcements_insert_staff` first, and nobody has read it. Do not "restore" the conjunct for symmetry with the update policy.

### A3 — The read-tracking denominator is the as-of **roster of pupils**, not the live roster — and not the set the read predicate admits either.

«12 av 28 har lest» computed over today's roster counts families that `reads_announcement_row` refuses to show the row to. So the denominator is the roster **as of `published_at`**.

⛔ **What it is NOT, corrected by the review panel: "the same set the read predicate admits".** That sentence was in this plan's first draft and it is false. The projection counts **pupils**; the read predicate admits **users**. Measured against the live fixture: of the three pupils the projection returns for the class announcement, one — «Skjermet», this plan's own A4 witness — has `student_user_id is null` **and** no `guardian_student` row, so *no user at all* is admitted on her account and her `has_read` can never become true. **«0 av 3» can never reach 3 av 3**, and the office is told to phone a family that has no account.

The fix is not to drop her (A4 explains why not) but to **say so**: the projection carries a fifth boolean, `reachable`, and `ReadStatus.tsx` renders «ingen pålogging» beside a name that will never clear. The denominator stays the roster — that is the number the office acts on — and the list stops lying about what a name in it means.

⚠ That fifth column is why `pg_get_function_result` in §H's return-shape assertion expects five columns, not four. The assertion exists to notice exactly this kind of shape change; it was updated **deliberately**, in the same commit as the column.

⚠ **CORRECTED 2026-08-05, then narrowed by D-B — and here is exactly where the two sets still diverge, because «they are the same set» is the sentence this paragraph exists to stop being written again.** For `class_id is null`:

| | the **denominator** (`announcement_read_status`) | the **audience** (`reads_announcement_row`) |
|---|---|---|
| unit | **pupils** | **users** |
| families | enrolled **as of `published_at`**, in any class | enrolled **now** (`left_on is null`) — D-B |
| staff | none — a teacher is not on a roster | every `admin`/`teacher`/`economy` account |
| measured on the fixture | **6** pupils (assertion 63) | **12** of 14 accounts — 1 admin + 3 teachers + 1 economy + 5 of 6 guardians + both pupils; the two refused are the departed family and the role-less account |

So the denominator is neither a subset nor a superset of the audience, and D-B did not change that — it changed *which* families are in the audience. Concretely: a family that left last month is **in** the denominator of a notice published while they were here (correct — the office may still need to phone them about it) and **out** of the audience for anything published today. A teacher is in the audience of every school-wide notice and in no denominator at all. «12 av 28» counts pupils the notice was *for*, which is the number the office acts on; it was never a count of who can open the row, and the `reachable` column is what stops the list lying about the difference.

### A4 — Protected pupils are **included** in the read-tracking list and the denominator is **not** reduced (this reverses spec §7) — but the NAME is gated (D-A).

§7 transposes the 2026-08-03 mate-name rule onto this list. The transposition is wrong, and the tree says so in two places:

- `20260717164230:4-6` — *"protected («skjermet») deliberately changes NO policy in this phase: every teacher/admin/family read that exists today already applies to protected students (own teacher's roster + admin + the child's own family…)"*.
- `20260803001000:29-31` — *"«Skjermet» stays the staff-only term on the six staff surfaces that use it. **Staff are entitled to know a child is protected; other families are not**, in any wording."*

The mate-name omission is a **cross-family** rule: it stops a parent learning that another family's child is under protection. The read-tracking list is reachable only through `private.writes_announcement`, i.e. **admin or that class's own teacher** — the people who already see the pupil on their roster and already see the «Skjermet» marker. Omitting the row there hides from the office precisely the family it most needs to phone, and buys no privacy from anyone.

**Pinned by a witness assertion** (a protected pupil is present in `announcement_read_status` for their class's teacher) so nobody "fixes" it back on the strength of §7's sentence.

⚠ **The witness pupil is also the unreachable one** (no login, no guardian account — see A3), so that single assertion cannot by itself distinguish "protected pupils are included" from "pupils nobody can reach are included". The mutation that adds `and not s.protected` still reddens it, so the assertion works; the fixture just conflates two properties. The `reachable` column and its own two assertions separate them.

⚠ **CORRECTED 2026-08-05, and then CLOSED by D-A.** The original witness pinned only the SAFE half: «Skjermet» has `left_on = null`, so she is on the teacher's **live** roster, where `students_select_related` already shows her. The disclosure this projection actually added was the **departed** protected pupil, whom `students` refuses (`students_select_taught_ever` carries `and protected = false`) and this function named in full.

★ **So A4 is now two rules, not one, and the split is exactly where the existing policies split.** The **row** is included unconditionally — the denominator is the office's number and dropping a pupil from it is what §7 would have cost. The **name** is gated: `case when s.protected and not (has_role(admin) or teaches_student(uid, s.id)) then 'Skjermet elev' else … end`, so the projection discloses exactly what `public.students` would already disclose to that caller and not one pupil more. A teacher reading her *current* roster sees no change at all; a teacher reading the roster of a class she has left sees «Skjermet elev» where she used to see a name; admin sees everything, because admin already does. §H carries four witnesses (49, 50, 51, 64) and Task 4 mutations 15–18, each reddening one of them alone.

### A5 — The read-tracking unit is the pupil (the family), not the user.

A read counts if **any** of the pupil's guardians, or the pupil's own login, has an `announcement_reads` row. Counting users would put a two-guardian family twice in the denominator and send the office chasing a parent who has already read.

⚠ **Both arms need a witness, and the first draft had neither.** The fixture's only read row belonged to a guardian, so deleting the `ar.user_id = s.student_user_id` arm reddened nothing at all; and no fixture pupil had two guardians, so the «exactly one FAMILY» count could not tell per-family from per-user counting. §G therefore records a read as a **pupil's own login** as well, one pupil carries **two** guardians, and §H asserts the pupil-login arm by name.

### A6 — Read-tracking covers school-wide announcements too.

Same function, one extra clause: for `class_id is null` the roster is every pupil with an as-of enrolment in **any** class at `published_at`. The school-wide case is the one where "who has not seen it" is most valuable, and it is one `or` rather than a second function.

⚠ **CORRECTED 2026-08-05 — that clause had no assertion at all.** Every §H call passed a *class* announcement, so `a.class_id is null or` could be deleted from the roster lateral with **every other §H assertion green** (measured: the class-notice numbers do not move by one row, and the school-wide roster goes to **0**). §H now calls the projection as **admin** on the school-wide id and expects **6** (assertion 63), with mutation 12 behind it. Note what the number means, though: it is the **pupil** roster as of publication, and D-B bounded the *audience* to live families plus staff — so the two sets differ in both directions. The A3 table says exactly how.

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

The parameters are named `cls`, `pub`, `author` rather than `class_id`, `published_at`, `created_by`. `pg_get_functiondef` renders the parameter list, so a fingerprint marker matching a **bare parameter name** is satisfied by the header regardless of the body — that is finding F1 from plan 1's panel, where the marker `'kind'` became unfailable the moment `kind` was a parameter.

⚠ **CORRECTED 2026-08-05 — the rationale this paragraph used to give was backwards, and it is worth knowing which way round it goes.** The old wording said that renaming these three parameters to `class_id`/`published_at`/`created_by` would make three fingerprint markers **vacuous while still reporting green**. Measured: all **34** markers (26 at the time; D-A and D-B added eight more, and the probe was re-run on 2026-08-05 with the same answer) matched against the function **header only** return **0 rows**. Every marker in this plan is dot-qualified (`private.has_role`, `cs.left_on`, `private.teaches_student`), operator-bearing (`cls is null`, `pub <= now()`, `ur.role in`) or a string literal (`Europe/Oslo`) — **not one is a bare parameter name**, so none can be satisfied by a header. Renaming `cls` → `class_id` makes `'cls is null'` match **nowhere**, and file 29 goes **red**: loud and safe, not silently green.

So: **the operators are what keep these markers non-vacuous; the parameter names are incidental.** F1's hazard is real but specific to bare-word markers, and this plan has none. Keep the names — a marker one refactor away from being a parameter name is a marker one refactor away from F1 — but do not write a fingerprint that *depends* on them, and do not tell the next engineer that a rename would pass silently.

### A11 — A read is recorded in the DAL, on the read, for every reader.

The house precedent is `adminListAuditLog` (`src/lib/admin/audit-log.ts:27`) and `admin.threads.viewed` — a GET that writes, because the write **is** the record of the read. No client component, no extra server action.

Recorded for staff too, deliberately: one code path with no role branch to forget, and `announcement_read_status` derives the family signal from a guardian/login join, so a teacher's row is inert.

### A12 — Refusals are asserted by EFFECT, never by `throws_ok`, for DELETE and UPDATE.

Measured in plan 1: a guardian's refused DELETE returns `OK rows=0` — **DELETE refusals under RLS are filtered, not raised**, and an UPDATE whose `using` excludes the row is likewise a no-op. Assert the survivor count or the unchanged column. `throws_ok` is correct only for INSERT (`with check` raises) and for grant refusals.

### A13 — `okonomi` gets no announcement surface in this plan.

D17 includes economy in school-wide announcements, and the policy does admit them (`cls is null` admits any authenticated user **who holds a role** — see A15). But `src/app/(portal)/okonomi/` is `layout.tsx` + `page.tsx` + `error.tsx` with **no nav component**, so there is nowhere to put a route without inventing one. The policy is right; the surface is missing. Recorded in «what this plan deliberately leaves broken».

### A14 — ★★ **NO SEEDED FAMILY IS IN ANY CLASS AS OF TODAY.** Tasks 8–11 must open an enrolment window before they can see anything.

Two independent review lenses found this, and it is the single most expensive fact in the plan. Measured 2026-08-06 against the live seed:

```
 class    | student  | enrolled_on | left_on | in as-of roster now
 Klasse 1 | Yusuf    | 2026-08-20  |         | f
 Klasse 1 | Bilal    | 2026-08-20  |         | f
 Klasse 3 | Amira    | 2026-08-20  |         | f
 Klasse 3 | Zaynab   | 2026-08-21  |         | f
```

`current_date` is `2026-08-05`. **Every seeded enrolment starts fifteen days from now**, so for an announcement published *now* the as-of roster is empty and every family-facing and read-tracking outcome in Tasks 8–11 is empty with it.

**Why nothing in the repo caught it.** All eight existing `enrolled_on <=` sites resolve against a *lesson / test / assignment* date, which the seed puts inside the term. The two live helpers `private.guardian_in_class` / `student_in_class` filter `left_on is null` only and never look at `enrolled_on` at all — which is why plan 1's thread tests pass over the same seed. **The two helpers this plan adds are the first in the repo anchored on `now()`.** pgTAP 37 is unaffected: its fixture is hermetic and `now()`-relative.

**What it breaks if ignored:** `tests/api/announcements.test.ts` — "the read records itself" gets `null` from `getAnnouncement` and fails `resolves.not.toBeNull()`; "read-tracking is staff-only" throws `TypeError` on `.get(id)!.length` because the Map has no entry; and the scheduling test's «a family cannot read it» assertion passes **vacuously** — it would pass with the `pub <= now()` conjunct deleted, which is the one assertion in that file whose whole job is to notice that deletion. Plus Task 8 step 8 item 6, Task 9 step 4 items 1–2 and Task 10 step 6 item 5, none of which a human can perform.

**The decision: open the window in the test / the walkthrough, do not move the seed.** `tests/api/school-actions.test.ts:1105` asserts `enrolled_on === '2026-08-20'` verbatim, and `assignments-core.test.ts:423`, `assignments-actions.test.ts:269,310` and `attendance-core.test.ts:127` all key off the same dates. Task 11 back-dates Klasse 1's two enrolments through the scaffolding service client in `beforeAll` and restores them in `afterAll`; the walkthroughs tell the human to do the same by hand, once.

⚠ **It must be an UPDATE of `enrolled_on`, never an extra row.** `class_students_one_active` is `UNIQUE (student_id) WHERE (left_on IS NULL)` (a partial unique *index*, so it does not appear in `pg_constraint`), so a second open enrolment for the same pupil raises `23505`.

### A15 — `cls is null` means "everyone **still at the school**": the staff roles, plus the families of a pupil who is currently enrolled. **Superseded in part by D-B.**

The first draft's comment said the school-wide arm *"deliberately does not consult uid at all"*. Measured: that admits **any** authenticated account, including one with a `profiles` row and **zero** `user_roles` rows. `private.handle_new_user` is `AFTER INSERT` on `auth.users`, so every auth user gets a profile, while roles are assigned separately — and revoking a role leaves the account intact. `src/proxy.ts:93-102` gates on `user_roles`, but PostgREST is reachable directly with any valid session (`NEXT_PUBLIC_SUPABASE_*` ships in the browser bundle), so `requireRole` is **not** the wall. A created-but-unassigned account, or a departed family whose roles were removed, would keep reading every school-wide notice.

A15's own answer — `exists (select 1 from public.user_roles ur where ur.user_id = uid)` — closed the *unassigned* account and left the **departed** one open, because **nothing in Phase 5 revokes a role**: offboarding is plan 4. That residual is what **D-B** closes, and the arm is now three branches rather than one:

```sql
(cls is null
 and (
   exists (select 1 from public.user_roles ur
            where ur.user_id = uid
              and ur.role in ('admin', 'teacher', 'economy'))
   or exists (select 1 from public.class_students cs
                join public.guardian_student gs on gs.student_id = cs.student_id
               where gs.guardian_id = uid and cs.left_on is null)
   or exists (select 1 from public.class_students cs
                join public.students s on s.id = cs.student_id
               where s.student_user_id = uid and cs.left_on is null)
 ))
```

It still admits `economy` (D17) and still never asks which family role anybody holds. What it no longer does is treat *having once been given a role* as membership. Four witnesses, each with its own mutation: **17** (economy), **18** (a pupil's own login), **08** (a guardian), **10** (the departed family, expecting **0**).

⚠ **The role list is deliberately spelled out rather than calling `private.is_staff`,** which is the same three roles — see standing rule 11. Writing it here pins school-wide reach to this list rather than to whatever `is_staff` comes to mean, and the fingerprint marker `'ur.role in'` fails loudly if the list is rewritten.

⚠ **And `left_on is null` is the house's LIVE spelling, not an as-of-today test** — the same one `private.guardian_in_class` uses, which never looks at `enrolled_on` at all. A family whose enrolment starts next month is therefore admitted. That is deliberate (D-B records the trade); it is also why the school-wide surface, unlike the class one, is **not** empty out of the box under A14.

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
| `src/app/(portal)/laerer/oppslag/page.tsx` + `[announcementId]/page.tsx` + `[announcementId]/AnnouncementControls.tsx` + `ny/page.tsx` + `ny/NewAnnouncementForm.tsx` + `actions.ts` | Teacher surface. |
| `src/app/(portal)/forelder/oppslag/page.tsx` + `[announcementId]/page.tsx` | Parent surface. |
| `src/app/(portal)/elev/oppslag/page.tsx` + `[announcementId]/page.tsx` | Pupil surface. |
| `src/app/(portal)/admin/oppslag/page.tsx` + `[announcementId]/page.tsx` + `[announcementId]/AnnouncementControls.tsx` + `ny/page.tsx` + `ny/NewSchoolAnnouncementForm.tsx` + `actions.ts` | Admin surface, including school-wide and scheduling. |
| `tests/api/announcements.test.ts` | Wall-1: creation entitlement with a positive control, the enumeration-quiet `null`, the read recording, the filtered delete. |

⚠ **The two `AnnouncementControls.tsx` files are not decoration — without them the plan does not compile its own promises.** `updateAnnouncementAction` and `deleteAnnouncementAction` are written in *both* action files and, in the first draft, imported by nothing: knip fails an unused export at ERROR level, `AnnouncementDetail.canEdit` was computed by an RPC on every detail view and never read, and the walkthroughs asked a human to click a «Trekk tilbake» control the plan never wrote. One component per staff surface, importing that surface's own actions, closes all three.

**Modified:** `supabase/tests/34_enrollment_boundary.sql` (Task 2) · `supabase/tests/31_column_locks.sql` (Task 3) · `supabase/tests/29_definer_fingerprints.sql` (Task 6) · `src/lib/dates.ts` + `src/lib/dates.test.ts` (Task 8 — `osloLocalToInstant`) · `src/lib/supabase/database.types.ts` (regenerated, every migration task) · the four `*Nav.tsx` files · `src/app/action-guards.test.ts` (the action count, once per task that adds actions) · **`src/enrollment-interval.test.ts` — comment only, and its counts must NOT move; run it.**

⚠ **That last file is a repo-wide invariant nobody has named in this plan, and it is one TypeScript line away from going red.** It sweeps every `src/**/*.ts(x)` for `enrolled_on`/`left_on` and asserts **exact** counts — `asOfLeft` 8, `asOfEnrolled` 8, `clamps` 2 — plus a per-site operator assertion. This plan adds **zero** TS-side sites (verified: the only `enrolled_on` in TypeScript here is Task 11's `beforeAll`, which lives under `tests/` and is not scanned; the `left_on is null` in `announcement-audience.ts`'s docblock carries no operator and does not match), so the counts stay 8/8/2 and the file stays green. What *does* become false is prose: its header says the interval is written "SEVENTEEN times: nine in SQL", and `34_enrollment_boundary.sql`'s header says "eight function bodies". **Plan 2 adds three SQL spellings, not two** — see the correction in Task 2. ⛔ **If plan 3 ever puts an as-of filter in TypeScript, this file goes red and nothing anywhere warns first.**

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
8. **Stage explicit paths, never `git add -A`, and CHECK `docker ps` FIRST.** `scripts/fiken-probe.mjs` and everything untracked under `docs/` belongs to a parallel economy track. ⚠ **Two sessions share this checkout and this Supabase stack.** While this plan was being written, another session committed `3f67907` on top of the branch and cleaned three files that were dirty when Task 0's baseline was drafted. Re-run `git log --oneline -3` and `git status` before every task, and treat any before/after measurement taken while a foreign `vitest` or `supabase` process is running as contaminated. ★ **Promoted from a footnote 2026-08-05, because it cost a reviewer a wrong baseline:** a sibling session's `supabase db reset` was mid-flight, `supabase_migrations.schema_migrations` did not yet exist, and the migration-head query returned a plausible-looking answer that was simply false. `docker ps` (and `docker logs supabase_db_iqra-portal --tail 5` if anything looks half-built) is two seconds and comes **before** the numbers, not after they disagree.
9. **Commit messages:** conventional subject + a substantial «why» body. **No AI trailers** — CLAUDE.md forbids them and overrides the harness default.
10. **`knip` fails unused exports at ERROR level** (`knip.json` downgrades only `types` and `enumMembers`). Every export lands in the same commit as its first consumer.
11. ⚠ **`private.is_staff` must never be used in this phase** — it admits `economy` (D17). ⚠ **The one place the same three roles appear is D-B's school-wide arm** (`ur.role in ('admin', 'teacher', 'economy')`), where admitting economy is the *requirement* rather than the hazard. It is still written out rather than delegated: the ban exists because `is_staff` silently carries economy into places that must exclude it, and a call site that is correct today becomes wrong the moment somebody widens the function. The literal list is pinned by the fingerprint marker `'ur.role in'`.
12. **zod is 4.4.3.** Use `uuidField` from `src/lib/validation/school.ts` (it is `z.guid`, not `z.uuid` — the seed's readable UUIDs fail the RFC variant nibble). Date helpers are in `src/lib/dates.ts`, **not** `format.ts`; `formatDateNb` throws on a timestamptz, so it is always `formatDateNb(osloDateOf(ts))` or `formatDateTimeNb(ts)`.
13. **There is no `audit()` helper.** Audit rows are a literal service-role insert, and `createServiceRoleClient` never leaves `src/lib/admin/` (`quarantine.ts`). This plan writes no audit rows from TypeScript; the `announcements` audit trigger covers the phase's needs.
14. ⚠ **`00_grant_firewall.sql` does NOT sweep functions.** It filters `relkind in ('r','p','v','m','S')` plus schema USAGE — every current and future *table*, sequence and view, and **no function ACL at all**. So a `public` SECURITY DEFINER function that forgets `revoke execute … from public` / `from anon` is caught by nothing in the suite. Measured locally, not only in cloud: without the revoke, `has_function_privilege('anon', …, 'EXECUTE')` is **true** on this stack. This plan puts three `public` functions on the PostgREST surface and asserts the `anon` ACL of each one by hand — `announcement_read_status` most of all, since it is a definer projection over every class roster **by name**.
15. ⚠ **No seeded family is in any class as of today** (A14). Anything that reads an announcement *as a family*, or counts a roster as of `now()`, must open an enrolment window first. This bites Tasks 8–11 and the walkthroughs, and it bites silently — the failure mode is an empty list, not an error.

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

- [ ] **Step 2: Confirm the facts Tasks 1–11 depend on**

```bash
docker exec supabase_db_iqra-portal psql -U postgres -q -t -A -c "select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('has_role','teaches_class','audit_row_change','set_updated_at') order by 1;"
# ⚠ pg_indexes, NOT pg_constraint: class_students_one_active is a partial UNIQUE
# INDEX, so it does not appear in pg_constraint at all and a query there reads
# as "the constraint is gone".
docker exec supabase_db_iqra-portal psql -U postgres -q -t -A -c "select indexname, indexdef from pg_indexes where tablename='class_students';"
grep -n "student_user_id" supabase/tests/34_enrollment_boundary.sql | head
```

Expected: all four functions present · `class_students_one_active` is `CREATE UNIQUE INDEX … (student_id) WHERE (left_on IS NULL)` and `class_students_interval_unique` is `(class_id, student_id, enrolled_on)` · file 34's pupils do carry `student_user_id`. If the last is absent, Task 2's pupil-arm assertions need the column added to that file's fixture — say so rather than skipping them.

- [ ] **Step 3: ★★ Probe the as-of roster of the SEED, before writing anything that depends on it (A14)**

```bash
docker exec supabase_db_iqra-portal psql -U postgres -q -t -A -c "
select c.name, cs.student_id, cs.enrolled_on, cs.left_on,
       (cs.enrolled_on <= (now() at time zone 'Europe/Oslo')::date
        and (cs.left_on is null or (now() at time zone 'Europe/Oslo')::date < cs.left_on))
         as in_asof_roster_now
from public.class_students cs join public.classes c on c.id = cs.class_id
order by 1, 3;"
```

**Expected today: `in_asof_roster_now` is `f` on every row** — the seed enrols everyone on `2026-08-20`/`2026-08-21` and `current_date` is `2026-08-05`. That is not a defect to fix in the seed (five committed api assertions key off those exact dates — A14); it is the condition Task 11 and all three walkthroughs must open a window around.

If some row comes back `t`, the clock has moved past the seed's dates and the window is already open: say so, and Task 11's back-dating hook becomes a no-op it can keep for the day the seed is refreshed.

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
-- left 663 of 663 assertions green. (Plan 2 adds a THIRD spelling in
-- 20260806121000: announcement_read_status inlines the same interval over the
-- roster. It is the eleventh, and it is asserted behaviourally in §H rather
-- than in file 34 — see the correction in task 2.)
-- ⚠ The two `cs.left_on is null` tests in the school-wide arm below are NOT
-- among them. That is the house's LIVE spelling — the one private.guardian_in_class
-- and private.teaches_student already use, which never looks at enrolled_on —
-- and it is there because D-B bounds school-wide reach to who is here NOW. Do
-- not "harmonise" it into the as-of form. If you do, assertion 08 goes RED —
-- the family whose enrolment starts after publication is admitted by the live
-- spelling and refused by the as-of one, and that assertion is the only thing
-- in the suite standing on the difference.
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
-- set by writing the column.
--
-- ⛔ AND IT IS BOUNDED IN BOTH DIRECTIONS, BECAUSE BOTH DIRECTIONS MOVE THE
-- AUDIENCE. An earlier draft of this comment said back-dating was "the only
-- direction that changes who reads". That is FALSE and it was measured false:
-- at published_at = now() + 90 days a guardian whose left_on falls inside those
-- 90 days DROPS OUT of the audience and a guardian who joins inside them is
-- ADDED. Forward-dating addresses families the author may never meet; with no
-- upper bound at all, published_at = '2999-01-01' was accepted. Back-dating is
-- merely the direction that reaches families who have already LEFT, i.e. the
-- one that cannot be undone by waiting.
--   announcements_not_backdated  — published_at >= created_at
--   announcements_schedule_bound — published_at <= created_at + 120 days
-- Both compare against created_at, which is NOT granted and is therefore always
-- the true insert instant. No `with check` predicate could do either: at INSERT
-- it has no other timestamp to compare against. published_at stays ungrantable
-- at UPDATE. The 120 days is a PRODUCT decision (a little over one term) and is
-- mirrored by a zod bound in src/lib/validation/announcements.ts — change both
-- or neither; only the zod half produces a sentence a teacher can act on.
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
  constraint announcements_not_backdated check (published_at >= created_at),
  -- Forward is bounded too — see the header. 120 days ≈ one term.
  constraint announcements_schedule_bound
    check (published_at <= created_at + interval '120 days')
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
  'Decides the READ AUDIENCE via private.reads_announcement_row, and is therefore the security-relevant column on this table. Client-writable at INSERT so an announcement can be SCHEDULED, and bounded in BOTH directions against created_at (which is not granted): announcements_not_backdated refuses anything earlier, announcements_schedule_bound anything more than 120 days later. Both directions move the audience — forward-dating drops families whose enrolment closes in the meantime and adds families who join. NOT writable at UPDATE — see 31_column_locks.sql.';
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

-- ⚠ SCOPED to the columns that carry meaning. Only one other audit trigger in
-- this repo is scoped — threads_audit, which is `update of subject, kind,
-- staff_id, student_id, created_by`; the other twelve are unscoped. (The first
-- draft of this comment said all thirteen were, which would have made this
-- trigger look more unusual than it is.) An unscoped `or
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
-- The parameters are named cls / pub / author. pg_get_functiondef renders the
-- parameter list, so a fingerprint marker matching a BARE parameter name is
-- satisfied by the HEADER regardless of the body — finding F1 of plan 1's
-- panel, where the marker 'kind' became unfailable the moment `kind` was a
-- parameter. ⚠ MEASURED 2026-08-05, and the earlier version of this comment
-- had it backwards: none of this plan's 34 markers is a bare parameter name
-- (all are dot-qualified, operator-bearing or string literals), so matching
-- them against the header alone returns ZERO rows. Renaming these three would
-- not make any marker vacuous — it would make 'cls is null' match nowhere and
-- turn 29_definer_fingerprints.sql RED, which is the safe failure. The
-- OPERATORS are what keep the markers honest; the names are incidental.
--
-- ★★ WHAT PROTECTS published_at AND class_id AT UPDATE — corrected by the
-- review panel, because the first version of this comment named the wrong
-- mechanism and a wrong reason in a comment is how the next engineer deletes
-- the right line. It said the row form would catch a later `update (class_id)`
-- or `update (published_at)` grant. MEASURED, IT WOULD NOT:
--   · with `grant update (published_at)`, both the bare update and
--     `… returning title` SUCCEED for the author. The row form is BLIND here:
--     `author = uid` is the first arm and short-circuits before `pub` is ever
--     read. So a published, already-read notice can be silently un-published
--     and its audience migrated to a future roster. published_at has NO policy
--     guard of any kind — THE ABSENT UPDATE GRANT IS THE ONLY WALL.
--   · with `grant update (class_id)`, the update IS refused — but by
--     announcements_update_author's `with check`, which re-evaluates
--     private.writes_announcement against the NEW row. Not by this policy.
-- ⛔ So: do not treat those two revokes as tidiness, and do not expect this
-- predicate to catch their removal. 31_column_locks.sql asserts both.
--
-- (The row-form argument above remains exactly correct for the case it was
-- introduced for — INSERT … RETURNING. It is a different mechanism from this
-- one, and conflating them is what produced the sentence being corrected here.)
--
-- The arms, and what each is for:
--   author = uid       the author reads their own not-yet-published row, so a
--                      scheduled announcement is visible on the screen that
--                      scheduled it.
--   has_role(admin)    oversight, unbounded and with no time limit (D5, §4.1).
--   pub <= now()       the draft/published boundary, explicit rather than
--                      implied by a nullable timestamp a policy might forget.
--   cls is null        the whole school: everyone STILL AT THE SCHOOL — the
--                      three staff roles, plus the family of a pupil who is
--                      currently enrolled. See below; it is three branches and
--                      each one has its own witness.
-- ★★ THE SCHOOL-WIDE ARM IS BOUNDED, AND IT IS THE ONE ARM THAT IS NOT AS-OF.
-- D-B, decided by the user 2026-08-05. Two things were measured before it:
--   · without ANY guard, `cls is null` admits every authenticated account —
--     handle_new_user gives every auth user a profiles row while roles are
--     assigned separately, and src/proxy.ts is not the wall, because PostgREST
--     is reachable directly with any valid session and the anon key ships in
--     the browser bundle (count 1 for a role-less user before the guard, 0
--     after);
--   · with only a `user_roles` existence check, a family that left 30 days ago
--     still reads every school-wide notice — NOTHING REVOKES A ROLE until plan
--     4's offboarding, so "has ever been given a role" is not "is here".
-- Hence three branches. `left_on is null` is the HOUSE's live spelling, copied
-- from private.guardian_in_class, which never looks at enrolled_on either — so
-- a family whose enrolment starts next month IS admitted, deliberately, and
-- assertion 08 is that family. The class arms below stay AS-OF: a departed
-- family keeps reading the class notices published while they were enrolled
-- (assertion 11) and stops receiving new school-wide ones (assertion 10). That
-- asymmetry is the decision, not an inconsistency.
-- ⚠ The role list is spelled out rather than calling private.is_staff, which is
-- the same three roles. Standing rule 11 bans that function for this phase
-- because it silently carries economy into places that must exclude it; here
-- economy is REQUIRED (D17), and the literal list pins school-wide reach to
-- this list rather than to whatever is_staff comes to mean.
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
        (cls is null
         and (
           -- The adults who work at the school. They hold no enrolment, so the
           -- family bound below could never admit them, and D17 puts economy in
           -- school-wide notices and out of class ones.
           exists (select 1 from public.user_roles ur
                    where ur.user_id = uid
                      and ur.role in ('admin', 'teacher', 'economy'))
           -- Families, only while somebody they belong to is still enrolled.
           or exists (
             select 1
             from public.class_students cs
             join public.guardian_student gs on gs.student_id = cs.student_id
             where gs.guardian_id = uid and cs.left_on is null
           )
           or exists (
             select 1
             from public.class_students cs
             join public.students s on s.id = cs.student_id
             where s.student_user_id = uid and cs.left_on is null
           )
         ))
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

-- ⚠ created_by is pinned in `using` AS WELL AS in `with check`, and the reason
-- is NOT the one the first draft gave. That draft said the `with check`-only
-- version would let teacher B rewrite the row SETTING created_by = B and take
-- the byline. Measured: B cannot, because created_by has no UPDATE GRANT at
-- all — the laundering attack is closed one layer down, and a comment that
-- justifies a line by an attack that cannot happen is a line the next reader
-- deletes.
-- The real reason is duller and live: with the pin only in `with check`, any
-- teacher of the class may retitle a COLLEAGUE'S announcement. `using` still
-- admits the row (writes_announcement is true for both of them) and the check
-- still passes (created_by is unchanged, and it is A's). The pin in `using` is
-- what makes editing authorship rather than class membership. Assertion 32 in
-- 37_announcements_rls.sql is that exact scenario, with the same teacher's
-- successful edit of her OWN row beside it as the control.
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
--
-- ⛔ NO `private.writes_announcement(…)` CONJUNCT HERE, AND THAT IS DELIBERATE.
-- The first draft had one. Measured: a teacher who schedules an announcement
-- and then stops teaching that class can still SEE her row (the author arm of
-- the read predicate) while her delete filters to ZERO ROWS — the withdraw path
-- disappears exactly when it is needed, and only an admin who happens to notice
-- can remove it before it publishes to a class she has left. The two conjuncts
-- that remain are already strictly narrower than the insert wall: nothing
-- reaches created_by = <you> without having passed announcements_insert_staff,
-- and published_at > now() means nobody has read it. Do not add the third
-- conjunct back for symmetry with announcements_update_author.
create policy "announcements_delete_own_unpublished"
  on public.announcements for delete to authenticated
  using (created_by = (select auth.uid())
         and published_at > now());

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

The claim in the migration comment — that a BEFORE trigger may assign a column the caller was never granted — is load-bearing for Task 5 and is asserted nowhere else. Prove it before writing 49 assertions on top of it:

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

Create `supabase/tests/37_announcements_rls.sql`. Fixture prefix `c0`, `plan(51)`.

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(51);

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
  ('c0000000-0000-0000-0000-000000000013'::uuid, 'pgtap-op-elev2@test.local',     'OP Elev Startet'),
  -- …014 is Ordinær's SECOND guardian. Without a two-guardian family, «exactly
  -- one FAMILY has read it» cannot tell per-family counting from per-user
  -- counting: every fixture pupil would produce one row either way (A5).
  ('c0000000-0000-0000-0000-000000000014'::uuid, 'pgtap-op-forelder5@test.local', 'OP Forelder Ordinær To'),
  -- …015 has a profile (handle_new_user makes one for every auth user) and NO
  -- user_roles row at all. That is a reachable state, not a hypothetical:
  -- accounts are created before roles are assigned, and revoking a role leaves
  -- the account intact. It is the witness for A15.
  ('c0000000-0000-0000-0000-000000000015'::uuid, 'pgtap-op-ingenrolle@test.local','OP Uten Rolle')
) as u(id, email, full_name);
-- ⚠ NO user_roles row for …015. That is the fixture.
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
  ('c0000000-0000-0000-0000-000000000014', 'parent'),
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
  ('c0000000-0000-0000-0000-000000000036', 'OP', 'Startet',  2013, false, 'c0000000-0000-0000-0000-000000000013'),
  -- ★ D-A's pair, and they only work as a PAIR. Both left the class twenty days
  -- after the notice went out, so both are in its as-of roster and neither is on
  -- the live roster private.teaches_student asks about. They differ in exactly
  -- one column. Without the ordinary one, «the name was withheld» is equally
  -- explained by the leaving; without the protected one, the gate has no
  -- witness at all. And «Skjermet» (…035) STAYS on the live roster, because she
  -- is the only witness for the `teaches_student` half of the gate — move her
  -- and it can be deleted with the file green.
  ('c0000000-0000-0000-0000-000000000037', 'OP', 'Vernet Sluttet',  2013, true,  null),
  ('c0000000-0000-0000-0000-000000000038', 'OP', 'Ordinaer Sluttet', 2013, false, null);
-- ⚠ Ordinær (…031) has TWO guardians, and only ONE of them ever records a read.
-- «Skjermet» (…035) has NONE and no login either — she is A4's witness and, at
-- the same time, the pupil the read predicate admits nobody for (A3). The
-- `reachable` column exists to tell those two facts apart on screen.
insert into public.guardian_student (guardian_id, student_id) values
  ('c0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000031'),
  ('c0000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000031'),
  ('c0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000032'),
  ('c0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000033'),
  ('c0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000034'),
  ('c0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000036');

-- D = the OSLO calendar day 30 days ago. Four pupils differ in nothing but
-- their position relative to D:
--   Ordinær   enrolled D-60, open            → IN
--   Etterpå   enrolled D+1,  open            → OUT (enrolled after publication)
--   Sluttet   enrolled D-60, left_on = D     → OUT (left_on is EXCLUSIVE)
--   Startet   enrolled D,     open           → IN  (enrolled_on is INCLUSIVE)
-- Skjermet sits alongside Ordinær and exists only for the read-status witness.
--
-- ⚠ ETTERPÅ IS AT D + 1, NOT D + 20, AND THAT IS THE UPPER EDGE OF enrolled_on.
-- Corrected 2026-08-05: with her at D+20, widening `cs.enrolled_on <= X` to
-- `<= X + 1` reddened NOTHING in the entire suite — measured, at all three SQL
-- sites at once, 66 of 66 assertions green. One day is the only distance at
-- which the two spellings differ, so the fixture has to stand there. With her
-- at D+1, that widening reddens 07 and 40 in this file and 45 and 58 in §H.
insert into public.class_students (class_id, student_id, enrolled_on, left_on) values
  ('c0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000031',
   ((now() - interval '90 days') at time zone 'Europe/Oslo')::date, null),
  ('c0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000032',
   ((now() - interval '30 days') at time zone 'Europe/Oslo')::date + 1, null),
  ('c0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000033',
   ((now() - interval '90 days') at time zone 'Europe/Oslo')::date,
   ((now() - interval '30 days') at time zone 'Europe/Oslo')::date),
  ('c0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000035',
   ((now() - interval '90 days') at time zone 'Europe/Oslo')::date, null),
  ('c0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000036',
   ((now() - interval '30 days') at time zone 'Europe/Oslo')::date, null),
  ('c0000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-000000000034',
   ((now() - interval '90 days') at time zone 'Europe/Oslo')::date, null),
  -- D + 20: inside …041's as-of window (D), outside …045's (D + 25), and
  -- outside the LIVE roster — which is the three facts D-A's gate turns on.
  ('c0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000037',
   ((now() - interval '90 days') at time zone 'Europe/Oslo')::date,
   ((now() - interval '30 days') at time zone 'Europe/Oslo')::date + 20),
  ('c0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000038',
   ((now() - interval '90 days') at time zone 'Europe/Oslo')::date,
   ((now() - interval '30 days') at time zone 'Europe/Oslo')::date + 20);

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
   now() + interval '9 days', 'c0000000-0000-0000-0000-000000000002', now()),
  -- ★ D-B's control row: a CLASS notice published while «Sluttet» was still
  -- enrolled (D − 40). Her guardian reads it, and that is the only positive
  -- assertion she has — the school-wide arm now refuses her, so without this row
  -- both of her assertions would be zeros and a broken session would satisfy
  -- them both. It also pins the asymmetry D-B creates: the class arm stays
  -- as-of and keeps a departed family's own history readable.
  ('c0000000-0000-0000-0000-000000000048', 'c0000000-0000-0000-0000-000000000021',
   'OP Gammel klassebeskjed', 'Publisert mens Sluttet fortsatt gikk her.',
   now() - interval '70 days', 'c0000000-0000-0000-0000-000000000002', now() - interval '80 days');

-- ⚠ §J asserts that deleting an announcement takes its read rows with it. That
-- assertion is VACUOUS unless a read row exists to be taken — a count of 0 that
-- was 0 all along proves nothing, which is the exact shape that let four
-- Phase-4 assertions survive `select true`. This row is its witness, and §J's
-- middle assertion checks it is still there after the refused delete.
insert into public.announcement_reads (announcement_id, user_id) values
  ('c0000000-0000-0000-0000-000000000046', 'c0000000-0000-0000-0000-000000000004');

-- ── §A 01-05 shape and the anon ACL ─────────────────────────────────
select ok((select relrowsecurity from pg_class where oid = 'public.announcements'::regclass),
  'RLS enabled on announcements');
select ok((select relforcerowsecurity from pg_class where oid = 'public.announcements'::regclass),
  'RLS FORCED on announcements (26_rls_force asserts three things per table, not two)');
select ok((select relrowsecurity from pg_class where oid = 'public.announcement_reads'::regclass),
  'RLS enabled on announcement_reads');
select ok((select relforcerowsecurity from pg_class where oid = 'public.announcement_reads'::regclass),
  'RLS FORCED on announcement_reads');
-- ⚠ NOTHING ELSE IN THE SUITE ASSERTS A FUNCTION ACL. 00_grant_firewall.sql
-- sweeps relkind in ('r','p','v','m','S') and schema USAGE — every current and
-- future TABLE, and no function at all. A `public` definer function that loses
-- its `revoke execute … from public/anon` is caught by nobody. Measured on this
-- stack (not only in cloud): without the revoke this returns TRUE.
select is(has_function_privilege('anon', 'public.can_edit_announcement(uuid)', 'EXECUTE'),
  false,
  'anon cannot execute can_edit_announcement — the grant firewall does not sweep functions, so this is asserted by hand');

-- ── §B 06-15 the AS-OF audience (D9), and D-B's live school-wide bound ──
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
  'D9: a family enrolled the DAY AFTER published_at does not read that announcement — enrolled_on''s upper edge, one day wide');
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
-- ⛔ D-B. This assertion used to expect 1, and pinned the exact behaviour the
-- user decided against: nothing revokes a role until plan 4, so a family that
-- has left keeps a `parent` row and kept receiving every school-wide notice.
-- The control for this 0 is the assertion two above — a DIFFERENT actor
-- reading the IDENTICAL row and getting it — and the positive below is what
-- proves this guardian's session is real rather than broken.
select is((select count(*) from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000042'), 0::bigint,
  'D-B: a family whose enrolment has CLOSED stops receiving school-wide notices — «hele skolen» means everyone still AT the school');
select is((select count(*) from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000048'), 1::bigint,
  'and still reads the CLASS notice published while they WERE enrolled — the class arm stays as-of (D9) while the school-wide arm is live, and that asymmetry is D-B');
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

-- ⚠ …010, NOT the author …002, AND THAT IS WHAT MAKES THIS ASSERTION WORTH
-- HAVING. Measured 2026-08-05: with …002 here — who wrote …041 — deleting
-- `private.teaches_class(uid, cls)` from reads_announcement_row reddened
-- NOTHING IN THE FILE. The author arm short-circuits before the teacher arm is
-- ever reached, so the one clause that lets a teacher read her class's notices
-- could be deleted with all 77 assertions green. …010 teaches class A and wrote
-- neither announcement in it, so she reaches the row through teaches_class and
-- nothing else. The author arm keeps its own witnesses in §D (19) and §E (27).
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000010","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000041'), 1::bigint,
  'control: a teacher OF that class reads the identical announcement — and it is her colleague''s, so this is the teaches_class arm rather than the author arm');
reset role;

-- ── §C 16-20 economy, the pupil's own login, the role-less account ──
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

-- ★ D-B's THIRD branch, and the one nothing else in the file can see. …007
-- holds `student` and no staff role, so she reaches the school-wide notice only
-- through her own live enrolment. Without this assertion the pupil branch of
-- the school-wide guard could be replaced with `false` and all 76 other
-- assertions stay green — measured.
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000042'), 1::bigint,
  'the pupil arm of the school-wide bound: a pupil on her OWN login reads it, through her live enrolment rather than through any role');
reset role;

-- A15. The control for this 0 is the assertion directly above: a DIFFERENT
-- actor reading the IDENTICAL row, and getting it.
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000015","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000042'), 0::bigint,
  'A15: an account with a profile but NO user_roles row reads nothing — not even the school-wide notice. «Hele skolen» means everyone AT the school');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000009","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.announcements
           where id = 'c0000000-0000-0000-0000-000000000041'), 0::bigint,
  'a guardian of another class''s pupil reads nothing of class A''s announcement');
reset role;

-- ── §D 21-24 the scheduled row (D8) ─────────────────────────────────
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

-- ── §E 25-33 creation: the two bounds, RETURNING, and the write wall ─
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
-- A1's second bound. Forward-dating moves the audience too — it drops families
-- whose enrolment closes before the new date and adds families who join — so
-- "forward" is not the safe direction, only the recoverable one. Without this
-- constraint published_at = '2999-01-01' was accepted (measured).
select throws_ok(
  $$ insert into public.announcements (class_id, title, body, published_at, created_by)
     values ('c0000000-0000-0000-0000-000000000021', 'OP For langt fram', 'x',
             now() + interval '200 days', 'c0000000-0000-0000-0000-000000000002') $$,
  '23514', null,
  'A1: and cannot be scheduled past the 120-day bound — beyond about a term the roster it would address is not one anybody can picture');
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
-- ⚠ AND THE SAME SHAPE FOR A SCHEDULED ROW, WHICH IS A DIFFERENT ARM.
-- Measured: with `author = uid` deleted from reads_announcement_row, the
-- IMMEDIATE returning-insert above still succeeds (pub <= now() carries it) and
-- the bare scheduled insert still succeeds (no RETURNING, no extra check) — so
-- neither creation assertion can see that deletion, and only a SELECT assertion
-- can. Today the app never emits this statement (`.insert(obj)` without
-- `.select()` sends return=minimal), but the gap opens on the one-token change
-- that broke plan 1: someone adds `.select()` to createAnnouncementAction.
select lives_ok(
  $$ insert into public.announcements (class_id, title, body, published_at, created_by)
     values ('c0000000-0000-0000-0000-000000000021', 'OP Planlagt med returnering', 'x',
             now() + interval '2 days', 'c0000000-0000-0000-0000-000000000002')
     returning id $$,
  '★ RETURNING id on a SCHEDULED row: the author arm must carry it, because pub <= now() cannot');
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

-- ── §F 34-38 the update pins, and the control the UI asks ───────────
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

-- ⛔ public.can_edit_announcement HAD FINGERPRINT MARKERS AND NO BEHAVIOUR.
-- File 29 pins that its body still MENTIONS both conjuncts; nothing asserted
-- what it returns. Drop `a.created_by = (select auth.uid())` and it says yes to
-- every teacher of the class — the policy still refuses the update, so this is
-- a UI lie rather than a hole: an edit form that renders, submits, and silently
-- changes nothing. Its own comment calls it "a thin mirror of
-- announcements_update_author", and a mirror is a claim about two objects.
-- The same actor and the two rows §F has just tried to update. ⚠ The session is
-- re-established explicitly: the assertions above run after `reset role`, and a
-- definer function asked "may the CALLER edit this" should be asked by a caller.
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000010","role":"authenticated"}', true);
set local role authenticated;
select is(public.can_edit_announcement('c0000000-0000-0000-0000-000000000041'), false,
  'the mirror, refusing: a co-teacher gets NO edit control for a colleague''s announcement — the same row her UPDATE above did not change');
select is(public.can_edit_announcement('c0000000-0000-0000-0000-000000000045'), true,
  'control: and DOES get one for her own in the same class — so the false above is the created_by conjunct, not a function stuck at false');
reset role;

-- ── §G 39-46 announcement_reads: the two INSERT binds, and the SELECT
--    policy that had NO assertion at all ──────────────────────────────
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
-- ⚠ …042 (school-wide), NOT …041, and that is load-bearing. 42501 is the same
-- SQLSTATE for "no column grant" and "policy refused", so this assertion can
-- only be about the grant if the policy would have PASSED — which it does here,
-- because …004 reads the school-wide notice. Mutation 18 (granting read_at)
-- proves it: with the grant the insert lives, so the refusal was the grant.
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

-- ★ A5's SECOND ARM, which had no witness at all. The only read row in the
-- first draft belonged to a guardian, so deleting `ar.user_id =
-- s.student_user_id` from announcement_read_status reddened NOTHING. This is a
-- pupil recording their own read, on their own login — and the double bind
-- passes for them because student_in_class_asof admits them (…036 enrolled on
-- the Oslo publication day, the inclusive edge).
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000013","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.announcement_reads (announcement_id, user_id)
     values ('c0000000-0000-0000-0000-000000000041',
             'c0000000-0000-0000-0000-000000000013') $$,
  'a pupil records their OWN read on their own login — the second arm of A5, and the witness §H''s per-family count needs');
reset role;

-- ⛔ announcement_reads_select_own_or_staff HAD NO ASSERTION IN THE FIRST DRAFT,
-- and it could have been `using (true)` or `using (false)` with every other
-- assertion in this file green. §G above tests INSERTs only; §H goes through a
-- SECURITY DEFINER projection, which never evaluates this policy at all; and §J
-- reads this table only AFTER `reset role`, i.e. as postgres, which holds
-- rolbypassrls. That is the same shape as commit 3f67907 on this branch.
-- The three below are one row — the fixture's (…046, …004) — read by three
-- actors whose only difference is entitlement.
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.announcement_reads
           where announcement_id = 'c0000000-0000-0000-0000-000000000046'), 0::bigint,
  'another family sees no read rows — who has opened a notice is not something families learn about each other');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.announcement_reads
           where announcement_id = 'c0000000-0000-0000-0000-000000000046'), 1::bigint,
  'control: the class''s OWN teacher sees that identical row — so the 0 above is the policy, not an empty table');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.announcement_reads
           where announcement_id = 'c0000000-0000-0000-0000-000000000046'), 1::bigint,
  'and so does admin, through the has_role arm rather than the writes_announcement one');
reset role;

-- ── §J 47-51 the delete pair ────────────────────────────────────────
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

Expected: 51 `ok`, no `not ok`, and **no** `Looks like you planned…` line. If the count differs, set `plan(N)` to what pgTAP reports and correct this document — never by counting `select` lines.

★ **Measured 2026-08-05, so this is not a prediction.** The whole of file 37 — this task's sections plus §H and §I from Tasks 4 and 5 — was assembled verbatim from this document, run against the three migrations inside `begin; … rollback;`, and returned **77 of 77 green** with the sections landing exactly where the numbering table at the bottom of this plan says. Task 1's own subset is the first 46 of them plus §J at 47–51.

⚠ **Task 1's §J is at 47–51, not 45–49, and that changed on 2026-08-05 when D-A and D-B landed.** §B gained two assertions and §C one, so everything from §C onward moved by two or three. The mutation table below uses **Task-1 numbering**; the cross-task table at the bottom of this plan is what maps it to the finished file.

⚠ If assertion 4 or `26_rls_force.sql` fails, a new table is missing `force row level security` or a policy. That file is `plan(4)`: **three sweeps across all public tables** (enabled, forced, has-a-policy) plus one role-attribute assertion — so it catches either verb by name and needs no edit.

- [ ] **Step 6: ★ Mutation pass — twenty-eight named mutations, each must redden ALONE**

Apply each with `create or replace` (functions) or `alter policy` / `alter table` (policies, constraints), re-run the file, then restore by re-running the migration's own block and **verify the restore with the md5 check in standing rule 3**.

| # | Mutation | Must redden | Must NOT redden |
|---|---|---|---|
| 1 | `guardian_in_class_asof`: `< cs.left_on` → `<= cs.left_on` | 09 (the family that left ON the publication day gains it) | 06 |
| 2 | `guardian_in_class_asof`: `cs.enrolled_on <=` → `cs.enrolled_on <` | 12 (the family that started ON the publication day loses it) | 06 |
| 3 | `guardian_in_class_asof`: drop **both** `at time zone 'Europe/Oslo'` (leave `pub::date`) | **09 and 12** — the Oslo day and the UTC day differ at 00:30 | 06 |
| 4 | `student_in_class_asof`: `cs.enrolled_on <=` → `<` | **13, 43** and §H's **54, 55** — ⚠ the pupil's inclusive edge, *and* her own read: she can no longer record one (the double bind refuses her), so both per-family counts move with it. Measured 2026-08-05; this table said «12» alone and was **wrong before the decisions landed** | 06, 39 |
| 5 | `student_in_class_asof`: drop both `at time zone 'Europe/Oslo'` | **13, 43** and §H's **54, 55** — identical collateral, same reason | 06, 39 |
| 6 | `reads_announcement_row`: substitute `private.guardian_in_class` (the LIVE helper) for `guardian_in_class_asof` | **07, 11 and 42** — a family enrolled after publication gains the notice, the departed family LOSES the old one it is entitled to, and the double bind then admits a read it should refuse. ⚠ 42 was measured and was missing from this table; 11 is D-B's control row | 06 |
| 7 | `reads_announcement_row`: delete the `pub <= now()` conjunct | 23 (a family reads a scheduled announcement) | 21, 22 |
| 8 | `reads_announcement_row`: delete the `author = uid` arm | **21, 29 and 47** — the author loses her own scheduled row, the scheduled `returning id` insert 42501s, and her withdraw of `…047` finds nothing to delete: a DELETE with a WHERE applies the SELECT policy too, so a row she cannot read is a row she cannot remove. ⚠ 47 was measured 2026-08-05 and was missing from this table | 22, 28 |
| 9 | `reads_announcement_row`: delete the whole `cls is null` arm | **08, 17 and 18** — the three school-wide positives: a live guardian, economy, and a pupil's own login. ⚠ It no longer reddens 10, and that is D-B: 10 now expects **0** and a deleted arm keeps it at 0 | 16, 19 |
| 10 | `announcements_update_author`: drop `created_by = (select auth.uid())` from **both** `using` and `with check` | 34 | 35 |
| 11 | drop the `announcements_not_backdated` CHECK | 25 | 26 |
| 12 | `announcements_select_audience`: replace the row form with `using (private.reads_announcement((select auth.uid()), id))` | ★ **28 and 29** — both `returning id` inserts 42501 while the predicate is true | 06, 10, 14 (bare reads are unaffected) |
| 13 | `announcement_reads_insert_own`: drop the `private.reads_announcement(…)` conjunct | 42 | 39 |
| 14 | `announcements_delete_own_unpublished`: drop `published_at > now()` | **48 and 49** — the author's delete of the published announcement now succeeds, taking its read row with it | 47 |
| 15 | `reads_announcement_row`: delete the whole school-wide guard, keeping a bare `cls is null` | **10 and 19** — the departed family reads it again, and so does the account with no role at all | 08, 17, 18 |
| 16 | drop the `announcements_schedule_bound` CHECK | 27 | 26 |
| 17 | `announcement_reads_select_own_or_staff`: drop the `exists (… private.writes_announcement …)` arm | 45 (the class's own teacher stops seeing the read row) | 44, 46 |
| 18 | `grant insert (read_at) on public.announcement_reads to authenticated` | 41 (a read can now be back-dated) | 39 |
| 19 | `grant execute on function public.can_edit_announcement(uuid) to anon` | 05 | — |
| 20 | `announcements_insert_staff`: drop the `private.writes_announcement(…)` conjunct, keeping the author pin | **30 and 31** — the teacher publishes to a class she does not teach, and to the whole school | 32, 33 |
| 21 | `announcements_insert_staff`: drop `created_by = (select auth.uid())`, keeping `writes_announcement` | 32 (a forged byline is accepted) | 30, 31 |
| 22 | `reads_announcement_row`: delete the `private.teaches_class(uid, cls)` arm | 15 (a teacher stops reading her own class's announcement) ⚠ **only because assertion 15's actor is the co-teacher.** With the author there — as this file had it until 2026-08-05 — this mutation reddens **nothing at all**, measured | 14, 06 |
| 23 | `guardian_in_class_asof`: `cs.enrolled_on <= X` → `<= X + 1` — the UPPER edge | **07 and 42** — «Etterpå» enters the audience, and with her the double bind admits her read | 06, 12 |
| 24 | `can_edit_announcement`: delete the `a.created_by = (select auth.uid())` conjunct | 37 (the co-teacher is offered an edit control for a colleague's notice — the policy still refuses the UPDATE, so this is a form that submits and changes nothing) | 38, 34 |
| ★25 | **D-B:** school-wide guard, guardian branch — delete `and cs.left_on is null` | **10** (the departed family receives school-wide notices again — the exact state the user decided against) | 08, 17, 18, 19 |
| ★26 | **D-B:** school-wide guard — replace the whole guardian branch with `false` | **08** (a live family stops receiving them) | 10, 17, 18 |
| ★27 | **D-B:** school-wide guard — replace the whole pupil branch with `false` | **18** (a pupil on her own login stops receiving them; her guardian is unaffected, so nothing else moves) | 08, 17 |
| ★28 | **D-B:** school-wide guard — drop `'economy'` from the role list | **17** (D17's own rule: economy holds no enrolment, so the family branches cannot carry it) | 08, 18 |


⚠ Mutations 1–3 **and 23** are different clauses of the same function — run them separately or one masks another. Same for 4–5, and for 7, 8, 9, 15, 22 and **25–28**, which are nine clauses of `reads_announcement_row`.

★ **20–24 were added 2026-08-05, and 20–22 exist because standing rule 2 was broken by this plan's own table.** The insert wall (28, 29, 30) and the `teaches_class` read arm behind 13/14 were the file's most consequential assertions and had **no named mutation at all** — the rule says every new assertion is watched fail, and «the policy is obviously what refuses» is exactly the reasoning that shipped four Phase-4 assertions which survived `select true`.

⛔ **And running mutation 22 is what found the hole under it.** The arm had not merely lost its mutation: with the author as assertion 15's actor, **no assertion in the file could see the arm deleted** — a teacher would silently stop reading her colleagues' notices to her own class and the suite would stay green. That is why §B's control is now the co-teacher. The lesson is the one this project keeps re-learning: a mutation table entry is a *prediction*, and this one was wrong until it was run.

23 and 24 are different again: 23 exists because the upper edge of `enrolled_on` was measurably unpinned (see the fixture comment for «Etterpå», and Task 2's mutations 7–8 for the same edge asserted directly on the helpers), and 24 because `can_edit_announcement` had fingerprint markers and no behaviour at all.

★ **25–28 are D-B's, added 2026-08-05 with the decision, and each reddens exactly ONE assertion — measured, not predicted.** The school-wide guard is three branches, and a three-branch `or` is precisely the shape where one dead branch hides behind two live ones. 25 is the decision itself (the departed family), 26 and 27 are its two family arms, 28 is D17's economy.

⛔ **And re-running the OLD table under the new fixture is what caught three entries that were already wrong before either decision landed** — 4, 5 and 6. Mutations 4 and 5 were recorded as reddening one assertion; they redden four, because a pupil excluded from the as-of audience also cannot record the read that §H's per-family counts stand on. Mutation 6 was recorded as reddening one; it reddens two even before D-B's control row is counted. Nothing about D-A or D-B caused that — the entries were **predictions nobody had run**, in a plan whose own standing rule 2 exists to stop exactly this. Re-measured against the committed document: `red=[12, 41, 49, 50]` for 4 and 5, `red=[7, 40]` for 6, in the committed numbering.

⚠ **Mutation 10 changed after review, and the first version could not have worked.** Dropping the pin from `using` while keeping it in `with check` does not make the update a silent no-op: it raises `ERROR: new row violates row-level security policy` (measured). §F's two UPDATEs are bare statements, not pgTAP calls, so that error aborts the transaction — every later statement fails `25P02` and `finish()` never runs. Dropping it from **both** clauses lets the update succeed silently, which is what assertion 34 is written to catch.

⚠ Mutation 12 is the most valuable one in this plan. It reproduces, exactly, the defect that broke every thread creation in plan 1 and survived 737 assertions. If it does **not** redden assertions 28 and 29, they are wrong — check that they really say `returning id` and not `returning 1`.

⚠ **Two assertions in this file still have no mutation behind them, and it is on the record rather than hidden:** the `pub <= now()` **equality** boundary is never exercised — every fixture is 30 days past or 1–9 days future, so changing `<=` to `<` reddens nothing — and assertion 36 (`has_column_privilege(…,'published_at','UPDATE')`) is a privilege probe whose mutation lives in Task 3's table instead. If you can add an equality fixture cheaply, do; if not, say so in the commit body.

- [ ] **Step 7: Full suite from a clean database**

```bash
cd ~/dev/iqra-portal && supabase db reset && supabase test db --local && npm run typecheck && npm run lint
```

Expected: `Files=` baseline+1, `Tests=` baseline+49, `Result: PASS`; typecheck 0 errors; lint 0 errors and the pre-existing warnings only.

- [ ] **Step 8: Commit**

```bash
cd ~/dev/iqra-portal
git add supabase/migrations/20260806120000_announcements.sql supabase/tests/37_announcements_rls.sql src/lib/supabase/database.types.ts
git commit -m "feat(oppslag): announcements, with the audience resolved as of publication"
```

Body must state: that `published_at` is client-writable at INSERT and why **two** CHECKs rather than the grant are the wall, including that forward-dating moves the audience too (A1); **that the school-wide arm is bounded to live enrolment ∪ staff ∪ economy by the user's decision D-B of 2026-08-05, that `left_on is null` is deliberately the house's live spelling rather than an as-of test, and that assertion 10 was FLIPPED from 1 to 0 by that decision** (A15); that the withdraw policy deliberately drops `writes_announcement` (A2); that the SELECT policy is the row form and which mutation proves it; that the read-tracking table carries no audit trigger and why; that «Etterpå» sits one day past publication because at twenty days the upper edge of `enrolled_on` was unpinned across the whole suite; and the twenty-eight mutations run in step 6 with what each reddened — **including that re-running the pre-decision table found entries 4, 5 and 6 to have been wrong all along**.

---

## Task 2: the as-of interval, asserted where the other eight are

**Files:**
- Modify: `supabase/tests/34_enrollment_boundary.sql`
- Modify: `src/enrollment-interval.test.ts` (comment only — its counts must not move)

M3's own note in that file reserves this slot: *"Phase 5: D9 resolves an announcement's audience as of published_at. It is the ninth site of this idiom, and it must be written `published_at < cs.left_on` and asserted here (or beside here) at the same edge."* The note is one clause short — it does not mention the timezone of the cast — and this task supplies it.

⚠ **CORRECTED 2026-08-05: plan 2 adds THREE spellings of the interval, not two.** `private.guardian_in_class_asof` and `private.student_in_class_asof` are the ninth and tenth, asserted here. **`public.announcement_read_status` inlines an eleventh** over the roster (`cs.enrolled_on <= …` / `… < cs.left_on` / `Europe/Oslo`, all three fingerprinted in Task 6 and asserted behaviourally by §H's 47, 52 and 53). It is not asserted here because it takes an announcement id rather than a date, and §H already places pupils on both edges of it.

Two file headers become false in the same commit, and both are prose: this file's says the interval is "spelled out in eight function bodies" (**eleven**), and `src/enrollment-interval.test.ts`'s says "SEVENTEEN times: nine in SQL" (**twenty, twelve in SQL**). Fix both, change nothing else in the TypeScript file, and **run it** — its exact counts (`asOfLeft` 8, `asOfEnrolled` 8, `clamps` 2) are a repo-wide invariant this plan must leave at 8/8/2.

- [ ] **Step 1: Read the file's fixture and its plan count**

```bash
cd ~/dev/iqra-portal && sed -n '1,120p' supabase/tests/34_enrollment_boundary.sql && grep -n "student_user_id\|bd000000-0000-0000-0000-0000000000[23]" supabase/tests/34_enrollment_boundary.sql | head -20
```

You need: the current `plan(N)` (expected **24**), the boundary date `D` the file uses (expected `2026-09-15`), the three guardians' ids and the three pupils' ids, the class id, and whether `students.student_user_id` is populated. **If any differs from what step 2 assumes, correct step 2 rather than the file.**

- [ ] **Step 2: Add the ninth and tenth copies, at both edges**

Bump `plan(24)` to `plan(32)` and append, immediately before `select * from finish();`:

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
    'bd000000-0000-0000-0000-000000000041',
    (('2026-09-15'::date + time '00:30') at time zone 'Europe/Oslo')),
  false,
  'guardian_in_class_asof: left_on = D is OUT — left_on is EXCLUSIVE, ninth site');
select is(private.guardian_in_class_asof(
    'bd000000-0000-0000-0000-000000000012',
    'bd000000-0000-0000-0000-000000000041',
    (('2026-09-15'::date + time '00:30') at time zone 'Europe/Oslo')),
  true,
  'control: left_on = D + 1 is IN — so the false above is the operator, not a broken fixture');
select is(private.guardian_in_class_asof(
    'bd000000-0000-0000-0000-000000000013',
    'bd000000-0000-0000-0000-000000000041',
    (('2026-09-15'::date + time '00:30') at time zone 'Europe/Oslo')),
  true,
  'guardian_in_class_asof: enrolled_on = D is IN — enrolled_on is INCLUSIVE, and this is also the Oslo-cast witness');
select is(private.student_in_class_asof(
    'bd000000-0000-0000-0000-000000000021',
    'bd000000-0000-0000-0000-000000000041',
    (('2026-09-15'::date + time '00:30') at time zone 'Europe/Oslo')),
  false,
  'student_in_class_asof: left_on = D is OUT, tenth site');
select is(private.student_in_class_asof(
    'bd000000-0000-0000-0000-000000000022',
    'bd000000-0000-0000-0000-000000000041',
    (('2026-09-15'::date + time '00:30') at time zone 'Europe/Oslo')),
  true,
  'control: left_on = D + 1 is IN');
select is(private.student_in_class_asof(
    'bd000000-0000-0000-0000-000000000023',
    'bd000000-0000-0000-0000-000000000041',
    (('2026-09-15'::date + time '00:30') at time zone 'Europe/Oslo')),
  true,
  'student_in_class_asof: enrolled_on = D is IN, and the Oslo-cast witness for the pupil arm');
-- ★ THE UPPER EDGE OF enrolled_on, WHICH NOTHING IN THIS REPO PINNED.
-- Measured 2026-08-05: widening `cs.enrolled_on <= X` to `<= X + 1` at all
-- three of plan 2's SQL sites at once left file 37 at 66 of 66 green and this
-- file untouched — no fixture anywhere stood one day the wrong side of an
-- as-of date, which is the only distance at which the two spellings differ.
-- These two need no new fixture: they ask about the SAME pupil as the two
-- assertions above, one day EARLIER. «Startet Grensedagen» enrolled on D, so
-- she is out of the roster of anything published on D − 1, and the assertions
-- above (enrolled_on = D is IN) are their control on the identical row.
select is(private.guardian_in_class_asof(
    'bd000000-0000-0000-0000-000000000013',
    'bd000000-0000-0000-0000-000000000041',
    (('2026-09-15'::date - 1 + time '00:30') at time zone 'Europe/Oslo')),
  false,
  'guardian_in_class_asof: the pupil who enrolled on D is OUT of the audience of a notice published on D-1 — enrolled_on''s UPPER edge, one day wide');
select is(private.student_in_class_asof(
    'bd000000-0000-0000-0000-000000000023',
    'bd000000-0000-0000-0000-000000000041',
    (('2026-09-15'::date - 1 + time '00:30') at time zone 'Europe/Oslo')),
  false,
  'student_in_class_asof: same pupil, same day, the pupil arm — both helpers carry their own copy of the operator');
```

⛔ **The class id in all six calls is `bd…041`, and the first draft of this plan had `bd…031` — which is the TERM.** Verified 2026-08-06 against the file: `terms.id = bd000000-…-000000000031`, `classes.id = bd000000-…-000000000041`. The actor ids **are** right (guardians `…011/012/013`, pupil logins `…021/022/023`, D = `2026-09-15`, `plan(24)`).

⚠ **This is not a typo you can leave to the executor to notice, and here is why.** With the term id as `cid`, no `class_students` row matches, so every one of the six calls returns `false` — and **two of them expect `false`**. Assertions 25 and 28 (`left_on = D is OUT`) would have passed *because the fixture row does not exist*, not because `left_on` is exclusive. Only the four that expect `true` go red, so an executor who fixes what is red leaves both boundary negatives permanently untested. That is plan 1's «wrong pupil's login» defect, verbatim, in a file that exists specifically because a widening survived 663 assertions.

Step 1 still tells you the real ids: if they differ from the above, substitute — do not invent a new fixture.

- [ ] **Step 3: Run it**

```bash
cd ~/dev/iqra-portal && docker exec -i supabase_db_iqra-portal psql -U postgres -q -f - < supabase/tests/34_enrollment_boundary.sql
```

Expected: 32 `ok`, no `not ok`. ★ Measured 2026-08-05 against the repo's own file 34 with Task 1's migration applied in a rollback transaction: **32 of 32 green**, the eight new ones landing at 25–32 exactly.

- [ ] **Step 4: ★ Mutation pass**

| # | Mutation | Must redden | Must NOT redden |
|---|---|---|---|
| 1 | `guardian_in_class_asof`: `<` → `<=` on `left_on` | 25 | 26 |
| 2 | `guardian_in_class_asof`: `<=` → `<` on `enrolled_on` | 27 | 26, 31 |
| 3 | `guardian_in_class_asof`: `(pub at time zone 'Europe/Oslo')::date` → `pub::date`, both occurrences | **25 and 27** | 26 |
| 4 | `student_in_class_asof`: `<` → `<=` on `left_on` | 28 | 29 |
| 5 | `student_in_class_asof`: `<=` → `<` on `enrolled_on` | 30 | 29, 32 |
| 6 | `student_in_class_asof`: drop the Oslo cast, both occurrences | **28 and 30** | 29 |
| 7 | `guardian_in_class_asof`: `<=` → `<= … + 1` on `enrolled_on` — the UPPER edge | 31 | 27 |
| 8 | `student_in_class_asof`: `<=` → `<= … + 1` on `enrolled_on` | 32 | 30 |

(Assertion numbers assume the eight land at 25–32. If step 3 numbered them differently, use what pgTAP printed.)

★ **Mutations 7 and 8 were run 2026-08-05 and behave as the table says** — applied to both helpers at once they redden **31 and 32 and nothing else**, while `<=` → `<` reddens **27 and 30 and nothing else**. The two directions of one operator, each with its own witness, which is what this file exists to do.

- [ ] **Step 5: Commit**

```bash
cd ~/dev/iqra-portal
git add supabase/tests/34_enrollment_boundary.sql src/enrollment-interval.test.ts
git commit -m "test(oppslag): pin the announcement audience at both edges of the enrolment interval"
```

Body must state that these are the ninth and tenth sites of one interval and that `announcement_read_status` is an eleventh asserted elsewhere; that the file's earlier note asked only for the `left_on` edge and the timezone of the cast was the missing half; that the **upper** edge of `enrolled_on` was unpinned across the entire repo until this commit, measured; that `src/enrollment-interval.test.ts` changed in comment only and its 8/8/2 counts did not move; and which mutations reddened which assertions.

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
| 6 | `grant insert (fanned_out_at) on public.announcements to authenticated` | 30 |

⚠ Mutation 1 must redden **23 only** — mutations 24–28 are column probes and `has_column_privilege` reports true when a table grant exists, so 24 and 25 stay green while 26–28 also flip. Record what actually happened: if 26–28 redden too, that is the asymmetry the block's comment describes and it is correct behaviour, not a defect.

⚠ Mutation 2 also reddens **assertion 36 of `37_announcements_rls.sql`** (§F's `published_at` privilege probe), which is the same claim asserted in the file that owns the behaviour. Re-running file 37 under this mutation is optional; noticing that the two files agree is not, because the RLS-lens finding above records that **`published_at` has no policy guard of any kind** — this grant is the entire wall, asserted in two places on purpose.

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
-- ★ THE ROSTER IS AS OF published_at (A3). A live roster would count families
-- the announcement is invisible to, so «12 av 28» would be a number nobody
-- could act on.
--
-- ⛔ IT IS NOT "the same set reads_announcement_row admits", WHICH IS WHAT AN
-- EARLIER DRAFT OF THIS COMMENT SAID. This function counts PUPILS; the read
-- predicate admits USERS. Measured: of the three pupils it returns for the
-- fixture's class announcement, one has student_user_id null AND no
-- guardian_student row, so no user at all is admitted on her account and her
-- has_read can never become true — «0 av 3» could never reach 3. That is why
-- there is a fifth column. `reachable` does not change the denominator (the
-- office still needs to know the child exists and was in the class); it lets
-- the screen say «ingen pålogging» instead of printing a name that will never
-- clear and telling the office to phone a family that has no account.
--
-- ⚠ AND THE PROJECTION IS BOUND TO PUBLISHED ROWS. Without `a.published_at <=
-- now()` this function binds on WRITE authority while the row it describes
-- binds on READ authority: measured, a co-teacher who cannot SELECT a
-- colleague's scheduled announcement at all still got its projected roster
-- back from here — she learned the draft exists and saw who it would go to.
-- Bounded (that roster is her own class list) but pointless: read-tracking for
-- a notice nobody has been able to read is a row of zeroes.
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
-- ★★ BUT THE NAME IS GATED — D-A, decided by the user 2026-08-05, and the ROW
-- and the NAME are two different questions with two different answers.
-- The roster this function returns is AS OF published_at, while every teacher
-- read of public.students is either LIVE (students_select_related →
-- private.teaches_student, `cs.left_on is null`) or carries `and protected =
-- false` (students_select_taught_ever, 20260721120712:79-84). So for a pupil
-- who was in the class when the notice went out and has since left, this
-- projection was the ONE surface in the portal naming a protected child to a
-- teacher who may no longer see her — measured against pg_policy on the live
-- database, with an ordinary departed pupil as the control that showed the
-- entire delta was `protected`.
-- The case below returns the pupil's name exactly when public.students would
-- already return her row to this caller, and «Skjermet elev» otherwise. The
-- ROW stays either way, so the denominator the office acts on is unchanged.
-- ⚠ private.has_role(admin) is in the gate on purpose: students_select_related
-- names every protected pupil to admin already, so gating admin would blind the
-- office — the one reader read-tracking exists for — while withholding nothing
-- from anybody. Assertion 64 is its witness.
-- ⚠ It mirrors TWO of students_select_related's four arms. The other two
-- (is_guardian_of, student_user_id = uid) cannot be callers here, because
-- writes_announcement admits only admin and the class's current teacher — with
-- one rare exception that fails CLOSED: a teacher who still teaches the class
-- and whose own protected child has LEFT it reads «Skjermet elev» for her own
-- child. Withholding, not disclosing. See the plan's D-A entry; the fix, if it
-- is ever wanted, is `or private.is_guardian_of((select auth.uid()), s.id)`
-- with its own assertion.
-- ⚠ What this does NOT do: the row's existence still tells a former teacher
-- that one pupil on that as-of roster is protected, and she still receives the
-- student_id. That is strictly less than the name and strictly more than
-- students_select_taught_ever gives her. Omitting the row — 20260803001000's
-- answer for the CROSS-FAMILY mate list — was rejected here because it breaks
-- the denominator. Recorded in the plan's «leaves broken».
-- ⛔ The user asked whether `protected` could be removed from the product
-- altogether. Answer: not legally mandated, but Norwegian beskyttet identitet
-- (kode 6/7) makes the obligation real and it arrives without warning, and
-- removing it means surgery on shipped CI-green Phase-4 code
-- (20260721120712_attendance_visibility.sql and
-- 20260803001000_protected_mate_omission.sql plus their pgTAP). DEFERRED as its
-- own scoped task. Nothing here removes anything.
--
-- ⚠ THE SCHOOL-WIDE BRANCH IS ONE CLAUSE, NOT A SECOND FUNCTION. For
-- class_id null the roster is every pupil with an as-of enrolment in ANY
-- class. That is the case where "who has not seen it" is most valuable, since
-- announcements send no e-mail at all (D12) and the office's only instrument
-- is the phone.
create or replace function public.announcement_read_status(p_announcement_ids uuid[])
returns table (announcement_id uuid, student_id uuid, display_name text,
               has_read boolean, reachable boolean)
language sql stable security definer set search_path = ''
as $$
  select a.id,
         s.id,
         -- D-A. The name, or «Skjermet elev» — see the header. The row is never
         -- dropped; only the name is withheld, and only from a caller
         -- public.students would also refuse.
         case
           when s.protected
            and not (private.has_role((select auth.uid()), 'admin')
                     or private.teaches_student((select auth.uid()), s.id))
           then 'Skjermet elev'
           else s.first_name || ' ' || s.last_name
         end,
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
         ),
         -- ★ Whether ANY account exists that could ever open it on this
         -- pupil's behalf. Without it, a pupil with no guardian account and no
         -- login of her own sits permanently in the unread list and the office
         -- is told to phone a family that cannot be phoned through the portal.
         (exists (select 1 from public.guardian_student gs
                   where gs.student_id = s.id)
          or s.student_user_id is not null)
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
    and private.writes_announcement((select auth.uid()), a.class_id)
    -- ⚠ And read-tracking describes a PUBLISHED announcement. See the header:
    -- without this, write authority hands back the projected roster of a
    -- colleague's unpublished draft.
    and a.published_at <= now();
$$;
-- ⚠ Name the roles — `from public` does not strip the explicit anon grant
-- pg_default_acl gives to supabase_admin-created functions (the cloud path).
revoke execute on function public.announcement_read_status(uuid[]) from public;
revoke execute on function public.announcement_read_status(uuid[]) from anon;
grant execute on function public.announcement_read_status(uuid[]) to authenticated;
comment on function public.announcement_read_status(uuid[]) is
  'D10. Who, in the as-of roster at published_at, has read each announcement — one row per (announcement, pupil), for PUBLISHED announcements only. Bound to admin or the class''s own teacher by private.writes_announcement inside the WHERE, so another class''s rows are ABSENT rather than filtered on display. Protected pupils are INCLUDED — the denominator is the office''s number and dropping a pupil from it is what spec §7 would have cost — but the NAME is gated (D-A): a protected pupil the caller no longer teaches renders as «Skjermet elev», because the roster here is AS OF publication while every teacher read of public.students is live or carries `and protected = false`. Admin is exempt: students_select_related names her to admin already. `reachable` is false for a pupil with no guardian account and no login of her own — she is in the denominator (the office needs to know she was in the class) but her has_read can never become true, and the screen must say so rather than print a name that never clears. See the migration header.';
```

- [ ] **Step 2: Apply and regenerate types**

```bash
cd ~/dev/iqra-portal && supabase db reset && npm run db:types
```

- [ ] **Step 3: Add §H to pgTAP 37**

Bump `plan(51)` to `plan(71)` and insert this block **immediately after §G** (it depends on the two read rows §G's assertions 39 and 43 insert) and **before §J**:

```sql
-- ── §H 47-66 read-tracking (D10), and D-A's name gate ───────────────
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.announcement_read_status(
             array['c0000000-0000-0000-0000-000000000041'::uuid])), 5::bigint,
  'A3: the roster is AS OF published_at — Ordinær, Skjermet, Startet and D-A''s two leavers, but not the family that joined later nor the one that left that day');
-- ⛔ The witness for A4. Spec §7 asks for this pupil to be omitted; the two
-- migration comments it was transposed from say staff are entitled to see her.
-- If this ever goes red, read the header of 20260806121000 before "fixing" it.
select is((select count(*) from public.announcement_read_status(
             array['c0000000-0000-0000-0000-000000000041'::uuid])
           where student_id = 'c0000000-0000-0000-0000-000000000035'), 1::bigint,
  'A4: a PROTECTED pupil is present in the read-tracking list — this is a staff-only surface, and hiding her hides the family most worth phoning');
-- ⛔ D-A's three teacher-side witnesses, and they only mean anything together.
-- The row is never dropped (that is A4, above); the NAME is gated to whatever
-- public.students would already show THIS caller. …035 is still on her live
-- roster; …037 and …038 both left twenty days after publication, so both are in
-- the as-of roster and neither is on the live one — and they differ in exactly
-- one column. Measured: deleting the whole `case` reddens 50 alone, dropping
-- `s.protected` reddens 51 alone, dropping private.teaches_student reddens 49
-- alone. Without …038 the placeholder would be equally explained by the
-- leaving; without …035 the teaches_student half could be deleted with the
-- file green.
select is((select display_name from public.announcement_read_status(
             array['c0000000-0000-0000-0000-000000000041'::uuid])
           where student_id = 'c0000000-0000-0000-0000-000000000035'),
  'OP Skjermet',
  'D-A: a protected pupil the caller STILL teaches is named in full — students_select_related already shows her, so withholding here would buy nothing');
select is((select display_name from public.announcement_read_status(
             array['c0000000-0000-0000-0000-000000000041'::uuid])
           where student_id = 'c0000000-0000-0000-0000-000000000037'),
  'Skjermet elev',
  'D-A: a protected pupil who has SINCE LEFT is NOT named — students_select_taught_ever carries `and protected = false`, and this projection must not be the one surface that discloses her');
select is((select display_name from public.announcement_read_status(
             array['c0000000-0000-0000-0000-000000000041'::uuid])
           where student_id = 'c0000000-0000-0000-0000-000000000038'),
  'OP Ordinaer Sluttet',
  'control: an ORDINARY pupil who left on the SAME day IS named — taught_student_ever admits her, so the whole delta above is `protected` rather than the leaving');
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
           where has_read), 2::bigint,
  'A5: exactly TWO FAMILIES have read it — Ordinær through ONE of her two guardians, and Startet through the pupil''s own login. Counted per pupil, never per user');
-- ★ The second arm by name. Without it, deleting `ar.user_id =
-- s.student_user_id` from the has_read exists reddens nothing at all: every
-- read row in the first draft's fixture belonged to a guardian.
select is((select count(*) from public.announcement_read_status(
             array['c0000000-0000-0000-0000-000000000041'::uuid])
           where student_id = 'c0000000-0000-0000-0000-000000000036' and has_read), 1::bigint,
  'A5''s pupil arm: a pupil''s OWN login clears their family''s row — a secondary pupil is not a family who has not seen it');
-- ⛔ A3's correction, pinned. «Skjermet» has no guardian account and no login,
-- so no user is admitted on her behalf and her has_read can NEVER become true.
-- She stays in the denominator; the screen says «ingen pålogging» rather than
-- telling the office to phone a family that has no account.
select is((select count(*) from public.announcement_read_status(
             array['c0000000-0000-0000-0000-000000000041'::uuid])
           where student_id = 'c0000000-0000-0000-0000-000000000035' and reachable), 0::bigint,
  'A3: a pupil with no guardian account and no login of her own is NOT reachable — «0 av 3» could otherwise never reach 3 and nothing on screen would say why');
select is((select count(*) from public.announcement_read_status(
             array['c0000000-0000-0000-0000-000000000041'::uuid])
           where student_id = 'c0000000-0000-0000-0000-000000000031' and reachable), 1::bigint,
  'control: a pupil whose guardian has an account IS reachable — so the 0 above is the missing account, not a column stuck at false');
-- ⛔ THE TWO-ELEMENT CALL, AND THE ONLY THING THAT TESTS THE CORRELATION.
-- Every call above passes ONE id, and it is the one id with read rows — so
-- `ar.announcement_id = a.id` can be deleted from the has_read exists and the
-- numbers do not move: the fixture's other read row belongs to the SAME family,
-- so «Ordinær» is has_read either way. Measured with the correlation dropped:
-- …041 stays 3 rows / 2 read, and …045 goes from 0 read to 2. So the second id
-- is the witness, and the row count beside it is what stops the witness being
-- vacuous — with batching broken, «no reads» would be true of an empty set.
-- …045 is «OP Fra laerer tre»: same class, published five days ago, nobody has
-- read it, and its as-of roster is four (Etterpå enrolled a day after …041 was
-- published, which is inside …045's window).
select is((select count(*) from public.announcement_read_status(
             array['c0000000-0000-0000-0000-000000000041'::uuid,
                   'c0000000-0000-0000-0000-000000000045'::uuid])
           where announcement_id = 'c0000000-0000-0000-0000-000000000045'), 4::bigint,
  'the BATCH returns the second id too — four pupils in its own as-of roster. Nothing else in this file passes two ids, and the DAL always will');
select is((select count(*) from public.announcement_read_status(
             array['c0000000-0000-0000-0000-000000000041'::uuid,
                   'c0000000-0000-0000-0000-000000000045'::uuid])
           where announcement_id = 'c0000000-0000-0000-0000-000000000045' and has_read), 0::bigint,
  'and NONE of them has read it — a read of one announcement is not a read of another, which is the ar.announcement_id = a.id correlation and nothing above can see it');
-- Read-tracking describes a PUBLISHED announcement. The same actor reads this
-- row perfectly well (assertion 21) and authored it — she still gets no
-- projected roster for it, because there is nothing yet to have read it.
select is((select count(*) from public.announcement_read_status(
             array['c0000000-0000-0000-0000-000000000043'::uuid])), 0::bigint,
  'a SCHEDULED announcement has no read-tracking at all — the projection binds on published rows, not on write authority alone');
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

-- ⛔ A6's OWN BRANCH, WHICH HAD NO ASSERTION UNTIL 2026-08-05. Every call above
-- passes a CLASS announcement, so `a.class_id is null or` could be deleted from
-- the roster lateral with every other §H assertion green — measured: the class
-- numbers do not move by a single row and the school-wide roster goes to 0.
-- That is read-tracking silently killed for exactly the case A6 calls the one
-- where "who has not seen it" is most valuable. Admin, because
-- writes_announcement(uid, null) is admin-only.
-- SIX, not eight: it is the as-of roster of EVERY class at published_at, so
-- «Klasse B» and D-A's two leavers are in it and the two pupils on the wrong
-- side of D are not.
-- ⚠ It is the PUPIL roster. The school-wide AUDIENCE is a different set in both
-- directions — live families plus every staff account, none of whom is on any
-- roster. D-B narrowed the audience and did not make the two agree; the table
-- in A3 says exactly where they diverge.
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.announcement_read_status(
             array['c0000000-0000-0000-0000-000000000042'::uuid])), 6::bigint,
  'A6: the school-wide announcement has read-tracking too, over the as-of roster of EVERY class — including the pupil in Klasse B, who is in no class this notice names');
-- ★ D-A's fourth witness, and the only one that can see the admin arm of the
-- gate. Same pupil as assertion 50, different caller: admin reads every
-- protected pupil's students row already (students_select_related), so gating
-- her here would blind «hvem ringer vi» and withhold nothing from anyone.
select is((select display_name from public.announcement_read_status(
             array['c0000000-0000-0000-0000-000000000041'::uuid])
           where student_id = 'c0000000-0000-0000-0000-000000000037'),
  'OP Vernet Sluttet',
  'D-A: and ADMIN reads her name in full — the gate mirrors what public.students would disclose to THIS caller, and to admin it discloses everything');
reset role;

-- ⚠ NOT columns_are. That reads pg_attribute on a RELATION, and a `returns
-- table` function has no pg_class row — measured in plan 1 against the
-- identically-shaped assignment_group_mate_names: every column reported
-- missing, pg_class count 0. The assertion could never pass, so D14's central
-- claim would have shipped unpinned.
select is(pg_get_function_result(
    'public.announcement_read_status(uuid[])'::regprocedure),
  'TABLE(announcement_id uuid, student_id uuid, display_name text, has_read boolean, reachable boolean)',
  'exactly these five columns — a sixth is where a guardian''s name or a phone number would arrive');
-- The same reason as §A's: 00_grant_firewall.sql sweeps tables, not functions.
-- ★ AND THIS IS THE ONE THAT MATTERS. Without the revoke, an anon key — which
-- ships in every browser bundle — executes a definer projection over every
-- class roster in the school, BY NAME, with read state attached.
select is(has_function_privilege('anon', 'public.announcement_read_status(uuid[])', 'EXECUTE'),
  false,
  'anon cannot execute announcement_read_status — this is the definer function on the PostgREST surface whose leak would be a roster, by name');
```

- [ ] **Step 4: Run and mutate**

```bash
cd ~/dev/iqra-portal && docker exec -i supabase_db_iqra-portal psql -U postgres -q -f - < supabase/tests/37_announcements_rls.sql
```

Expected: 71 `ok`.

§H's assertions land at **47** (count = 5) · **48** (protected present) · **49** (D-A: the still-taught protected pupil is named) · **50** (D-A: the departed protected pupil is «Skjermet elev») · **51** (D-A control: the departed ordinary pupil is named) · **52** (inclusive edge present) · **53** (exclusive edge absent) · **54** (two families have read) · **55** (the pupil-login arm) · **56** (Skjermet not reachable) · **57** (Ordinær reachable) · **58** (the batch's second id, four rows) · **59** (and none of them read — the correlation) · **60** (a scheduled row has no read-tracking) · **61** (other teacher → 0) · **62** (guardian → 0) · **63** (A6, school-wide → 6) · **64** (D-A: admin reads her name in full) · **65** (return shape) · **66** (anon cannot execute). §J moves to **67–71**.

⚠ **Three of those numbers are the counts D-A's two new fixture pupils moved:** 47 is **5** where it was 3, 63 is **6** where it was 4, and 58 stays **4** — both leavers are outside `…045`'s window, which is the same fact that makes them untaught. If 58 reads 2, the two enrolments were given `left_on` on the wrong side of D + 25.

| # | Mutation | Must redden | Must NOT redden |
|---|---|---|---|
| 1 | delete `and private.writes_announcement(…)` from the `where` | **61 and 62** | 47, 63 |
| 2 | move `private.writes_announcement(…)` out of the `where` and into the select list as a **sixth** column ⚠ needs `drop function public.announcement_read_status(uuid[]);` first — a `create or replace` that changes the return type raises **42P13** | 61, 62 **and 65** — the return type changes, which is what assertion 65 is for | — |
| 3 | add `and not s.protected` — the change §7 asks for ⚠ to the **OUTER `where`**, not the lateral: `s` is joined *after* the lateral and is not in scope inside it | **47, 48, 49, 50, 58, 63 and 64** (measured: the class roster drops 5 → 3, `…045`'s 4 → 3, the school-wide 6 → 4, and every assertion naming a protected pupil — presence *and* both D-A name assertions — goes with them) | 51, 56, 61 |
| 4 | `cs.enrolled_on <=` → `<` | **47, 52, 54, 55 and 63** (Startet leaves both rosters, and takes her family's read with her) | 58, 61 |
| 5 | `< cs.left_on` → `<=` | **47, 53 and 63** (Sluttet joins both rosters) | 58, 61 |
| 6 | drop the Oslo cast, both occurrences | ⚠ **52, 53, 54 and 55 — NOT 47, and NOT 63.** The resolved day moves to D−1, which pushes Startet out and pulls Sluttet in, so **both** counts stay where they were and both count assertions are blind to it | 47, 58, 61, 63 |
| 7 | replace the guardian arm of the `has_read` exists with `false` | 54 | 47, 55 |
| 8 | replace `ar.user_id = s.student_user_id` with `false` | **54 and 55** | 47 |
| 9 | replace the whole `reachable` expression with `true` | 56 | 57 |
| 10 | delete `and a.published_at <= now()` from the `where` | 60 | 47 |
| 11 | `grant execute on function public.announcement_read_status(uuid[]) to anon` | 66 | 47 |
| 12 | delete `a.class_id is null or` from the roster lateral — A6's whole branch | **63** | 47, 58 |
| 13 | delete `and ar.announcement_id = a.id` from the `has_read` exists | **59** | 47, 54, 58 |
| 14 | `cs.enrolled_on <=` → `<= … + 1` — the upper edge | **47 and 63** (Etterpå enters both rosters) | 58, 61 |
| ★15 | **D-A:** delete the whole `case`, leaving `s.first_name \|\| ' ' \|\| s.last_name` | **50** — and *only* 50. The departed protected pupil is named again, which is the state the decision closed | 49, 51, 64 |
| ★16 | **D-A:** drop `s.protected` from the gate, keeping the caller test | **51** — the ordinary leaver is withheld too, which is how you tell a gate on `protected` from a gate on «no longer teaches» | 49, 50, 64 |
| ★17 | **D-A:** drop `private.teaches_student(…)` from the gate | **49** — the pupil still on the caller's live roster is withheld, i.e. the gate stops mirroring public.students | 50, 51, 64 |
| ★18 | **D-A:** drop `private.has_role((select auth.uid()), 'admin')` from the gate | **64** — admin loses a name she can read in the next tab, and the office loses the list read-tracking exists for | 49, 50, 51 |

⚠ Mutation 6 is the one worth reading. The count assertion cannot see it — two pupils swap places and 5 stays 5. That is why 52 and 53 exist, and it is the same lesson as plan 1's «the fixture was hiding the defect it sat next to»: a count over a set is invisible to any mutation that preserves the set's size. **Assertion 63 has the same blind spot for the same reason**, which is why it is a count over a set the *other* mutations do move.

⚠ Mutation 3 is not a bug being introduced — it is **the specification's own instruction**, applied, so the reviewer can see exactly what §7 would have cost. Record the reddened assertions in the commit body.

⛔ **And it does NOT redden 56, which the table claimed until it was run on 2026-08-05.** Assertion 56 says «Skjermet is not reachable» as a count of **0**, and a pupil who has been filtered out of the projection entirely also contributes 0 — so it cannot tell «present and unreachable» from «absent». That is this file's own vacuity lesson landing on one of its own assertions. It is not a hole: 48 pins her *presence* and mutation 9 pins the `reachable` expression, so between them the pair is covered. But the two assertions guard different things than the table said they did, and a mutation table entry is a prediction until somebody runs it.

★ **12, 13 and 14 were added 2026-08-05 and every effect in the three tables above was executed, not predicted.** Each of the three closes a hole where a clause of this function could be deleted with the whole file green: the school-wide branch (12), the announcement correlation on `has_read` (13), and the upper edge of `enrolled_on` (14). The numbers in the «must redden» column are the ones psql printed.

★★ **15–18 are D-A's, and they are the reason the gate is written as three separate tests rather than one.** Each reddens exactly one assertion and nothing else — measured, same day, same rollback transaction. A gate whose three parts cannot be told apart by the suite is a gate that gets simplified in six months by somebody who reads it as one idea; these four say, in the test output, which part they broke.

⚠ Mutations 2 and 9 change the function's shape or its output. After **every** restore, run the md5 check in standing rule 3 — and after mutation 2 in particular, confirm the function is back to five columns with `pg_get_function_result` rather than trusting that the drop-and-recreate ran. **Mutations 15–18 all edit the same `case`** — run them one at a time, or 16 masks 15.

- [ ] **Step 5: Commit**

```bash
cd ~/dev/iqra-portal
git add supabase/migrations/20260806121000_announcement_read_status.sql supabase/tests/37_announcements_rls.sql src/lib/supabase/database.types.ts
git commit -m "feat(oppslag): who has read it, through a projection rather than a wider policy"
```

Body must state the A4 reversal explicitly — that spec §7 asks for protected pupils to be omitted, that the two migrations it was transposed from say the opposite for staff surfaces, and that a witness assertion now pins the decision. **It must also state D-A**: that the user asked on 2026-08-05 whether `protected` could be removed from the product, that the answer was no (beskyttet identitet, kode 6/7, arrives without warning) and that removing it is DEFERRED as its own scoped task rather than folded in here; that the ROW stays and only the NAME is gated, to exactly the callers `public.students` would refuse; that admin is deliberately exempt; and that the residual — a former teacher still learns a protected pupil was on that roster, and still gets her `student_id` — is recorded in «leaves broken» rather than fixed by dropping the row. It must also state that the projection returns **five** columns, that the fifth exists because the denominator is the roster and not the set the read predicate admits (A3), and that the return-shape assertion was updated deliberately in the same commit rather than "fixed" afterwards. **And it must name the three clauses that had no witness before this commit** — the school-wide branch, the `ar.announcement_id = a.id` correlation and the upper edge of `enrolled_on` — with the assertion each one now reddens. ⚠ The old pointer to OD-1 is gone from this list because the hole is closed: the A4 witness who is still on the live roster is now **one of three** pupils telling that story, and 49/50/51/64 pin all four halves of it.

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

Bump `plan(71)` to `plan(77)` and insert **after §H, before §J**:

```sql
-- ── §I 67-72 the scheduled-publish claim (§11 3b) ───────────────────
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select * from public.claim_due_announcements() $$,
  '42501', null,
  'the claim is service_role only — a logged-in parent could otherwise burn every pending fan-out in one call');
reset role;
-- Third of the three function ACLs nothing else in the suite sweeps (§A, §H).
select is(has_function_privilege('anon', 'public.claim_due_announcements()', 'EXECUTE'),
  false,
  'and anon cannot execute it either — the revoke names anon explicitly because pg_default_acl grants it in the cloud path');

set local role service_role;
select is((select count(*) from public.claim_due_announcements()), 0::bigint,
  'nothing to claim: the BEFORE INSERT trigger already stamped every immediately-published row, so plan 3''s first drain will not retro-fan the whole history');
reset role;

-- Undo one stamp, which is the state a genuinely scheduled announcement
-- reaches the moment its published_at arrives.
update public.announcements set fanned_out_at = null
  where id = 'c0000000-0000-0000-0000-000000000041';
set local role service_role;
-- ⚠ array_agg, NOT a scalar subquery. `select (select announcement_id from …)`
-- raises `more than one row returned by a subquery used as an expression` the
-- moment the claim returns two rows — which is exactly what mutation 1 makes it
-- do. That error is not a red assertion: it ABORTS the transaction, every later
-- statement fails 25P02 and finish() never runs, so the mutation that matters
-- most in this section would have read as a broken file rather than as a
-- caught defect.
select is((select array_agg(announcement_id order by announcement_id)
             from public.claim_due_announcements()),
  array['c0000000-0000-0000-0000-000000000041'::uuid],
  'the claim returns exactly the due, unannounced announcement — and nothing else');
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

Expected: 77 `ok`.

§I's assertions land at **67** (authenticated → 42501) · **68** (anon cannot execute) · **69** (nothing to claim) · **70** (the claim returns exactly `…041`) · **71** (a second claim returns nothing) · **72** (`…043` is never claimed). §J moves to **73–77**.

| # | Mutation | Must redden | Must NOT redden |
|---|---|---|---|
| 1 | delete `and b.fanned_out_at is null` | **69, 70 and 71** — every published row is claimable, so the first call is no longer empty, the array is no longer `[…041]`, and the second call repeats | 67 |
| 2 | delete `and b.published_at <= now()` | **69 and 72** — the two future rows are claimed by the FIRST call, which is what leaves 70 green | 70 |
| 3 | `grant execute on function public.claim_due_announcements() to authenticated` | 67 | 70 |
| 4 | `stamp_announcement_fanout`: `return new;` with the assignment deleted | 69 (there is suddenly a backlog to claim) | 67 |
| 5 | `grant execute on function public.claim_due_announcements() to anon` | 68 | 67 |

⚠ Mutation 4 belongs to Task 1's trigger but has no assertion there — assertion 69 is the only thing in the suite that can see it. Note that in the commit body.

⚠ Mutation 1 is the reason assertion 70 is written with `array_agg`. Under the scalar-subquery spelling it would have raised `more than one row returned by a subquery` instead of failing, aborting the file at that point and taking 71 and 72 with it — a mutation that "worked" by destroying the evidence.

⚠ **`…048` does not disturb this section, and that was checked rather than assumed.** D-B's control row is published in the past, so the BEFORE INSERT trigger stamps it at fixture time and it never enters the queue — assertion 69 is still **0**, and 70 still returns exactly `[…041]`.

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
    -- ★ The announcement read rule. Every marker below is dot-qualified or
    -- carries an OPERATOR, and that — not the cls/pub/author parameter names —
    -- is what stops it being satisfied by the FUNCTION HEADER. F1 of plan 1's
    -- panel was the bare word 'kind', which the parameter list satisfied.
    -- ⚠ Corrected 2026-08-05: an earlier version of this comment said renaming
    -- the parameters to class_id/published_at/created_by would make three of
    -- these vacuous while still reporting green. Measured against the header
    -- alone, all 26 of this plan's markers match ZERO times — a rename makes
    -- 'cls is null' match nowhere and turns this file RED. Never write a marker
    -- that is a bare parameter name; the names themselves are incidental.
    (
      'private.reads_announcement_row(uuid,uuid,timestamptz,uuid)',
      array[
        'private.has_role',
        'private.teaches_class',
        'private.guardian_in_class_asof',
        'private.student_in_class_asof',
        'cls is null',
        -- The role gate on the school-wide arm (A15). Without it `cls is null`
        -- admits any authenticated account, including one with no user_roles
        -- row at all — and `cls is null` alone would still satisfy its own
        -- marker while that happened.
        'public.user_roles',
        'pub <= now()',
        -- ★ D-B's three, added 2026-08-05 with the decision. The role LIST is
        -- pinned rather than delegated to private.is_staff (standing rule 11),
        -- so a marker on the list is the only thing that notices it being
        -- widened; and the two live-enrolment branches are what stop a family
        -- that left last term from receiving school-wide notices for ever,
        -- because nothing revokes a role until plan 4.
        'ur.role in',
        'public.class_students',
        'cs.left_on is null'
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
        -- Read-tracking describes PUBLISHED announcements. Deleting this line
        -- hands a co-teacher the projected roster of a colleague's draft.
        'a.published_at <= now()',
        'cs.enrolled_on <=',
        'cs.left_on',
        'Europe/Oslo',
        -- ★ D-A's name gate, all three parts. This projection returns an as-of
        -- roster while every teacher read of public.students is live or carries
        -- `and protected = false`, so without these three it is the one surface
        -- naming a protected child to a teacher who may no longer see her. The
        -- has_role marker is the ADMIN exemption: delete it and the office —
        -- the reader this whole function exists for — starts getting
        -- «Skjermet elev» for a pupil it can open in the next tab.
        'private.has_role',
        'private.teaches_student',
        's.protected'
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

Then update the counter. **Expected new value: 49 + 34 = 83**, from these per-entry marker counts:

| entry | markers | |
|---|---|---|
| `guardian_in_class_asof` | 4 | |
| `student_in_class_asof` | 4 | |
| `reads_announcement_row` | **10** | 7 + D-B's three |
| `reads_announcement` | 1 | |
| `writes_announcement` | 3 | |
| `can_edit_announcement` | 2 | |
| `announcement_read_status` | **8** | 5 + D-A's three |
| `claim_due_announcements` | 2 | |
| **added** | **34** | |

★ **Measured 2026-08-05 against the three migrations applied verbatim in a rollback transaction: 34 pairs, 0 markers missing from the installed bodies, 0 satisfiable from a function header.** The value before D-A and D-B was 28 → 77; six markers landed with the decisions.

⛔ **Do not take 83 on trust.** Apply the edit, run the file, and if assertion 1 reports a different number, **count the markers in the entries you actually wrote** and correct this document. Never nudge the counter to make a failure go away — that is the file's own standing instruction, and plan 1's ledger records the plan getting this arithmetic wrong twice (26 → "31", when the true value was 43).

Also update the comment above the counter, which currently narrates the 26 → 43 → 48 → 49 history, with the 49 → 83 step and the same "these are pairs, not functions" warning.

⚠ **And two lines of prose in the same file are now wrong.** Its header says *"The live SECURITY DEFINER count is 52"* (and again, *"not all 52 SECURITY DEFINER functions"*). This plan adds **eight** definer functions — the two as-of helpers, the two read predicates, `writes_announcement`, `can_edit_announcement`, `announcement_read_status`, `claim_due_announcements` — so both numbers become **60**. `private.stamp_announcement_fanout` is deliberately not one of them. Verify rather than assume:

```bash
docker exec supabase_db_iqra-portal psql -U postgres -q -t -A -c "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prosecdef and n.nspname in ('public','private');"
```

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

⚠ **And run the F1 check — but ⚠ CORRECTED 2026-08-05, because the version this step used to carry was confounded and could not have told you anything.** It renamed the parameters **and** deleted the `cls is null` arm in one mutation. The deletion alone reddens the file (that is mutation 1 above), so a red result proved nothing about naming: the experiment had two variables and one outcome.

The question F1 actually asks is *can a marker be satisfied by the function header alone*, and that is one query, not a mutation:

```bash
docker exec supabase_db_iqra-portal psql -U postgres -q -t -A -c "
select f.sig, m
from (values
  ('private.reads_announcement_row(uuid,uuid,timestamptz,uuid)',
   array['private.has_role','private.teaches_class','private.guardian_in_class_asof',
         'private.student_in_class_asof','cls is null','public.user_roles','pub <= now()',
         'ur.role in','public.class_students','cs.left_on is null'])
  -- …and every other entry you added in step 2
) as f(sig, markers),
lateral unnest(f.markers) as m
where position(m in split_part(pg_get_functiondef(f.sig::regprocedure), 'AS \$function\$', 1)) > 0;"
```

**Expect ZERO rows** — that is what «non-vacuous» means here, and it was measured for all **34** markers on 2026-08-05, including D-A's and D-B's six. A row would name a marker that the parameter list satisfies, and that marker must be rewritten to carry an operator or a schema qualifier.

If you also want the rename observed end-to-end, run it **without** touching the body — one variable:

```sql
begin;
drop policy "announcements_select_audience" on public.announcements;
drop function private.reads_announcement(uuid, uuid);
drop function private.reads_announcement_row(uuid, uuid, timestamptz, uuid);
-- recreate it with the SAME body, parameters renamed class_id/published_at/
-- created_by, then re-run 29_definer_fingerprints.sql.
-- It must go RED on 'cls is null' and 'pub <= now()': the body now says
-- `class_id is null`, so the markers match nowhere. That is the SAFE failure,
-- and it is the point — a rename is loud, not silent.
rollback;   -- ⚠ roll back rather than restoring by hand: three objects,
            -- and a partial restore leaves the table with no SELECT policy
            -- at all, which reads as "everything is denied" in every later run.
```

Run it in one transaction against the reset database and roll back; then confirm with the md5 check in standing rule 3 **and** `select count(*) from pg_policy where polrelid = 'public.announcements'::regclass` — expect **5** (select, insert, update, and the two deletes).

- [ ] **Step 5: Commit**

```bash
cd ~/dev/iqra-portal
git add supabase/tests/29_definer_fingerprints.sql
git commit -m "test(oppslag): fingerprint the announcement predicates and the two projections"
```

Body must state the new counter value **as measured**, that it counts pairs rather than functions, that **no marker in this plan is satisfiable from a function header** and the header-only probe that proved it (the parameter names are incidental — a rename reddens the file rather than silencing it), that the file's own «the live SECURITY DEFINER count is 52» prose moved to 60 in the same commit, and **that six of the 34 markers exist because of D-A and D-B** — `ur.role in` pins a role list that standing rule 11 forbids delegating to `private.is_staff`, and `s.protected` / `private.teaches_student` / `private.has_role` pin the three parts of the name gate.

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
 *
 * ⛔ NOT EXPORTED, ON PURPOSE. Its only callers are the three role wrappers in
 * this same module, and knip reports an export consumed only inside its own
 * module as an unused export — at ERROR level, since knip.json downgrades only
 * `types` and `enumMembers`. (The `listThreads` precedent does not apply: that
 * one is imported by src/lib/admin/threads.ts.) Exporting it would fail
 * `npm run knip` in Task 7 step 6 and every gate after it.
 */
async function listAnnouncements(): Promise<AnnouncementRow[]> {
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

⚠ `AdminNav.tsx` carries a comment saying «Meldinger» is *"Last, as on the other three navs"*. **That sentence is already false today** — verified 2026-08-06: `LaererNav`'s items are I dag · Oppgaver · **Meldinger** · **Vurdering**, so Meldinger is last on three navs, not four. And this task makes it falser still, by putting Oppslag between Meldinger and Vurdering. Task 10 rewrites it; what it must not do is replace one wrong sentence with another («the last two, in that order, on all four navs» would also be false). The true statement after this plan is: **Oppslag sits directly after Meldinger on all four navs; on LaererNav both are followed by Vurdering.**

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
- Create: `src/app/(portal)/laerer/oppslag/[announcementId]/AnnouncementControls.tsx`
- Create: `src/app/(portal)/laerer/oppslag/actions.ts`
- Modify: `src/lib/dates.ts` + `src/lib/dates.test.ts` (`osloLocalToInstant`)
- Modify: `src/lib/dal/announcements.ts`
- Modify: `src/app/action-guards.test.ts` (73 → 76)

- [ ] **Step 1: Convert the picked time to an instant — then write the schemas**

⛔ **`new Date('2026-11-07T07:00').toISOString()` is WRONG, and it is wrong only in production.** A `datetime-local` input yields a bare wall-clock string with no zone; `new Date()` parses it in the **server's** timezone. Vercel runs UTC:

```
teacher picked 07:00 Oslo -> '2026-11-07T07:00'
toISOString()             -> '2026-11-07T07:00:00.000Z'
rendered back in Oslo     -> 07.11.2026, 08:00     ← an hour late
summer (2026-06-06T07:00) -> 09:00                 ← two hours late
```

D8's own example is «publiser lørdag 07:00». **This plan spends A8 closing exactly this hazard in SQL, and the first draft then reopened it in TypeScript** — in both the teacher and the admin action, and in the zod `refine`, which computes `Date.parse(v)` the same way, so inside the first hour or two the validator and `announcements_not_backdated` disagree about what "in the past" means. The dev machine runs Europe/Oslo, so **the walkthrough shows the right time and the defect ships**.

Add to `src/lib/dates.ts`, beside the six other Europe/Oslo pins:

```ts
/**
 * A `datetime-local` value («2026-11-07T07:00») is a wall-clock reading with no
 * zone. Read it as OSLO wall-clock and return the instant it names.
 *
 * ⚠ new Date(value) parses it in the SERVER's zone, and production runs UTC —
 * so a notice a teacher scheduled for 07:00 would publish at 08:00 (09:00 in
 * summer). The dev machine runs Europe/Oslo, which is why no walkthrough can
 * see this. Same lesson as osloDateOf and formatDateTimeNb, other direction.
 *
 * Returns an Invalid Date for anything that is not `YYYY-MM-DDTHH:mm`; callers
 * check with Number.isNaN(d.getTime()).
 */
export function osloLocalToInstant(value: string): Date {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return new Date(NaN);
  const [, y, mo, d, h, mi] = m;
  const naive = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  // The offset read AT the naive instant is right everywhere except inside the
  // one hour a DST shift moves; re-reading it at the corrected instant settles
  // that. Two passes, no dependency.
  const corrected = naive - osloOffsetMs(naive);
  return new Date(naive - osloOffsetMs(corrected));
}

/** How far ahead of UTC Oslo is at a given instant, in ms. */
function osloOffsetMs(utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Oslo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(utcMs));
  const at = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return Date.UTC(at('year'), at('month') - 1, at('day'),
                  at('hour'), at('minute'), at('second')) - utcMs;
}
```

And its tests in `src/lib/dates.test.ts` — these must hold **whatever zone the runner is in**, which is the whole defect:

```ts
describe('osloLocalToInstant', () => {
  it('reads a winter wall-clock as CET, not as the runner clock', () => {
    expect(osloLocalToInstant('2026-11-07T07:00').toISOString()).toBe('2026-11-07T06:00:00.000Z');
  });
  it('reads a summer wall-clock as CEST', () => {
    expect(osloLocalToInstant('2026-06-06T07:00').toISOString()).toBe('2026-06-06T05:00:00.000Z');
  });
  it('is invalid for a value that is not a datetime-local', () => {
    expect(Number.isNaN(osloLocalToInstant('i går').getTime())).toBe(true);
  });
});
```

⚠ Run them with `TZ=UTC npx vitest run src/lib/dates.test.ts` **as well as** the default. A test that only passes on a machine set to Europe/Oslo is precisely the instrument this defect defeated.

Then create `src/lib/validation/announcements.ts`:

```ts
import { z } from 'zod';
import { osloLocalToInstant } from '@/lib/dates';
import { uuidField } from './school';

/**
 * Mirrors the DB CHECK constraints exactly (1..140, 1..4000, and both bounds on
 * published_at) — one rule, two layers, never two rules. uuidField is z.guid,
 * not z.uuid: the seed's readable UUIDs fail the RFC 9562 variant nibble and
 * z.uuid() would reject every fixture.
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
 * ⚠ AND THE STRING IS READ AS OSLO WALL-CLOCK, NEVER WITH Date.parse. Date.parse
 * of a zone-less datetime-local uses the SERVER's zone, and production runs UTC
 * — so on Vercel this refine and announcements_not_backdated disagree by one or
 * two hours about what "in the past" means, and a time the teacher picked
 * half an hour ago sails through validation and schedules an hour late.
 *
 * The one-minute floor exists so the same Norwegian sentence covers both the
 * validation refusal and the 23514 a genuine race would still produce. The
 * 120-day ceiling mirrors announcements_schedule_bound (A1) — the CHECK is the
 * wall, but only this layer produces a sentence the teacher can act on, and
 * PG_ERROR.CHECK cannot tell the two constraints apart.
 */
const SCHEDULE_BOUND_MS = 120 * 24 * 60 * 60 * 1000;

export const announcementSchema = z.object({
  classId: z.union([uuidField, z.literal('')]).transform((v) => (v === '' ? null : v)),
  title: titleField,
  body: bodyField,
  publisertAt: z
    .string()
    .trim()
    .transform((v) => (v === '' ? undefined : v))
    .refine(
      (v) => v === undefined || !Number.isNaN(osloLocalToInstant(v).getTime()),
      'Ugyldig tidspunkt.',
    )
    .refine(
      (v) => v === undefined || osloLocalToInstant(v).getTime() > Date.now() + 60_000,
      'Publiseringstidspunktet må være minst ett minutt fram i tid.',
    )
    .refine(
      (v) => v === undefined || osloLocalToInstant(v).getTime() < Date.now() + SCHEDULE_BOUND_MS,
      'Et oppslag kan planlegges høyst 120 dager fram i tid.',
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
  /**
   * Whether ANY account exists that could open it on this pupil's behalf — a
   * guardian's or the pupil's own. False means `hasRead` can never become true,
   * so the screen must say «ingen pålogging» rather than list a name the office
   * is meant to chase (A3).
   */
  reachable: boolean;
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
      reachable: row.reachable,
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
import { osloLocalToInstant } from '@/lib/dates';
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
 *
 * ⚠ And when it is sent, it goes through osloLocalToInstant. `new Date(value)`
 * would read the picked wall-clock in the SERVER's zone, which is UTC on
 * Vercel — publishing «lørdag 07:00» at 08:00, or 09:00 in summer. A8 closes
 * this in SQL; this is the same hazard on the way in.
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
      ? { published_at: osloLocalToInstant(parsed.data.publisertAt).toISOString() }
      : {}),
  });
  if (error) {
    // ⚠ 23514 reaches here from FOUR constraints — the two published_at bounds
    // and the two length CHECKs — and the code cannot tell them apart. The
    // lengths are unreachable (zod runs first, with the same limits) and the
    // 120-day bound is unreachable for the same reason, so the only refusal
    // that realistically arrives is the back-dating race this sentence names.
    // If a length or bound ever does get here, the sentence is wrong rather
    // than dangerous — but that is why both limits are mirrored in zod.
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
 *
 * ⚠ The «skoleadministrasjonen» sentence below is a WALL-1 GUARD, not a screen.
 * AnnouncementControls only renders the withdraw button for a scheduled
 * announcement the caller authored, so the count===0 branch is reachable only
 * by a forged POST or a row that published between render and submit — and a
 * thrown Server Action error is redacted to a digest in production anyway, so
 * nobody would read this sentence. tests/api/announcements.test.ts asserts it;
 * do not add a permanently-failing button to the UI in order to see it.
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
      {/* canEdit comes from the can_edit_announcement RPC, which mirrors
          announcements_update_author. It is READ here — in the first draft the
          RPC ran on every detail view for every role and nothing consumed it. */}
      <AnnouncementControls announcement={announcement} />
      <ReadStatus rows={readStatus.get(announcement.id) ?? []} />
    </div>
  );
}
```

(add `import { AnnouncementControls } from './AnnouncementControls';` to that file.)

- [ ] **Step 6: Write the two shared components and the teacher's controls**

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
              <li key={r.studentId}>
                {r.displayName}
                {/* ⚠ A3. A pupil with no guardian account and no login of her
                    own can NEVER clear this list — «0 av 3» would sit at 0
                    forever with nothing on screen saying why, and the office
                    would keep phoning a family that has no account. The
                    denominator still counts her: she was in the class when the
                    notice went out, and that is what the office needs to know. */}
                {r.reachable ? null : (
                  <span className="text-ink/60"> · ingen pålogging</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
```

`src/app/(portal)/laerer/oppslag/[announcementId]/AnnouncementControls.tsx`:

```tsx
'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { useNoFormReset } from '@/lib/use-no-form-reset';
import { idleForm } from '@/lib/validation/school';
import type { AnnouncementDetail } from '@/lib/dal/announcements';
import { deleteAnnouncementAction, updateAnnouncementAction } from '../actions';

/**
 * Fix a typo, or withdraw something not yet published.
 *
 * ⚠ WITHOUT THIS COMPONENT THE PLAN DOES NOT HOLD TOGETHER: updateAnnouncement-
 * Action and deleteAnnouncementAction would have no caller at all (knip fails
 * an unused export at ERROR level), AnnouncementDetail.canEdit would be fetched
 * by an RPC on every detail view and read by nobody, and the walkthrough would
 * ask a human to click a «Trekk tilbake» control that does not exist.
 *
 * ⚠ `canEdit` is the can_edit_announcement RPC — a mirror of
 * announcements_update_author, asked rather than re-derived (D21). An admin
 * viewing a teacher's notice gets false: editing is authorship.
 *
 * ⚠ The withdraw button appears only for a SCHEDULED announcement. A published
 * one is admin-delete-only (A2), and offering a control that always fails is
 * the same defect as a picker that offers a class the wall refuses — worse
 * here, because a thrown Server Action error is redacted to a digest in
 * production, so the careful Norwegian sentence would never reach the teacher.
 * The action still checks; the screen just does not invite the refusal.
 */
export function AnnouncementControls({ announcement }: { announcement: AnnouncementDetail }) {
  const [state, formAction, pending] = useActionState(updateAnnouncementAction, idleForm);
  const formRef = useNoFormReset<HTMLFormElement>();
  const [title, setTitle] = useState(announcement.title);
  const [body, setBody] = useState(announcement.body);

  if (!announcement.canEdit) return null;

  return (
    <section className="flex flex-col gap-6 border-t border-hairline pt-6 print:hidden">
      <h2 className="font-medium">Rediger oppslaget</h2>
      <form ref={formRef} action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={announcement.id} />
        <Field label="Tittel" htmlFor="edit-title">
          <Input id="edit-title" name="title" value={title}
                 onChange={(e) => setTitle(e.target.value)}
                 maxLength={140} required />
        </Field>
        <Field label="Innhold" htmlFor="edit-body">
          <textarea id="edit-body" name="body" value={body}
                    onChange={(e) => setBody(e.target.value)}
                    maxLength={4000} rows={8} required
                    className="rounded-sm border border-border-input bg-canvas px-3 py-2" />
        </Field>
        {state.error ? (
          <p role="alert" className="text-sm text-danger-ink">{state.error}</p>
        ) : null}
        {state.success ? <p className="text-sm text-ink/60">Lagret.</p> : null}
        <div>
          <Button type="submit" loading={pending}>Lagre endringer</Button>
        </div>
      </form>

      {announcement.scheduled ? (
        <form action={deleteAnnouncementAction} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={announcement.id} />
          <p className="text-sm text-ink/60">
            Oppslaget er ikke publisert ennå. Det kan ikke flyttes til et annet
            tidspunkt — publiseringstidspunktet bestemmer hvilke familier som får
            se det — men det kan trekkes tilbake og skrives på nytt.
          </p>
          <div>
            <Button type="submit" variant="secondary">Trekk tilbake</Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
```

⚠ **Check `Button`'s prop surface before writing `variant="secondary"`.** The plan verified `Button {loading}` exists; it did not verify the variant names. Use whatever the repo has for a non-primary action, and if there is only one variant, say so and leave it plain.

⚠ **The two fields are controlled, and `useNoFormReset` needs them to be.** React 19 auto-resets a `<form action={fn}>` even when the action FAILS, so an uncontrolled edit form would throw away everything the teacher retyped the moment the update was refused — and `useNoFormReset`'s contract is fully-controlled fields, which is how the rest of this plan's forms are written.

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

⛔ **First, open an enrolment window, or steps 6 and every family check in Tasks 9–10 show nothing (A14).** Every seeded enrolment starts `2026-08-20`, so as of today **no family is in any class** and an announcement published now has an empty as-of roster. One statement, and it is an UPDATE — a second open enrolment for the same pupil violates `class_students_one_active`:

```bash
docker exec supabase_db_iqra-portal psql -U postgres -q -c \
  "update public.class_students set enrolled_on = current_date - 7
     where class_id = 'fc000000-0000-0000-0000-000000000001';"
```

⚠ **Put it back before running `npm run test:api`** (`update … set enrolled_on = '2026-08-20'` for the same class) — `tests/api/school-actions.test.ts:1105` asserts that literal date, and three other api files key off it. Or just `supabase db reset`, and re-enrol MFA afterwards.

A human logs in as `laerer@test.local` / `test-passord-123`, re-enrols MFA at `/mfa/registrer` if the last `db reset` wiped it, and checks:

1. `/laerer/oppslag` shows the empty state, «Oppslag» lit in the nav.
2. «Nytt oppslag» → publish immediately → the notice appears in the list, dated today. **This also proves `listPublishableClasses` returns rows** (step 2's open question).
3. Publish with a datetime one week out → the row shows «Planlagt» and the date **and time**. ★ **Read the time back and check it is the time you picked**, not an hour later — that is the `osloLocalToInstant` fix from step 1, and the dev machine's Europe/Oslo clock hides the bug it replaced. (To see the production behaviour, run the dev server with `TZ=UTC npm run dev` once.)
4. ★ **The refusal path.** Blank the title and submit; when the error appears, confirm **the class select still shows the class you chose**. This is plan 1's wrong-child bug transposed to a wrong-class one, and it is the single most valuable thing to click.
5. Open the **scheduled** one → the edit form is there and «Trekk tilbake» removes it. Open the **published** one → the edit form is still there (you wrote it) and **there is no «Trekk tilbake» at all**: a published announcement is admin-delete-only (A2), and the plan deliberately does not render a control that always fails. The refusal sentence behind it is asserted in `tests/api/announcements.test.ts`, not on screen.
6. The read-tracking block reads «0 av N familier har lest» with N = the class roster **you just back-dated**, and it lists the families by name. If N is 0 the window above did not take.

⚠ Synthetic clicks do not fire this app's React handlers — a human clicks, you measure.

- [ ] **Step 9: Commit**

```bash
cd ~/dev/iqra-portal
git add src/lib/validation/announcements.ts src/lib/dal/announcements.ts \
        src/lib/dates.ts src/lib/dates.test.ts \
        src/components/announcements/AnnouncementBody.tsx src/components/announcements/ReadStatus.tsx \
        "src/app/(portal)/laerer/oppslag/ny/page.tsx" "src/app/(portal)/laerer/oppslag/ny/NewAnnouncementForm.tsx" \
        "src/app/(portal)/laerer/oppslag/[announcementId]/page.tsx" \
        "src/app/(portal)/laerer/oppslag/[announcementId]/AnnouncementControls.tsx" \
        "src/app/(portal)/laerer/oppslag/actions.ts" \
        src/app/action-guards.test.ts
git commit -m "feat(oppslag): publish, schedule, withdraw — and see who has read it"
```

Body must state: why `published_at` is omitted for an immediate publish; **why a picked time goes through `osloLocalToInstant` rather than `new Date()`, and that the dev machine's clock is why the walkthrough could not have caught it**; that both the update and the delete check `count` because RLS refusals in those commands are filtered rather than raised; that the withdraw control renders only for a scheduled announcement, so the refusal sentence is a wall-1 guard rather than a screen; and that the form uses `useNoFormReset` because it carries a `<select>`.

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

⚠ **No `<ReadStatus>` on a family surface.** `announcement_read_status` returns nothing to a guardian (assertion 62 pins it), so rendering it would be a permanently empty block — and read-tracking is who the office should phone, not something families see about each other.

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

⛔ **The Klasse-1 enrolment window from Task 8 step 8 must still be open, or items 1–3 show an empty list and prove nothing** (A14). `forelder@`'s child Yusuf and `elev@`'s own login both hang off `fc000000-…-0001`; with the seed's `2026-08-20` enrolment date, the as-of audience of anything published today is empty and **the family list is correctly empty for the wrong reason**. Re-run the `update … set enrolled_on = current_date - 7` from Task 8 if the database has been reset since.

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
- Create: `src/app/(portal)/admin/oppslag/page.tsx` + `[announcementId]/page.tsx` + `[announcementId]/AnnouncementControls.tsx` + `ny/page.tsx` + `ny/NewSchoolAnnouncementForm.tsx` + `actions.ts`
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
import { osloLocalToInstant } from '@/lib/dates';
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
    // ⚠ osloLocalToInstant, not new Date(): the picked value is Oslo
    // wall-clock and the server is UTC in production. Same as the teacher's.
    ...(parsed.data.publisertAt
      ? { published_at: osloLocalToInstant(parsed.data.publisertAt).toISOString() }
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

`src/app/(portal)/admin/oppslag/[announcementId]/page.tsx` — the teacher's detail page with `requireStaffRole('admin')` and `basePath` `/admin/oppslag`. It keeps `<ReadStatus>`: for a school-wide announcement the roster is every enrolled pupil at publication, which is exactly the «who do we phone» list D12's no-e-mail ruling makes the office's only instrument. It renders its own `AnnouncementControls`, imported from `./AnnouncementControls` — **not** the teacher's, which imports the teacher's actions.

`src/app/(portal)/admin/oppslag/[announcementId]/AnnouncementControls.tsx` — the teacher's component with three differences:

- it imports `../actions` from **admin**, so `requireStaffRole('admin')` is the guard;
- the delete form is rendered **unconditionally**, not only for a scheduled row — `announcements_delete_admin` has no `published_at` condition, and removing a published notice is the one thing only an admin can do. Label it «Slett oppslaget», and put the consequence next to it: *«Oppslaget forsvinner for alle, og registreringen av hvem som har lest det forsvinner med det.»* (the `announcement_reads` cascade);
- the edit form is still gated on `canEdit`, which for an admin viewing a **teacher's** notice is `false`. There is no admin override and that is deliberate — see the note below.

⚠ **Do not "fix" the missing edit form for admins by widening `can_edit_announcement` or `announcements_update_author`.** An edit changes what the school said without changing whose name is on it.

- [ ] **Step 5: Nav, and the stale comment**

In `AdminNav.tsx`, add after «Meldinger»:

```ts
  { href: '/admin/oppslag', label: 'Oppslag', exact: false },
```

and rewrite the comment above the «Meldinger» entry, which currently says it is *"Last, as on the other three navs"*.

⚠ **Do not replace it with «Meldinger and Oppslag are the last two on all four navs» — that would be false too.** The original sentence was **already false before this plan**: `LaererNav` is I dag · Oppgaver · **Meldinger** · **Vurdering**, so Meldinger is last on three navs, not four. Task 7 then put Oppslag between Meldinger and Vurdering. The true sentence is:

```ts
  // Oppslag sits directly after Meldinger on all four navs. On ForelderNav,
  // ElevNav and here it is the last item; on LaererNav both are followed by
  // Vurdering. `exact: false` on both so the pill stays lit inside a thread or
  // an announcement — with `exact: true` an admin reading one would see
  // nothing marked current at all.
```

⚠ `AdminNav` is also the only one of the four whose `<nav>` lacks `className="print:hidden"`. Leave it — fixing it is unrelated to this plan and belongs in its own commit.

- [ ] **Step 6: Bump the action count and verify**

`toBe(76)` → `toBe(79)`.

```bash
cd ~/dev/iqra-portal && npm run typecheck && npm run lint && npm run knip && npm test && npm run build
```

A human, as `admin@test.local` / `test-passord-123` (re-enrol MFA first, and keep Task 8's enrolment window open — item 5 counts an as-of roster, so with the seed's dates it is empty; A14):

1. `/admin/oppslag` lists **every** announcement in the school, including the teacher's and every scheduled one.
2. «Nytt oppslag» → «Hele skolen» → the warning line appears → publish → it shows in the parent's and the pupil's lists too.
3. ★ Choose a class, blank the title, submit — and confirm the select still says that class, **not** «Hele skolen». This is the highest-severity refusal path in the plan.
4. Open a **teacher's** announcement as admin: **there is no edit form at all** (`can_edit_announcement` is false — editing is authorship, and an admin corrects by deleting and writing their own), and the delete control works. Then open one the admin wrote: the edit form is there.
5. The read-tracking block on the school-wide announcement lists every enrolled pupil, and any pupil with no guardian account and no login of their own is marked «ingen pålogging» rather than sitting silently in the unread list.
6. `/admin/oppslag` and a detail page at **1280 and 375**.

- [ ] **Step 7: Commit**

```bash
cd ~/dev/iqra-portal
git add "src/app/(portal)/admin/oppslag" src/lib/dal/announcements.ts \
        "src/app/(portal)/admin/AdminNav.tsx" src/app/action-guards.test.ts
git commit -m "feat(oppslag): the whole school, and a publish time chosen in advance"
```

Body must state that an admin may delete but not edit another author's announcement, why that is the same argument as D5, and that the AdminNav comment it rewrote had been false since before this plan (Meldinger was last on three navs, not four).

---

## Task 11: the wall-1 api suite

**Files:**
- Create: `tests/api/announcements.test.ts`

pgTAP 37 proves the **database** refuses. This proves the TypeScript in front of it never hands the database a request that should not have been made, and never turns a refusal into something the caller cannot act on — a different failure mode, so a green pgTAP run does not imply it.

- [ ] **Step 1: Read the harness and the seed ids you need**

```bash
cd ~/dev/iqra-portal && sed -n '1,60p' tests/api/threads.test.ts && grep -n "fc000000\|Klasse" supabase/seed.sql | head -20
grep -n "enrolled_on" supabase/seed.sql tests/api/*.test.ts | head -20
```

You need the exact class ids and which teacher teaches which. ⚠ **Do not guess them from this document** — plan 1's ledger records four separate defects that came from a plan asserting a repo fact it had not read. (Verified 2026-08-06: `KLASSE_1 = 'fc000000-0000-0000-0000-000000000001'` taught by `laerer@`, `KLASSE_3 = 'fc000000-0000-0000-0000-000000000002'` taught by `laererforelder@` — `supabase/seed.sql:108-109`.)

⛔ **And you need to know that this file cannot work over the seed as it stands (A14).** Every seeded enrolment starts `2026-08-20`; today is earlier; so the as-of roster of anything published now is **empty**, and three of the tests below fail or pass vacuously for reasons that have nothing to do with the code they claim to guard. The second grep tells you which other api files pin the seed's date — at the time of writing `school-actions.test.ts:1105` asserts `'2026-08-20'` verbatim, and `assignments-core`, `assignments-actions` and `attendance-core` key off it. **That is why this file opens its own window and closes it again rather than moving the seed.**

The harness is `tests/api/harness.ts`: it **mocks** `@/lib/supabase/server` with `createServerClientMock` and calls actions and DAL functions **directly**. There is no `signIn()`, no `serviceClient()` export, and no PostgREST driving. Copy the four-`vi.mock` preamble from `threads.test.ts` verbatim.

- [ ] **Step 2: Write the suite**

```ts
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
import {
  createAnnouncementAction,
  deleteAnnouncementAction,
} from '@/app/(portal)/laerer/oppslag/actions';
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

/**
 * ⛔ THE SEED ENROLS NOBODY UNTIL 2026-08-20, SO NOTHING BELOW WOULD WORK (A14).
 *
 * The announcement audience is resolved AS OF published_at (D9), and the two
 * new helpers are the first in this repo anchored on now(). Every seeded
 * class_students row starts 2026-08-20; before that date the as-of roster of an
 * announcement published *now* is EMPTY. Without this window:
 *   · «the read records itself» gets null from getAnnouncement and fails;
 *   · «read-tracking is staff-only» throws TypeError on `.get(id)!.length`;
 *   · and the scheduling test's «a family cannot read it» passes VACUOUSLY —
 *     it would pass with `pub <= now()` deleted from the read predicate, which
 *     is the one deletion that assertion exists to notice.
 * The whole pgTAP suite stays green throughout: file 37's fixture is hermetic
 * and now()-relative, so the DB tests cannot see this at all.
 *
 * ⚠ UPDATE, never INSERT: class_students_one_active is
 * UNIQUE (student_id) WHERE (left_on IS NULL), so a second open enrolment for
 * the same pupil raises 23505.
 * ⚠ And it must be restored: school-actions.test.ts asserts enrolled_on ===
 * '2026-08-20' verbatim, and three other api files key off the same dates.
 * `fileParallelism: false` (vitest.config.api.ts) is what makes that safe —
 * files run one at a time, so no other file can observe the window. If this
 * file is ever run with parallelism on, or the process is killed mid-file, run
 * `supabase db reset` before trusting the rest of the suite.
 */
const KLASSE_1_ENROLLED_ON = '2026-08-20';

beforeAll(async () => {
  const service = scaffoldingServiceClient();
  const openedOn = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const { error } = await service
    .from('class_students')
    .update({ enrolled_on: openedOn })
    .eq('class_id', KLASSE_1);
  if (error) throw new Error(`Kunne ikke åpne påmeldingsvinduet: ${error.message}`);
});

afterAll(async () => {
  const service = scaffoldingServiceClient();
  await service
    .from('class_students')
    .update({ enrolled_on: KLASSE_1_ENROLLED_ON })
    .eq('class_id', KLASSE_1);
});

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

    // ★ THIS TEST'S OWN POSITIVE CONTROL, IN THE SAME it(), AS THE SAME ACTOR.
    // Without it the whole test passes under a TOTAL creation outage: the
    // action converts every 42501 into exactly the sentence above, and "no row"
    // is satisfied by the outage too. That is F6 from plan 1's panel,
    // reproduced inside the file whose header claims to have eliminated it —
    // and step 4 below could not have caught it, because step 4 IS the outage.
    const ok = await createAnnouncementAction(
      idleForm,
      form({ classId: KLASSE_3, title: `${SCRATCH}egen`, body: 'x', publisertAt: '' }),
    ).catch((e: Error) => e);
    expect(String(ok)).toContain('NEXT_REDIRECT:/laerer/oppslag');
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
    // ANYONE would pass the assertion above. ⚠ It is also the assertion that
    // depends on beforeAll's enrolment window: with the seed's own dates the
    // Map has no entry for the teacher either, and this line throws TypeError
    // rather than failing — which reads as a broken test, not a missing roster.
    //
    // ⚠ THE EXACT ROSTER, NOT toBeGreaterThan(0) (corrected 2026-08-05). This
    // is the one assertion in the file whose whole job is to tell «correctly
    // refused» from «nothing works», and `> 0` is the weakest form of it:
    // one row of a two-pupil class satisfies it, so a roster silently halved by
    // an as-of bug reads as green here. Klasse 1 seeds TWO pupils (verified
    // against the live database, 2026-08-05); if the seed grows, this number
    // moves with it and that is the point.
    await signInAsAAL2('laerer@test.local');
    expect((await getReadStatus([id])).get(id)!).toHaveLength(2);
  });
});

describe('the filtered delete', () => {
  it('withdraws the author\'s scheduled notice and refuses her published one', async () => {
    const service = scaffoldingServiceClient();
    const when = new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);

    await signInAsAAL2('laerer@test.local');
    await createAnnouncementAction(
      idleForm,
      form({ classId: KLASSE_1, title: `${SCRATCH}slett-planlagt`, body: 'x', publisertAt: when }),
    ).catch(() => undefined);
    await createAnnouncementAction(
      idleForm,
      form({ classId: KLASSE_1, title: `${SCRATCH}slett-publisert`, body: 'x', publisertAt: '' }),
    ).catch(() => undefined);

    const { data: rows } = await service
      .from('announcements').select('id, title').like('title', `${SCRATCH}slett-%`);
    const scheduled = rows!.find((r) => r.title.endsWith('planlagt'))!.id;
    const published = rows!.find((r) => r.title.endsWith('publisert'))!.id;

    // A2's positive control: her own unpublished notice goes.
    await expect(
      deleteAnnouncementAction(form({ id: scheduled })),
    ).rejects.toThrow(/NEXT_REDIRECT/);
    const { data: gone } = await service.from('announcements').select('id').eq('id', scheduled);
    expect(gone).toHaveLength(0);

    // ⚠ And the refusal is BY EFFECT, not by an exception RLS never raises: a
    // filtered DELETE returns OK with rows=0. The sentence exists because the
    // action checks `count`, which is the only way to tell the two apart.
    await expect(
      deleteAnnouncementAction(form({ id: published })),
    ).rejects.toThrow(/skoleadministrasjonen/);
    const { data: survived } = await service.from('announcements').select('id').eq('id', published);
    expect(survived).toHaveLength(1);
  });
});
```

⚠ `deleteAnnouncementAction` returns `Promise<void>` and signals success by `redirect()`, which the harness's `redirectMock` throws — so **both** arms above are `rejects.toThrow`, and only the message tells them apart. Add it to the import from `@/app/(portal)/laerer/oppslag/actions`.

⚠ `when` is a **UTC-shaped** `YYYY-MM-DDTHH:mm` string standing in for a `datetime-local` value, which the action reads as Oslo wall-clock. That shifts the real publication time by an hour or two — irrelevant here, since the assertion is only "in the future and unstamped", and deliberately so: a test that pinned the exact instant would be pinning `osloLocalToInstant`, whose own tests live in `src/lib/dates.test.ts` where they can run under `TZ=UTC`.

⚠ `createAnnouncementAction` **redirects on success**, which the harness's `redirectMock` turns into a thrown `NEXT_REDIRECT:` error. Every success path above therefore either asserts the thrown string or uses `.catch(() => undefined)` when the redirect is incidental. **The first test must assert the string** — swallowing it there is exactly how F6's outage hid.

- [ ] **Step 3: Run it**

```bash
cd ~/dev/iqra-portal && eval "$(supabase status -o env | sed 's/^/export /')" && npm run test:api
```

Expected: the whole api suite green. Budget **21 minutes** and expect no output until it finishes. ⚠ The suite is **not flaky** — apparent flakiness is GoTrue session churn, and it resets between runs.

- [ ] **Step 4: ★ Prove the positive controls do their job**

Break creation on purpose — set `announcements_insert_staff` to `with check (false)` — and re-run just this file.

⛔ **"Every test must fail" is the wrong instruction, and the first draft's version of this step would have been passed by a suite with a hole in it.** Under a total creation outage:

| test | under the outage | why |
|---|---|---|
| publishes to a class the teacher actually teaches | **must fail** | no `NEXT_REDIRECT` |
| refuses a class the teacher does not teach | **must fail** | only because of the Klasse-3 control added inside it — without that line it passes, since the action turns every 42501 into the asserted sentence and "no row" is satisfied by the outage |
| accepts a future time, unstamped and unreadable | **must fail** | `data` is empty |
| the enumeration-quiet null | **must fail** | `data![0]` throws |
| the read records itself | **must fail** | `data![0]` throws |
| read-tracking is staff-only | **must fail** | `data![0]` throws |
| the filtered delete | **must fail** | neither row is created |
| refuses the whole school before it reaches the database | **stays green — expected** | pure zod/branch, never reaches the DB |
| refuses a past time | **stays green — expected** | pure zod, never reaches the DB |

So: **seven of the nine must fail; the two pure-validation tests are expected to stay green.** If any of the seven stays green, it is asserting an outage rather than a wall — F6 reproduced — and the fix is a discriminator inside that same `it()`, not a note in the commit body. Restore the policy by re-running the migration and confirm with:

```bash
docker exec supabase_db_iqra-portal psql -U postgres -q -t -A -c "select pg_get_expr(polwithcheck, polrelid) from pg_policy where polname='announcements_insert_staff';"
```

- [ ] **Step 5: Commit**

```bash
cd ~/dev/iqra-portal
git add tests/api/announcements.test.ts
git commit -m "test(oppslag): wall-1 assertions for publication, scheduling and the quiet null"
```

Body must state that every refusal block carries a positive control **inside its own `it()`**, that seven of the nine tests were watched fail under a `with check (false)` policy and which two were expected to stay green and why, and that the file opens and restores its own enrolment window because the seed enrols nobody until 2026-08-20 (A14).

---

## Assertion numbering in file 37, across tasks

The file is written once in Task 1 and grown twice. **Inserting §H and §I renumbers §J**, so a mutation table written for an earlier task refers to §J at numbers that later move:

| after | §A | §B | §C | §D | §E | §F | §G | §H | §I | §J | `plan()` |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Task 1 | 1–5 | 6–15 | 16–20 | 21–24 | 25–33 | 34–38 | 39–46 | — | — | 47–51 | 51 |
| Task 4 | 1–5 | 6–15 | 16–20 | 21–24 | 25–33 | 34–38 | 39–46 | 47–66 | — | 67–71 | 71 |
| Task 5 | 1–5 | 6–15 | 16–20 | 21–24 | 25–33 | 34–38 | 39–46 | 47–66 | 67–72 | 73–77 | 77 |

⛔ **This table was wrong for Tasks 4 and 5 until 2026-08-05, and the way it was wrong is worth keeping.** It put §H at 48–60 when §G ended at 42 — five numbers that belonged to nothing — and then reported `plan(60)` on a row whose own last assertion was 65. Every §H and §I number in Tasks 4 and 5 inherited the error. It was found by assembling the file verbatim from this document and **running it**: pgTAP prints `ok N - <description>`, so the true mapping is not a thing to derive twice.

★ **Measured 2026-08-05, twice.** The assembled file returned **71 of 71** green before the three decisions and **77 of 77** after them, with every section landing exactly where the Task-5 row says. The second run is the current one; the first is recorded because it is what the numbers below were checked *against*.

⚠ **The three decisions moved almost every number in this file, and that is why they were taken before execution rather than after.** §B gained two assertions (D-B's 10-is-now-0 pair) and §C one; §H gained four (D-A's name gate). Everything from §C onward shifted by two or three, and §H's own tail by four — 60 individual references in five mutation tables, three landing lists, two section-header comments and this table. After execution that is a merge nobody would attempt, which is the whole argument for the ledger rule.

⚠ **§H and §I are INSERTED before §J, not appended after it.** So §J's five assertions move twice — 47–51, then 67–71, then 73–77 — while everything above §H never moves at all. A mutation table that names §J at the wrong task's numbers is the failure mode this table exists to prevent.

⚠ **And §J's own header comment inside the file moves with it.** Task 1 writes `-- ── §J 47-51 the delete pair ──`; Task 4 rewrites it to **67-71** and Task 5 to **73-77**. Do it in the same edit that inserts the new section, not afterwards — a section header that disagrees with the assertion numbers is how the next reader mis-attributes a failure, and it costs nothing to keep right.

Section sizes: §A 5 · §B 10 · §C 5 · §D 4 · §E 9 · §F 5 · §G 8 · §H 20 · §I 6 · §J 5 = **77**.

Each task's mutation table uses the numbering **as of that task**. If you re-run Task 1's mutations after Task 5 has landed, its §J references (47, 48, 49) are now **73, 74 and 75**, and its §A–§G references have not moved at all. Task 4's §J references (67–71) become 73–77 the same way.

⚠ **§H must be inserted after §G, and §I after §H, both before §J.** §H's «exactly two families have read it» depends on the two read rows §G's assertions 39 and 43 insert — one guardian's and one pupil's own. §J is order-independent by construction — it operates on `…046` and `…047`, which nothing else touches — except that §G's three read-visibility assertions (44–46) read `…046`'s read row, so they must stay ahead of §J's deletes. Keeping §J last satisfies both.

---

## Exit criteria for this plan

Not the phase's exit gate (that is plan 4) — these are the conditions for calling plan 2 done.

- [ ] `supabase db reset && supabase test db --local` → **one more file than the Task 0 baseline**, `Tests=` baseline + 77 (file 37) + 8 (file 34) + 9 (file 31), `Result: PASS`.
- [ ] `npm test` → all pass; the count has risen by the nav and component tests, the three `audienceLabel` cases and the three `osloLocalToInstant` cases added here. Run the date tests under `TZ=UTC` as well as the default — that is the whole point of them.
- [ ] `npm run test:api` → all pass (budget 21 min), **and `class_students.enrolled_on` for Klasse 1 is back to `2026-08-20` afterwards** (`select enrolled_on from public.class_students where class_id = 'fc000000-0000-0000-0000-000000000001';`). Task 11 opens that window in `beforeAll` and closes it in `afterAll`; if a run is interrupted, `supabase db reset` before trusting `school-actions.test.ts`.
- [ ] `npm run typecheck` → 0 · `npm run lint` → 0 errors · `npm run knip` → only the pre-existing findings · `node scripts/audit-gate.mjs` → pass.
- [ ] `npm run build` → clean. Stop the dev server first.
- [ ] `action-guards.test.ts` asserts **79**, and the number was reached by two deliberate bumps (Tasks 8 and 10), each stated in its commit body.
- [ ] `29_definer_fingerprints.sql` asserts the value **measured** after Task 6 — predicted **83** here, and 34 of those pairs are this plan's — not the one predicted here, and the commit body says which. Its «the live SECURITY DEFINER count is 52» prose reads 60 in both places (verified: eight new definer functions, and D-A and D-B added none).
- [ ] Every ★ mutation in Tasks 1–6 was run — **28 in Task 1, 8 in Task 2, 6 in Task 3, 18 in Task 4, 5 in Task 5, 3 + the header-only F1 probe in Task 6** — each reddened **alone** (where a table names two or more, exactly those), and each restore was verified by an object-definition diff, not merely issued. Record which, in the final commit body. **The eight added by D-A and D-B (Task 1's 25–28, Task 4's 15–18) each redden exactly one assertion**; if any of them reddens two, the fixture has drifted.
- [ ] ✅ **The three decisions at the top of this plan are CLOSED — answered by the user on 2026-08-05, before Task 1 was written**, and each is already in the migrations, the fixture and the assertions above. Nothing here is left for an executor to decide. What the executor must not do is *undo* one by accident: **D-A** is the `case` in `20260806121000`'s select list plus §H's two extra fixture pupils (assertions 49, 50, 51, 64); **D-B** is the three-branch guard on `reads_announcement_row`'s `cls is null` arm (assertions 08, 10, 11, 17, 18, 19); **D-C** is the *absence* of a publication-state bound on `announcements_update_author` — it is a decision, not an omission, and «leaves broken» says what it costs.
- [ ] The three `has_function_privilege('anon', …)` assertions (§A 05, §H 66, §I 68) exist and were each watched fail under a `grant execute … to anon`. Nothing else in the suite sweeps function ACLs (standing rule 14).
- [ ] A human has clicked all four surfaces at 1280 and 375, after re-enrolling MFA **and after opening the Klasse-1 enrolment window** (A14 — without it every family surface is correctly empty and proves nothing). Specifically: a teacher publishes and schedules; **the scheduled time reads back as the time that was picked**; **a refused publish leaves both selects showing what was chosen**; a parent and a pupil see the published notice and not the scheduled one; the admin publishes school-wide and every role sees it; the admin can delete a teacher's notice and has no edit form for it; the read count moves when a parent opens it. **And one D-A item:** open the read-tracking block for a class the signed-in teacher no longer teaches (or ask an admin to look at the same announcement) — a protected pupil in that as-of roster must read «Skjermet elev» for the former teacher and her real name for admin.

---

## What this plan deliberately leaves broken

Say these out loud when handing over, so nobody reports them as defects.

- **Nothing notifies anyone.** No `notifications` row, no varsel bell, no e-mail. The only way to discover an announcement is to open the surface. Plan 3.
- **`public.claim_due_announcements()` has no caller.** It is built, granted and asserted, and nothing runs it — there is no drain until plan 3, and plan 3 must extend the function's body rather than call it and fan out separately.
- ★ **This repo has no scheduling mechanism of any kind, and plan 3 has to build two firsts.** Measured 2026-08-05: `vercel.json` is `{"regions":["arn1"]}` with **no `crons` key**; `pg_cron` is available at **1.6.4 with `installed_version` NULL**, i.e. not installed; and `find src/app -name route.ts` returns **zero** — there is not one route handler in the entire application. So plan 3 must write **the repo's first API route and its first cron entry** before `claim_due_announcements()` can ever run, plus whatever shared secret protects that route from being called by anyone who guesses the path. Budget it as a task, not as a line: it is new surface in two systems, and neither has a precedent here to copy.
- **`announcements.created_by → public.profiles` is `ON DELETE RESTRICT`, so a staff profile that has ever published cannot be deleted.** No live consequence in this plan — nothing deletes profiles — but plan 4's exit gate and any future offboarding inherit it. The alternative (`set null`) would erase the byline of every notice that person ever sent, which is the same argument the `class_id` RESTRICT rests on. Recorded so it is a decision rather than a surprise.
- **A scheduled announcement still publishes if the scheduler never runs.** `reads_announcement_row` keys on `published_at`, not on `fanned_out_at`, so the notice appears on time; only the notification is missing. **In this plan, that is every scheduled announcement, because there are no notifications at all.** Nothing on any screen observes the size of that backlog — the health number belongs with the drain.
- **A scheduled announcement cannot be rescheduled.** `published_at` has no UPDATE grant, so the only correction is withdraw-and-rewrite. The author may withdraw their own unpublished one; a published one is admin-delete-only.
- ★ **A published announcement stays editable, so read-tracking means read-of-*a*-version** — **D-C, the user's decision of 2026-08-05.** The author may rewrite `title` and `body` after publication, because a school must be able to fix a typo or a wrong time in a notice it has already sent. The `announcement_reads` rows survive the edit (measured), so «12 av 28 har lest» can be true of words those twelve never saw. **And the audit log cannot supply the difference**: `audit_row_change` records ids and changed column *names* only, so it says an edit happened, by whom, to which columns, and never what the text was before. The fix, when this bites, is a version row — **not** `and published_at > now()` on the update policy, which would make the `title`/`body` grants dead for every published row and leave withdraw-and-rewrite (which destroys the read rows too) as the only way to correct a comma.
- ★ **A family that leaves stops receiving school-wide notices the day their enrolment closes** — **D-B**, and it is the intended behaviour rather than a gap. The class arm stays as-of, so they keep reading the class notices published while they were here (assertion 11); the school-wide arm is live, so they receive nothing new (assertion 10). Two consequences worth saying out loud: a family in a **notice period** — enrolment ending next month, `left_on` already set — is still live and still receives everything, because the spelling is `left_on is null`; and a family whose enrolment starts **next month** already receives school-wide notices, for the same reason. That is the house's live spelling (`private.guardian_in_class` never looks at `enrolled_on` either), and assertion 08 is the witness for it. If the school wants «not until the first day», that is an `enrolled_on <= current_date` conjunct in one place plus a new assertion — and it makes every family surface empty out of the box, which A14 already makes true of the class arm.
- ★ **`announcement_read_status` still tells a former teacher that a protected pupil was on that roster** — **D-A's residual.** The name is gated to «Skjermet elev» for a caller `public.students` would refuse, but the **row** stays (the denominator is the office's number) and it still carries the pupil's `student_id`. So a teacher who no longer teaches the class learns that one of the pupils in that as-of roster is under protection, which `students_select_taught_ever` withholds. The alternative — omitting the row, which is what `20260803001000` does for the **cross-family** mate list — was considered and rejected: it breaks the count the office acts on. **And the gate fails closed in one rare shape:** a teacher who still teaches the class but whose own protected child has left it sees «Skjermet elev» for her own child, because the gate mirrors two of `students_select_related`'s four arms and `is_guardian_of` is not one of them. ⛔ **And the user's larger question, whether `protected` could be removed from the product altogether, is DEFERRED as its own scoped task**: it is not legally mandated, but *beskyttet identitet* (kode 6/7) arrives without warning, and removing it means surgery on shipped, CI-green Phase-4 code — `20260721120712_attendance_visibility.sql` and `20260803001000_protected_mate_omission.sql` plus their pgTAP coverage. **This plan removes nothing.**
- **`okonomi` has no announcement surface.** The policy admits economy to school-wide notices (D17) and `reads_announcement_row`'s `cls is null` arm is unconditional — but `src/app/(portal)/okonomi/` has no nav component and one page, so there is nowhere to put the route. Building one means inventing an `OkonomiNav`, which belongs with whatever gives økonomi a real surface, not here.
- **Deleting a class that has ever been announced to now fails.** `announcements.class_id` is `on delete restrict`, so `deleteClassAction` (`src/app/(portal)/admin/klasser/actions.ts:87`) will raise `23503` and surface as «Kunne ikke slette klasse: …». That is the intended trade — an announcement is a record of what the school told a family — but the message is a raw database error and the admin flow has no branch for it. **Fixing the message is a one-line `PG_ERROR.FOREIGN_KEY` branch in that action and it is deliberately not done here**, because it touches a Phase-3 surface this plan otherwise leaves alone.
- **`announcements.body` is free text no pupil-keyed erasure reaches**, and `announcement_reads` rows keyed to a *pupil's own login* survive the `students` cascade, because `student_user_id` is `on delete set null`. Both are spec §10.11 items and both belong to Phase 7's retention job. This plan makes them possible to sweep (`service_role` holds `select, delete` on both tables) and sweeps nothing.
- **The announcement lists are unpaginated, and the read policy is not inlinable.** `listAnnouncements()` selects every announcement the caller may read, and `reads_announcement_row` is SECURITY DEFINER with `set search_path = ''`, so PostgreSQL calls it **once per row scanned** — measured at roughly 20 buffer hits and ~2 ms per candidate on the dev host, and each call may fan out to three more definer helpers. At this school's volume (a few notices a week) that is nothing; over several years of history it becomes a visibly slow parent page. The `(published_at desc)` index is there for it, and the fix when it bites is a `.limit()` plus «vis eldre», not a widened policy. **Plan 3 inherits the sharper version of this** — see A7's narrow-then-filter note, because its recipient query runs inside the announcement INSERT's own transaction.
- **A scheduled announcement addresses a roster nobody can see yet, and the author cannot correct it — only withdraw it.** `published_at` moves the audience in **both** directions (A1): forward-dating drops families whose enrolment closes before the new date and adds families who join after today. The 120-day CHECK bounds how far that can reach, and A2's withdraw path is how it is undone. Nothing on any screen previews «who would get this if I schedule it for March», and read-tracking deliberately shows nothing for an unpublished row. If the school starts scheduling months ahead, that preview is the next thing to build.
- **`announcement_read_status` names (or, for a protected pupil the caller no longer teaches, does not name) pupils the school cannot reach through the portal at all.** A pupil with no guardian account and no login of her own can never clear the unread list; the `reachable` flag makes the screen say «ingen pålogging» instead of pretending. **What it does not do is fix the underlying gap** — those families exist because nobody has been invited yet, which is plan 4's invite/credential flow.
- **A departed family sees «Klasseoppslag» instead of the class name.** `audienceLabel` degrades to a true, vaguer word rather than the false «Hele skolen» (see Task 7 step 2). Recovering the real name would need a definer projection over `classes` — the `thread_counterparts` pattern again — and that is a schema + RLS change this plan does not make.
- **No announcement is seeded, and no enrolment is moved.** `supabase/seed.sql` is untouched on purpose — see the scope note and A14. The consequence is that **every family-facing surface is empty out of the box until somebody back-dates an enrolment**, which is a trap for the next person who opens the portal expecting to see something. The api suite opens and closes its own window; the walkthrough tells the human to. Neither is a fix, and the real fix — a seed whose dates are relative to `current_date` — is a change to five committed api assertions and belongs in its own commit.
- **The Norwegian copy is a draft.** §12 Q3 is answered only in part: the user has not edited these strings and the board has not seen them. The disclosure block's copy-and-policies-are-one-change rule (§4.2) applies to the empty-state sentence «Du får ikke e-post om oppslag» too — it is true only because of D12.

---

## Plan review ledger — 2026-08-06

Reviewed against the goal before any code, per CLAUDE.md. **Two rounds.**

**Round 1** — a focused pass in the main loop plus one lens dispatched
mid-write: **seven defects**, six of them in material the plan had already
written and read as correct.

**Round 2** — the full panel CLAUDE.md calls for on RLS plans: three independent
lenses over the round-1 document — **assertion vacuity** (9 findings),
**RLS / privilege escalation** (7), **repo integration** (5 + 5 minors). Every
finding marked *proved* was executed against the live database, most inside
`begin; … rollback;` replays of the three migrations verbatim. **All 21 were
applied.** The round-2 tables are below the round-1 one.

★ **Across both rounds, almost every finding came from running something rather
than from re-reading the plan.** That is now the sixth round on this project
where checking a claim against the repo — not against the plan's own internal
consistency — is what found the defect. The rest came from tracing a mutation's
*effect* by hand instead of trusting the sentence that named it.

### Round 1 — the focused pass and one lens

⚠ Assertion numbers in **all three round tables** are historical — round 1's are the round-1 file's (39 → 47 → 52), round 2's are the numbering as it stood before round 3 corrected it, and **round 3's are the pre-decision numbering (49 → 65 → 71)**. The current numbering is the one in «Assertion numbering in file 37, across tasks» — **51 → 71 → 77**, measured rather than derived, after D-A and D-B added five assertions between them. The findings below are unchanged; only their addresses moved.

| # | Defect | How it was caught | Consequence if executed |
|---|---|---|---|
| 1 | ★★ **`classes` carries LIVE select policies for families, so the class-name embed is NULL for anyone whose enrolment has closed** | Read `pg_policy` for `public.classes`: `classes_select_guardian` → `private.guardian_in_class`, `classes_select_student` → `private.student_in_class`, both filtering `left_on is null`. The announcement audience is **as-of**. The two disagree by construction. | The list rendered `className ?? 'Hele skolen'`, so **on term-rollover day every family's past class notices would relabel themselves as school-wide, all at once** — the portal telling ~150 families that a message meant for one class went to everyone. Fixed with `audienceLabel(classId, className)`, one function, two consumers, and a test whose third case is exactly this. |
| 2 | ★ **The Oslo-cast mutation on `announcement_read_status` was invisible to the assertion that named it** | Traced the mutation by hand against the fixture: dropping the cast moves the resolved day to D−1, which pushes «Startet» **out** of the roster and pulls «Sluttet» **in** — so the count stays at 3. | The mutation table claimed assertion 35 would redden. It would not. A count over a set cannot see any mutation that preserves the set's size — the same lesson as plan 1's «the fixture was hiding the defect it sat next to». Fixed by adding two membership assertions at the two edges (37, 38) and correcting the table to say the count assertion is blind to it. |
| 3 | ★ **The cascade assertion in §J was vacuous** | Walked the fixture: no `announcement_reads` row was ever created for `…046`, so "0 read rows after the delete" was 0 before it too. | The assertion that erasure is complete could not fail. Fixed by seeding a read row for `…046` and adding a control assertion that it survives the *refused* delete — so the final 0 is attributable to the cascade and nothing else. |
| 4 | **The `announcements_not_backdated` fixture margin was about 30 minutes** | Worked the arithmetic: at 00:30 the Oslo day D can begin almost 24 h before `now() − 30 days`, while `created_at` was `now() − 31 days`. Positive, but by minutes. | Not a failure, a fragility: a fixture whose validity rests on arithmetic that tight breaks later for a reason nobody looks for. `created_at` moved to `now() − 40 days` (and `− 15 days` for the five-day-old rows). |
| 5 | ★★ **The `UPDATE … RETURNING` pre-update-tuple hazard was not in the plan at all** | Supplied by the coordinator's lens, measured on `threads`: a by-id predicate re-checks against the **pre-update** tuple, a column-reference predicate against the **new** one. | The plan already used the row form, so the hazard was closed **by accident** rather than on the record — which is exactly how the next person grants `update (class_id)` "because the policy checks it anyway" and re-opens it. Now stated in the migration comment, naming the two revokes that are half of why the predicate is correct. |
| 6 | **The three sibling tables' safety was undocumented** | Same lens. | `announcement_reads_select_own_or_staff`, and plan 3's `notifications_select_own` and `private.email_pings`, are all safe from the `RETURNING` hazard for three *different* reasons. A plan-3 author who has just read this plan's row-form argument would over-apply it. Now written out as **A7b**, with the reason per table. |
| 7 | **The definer-predicate cost was unrecorded, and it lands on plan 3 hardest** | Same lens, measured: SECURITY DEFINER + `set search_path = ''` blocks inlining, so the planner emits one call per row scanned (~20 buffer hits, ~2 ms per candidate). | D21 says the fan-out must **call** the read predicate. Read literally, that becomes `select p.id from profiles p where reads_announcement(p.id, …)` — O(school roll) definer invocations inside the announcement INSERT's own transaction. Now A7 says **narrow first, then filter**, and «leaves broken» records the milder version this plan does ship (unpaginated lists over a non-inlinable policy). |

### Round 2 — the three-lens panel

★★ **The most important finding was found TWICE, independently, by two lenses that were not talking to each other** — the vacuity lens tracing which api assertions could fail, and the integration lens replaying the migrations against the real seed. When two different questions converge on one fact, that fact is the one to fix first.

| # | Lens(es) | Defect | Consequence if executed |
|---|---|---|---|
| ★★1 | **vacuity + integration**, both proved | **No seeded family is in any class as of today.** Every `class_students.enrolled_on` is `2026-08-20`/`21`; `current_date` is `2026-08-05`. The two new helpers are the **first in the repo anchored on `now()`** — the eight existing sites resolve against a lesson/test/assignment date inside the term, and the live `guardian_in_class` never looks at `enrolled_on` at all, which is why plan 1's thread tests pass over the same seed. | Two api tests fail on `null`/`TypeError`, **one passes vacuously** (the family-cannot-read-a-scheduled-notice assertion would pass with `pub <= now()` deleted), and four walkthrough items are unperformable. **pgTAP stays 100% green throughout** — file 37's fixture is hermetic and `now()`-relative. Now A14, standing rule 15, a Task 0 probe, a `beforeAll`/`afterAll` window in Task 11, and a sentence in all three walkthroughs. |
| 2 | vacuity, proved | **`announcement_reads_select_own_or_staff` had no assertion at all.** §G tested INSERTs; §H goes through a definer projection that never evaluates the policy; §J read the table only after `reset role`, as `postgres`, which holds `rolbypassrls`. | The policy could have been `using (true)` **or** `using (false)` with all 52 assertions of the round-1 file green — the same shape as commit `3f67907` on this very branch. Now a §G triple over one fixture row (guardian 0 / class teacher 1 / admin 1) plus mutation 17. |
| 3 | vacuity + integration, proved | **Task 2 passed the TERM id where the CLASS id belongs** (`bd…031` is `terms.id`, the class is `bd…041`). | Four assertions redden, **and the two that expect `false` pass for the wrong reason** — because the fixture row does not exist, not because `left_on` is exclusive. Fix what is red and both boundary negatives stay permanently untested. Plan 1's «wrong pupil's login», verbatim. |
| 4 | vacuity, proved | **Task 1's mutation 10 would have aborted the file instead of reddening.** Dropping the `created_by` pin from `using` while keeping it in `with check` does not make the UPDATE a no-op — it raises `new row violates row-level security policy`, and §F's UPDATEs are bare statements, so the transaction aborts, everything after fails `25P02` and `finish()` never runs. | The mutation that guards the Phase-4 authorship defect would have read as a broken file. Now dropped from **both** clauses. And the comment justifying the pin was rewritten: the laundering attack it described is impossible anyway (`created_by` has no UPDATE grant) — the real reason is that a co-teacher could otherwise retitle a colleague's notice. |
| 5 | vacuity, proved | **Assertion 45's scalar-subquery shape made Task 5's mutation 1 abort the file.** `select (select announcement_id from claim_due_announcements())` raises `more than one row returned by a subquery` the moment the claim returns two rows — which is exactly what the mutation makes it do. | The most valuable mutation in §I would have destroyed the evidence instead of producing it. Now `array_agg(… order by …)`, and the table corrected: mutation 1 reddens three assertions, mutation 2 reddens two. |
| 6 | **RLS**, proved | **A1's central claim was false: forward-dating moves the audience too.** At `published_at = now()+90d` a guardian whose `left_on` falls inside the window drops out and one who joins is added. No upper bound existed at all (`'2999-01-01'` accepted), and — proved — the author **cannot withdraw** a scheduled row after she leaves the class. | A sentence in a migration comment that is wrong in the security-relevant direction. Now A1 states both directions, a `120 days` CHECK bounds the forward one (flagged as a revisable **product** decision, mirrored in zod), and A2's withdraw policy drops the `writes_announcement` conjunct that was disabling the very path A2 promises. |
| 7 | **RLS**, proved | **The `UPDATE … RETURNING` comment named the wrong mechanism.** It told a future engineer the row form would catch a later `update (published_at)` grant. It would not: `author = uid` short-circuits, and both the bare update and `… returning title` succeed. `class_id` *is* refused — but by `announcements_update_author`'s `with check`, not by the SELECT policy. | This project has been bitten specifically by wrong reasons in comments. Rewritten to say what is true: **`published_at` has no policy guard of any kind — the absent UPDATE grant is the only wall** — while keeping the row-form argument for the INSERT/`RETURNING` case it was actually introduced for. |
| 8 | **RLS**, proved | **`cls is null` admitted any authenticated account, including one with zero `user_roles` rows.** `handle_new_user` gives every auth user a profile; roles are assigned separately; `src/proxy.ts` is not the wall because PostgREST is reachable directly with any valid session. | A created-but-unassigned account, or a departed family whose roles were revoked, keeps reading every school-wide notice. Now one extra clause (A15), a fixture user with no role, assertion 17 and mutation 15. |
| 9 | **RLS**, proved | **A3 was false: the read-tracking denominator is not the set the read predicate admits.** The projection counts *pupils*; the predicate admits *users*. The fixture's A4 witness has no login and no guardian account, so «0 av 3» could never reach 3. | The office is told to phone a family with no account, and the same fixture pupil conflates «protected» with «unreachable». Judgement call: the fifth `reachable` column was **taken now** — with assertion 59's `pg_get_function_result` string, the fingerprint entry, the counter, the DAL type and `ReadStatus.tsx`'s «ingen pålogging» all moved with it. |
| 10 | vacuity, proved | **Three mutations could not be applied as written.** A fifth output column needs `drop function` (42P13 otherwise); `and not s.protected` cannot go in the lateral (`s` is joined after it); and Task 6's F1 rename needs `announcements_select_audience` and `private.reads_announcement` dropped first. | Three "run this mutation" steps that stop with an error unrelated to what they were testing. All three now carry their sequence. |
| 11 | vacuity, proved | **Nothing asserted `revoke execute … from public`, and `00_grant_firewall.sql` does not sweep functions** — it filters `relkind in ('r','p','v','m','S')` and never touches `pg_proc`. The round-1 ledger's claim that it "sweeps every current and future public object" is true for tables and **false for functions**. | An anon-executable definer projection over every class roster, by name, with read state attached — caught by nothing. Now three `has_function_privilege('anon', …)` assertions (§A, §H, §I), one mutation each, and standing rule 14. |
| 12 | vacuity, proved | **A5's pupil-login arm had no witness, and no fixture pupil had two guardians.** The only read row belonged to a guardian, so deleting `ar.user_id = s.student_user_id` reddened nothing. | Half of A5 was untested and «exactly one FAMILY» could not distinguish per-family from per-user counting. Now a pupil records their own read in §G, `…031` carries two guardians, assertion 52 expects **2**, and 53 names the pupil arm. |
| 13 | vacuity, proved | **Task 11 step 4's "every test must fail" was false for three of eight.** The foreign-class refusal passes under a total outage — the action converts every 42501 into exactly the asserted sentence, and "no row" is satisfied by the outage. | F6 from plan 1's panel, reproduced **inside the file whose header claims to have eliminated it**. Now that test carries a Klasse-3 publish as its own discriminator, and step 4 is a table: seven of nine must fail, two pure-validation tests are expected to stay green. |
| 14 | integration, proved | **`export async function listAnnouncements()` fails `npm run knip` at ERROR level** — consumed only inside its own module. The `listThreads` precedent does not apply (it is imported by `src/lib/admin/threads.ts`). | The plan's own standing rule 10, broken by the plan. Fails at Task 7 step 6 and every gate after. `export` dropped. |
| ★15 | integration, proved | **`datetime-local → new Date().toISOString()` publishes 1–2 HOURS LATE in production** and the walkthrough cannot see it, because the dev machine runs Europe/Oslo and Vercel runs UTC. The zod `refine` computes `Date.parse` the same way, so inside that window the validator and `announcements_not_backdated` disagree. | **The plan spends A8 closing this exact hazard in SQL and then reopened it in TypeScript**, in both actions. D8's own example is «publiser lørdag 07:00». Now `osloLocalToInstant` in `src/lib/dates.ts` with its own tests, used by both actions and all three refines — and the walkthrough says to read the time back. |
| 16 | integration, proved | **Two exported actions per file had no caller, and the walkthrough asked a human to click controls the plan never writes.** `AnnouncementDetail.canEdit` was fetched by an RPC on every detail view and read by nobody. | Four more knip errors on top of #14, plus two walkthrough steps that cannot be performed. Judgement call: **the components were added** (one per staff surface), and the walkthrough steps were rewritten to match what they actually do. |
| 17 | integration | **AdminNav's «Last, as on the other three navs» was already false** — `LaererNav` is I dag · Oppgaver · Meldinger · **Vurdering** — and the round-1 replacement text would have been false too, since Task 7 inserts Oppslag before Vurdering. | Replacing one wrong comment with another. The true sentence is now written out in Task 10 step 5, ready to paste. |
| 18–21 | integration, minors | File 29's «the live SECURITY DEFINER count is 52» becomes **60** (8 new definers; the stamp trigger is not one) · Task 1 step 5 mis-described `26_rls_force.sql` (`plan(4)` = three table sweeps + one role attribute) · the `PG_ERROR.CHECK` branch's message also fires for the length CHECKs and now for the schedule bound (unreachable — zod runs first, with both limits mirrored) · the prefix inventory omitted `33, 55, 77, f1–f5, f7, fa` (`c0` is still genuinely free). | Each fixed in place. |

**Also fixed while applying the above** (found by this pass, not by a lens): Task 0 step 2 queried `pg_constraint` for `class_students_one_active`, which is a partial unique **index** and never appears there — the check would have read as "the constraint is gone". It now queries `pg_indexes`.

**Verified sound and left unchanged** (checked by running the query, not assumed):

- `postgres` **is** a member of `service_role`, so §I's `set local role service_role` works — and five existing pgTAP files already do it.
- `students.first_name` and `last_name` are both `NOT NULL`, so `first_name || ' ' || last_name` cannot yield NULL.
- `class_teachers_select_admin_or_own_class` is `has_role(admin) or teaches_class(uid, class_id)` — **self-satisfying for a teacher's own rows**, so `listPublishableClasses` will return rows. Plan 1's measured 0-row result was for a **guardian**, and the distinction matters: the same query is safe here and was not there.
- `pg_get_function_result` really renders `TABLE(col type, …)`, verified against `thread_counterparts` and `guardian_thread_options`, so Task 4's return-shape assertion is written in a form that can pass.
- `29_definer_fingerprints.sql` really ends in `49`; `31_column_locks.sql` really is `plan(22)`; `34_enrollment_boundary.sql` really is `plan(24)` with D = 2026-09-15; `action-guards.test.ts` really asserts `73`; the migration head really is `20260805123000`; `37` and prefix `c0` are free in both tests and migrations. **Re-measured by two of the three round-2 lenses**, one of them after a concurrent `db reset`: all still true, on PostgreSQL 17.6.
- `26_rls_force.sql` sweeps **all** public tables — `plan(4)` is three per-table sweeps (enabled, forced, has-a-policy) plus one role attribute — so the two new tables fail it by name if either verb is missed. `00_grant_firewall.sql` (`plan(6)`) sweeps every current and future public **table, view, matview and sequence**, so the `revoke all … from anon, authenticated, service_role` is required (measured: `pg_default_acl` grants `Dxtm` to all three on postgres-created tables in `public`) and a missing one reddens with no edit to that file. ⛔ **It does NOT sweep functions** — corrected from the round-1 ledger, and now standing rule 14.
- **All three migrations apply cleanly, verbatim, in one transaction** on PG 17.6, in the order their timestamps give them; the scoped `create trigger … execute function private.audit_row_change('id','class_id')` is valid (the function takes no declared args and reads `tg_argv`); `set_updated_at`, `has_role` and `teaches_class` all exist with the assumed signatures.
- **All 26 round-1 fingerprint markers were confirmed present in the installed bodies** by running file 29's own `position(m in pg_get_functiondef(...)) = 0` query over every one: 0 missing. **No marker is satisfiable from a function header** — checked individually, including the deliberate `_row` suffix on `private.reads_announcement`'s marker and the `cls` / `pub` / `cid` parameter names. (Round 2 then added two markers, so the counter is 77, not 75.)
- **Every repo-wide invariant survives, measured post-apply:** 0 RLS/force violations, 0 anon table privileges, 0 DDL verbs held by api roles, 0 tables without a policy. No other test sweeps all tables or all definer functions.
- **The full role × row matrix over the three fixture announcements was executed** — admin, both teachers, four guardian positions, the pupil's own login, economy and a role-less user against the class notice, the school-wide notice and the scheduled one. `left_on` exclusive and `enrolled_on` inclusive confirmed **at the edge**; **no path admits `economy` to a class announcement** and none excludes it from a school-wide one; `private.is_staff` really is `role in ('admin','teacher','economy')`, so standing rule 11's ban is correct and no policy here uses it.
- **The `select distinct` in the roster lateral is necessary, not defensive:** `class_students_one_active` forbids two OPEN enrolments, `class_students_interval_unique` is `(class_id, student_id, enrolled_on)` — so two overlapping **closed** intervals containing one `published_at` are possible, and the school-wide branch would double-count without it.
- **Both `RETURNING` claims hold:** row form + `returning` succeeds for immediate and scheduled inserts; the by-id spelling raises 42501 while the predicate evaluates true. The by-id delegate is used in exactly two places, both safe.
- **Grants:** every UPDATE lock holds (`published_at`, `created_at`, `class_id`, `created_by`, `fanned_out_at` all refused; only `title`/`body` pass, and only for the author); `id` is not INSERT-grantable, so a client cannot choose an announcement id; `read_at` forged at INSERT → 42501. **No enumeration oracle** — a real-but-unreadable id and a non-existent one both give 42501, RLS being evaluated before the FK.
- **`claim_due_announcements` behaves under real concurrency:** two sessions, 50 due rows — A claims 50, B claims 0, no blocking, no double-claim. `service_role` holds only `select, delete` on the table, so there is no second write path.
- **Every referenced UI primitive exists with the assumed shape** — `Chip {tone:'warning'}`, `EmptyState`, `PillLink`, `Field`, `Input`, `Button {loading}`, `BackLink`, `useNoFormReset`, `FormState`, `idleForm`, `firstIssue`, `uuidField`, `PG_ERROR.*`, `formatDateNb`/`formatDateTimeNb`/`osloDateOf`, `requireRole`/`requireStaffRole` — as do every Tailwind token used (`ease-brand`, `divide-hairline`, `ring-ring`, `surface-tint`, `border-input`, `warning-ink`, `danger-ink`). The harness's `signInAs`, `signInAsAAL2`, `signOut`, `createServerClientMock` and `redirectMock` all exist, and `SeedEmail` includes `forelder2@` and `laererforelder@`.
- **`db:types` produces the argument names the DAL uses** — the SQL parameter name verbatim, so `p_announcement_ids` and `aid` are right.
- **Refuted as an exploit, recorded so nobody re-derives it:** `created_at` defaults to `now()` = `transaction_timestamp()`, so `announcements_not_backdated` compares against the transaction's *start*. In a transaction held open two seconds, `published_at = transaction_timestamp() + interval '1 second'` was accepted and landed 1.38 s in the real past. The window equals the transaction's age; PostgREST runs one transaction per request, so through the app it is milliseconds — the same race A1 already closes by omitting the column for an immediate publish. **No fix needed.**
- **Left alone on purpose, and the plan says so where it matters:** the three sibling tables of A7b are each safe from the `RETURNING` hazard for a *different* reason (`announcement_reads_select_own_or_staff`'s first arm is a plain column on the row being written and its third subqueries a different, committed table; plan 3's `notifications_select_own` is a plain column *and* written only by a definer trigger owned by a BYPASSRLS role; `private.email_pings` has no RLS at all). **None of them should be "hardened" into a row form** — a plan-3 author who has just read this plan's row-form argument is exactly the person who would.
- ⚠ **Every count above was re-verified after the branch moved under this plan.** A concurrent session committed `3f67907` («the three policies that could be deleted with the suite green») while this document was being written, cleaning three files that were dirty when Task 0 was drafted. Re-measured afterwards: fingerprint counter still **49**, `action-guards` still **73**, migration head still `20260805123000`, highest test file still **36**, `31` still `plan(22)`, `34` still `plan(24)` — and `35`/`36` are `plan(41)`/`plan(14)`, which is where the previously-uncommitted work landed. Nothing this plan depends on moved, but **the branch is shared and it moved once during a two-hour write**; Task 0 exists because of that.
- The 21-line teardown named in the brief is **not** what shipped: `35_threads_rls.sql` and `36_thread_counterparts.sql` both carry a **9-line** block — the short one plus `delete from public.assignments`, which is the single ON DELETE RESTRICT edge on the path to `classes`. File 37 copies that block and adds the two announcement deletes ahead of it, because `announcements.class_id` is a **second** such edge. (File 34's 20-line version is a different file's history, not the house standard.)

✅ **The full review panel CLAUDE.md calls for on RLS plans has now been run**,
and the round-1 gap note that used to stand here is withdrawn. Three lenses,
21 findings, all applied. What that bought, stated plainly so the next plan's
author can decide how much of it to repeat:

- The **critical** finding was found by two lenses independently — from two
  different questions ("can this assertion fail?" and "does this apply to the
  real repo?") converging on one row of seed data. Neither the round-1 pass nor
  a third re-read would have found it, because it is not visible in the plan.
- The **RLS lens found nothing exploitable and two false sentences**, both in
  comments — which is the finding. On this project a wrong reason in a comment
  is how the right line gets deleted six months later.
- The **integration lens found the two things that stop execution dead** (a knip
  error and an empty roster) and the one defect that ships silently because the
  dev machine's clock hides it.
- **Every lens also reported what it verified sound**, and that list is longer
  than the defect list. It is above, deliberately: re-reviewing settled ground
  is the other way a panel wastes a night.

✅ **Both things round 1 could not verify by running them have now been run**, by
two lenses independently, and both hold:

1. **A BEFORE INSERT trigger does assign `fanned_out_at` when the caller holds no
   grant on it** — immediate row stamped, scheduled row null; naming the column
   in the statement gives `42501 permission denied for table`. (EXECUTE on a
   trigger function is checked at `CREATE TRIGGER`, not at fire time, so the
   `revoke` is harmless.) Task 1 step 3's probe is kept anyway: it costs ten
   seconds and sits under 49 assertions.
2. **`for update skip locked` inside `where id in (…)` in a `language sql`
   function that `returns table` compiles and behaves as a claim** — and holds
   under real concurrency (two sessions, 50 due rows: A claims 50, B claims 0,
   no blocking, no double-claim, 50/50 stamped).

⚠ **What is still unattacked, and should be said out loud:** the `pub <= now()`
**equality** boundary is exercised by no fixture in this plan; the Norwegian
copy has still not been read by the user or the board (§12 Q3); and the whole of
Tasks 7–11 is reviewed as *code in a document*, not as a running app — no lens
clicked anything, because nothing is built yet. The human walkthroughs are not a
formality.

---

### Round 3 — the independent panel, merged 2026-08-05

Rounds 1 and 2 above were run by this plan's own author and by a concurrent
session. **Round 3 was a third panel that did not talk to either**, dispatched
because the round-1 ledger named three lenses as missing and round 2 supplied
them from inside the same head: **escalation · assertion vacuity · repo
integration**. Its findings barely overlap the other two — verified by grep
before it was merged — and every one of them was executed against the live
database rather than argued from the document.

It produced **three open decisions** and the fixes below. ⚠ **The decisions are
now CLOSED** — put to the user on 2026-08-05 and merged the same day; see
«THREE DECISIONS TAKEN» at the top, and the round-4 entry below for what the
merge measured.

| # | What | Merged as |
|---|---|---|
| ★1 | **The cross-task numbering table was wrong for Tasks 4 and 5.** §H was written as 48–60 while §G ends at 42, and `plan(60)` sat on a row whose last assertion was 65. Found by assembling file 37 verbatim from this document, running it against the three migrations in a rollback transaction, and reading `ok N` off the output. | The table, every §H/§I/§J reference in Tasks 4 and 5, and the §-header comments. **The file ran 71/71 green as round 3 left it** (49 after Task 1, 65 after Task 4). ⚠ Those are pre-decision addresses: round 4 took it to **77** — see below. |
| ★2 | **A10's rationale was backwards.** It said renaming `cls`/`pub`/`author` would make three fingerprint markers vacuous *while still reporting green*. Measured: **0 of 28 markers** match the function header alone — all are dot-qualified, operator-bearing or string literals. A rename makes `'cls is null'` match nowhere and turns file 29 **red**, which is the safe failure. | A10, the migration comment, Task 6 step 2's comment, and Task 6 step 4 — whose «F1 check» renamed the parameters **and** deleted the `cls is null` arm in one mutation, so the deletion alone reddened it and it proved nothing. Replaced with a header-only probe (one query) plus a rename-only variant. |
| ★3 | **The upper edge of `enrolled_on` was unpinned in the entire repo.** `<= X` widened to `<= X + 1` at all three of this plan's SQL sites left file 37 at **66/66 green** and file 34 untouched — no fixture stood one day the wrong side of an as-of date. | «Etterpå» moved from D+20 to **D+1** (no new assertion in file 37: assertions 07, 38, 45 and 58 become the witnesses), two new assertions in file 34 asking about the *same* pupil one day earlier, and mutations Task 1 #23, Task 2 #7–8, Task 4 #14. |
| 4 | **Three clauses of `announcement_read_status` could be deleted with §H green:** the school-wide branch (`a.class_id is null or`), the `ar.announcement_id = a.id` correlation, and the upper edge above. The correlation is *set-preserving* on a one-element call — the fixture's other read row belongs to the same family, so the numbers do not move. | §H gains three assertions — A6's school-wide roster as admin (**4**), the batch's second id (**4 rows**), and «none of them has read it» (**0**) — plus mutations 12–14, every effect measured. |
| 5 | **`public.can_edit_announcement` had fingerprint markers and no behaviour.** Drop its `created_by` conjunct and it says yes to every teacher of the class — a UI lie (the policy still refuses) inside a function whose comment calls it "a thin mirror" of that policy. | Two assertions at the end of §F, on the two rows §F has just tried to update: the co-teacher gets **false** for a colleague's row and **true** for her own, plus mutation 24. |
| ★6 | **Standing rule 2 was broken by this plan's own table** — the insert wall (28, 29, 30) and the `teaches_class` read arm had **no named mutation** — and writing the missing mutation is what exposed the real defect: with assertion 14's actor being the announcement's **author**, `author = uid` short-circuits, so deleting `private.teaches_class(uid, cls)` from the read predicate reddened **nothing in the file**. A teacher would silently stop reading her colleagues' notices to her own class, and 71 assertions would stay green. | Task 1 mutations 20–22, and §B's control actor changed from the author to the **co-teacher** — one word in the fixture, and the arm now has a witness. No assertion count changed. |
| 7 | **Two entries in the existing mutation tables were wrong, both found by running them.** Task 1 mutation 8 (drop the `author = uid` arm) also reddens **45** — a DELETE with a WHERE applies the SELECT policy, so the author cannot withdraw a scheduled row she can no longer read. Task 4 mutation 3 (`and not s.protected`) does **not** redden 51: that assertion is a count of 0, and a pupil filtered out of the projection contributes 0 too. | Both tables corrected in place, with the reason. |
| 8 | **`src/enrollment-interval.test.ts` is an unnamed repo-wide invariant.** It sweeps `src/**` and asserts exact counts (8/8/2). This plan adds **zero** TS-side sites, so it stays green — but two file headers become false, and plan 2 adds **three** SQL spellings, not the two it claimed. | Added to «Modified» as comment-only-and-run-it, with the ninth/tenth/**eleventh** correction in Task 2 and the migration header. |
| 9 | **Task 11's positive control was `toBeGreaterThan(0)`** on the one assertion whose job is to tell «correctly refused» from «nothing works» — one row of a two-pupil class satisfies it. | `toHaveLength(2)`, Klasse 1's exact seeded roster (verified against the database). |
| 10 | **No scheduling mechanism exists in this repo at all**, and `created_by`'s RESTRICT edge blocks deleting a staff profile that has ever published. | Two «leaves broken» entries. |
| 11 | A reviewer measured a plausible but **wrong** baseline because a sibling session's `db reset` was mid-flight. | Standing rule 8 now says **check `docker ps` first**. |

**Two of its findings were already applied and were not merged twice** — Task 1
mutation 9's collateral (assertions 08 and 10) and Task 5 mutation 2's (63 and
66) were both already in the tables under the current numbering, and Task 11
step 4's «every test must fail» had already been rewritten by round 2 into
seven-of-nine with the two zod tests named. The panel's own numbers for those
were pre-rewrite addresses, not missing content.

#### Verified SOUND by round 3, so nobody re-litigates it

Re-measured while merging, on PostgreSQL 17.6, with the three migrations
applied verbatim inside `begin; … rollback;`:

- ★ **The fingerprint counter is right: 49 → 77.** The eight new entries carry
  exactly **28** pairs by `lateral unnest` (4+4+7+1+3+2+5+2), **0** of the 28
  markers is missing from the installed bodies, and **0** is satisfiable from a
  function header. (The panel measured 26 and 75 against the round-1 entries;
  round 2 had since added `'public.user_roles'` and `'a.published_at <= now()'`.
  Both are present verbatim.) **This is the exact arithmetic plan 1 got wrong**
  — it said 31 when the answer was 43.
- **The whole of file 37 runs green**, assembled verbatim from this document:
  **71/71**, no plan mismatch. ⛔ The panel's claim that "every §-to-number
  mapping in the cross-task table is correct" was true of the file at HEAD when
  it ran and **false of the committed rewrite** — see round-3 finding 1. It is
  the one thing in its SOUND list that did not survive re-measurement, and it is
  why numbering is measured here rather than derived.
- **Baseline: `Files=37`, and the sum of the 37 committed `plan(N)` values is
  `748`** — no repeat of plan 1's 741-vs-734 discrepancy. Exit arithmetic is
  therefore `748 + 71 + 8 + 9 = 836` over 38 files, and Task 0 still measures it
  rather than inheriting it.
- **All three migrations compile clean** run verbatim in one transaction; every
  helper exists with the exact signature called; the scoped
  `audit_row_change('id','class_id')` trigger is valid.
- **Every whole-schema invariant stays green with the two new tables applied**,
  re-run individually against the migrated schema: `00_grant_firewall` **6/6**,
  `01_schema` **13/13**, `03_audit_log_rls` **15/15**, `26_rls_force` **4/4**.
  A sweep of all 37 files found only `00` and `26` sweeping all tables — no
  unaccounted invariant.
- **The teardown is correct.** Files 35 and 36 each carry a 9-delete block; file
  37's 11-line version is complete against the full RESTRICT/NO-ACTION edge set
  into `classes`/`terms`/`subjects`/`profiles`, and `term_grades` is cleared by
  the `students` cascade *before* `delete from public.terms`. **23** test files
  run `delete from public.classes` — the plan's count is exact.
- **D17 is clean in both directions** (economy: class notice 0, school-wide 1,
  `announcement_read_status` 0) and `private.is_staff` appears nowhere in this
  plan except the standing rule forbidding it.
- **The `RETURNING` hazard is genuinely closed** — `insert … returning id`
  succeeds under the row-form policy, for the immediate and the scheduled row.
- **The write boundary holds:** `has_column_privilege(authenticated, …)` is
  false for `class_id`/`published_at`/`created_by` UPDATE, `fanned_out_at`
  INSERT and `announcement_reads.read_at` INSERT. No retroactive audience
  widening, no back-dating, no read forging.
- **`claim_due_announcements` refuses an ordinary authenticated caller** (42501)
  and returns id/class_id/published_at only — no content. **No existence oracle
  on a scheduled announcement**: `with check` fires before the FK, so
  existing-but-unreadable and non-existent both give 42501.
- **The as-of interval spelling is byte-identical to all eight existing sites**,
  and **§D covers both edges of D8** — the family cannot read the future-dated
  row, with the same guardian reading the published one as control, and the
  author reads it attributably.
- **The `announcement_reads` upsert is the right shape** — `ignoreDuplicates:
  true` → `ON CONFLICT DO NOTHING`, which needs no UPDATE privilege, correct for
  a table with neither an UPDATE grant nor policy.
- **Task 1 Step 3's stamp probe works verbatim**, and the uuid it uses —
  `11111111-…-1111` — really is **`admin@test.local`** in the seed (verified).
  It reads like a fabricated value, and the plan tells the executor to stop if
  it 42501s.
- ★ **Both assumptions round 1 could not verify are measured and hold:** a
  BEFORE INSERT trigger **can** assign a column the caller holds no grant on,
  and `for update skip locked` inside `where id in (…)` in a `language sql`
  function that `returns table` **is** accepted and behaves as a claim under
  real concurrency.

★ **What round 3 cost and bought, for the next plan's author.** Five of its
eleven merged findings (1, 3, 4, 6, 7) are of a shape no amount of re-reading
produces: they were found by *running the plan's own artefacts* — assembling the
pgTAP file from the document, applying the mutation the table names, and reading
the number. **Two of those five were not in the panel's report at all**; they
appeared only because writing the missing mutation and running it disagreed with
what the table predicted. Two more (2, 9) are the opposite shape: a sentence that
was confidently wrong, caught by asking what the words would predict and then
measuring it. And the three open decisions came from the escalation lens asking
the one question neither earlier round asked — *who ends up seeing something
they could not see before?*

⚠ **One thing the panel reported did not survive re-measurement**, and it is
recorded rather than quietly dropped: it said the cross-task numbering table was
correct. It was, of the file at HEAD; the committed rewrite it was merged into
had moved. **A review's findings age against the branch they were taken on** —
which is the same lesson standing rule 8 carries, one layer up.

---

### Round 4 — the three decisions merged, 2026-08-05

Not a review round: the **user answered round 3's three open decisions** and this
pass wrote them in. Recorded here because two of the three changed behaviour, and
because merging them cost more than the decisions themselves.

| | decision | written into |
|---|---|---|
| **D-A** | protected pupil: **gate the name, keep the row** — and the removal question is deferred, not done | `20260806121000`'s select list · §H fixture `…037`/`…038` · assertions 49, 50, 51, 64 · Task 4 mutations 15–18 · A4 · fingerprint markers ×3 |
| **D-B** | school-wide reach: **live enrolment ∪ staff ∪ economy** | `reads_announcement_row`'s `cls is null` arm · assertion **10 flipped 1 → 0** · assertions 11, 18 added · Task 1 mutations 25–28 · A15 · A3's divergence table · fingerprint markers ×3 |
| **D-C** | editing after publication: **accepted** | no code at all — A2, «leaves broken», and the decision record |

★ **What the merge measured, all inside `begin; … rollback;` against the three
migrations assembled verbatim from this document:**

- **File 37 runs 77 of 77 green**, sections landing exactly as the cross-task
  table says (§A 1–5 · §B 6–15 · §C 16–20 · §D 21–24 · §E 25–33 · §F 34–38 ·
  §G 39–46 · §H 47–66 · §I 67–72 · §J 73–77). The pre-decision file was
  re-run first and returned **71 of 71**, so the delta is attributable.
- **File 34 runs 32 of 32 green**, unchanged — neither decision touches the
  as-of helpers, and that was checked rather than assumed.
- **All eight new mutations redden exactly one assertion each.** Every part of
  both new clauses has its own witness and no two share one.
- **The fingerprint arithmetic is 49 + 34 = 83**, with 0 markers missing from
  the installed bodies and 0 satisfiable from a function header. The live
  SECURITY DEFINER count stays **60**: both decisions are clauses, not
  functions.

⛔ **Three entries in the committed mutation tables were already wrong, and
re-running them is the only reason anybody knows.** They have nothing to do with
either decision — they were predictions written into a table and never executed:

| entry | said | measured (committed numbering) |
|---|---|---|
| Task 1 #4 (`student_in_class_asof`: `<=` → `<`) | reddens **12** | **12, 41, 49, 50** — a pupil outside the as-of audience also cannot record the read that §H's per-family counts stand on |
| Task 1 #5 (drop the pupil helper's Oslo cast) | reddens **12** | **12, 41, 49, 50** — identical collateral |
| Task 1 #6 (live helper for the as-of helper) | reddens **7** | **7, 40** — the double bind then admits a read it should refuse |

That is the fourth consecutive round on this plan where **running the plan's own
artefacts** found something no amount of re-reading would: round 3 found a broken
numbering table the same way, and standing rule 2's whole point is that a
«must redden» column is a claim until psql prints it.

★ **And the merge is the argument for deciding before executing, in one number.**
The two behavioural decisions added five assertions and moved **every** number
from §C onward — about sixty references across five mutation tables, three
landing lists, two in-file section headers and the cross-task table. In a
document that is a merge; in a shipped suite with migrations on top of it, it is
a week. Round 3 flagged all three as *«far cheaper before the assertions around
it are written than after»*, and this is what that sentence was worth.

⚠ **What round 4 did NOT do, said plainly.** It did not re-review the plan — no
new lens ran, and the three decisions were applied as the user gave them. Two
things it deliberately left alone: the `pub <= now()` **equality** boundary still
has no fixture (unchanged since round 2), and D-A's residual — a former teacher
still learns that *a* protected pupil was on that roster, and still receives her
`student_id` — is **recorded in «leaves broken», not closed**, because closing it
means dropping the row and the row is the denominator.



