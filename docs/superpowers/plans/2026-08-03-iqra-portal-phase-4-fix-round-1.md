# Phase 4 Fix Round — Part 1: Privilege Escalations and Child-Data Privacy

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two confirmed privilege-escalation chains and the three child-data privacy defects that block merging PR #15.

**Architecture:** Two new migrations. The first closes both escalations by making immutable columns genuinely immutable (column-level `revoke`) and by making the `submissions` UPDATE `with check` validate the NEW row the way the INSERT policy already does. The second changes `assignment_group_mate_names` to omit protected pupils and narrows the family branch of `assignment_group_members_select_related` so the omission cannot be undone by arithmetic. UI changes follow the data changes, never lead them.

**Tech Stack:** Postgres 15 / Supabase RLS, pgTAP, Vitest against real PostgREST HTTP, Next 16 App Router, TypeScript.

**Branch:** `feat/phase-4-oppgaver` (tip `a8d6ae2`, 26 commits ahead of `origin/real`). New migrations follow `20260802000000`.

---

## Context an implementer needs

Three facts were measured on 2026-08-03 and every task below rests on them.

1. **`authenticated` holds column-level UPDATE on every column of `public.submissions` and `public.assignments`.** Verified via `information_schema.column_privileges`. This is what makes both escalations reachable.

2. **The app writes exactly three columns on `submissions`** — `body`, `submitted_by`, `submitted_at`, all from `writeHandIn` at `src/lib/dal/submissions.ts:105`. Nothing else. Revoking the other six costs nothing.

3. **Nothing in `src/` updates `public.assignments` at all.** `grep -rn "from('assignments')" src/` returns eight call sites, none of them `.update()` or `.upsert()`. So revoking the ownership columns costs nothing today.

**The reproduction for Escalation 1**, already run and rolled back — keep it, it becomes the test:

```
pivot_before                       f
foreign_assignment_visible_before  0
UPDATE (rewrite assignment_id)     UPDATE 1
pivot_after                        t
foreign_assignment_visible_after   1
```

**The reproduction for Escalation 2**, likewise:

```
discard_empty_assignment(...)      ERROR: NOT_YOURS
UPDATE (rewrite created_by)        UPDATE 1
discard_empty_assignment(...)      (succeeds)
rows_left                          0
```

**Why `with check` alone is not enough, and `revoke` alone is not enough.** `private.writes_submission(uid, id)` re-reads the row from the table and is STABLE, so inside an UPDATE it sees the pre-update snapshot — it can never validate the new triple. Adding `can_write_submission` on the NEW columns fixes that. But `submitted_at` must stay app-writable under the current design, so the backdating half needs a different instrument: take the column away from the client and let a trigger set it. Both layers are therefore load-bearing, and Task 1's tests must prove each one separately.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260803000000_submission_assignment_column_locks.sql` | Both escalations: column revokes, the corrected `with check`, and the `submitted_at` trigger. |
| `supabase/migrations/20260803001000_protected_mate_omission.sql` | F6: omit protected pupils from the projection; narrow the membership policy's family branch. |
| `supabase/tests/31_column_locks.sql` | pgTAP: grant shape and policy shape for both tables. |
| `tests/api/submission-column-locks.test.ts` | The attacker's actual path — PostgREST over HTTP, with a pupil's own JWT. |
| `src/lib/dal/submissions.ts` | Stop sending `submitted_at`; the trigger owns it now. |
| `src/components/assignments/HandInCard.tsx` | Remove the mate placeholder; stop deriving the family-visible lock from other families' reviews. |
| `src/components/assignments/AttachmentList.tsx` | Stop rendering the uploader's filename to co-members. |

---

### Task 1: Lock the immutable columns on `submissions` and `assignments`

**Files:**
- Create: `supabase/migrations/20260803000000_submission_assignment_column_locks.sql`
- Create: `supabase/tests/31_column_locks.sql`
- Modify: `src/lib/dal/submissions.ts:105`

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/31_column_locks.sql`:

```sql
begin;
select plan(8);

-- ── Escalation 1: a pupil must not be able to re-point their own hand-in ──
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);

select throws_ok(
  $$ update public.submissions
        set assignment_id = 'f8000000-0000-0000-0000-000000000001'
      where id = 'f9000000-0000-0000-0000-000000000002' $$,
  '42501', null,
  '★ a pupil cannot rewrite assignment_id on their own hand-in');

select throws_ok(
  $$ update public.submissions
        set student_id = 'fe000000-0000-0000-0000-000000000003'
      where id = 'f9000000-0000-0000-0000-000000000002' $$,
  '42501', null,
  '★ a pupil cannot rewrite student_id on their own hand-in');

select throws_ok(
  $$ update public.submissions
        set assignment_group_id = null
      where id = 'f9000000-0000-0000-0000-000000000002' $$,
  '42501', null,
  '★ a pupil cannot detach their hand-in from its group');

select throws_ok(
  $$ update public.submissions
        set submitted_at = '2026-01-01T08:00:00Z'
      where id = 'f9000000-0000-0000-0000-000000000002' $$,
  '42501', null,
  '★ a pupil cannot backdate submitted_at to launder a late hand-in');

-- The positive control. Without this, a revoke of ALL columns would pass the
-- four assertions above while breaking every hand-in in the school.
select lives_ok(
  $$ update public.submissions
        set body = 'Vi har valgt Al-Fatiha, revidert.'
      where id = 'f9000000-0000-0000-0000-000000000002' $$,
  'a pupil CAN still edit the body of an open hand-in');

-- ── Escalation 2: a teacher must not be able to take ownership ──
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select throws_ok(
  $$ update public.assignments
        set created_by = '66666666-6666-6666-6666-666666666666'
      where id = 'f8000000-0000-0000-0000-000000000001' $$,
  '42501', null,
  '★ a teacher cannot rewrite created_by — this is what made discard_empty_assignment bypassable');

select throws_ok(
  $$ update public.assignments
        set class_id = 'fc000000-0000-0000-0000-000000000002'
      where id = 'f8000000-0000-0000-0000-000000000001' $$,
  '42501', null,
  '★ a teacher cannot move an assignment to another class');

select throws_ok(
  $$ update public.assignments
        set due_on = '2026-09-01'
      where id = 'f8000000-0000-0000-0000-000000000001' $$,
  '42501', null,
  'due_on is locked too: an unchecked edit re-opens mate-name resolution for a frozen group');

reset role;

-- ── The regression guard for the mistake this plan nearly shipped ──────────
-- A table-level UPDATE grant silently re-opens every assertion above, because
-- it covers all columns and no column-level revoke can subtract from it. Pin
-- the grant SHAPE, not just the behaviour: this is the line a future migration
-- would cross by writing `grant update on public.submissions to authenticated`
-- without noticing what it undoes.
select is_empty(
  $$ select table_name from information_schema.role_table_grants
      where grantee = 'authenticated'
        and privilege_type = 'UPDATE'
        and table_name in ('submissions','assignments') $$,
  '★ neither table carries a TABLE-level UPDATE grant — column grants only');

select set_eq(
  $$ select column_name::text from information_schema.column_privileges
      where grantee='authenticated' and table_name='submissions'
        and privilege_type='UPDATE' $$,
  $$ values ('body'), ('submitted_by') $$,
  '★ and exactly two columns are writable — submitted_at is server-owned');

select * from finish();
rollback;
```

Adjust `plan(8)` to whatever pgTAP reports after adding these two. Run the file to get the number; do not count the calls by eye or by grep.

- [ ] **Step 2: Run it and confirm every assertion fails for the right reason**

Run: `supabase test db --file supabase/tests/31_column_locks.sql`

Expected: assertions 1–4 and 6–8 FAIL (the updates succeed today, so `throws_ok` reports no exception raised). Assertion 5 PASSES already — that is correct and is the point of a positive control.

Record which assertions failed. If assertion 5 fails at this stage, stop: the fixture is wrong, not the code.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260803000000_submission_assignment_column_locks.sql`:

```sql
-- Two confirmed privilege-escalation chains, both reproduced against the live
-- database on 2026-08-03 and both closed here.
--
-- 1. A pupil PATCHed `submissions.assignment_id` to an assignment in a class
--    they were not enrolled in. `private.student_in_assignment` branch 2 asks
--    "does a submissions row exist for this pupil on this assignment", so the
--    forged row made it answer TRUE, which unlocked assignments_select_related,
--    assignment_group_members_select_related (every member's student_id) and —
--    worst — assignments_objects_select on storage.objects, i.e. every
--    teacher-uploaded file on that assignment.
--
--    The UPDATE policy could not have caught it. private.writes_submission
--    takes a ROW ID and re-reads the row; it is STABLE, so inside an UPDATE it
--    sees the pre-update snapshot and structurally cannot see the new triple.
--    The INSERT policy has always done this correctly by calling
--    private.can_write_submission on the NEW column values. The UPDATE policy
--    now does the same.
--
-- 2. `discard_empty_assignment` guards on `created_by = auth.uid()` so that a
--    co-teacher cannot destroy a colleague's work-free assignment. But
--    assignments_update_teacher_or_admin never pinned created_by, and
--    `authenticated` held a column UPDATE grant on it, so the guard was one
--    PATCH away. supabase/tests/21_assignments_rls.sql:270 asserts exactly the
--    property that failed — it is green only because it never attempts the
--    PATCH first.
--
-- WHY COLUMN GRANTS AND NOT ONLY POLICIES: `submitted_at` must remain writable
-- by the server on every edit, so no with-check predicate can distinguish a
-- legitimate touch from a backdate. Taking the column away from the client and
-- letting a trigger own it is the only instrument that actually closes it.
-- Generalisation worth keeping: when the question is WHICH COLUMNS, a policy is
-- the wrong tool — the same lesson as the mate-name projection in 20260801000000.

-- ── submissions ───────────────────────────────────────────────────────────
-- ★ REVOKE THE TABLE-LEVEL GRANT FIRST. `authenticated` holds UPDATE on the
-- whole table, and in Postgres a table-level privilege covers every column —
-- a column-level REVOKE cannot subtract from it. Measured 2026-08-03: with the
-- table grant left in place, `revoke update (assignment_id, submitted_at)`
-- changed nothing and the escalation still returned UPDATE 1. The only
-- sequence that works is revoke-the-table then grant-the-columns.
--
-- The app writes exactly three columns (src/lib/dal/submissions.ts:105:
-- body, submitted_by, submitted_at) and submitted_at moves to the trigger
-- below, so only body and submitted_by stay client-writable.
revoke update on public.submissions from authenticated;
grant update (body, submitted_by) on public.submissions to authenticated;

-- submitted_at is now server-owned. It advances whenever the answer changes,
-- which is the behaviour public.assignments_awaiting_review depends on: it
-- treats a review as stale when reviewed_at < submitted_at, so an edit must
-- move this column or re-submitted work reads as already assessed.
create or replace function private.touch_submitted_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.body is distinct from old.body then
    new.submitted_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function private.touch_submitted_at() from public;

create trigger submissions_touch_submitted_at
  before update on public.submissions
  for each row execute function private.touch_submitted_at();

-- Belt and braces with the revoke above: even if a future migration re-grants a
-- column, the new row must still satisfy the same predicate the INSERT policy
-- applies. Note both halves are needed — writes_submission(uid, id) enforces
-- the approval lock against the OLD row via USING, can_write_submission
-- enforces entitlement against the NEW columns via WITH CHECK.
drop policy if exists "submissions_update_pupil_or_guardian" on public.submissions;
create policy "submissions_update_pupil_or_guardian"
  on public.submissions for update to authenticated
  using (private.writes_submission((select auth.uid()), id))
  with check (
    private.writes_submission((select auth.uid()), id)
    and private.can_write_submission(
      (select auth.uid()), assignment_id, assignment_group_id, student_id)
    and submitted_by = (select auth.uid())
  );

-- ── assignments ───────────────────────────────────────────────────────────
-- Nothing in src/ updates this table (verified 2026-08-03: eight `from(
-- 'assignments')` call sites, no .update() or .upsert()), so these revokes
-- cost no functionality today.
--
-- due_on is included deliberately. An unchecked edit that drags an old
-- assignment's frist into the current term silently re-opens
-- assignment_group_mate_names for its frozen group, because that function's
-- retention bound keys on due_on. If an edit-assignment feature is built later
-- it must re-grant due_on TOGETHER WITH a term-window check, never alone.
--
-- Same table-then-columns sequence as above, for the same reason.
-- updated_at is deliberately NOT granted: set_updated_at assigns it in a
-- trigger, and a trigger can write a column the caller cannot — column
-- privileges are checked against the statement's SET list, not against NEW
-- assignments. Verified 2026-08-03.
revoke update on public.assignments from authenticated;
grant update (title, instructions, subject_id, submission_type)
  on public.assignments to authenticated;
```

- [ ] **Step 4: Apply and re-run the pgTAP file**

Run: `supabase migration up && supabase test db --file supabase/tests/31_column_locks.sql`

Expected: `Tests: 8`, all passing. If assertion 5 (the positive control) now fails, the revoke list is too wide — `body` must remain writable.

- [ ] **Step 5: Stop sending `submitted_at` from the DAL**

The column is revoked, so the existing update would now 42501 on every hand-in edit. In `src/lib/dal/submissions.ts:105`, change:

```ts
      .update({ body, submitted_by: userId, submitted_at: new Date().toISOString() })
```

to:

```ts
      // submitted_at is server-owned (private.touch_submitted_at, migration
      // 20260803000000). Sending it from here would 42501: the column is
      // revoked from `authenticated` so a pupil cannot backdate a late hand-in.
      .update({ body, submitted_by: userId })
```

- [ ] **Step 6: Write the api test — the path an attacker actually uses**

pgTAP runs as a database role. The exploit runs over PostgREST with a real JWT, and this branch has already shipped one control that passed pgTAP while being bypassable over HTTP. Create `tests/api/submission-column-locks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { signInAs } from './helpers/auth';
import { SEED } from './helpers/seed';

describe('submissions column locks over PostgREST', () => {
  it('refuses a pupil rewriting assignment_id on their own hand-in', async () => {
    const pupil = await signInAs('elev@test.local');

    const { error } = await pupil
      .from('submissions')
      .update({ assignment_id: SEED.assignments.alfabet })
      .eq('id', SEED.submissions.group);

    expect(error).not.toBeNull();
    expect(error!.code).toBe('42501');
  });

  it('refuses a pupil backdating submitted_at', async () => {
    const pupil = await signInAs('elev@test.local');

    const { error } = await pupil
      .from('submissions')
      .update({ submitted_at: '2026-01-01T08:00:00Z' })
      .eq('id', SEED.submissions.group);

    expect(error).not.toBeNull();
    expect(error!.code).toBe('42501');
  });

  it('still lets the pupil edit the body, and the server advances submitted_at', async () => {
    const pupil = await signInAs('elev@test.local');

    const before = await pupil
      .from('submissions')
      .select('submitted_at')
      .eq('id', SEED.submissions.group)
      .single();

    const { error } = await pupil
      .from('submissions')
      .update({ body: 'Revidert svar fra gruppa.' })
      .eq('id', SEED.submissions.group);
    expect(error).toBeNull();

    const after = await pupil
      .from('submissions')
      .select('submitted_at')
      .eq('id', SEED.submissions.group)
      .single();

    expect(new Date(after.data!.submitted_at).getTime())
      .toBeGreaterThan(new Date(before.data!.submitted_at).getTime());
  });

  it('refuses a teacher taking ownership of a colleague-created assignment', async () => {
    const teacher = await signInAs('laerer@test.local');

    const { error } = await teacher
      .from('assignments')
      .update({ created_by: SEED.users.laererforelder })
      .eq('id', SEED.assignments.alfabet);

    expect(error).not.toBeNull();
    expect(error!.code).toBe('42501');
  });
});
```

Check `tests/api/helpers/` for the actual names of the sign-in helper and seed-id constants before writing this — the file must import what exists, not what this plan guessed. If a `SEED` constants module does not exist, inline the UUIDs from `supabase/seed.sql` and say so in a comment.

- [ ] **Step 7: Run the api test**

Run: `npm run test:api -- submission-column-locks`

Expected: 4 passed. ⚠ This deletes any enrolled MFA factor — do not run it while a human walkthrough is in progress.

- [ ] **Step 8: Prove the tests can fail**

Temporarily comment out the `revoke update` on `submissions` in the migration, `supabase db reset`, re-run both suites, and confirm assertions 1–4 of the pgTAP file and the first two api tests go red. Restore, reset, re-run, confirm green. Record the mutant and its victims in the commit message — this branch has shipped eight assertions that could not fail, and the fix for two of them was itself unfailable.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260803000000_submission_assignment_column_locks.sql \
        supabase/tests/31_column_locks.sql \
        tests/api/submission-column-locks.test.ts \
        src/lib/dal/submissions.ts
git commit -F- <<'MSG'
fix(rls): close two privilege-escalation chains via column locks

A pupil could PATCH submissions.assignment_id to any assignment and unlock
its rows, its group membership and its Storage objects through
private.student_in_assignment branch 2. The UPDATE policy structurally could
not catch it: private.writes_submission takes a row id and is STABLE, so it
sees the pre-update snapshot. The INSERT policy has always validated the NEW
columns; the UPDATE policy now does too.

A co-teacher could PATCH assignments.created_by to themselves and then call
discard_empty_assignment, whose NOT_YOURS guard then matched. 21_assignments_rls
asserts that exact property and was green only because it never tried the PATCH.

submitted_at moves to a trigger because no with-check can distinguish a
legitimate touch from a backdate.

Mutation-tested: dropping the submissions revoke reddens pgTAP 31 assertions
1-4 and the first two api tests, nothing else.
MSG
```

---

### Task 2: Omit protected pupils from the mate list

**Files:**
- Create: `supabase/migrations/20260803001000_protected_mate_omission.sql`
- Modify: `supabase/tests/22_submissions_rls.sql` (the protected-pupil pair)
- Modify: `src/components/assignments/HandInCard.tsx:60-80`

**Decision being implemented (settled 2026-08-03):** a protected pupil is omitted from the mate list entirely, rather than rendered as «Skjermet» or as the current neutral «En annen elev». Both placeholders carry identical information — "there is a member here whose name you may not see" — and any parent who has seen one named mate learns the mapping on first use. What the portal uniquely discloses is not the child's identity (their classmates see them daily in one room) but the *fact that they are under protection*, which in Norwegian practice usually means adressesperre or a barnevern situation. «Skjermet» remains the staff-only term on the six staff surfaces that already use it.

The current code comment at `HandInCard.tsx:70-78` argues the opposite and must be replaced, not left to contradict the new behaviour.

- [ ] **Step 1: Write the failing pgTAP assertions**

In `supabase/tests/22_submissions_rls.sql`, replace the protected-pupil pair (currently asserting a null name and a count of 1) with:

```sql
select is_empty(
  $$ select 1 from public.assignment_group_mate_names(
       array['bb000000-0000-0000-0000-000000000063'::uuid],
       'fe000000-0000-0000-0000-000000000031')
     where student_id = 'fe000000-0000-0000-0000-000000000004' $$,
  '★ a protected pupil produces NO ROW at all — not a null name, not a placeholder');

select is(
  (select count(*)::int from public.assignment_group_mate_names(
     array['bb000000-0000-0000-0000-000000000063'::uuid],
     'fe000000-0000-0000-0000-000000000031')),
  0,
  '★ and the omission is total: a 2-member group whose only mate is protected yields nothing');
```

The second assertion exists to keep the first honest. `is_empty()` over a function returning zero rows for an unrelated reason — a broken standing check, a retention bound excluding everything — would pass while proving nothing.

Adjust the fixture UUIDs to the ones actually used in that file; the group and pupil ids above are illustrative and MUST be checked against the file's own fixture block before running.

- [ ] **Step 2: Run and confirm failure**

Run: `supabase test db --file supabase/tests/22_submissions_rls.sql`

Expected: both new assertions FAIL — today the function returns one row with a null name.

Also expect a `plan()` mismatch if the assertion count changed. Do not fix `plan()` by counting with grep: grep undercounts multi-line pgTAP calls (measured 17 against a correct `plan(20)` in this repo). Run the file and use the number pgTAP reports.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260803001000_protected_mate_omission.sql`:

```sql
-- F6, settled 2026-08-03: a protected («skjermet») pupil is OMITTED from the
-- mate list, not rendered as a placeholder.
--
-- The placeholder and «Skjermet» carry identical information. Both say "there
-- is a member here whose name you may not see", and a parent who has seen one
-- named mate learns the mapping immediately — so the placeholder was itself the
-- oracle for the thing it protected. The classroom already discloses WHO the
-- children are; what only the portal discloses is that this particular child is
-- under protection, which is the most sensitive bit in the feature.
--
-- Omission is only real if the id disclosure goes too. With
-- assignment_group_members handing a guardian every member's student_id, a
-- caller could subtract the projection's rows from the policy's rows and
-- recover the omitted member by arithmetic. The two changes are therefore ONE
-- change and must not be split across migrations.

create or replace function public.assignment_group_mate_names(
  p_group_ids uuid[],
  p_student_id uuid
)
returns table (assignment_group_id uuid, student_id uuid, short_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select agm.assignment_group_id,
         agm.student_id,
         private.short_name(s.first_name, s.last_name)
    from public.assignment_group_members agm
    join public.students s on s.id = agm.student_id
    join public.assignment_groups ag on ag.id = agm.assignment_group_id
    join public.assignments a on a.id = ag.assignment_id
    join public.terms t
      on t.is_current
     and a.due_on between t.starts_on and t.ends_on
   where agm.assignment_group_id = any(p_group_ids)
     and agm.student_id is distinct from p_student_id
     -- ★ THE CHANGE: a protected pupil yields no row at all.
     and not s.protected
     -- The standing check. Correlated PER GROUP, so passing 200 group ids
     -- returns rows only for the groups the caller actually stands in.
     and exists (
       select 1
         from public.assignment_group_members standing
        where standing.assignment_group_id = agm.assignment_group_id
          and standing.student_id = p_student_id
     );
$$;

revoke execute on function public.assignment_group_mate_names(uuid[], uuid) from public;
grant execute on function public.assignment_group_mate_names(uuid[], uuid) to authenticated;

-- Narrow the family branch to own-membership only. Verified 2026-08-03 that all
-- three consumers (dal/assignments.ts:841, dal/submissions.ts:87,
-- dal/attachments.ts:284) only ever ask "is my own child in this group?" — the
-- mate list comes exclusively from the definer projection above. Teacher and
-- admin branches are deliberately untouched.
drop policy if exists "assignment_group_members_select_related"
  on public.assignment_group_members;
create policy "assignment_group_members_select_related"
  on public.assignment_group_members for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_assignment_group((select auth.uid()), assignment_group_id)
    or private.is_linked_student((select auth.uid()), student_id)
    or private.is_guardian_of((select auth.uid()), student_id)
  );
```

⚠ Before running this, verify that `private.teaches_assignment_group` is the actual helper name used by the existing policy. Read the current policy with
`docker exec supabase_db_iqra-portal psql -U postgres -c "\d+ public.assignment_group_members"`
and reuse whatever the teacher branch already calls. Substituting a helper that does not exist will drop the teacher's access silently — the policy will simply match nothing.

- [ ] **Step 4: Apply and re-run**

Run: `supabase migration up && supabase test db --file supabase/tests/22_submissions_rls.sql`

Expected: `Tests: N` with the two new assertions green and every pre-existing assertion in the file still green. If a teacher-facing assertion in this file or in `21_assignments_rls.sql` goes red, the helper name in the policy is wrong — fix the name, do not weaken the assertion.

- [ ] **Step 5: Remove the placeholder from the UI**

In `src/components/assignments/HandInCard.tsx`, delete the `MATE_PLACEHOLDER` constant and the doc comment above it (lines ~68-80), and replace the mate-name mapping so a null name can no longer reach the screen:

```tsx
/**
 * A protected («skjermet») pupil is omitted from this list by
 * public.assignment_group_mate_names (migration 20260803001000), so `name` is
 * non-null for every row that arrives here. The placeholder this component used
 * to render was itself an oracle: it announced that a member existed whose name
 * was withheld, which is the one fact the omission exists to hide. «Skjermet»
 * stays a staff-only term.
 */
const mateNames = assignment.group_mates
  .map((mate) => mate.name)
  .filter((name): name is string => name !== null);
```

- [ ] **Step 6: Pin it in a component test**

In `src/components/assignments/HandInCard.test.tsx`, add:

```tsx
it('renders no placeholder when the projection omitted a protected mate', () => {
  render(
    <HandInCard
      assignment={{
        ...groupAssignment,
        group_name: 'Halaqa A',
        group_mates: [],
      }}
      copy={pupilCopy}
    />,
  );

  expect(screen.queryByText(/En annen elev/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Skjermet/)).not.toBeInTheDocument();
});
```

Note the fixture keeps `group_name` set with an empty `group_mates`. That combination is exactly the shape a fully-omitted group produces, and it is also the shape that would regress if someone re-gated the group sentence on `mates.length > 0` — which is why the group label is gated on `group_name`, not on the mate list.

- [ ] **Step 7: Run the component tests**

Run: `npm test -- HandInCard`

Expected: all passing, including the new case.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260803001000_protected_mate_omission.sql \
        supabase/tests/22_submissions_rls.sql \
        src/components/assignments/HandInCard.tsx \
        src/components/assignments/HandInCard.test.tsx
git commit -F- <<'MSG'
fix(privacy): omit protected pupils from group mate lists

Both «Skjermet» and the neutral «En annen elev» carry identical information —
that a member exists whose name is withheld — so the placeholder was the oracle
for the thing it protected. The classroom already discloses who the children
are; only the portal disclosed that a particular child is under protection.

Paired with narrowing assignment_group_members_select_related to own-membership,
without which the omission is undone by subtracting the projection's rows from
the policy's. The two are one change.

«Skjermet» remains the staff-only term on the six staff surfaces.
MSG
```

---

### Task 3: Stop the `writable` flag disclosing another family's review state

**Files:**
- Modify: `src/components/assignments/HandInCard.tsx:110-120, 184-207`
- Modify: `src/components/assignments/HandInCard.test.tsx`

**The defect, reproduced on screen 2026-08-03.** With Yusuf approved on a group task and Bilal unreviewed, Yusuf's card renders «Godkjent · 10 poeng» *and* keeps an editable textarea and a «Lagre innlevering» button — while his individual approved task on the same screen renders no textarea and the sentence «Oppgaven er godkjent.» Reading the two cards together tells the family that somebody else in the group is not approved, and «Du er i gruppe med Bilal O.» names him three lines above.

`private.writes_submission`'s group branch is `can_write AND EXISTS(member with no review, or a review that is not 'godkjent')`. The reader already knows their own review — it is rendered directly above — so subtracting one from the other yields another family's child's assessment state.

**The fix:** stop deriving the family-visible lock from other families' reviews. Lock the card on the reader's own review, which is strictly stricter than the database (so it fails closed, never open) and carries no information about anyone else.

**Accepted cost, stated deliberately:** a pupil whose own work is approved can no longer edit the shared answer even when a mate has been asked to redo. That is a UX regression against a privacy fix, and it is the right trade — refusing an edit the database would have accepted is a support conversation; telling family A that family B's child must redo the work is a personal-data disclosure. If the editing capability matters, the correct route is to make closure a property of the assignment (teacher closes it, or `due_on` plus a grace window) so that writability carries no information at all. That is a Phase 5 design change, not a fix-round change.

- [ ] **Step 1: Write the failing test**

In `src/components/assignments/HandInCard.test.tsx`:

```tsx
it('★ does not reveal that a group mate is unapproved by leaving the box editable', () => {
  render(
    <HandInCard
      assignment={{
        ...groupAssignment,
        group_name: 'Halaqa A',
        group_mates: [{ student_id: 'x', name: 'Bilal O.' }],
        review: { status: 'godkjent', points: 10, feedback: 'Veldig bra.' },
        // The server still says writable, because Bilal has no review yet.
        // That is precisely the bit that must not reach the screen.
        writable: true,
      }}
      copy={pupilCopy}
    />,
  );

  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Lagre innlevering/ })).not.toBeInTheDocument();
});

it('still allows editing when the reader is not approved, whatever the mates are doing', () => {
  render(
    <HandInCard
      assignment={{
        ...groupAssignment,
        group_name: 'Halaqa A',
        group_mates: [{ student_id: 'x', name: 'Bilal O.' }],
        review: null,
        writable: true,
      }}
      copy={pupilCopy}
    />,
  );

  expect(screen.getByRole('textbox')).toBeInTheDocument();
});
```

The second test is the positive control. Without it, locking the card unconditionally would satisfy the first test while breaking every group hand-in.

- [ ] **Step 2: Run and confirm the first test fails**

Run: `npm test -- HandInCard`

Expected: the first new test FAILS (the textarea renders today because `writable` is true). The second PASSES already.

- [ ] **Step 3: Change the lock**

In `src/components/assignments/HandInCard.tsx`, replace line 118:

```tsx
  const locked = !assignment.writable;
```

with:

```tsx
  // Locked on the READER'S OWN review, never on the server's `writable` flag.
  //
  // writes_submission's group branch is
  //   can_write AND EXISTS(member with no review, or a review not 'godkjent')
  // and the reader's own review is rendered directly above this. Subtracting
  // one from the other discloses another family's child's assessment state — in
  // a two-pupil group the mate is named three lines up. Verified on screen
  // 2026-08-03: an approved pupil kept an editable box precisely because their
  // mate was unapproved.
  //
  // Own-review locking is strictly STRICTER than the database, so it fails
  // closed: we may refuse an edit RLS would have accepted, never the reverse.
  // `writable` is still consumed for rows with no review at all, where it
  // carries no cross-family information.
  const locked =
    assignment.review?.status === 'godkjent' ||
    (assignment.review === null && !assignment.writable);
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- HandInCard`

Expected: all passing, both new tests included.

- [ ] **Step 5: Check the lock sentence still tells the truth**

`HandInCard.tsx:206` renders «Oppgaven er godkjent. Snakk med læreren hvis noe skal endres.» Under the new rule that branch is now reached in two cases: an own approval (sentence correct) and a null review with `writable === false` (sentence wrong — nothing was approved). Split it:

```tsx
) : locked ? (
  <p className="text-sm text-ink/70">
    {assignment.review?.status === 'godkjent'
      ? 'Oppgaven er godkjent. Snakk med læreren hvis noe skal endres.'
      : 'Denne innleveringen er låst akkurat nå.'}
  </p>
) : (
```

- [ ] **Step 6: Commit**

```bash
git add src/components/assignments/HandInCard.tsx \
        src/components/assignments/HandInCard.test.tsx
git commit -F- <<'MSG'
fix(privacy): stop the writable flag disclosing a mate's review state

writes_submission's group branch is true while ANY member is unapproved, and
the reader's own review is rendered directly above the box. An approved pupil
seeing an editable answer therefore learned that somebody else in the group was
not approved — and in a two-pupil group the mate is named three lines up.
Reproduced on screen 2026-08-03.

The card now locks on the reader's own review, which is strictly stricter than
the database and so fails closed. Cost: an approved pupil can no longer edit the
shared answer while a mate redoes their part. Making closure a property of the
assignment is the real fix and belongs in a design phase.
MSG
```

---

### Task 4: Stop attachment filenames carrying the surname

**Files:**
- Modify: `src/components/assignments/AttachmentList.tsx:109, 116`
- Modify: `src/components/assignments/AttachmentList.test.tsx`

**The defect.** `submission_attachments` rows are readable by every group member's family through `private.reads_submission`. `src/lib/dal/submissions.ts:202` stores `filename.slice(0, 255)` — the raw browser-supplied name — and `AttachmentList.tsx:109` renders it verbatim, as does the `aria-label` at :116. So `Yusuf Ahmed – sure 1.pdf` hands the full surname to Bilal's family, which is exactly what `assignment_group_mate_names` truncates to «Yusuf A.» in SQL. `safeStorageName` preserves `\p{L}`, so it is in the object path too.

**The fix, minimal and behaviour-preserving for the uploader:** co-members see kind and size; the uploading family and staff see the filename. Both values are already computed in this component.

**★ The visibility is PER ATTACHMENT, not per list.** A group hand-in holds files from several families — Yusuf uploads one, Bilal another — and the viewer is entitled to their own family's filenames but not the other's. A list-level flag cannot express that. It also cannot be computed in the component: the answer is "was this uploaded by me, by my own child, or by a guardian of my own child", which needs `uploaded_by` matched against the caller's own pupils. Only the DAL knows that. So the read resolves it server-side and the component renders what it is told.

- [ ] **Step 1: Resolve the flag in the DAL, where the caller's own pupils are known**

In `src/lib/dal/attachments.ts`, where submission attachments are projected for a family, add `filename_visible` per row. The rule: visible when the row's `uploaded_by` is the caller, or is the `student_user_id` of one of the caller's own pupils, or is a guardian of one of the caller's own pupils. Staff reads (the teacher's review screen) always resolve `true`.

Read the surrounding function before writing this — it already has the caller's pupil set in scope for the second narrowing described in the hat-problem comment, and that same set is what this needs. Do not re-query it.

Where the value cannot be established, emit `false`. This control fails closed.

- [ ] **Step 2: Write the failing component test**

```tsx
it('★ does not show another family the uploader-supplied filename', () => {
  render(
    <AttachmentList
      items={[{
        id: 'a1',
        filename: 'Yusuf Ahmed - sure 1.pdf',
        mime: 'application/pdf',
        size_bytes: 120_000,
        filename_visible: false,
      }]}
      getUrl={vi.fn()}
    />,
  );

  expect(screen.queryByText(/Yusuf Ahmed/)).not.toBeInTheDocument();
  expect(screen.getByText(/Dokument/)).toBeInTheDocument();
});

it('shows the filename to the family that uploaded it', () => {
  render(
    <AttachmentList
      items={[{
        id: 'a1',
        filename: 'Yusuf Ahmed - sure 1.pdf',
        mime: 'application/pdf',
        size_bytes: 120_000,
        filename_visible: true,
      }]}
      getUrl={vi.fn()}
    />,
  );

  expect(screen.getByText('Yusuf Ahmed - sure 1.pdf')).toBeInTheDocument();
});

it('★ shows each family only its own filenames in one mixed group list', () => {
  render(
    <AttachmentList
      items={[
        { id: 'a1', filename: 'Yusuf Ahmed - sure 1.pdf', mime: 'application/pdf',
          size_bytes: 120_000, filename_visible: true },
        { id: 'a2', filename: 'Bilal Omar - opptak.m4a', mime: 'audio/mp4',
          size_bytes: 3_200_000, filename_visible: false },
      ]}
      getUrl={vi.fn()}
    />,
  );

  expect(screen.getByText('Yusuf Ahmed - sure 1.pdf')).toBeInTheDocument();
  expect(screen.queryByText(/Bilal Omar/)).not.toBeInTheDocument();
});
```

The third test is the one that would have caught the list-level design this task originally specified. A per-list flag passes the first two and fails this one.

- [ ] **Step 3: Run and confirm the first and third fail**

Run: `npm test -- AttachmentList`

Expected: tests 1 and 3 FAIL — the filename renders unconditionally today. The field does not exist on the item type yet, so expect a TypeScript error as well; that is the correct failure.

- [ ] **Step 4: Add the field to the item type and gate the render**

In `AttachmentList.tsx`, add `filename_visible: boolean` to the item type with this doc comment, then gate line 109 and the `aria-label` at :116:

```tsx
  /**
   * Whether THIS viewer may see THIS attachment's uploader-supplied filename.
   * Resolved server-side in dal/attachments.ts, never in the component:
   * submission_attachments is readable by every group member's family through
   * private.reads_submission, and a filename like «Yusuf Ahmed - sure 1.pdf»
   * hands over the exact surname assignment_group_mate_names truncates to
   * «Yusuf A.» inside the database.
   *
   * Per attachment, not per list — one group hand-in carries files from
   * several families and each is entitled only to its own.
   */
  filename_visible: boolean;
```

```tsx
<span className="text-sm text-ink/60">{kindLabel(item.mime)}</span>
{item.filename_visible ? (
  <span className="font-medium break-all">{item.filename}</span>
) : null}
<span className="text-sm text-ink/60">{readableSize(item.size_bytes)}</span>
```

```tsx
aria-label={item.filename_visible ? `Åpne ${item.filename}` : `Åpne ${kindLabel(item.mime)}`}
```

- [ ] **Step 5: Check every call site still typechecks**

Run `grep -rn "<AttachmentList" src/` and confirm each call site's data source now carries `filename_visible`. The teacher's review screen resolves `true` for every row; the family surfaces resolve it per row in the DAL. A call site whose projection lacks the field is a typecheck failure, which is the intended forcing function — do not silence it with a default.

- [ ] **Step 6: Run the full unit suite**

Run: `npm test`

Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add src/components/assignments/AttachmentList.tsx \
        src/components/assignments/AttachmentList.test.tsx \
        src/lib/dal/attachments.ts src/app src/components
git commit -F- <<'MSG'
fix(privacy): stop attachment filenames leaking a mate's surname

submission_attachments is readable by every group member's family, and the
uploader-supplied filename was rendered verbatim — so «Yusuf Ahmed - sure
1.pdf» handed over the exact surname assignment_group_mate_names truncates to
«Yusuf A.» inside the database. The minimisation story did not survive one
realistic upload.

Co-members now see kind and size; the uploading family and staff see the name.
Fails closed: a call site that cannot establish the viewer passes false.
MSG
```

---

### Task 5: Verify the whole gate, from a clean database

- [ ] **Step 1: Reset and run everything**

```bash
supabase db reset
npm run typecheck && npm run lint && npm test && npm run test:api && supabase test db
```

⚠ `supabase db reset` exits 1 with `supabase_storage_iqra-portal container is not ready: starting` even on success — that is the CLI's readiness check racing Storage's ~20s migration window. Do NOT re-run on that exit code. Verify instead: containers healthy, `max(version)` in `supabase_migrations.schema_migrations` equals `20260803001000`, and the seed counts below.

⚠ Both steps wipe MFA enrolment. Warn the user before running if they are mid-walkthrough.

- [ ] **Step 2: Confirm the seed returns to baseline**

```bash
docker exec supabase_db_iqra-portal psql -U postgres -c "
select 'auth.users' t, count(*) from auth.users
union all select 'assignments', count(*) from public.assignments
union all select 'submissions', count(*) from public.submissions
union all select 'assignment_reviews', count(*) from public.assignment_reviews
union all select 'storage.objects', count(*) from storage.objects;"
```

Expected: `auth.users` 7, `assignments` 2, `submissions` 2, `assignment_reviews` 1, `storage.objects` 0.

- [ ] **Step 3: Re-run the two original exploits and confirm both are dead**

Use the two rolled-back probe scripts recorded in the Context section. Expected: the `submissions` PATCH now raises `42501` instead of `UPDATE 1`, and `student_in_assignment` stays `f`; the `created_by` PATCH raises `42501` and `discard_empty_assignment` still answers `NOT_YOURS`.

This is the acceptance test for the whole plan. A green suite that does not include this step proves nothing about the two defects it was written for.

- [ ] **Step 4: Commit any gate fixes, then hand back for the walkthrough**

The pupil and parent surfaces changed in Tasks 2–4, so they need re-walking at 1280 and 375 before merge.

---

## Plan Review Ledger

Recorded per CLAUDE.md so the reasoning survives the session.

0. **★★ The plan's central mechanism did not work, and only building it proved that.** The first draft wrote `revoke update (assignment_id, submitted_at, …) on public.submissions from authenticated`. Built in a rolled-back transaction, the escalation still returned **`UPDATE 1`** — because `authenticated` holds a **table-level** UPDATE grant, and in Postgres a table-level privilege covers every column, so a column-level `REVOKE` subtracts nothing. The working sequence is `revoke update on <table>` followed by `grant update (<allowed columns>)`. Re-verified end to end: backdate → `permission denied`, escalation → `permission denied`, legitimate body edit → `UPDATE 1` with the trigger advancing `submitted_at`. **A migration that had shipped the first version would have passed review, read correctly, and closed nothing** — and its pgTAP assertions would have failed loudly only if someone wrote them as `throws_ok`, which is why Task 1 Step 2 requires watching them fail first. Generalisation: never trust a `revoke` on a table whose grants you have not read.

1. **`submitted_at` cannot be fixed by a policy, and the first draft of Task 1 tried to.** No `with check` predicate can distinguish a legitimate touch from a backdate, because both are just a client-supplied timestamp. Moving the column to a trigger and revoking it is the only instrument that closes it. This is the same lesson as 20260801000000: when the question is *which columns*, a policy is the wrong tool.

2. **The revoke list needed a positive control or it would have shipped broken.** Revoking every column on `submissions` satisfies all four escalation assertions while breaking every hand-in in the school. Assertion 5 (`lives_ok` on a body edit) is what stops that, and Step 2 explicitly requires it to pass *before* the fix — a positive control that only passes afterwards is not a control.

3. **Task 2's two halves cannot be split across migrations.** Omitting protected pupils from the projection while `assignment_group_members` still discloses their `student_id` leaves the omission recoverable by subtracting one row set from the other. Landing them separately would create a window where the migration claims a protection it does not have.

4. **Task 3 pays a real UX cost and the plan says so rather than hiding it.** Locking on the reader's own review means an approved pupil cannot edit the shared answer while a mate redoes their part. The alternative — server-computed closure that carries no information — is a design change, not a fix. Stating the cost is what lets the user overrule it.

5. **`due_on` was added to the assignments revoke on evidence, not instinct.** The privacy review found that dragging an old assignment's frist into the current term silently re-opens mate-name resolution for its frozen group, because the retention bound keys on `due_on`. Since nothing in `src/` updates assignments, the revoke is free today — but the comment records that re-granting it requires a term-window check, so a future implementer cannot re-open the hole by accident.

6. **★ Task 4 was designed wrong and the review caught it.** The first draft put `canReadFilename` on the *list*. A group hand-in carries files from several families, so the answer is per *attachment* — with a list-level flag, the moment Yusuf and Bilal both upload, either Bilal's family reads Yusuf's surname or Yusuf's family stops seeing its own filenames. It also cannot be computed in the component at all: "is this my family's upload" requires matching `uploaded_by` against the caller's own pupils, which only the DAL knows. Rewritten as a server-resolved per-row field, and a third test was added specifically because the first two pass under the broken design. This is the shape the phase keeps producing — a control that looks right per screen and is wrong across the set.

7. **Task 3's lock rule was checked against every combination, not just the reported one.** `locked = own review godkjent || (no review && !writable)`. The reachable states: own review `ny_innlevering` leaves the box open (correct — the pupil was asked to redo, and it is their own review so nothing leaks); own review `godkjent` locks regardless of mates (the fix); no review with `writable` false can only arise from non-entitlement or a missing RPC row, because the approval branch is true whenever *any* member is unreviewed — so it cannot be reached by "all mates approved" and carries no cross-family information. The one combination that would leak, `godkjent` + still editable, is exactly the one now closed.

8. **Two helper names in this plan are unverified and are flagged inline rather than asserted.** `private.teaches_assignment_group` in Task 2 and the `signInAs`/`SEED` helpers in Task 1 Step 6 are guesses from surrounding code. Both steps instruct the implementer to read the real names first. A plan that silently guesses an identifier produces a policy that matches nothing — which fails *open* for the teacher branch and would not necessarily redden a test.
