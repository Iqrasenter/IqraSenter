# IQRA Skoleportal — Phase 1 (School Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the school core on the LOCAL stack — terms, subjects, classes (teachers/subjects/schedule), students, guardians and enrollment, with RLS + grants at wall 2 and DAL guards at wall 1 for every new table, both adversarial suites extended (pgTAP + tests/api), the service-role admin module grown to user provisioning/role grants, and the admin registry + one-glance student page plus minimal teacher/parent/student surfaces — Phase 1 of `docs/spec.md` (§9). Also closes the standing deferred item: `private.audit()` reserved-namespace enforcement.

**Architecture:** Same two-wall model as Phase 0. New tables get default-deny RLS with explicit narrow policies driven by SECURITY DEFINER relationship helpers in the `private` schema (`is_guardian_of`, `teaches_student`, `teaches_class`, `guardian_in_class`, `student_in_class`); every DAL read carries its own scoping predicate (never a bare select trusting RLS — the `.eq` discipline from T11). Admin writes to school-core tables flow through the admin's OWN session under RLS admin policies (wall 2 stays real); the service-role quarantine grows only by what genuinely needs it: creating auth users, granting roles, and email→user lookup. Staff data access gains an AAL2 assertion at wall 1 (`requireStaffRole`), closing the T13 matcher-exclusion ledger risk for DAL-guarded reads.

**Tech Stack:** Unchanged — Next.js 16 (App Router, `src/`, Turbopack), React 19 (`useActionState`), TypeScript strict, Tailwind v4 tokens from `globals.css`, `@supabase/ssr` + `@supabase/supabase-js` v2, Zod, Vitest (+ `vitest.config.api.ts` live suite), Supabase CLI with SQL migrations + pgTAP. **Zero new npm dependencies.**

---

## Read this before starting

**Environment gotchas (this machine — inherited from Phase 0, all still true):**

1. **Every Bash step must `cd` explicitly.** The session's default working directory is the *marketing site* repo (`/Users/daodilyas/Desktop/iqra`), NOT the portal. Every command block starts with `cd /Users/daodilyas/dev/iqra-portal`. Never rely on a previous step's directory.
2. **The portal lives at `/Users/daodilyas/dev/iqra-portal`**, deliberately outside iCloud-synced paths. Plans/specs for the project live in the marketing repo under `docs/superpowers/` — but ALL code work happens in the portal repo. Work on **branch `feat/phase-1`** (Task 1 creates it from `main`).
3. **Docker + Supabase quirks:** if the stack is down, never plain `supabase start` — use `supabase start --ignore-health-check`, then wait until `docker ps` shows every container healthy (`rest`/`edge-runtime` have no healthcheck; plain `Up` is their healthy). `supabase db reset` completes all DB work even when it exits 1 in its final `Restarting containers...` phase — the `Applying migration .../Seeding data...` lines are the success signal; when it exits 1, do NOT re-run it: run the wait loop, then continue (the following `supabase test db` is the real verification).
4. **`supabase test db` runs pgTAP against the CURRENT local database.** Always `supabase db reset` after changing migrations/seeds, then `supabase test db`.
5. **Stale `.next` after `npm run build`:** running `npm run build` right before `npm run dev` leaves a manifest that 404s every route. Before browser-verifying after a build: `rm -rf .next`, then `npm run dev`.
6. **Commit messages:** Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). Never mention Claude/AI. No Co-Authored-By trailers.
7. **Norwegian UI, English code.** User-facing strings are bokmål; identifiers, comments, and DB names are English. New URL paths this phase: `/admin/elever`, `/admin/elever/ny`, `/admin/elever/[id]`, `/admin/elever/[id]/rediger`, `/admin/klasser`, `/admin/klasser/ny`, `/admin/klasser/[id]`, `/admin/fag`, `/admin/terminer`, `/admin/terminer/[id]`, `/laerer/klasser/[id]`.
8. **Design system is LOCKED (direction "C · Familie", spec §7).** Tokens live in `src/app/globals.css`, primitives in `src/components/ui/` (Button, Field, Input, Chip, Skeleton, EmptyState — read them before writing UI). Repo `DESIGN.md` is the reference. Bans: no kicker/eyebrow mini-labels, no emojis in UI, no purple, never `#000`/`#fff` (use `ink`/`canvas`), no gradient text, no identical-card grids. Interactive elements: `min-h-11`, visible focus ring (`focus-visible:ring-2 ring-ring ring-offset-2`), labels above inputs, teaching empty states, inline errors with `role="alert"`. All dates render via `Europe/Oslo` (server TZ is UTC in prod).
9. **Migrations own their privileges (gotcha 8 of Phase 0, ENFORCED by `supabase/tests/00_grant_firewall.sql`).** Every new table: `revoke all ... from anon, authenticated, service_role;` then grant back exactly the verbs its policies are written for. `anon` gets NOTHING. Every `create function` is followed by `revoke execute ... from public;` then a narrow grant. No sequences this phase (all PKs are `uuid default gen_random_uuid()` or composite).
10. **FK lifecycle (gotcha 9):** identity cascades from `auth.users` (Phase 0). School-core rules this phase: `students` NEVER cascades from any auth/profile row (`student_user_id ... on delete set null` — deleting a login must not destroy the registry); `guardian_student`/`class_teachers` DO cascade from `profiles` (pure relationship rows); `class_students` cascades from both `classes` and `students`; `classes.term_id` and `class_subjects.subject_id` are `on delete restrict` (structure in use must not vanish). No financial tables this phase.
11. **RLS helper pattern:** policies never subquery an RLS-protected table directly (the subquery would evaluate under the caller's own policies — recursion/denial hazards). Relationship checks go through SECURITY DEFINER `stable` functions in `private` with `set search_path = ''`, exactly like `private.has_role`. All Phase 1 helpers take `(uid uuid, …)` and are called as `private.helper((select auth.uid()), col)`.
12. **Audit namespace is ENFORCED from Task 1 on:** `private.audit()` rejects actions starting `admin.` / `system.` (SQLSTATE 42501). Trigger/DAL audit actions use `<table>.<verb>` (e.g. `students.update`); only the service-role admin module writes `admin.*` (direct INSERT). Never name an app-side audit action with a reserved prefix.
13. **Seed UUID scheme:** seed USERS use prefixes `1…7` (`77777777-…` is new this phase); seed school data uses `f1…` (terms), `fa…` (subjects), `fc…` (classes), `fe…` (students); pgTAP fixtures use per-file prefixes `a5…`/`a6…`/`a7…`/`a8…`/`a9…`/`ad…`. Never overlap them.
14. **`tests/api` growth rules:** every new seed user extends `DENIED_CELLS` in `access-wall.test.ts` (Task 5 takes it 23 → 27 cells) and the `SeedEmail` union in `harness.ts`. New Phase 1 API tests live in NEW files (`school-core.test.ts`, `admin-users.test.ts`, `school-actions.test.ts`) — the `vi.mock` preamble must be repeated per file (mock factories are hoisted; they cannot be shared).
15. **`'use server'` files may export ONLY async functions.** All Zod schemas + label maps live in `src/lib/validation/school.ts` (pure, unit-tested) and are imported by action files.
16. **One-active-enrollment invariant (spec §2 "one group per student"):** partial unique index on `class_students (student_id) where left_on is null`. Moving a student = set `left_on` on the old row, then insert the new one. The 23505 from this index maps to the Norwegian error «Eleven er allerede i en klasse.»
17. **TOTP for manual browser checks:** staff logins bounce to `/mfa/registrer` (all seed users are factorless). During enrollment the page shows the secret — generate codes without an app:

```bash
node -e '
const {createHmac} = require("node:crypto");
const secret = process.argv[1];
const A="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits="";
for (const ch of secret.replace(/=+$/,"").toUpperCase()){const v=A.indexOf(ch); if(v>=0) bits+=v.toString(2).padStart(5,"0");}
const bytes=[]; for(let i=0;i+8<=bits.length;i+=8) bytes.push(parseInt(bits.slice(i,i+8),2));
const msg=Buffer.alloc(8); msg.writeBigInt64BE(BigInt(Math.floor(Date.now()/1000/30)));
const d=createHmac("sha1",Buffer.from(bytes)).update(msg).digest(); const o=d[d.length-1]&15;
console.log((((d[o]&127)<<24|d[o+1]<<16|d[o+2]<<8|d[o+3])%1e6).toString().padStart(6,"0"));
' 'PASTE_SECRET_HERE'
```

**Execution discipline (unchanged from Phase 0 — protect it):** fresh implementer per task (Sonnet) → spec review → quality review → fix loop → controller live-verifies before closing. **Security-critical tasks (Fable-5 review with live probes): 1, 2, 3, 4, 5, 7, 8, 10.** TDD everywhere: tests written and failing before implementation; tests and implementation committed together per task (one commit per task, Phase 0 style).

**Deliberate scope decisions (do not re-litigate during implementation):**

- **Economy gets NO students access this phase.** The matrix cell "R names+payer only" ships in Phase 6 with its consumer (invoice runs) as a dedicated, role-checked path that EXCLUDES `protected` students (they are invoiced via family-level lines with `student_id null` — spec §4 `invoice_lines`). Until then economy is fully denied on `students`/`guardian_student`, and both suites pin that denial.
- **Provisioned accounts have no credentials yet.** `adminProvisionUser` creates confirmed, password-less auth users (registry-complete, login-later). The credential/invite flow (content-free e-mail via Brevo + token exchange + set-password page) lands with cloud onboarding — pre-pilot, tracked in the ledger. Locally, the seeded users cover every login flow.
- **Parents do not see teacher names this phase.** That requires cross-profile visibility (a `profiles` RLS widening or a definer lookup) and belongs to Phase 5 (messaging) where threads force the decision properly. Parent surfaces show class name + schedule only.
- **Teachers do not see guardian data.** Not in the §3 matrix; revisit with messaging.
- **`protected` ("skjermet") changes no RLS this phase** — every Phase 1 read path is own-relationship or admin, all of which may see protected students (spec §3 golden rule allows own teacher's roster + admin; a parent obviously sees their own child). The flag is stored, settable, chip-marked in admin/teacher UI, and its export/economy exclusions land with those features. Do NOT "helpfully" filter protected students from parent/teacher-own views — that would be a bug.
- **Term editing is minimal** (name/dates on a detail page); no term deletion when classes exist (FK restrict surfaces as a friendly error).

**File structure (new/modified this phase):**

```
/Users/daodilyas/dev/iqra-portal/
├── supabase/
│   ├── migrations/
│   │   ├── <ts>_audit_namespace_guard.sql        # Task 1
│   │   ├── <ts>_school_structure.sql             # Task 2: terms, subjects
│   │   ├── <ts>_classes.sql                      # Task 3: classes, class_teachers, class_subjects, class_schedule, teaches_class
│   │   ├── <ts>_students_guardians_enrollment.sql# Task 4: students, guardian_student, class_students, helpers, audit triggers
│   │   └── <ts>_admin_user_lookup.sql            # Task 8: service-role email→user lookup fn
│   ├── seed.sql                                  # Task 5: +forelder2, school data
│   └── tests/
│       ├── 05_audit_namespace.sql                # Task 1
│       ├── 06_school_structure_rls.sql           # Task 2
│       ├── 07_classes_rls.sql                    # Task 3
│       ├── 08_students_guardians_rls.sql         # Task 4 (Bergen tests at wall 2)
│       ├── 09_enrollment_rls.sql                 # Task 4
│       └── 10_admin_lookup.sql                   # Task 8
├── tests/api/
│   ├── harness.ts                                # Task 5: +forelder2 in SeedEmail
│   ├── access-wall.test.ts                       # Task 5: DENIED_CELLS 23→27
│   ├── school-core.test.ts                       # Tasks 6–7: DAL reads at wall 1
│   ├── admin-users.test.ts                       # Task 8: provisioning quarantine
│   └── school-actions.test.ts                    # Tasks 9–10: action guards + mappings
└── src/
    ├── lib/
    │   ├── validation/school.ts (+test)          # Task 9: all Zod schemas + label maps
    │   ├── dates.ts (+test)                      # Task 9: Oslo-pinned date helpers
    │   ├── dal/
    │   │   ├── session.ts                        # Task 6: +requireStaffRole (AAL2 at wall 1)
    │   │   ├── terms.ts / subjects.ts / classes.ts / users.ts   # Task 6
    │   │   ├── students.ts                       # Task 7
    │   │   └── dashboard.ts                      # Task 16
    │   └── admin/
    │       ├── quarantine.ts                     # Task 8: AdminAccessDenied + requireAdminActor + service client (extracted)
    │       ├── audit-log.ts                      # Task 1 comment fix; Task 8 imports from quarantine
    │       └── users.ts                          # Task 8: adminProvisionUser/adminGrantRole/adminFindUserByEmail
    └── app/(portal)/
        ├── admin/
        │   ├── layout.tsx                        # Task 6: requireStaffRole; Task 11: AdminNav
        │   ├── page.tsx                          # Task 16: real counts
        │   ├── AdminNav.tsx                      # Task 11
        │   ├── terminer/ page.tsx + [id]/page.tsx + TermForms.tsx + actions.ts   # Tasks 9, 11
        │   ├── fag/      page.tsx + SubjectForms.tsx + actions.ts                # Tasks 9, 11
        │   ├── klasser/  page.tsx + ny/page.tsx + [id]/page.tsx + ClassForms.tsx + actions.ts  # Tasks 9, 12
        │   └── elever/   page.tsx + ny/page.tsx + [id]/page.tsx + [id]/rediger/page.tsx
        │                 + StudentForms.tsx + GuardianCard.tsx + LoginCard.tsx + EnrollCard.tsx + actions.ts  # Tasks 10, 13, 14
        ├── laerer/  layout.tsx (Task 6) + page.tsx + klasser/[id]/page.tsx       # Task 15
        ├── okonomi/ layout.tsx                   # Task 6: requireStaffRole
        ├── forelder/page.tsx                     # Task 16
        └── elev/    page.tsx                     # Task 16
```

**Task order and why:** 1 audit-namespace guard (smallest migration; unblocks trusting `admin.*` and sets the Phase 1 migration rhythm) → 2–4 school-core migrations + pgTAP (wall 2 proven before any app code) → 5 seeds + regenerated types + matrix growth (everything downstream needs fixtures and `Database` types) → 6–7 DAL reads + `requireStaffRole` (wall 1 twins of the pgTAP proofs) → 8 admin-module provisioning (needed by guardian/login linking) → 9–10 validation + server actions (writes, TDD against live stack) → 11–16 UI (admin structure → registry → one-glance → teacher → parent/student/dashboards) → 17 exit gate + docs + ledger.

---

### Task 1: Enforce the reserved audit namespace

Closes the durable deferred item from the T5/T11 security reviews: `private.audit()` must REJECT actions in the reserved `admin.`/`system.` namespaces so that `admin.*` entries in `audit_log` are genuinely unforgeable by app-role sessions (they can then only originate from the service-role admin module or migrations). Phase 1 introduces trigger-driven audit writes, so this lands FIRST.

**Files:**
- Create: `supabase/tests/05_audit_namespace.sql`
- Create: `supabase/migrations/<ts>_audit_namespace_guard.sql` (via `supabase migration new`)
- Modify: `src/lib/admin/audit-log.ts` (comment only — the "convention only" caveat is now false)

- [ ] **Step 0: Branch + stack sanity**

```bash
cd /Users/daodilyas/dev/iqra-portal
git checkout main && git pull --ff-only 2>/dev/null; git checkout -b feat/phase-1
docker ps --format '{{.Names}}\t{{.Status}}' | grep supabase | wc -l
npm run typecheck && npm test -- --run 2>&1 | tail -3
```

Expected: branch `feat/phase-1` created; 10 supabase containers; typecheck silent; 75 Vitest tests pass. If containers are missing, follow gotcha 3.

- [ ] **Step 1: Write the failing pgTAP file**

Create `supabase/tests/05_audit_namespace.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Setup: an ordinary user and an ADMIN — the namespace guard must reject
-- both (admin-authoritative entries only ever come from the service-role
-- admin module, never from an app-role session, whatever its role).
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'a5000000-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'pgtap-ns-user@test.local',
   '{"provider":"email","providers":["email"]}', '{"full_name":"NS Bruker"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a5000000-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'pgtap-ns-admin@test.local',
   '{"provider":"email","providers":["email"]}', '{"full_name":"NS Admin"}', now(), now());
insert into public.user_roles (user_id, role) values
  ('a5000000-0000-0000-0000-000000000002', 'admin');

-- As an ordinary authenticated user: reserved prefixes are rejected.
select set_config('request.jwt.claims',
  '{"sub":"a5000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select private.audit('admin.spoofed_view', 'audit_log') $$,
  '42501', null,
  'private.audit rejects the reserved admin.* namespace');
select throws_ok(
  $$ select private.audit('system.retention_run', 'audit_log') $$,
  '42501', null,
  'private.audit rejects the reserved system.* namespace');
-- Normalization-agnostic boundary (security review F1): case-folded and
-- leading-whitespace variants must also be rejected, so the guard never
-- depends on a downstream consumer normalizing the same way.
select throws_ok(
  $$ select private.audit('ADMIN.spoofed_view', 'audit_log') $$,
  '42501', null,
  'private.audit rejects a case-variant of the reserved namespace');
select throws_ok(
  $$ select private.audit('  admin.spoofed_view', 'audit_log') $$,
  '42501', null,
  'private.audit rejects a leading-whitespace variant of the reserved namespace');
select lives_ok(
  $$ select private.audit('students.update', 'students', 'a5-entity') $$,
  'ordinary namespaced actions still pass');
reset role;

-- Even a genuine ADMIN session cannot mint admin.* through private.audit.
select set_config('request.jwt.claims',
  '{"sub":"a5000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select private.audit('admin.audit_log.viewed', 'audit_log') $$,
  '42501', null,
  'admin-role sessions are also rejected — admin.* is module-only');
reset role;

-- The allowed entry landed with the actor pinned by the definer.
select is(
  (select count(*) from public.audit_log
   where action = 'students.update'
     and actor_id = 'a5000000-0000-0000-0000-000000000001'
     and entity_id = 'a5-entity'),
  1::bigint,
  'allowed action landed with actor pinned to the caller');

-- The service role (admin module's path) still writes admin.* directly.
set local role service_role;
select lives_ok(
  $$ insert into public.audit_log (actor_id, action, entity, meta)
     values ('a5000000-0000-0000-0000-000000000002', 'admin.probe', 'audit_log',
             '{"source":"pgtap"}') $$,
  'service_role inserts admin.* directly (module path unaffected)');
reset role;
select is(
  (select count(*) from public.audit_log where action = 'admin.probe'),
  1::bigint,
  'the module-path admin.* entry landed');

select * from finish();
rollback;
```

- [ ] **Step 2: Run pgTAP — expect the new file RED**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase test db 2>&1 | tail -15
```

Expected: `00`–`04` pass; `05_audit_namespace` FAILS on the three `throws_ok` tests (the current `private.audit` happily inserts reserved actions). If it fails for a different reason (syntax, setup), fix that first — the failure must be the guard's absence.

- [ ] **Step 3: Create the migration**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase migration new audit_namespace_guard
```

Write the generated file `supabase/migrations/<ts>_audit_namespace_guard.sql`:

```sql
-- Enforce the reserved audit namespace (closes the T5/T11 review follow-up).
-- private.audit() is the ONLY write path into audit_log available to app-role
-- sessions (authenticated holds no INSERT grant and no INSERT policy exists),
-- so rejecting reserved prefixes HERE makes `admin.*` / `system.*` entries
-- unforgeable from app sessions: they can only originate from the
-- service-role admin module (direct INSERT bypasses this function) or from
-- migrations/seeds running as postgres. Consumers (the Phase 7 audit viewer,
-- alerting) may treat the namespace as authoritative from this migration on.
create or replace function private.audit(
  p_action    text,
  p_entity    text,
  p_entity_id text default null,
  p_meta      jsonb default '{}'::jsonb
)
returns void
language plpgsql  -- was sql: plpgsql for the guard + RAISE
security definer
set search_path = ''
as $$
begin
  -- Normalization-agnostic boundary (T1 security review F1): fold case and
  -- skip leading whitespace so `Admin.`, `ADMIN.`, ` admin.` and tab-prefixed
  -- lookalikes are ALSO rejected. The guard must not depend on a downstream
  -- consumer matching the exact same way — a viewer that ilike/lower/trims
  -- before deciding authority would otherwise promote a spoofed variant.
  -- lower() and ~ are pg_catalog (safe under search_path='').
  if lower(p_action) ~ '^[[:space:]]*(admin|system)\.' then
    raise exception 'reservert navnerom for revisjonslogg: %', p_action
      using errcode = '42501';
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values ((select auth.uid()), p_action, p_entity, p_entity_id, p_meta);
end;
$$;

-- CREATE OR REPLACE preserves the existing ACL, but the normalize rule is
-- uniform (header gotcha 9): strip PUBLIC, grant back the narrow set.
revoke execute on function private.audit(text, text, text, jsonb) from public;
grant execute on function private.audit(text, text, text, jsonb) to authenticated;

comment on function private.audit(text, text, text, jsonb) is
  'Sanctioned app-role write path to audit_log. TRUST MODEL: actor_id is
   authoritative (pinned to auth.uid()); action/entity/entity_id/meta are
   caller-asserted EXCEPT the namespace: actions that normalize (case-fold +
   leading-whitespace-skip) to an admin. or system. prefix are REJECTED here
   (42501), so entries in those namespaces are authoritative — they can only
   come from the service-role admin module or migrations. Phase 7 consumers
   MUST still classify with a case-sensitive, anchored predicate
   (action LIKE ''admin.%''), never ILIKE/lower/trim.';
```

- [ ] **Step 4: Apply and verify GREEN**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase db reset 2>&1 | tail -5
supabase test db 2>&1 | tail -10
```

Expected: reset applies 3 migrations (gotcha 3 if exit 1 in the restart phase); `supabase test db` shows all 6 files passing — `05_audit_namespace` 9/9. Total pgTAP: **74 tests** (65 + 9).

- [ ] **Step 5: Update the stale comment in the admin module**

In `src/lib/admin/audit-log.ts`, replace:

```ts
  // `admin.*` marks a service-role (authoritative) entry, distinct from the
  // caller-asserted private.audit() path. NB: until private.audit() rejects
  // the reserved `admin.` prefix (tracked), the namespace is convention only —
  // no consumer may treat `admin.*` alone as proof of a genuine admin action.
```

with:

```ts
  // `admin.*` marks a service-role (authoritative) entry. private.audit()
  // REJECTS the reserved admin./system. prefixes (audit_namespace_guard
  // migration), so this namespace cannot be minted from app-role sessions —
  // consumers may treat admin.* as proof of a service-role write.
```

- [ ] **Step 6: Full local gate + commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run lint && npm test -- --run 2>&1 | tail -3 && npm run test:api 2>&1 | tail -4
git add supabase/tests/05_audit_namespace.sql supabase/migrations/*_audit_namespace_guard.sql src/lib/admin/audit-log.ts
git commit -m "feat: enforce reserved admin./system. audit namespace in private.audit"
```

Expected: typecheck silent, lint clean, 75 Vitest, 32 test:api (the stack is up and reseeded from Step 4). Commit lands on `feat/phase-1`.

### Task 2: Migration — terms and subjects

**Files:**
- Create: `supabase/tests/06_school_structure_rls.sql`
- Create: `supabase/migrations/<ts>_school_structure.sql`

- [ ] **Step 1: Write the failing pgTAP file**

Create `supabase/tests/06_school_structure_rls.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- Hermetic fixtures (seed independence): `supabase db reset` loads seed.sql —
-- which populates the school-core tables from Task 5 on — BEFORE `supabase
-- test db` runs. Clear those rows first (as postgres, inside this rolled-back
-- transaction) so the fixtures below are the only rows and the absolute-count
-- and single-current assertions stay independent of seed content. Restored on
-- rollback. FK-safe order: children before parents.
delete from public.class_students;
delete from public.class_schedule;
delete from public.class_subjects;
delete from public.class_teachers;
delete from public.guardian_student;
delete from public.students;
delete from public.classes;
delete from public.subjects;
delete from public.terms;

-- ── Setup (as postgres) ─────────────────────────────────────────────
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'a6000000-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'pgtap-ss-admin@test.local',
   '{"provider":"email","providers":["email"]}', '{"full_name":"SS Admin"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a6000000-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'pgtap-ss-laerer@test.local',
   '{"provider":"email","providers":["email"]}', '{"full_name":"SS Lærer"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a6000000-0000-0000-0000-000000000003',
   'authenticated', 'authenticated', 'pgtap-ss-forelder@test.local',
   '{"provider":"email","providers":["email"]}', '{"full_name":"SS Forelder"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a6000000-0000-0000-0000-000000000004',
   'authenticated', 'authenticated', 'pgtap-ss-okonomi@test.local',
   '{"provider":"email","providers":["email"]}', '{"full_name":"SS Økonomi"}', now(), now());
insert into public.user_roles (user_id, role) values
  ('a6000000-0000-0000-0000-000000000001', 'admin'),
  ('a6000000-0000-0000-0000-000000000002', 'teacher'),
  ('a6000000-0000-0000-0000-000000000003', 'parent'),
  ('a6000000-0000-0000-0000-000000000004', 'economy');

insert into public.terms (id, name, starts_on, ends_on, is_current) values
  ('a6000000-0000-0000-0000-000000000011', 'A6 Vår',  '2026-01-10', '2026-06-20', true),
  ('a6000000-0000-0000-0000-000000000012', 'A6 Høst', '2026-08-15', '2026-12-20', false);
insert into public.subjects (id, name, quran_tracking, sort) values
  ('a6000000-0000-0000-0000-000000000021', 'A6 Arabisk', false, 1),
  ('a6000000-0000-0000-0000-000000000022', 'A6 Koran',   true,  2);

-- ── Schema shape ────────────────────────────────────────────────────
select has_table('public'::name, 'terms'::name, 'terms table exists');
select has_table('public'::name, 'subjects'::name, 'subjects table exists');
select ok((select relrowsecurity from pg_class
           where oid = 'public.terms'::regclass), 'RLS enabled on terms');
select ok((select relrowsecurity from pg_class
           where oid = 'public.subjects'::regclass), 'RLS enabled on subjects');

-- ── Invariants (as postgres — constraint layer, role-independent) ───
select throws_ok(
  $$ insert into public.terms (name, starts_on, ends_on, is_current)
     values ('A6 Andre nåværende', '2027-01-01', '2027-06-01', true) $$,
  '23505', null,
  'a second current term violates terms_single_current');
select throws_ok(
  $$ insert into public.terms (name, starts_on, ends_on)
     values ('A6 Baklengs', '2026-06-01', '2026-01-01') $$,
  '23514', null,
  'ends_on before starts_on is rejected');
select throws_ok(
  $$ insert into public.subjects (name) values ('A6 Arabisk') $$,
  '23505', null,
  'duplicate subject name is rejected');

-- ── anon: denied at the grant layer ─────────────────────────────────
set local role anon;
select throws_ok(
  $$ select count(*) from public.terms $$, '42501', null,
  'anon is denied on terms at the grant layer');
select throws_ok(
  $$ select count(*) from public.subjects $$, '42501', null,
  'anon is denied on subjects at the grant layer');
reset role;

-- ── Read matrix ─────────────────────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"a6000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.terms), 2::bigint,
  'teacher reads all terms');
select is((select count(*) from public.subjects), 2::bigint,
  'teacher reads all subjects');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"a6000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.terms), 2::bigint,
  'economy reads terms (needed for invoice runs in Phase 6)');
select is((select count(*) from public.subjects), 0::bigint,
  'economy sees ZERO subjects — no pedagogy surface (spec §3)');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"a6000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.subjects), 2::bigint,
  'parent reads subjects');

-- ── Write matrix (still as parent) ──────────────────────────────────
select throws_ok(
  $$ insert into public.terms (name, starts_on, ends_on)
     values ('A6 Kapret termin', '2027-01-01', '2027-06-01') $$,
  '42501', null,
  'parent cannot insert a term (RLS with check)');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"a6000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ update public.terms set name = 'A6 Kapret'
     where id = 'a6000000-0000-0000-0000-000000000011' $$,
  'teacher update against a term runs without matching any row');
reset role;
select is(
  (select name from public.terms
   where id = 'a6000000-0000-0000-0000-000000000011'),
  'A6 Vår',
  'term is unchanged after the teacher write attempt');

-- ── Admin writes through their own session (wall 2 stays real) ─────
select set_config('request.jwt.claims',
  '{"sub":"a6000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.terms (id, name, starts_on, ends_on)
     values ('a6000000-0000-0000-0000-000000000031', 'A6 Neste',
             '2027-01-05', '2027-06-15') $$,
  'admin inserts a term');
select lives_ok(
  $$ update public.subjects set sort = 9
     where id = 'a6000000-0000-0000-0000-000000000021' $$,
  'admin updates a subject');
select lives_ok(
  $$ delete from public.terms
     where id = 'a6000000-0000-0000-0000-000000000031' $$,
  'admin deletes a term without classes');
reset role;

select is((select count(*) from public.terms), 2::bigint,
  'admin insert+delete round-trip leaves the original two terms');
select is(
  (select sort from public.subjects
   where id = 'a6000000-0000-0000-0000-000000000021'),
  9,
  'admin subject update landed');

select * from finish();
rollback;
```

- [ ] **Step 2: Run pgTAP — expect 06 RED**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase test db 2>&1 | tail -12
```

Expected: `05` and earlier pass; `06_school_structure_rls` errors immediately (`relation "public.terms" does not exist`). That IS the failing state — the tables are missing.

- [ ] **Step 3: Create the migration**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase migration new school_structure
```

Write `supabase/migrations/<ts>_school_structure.sql`:

```sql
-- School structure part 1: terms and subjects (spec §4).
-- Low-sensitivity scaffolding, but least privilege still applies: economy
-- has no pedagogy surface (spec §3 golden rule), so subjects exclude the
-- economy role; terms stay readable by every authenticated user (economy
-- needs them for invoice runs in Phase 6, shells show the current term).

-- ── terms ───────────────────────────────────────────────────────────
create table public.terms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 60),
  starts_on  date not null,
  ends_on    date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint terms_dates check (ends_on > starts_on),
  constraint terms_name_unique unique (name)
);
comment on table public.terms is
  'School terms ("Høst 2026"). At most one row has is_current — enforced by terms_single_current. This is the single source of truth for the current term (deliberately NOT duplicated into settings).';

-- The single-current invariant. NB for the app layer: switching the current
-- term is TWO statements in one request (clear the old, set the new) — a
-- single UPDATE touching both rows can transiently violate this index
-- depending on row visit order.
create unique index terms_single_current on public.terms (is_current)
  where is_current;

create trigger terms_set_updated_at
  before update on public.terms
  for each row execute function private.set_updated_at();

-- ── subjects ────────────────────────────────────────────────────────
create table public.subjects (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(name) between 1 and 60),
  quran_tracking boolean not null default false,
  sort           integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint subjects_name_unique unique (name)
);
comment on table public.subjects is
  'Teaching subjects (Arabisk, Koran, Islamkunnskap, …). quran_tracking marks subjects assessed with the Quran tracker (Phase 3). sort orders UI lists.';

create trigger subjects_set_updated_at
  before update on public.subjects
  for each row execute function private.set_updated_at();

-- ── Grant layer (wall 2a, header gotcha 9): normalize, then narrow ──
-- authenticated gets full DML because ADMIN writes flow through the
-- admin's own session (RLS admin policies below gate who) — the service
-- role is NOT the write path for school structure. anon gets nothing.
revoke all on table public.terms    from anon, authenticated, service_role;
revoke all on table public.subjects from anon, authenticated, service_role;
grant select, insert, update, delete on public.terms    to authenticated;
grant select, insert, update, delete on public.subjects to authenticated;
grant select, insert, update, delete on public.terms    to service_role;
grant select, insert, update, delete on public.subjects to service_role;

-- ── RLS: default deny, then explicit narrow policies ────────────────
alter table public.terms    enable row level security;
alter table public.subjects enable row level security;

create policy "terms_select_authenticated"
  on public.terms for select to authenticated
  using (true);
create policy "terms_admin_insert"
  on public.terms for insert to authenticated
  with check (private.has_role((select auth.uid()), 'admin'));
create policy "terms_admin_update"
  on public.terms for update to authenticated
  using (private.has_role((select auth.uid()), 'admin'))
  with check (private.has_role((select auth.uid()), 'admin'));
create policy "terms_admin_delete"
  on public.terms for delete to authenticated
  using (private.has_role((select auth.uid()), 'admin'));

-- subjects: pedagogy — admin/teacher/parent/student read; economy does not.
create policy "subjects_select_school"
  on public.subjects for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.has_role((select auth.uid()), 'teacher')
    or private.has_role((select auth.uid()), 'parent')
    or private.has_role((select auth.uid()), 'student')
  );
create policy "subjects_admin_insert"
  on public.subjects for insert to authenticated
  with check (private.has_role((select auth.uid()), 'admin'));
create policy "subjects_admin_update"
  on public.subjects for update to authenticated
  using (private.has_role((select auth.uid()), 'admin'))
  with check (private.has_role((select auth.uid()), 'admin'));
create policy "subjects_admin_delete"
  on public.subjects for delete to authenticated
  using (private.has_role((select auth.uid()), 'admin'));
```

- [ ] **Step 4: Apply and verify GREEN**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase db reset 2>&1 | tail -5
supabase test db 2>&1 | tail -12
```

Expected: all 7 files pass — `06` 22/22; the grant firewall (`00`) still passes, proving the revoke/grant layer is complete. Total pgTAP: **96**.

- [ ] **Step 5: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add supabase/tests/06_school_structure_rls.sql supabase/migrations/*_school_structure.sql
git commit -m "feat: terms and subjects with admin-write RLS and single-current invariant"
```

---

### Task 3: Migration — classes, class_teachers, class_subjects, class_schedule

**Files:**
- Create: `supabase/tests/07_classes_rls.sql`
- Create: `supabase/migrations/<ts>_classes.sql`

- [ ] **Step 1: Write the failing pgTAP file**

Create `supabase/tests/07_classes_rls.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- Hermetic fixtures (seed independence): `supabase db reset` loads seed.sql —
-- which populates the school-core tables from Task 5 on — BEFORE `supabase
-- test db` runs. Clear those rows first (as postgres, inside this rolled-back
-- transaction) so the fixtures below are the only rows and the absolute-count
-- and single-current assertions stay independent of seed content. Restored on
-- rollback. FK-safe order: children before parents.
delete from public.class_students;
delete from public.class_schedule;
delete from public.class_subjects;
delete from public.class_teachers;
delete from public.guardian_student;
delete from public.students;
delete from public.classes;
delete from public.subjects;
delete from public.terms;

-- ── Setup (as postgres) ─────────────────────────────────────────────
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'a7000000-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'pgtap-kl-admin@test.local',
   '{"provider":"email","providers":["email"]}', '{"full_name":"KL Admin"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a7000000-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'pgtap-kl-laerer1@test.local',
   '{"provider":"email","providers":["email"]}', '{"full_name":"KL Lærer En"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a7000000-0000-0000-0000-000000000003',
   'authenticated', 'authenticated', 'pgtap-kl-laerer2@test.local',
   '{"provider":"email","providers":["email"]}', '{"full_name":"KL Lærer To"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a7000000-0000-0000-0000-000000000004',
   'authenticated', 'authenticated', 'pgtap-kl-forelder@test.local',
   '{"provider":"email","providers":["email"]}', '{"full_name":"KL Forelder"}', now(), now());
insert into public.user_roles (user_id, role) values
  ('a7000000-0000-0000-0000-000000000001', 'admin'),
  ('a7000000-0000-0000-0000-000000000002', 'teacher'),
  ('a7000000-0000-0000-0000-000000000003', 'teacher'),
  ('a7000000-0000-0000-0000-000000000004', 'parent');

insert into public.terms (id, name, starts_on, ends_on) values
  ('a7000000-0000-0000-0000-000000000011', 'A7 Termin', '2026-08-15', '2026-12-20');
insert into public.subjects (id, name, sort) values
  ('a7000000-0000-0000-0000-000000000031', 'A7 Fag', 1);
insert into public.classes (id, term_id, name, room) values
  ('a7000000-0000-0000-0000-000000000021',
   'a7000000-0000-0000-0000-000000000011', 'A7 Klasse 1', 'Rom 2'),
  ('a7000000-0000-0000-0000-000000000022',
   'a7000000-0000-0000-0000-000000000011', 'A7 Klasse 2', null);
insert into public.class_teachers (class_id, teacher_id) values
  ('a7000000-0000-0000-0000-000000000021', 'a7000000-0000-0000-0000-000000000002'),
  ('a7000000-0000-0000-0000-000000000022', 'a7000000-0000-0000-0000-000000000003');
insert into public.class_subjects (class_id, subject_id) values
  ('a7000000-0000-0000-0000-000000000021', 'a7000000-0000-0000-0000-000000000031'),
  ('a7000000-0000-0000-0000-000000000022', 'a7000000-0000-0000-0000-000000000031');
insert into public.class_schedule (class_id, weekday, starts_at, ends_at) values
  ('a7000000-0000-0000-0000-000000000021', 6, '10:00', '13:00'),
  ('a7000000-0000-0000-0000-000000000022', 7, '10:00', '13:00');

-- ── Schema shape ────────────────────────────────────────────────────
select has_table('public'::name, 'classes'::name, 'classes table exists');
select has_table('public'::name, 'class_teachers'::name, 'class_teachers table exists');
select has_table('public'::name, 'class_subjects'::name, 'class_subjects table exists');
select has_table('public'::name, 'class_schedule'::name, 'class_schedule table exists');
select ok((select relrowsecurity from pg_class
           where oid = 'public.classes'::regclass), 'RLS enabled on classes');
select ok((select relrowsecurity from pg_class
           where oid = 'public.class_teachers'::regclass), 'RLS enabled on class_teachers');
select ok((select relrowsecurity from pg_class
           where oid = 'public.class_subjects'::regclass), 'RLS enabled on class_subjects');
select ok((select relrowsecurity from pg_class
           where oid = 'public.class_schedule'::regclass), 'RLS enabled on class_schedule');
select has_function('private', 'teaches_class', array['uuid', 'uuid'],
  'private.teaches_class(uuid,uuid) exists');

-- ── Constraint invariants (as postgres) ─────────────────────────────
select throws_ok(
  $$ insert into public.class_schedule (class_id, weekday, starts_at, ends_at)
     values ('a7000000-0000-0000-0000-000000000021', 6, '14:00', '13:00') $$,
  '23514', null,
  'schedule slot with ends_at before starts_at is rejected');
select throws_ok(
  $$ insert into public.class_schedule (class_id, weekday, starts_at, ends_at)
     values ('a7000000-0000-0000-0000-000000000021', 6, '10:00', '12:00') $$,
  '23505', null,
  'duplicate schedule slot (class, weekday, start) is rejected');
select throws_ok(
  $$ delete from public.terms
     where id = 'a7000000-0000-0000-0000-000000000011' $$,
  '23503', null,
  'a term with classes cannot be deleted (FK restrict)');

-- ── Teacher 1: own class only (fine-derived #4 at the class level) ──
select set_config('request.jwt.claims',
  '{"sub":"a7000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select id from public.classes $$,
  $$ values ('a7000000-0000-0000-0000-000000000021'::uuid) $$,
  'teacher 1 sees exactly their own class');
select is_empty(
  $$ select id from public.classes
     where id = 'a7000000-0000-0000-0000-000000000022' $$,
  'teacher 1 cannot see class 2 even by direct id');
select is((select count(*) from public.class_schedule), 1::bigint,
  'teacher 1 sees only their own class''s schedule');
select is((select count(*) from public.class_subjects), 1::bigint,
  'teacher 1 sees only their own class''s subjects');
select results_eq(
  $$ select class_id from public.class_teachers $$,
  $$ values ('a7000000-0000-0000-0000-000000000021'::uuid) $$,
  'teacher 1 sees teacher rows only for their own class');
select throws_ok(
  $$ insert into public.classes (term_id, name)
     values ('a7000000-0000-0000-0000-000000000011', 'A7 Kapret') $$,
  '42501', null,
  'teacher cannot create a class');
select throws_ok(
  $$ insert into public.class_teachers (class_id, teacher_id)
     values ('a7000000-0000-0000-0000-000000000022',
             'a7000000-0000-0000-0000-000000000002') $$,
  '42501', null,
  'teacher cannot assign themselves to another class');
select lives_ok(
  $$ delete from public.classes
     where id = 'a7000000-0000-0000-0000-000000000021' $$,
  'teacher delete against their class runs without matching any row');
reset role;
select is((select count(*) from public.classes), 2::bigint,
  'both classes survive the teacher delete attempt');

-- ── Parent: no classes visible yet (enrollment comes in Task 4) ─────
select set_config('request.jwt.claims',
  '{"sub":"a7000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.classes), 0::bigint,
  'parent with no enrolled children sees zero classes');
reset role;

-- ── Admin: full visibility + the teacher-role with_check invariant ──
select set_config('request.jwt.claims',
  '{"sub":"a7000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.classes), 2::bigint,
  'admin sees every class');
select throws_ok(
  $$ insert into public.class_teachers (class_id, teacher_id)
     values ('a7000000-0000-0000-0000-000000000021',
             'a7000000-0000-0000-0000-000000000004') $$,
  '42501', null,
  'even admin cannot assign a non-teacher as class teacher (with check)');
select lives_ok(
  $$ insert into public.classes (term_id, name)
     values ('a7000000-0000-0000-0000-000000000011', 'A7 Klasse 3') $$,
  'admin creates a class');
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Run pgTAP — expect 07 RED**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase test db 2>&1 | tail -12
```

Expected: `07_classes_rls` errors with `relation "public.classes" does not exist`; everything else passes.

- [ ] **Step 3: Create the migration**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase migration new classes
```

Write `supabase/migrations/<ts>_classes.sql`:

```sql
-- School structure part 2: classes and their teacher/subject/schedule links
-- (spec §4). Visibility model this migration: admin sees everything, a
-- teacher sees exactly the classes they teach (private.teaches_class).
-- Parent/student visibility is ADDED in the enrollment migration (Task 4) —
-- policies are permissive (OR-ed), so later migrations extend, never edit.

create table public.classes (
  id         uuid primary key default gen_random_uuid(),
  term_id    uuid not null references public.terms (id) on delete restrict,
  name       text not null check (char_length(name) between 1 and 60),
  room       text check (room is null or char_length(room) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classes_name_per_term unique (term_id, name)
);
comment on table public.classes is
  'One group per student ("Klasse 3") within a term (spec §2). Deleting a class cascades its link rows (teachers/subjects/schedule/enrollment) — deleting a TERM with classes is refused instead (restrict).';

create trigger classes_set_updated_at
  before update on public.classes
  for each row execute function private.set_updated_at();

create table public.class_teachers (
  class_id   uuid not null references public.classes (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, teacher_id)
);
comment on table public.class_teachers is
  'Pure relationship row: cascades from both sides (a deleted teacher profile must not leave dangling links — GDPR erasure propagates; the class itself is untouched).';

create table public.class_subjects (
  class_id   uuid not null references public.classes (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (class_id, subject_id)
);

create table public.class_schedule (
  class_id   uuid not null references public.classes (id) on delete cascade,
  weekday    smallint not null check (weekday between 1 and 7),
  starts_at  time not null,
  ends_at    time not null,
  created_at timestamptz not null default now(),
  primary key (class_id, weekday, starts_at),
  constraint class_schedule_times check (ends_at > starts_at)
);
comment on column public.class_schedule.weekday is
  'ISO weekday: 1 = mandag … 7 = søndag. Lessons are GENERATED from these rows per term in Phase 2.';

-- ── Relationship helper (header gotcha 11) ──────────────────────────
create or replace function private.teaches_class(uid uuid, cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.class_teachers
    where class_id = cid and teacher_id = uid
  );
$$;
revoke execute on function private.teaches_class(uuid, uuid) from public;
grant execute on function private.teaches_class(uuid, uuid) to authenticated;

-- ── Grant layer (wall 2a, header gotcha 9) ──────────────────────────
-- class_teachers/class_subjects rows are add/remove only (composite-PK link
-- rows) — no UPDATE verb is granted to anyone, not even service_role (they
-- are immutable below superuser). Schedule slots are likewise replaced,
-- never edited in place.
revoke all on table public.classes        from anon, authenticated, service_role;
revoke all on table public.class_teachers from anon, authenticated, service_role;
revoke all on table public.class_subjects from anon, authenticated, service_role;
revoke all on table public.class_schedule from anon, authenticated, service_role;
grant select, insert, update, delete on public.classes  to authenticated;
grant select, insert, delete         on public.class_teachers to authenticated;
grant select, insert, delete         on public.class_subjects to authenticated;
grant select, insert, delete         on public.class_schedule to authenticated;
grant select, insert, update, delete on public.classes        to service_role;
grant select, insert, delete         on public.class_teachers to service_role;
grant select, insert, delete         on public.class_subjects to service_role;
grant select, insert, delete         on public.class_schedule to service_role;

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.classes        enable row level security;
alter table public.class_teachers enable row level security;
alter table public.class_subjects enable row level security;
alter table public.class_schedule enable row level security;

create policy "classes_select_admin_or_teacher"
  on public.classes for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_class((select auth.uid()), id)
  );
create policy "classes_admin_insert"
  on public.classes for insert to authenticated
  with check (private.has_role((select auth.uid()), 'admin'));
create policy "classes_admin_update"
  on public.classes for update to authenticated
  using (private.has_role((select auth.uid()), 'admin'))
  with check (private.has_role((select auth.uid()), 'admin'));
create policy "classes_admin_delete"
  on public.classes for delete to authenticated
  using (private.has_role((select auth.uid()), 'admin'));

-- class_teachers: a teacher sees the teacher rows of classes they teach
-- (incl. co-teachers); only admin links/unlinks, and ONLY users who actually
-- hold the teacher role can be linked (with check invariant).
create policy "class_teachers_select_admin_or_own_class"
  on public.class_teachers for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_class((select auth.uid()), class_id)
  );
create policy "class_teachers_admin_insert"
  on public.class_teachers for insert to authenticated
  with check (
    private.has_role((select auth.uid()), 'admin')
    and private.has_role(teacher_id, 'teacher')
  );
create policy "class_teachers_admin_delete"
  on public.class_teachers for delete to authenticated
  using (private.has_role((select auth.uid()), 'admin'));

create policy "class_subjects_select_admin_or_teacher"
  on public.class_subjects for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_class((select auth.uid()), class_id)
  );
create policy "class_subjects_admin_insert"
  on public.class_subjects for insert to authenticated
  with check (private.has_role((select auth.uid()), 'admin'));
create policy "class_subjects_admin_delete"
  on public.class_subjects for delete to authenticated
  using (private.has_role((select auth.uid()), 'admin'));

create policy "class_schedule_select_admin_or_teacher"
  on public.class_schedule for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_class((select auth.uid()), class_id)
  );
create policy "class_schedule_admin_insert"
  on public.class_schedule for insert to authenticated
  with check (private.has_role((select auth.uid()), 'admin'));
create policy "class_schedule_admin_delete"
  on public.class_schedule for delete to authenticated
  using (private.has_role((select auth.uid()), 'admin'));
```

- [ ] **Step 4: Apply and verify GREEN**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase db reset 2>&1 | tail -5
supabase test db 2>&1 | tail -12
```

Expected: all 8 files pass — `07` 25/25, firewall still green. Total pgTAP: **121**.

- [ ] **Step 5: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add supabase/tests/07_classes_rls.sql supabase/migrations/*_classes.sql
git commit -m "feat: classes with teacher/subject/schedule links and teacher-scoped RLS"
```

---

### Task 4: Migration — students, guardians, enrollment (Bergen tests at wall 2)

The security heart of Phase 1: the registry itself. Two pgTAP files — `08` proves the students/guardians matrix (including fine-derived test #1: parent A never sees parent B's child), `09` proves enrollment visibility and the one-active-class invariant (including fine-derived #4: teacher of class X cannot read class Y's roster).

**Files:**
- Create: `supabase/tests/08_students_guardians_rls.sql`
- Create: `supabase/tests/09_enrollment_rls.sql`
- Create: `supabase/migrations/<ts>_students_guardians_enrollment.sql`

- [ ] **Step 1: Write the failing pgTAP file 08**

Create `supabase/tests/08_students_guardians_rls.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

-- Hermetic fixtures (seed independence): `supabase db reset` loads seed.sql —
-- which populates the school-core tables from Task 5 on — BEFORE `supabase
-- test db` runs. Clear those rows first (as postgres, inside this rolled-back
-- transaction) so the fixtures below are the only rows and the absolute-count
-- and single-current assertions stay independent of seed content. Restored on
-- rollback. FK-safe order: children before parents.
delete from public.class_students;
delete from public.class_schedule;
delete from public.class_subjects;
delete from public.class_teachers;
delete from public.guardian_student;
delete from public.students;
delete from public.classes;
delete from public.subjects;
delete from public.terms;

-- ── Setup (as postgres) ─────────────────────────────────────────────
-- Two families: parent A (children s1, s3), parent B (child s2, protected).
-- s1 is enrolled in class 1 (teacher 1) and has a student login.
-- s2 is enrolled in class 2 (teacher 2). s3 has stopped, no class.
-- One user has NO role at all (guardian-invariant probe).
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.email, '{"provider":"email","providers":["email"]}',
       jsonb_build_object('full_name', u.full_name), now(), now()
from (values
  ('a8000000-0000-0000-0000-000000000001'::uuid, 'pgtap-st-admin@test.local',    'ST Admin'),
  ('a8000000-0000-0000-0000-000000000002'::uuid, 'pgtap-st-laerer1@test.local',  'ST Lærer En'),
  ('a8000000-0000-0000-0000-000000000003'::uuid, 'pgtap-st-laerer2@test.local',  'ST Lærer To'),
  ('a8000000-0000-0000-0000-000000000004'::uuid, 'pgtap-st-forelderA@test.local','ST Forelder A'),
  ('a8000000-0000-0000-0000-000000000005'::uuid, 'pgtap-st-forelderB@test.local','ST Forelder B'),
  ('a8000000-0000-0000-0000-000000000006'::uuid, 'pgtap-st-elev@test.local',     'ST Elev'),
  ('a8000000-0000-0000-0000-000000000007'::uuid, 'pgtap-st-okonomi@test.local',  'ST Økonomi'),
  ('a8000000-0000-0000-0000-000000000008'::uuid, 'pgtap-st-ingen@test.local',    'ST Ingen Rolle')
) as u(id, email, full_name);
insert into public.user_roles (user_id, role) values
  ('a8000000-0000-0000-0000-000000000001', 'admin'),
  ('a8000000-0000-0000-0000-000000000002', 'teacher'),
  ('a8000000-0000-0000-0000-000000000003', 'teacher'),
  ('a8000000-0000-0000-0000-000000000004', 'parent'),
  ('a8000000-0000-0000-0000-000000000005', 'parent'),
  ('a8000000-0000-0000-0000-000000000006', 'student'),
  ('a8000000-0000-0000-0000-000000000007', 'economy');

insert into public.terms (id, name, starts_on, ends_on) values
  ('a8000000-0000-0000-0000-000000000011', 'A8 Termin', '2026-08-15', '2026-12-20');
insert into public.classes (id, term_id, name) values
  ('a8000000-0000-0000-0000-000000000021',
   'a8000000-0000-0000-0000-000000000011', 'A8 Klasse 1'),
  ('a8000000-0000-0000-0000-000000000022',
   'a8000000-0000-0000-0000-000000000011', 'A8 Klasse 2');
insert into public.class_teachers (class_id, teacher_id) values
  ('a8000000-0000-0000-0000-000000000021', 'a8000000-0000-0000-0000-000000000002'),
  ('a8000000-0000-0000-0000-000000000022', 'a8000000-0000-0000-0000-000000000003');

insert into public.students (id, first_name, last_name, birth_year, protected, status, student_user_id) values
  ('a8000000-0000-0000-0000-000000000031', 'Sara',  'A-Barn', 2014, false, 'active',
   'a8000000-0000-0000-0000-000000000006'),
  ('a8000000-0000-0000-0000-000000000032', 'Skjult','B-Barn', 2015, true,  'active', null),
  ('a8000000-0000-0000-0000-000000000033', 'Slutta','A-Barn', 2012, false, 'stopped', null);
insert into public.guardian_student (guardian_id, student_id, relationship, is_payer) values
  ('a8000000-0000-0000-0000-000000000004', 'a8000000-0000-0000-0000-000000000031', 'far', true),
  ('a8000000-0000-0000-0000-000000000004', 'a8000000-0000-0000-0000-000000000033', 'far', true),
  ('a8000000-0000-0000-0000-000000000005', 'a8000000-0000-0000-0000-000000000032', 'mor', true);
insert into public.class_students (class_id, student_id) values
  ('a8000000-0000-0000-0000-000000000021', 'a8000000-0000-0000-0000-000000000031'),
  ('a8000000-0000-0000-0000-000000000022', 'a8000000-0000-0000-0000-000000000032');

-- ── Schema shape + helpers ──────────────────────────────────────────
select has_table('public'::name, 'students'::name, 'students table exists');
select has_table('public'::name, 'guardian_student'::name, 'guardian_student table exists');
select ok((select relrowsecurity from pg_class
           where oid = 'public.students'::regclass), 'RLS enabled on students');
select ok((select relrowsecurity from pg_class
           where oid = 'public.guardian_student'::regclass), 'RLS enabled on guardian_student');
select has_function('private', 'is_guardian_of', array['uuid', 'uuid'],
  'private.is_guardian_of exists');
select has_function('private', 'teaches_student', array['uuid', 'uuid'],
  'private.teaches_student exists');
select has_function('private', 'guardian_in_class', array['uuid', 'uuid'],
  'private.guardian_in_class exists');
select has_function('private', 'student_in_class', array['uuid', 'uuid'],
  'private.student_in_class exists');
select has_function('private', 'is_linked_student', array['uuid', 'uuid'],
  'private.is_linked_student exists');

-- ── anon ────────────────────────────────────────────────────────────
set local role anon;
select throws_ok(
  $$ select count(*) from public.students $$, '42501', null,
  'anon is denied on students at the grant layer');
reset role;

-- ── Parent A: own children ONLY (Bergen fine, spec §6 test #1) ──────
select set_config('request.jwt.claims',
  '{"sub":"a8000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select id from public.students order by id $$,
  $$ values ('a8000000-0000-0000-0000-000000000031'::uuid),
            ('a8000000-0000-0000-0000-000000000033'::uuid) $$,
  'parent A sees exactly their own two children');
select is_empty(
  $$ select id from public.students
     where id = 'a8000000-0000-0000-0000-000000000032' $$,
  'BERGEN: parent A gets an empty result for parent B''s child, even by direct id');
select results_eq(
  $$ select student_id from public.guardian_student order by student_id $$,
  $$ values ('a8000000-0000-0000-0000-000000000031'::uuid),
            ('a8000000-0000-0000-0000-000000000033'::uuid) $$,
  'parent A sees only their own guardian links');
select lives_ok(
  $$ update public.students set first_name = 'Kapret'
     where id = 'a8000000-0000-0000-0000-000000000031' $$,
  'parent update against own child runs without matching any row (read-only)');
select throws_ok(
  $$ insert into public.students (first_name, last_name, birth_year)
     values ('Falsk', 'Elev', 2015) $$,
  '42501', null,
  'parent cannot insert students');
reset role;
select is(
  (select first_name from public.students
   where id = 'a8000000-0000-0000-0000-000000000031'),
  'Sara',
  'child row is unchanged after the parent write attempt');

-- ── Teachers: own enrolled students only ────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"a8000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select id from public.students $$,
  $$ values ('a8000000-0000-0000-0000-000000000031'::uuid) $$,
  'teacher 1 sees exactly the students enrolled in their class');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"a8000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select id from public.students $$,
  $$ values ('a8000000-0000-0000-0000-000000000032'::uuid) $$,
  'teacher 2 sees the protected student in their OWN roster (spec §3 golden rule)');
reset role;

-- ── Student login: self only ────────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"a8000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select id from public.students $$,
  $$ values ('a8000000-0000-0000-0000-000000000031'::uuid) $$,
  'a student login sees exactly its own student row');
reset role;

-- ── Economy: fully denied this phase (names+payer arrives in Phase 6) ─
select set_config('request.jwt.claims',
  '{"sub":"a8000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.students), 0::bigint,
  'economy sees zero students');
select is((select count(*) from public.guardian_student), 0::bigint,
  'economy sees zero guardian links');
reset role;

-- ── Admin: full registry + with_check invariants + audit triggers ──
select set_config('request.jwt.claims',
  '{"sub":"a8000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.students), 3::bigint,
  'admin sees every student');
select throws_ok(
  $$ insert into public.guardian_student (guardian_id, student_id)
     values ('a8000000-0000-0000-0000-000000000008',
             'a8000000-0000-0000-0000-000000000031') $$,
  '42501', null,
  'guardian links require the parent role (with check invariant)');
select throws_ok(
  $$ update public.students
     set student_user_id = 'a8000000-0000-0000-0000-000000000002'
     where id = 'a8000000-0000-0000-0000-000000000033' $$,
  '42501', null,
  'student_user_id must hold the student role (with check invariant)');
select lives_ok(
  $$ update public.students set first_name = 'Sara-Marie'
     where id = 'a8000000-0000-0000-0000-000000000031' $$,
  'admin updates a student through their own session');
select lives_ok(
  $$ delete from public.students
     where id = 'a8000000-0000-0000-0000-000000000033' $$,
  'admin deletes a student (cascades the guardian link)');
select lives_ok(
  $$ insert into public.students (first_name, last_name, birth_year)
     values ('Ny', 'Elev', 2016) $$,
  'admin registers a new student');
reset role;

-- Audit-trigger proofs (as postgres): actor pinned, changed-keys only,
-- updated_at noise filtered, delete + insert recorded.
select is(
  (select count(*) from public.audit_log
   where action = 'students.update'
     and actor_id = 'a8000000-0000-0000-0000-000000000001'
     and entity_id = 'a8000000-0000-0000-0000-000000000031'
     and (meta -> 'changed') ? 'first_name'
     and not ((meta -> 'changed') ? 'updated_at')),
  1::bigint,
  'students.update audit row: actor pinned, changed lists first_name, updated_at filtered');
select is(
  (select count(*) from public.audit_log
   where action = 'students.delete'
     and actor_id = 'a8000000-0000-0000-0000-000000000001'
     and entity_id = 'a8000000-0000-0000-0000-000000000033'),
  1::bigint,
  'students.delete audit row landed');
select is(
  (select count(*) from public.audit_log
   where action = 'guardian_student.delete'
     and entity_id = 'a8000000-0000-0000-0000-000000000033'
     and meta ->> 'guardian_id' = 'a8000000-0000-0000-0000-000000000004'),
  1::bigint,
  'cascaded guardian-link delete is audited with the guardian id in meta');
select is(
  (select count(*) from public.audit_log
   where action = 'students.insert'
     and actor_id = 'a8000000-0000-0000-0000-000000000001'),
  1::bigint,
  'students.insert audit row landed for the admin insert');

select * from finish();
rollback;
```

- [ ] **Step 2: Write the failing pgTAP file 09**

Create `supabase/tests/09_enrollment_rls.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- ── Setup (as postgres): two classes, two families ──────────────────
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.email, '{"provider":"email","providers":["email"]}',
       jsonb_build_object('full_name', u.full_name), now(), now()
from (values
  ('a9000000-0000-0000-0000-000000000001'::uuid, 'pgtap-en-admin@test.local',    'EN Admin'),
  ('a9000000-0000-0000-0000-000000000002'::uuid, 'pgtap-en-laerer1@test.local',  'EN Lærer En'),
  ('a9000000-0000-0000-0000-000000000003'::uuid, 'pgtap-en-laerer2@test.local',  'EN Lærer To'),
  ('a9000000-0000-0000-0000-000000000004'::uuid, 'pgtap-en-forelderA@test.local','EN Forelder A'),
  ('a9000000-0000-0000-0000-000000000005'::uuid, 'pgtap-en-forelderB@test.local','EN Forelder B'),
  ('a9000000-0000-0000-0000-000000000006'::uuid, 'pgtap-en-elev@test.local',     'EN Elev')
) as u(id, email, full_name);
insert into public.user_roles (user_id, role) values
  ('a9000000-0000-0000-0000-000000000001', 'admin'),
  ('a9000000-0000-0000-0000-000000000002', 'teacher'),
  ('a9000000-0000-0000-0000-000000000003', 'teacher'),
  ('a9000000-0000-0000-0000-000000000004', 'parent'),
  ('a9000000-0000-0000-0000-000000000005', 'parent'),
  ('a9000000-0000-0000-0000-000000000006', 'student');

insert into public.terms (id, name, starts_on, ends_on) values
  ('a9000000-0000-0000-0000-000000000011', 'A9 Termin', '2026-08-15', '2026-12-20');
insert into public.subjects (id, name, sort) values
  ('a9000000-0000-0000-0000-000000000041', 'A9 Fag', 1);
insert into public.classes (id, term_id, name) values
  ('a9000000-0000-0000-0000-000000000021',
   'a9000000-0000-0000-0000-000000000011', 'A9 Klasse 1'),
  ('a9000000-0000-0000-0000-000000000022',
   'a9000000-0000-0000-0000-000000000011', 'A9 Klasse 2');
insert into public.class_teachers (class_id, teacher_id) values
  ('a9000000-0000-0000-0000-000000000021', 'a9000000-0000-0000-0000-000000000002'),
  ('a9000000-0000-0000-0000-000000000022', 'a9000000-0000-0000-0000-000000000003');
insert into public.class_subjects (class_id, subject_id) values
  ('a9000000-0000-0000-0000-000000000021', 'a9000000-0000-0000-0000-000000000041'),
  ('a9000000-0000-0000-0000-000000000022', 'a9000000-0000-0000-0000-000000000041');
insert into public.class_schedule (class_id, weekday, starts_at, ends_at) values
  ('a9000000-0000-0000-0000-000000000021', 6, '10:00', '13:00'),
  ('a9000000-0000-0000-0000-000000000022', 7, '10:00', '13:00');
insert into public.students (id, first_name, last_name, birth_year, student_user_id) values
  ('a9000000-0000-0000-0000-000000000031', 'Aktiv', 'A-Barn', 2014,
   'a9000000-0000-0000-0000-000000000006'),
  ('a9000000-0000-0000-0000-000000000032', 'Rolig', 'B-Barn', 2015, null);
insert into public.guardian_student (guardian_id, student_id, relationship, is_payer) values
  ('a9000000-0000-0000-0000-000000000004', 'a9000000-0000-0000-0000-000000000031', 'far', true),
  ('a9000000-0000-0000-0000-000000000005', 'a9000000-0000-0000-0000-000000000032', 'mor', true);
insert into public.class_students (class_id, student_id, enrolled_on) values
  ('a9000000-0000-0000-0000-000000000021',
   'a9000000-0000-0000-0000-000000000031', '2026-08-20'),
  ('a9000000-0000-0000-0000-000000000022',
   'a9000000-0000-0000-0000-000000000032', '2026-08-20');

-- ── Invariants (as postgres) ────────────────────────────────────────
select throws_ok(
  $$ insert into public.class_students (class_id, student_id)
     values ('a9000000-0000-0000-0000-000000000022',
             'a9000000-0000-0000-0000-000000000031') $$,
  '23505', null,
  'ONE GROUP PER STUDENT: a second active enrollment is rejected (spec §2)');
select throws_ok(
  $$ update public.class_students set left_on = '2026-08-01'
     where student_id = 'a9000000-0000-0000-0000-000000000031' $$,
  '23514', null,
  'left_on before enrolled_on is rejected');

-- ── Parent A: enrollment-driven visibility ──────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"a9000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select student_id from public.class_students $$,
  $$ values ('a9000000-0000-0000-0000-000000000031'::uuid) $$,
  'parent A sees only their own child''s enrollment row');
select results_eq(
  $$ select id from public.classes $$,
  $$ values ('a9000000-0000-0000-0000-000000000021'::uuid) $$,
  'parent A sees the child''s class (guardian_in_class)');
select is((select count(*) from public.class_schedule), 1::bigint,
  'parent A sees the child''s class schedule only');
select is((select count(*) from public.class_subjects), 1::bigint,
  'parent A sees the child''s class subjects only');
select lives_ok(
  $$ update public.class_students set left_on = '2026-09-01'
     where student_id = 'a9000000-0000-0000-0000-000000000031' $$,
  'parent update against enrollment runs without matching any row');
reset role;
select is(
  (select count(*) from public.class_students where left_on is not null),
  0::bigint,
  'no enrollment gained a left_on from the parent attempt');

-- ── Student login: own class only ───────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"a9000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select id from public.classes $$,
  $$ values ('a9000000-0000-0000-0000-000000000021'::uuid) $$,
  'student login sees exactly their own class');
select is((select count(*) from public.class_schedule), 1::bigint,
  'student login sees their own schedule only');
reset role;

-- ── Teacher 1: own roster only (fine-derived #4) ────────────────────
select set_config('request.jwt.claims',
  '{"sub":"a9000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select student_id from public.class_students $$,
  $$ values ('a9000000-0000-0000-0000-000000000031'::uuid) $$,
  'teacher 1 sees only their own class''s enrollment rows');
select is_empty(
  $$ select student_id from public.class_students
     where class_id = 'a9000000-0000-0000-0000-000000000022' $$,
  'BERGEN/OSLO #4: teacher of class 1 cannot read class 2''s roster');
select throws_ok(
  $$ insert into public.class_students (class_id, student_id)
     values ('a9000000-0000-0000-0000-000000000021',
             'a9000000-0000-0000-0000-000000000032') $$,
  '42501', null,
  'teacher cannot enroll students');
reset role;

-- ── Admin: leave + move flow, audited ───────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"a9000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ update public.class_students set left_on = '2026-10-01'
     where class_id = 'a9000000-0000-0000-0000-000000000021'
       and student_id = 'a9000000-0000-0000-0000-000000000031' $$,
  'admin marks the student as having left class 1');
select lives_ok(
  $$ insert into public.class_students (class_id, student_id)
     values ('a9000000-0000-0000-0000-000000000022',
             'a9000000-0000-0000-0000-000000000031') $$,
  'admin re-enrolls the student in class 2 (one-active satisfied after leave)');
reset role;

-- Parent visibility follows ACTIVE enrollment: after the move, parent A sees
-- class 2, not class 1.
select set_config('request.jwt.claims',
  '{"sub":"a9000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select id from public.classes $$,
  $$ values ('a9000000-0000-0000-0000-000000000022'::uuid) $$,
  'after the move, parent A sees the NEW class only (left_on gates visibility)');
reset role;

select is(
  (select count(*) from public.audit_log
   where action = 'class_students.update'
     and actor_id = 'a9000000-0000-0000-0000-000000000001'
     and entity_id = 'a9000000-0000-0000-0000-000000000031'
     and (meta -> 'changed') ? 'left_on'
     and meta ->> 'class_id' = 'a9000000-0000-0000-0000-000000000021'),
  1::bigint,
  'the leave is audited with changed=[left_on] and the class id in meta');
select is(
  (select count(*) from public.audit_log
   where action = 'class_students.insert'
     and actor_id = 'a9000000-0000-0000-0000-000000000001'
     and meta ->> 'class_id' = 'a9000000-0000-0000-0000-000000000022'),
  1::bigint,
  'the re-enrollment is audited');

select * from finish();
rollback;
```

- [ ] **Step 3: Run pgTAP — expect 08 and 09 RED**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase test db 2>&1 | tail -12
```

Expected: `08` and `09` error with `relation "public.students" does not exist`; files 00–07 stay green.

- [ ] **Step 4: Create the migration**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase migration new students_guardians_enrollment
```

Write `supabase/migrations/<ts>_students_guardians_enrollment.sql`:

```sql
-- The registry: students, guardian links, enrollment (spec §4) — the tables
-- the Bergen fine is about. Authorization is role + relationship, enforced
-- here (wall 2) via SECURITY DEFINER helpers, and again in the DAL (wall 1).
-- protected ("skjermet") deliberately changes NO policy in this phase: every
-- Phase 1 read path is own-relationship or admin, all of which may see
-- protected students (own teacher's roster + admin + the child's own family,
-- spec §3). Its exclusions bind to exports (Phase 7) and the economy
-- names+payer path (Phase 6).

-- ── students ────────────────────────────────────────────────────────
create table public.students (
  id              uuid primary key default gen_random_uuid(),
  first_name      text not null check (char_length(first_name) between 1 and 60),
  last_name       text not null check (char_length(last_name) between 1 and 60),
  birth_year      smallint not null check (birth_year between 1900 and 2100),
  protected       boolean not null default false,
  status          text not null default 'active'
                  check (status in ('active', 'stopped')),
  student_user_id uuid references public.profiles (id) on delete set null,
  note            text check (note is null or char_length(note) <= 2000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint students_user_unique unique (student_user_id)
);
comment on table public.students is
  'The student registry. NOT an auth identity: student_user_id is set only when a login is enabled (optional, typically 13+), and deleting that login must never destroy the registry row (on delete set null — header gotcha 10).';
comment on column public.students.protected is
  '"Skjermet": excluded from every export and every surface beyond own teacher''s roster + admin (spec §3). Enforced by the consumers that arrive with those features — no Phase 1 read path crosses families.';
comment on column public.students.note is
  'Minimal by policy (spec §4): practical notes only, never health/religious/sensitive detail.';

create trigger students_set_updated_at
  before update on public.students
  for each row execute function private.set_updated_at();

-- ── guardian_student ────────────────────────────────────────────────
create table public.guardian_student (
  guardian_id  uuid not null references public.profiles (id) on delete cascade,
  student_id   uuid not null references public.students (id) on delete cascade,
  relationship text not null default 'foresatt'
               check (relationship in ('mor', 'far', 'foresatt')),
  is_payer     boolean not null default false,
  created_at   timestamptz not null default now(),
  primary key (guardian_id, student_id)
);
comment on table public.guardian_student is
  'Family relationship rows. Cascade from both sides: erasing a guardian account removes the link (never the student); deleting a student removes their links.';

-- ── class_students (enrollment) ─────────────────────────────────────
create table public.class_students (
  class_id    uuid not null references public.classes (id) on delete cascade,
  student_id  uuid not null references public.students (id) on delete cascade,
  enrolled_on date not null default (now() at time zone 'Europe/Oslo')::date,
  left_on     date,
  created_at  timestamptz not null default now(),
  primary key (class_id, student_id),
  constraint class_students_leave_after_enroll
    check (left_on is null or left_on >= enrolled_on)
);
comment on table public.class_students is
  'Enrollment. left_on null = active. Moving a student = set left_on on the old row, insert the new one (class_students_one_active forbids two active rows). Term rollover (stamping left_on en masse) is a later-phase flow.';

-- ONE GROUP PER STUDENT (spec §2): at most one ACTIVE enrollment.
create unique index class_students_one_active
  on public.class_students (student_id) where left_on is null;

-- ── Relationship helpers (header gotcha 11) ─────────────────────────
create or replace function private.is_guardian_of(uid uuid, sid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.guardian_student
    where guardian_id = uid and student_id = sid
  );
$$;

create or replace function private.teaches_student(uid uuid, sid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.class_students cs
    join public.class_teachers ct on ct.class_id = cs.class_id
    where cs.student_id = sid and ct.teacher_id = uid and cs.left_on is null
  );
$$;

create or replace function private.is_linked_student(uid uuid, sid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.students
    where id = sid and student_user_id = uid
  );
$$;

create or replace function private.guardian_in_class(uid uuid, cid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.class_students cs
    join public.guardian_student gs on gs.student_id = cs.student_id
    where cs.class_id = cid and gs.guardian_id = uid and cs.left_on is null
  );
$$;

create or replace function private.student_in_class(uid uuid, cid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.class_students cs
    join public.students s on s.id = cs.student_id
    where cs.class_id = cid and s.student_user_id = uid and cs.left_on is null
  );
$$;

revoke execute on function
  private.is_guardian_of(uuid, uuid),
  private.teaches_student(uuid, uuid),
  private.is_linked_student(uuid, uuid),
  private.guardian_in_class(uuid, uuid),
  private.student_in_class(uuid, uuid)
from public;
grant execute on function
  private.is_guardian_of(uuid, uuid),
  private.teaches_student(uuid, uuid),
  private.is_linked_student(uuid, uuid),
  private.guardian_in_class(uuid, uuid),
  private.student_in_class(uuid, uuid)
to authenticated;

-- ── Audit triggers (spec §6: triggers on writes to student records) ─
-- Generic row-change audit. tg_argv[0] = the column whose value becomes
-- entity_id; tg_argv[1..] = extra key columns copied into meta (composite-PK
-- tables). meta stores REFERENCES (ids) and changed column NAMES — never
-- column values, so no PII beyond ids enters the audit log.
create or replace function private.audit_row_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_row     jsonb := to_jsonb(coalesce(new, old));
  v_meta    jsonb := '{}'::jsonb;
  v_changed jsonb;
  i         int;
begin
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_agg(n.key order by n.key), '[]'::jsonb)
      into v_changed
      from jsonb_each(to_jsonb(new)) n
      where n.key <> 'updated_at'
        and to_jsonb(old) -> n.key is distinct from n.value;
    v_meta := jsonb_build_object('changed', v_changed);
  end if;
  for i in 1 .. tg_nargs - 1 loop
    v_meta := v_meta || jsonb_build_object(tg_argv[i], v_row ->> tg_argv[i]);
  end loop;
  perform private.audit(
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    v_row ->> tg_argv[0],
    v_meta
  );
  return coalesce(new, old);
end;
$$;
revoke execute on function private.audit_row_change() from public;

create trigger students_audit
  after insert or update or delete on public.students
  for each row execute function private.audit_row_change('id');
create trigger guardian_student_audit
  after insert or update or delete on public.guardian_student
  for each row execute function private.audit_row_change('student_id', 'guardian_id');
create trigger class_students_audit
  after insert or update or delete on public.class_students
  for each row execute function private.audit_row_change('student_id', 'class_id');

-- ── Grant layer (wall 2a, header gotcha 9) ──────────────────────────
revoke all on table public.students         from anon, authenticated, service_role;
revoke all on table public.guardian_student from anon, authenticated, service_role;
revoke all on table public.class_students   from anon, authenticated, service_role;
grant select, insert, update, delete on public.students         to authenticated;
grant select, insert, update, delete on public.guardian_student to authenticated;
grant select, insert, update, delete on public.class_students   to authenticated;
grant select, insert, update, delete on public.students         to service_role;
grant select, insert, update, delete on public.guardian_student to service_role;
grant select, insert, update, delete on public.class_students   to service_role;

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.students         enable row level security;
alter table public.guardian_student enable row level security;
alter table public.class_students   enable row level security;

-- students: admin everything; teacher = actively-enrolled students of their
-- classes; parent = own children; student login = own row. Economy: NO
-- policy — fully denied until the Phase 6 names+payer path.
create policy "students_select_related"
  on public.students for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_student((select auth.uid()), id)
    or private.is_guardian_of((select auth.uid()), id)
    or student_user_id = (select auth.uid())
  );
create policy "students_admin_insert"
  on public.students for insert to authenticated
  with check (
    private.has_role((select auth.uid()), 'admin')
    and (student_user_id is null
         or private.has_role(student_user_id, 'student'))
  );
create policy "students_admin_update"
  on public.students for update to authenticated
  using (private.has_role((select auth.uid()), 'admin'))
  with check (
    private.has_role((select auth.uid()), 'admin')
    and (student_user_id is null
         or private.has_role(student_user_id, 'student'))
  );
create policy "students_admin_delete"
  on public.students for delete to authenticated
  using (private.has_role((select auth.uid()), 'admin'));

-- guardian_student: a guardian reads their own links; admin manages all;
-- linked users must actually hold the parent role (with check invariant).
create policy "guardian_student_select_own_or_admin"
  on public.guardian_student for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or guardian_id = (select auth.uid())
  );
create policy "guardian_student_admin_insert"
  on public.guardian_student for insert to authenticated
  with check (
    private.has_role((select auth.uid()), 'admin')
    and private.has_role(guardian_id, 'parent')
  );
create policy "guardian_student_admin_update"
  on public.guardian_student for update to authenticated
  using (private.has_role((select auth.uid()), 'admin'))
  with check (
    private.has_role((select auth.uid()), 'admin')
    and private.has_role(guardian_id, 'parent')
  );
create policy "guardian_student_admin_delete"
  on public.guardian_student for delete to authenticated
  using (private.has_role((select auth.uid()), 'admin'));

-- class_students: admin all; teacher = rows of classes they teach; parent =
-- rows of own children; student login = own rows. Writes admin-only.
create policy "class_students_select_related"
  on public.class_students for select to authenticated
  using (
    private.has_role((select auth.uid()), 'admin')
    or private.teaches_class((select auth.uid()), class_id)
    or private.is_guardian_of((select auth.uid()), student_id)
    or private.is_linked_student((select auth.uid()), student_id)
  );
create policy "class_students_admin_insert"
  on public.class_students for insert to authenticated
  with check (private.has_role((select auth.uid()), 'admin'));
create policy "class_students_admin_update"
  on public.class_students for update to authenticated
  using (private.has_role((select auth.uid()), 'admin'))
  with check (private.has_role((select auth.uid()), 'admin'));
create policy "class_students_admin_delete"
  on public.class_students for delete to authenticated
  using (private.has_role((select auth.uid()), 'admin'));

-- ── Enrollment-driven visibility on the structure tables ────────────
-- Policies are permissive (OR-ed): these ADD parent/student visibility to
-- the admin/teacher policies from the classes migration.
create policy "classes_select_guardian"
  on public.classes for select to authenticated
  using (private.guardian_in_class((select auth.uid()), id));
create policy "classes_select_student"
  on public.classes for select to authenticated
  using (private.student_in_class((select auth.uid()), id));
create policy "class_subjects_select_guardian"
  on public.class_subjects for select to authenticated
  using (private.guardian_in_class((select auth.uid()), class_id));
create policy "class_subjects_select_student"
  on public.class_subjects for select to authenticated
  using (private.student_in_class((select auth.uid()), class_id));
create policy "class_schedule_select_guardian"
  on public.class_schedule for select to authenticated
  using (private.guardian_in_class((select auth.uid()), class_id));
create policy "class_schedule_select_student"
  on public.class_schedule for select to authenticated
  using (private.student_in_class((select auth.uid()), class_id));
```

- [ ] **Step 5: Apply and verify GREEN**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase db reset 2>&1 | tail -5
supabase test db 2>&1 | tail -14
```

Expected: all 10 files pass — `08` 31/31, `09` 18/18, grant firewall still green (it now also sweeps the three new tables). Total pgTAP: **170**.

- [ ] **Step 6: Full local gate + commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm test -- --run 2>&1 | tail -3
git add supabase/tests/08_students_guardians_rls.sql supabase/tests/09_enrollment_rls.sql supabase/migrations/*_students_guardians_enrollment.sql
git commit -m "feat: students, guardians and enrollment with relationship RLS and audit triggers"
```

Expected: typecheck/Vitest untouched and green (no app code changed yet).

---

### Task 5: Seeds, regenerated types, and the grown denial matrix

Extends the local fixture world: a second parent (for the cross-family denial tests), a full school structure, and five students. Then regenerates `database.types.ts` and grows `DENIED_CELLS` (23 → 27) plus the `SeedEmail` union.

> **Dependency (resolved plan gap):** this seed is the first to populate the school-core tables that pgTAP files `06`/`07`/`08` count against, and `supabase db reset` loads it BEFORE `supabase test db` runs. Those three files therefore carry a hermetic delete-preamble (added to their Task 2/3/4 blocks above) that clears the seed rows inside their rolled-back transaction, so their absolute-count and single-current assertions stay seed-independent. If executing Tasks 2–4 fresh, that preamble is already in their blocks; nothing extra is needed here. `09` needs no preamble (its assertions are relationship-id-scoped, so the seed's different families are invisible to its fixture users).

**Files:**
- Modify: `supabase/seed.sql`
- Modify: `src/lib/supabase/database.types.ts` (generated — never hand-edited)
- Modify: `tests/api/harness.ts` (SeedEmail union)
- Modify: `tests/api/access-wall.test.ts` (DENIED_CELLS)

- [ ] **Step 1: Extend the seed header comment**

In `supabase/seed.sql`, replace the two header lines:

```
-- UUID prefixes 1-6 are reserved for seed users; pgTAP tests use
-- a/b/c prefixes (supabase/tests/*.sql) — never overlap them.
-- Six test users, password for all: test-passord-123
```

with:

```
-- UUID prefixes 1-7 are reserved for seed users; school data uses
-- f1 (terms), fa (subjects), fc (classes), fe (students); pgTAP tests
-- use per-file a5/a6/a7/a8/a9/ad prefixes — never overlap them.
-- Seven test users, password for all: test-passord-123
```

and add below the `laererforelder@test.local` line in the user list comment:

```
--   forelder2@test.local       parent (second family — denial tests)
```

- [ ] **Step 2: Add the seventh user**

In the `insert into auth.users ... from (values ...)` block, add after the `laererforelder` row (watch the comma on the previous line):

```sql
  ('77777777-7777-7777-7777-777777777777'::uuid, 'forelder2@test.local',      'Fatima Yusuf')
```

In the `insert into public.user_roles` block, add:

```sql
  ('77777777-7777-7777-7777-777777777777', 'parent');
```

(The `auth.identities` insert selects every `@test.local` user — the new user is covered automatically; the domain filter comment stays true.)

- [ ] **Step 3: Append the school-core seed data**

Append at the end of `supabase/seed.sql`:

```sql
-- ═══════════════════════════════════════════════════════════════════
-- Phase 1 school core. Relationships are chosen to exercise every RLS
-- path: two classes with different teachers; the dual-role user teaches
-- Klasse 3 while her own child sits in Klasse 1 (teacher-hat vs
-- parent-hat must not blend); family 1 has children in BOTH classes;
-- family 2 holds the protected student and a stopped, unenrolled one.
-- Seed inserts fire the audit triggers with actor_id null — expected.
-- ═══════════════════════════════════════════════════════════════════
insert into public.terms (id, name, starts_on, ends_on, is_current) values
  ('f1000000-0000-0000-0000-000000000001', 'Høst 2026', '2026-08-15', '2026-12-20', true);

insert into public.subjects (id, name, quran_tracking, sort) values
  ('fa000000-0000-0000-0000-000000000001', 'Arabisk',       false, 1),
  ('fa000000-0000-0000-0000-000000000002', 'Koran',         true,  2),
  ('fa000000-0000-0000-0000-000000000003', 'Islamkunnskap', false, 3);

insert into public.classes (id, term_id, name, room) values
  ('fc000000-0000-0000-0000-000000000001',
   'f1000000-0000-0000-0000-000000000001', 'Klasse 1', 'Rom 2'),
  ('fc000000-0000-0000-0000-000000000002',
   'f1000000-0000-0000-0000-000000000001', 'Klasse 3', null);

insert into public.class_teachers (class_id, teacher_id) values
  ('fc000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222'), -- laerer@
  ('fc000000-0000-0000-0000-000000000002', '66666666-6666-6666-6666-666666666666'); -- laererforelder@

insert into public.class_subjects (class_id, subject_id) values
  ('fc000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000001'),
  ('fc000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000002'),
  ('fc000000-0000-0000-0000-000000000002', 'fa000000-0000-0000-0000-000000000001'),
  ('fc000000-0000-0000-0000-000000000002', 'fa000000-0000-0000-0000-000000000002'),
  ('fc000000-0000-0000-0000-000000000002', 'fa000000-0000-0000-0000-000000000003');

insert into public.class_schedule (class_id, weekday, starts_at, ends_at) values
  ('fc000000-0000-0000-0000-000000000001', 6, '10:00', '13:00'), -- lørdag
  ('fc000000-0000-0000-0000-000000000002', 7, '10:00', '13:00'); -- søndag

-- Students. fe…01 Yusuf: forelder@'s child, HAS the elev@ login, Klasse 1.
-- fe…02 Amira: forelder@'s second child, Klasse 3 (parent spans classes).
-- fe…03 Bilal: laererforelder@'s child, Klasse 1 (NOT her own class).
-- fe…04 Zaynab: forelder2@'s child, PROTECTED, Klasse 3.
-- fe…05 Idris: forelder2@'s child, STOPPED, no class.
insert into public.students
  (id, first_name, last_name, birth_year, protected, status, student_user_id) values
  ('fe000000-0000-0000-0000-000000000001', 'Yusuf',  'Farah', 2013, false, 'active',
   '44444444-4444-4444-4444-444444444444'),
  ('fe000000-0000-0000-0000-000000000002', 'Amira',  'Farah', 2016, false, 'active', null),
  ('fe000000-0000-0000-0000-000000000003', 'Bilal',  'Omar',  2014, false, 'active', null),
  ('fe000000-0000-0000-0000-000000000004', 'Zaynab', 'Ali',   2015, true,  'active', null),
  ('fe000000-0000-0000-0000-000000000005', 'Idris',  'Ali',   2011, false, 'stopped', null);

insert into public.guardian_student (guardian_id, student_id, relationship, is_payer) values
  ('33333333-3333-3333-3333-333333333333', 'fe000000-0000-0000-0000-000000000001', 'far', true),
  ('33333333-3333-3333-3333-333333333333', 'fe000000-0000-0000-0000-000000000002', 'far', true),
  ('66666666-6666-6666-6666-666666666666', 'fe000000-0000-0000-0000-000000000003', 'mor', true),
  ('77777777-7777-7777-7777-777777777777', 'fe000000-0000-0000-0000-000000000004', 'mor', true),
  ('77777777-7777-7777-7777-777777777777', 'fe000000-0000-0000-0000-000000000005', 'mor', true);

insert into public.class_students (class_id, student_id, enrolled_on) values
  ('fc000000-0000-0000-0000-000000000001',
   'fe000000-0000-0000-0000-000000000001', '2026-08-20'),
  ('fc000000-0000-0000-0000-000000000002',
   'fe000000-0000-0000-0000-000000000002', '2026-08-20'),
  ('fc000000-0000-0000-0000-000000000001',
   'fe000000-0000-0000-0000-000000000003', '2026-08-20'),
  ('fc000000-0000-0000-0000-000000000002',
   'fe000000-0000-0000-0000-000000000004', '2026-08-21');
```

- [ ] **Step 4: Reset and regenerate types**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase db reset 2>&1 | tail -5
npm run db:types
npm run typecheck
```

Expected: reset seeds cleanly (`Seeding data ...`); `database.types.ts` now contains `terms`, `subjects`, `classes`, `class_teachers`, `class_subjects`, `class_schedule`, `students`, `guardian_student`, `class_students`; typecheck stays silent.

- [ ] **Step 5: Grow the harness and the denial matrix**

In `tests/api/harness.ts`, extend the union:

```ts
export type SeedEmail =
  | 'admin@test.local'
  | 'laerer@test.local'
  | 'forelder@test.local'
  | 'forelder2@test.local'
  | 'elev@test.local'
  | 'okonomi@test.local'
  | 'laererforelder@test.local';
```

In `tests/api/access-wall.test.ts`, update the matrix comment and add the four new cells after the `forelder@test.local` block:

```ts
  // The full denied-cell matrix for the Task 6 seed users: 7 users x 5
  // portal roles minus the 8 held roles = 27 forbidden cells. Every later
  // phase that adds a role or a seed user extends this table.
```

```ts
    ['forelder2@test.local', 'admin'],
    ['forelder2@test.local', 'teacher'],
    ['forelder2@test.local', 'student'],
    ['forelder2@test.local', 'economy'],
```

- [ ] **Step 6: Run every suite, then commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase test db 2>&1 | tail -14
npm test -- --run 2>&1 | tail -3
npm run test:api 2>&1 | tail -4
git add supabase/seed.sql src/lib/supabase/database.types.ts tests/api/harness.ts tests/api/access-wall.test.ts
git commit -m "feat: seed school core fixtures, second family, regenerated db types"
```

Expected: 170 pgTAP; 75 Vitest; **36** test:api (32 + 4 new denied cells). If `test:api` fails on login for `forelder2@test.local`, the identities insert didn't cover the new user — re-check Step 2.

---

### Task 6: `requireStaffRole` + structure DAL (terms, subjects, classes, users)

Wall 1 for the structure tables, plus the new staff guard: `requireRole` + an AAL2 assertion on the caller's own session. The proxy already gates staff routes, but ledger #9/#13(a) recorded that a future route ending in an excluded extension would skip the UI gate — after this task, staff data access through the DAL re-checks assurance itself, so that gap stops mattering for data.

**Files:**
- Modify: `src/lib/dal/session.ts` (add `requireStaffRole`)
- Modify: `src/app/(portal)/admin/layout.tsx`, `src/app/(portal)/laerer/layout.tsx`, `src/app/(portal)/okonomi/layout.tsx` (swap the guard)
- Create: `src/lib/dal/terms.ts`, `src/lib/dal/subjects.ts`, `src/lib/dal/classes.ts`, `src/lib/dal/users.ts`
- Create: `tests/api/school-core.test.ts`

- [ ] **Step 1: Write the failing API tests**

Create `tests/api/school-core.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Same mock preamble as access-wall.test.ts — vi.mock factories are hoisted
// and cannot be shared across files, so the three blocks are repeated.
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

import { requireStaffRole } from '@/lib/dal/session';
import { getCurrentTerm, listTerms } from '@/lib/dal/terms';
import { listSubjects } from '@/lib/dal/subjects';
import {
  getClassForAdmin,
  listClassesForAdmin,
  listMyTeachingClasses,
} from '@/lib/dal/classes';
import { listUsersWithRole } from '@/lib/dal/users';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getPublicEnv } from '@/lib/env';
import { signInAs, signInAsAAL2, signOut } from './harness';

// Test-scaffolding service client (same sanction as the harness's AAL2
// factor cleanup): sets up the admin+teacher dual-role case that no seed
// user covers, then tears it down. Never the code under test.
function scaffoldingServiceClient() {
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

describe('wall 1: requireStaffRole demands AAL2 for staff data (ledger #13a)', () => {
  it('sends a password-only (AAL1) admin to MFA enrollment', async () => {
    signInAs('admin@test.local');
    await expect(requireStaffRole('admin')).rejects.toThrow(
      'NEXT_REDIRECT:/mfa/registrer',
    );
  });

  it('admits a 2FA-verified economy user to the economy surface', async () => {
    await signInAsAAL2('okonomi@test.local');
    const { roles } = await requireStaffRole('economy');
    expect(roles).toContain('economy');
  });

  it('refuses to be used for non-staff roles (misuse guard)', async () => {
    signInAs('forelder@test.local');
    await expect(requireStaffRole('parent')).rejects.toThrow(
      'requireStaffRole gjelder bare stabsroller',
    );
  });
});

describe('wall 1: structure reads', () => {
  it('returns the current term to any logged-in user', async () => {
    signInAs('forelder@test.local');
    const term = await getCurrentTerm();
    expect(term?.name).toBe('Høst 2026');
    expect(term?.is_current).toBe(true);
  });

  it('lists terms for a 2FA-verified admin', async () => {
    await signInAsAAL2('admin@test.local');
    const terms = await listTerms();
    expect(terms.map((t) => t.name)).toContain('Høst 2026');
  });

  it('lists subjects in sort order for a teacher', async () => {
    await signInAsAAL2('laerer@test.local');
    const subjects = await listSubjects();
    expect(subjects.map((s) => s.name)).toEqual([
      'Arabisk',
      'Koran',
      'Islamkunnskap',
    ]);
  });

  it('returns ZERO subjects to economy (no pedagogy surface, spec §3)', async () => {
    signInAs('okonomi@test.local');
    await expect(listSubjects()).resolves.toEqual([]);
  });
});

describe('wall 1: teaching classes are relationship-scoped', () => {
  it('gives the teacher exactly their own class with schedule and count', async () => {
    await signInAsAAL2('laerer@test.local');
    const classes = await listMyTeachingClasses();
    expect(classes).toHaveLength(1);
    expect(classes[0].name).toBe('Klasse 1');
    expect(classes[0].term_name).toBe('Høst 2026');
    expect(classes[0].active_count).toBe(2);
    expect(classes[0].schedule).toEqual([
      { weekday: 6, starts_at: '10:00:00', ends_at: '13:00:00' },
    ]);
  });

  it('gives the dual-role user only the class she TEACHES', async () => {
    await signInAsAAL2('laererforelder@test.local');
    const classes = await listMyTeachingClasses();
    expect(classes.map((c) => c.name)).toEqual(['Klasse 3']);
    expect(classes[0].active_count).toBe(2);
  });

  it('turns a parent away from the teaching-classes read', async () => {
    signInAs('forelder@test.local');
    await expect(listMyTeachingClasses()).rejects.toThrow(
      'NEXT_REDIRECT:/ingen-tilgang',
    );
  });

  it('sends an AAL1 teacher to MFA before any data', async () => {
    signInAs('laerer@test.local');
    await expect(listMyTeachingClasses()).rejects.toThrow(
      'NEXT_REDIRECT:/mfa/registrer',
    );
  });

  // The `.eq('teacher_id', user.id)` in listMyTeachingClasses is load-bearing
  // ONLY for a caller who is BOTH admin and teacher: RLS
  // (class_teachers_select_admin_or_own_class = has_role(admin) OR
  // teaches_class) already scopes a pure teacher, but lets a dual-role admin
  // read every class's teacher rows — so without the .eq that user's "my
  // classes" would over-return every class. No seed user holds both roles, so
  // this grants admin@ the teacher role + one class link, verifies the scope,
  // and tears it down. (Same-file, so it never races listUsersWithRole above.)
  it('scopes a dual-role admin+teacher to only the class they teach (.eq guard)', async () => {
    const ADMIN_ID = '11111111-1111-1111-1111-111111111111';
    const KLASSE1 = 'fc000000-0000-0000-0000-000000000001';
    const service = scaffoldingServiceClient();
    await service.from('user_roles').insert({ user_id: ADMIN_ID, role: 'teacher' });
    await service
      .from('class_teachers')
      .insert({ class_id: KLASSE1, teacher_id: ADMIN_ID });
    try {
      await signInAsAAL2('admin@test.local');
      const classes = await listMyTeachingClasses();
      // Without the .eq this is ['Klasse 1','Klasse 1','Klasse 3'] (every
      // class_teachers row visible to admin); the strong toEqual catches both
      // the over-return and the duplicate.
      expect(classes.map((c) => c.name)).toEqual(['Klasse 1']);
    } finally {
      await service
        .from('class_teachers')
        .delete()
        .eq('class_id', KLASSE1)
        .eq('teacher_id', ADMIN_ID);
      await service
        .from('user_roles')
        .delete()
        .eq('user_id', ADMIN_ID)
        .eq('role', 'teacher');
    }
  });
});

describe('wall 1: admin class management reads', () => {
  it('lists every class with term, teachers and active counts', async () => {
    await signInAsAAL2('admin@test.local');
    const classes = await listClassesForAdmin();
    expect(classes).toHaveLength(2);
    const k1 = classes.find((c) => c.name === 'Klasse 1');
    expect(k1?.teacher_names).toEqual(['Leila Ahmed']);
    expect(k1?.active_count).toBe(2);
    expect(k1?.term_is_current).toBe(true);
  });

  it('composes the class detail: teachers, subjects, schedule, roster', async () => {
    await signInAsAAL2('admin@test.local');
    const overview = await listClassesForAdmin();
    const k1Id = overview.find((c) => c.name === 'Klasse 1')!.id;
    const detail = await getClassForAdmin(k1Id);
    expect(detail?.teachers.map((t) => t.full_name)).toEqual(['Leila Ahmed']);
    expect(detail?.subject_ids).toHaveLength(2);
    expect(detail?.schedule).toHaveLength(1);
    expect(detail?.active_roster.map((r) => r.first_name)).toEqual([
      'Yusuf',
      'Bilal',
    ]);
    expect(detail?.former_roster).toEqual([]);
  });

  it('answers null for a malformed or unknown class id', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(getClassForAdmin('ikke-en-uuid')).resolves.toBeNull();
    await expect(
      getClassForAdmin('00000000-0000-0000-0000-00000000dead'),
    ).resolves.toBeNull();
  });

  it('lists teacher-role users for the class form, sorted by name', async () => {
    await signInAsAAL2('admin@test.local');
    const teachers = await listUsersWithRole('teacher');
    expect(teachers.map((t) => t.full_name)).toEqual([
      'Leila Ahmed',
      'Sara Omar',
    ]);
  });
});
```

- [ ] **Step 2: Run — expect import failures (modules missing)**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run test:api 2>&1 | tail -6
```

Expected: `school-core.test.ts` fails to resolve `@/lib/dal/terms` (and friends), plus `requireStaffRole` is not exported. The 36 existing tests stay green.

- [ ] **Step 3: Add `requireStaffRole` to the session DAL**

In `src/lib/dal/session.ts`: extend the access import and add the guard after `requireRole`:

```ts
import { isRole, isStaffRole, mfaGate, type Role } from '@/lib/auth/access';
```

```ts
/**
 * Wall-1 guard for STAFF surfaces (admin/teacher/economy): requireRole PLUS
 * an AAL2 assertion on the caller's own session (spec §6). The proxy gates
 * staff routes too, but this module must not depend on the proxy having
 * run (ledger #9/#13a: a route ending in an excluded extension skips the
 * UI gate) — staff DATA is therefore re-gated here, at wall 1.
 */
export async function requireStaffRole(
  role: Role,
): Promise<{ user: User; roles: Role[] }> {
  if (!isStaffRole(role)) {
    throw new Error(
      `requireStaffRole gjelder bare stabsroller, fikk «${role}» — bruk requireRole.`,
    );
  }
  const result = await requireRole(role);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) {
    throw new Error(`Sikkerhetsnivå-kontroll feilet: ${error.message}`);
  }
  const gate = mfaGate({
    currentLevel: data?.currentLevel ?? null,
    nextLevel: data?.nextLevel ?? null,
  });
  if (gate === 'verify') redirect('/mfa/verifiser');
  if (gate === 'enroll') redirect('/mfa/registrer');
  return result;
}
```

- [ ] **Step 4: Swap the three STAFF layouts to the new guard**

In `src/app/(portal)/admin/layout.tsx`, `src/app/(portal)/laerer/layout.tsx` and `src/app/(portal)/okonomi/layout.tsx`, change the import and the call (`forelder`/`elev` layouts keep `requireRole`):

```ts
import { getOwnProfile, requireStaffRole } from '@/lib/dal/session';
// …
const { roles } = await requireStaffRole('admin');   // 'teacher' / 'economy' respectively
```

- [ ] **Step 5: Create the terms DAL**

Create `src/lib/dal/terms.ts`:

```ts
import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export interface Term {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  is_current: boolean;
}

/** The current term (≤1 by the terms_single_current index). Null = none. */
export const getCurrentTerm = cache(async (): Promise<Term | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('terms')
    .select('id, name, starts_on, ends_on, is_current')
    .eq('is_current', true)
    .maybeSingle();
  if (error) {
    throw new Error(`Kunne ikke lese nåværende termin: ${error.message}`);
  }
  return data;
});

export const listTerms = cache(async (): Promise<Term[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('terms')
    .select('id, name, starts_on, ends_on, is_current')
    .order('starts_on', { ascending: false });
  if (error) {
    throw new Error(`Kunne ikke lese terminer: ${error.message}`);
  }
  return data ?? [];
});
```

- [ ] **Step 6: Create the subjects DAL**

Create `src/lib/dal/subjects.ts`:

```ts
import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export interface Subject {
  id: string;
  name: string;
  quran_tracking: boolean;
  sort: number;
}

/** RLS scopes visibility (economy reads zero rows — no pedagogy surface). */
export const listSubjects = cache(async (): Promise<Subject[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('subjects')
    .select('id, name, quran_tracking, sort')
    .order('sort')
    .order('name');
  if (error) {
    throw new Error(`Kunne ikke lese fag: ${error.message}`);
  }
  return data ?? [];
});
```

- [ ] **Step 7: Create the classes DAL**

Create `src/lib/dal/classes.ts`:

```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { requireStaffRole } from './session';

export interface ScheduleSlot {
  weekday: number;
  starts_at: string;
  ends_at: string;
}

export interface TeachingClass {
  id: string;
  name: string;
  room: string | null;
  term_name: string;
  active_count: number;
  schedule: ScheduleSlot[];
}

const nbCollator = new Intl.Collator('nb');

/** Active-enrollment head-counts for a set of classes (left_on null). */
async function activeCounts(classIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (classIds.length === 0) return counts;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('class_students')
    .select('class_id')
    .in('class_id', classIds)
    .is('left_on', null);
  if (error) {
    throw new Error(`Kunne ikke telle elever i klasser: ${error.message}`);
  }
  for (const row of data ?? []) {
    counts.set(row.class_id, (counts.get(row.class_id) ?? 0) + 1);
  }
  return counts;
}

function sortSlots(slots: ScheduleSlot[]): ScheduleSlot[] {
  return [...slots].sort(
    (a, b) => a.weekday - b.weekday || a.starts_at.localeCompare(b.starts_at),
  );
}

/**
 * The classes the CALLER teaches. The explicit .eq on teacher_id is
 * load-bearing (the .eq discipline): RLS also lets admins read classes,
 * so a bare select would over-return for dual-role users.
 */
export async function listMyTeachingClasses(): Promise<TeachingClass[]> {
  const { user } = await requireStaffRole('teacher');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('class_teachers')
    .select(
      'classes(id, name, room, terms(name), class_schedule(weekday, starts_at, ends_at))',
    )
    .eq('teacher_id', user.id);
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

export interface AdminClassOverview {
  id: string;
  name: string;
  room: string | null;
  term_id: string;
  term_name: string;
  term_is_current: boolean;
  teacher_names: string[];
  active_count: number;
}

export async function listClassesForAdmin(): Promise<AdminClassOverview[]> {
  await requireStaffRole('admin');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('classes')
    .select(
      'id, name, room, term_id, terms(name, is_current), class_teachers(profiles(full_name))',
    );
  if (error) {
    throw new Error(`Kunne ikke lese klasser: ${error.message}`);
  }
  const counts = await activeCounts((data ?? []).map((c) => c.id));
  return (data ?? [])
    .map((c) => ({
      id: c.id,
      name: c.name,
      room: c.room,
      term_id: c.term_id,
      term_name: c.terms?.name ?? '',
      term_is_current: c.terms?.is_current ?? false,
      teacher_names: (c.class_teachers ?? [])
        .map((t) => t.profiles?.full_name ?? '')
        .filter(Boolean)
        .sort(nbCollator.compare),
      active_count: counts.get(c.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        Number(b.term_is_current) - Number(a.term_is_current) ||
        nbCollator.compare(a.name, b.name),
    );
}

export interface RosterRow {
  student_id: string;
  first_name: string;
  last_name: string;
  birth_year: number;
  protected: boolean;
  status: string;
  enrolled_on: string;
  left_on: string | null;
}

export interface AdminClassDetail {
  id: string;
  name: string;
  room: string | null;
  term_id: string;
  term_name: string;
  teachers: { user_id: string; full_name: string }[];
  subject_ids: string[];
  schedule: ScheduleSlot[];
  active_roster: RosterRow[];
  former_roster: RosterRow[];
}

export async function getClassForAdmin(
  classId: string,
): Promise<AdminClassDetail | null> {
  await requireStaffRole('admin');
  const supabase = await createClient();
  const { data: cls, error } = await supabase
    .from('classes')
    .select('id, name, room, term_id, terms(name)')
    .eq('id', classId)
    .maybeSingle();
  if (error) {
    // 22P02 = malformed uuid literal: treat as not-found, don't leak shape.
    if (error.code === '22P02') return null;
    throw new Error(`Kunne ikke lese klassen: ${error.message}`);
  }
  if (!cls) return null;

  const [teachersRes, subjectsRes, scheduleRes, rosterRes] = await Promise.all([
    supabase
      .from('class_teachers')
      .select('teacher_id, profiles(full_name)')
      .eq('class_id', classId),
    supabase.from('class_subjects').select('subject_id').eq('class_id', classId),
    supabase
      .from('class_schedule')
      .select('weekday, starts_at, ends_at')
      .eq('class_id', classId),
    supabase
      .from('class_students')
      .select(
        'enrolled_on, left_on, students(id, first_name, last_name, birth_year, protected, status)',
      )
      .eq('class_id', classId),
  ]);
  for (const res of [teachersRes, subjectsRes, scheduleRes, rosterRes]) {
    if (res.error) {
      throw new Error(`Kunne ikke lese klassedetaljer: ${res.error.message}`);
    }
  }

  const roster: RosterRow[] = (rosterRes.data ?? [])
    .filter((row) => row.students !== null)
    .map((row) => ({
      student_id: row.students!.id,
      first_name: row.students!.first_name,
      last_name: row.students!.last_name,
      birth_year: row.students!.birth_year,
      protected: row.students!.protected,
      status: row.students!.status,
      enrolled_on: row.enrolled_on,
      left_on: row.left_on,
    }))
    .sort(
      (a, b) =>
        nbCollator.compare(a.last_name, b.last_name) ||
        nbCollator.compare(a.first_name, b.first_name),
    );

  return {
    id: cls.id,
    name: cls.name,
    room: cls.room,
    term_id: cls.term_id,
    term_name: cls.terms?.name ?? '',
    teachers: (teachersRes.data ?? [])
      .map((t) => ({ user_id: t.teacher_id, full_name: t.profiles?.full_name ?? '' }))
      .sort((a, b) => nbCollator.compare(a.full_name, b.full_name)),
    subject_ids: (subjectsRes.data ?? []).map((s) => s.subject_id),
    schedule: sortSlots(scheduleRes.data ?? []),
    active_roster: roster.filter((r) => r.left_on === null),
    former_roster: roster.filter((r) => r.left_on !== null),
  };
}
```

- [ ] **Step 8: Create the users DAL**

Create `src/lib/dal/users.ts`:

```ts
import 'server-only';
import type { Role } from '@/lib/auth/access';
import { createClient } from '@/lib/supabase/server';
import { requireStaffRole } from './session';

export interface RoleUser {
  user_id: string;
  full_name: string;
}

const nbCollator = new Intl.Collator('nb');

/**
 * Admin-only: every user holding a role (class-teacher pickers etc.).
 * Two queries + client-side join, NOT a PostgREST embed: user_roles and
 * profiles have NO foreign key between them (both reference auth.users
 * independently), so `user_roles.select('...profiles(...)')` cannot resolve
 * ("Could not find a relationship"). Both reads run under the admin's RLS
 * (user_roles: admin sees all; profiles: admin sees all). Contrast with
 * classes.ts, whose embeds work because class_teachers.teacher_id and
 * guardian_student.guardian_id DO carry an FK to profiles(id).
 */
export async function listUsersWithRole(role: Role): Promise<RoleUser[]> {
  await requireStaffRole('admin');
  const supabase = await createClient();
  const { data: roleRows, error } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', role);
  if (error) {
    throw new Error(`Kunne ikke lese brukere med rolle ${role}: ${error.message}`);
  }
  const ids = (roleRows ?? []).map((row) => row.user_id);
  if (ids.length === 0) return [];
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', ids);
  if (profilesError) {
    throw new Error(`Kunne ikke lese navn for brukere: ${profilesError.message}`);
  }
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  return ids
    .map((id) => ({ user_id: id, full_name: nameById.get(id) ?? '' }))
    .sort((a, b) => nbCollator.compare(a.full_name, b.full_name));
}
```

- [ ] **Step 9: Verify GREEN, then commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run lint
npm run test:api 2>&1 | tail -4
npm test -- --run 2>&1 | tail -3
git add src/lib/dal/ 'src/app/(portal)/admin/layout.tsx' 'src/app/(portal)/laerer/layout.tsx' 'src/app/(portal)/okonomi/layout.tsx' tests/api/school-core.test.ts
git commit -m "feat: staff AAL2 wall-1 guard and structure DAL with relationship-scoped reads"
```

Expected: typecheck/lint clean; **52** test:api (36 + 16 new); 75 Vitest untouched. If the embedded `terms(name)`/`profiles(full_name)` selects type-error, re-run `npm run db:types` (Task 5 must have landed).

---

### Task 7: Students DAL — registry, children, rosters (Bergen tests at wall 1)

**Files:**
- Create: `src/lib/dal/students.ts`
- Modify: `tests/api/school-core.test.ts` (add the students describes)

- [ ] **Step 1: Write the failing API tests**

Append to `tests/api/school-core.test.ts` (inside the file, after the existing describes) — and add the new imports at the top:

```ts
import {
  getOwnStudentRecord,
  getRosterForTeacher,
  getStudentForAdmin,
  listChildrenForGuardian,
  listStudentsForAdmin,
  listStudentsWithoutActiveClass,
} from '@/lib/dal/students';
```

```ts
describe('wall 1: a parent sees exactly their own children (Bergen #1)', () => {
  it('lists both children with class and schedule', async () => {
    signInAs('forelder@test.local');
    const children = await listChildrenForGuardian();
    expect(children.map((c) => c.first_name)).toEqual(['Amira', 'Yusuf']);
    const amira = children[0];
    expect(amira.class_name).toBe('Klasse 3');
    expect(amira.schedule).toEqual([
      { weekday: 7, starts_at: '10:00:00', ends_at: '13:00:00' },
    ]);
    const yusuf = children[1];
    expect(yusuf.class_name).toBe('Klasse 1');
  });

  it("never returns another family's student ids", async () => {
    signInAs('forelder@test.local');
    const children = await listChildrenForGuardian();
    const foreign = [
      'fe000000-0000-0000-0000-000000000003',
      'fe000000-0000-0000-0000-000000000004',
      'fe000000-0000-0000-0000-000000000005',
    ];
    expect(
      children.filter((c) => foreign.includes(c.student_id)),
    ).toEqual([]);
  });

  it('shows family 2 their protected and stopped children (own family always sees own)', async () => {
    signInAs('forelder2@test.local');
    const children = await listChildrenForGuardian();
    expect(children.map((c) => c.first_name)).toEqual(['Idris', 'Zaynab']);
    expect(children[0].class_name).toBeNull();
    expect(children[0].status).toBe('stopped');
    expect(children[1].class_name).toBe('Klasse 3');
  });

  // The `.eq('guardian_id', user.id)` in listChildrenForGuardian is
  // load-bearing ONLY for a caller who is BOTH admin and parent: RLS
  // (guardian_student_select_own_or_admin = has_role(admin) OR guardian_id =
  // uid) already scopes a pure parent to their own links, but lets a dual-role
  // admin read EVERY family's links — so without the .eq that user's "my
  // children" would over-return all five children. No seed user holds both
  // roles; grant an existing PARENT the admin role (not the reverse — a
  // service_role insert into guardian_student trips its audit trigger, which
  // service_role can't reach). AAL1 suffices (requireRole('parent'), not staff).
  it('scopes a dual-role admin+parent to only their OWN children (.eq guard)', async () => {
    const FORELDER_ID = '33333333-3333-3333-3333-333333333333';
    const service = scaffoldingServiceClient();
    await service.from('user_roles').insert({ user_id: FORELDER_ID, role: 'admin' });
    try {
      signInAs('forelder@test.local');
      const children = await listChildrenForGuardian();
      // Without the .eq, RLS lets the admin read every family's links → all 5
      // children over-return; the strong toEqual catches it.
      expect(children.map((c) => c.first_name)).toEqual(['Amira', 'Yusuf']);
    } finally {
      await service
        .from('user_roles')
        .delete()
        .eq('user_id', FORELDER_ID)
        .eq('role', 'admin');
    }
  });

  it('turns a teacher without the parent role away', async () => {
    await signInAsAAL2('laerer@test.local');
    await expect(listChildrenForGuardian()).rejects.toThrow(
      'NEXT_REDIRECT:/ingen-tilgang',
    );
  });
});

describe('wall 1: a student login reads only itself', () => {
  it('returns the own record with class and schedule', async () => {
    signInAs('elev@test.local');
    const record = await getOwnStudentRecord();
    expect(record?.first_name).toBe('Yusuf');
    expect(record?.class_name).toBe('Klasse 1');
    expect(record?.schedule).toHaveLength(1);
  });
});

describe('wall 1: teacher rosters are class-bound (fine-derived #4)', () => {
  it('returns the own-class roster sorted by last name', async () => {
    await signInAsAAL2('laerer@test.local');
    const result = await getRosterForTeacher(
      'fc000000-0000-0000-0000-000000000001',
    );
    expect(result?.class.name).toBe('Klasse 1');
    expect(result?.roster.map((r) => `${r.first_name} ${r.last_name}`)).toEqual([
      'Yusuf Farah',
      'Bilal Omar',
    ]);
  });

  it('answers null for a class the teacher does not teach', async () => {
    await signInAsAAL2('laerer@test.local');
    await expect(
      getRosterForTeacher('fc000000-0000-0000-0000-000000000002'),
    ).resolves.toBeNull();
  });

  it('shows the dual-role user her TAUGHT class incl. the protected student', async () => {
    await signInAsAAL2('laererforelder@test.local');
    const result = await getRosterForTeacher(
      'fc000000-0000-0000-0000-000000000002',
    );
    expect(result?.roster.map((r) => r.first_name)).toEqual(['Zaynab', 'Amira']);
    expect(result?.roster[0].protected).toBe(true);
  });

  it("does NOT give the dual-role user her child's class as teacher", async () => {
    await signInAsAAL2('laererforelder@test.local');
    await expect(
      getRosterForTeacher('fc000000-0000-0000-0000-000000000001'),
    ).resolves.toBeNull();
  });
});

describe('wall 1: the admin registry', () => {
  it('lists all five students with class names', async () => {
    await signInAsAAL2('admin@test.local');
    const students = await listStudentsForAdmin();
    expect(students).toHaveLength(5);
    const yusuf = students.find((s) => s.first_name === 'Yusuf');
    expect(yusuf?.class_name).toBe('Klasse 1');
    const idris = students.find((s) => s.first_name === 'Idris');
    expect(idris?.class_name).toBeNull();
  });

  it('filters by search and status', async () => {
    await signInAsAAL2('admin@test.local');
    const farah = await listStudentsForAdmin({ search: 'Farah' });
    expect(farah.map((s) => s.first_name).sort()).toEqual(['Amira', 'Yusuf']);
    const stopped = await listStudentsForAdmin({ status: 'stopped' });
    expect(stopped.map((s) => s.first_name)).toEqual(['Idris']);
  });

  it('sanitizes ilike metacharacters instead of matching everything', async () => {
    await signInAsAAL2('admin@test.local');
    const result = await listStudentsForAdmin({ search: '%_,()' });
    expect(result).toHaveLength(5); // stripped to empty -> unfiltered list
  });

  it('composes the one-glance detail: guardians, enrollment, login', async () => {
    await signInAsAAL2('admin@test.local');
    const zaynab = await getStudentForAdmin(
      'fe000000-0000-0000-0000-000000000004',
    );
    expect(zaynab?.protected).toBe(true);
    expect(zaynab?.has_login).toBe(false);
    expect(zaynab?.guardians).toEqual([
      {
        guardian_id: '77777777-7777-7777-7777-777777777777',
        full_name: 'Fatima Yusuf',
        relationship: 'mor',
        is_payer: true,
      },
    ]);
    expect(zaynab?.enrollment.map((e) => e.class_name)).toEqual(['Klasse 3']);

    const yusuf = await getStudentForAdmin(
      'fe000000-0000-0000-0000-000000000001',
    );
    expect(yusuf?.has_login).toBe(true);
  });

  it('answers null for malformed or unknown student ids', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(getStudentForAdmin('ikke-uuid')).resolves.toBeNull();
    await expect(
      getStudentForAdmin('00000000-0000-0000-0000-00000000dead'),
    ).resolves.toBeNull();
  });

  it('turns a parent away from every admin registry read', async () => {
    signInAs('forelder@test.local');
    await expect(listStudentsForAdmin()).rejects.toThrow(
      'NEXT_REDIRECT:/ingen-tilgang',
    );
    await expect(
      getStudentForAdmin('fe000000-0000-0000-0000-000000000001'),
    ).rejects.toThrow('NEXT_REDIRECT:/ingen-tilgang');
  });

  it('finds no unplaced active students in the seed world', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(listStudentsWithoutActiveClass()).resolves.toEqual([]);
    // The dynamic proof (unenroll -> student appears here) runs in the
    // Task 10 action lifecycle test.
  });
});
```

Run and confirm RED:

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run test:api 2>&1 | tail -6
```

Expected: resolution failure for `@/lib/dal/students`; prior 51 tests green.

- [ ] **Step 2: Create the students DAL**

Create `src/lib/dal/students.ts`:

```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ScheduleSlot } from './classes';
import { requireRole, requireStaffRole } from './session';

const nbCollator = new Intl.Collator('nb');

interface EnrollmentJoin {
  class_id: string;
  student_id: string;
  classes: {
    id: string;
    name: string;
    class_schedule: ScheduleSlot[];
  } | null;
}

/** Active class + schedule per student id (left_on null). */
async function activeEnrollmentMap(
  studentIds: string[],
): Promise<Map<string, { class_id: string; class_name: string; schedule: ScheduleSlot[] }>> {
  const map = new Map<
    string,
    { class_id: string; class_name: string; schedule: ScheduleSlot[] }
  >();
  if (studentIds.length === 0) return map;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('class_students')
    .select(
      'class_id, student_id, classes(id, name, class_schedule(weekday, starts_at, ends_at))',
    )
    .in('student_id', studentIds)
    .is('left_on', null);
  if (error) {
    throw new Error(`Kunne ikke lese klassemedlemskap: ${error.message}`);
  }
  for (const row of (data ?? []) as EnrollmentJoin[]) {
    if (!row.classes) continue;
    map.set(row.student_id, {
      class_id: row.classes.id,
      class_name: row.classes.name,
      schedule: [...(row.classes.class_schedule ?? [])].sort(
        (a, b) => a.weekday - b.weekday || a.starts_at.localeCompare(b.starts_at),
      ),
    });
  }
  return map;
}

export interface ChildCard {
  student_id: string;
  first_name: string;
  last_name: string;
  birth_year: number;
  status: string;
  relationship: string;
  class_id: string | null;
  class_name: string | null;
  schedule: ScheduleSlot[];
}

/**
 * The caller's own children. The explicit .eq on guardian_id is
 * load-bearing (the .eq discipline): RLS also lets admins read all links,
 * so a bare select would over-return for a dual-role admin+parent.
 */
export async function listChildrenForGuardian(): Promise<ChildCard[]> {
  const { user } = await requireRole('parent');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('guardian_student')
    .select(
      'relationship, students(id, first_name, last_name, birth_year, status)',
    )
    .eq('guardian_id', user.id);
  if (error) {
    throw new Error(`Kunne ikke lese egne barn: ${error.message}`);
  }
  const rows = (data ?? []).filter(
    (row): row is typeof row & { students: NonNullable<(typeof row)['students']> } =>
      row.students !== null,
  );
  const enrollment = await activeEnrollmentMap(rows.map((r) => r.students.id));
  return rows
    .map((row) => {
      const active = enrollment.get(row.students.id) ?? null;
      return {
        student_id: row.students.id,
        first_name: row.students.first_name,
        last_name: row.students.last_name,
        birth_year: row.students.birth_year,
        status: row.students.status,
        relationship: row.relationship,
        class_id: active?.class_id ?? null,
        class_name: active?.class_name ?? null,
        schedule: active?.schedule ?? [],
      };
    })
    .sort((a, b) => nbCollator.compare(a.first_name, b.first_name));
}

export interface OwnStudentRecord {
  student_id: string;
  first_name: string;
  last_name: string;
  birth_year: number;
  status: string;
  class_name: string | null;
  schedule: ScheduleSlot[];
}

export async function getOwnStudentRecord(): Promise<OwnStudentRecord | null> {
  const { user } = await requireRole('student');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('students')
    .select('id, first_name, last_name, birth_year, status')
    .eq('student_user_id', user.id)
    .maybeSingle();
  if (error) {
    throw new Error(`Kunne ikke lese egen elevinformasjon: ${error.message}`);
  }
  if (!data) return null;
  const enrollment = await activeEnrollmentMap([data.id]);
  const active = enrollment.get(data.id) ?? null;
  return {
    student_id: data.id,
    first_name: data.first_name,
    last_name: data.last_name,
    birth_year: data.birth_year,
    status: data.status,
    class_name: active?.class_name ?? null,
    schedule: active?.schedule ?? [],
  };
}

export interface RosterEntry {
  student_id: string;
  first_name: string;
  last_name: string;
  birth_year: number;
  protected: boolean;
  status: string;
}

export interface TeacherRoster {
  class: { id: string; name: string; room: string | null };
  roster: RosterEntry[];
}

/**
 * The roster of ONE of the caller's own classes. Relationship check FIRST
 * (wall 1); enumeration-quiet: a class that exists but is not theirs and a
 * class that does not exist are the same null (page renders 404).
 */
export async function getRosterForTeacher(
  classId: string,
): Promise<TeacherRoster | null> {
  const { user } = await requireStaffRole('teacher');
  const supabase = await createClient();
  const { data: link, error: linkError } = await supabase
    .from('class_teachers')
    .select('class_id, classes(id, name, room)')
    .eq('class_id', classId)
    .eq('teacher_id', user.id)
    .maybeSingle();
  if (linkError) {
    if (linkError.code === '22P02') return null;
    throw new Error(`Kunne ikke verifisere klassetilhørighet: ${linkError.message}`);
  }
  if (!link?.classes) return null;

  const { data: rows, error } = await supabase
    .from('class_students')
    .select('students(id, first_name, last_name, birth_year, protected, status)')
    .eq('class_id', classId)
    .is('left_on', null);
  if (error) {
    throw new Error(`Kunne ikke lese klasselisten: ${error.message}`);
  }
  const roster: RosterEntry[] = (rows ?? [])
    .flatMap((row) => (row.students ? [row.students] : []))
    .map((s) => ({
      student_id: s.id,
      first_name: s.first_name,
      last_name: s.last_name,
      birth_year: s.birth_year,
      protected: s.protected,
      status: s.status,
    }))
    .sort(
      (a, b) =>
        nbCollator.compare(a.last_name, b.last_name) ||
        nbCollator.compare(a.first_name, b.first_name),
    );
  return {
    class: { id: link.classes.id, name: link.classes.name, room: link.classes.room },
    roster,
  };
}

export interface AdminStudentListItem {
  student_id: string;
  first_name: string;
  last_name: string;
  birth_year: number;
  protected: boolean;
  status: string;
  class_name: string | null;
}

export interface StudentFilters {
  search?: string;
  status?: 'active' | 'stopped';
}

export async function listStudentsForAdmin(
  filters: StudentFilters = {},
): Promise<AdminStudentListItem[]> {
  await requireStaffRole('admin');
  const supabase = await createClient();
  let query = supabase
    .from('students')
    .select('id, first_name, last_name, birth_year, protected, status');
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.search) {
    // PostgREST's .or() parses commas/parens, and ilike treats %/_ as
    // wildcards. Names never contain these — strip rather than escape.
    const q = filters.search.replace(/[%_,()]/g, '').trim();
    if (q) {
      query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
    }
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`Kunne ikke lese elevregisteret: ${error.message}`);
  }
  const enrollment = await activeEnrollmentMap((data ?? []).map((s) => s.id));
  return (data ?? [])
    .map((s) => ({
      student_id: s.id,
      first_name: s.first_name,
      last_name: s.last_name,
      birth_year: s.birth_year,
      protected: s.protected,
      status: s.status,
      class_name: enrollment.get(s.id)?.class_name ?? null,
    }))
    .sort(
      (a, b) =>
        nbCollator.compare(a.first_name, b.first_name) ||
        nbCollator.compare(a.last_name, b.last_name),
    );
}

export interface GuardianLink {
  guardian_id: string;
  full_name: string;
  relationship: string;
  is_payer: boolean;
}

export interface EnrollmentRow {
  class_id: string;
  class_name: string;
  enrolled_on: string;
  left_on: string | null;
}

export interface AdminStudentDetail {
  student_id: string;
  first_name: string;
  last_name: string;
  birth_year: number;
  protected: boolean;
  status: string;
  note: string | null;
  has_login: boolean;
  guardians: GuardianLink[];
  enrollment: EnrollmentRow[];
}

export async function getStudentForAdmin(
  studentId: string,
): Promise<AdminStudentDetail | null> {
  await requireStaffRole('admin');
  const supabase = await createClient();
  const { data: student, error } = await supabase
    .from('students')
    .select(
      'id, first_name, last_name, birth_year, protected, status, note, student_user_id',
    )
    .eq('id', studentId)
    .maybeSingle();
  if (error) {
    if (error.code === '22P02') return null;
    throw new Error(`Kunne ikke lese eleven: ${error.message}`);
  }
  if (!student) return null;

  const [guardiansRes, enrollmentRes] = await Promise.all([
    supabase
      .from('guardian_student')
      .select('guardian_id, relationship, is_payer, profiles(full_name)')
      .eq('student_id', studentId),
    supabase
      .from('class_students')
      .select('class_id, enrolled_on, left_on, classes(name)')
      .eq('student_id', studentId)
      .order('enrolled_on', { ascending: false }),
  ]);
  if (guardiansRes.error) {
    throw new Error(`Kunne ikke lese foresatte: ${guardiansRes.error.message}`);
  }
  if (enrollmentRes.error) {
    throw new Error(`Kunne ikke lese klassehistorikk: ${enrollmentRes.error.message}`);
  }

  return {
    student_id: student.id,
    first_name: student.first_name,
    last_name: student.last_name,
    birth_year: student.birth_year,
    protected: student.protected,
    status: student.status,
    note: student.note,
    has_login: student.student_user_id !== null,
    guardians: (guardiansRes.data ?? [])
      .map((g) => ({
        guardian_id: g.guardian_id,
        full_name: g.profiles?.full_name ?? '',
        relationship: g.relationship,
        is_payer: g.is_payer,
      }))
      .sort((a, b) => nbCollator.compare(a.full_name, b.full_name)),
    enrollment: (enrollmentRes.data ?? []).map((e) => ({
      class_id: e.class_id,
      class_name: e.classes?.name ?? '',
      enrolled_on: e.enrolled_on,
      left_on: e.left_on,
    })),
  };
}

/** Active students with no active enrollment — the enroll picker. */
export async function listStudentsWithoutActiveClass(): Promise<
  Pick<AdminStudentListItem, 'student_id' | 'first_name' | 'last_name'>[]
> {
  await requireStaffRole('admin');
  const supabase = await createClient();
  const [studentsRes, activeRes] = await Promise.all([
    supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('status', 'active'),
    supabase.from('class_students').select('student_id').is('left_on', null),
  ]);
  if (studentsRes.error) {
    throw new Error(`Kunne ikke lese elever: ${studentsRes.error.message}`);
  }
  if (activeRes.error) {
    throw new Error(`Kunne ikke lese medlemskap: ${activeRes.error.message}`);
  }
  const placed = new Set((activeRes.data ?? []).map((r) => r.student_id));
  return (studentsRes.data ?? [])
    .filter((s) => !placed.has(s.id))
    .map((s) => ({
      student_id: s.id,
      first_name: s.first_name,
      last_name: s.last_name,
    }))
    .sort((a, b) => nbCollator.compare(a.first_name, b.first_name));
}
```

- [ ] **Step 3: Verify GREEN, then commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run lint
npm run test:api 2>&1 | tail -4
git add src/lib/dal/students.ts tests/api/school-core.test.ts
git commit -m "feat: students DAL with guardian, roster and registry reads at wall 1"
```

Expected: **69** test:api (52 + 17). The two Bergen-critical tests to eyeball in the output: `never returns another family's student ids` and `does NOT give the dual-role user her child's class as teacher`.

---

### Task 8: Admin module — provisioning, role grants, e-mail lookup (SECURITY-CRITICAL)

The quarantine grows by exactly what needs the service role: creating auth users, writing `user_roles`, and resolving e-mail → user (PostgREST exposes only `public`, so a narrow SECURITY DEFINER bridge function is added, EXECUTE service_role-only). Shared plumbing is extracted to `quarantine.ts` so `users.ts` and `audit-log.ts` use ONE `requireAdminActor`.

**Files:**
- Create: `supabase/migrations/<ts>_admin_user_lookup.sql`
- Create: `supabase/tests/10_admin_lookup.sql`
- Create: `src/lib/admin/quarantine.ts`
- Create: `src/lib/admin/users.ts`
- Modify: `src/lib/admin/audit-log.ts` (import from quarantine; delete the moved code)
- Modify: `src/app/(portal)/admin/page.tsx`, `tests/api/access-wall.test.ts` (AdminAccessDenied import path)
- Modify: `src/lib/supabase/database.types.ts` (regenerated — the rpc appears in Functions)
- Create: `tests/api/admin-users.test.ts`

- [ ] **Step 1: Write the failing pgTAP file**

Create `supabase/tests/10_admin_lookup.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- Setup: one user with a known e-mail (profile auto-created by trigger).
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'ad000000-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'pgtap-lk@test.local',
   '{"provider":"email","providers":["email"]}', '{"full_name":"LK Bruker"}', now(), now());

select has_function('public', 'admin_lookup_user_by_email', array['text'],
  'public.admin_lookup_user_by_email(text) exists');
select ok(
  not has_function_privilege('anon', 'public.admin_lookup_user_by_email(text)', 'execute'),
  'anon cannot execute the lookup');
select ok(
  not has_function_privilege('authenticated', 'public.admin_lookup_user_by_email(text)', 'execute'),
  'authenticated cannot execute the lookup — service_role only');

select set_config('request.jwt.claims',
  '{"sub":"ad000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select * from public.admin_lookup_user_by_email('pgtap-lk@test.local') $$,
  '42501', null,
  'an app-role call dies at the EXECUTE privilege');
reset role;

set local role service_role;
select results_eq(
  $$ select user_id, full_name
     from public.admin_lookup_user_by_email('pgtap-lk@test.local') $$,
  $$ values ('ad000000-0000-0000-0000-000000000001'::uuid, 'LK Bruker'::text) $$,
  'service_role resolves the e-mail to user id + name');
select results_eq(
  $$ select user_id from public.admin_lookup_user_by_email('  PGTAP-LK@TEST.LOCAL ') $$,
  $$ values ('ad000000-0000-0000-0000-000000000001'::uuid) $$,
  'lookup is case- and whitespace-insensitive');
select is_empty(
  $$ select * from public.admin_lookup_user_by_email('finnes-ikke@test.local') $$,
  'unknown e-mail yields the empty set');
reset role;

select * from finish();
rollback;
```

Run `supabase test db 2>&1 | tail -14` — expect `10_admin_lookup` RED (`function ... does not exist`), everything else green.

- [ ] **Step 2: Create the lookup migration, apply, regenerate types**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase migration new admin_user_lookup
```

Write `supabase/migrations/<ts>_admin_user_lookup.sql`:

```sql
-- Service-role-only e-mail → user lookup for the admin module (guardian and
-- student-login linking need "does this e-mail already have an account?").
-- PostgREST exposes only the public schema, so the module cannot query
-- auth.users directly; this SECURITY DEFINER function is the narrow bridge.
-- EXECUTE is service_role-only: app roles die at the privilege layer, and
-- the admin module re-verifies its caller (AAL2 admin) before invoking.
create or replace function public.admin_lookup_user_by_email(p_email text)
returns table (user_id uuid, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, coalesce(p.full_name, '')
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(p_email));
$$;

revoke execute on function public.admin_lookup_user_by_email(text)
  from public, anon, authenticated;
grant execute on function public.admin_lookup_user_by_email(text) to service_role;
```

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase db reset 2>&1 | tail -5
supabase test db 2>&1 | tail -14
npm run db:types && npm run typecheck
```

Expected: all 11 pgTAP files pass — total **177** (170 + 7); `database.types.ts` gains `admin_lookup_user_by_email` under `Functions`; typecheck silent.

- [ ] **Step 3: Extract the quarantine plumbing**

Create `src/lib/admin/quarantine.ts` (the moved code is byte-identical to what `audit-log.ts` holds today — move, don't rewrite):

```ts
import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getPublicEnv } from '@/lib/env';
import { getServiceRoleKey } from '@/lib/env.server';
import { getSessionUser } from '@/lib/dal/session';
import { createClient as createUserClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

/**
 * QUARANTINE (spec §3/§6): src/lib/admin/ is the ONLY place allowed to use
 * the service-role key. Because the service client BYPASSES RLS, this module
 * is the SOLE wall if the proxy ever fails to gate a route — so it re-verifies
 * everything itself, trusting neither cookie claims nor the proxy. Contract
 * for every exported function in this directory:
 *   1. Re-verify the caller holds AAL2 (staff must be 2FA-verified, spec §6).
 *   2. Re-verify the caller holds the admin role with an independent query.
 *   3. Write an audit entry describing what was done.
 * createServiceRoleClient is exported for SIBLING FILES IN THIS DIRECTORY
 * ONLY — never import it outside src/lib/admin/.
 */

/**
 * A DENIAL from the admin quarantine (not an infrastructure failure).
 * UI may catch exactly this to render a locked state; every other error
 * must keep propagating (fail fast).
 */
export class AdminAccessDenied extends Error {}

export function createServiceRoleClient() {
  const env = getPublicEnv();
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    getServiceRoleKey(),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** Throws unless the current session user is an AAL2 admin. Returns their id. */
export async function requireAdminActor(): Promise<string> {
  const user = await getSessionUser();
  if (!user) {
    throw new AdminAccessDenied('Ikke innlogget.');
  }
  // Assurance re-check on the caller's OWN session (not the service client).
  // The proxy also enforces AAL2, but this module bypasses RLS, so it must
  // never depend on the proxy having run. Denies before any service query.
  const userClient = await createUserClient();
  const { data: aal, error: aalError } =
    await userClient.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError) {
    throw new Error(`Sikkerhetsnivå-kontroll feilet: ${aalError.message}`);
  }
  if (aal?.currentLevel !== 'aal2') {
    throw new AdminAccessDenied('Krever bekreftet to-faktor (AAL2).');
  }
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();
  if (error) {
    throw new Error(`Rollekontroll feilet: ${error.message}`);
  }
  if (!data) {
    throw new AdminAccessDenied('Du har ikke tilgang til denne siden.');
  }
  return user.id;
}
```

Rewrite `src/lib/admin/audit-log.ts` to import the shared pieces (drop its local `AdminAccessDenied`, `createServiceRoleClient`, `requireAdminActor`, and the now-duplicated imports; `adminListAuditLog` itself is unchanged, including its Task 1 comment):

```ts
import 'server-only';
import { createServiceRoleClient, requireAdminActor } from './quarantine';

export interface AuditLogEntry { /* … unchanged … */ }

export async function adminListAuditLog(limit = 5): Promise<AuditLogEntry[]> {
  /* … unchanged body … */
}
```

Update the two import sites of `AdminAccessDenied`:
- `src/app/(portal)/admin/page.tsx`: `import { AdminAccessDenied } from '@/lib/admin/quarantine';` and `import { adminListAuditLog, type AuditLogEntry } from '@/lib/admin/audit-log';`
- `tests/api/access-wall.test.ts`: `import { AdminAccessDenied } from '@/lib/admin/quarantine';` and `import { adminListAuditLog } from '@/lib/admin/audit-log';`

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run test:api 2>&1 | tail -4
```

Expected: typecheck silent; all 69 API tests still green (pure refactor).

- [ ] **Step 4: Write the failing module tests**

Create `tests/api/admin-users.test.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { AdminAccessDenied } from '@/lib/admin/quarantine';
import {
  adminFindUserByEmail,
  adminGrantRole,
  adminProvisionUser,
  EmailAlreadyRegistered,
} from '@/lib/admin/users';
import type { Database } from '@/lib/supabase/database.types';
import { getPublicEnv } from '@/lib/env';
import { signInAs, signInAsAAL2, signOut } from './harness';

// Test-scaffolding service client (same sanction as the harness's own AAL2
// cleanup): provisioned users must not leak between runs.
function scaffoldingServiceClient() {
  const env = getPublicEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY mangler i miljøet.');
  return createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const provisionedIds: string[] = [];

afterAll(async () => {
  const service = scaffoldingServiceClient();
  for (const id of provisionedIds) {
    await service.auth.admin.deleteUser(id);
  }
});

beforeEach(() => {
  signOut();
});

describe('admin quarantine: provisioning is triple-locked', () => {
  it('denies a logged-out caller', async () => {
    await expect(
      adminProvisionUser({ email: 'x@test.local', fullName: 'X X', roles: ['parent'] }),
    ).rejects.toBeInstanceOf(AdminAccessDenied);
  });

  it('denies a genuine admin on a password-only (AAL1) session', async () => {
    signInAs('admin@test.local');
    await expect(
      adminProvisionUser({ email: 'x@test.local', fullName: 'X X', roles: ['parent'] }),
    ).rejects.toThrow('Krever bekreftet to-faktor (AAL2).');
  });

  it('denies 2FA-verified NON-admin staff', async () => {
    await signInAsAAL2('okonomi@test.local');
    await expect(
      adminProvisionUser({ email: 'x@test.local', fullName: 'X X', roles: ['parent'] }),
    ).rejects.toThrow('Du har ikke tilgang til denne siden.');
  });
});

describe('admin quarantine: provisioning at AAL2', () => {
  it('creates a password-less confirmed user with roles and audit trail', async () => {
    await signInAsAAL2('admin@test.local');
    const email = `provision-${randomUUID()}@test.local`;
    const { userId } = await adminProvisionUser({
      email,
      fullName: 'Provisjonert Forelder',
      roles: ['parent'],
    });
    provisionedIds.push(userId);

    const service = scaffoldingServiceClient();
    const { data: roles } = await service
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    expect(roles?.map((r) => r.role)).toEqual(['parent']);
    const { data: profile } = await service
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();
    expect(profile?.full_name).toBe('Provisjonert Forelder');
    const { data: audit } = await service
      .from('audit_log')
      .select('action, meta')
      .eq('entity_id', userId)
      .eq('action', 'admin.user.provisioned');
    expect(audit).toHaveLength(1);
    expect(audit?.[0].meta).toMatchObject({ roles: ['parent'], source: 'admin_module' });
  });

  it('maps an existing e-mail to the typed EmailAlreadyRegistered', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(
      adminProvisionUser({
        email: 'laerer@test.local',
        fullName: 'Dublett',
        roles: ['parent'],
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegistered);
  });

  it('rejects garbage input before touching GoTrue', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(
      adminProvisionUser({ email: 'ikke-epost', fullName: 'X X', roles: ['parent'] }),
    ).rejects.toThrow('Ugyldig provisjonering');
  });
});

describe('admin quarantine: role grants', () => {
  it('grants idempotently and audits', async () => {
    await signInAsAAL2('admin@test.local');
    // forelder@ already holds parent — granting again must be a quiet no-op.
    await adminGrantRole('33333333-3333-3333-3333-333333333333', 'parent');
    await adminGrantRole('33333333-3333-3333-3333-333333333333', 'parent');
    const service = scaffoldingServiceClient();
    const { data: roles } = await service
      .from('user_roles')
      .select('role')
      .eq('user_id', '33333333-3333-3333-3333-333333333333');
    expect(roles?.map((r) => r.role)).toEqual(['parent']);
  });

  it('denies role grants below AAL2', async () => {
    signInAs('admin@test.local');
    await expect(
      adminGrantRole('33333333-3333-3333-3333-333333333333', 'parent'),
    ).rejects.toBeInstanceOf(AdminAccessDenied);
  });
});

describe('admin quarantine: e-mail lookup', () => {
  it('finds a seed user by e-mail, case-insensitively', async () => {
    await signInAsAAL2('admin@test.local');
    const hit = await adminFindUserByEmail('FORELDER@test.local');
    expect(hit).toEqual({
      userId: '33333333-3333-3333-3333-333333333333',
      fullName: 'Omar Farah',
    });
  });

  it('answers null for unknown or malformed e-mails', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(adminFindUserByEmail('finnes-ikke@test.local')).resolves.toBeNull();
    await expect(adminFindUserByEmail('ikke-epost')).resolves.toBeNull();
  });

  it('denies the lookup below AAL2', async () => {
    signInAs('admin@test.local');
    await expect(adminFindUserByEmail('forelder@test.local')).rejects.toBeInstanceOf(
      AdminAccessDenied,
    );
  });
});
```

Run `npm run test:api 2>&1 | tail -5` — expect resolution failure for `@/lib/admin/users`.

- [ ] **Step 5: Implement the users module**

Create `src/lib/admin/users.ts`:

```ts
import 'server-only';
import { z } from 'zod';
import { ALL_ROLES, type Role } from '@/lib/auth/access';
import { createServiceRoleClient, requireAdminActor } from './quarantine';

/** The e-mail already has an account — callers offer linking instead. */
export class EmailAlreadyRegistered extends Error {
  constructor(email: string) {
    super(`E-postadressen ${email} har allerede en konto.`);
  }
}

const provisionSchema = z.object({
  email: z.email().max(254),
  fullName: z.string().trim().min(2).max(120),
  roles: z.array(z.enum(ALL_ROLES)).min(1).max(5),
});

/**
 * Creates a CONFIRMED, PASSWORD-LESS auth user + roles + audit entry.
 * Deliberately no credentials: the invite/set-password flow ships with
 * cloud onboarding (content-free e-mail via Brevo) — see the Phase 1 plan
 * header. The profiles row is created by the on_auth_user_created trigger.
 */
export async function adminProvisionUser(input: {
  email: string;
  fullName: string;
  roles: Role[];
}): Promise<{ userId: string }> {
  const actorId = await requireAdminActor();
  const parsed = provisionSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      `Ugyldig provisjonering: ${parsed.error.issues[0]?.message ?? 'ukjent felt'}`,
    );
  }
  const service = createServiceRoleClient();
  const { data, error } = await service.auth.admin.createUser({
    email: parsed.data.email,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (error || !data.user) {
    if (error?.code === 'email_exists') {
      throw new EmailAlreadyRegistered(parsed.data.email);
    }
    throw new Error(`Kunne ikke opprette bruker: ${error?.message ?? 'ukjent feil'}`);
  }
  const userId = data.user.id;
  const { error: rolesError } = await service.from('user_roles').upsert(
    parsed.data.roles.map((role) => ({ user_id: userId, role })),
    { onConflict: 'user_id,role', ignoreDuplicates: true },
  );
  if (rolesError) {
    throw new Error(
      `Bruker opprettet, men rolletildeling feilet: ${rolesError.message}`,
    );
  }
  const { error: auditError } = await service.from('audit_log').insert({
    actor_id: actorId,
    action: 'admin.user.provisioned',
    entity: 'auth.users',
    entity_id: userId,
    meta: { roles: parsed.data.roles, source: 'admin_module' },
  });
  if (auditError) {
    throw new Error(`Kunne ikke skrive til revisjonsloggen: ${auditError.message}`);
  }
  return { userId };
}

/** Idempotent role grant (linking existing users as guardians/students). */
export async function adminGrantRole(userId: string, role: Role): Promise<void> {
  const actorId = await requireAdminActor();
  // z.guid(), not z.uuid(): z.uuid() enforces the RFC 9562/4122 variant
  // nibble ([89abAB]), which the repo's own seed users fail by design
  // (gotcha 13 — 11111111.../77777777... have no RFC-valid variant bits).
  // z.guid() validates the same 8-4-4-4-12 hex shape without that
  // constraint, so it accepts both seed fixtures and real gen_random_uuid()
  // rows while still rejecting non-UUID-shaped input.
  const parsed = z
    .object({ userId: z.guid(), role: z.enum(ALL_ROLES) })
    .safeParse({ userId, role });
  if (!parsed.success) {
    throw new Error('Ugyldig rolletildeling.');
  }
  const service = createServiceRoleClient();
  const { error } = await service.from('user_roles').upsert(
    [{ user_id: parsed.data.userId, role: parsed.data.role }],
    { onConflict: 'user_id,role', ignoreDuplicates: true },
  );
  if (error) {
    throw new Error(`Rolletildeling feilet: ${error.message}`);
  }
  const { error: auditError } = await service.from('audit_log').insert({
    actor_id: actorId,
    action: 'admin.user_roles.granted',
    entity: 'user_roles',
    entity_id: parsed.data.userId,
    meta: { role: parsed.data.role, source: 'admin_module' },
  });
  if (auditError) {
    throw new Error(`Kunne ikke skrive til revisjonsloggen: ${auditError.message}`);
  }
}

/**
 * Resolves an e-mail to an existing account (guardian/student-login linking).
 * Malformed input answers null (quiet), the lookup itself is audited.
 */
export async function adminFindUserByEmail(
  email: string,
): Promise<{ userId: string; fullName: string } | null> {
  const actorId = await requireAdminActor();
  const parsed = z.email().max(254).safeParse(email.trim());
  if (!parsed.success) return null;
  const service = createServiceRoleClient();
  const { data, error } = await service.rpc('admin_lookup_user_by_email', {
    p_email: parsed.data,
  });
  if (error) {
    throw new Error(`Brukeroppslag feilet: ${error.message}`);
  }
  const row = data?.[0] ?? null;
  const { error: auditError } = await service.from('audit_log').insert({
    actor_id: actorId,
    action: 'admin.user.lookup',
    entity: 'auth.users',
    entity_id: row?.user_id ?? null,
    meta: { found: row !== null, source: 'admin_module' },
  });
  if (auditError) {
    throw new Error(`Kunne ikke skrive til revisjonsloggen: ${auditError.message}`);
  }
  return row ? { userId: row.user_id, fullName: row.full_name } : null;
}
```

- [ ] **Step 6: Verify GREEN, then commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run lint
npm run test:api 2>&1 | tail -4
npm test -- --run 2>&1 | tail -3
git add supabase/migrations/*_admin_user_lookup.sql supabase/tests/10_admin_lookup.sql src/lib/admin/ src/lib/supabase/database.types.ts 'src/app/(portal)/admin/page.tsx' tests/api/access-wall.test.ts tests/api/admin-users.test.ts
git commit -m "feat: admin-module user provisioning, role grants and service-only email lookup"
```

Expected: **80** test:api (69 + 11); 75 Vitest; 177 pgTAP (from Step 2). The security review for this task MUST probe live: AAL1 denial before any GoTrue write, non-admin AAL2 denial, audit entries for provision/grant/lookup, and that `admin_lookup_user_by_email` is uncallable as `authenticated` (pgTAP 10 pins it, re-verify by hand via `psql` if in doubt).

---

### Task 9: Validation module, date helpers, and structure actions (terms/subjects/classes)

All Zod schemas live in `src/lib/validation/school.ts` (`'use server'` files may export only async functions — gotcha 15). Every action: `requireStaffRole('admin')` FIRST, then Zod, then the write under the admin's own RLS session, with constraint errors mapped to Norwegian field errors.

**Files:**
- Create: `src/lib/validation/school.ts` + `src/lib/validation/school.test.ts`
- Create: `src/lib/dates.ts` + `src/lib/dates.test.ts`
- Create: `src/app/(portal)/admin/terminer/actions.ts`
- Create: `src/app/(portal)/admin/fag/actions.ts`
- Create: `src/app/(portal)/admin/klasser/actions.ts`
- Create: `tests/api/school-actions.test.ts`

- [ ] **Step 1: Create the validation module (with failing unit tests first)**

Create `src/lib/validation/school.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  classSchema,
  guardianLinkSchema,
  scheduleSlotSchema,
  studentSchema,
  subjectSchema,
  termSchema,
} from './school';

describe('termSchema', () => {
  it('accepts a valid term', () => {
    const parsed = termSchema.safeParse({
      navn: 'Høst 2027',
      start: '2027-08-14',
      slutt: '2027-12-19',
    });
    expect(parsed.success).toBe(true);
  });

  it.each([
    [{ navn: '', start: '2027-08-14', slutt: '2027-12-19' }, 'Oppgi navn.'],
    [
      { navn: 'X', start: '2027-12-19', slutt: '2027-08-14' },
      'Sluttdato må være etter startdato.',
    ],
    [{ navn: 'X', start: 'ikke-dato', slutt: '2027-12-19' }, 'Oppgi startdato.'],
  ])('rejects %j', (input, message) => {
    const parsed = termSchema.safeParse(input);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe(message);
    }
  });
});

describe('subjectSchema', () => {
  it('coerces sort from form strings', () => {
    const parsed = subjectSchema.safeParse({ navn: 'Arabisk 2', sort: '4' });
    expect(parsed.success && parsed.data.sort).toBe(4);
  });
  it('rejects a fractional or out-of-range sort', () => {
    expect(subjectSchema.safeParse({ navn: 'X', sort: '1.5' }).success).toBe(false);
    expect(subjectSchema.safeParse({ navn: 'X', sort: '-1' }).success).toBe(false);
  });
});

describe('classSchema', () => {
  it('turns an empty room into null', () => {
    const parsed = classSchema.safeParse({
      terminId: 'f1000000-0000-0000-0000-000000000001',
      navn: 'Klasse 5',
      rom: '',
    });
    expect(parsed.success && parsed.data.rom).toBeNull();
  });
  it('rejects a malformed term id', () => {
    expect(
      classSchema.safeParse({ terminId: 'nope', navn: 'K', rom: '' }).success,
    ).toBe(false);
  });
});

describe('scheduleSlotSchema', () => {
  const base = {
    klasseId: 'fc000000-0000-0000-0000-000000000001',
    ukedag: '6',
    start: '10:00',
    slutt: '13:00',
  };
  it('accepts a valid slot and coerces the weekday', () => {
    const parsed = scheduleSlotSchema.safeParse(base);
    expect(parsed.success && parsed.data.ukedag).toBe(6);
  });
  it.each([
    [{ ...base, ukedag: '8' }],
    [{ ...base, start: '25:00' }],
    [{ ...base, slutt: '09:00' }],
  ])('rejects %j', (input) => {
    expect(scheduleSlotSchema.safeParse(input).success).toBe(false);
  });
});

describe('studentSchema', () => {
  const base = {
    fornavn: 'Test',
    etternavn: 'Elev',
    fodselsaar: '2015',
    notat: '',
    skjermet: false,
    status: 'active',
  };
  it('coerces birth year and nulls the empty note', () => {
    const parsed = studentSchema.safeParse(base);
    expect(parsed.success && parsed.data.fodselsaar).toBe(2015);
    expect(parsed.success && parsed.data.notat).toBeNull();
  });
  it.each([
    [{ ...base, fodselsaar: '1899' }],
    [{ ...base, fodselsaar: 'abc' }],
    [{ ...base, fornavn: '' }],
    [{ ...base, status: 'paused' }],
  ])('rejects %j', (input) => {
    expect(studentSchema.safeParse(input).success).toBe(false);
  });
});

describe('guardianLinkSchema', () => {
  it('rejects a bad e-mail and a bad relationship', () => {
    expect(
      guardianLinkSchema.safeParse({
        elevId: 'fe000000-0000-0000-0000-000000000001',
        epost: 'ikke-epost',
        relasjon: 'mor',
        betaler: true,
      }).success,
    ).toBe(false);
    expect(
      guardianLinkSchema.safeParse({
        elevId: 'fe000000-0000-0000-0000-000000000001',
        epost: 'ok@test.local',
        relasjon: 'onkel',
        betaler: true,
      }).success,
    ).toBe(false);
  });
});
```

Run `npm test -- --run 2>&1 | tail -4` — expect module-not-found RED. Then create `src/lib/validation/school.ts`:

```ts
import { z } from 'zod';

/** Shared useActionState shape for every admin form. */
export interface FormState {
  error: string | null;
  success?: boolean;
}
export const idleForm: FormState = { error: null };

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Ugyldig innsending.';
}

// z.guid(), not z.uuid(): z.uuid() (Zod v4) enforces the RFC 9562/4122
// variant nibble, which the readable seed UUIDs (gotcha 13 — 11111111…,
// fc000000…, fe000000…) do NOT satisfy, so z.uuid() would reject every seed
// id and break these actions against the fixtures. z.guid() validates the
// 8-4-4-4-12 hex shape without the variant constraint (accepts seed fixtures
// AND real gen_random_uuid() rows), still rejecting non-UUID-shaped input.
export const uuidField = z.guid('Ugyldig id.');

const nameField = (message: string) =>
  z.string({ error: message }).trim().min(1, message).max(60, 'Maks 60 tegn.');

export const termSchema = z
  .object({
    navn: nameField('Oppgi navn.'),
    start: z.iso.date('Oppgi startdato.'),
    slutt: z.iso.date('Oppgi sluttdato.'),
  })
  .refine((v) => v.slutt > v.start, {
    message: 'Sluttdato må være etter startdato.',
    path: ['slutt'],
  });

export const subjectSchema = z.object({
  navn: nameField('Oppgi fagnavn.'),
  sort: z.coerce
    .number({ error: 'Sortering må være et tall.' })
    .int('Sortering må være et heltall.')
    .min(0, 'Minst 0.')
    .max(999, 'Maks 999.'),
});

export const classSchema = z.object({
  terminId: uuidField,
  navn: nameField('Oppgi klassenavn.'),
  rom: z
    .string()
    .trim()
    .max(40, 'Maks 40 tegn.')
    .transform((v) => (v === '' ? null : v)),
});

const timeField = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Ugyldig klokkeslett (tt:mm).');

export const scheduleSlotSchema = z
  .object({
    klasseId: uuidField,
    ukedag: z.coerce
      .number({ error: 'Velg ukedag.' })
      .int()
      .min(1, 'Velg ukedag.')
      .max(7, 'Velg ukedag.'),
    start: timeField,
    slutt: timeField,
  })
  .refine((v) => v.slutt > v.start, {
    message: 'Sluttid må være etter starttid.',
    path: ['slutt'],
  });

export const studentSchema = z.object({
  fornavn: nameField('Oppgi fornavn.'),
  etternavn: nameField('Oppgi etternavn.'),
  fodselsaar: z.coerce
    .number({ error: 'Oppgi fødselsår.' })
    .int('Oppgi et gyldig fødselsår.')
    .min(1900, 'Fødselsår må være mellom 1900 og 2100.')
    .max(2100, 'Fødselsår må være mellom 1900 og 2100.'),
  notat: z
    .string()
    .trim()
    .max(2000, 'Maks 2000 tegn.')
    .transform((v) => (v === '' ? null : v)),
  skjermet: z.boolean(),
  status: z.enum(['active', 'stopped'], { error: 'Ugyldig status.' }),
});

export const RELATIONSHIPS = ['mor', 'far', 'foresatt'] as const;

export const guardianLinkSchema = z.object({
  elevId: uuidField,
  epost: z.email('Oppgi en gyldig e-postadresse.').max(254),
  relasjon: z.enum(RELATIONSHIPS, { error: 'Velg relasjon.' }),
  betaler: z.boolean(),
});

export const guardianProvisionSchema = guardianLinkSchema.extend({
  fulltNavn: z
    .string()
    .trim()
    .min(2, 'Oppgi fullt navn.')
    .max(120, 'Maks 120 tegn.'),
});

export const loginLinkSchema = z.object({
  elevId: uuidField,
  epost: z.email('Oppgi en gyldig e-postadresse.').max(254),
});

export const loginProvisionSchema = loginLinkSchema.extend({
  fulltNavn: z
    .string()
    .trim()
    .min(2, 'Oppgi fullt navn.')
    .max(120, 'Maks 120 tegn.'),
});

export const enrollSchema = z.object({
  elevId: uuidField,
  klasseId: uuidField,
});

/** UI label maps (Norwegian) — DB values stay English (header gotcha 7). */
export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Mandag',
  2: 'Tirsdag',
  3: 'Onsdag',
  4: 'Torsdag',
  5: 'Fredag',
  6: 'Lørdag',
  7: 'Søndag',
};

export const STATUS_LABELS: Record<'active' | 'stopped', string> = {
  active: 'Aktiv',
  stopped: 'Sluttet',
};

export const RELATIONSHIP_LABELS: Record<(typeof RELATIONSHIPS)[number], string> = {
  mor: 'Mor',
  far: 'Far',
  foresatt: 'Foresatt',
};
```

- [ ] **Step 2: Create the date helpers (tests first)**

Create `src/lib/dates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatDateNb, scheduleLabel, todayOsloISO } from './dates';

describe('dates', () => {
  it('formats ISO dates in Norwegian, pinned to Europe/Oslo', () => {
    expect(formatDateNb('2026-08-15')).toBe('15. aug. 2026');
  });
  it('renders a schedule slot as a Norwegian label', () => {
    expect(
      scheduleLabel({ weekday: 6, starts_at: '10:00:00', ends_at: '13:00:00' }),
    ).toBe('Lørdag 10:00–13:00');
  });
  it('produces an Oslo-local ISO date for today', () => {
    expect(todayOsloISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

Create `src/lib/dates.ts`:

```ts
import { WEEKDAY_LABELS } from '@/lib/validation/school';

/**
 * All user-facing dates pin Europe/Oslo (the server runs UTC in prod —
 * the T12 audit-timestamp lesson). Date-only ISO strings are anchored to
 * UTC noon so no timezone can shift the calendar day.
 */
export function formatDateNb(isoDate: string): string {
  return new Intl.DateTimeFormat('nb-NO', {
    dateStyle: 'medium',
    timeZone: 'Europe/Oslo',
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

/** '10:00:00' | '10:00' -> '10:00' */
export function formatTime(time: string): string {
  return time.slice(0, 5);
}

export function scheduleLabel(slot: {
  weekday: number;
  starts_at: string;
  ends_at: string;
}): string {
  const day = WEEKDAY_LABELS[slot.weekday] ?? `Dag ${slot.weekday}`;
  return `${day} ${formatTime(slot.starts_at)}–${formatTime(slot.ends_at)}`;
}

/** Today's calendar date in Oslo as YYYY-MM-DD (en-CA gives ISO order). */
export function todayOsloISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Oslo',
  }).format(new Date());
}
```

Run `npm test -- --run 2>&1 | tail -3` — expect all unit tests green now (**~96**: 75 + 18 validation + 3 dates).

- [ ] **Step 3: Terms actions**

Create `src/app/(portal)/admin/terminer/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaffRole } from '@/lib/dal/session';
import { createClient } from '@/lib/supabase/server';
import {
  firstIssue,
  termSchema,
  uuidField,
  type FormState,
} from '@/lib/validation/school';

export async function createTermAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaffRole('admin');
  const parsed = termSchema.safeParse({
    navn: formData.get('navn'),
    start: formData.get('start'),
    slutt: formData.get('slutt'),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from('terms').insert({
    name: parsed.data.navn,
    starts_on: parsed.data.start,
    ends_on: parsed.data.slutt,
  });
  if (error) {
    if (error.code === '23505') {
      return { error: 'En termin med dette navnet finnes allerede.' };
    }
    throw new Error(`Kunne ikke opprette termin: ${error.message}`);
  }
  revalidatePath('/admin/terminer');
  return { error: null, success: true };
}

export async function updateTermAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaffRole('admin');
  const id = uuidField.safeParse(formData.get('id'));
  const parsed = termSchema.safeParse({
    navn: formData.get('navn'),
    start: formData.get('start'),
    slutt: formData.get('slutt'),
  });
  if (!id.success) return { error: 'Ugyldig termin.' };
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('terms')
    .update({
      name: parsed.data.navn,
      starts_on: parsed.data.start,
      ends_on: parsed.data.slutt,
    })
    .eq('id', id.data)
    .select('id');
  if (error) {
    if (error.code === '23505') {
      return { error: 'En termin med dette navnet finnes allerede.' };
    }
    throw new Error(`Kunne ikke oppdatere termin: ${error.message}`);
  }
  if (!data || data.length === 0) {
    return { error: 'Terminen finnes ikke lenger.' };
  }
  revalidatePath('/admin/terminer');
  redirect('/admin/terminer');
}

/**
 * Two statements by design: a single UPDATE touching both rows can
 * transiently violate terms_single_current. A crash between them leaves
 * NO current term — a benign, visible state fixed by clicking again.
 */
export async function setCurrentTermAction(formData: FormData): Promise<void> {
  await requireStaffRole('admin');
  const id = uuidField.parse(formData.get('id'));
  const supabase = await createClient();
  const { error: clearError } = await supabase
    .from('terms')
    .update({ is_current: false })
    .eq('is_current', true);
  if (clearError) {
    throw new Error(`Kunne ikke fjerne nåværende termin: ${clearError.message}`);
  }
  const { data: setData, error: setError } = await supabase
    .from('terms')
    .update({ is_current: true })
    .eq('id', id)
    .select('id');
  if (setError) {
    if (setError.code === '23505') {
      throw new Error('Nåværende termin ble nettopp endret av noen andre. Prøv igjen.');
    }
    throw new Error(`Kunne ikke sette nåværende termin: ${setError.message}`);
  }
  if (!setData || setData.length === 0) {
    throw new Error('Terminen finnes ikke lenger.');
  }
  revalidatePath('/admin/terminer');
  revalidatePath('/admin');
}

export async function deleteTermAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaffRole('admin');
  const id = uuidField.safeParse(formData.get('id'));
  if (!id.success) return { error: 'Ugyldig termin.' };
  const supabase = await createClient();
  const { error } = await supabase.from('terms').delete().eq('id', id.data);
  if (error) {
    if (error.code === '23503') {
      return { error: 'Terminen har klasser og kan ikke slettes.' };
    }
    throw new Error(`Kunne ikke slette termin: ${error.message}`);
  }
  revalidatePath('/admin/terminer');
  return { error: null, success: true };
}
```

- [ ] **Step 4: Subjects actions**

Create `src/app/(portal)/admin/fag/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { requireStaffRole } from '@/lib/dal/session';
import { createClient } from '@/lib/supabase/server';
import {
  firstIssue,
  subjectSchema,
  uuidField,
  type FormState,
} from '@/lib/validation/school';

export async function createSubjectAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaffRole('admin');
  const parsed = subjectSchema.safeParse({
    navn: formData.get('navn'),
    sort: formData.get('sort'),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from('subjects').insert({
    name: parsed.data.navn,
    sort: parsed.data.sort,
    quran_tracking: formData.get('koranspor') === 'on',
  });
  if (error) {
    if (error.code === '23505') {
      return { error: 'Et fag med dette navnet finnes allerede.' };
    }
    throw new Error(`Kunne ikke opprette fag: ${error.message}`);
  }
  revalidatePath('/admin/fag');
  return { error: null, success: true };
}

export async function updateSubjectAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaffRole('admin');
  const id = uuidField.safeParse(formData.get('id'));
  const parsed = subjectSchema.safeParse({
    navn: formData.get('navn'),
    sort: formData.get('sort'),
  });
  if (!id.success) return { error: 'Ugyldig fag.' };
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('subjects')
    .update({
      name: parsed.data.navn,
      sort: parsed.data.sort,
      quran_tracking: formData.get('koranspor') === 'on',
    })
    .eq('id', id.data)
    .select('id');
  if (error) {
    if (error.code === '23505') {
      return { error: 'Et fag med dette navnet finnes allerede.' };
    }
    throw new Error(`Kunne ikke oppdatere fag: ${error.message}`);
  }
  if (!data || data.length === 0) {
    return { error: 'Faget finnes ikke lenger.' };
  }
  revalidatePath('/admin/fag');
  return { error: null, success: true };
}

export async function deleteSubjectAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaffRole('admin');
  const id = uuidField.safeParse(formData.get('id'));
  if (!id.success) return { error: 'Ugyldig fag.' };
  const supabase = await createClient();
  const { error } = await supabase.from('subjects').delete().eq('id', id.data);
  if (error) {
    if (error.code === '23503') {
      return { error: 'Faget er i bruk i en klasse og kan ikke slettes.' };
    }
    throw new Error(`Kunne ikke slette fag: ${error.message}`);
  }
  revalidatePath('/admin/fag');
  return { error: null, success: true };
}
```

- [ ] **Step 5: Classes actions**

Create `src/app/(portal)/admin/klasser/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaffRole } from '@/lib/dal/session';
import { createClient } from '@/lib/supabase/server';
import { todayOsloISO } from '@/lib/dates';
import {
  classSchema,
  enrollSchema,
  firstIssue,
  scheduleSlotSchema,
  uuidField,
  type FormState,
} from '@/lib/validation/school';
import { z } from 'zod';

export async function createClassAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaffRole('admin');
  const parsed = classSchema.safeParse({
    terminId: formData.get('terminId'),
    navn: formData.get('navn'),
    rom: formData.get('rom') ?? '',
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('classes')
    .insert({
      term_id: parsed.data.terminId,
      name: parsed.data.navn,
      room: parsed.data.rom,
    })
    .select('id')
    .single();
  if (error || !data) {
    if (error?.code === '23505') {
      return { error: 'En klasse med dette navnet finnes allerede i terminen.' };
    }
    if (error?.code === '23503') {
      return { error: 'Terminen finnes ikke lenger.' };
    }
    throw new Error(`Kunne ikke opprette klasse: ${error?.message ?? 'ukjent'}`);
  }
  revalidatePath('/admin/klasser');
  redirect(`/admin/klasser/${data.id}`);
}

export async function updateClassAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaffRole('admin');
  const id = uuidField.safeParse(formData.get('id'));
  const parsed = classSchema
    .omit({ terminId: true })
    .safeParse({ navn: formData.get('navn'), rom: formData.get('rom') ?? '' });
  if (!id.success) return { error: 'Ugyldig klasse.' };
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('classes')
    .update({ name: parsed.data.navn, room: parsed.data.rom })
    .eq('id', id.data)
    .select('id');
  if (error) {
    if (error.code === '23505') {
      return { error: 'En klasse med dette navnet finnes allerede i terminen.' };
    }
    throw new Error(`Kunne ikke oppdatere klasse: ${error.message}`);
  }
  if (!data || data.length === 0) {
    return { error: 'Klassen finnes ikke lenger.' };
  }
  revalidatePath(`/admin/klasser/${id.data}`);
  return { error: null, success: true };
}

export async function deleteClassAction(formData: FormData): Promise<void> {
  await requireStaffRole('admin');
  const id = uuidField.parse(formData.get('id'));
  const supabase = await createClient();
  const { error } = await supabase.from('classes').delete().eq('id', id);
  if (error) {
    throw new Error(`Kunne ikke slette klasse: ${error.message}`);
  }
  revalidatePath('/admin/klasser');
  redirect('/admin/klasser');
}

/**
 * Replace-set semantics. Teacher roles are PRE-validated so the destructive
 * delete never runs against a bad set (the class_teachers with_check policy
 * remains the wall-2 backstop).
 */
export async function saveClassTeachersAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaffRole('admin');
  const id = uuidField.safeParse(formData.get('klasseId'));
  const teacherIds = z
    .array(uuidField)
    .max(20, 'Maks 20 lærere.')
    .safeParse(formData.getAll('laerere'));
  if (!id.success) return { error: 'Ugyldig klasse.' };
  if (!teacherIds.success) return { error: 'Ugyldig lærervalg.' };
  const supabase = await createClient();
  if (teacherIds.data.length > 0) {
    const { data: verified, error: verifyError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'teacher')
      .in('user_id', teacherIds.data);
    if (verifyError) {
      throw new Error(`Kunne ikke verifisere lærere: ${verifyError.message}`);
    }
    if ((verified ?? []).length !== teacherIds.data.length) {
      return { error: 'Valgt bruker er ikke lærer.' };
    }
  }
  const { error: clearError } = await supabase
    .from('class_teachers')
    .delete()
    .eq('class_id', id.data);
  if (clearError) {
    throw new Error(`Kunne ikke oppdatere lærere: ${clearError.message}`);
  }
  if (teacherIds.data.length > 0) {
    const { error: insertError } = await supabase.from('class_teachers').insert(
      teacherIds.data.map((teacherId) => ({
        class_id: id.data,
        teacher_id: teacherId,
      })),
    );
    if (insertError) {
      if (insertError.code === '42501') {
        return { error: 'Valgt bruker er ikke lærer.' };
      }
      throw new Error(`Kunne ikke lagre lærere: ${insertError.message}`);
    }
  }
  revalidatePath(`/admin/klasser/${id.data}`);
  return { error: null, success: true };
}

export async function saveClassSubjectsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaffRole('admin');
  const id = uuidField.safeParse(formData.get('klasseId'));
  const subjectIds = z
    .array(uuidField)
    .max(30, 'Maks 30 fag.')
    .safeParse(formData.getAll('fag'));
  if (!id.success) return { error: 'Ugyldig klasse.' };
  if (!subjectIds.success) return { error: 'Ugyldig fagvalg.' };
  const supabase = await createClient();
  const { error: clearError } = await supabase
    .from('class_subjects')
    .delete()
    .eq('class_id', id.data);
  if (clearError) {
    throw new Error(`Kunne ikke oppdatere fag: ${clearError.message}`);
  }
  if (subjectIds.data.length > 0) {
    const { error: insertError } = await supabase.from('class_subjects').insert(
      subjectIds.data.map((subjectId) => ({
        class_id: id.data,
        subject_id: subjectId,
      })),
    );
    if (insertError) {
      if (insertError.code === '23503') {
        return { error: 'Klassen eller ett av fagene finnes ikke lenger.' };
      }
      throw new Error(`Kunne ikke lagre fag: ${insertError.message}`);
    }
  }
  revalidatePath(`/admin/klasser/${id.data}`);
  return { error: null, success: true };
}

export async function addScheduleSlotAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaffRole('admin');
  const parsed = scheduleSlotSchema.safeParse({
    klasseId: formData.get('klasseId'),
    ukedag: formData.get('ukedag'),
    start: formData.get('start'),
    slutt: formData.get('slutt'),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from('class_schedule').insert({
    class_id: parsed.data.klasseId,
    weekday: parsed.data.ukedag,
    starts_at: parsed.data.start,
    ends_at: parsed.data.slutt,
  });
  if (error) {
    if (error.code === '23505') {
      return { error: 'Det finnes allerede en økt på dette tidspunktet.' };
    }
    if (error.code === '23514') {
      return { error: 'Sluttid må være etter starttid.' };
    }
    if (error.code === '23503') {
      return { error: 'Klassen finnes ikke lenger.' };
    }
    throw new Error(`Kunne ikke legge til økt: ${error.message}`);
  }
  revalidatePath(`/admin/klasser/${parsed.data.klasseId}`);
  return { error: null, success: true };
}

export async function removeScheduleSlotAction(formData: FormData): Promise<void> {
  await requireStaffRole('admin');
  const klasseId = uuidField.parse(formData.get('klasseId'));
  const ukedag = z.coerce.number().int().min(1).max(7).parse(formData.get('ukedag'));
  const start = z.string().parse(formData.get('start'));
  const supabase = await createClient();
  const { error } = await supabase
    .from('class_schedule')
    .delete()
    .eq('class_id', klasseId)
    .eq('weekday', ukedag)
    .eq('starts_at', start);
  if (error) {
    throw new Error(`Kunne ikke fjerne økt: ${error.message}`);
  }
  revalidatePath(`/admin/klasser/${klasseId}`);
}

export async function enrollStudentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaffRole('admin');
  const parsed = enrollSchema.safeParse({
    elevId: formData.get('elevId'),
    klasseId: formData.get('klasseId'),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from('class_students').insert({
    class_id: parsed.data.klasseId,
    student_id: parsed.data.elevId,
  });
  if (error) {
    if (error.code === '23505') {
      return { error: 'Eleven er allerede i en klasse.' };
    }
    if (error.code === '23503') {
      return { error: 'Fant ikke eleven eller klassen.' };
    }
    throw new Error(`Kunne ikke melde inn elev: ${error.message}`);
  }
  revalidatePath(`/admin/klasser/${parsed.data.klasseId}`);
  revalidatePath(`/admin/elever/${parsed.data.elevId}`);
  return { error: null, success: true };
}

export async function unenrollStudentAction(formData: FormData): Promise<void> {
  await requireStaffRole('admin');
  const parsed = enrollSchema.parse({
    elevId: formData.get('elevId'),
    klasseId: formData.get('klasseId'),
  });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('class_students')
    .update({ left_on: todayOsloISO() })
    .eq('class_id', parsed.klasseId)
    .eq('student_id', parsed.elevId)
    .is('left_on', null)
    .select('class_id');
  if (error) {
    throw new Error(`Kunne ikke melde ut elev: ${error.message}`);
  }
  if (!data || data.length === 0) {
    throw new Error('Eleven har ingen aktiv plass i denne klassen.');
  }
  revalidatePath(`/admin/klasser/${parsed.klasseId}`);
  revalidatePath(`/admin/elever/${parsed.elevId}`);
}
```

- [ ] **Step 6: Write the action-level API tests**

Create `tests/api/school-actions.test.ts` (guard order + error mapping — exhaustive input coverage lives in the Zod unit tests):

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
  addScheduleSlotAction,
  createClassAction,
  saveClassSubjectsAction,
  saveClassTeachersAction,
  unenrollStudentAction,
  updateClassAction,
} from '@/app/(portal)/admin/klasser/actions';
import {
  createTermAction,
  deleteTermAction,
  setCurrentTermAction,
  updateTermAction,
} from '@/app/(portal)/admin/terminer/actions';
import { createSubjectAction, updateSubjectAction } from '@/app/(portal)/admin/fag/actions';
import { getClassForAdmin } from '@/lib/dal/classes';
import { getCurrentTerm } from '@/lib/dal/terms';
import { createServerClientMock, signInAs, signInAsAAL2, signOut } from './harness';

const K1 = 'fc000000-0000-0000-0000-000000000001';
const LAERER_ID = '22222222-2222-2222-2222-222222222222';
const HOST_2026 = 'f1000000-0000-0000-0000-000000000001';
// Idris: forelder2@'s child, STOPPED, no class (seed.sql) — has zero
// class_students rows, so any unenroll target for him is a clean "no
// active enrollment" case with nothing to restore afterwards.
const STOPPED_STUDENT_NO_CLASS = 'fe000000-0000-0000-0000-000000000005';

function form(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) fd.append(key, v);
  }
  return fd;
}

beforeEach(() => {
  signOut();
});

describe('actions: guard order (role, then AAL2, then validation)', () => {
  it('turns a parent away before validating anything', async () => {
    signInAs('forelder@test.local');
    await expect(
      createTermAction({ error: null }, form({ navn: '' })),
    ).rejects.toThrow('NEXT_REDIRECT:/ingen-tilgang');
  });

  it('sends an AAL1 admin to MFA before validating anything', async () => {
    signInAs('admin@test.local');
    await expect(
      createTermAction({ error: null }, form({ navn: '' })),
    ).rejects.toThrow('NEXT_REDIRECT:/mfa/registrer');
  });
});

describe('actions: terms', () => {
  it('maps reversed dates to a field error', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(
      createTermAction(
        { error: null },
        form({ navn: 'Vinter 2027', start: '2027-06-01', slutt: '2027-01-01' }),
      ),
    ).resolves.toEqual({ error: 'Sluttdato må være etter startdato.' });
  });

  it('maps a duplicate name to a field error', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(
      createTermAction(
        { error: null },
        form({ navn: 'Høst 2026', start: '2027-08-14', slutt: '2027-12-19' }),
      ),
    ).resolves.toEqual({ error: 'En termin med dette navnet finnes allerede.' });
  });

  it('creates and deletes a term end-to-end', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(
      createTermAction(
        { error: null },
        form({ navn: 'Testtermin 2099', start: '2099-08-14', slutt: '2099-12-19' }),
      ),
    ).resolves.toEqual({ error: null, success: true });
    const client = await createServerClientMock();
    const { data: created } = await client
      .from('terms')
      .select('id')
      .eq('name', 'Testtermin 2099')
      .single();
    expect(created).not.toBeNull();
    await expect(
      deleteTermAction({ error: null }, form({ id: created!.id })),
    ).resolves.toEqual({ error: null, success: true });
  });

  it('switches the current term and back', async () => {
    await signInAsAAL2('admin@test.local');
    const client = await createServerClientMock();
    const { data: temp } = await client
      .from('terms')
      .insert({ name: 'Byttetermin 2098', starts_on: '2098-01-01', ends_on: '2098-06-01' })
      .select('id')
      .single();
    try {
      await setCurrentTermAction(form({ id: temp!.id }));
      const current = await getCurrentTerm();
      expect(current?.id).toBe(temp!.id);
    } finally {
      await setCurrentTermAction(form({ id: HOST_2026 }));
      await client.from('terms').delete().eq('id', temp!.id);
    }
    const restored = await getCurrentTerm();
    expect(restored?.name).toBe('Høst 2026');
  });
});

describe('actions: subjects and schedule', () => {
  it('maps a duplicate subject to a field error', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(
      createSubjectAction({ error: null }, form({ navn: 'Arabisk', sort: '4' })),
    ).resolves.toEqual({ error: 'Et fag med dette navnet finnes allerede.' });
  });

  it('maps a colliding schedule slot to a field error', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(
      addScheduleSlotAction(
        { error: null },
        form({ klasseId: K1, ukedag: '6', start: '10:00', slutt: '12:00' }),
      ),
    ).resolves.toEqual({ error: 'Det finnes allerede en økt på dette tidspunktet.' });
  });

  it('rejects reversed times at the validation layer', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(
      addScheduleSlotAction(
        { error: null },
        form({ klasseId: K1, ukedag: '3', start: '13:00', slutt: '10:00' }),
      ),
    ).resolves.toEqual({ error: 'Sluttid må være etter starttid.' });
  });
});

describe('actions: class teachers are pre-validated (no destructive delete)', () => {
  it('refuses a non-teacher and leaves the class untouched', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(
      saveClassTeachersAction(
        { error: null },
        form({
          klasseId: K1,
          laerere: ['77777777-7777-7777-7777-777777777777'], // forelder2: parent
        }),
      ),
    ).resolves.toEqual({ error: 'Valgt bruker er ikke lærer.' });
    const detail = await getClassForAdmin(K1);
    expect(detail?.teachers.map((t) => t.full_name)).toEqual(['Leila Ahmed']);
  });

  it('replaces and restores the teacher set', async () => {
    await signInAsAAL2('admin@test.local');
    try {
      await expect(
        saveClassTeachersAction(
          { error: null },
          form({
            klasseId: K1,
            laerere: [LAERER_ID, '66666666-6666-6666-6666-666666666666'],
          }),
        ),
      ).resolves.toEqual({ error: null, success: true });
      const detail = await getClassForAdmin(K1);
      expect(detail?.teachers).toHaveLength(2);
    } finally {
      await saveClassTeachersAction(
        { error: null },
        form({ klasseId: K1, laerere: [LAERER_ID] }),
      );
    }
    const restored = await getClassForAdmin(K1);
    expect(restored?.teachers.map((t) => t.full_name)).toEqual(['Leila Ahmed']);
  });
});

describe('actions: confirm affected rows and map stale-reference errors', () => {
  it('updateTermAction on a nonexistent id reports it is gone (no redirect)', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(
      updateTermAction(
        { error: null },
        form({
          id: crypto.randomUUID(),
          navn: 'Spøkelsestermin',
          start: '2027-01-01',
          slutt: '2027-06-01',
        }),
      ),
    ).resolves.toEqual({ error: 'Terminen finnes ikke lenger.' });
  });

  it('updateSubjectAction on a nonexistent id reports it is gone', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(
      updateSubjectAction(
        { error: null },
        form({ id: crypto.randomUUID(), navn: 'Spøkelsesfag', sort: '1' }),
      ),
    ).resolves.toEqual({ error: 'Faget finnes ikke lenger.' });
  });

  it('updateClassAction on a nonexistent id reports it is gone', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(
      updateClassAction(
        { error: null },
        form({ id: crypto.randomUUID(), navn: 'Spøkelsesklasse', rom: '' }),
      ),
    ).resolves.toEqual({ error: 'Klassen finnes ikke lenger.' });
  });

  it('setCurrentTermAction on a nonexistent id throws, leaving the previous term restorable', async () => {
    await signInAsAAL2('admin@test.local');
    // Statement 1 (clear old current) always runs and succeeds before
    // statement 2 fails on the bad id, so the current term must be
    // captured up front and restored here even if the assertion fails.
    const previous = await getCurrentTerm();
    try {
      await expect(
        setCurrentTermAction(form({ id: crypto.randomUUID() })),
      ).rejects.toThrow('Terminen finnes ikke lenger.');
    } finally {
      if (previous) {
        const client = await createServerClientMock();
        await client.from('terms').update({ is_current: true }).eq('id', previous.id);
      }
    }
  });

  it('createClassAction with a nonexistent term_id reports the term is gone', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(
      createClassAction(
        { error: null },
        form({ terminId: crypto.randomUUID(), navn: 'Spøkelsesklasse', rom: '' }),
      ),
    ).resolves.toEqual({ error: 'Terminen finnes ikke lenger.' });
  });

  it('addScheduleSlotAction with a nonexistent class id reports the class is gone', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(
      addScheduleSlotAction(
        { error: null },
        form({ klasseId: crypto.randomUUID(), ukedag: '2', start: '09:00', slutt: '10:00' }),
      ),
    ).resolves.toEqual({ error: 'Klassen finnes ikke lenger.' });
  });

  it('saveClassSubjectsAction with a nonexistent subject id reports the stale reference', async () => {
    await signInAsAAL2('admin@test.local');
    const client = await createServerClientMock();
    const { data: klasse } = await client
      .from('classes')
      .insert({ term_id: HOST_2026, name: 'Testklasse for fagvalidering', room: null })
      .select('id')
      .single();
    try {
      await expect(
        saveClassSubjectsAction(
          { error: null },
          form({ klasseId: klasse!.id, fag: [crypto.randomUUID()] }),
        ),
      ).resolves.toEqual({ error: 'Klassen eller ett av fagene finnes ikke lenger.' });
    } finally {
      await client.from('classes').delete().eq('id', klasse!.id);
    }
  });

  it('unenrollStudentAction for a student with no active enrollment in that class throws', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(
      unenrollStudentAction(form({ elevId: STOPPED_STUDENT_NO_CLASS, klasseId: K1 })),
    ).rejects.toThrow('Eleven har ingen aktiv plass i denne klassen.');
  });
});
```

- [ ] **Step 7: Verify GREEN, then commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run lint
npm test -- --run 2>&1 | tail -3
npm run test:api 2>&1 | tail -4
git add src/lib/validation/ src/lib/dates.ts src/lib/dates.test.ts 'src/app/(portal)/admin/terminer/actions.ts' 'src/app/(portal)/admin/fag/actions.ts' 'src/app/(portal)/admin/klasser/actions.ts' tests/api/school-actions.test.ts
git commit -m "feat: validated admin actions for terms, subjects, classes and schedule"
```

Expected: 96 Vitest; **99** test:api (80 + 19). NB: the actions are not yet reachable from any page — that is Tasks 11–12; wall-1 correctness is already fully proven here.

---

### Task 10: Registry actions — students, guardians, enrollment linking, student logins (SECURITY-CRITICAL)

These actions bridge the RLS session (registry writes) and the admin module (account provisioning + role grants). Link-by-e-mail is a two-step state machine: try to link an existing account; if none exists the form reveals a name field and provisions.

**Files:**
- Modify: `src/lib/validation/school.ts` (add `LinkFormState`)
- Create: `src/app/(portal)/admin/elever/actions.ts`
- Modify: `tests/api/school-actions.test.ts` (registry lifecycle describes)

- [ ] **Step 1: Add the link-form state type**

In `src/lib/validation/school.ts`, under `FormState`:

```ts
/** Link-by-e-mail forms: needsProvision reveals the provisioning fields. */
export interface LinkFormState extends FormState {
  needsProvision?: boolean;
}
```

- [ ] **Step 2: Write the failing lifecycle tests**

In `tests/api/school-actions.test.ts`, the module import block below the `vi.mock` preamble becomes (byte-exact; note `enrollStudentAction` merges into the EXISTING klasser import — a second import statement from that module would redeclare `unenrollStudentAction`):

```ts
import {
  addScheduleSlotAction,
  createClassAction,
  enrollStudentAction,
  saveClassSubjectsAction,
  saveClassTeachersAction,
  unenrollStudentAction,
  updateClassAction,
} from '@/app/(portal)/admin/klasser/actions';
import {
  createTermAction,
  deleteTermAction,
  setCurrentTermAction,
  updateTermAction,
} from '@/app/(portal)/admin/terminer/actions';
import { createSubjectAction, updateSubjectAction } from '@/app/(portal)/admin/fag/actions';
import {
  createStudentAction,
  deleteStudentAction,
  linkGuardianAction,
  linkStudentLoginAction,
  provisionGuardianAction,
  provisionStudentLoginAction,
  setGuardianPayerAction,
  unlinkGuardianAction,
  unlinkStudentLoginAction,
  updateStudentAction,
} from '@/app/(portal)/admin/elever/actions';
import { adminFindUserByEmail } from '@/lib/admin/users';
import { getClassForAdmin } from '@/lib/dal/classes';
import { getCurrentTerm } from '@/lib/dal/terms';
import {
  getStudentForAdmin,
  listStudentsWithoutActiveClass,
} from '@/lib/dal/students';
import { randomUUID } from 'node:crypto';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getPublicEnv } from '@/lib/env';
import { createServerClientMock, signInAs, signInAsAAL2, signOut } from './harness';
```

and append the describes:

```ts
const K3 = 'fc000000-0000-0000-0000-000000000002';

function scaffoldingServiceClient() {
  const env = getPublicEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY mangler i miljøet.');
  return createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function expectRedirect(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const match = (error as Error).message.match(/^NEXT_REDIRECT:(.+)$/);
    if (match) return match[1];
    throw error;
  }
  throw new Error('Forventet redirect, men handlingen returnerte.');
}

describe('actions: the registry lifecycle', () => {
  // This test performs ~25-30 sequential real round-trips against the local
  // stack (AAL2 sign-in's TOTP enroll/challenge/verify dance, then the full
  // create → guardian → enroll → move → provision-login → unlink → delete
  // chain). Measured in isolation at ~27s — comfortably over the file's
  // 15s default testTimeout (vitest.config.api.ts) but not a hang: raised
  // per-test rather than lifting the shared default for every test.
  it('create → guardian → enroll → move → login → delete', async () => {
    await signInAsAAL2('admin@test.local');
    const service = scaffoldingServiceClient();
    let studentId = '';
    let provisionedLoginId: string | null = null;
    try {
      // Create: the redirect carries the new id.
      const target = await expectRedirect(
        createStudentAction(
          { error: null },
          form({
            fornavn: 'Livssyklus',
            etternavn: 'Testelev',
            fodselsaar: '2014',
            notat: '',
          }),
        ),
      );
      studentId = target.replace('/admin/elever/', '');
      expect(studentId).toMatch(/^[0-9a-f-]{36}$/);

      // Guardian: link the existing forelder2 account.
      await expect(
        linkGuardianAction(
          { error: null },
          form({
            elevId: studentId,
            epost: 'forelder2@test.local',
            relasjon: 'far',
            betaler: 'on',
          }),
        ),
      ).resolves.toEqual({ error: null, success: true });
      await expect(
        linkGuardianAction(
          { error: null },
          form({
            elevId: studentId,
            epost: 'forelder2@test.local',
            relasjon: 'far',
            betaler: 'on',
          }),
        ),
      ).resolves.toEqual({ error: 'Allerede registrert som foresatt.' });

      // Enroll, refuse the double placement, move via leave + re-enroll.
      await expect(
        enrollStudentAction(
          { error: null },
          form({ elevId: studentId, klasseId: K1 }),
        ),
      ).resolves.toEqual({ error: null, success: true });
      await expect(
        enrollStudentAction(
          { error: null },
          form({ elevId: studentId, klasseId: K3 }),
        ),
      ).resolves.toEqual({ error: 'Eleven er allerede i en klasse.' });
      await unenrollStudentAction(form({ elevId: studentId, klasseId: K1 }));
      const unplaced = await listStudentsWithoutActiveClass();
      expect(unplaced.map((s) => s.student_id)).toContain(studentId);
      await expect(
        enrollStudentAction(
          { error: null },
          form({ elevId: studentId, klasseId: K3 }),
        ),
      ).resolves.toEqual({ error: null, success: true });

      // Student login: provision a fresh account, then unlink it.
      const loginEmail = `elev-${randomUUID()}@test.local`;
      await expect(
        provisionStudentLoginAction(
          { error: null },
          form({
            elevId: studentId,
            epost: loginEmail,
            fulltNavn: 'Livssyklus Testelev',
          }),
        ),
      ).resolves.toEqual({ error: null, success: true });
      const withLogin = await getStudentForAdmin(studentId);
      expect(withLogin?.has_login).toBe(true);
      const { data: provisioned } = await service.rpc('admin_lookup_user_by_email', {
        p_email: loginEmail,
      });
      provisionedLoginId = provisioned?.[0]?.user_id ?? null;
      expect(provisionedLoginId).not.toBeNull();
      await unlinkStudentLoginAction(form({ elevId: studentId }));
      const withoutLogin = await getStudentForAdmin(studentId);
      expect(withoutLogin?.has_login).toBe(false);

      // Delete: the student and its links disappear.
      const deleteTarget = await expectRedirect(
        deleteStudentAction(form({ id: studentId })),
      );
      expect(deleteTarget).toBe('/admin/elever');
      await expect(getStudentForAdmin(studentId)).resolves.toBeNull();
      studentId = '';
    } finally {
      if (studentId) {
        // The audit triggers make service-role deletes on students fail with
        // 42501 — surface that loudly instead of leaving silent residue, but
        // never throw from a finally (it would mask the primary failure).
        const { error } = await service.from('students').delete().eq('id', studentId);
        if (error) {
          console.error(
            'Lifecycle cleanup failed: scratch student row not deleted.',
            error.message,
          );
        }
      }
      if (provisionedLoginId) {
        await service.auth.admin.deleteUser(provisionedLoginId);
      }
    }
  }, 45000);

  it('offers provisioning when the guardian e-mail has no account', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(
      linkGuardianAction(
        { error: null },
        form({
          elevId: 'fe000000-0000-0000-0000-000000000001',
          epost: `ukjent-${randomUUID()}@test.local`,
          relasjon: 'mor',
          betaler: '',
        }),
      ),
    ).resolves.toEqual({ error: null, needsProvision: true });
  });

  it('points provisioning at linking when the e-mail already has an account', async () => {
    await signInAsAAL2('admin@test.local');
    const result = await provisionGuardianAction(
      { error: null },
      form({
        elevId: 'fe000000-0000-0000-0000-000000000001',
        epost: 'laerer@test.local',
        fulltNavn: 'Har Konto',
        relasjon: 'mor',
        betaler: '',
      }),
    );
    expect(result.error).toContain('har allerede en konto');
  });

  it('maps an out-of-range birth year to a field error', async () => {
    await signInAsAAL2('admin@test.local');
    const result = await updateStudentAction(
      { error: null },
      form({
        id: 'fe000000-0000-0000-0000-000000000001',
        fornavn: 'Yusuf',
        etternavn: 'Farah',
        fodselsaar: '1850',
        notat: '',
        status: 'active',
      }),
    );
    expect(result.error).toBe('Fødselsår må være mellom 1900 og 2100.');
  });

  it('turns a student login away from destructive registry actions', async () => {
    signInAs('elev@test.local');
    await expect(
      deleteStudentAction(form({ id: 'fe000000-0000-0000-0000-000000000001' })),
    ).rejects.toThrow('NEXT_REDIRECT:/ingen-tilgang');
  });
});

describe('actions: registry stale-reference guards', () => {
  it('updateStudentAction on a nonexistent id reports it is gone', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(
      updateStudentAction(
        { error: null },
        form({
          id: randomUUID(),
          fornavn: 'Spøkelse',
          etternavn: 'Elev',
          fodselsaar: '2014',
          notat: '',
          status: 'active',
        }),
      ),
    ).resolves.toEqual({ error: 'Eleven finnes ikke lenger.' });
  });

  it('setGuardianPayerAction on a nonexistent guardian-student pair reports it is gone', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(
      setGuardianPayerAction(
        form({ elevId: randomUUID(), guardianId: randomUUID(), betaler: 'true' }),
      ),
    ).rejects.toThrow('Foresatt-koblingen finnes ikke lenger.');
  });

  it('unlinkStudentLoginAction on a nonexistent student reports it is gone', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(
      unlinkStudentLoginAction(form({ elevId: randomUUID() })),
    ).rejects.toThrow('Eleven finnes ikke lenger.');
  });

  it('linkGuardianAction with a real guardian but a nonexistent student maps the stale FK', async () => {
    await signInAsAAL2('admin@test.local');
    // forelder2@test.local already holds the parent role (seed.sql) —
    // adminGrantRole is an idempotent upsert, so re-granting it here is a
    // harmless no-op and the insert itself fails on the student_id FK.
    await expect(
      linkGuardianAction(
        { error: null },
        form({
          elevId: randomUUID(),
          epost: 'forelder2@test.local',
          relasjon: 'mor',
          betaler: 'on',
        }),
      ),
    ).resolves.toEqual({ error: 'Eleven eller kontoen finnes ikke lenger.' });
  });

  it('provisionStudentLoginAction with a nonexistent student provisions the account then reports it gone', async () => {
    await signInAsAAL2('admin@test.local');
    const loginEmail = `elev-${randomUUID()}@test.local`;
    const service = scaffoldingServiceClient();
    try {
      await expect(
        provisionStudentLoginAction(
          { error: null },
          form({
            elevId: randomUUID(),
            epost: loginEmail,
            fulltNavn: 'Spøkelse Elev',
          }),
        ),
      ).resolves.toEqual({ error: 'Eleven finnes ikke lenger.' });
    } finally {
      // adminProvisionUser succeeds before linkLogin discovers the student
      // is gone, so the account is real and must be cleaned up here.
      const provisioned = await adminFindUserByEmail(loginEmail);
      if (provisioned) {
        await service.auth.admin.deleteUser(provisioned.userId);
      }
    }
  });
});

describe('actions: registry wall-1 sweep and role-grant coverage', () => {
  // Every exported registry action with a minimal invocation. The
  // requireStaffRole('admin') gate is each action's FIRST statement, so it
  // fires before any FormData parsing — empty forms are sufficient, and a
  // sweep failure means the gate itself moved or vanished.
  const registryActions: ReadonlyArray<[string, () => Promise<unknown>]> = [
    ['createStudentAction', () => createStudentAction({ error: null }, form({}))],
    ['updateStudentAction', () => updateStudentAction({ error: null }, form({}))],
    ['deleteStudentAction', () => deleteStudentAction(form({}))],
    ['linkGuardianAction', () => linkGuardianAction({ error: null }, form({}))],
    ['provisionGuardianAction', () => provisionGuardianAction({ error: null }, form({}))],
    ['unlinkGuardianAction', () => unlinkGuardianAction(form({}))],
    ['setGuardianPayerAction', () => setGuardianPayerAction(form({}))],
    ['linkStudentLoginAction', () => linkStudentLoginAction({ error: null }, form({}))],
    [
      'provisionStudentLoginAction',
      () => provisionStudentLoginAction({ error: null }, form({})),
    ],
    ['unlinkStudentLoginAction', () => unlinkStudentLoginAction(form({}))],
  ];

  // The outcome object carries the action's name into the assertion diff, so
  // a sweep failure names the culprit instead of pointing at the loop line.
  async function sweepOutcome(name: string, invoke: () => Promise<unknown>) {
    return invoke().then(
      (resolved) => ({ name, resolved }),
      (error: unknown) => ({ name, message: (error as Error).message }),
    );
  }

  // Timeouts: a 10-action sweep is 30+ real round-trips (the AAL1 sweep pays
  // a bcrypt password grant per action) — measured 12-14.4s in ISOLATION,
  // over the 15s default under full-suite load. Raised per test, like the
  // lifecycle test above, instead of lifting the file-wide default.
  it('turns an AAL2 teacher away from every registry action', async () => {
    await signInAsAAL2('laerer@test.local');
    for (const [name, invoke] of registryActions) {
      expect(await sweepOutcome(name, invoke)).toEqual({
        name,
        message: 'NEXT_REDIRECT:/ingen-tilgang',
      });
    }
  }, 30000);

  it('sends a password-only admin to MFA from every registry action', async () => {
    signInAs('admin@test.local');
    for (const [name, invoke] of registryActions) {
      expect(await sweepOutcome(name, invoke)).toEqual({
        name,
        message: expect.stringMatching(/^NEXT_REDIRECT:\/mfa\//),
      });
    }
  }, 30000);

  it('grants the parent role before inserting the guardian link, and unlink cleans up', async () => {
    await signInAsAAL2('admin@test.local');
    const service = scaffoldingServiceClient();
    // laerer@ holds ONLY the teacher role in the seed, so a successful link
    // proves adminGrantRole ran BEFORE the guardian_student insert — the
    // with_check would refuse a guardian who does not hold the parent role.
    const teacher = await adminFindUserByEmail('laerer@test.local');
    if (!teacher) throw new Error('laerer@test.local mangler i seeden.');
    let studentId = '';
    try {
      const target = await expectRedirect(
        createStudentAction(
          { error: null },
          form({
            fornavn: 'Rollebevis',
            etternavn: 'Testelev',
            fodselsaar: '2015',
            notat: '',
          }),
        ),
      );
      studentId = target.replace('/admin/elever/', '');

      await expect(
        linkGuardianAction(
          { error: null },
          form({
            elevId: studentId,
            epost: 'laerer@test.local',
            relasjon: 'mor',
            betaler: '',
          }),
        ),
      ).resolves.toEqual({ error: null, success: true });

      const { data: roleRows } = await service
        .from('user_roles')
        .select('role')
        .eq('user_id', teacher.userId)
        .eq('role', 'parent');
      expect(roleRows).toHaveLength(1);
      const { data: linkRows } = await service
        .from('guardian_student')
        .select('guardian_id')
        .eq('student_id', studentId)
        .eq('guardian_id', teacher.userId);
      expect(linkRows).toHaveLength(1);
    } finally {
      // Cleanup runs through the authenticated actions for the audited tables
      // (the service role cannot delete students/guardian_student rows) and
      // doubles as unlinkGuardianAction's happy-path coverage.
      if (studentId) {
        await unlinkGuardianAction(
          form({ elevId: studentId, guardianId: teacher.userId }),
        );
        const { data: leftover } = await service
          .from('guardian_student')
          .select('guardian_id')
          .eq('student_id', studentId)
          .eq('guardian_id', teacher.userId);
        expect(leftover).toHaveLength(0);
      }
      // Restore the seed invariant (laerer@ without parent). user_roles has no
      // audit trigger, so the service delete is sanctioned; deleting a row the
      // grant never created is a harmless 0-row delete.
      await service
        .from('user_roles')
        .delete()
        .eq('user_id', teacher.userId)
        .eq('role', 'parent');
      if (studentId) {
        await expectRedirect(deleteStudentAction(form({ id: studentId })));
      }
    }
  }, 30000);

  it('offers provisioning when the student-login e-mail has no account', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(
      linkStudentLoginAction(
        { error: null },
        form({
          elevId: 'fe000000-0000-0000-0000-000000000001',
          epost: `ukjent-${randomUUID()}@test.local`,
        }),
      ),
    ).resolves.toEqual({ error: null, needsProvision: true });
  });

  it('links an existing passwordless account as student login and grants the role', async () => {
    await signInAsAAL2('admin@test.local');
    const service = scaffoldingServiceClient();
    const loginEmail = `elev-${randomUUID()}@test.local`;
    let scratchUserId: string | null = null;
    let studentId = '';
    try {
      const { data: created, error: createError } = await service.auth.admin.createUser({
        email: loginEmail,
        email_confirm: true,
      });
      if (createError || !created.user) {
        throw new Error(
          `Klarte ikke å opprette scratch-brukeren: ${createError?.message ?? 'ukjent'}`,
        );
      }
      scratchUserId = created.user.id;

      const target = await expectRedirect(
        createStudentAction(
          { error: null },
          form({
            fornavn: 'Kobling',
            etternavn: 'Testelev',
            fodselsaar: '2013',
            notat: '',
          }),
        ),
      );
      studentId = target.replace('/admin/elever/', '');

      await expect(
        linkStudentLoginAction(
          { error: null },
          form({ elevId: studentId, epost: loginEmail }),
        ),
      ).resolves.toEqual({ error: null, success: true });

      const { data: studentRow } = await service
        .from('students')
        .select('student_user_id')
        .eq('id', studentId)
        .single();
      expect(studentRow?.student_user_id).toBe(scratchUserId);
      const { data: roleRows } = await service
        .from('user_roles')
        .select('role')
        .eq('user_id', scratchUserId)
        .eq('role', 'student');
      expect(roleRows).toHaveLength(1);
    } finally {
      if (studentId) {
        await unlinkStudentLoginAction(form({ elevId: studentId }));
        await expectRedirect(deleteStudentAction(form({ id: studentId })));
      }
      if (scratchUserId) {
        // Cascades the trigger-created profiles row and the granted role.
        await service.auth.admin.deleteUser(scratchUserId);
      }
    }
  }, 30000);
});
```

Run `npm run test:api 2>&1 | tail -5` — expect resolution failure for `@/app/(portal)/admin/elever/actions`.

- [ ] **Step 3: Implement the registry actions**

Create `src/app/(portal)/admin/elever/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  adminFindUserByEmail,
  adminGrantRole,
  adminProvisionUser,
  EmailAlreadyRegistered,
} from '@/lib/admin/users';
import { requireStaffRole } from '@/lib/dal/session';
import { createClient } from '@/lib/supabase/server';
import {
  firstIssue,
  guardianLinkSchema,
  guardianProvisionSchema,
  loginLinkSchema,
  loginProvisionSchema,
  studentSchema,
  uuidField,
  type FormState,
  type LinkFormState,
} from '@/lib/validation/school';

function studentFields(formData: FormData, status: string) {
  return {
    fornavn: formData.get('fornavn'),
    etternavn: formData.get('etternavn'),
    fodselsaar: formData.get('fodselsaar'),
    notat: formData.get('notat') ?? '',
    skjermet: formData.get('skjermet') === 'on',
    status,
  };
}

export async function createStudentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaffRole('admin');
  const parsed = studentSchema.safeParse(studentFields(formData, 'active'));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('students')
    .insert({
      first_name: parsed.data.fornavn,
      last_name: parsed.data.etternavn,
      birth_year: parsed.data.fodselsaar,
      note: parsed.data.notat,
      protected: parsed.data.skjermet,
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(`Kunne ikke registrere elev: ${error?.message ?? 'ukjent'}`);
  }
  revalidatePath('/admin/elever');
  redirect(`/admin/elever/${data.id}`);
}

export async function updateStudentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaffRole('admin');
  const id = uuidField.safeParse(formData.get('id'));
  const parsed = studentSchema.safeParse(
    studentFields(formData, String(formData.get('status') ?? '')),
  );
  if (!id.success) return { error: 'Ugyldig elev.' };
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('students')
    .update({
      first_name: parsed.data.fornavn,
      last_name: parsed.data.etternavn,
      birth_year: parsed.data.fodselsaar,
      note: parsed.data.notat,
      protected: parsed.data.skjermet,
      status: parsed.data.status,
    })
    .eq('id', id.data)
    .select('id');
  if (error) {
    throw new Error(`Kunne ikke oppdatere elev: ${error.message}`);
  }
  if (!data || data.length === 0) {
    return { error: 'Eleven finnes ikke lenger.' };
  }
  revalidatePath(`/admin/elever/${id.data}`);
  revalidatePath('/admin/elever');
  redirect(`/admin/elever/${id.data}`);
}

export async function deleteStudentAction(formData: FormData): Promise<void> {
  await requireStaffRole('admin');
  const id = uuidField.parse(formData.get('id'));
  const supabase = await createClient();
  const { error } = await supabase.from('students').delete().eq('id', id);
  if (error) {
    throw new Error(`Kunne ikke slette elev: ${error.message}`);
  }
  revalidatePath('/admin/elever');
  redirect('/admin/elever');
}

/** Step 1 of guardian linking: try the e-mail against existing accounts. */
export async function linkGuardianAction(
  _prev: LinkFormState,
  formData: FormData,
): Promise<LinkFormState> {
  await requireStaffRole('admin');
  const parsed = guardianLinkSchema.safeParse({
    elevId: formData.get('elevId'),
    epost: formData.get('epost'),
    relasjon: formData.get('relasjon'),
    betaler: formData.get('betaler') === 'on',
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const existing = await adminFindUserByEmail(parsed.data.epost);
  if (!existing) {
    return { error: null, needsProvision: true };
  }
  await adminGrantRole(existing.userId, 'parent');
  const supabase = await createClient();
  const { error } = await supabase.from('guardian_student').insert({
    guardian_id: existing.userId,
    student_id: parsed.data.elevId,
    relationship: parsed.data.relasjon,
    is_payer: parsed.data.betaler,
  });
  if (error) {
    if (error.code === '23505') {
      return { error: 'Allerede registrert som foresatt.' };
    }
    if (error.code === '23503') {
      return { error: 'Eleven eller kontoen finnes ikke lenger.' };
    }
    throw new Error(`Kunne ikke koble foresatt: ${error.message}`);
  }
  revalidatePath(`/admin/elever/${parsed.data.elevId}`);
  return { error: null, success: true };
}

/** Step 2: no account existed — provision one (password-less) and link. */
export async function provisionGuardianAction(
  _prev: LinkFormState,
  formData: FormData,
): Promise<LinkFormState> {
  await requireStaffRole('admin');
  const parsed = guardianProvisionSchema.safeParse({
    elevId: formData.get('elevId'),
    epost: formData.get('epost'),
    fulltNavn: formData.get('fulltNavn'),
    relasjon: formData.get('relasjon'),
    betaler: formData.get('betaler') === 'on',
  });
  if (!parsed.success) {
    return { error: firstIssue(parsed.error), needsProvision: true };
  }
  let userId: string;
  try {
    ({ userId } = await adminProvisionUser({
      email: parsed.data.epost,
      fullName: parsed.data.fulltNavn,
      roles: ['parent'],
    }));
  } catch (error) {
    if (error instanceof EmailAlreadyRegistered) {
      return {
        error: 'E-postadressen har allerede en konto — bruk «Koble til» i stedet.',
        needsProvision: true,
      };
    }
    throw error;
  }
  const supabase = await createClient();
  const { error } = await supabase.from('guardian_student').insert({
    guardian_id: userId,
    student_id: parsed.data.elevId,
    relationship: parsed.data.relasjon,
    is_payer: parsed.data.betaler,
  });
  if (error) {
    if (error.code === '23503') {
      return { error: 'Kontoen ble opprettet, men eleven finnes ikke lenger.' };
    }
    throw new Error(`Konto opprettet, men kobling feilet: ${error.message}`);
  }
  revalidatePath(`/admin/elever/${parsed.data.elevId}`);
  return { error: null, success: true };
}

export async function unlinkGuardianAction(formData: FormData): Promise<void> {
  await requireStaffRole('admin');
  const elevId = uuidField.parse(formData.get('elevId'));
  const guardianId = uuidField.parse(formData.get('guardianId'));
  const supabase = await createClient();
  const { error } = await supabase
    .from('guardian_student')
    .delete()
    .eq('student_id', elevId)
    .eq('guardian_id', guardianId);
  if (error) {
    throw new Error(`Kunne ikke fjerne foresatt: ${error.message}`);
  }
  revalidatePath(`/admin/elever/${elevId}`);
}

export async function setGuardianPayerAction(formData: FormData): Promise<void> {
  await requireStaffRole('admin');
  const elevId = uuidField.parse(formData.get('elevId'));
  const guardianId = uuidField.parse(formData.get('guardianId'));
  const betaler = formData.get('betaler') === 'true';
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('guardian_student')
    .update({ is_payer: betaler })
    .eq('student_id', elevId)
    .eq('guardian_id', guardianId)
    .select('student_id');
  if (error) {
    throw new Error(`Kunne ikke endre betaler: ${error.message}`);
  }
  if (!data || data.length === 0) {
    throw new Error('Foresatt-koblingen finnes ikke lenger.');
  }
  revalidatePath(`/admin/elever/${elevId}`);
}

/** Student-login linking mirrors the guardian machinery. */
export async function linkStudentLoginAction(
  _prev: LinkFormState,
  formData: FormData,
): Promise<LinkFormState> {
  await requireStaffRole('admin');
  const parsed = loginLinkSchema.safeParse({
    elevId: formData.get('elevId'),
    epost: formData.get('epost'),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const existing = await adminFindUserByEmail(parsed.data.epost);
  if (!existing) {
    return { error: null, needsProvision: true };
  }
  await adminGrantRole(existing.userId, 'student');
  return linkLogin(parsed.data.elevId, existing.userId);
}

export async function provisionStudentLoginAction(
  _prev: LinkFormState,
  formData: FormData,
): Promise<LinkFormState> {
  await requireStaffRole('admin');
  const parsed = loginProvisionSchema.safeParse({
    elevId: formData.get('elevId'),
    epost: formData.get('epost'),
    fulltNavn: formData.get('fulltNavn'),
  });
  if (!parsed.success) {
    return { error: firstIssue(parsed.error), needsProvision: true };
  }
  try {
    const { userId } = await adminProvisionUser({
      email: parsed.data.epost,
      fullName: parsed.data.fulltNavn,
      roles: ['student'],
    });
    return await linkLogin(parsed.data.elevId, userId);
  } catch (error) {
    if (error instanceof EmailAlreadyRegistered) {
      return {
        error: 'E-postadressen har allerede en konto — bruk «Koble til» i stedet.',
        needsProvision: true,
      };
    }
    throw error;
  }
}

async function linkLogin(elevId: string, userId: string): Promise<LinkFormState> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('students')
    .update({ student_user_id: userId })
    .eq('id', elevId)
    .select('id');
  if (error) {
    if (error.code === '23505') {
      return { error: 'Denne kontoen er allerede koblet til en annen elev.' };
    }
    throw new Error(`Kunne ikke koble elevinnlogging: ${error.message}`);
  }
  if (!data || data.length === 0) {
    return { error: 'Eleven finnes ikke lenger.' };
  }
  revalidatePath(`/admin/elever/${elevId}`);
  return { error: null, success: true };
}

export async function unlinkStudentLoginAction(formData: FormData): Promise<void> {
  await requireStaffRole('admin');
  const elevId = uuidField.parse(formData.get('elevId'));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('students')
    .update({ student_user_id: null })
    .eq('id', elevId)
    .select('id');
  if (error) {
    throw new Error(`Kunne ikke fjerne elevinnlogging: ${error.message}`);
  }
  if (!data || data.length === 0) {
    throw new Error('Eleven finnes ikke lenger.');
  }
  revalidatePath(`/admin/elever/${elevId}`);
  // Deliberately does NOT revoke the student role — role revocation is a
  // ledger item (needs a "last student link?" decision).
}
```

- [ ] **Step 4: Verify GREEN, then commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run lint
npm run test:api 2>&1 | tail -4
git add src/lib/validation/school.ts 'src/app/(portal)/admin/elever/actions.ts' tests/api/school-actions.test.ts
git commit -m "feat: registry actions for students, guardians, enrollment and student logins"
```

Expected: **114** test:api (99 + 15 new tests). The security review MUST verify live: the lifecycle audit trail (`students.insert` → `guardian_student.insert` → `class_students.*` → `admin.user.provisioned` → `students.delete`, all with the admin as actor) and that `adminGrantRole` runs BEFORE the `guardian_student` insert so the with_check invariant never fires for the happy path.

---

### Task 11: Admin UI — navigation, terms and subjects pages

Design context (read before writing UI): repo `DESIGN.md`, `src/app/globals.css` tokens, the primitives in `src/components/ui/`. Patterns for this and every UI task: list rows in `divide-y divide-hairline rounded-lg border border-hairline` containers (the admin-dashboard idiom), forms as client components with `useActionState` + a single `role="alert"` error line, teaching `EmptyState`s, `min-h-11` targets, no design-ban violations. This task also lands the T12-ledger `PillLink` primitive (rule of three: RoleSwitcher + AdminNav + row links).

**Files:**
- Create: `src/components/ui/PillLink.tsx`
- Modify: `src/components/shell/RoleSwitcher.tsx` (use PillLink — byte-equal styling)
- Create: `src/app/(portal)/admin/AdminNav.tsx`
- Modify: `src/app/(portal)/admin/layout.tsx` (render AdminNav above children)
- Create: `src/app/(portal)/admin/terminer/page.tsx`, `src/app/(portal)/admin/terminer/[id]/page.tsx`, `src/app/(portal)/admin/terminer/TermForms.tsx`
- Create: `src/app/(portal)/admin/fag/page.tsx`, `src/app/(portal)/admin/fag/SubjectForms.tsx`

- [ ] **Step 1: PillLink + RoleSwitcher migration**

Create `src/components/ui/PillLink.tsx`:

```tsx
import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/**
 * Pill-shaped nav/action link (T12-ledger rule-of-three: RoleSwitcher,
 * AdminNav and list-row links share this). `active` = filled primary.
 */
export function PillLink({
  active = false,
  className,
  ...rest
}: ComponentProps<typeof Link> & { active?: boolean }) {
  return (
    <Link
      {...rest}
      className={cn(
        'inline-flex min-h-11 items-center rounded-pill px-4 text-sm font-medium',
        'transition-colors duration-200 ease-brand',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        active
          ? 'bg-primary text-on-primary'
          : 'bg-surface-tint text-ink hover:bg-hairline',
        className,
      )}
    />
  );
}
```

In `src/components/shell/RoleSwitcher.tsx`, replace the `<Link …className={cn(…)}>` block with (imports: drop `Link` + `cn`, add `PillLink`):

```tsx
            <PillLink
              href={PORTAL_PATHS[role]}
              active={role === activeRole}
              aria-current={role === activeRole ? 'page' : undefined}
            >
              {PORTAL_LABELS[role]}
            </PillLink>
```

- [ ] **Step 2: AdminNav**

Create `src/app/(portal)/admin/AdminNav.tsx`:

```tsx
'use client';

import { usePathname } from 'next/navigation';
import { PillLink } from '@/components/ui/PillLink';

const ITEMS = [
  { href: '/admin', label: 'Oversikt', exact: true },
  { href: '/admin/elever', label: 'Elever', exact: false },
  { href: '/admin/klasser', label: 'Klasser', exact: false },
  { href: '/admin/fag', label: 'Fag', exact: false },
  { href: '/admin/terminer', label: 'Terminer', exact: false },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Administrasjon">
      <ul className="flex flex-wrap gap-2">
        {ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <PillLink
                href={item.href}
                active={active}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </PillLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

In `src/app/(portal)/admin/layout.tsx`, wrap the children:

```tsx
import { AdminNav } from './AdminNav';
// …
    >
      <div className="flex flex-col gap-6">
        <AdminNav />
        {children}
      </div>
    </PortalShell>
```

- [ ] **Step 3: Terms pages**

Create `src/app/(portal)/admin/terminer/TermForms.tsx`:

```tsx
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import type { Term } from '@/lib/dal/terms';
import { idleForm } from '@/lib/validation/school';
import {
  createTermAction,
  deleteTermAction,
  setCurrentTermAction,
  updateTermAction,
} from './actions';

function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm text-danger-ink">
      {error}
    </p>
  );
}

export function TermCreateForm() {
  const [state, formAction, pending] = useActionState(createTermAction, idleForm);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={formAction} className="flex max-w-xl flex-col gap-4">
      <Field label="Navn" htmlFor="term-navn">
        <Input id="term-navn" name="navn" required maxLength={60} placeholder="Høst 2026" />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Startdato" htmlFor="term-start">
          <Input id="term-start" name="start" type="date" required />
        </Field>
        <Field label="Sluttdato" htmlFor="term-slutt">
          <Input id="term-slutt" name="slutt" type="date" required />
        </Field>
      </div>
      <FormError error={state.error} />
      <div>
        <Button type="submit" loading={pending}>
          Opprett termin
        </Button>
      </div>
    </form>
  );
}

export function TermEditForm({ term }: { term: Term }) {
  const [state, formAction, pending] = useActionState(updateTermAction, idleForm);
  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="id" value={term.id} />
      <Field label="Navn" htmlFor="term-navn">
        <Input id="term-navn" name="navn" defaultValue={term.name} required maxLength={60} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Startdato" htmlFor="term-start">
          <Input id="term-start" name="start" type="date" defaultValue={term.starts_on} required />
        </Field>
        <Field label="Sluttdato" htmlFor="term-slutt">
          <Input id="term-slutt" name="slutt" type="date" defaultValue={term.ends_on} required />
        </Field>
      </div>
      <FormError error={state.error} />
      <div>
        <Button type="submit" loading={pending}>
          Lagre endringer
        </Button>
      </div>
    </form>
  );
}

export function SetCurrentTermForm({ termId }: { termId: string }) {
  return (
    <form action={setCurrentTermAction}>
      <input type="hidden" name="id" value={termId} />
      <Button type="submit" variant="secondary">
        Sett som nåværende
      </Button>
    </form>
  );
}

/** Two-step confirm — no browser confirm() (spec §7 interaction states). */
export function DeleteTermForm({ termId }: { termId: string }) {
  const [state, formAction, pending] = useActionState(deleteTermAction, idleForm);
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button variant="ghost" onClick={() => setConfirming(true)}>
        Slett
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={formAction}>
        <input type="hidden" name="id" value={termId} />
        <Button type="submit" variant="secondary" loading={pending} className="text-danger-ink">
          Bekreft sletting
        </Button>
      </form>
      <Button variant="ghost" onClick={() => setConfirming(false)}>
        Avbryt
      </Button>
      <FormError error={state.error} />
    </div>
  );
}
```

Create `src/app/(portal)/admin/terminer/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { PillLink } from '@/components/ui/PillLink';
import { listTerms } from '@/lib/dal/terms';
import { formatDateNb } from '@/lib/dates';
import { DeleteTermForm, SetCurrentTermForm, TermCreateForm } from './TermForms';

export const metadata: Metadata = { title: 'Terminer' };

export default async function TerminerPage() {
  const terms = await listTerms();
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Terminer</h1>
      {terms.length === 0 ? (
        <EmptyState
          title="Ingen terminer ennå"
          description="Opprett skoleårets første termin nedenfor — hver klasse hører til en termin."
        />
      ) : (
        <ul className="divide-y divide-hairline rounded-lg border border-hairline">
          {terms.map((term) => (
            <li
              key={term.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
            >
              <div className="min-w-44">
                <p className="font-medium">{term.name}</p>
                <p className="text-sm text-ink/60">
                  {formatDateNb(term.starts_on)} – {formatDateNb(term.ends_on)}
                </p>
              </div>
              {term.is_current ? <Chip tone="success">Nåværende</Chip> : null}
              <div className="ms-auto flex flex-wrap items-center gap-2">
                {!term.is_current ? <SetCurrentTermForm termId={term.id} /> : null}
                <PillLink href={`/admin/terminer/${term.id}`}>Rediger</PillLink>
                <DeleteTermForm termId={term.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Ny termin</h2>
        <TermCreateForm />
      </section>
    </div>
  );
}
```

Create `src/app/(portal)/admin/terminer/[id]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listTerms } from '@/lib/dal/terms';
import { TermEditForm } from '../TermForms';

export const metadata: Metadata = { title: 'Rediger termin' };

export default async function RedigerTerminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const term = (await listTerms()).find((t) => t.id === id);
  if (!term) notFound();
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Rediger {term.name}</h1>
      <TermEditForm term={term} />
    </div>
  );
}
```

- [ ] **Step 4: Subjects page**

Create `src/app/(portal)/admin/fag/SubjectForms.tsx`:

```tsx
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import type { Subject } from '@/lib/dal/subjects';
import { idleForm } from '@/lib/validation/school';
import { createSubjectAction, deleteSubjectAction, updateSubjectAction } from './actions';

function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm text-danger-ink">
      {error}
    </p>
  );
}

function SubjectFields({ subject }: { subject?: Subject }) {
  const suffix = subject?.id ?? 'ny';
  return (
    <div className="flex flex-wrap items-end gap-4">
      <Field label="Fagnavn" htmlFor={`fag-navn-${suffix}`}>
        <Input
          id={`fag-navn-${suffix}`}
          name="navn"
          defaultValue={subject?.name}
          required
          maxLength={60}
          placeholder="Arabisk"
          className="w-56"
        />
      </Field>
      <Field label="Sortering" htmlFor={`fag-sort-${suffix}`}>
        <Input
          id={`fag-sort-${suffix}`}
          name="sort"
          type="number"
          min={0}
          max={999}
          defaultValue={subject?.sort ?? 0}
          required
          className="w-24"
        />
      </Field>
      <label className="flex min-h-11 items-center gap-2 text-base">
        <input
          type="checkbox"
          name="koranspor"
          defaultChecked={subject?.quran_tracking}
          className="size-5 accent-primary"
        />
        Koran-sporing
      </label>
    </div>
  );
}

export function SubjectCreateForm() {
  const [state, formAction, pending] = useActionState(createSubjectAction, idleForm);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <SubjectFields />
      <FormError error={state.error} />
      <div>
        <Button type="submit" loading={pending}>
          Legg til fag
        </Button>
      </div>
    </form>
  );
}

export function SubjectRow({ subject }: { subject: Subject }) {
  const [editing, setEditing] = useState(false);
  const [editState, editAction, editPending] = useActionState(
    updateSubjectAction,
    idleForm,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteSubjectAction,
    idleForm,
  );
  const [confirming, setConfirming] = useState(false);

  // Collapse the edit form when the action reports success — state is
  // adjusted during render (React's recommended pattern; the repo's lint
  // rules forbid synchronous setState inside effects).
  const [prevEditState, setPrevEditState] = useState(editState);
  if (prevEditState !== editState) {
    setPrevEditState(editState);
    if (editState.success) setEditing(false);
  }

  if (editing) {
    return (
      <li className="flex flex-col gap-3 px-4 py-3">
        <form action={editAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={subject.id} />
          <SubjectFields subject={subject} />
          <FormError error={editState.error} />
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" loading={editPending}>
              Lagre
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Avbryt
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <p className="min-w-40 font-medium">{subject.name}</p>
      {subject.quran_tracking ? <Chip tone="success">Koran-sporing</Chip> : null}
      <span className="text-sm text-ink/60">Sortering {subject.sort}</span>
      <div className="ms-auto flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={() => setEditing(true)}>
          Rediger
        </Button>
        {confirming ? (
          <>
            <form action={deleteAction}>
              <input type="hidden" name="id" value={subject.id} />
              <Button
                type="submit"
                variant="secondary"
                loading={deletePending}
                className="text-danger-ink"
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
      <FormError error={deleteState.error} />
    </li>
  );
}
```

Create `src/app/(portal)/admin/fag/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';
import { listSubjects } from '@/lib/dal/subjects';
import { SubjectCreateForm, SubjectRow } from './SubjectForms';

export const metadata: Metadata = { title: 'Fag' };

export default async function FagPage() {
  const subjects = await listSubjects();
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Fag</h1>
      {subjects.length === 0 ? (
        <EmptyState
          title="Ingen fag ennå"
          description="Legg til fagene skolen underviser i — de kobles til klassene og brukes i vurdering senere."
        />
      ) : (
        <ul className="divide-y divide-hairline rounded-lg border border-hairline">
          {subjects.map((subject) => (
            <SubjectRow key={subject.id} subject={subject} />
          ))}
        </ul>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Nytt fag</h2>
        <SubjectCreateForm />
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Verify (typecheck, build, live browser), then commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run lint && npm test -- --run 2>&1 | tail -3
npm run build 2>&1 | tail -5
rm -rf .next && npm run dev
```

Browser check (header gotcha 17 for the TOTP code): log in as `admin@test.local` / `test-passord-123`, complete MFA enrollment, then visit `/admin/terminer` and `/admin/fag`. Verify: AdminNav pills with correct active state; «Høst 2026» listed with the green «Nåværende» chip; create a term «Vår 2027» (form clears on success), edit it, delete it; duplicate-name create shows the inline error; add subject «Test-fag», edit its sort, delete it; deleting «Arabisk» shows «Faget er i bruk …» inline (linked to classes). Keyboard-only pass: every pill/button reachable with a visible ring.

Expected: typecheck + lint silent · 96 unit · clean build · every walkthrough item observed live.

```bash
cd /Users/daodilyas/dev/iqra-portal
git add src/components/ui/PillLink.tsx src/components/shell/RoleSwitcher.tsx 'src/app/(portal)/admin/AdminNav.tsx' 'src/app/(portal)/admin/layout.tsx' 'src/app/(portal)/admin/terminer/' 'src/app/(portal)/admin/fag/'
git commit -m "feat: admin navigation with terms and subjects management pages"
```

---

### Task 12: Admin UI — class management

**Files:**
- Create: `src/app/(portal)/admin/klasser/page.tsx`, `src/app/(portal)/admin/klasser/ny/page.tsx`, `src/app/(portal)/admin/klasser/[id]/page.tsx`, `src/app/(portal)/admin/klasser/ClassForms.tsx`

- [ ] **Step 1: Class forms (client)**

Create `src/app/(portal)/admin/klasser/ClassForms.tsx`:

```tsx
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import type { Term } from '@/lib/dal/terms';
import type { Subject } from '@/lib/dal/subjects';
import type { RoleUser } from '@/lib/dal/users';
import { idleForm, WEEKDAY_LABELS } from '@/lib/validation/school';
import {
  addScheduleSlotAction,
  createClassAction,
  deleteClassAction,
  enrollStudentAction,
  removeScheduleSlotAction,
  saveClassSubjectsAction,
  saveClassTeachersAction,
  unenrollStudentAction,
  updateClassAction,
} from './actions';

function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm text-danger-ink">
      {error}
    </p>
  );
}

const selectClasses =
  'min-h-11 w-full rounded-md border border-border-input bg-canvas px-4 text-base text-ink ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export function ClassCreateForm({ terms }: { terms: Term[] }) {
  const [state, formAction, pending] = useActionState(createClassAction, idleForm);
  const defaultTerm = terms.find((t) => t.is_current) ?? terms[0];
  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <Field label="Termin" htmlFor="klasse-termin">
        <select
          id="klasse-termin"
          name="terminId"
          defaultValue={defaultTerm?.id}
          required
          className={selectClasses}
        >
          {terms.map((term) => (
            <option key={term.id} value={term.id}>
              {term.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Klassenavn" htmlFor="klasse-navn">
        <Input id="klasse-navn" name="navn" required maxLength={60} placeholder="Klasse 1" />
      </Field>
      <Field label="Rom (valgfritt)" htmlFor="klasse-rom">
        <Input id="klasse-rom" name="rom" maxLength={40} placeholder="Rom 2" />
      </Field>
      <FormError error={state.error} />
      <div>
        <Button type="submit" loading={pending}>
          Opprett klasse
        </Button>
      </div>
    </form>
  );
}

export function ClassMetaForm({
  klasseId,
  name,
  room,
}: {
  klasseId: string;
  name: string;
  room: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateClassAction, idleForm);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-4">
      <input type="hidden" name="id" value={klasseId} />
      <Field label="Klassenavn" htmlFor="meta-navn">
        <Input id="meta-navn" name="navn" defaultValue={name} required maxLength={60} className="w-56" />
      </Field>
      <Field label="Rom" htmlFor="meta-rom">
        <Input id="meta-rom" name="rom" defaultValue={room ?? ''} maxLength={40} className="w-40" />
      </Field>
      <Button type="submit" variant="secondary" loading={pending}>
        Lagre
      </Button>
      <FormError error={state.error} />
    </form>
  );
}

export function ClassTeachersForm({
  klasseId,
  allTeachers,
  selectedIds,
}: {
  klasseId: string;
  allTeachers: RoleUser[];
  selectedIds: string[];
}) {
  const [state, formAction, pending] = useActionState(
    saveClassTeachersAction,
    idleForm,
  );
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="klasseId" value={klasseId} />
      <ul className="flex flex-col gap-1">
        {allTeachers.map((teacher) => (
          <li key={teacher.user_id}>
            <label className="flex min-h-11 items-center gap-3 text-base">
              <input
                type="checkbox"
                name="laerere"
                value={teacher.user_id}
                defaultChecked={selectedIds.includes(teacher.user_id)}
                className="size-5 accent-primary"
              />
              {teacher.full_name}
            </label>
          </li>
        ))}
      </ul>
      <FormError error={state.error} />
      <div>
        <Button type="submit" variant="secondary" loading={pending}>
          Lagre lærere
        </Button>
      </div>
    </form>
  );
}

export function ClassSubjectsForm({
  klasseId,
  allSubjects,
  selectedIds,
}: {
  klasseId: string;
  allSubjects: Subject[];
  selectedIds: string[];
}) {
  const [state, formAction, pending] = useActionState(
    saveClassSubjectsAction,
    idleForm,
  );
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="klasseId" value={klasseId} />
      <ul className="flex flex-col gap-1">
        {allSubjects.map((subject) => (
          <li key={subject.id}>
            <label className="flex min-h-11 items-center gap-3 text-base">
              <input
                type="checkbox"
                name="fag"
                value={subject.id}
                defaultChecked={selectedIds.includes(subject.id)}
                className="size-5 accent-primary"
              />
              {subject.name}
            </label>
          </li>
        ))}
      </ul>
      <FormError error={state.error} />
      <div>
        <Button type="submit" variant="secondary" loading={pending}>
          Lagre fag
        </Button>
      </div>
    </form>
  );
}

export function AddSlotForm({ klasseId }: { klasseId: string }) {
  const [state, formAction, pending] = useActionState(addScheduleSlotAction, idleForm);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-4">
      <input type="hidden" name="klasseId" value={klasseId} />
      <Field label="Ukedag" htmlFor="slot-ukedag">
        <select id="slot-ukedag" name="ukedag" required defaultValue="6" className={selectClasses}>
          {Object.entries(WEEKDAY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Fra" htmlFor="slot-start">
        <Input id="slot-start" name="start" type="time" required className="w-32" />
      </Field>
      <Field label="Til" htmlFor="slot-slutt">
        <Input id="slot-slutt" name="slutt" type="time" required className="w-32" />
      </Field>
      <Button type="submit" variant="secondary" loading={pending}>
        Legg til økt
      </Button>
      <FormError error={state.error} />
    </form>
  );
}

export function RemoveSlotForm({
  klasseId,
  weekday,
  startsAt,
}: {
  klasseId: string;
  weekday: number;
  startsAt: string;
}) {
  return (
    <form action={removeScheduleSlotAction}>
      <input type="hidden" name="klasseId" value={klasseId} />
      <input type="hidden" name="ukedag" value={weekday} />
      <input type="hidden" name="start" value={startsAt} />
      <Button type="submit" variant="ghost">
        Fjern
      </Button>
    </form>
  );
}

export function EnrollForm({
  klasseId,
  candidates,
}: {
  klasseId: string;
  candidates: { student_id: string; first_name: string; last_name: string }[];
}) {
  const [state, formAction, pending] = useActionState(enrollStudentAction, idleForm);
  if (candidates.length === 0) {
    return (
      <p className="text-sm text-ink/60">
        Alle aktive elever er allerede plassert i en klasse.
      </p>
    );
  }
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-4">
      <input type="hidden" name="klasseId" value={klasseId} />
      <Field label="Meld inn elev" htmlFor="enroll-elev">
        <select id="enroll-elev" name="elevId" required className={selectClasses}>
          {candidates.map((s) => (
            <option key={s.student_id} value={s.student_id}>
              {s.first_name} {s.last_name}
            </option>
          ))}
        </select>
      </Field>
      <Button type="submit" variant="secondary" loading={pending}>
        Meld inn
      </Button>
      <FormError error={state.error} />
    </form>
  );
}

export function UnenrollForm({
  klasseId,
  elevId,
}: {
  klasseId: string;
  elevId: string;
}) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button variant="ghost" onClick={() => setConfirming(true)}>
        Meld ut
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <form action={unenrollStudentAction}>
        <input type="hidden" name="klasseId" value={klasseId} />
        <input type="hidden" name="elevId" value={elevId} />
        <Button type="submit" variant="secondary" className="text-danger-ink">
          Bekreft utmelding
        </Button>
      </form>
      <Button variant="ghost" onClick={() => setConfirming(false)}>
        Avbryt
      </Button>
    </div>
  );
}

export function DeleteClassForm({ klasseId }: { klasseId: string }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button variant="ghost" onClick={() => setConfirming(true)}>
        Slett klassen
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={deleteClassAction}>
        <input type="hidden" name="id" value={klasseId} />
        <Button type="submit" variant="secondary" className="text-danger-ink">
          Bekreft — sletter også klassemedlemskap
        </Button>
      </form>
      <Button variant="ghost" onClick={() => setConfirming(false)}>
        Avbryt
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Class pages**

Create `src/app/(portal)/admin/klasser/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { PillLink } from '@/components/ui/PillLink';
import { listClassesForAdmin } from '@/lib/dal/classes';

export const metadata: Metadata = { title: 'Klasser' };

export default async function KlasserPage() {
  const classes = await listClassesForAdmin();
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-semibold">Klasser</h1>
        <PillLink href="/admin/klasser/ny" className="ms-auto">
          Ny klasse
        </PillLink>
      </div>
      {classes.length === 0 ? (
        <EmptyState
          title="Ingen klasser ennå"
          description="Opprett den første klassen og knytt lærere, fag og timeplan til den."
        />
      ) : (
        <ul className="divide-y divide-hairline rounded-lg border border-hairline">
          {classes.map((cls) => (
            <li
              key={cls.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
            >
              <div className="min-w-44">
                <PillLink href={`/admin/klasser/${cls.id}`} className="-ms-4 bg-transparent hover:bg-surface-tint">
                  {cls.name}
                </PillLink>
                <p className="ps-0 text-sm text-ink/60">
                  {cls.teacher_names.length > 0
                    ? cls.teacher_names.join(', ')
                    : 'Ingen lærer ennå'}
                </p>
              </div>
              {!cls.term_is_current ? <Chip>{cls.term_name}</Chip> : null}
              {cls.room ? <span className="text-sm text-ink/60">{cls.room}</span> : null}
              <span className="ms-auto text-sm tabular-nums text-ink/70">
                {cls.active_count} elever
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

Create `src/app/(portal)/admin/klasser/ny/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';
import { PillLink } from '@/components/ui/PillLink';
import { listTerms } from '@/lib/dal/terms';
import { ClassCreateForm } from '../ClassForms';

export const metadata: Metadata = { title: 'Ny klasse' };

export default async function NyKlassePage() {
  const terms = await listTerms();
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Ny klasse</h1>
      {terms.length === 0 ? (
        <EmptyState
          title="Opprett en termin først"
          description="Hver klasse hører til en termin. Opprett terminen, og kom tilbake hit."
          action={<PillLink href="/admin/terminer">Til terminer</PillLink>}
        />
      ) : (
        <ClassCreateForm terms={terms} />
      )}
    </div>
  );
}
```

Create `src/app/(portal)/admin/klasser/[id]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Chip } from '@/components/ui/Chip';
import { getClassForAdmin } from '@/lib/dal/classes';
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

export const metadata: Metadata = { title: 'Klasse' };

export default async function KlassePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getClassForAdmin(id);
  if (!detail) notFound();
  const [teachers, subjects, candidates] = await Promise.all([
    listUsersWithRole('teacher'),
    listSubjects(),
    listStudentsWithoutActiveClass(),
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
        <h2 className="text-lg font-semibold">
          Elever <span className="tabular-nums text-ink/60">({detail.active_roster.length})</span>
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
                <span className="text-sm tabular-nums text-ink/60">f. {row.birth_year}</span>
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
                  {row.first_name} {row.last_name} — sluttet {formatDateNb(row.left_on ?? row.enrolled_on)}
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

- [ ] **Step 3: Verify (typecheck, build, live browser), then commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run lint && npm run build 2>&1 | tail -5
rm -rf .next && npm run dev
```

Browser check as AAL2 admin: `/admin/klasser` lists Klasse 1 (Leila Ahmed, 2 elever) and Klasse 3; open Klasse 1: rename round-trip; check/uncheck teachers incl. the «Valgt bruker er ikke lærer»-path being impossible from the UI (only teacher-role users listed); toggle a subject; add a Sunday slot then remove it; enroll picker states «Alle aktive elever er allerede plassert»; unenroll Yusuf (two-step), see him under candidates, re-enroll him; Zaynab shows the «Skjermet» chip inside Klasse 3 admin roster. Create + delete a scratch class end-to-end.

```bash
cd /Users/daodilyas/dev/iqra-portal
git add 'src/app/(portal)/admin/klasser/'
git commit -m "feat: class management pages with teachers, subjects, schedule and roster"
```

---

### Task 13: Admin UI — student registry + registration

**Files:**
- Create: `src/app/(portal)/admin/elever/page.tsx`, `src/app/(portal)/admin/elever/ny/page.tsx`, `src/app/(portal)/admin/elever/StudentForms.tsx`

- [ ] **Step 1: Student forms (client)**

Create `src/app/(portal)/admin/elever/StudentForms.tsx`:

```tsx
'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import type { AdminStudentDetail } from '@/lib/dal/students';
import { idleForm, STATUS_LABELS } from '@/lib/validation/school';
import { createStudentAction, deleteStudentAction, updateStudentAction } from './actions';

export function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm text-danger-ink">
      {error}
    </p>
  );
}

export const selectClasses =
  'min-h-11 w-full rounded-md border border-border-input bg-canvas px-4 text-base text-ink ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const textareaClasses =
  'min-h-24 w-full rounded-md border border-border-input bg-canvas px-4 py-3 text-base text-ink ' +
  'placeholder:text-ink/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

function StudentFields({ student }: { student?: AdminStudentDetail }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Fornavn" htmlFor="elev-fornavn">
          <Input
            id="elev-fornavn"
            name="fornavn"
            defaultValue={student?.first_name}
            required
            maxLength={60}
          />
        </Field>
        <Field label="Etternavn" htmlFor="elev-etternavn">
          <Input
            id="elev-etternavn"
            name="etternavn"
            defaultValue={student?.last_name}
            required
            maxLength={60}
          />
        </Field>
      </div>
      <Field label="Fødselsår" htmlFor="elev-fodselsaar">
        <Input
          id="elev-fodselsaar"
          name="fodselsaar"
          type="number"
          min={1900}
          max={2100}
          defaultValue={student?.birth_year}
          required
          placeholder="2015"
          className="w-32"
        />
      </Field>
      <Field label="Notat (kort og saklig — aldri sensitivt innhold)" htmlFor="elev-notat">
        <textarea
          id="elev-notat"
          name="notat"
          defaultValue={student?.note ?? ''}
          maxLength={2000}
          className={textareaClasses}
        />
      </Field>
      <label className="flex min-h-11 items-center gap-3 text-base">
        <input
          type="checkbox"
          name="skjermet"
          defaultChecked={student?.protected}
          className="size-5 accent-primary"
        />
        Skjermet elev (holdes utenfor eksporter og alle flater utenfor egen
        lærer og administrasjonen)
      </label>
    </>
  );
}

export function StudentCreateForm() {
  const [state, formAction, pending] = useActionState(createStudentAction, idleForm);
  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <StudentFields />
      <FormError error={state.error} />
      <div>
        <Button type="submit" loading={pending}>
          Registrer elev
        </Button>
      </div>
    </form>
  );
}

export function StudentEditForm({ student }: { student: AdminStudentDetail }) {
  const [state, formAction, pending] = useActionState(updateStudentAction, idleForm);
  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="id" value={student.student_id} />
      <StudentFields student={student} />
      <Field label="Status" htmlFor="elev-status">
        <select
          id="elev-status"
          name="status"
          defaultValue={student.status}
          className={selectClasses}
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <FormError error={state.error} />
      <div>
        <Button type="submit" loading={pending}>
          Lagre endringer
        </Button>
      </div>
    </form>
  );
}

export function DeleteStudentForm({ studentId }: { studentId: string }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button variant="ghost" onClick={() => setConfirming(true)}>
        Slett elev
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={deleteStudentAction}>
        <input type="hidden" name="id" value={studentId} />
        <Button type="submit" variant="secondary" className="text-danger-ink">
          Bekreft — sletter eleven og alle koblinger
        </Button>
      </form>
      <Button variant="ghost" onClick={() => setConfirming(false)}>
        Avbryt
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Registry page with search + status filter**

Create `src/app/(portal)/admin/elever/page.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { PillLink } from '@/components/ui/PillLink';
import { Button } from '@/components/ui/Button';
import { listStudentsForAdmin } from '@/lib/dal/students';
import { STATUS_LABELS } from '@/lib/validation/school';

export const metadata: Metadata = { title: 'Elever' };

const FILTERS = [
  { value: undefined, label: 'Alle' },
  { value: 'active', label: 'Aktive' },
  { value: 'stopped', label: 'Sluttet' },
] as const;

export default async function EleverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const statusFilter = status === 'active' || status === 'stopped' ? status : undefined;
  const students = await listStudentsForAdmin({ search: q, status: statusFilter });
  const isFiltered = Boolean(q) || Boolean(statusFilter);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-semibold">Elever</h1>
        <PillLink href="/admin/elever/ny" className="ms-auto">
          Registrer elev
        </PillLink>
      </div>

      <form method="get" action="/admin/elever" className="flex max-w-md items-end gap-2">
        {statusFilter ? <input type="hidden" name="status" value={statusFilter} /> : null}
        <div className="grow">
          <label htmlFor="elev-sok" className="mb-1.5 block text-sm font-medium text-ink">
            Søk på navn
          </label>
          <Input id="elev-sok" name="q" defaultValue={q ?? ''} placeholder="F.eks. Farah" />
        </div>
        <Button type="submit" variant="secondary">
          Søk
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const href = filter.value
            ? `/admin/elever?${new URLSearchParams({ ...(q ? { q } : {}), status: filter.value })}`
            : `/admin/elever${q ? `?${new URLSearchParams({ q })}` : ''}`;
          const active = statusFilter === filter.value;
          return (
            <PillLink key={filter.label} href={href} active={active}>
              {filter.label}
            </PillLink>
          );
        })}
      </div>

      {students.length === 0 ? (
        isFiltered ? (
          <p className="text-ink/60">Ingen elever traff søket.</p>
        ) : (
          <EmptyState
            title="Ingen elever registrert ennå"
            description="Registrer den første eleven — deretter kobler du foresatte og melder eleven inn i en klasse."
            action={<PillLink href="/admin/elever/ny">Registrer elev</PillLink>}
          />
        )
      ) : (
        <ul className="divide-y divide-hairline rounded-lg border border-hairline">
          {students.map((student) => (
            <li
              key={student.student_id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
            >
              <Link
                href={`/admin/elever/${student.student_id}`}
                className="min-w-44 font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {student.first_name} {student.last_name}
              </Link>
              <span className="text-sm tabular-nums text-ink/60">f. {student.birth_year}</span>
              <span className="text-sm text-ink/70">
                {student.class_name ?? 'Ikke i klasse'}
              </span>
              {student.protected ? <Chip tone="warning">Skjermet</Chip> : null}
              {student.status === 'stopped' ? (
                <Chip>{STATUS_LABELS.stopped}</Chip>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

Create `src/app/(portal)/admin/elever/ny/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { StudentCreateForm } from '../StudentForms';

export const metadata: Metadata = { title: 'Registrer elev' };

export default function NyElevPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Registrer elev</h1>
      <StudentCreateForm />
    </div>
  );
}
```

- [ ] **Step 3: Verify + commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run lint && npm run build 2>&1 | tail -5
rm -rf .next && npm run dev
```

Browser check as AAL2 admin: `/admin/elever` lists 5 students; Zaynab carries «Skjermet», Idris carries «Sluttet» and «Ikke i klasse»; search «Farah» → 2 rows; filter «Sluttet» → Idris; register a scratch student → lands on their (not yet built — expect 404 until Task 14) detail URL; delete via Task 14 later or `supabase db reset` to restore seeds.

```bash
cd /Users/daodilyas/dev/iqra-portal
git add 'src/app/(portal)/admin/elever/page.tsx' 'src/app/(portal)/admin/elever/ny/page.tsx' 'src/app/(portal)/admin/elever/StudentForms.tsx'
git commit -m "feat: student registry with search, status filter and registration form"
```

---

### Task 14: Admin UI — the one-glance student page

Spec §5's «one-glance student page»: info, guardians, class, login, note — the Phase 1 slice of it (attendance/progress/grades/invoices/consents sections arrive with their phases).

**Files:**
- Create: `src/app/(portal)/admin/elever/[id]/page.tsx`, `src/app/(portal)/admin/elever/[id]/rediger/page.tsx`
- Create: `src/app/(portal)/admin/elever/GuardianCard.tsx`, `src/app/(portal)/admin/elever/LoginCard.tsx`, `src/app/(portal)/admin/elever/EnrollCard.tsx`

- [ ] **Step 1: GuardianCard (link-or-provision state machine)**

Create `src/app/(portal)/admin/elever/GuardianCard.tsx`:

```tsx
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import type { GuardianLink } from '@/lib/dal/students';
import {
  idleForm,
  RELATIONSHIP_LABELS,
  RELATIONSHIPS,
  type LinkFormState,
} from '@/lib/validation/school';
import {
  linkGuardianAction,
  provisionGuardianAction,
  setGuardianPayerAction,
  unlinkGuardianAction,
} from './actions';
import { FormError, selectClasses } from './StudentForms';

function GuardianRow({ elevId, guardian }: { elevId: string; guardian: GuardianLink }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-40">
        <p className="font-medium">{guardian.full_name}</p>
        <p className="text-sm text-ink/60">
          {RELATIONSHIP_LABELS[guardian.relationship as keyof typeof RELATIONSHIP_LABELS] ??
            guardian.relationship}
        </p>
      </div>
      {guardian.is_payer ? (
        <Chip tone="success">Betaler</Chip>
      ) : (
        <form action={setGuardianPayerAction}>
          <input type="hidden" name="elevId" value={elevId} />
          <input type="hidden" name="guardianId" value={guardian.guardian_id} />
          <input type="hidden" name="betaler" value="true" />
          <Button type="submit" variant="ghost">
            Gjør til betaler
          </Button>
        </form>
      )}
      <div className="ms-auto flex items-center gap-2">
        {confirming ? (
          <>
            <form action={unlinkGuardianAction}>
              <input type="hidden" name="elevId" value={elevId} />
              <input type="hidden" name="guardianId" value={guardian.guardian_id} />
              <Button type="submit" variant="secondary" className="text-danger-ink">
                Bekreft
              </Button>
            </form>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Avbryt
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={() => setConfirming(true)}>
            Fjern
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * Two-phase add flow: try the e-mail against existing accounts; when none
 * exists the form reveals the name field and provisions a password-less
 * account (credentials arrive with the cloud invite flow — plan header).
 */
function GuardianAddForm({ elevId }: { elevId: string }) {
  const [phase, setPhase] = useState<'link' | 'provision'>('link');
  const [linkState, linkAction, linkPending] = useActionState<LinkFormState, FormData>(
    linkGuardianAction,
    idleForm,
  );
  const [provState, provAction, provPending] = useActionState<LinkFormState, FormData>(
    provisionGuardianAction,
    idleForm,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const state = phase === 'link' ? linkState : provState;
  const pending = phase === 'link' ? linkPending : provPending;

  // Switch the link/provision phase from the action results — state is
  // adjusted during render (React's recommended pattern; the repo's lint
  // rules forbid synchronous setState inside effects).
  const [prevLinkState, setPrevLinkState] = useState(linkState);
  if (prevLinkState !== linkState) {
    setPrevLinkState(linkState);
    if (linkState.needsProvision) setPhase('provision');
  }
  const [prevProvState, setPrevProvState] = useState(provState);
  if (prevProvState !== provState) {
    setPrevProvState(provState);
    if (provState.success) setPhase('link');
  }
  useEffect(() => {
    if (linkState.success) formRef.current?.reset();
  }, [linkState]);
  useEffect(() => {
    if (provState.success) formRef.current?.reset();
  }, [provState]);

  return (
    <form
      ref={formRef}
      action={phase === 'link' ? linkAction : provAction}
      className="flex flex-col gap-4 px-4 py-4"
    >
      <input type="hidden" name="elevId" value={elevId} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Foresattes e-post" htmlFor="foresatt-epost">
          <Input
            id="foresatt-epost"
            name="epost"
            type="email"
            required
            maxLength={254}
            placeholder="navn@eksempel.no"
          />
        </Field>
        <Field label="Relasjon" htmlFor="foresatt-relasjon">
          <select id="foresatt-relasjon" name="relasjon" className={selectClasses}>
            {RELATIONSHIPS.map((value) => (
              <option key={value} value={value}>
                {RELATIONSHIP_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {phase === 'provision' ? (
        <>
          <p className="text-sm text-ink/70">
            Ingen konto med denne e-postadressen — oppgi navn, så opprettes
            kontoen (innlogging aktiveres senere).
          </p>
          <Field label="Fullt navn" htmlFor="foresatt-navn">
            <Input id="foresatt-navn" name="fulltNavn" required maxLength={120} />
          </Field>
        </>
      ) : null}
      <label className="flex min-h-11 items-center gap-3 text-base">
        <input type="checkbox" name="betaler" className="size-5 accent-primary" />
        Er betaler for eleven
      </label>
      <FormError error={state.error} />
      <div className="flex gap-2">
        <Button type="submit" variant="secondary" loading={pending}>
          {phase === 'link' ? 'Koble til foresatt' : 'Opprett konto og koble til'}
        </Button>
        {phase === 'provision' ? (
          <Button variant="ghost" onClick={() => setPhase('link')}>
            Avbryt
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function GuardianCard({
  elevId,
  guardians,
}: {
  elevId: string;
  guardians: GuardianLink[];
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Foresatte</h2>
      <div className="rounded-lg border border-hairline">
        {guardians.length === 0 ? (
          <p className="px-4 py-4 text-sm text-ink/60">
            Ingen foresatte er koblet til eleven ennå.
          </p>
        ) : (
          <ul className="divide-y divide-hairline">
            {guardians.map((guardian) => (
              <GuardianRow key={guardian.guardian_id} elevId={elevId} guardian={guardian} />
            ))}
          </ul>
        )}
        <div className="border-t border-hairline bg-surface-tint/40">
          <GuardianAddForm elevId={elevId} />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: LoginCard**

Create `src/app/(portal)/admin/elever/LoginCard.tsx`:

```tsx
'use client';

import { useActionState, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { idleForm, type LinkFormState } from '@/lib/validation/school';
import {
  linkStudentLoginAction,
  provisionStudentLoginAction,
  unlinkStudentLoginAction,
} from './actions';
import { FormError } from './StudentForms';

export function LoginCard({
  elevId,
  hasLogin,
}: {
  elevId: string;
  hasLogin: boolean;
}) {
  const [phase, setPhase] = useState<'link' | 'provision'>('link');
  const [confirming, setConfirming] = useState(false);
  const [linkState, linkAction, linkPending] = useActionState<LinkFormState, FormData>(
    linkStudentLoginAction,
    idleForm,
  );
  const [provState, provAction, provPending] = useActionState<LinkFormState, FormData>(
    provisionStudentLoginAction,
    idleForm,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const state = phase === 'link' ? linkState : provState;
  const pending = phase === 'link' ? linkPending : provPending;

  // Switch the link/provision phase from the action results — state is
  // adjusted during render (React's recommended pattern; the repo's lint
  // rules forbid synchronous setState inside effects).
  const [prevLinkState, setPrevLinkState] = useState(linkState);
  if (prevLinkState !== linkState) {
    setPrevLinkState(linkState);
    if (linkState.needsProvision) setPhase('provision');
  }
  const [prevProvState, setPrevProvState] = useState(provState);
  if (prevProvState !== provState) {
    setPrevProvState(provState);
    if (provState.success) setPhase('link');
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Elevinnlogging</h2>
      <div className="rounded-lg border border-hairline px-4 py-4">
        {hasLogin ? (
          <div className="flex flex-wrap items-center gap-3">
            <Chip tone="success">Innlogging aktiv</Chip>
            {confirming ? (
              <>
                <form action={unlinkStudentLoginAction}>
                  <input type="hidden" name="elevId" value={elevId} />
                  <Button type="submit" variant="secondary" className="text-danger-ink">
                    Bekreft frakobling
                  </Button>
                </form>
                <Button variant="ghost" onClick={() => setConfirming(false)}>
                  Avbryt
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={() => setConfirming(true)}>
                Koble fra
              </Button>
            )}
          </div>
        ) : (
          <form
            ref={formRef}
            action={phase === 'link' ? linkAction : provAction}
            className="flex flex-col gap-4"
          >
            <p className="text-sm text-ink/70">
              Valgfritt — typisk for elever fra ca. 13 år (samtykke fra
              foresatte for yngre).
            </p>
            <input type="hidden" name="elevId" value={elevId} />
            <Field label="Elevens e-post" htmlFor="login-epost">
              <Input
                id="login-epost"
                name="epost"
                type="email"
                required
                maxLength={254}
                placeholder="navn@eksempel.no"
              />
            </Field>
            {phase === 'provision' ? (
              <>
                <p className="text-sm text-ink/70">
                  Ingen konto funnet — oppgi navn, så opprettes kontoen
                  (innlogging aktiveres senere).
                </p>
                <Field label="Fullt navn" htmlFor="login-navn">
                  <Input id="login-navn" name="fulltNavn" required maxLength={120} />
                </Field>
              </>
            ) : null}
            <FormError error={state.error} />
            <div className="flex gap-2">
              <Button type="submit" variant="secondary" loading={pending}>
                {phase === 'link' ? 'Koble til konto' : 'Opprett konto og koble til'}
              </Button>
              {phase === 'provision' ? (
                <Button variant="ghost" onClick={() => setPhase('link')}>
                  Avbryt
                </Button>
              ) : null}
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: EnrollCard**

Create `src/app/(portal)/admin/elever/EnrollCard.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { PillLink } from '@/components/ui/PillLink';
import type { AdminClassOverview } from '@/lib/dal/classes';
import type { EnrollmentRow } from '@/lib/dal/students';
import { formatDateNb } from '@/lib/dates';
import { idleForm } from '@/lib/validation/school';
import { enrollStudentAction, unenrollStudentAction } from '../klasser/actions';
import { FormError, selectClasses } from './StudentForms';

// formatDateNb is imported here rather than passed from the server page:
// functions can never cross the RSC boundary as props.
export function EnrollCard({
  elevId,
  enrollment,
  classes,
}: {
  elevId: string;
  enrollment: EnrollmentRow[];
  classes: AdminClassOverview[];
}) {
  const [state, formAction, pending] = useActionState(enrollStudentAction, idleForm);
  const active = enrollment.find((row) => row.left_on === null) ?? null;
  const history = enrollment.filter((row) => row.left_on !== null);
  const currentTermClasses = classes.filter((cls) => cls.term_is_current);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Klasse</h2>
      <div className="flex flex-col gap-4 rounded-lg border border-hairline px-4 py-4">
        {active ? (
          <div className="flex flex-wrap items-center gap-3">
            <PillLink href={`/admin/klasser/${active.class_id}`}>
              {active.class_name}
            </PillLink>
            <span className="text-sm text-ink/60">
              innmeldt {formatDateNb(active.enrolled_on)}
            </span>
            <form action={unenrollStudentAction} className="ms-auto">
              <input type="hidden" name="elevId" value={elevId} />
              <input type="hidden" name="klasseId" value={active.class_id} />
              <Button type="submit" variant="ghost">
                Meld ut
              </Button>
            </form>
          </div>
        ) : currentTermClasses.length === 0 ? (
          <p className="text-sm text-ink/60">
            Ingen klasser i nåværende termin ennå — opprett en under Klasser.
          </p>
        ) : (
          <form action={formAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="elevId" value={elevId} />
            <div className="grow">
              <label htmlFor="enroll-klasse" className="mb-1.5 block text-sm font-medium">
                Meld inn i klasse
              </label>
              <select id="enroll-klasse" name="klasseId" required className={selectClasses}>
                {currentTermClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="secondary" loading={pending}>
              Meld inn
            </Button>
            <FormError error={state.error} />
          </form>
        )}
        {history.length > 0 ? (
          <div className="flex flex-col gap-1 border-t border-hairline pt-3">
            <h3 className="text-sm font-medium text-ink/60">Historikk</h3>
            <ul className="flex flex-col gap-1">
              {history.map((row) => (
                <li key={`${row.class_id}-${row.enrolled_on}`} className="text-sm text-ink/60">
                  {row.class_name}: {formatDateNb(row.enrolled_on)} –{' '}
                  {row.left_on ? formatDateNb(row.left_on) : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: The one-glance page + edit page**

Create `src/app/(portal)/admin/elever/[id]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Chip } from '@/components/ui/Chip';
import { PillLink } from '@/components/ui/PillLink';
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
  const classes = await listClassesForAdmin();

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

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Notat</h2>
        <p className="max-w-2xl leading-relaxed text-ink/80">
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

Create `src/app/(portal)/admin/elever/[id]/rediger/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getStudentForAdmin } from '@/lib/dal/students';
import { StudentEditForm } from '../../StudentForms';

export const metadata: Metadata = { title: 'Rediger elev' };

export default async function RedigerElevPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const student = await getStudentForAdmin(id);
  if (!student) notFound();
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">
        Rediger {student.first_name} {student.last_name}
      </h1>
      <StudentEditForm student={student} />
    </div>
  );
}
```

- [ ] **Step 5: Verify + commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run lint && npm run build 2>&1 | tail -5
rm -rf .next && npm run dev
```

Browser check as AAL2 admin, on `/admin/elever/fe000000-0000-0000-0000-000000000004` (Zaynab): «Skjermet» chip; guardian Fatima Yusuf (Mor, Betaler); class Klasse 3 with enroll date; no login → link form. Full flows: register a scratch student from `/admin/elever/ny` → lands on the one-glance page; add guardian by the seed e-mail `forelder2@test.local` (link path); add another with a fresh e-mail (provision path reveals the name field); toggle payer; enroll into Klasse 1; meld ut; delete the scratch student (two-step) → back on the registry. Then `supabase db reset` + `npm run test:api 2>&1 | tail -3` to confirm the world is clean (**94 passing**).

```bash
cd /Users/daodilyas/dev/iqra-portal
git add 'src/app/(portal)/admin/elever/'
git commit -m "feat: one-glance student page with guardian, class and login management"
```

---

### Task 15: Teacher surfaces — my classes + roster (phone-first)

The teacher scene (spec §7): a volunteer in a bright Saturday classroom, on a phone. Single column, big targets, zero clutter.

**Files:**
- Modify: `src/app/(portal)/laerer/page.tsx`
- Create: `src/app/(portal)/laerer/klasser/[id]/page.tsx`

- [ ] **Step 1: Replace the teacher dashboard**

Rewrite `src/app/(portal)/laerer/page.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';
import { listMyTeachingClasses } from '@/lib/dal/classes';
import { scheduleLabel } from '@/lib/dates';

export const metadata: Metadata = { title: 'Lærer' };

export default async function LaererDashboard() {
  const classes = await listMyTeachingClasses();
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Mine klasser</h1>
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
                  {cls.schedule.map(scheduleLabel).join(' · ')}
                  {cls.room ? ` · ${cls.room}` : ''}
                </span>
                <span className="ms-auto text-sm tabular-nums text-ink/70">
                  {cls.active_count} elever
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: The roster page**

Create `src/app/(portal)/laerer/klasser/[id]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { getRosterForTeacher } from '@/lib/dal/students';

export const metadata: Metadata = { title: 'Klasseliste' };

/**
 * getRosterForTeacher answers null both for foreign and non-existent
 * classes (enumeration-quiet) — either way this page is a plain 404.
 */
export default async function LaererKlassePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getRosterForTeacher(id);
  if (!result) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{result.class.name}</h1>
        {result.class.room ? <p className="text-ink/60">{result.class.room}</p> : null}
      </div>
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
      <p className="text-sm text-ink/60">
        Oppmøteregistrering kommer i neste fase — da starter dagen her.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Verify + commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run lint && npm run build 2>&1 | tail -5
rm -rf .next && npm run dev
```

Browser check as `laerer@test.local` (AAL2): `/laerer` shows exactly Klasse 1 («Lørdag 10:00–13:00 · Rom 2», 2 elever); the roster lists Yusuf Farah and Bilal Omar; hand-editing the URL to Klasse 3's id gives 404. As `laererforelder@test.local`: only Klasse 3, whose roster shows Zaynab with «Skjermet» and Amira. Resize to 375px width: single column, nothing clipped.

```bash
cd /Users/daodilyas/dev/iqra-portal
git add 'src/app/(portal)/laerer/'
git commit -m "feat: teacher class list and roster pages"
```

---

### Task 16: Parent, student and admin dashboards on real data

**Files:**
- Modify: `src/app/(portal)/forelder/page.tsx`, `src/app/(portal)/elev/page.tsx`, `src/app/(portal)/admin/page.tsx`
- Create: `src/lib/dal/dashboard.ts`
- Modify: `tests/api/school-core.test.ts` (dashboard describes)

- [ ] **Step 1: Failing tests for the overview read**

Append to `tests/api/school-core.test.ts` (import `getAdminOverview` from `@/lib/dal/dashboard`):

```ts
describe('wall 1: the admin overview counters', () => {
  it('counts active students and current-term classes', async () => {
    await signInAsAAL2('admin@test.local');
    await expect(getAdminOverview()).resolves.toEqual({
      active_students: 4, // Idris is stopped
      current_term_name: 'Høst 2026',
      current_term_classes: 2,
    });
  });

  it('turns non-admins away', async () => {
    signInAs('forelder@test.local');
    await expect(getAdminOverview()).rejects.toThrow(
      'NEXT_REDIRECT:/ingen-tilgang',
    );
  });
});
```

- [ ] **Step 2: The dashboard DAL**

Create `src/lib/dal/dashboard.ts`:

```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { requireStaffRole } from './session';
import { getCurrentTerm } from './terms';

export interface AdminOverview {
  active_students: number;
  current_term_name: string | null;
  current_term_classes: number;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  await requireStaffRole('admin');
  const supabase = await createClient();
  const term = await getCurrentTerm();
  const { count: studentCount, error: studentsError } = await supabase
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');
  if (studentsError) {
    throw new Error(`Kunne ikke telle elever: ${studentsError.message}`);
  }
  let classCount = 0;
  if (term) {
    const { count, error } = await supabase
      .from('classes')
      .select('id', { count: 'exact', head: true })
      .eq('term_id', term.id);
    if (error) {
      throw new Error(`Kunne ikke telle klasser: ${error.message}`);
    }
    classCount = count ?? 0;
  }
  return {
    active_students: studentCount ?? 0,
    current_term_name: term?.name ?? null,
    current_term_classes: classCount,
  };
}
```

- [ ] **Step 3: Parent dashboard**

Rewrite `src/app/(portal)/forelder/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { listChildrenForGuardian } from '@/lib/dal/students';
import { scheduleLabel } from '@/lib/dates';
import { STATUS_LABELS } from '@/lib/validation/school';

export const metadata: Metadata = { title: 'Forelder' };

export default async function ForelderDashboard() {
  const children = await listChildrenForGuardian();
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Mine barn</h1>
      {children.length === 0 ? (
        <EmptyState
          title="Ingen barn registrert ennå"
          description="Når skolen har registrert barna dine, ser du klasse og timeplan her. Ta kontakt med administrasjonen hvis noe mangler."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {children.map((child) => (
            <li
              key={child.student_id}
              className="flex flex-col gap-1 rounded-lg border border-hairline bg-canvas px-4 py-4"
            >
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-lg font-semibold">
                  {child.first_name} {child.last_name}
                </p>
                {child.status === 'stopped' ? (
                  <Chip>{STATUS_LABELS.stopped}</Chip>
                ) : null}
              </div>
              {child.class_name ? (
                <p className="text-ink/70">
                  {child.class_name}
                  {child.schedule.length > 0
                    ? ` · ${child.schedule.map(scheduleLabel).join(' · ')}`
                    : ''}
                </p>
              ) : (
                <p className="text-ink/60">Ikke meldt inn i noen klasse ennå.</p>
              )}
              <p className="text-sm text-ink/50">
                Oppmøte, fremdrift og beskjeder kommer i senere faser.
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Student dashboard**

Rewrite `src/app/(portal)/elev/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';
import { getOwnStudentRecord } from '@/lib/dal/students';
import { scheduleLabel } from '@/lib/dates';

export const metadata: Metadata = { title: 'Elev' };

export default async function ElevDashboard() {
  const record = await getOwnStudentRecord();
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Min side</h1>
      {!record ? (
        <EmptyState
          title="Kontoen er ikke koblet til en elev ennå"
          description="Administrasjonen kobler kontoen din til elevregisteret — etterpå ser du klassen og timeplanen din her."
        />
      ) : (
        <div className="flex flex-col gap-1 rounded-lg border border-hairline bg-canvas px-4 py-4">
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
          <p className="text-sm text-ink/50">
            Lekser, prøver og fremdrift kommer i senere faser.
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Admin dashboard on real counts**

In `src/app/(portal)/admin/page.tsx`: add the imports and replace the `EmptyState` block (the `loadAuditEntries` helper and «Siste hendelser» section stay exactly as they are):

```tsx
import { PillLink } from '@/components/ui/PillLink';
import { getAdminOverview } from '@/lib/dal/dashboard';
```

```tsx
export default async function AdminDashboard() {
  const [overview, entries] = await Promise.all([
    getAdminOverview(),
    loadAuditEntries(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Administrasjon</h1>

      <section className="rounded-lg border border-hairline bg-surface-tint/60 px-5 py-4">
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
          <div className="ms-auto flex flex-wrap gap-2">
            <PillLink href="/admin/elever">Elevregisteret</PillLink>
            <PillLink href="/admin/klasser">Klasser</PillLink>
          </div>
        </dl>
      </section>
      {/* …the existing «Siste hendelser» section continues unchanged… */}
```

- [ ] **Step 6: Verify + commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run lint
npm run test:api 2>&1 | tail -4
npm run build 2>&1 | tail -5
rm -rf .next && npm run dev
```

Browser check: `forelder@test.local` (no MFA needed) sees Amira (Klasse 3 · Søndag) and Yusuf (Klasse 1 · Lørdag); `forelder2@test.local` sees Idris («Sluttet», no class) and Zaynab; `elev@test.local` sees Yusuf's own card; AAL2 admin dashboard shows 4 aktive elever / 2 klasser / Høst 2026 with working links and the audit list below.

```bash
cd /Users/daodilyas/dev/iqra-portal
git add src/lib/dal/dashboard.ts 'src/app/(portal)/forelder/page.tsx' 'src/app/(portal)/elev/page.tsx' 'src/app/(portal)/admin/page.tsx' tests/api/school-core.test.ts
git commit -m "feat: parent, student and admin dashboards on live registry data"
```

Expected: **98** test:api (96 + 2).

---

### Task 17: Exit gate, docs, ledger

- [ ] **Step 1: The full exit gate (all numbers must match)**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck
npm run lint
npm test -- --run 2>&1 | tail -3        # ~96 unit tests
npm run build 2>&1 | tail -6            # all routes compile
supabase db reset 2>&1 | tail -4        # migrations 7 + seeds apply
supabase test db 2>&1 | tail -14        # 177 pgTAP across 11 files
npm run test:api 2>&1 | tail -4         # 98 live wall-1 tests
npm audit --audit-level=high            # exit 0
git log --oneline main..feat/phase-1 | wc -l   # 16 commits (one per task)
```

Any mismatch is a defect to fix BEFORE proceeding — never adjust the expectation to match the output without understanding why.

- [ ] **Step 2: Design self-audit (spec §7 + web-interface-guidelines pass)**

Walk every new page at 375px and desktop, keyboard-only, and confirm: visible focus ring on every pill/button/link/input; `min-h-11` targets; labels above inputs; single `role="alert"` error line per form; teaching empty states everywhere a list can be empty; `tabular-nums` on figures; all dates via `formatDateNb`/`scheduleLabel` (Oslo); chips carry AA-contrast `-ink` text on `/15` tints; NO kicker labels, emojis, purple, `#000`/`#fff`, gradient text, or identical-card grids. Fix anything found, amend the relevant task's commit message convention (`fix:`).

- [ ] **Step 3: README + docs**

In `README.md`, extend the feature list («Funksjoner» or equivalent section) with:

```markdown
- **Fase 1 — skolekjerne:** elevregister med én-blikk-elevside (foresatte,
  klasse, elevinnlogging, notat), klasseadministrasjon (lærere, fag,
  timeplan, innmelding), terminer og fag, lærerens klasseliste,
  foreldre-/elevoversikt. Alle nye tabeller står bak RLS med
  relasjonssjekker i begge murer og revisjonstriggere på elevdata.
```

- [ ] **Step 4: Commit docs + push the branch**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add README.md
git commit -m "docs: phase 1 feature summary"
git push -u origin feat/phase-1
gh run watch --repo daodiii/iqra-portal || true
```

Expected: CI green on the branch (typecheck/lint/unit/build + pgTAP jobs; `test:api` is deliberately NOT in CI — needs the local stack, T15/Phase-0 decision stands). **STOP here: merging `feat/phase-1` into `main` is the user's call**, exactly like Phase 0.

---

## Deferred ledger #12 (Phase 1) — durable, do not lose

1. **Credential/invite flow**: provisioned accounts (guardians, student logins) are password-less by design — no way to log in until the cloud onboarding flow (Brevo content-free invite + token exchange + set-password page) lands pre-pilot. Blocks REAL parent onboarding, not local dev.
2. **Role revocation**: unlink-guardian and unlink-student-login keep the parent/student role. Needs a last-link decision (revoke when no links remain?) — revisit when off-boarding becomes real (Phase 7 retention).
3. **Teacher names for parents** (Phase 5): requires cross-profile visibility (definer lookup or profiles-RLS widening). Parent surfaces deliberately show class name only until then.
4. **Economy names+payer path** (Phase 6): decision RECORDED — a dedicated role-checked path that EXCLUDES protected students; protected children are invoiced via family-level lines (`invoice_lines.student_id null`). Until then economy is fully denied on students/guardian_student (pinned in both suites).
5. **Term rollover**: `class_students_one_active` means a new term's enrollment requires stamping `left_on` on the old rows first — the mass-rollover flow belongs to the phase that makes terms operational (2 or 3).
6. **Teacher historical visibility**: `teaches_student` requires an ACTIVE enrollment, so teachers lose student access at unenrollment. Phase 2 (attendance history) must decide historical-roster semantics explicitly.
7. **T12 minors still open**: skip-to-main link; 5-portal-layout factory; 320px header-wrap polish. (The pill-link primitive CLOSED via `PillLink` in Task 11.)
8. **No pagination** on registry/class lists — right for a few hundred students; revisit only if the school grows past ~1k rows per list.
9. **Phase 7 audit-viewer consumer contract (BINDING, from T1 security review F1):** the viewer/alerting MUST classify the reserved namespace with a **case-sensitive, anchored** predicate only — `action LIKE 'admin.%'` / `action LIKE 'system.%'`. Never `ILIKE`, `lower()`/`upper()`, `trim()`, or any UI case-collapsing for the authority decision. The T1 guard is now normalization-agnostic (rejects case/whitespace variants too), so this is belt-and-braces — but it must be stated in the Phase 7 plan, not assumed.
11. **`adminProvisionUser` isn't atomic (LOW, from T8 security review N1):** it spans GoTrue `createUser` + `user_roles` upsert + audit insert with no cross-store transaction (GoTrue is a separate API, not in the DB tx). A failure after `createUser` throws (fail-fast) but can leave an orphaned password-less user (roles-upsert fails) or a provisioned+roled-but-unaudited user (audit fails). Blast radius minimal — the orphan CAN'T log in (password-less) and a retry with the same e-mail hits `EmailAlreadyRegistered`, so the admin sees it. True atomicity across GoTrue+Postgres isn't achievable cheaply; accepted for Phase 1. Revisit if provisioning volume grows (a compensating delete-on-roles-failure, or a reconcile job). Task 10 consumers must surface `EmailAlreadyRegistered` and let `AdminAccessDenied` propagate.
10. **Dual-role-with-admin `.eq` coverage (LOW, from T6/T7 security reviews):** the wall-1 relationship `.eq` filters (`listMyTeachingClasses` teacher_id, `listChildrenForGuardian` guardian_id, `getOwnStudentRecord` student_user_id, `getRosterForTeacher` teacher_id) are load-bearing ONLY for a caller who ALSO holds admin (RLS admin-permissive lets them read all rows; a pure-role caller is already RLS-scoped). Severity is CORRECTNESS not leak — an admin already sees all via the registry, so over-return discloses nothing new; RLS is the real Bergen wall for non-admins (T7 mutation-proved: removing every `.eq`, pure-role users still saw only their own rows). COVERED so far: admin+teacher (`listMyTeachingClasses`, T6 test) + admin+parent (`listChildrenForGuardian`, T7 test). STILL uncovered (accepted low-severity): admin+student (`getOwnStudentRecord` — fails closed via maybeSingle-on-many) and admin+teacher (`getRosterForTeacher` — same principle as the covered `listMyTeachingClasses`). Add tests if a real admin+student/admin+teacher persona appears, or during a Phase-7 hardening sweep. **Scaffolding gotcha:** build such a dual role by granting an EXISTING role-holder the second role via service_role on `user_roles` — NOT by inserting into an AUDITED school-core table (students/guardian_student/class_students): those fire `private.audit_row_change`→`private.audit`, and **service_role lacks USAGE on schema `private`**, so the insert 42501s. This also means retention/anonymization jobs (Phase 7) cannot mutate the audited tables via the service role — they must run through an authenticated path or the audit-trigger grants must be revisited.

## Coverage self-check (spec §9 Phase 1: «Terms, classes, subjects, students, guardians, enrollment; admin registry + one-glance page»)

| Spec item | Wall 2 (RLS + pgTAP) | Wall 1 (DAL + tests/api) | UI |
|---|---|---|---|
| Terms | T2 / 06 | T6 / school-core | T11 |
| Subjects | T2 / 06 | T6 | T11 |
| Classes + teachers/subjects/schedule | T3 / 07 | T6 / T9 | T12 |
| Students (+protected, status, note) | T4 / 08 | T7 / T10 | T13, T14 |
| Guardians (+payer, provisioning) | T4 / 08 | T8 / T10 | T14 |
| Enrollment (one-active, leave/move) | T4 / 09 | T7 / T10 | T12, T14 |
| Admin registry | — | T7 | T13 |
| One-glance page | — | T7 | T14 |
| Fine-derived #1 (parent A vs B's child) | 08 | school-core | — |
| Fine-derived #4 (teacher X vs class Y) | 09 | school-core | T15 (404) |
| Audit on student-record writes (spec §6) | T4 / 08–09 | T10 lifecycle | — |
| Namespace enforcement (deferred item) | T1 / 05 | — | — |

Fine-derived #2 (exports) and #3 (notifications) have no Phase 1 surface — they bind to the features that introduce exports/notifications.

