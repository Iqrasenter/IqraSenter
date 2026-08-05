# Phase 5 Plan 1 — Threads and Messages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship working teacher↔family messaging — anchored to one pupil, with an office channel the pupil's teachers cannot read — as schema, RLS, DAL, actions and all four role surfaces.

**Architecture:** Three SECURITY DEFINER predicates in `private` are the only authority on who reads, writes and starts a thread; every policy, DAL read and fan-out calls one of them rather than restating it. Participation is derived from live relationships and never stored, so there is no row whose INSERT is an access grant. Counterpart names come from a definer projection with the caller bind inside its `where`, never from widening `profiles` RLS.

**Tech Stack:** Postgres 15 + Supabase (RLS, pgTAP), Next.js 16 App Router (server components, server actions), TypeScript strict, vitest (unit + api), Tailwind.

---

## Scope of this plan

This is **plan 1 of 4** for Phase 5. It covers spec §11 items 1, 4, 5 (thread half), 6, 7 and the thread halves of 10–12.

**Not in this plan** — each has its own plan, written when this one lands:
- Plan 2: `announcements` + `announcement_reads` + the scheduled-publish fan-out (§11 items 2, 3b).
- Plan 3: `notifications`, `private.email_pings`, the drain route, Resend, «Min profil», the varsel bell (§11 items 3, 8, 8b, 8c, 9, 9b, 13).
- Plan 4: the invite/credential flow (§11 15-series), document reconciliation (14) and the exit gate (16-series).

⚠ **Do not add a notification fan-out trigger in this plan.** `messages` gets its `touch_thread` trigger here and nothing else; plan 3 adds the fan-out to the same table. A fan-out written here would reference `private.email_pings`, which plan 3 creates.

### pgTAP file numbers and fixture prefixes — read before creating a file

The spec's §8 reserves files **35–38** and prefixes **`be`/`bf`/`c0`** (34 and `bd` were taken by M3 on 2026-08-05). This plan claims **35** and **36**; plans 2 and 3 take 37 and 38.

| File | Prefix | Plan |
|---|---|---|
| `supabase/tests/35_threads_rls.sql` | `be` | this plan, Task 1 |
| `supabase/tests/36_thread_counterparts.sql` | `bf` | this plan, Task 3 |
| `supabase/tests/37_announcements_rls.sql` | `c0` | plan 2 |
| `supabase/tests/38_notifications.sql` | `c1` | plan 3 |

⚠ This assigns numbers **by plan order**, which differs from spec §11's item order (where announcements were 35 and counterparts 37). The spec's own §8 has now been wrong about file numbers twice, both times because something landed between spec and execution. **Before creating any file, run `ls supabase/tests/ | tail -3` and confirm the number is still free.** If it is not, take the next free one and correct this table rather than overwriting.

### Migration timestamps

Current head is `20260804002000` (`select max(version) from supabase_migrations.schema_migrations`). This plan adds two migrations: `20260805120000_threads_messages.sql` and `20260805121000_thread_counterparts.sql`. If the head has moved past these, bump both by a day and keep their relative order.

---

## File structure

**Created:**

| File | Responsibility |
|---|---|
| `supabase/migrations/20260805120000_threads_messages.sql` | `threads` + `messages`: tables, indexes, comments, grants (column-locked), RLS enable+force, audit triggers, `touch_thread`, the three `private` predicates, eight policies. One file because RLS without policies denies everything and policies without predicates do not compile. |
| `supabase/migrations/20260805121000_thread_counterparts.sql` | `public.thread_counterparts(uuid[])` — D14's projection, caller bind inside the `where`. |
| `supabase/tests/35_threads_rls.sql` | T-01, T-02, T-03, T-06, T-07, T-17, T-18, T-22, T-23, T-26 + grant/column shape. |
| `supabase/tests/36_thread_counterparts.sql` | T-21. |
| `src/lib/dal/threads.ts` | Every thread read, plus `requireThreadReader`. One module: these reads share the counterpart-name batching and must not drift. |
| `src/lib/validation/threads.ts` | Zod schemas for the two write paths. |
| `src/components/threads/DisclosureBlock.tsx` | D6's permanent block, three variants (`voksen` \| `elev` \| `ansatt`). |
| `src/components/threads/ThreadList.tsx` | Shared list rendering; used by all four surfaces. |
| `src/components/threads/MessageThread.tsx` | Shared message rendering + the composer form. |
| `src/app/(portal)/laerer/meldinger/page.tsx` + `[threadId]/page.tsx` + `ny/page.tsx` + `actions.ts` | Teacher surface. |
| `src/app/(portal)/forelder/meldinger/page.tsx` + `[threadId]/page.tsx` + `ny/page.tsx` + `actions.ts` | Parent surface. |
| `src/app/(portal)/elev/meldinger/page.tsx` + `[threadId]/page.tsx` | Pupil surface (read + reply; no `ny` — D19). |
| `src/app/(portal)/admin/meldinger/page.tsx` + `[threadId]/page.tsx` | Admin oversight + the audited detail route. |
| `tests/api/threads.test.ts` | Wall-1 assertions: entitlement, enumeration-quiet null, T-08's audit delta. |

**Modified:** `supabase/tests/29_definer_fingerprints.sql` (Task 4) · `supabase/tests/31_column_locks.sql` (Task 2) · `src/lib/supabase/database.types.ts` (regenerated, every migration task) · `src/app/(portal)/laerer/LaererNav.tsx`, `forelder/ForelderNav.tsx`, `elev/ElevNav.tsx`, `admin/AdminNav.tsx` (nav entries) · `src/app/action-guards.test.ts` (the action count, once per task that adds actions).

---

## Standing rules for every task in this plan

1. **Tests and implementation land in ONE commit.** The tables do not exist beforehand, so a test-only commit is a red build and violates "each commit compiles and passes tests" (spec §11). Red-first happens in the working tree and is evidenced by the mutation step, not by a committed red build.
2. **Every new assertion must be watched fail** under a named mutation of the code it guards, and pass again after restore. Phase 4 shipped four assertions that survived replacing the guarded function body with `select true`.
3. **Never count `plan()` by grep** — it undercounts multi-line calls. Let pgTAP tell you: a wrong count prints `Looks like you planned N but ran M`.
4. **Run a single pgTAP file** with:
   ```bash
   docker exec -i supabase_db_iqra-portal psql -U postgres -q -f - < supabase/tests/35_threads_rls.sql
   ```
5. **`db reset` and `test:api` wipe MFA enrolment.** Staff routes sit behind AAL2, so after any reset the human must re-enrol at `/mfa/registrer` before clicking anything. Budget it.
6. **Stage explicit paths, never `git add -A`.** `scripts/fiken-probe.mjs` and everything untracked under `docs/` belong to a parallel economy track.
7. **Commit messages:** conventional subject + a substantial «why» body. **No AI trailers** — CLAUDE.md forbids them and overrides the harness default.

---

## Task 1: `threads` + `messages` — schema, predicates, policies, pgTAP 35

**Files:**
- Create: `supabase/migrations/20260805120000_threads_messages.sql`
- Create: `supabase/tests/35_threads_rls.sql`
- Modify: `src/lib/supabase/database.types.ts` (regenerated)

- [ ] **Step 1: Confirm the migration head and the free test number**

```bash
docker exec supabase_db_iqra-portal psql -U postgres -q -t -A -c "select max(version) from supabase_migrations.schema_migrations;" && ls supabase/tests/ | tail -2
```

Expected: `20260804002000` and `34_enrollment_boundary.sql` last. If either has moved, adjust the filenames in this task and fix the table in "Scope of this plan".

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/20260805120000_threads_messages.sql`:

```sql
-- Threads and messages — the Phase 5 messaging core (D1–D7, D19–D24).
--
-- A thread is anchored to exactly ONE pupil (D1) and participation is DERIVED
-- from live relationships, never stored (D2). There is deliberately no
-- thread_participants table: a stored participant row IS an access grant, so
-- whoever could INSERT one could grant themselves a thread — the exact shape
-- of the escalation Phase 4 closed on 2026-08-03.
--
-- `kind` decides WHO ELSE reads, not merely how the row is labelled:
--   'laerer' admits the pupil's current teachers AND the pupil's own login;
--   'kontor' admits neither — only the family and admin (D19, D20).
-- Without it, readership would be derived from the PUPIL rather than from the
-- COUNTERPART, and a family's complaint about a teacher would be delivered to
-- that teacher.
--
-- audit_row_change writes ids and changed column NAMES only, never values
-- (verified in 20260717164230:139-168) — so NO MESSAGE BODY ever enters
-- audit_log. A future reader will otherwise assume the opposite and remove the
-- trigger for the wrong reason.

-- ── threads ─────────────────────────────────────────────────────────
create table public.threads (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  staff_id   uuid not null references public.profiles (id) on delete restrict,
  kind       text not null check (kind in ('laerer', 'kontor')),
  subject    text not null check (char_length(subject) between 1 and 120),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- The COMPOSITE, not two singles: every thread list in §7 is
-- "student_id in (…) order by updated_at desc", the phase's most-used query.
create index threads_student_updated_idx on public.threads (student_id, updated_at desc);
create index threads_staff_idx on public.threads (staff_id);

comment on table public.threads is
  'Meldingstråder. Anchored to ONE pupil (D1); participation is derived from live relationships and never stored (D2). kind decides who else reads: ''laerer'' admits the pupil''s current teachers and the pupil''s own login, ''kontor'' admits only the family and admin (D19).';
comment on column public.threads.kind is
  'Input to private.reads_thread — NOT a label. Deliberately has no UPDATE grant: flipping ''kontor'' to ''laerer'' would hand a family''s office thread to the pupil''s teachers. Validated against staff_id at INSERT by can_start_thread, which is the only moment it can be set.';
comment on column public.threads.staff_id is
  'Who the family is writing TO — display and notification routing only. Read access follows the LIVE teaching relationship (D4), never this column, so a thread survives its originator leaving.';

create trigger threads_set_updated_at
  before update on public.threads
  for each row execute function private.set_updated_at();

-- ⚠ Scoped to the columns that carry meaning. An unscoped `or update` would
-- fire on every `updated_at` touch from private.touch_thread() below — i.e. a
-- second audit row for every message in the school, whose only recorded change
-- is a timestamp. Double the volume, zero signal, and it buries the writes
-- that matter.
create trigger threads_audit
  after insert or delete
     or update of subject, kind, staff_id, student_id, created_by
  on public.threads
  for each row execute function private.audit_row_change('id', 'student_id');

-- ── messages ────────────────────────────────────────────────────────
create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.threads (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete restrict,
  body       text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index messages_thread_created_idx on public.messages (thread_id, created_at);

comment on table public.messages is
  'Immutable (D7): no UPDATE grant of any kind, DELETE admin-only. A mis-sent message is answered, not destroyed — a school''s message log is a record it may have to stand behind. The audit trigger records ids and column names only, never the body.';

create trigger messages_audit
  after insert or update or delete on public.messages
  for each row execute function private.audit_row_change('id', 'thread_id');

-- threads.updated_at must advance when a message lands, because every thread
-- list sorts on it. Trigger-owned for the same reason submissions.submitted_at
-- is: no `with check` predicate can tell a legitimate touch from a
-- client-supplied backdate — both are just a timestamp.
--
-- ★ WHY THIS TRIGGER MAY WRITE A COLUMN NOBODY WAS GRANTED. It is SECURITY
-- DEFINER and owned by the migration role (a superuser), so it bypasses both
-- the column grant above and `force row level security` on threads. That is
-- the whole mechanism — do NOT reason from "a trigger may assign NEW", which
-- is a different rule for BEFORE triggers and does not apply here: this is an
-- AFTER trigger issuing a separate UPDATE against a DIFFERENT row. Dropping
-- `security definer` makes every message from a non-author silently fail to
-- bump the thread, and the thread list then sorts by a stale timestamp.
create or replace function private.touch_thread()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.threads set updated_at = now() where id = new.thread_id;
  return new;
end;
$$;
revoke execute on function private.touch_thread() from public;

create trigger messages_touch_thread
  after insert on public.messages
  for each row execute function private.touch_thread();

-- ── grants: revoke the TABLE, then grant the columns ────────────────
-- ⚠ The order is load-bearing. `revoke update (col) … from authenticated`
-- subtracts NOTHING when the role holds a table-level UPDATE grant — measured
-- 2026-08-03, where the first version of 20260803000000 closed nothing and
-- would have passed review.
revoke all on table public.threads from anon, authenticated, service_role;
grant select on public.threads to authenticated;
grant insert (student_id, staff_id, kind, subject, created_by) on public.threads to authenticated;
grant update (subject) on public.threads to authenticated;
grant delete on public.threads to authenticated;   -- admin-gated by policy
grant select, delete on public.threads to service_role;

revoke all on table public.messages from anon, authenticated, service_role;
grant select on public.messages to authenticated;
grant insert (thread_id, sender_id, body) on public.messages to authenticated;
--   created_at is NOT granted: server-defaulted, so it cannot be backdated.
grant delete on public.messages to authenticated;  -- admin-gated by policy
grant select, delete on public.messages to service_role;

alter table public.threads enable row level security;
alter table public.threads force row level security;
alter table public.messages enable row level security;
alter table public.messages force row level security;

-- ── the three predicates ────────────────────────────────────────────
-- ★ ONE source of truth per question. Every policy below, and the fan-out in
-- plan 3, CALLS these — nothing restates them. Both faults D21 fixes existed
-- because the recipient set was written out by hand a second time.

create or replace function private.reads_thread(uid uuid, tid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.threads t
    where t.id = tid
      and (
        private.has_role(uid, 'admin')
        or private.is_guardian_of(uid, t.student_id)
        or (t.kind = 'laerer' and private.is_linked_student(uid, t.student_id))
        or (t.kind = 'laerer' and private.teaches_student(uid, t.student_id))
      )
  );
$$;
revoke execute on function private.reads_thread(uuid, uuid) from public;
grant execute on function private.reads_thread(uuid, uuid) to authenticated;

-- writes_thread = reads_thread minus BARE admin oversight (D5), plus D23's
-- kontor arm. ⚠ Note the inner disjunction is parenthesised: dropping those
-- brackets makes `t.kind = 'kontor'` a top-level arm and hands every
-- authenticated user every office thread.
create or replace function private.writes_thread(uid uuid, tid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.threads t
    where t.id = tid
      and (
        (private.has_role(uid, 'admin') and (t.staff_id = uid or t.kind = 'kontor'))
        or private.is_guardian_of(uid, t.student_id)
        or (t.kind = 'laerer' and private.is_linked_student(uid, t.student_id))
        or (t.kind = 'laerer' and private.teaches_student(uid, t.student_id))
      )
  );
$$;
revoke execute on function private.writes_thread(uuid, uuid) from public;
grant execute on function private.writes_thread(uuid, uuid) to authenticated;

-- The double bind at creation. Four conjuncts, each closing a different hole:
--   1. the caller is entitled to the pupil — and a PUPIL may start only a
--      'laerer' thread (D19), since they cannot read a 'kontor' one and must
--      not create a thread the office would answer believing they are present;
--   2. the proposed staff_id is a real counterpart OF THE RIGHT KIND;
--   3. staff_id is not a pupil and holds no pupil relationship to sid — this
--      is what makes elev↔elev UNREPRESENTABLE rather than merely refused;
--   4. D24: unless the caller is family to THIS pupil, staff must be the
--      caller. ⚠ This keys on a relationship to the pupil, NOT on holding a
--      staff role. The role test locked out a teacher who is also a parent
--      (laererforelder@test.local): as a parent she was told to name herself,
--      and as a counterpart she failed teaches_student, because she does not
--      teach her own child's class. Both routes closed at once.
create or replace function private.can_start_thread(uid uuid, sid uuid, staff uuid, kind text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select
    -- 1
    (
      private.has_role(uid, 'admin')
      or private.is_guardian_of(uid, sid)
      or private.teaches_student(uid, sid)
      or (kind = 'laerer' and private.is_linked_student(uid, sid))
    )
    -- 2
    and (
      (kind = 'laerer' and private.teaches_student(staff, sid))
      or (kind = 'kontor' and private.has_role(staff, 'admin'))
    )
    -- 3
    and not exists (
      select 1 from public.students s
      where s.id = sid and s.student_user_id = staff
    )
    and not private.is_guardian_of(staff, sid)
    -- 4
    and (
      private.is_guardian_of(uid, sid)
      or private.is_linked_student(uid, sid)
      or staff = uid
    );
$$;
revoke execute on function private.can_start_thread(uuid, uuid, uuid, text) from public;
grant execute on function private.can_start_thread(uuid, uuid, uuid, text) to authenticated;

-- ── policies ────────────────────────────────────────────────────────
-- The UI needs to know whether to render a composer. ★ It must ASK, not
-- re-derive: a TypeScript copy of writes_thread is the same defect D21 removed
-- from the notification fan-out, and the first draft of this plan got it wrong
-- in a way that mattered — it hid the composer from a guardian who also holds
-- `admin`, which at this school is a real person, not a hypothetical.
create or replace function public.can_write_thread(tid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.writes_thread((select auth.uid()), tid); $$;
revoke execute on function public.can_write_thread(uuid) from public;
revoke execute on function public.can_write_thread(uuid) from anon;
grant execute on function public.can_write_thread(uuid) to authenticated;
comment on function public.can_write_thread(uuid) is
  'Whether the CALLER may post in this thread. A thin delegation to private.writes_thread so the UI never re-implements the predicate.';

create policy "threads_select_related"
  on public.threads for select to authenticated
  using (private.reads_thread((select auth.uid()), id));

create policy "threads_insert_entitled"
  on public.threads for insert to authenticated
  with check (
    private.can_start_thread((select auth.uid()), student_id, staff_id, kind)
    and created_by = (select auth.uid())
  );

create policy "threads_update_subject_author"
  on public.threads for update to authenticated
  using (created_by = (select auth.uid()) and private.writes_thread((select auth.uid()), id))
  with check (created_by = (select auth.uid()) and private.writes_thread((select auth.uid()), id));

create policy "threads_delete_admin"
  on public.threads for delete to authenticated
  using (private.has_role((select auth.uid()), 'admin'));

create policy "messages_select_related"
  on public.messages for select to authenticated
  using (private.reads_thread((select auth.uid()), thread_id));

create policy "messages_insert_participant"
  on public.messages for insert to authenticated
  with check (
    private.writes_thread((select auth.uid()), thread_id)
    and sender_id = (select auth.uid())
  );
-- Deliberately NO update policy, and no UPDATE grant above (D7).

create policy "messages_delete_admin"
  on public.messages for delete to authenticated
  using (private.has_role((select auth.uid()), 'admin'));
```

- [ ] **Step 3: Confirm the three helper names this migration depends on exist**

```bash
docker exec supabase_db_iqra-portal psql -U postgres -q -t -A -c "select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('has_role','is_guardian_of','is_linked_student','teaches_student','set_updated_at','audit_row_change') order by 1;"
```

Expected: all six listed. If `is_linked_student` is absent under that name, find the real one (`grep -rn "is_linked_student" supabase/migrations/`) and correct the migration — a missing function fails `db reset` with a clear error, but only after a full reset cycle.

- [ ] **Step 4: Apply and regenerate types**

```bash
supabase db reset && npm run db:types
```

Expected: reset completes; `select max(version)` returns `20260805120000`. ⚠ `supabase db reset` exits 1 on a storage-readiness race even when it worked — verify by the migration head and seed counts, not by the exit code.

- [ ] **Step 5: Write pgTAP 35**

Create `supabase/tests/35_threads_rls.sql`. Fixture prefix `be`. Actors: admin, teacher-of-pupil (`t1`), teacher-of-another-class (`t2`), **teacher-who-is-also-a-parent** (`tp`, guards `s2` whose class she does not teach), guardian of `s1` (`g1`), guardian of another family (`g2`), pupil `s1`'s login, pupil `s2`'s login.

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- Threads and messages: the read wall, the write wall, and the creation bind.
--
-- ★ Every → 0 rows negative below carries an ENTITLED-READER control over the
-- IDENTICAL rows. Pairing a refusal with a second read by the SAME actor only
-- proves the actor has a session; it does not prove the withheld row exists.
-- That is the shape that let four Phase-4 assertions survive replacing the
-- guarded function body with `select true`.

-- ⚠ CORRECTED 2026-08-05 by the review panel. The short eight-line teardown
-- this plan originally carried ABORTS THE WHOLE FILE before assertion 1:
-- assignments.class_id is ON DELETE RESTRICT and seed.sql populates
-- public.assignments, so `delete from public.classes` raises 23503 and zero
-- assertions run. Use the house order from 34_enrollment_boundary.sql:46-67 —
-- children before parents. Copy THIS block into file 36, not the old one.
delete from public.messages;
delete from public.threads;
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

insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.email, '{"provider":"email","providers":["email"]}',
       jsonb_build_object('full_name', u.full_name), now(), now()
from (values
  ('be000000-0000-0000-0000-000000000001'::uuid, 'pgtap-th-admin@test.local',   'TH Admin'),
  ('be000000-0000-0000-0000-000000000002'::uuid, 'pgtap-th-laerer1@test.local', 'TH Lærer En'),
  ('be000000-0000-0000-0000-000000000003'::uuid, 'pgtap-th-laerer2@test.local', 'TH Lærer To'),
  ('be000000-0000-0000-0000-000000000004'::uuid, 'pgtap-th-laererfar@test.local','TH Lærerforelder'),
  ('be000000-0000-0000-0000-000000000005'::uuid, 'pgtap-th-forelder1@test.local','TH Forelder En'),
  ('be000000-0000-0000-0000-000000000006'::uuid, 'pgtap-th-forelder2@test.local','TH Forelder To'),
  ('be000000-0000-0000-0000-000000000007'::uuid, 'pgtap-th-elev1@test.local',   'TH Elev En'),
  ('be000000-0000-0000-0000-000000000008'::uuid, 'pgtap-th-elev2@test.local',   'TH Elev To')
) as u(id, email, full_name);
insert into public.user_roles (user_id, role) values
  ('be000000-0000-0000-0000-000000000001', 'admin'),
  ('be000000-0000-0000-0000-000000000002', 'teacher'),
  ('be000000-0000-0000-0000-000000000003', 'teacher'),
  ('be000000-0000-0000-0000-000000000004', 'teacher'),
  ('be000000-0000-0000-0000-000000000004', 'parent'),
  ('be000000-0000-0000-0000-000000000005', 'parent'),
  ('be000000-0000-0000-0000-000000000006', 'parent'),
  ('be000000-0000-0000-0000-000000000007', 'student'),
  ('be000000-0000-0000-0000-000000000008', 'student');

insert into public.terms (id, name, starts_on, ends_on) values
  ('be000000-0000-0000-0000-000000000011', 'TH Termin', '2026-08-15', '2026-12-20');
insert into public.classes (id, term_id, name) values
  ('be000000-0000-0000-0000-000000000021', 'be000000-0000-0000-0000-000000000011', 'TH Klasse A'),
  ('be000000-0000-0000-0000-000000000022', 'be000000-0000-0000-0000-000000000011', 'TH Klasse B');
-- t1 teaches A. t2 teaches B. tp (the teacher-parent) teaches B and guards a
-- child in A — the exact shape D24 exists for.
insert into public.class_teachers (class_id, teacher_id) values
  ('be000000-0000-0000-0000-000000000021', 'be000000-0000-0000-0000-000000000002'),
  ('be000000-0000-0000-0000-000000000022', 'be000000-0000-0000-0000-000000000003'),
  ('be000000-0000-0000-0000-000000000022', 'be000000-0000-0000-0000-000000000004');

-- s3 is in class B, which tp TEACHES, and she has no family tie to them. That
-- combination is what makes assertion 21 non-vacuous: without it, tp's refusal
-- comes from conjunct 1 (she is neither guardian nor teacher of s1) and the
-- assertion passes even with D24's conjunct deleted — proving nothing.
insert into public.students (id, first_name, last_name, birth_year, protected, student_user_id) values
  ('be000000-0000-0000-0000-000000000031', 'TH', 'Elev En',  2013, false, 'be000000-0000-0000-0000-000000000007'),
  ('be000000-0000-0000-0000-000000000032', 'TH', 'Elev To',  2013, false, 'be000000-0000-0000-0000-000000000008'),
  ('be000000-0000-0000-0000-000000000033', 'TH', 'Elev Tre', 2013, false, null);
insert into public.guardian_student (guardian_id, student_id) values
  ('be000000-0000-0000-0000-000000000005', 'be000000-0000-0000-0000-000000000031'),
  ('be000000-0000-0000-0000-000000000006', 'be000000-0000-0000-0000-000000000032'),
  ('be000000-0000-0000-0000-000000000004', 'be000000-0000-0000-0000-000000000032');
insert into public.class_students (class_id, student_id, enrolled_on, left_on) values
  ('be000000-0000-0000-0000-000000000021', 'be000000-0000-0000-0000-000000000031', '2026-08-20', null),
  ('be000000-0000-0000-0000-000000000021', 'be000000-0000-0000-0000-000000000032', '2026-08-20', null),
  ('be000000-0000-0000-0000-000000000022', 'be000000-0000-0000-0000-000000000033', '2026-08-20', null);

-- Two threads about pupil 31: one 'laerer' (counterpart t1), one 'kontor'
-- (counterpart admin). Every assertion below is one of these two.
insert into public.threads (id, student_id, staff_id, kind, subject, created_by) values
  ('be000000-0000-0000-0000-000000000041', 'be000000-0000-0000-0000-000000000031',
   'be000000-0000-0000-0000-000000000002', 'laerer', 'TH Om lekser',
   'be000000-0000-0000-0000-000000000005'),
  ('be000000-0000-0000-0000-000000000042', 'be000000-0000-0000-0000-000000000031',
   'be000000-0000-0000-0000-000000000001', 'kontor', 'TH Om betaling',
   'be000000-0000-0000-0000-000000000005');
insert into public.messages (thread_id, sender_id, body) values
  ('be000000-0000-0000-0000-000000000041', 'be000000-0000-0000-0000-000000000005', 'TH melding i laerertraad'),
  ('be000000-0000-0000-0000-000000000042', 'be000000-0000-0000-0000-000000000005', 'TH melding i kontortraad');

-- ── 01-04 shape and grants ──────────────────────────────────────────
select ok((select relrowsecurity from pg_class where oid = 'public.threads'::regclass),
  'RLS enabled on threads');
select ok((select relforcerowsecurity from pg_class where oid = 'public.threads'::regclass),
  'RLS FORCED on threads (26_rls_force asserts three things per table, not two)');
select is(has_table_privilege('authenticated', 'public.messages', 'UPDATE'), false,
  'D7: authenticated holds NO table UPDATE on messages');
select is(has_column_privilege('authenticated', 'public.messages', 'created_at', 'INSERT'), false,
  'messages.created_at is server-defaulted and cannot be backdated at INSERT');

-- ── 05-07 T-17: a kontor thread is invisible to the pupil's teacher ─
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"be000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is(
  (select count(*) from public.messages where thread_id = 'be000000-0000-0000-0000-000000000042'),
  0::bigint, 'T-17: the pupil''s own teacher reads NOTHING in the kontor thread');
select is(
  (select count(*) from public.messages where thread_id = 'be000000-0000-0000-0000-000000000041'),
  1::bigint, 'control: the same teacher reads the laerer thread about the same pupil');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"be000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*) from public.messages where thread_id = 'be000000-0000-0000-0000-000000000042'),
  1::bigint, 'control: the admin counterpart reads that same kontor thread — so the 0 above is refusal, not absence');
reset role;

-- ── 08-10 T-22 (D19): the pupil is out of the kontor thread ─────────
select set_config('request.jwt.claims',
  '{"sub":"be000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*) from public.messages where thread_id = 'be000000-0000-0000-0000-000000000042'),
  0::bigint, 'T-22: the pupil does not read their family''s kontor thread');
select is(
  (select count(*) from public.messages where thread_id = 'be000000-0000-0000-0000-000000000041'),
  1::bigint, 'control: the same pupil reads their laerer thread');
select throws_ok(
  $$ insert into public.threads (student_id, staff_id, kind, subject, created_by)
     values ('be000000-0000-0000-0000-000000000031',
             'be000000-0000-0000-0000-000000000001', 'kontor', 'TH Elevforsøk',
             'be000000-0000-0000-0000-000000000007') $$,
  '42501', null, 'T-22: a pupil cannot START a kontor thread either');
reset role;

-- ── 11-13 T-01/T-02: parent A never reaches child B ─────────────────
select set_config('request.jwt.claims',
  '{"sub":"be000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*) from public.messages where thread_id = 'be000000-0000-0000-0000-000000000041'),
  0::bigint, 'T-01 read half: a guardian of another child reads nothing of this thread');
select throws_ok(
  $$ insert into public.messages (thread_id, sender_id, body)
     values ('be000000-0000-0000-0000-000000000041',
             'be000000-0000-0000-0000-000000000006', 'TH innbrudd') $$,
  '42501', null, 'T-01 write half: and cannot post into it');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"be000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*) from public.messages where thread_id = 'be000000-0000-0000-0000-000000000041'),
  1::bigint, 'control: the pupil''s OWN guardian reads that identical thread');
reset role;

-- ── 14-15 T-06: nobody can forge a sender ───────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"be000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.messages (thread_id, sender_id, body)
     values ('be000000-0000-0000-0000-000000000041',
             'be000000-0000-0000-0000-000000000002', 'TH utgir seg for læreren') $$,
  '42501', null, 'T-06: the author pin refuses a forged sender_id');
select lives_ok(
  $$ insert into public.messages (thread_id, sender_id, body)
     values ('be000000-0000-0000-0000-000000000041',
             'be000000-0000-0000-0000-000000000005', 'TH ekte svar') $$,
  'T-15 positive control: the same guardian posts as themselves');
reset role;

-- ── 16-17 T-07 + T-23: admin write, scoped by kind ──────────────────
select set_config('request.jwt.claims',
  '{"sub":"be000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.messages (thread_id, sender_id, body)
     values ('be000000-0000-0000-0000-000000000041',
             'be000000-0000-0000-0000-000000000001', 'TH admin i laerertraad') $$,
  '42501', null,
  'T-07: an admin who is not staff_id cannot post in a LAERER thread (D5)');
select lives_ok(
  $$ insert into public.messages (thread_id, sender_id, body)
     values ('be000000-0000-0000-0000-000000000042',
             'be000000-0000-0000-0000-000000000001', 'TH kontoret svarer') $$,
  'T-23: the SAME admin may post in the KONTOR thread (D23, office continuity)');
reset role;

-- ── 18-19 T-03: elev↔elev is unrepresentable ────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"be000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.threads (student_id, staff_id, kind, subject, created_by)
     values ('be000000-0000-0000-0000-000000000031',
             'be000000-0000-0000-0000-000000000008', 'laerer', 'TH elev-elev',
             'be000000-0000-0000-0000-000000000005') $$,
  '42501', null,
  'T-03: a pupil login cannot be a thread''s counterpart — elev↔elev has no shape');
select lives_ok(
  $$ insert into public.threads (student_id, staff_id, kind, subject, created_by)
     values ('be000000-0000-0000-0000-000000000031',
             'be000000-0000-0000-0000-000000000002', 'laerer', 'TH ny traad',
             'be000000-0000-0000-0000-000000000005') $$,
  'T-15 positive control: the same guardian starts a legitimate thread');
reset role;

-- ── 20-21 T-26 (D24): the teacher who is also a parent ──────────────
select set_config('request.jwt.claims',
  '{"sub":"be000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.threads (student_id, staff_id, kind, subject, created_by)
     values ('be000000-0000-0000-0000-000000000032',
             'be000000-0000-0000-0000-000000000002', 'laerer', 'TH om mitt eget barn',
             'be000000-0000-0000-0000-000000000004') $$,
  'T-26: a teacher who is also a parent starts a thread about her OWN child, naming that child''s real teacher');
-- ⚠ The pupil here MUST be one she teaches (s3, class B) and has no family tie
-- to. Naming a pupil she neither teaches nor guards would be refused by
-- conjunct 1 instead, and the assertion would pass with D24 deleted.
select throws_ok(
  $$ insert into public.threads (student_id, staff_id, kind, subject, created_by)
     values ('be000000-0000-0000-0000-000000000033',
             'be000000-0000-0000-0000-000000000003', 'laerer', 'TH kapret navn',
             'be000000-0000-0000-0000-000000000004') $$,
  '42501', null,
  'T-26 other half: over a pupil she TEACHES but has no family tie to, she cannot name a colleague as counterpart');
reset role;

-- ── 22-24 T-18: a former teacher reads nothing ──────────────────────
update public.class_students set left_on = '2026-09-01'
  where student_id = 'be000000-0000-0000-0000-000000000031';
select set_config('request.jwt.claims',
  '{"sub":"be000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*) from public.messages where thread_id = 'be000000-0000-0000-0000-000000000041'),
  0::bigint,
  'T-18: a teacher whose pupil has left reads nothing — including a thread they are staff_id of');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"be000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select isnt(
  (select count(*) from public.messages where thread_id = 'be000000-0000-0000-0000-000000000041'),
  0::bigint, 'control: the guardian still reads that identical thread');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"be000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select isnt(
  (select count(*) from public.messages where thread_id = 'be000000-0000-0000-0000-000000000041'),
  0::bigint, 'control: and admin still reads it — D18''s continuity path, not a dead thread');
reset role;

-- ── 25 the bracket wall on writes_thread's admin arm ────────────────
-- Nothing else in this file can see this mutation: every other write
-- assertion is against the LAERER thread, where `t.kind = 'kontor'` is false
-- either way. Dropping the brackets makes that clause a TOP-LEVEL arm, so it
-- stops being about admins at all and hands every authenticated user every
-- office thread — which is a stranger posting into a family's conversation
-- about unpaid fees.
select set_config('request.jwt.claims',
  '{"sub":"be000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.messages (thread_id, sender_id, body)
     values ('be000000-0000-0000-0000-000000000042',
             'be000000-0000-0000-0000-000000000006', 'TH fremmed i kontortraad') $$,
  '42501', null,
  'a guardian of another family cannot post into this family''s KONTOR thread');
reset role;

select * from finish();
rollback;
```

- [ ] **Step 6: Run the file**

```bash
docker exec -i supabase_db_iqra-portal psql -U postgres -q -f - < supabase/tests/35_threads_rls.sql
```

Expected: 25 `ok`, no `not ok`, and **no** `Looks like you planned…` line. If the count is off, fix `plan(N)` to what pgTAP reports — never by counting `select` lines.

- [ ] **Step 7: ★ Mutation pass — four named mutations, each must redden ALONE**

Apply each to the live database with `create or replace`, re-run the file, then restore by re-running the migration's function block.

| # | Mutation | Must redden | Must NOT redden |
|---|---|---|---|
| 1 | Delete `t.kind = 'laerer' and` from **the teacher arm** of `reads_thread` | 05 (T-17) | 08 (T-22) |
| 2 | Delete `t.kind = 'laerer' and` from **the pupil arm** of `reads_thread` | 08 (T-22) | 05 (T-17) |
| 3 | Drop the brackets in `writes_thread`'s admin arm → `has_role(uid,'admin') and t.staff_id = uid or t.kind = 'kontor'` | **25** — the clause stops being about admins and every authenticated user gains every office thread | 12, 14, 16 (all against the `laerer` thread, where the mutated clause is false either way) |
| 4 | Replace D24's conjunct 4 with `not private.has_role(uid,'teacher') or staff = uid` (the pre-D24 form) | 20 (T-26 first half) | 21 |

⚠ Mutations 1 and 2 are **different conjuncts of the same function** — run them separately or one masks the other.

- [ ] **Step 8: Full suite from a clean database**

```bash
supabase db reset && supabase test db --local && npm run typecheck && npm run lint
```

Expected: `Files=36, Tests=712` (687 + 25), `Result: PASS`; typecheck 0 errors; lint 0 errors and 5 pre-existing warnings.

⚠ If `26_rls_force.sql` fails, the new tables are missing `force row level security` or a policy — that test asserts three things per public table.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260805120000_threads_messages.sql supabase/tests/35_threads_rls.sql src/lib/supabase/database.types.ts
git commit -m "feat(meldinger): threads and messages, with kind deciding who else reads"
```

Body must state: which decisions the `kind` conjuncts implement (D19, D23, D24), that the audit trigger records no message body, and the four mutations run in step 7 with what each reddened.

---

## Task 2: column locks — assert the grant shape where it is already asserted

**Files:**
- Modify: `supabase/tests/31_column_locks.sql`

- [ ] **Step 1: Read the file's structure and its plan count**

```bash
head -20 supabase/tests/31_column_locks.sql && grep -n "select plan(" supabase/tests/31_column_locks.sql && grep -n "^-- ── " supabase/tests/31_column_locks.sql
```

Note the current `plan(N)` and the section-header numbering. ⚠ If you insert assertions mid-file, every `-- ── NN-NN` header below the insertion point starts lying about its own range. **Append at the end instead**, and add one new section header.

- [ ] **Step 2: Append the new assertions**

Add before `select * from finish();`:

```sql
-- ── Phase 5: threads and messages ───────────────────────────────────
-- The revoke-then-grant sequence, asserted where a future
-- `grant update on public.threads to authenticated` would silently undo it.
select is(has_table_privilege('authenticated', 'public.threads', 'UPDATE'), false,
  'threads holds no TABLE-level UPDATE grant — a column revoke subtracts nothing without this');
select is(has_column_privilege('authenticated', 'public.threads', 'subject', 'UPDATE'), true,
  'the thread author may rename the subject');
select is(has_column_privilege('authenticated', 'public.threads', 'kind', 'UPDATE'), false,
  'kind is INSERT-only: an UPDATE grant would let a kontor thread be flipped to laerer and handed to the pupil''s teachers');
select is(has_column_privilege('authenticated', 'public.threads', 'created_by', 'UPDATE'), false,
  'created_by cannot be laundered — the Phase-4 authorship defect');
select is(has_table_privilege('authenticated', 'public.messages', 'UPDATE'), false,
  'D7: messages are immutable, at the privilege layer');
select is(has_column_privilege('authenticated', 'public.messages', 'created_at', 'INSERT'), false,
  'a message timestamp cannot be forged at INSERT — the submitted_at lesson');
```

Bump `plan(N)` by 6.

- [ ] **Step 3: Run it**

```bash
docker exec -i supabase_db_iqra-portal psql -U postgres -q -f - < supabase/tests/31_column_locks.sql
```

Expected: all pass, no plan mismatch.

- [ ] **Step 4: ★ Mutation — prove assertion 1 can fail**

Run `grant update on public.threads to authenticated;` against the live db, re-run the file. Expected: the first new assertion reddens (and the `kind`/`created_by` ones too — a table grant covers every column, which is exactly the point). Restore with `revoke update on public.threads from authenticated; grant update (subject) on public.threads to authenticated;` and re-run to green.

- [ ] **Step 5: Commit**

```bash
git add supabase/tests/31_column_locks.sql
git commit -m "test(meldinger): pin the thread and message column grants"
```

---

## Task 3: `thread_counterparts` — D14's projection

**Files:**
- Create: `supabase/migrations/20260805121000_thread_counterparts.sql`
- Create: `supabase/tests/36_thread_counterparts.sql`
- Modify: `src/lib/supabase/database.types.ts`

- [ ] **Step 1: Write the migration**

```sql
-- D14: counterpart names come from a PROJECTION, never from widening profiles.
--
-- `authenticated` holds a table-wide SELECT grant on public.profiles, and
-- profiles_select_own_or_admin is a ROW policy — so admitting the row hands
-- over `phone` and `locale` too. The rejected v1 of 20260801000000 did exactly
-- that to public.students and leaked an unrelated family's `note` over plain
-- HTTP. A projection makes phone UNREACHABLE rather than merely un-selected.
--
-- ★ The caller bind is in the WHERE, not the select list. In the select list it
-- would decide what to SHOW; in the where it decides what EXISTS. Only the
-- second is a wall.
create or replace function public.thread_counterparts(thread_ids uuid[])
returns table (thread_id uuid, user_id uuid, display_name text, role_label text)
language sql stable security definer set search_path = ''
as $$
  select t.id,
         p.id,
         coalesce(nullif(trim(p.full_name), ''), 'Ansatt'),
         case when private.has_role(p.id, 'admin') then 'Skolen' else 'Lærer' end
  from public.threads t
  join public.profiles p on p.id = t.staff_id
  where t.id = any(thread_ids)
    and private.reads_thread((select auth.uid()), t.id);
$$;
revoke execute on function public.thread_counterparts(uuid[]) from public;
revoke execute on function public.thread_counterparts(uuid[]) from anon;
grant execute on function public.thread_counterparts(uuid[]) to authenticated;
comment on function public.thread_counterparts(uuid[]) is
  'D14. Returns EXACTLY four columns — a fifth is where phone would arrive. Caller bind is inside the where clause, so an unreadable thread is ABSENT rather than filtered on display.';
```

⚠ **Name the roles in the revoke.** `revoke execute … from public` does **not** strip the explicit anon/authenticated EXECUTE grants that `pg_default_acl` gives to `supabase_admin`-created public functions — measured; the omission leaves a projection callable by `anon` **in cloud only**. See `20260728200000:229`.

- [ ] **Step 2: Apply and regenerate types**

```bash
supabase db reset && npm run db:types
```

- [ ] **Step 3: Write pgTAP 36 (T-21)**

Create `supabase/tests/36_thread_counterparts.sql`, fixture prefix `bf`. Build the same two-family shape as file 35 (copy the fixture block, changing the prefix), then:

```sql
-- ── The projection refuses ids the caller cannot read ───────────────
select set_config('request.jwt.claims',
  '{"sub":"bf000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*) from public.thread_counterparts(
     array['bf000000-0000-0000-0000-000000000041']::uuid[])),
  0::bigint,
  'T-21: a stranger passing a VALID thread id gets 0 rows');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"bf000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*) from public.thread_counterparts(
     array['bf000000-0000-0000-0000-000000000041']::uuid[])),
  1::bigint,
  'control: a genuine participant passing the IDENTICAL array gets exactly 1');
reset role;
-- The exact column set — D14's whole argument. A FIFTH column is where phone
-- would arrive.
--
-- ⚠ CORRECTED 2026-08-05 by two independent review lenses. The original
-- `columns_are('public','thread_counterparts', …)` CANNOT PASS: columns_are
-- reads pg_attribute on a RELATION, and a `returns table (…)` function has no
-- pg_class row at all. Measured against the identically-shaped existing
-- function assignment_group_mate_names — it reports every column as "missing"
-- and `select count(*) from pg_class where relname = …` returns 0. So the
-- assertion would fail on first run, and mutation 2 (`add p.phone` → it
-- reddens) would be untestable. D14's central claim would ship unpinned.
--
-- Also NOT results_eq: that compares row VALUES and in the 0-row half may not
-- compare structure at all.
select is(
  pg_get_function_result('public.thread_counterparts(uuid[])'::regprocedure),
  'TABLE(thread_id uuid, user_id uuid, display_name text, role_label text)',
  'the projection returns exactly D14''s four columns');
select is(
  has_function_privilege('anon', 'public.thread_counterparts(uuid[])', 'EXECUTE'), false,
  'anon cannot execute the projection — named explicitly, because revoke-from-public does not strip the default ACL grant in cloud');
```

Set `plan()` to the fixture assertions plus these four; let pgTAP tell you the number.

- [ ] **Step 4: Run and mutation-test**

Run the file. Then two mutations, each re-running the file:
1. Move `private.reads_thread(...)` from the `where` into the select list as a boolean column → assertion 1 reddens (the stranger now gets a row).
2. Add `p.phone` to the returned columns and the `returns table` list → `columns_are` reddens.

Restore after each.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260805121000_thread_counterparts.sql supabase/tests/36_thread_counterparts.sql src/lib/supabase/database.types.ts
git commit -m "feat(meldinger): counterpart names through a projection, not a wider profiles policy"
```

---

## Task 4: definer fingerprints — the five new functions

**Files:**
- Modify: `supabase/tests/29_definer_fingerprints.sql`

The file asserts that each SECURITY DEFINER function's body still **mentions** the dependencies that make it a wall. It ends in a hard-coded pair count.

- [ ] **Step 1: Read the table's shape and the count line**

```bash
sed -n '1,60p' supabase/tests/29_definer_fingerprints.sql && sed -n '140,155p' supabase/tests/29_definer_fingerprints.sql
```

Expected at the end: `is(count, 26, 'the fingerprint table still covers 26 (function, predicate) pairs')`.

- [ ] **Step 2: Add four entries**

Following the existing `(signature, array[…])` shape:

```sql
    -- The read wall. `kind` is listed on purpose: without those two conjuncts
    -- the predicate derives readership from the PUPIL rather than from the
    -- COUNTERPART, and a family's complaint about a teacher is delivered to
    -- that teacher (D19, D20).
    (
      'private.reads_thread(uuid,uuid)',
      array['private.has_role', 'private.is_guardian_of',
            'private.is_linked_student', 'private.teaches_student', 'kind']
    ),
    -- D5's wall, and D23's exception to it. Both must remain visible.
    (
      'private.writes_thread(uuid,uuid)',
      array['private.has_role', 'staff_id', 'kontor', 'private.is_guardian_of']
    ),
    -- The creation bind. `student_user_id` is what makes elev↔elev
    -- unrepresentable; the two family predicates are D24's exemption, and
    -- deleting them re-locks a teacher-parent out of her own child's thread.
    (
      'private.can_start_thread(uuid,uuid,uuid,text)',
      array['private.teaches_student', 'private.has_role', 'student_user_id',
            'private.is_guardian_of', 'private.is_linked_student']
    ),
    -- The projection: the caller bind is the security property, and the
    -- function is in `public`, i.e. on the PostgREST surface.
    (
      'public.thread_counterparts(uuid[])',
      array['private.reads_thread', 'full_name']
    ),
    -- Stubbed to `select true`, this hands every reader a composer on every
    -- thread — including a bare admin on a teacher's thread, which is D5.
    (
      'public.can_write_thread(uuid)',
      array['private.writes_thread']
    ),
```

- [ ] **Step 3: Bump the count deliberately, once**

⚠ **CORRECTED 2026-08-05 by the review panel: the number is 43, not 31.** The
plan had been counting *functions*; assertion 1 counts **(function, predicate)
pairs** — `select count(*) from definer_markers d, lateral unnest(d.markers)`
(`29_definer_fingerprints.sql:145-149`). The existing 26 is 5+3+4+4+5+5 markers
over **six** functions. The five entries above carry 5+4+5+2+1 = **17** markers,
so the post-Task-4 total is **43** — built and measured live, with all 17
markers confirmed present in `pg_get_functiondef`.

Change `26` to `43` and the message to `'the fingerprint table still covers 43 (function, predicate) pairs'`.

Note that this plan's own earlier ledger entry ("count 30 → **31**") carries the
same miscount, from the same cause. Five functions are added — the three
predicates, the projection, and `public.can_write_thread` — but that is not what
the assertion counts.

⚠ This literal is the same hard-coded-counter trap as `expect(allActions.length).toBe(67)`. Bump it in the commit that adds the functions, and say the new number in the commit body — never adjust it to make an unrelated failure go away.

- [ ] **Step 4: Run, then mutation-test**

```bash
docker exec -i supabase_db_iqra-portal psql -U postgres -q -f - < supabase/tests/29_definer_fingerprints.sql
```

Mutation: `create or replace` `reads_thread` without the two `kind` conjuncts. Expected: the `reads_thread` fingerprint reddens. Restore.

⚠ **A mention is not an operator.** This file cannot see a changed comparison — that is what file 35's behavioural assertions are for. M3 recorded the same gap on `left_on`.

- [ ] **Step 5: Commit**

```bash
git add supabase/tests/29_definer_fingerprints.sql
git commit -m "test(meldinger): fingerprint the three thread predicates and the projection"
```

---

## Task 5: teacher thread list — DAL slice + route + nav

⚠ **`knip` fails unused exports at error level.** Every DAL export in this plan lands in the same commit as its first consumer. Do not create `threads.ts` with five exports and one page.

**Files:**
- Create: `src/lib/dal/threads.ts`
- Create: `src/app/(portal)/laerer/meldinger/page.tsx`
- Create: `src/components/threads/ThreadList.tsx`
- Modify: `src/app/(portal)/laerer/LaererNav.tsx`

- [ ] **Step 1: Write the DAL slice**

Create `src/lib/dal/threads.ts`:

```ts
import { createClient } from '@/lib/supabase/server';
import { requireRole, requireStaffRole } from '@/lib/dal/session';

export interface ThreadRow {
  id: string;
  subject: string;
  kind: 'laerer' | 'kontor';
  updatedAt: string;
  studentName: string;
  counterpartName: string;
}

/**
 * Thread rows for the caller, newest activity first.
 *
 * RLS decides membership — this read applies NO predicate of its own beyond
 * the sort. Restating reads_thread here is exactly the drift D21 removed from
 * the notification fan-out, and the same argument applies to a DAL read: two
 * copies of one rule disagree eventually, and the copy nobody tests wins.
 *
 * Counterpart names come from the projection in ONE batched call, never per
 * row: D11's "resolve through RLS" read literally is an N+1, and a thread the
 * caller cannot read is ABSENT from the projection's result rather than
 * filtered afterwards — a guarantee that cannot be forgotten for one row.
 */
export async function listThreads(): Promise<ThreadRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('threads')
    .select('id, subject, kind, updated_at, students(first_name, last_name)')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`Kunne ikke lese meldinger: ${error.message}`);
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const { data: counterparts, error: cpError } = await supabase.rpc('thread_counterparts', {
    thread_ids: rows.map((r) => r.id),
  });
  if (cpError) throw new Error(`Kunne ikke lese mottakere: ${cpError.message}`);
  const byThread = new Map((counterparts ?? []).map((c) => [c.thread_id, c.display_name]));

  return rows.map((row) => ({
    id: row.id,
    subject: row.subject,
    kind: row.kind as 'laerer' | 'kontor',
    updatedAt: row.updated_at,
    studentName: row.students
      ? `${row.students.first_name} ${row.students.last_name}`
      : 'Ukjent elev',
    counterpartName: byThread.get(row.id) ?? 'Skolen',
  }));
}

/** Teacher surface: role + AAL2 first, then the same unfiltered read. */
export async function listThreadsForTeacher(): Promise<ThreadRow[]> {
  await requireStaffRole('teacher');
  return listThreads();
}

/** Family surfaces: role only — parents and pupils are not behind AAL2. */
export async function listThreadsForFamily(role: 'parent' | 'student'): Promise<ThreadRow[]> {
  await requireRole(role);
  return listThreads();
}
```

⚠ `listThreadsForFamily` is shown here for context but is **first consumed in Task 8**. knip fails unused exports at error level, so adding it now reddens this task's own gate. **Omit both the function and the `requireRole` import** in this commit — an unused import is a lint error in its own right — and add them together in Task 8.

- [ ] **Step 2: Write the shared list component**

Create `src/components/threads/ThreadList.tsx`:

```tsx
import Link from 'next/link';
import { Chip } from '@/components/ui/Chip';
import { formatDateNb } from '@/lib/dates';
import type { ThreadRow } from '@/lib/dal/threads';

/**
 * `basePath` differs per surface (/laerer/meldinger, /forelder/meldinger, …)
 * so the same list serves all four without a role check of its own — the row
 * set is already whatever RLS returned to the caller.
 */
export function ThreadList({ threads, basePath }: { threads: ThreadRow[]; basePath: string }) {
  return (
    <ul className="flex flex-col divide-y divide-ink/10">
      {threads.map((thread) => (
        <li key={thread.id}>
          <Link
            href={`${basePath}/${thread.id}`}
            className="flex flex-wrap items-baseline justify-between gap-2 py-4 hover:bg-ink/5"
          >
            <span className="flex flex-col gap-1">
              <span className="font-medium">{thread.subject}</span>
              <span className="text-sm text-ink/60">
                {thread.studentName} · {thread.counterpartName}
              </span>
            </span>
            <span className="flex items-center gap-3">
              {thread.kind === 'kontor' ? <Chip>Kontoret</Chip> : null}
              <span className="text-sm text-ink/60">{formatDateNb(thread.updatedAt)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Write the page**

Create `src/app/(portal)/laerer/meldinger/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';
import { PillLink } from '@/components/ui/PillLink';
import { ThreadList } from '@/components/threads/ThreadList';
import { listThreadsForTeacher } from '@/lib/dal/threads';

export const metadata: Metadata = { title: 'Meldinger' };

export default async function LaererMeldingerPage() {
  const threads = await listThreadsForTeacher();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold">Meldinger</h1>
        <div className="print:hidden">
          <PillLink href="/laerer/meldinger/ny" variant="primary">Ny melding</PillLink>
        </div>
      </div>

      {threads.length === 0 ? (
        <EmptyState
          title="Ingen meldinger ennå"
          description="Samtaler med foresatte og elever dukker opp her, med den siste aktiviteten øverst."
          action={<PillLink href="/laerer/meldinger/ny" variant="primary">Skriv den første</PillLink>}
        />
      ) : (
        <ThreadList threads={threads} basePath="/laerer/meldinger" />
      )}
    </div>
  );
}
```

⚠ `/laerer/meldinger/ny` does not exist until Task 7. Between this commit and that one the link 404s. That is acceptable for an intermediate commit (the build passes; nothing crashes) — but if you prefer no dead link, land Tasks 5–7 as one commit.

- [ ] **Step 4: Add the nav entry**

In `src/app/(portal)/laerer/LaererNav.tsx`, add to `ITEMS` after «Oppgaver»:

```ts
  { href: '/laerer/meldinger', label: 'Meldinger', exact: false },
```

- [ ] **Step 5: Verify**

```bash
npm run typecheck && npm run lint && npm run knip && npm test -- LaererNav
```

Expected: 0 type errors; 0 lint errors; knip reports **only** the 7 pre-existing findings plus `scripts/fiken-probe.mjs`; the `LaererNav` test passes (it asserts nav items — if it pins a count, update it in this commit).

- [ ] **Step 6: Browser check**

Start the dev server from the portal directory **via Bash, never `preview_start` name-mode** (it serves the session-root repo, not the portal):

```bash
cd ~/dev/iqra-portal && npm run dev
```

Then open `http://localhost:3000/laerer/meldinger`. Log in as `laerer@test.local` / `test-passord-123` and re-enrol MFA at `/mfa/registrer` if the last `db reset` wiped it. Expected: the empty state, and «Meldinger» highlighted in the nav.

⚠ Synthetic clicks do not fire this app's React handlers — a human clicks, you measure.

- [ ] **Step 7: Commit**

```bash
git add src/lib/dal/threads.ts src/components/threads/ThreadList.tsx "src/app/(portal)/laerer/meldinger/page.tsx" "src/app/(portal)/laerer/LaererNav.tsx"
git commit -m "feat(meldinger): teacher thread list"
```

---

## Task 6: the disclosure block + teacher thread detail + `sendMessageAction`

**Files:**
- Create: `src/components/threads/DisclosureBlock.tsx`
- Create: `src/components/threads/MessageThread.tsx`
- Create: `src/app/(portal)/laerer/meldinger/[threadId]/page.tsx`
- Create: `src/app/(portal)/laerer/meldinger/actions.ts`
- Create: `src/lib/validation/threads.ts`
- Modify: `src/lib/dal/threads.ts` (add `getThread`)
- Modify: `src/app/action-guards.test.ts` (action count)

- [ ] **Step 1: Write the disclosure block — all three variants**

⚠ **The copy and the policies are ONE change, never two** (§4.2). Six claims in this text are true only because of a decision: D5 (admin reads), D4 (the pupil's *current* teachers read, and only in a `laerer` thread), D3 + D19 (all guardians read; the pupil reads a `laerer` thread), D7 (immutable), D18's converse (a former teacher does not read), D20 (a complaint about staff goes to the principal, in person).

Create `src/components/threads/DisclosureBlock.tsx`:

```tsx
/**
 * D6: permanent, on every thread screen, for every role. Not a modal, not
 * dismissible, not a settings footnote — a guardian added later, a pupil who
 * gets a login next year, and a substitute teacher must all see it at the
 * moment they write.
 *
 * Three variants, not two. The adult text is addressed to a parent about
 * «barnet ditt»; showing it to staff made a teacher read a disclosure about
 * their own child (corrected 2026-08-05).
 *
 * ⚠ The pupil version names no service outside the school. An earlier draft
 * promised a child that calling 116 111 would not reach the school or their
 * parents — written from memory, very likely false, and a child who discloses
 * on that promise and then has a parent contacted is harmed by our own copy.
 * Removed by the user's decision on 2026-08-05 (§14.2). Do not re-add a line
 * of this kind without the service's own page in front of you.
 */
export function DisclosureBlock({ variant }: { variant: 'voksen' | 'elev' | 'ansatt' }) {
  return (
    <section
      aria-label="Om meldinger"
      className="rounded-lg border border-ink/15 bg-ink/[0.03] p-4 text-sm leading-relaxed"
    >
      {variant === 'voksen' ? (
        <>
          <h2 className="font-medium">Om meldinger i portalen</h2>
          <p>
            Skoleadministrasjonen kan lese meldinger i portalen. I samtaler med en lærer kan
            også andre lærere som underviser barnet ditt lese meldingene.{' '}
            <strong>
              Alle foresatte som er registrert på barnet, og barnet selv hvis det har egen
              innlogging, leser denne samtalen.
            </strong>{' '}
            Meldinger kan ikke slettes eller endres etter at de er sendt.
          </p>
          <p>
            Har du noe sensitivt å ta opp, ring skolen på{' '}
            <a href="tel:+4799864331" className="underline">+47 998 64 331</a> i stedet.
          </p>
          <p>Gjelder det en klage på en ansatt, ta det opp med rektor på skolen — ikke i portalen.</p>
        </>
      ) : null}

      {variant === 'elev' ? (
        <>
          <h2 className="font-medium">Om meldinger</h2>
          <p>
            Foreldrene dine kan lese alt du skriver her, og det kan læreren din og skolen også.
            Meldinger kan ikke slettes.
          </p>
        </>
      ) : null}

      {variant === 'ansatt' ? (
        <>
          <h2 className="font-medium">Om meldinger i portalen</h2>
          <p>
            Skoleadministrasjonen kan lese alle meldinger i portalen, også dine. I samtaler med
            en elev og foresatte kan andre lærere som underviser eleven lese meldingene. Alle
            foresatte som er registrert på eleven, og eleven selv hvis hen har egen innlogging,
            leser samtalen. Meldinger kan ikke slettes eller endres etter at de er sendt.
          </p>
        </>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 2: Add `getThread` to the DAL**

Append to `src/lib/dal/threads.ts`:

```ts
export interface MessageRow {
  id: string;
  body: string;
  createdAt: string;
  senderName: string;
  isOwn: boolean;
}

export interface ThreadDetail {
  id: string;
  subject: string;
  kind: 'laerer' | 'kontor';
  studentName: string;
  counterpartName: string;
  messages: MessageRow[];
  canWrite: boolean;
}

/**
 * One thread and its messages, or null.
 *
 * Enumeration-quiet: a thread that exists but is not the caller's is
 * indistinguishable from one that does not exist. Both return null, and the
 * page renders notFound() — never an error that says "not yours".
 */
export async function getThread(threadId: string): Promise<ThreadDetail | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: thread, error } = await supabase
    .from('threads')
    .select('id, subject, kind, students(first_name, last_name)')
    .eq('id', threadId)
    .maybeSingle();
  if (error) {
    if (error.code === PG_ERROR.INVALID_TEXT) return null;
    throw new Error(`Kunne ikke lese samtalen: ${error.message}`);
  }
  if (!thread) return null;

  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('id, body, created_at, sender_id, profiles(full_name)')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });
  if (msgError) throw new Error(`Kunne ikke lese meldingene: ${msgError.message}`);

  const { data: counterparts } = await supabase.rpc('thread_counterparts', {
    thread_ids: [threadId],
  });

  // ★ ASK, do not re-derive. The first draft of this plan computed canWrite in
  // TypeScript from roles + counterpart, and got it wrong for a guardian who
  // also holds `admin` — it hid the composer from a parent, and at this school
  // most admins are also parents. Delegating to the predicate makes the UI
  // incapable of disagreeing with the wall.
  const { data: canWrite, error: writeError } = await supabase.rpc('can_write_thread', {
    tid: threadId,
  });
  if (writeError) throw new Error(`Kunne ikke sjekke skrivetilgang: ${writeError.message}`);

  return {
    id: thread.id,
    subject: thread.subject,
    kind: thread.kind as 'laerer' | 'kontor',
    studentName: thread.students
      ? `${thread.students.first_name} ${thread.students.last_name}`
      : 'Ukjent elev',
    counterpartName: (counterparts ?? [])[0]?.display_name ?? 'Skolen',
    messages: (messages ?? []).map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.created_at,
      senderName: m.profiles?.full_name ?? 'Ukjent',
      isOwn: m.sender_id === user.id,
    })),
    canWrite: canWrite ?? false,
  };
}
```

Add `import { PG_ERROR } from '@/lib/pg-error';` at the top of the file. ⚠ `getSessionRoles` is **not** needed — an earlier draft used it to re-derive write access, which is the defect the RPC removes.

- [ ] **Step 3: Write the validation schema**

Create `src/lib/validation/threads.ts`:

```ts
import { z } from 'zod';
import { uuidField } from '@/lib/validation/school';

/** Mirrors the CHECK constraints exactly — 1..4000 and 1..120. A schema that
 *  is looser than the column turns a helpful message into a 23514.
 *
 *  ⚠ zod is **4.4.3** here: `z.string().uuid()` is the v3 idiom. The house
 *  already has `uuidField = z.guid(…)` in validation/school.ts — reuse it
 *  rather than introducing a second spelling of the same rule. */
export const messageSchema = z.object({
  threadId: uuidField,
  body: z
    .string()
    .trim()
    .min(1, 'Skriv en melding.')
    .max(4000, 'Meldingen kan ikke være lengre enn 4000 tegn.'),
});

export const newThreadSchema = z.object({
  studentId: uuidField,
  staffId: uuidField,
  kind: z.enum(['laerer', 'kontor']),
  subject: z
    .string()
    .trim()
    .min(1, 'Gi samtalen en tittel.')
    .max(120, 'Tittelen kan ikke være lengre enn 120 tegn.'),
  body: z.string().trim().min(1, 'Skriv en melding.').max(4000, 'Meldingen er for lang.'),
});
```

- [ ] **Step 4: Write the action**

Create `src/app/(portal)/laerer/meldinger/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaffRole } from '@/lib/dal/session';
import { messageSchema } from '@/lib/validation/threads';
import { firstIssue, type FormState } from '@/lib/validation/school';

/**
 * Expected, actionable refusals RETURN — they never throw. Next redacts thrown
 * server-action messages in production, so the parent gets «Noe gikk galt» and
 * a digest while the real sentence goes to the server log (Phase-4 lesson 6).
 */
export async function sendMessageAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireStaffRole('teacher');
  const parsed = messageSchema.safeParse({
    threadId: formData.get('threadId'),
    body: formData.get('body'),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from('messages').insert({
    thread_id: parsed.data.threadId,
    sender_id: user.id,
    body: parsed.data.body,
  });
  if (error) {
    return { error: 'Meldingen ble ikke sendt. Prøv igjen, eller ring skolen.' };
  }

  revalidatePath(`/laerer/meldinger/${parsed.data.threadId}`);
  revalidatePath('/laerer/meldinger');
  return { error: null };
}
```

- [ ] **Step 5: Write the shared thread component**

Create `src/components/threads/MessageThread.tsx`. All four surfaces use it; the action differs per role and is passed in, so the component holds no role knowledge.

```tsx
'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { formatDateTimeNb } from '@/lib/dates';
import type { FormState } from '@/lib/validation/school';
import type { ThreadDetail } from '@/lib/dal/threads';

const EMPTY: FormState = { error: null };

export function MessageThread({
  thread,
  action,
}: {
  thread: ThreadDetail;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY);

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-col gap-4">
        {thread.messages.map((message) => (
          <li
            key={message.id}
            className={
              message.isOwn
                ? 'self-end max-w-[80%] rounded-lg bg-ink/10 p-3'
                : 'self-start max-w-[80%] rounded-lg bg-ink/5 p-3'
            }
          >
            <p className="whitespace-pre-wrap">{message.body}</p>
            <p className="mt-1 text-xs text-ink/60">
              {message.senderName} · <time dateTime={message.createdAt}>
                {formatDateTimeNb(message.createdAt)}
              </time>
            </p>
          </li>
        ))}
      </ol>

      {thread.canWrite ? (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="threadId" value={thread.id} />
          <label htmlFor="body" className="text-sm font-medium">Skriv en melding</label>
          <textarea
            id="body"
            name="body"
            rows={4}
            maxLength={4000}
            required
            className="rounded-lg border border-ink/20 p-3"
          />
          {state.error ? <ErrorPanel>{state.error}</ErrorPanel> : null}
          <Button type="submit" disabled={pending}>
            {pending ? 'Sender …' : 'Send'}
          </Button>
        </form>
      ) : (
        // D5: an admin reading a teacher's thread is an overseer, not a
        // participant. Saying so is better than a form that 42501s on submit.
        <p className="text-sm text-ink/60">
          Du leser denne samtalen som skoleadministrasjon og kan ikke svare i den.
          Start en egen samtale hvis du trenger å skrive til familien.
        </p>
      )}
    </div>
  );
}
```

⚠ **`formatDateTimeNb` does not exist yet, and date helpers are in `src/lib/dates.ts` — NOT `src/lib/format.ts`,** which holds only `formatOre` (currency). Verified 2026-08-05. Add it to `dates.ts` in this commit, beside `formatDateNb` and `formatTime`, with a case in `src/lib/dates.test.ts`:

```ts
/** A message needs day AND time — a thread with six messages on one afternoon
 *  is unreadable when every line says only «5. august». */
export function formatDateTimeNb(iso: string): string {
  return new Intl.DateTimeFormat('nb-NO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
```

- [ ] **Step 5b: Write the page**

Create `src/app/(portal)/laerer/meldinger/[threadId]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BackLink } from '@/components/ui/BackLink';
import { DisclosureBlock } from '@/components/threads/DisclosureBlock';
import { MessageThread } from '@/components/threads/MessageThread';
import { getThread } from '@/lib/dal/threads';
import { requireStaffRole } from '@/lib/dal/session';
import { sendMessageAction } from '../actions';

export const metadata: Metadata = { title: 'Samtale' };

export default async function LaererThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  await requireStaffRole('teacher');
  const { threadId } = await params;
  const thread = await getThread(threadId);
  if (!thread) notFound();

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/laerer/meldinger">Meldinger</BackLink>
      <div>
        <h1 className="text-2xl font-semibold">{thread.subject}</h1>
        <p className="text-sm text-ink/60">{thread.studentName}</p>
      </div>
      <DisclosureBlock variant="ansatt" />
      <MessageThread thread={thread} action={sendMessageAction} />
    </div>
  );
}
```

- [ ] **Step 6: Bump the action count**

`src/app/action-guards.test.ts:213` asserts `expect(allActions.length).toBe(67)`. This task adds one action. Change it to `68`.

⚠ An exact count, not a floor — a parser regression must not be able to drop five actions silently. Bump it deliberately in the commit that adds the action, never to silence an unrelated failure.

- [ ] **Step 7: Verify**

```bash
npm run typecheck && npm run lint && npm test -- action-guards
```

Expected: 0 errors; the action-guards suite passes with 68, and `sendMessageAction` appears in the guarded list (it calls `requireStaffRole`).

- [ ] **Step 8: Browser check**

Log in as `laerer@test.local`, open a thread seeded by hand:

```bash
docker exec supabase_db_iqra-portal psql -U postgres -q -c "insert into public.threads (student_id, staff_id, kind, subject, created_by) select s.id, u.id, 'laerer', 'Prøvesamtale', u.id from public.students s, auth.users u where u.email = 'laerer@test.local' limit 1;"
```

Expected: the thread renders, the disclosure block shows the **staff** wording (not «barnet ditt»), and a message the human types appears after submit.

- [ ] **Step 9: Commit**

```bash
git add src/components/threads/ src/lib/validation/threads.ts src/lib/dal/threads.ts "src/app/(portal)/laerer/meldinger" src/app/action-guards.test.ts
git commit -m "feat(meldinger): thread detail, the disclosure block, and sending a message"
```

Body must record that the disclosure copy carries six claims that are each true only because of a named decision, and that the pupil variant deliberately names no outside service.

---

## Task 7: starting a thread (teacher)

**Files:**
- Create: `src/app/(portal)/laerer/meldinger/ny/page.tsx`
- Modify: `src/app/(portal)/laerer/meldinger/actions.ts` (add `startThreadAction`)
- Modify: `src/lib/dal/threads.ts` (add `listThreadCandidatesForTeacher`)
- Modify: `src/app/action-guards.test.ts` (68 → 69)

- [ ] **Step 1: Add the candidate read**

A teacher may only start a `laerer` thread naming **themselves** (D24 conjunct 4 — she has no family tie to the pupil), about a pupil she currently teaches. Append to `src/lib/dal/threads.ts`:

```ts
export interface ThreadCandidate {
  studentId: string;
  studentName: string;
}

/**
 * Pupils this teacher may start a thread about — the LIVE roster, since
 * can_start_thread's counterpart bind is teaches_student(staff, sid) and staff
 * is the teacher herself. RLS already limits `students` to those she teaches;
 * this read adds no predicate of its own.
 */
export async function listThreadCandidatesForTeacher(): Promise<ThreadCandidate[]> {
  await requireStaffRole('teacher');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('students')
    .select('id, first_name, last_name')
    .order('last_name');
  if (error) throw new Error(`Kunne ikke lese elevlisten: ${error.message}`);
  return (data ?? []).map((s) => ({
    studentId: s.id,
    studentName: `${s.first_name} ${s.last_name}`,
  }));
}
```

- [ ] **Step 2: Add the action**

Append to `src/app/(portal)/laerer/meldinger/actions.ts`:

```ts
export async function startThreadAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireStaffRole('teacher');
  const parsed = newThreadSchema.safeParse({
    studentId: formData.get('studentId'),
    // A teacher names HERSELF: D24's fourth conjunct exempts only someone with
    // a family tie to this pupil, and she has none. Taking staffId from the
    // form would be refused by the predicate anyway — this makes the refusal
    // impossible to trigger by accident rather than merely certain.
    staffId: user.id,
    kind: 'laerer',
    subject: formData.get('subject'),
    body: formData.get('body'),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data: thread, error } = await supabase
    .from('threads')
    .insert({
      student_id: parsed.data.studentId,
      staff_id: parsed.data.staffId,
      kind: parsed.data.kind,
      subject: parsed.data.subject,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (error || !thread) {
    return { error: 'Samtalen ble ikke opprettet. Sjekk at eleven er i klassen din.' };
  }

  const { error: msgError } = await supabase
    .from('messages')
    .insert({ thread_id: thread.id, sender_id: user.id, body: parsed.data.body });
  if (msgError) {
    // The thread exists with no message. Say so rather than pretending it
    // failed — the teacher can open it and write, and a silent rollback here
    // would need a definer RPC we have no other reason to build.
    return { error: 'Samtalen ble opprettet, men den første meldingen ble ikke sendt.' };
  }

  revalidatePath('/laerer/meldinger');
  redirect(`/laerer/meldinger/${thread.id}`);
}
```

Add `redirect` to the `next/navigation` import and `newThreadSchema` to the validation import.

- [ ] **Step 3: Write the page** — a form posting `studentId`, `subject`, `body` to `startThreadAction`, listing candidates from step 1. Include `<DisclosureBlock variant="ansatt" />` above the form (§4.2: the block is on every thread screen, and composing is one).

- [ ] **Step 4: Bump the action count to 69, verify, commit**

```bash
npm run typecheck && npm run lint && npm test -- action-guards
git add "src/app/(portal)/laerer/meldinger" src/lib/dal/threads.ts src/app/action-guards.test.ts
git commit -m "feat(meldinger): a teacher starts a thread about a pupil she teaches"
```

---

## Task 8: parent surface — list, detail, and both ways to start

**Files:**
- Create: `src/app/(portal)/forelder/meldinger/page.tsx`, `[threadId]/page.tsx`, `ny/page.tsx`, `actions.ts`
- Modify: `src/lib/dal/threads.ts` (add `listThreadsForFamily`, `listChildrenForGuardian`)
- Modify: `src/app/(portal)/forelder/ForelderNav.tsx`
- Modify: `src/app/action-guards.test.ts` (69 → 71)

The parent is the only actor who can start **both** kinds. `kind = 'kontor'` names an admin as counterpart; `kind = 'laerer'` names one of the child's current teachers.

- [ ] **Step 1: Add the family reads**

Append to `src/lib/dal/threads.ts` — this is where `listThreadsForFamily` (written in Task 5's step 1 but deliberately not exported then, because knip fails an export with no consumer) becomes live:

```ts
export interface ThreadStaffOption {
  id: string;
  name: string;
  kind: 'laerer' | 'kontor';
}

export interface GuardianChild {
  studentId: string;
  studentName: string;
  staffOptions: ThreadStaffOption[];
}

/**
 * Each child this guardian is registered on, with the counterparts they may
 * name: the child's CURRENT teachers (kind = 'laerer') and the school's admins
 * (kind = 'kontor'). Both halves are re-validated by can_start_thread at
 * INSERT — this read exists so the form does not offer a choice the database
 * will refuse, not as a wall of its own.
 */
export async function listChildrenForGuardian(): Promise<GuardianChild[]> {
  await requireRole('parent');
  const supabase = await createClient();

  const { data: children, error } = await supabase
    .from('guardian_student')
    .select('students(id, first_name, last_name)')
    .order('student_id');
  if (error) throw new Error(`Kunne ikke lese barna dine: ${error.message}`);

  // Admins are the 'kontor' counterpart for every child, so read them once.
  const { data: admins, error: adminError } = await supabase
    .from('user_roles')
    .select('user_id, profiles(full_name)')
    .eq('role', 'admin');
  if (adminError) throw new Error(`Kunne ikke lese kontoret: ${adminError.message}`);
  const officeOptions: ThreadStaffOption[] = (admins ?? []).map((a) => ({
    id: a.user_id,
    name: a.profiles?.full_name ?? 'Skolen',
    kind: 'kontor' as const,
  }));

  const result: GuardianChild[] = [];
  for (const row of children ?? []) {
    const child = row.students;
    if (!child) continue;
    // The child's live class teachers. RLS on class_teachers already limits a
    // guardian to their own child's classes (guardian_in_class).
    const { data: teachers, error: tError } = await supabase
      .from('class_students')
      .select('class_id, classes(class_teachers(teacher_id, profiles(full_name)))')
      .eq('student_id', child.id)
      .is('left_on', null);
    if (tError) throw new Error(`Kunne ikke lese lærerne: ${tError.message}`);

    const teacherOptions: ThreadStaffOption[] = (teachers ?? []).flatMap((t) =>
      (t.classes?.class_teachers ?? []).map((ct) => ({
        id: ct.teacher_id,
        name: ct.profiles?.full_name ?? 'Lærer',
        kind: 'laerer' as const,
      })),
    );

    result.push({
      studentId: child.id,
      studentName: `${child.first_name} ${child.last_name}`,
      // Dedupe: a pupil in two classes taught by the same teacher would
      // otherwise appear twice in the picker.
      staffOptions: [
        ...new Map([...teacherOptions, ...officeOptions].map((o) => [o.id + o.kind, o])).values(),
      ],
    });
  }
  return result;
}
```

⚠ Verify the embedded-select shapes against the generated types before trusting them — PostgREST nests differently for one-to-many vs many-to-one, and `classes(class_teachers(...))` returns an array. Run `npm run typecheck` after writing; the generated `database.types.ts` is the authority, not this plan.

- [ ] **Step 2: Add the two parent actions**

Create `src/app/(portal)/forelder/meldinger/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/dal/session';
import { messageSchema, newThreadSchema } from '@/lib/validation/threads';
import { firstIssue, type FormState } from '@/lib/validation/school';

export async function sendFamilyMessageAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireRole('parent');
  const parsed = messageSchema.safeParse({
    threadId: formData.get('threadId'),
    body: formData.get('body'),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from('messages').insert({
    thread_id: parsed.data.threadId,
    sender_id: user.id,
    body: parsed.data.body,
  });
  if (error) return { error: 'Meldingen ble ikke sendt. Prøv igjen, eller ring skolen.' };

  revalidatePath(`/forelder/meldinger/${parsed.data.threadId}`);
  revalidatePath('/forelder/meldinger');
  return { error: null };
}

/**
 * A guardian is the ONLY actor who may name a counterpart other than
 * themselves — D24's fourth conjunct exempts them precisely because choosing a
 * counterpart is not impersonating one. `kind` and `staffId` therefore both
 * come from the form, and can_start_thread validates the PAIR: a 'laerer'
 * thread must name a teacher of this child, a 'kontor' thread must name an
 * admin. Sending a mismatched pair is a 42501, not a silent success.
 */
export async function startFamilyThreadAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireRole('parent');
  const parsed = newThreadSchema.safeParse({
    studentId: formData.get('studentId'),
    staffId: formData.get('staffId'),
    kind: formData.get('kind'),
    subject: formData.get('subject'),
    body: formData.get('body'),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data: thread, error } = await supabase
    .from('threads')
    .insert({
      student_id: parsed.data.studentId,
      staff_id: parsed.data.staffId,
      kind: parsed.data.kind,
      subject: parsed.data.subject,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (error || !thread) {
    return { error: 'Samtalen ble ikke opprettet. Velg barn og mottaker på nytt.' };
  }

  const { error: msgError } = await supabase
    .from('messages')
    .insert({ thread_id: thread.id, sender_id: user.id, body: parsed.data.body });
  if (msgError) {
    return { error: 'Samtalen ble opprettet, men den første meldingen ble ikke sendt.' };
  }

  revalidatePath('/forelder/meldinger');
  redirect(`/forelder/meldinger/${thread.id}`);
}
```

- [ ] **Step 3: The three pages**

`src/app/(portal)/forelder/meldinger/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';
import { PillLink } from '@/components/ui/PillLink';
import { ThreadList } from '@/components/threads/ThreadList';
import { listThreadsForFamily } from '@/lib/dal/threads';

export const metadata: Metadata = { title: 'Meldinger' };

export default async function ForelderMeldingerPage() {
  const threads = await listThreadsForFamily('parent');

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold">Meldinger</h1>
        <div className="print:hidden">
          <PillLink href="/forelder/meldinger/ny" variant="primary">Ny melding</PillLink>
        </div>
      </div>
      {threads.length === 0 ? (
        <EmptyState
          title="Ingen meldinger ennå"
          description="Her ser du samtaler med lærerne til barna dine, og med skolens kontor."
          action={<PillLink href="/forelder/meldinger/ny" variant="primary">Skriv en melding</PillLink>}
        />
      ) : (
        <ThreadList threads={threads} basePath="/forelder/meldinger" />
      )}
    </div>
  );
}
```

`[threadId]/page.tsx` — identical in shape to the teacher's, with `requireRole('parent')`, `DisclosureBlock variant="voksen"` and `sendFamilyMessageAction`.

`ny/page.tsx` — a client form over `startFamilyThreadAction` rendering `listChildrenForGuardian()`: a `<select name="studentId">`, a `<select name="staffId">` whose options carry the counterpart's `kind` (set a hidden `kind` input from the chosen option, so the pair the database validates is the pair the parent saw), `subject`, `body`, and `<DisclosureBlock variant="voksen" />` above the form.

⚠ **Do not offer a free-text "kind" toggle separate from the recipient list.** Two independent inputs let a parent pick «Kontoret» and then a teacher, which `can_start_thread` refuses with a 42501 the parent cannot act on. One list, each entry carrying its own kind.

- [ ] **Step 4: Nav entry**

In `src/app/(portal)/forelder/ForelderNav.tsx` add `{ href: '/forelder/meldinger', label: 'Meldinger', exact: false }`.

- [ ] **Step 5: Verify and commit**

```bash
npm run typecheck && npm run lint && npm run knip && npm test -- ForelderNav
```

Then bump `action-guards` to **71** and browser-check as `forelder@test.local` (guards Yusuf + Amira, so the child selector must show two names).

```bash
git add "src/app/(portal)/forelder/meldinger" "src/app/(portal)/forelder/ForelderNav.tsx" src/lib/dal/threads.ts src/app/action-guards.test.ts
git commit -m "feat(meldinger): the parent surface, and the only actor who may choose a counterpart"
```

⚠ The parent detail page uses `variant="voksen"`, which is the version naming the school's phone number and the principal route. Do not reuse the staff variant here.

---

## Task 9: pupil surface — read and reply, `laerer` threads only

**Files:**
- Create: `src/app/(portal)/elev/meldinger/page.tsx`, `[threadId]/page.tsx`, `actions.ts`
- Modify: `src/app/(portal)/elev/ElevNav.tsx`
- Modify: `src/app/action-guards.test.ts` (71 → 72)

- [ ] **Step 1: The list page**

Create `src/app/(portal)/elev/meldinger/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';
import { ThreadList } from '@/components/threads/ThreadList';
import { listThreadsForFamily } from '@/lib/dal/threads';

export const metadata: Metadata = { title: 'Meldinger' };

export default async function ElevMeldingerPage() {
  const threads = await listThreadsForFamily('student');

  return (
    <div className="flex flex-col gap-8">
      {/* No «Ny melding» button, deliberately (D19). A pupil cannot start a
          kontor thread — they could not then read it — and the office channel
          is not offered anywhere on this surface. If a pupil needs the office,
          their family writes. A teacher thread is started by the teacher or by
          a guardian. */}
      <h1 className="text-2xl font-semibold">Meldinger</h1>
      {threads.length === 0 ? (
        <EmptyState
          title="Ingen meldinger"
          description="Her ser du samtaler med læreren din."
        />
      ) : (
        <ThreadList threads={threads} basePath="/elev/meldinger" />
      )}
    </div>
  );
}
```

- [ ] **Step 2: The detail page and the action**

`src/app/(portal)/elev/meldinger/[threadId]/page.tsx` mirrors the teacher's detail page with `requireRole('student')`, `DisclosureBlock variant="elev"` and `sendPupilMessageAction`.

`src/app/(portal)/elev/meldinger/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/dal/session';
import { messageSchema } from '@/lib/validation/threads';
import { firstIssue, type FormState } from '@/lib/validation/school';

export async function sendPupilMessageAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireRole('student');
  const parsed = messageSchema.safeParse({
    threadId: formData.get('threadId'),
    body: formData.get('body'),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from('messages').insert({
    thread_id: parsed.data.threadId,
    sender_id: user.id,
    body: parsed.data.body,
  });
  // A pupil posting into a kontor thread is refused by writes_thread (D19).
  // It should be unreachable from this UI — the thread is not in their list —
  // so say something plain rather than explaining a rule they never saw.
  if (error) return { error: 'Meldingen ble ikke sendt. Snakk med læreren din.' };

  revalidatePath(`/elev/meldinger/${parsed.data.threadId}`);
  revalidatePath('/elev/meldinger');
  return { error: null };
}
```

- [ ] **Step 3: Verify the pupil cannot see a kontor thread through the UI**

With the fixture from Task 1 seeded into the dev database, log in as `elev@test.local` and confirm the list shows the `laerer` thread and **not** the `kontor` one. This is the same property as pgTAP 35 assertion 08, checked at the surface a child actually uses.

- [ ] **Step 4: Nav entry, count bump, commit.**

---

## Task 10: admin oversight — the list, the audited detail route

**Files:**
- Create: `src/app/(portal)/admin/meldinger/page.tsx`, `[threadId]/page.tsx`
- Modify: `src/lib/dal/threads.ts` (add `listThreadsForAdmin`, `getThreadAsAdmin`)
- Modify: `src/app/(portal)/admin/AdminNav.tsx`

- [ ] **Step 1: The two audited reads**

Audit triggers are **row-change** triggers — they do not fire on SELECT, so an oversight read produces nothing by itself. The audit write happens in the DAL, on the `adminListAuditLog` precedent in `src/lib/admin/audit-log.ts` (which already audits its own read through `requireAdminActor()`).

Append to `src/lib/dal/threads.ts`:

```ts
import { requireAdminActor, serviceClient } from '@/lib/admin/quarantine';

/**
 * §4.3: the admin's own oversight read is itself a recorded event, written
 * from the DAL — audit triggers are ROW-CHANGE triggers and do not fire on
 * SELECT, so nothing else records it.
 *
 * meta holds ids and counts ONLY. No subject line, no pupil name, no body —
 * the same discipline audit_row_change keeps, and what docs/spec.md:124
 * requires.
 */
export async function listThreadsForAdmin(): Promise<ThreadRow[]> {
  const actorId = await requireAdminActor();
  const threads = await listThreads();
  // The house idiom, from audit-log.ts:27 and users.ts:59 — a SERVICE-ROLE
  // insert into audit_log. `admin.*` is a reserved prefix that private.audit()
  // refuses from an app-role session (the audit_namespace_guard migration), so
  // an admin.* row is itself proof of a service-role write. ⚠ There is no
  // `audit()` helper to import; an earlier draft of this plan invented one.
  const service = serviceClient();
  const { error } = await service.from('audit_log').insert({
    actor_id: actorId,
    action: 'admin.threads.listed',
    entity: 'threads',
    meta: { count: threads.length, filter: 'none' },
  });
  if (error) throw new Error(`Kunne ikke skrive til revisjonsloggen: ${error.message}`);
  return threads;
}

/**
 * The audited detail read. Fires admin.threads.viewed ONLY when the admin is
 * NOT the thread's own counterpart: an admin reading their own office thread
 * is a participant, not an overseer, and logging that would turn audit_log
 * into a reading-habits record of the whole school — which is precisely what
 * §4.3 exists to prevent. T-08 asserts the negative half.
 */
export async function getThreadAsAdmin(threadId: string): Promise<ThreadDetail | null> {
  const actorId = await requireAdminActor();
  const thread = await getThread(threadId);
  if (!thread) return null;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from('threads')
    .select('staff_id, student_id')
    .eq('id', threadId)
    .maybeSingle();

  if (row && row.staff_id !== actorId) {
    const service = serviceClient();
    const { error } = await service.from('audit_log').insert({
      actor_id: actorId,
      action: 'admin.threads.viewed',
      entity: 'threads',
      entity_id: threadId,
      meta: { student_id: row.student_id, message_count: thread.messages.length },
    });
    if (error) throw new Error(`Kunne ikke skrive til revisjonsloggen: ${error.message}`);
  }
  return thread;
}
```

⚠ **Verify the service-client export name before writing this.** `grep -n "^export" src/lib/admin/quarantine.ts` — `requireAdminActor` is confirmed, but the service-client accessor may be named differently (it is used at `audit-log.ts:27` as `service`). Match what is there; do not introduce a second audit-writing path, and do not invent a helper — verified 2026-08-05 that `@/lib/admin/audit-log` exports only `AuditLogEntry` and `adminListAuditLog`.

- [ ] **Step 2: The pages**

`src/app/(portal)/admin/meldinger/page.tsx` renders `listThreadsForAdmin()` through `ThreadList` with `basePath="/admin/meldinger"`, under a heading that says what this screen is:

```tsx
<h1 className="text-2xl font-semibold">Alle samtaler</h1>
<p className="text-sm text-ink/60">
  Skoleadministrasjonen kan lese alle meldinger i portalen. Oppslagene dine blir
  loggført.
</p>
```

`src/app/(portal)/admin/meldinger/[threadId]/page.tsx` uses `getThreadAsAdmin`, `DisclosureBlock variant="ansatt"`, and `MessageThread` — whose `canWrite` is already false for a bare admin on a `laerer` thread and true on a `kontor` one, so the composer appears exactly where D5 and D23 say it should.

- [ ] **Step 3: Verify the audit rows by hand**

```bash
docker exec supabase_db_iqra-portal psql -U postgres -q -c "select action, entity, meta from public.audit_log where action like 'admin.threads%' order by created_at desc limit 5;"
```

Expected: `admin.threads.listed` with `{"count": n, "filter": "none"}` and `admin.threads.viewed` with `{"student_id": …, "message_count": n}` — **and no subject line or body anywhere in `meta`**.

- [ ] **Step 4: Nav entry, verify, commit.**

---

## Task 11: the wall-1 api suite

**Files:**
- Create: `tests/api/threads.test.ts`

pgTAP proves the database refuses. This proves the TypeScript in front of it never hands the database a request that should not have been made — a different failure mode, so a green pgTAP run does not imply it.

- [ ] **Step 1: Write the suite**

Follow the shape of an existing file in `tests/api/` (read one first — the suite is serialised by `vitest.config.api.ts` because it shares one stateful backend, and the sign-in helpers live there).

⚠ **Read `tests/api/harness.ts` first.** This suite does **not** sign clients in
and drive PostgREST — verified 2026-08-05. It **mocks** `@/lib/supabase/server`
with `createServerClientMock` from the harness and calls the server actions
directly, so the wall under test is the TypeScript one. There is no
`tests/api/helpers` module and no `signIn()`; an earlier draft of this plan
invented both.

Open `tests/api/assignments-core.test.ts` and copy its opening block verbatim —
the `vi.mock('server-only')`, `vi.mock('next/cache')`, the `createServerClientMock`
wiring and the `redirectMock` — then write the three cases against it:

```ts
// 1. Enumeration-quiet. A thread that exists but is not yours must be
//    indistinguishable from one that does not: getThread returns null for
//    BOTH, and neither path throws. An error here would let anyone probe
//    which thread ids exist.
// 2. Entitlement. startFamilyThreadAction with a staffId who does not teach
//    the child must come back as a returned FormState error — never a throw,
//    because Next redacts thrown server-action messages in production.
// 3. T-08's audit DELTA (below).
```

★ **T-08's negative must be a DELTA, not a missing action name.** Asserting
that a teacher's read produces no `admin.threads.viewed` row is satisfied by the
namespace guard shipped in `20260717151741`, not by the DAL branching
correctly — so an implementation that logged every read as `thread.viewed`
would pass while building the reading-habits database §4.3 exists to prevent.
Assert instead that `count(*)` over `audit_log` is **unchanged** across a
teacher opening a thread, paired with an admin's open producing exactly one
row.

⚠ Resolve every id against the seed rather than inventing a fixture. The seed accounts are all `@test.local` with password `test-passord-123`: `admin@ elev@ forelder@` (guards Yusuf + Amira) `forelder2@ laerer@ laererforelder@` (**parent AND teacher — the account T-26 is about**) `okonomi@`.

⚠ **T-08's negative must be a DELTA, not a missing action name.** Asserting that a teacher's read produces no `admin.threads.viewed` row is satisfied by the namespace guard shipped in `20260717151741`, not by the DAL branching correctly — so an implementation logging every read as `thread.viewed` would pass while building the reading-habits database §4.3 exists to prevent. Assert that `count(*)` over `audit_log` is **unchanged** across a teacher's open, paired with an admin's open producing exactly one row.

- [ ] **Step 2: Run it**

```bash
npm run test:api -- threads
```

⚠ The full api suite takes ~21 minutes and prints nothing until it finishes (stdout is not a TTY). Progress signal: `select count(*) from auth.sessions` climbing. That churn is GoTrue, not flakiness — measured 2.1×.

- [ ] **Step 3: Commit**

```bash
git add tests/api/threads.test.ts
git commit -m "test(meldinger): wall-1 assertions for thread entitlement and the oversight audit"
```

---

## Exit criteria for this plan

Not the phase's exit gate (that is plan 4) — these are the conditions for calling plan 1 done.

- [ ] `supabase db reset && supabase test db --local` → **Files=36**, all pass.
- [ ] `npm test` → all pass; the count has risen by the nav/component tests added here.
- [ ] `npm run test:api` → all pass (budget 21 min).
- [ ] `npm run typecheck` → 0 · `npm run lint` → 0 errors · `npm run knip` → only the pre-existing findings · `node scripts/audit-gate.mjs` → pass.
- [ ] `npm run build` → clean. Stop the dev server first; `next build` and `next dev` fight over `.next`.
- [ ] Every ★ mutation in Tasks 1, 3 and 4 was run and each reddened **alone**. Record which, in the final commit body.
- [ ] A human has clicked all four surfaces at 1280 and 375, after re-enrolling MFA. Specifically: a pupil cannot see the `kontor` thread; a teacher cannot see it either; the parent can; the admin can read but cannot post in a `laerer` thread and **can** post in a `kontor` one.

---

## What this plan deliberately leaves broken

Say these out loud when handing over, so nobody reports them as defects:

- **No notifications.** Nothing pings anyone; the only way to discover a new message is to open the surface. Plan 3.
- **No e-mail.** Same.
- **No announcements.** The nav has no «Oppslag» entry. Plan 2.
- **Parents and pupils still cannot log in** unless an admin has set a password by hand — provisioned accounts have no credentials (`src/lib/admin/users.ts:19-23`). Plan 4's 15-series. This is why the browser checks above name `forelder@test.local` and `elev@test.local`, which are seeded with `test-passord-123`.

---

## Plan review ledger — 2026-08-05

Reviewed against the goal before any code, per CLAUDE.md. A single focused pass
in the main loop rather than the full multi-agent panel — noted so a later
reader knows the depth, and because agent dispatch was not authorised in this
session. **Nine defects found in the plan**, plus one caught during the
writing-plans self-review.

★ **Eight of the nine came from checking a claim against the repo rather than
against the plan's own internal consistency.** The plan read as careful and was
internally consistent throughout. That is the rule this project has now paid
for four times.

| # | Defect | How it was caught | Consequence if executed |
|---|---|---|---|
| 1 | `formatDateNb` imported from `@/lib/format`, and `formatDateTimeNb` imported at all | Read `src/lib/format.ts` — it exports **only** `formatOre`. Date helpers are in `src/lib/dates.ts`, and no datetime variant exists anywhere | Both shared components fail to compile. The plan also told the engineer to "check it exists" in the wrong file, so the check would have confirmed the wrong thing. Now: import from `dates.ts`, and Task 6 adds `formatDateTimeNb` with a test. |
| 2 | Schemas written `z.string().uuid()` | `node -e` on zod's package.json → **4.4.3**; `validation/school.ts` already exports `uuidField = z.guid(…)` | The v3 idiom, and a second spelling of a rule the house already has in one place. Now reuses `uuidField`. |
| 3 | Task 10 imported `audit()` from `@/lib/admin/audit-log` | `grep -n "^export"` — that module exports **only** `AuditLogEntry` and `adminListAuditLog`. The house writes audit rows as a **service-role insert** (`audit-log.ts:27`, `users.ts:59`) | An invented helper. The oversight audit — §4.3's whole point and what T-08 tests — would not have compiled, and the natural repair is a second audit-writing path. |
| 4 | Task 11 written against `signIn()` / `serviceClient()` from `tests/api/helpers` | `ls tests/api/` → the module is **`harness.ts`**, and the suite **mocks** `@/lib/supabase/server` and calls actions directly rather than driving PostgREST | The entire api task was the wrong shape and would have been rewritten from scratch mid-execution — after a 21-minute run to discover it. |
| 5 | ★ **T-26's second half was VACUOUS** | Traced the predicate by hand: the teacher-parent naming a colleague over a pupil she neither teaches nor guards is refused by **conjunct 1**, not conjunct 4 | The assertion guarding D24 — the decision made hours earlier — would have passed with D24's conjunct **deleted**. Exactly the class of defect that let four Phase-4 assertions survive `select true`. Fixed by adding a pupil in the class she teaches, so only conjunct 4 can refuse. |
| 6 | ★ **`canWrite` re-implemented `writes_thread` in TypeScript** | Walked the role combinations: a guardian who also holds `admin` gets `canWrite = false` on their own child's `laerer` thread | The composer hidden from a parent — and at this school most admins are also parents. It is also the precise defect D21 exists to remove, reintroduced one layer up. Fixed with `public.can_write_thread(uuid)`, a thin delegation, which the fingerprints now cover (count 30 → **31**). |
| 7 | `touch_thread`'s comment justified it by the BEFORE-trigger `NEW` rule | The trigger is `AFTER INSERT` and updates a **different row** — that rule does not apply; it works because it is `security definer` owned by a superuser, bypassing the column grant *and* `force row level security` | Right outcome, wrong reason. A wrong reason in a comment is what makes the next person delete `security definer` and silently break thread sorting for every non-author. |
| 8 | The `threads` audit trigger fired on every `updated_at` touch | Followed `touch_thread`'s UPDATE into the trigger it fires | **Two audit rows per message**, the second recording only a timestamp change. Double volume, zero signal, burying the writes that matter. Now scoped to `update of subject, kind, staff_id, student_id, created_by`. |
| 9 | `bg-brand/10` in the message bubble | `grep` over `globals.css` — there is `--color-ink` and `--ease-brand` (an easing curve), no `brand` colour | A silently-unstyled bubble: Tailwind emits nothing for an undefined token, so it would look merely "wrong" rather than broken, and would probably ship. |

**Caught earlier, during the writing-plans self-review** (recorded here so the
count is honest): the Task 1 mutation table claimed that dropping the brackets
in `writes_thread`'s admin arm would redden assertion 12. It would not — every
write assertion in the file was against the `laerer` thread, where the mutated
clause is false either way. **The mutation that hands every authenticated user
every office thread would have passed silently.** A 25th assertion was added
and the table now names what each mutation must *not* redden as well.

**Verified sound and left unchanged** (checked, not assumed): all six `private`
helpers exist under the names used · the audit trigger event clause matches
`class_students_audit` · `action-guards.test.ts` really asserts `toBe(67)` ·
`29_definer_fingerprints.sql` really ends in `26` · `firstIssue`/`FormState`,
`getSessionRoles`, `requireRole`/`requireStaffRole`, `PG_ERROR`, and the five UI
primitives all exist as imported · `--color-ink` is a real token.

⚠ **Not done, and it is the honest gap:** CLAUDE.md calls for the **full review
panel** on RLS plans, and this was one pass. The panel's value is independent
lenses disagreeing with each other — the Phase-5 spec review had one agent clear
a case another had correctly flagged as critical. If you want it, that needs
agent dispatch authorised; this ledger is a floor, not a ceiling.

---

# Execution ledger — overnight run, 2026-08-05

Agent dispatch **was** authorised for this run, so the review panel the ledger
above called "a floor, not a ceiling" was run: three independent lenses
(privilege escalation · assertion vacuity · repo/operational integration) over
the Task 1 and Task 3 SQL, concurrently with Task 1's execution.

★ **The panel earned its keep on the first task.** The single-pass review that
wrote the plan was careful and internally consistent — and the panel still found
a defect that would have aborted pgTAP file 35 before assertion 1 ever ran, plus
two more assertions that could not fail for the reason they claimed. That is now
the **fifth** time on this project that checking a claim against the repo, rather
than against the plan's own consistency, is what found the defect.

## ⚠ FOUR OPEN DECISIONS — these need the user, and nothing overnight changed them

Each was **proven by executed SQL against the live database**, not inferred. In
each case the code was left as the plan wrote it and the behaviour was **pinned
by a new pgTAP assertion**, labelled `OPEN DECISION 2026-08-05`, so it is visible
in the test output and cannot drift silently. Pinning is not endorsement.

### D-OPEN-1 — the `kontor` wall is role-shaped, not person-shaped

`reads_thread`'s admin arm is a bare `private.has_role(uid,'admin')`. Anyone
holding **both** `admin` and `teacher` therefore reads and writes every office
thread, including one about themselves. Proven: a dual-role user read a
complaint naming them, posted into it, and `can_write_thread` returned true,
while a plain teacher of the same pupil got 0 rows.

**Why it was NOT closed overnight:** the fix (`and (t.kind <> 'kontor' or not
teaches_student(uid, t.student_id))`) has an operational trap — if the only
admin teaches the pupil, that family's office channel reaches **nobody**. That
needs to be checked against who actually holds these roles at IQRA.

**Mitigating, and why this is likely a documentation defect rather than a hole:**
D20 already routes complaints about staff *out* of the portal, and the
DisclosureBlock copy says so in as many words — «Gjelder det en klage på en
ansatt, ta det opp med rektor på skolen — ikke i portalen.» The `kontor` channel
is for office matters. What was genuinely wrong was the migration's **own header
comment**, which claimed `kind` prevents a complaint reaching the teacher it is
about. That comment was corrected — it now states what the predicate actually
delivers.

**The question for you:** does anyone at IQRA hold both `admin` and `teacher`?
If no, this is theoretical and the pin is enough. If yes, decide (a) accept and
say so in the disclosure copy, or (b) close it and guarantee a non-teaching admin.

### D-OPEN-2 — a family can name a teacher-of-their-child as the office counterpart

`can_start_thread`'s kontor arm asks only `has_role(staff,'admin')`. It never
asks whether that person teaches the pupil. `thread_counterparts` then labels
them **«Skolen»**, and Task 8's picker will offer them as the office. Compounds
D-OPEN-1: the UI would actively present the complained-about teacher as the
school office, and plan 3's notification routing would follow `staff_id` to them.

**Why NOT closed:** the obvious fix (`and not teaches_student(staff, sid)`) has
the same lockout trap as D-OPEN-1, and worse — it is a hard refusal at creation,
so an affected family could not open an office thread at all.

### D-OPEN-3 — a pupil's NEW teacher inherits the entire prior thread history

`reads_thread`'s teacher arm has no temporal bound. Proven: a pupil transfers
from class A to class B; the class B teacher, who has never had any relationship
to that family, reads the full body of threads written about the class A
teacher. A substitute added to a class on Monday reads years of that family's
correspondence on Monday.

The plan tested only the **losing** direction (T-18, assertions 22–24 — a former
teacher correctly reads nothing). The **gaining** direction was untested and
unmentioned; grep for «bytter klasse» in the plan returns nothing.

**This is the one I would look at first.** It is the largest privacy surface of
the four, it is invisible to every existing assertion, and unlike the other three
it has no mitigating policy elsewhere. The fix is a real design choice, though:
a new teacher legitimately needs *some* context about a pupil they now teach, so
"bound it by the enrollment interval that made them a teacher" trades one
complaint for another.

### D-OPEN-4 — an admin can delete a thread and cascade the "immutable" log away

`messages.thread_id` is `on delete cascade` and admins hold DELETE on `threads`.
One statement erases the message log; `audit_row_change` records ids and column
*names* only, so the bodies are unrecoverable. Combined with D-OPEN-1, a person
who is the subject of a record can read it and destroy it.

**Probably intentional** — GDPR erasure needs a delete path, and D7 says
"DELETE admin-only" — so this is a governance question (who may erase, and is
it recorded well enough), not obviously a bug. Raised because the `messages`
comment says the log "is a record it may have to stand behind", which a
one-statement cascade undercuts.

### Also noted, low severity

- The plan disagrees with itself on whether a pupil may start a thread: the
  database permits it (`can_start_thread` conjunct 1, deliberately per its
  comment), the file table says «no `ny` — D19». Not an escalation — a
  `laerer` thread's readership does not depend on who created it — but a crafted
  PostgREST call reaches what the UI does not offer. Pick one wording.
- `private.reads_thread` / `can_start_thread` take a caller-supplied `uid` and
  are granted to `authenticated`, so they compose into an "is person P on thread
  T" probe. The grants are **required** (RLS predicates execute as the caller)
  and the same shape already ships on `is_guardian_of` / `teaches_student`, so
  this is house convention, not a regression.

## Defects found and FIXED during execution

| # | Defect | Lens | Consequence had it shipped |
|---|---|---|---|
| 1 | pgTAP 35's teardown omits `delete from public.assignments` | vacuity | **The whole file aborts before assertion 1.** `assignments.class_id` is `on delete restrict` and the seed populates it, so `delete from public.classes` raises 23503. File 34 already documents this exact trap; this plan did not inherit it. Zero assertions would have run — while the task reported a green migration. |
| 2 | Assertion 17 (T-23, D23) was vacuous | vacuity | Thread `…042`'s `staff_id` **was** the posting admin, so `writes_thread` was satisfied by `t.staff_id = uid` alone and D23's `or t.kind = 'kontor'` arm was never consulted. Deleting the arm entirely left the assertion green. Fixed by giving `…042` a *different* admin as counterpart, which is what office continuity actually means. |
| 3 | Assertion 18 (T-03) refused by the wrong conjunct | vacuity | Refused by conjunct 2 (`teaches_student(pupil_login, …)` is false), not by conjunct 3 — whose comment claims it makes elev↔elev unrepresentable. The fixture compared the *wrong pupil's* login. Conjunct 3 could be deleted in full with the file still green. |
| 4 | T-02 claimed in the file's coverage, no assertion for it | vacuity | The cross-class teacher read wall — the arm most likely to be widened later — was untested. `…003` was declared as "teacher of another class" and never read anything. |
| 5 | `has_table_privilege(…,'UPDATE')` does not see column grants | vacuity | Assertion 3 claimed to prove D7 immutability "at the privilege layer"; `grant update (body) on messages` would have left it green. Now `has_any_column_privilege`. |
| 6 | Migration header comment overstated the `kontor` guarantee | escalation | See D-OPEN-1. A comment promising more than the code delivers is how the next reader deletes the wrong line. |
| 7 | Forged `created_by` at thread INSERT had no assertion | escalation | Correctly refused by the policy, but unpinned — unlike the `sender_id` mirror at assertion 14. |
| 8 | Mutation coverage was 5 of 25 assertions | vacuity | Violates the plan's own standing rule 2 ("every new assertion must be watched fail"). Six further mutations added, each targeting a specific previously-unmutated assertion. |

## Verified sound, so nobody re-litigates it

The escalation lens attacked and **refuted**: `writes_thread` ⊄ `reads_thread`
(it is a genuine subset) · bracket precedence in the admin arm (the plan's
mutation 3 is well-aimed) · NULL propagation (every predicate is `exists(…)`,
and RLS `WITH CHECK` fails closed on NULL) · flipping `kind`/`staff_id` through
the `subject` UPDATE policy (refused at the *grant* layer, before RLS) ·
`thread_counterparts` as an existence oracle (a real-but-unreadable id and a
nonexistent id are indistinguishable) · an error-code oracle on message INSERT
(both return 42501, because `WITH CHECK` is evaluated before the FK trigger) ·
`anon` reaching the predicates locally · self-granting participation by writing
the derivation tables (all three are admin-only, and `class_teachers` also
requires the target to hold `teacher`) · `audit_log` as a side channel into
`kontor` · former-teacher access (a *future* `left_on` also cuts access
immediately — fails closed) · a classmate reading another pupil's threads ·
`touch_thread` hijack · `search_path` gaps in all five new functions ·
`RETURNS TABLE` OUT-name shadowing.

The vacuity lens independently confirmed all four of the plan's original
mutations are correctly aimed, that `plan(25)` was the right count for the file
as written, that the `set_config`/`set local role` ordering difference between
blocks is immaterial, and that `left_on = '2026-09-01'` really does flip
`teaches_student` despite being a future date — because that helper uses
`cs.left_on is null`, **not** the half-open as-of idiom of file 34's eight
functions.

## Plan-body corrections made during the run (so downstream tasks inherit them)

Three of the panel's findings were defects in the **plan text itself**, not in
the code written from it. Left alone, Tasks 3 and 4 would each have hit a hard
stop, because they are executed from this document. All three are now patched in
place, above, with the correction marked inline.

| Where | Was | Is now | Why it mattered |
|---|---|---|---|
| Task 1, pgTAP 35 fixture teardown | An eight-line `delete` block | The 21-line house order from `34_enrollment_boundary.sql:46-67` | The short block raises 23503 on `delete from public.classes` (`assignments.class_id` is ON DELETE RESTRICT and the seed populates it) and **aborts the file before assertion 1**. Task 3 says "copy the fixture block from file 35", so file 36 would have inherited it. |
| Task 3, the column-shape assertion | `columns_are('public','thread_counterparts', …)` | `is(pg_get_function_result(…), 'TABLE(thread_id uuid, …)', …)` | `columns_are` reads `pg_attribute` on a **relation**; a `returns table` function has no `pg_class` row. Measured against the identically-shaped `assignment_group_mate_names`: every column reported missing, `pg_class` count 0. The assertion could never pass, and mutation 2 would be untestable — so D14's central claim would ship unpinned. **Found independently by two lenses.** |
| Task 4, the fingerprint counter | `26` → `31` | `26` → **43** | The assertion counts **(function, predicate) pairs**, not functions — `count(*) … lateral unnest(d.markers)`. The five new entries carry 17 markers. Built the post-Task-4 table and ran it live: 43. The plan had been counting functions throughout, including in its own earlier ledger ("count 30 → 31"). Task 4 Step 4 would have failed `have 43 / want 31` on a counter the plan explicitly forbids adjusting to silence a failure — an ambiguous stop for whoever hit it. |

Two further corrections went to the migration's **comments**, where the
behaviour is right but the stated reason is wrong — the exact defect class this
plan's own review ledger flagged as item 7:

- **`touch_thread`.** The comment claimed that dropping `security definer` would
  make non-author messages "silently fail to bump the thread". Measured: it is a
  hard 42501 that aborts **every** message INSERT, the author's included. The
  comment also called the owner a superuser; `postgres` here is
  `rolsuper=f, rolbypassrls=t`, so the mechanism is BYPASSRLS. Right outcome,
  wrong reason, twice.
- **The scoped audit trigger.** Justified by reference to `class_students_audit`.
  All 13 audit triggers in this repo are unscoped — no trigger anywhere uses
  `update of <cols>`. The reasoning for scoping it is sound and was kept; the
  invented precedent was replaced with "deliberately unlike every existing audit
  trigger, and here is why".

Smaller drift recorded but not acted on: the plan says Postgres 15, the stack is
**17.6** · `29_definer_fingerprints.sql`'s scope comment says the live definer
count is 44, it is now 49 (50 after Task 3) · line 811's `pg_default_acl`
warning does not reproduce locally, because migrations here run as `postgres`,
whose default ACL grants no anon — the entry belongs to `supabase_admin`, so
keep the explicit `revoke … from anon` as free defence but not for the stated
reason · `threads.staff_id`/`created_by` and `messages.sender_id` are ON DELETE
RESTRICT, so a staff profile becomes undeletable once they have messaged, which
plan 4's exit gate should know about.

**Baseline confirmed by measurement, not assumption:** `29_…` really carried
`26` · `action-guards.test.ts:214` really asserts `toBe(67)` · the pre-Task-1
suite really is `Files=35, Tests=687` · and the plan's `Files=36, Tests=712`
prediction for post-Task-1 was **exactly right**.

## Task 1 — done, `c520c6e`

`feat(meldinger): threads and messages, with kind deciding who else reads` — 3
files, +819. Verified independently of the implementer's own report: **31 ok, 0
not ok**, no plan mismatch; suite `Files=36, Tests=718, Result: PASS`; typecheck
and lint clean; no AI trailers in the commit body.

The file grew from the plan's 25 assertions to **31**, and from 4 mutations to
**14**. Every mutation was applied alone, reverted, and the file re-confirmed
31/31 green between each — so no mutation is masking another.

**Three mutations reddened MORE than predicted, and the explanations are worth
keeping**, because in each case the instinct would be to weaken the assertion:

- M5 and M8 also redden assertion **30**, and M6 does too. Assertion 30 is an
  exact message count. When the refusal under test flips, the message that was
  supposed to be refused *lands*, and the count becomes 3 instead of 2. The
  over-reddening is the assertion working, one table over. Recorded in the file
  so a future reader fixes the upstream assertion rather than loosening 30.

**The implementer corrected me on a prediction I got wrong.** I told it
assertion 30 should count 1 message; the real value is 2, because the guardian's
reply added at assertion 18 lands in that same thread. It measured, asserted the
measured value, and said so — which is the behaviour that makes delegation
safe. Worth noting because the instruction it was given said explicitly to treat
a mismatch with my claim as a finding rather than something to make agree.

**Two of my three review-panel dispatches paid for themselves inside this one
task**, and the third (operational) paid for itself in Tasks 3 and 4 before they
were even started.

Behaviour now pinned but NOT closed, as assertions 11, 12 and 30 — see the four
open decisions above. Mutations 12, 13 and 14 are the candidate fixes for
D-OPEN-1 and D-OPEN-3, and each was confirmed to redden its own pin, so whoever
takes the decision already has the change and its proof.

## Tasks 2, 3, 4 — done

| Task | Commit | Subject |
|---|---|---|
| 2 | `3d357db` | test(meldinger): pin the thread and message column grants |
| 3 | `292a247` | feat(meldinger): counterpart names through a projection, not a wider profiles policy |
| 4 | `3a78093` | test(meldinger): fingerprint the three thread predicates and the projection |

Suite `Files=37, Tests=728, Result: PASS`; typecheck 0, lint 0 errors. Reconciles
exactly against the post-Task-1 baseline: +1 file, +6 in file 31
(`plan(16)`→`22`), +4 in file 36. Task 4 adds no assertions — only the marker
count inside file 29 moves, from 26 to **43**, observed live.

The corrections the panel supplied were all confirmed by measurement rather than
taken on faith:

- **`has_table_privilege` really is blind to column grants.** Under
  `grant update (body) on public.messages`, the plan's original probe reported
  **false** — it would have stayed green while messages became mutable, in the
  assertion whose entire claim is D7 immutability. `has_any_column_privilege`
  reported true. The asymmetry is now documented in the file: `threads` keeps
  the table-level probe, because there a table grant is exactly what would
  silently undo the column revoke.
- **The 43 was verified before it was written**, by checking all 17 markers
  against `pg_get_functiondef` — rather than asserting 43 and reconciling
  afterwards, which is how a wrong counter gets talked into looking right.

### ★ Three findings from this task worth more than the tasks themselves

**1. Supabase ships a `realtime.messages` table, and file 31's existing house
style walks straight into it.** Assertions 9, 10, 15 and 16 query
`information_schema` filtering on `table_name` with **no `table_schema`
predicate**. An unqualified query for `'messages'` therefore returns realtime's
`binary_payload`/`topic`/`extension` columns *and a live UPDATE grant that is
not ours*, merged with our own. The four existing assertions are not wrong today
— there is no `realtime.submissions` or `realtime.assignments` — but the pattern
is a live trap for anyone who adds a commonly-named table. The new assertions
avoid it by using `has_*_privilege`, which takes a schema-qualified regclass and
cannot collide. **Worth fixing the existing four in a later pass.**

**2. The anon assertion is failable — but the plan named the wrong half.** Read
from `pg_default_acl`: omitting `revoke … from public` **does** redden it
locally, because Postgres grants EXECUTE to PUBLIC on every new function and
`anon` is a member. Omitting `revoke … from anon` does **not**, because that
stray grant comes from the `(supabase_admin, public, f)` row — cloud migrations
run as `supabase_admin`, local ones as `postgres`, whose row is `{postgres=X}`
only. So the assertion is a local wall *and* a cloud wall, but for two different
revokes. The file now records which half is a local no-op, instead of the
plan's claim that the whole assertion was untestable.

**3. ★ A mutation harness silently restored nothing, and the output still looked
plausible.** `psql -f <host path>` run inside `docker exec` resolves the path
**in the container**, not on the host. Three restores did nothing, and two later
mutations therefore ran against an already-mutated database — producing results
that read as sensible. Only a byte-for-byte `pg_get_functiondef` diff caught it.
The harness was rebuilt to restore by replaying the migration files, everything
was re-run clean, and all three functions were verified identical afterwards.

**This is the second time on this project that a mutation harness has had its own
failure mode.** The lesson is now house practice: a mutation result is only
evidence if the restore was *verified*, not merely issued. Diff the object
definition after every restore.

### One gap flagged, not silently expanded

Nothing in file 36 asserts the **values** of `display_name` or `role_label` —
only row counts and the column shape. A projection returning the *caller's own*
name instead of the counterpart's would pass all four assertions. Not a leak
(the caller already knows their own name), so it was left rather than scope-crept
mid-task. The fixture already contains witnesses for both `role_label` branches
(`Lærer` on thread …041, `Skolen` on …042) if this gets pinned later.

## Tasks 5, 6, 7 — done, the teacher surface complete

| Task | Commit | Subject |
|---|---|---|
| 5 | `178d592` | feat(meldinger): teacher thread list |
| 6 | `25eb074` | feat(meldinger): thread detail, the disclosure block, and sending a message |
| 7 | `5fa1f71` | feat(meldinger): a teacher starts a thread about a pupil she teaches |

Verified independently of the implementer's report: typecheck 0 · lint 0 errors,
5 pre-existing warnings · `action-guards.test.ts` at **69** · `npm test` 569
passing across 49 files · `next build` compiles all three new routes · working
tree clean but for the untracked economy probe.

**Seven more defects in the plan, found and fixed.** Five by reading the repo,
two by measuring React's actual behaviour. The two React ones are the reason
this task took as long as it did, and they are the ones worth reading:

### ★ The near-miss: a controlled `<select>` that silently pointed at the wrong child

React 19 auto-resets `<form action={fn}>` **even when the action fails**. The
plan's uncontrolled composer therefore answered «Meldingen ble ikke sendt. Prøv
igjen» while deleting the message it was asking the teacher to retype. That is
defect 6, and it is merely annoying.

Defect 7 is not. Making the inputs controlled fixes textareas and text inputs —
React keeps their `defaultValue` in step — but **not a `<select>`**.
`form.reset()` reverts the DOM to the first `<option>` while React state keeps
the chosen pupil, and React never re-syncs the two. So after a refused send, the
box read the wrong pupil, and pressing Send again would have sent the message
**about the wrong child, to the wrong family** — with nothing on screen looking
wrong to the teacher. Fixed with a post-commit effect; a keyed remount loses the
ordering race and only measures green against the detached node, which was
checked both ways.

Task 8's parent form has **two** selects and is the higher-risk version of the
same shape.

### The other five

1. **`formatDateNb(thread.updatedAt)` throws.** It anchors by string
   concatenation, so a timestamptz becomes an Invalid Date and a `RangeError`.
   The list would have 500'd the moment one thread existed — while the empty
   state, the only thing a first click sees, rendered perfectly. Now
   `formatDateNb(osloDateOf(…))`, pinned by a test carrying a real timestamptz.
2. **`getThread` embedded `profiles(full_name)`.** `profiles_select_own_or_admin`
   is own-or-admin, so the embed is NULL for every *other* sender — see the gap
   below.
3. **`formatDateTimeNb` omitted `timeZone`.** Every other helper in `dates.ts`
   pins Europe/Oslo because prod runs UTC; the assertions are toothless on an
   Oslo laptop and were mutation-evidenced under `TZ=UTC`.
4. **`<ErrorPanel>{state.error}</ErrorPanel>` does not compile.** `ErrorPanel` is
   the error-boundary body (`{digest, onRetry}`, renders its own `<h1>`).
5. **The candidate list over-returned.** `students` carries two OR'd permissive
   select policies, so a bare select returns every pupil the teacher *ever*
   taught, while `can_start_thread` binds on live enrolment. Every stale pupil
   would have answered «Sjekk at eleven er i klassen din». Rewritten to mirror
   the predicate exactly.

### ⚠ KNOWN GAP — message bylines, needs a decision

A sender the reader is not entitled to name renders as **«Annen deltaker»**: a
second guardian, a co-teacher, or an admin. On the teacher surface that is the
**common** case, because the staff counterpart of a teacher's own thread is the
teacher herself — so a parent's reply is unnamed.

Closing it needs `public.thread_message_senders(uuid[])`, a definer projection
mirroring `thread_counterparts`. That is a schema + RLS change, so per CLAUDE.md
it needs the review panel, and it is also a genuine privacy decision — it names
the other guardian to a teacher. Deliberately **not** slipped into a UI task.
Documented in the `★ KNOWN GAP` comment in `src/lib/dal/threads.ts` and queued
as a task chip.

My read: the privacy delta is small, because a teacher already knows their
pupil's guardians and a guardian already knows their child's teachers — but
"small" is not a call to make at 6am against a school's own judgement, and it is
outside this plan's scope. Remaining plan scope comes first.

## Tasks 8, 9 — done, the family surfaces

| Task | Commit | Subject |
|---|---|---|
| 8 | `df99bab` | feat(meldinger): the parent surface, and the only actor who may choose a counterpart |
| 9 | `440e199` | feat(meldinger): a pupil reads and answers, and cannot open a channel |

typecheck 0 · lint 0 errors · knip at baseline · `npm test` **581 passing / 51
files** · `next build` clean, with all five family routes present and **no**
`/elev/meldinger/ny` · pgTAP **37 files / 737 assertions** · `action-guards`
69 → 71 → 72.

### ★ The previous task's fix was a race, not a fix — and only measurement found it

Task 7's remedy for the controlled-`<select>` revert was committed at `5fa1f71`
with the claim that both approaches had been checked. Task 8's implementer
measured the committed code before writing anything and found
`NewThreadForm.test.tsx` **fails 1 run in 6**.

The mechanism: React sometimes delivers the action state in one commit and
performs the form reset in a *later* one, so the post-commit `useEffect` fires
while the DOM is still correct, no-ops, and never runs again. React's `onReset`
prop **never fires** for this reset at all (verified with a logging listener), so
cancelling it through React is not available. A **native** `reset` listener does
fire, and the event is cancelable by spec — `src/lib/use-no-form-reset.ts` now
cancels it, and both select-bearing forms use it.

Evidence: 10/10 green on the parent suite, 8/8 on the teacher's, and detaching
the ref fails both 4/4. Independently re-run in the main loop afterwards: 5/5
green.

**This is the single most valuable thing the overnight run produced.** A
one-in-six flake in a test guarding "the form does not silently point at a
different child" is worse than no test — it would have been re-run, seen green,
and believed. The lesson generalises: when a fix targets a *timing* bug, one
green run is not evidence. Run it until the flake rate would have shown.

### The plan's recipient list returned nothing — a projection was added

Task 8 step 1 read counterparts through RLS, on the stated grounds that
`guardian_in_class` covers `class_teachers`. Measured as a real guardian against
the seed: `class_teachers` → **0 rows** (its one select policy is
admin-or-`teaches_class`; the enrollment migration adds guardian arms to
`classes`, `class_subjects` and `class_schedule` and stops there),
`user_roles where role='admin'` → **0 rows** (own-or-admin). **Every family would
have opened «Ny melding» to an empty recipient list.**

Widening any of those three is exactly what D14 exists to prevent, so the house
pattern was followed instead: `20260805122000_guardian_thread_options.sql`, a
definer projection with the caller bind inside the `where`, mirroring
`can_start_thread` conjunct by conjunct — including `not is_guardian_of(staff,
student)`, which matters because most admins here are also parents and would
otherwise be offered as their own child's «Kontoret» counterpart. File 36 4 → 13
assertions; fingerprint pairs 43 → 48.

⚠ **This is a schema + RLS change made outside the plan**, so per CLAUDE.md it
needs the panel. A focused review was dispatched against it; its result is
recorded below.

### A product question, not a defect

The office picker lists **individual admins by name** rather than one «Kontoret»
entry, because `can_start_thread` needs a concrete admin uuid. If the school
would rather families saw a single «Kontoret» option, that is a routing decision
— someone has to say which admin receives it.

## Review of the unplanned migration — `20260805122000_guardian_thread_options.sql`

CLAUDE.md routes RLS changes to the panel; this one was written during execution
and had not had it. A focused review was dispatched. **Verdict: no security
defect.** The projection is a faithful mirror of `can_start_thread` and the
caller bind is a genuine wall — both proved by execution, not argued.

What the reviewer established by running it, rather than reading it:

- **No over-offer and no under-offer.** `private.teaches_student` *is literally*
  the join the `laerer` arm uses, not an approximation; `has_role` is a bare
  `exists`, which the `kontor` arm reproduces; conjunct 3 is spelled identically
  in both places. `class_subjects` has no `teacher_id`, so `class_teachers` is
  the only teacher↔class edge and the derivation is complete.
- **The bind is structural.** The function takes **no arguments at all**, so
  another family's pupil id cannot be named. Measured: a guardian sees exactly
  one pupil; the pupil's own teacher, the pupil's own login, an admin who guards
  nobody, empty JWT claims and `service_role` all get **0 rows**.
- **The leak surface is exactly four columns.** `public.profiles` has no `email`
  column at all — email lives in `auth.users`, unreachable from here — and
  `phone`/`locale` are unreachable. `role='economy'` holders are not offered.
- **Owner `postgres` is `rolbypassrls = t` and NOT superuser**, which is what
  makes the `not exists` exclusions fail **closed** under FORCE RLS.
- Marker-pair count independently recomputed from the file text: **48**. The
  43 → 48 bump is correct.

### ⚠ One real test gap, with a validated fix — TO APPLY

The **pupil-login exclusion is completely unpinned**. Two mutants, each rolled
back:

| mutant | file 36 | file 29 |
|---|---|---|
| delete the whole `not exists` block | **all 13 pass** | `not ok 2` — the marker catches it |
| change `s.student_user_id = c.staff_id` → `= c.student_id` (exclusion logically dead, marker word intact) | **all 13 pass** | **`ok 1`, `ok 2` — nothing red anywhere** |

File 29's own comment claims the fingerprint is "the only thing standing between
that exclusion and a silent deletion". True for *deletion*, false for *drift* —
the marker is a literal string, and a one-token column swap defeats both layers.
Same shape as the Phase-4 "fixture hiding the defect it sat next to": the
conjunct with no witness is the one that rots.

Consequence if it rots is not escalation — `can_start_thread` still refuses the
INSERT — but exactly the dead-end option the projection exists to prevent.

Fix is one fixture row plus one assertion, validated end to end by the reviewer:
unmutated **14/14 ok**, and under either mutant assertions **5, 6 and the new 10
all go red**. Applied after Tasks 10–11 land, to avoid racing that agent's
commits.

### D-OPEN-5 — a live product consequence, and it needs the school

Per this migration's own note, most admins at IQRA are also parents. Conjunct 3
of `can_start_thread` refuses an admin who guards the pupil as that pupil's
counterpart — correctly, since it would be a self-thread. But it means **in a
school whose only admin is a parent, that admin's own family has no «Kontoret»
option at all** and is told to phone the school instead.

That is faithful to the predicate, not a projection bug. It is still a real
consequence somebody at IQRA should agree to. The empty-state copy currently
names two causes for an empty recipient list (no live class, no office account)
and omits this third one, which is the likeliest.

### Two comment-accuracy items, not defects

- The `union` comment names two premises the schema forbids: a teacher of two of
  the child's live classes is impossible (`class_students_one_active` is
  `UNIQUE (student_id) WHERE left_on IS NULL` — proved by triggering the
  violation), and `union` does **not** collapse a teaching rektor into one row,
  because the rows differ in `kind`. Mutant `union` → `union all` survives all 13
  assertions, because the forms are provably equivalent here. Keep `union` as
  free defence; fix the comment.
- Marker `'gs.guardian_id = (select auth.uid())'` is a whitespace-exact source
  fragment rather than an identifier like the other 47 — closer to the whole-text
  hash that file argues against. Reflowing the line would redden it for a
  non-change.

## ★★ The bug that mattered most — `INSERT … RETURNING` and a self-referential read policy

Found by Task 11's api suite **while it was being written**, before it was even
finished. Commit `0dd56ca`.

**Thread creation was broken for every actor.** No teacher, no guardian, no
surface could open a single thread — every call returned 42501 «new row violates
row-level security policy» while `private.can_start_thread` evaluated **TRUE**
for the same arguments in the same request. **The entire 737-assertion pgTAP
suite was green over it.**

**Why.** PostgreSQL applies a table's SELECT policies as an additional
`WITH CHECK` when an INSERT carries `RETURNING`. Both start actions insert with
`.select('id').single()` because they need the new id to redirect to, so
PostgREST issues `INSERT … RETURNING "id"` and `threads_select_related` ran
against the new row. That policy called `private.reads_thread(uid, id)`, whose
body resolves the row by **re-querying `public.threads`**. Inside the very
command doing the insert, that subquery's snapshot cannot see the new tuple, so
`exists` was false and every creation was refused. The rule was right; asking it
**by id** was what could not work.

**Why nothing caught it.** Every INSERT assertion in file 35 is a bare
`insert … values (…)`. **The app's own statement shape was untested anywhere in
the suite.** That is not a weak assertion — it is a whole statement shape the
suite was blind to, which is a category worse.

**The fix moves the rule down rather than copying it.**
`private.reads_thread_row(uid, sid, kind)` becomes the source; `reads_thread(uid,
tid)` becomes a thin lookup that delegates to it. Inlining the four arms into the
policy would also have fixed the symptom — and would have been D21's own drift
reintroduced, two copies of the readership rule with one untested.

Also deliberately **not** fixed by granting `insert(id)` and letting the client
choose the uuid, because a caller-chosen primary key turns 23505 into an
enumeration oracle.

### Panel review of that fix — one regression it introduced, one hole it exposed

The implementer flagged their own change as unpanelled and asked for review. Two
lenses were dispatched. The correctness lens proved semantic equivalence by
brute force: it reconstructed the original monolithic body from the migration
history as a scratch function and compared **490 (profile × student × staff ×
kind) pairs** — **zero mismatches**, with every arm exercised including the
load-bearing `kontor`+teacher and `kontor`+pupil cases that must *not* admit.

**F1 — the commit made a load-bearing fingerprint marker unfailable.** Moving the
markers to `private.reads_thread_row(uuid,uuid,text)` kept the marker `'kind'` —
but `pg_get_functiondef` renders the header `(uid uuid, sid uuid, kind text)`, so
**the parameter name satisfies the marker regardless of the body**. Proven: with
both `kind = 'laerer'` guards deleted — the D19/D20 escalation, which makes
`reads_thread_row(teacher, taught_pupil, 'kontor')` return true — assertion 2
reports **zero missing markers and passes**. Against the old by-id shape the same
mutation reddened it. Fix: marker `'kind'` → `'kind = ''laerer'''`. ⚠ Do **not**
rename the parameter to `tkind` instead — `kind` is a substring of `tkind` and
the marker stays vacuous. (The escalation is still caught behaviourally by file
35's assertions 5 and 8, so this is lost defence-in-depth, not an open door.)

**F2 — `threads_select_related` has no refusal test at all.** It is the only
object this migration changes, and **nothing in `supabase/tests/` selects from
`public.threads` as an authenticated role** — every read assertion counts
`public.messages`, which goes through the *by-id* form. Assertions 32–33 cover
only the admit direction. Proven: with the policy set to `using (true)`, under
which a stranger parent reads another family's thread subject, **file 35 is 33/33
green and file 36 is 13/13 green**. Fix: one assertion selecting from
`public.threads` as an unrelated guardian expecting 0, with an entitled control.
The fixtures already exist.

**F3 — the dead-end worry is closed.** A sweep of all 490 `(uid, sid, staff,
kind)` combinations found 19 that pass `can_start_thread` and **zero** that then
fail `reads_thread_row`. The one shape that does dead-end — an actor who is both
a pupil's login *and* a teacher of that pupil's class, creating a `kontor` thread
— is a **correct** refusal: before this commit the bare insert would have
succeeded and left an invisible orphan thread.

**A correction to the commit's own reasoning.** It says the rejected
client-chosen-uuid alternative would let "anyone probe which thread ids exist".
Measured: RLS `WITH CHECK` runs **before** the unique-index insert, so an
RLS-denied payload gives 42501 and only an RLS-*allowed* payload on a taken id
gives 23505. It is a confirmation oracle gated behind `can_start_thread`, not
open enumeration. The rejection is still right — global scope, and it breaks the
server-generated-id discipline — but for a smaller reason than stated. The
chosen fix has no equivalent: `threads_pkey` is the only unique index, ids stay
server-generated, and the success/failure difference leaks only what
`public.guardian_thread_options()` already hands the caller directly.

Verified sound besides: the delegation preserves by-id behaviour for
`messages_select_related` and `thread_counterparts` (same 490-pair proof) · no
BEFORE INSERT trigger on `threads`, so proposed row = stored row · the row form
is strictly *safer* if `kind` ever becomes updatable · `reads_thread_row` is
unreachable over HTTP because `PGRST_DB_SCHEMAS` is `public,graphql_public` ·
the "watched fail" claim is true, restoring the by-id policy reddens exactly 32
and 33 · fingerprint arithmetic 48 → **49** is right, 13 signatures, live definer
count 52.

## ★★ The coverage lens — three policies with NO behavioural test, and the real discriminator

The second lens on the `RETURNING` fix went hunting for other statement shapes
the suite is blind to. It found that the blind spot is much wider than threads,
and it independently confirmed the first lens's worst finding.

### Three policies that can be deleted with the suite fully green — all PROVED

| mutation | file 35 | file 36 |
|---|---|---|
| `threads_select_related` → `using (true)` | **33/33 green** | **13/13 green** |
| `threads_delete_admin` **and** `messages_delete_admin` → `using (true)` | **33/33 green** | — |
| `threads_update_subject_author` → `using(true) with check(true)` | **33/33 green** | — |

**The read one is the leak.** Under `using(true)`, guardian `…006` — unrelated
to pupil `…031` — reads **6 thread rows** including the other family's office
thread «TH Om betaling»; under the real policy she reads 1. Message bodies stay
walled, so what escapes is the **subject line**, the pupil id and the staff id —
which for a `kontor` thread is the entire content of a complaint. `listThreads()`
deliberately applies no predicate of its own ("RLS decides membership"), so it
reaches the UI verbatim.

**The delete one is worse in consequence.** `authenticated` holds a real
`grant delete` on both tables, so the only thing between any signed-in parent and
deleting every thread and message in the school is a policy **no test
exercises**. ⚠ And the assertion must be a **survivor count, not `throws_ok`** —
measured, a guardian's refused delete returns `OK rows=0`. **DELETE refusals are
filtered, never raised.**

### ★ The real discriminator is the RETURNED EXPRESSION, not the word RETURNING

Measured on a scratch table with SELECT policy false, INSERT/DELETE true:

| shape | result |
|---|---|
| `insert …` (bare) | OK |
| `insert … returning 1` | **OK — SELECT policy NOT applied** |
| `insert … returning id` | 42501 |
| `update … where col = …` (no RETURNING, row invisible) | **42501 — a WHERE on a column is enough** |
| `delete … where col = …` (row invisible) | **OK, 0 rows deleted, NO ERROR** |

Confirmed against `pg_stat_statements`: the thread insert is
`… RETURNING "public"."threads"."id"` (a Var → policy applies → the outage); the
message insert is `… RETURNING $2`, PostgREST's `RETURNING 1` → policy does not
apply.

Three consequences:

1. **Assertions 32–33 are correct because they return `id`.** Written
   `returning 1` they would have been fake tests — verified: `returning 1` passes
   against the *broken* predicate.
2. **`.delete().select(…)` silently under-deletes**, and it is live at four sites
   outside this phase, two of which key storage cleanup off the returned `path` —
   so an RLS mismatch orphans files rather than erroring. Spun off as its own
   task; **not** touched here.
3. A catalog scan found the same self-referential-policy landmine on
   `class_teachers`, `lessons`, `submissions`, `tests` and `user_roles`.

### F4 — the composer is safe; the *next* optimisation is not

The feared case is **refuted by execution**: `insert into messages … returning id`
into a **committed** thread succeeds, because the by-id lookup resolves a
*different* row. A composer that adds `.select('id')` will not break.

But thread + message **in one statement** fails 42501 — with or without
`returning` on the message insert — because `messages_insert_participant` calls
`private.writes_thread(uid, thread_id)`, which is **still the self-referential
by-id lookup**. The fix moved `reads_thread` down to a row form and left
`writes_thread` untouched; there is no `writes_thread_row`. **The obvious next
optimisation — collapsing `startThreadAction`'s two round-trips into one
statement or one RPC — walks straight back into the identical bug through a
different door, and nothing in the suite would say so.**

### F6 — the api suite's entitlement block has no positive control

`seedTeacherThread`/`seedKontorThread` go through the real actions, so a
regression reddens 5 of the 8 tests. But the `entitlement:` describe asserts only
*refusals* — **under a total creation outage both its assertions still pass**,
including the `count === 0` follow-ups. That is exactly the discipline file 35's
own header demands and this block does not have. Both actions also replace
`error.message` with a fixed Norwegian sentence, which is why the outage
surfaced as an unattributable «Forventet redirect …» and needed isolation to
diagnose.

### Verified sound — including one piece of coverage nobody claimed

- The commit's "watched fail" claim is **exactly** true: restoring the by-id
  policy reddens 32 and 33 and nothing else.
- **32–33 are not duplicates of 22/25**, by two independent proofs: with the
  broken policy, dropping the RETURNING entirely → 33/33 green; using
  `returning 1` → 33/33 green. The returned column is the subject of the test.
- ★ **Assertion 33 is the only assertion in the whole suite that exercises
  `can_start_thread` conjunct 4's `staff = uid` arm** — deleting that arm locks
  every teacher out of starting a thread, and reddens 33 alone.
- The fixture-ordering claim is true and load-bearing: swapping the counterpart
  back to `…002` reddens 32 for **conjunct 2**, not for RETURNING.
- **The kontor creation path IS covered — by file 36, not 35.** Breaking
  `can_start_thread`'s `kontor` arm leaves 35 fully green and reddens 36's
  assertion 6. Families losing the office channel is caught; just not where you
  would look for it.
- `.single()` on the thread insert cannot silently see 0 rows from RLS — for
  INSERT the SELECT policy is a WITH CHECK (error), never a filter.

## Tasks 10, 11 — done. Plan 1 is code-complete.

| | Commit | Subject |
|---|---|---|
| Task 10 | `d0726cb` | feat(meldinger): the office reads everything, and the reading is on the record |
| blocking fix | `0dd56ca` | fix(meldinger): no thread could be created by anyone, and the reason was RETURNING |
| Task 11 | `02e3d1d` | test(meldinger): wall-1 assertions for thread entitlement and the oversight audit |
| review follow-ups | `61190aa` | test(meldinger): three review findings — a marker that could not fail, and two blocks with no control |

**Final gate:** pgTAP **37 files / 741 assertions** · `npm test` **587 / 53
files** · `npm run test:api` **13 files / 360 tests** · typecheck **0** · lint
**0 errors** (5 pre-existing warnings) · knip **at baseline** · `next build`
**clean** · `action-guards.test.ts` **73**.

Two deviations, both sound:

- **The admin reads live in `src/lib/admin/threads.ts`, not the DAL.** The audit
  row is a service-role insert and `quarantine.ts` states that key never leaves
  `src/lib/admin/` (spec §3/§6). `listThreads` is still exported and *called*, so
  the counterpart batching stays in one place.
- **`sendAdminMessageAction` was added** (count 72 → 73). Without it D23 is dead:
  `writes_thread` admits an admin on a `kontor` thread, and `/admin/meldinger` is
  the only surface where one is reachable — the office channel would have been
  **write-only**.

The implementer independently reproduced all three of the panel's findings
against its own code before fixing them, rather than taking them on trust. It
also hit a third mutation-harness failure: a perl substitution mangled the file
into a parse error, vitest printed no per-test lines, and the grep for failures
matched nothing — **indistinguishable from a passing run**. That is now three
distinct harness failure modes on this project in one night.

---

# ☀️ MORNING HANDOFF

## What exists

Working teacher↔family messaging, anchored to one pupil, with an office channel
the pupil's teachers cannot read. Schema, RLS, DAL, actions and all four role
surfaces. **11 tasks, 12 commits, on `feat/phase-5-meldinger`, nothing pushed.**

## What is NOT done, deliberately

- **Nobody has clicked any of it.** Synthetic clicks do not fire this app's
  React handlers, so no surface has been visually verified. Everything below.
- No notifications, no e-mail, no announcements (plans 2 and 3).
- Parents and pupils still cannot log in unless an admin sets a password by hand
  (plan 4's 15-series). Use the seeded `forelder@test.local` /
  `elev@test.local`, both `test-passord-123`.

## ⛔ First: five open decisions — see the list further up

Ranked, with executed proof for each. The top one is that a pupil changing class
hands their new teacher the entire prior thread history. All five are **pinned by
assertions**, so the current behaviour cannot drift while you decide.

## 🖱 Then: the browser pass. Re-enrol MFA at `/mfa/registrer` FIRST

Every `db reset` and every `test:api` run wipes enrolment. Budget it.

**Do these five first — they are the ones no test can reach:**

1. **Create a thread, as a teacher and as a parent.** This is what was completely
   broken; it has only been proven at the SQL and DAL level.
2. **The refusal path.** Force a creation to fail, then confirm **both** selects
   still read what you chose. This is the wrong-child bug — the highest-severity
   defect of the night, fixed twice, and never seen in a real browser.
3. **The `kontor` wall, from the child's seat.** As `elev@test.local`, the
   `laerer` thread is listed and the `kontor` thread is **not**.
4. **The D5/D23 pair as admin:** cannot post in a `laerer` thread (the sentence
   appears instead of a composer), **can** post in a `kontor` one.
5. **The composer on refusal:** it empties on success and **keeps your text** on
   a refusal.

Then the rest: disclosure copy per role (`voksen` on parent screens with the
phone number and the rektor line, `elev` on the pupil's, `ansatt` on staff —
never «barnet ditt» to a teacher) · the parent `ny` form showing both children,
grouped «Lærere»/«Kontoret», with the teacher swapping when the child does ·
no compose control anywhere on the pupil surface and `/elev/meldinger/ny` 404 ·
«Deg» on your own message and an Oslo timestamp · the byline reading «Annen
deltaker» (say whether that is acceptable interim) · `/admin/meldinger` and the
thread detail at **1280 and 375** · print (the «Ny melding» pill is
`print:hidden`).

## ⚠ Before this goes near `real`

`0dd56ca` is an RLS change. It got a **two-lens** panel — including a 490-pair
equivalence proof with zero mismatches — but not the full panel CLAUDE.md asks
for. Both lenses' findings are fixed. It still deserves the full panel.

## Known gaps, all documented in code

- **Message bylines** read «Annen deltaker» for a sender the reader cannot name.
  On the teacher surface that is the *common* case. Needs
  `thread_message_senders`, a definer projection — schema + RLS, so panel.
- **`writes_thread` is still the self-referential by-id form.** The composer is
  safe (proved), but collapsing `startThreadAction`'s two round-trips into one
  statement or one RPC walks straight back into the `RETURNING` outage through a
  different door, and **nothing in the suite would say so**.
- **`.delete().select(…)` silently under-deletes** at four sites outside this
  phase, two of which key storage cleanup off the returned path. Spun off as its
  own task.
- Four `information_schema` assertions in `31_column_locks.sql` filter on
  `table_name` with no `table_schema` — a live trap now that
  `realtime.messages` exists.

## Final: the three uncovered policies — `3f67907`

The last three coverage gaps are closed. Suite **Files=37, Tests=748, PASS**
(was 741). `35_threads_rls` 35 → **41**, `36_thread_counterparts` 13 → **14**.

⚠ **The authoring agent was killed mid-run when the process exited**, after
writing the assertions but before committing or reporting. Its mutation evidence
was lost with it. Rather than commit unverified work, the key mutation was
**re-measured in the main loop**: widening `threads_select_related` to
`using (true)` reddens assertion 34 and **nothing else**, and the restore was
verified by diffing `pg_get_expr(polqual)` back to the captured original — not
by assuming the `alter` ran. That is the discipline from
[[verify-the-restore-not-just-the-mutation]] applied to a case where the
alternative was trusting a dead agent's silence.

★ **A correction the agent made to file 29 is worth keeping.** Its
`student_user_id` marker carried a comment claiming to be "the only thing
standing between that exclusion and a silent deletion". Measured: rewriting the
exclusion's `s.student_user_id = c.staff_id` to `= c.student_id` kills it stone
dead **while leaving the word `student_user_id` in the body** — so file 29 stayed
green, and so did every assertion in file 36. **A fingerprint catches a
DELETION; only a witness catches a REWRITE.** File 36 now carries the witness.

---

# Plan 1 — FINAL STATE

**13 commits on `feat/phase-5-meldinger`. Nothing pushed.**

pgTAP **37 files / 748 assertions** · `npm test` **587 / 53 files** ·
`test:api` **13 files / 360** · typecheck **0** · lint **0 errors** · knip at
baseline · `next build` clean.

Everything else — the five open decisions, the browser checklist, the known
gaps — is in the MORNING HANDOFF section above.

## Third lens — blast radius. The panel is now complete.

Two lenses had run (semantic equivalence, test coverage). The third asked what
else the change touches and what it breaks next. It found the most consequential
thing of the night, and it is not about code already written.

### ★★ F1 — `announcements`, as the spec sketches it, ships this outage a SECOND time

§3.2's `announcements_select_audience` → `private.reads_announcement(auth.uid(),
id)` must resolve `published_at`, `class_id` and `created_by` by re-querying
`public.announcements` — structurally identical to the predicate that made every
thread uncreatable. The INSERT policy's own check is a row form and passes, so
the 42501 would again be blamed on the wrong policy.

Whether it fires turns on a decision plan 2 had not yet made: task 3b needs the
new id for the fan-out, §7 has a detail route, and **`.insert(…).select('id')` is
the repo's idiom at 20 sites.** Sent to plan 2's author mid-write, with the fix:
`reads_announcement_row(uid, class_id, published_at, created_by)` as the source
from day one.

**The other three tables are safe, and the reasons are now written down so nobody
"fixes" them:** `announcement_reads_select_own_or_staff` leads with
`user_id = auth.uid()`, a plain column the INSERT policy pins to the caller ·
`notifications` rows are written only by a definer trigger owned by `postgres`,
so no policy runs at INSERT · `email_pings` has no RLS.

### ★ F2 — `public.submissions` carries the identical trap TODAY

`submissions_select_related` is that table's only SELECT policy and is
`private.reads_submission(auth.uid(), id)` — a self-requery with no row-form arm.
Measured as `elev@test.local`: the bare insert succeeds, **the same insert with
`returning id` is refused**, and a client-chosen uuid does **not** rescue it —
only dropping `RETURNING` does.

It does not fire only because `src/lib/dal/submissions.ts:138` generates
`randomUUID()` in TypeScript and inserts bare. **Anyone who modernises that to a
server default plus `.select('id')` — exactly the shape the Phase 5 thread
actions use — kills hand-in for every pupil in the school**, and Phase 4's pgTAP
has the same blind spot Phase 5 just closed. Spun off as its own task.

Note the two phases solved the same problem in opposite ways and neither
migration mentions the other: `20260805123000` warns *against* granting
`insert(id)` as "the other obvious way to drop the RETURNING" — a route Phase 4
had already taken.

### ★ F3 — the equivalence proof holds for SELECT and INSERT, NOT for UPDATE

Measured: under `update … returning id`, the by-id spelling resolves the
**pre-update** tuple and permits the write; the identical rule written as a plain
column reference sees the **new** tuple and refuses. So a by-id predicate
silently authorises an update against stale column values.

Harmless on `threads` today — `subject` is the only updatable column and no
predicate reads it — but `threads_update_subject_author` still uses the by-id
`writes_thread`, which re-checks `kind`, `staff_id` and `student_id` against
pre-update values. The migration says `kind` "deliberately has no UPDATE grant"
because flipping it is an escalation; **after this change that safety rests on
the grant alone, and the second reason is written nowhere.**

### F4 — performance: the change is an improvement; the path under it is O(school)

Measured on a synthetic 300-pupil / 2 700-thread school, rolled back:

- **Not inlined, and `stable` does not mean cached.** SECURITY DEFINER +
  `search_path=''` both block inlining; one call per row scanned, fanning out to
  up to four more.
- **The new form is strictly cheaper**: admin 5 445 buffers vs 13 545; guardian
  56 576 vs 64 593. The delta is exactly 2 700 × 3 — the `threads_pkey` lookup
  the old form did per row.
- **No index serves the access path, and the composite is dead for it.** Every
  list read is `select … order by updated_at desc` with **no predicate** — RLS
  does all the filtering by design (D21) — so every role gets a Seq Scan plus a
  top-N sort. `threads_student_updated_idx` was justified by "every thread list
  is `student_id in (…) order by updated_at desc`", **which is not what was
  built**. `threads_staff_idx` is unused by any shipped query.
- **Cost is O(threads in the school), not O(the caller's threads).** A parent
  with one child pays the admin's scan.

Verdict: fine now (~0.2–0.6 s in production at year-one volume), stops being fine
around **3 000–5 000 total threads** without retention pruning. Inherited, not
introduced — and marginally better than before. Measured and **rejected**:
hoisting the admin arm into the policy is 6.6× faster for admins but re-creates
D21's drift.

### F5 — the admin audit row can claim a listing that was truncated

`PGRST_DB_MAX_ROWS=1000` and `listThreads()` has no `.limit()`/`.range()`. The
cap applies *after* the RLS filter, so it saves no cost — but past 1 000 threads
the oversight list silently drops the oldest, and `listThreadsForAdmin` then
writes `meta: { count: threads.length, filter: 'none' }`: **an audit row
asserting a complete listing that was not complete.** For an oversight read whose
whole purpose is being on the record, that is the wrong failure.

### F6 — the `writes_thread` asymmetry, with the breaking refactor named

Three call sites, all verified against the live catalog. Nothing reachable today.
But **the repo names the refactor that breaks it**: both start actions say
rolling the thread back "would need a definer RPC we have no other reason to
build". Written as plpgsql with two sequential INSERTs it is fine — the second
statement sees the thread. Written as one statement with a CTE, every send is
refused, and the user-visible symptom would be «Samtalen ble opprettet, men den
første meldingen ble ikke sendt.» on 100% of new threads — copy that already
exists for a different cause, which is what would make it hard to attribute.

### F7 — two comments now read false

`comment on column public.threads.kind` still says "Input to
private.reads_thread" — it is now an input to `reads_thread_row` and a direct
operand of the SELECT policy. And `private.reads_thread` has **no comment at
all**, while the warning that re-inlining it "would compile, pass every
behavioural test and silently restore the self-referential lookup" lives only in
the git log.

### Verified sound

Every caller of the changed functions gets the same answer, and none relied on
the old failure mode — swept all policies in all schemas, all `public`/`private`
bodies, views, trigger functions and check constraints. `private` is unreachable
over HTTP, confirmed independently by two request shapes. **Zero** functions and
**zero** tables in `public` are reachable by `anon`, repo-wide. Helper index
coverage is complete — the cost is function-call overhead, not missing indexes.
The fix itself works: `insert … returning id` as `laerer@test.local` succeeds
after a clean replay.

## The last three coverage gaps — closed, `78032d1`

⚠ **This landed twice.** A concurrent agent in the same checkout committed the
working tree as `3f67907`, with a message saying the authoring agent had been
"killed mid-run". It had not. The content was byte-identical
(`git diff 3f67907 78032d1 --stat` is empty), so it was kept and the **message
amended** to carry the per-assertion redden ledger the original had no way to
know. **If anything recorded `3f67907`, the commit is now `78032d1`.**

Recorded as a coordination hazard: several agents shared one checkout tonight,
and the failure mode is not a corrupted tree — it is a *plausible* commit made
on a false premise about another agent's liveness.

pgTAP now **`Files=37, Tests=748, PASS`** (741 → 748: +6 in file 35, +1 in file
36). Unmutated: file 35 41/41, file 36 14/14. Every restore verified by diffing
`pg_get_expr(polqual, polrelid)` / `pg_get_functiondef` against a pre-mutation
capture, never assumed.

### ★ My own instruction would have produced a hollow witness

I sketched the delete assertions using an **unentitled** guardian (`…006`). That
would have passed against the widened policy and closed nothing.

**Measured:** an UPDATE or DELETE whose `WHERE` names a column pulls the table's
**SELECT** policies in alongside the update/delete policy. So with *both* delete
policies at `using (true)`, `…006` still removes nothing — 2 messages and 1
thread survive, because she cannot see the rows to delete them. The refusal I
would have been asserting was the read wall, not the delete wall.

The implementer used `…005` instead (guardian of the pupil — **reads** the
thread, holds no admin role) and `…003` for the update case (reads the thread and
passes `writes_thread`, but is not the author, isolating `created_by` alone).

This is the same lesson as the `→ 0 rows` control, one layer down: a negative is
only evidence if the actor could have succeeded for every reason *except* the one
under test. It also means the two delete policies were doubly unguarded — the
suite had no witness, and the obvious witness would not have worked.

### It confirmed the picker finding rather than trusting it

Both picker mutants were replayed against file 36 **as it stood at HEAD**:
13/13 green under each. So the outright deletion of the exclusion was caught only
by file 29's marker, and the one-token rewrite (`= c.staff_id` → `= c.student_id`)
by **nothing in either file**. A fingerprint catches a deletion; only a witness
catches a rewrite. `29_definer_fingerprints.sql` carried a comment claiming its
marker was the only guard *because* file 36 had no witness — now false, and
corrected in place.

### ⚠ `test:api` is NOT confirmed green

4 failed / 356 passed (13 files), all `Test timed out in 15000ms` in
`tests/api/school-core.test.ts`. A first run on a churned stack gave **11**
failures; after a reset it dropped to 4, and that run overlapped another
session's `DROP POLICY`/`CREATE POLICY` on `public.threads` — which takes ACCESS
EXCLUSIVE and stalls exactly this way.

The diff is `supabase/tests/*.sql` only, and nothing under `tests/` or
`vitest.config.api.ts` references those files, so it is very unlikely to be the
change. **But "unlikely" is not "verified"** — a clean re-run with no second
session active is running now, and the result belongs in this ledger before
anyone calls the gate green.
