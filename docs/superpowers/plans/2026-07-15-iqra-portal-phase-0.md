# IQRA Skoleportal — Phase 0 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the portal repository with local Supabase, auth + enforced TOTP MFA for staff, the roles/RLS security skeleton with adversarial test harnesses at both walls (pgTAP for RLS, Vitest for the API/DAL), design tokens + core UI components, per-role portal shells, seed users, security headers, CI with Dependabot, and cloud-setup documentation — Phase 0 of `docs/superpowers/specs/2026-07-15-iqra-skoleportal-design.md` (§9).

**Architecture:** One Next.js 16 (App Router) app; all data access through a server-only DAL using the requesting user's cookie session so RLS applies to every query (wall 1 = DAL checks, wall 2 = RLS default-deny). Service-role usage quarantined to `src/lib/admin/`, where every function re-verifies the caller's admin role and writes an audit entry. Staff roles (admin/teacher/economy) are blocked below AAL2 by `src/proxy.ts` (Next 16's middleware).

**Tech Stack:** Next.js 16 (App Router, `src/` dir, Turbopack), React 19, TypeScript strict, Tailwind CSS v4 (`@tailwindcss/postcss`, `@theme` tokens), `@supabase/supabase-js` v2 + `@supabase/ssr`, Supabase CLI (Docker) with SQL migrations + pgTAP (`supabase test db`), Vitest + Testing Library, Zod, npm.

---

## Read this before starting

**Environment gotchas (this machine):**

1. **Every Bash step must `cd` explicitly.** The default working directory is the *marketing site* repo (`/Users/daodilyas/Desktop/iqra`), NOT the portal. Every command block in this plan starts with `cd /Users/daodilyas/dev/iqra-portal` (or another absolute path). Never rely on a previous step's directory.
2. **The new repo lives at `/Users/daodilyas/dev/iqra-portal`.** Deliberately OUTSIDE `~/Desktop` and `~/Documents` — iCloud Drive syncs those and corrupts git refs / evicts `node_modules` (see project memory). Do not create the repo anywhere else.
3. **Docker Desktop must be running** before any `supabase start` / `supabase test db` step. If a step fails with `Cannot connect to the Docker daemon`, run `open -a Docker`, wait ~30s, retry. **Amendment 2026-07-16:** on this machine a plain `supabase start` FAILS (CPU-slow cold boot outlives the CLI's health window) — wherever any task says `supabase start`, use the amended Task 3 Step 4 pattern instead: `supabase start --ignore-health-check` followed by the mandatory all-healthy wait loop (and usually the stack is already running — check `docker ps` first). `supabase test db` is unaffected. `supabase db reset` (observed 2026-07-16, T4) completes ALL database work correctly — `Applying migration ...` / `Seeding data ...` lines are the success signal — but can still exit 1 in its final `Restarting containers...` phase when the storage container's restart outlives the health window. When that happens: do NOT re-run the reset; run the same all-healthy wait loop, then proceed (the following `supabase test db` run is the real verification).
4. **Two different spec/plan locations.** The approved spec currently lives in the marketing repo at `/Users/daodilyas/Desktop/iqra/docs/superpowers/specs/2026-07-15-iqra-skoleportal-design.md`. Task 15 copies it into the portal repo as `docs/spec.md`.
5. **Commit messages:** Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`). Never mention Claude or AI in commit messages. No `Co-Authored-By` trailers.
6. **Norwegian UI, English code.** All user-facing strings are Norwegian (bokmål). Identifiers, comments, table/column names stay English (roles in the DB are `'admin','teacher','parent','student','economy'`; URL paths are Norwegian: `/laerer`, `/forelder`, `/elev`, `/okonomi`, `/logg-inn`).
7. **Design bans (spec §7):** no kicker/eyebrow uppercase mini-labels, no emojis in UI, no purple, never `#000`/`#fff` (use the `ink`/`canvas` tokens), no gradient text, no identical-card grids.
8. **Migrations own their privileges (amendment 2026-07-16).** This Supabase vintage does NOT auto-grant table DML to `anon`/`authenticated`/`service_role` — new tables are not auto-exposed (see the `auto_expose_new_tables` note in config.toml; legacy auto-expose is deprecated and removed 2026-10-30, and the residual default ACL hands the api roles only TRUNCATE/REFERENCES/TRIGGER/MAINTAIN). Every migration that creates a table MUST therefore normalize its privileges explicitly: `revoke all on table ... from anon, authenticated, service_role;` then `grant` back exactly the verbs its RLS policies are written for. `anon` gets nothing (anonymous requests fail with 42501 at the privilege layer before RLS is consulted). Tasks 4-5 model the pattern; every later phase follows it.

**File structure created by this plan:**

```
/Users/daodilyas/dev/iqra-portal/
├── .github/workflows/ci.yml          # Task 15
├── .github/dependabot.yml            # Task 15 (weekly grouped dependency PRs)
├── .env.example                      # Task 3
├── PRODUCT.md / DESIGN.md / README.md# Task 15
├── docs/spec.md                      # Task 15 (copy of approved spec)
├── next.config.ts                    # Task 15 (security headers + baseline CSP)
├── vercel.json                       # Task 15 (region pin arn1)
├── vitest.config.ts / vitest.setup.ts# Task 2
├── vitest.config.api.ts              # Task 12b (config for the API-wall suite)
├── tests/api/                        # Task 12b: wall-1 adversarial harness
│   ├── harness.ts                    #   sign-in-as-seed-user mock factories
│   └── access-wall.test.ts           #   forbidden-cell tests (grows every phase)
├── supabase/
│   ├── config.toml                   # Task 3 (MFA on, region note)
│   ├── seed.sql                      # Task 6 (LOCAL-ONLY test users)
│   ├── migrations/
│   │   ├── <ts>_core_identity.sql    # Task 4: private schema, profiles, user_roles, RLS, triggers
│   │   └── <ts>_audit_and_settings.sql # Task 5: audit_log, settings, private.audit
│   └── tests/                        # pgTAP adversarial harness (Tasks 4–5)
│       ├── 01_schema.sql
│       ├── 02_profiles_user_roles_rls.sql
│       ├── 03_audit_log_rls.sql
│       └── 04_settings.sql
└── src/
    ├── proxy.ts                      # Task 13: auth + staff-AAL2 gate (Next 16 middleware)
    ├── app/
    │   ├── layout.tsx / globals.css / page.tsx   # Tasks 7, 11
    │   ├── logg-inn/page.tsx + actions.ts        # Task 11
    │   ├── ingen-tilgang/page.tsx                # Task 11
    │   ├── mfa/registrer/page.tsx                # Task 14 (TOTP enroll)
    │   ├── mfa/verifiser/page.tsx                # Task 14 (TOTP challenge)
    │   └── (portal)/
    │       ├── actions.ts                        # Task 12 (logout)
    │       ├── admin/    layout.tsx + page.tsx   # Task 12
    │       ├── laerer/   layout.tsx + page.tsx   # Task 12
    │       ├── forelder/ layout.tsx + page.tsx   # Task 12
    │       ├── elev/     layout.tsx + page.tsx   # Task 12
    │       └── okonomi/  layout.tsx + page.tsx   # Task 12
    ├── components/
    │   ├── ui/  Button, Field, Input, Chip, Skeleton, EmptyState (+tests)  # Task 8
    │   └── shell/ PortalShell.tsx, RoleSwitcher.tsx                        # Task 12
    └── lib/
        ├── format.ts (+test)          # Task 2 (øre → kroner, tabular figures)
        ├── env.ts                     # Task 9
        ├── supabase/ server.ts, client.ts, middleware.ts, database.types.ts # Task 9
        ├── auth/ access.ts (+test)    # Task 10 (pure role/MFA-gate logic)
        ├── dal/ session.ts, settings.ts # Task 11 (server-only, RLS-scoped)
        └── admin/ audit-log.ts        # Task 11 (service-role quarantine)
```

**Task order and why:** 1 repo → 2 test tooling → 3 local Supabase → 4–5 migrations+pgTAP (security skeleton proven before any app code touches it) → 6 seeds → 7 tokens → 8 UI primitives → 9 env+clients → 10 pure access logic → 11 DAL+admin module → 12 portal shells → 12b API-wall harness (wall-1 twin of the pgTAP suite) → 13 middleware gate → 14 MFA pages → 15 headers+CI+docs+acceptance.

---

### Task 1: Create the portal repository

**Files:**
- Create: `/Users/daodilyas/dev/iqra-portal/` (entire Next.js app via `create-next-app`)

- [ ] **Step 1: Verify prerequisites**

```bash
node --version && npm --version && git --version && docker info --format '{{.ServerVersion}}'
```

Expected: Node `v20.x` or newer, npm 10+, git 2.x, a Docker server version (e.g. `27.x`). If the Docker line errors, run `open -a Docker`, wait 30 seconds, re-run. If Node is older than 20, stop and report — Next.js 16 requires Node 20.9+.

- [ ] **Step 2: Scaffold the app with create-next-app**

```bash
mkdir -p /Users/daodilyas/dev
cd /Users/daodilyas/dev
npx create-next-app@latest iqra-portal \
  --typescript --eslint --tailwind --app --src-dir \
  --import-alias "@/*" --turbopack --use-npm
```

Expected: ends with `Success! Created iqra-portal at /Users/daodilyas/dev/iqra-portal`. If any interactive prompt still appears (newer CNA versions add prompts), answer: React Compiler → **No**, linter → **ESLint**, anything else → the default.

- [ ] **Step 3: Normalize the git repo (main branch, conventional first commit)**

create-next-app already ran `git init` and made an initial commit. Rename the branch and the commit:

```bash
cd /Users/daodilyas/dev/iqra-portal
git branch -M main
git commit --amend -m "chore: bootstrap Next.js 16 app (TypeScript, Tailwind v4, App Router, src dir)"
git log --oneline
```

Expected: exactly one commit with the message above, on branch `main`.

- [ ] **Step 4: Verify TypeScript strict is on and the app builds**

```bash
cd /Users/daodilyas/dev/iqra-portal
grep '"strict"' tsconfig.json
npm run build
```

Expected: `"strict": true` in tsconfig, and the build ends with a route table (`Route (app) ...`) and exit code 0.

- [ ] **Step 5: Harden .gitignore for env files**

Open `/Users/daodilyas/dev/iqra-portal/.gitignore`. CNA already ignores `.env*`. Confirm the file contains a line `.env*` (or `.env*.local`). If it only has `.env*.local`, add these lines at the end:

```gitignore
# local env files — never commit secrets
.env
.env.local
```

Then, so the example file CAN be committed later, append:

```gitignore
!.env.example
```

- [ ] **Step 6: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add .gitignore
git commit -m "chore: allow .env.example through gitignore"
```

(If `.gitignore` needed no changes, skip this commit.)

---

### Task 2: Test tooling — Vitest, typecheck script, first TDD unit (øre formatting)

**Files:**
- Create: `/Users/daodilyas/dev/iqra-portal/vitest.config.ts`
- Create: `/Users/daodilyas/dev/iqra-portal/vitest.setup.ts`
- Create: `/Users/daodilyas/dev/iqra-portal/src/lib/format.test.ts`
- Create: `/Users/daodilyas/dev/iqra-portal/src/lib/format.ts`
- Modify: `/Users/daodilyas/dev/iqra-portal/package.json` (scripts)

Money is integer øre everywhere (spec §4). This task sets up Vitest and proves it with the formatter the whole app will use for figures — deterministic manual formatting, NOT `Intl` (ICU output varies across environments; deterministic output keeps tests stable).

- [ ] **Step 1: Install test dependencies**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom vite-tsconfig-paths
```

Expected: `added N packages` with exit code 0.

- [ ] **Step 2: Create Vitest config and setup**

Create `/Users/daodilyas/dev/iqra-portal/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

Create `/Users/daodilyas/dev/iqra-portal/vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Add npm scripts**

In `/Users/daodilyas/dev/iqra-portal/package.json`, extend the `"scripts"` object so it contains (keep the existing `dev`/`build`/`start`/`lint` entries):

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:types": "supabase gen types typescript --local > src/lib/supabase/database.types.ts"
  }
}
```

(If the existing `lint` script differs — e.g. `next lint` on an older template — leave it as generated; only add the four new entries.)

- [ ] **Step 4: Write the failing test**

Create `/Users/daodilyas/dev/iqra-portal/src/lib/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatOre } from './format';

describe('formatOre', () => {
  it.each([
    [0, '0,00 kr'],
    [3800, '38,00 kr'], // default purregebyr (spec §4: purring_fee_ore 3800)
    [150000, '1 500,00 kr'],
    [123456789, '1 234 567,89 kr'],
    [5, '0,05 kr'],
    [-2500, '−25,00 kr'], // sibling discount lines are negative (spec §4)
  ])('formats %i øre as %s', (ore, expected) => {
    expect(formatOre(ore)).toBe(expected);
  });

  it('rejects non-integer input (money is always integer øre)', () => {
    expect(() => formatOre(12.5)).toThrow('formatOre: expected integer øre, got 12.5');
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm test
```

Expected: FAIL — `Cannot find module './format'` (or "Failed to resolve import").

- [ ] **Step 6: Write the implementation**

Create `/Users/daodilyas/dev/iqra-portal/src/lib/format.ts`:

```ts
/**
 * Formats integer øre as Norwegian kroner, e.g. 3800 -> "38,00 kr".
 * Deliberately manual (no Intl): output is deterministic across
 * Node/browser ICU versions, which keeps tests and snapshots stable.
 * Thousands separator: regular space. Minus: U+2212 (typographic minus).
 */
export function formatOre(ore: number): string {
  if (!Number.isInteger(ore)) {
    throw new Error(`formatOre: expected integer øre, got ${ore}`);
  }
  const negative = ore < 0;
  const abs = Math.abs(ore);
  const kroner = Math.floor(abs / 100).toString();
  const rest = (abs % 100).toString().padStart(2, '0');
  const grouped = kroner.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${negative ? '−' : ''}${grouped},${rest} kr`;
}
```

- [ ] **Step 7: Run tests and typecheck to verify green**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm test && npm run typecheck
```

Expected: `Test Files  1 passed`, `Tests  7 passed`, then tsc exits silently with code 0.

- [ ] **Step 8: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add package.json package-lock.json vitest.config.ts vitest.setup.ts src/lib/format.test.ts src/lib/format.ts
git commit -m "test: add Vitest tooling and øre formatting unit"
```

---

### Task 3: Local Supabase — init, config (MFA on, Stockholm intent), env files

**Files:**
- Create: `/Users/daodilyas/dev/iqra-portal/supabase/config.toml` (via `supabase init`, then edited)
- Create: `/Users/daodilyas/dev/iqra-portal/supabase/seed.sql` (empty placeholder; filled in Task 6)
- Create: `/Users/daodilyas/dev/iqra-portal/.env.example`
- Create: `/Users/daodilyas/dev/iqra-portal/.env.local` (NOT committed)

- [ ] **Step 1: Verify/install the Supabase CLI**

```bash
supabase --version
```

Expected: a version `2.x` or newer. If `command not found`:

```bash
brew install supabase/tap/supabase
supabase --version
```

- [ ] **Step 2: Initialize the Supabase project**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase init
```

Expected: `Finished supabase init.` Answer **N** to any prompt about generating VS Code/IntelliJ Deno settings. This creates `supabase/config.toml` and `supabase/.gitignore`.

```bash
touch /Users/daodilyas/dev/iqra-portal/supabase/seed.sql
```

(Empty seed placeholder so `supabase db reset` never warns; Task 6 fills it.)

- [ ] **Step 3: Edit config.toml — project id, region intent, auth + MFA**

Open `/Users/daodilyas/dev/iqra-portal/supabase/config.toml` and make these targeted edits (the file is long; only touch these keys, leave the rest as generated):

1. Top of file — confirm/set the project id and add the region-intent comment directly above it:

```toml
# Cloud project intent (Task 15 / README "Skyoppsett" documents the manual steps):
#   - Supabase project MUST be created in region eu-north-1 (Stockholm) — GDPR/EU hosting (spec §3).
#   - Link with: supabase link --project-ref <ref>   (never automated; requires dashboard login)
project_id = "iqra-portal"
```

2. In the `[auth]` section, set the local site URL:

```toml
[auth]
enabled = true
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000"]
```

(Keep every other `[auth]` key the CLI generated.)

3. Find the `[auth.mfa]` section (or add it after the `[auth.email]` block if the template lacks it) and ensure TOTP enroll+verify are enabled:

```toml
[auth.mfa]
max_enrolled_factors = 10

[auth.mfa.totp]
enroll_enabled = true
verify_enabled = true
```

4. Find the `[analytics]` section (generated with `enabled = true`) and turn it off, leaving its other keys as generated:

```toml
[analytics]
enabled = false
```

Amendment 2026-07-16 (documented deviation): this machine has 8 GiB host RAM and a ~3.8 GiB Docker Desktop VM. The local Logflare (`analytics`) and Vector containers are the heaviest in the stack and failed health checks on three consecutive `supabase start` runs, cascading to `realtime`/`storage` (which depend on Vector only while analytics is enabled). Phase 0 never uses local log analytics; this key affects the local stack only — cloud logging lives in the Supabase dashboard. Do NOT raise Docker Desktop's memory allocation instead: on an 8 GiB host that starves macOS.

- [ ] **Step 4: Start the local stack**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase start --ignore-health-check
```

Amendment 2026-07-16 (documented deviation #2): plain `supabase start` failed 4× on this machine and NOT from crashes — `docker stats` during boot showed CPU saturation (realtime 244%, studio 124%, pg_meta 90% simultaneously on the 4-vCPU VM; memory peaked under 1 GiB of 3.8). Container logs show services reaching readiness seconds *after* the CLI's fixed ~60-75s health window tears the stack down (`[db] health_timeout` covers only the db container). `--ignore-health-check` is the CLI's official flag for this ("Ignore unhealthy services and exit 0"): it skips the teardown and lets slow services finish booting. Because the flag also masks real failures, the health verification below is MANDATORY — never proceed to Step 5 without `ALL_HEALTHY`.

Expected from the start command (first run pulls Docker images, takes minutes): a block ending with `API URL: http://127.0.0.1:54321`, `DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres`, `Studio URL: http://127.0.0.1:54323`, plus `anon key: eyJ...` and `service_role key: eyJ...`; a warning about unhealthy services is expected and fine at this point. If it fails with a Docker daemon error: `open -a Docker`, wait, retry. (With `[analytics] enabled = false` no `logflare`/`vector` containers start and Studio's log explorer is empty locally — expected.)

Then verify every container actually reaches healthy (cold boot on this hardware needs 2-4 minutes past the CLI's window):

```bash
cd /Users/daodilyas/dev/iqra-portal
for i in $(seq 1 30); do
  sleep 10
  STATUS=$(docker ps --filter "name=supabase_" --format '{{.Names}} {{.Status}}')
  COUNT=$(printf '%s\n' "$STATUS" | grep -c 'Up' || true)
  NOT_READY=$(printf '%s\n' "$STATUS" | grep -E '\(health: starting\)|\(unhealthy\)' || true)
  if [ "$COUNT" -ge 10 ] && [ -z "$NOT_READY" ]; then echo ALL_HEALTHY; break; fi
  echo "waiting ($COUNT up): $NOT_READY"
done
docker ps --filter "name=supabase_" --format '{{.Names}} {{.Status}}'
```

Expected: `ALL_HEALTHY` within ~5 minutes, and the final listing shows all 10 containers (db, kong, auth, rest, realtime, storage, pg_meta, studio, inbucket/mailpit, edge-runtime) `Up` with none `(unhealthy)` or `(health: starting)`. (Observed 2026-07-16: 8 show `(healthy)`; `rest` and `edge-runtime` define no Docker healthcheck and show plain `Up` — that is healthy for them.) If any container is still not healthy when the loop ends: STOP — do not proceed to Step 5 — and report BLOCKED with that container's `docker logs --tail 50 <name>`.

- [ ] **Step 5: Create .env.example (committed) and .env.local (not committed)**

Create `/Users/daodilyas/dev/iqra-portal/.env.example`:

```bash
# Kopier til .env.local og fyll inn verdiene fra `supabase status`.
# Lokalt: URL er http://127.0.0.1:54321, nøklene står som "anon key" og "service_role key".
# I skyen (Vercel): hent verdiene fra Supabase-dashbordet (Settings -> API).

NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# KUN server. Havner ALDRI i klientkode. Brukes bare av src/lib/admin/.
SUPABASE_SERVICE_ROLE_KEY=
```

Then create the real local file:

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase status
```

Copy the `anon key` and `service_role key` values from the output into a new `/Users/daodilyas/dev/iqra-portal/.env.local` with the same three variables filled in.

- [ ] **Step 6: Verify .env.local is ignored, then commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git check-ignore .env.local && echo IGNORED
git add supabase/config.toml supabase/.gitignore supabase/seed.sql .env.example
git commit -m "chore: add local Supabase config with TOTP MFA and env template"
```

Expected: `IGNORED` printed; commit succeeds and does NOT include `.env.local` (check with `git show --stat HEAD`).

---

### Task 4: Core identity migration — private schema, profiles, user_roles, RLS (pgTAP TDD)

**Files:**
- Test: `/Users/daodilyas/dev/iqra-portal/supabase/tests/01_schema.sql`
- Test: `/Users/daodilyas/dev/iqra-portal/supabase/tests/02_profiles_user_roles_rls.sql`
- Create: `/Users/daodilyas/dev/iqra-portal/supabase/migrations/<timestamp>_core_identity.sql` (generated by `supabase migration new`)

This is wall 2 of the two-wall model (spec §6): RLS default-deny. **Default-deny means: `enable row level security` + no permissive policy = nobody reads or writes.** We only add the explicit policies listed below. pgTAP tests are written FIRST and must fail. Amendment 2026-07-16: the privilege layer is explicit too (header gotcha 8) — the migration revokes all api-role table grants and grants back only what the policies use; `anon` gets nothing, so the anon tests assert 42501 at the grant layer, not empty results.

How the tests impersonate users: `supabase test db` runs as `postgres` (bypasses RLS — used for setup and expected-value snapshots), then each check switches with `set local role authenticated;` after setting `request.jwt.claims` so `auth.uid()` resolves. Test users use the `aaaaaaaa-…` UUID range so they can never collide with seed users (Task 6 uses `11111111-…`–`66666666-…`). Tests never assert absolute table counts (except RLS-scoped ones like "exactly own row"), so they stay green after seeds land.

- [ ] **Step 1: Write the failing schema test**

Create `/Users/daodilyas/dev/iqra-portal/supabase/tests/01_schema.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Tables exist
select has_table('public'::name, 'profiles'::name, 'profiles table exists');
select has_table('public'::name, 'user_roles'::name, 'user_roles table exists');

-- Columns pinned by the spec
select has_column('public', 'profiles', 'full_name', 'profiles.full_name exists');
select has_column('public', 'profiles', 'phone', 'profiles.phone exists');
select has_column('public', 'profiles', 'locale', 'profiles.locale exists');
select col_default_is('public', 'profiles', 'locale', 'nb', 'locale defaults to nb');

-- RLS is ENABLED on every table (default-deny wall)
select ok((select relrowsecurity from pg_class
           where oid = 'public.profiles'::regclass), 'RLS enabled on profiles');
select ok((select relrowsecurity from pg_class
           where oid = 'public.user_roles'::regclass), 'RLS enabled on user_roles');

-- Role check constraint: only the five roles are accepted
select throws_ok(
  $$ insert into public.user_roles (user_id, role)
     values ('aaaaaaaa-0000-0000-0000-00000000000f', 'superuser') $$,
  '23514',
  null,
  'unknown role value is rejected by check constraint'
);

-- Helper functions exist in the private schema
select has_function('private', 'has_role', array['uuid', 'text'], 'private.has_role(uuid,text) exists');
select has_function('private', 'is_staff', array['uuid'], 'private.is_staff(uuid) exists');

select * from finish();
rollback;
```

- [ ] **Step 2: Write the failing RLS behavior test**

Create `/Users/daodilyas/dev/iqra-portal/supabase/tests/02_profiles_user_roles_rls.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- ── Setup (as postgres; bypasses RLS) ──────────────────────────────
-- Three users: an admin, and two ordinary users A and B.
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'pgtap-admin@test.local',
   '{"provider":"email","providers":["email"]}', '{"full_name":"Test Admin"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'pgtap-a@test.local',
   '{"provider":"email","providers":["email"]}', '{"full_name":"Bruker A"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000003',
   'authenticated', 'authenticated', 'pgtap-b@test.local',
   '{"provider":"email","providers":["email"]}', '{"full_name":"Bruker B"}', now(), now());

insert into public.user_roles (user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'parent'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'teacher');

-- The on-insert trigger must have auto-created one profile per user,
-- copying full_name from raw_user_meta_data.
select is(
  (select count(*) from public.profiles where id in (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000003')),
  3::bigint,
  'trigger auto-created a profile per auth user'
);
select is(
  (select full_name from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  'Bruker A',
  'trigger copied full_name from user metadata'
);

-- Snapshot expected totals as postgres (RLS bypassed) for the admin check.
-- The grant is required: the snapshot is read later under the
-- `authenticated` role, and temp tables carry normal ACLs.
create temporary table t_expected on commit drop as
  select count(*)::bigint as profile_count from public.profiles;
grant select on t_expected to authenticated;

-- ── Anon: no grants at all — denied at the privilege layer ─────────
set local role anon;
select throws_ok(
  $$ select count(*) from public.profiles $$,
  '42501',
  null,
  'anon is denied on profiles at the grant layer'
);
select throws_ok(
  $$ select count(*) from public.user_roles $$,
  '42501',
  null,
  'anon is denied on user_roles at the grant layer'
);
reset role;

-- ── User A: own profile only; own roles only ───────────────────────
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select results_eq(
  $$ select id from public.profiles $$,
  $$ values ('aaaaaaaa-0000-0000-0000-000000000002'::uuid) $$,
  'user A sees exactly their own profile row and no others'
);
select results_eq(
  $$ select role from public.user_roles $$,
  $$ values ('parent'::text) $$,
  'user A sees exactly their own role rows'
);
-- RLS semantics on UPDATE: rows hidden by the USING clause are simply
-- filtered out — the statement succeeds but matches 0 rows and raises no
-- error. So the correct adversarial assertion is "statement runs, target
-- row is untouched", verified as postgres right after.
select lives_ok(
  $$ update public.profiles set full_name = 'Kapret'
     where id = 'aaaaaaaa-0000-0000-0000-000000000003' $$,
  'update against another profile runs without matching any row'
);
select lives_ok(
  $$ update public.profiles set phone = '+47 40000000'
     where id = 'aaaaaaaa-0000-0000-0000-000000000002' $$,
  'user A can update their own profile'
);
reset role;

-- As postgres: B is untouched, A's own change landed.
select is(
  (select full_name from public.profiles
   where id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  'Bruker B',
  'foreign profile is unchanged after the attempted hijack'
);
select is(
  (select phone from public.profiles
   where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  '+47 40000000',
  'own-profile update landed'
);

-- ── Admin sees all profiles ────────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select results_eq(
  $$ select count(*) from public.profiles $$,
  $$ select profile_count from t_expected $$,
  'admin sees every profile'
);
reset role;

-- ── Nobody at authenticated level can grant themselves a role ──────
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.user_roles (user_id, role)
     values ('aaaaaaaa-0000-0000-0000-000000000002', 'admin') $$,
  '42501',
  null,
  'authenticated user cannot insert into user_roles (no grant, no policy = deny)'
);
reset role;

select * from finish();
rollback;
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase test db
```

Expected: FAIL — `01_schema.sql` reports missing tables (`relation "public.profiles" does not exist` style failures); `02_...` errors on the first insert referencing `public.user_roles`. Exit code non-zero.

- [ ] **Step 4: Create the migration**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase migration new core_identity
```

Expected: `Created new migration at supabase/migrations/<timestamp>_core_identity.sql`. Open that generated file and paste exactly:

```sql
-- Core identity: private helper schema, profiles, user_roles, RLS skeleton.
-- Security model (spec §6): RLS is DEFAULT-DENY — enabling RLS with no policy
-- denies everything; only the explicit policies below open narrow paths.

-- ── private schema: helpers that must not be exposed via PostgREST ──
create schema if not exists private;
-- Policies run helper functions as the querying role, so that role needs
-- USAGE on the schema (functions themselves are SECURITY DEFINER). Only
-- authenticated: every policy below is `to authenticated`, and anon holds no
-- table grants at all (header gotcha 8) so it never evaluates a policy.
grant usage on schema private to authenticated;

-- ── profiles ────────────────────────────────────────────────────────
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null default '',
  phone      text,
  locale     text not null default 'nb',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is
  'One row per auth user. Auto-created by trigger on auth.users insert.';

-- ── user_roles ──────────────────────────────────────────────────────
create table public.user_roles (
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null
             check (role in ('admin', 'teacher', 'parent', 'student', 'economy')),
  created_at timestamptz not null default now(),
  primary key (user_id, role) -- enforces unique(user_id, role)
);
comment on table public.user_roles is
  'A person can hold several roles (spec §3). Written only by the admin module (service role) or migrations/seeds — no authenticated write policy exists.';

-- ── helper functions (SECURITY DEFINER so RLS policies can consult
--    user_roles without recursing into user_roles'' own policies) ────
create or replace function private.has_role(uid uuid, r text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = uid and role = r
  );
$$;

create or replace function private.is_staff(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = uid and role in ('admin', 'teacher', 'economy')
  );
$$;

grant execute on function private.has_role(uuid, text) to authenticated;
grant execute on function private.is_staff(uuid) to authenticated;

-- ── updated_at maintenance ─────────────────────────────────────────
create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- ── profile auto-creation on signup/provisioning ───────────────────
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ── Grant layer (wall 2a): explicit table privileges ────────────────
-- Never rely on the platform's default ACL — it varies by Supabase vintage
-- (legacy projects: GRANT ALL to the api roles; current: TRUNCATE/REFERENCES/
-- TRIGGER/MAINTAIN only; after 2026-10-30: nothing — header gotcha 8).
-- Normalize to zero, then grant back exactly the verbs the policies below are
-- written for. anon gets NOTHING: anonymous requests die at the privilege
-- layer (42501) before RLS is consulted. service_role (BYPASSRLS, server-only)
-- is the admin module's sanctioned writer for identity tables. authenticated
-- UPDATE on profiles is column-scoped: the user-editable columns only, so a
-- user cannot forge id/created_at/updated_at on their own row.
revoke all on table public.profiles   from anon, authenticated, service_role;
revoke all on table public.user_roles from anon, authenticated, service_role;
grant select on public.profiles to authenticated;
grant update (full_name, phone, locale) on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select, insert, update, delete on public.profiles   to service_role;
grant select, insert, update, delete on public.user_roles to service_role;

-- ── RLS: enable (default-deny), then explicit narrow policies ──────
alter table public.profiles  enable row level security;
alter table public.user_roles enable row level security;

-- profiles: a user reads/updates their own row; admins read all rows.
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or private.has_role((select auth.uid()), 'admin')
  );

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- user_roles: a user reads their own roles (role switcher); admins read all.
-- Deliberately NO insert/update/delete policies: role management happens via
-- the service-role admin module (Phase 1 UI) which bypasses RLS after its own
-- admin re-verification + audit entry.
create policy "user_roles_select_own_or_admin"
  on public.user_roles for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_role((select auth.uid()), 'admin')
  );
```

- [ ] **Step 5: Apply migration and re-run tests**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase db reset
supabase test db
```

Expected: reset prints `Applying migration <timestamp>_core_identity.sql`; then both test files pass: `01_schema.sql .. ok`, `02_profiles_user_roles_rls.sql .. ok`, `All tests successful.`

- [ ] **Step 6: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add supabase/tests/01_schema.sql supabase/tests/02_profiles_user_roles_rls.sql supabase/migrations/
git commit -m "feat: core identity schema with default-deny RLS and pgTAP harness"
```

---

### Task 5: Audit log + settings migration (pgTAP TDD)

**Files:**
- Test: `/Users/daodilyas/dev/iqra-portal/supabase/tests/03_audit_log_rls.sql`
- Test: `/Users/daodilyas/dev/iqra-portal/supabase/tests/04_settings.sql`
- Create: `/Users/daodilyas/dev/iqra-portal/supabase/migrations/<timestamp>_audit_and_settings.sql`

`audit_log` is append-only (spec §4/§6): the ONLY sanctioned write path for app roles is the security-definer function `private.audit(...)`; only admins may read; nobody — not even `service_role` — holds UPDATE/DELETE grants. `settings` is a single-row table enforced by `id boolean primary key default true check (id)`.

- [ ] **Step 1: Write the failing audit_log test**

Create `/Users/daodilyas/dev/iqra-portal/supabase/tests/03_audit_log_rls.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- ── Setup (as postgres) ────────────────────────────────────────────
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'pgtap-audit-admin@test.local',
   '{"provider":"email","providers":["email"]}', '{"full_name":"Audit Admin"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'pgtap-audit-user@test.local',
   '{"provider":"email","providers":["email"]}', '{"full_name":"Audit Bruker"}', now(), now());

insert into public.user_roles (user_id, role) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'admin'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'teacher');

select has_table('public'::name, 'audit_log'::name, 'audit_log table exists');
select ok((select relrowsecurity from pg_class
           where oid = 'public.audit_log'::regclass), 'RLS enabled on audit_log');

-- ── Direct writes are denied for app roles ─────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ insert into public.audit_log (action, entity) values ('sneaky', 'audit_log') $$,
  '42501',
  null,
  'authenticated cannot INSERT into audit_log directly'
);

-- ── The sanctioned path works: private.audit() as an ordinary user ──
select lives_ok(
  $$ select private.audit('test.event', 'pgtap', 'entity-1', '{"kilde":"pgtap"}'::jsonb) $$,
  'private.audit() inserts on behalf of the calling user'
);

-- ── Non-admin cannot read the audit log ────────────────────────────
select is((select count(*) from public.audit_log), 0::bigint,
  'non-admin (teacher) reads zero audit rows');
reset role;

-- anon lost ALL grants on audit_log — even SELECT raises permission denied
set local role anon;
select throws_ok(
  $$ select count(*) from public.audit_log $$,
  '42501',
  null,
  'anon has no grant on audit_log at all'
);
reset role;

-- ── Admin reads the entry written above, with actor recorded ───────
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select results_eq(
  $$ select actor_id, action, entity, entity_id from public.audit_log
     where action = 'test.event' $$,
  $$ values ('bbbbbbbb-0000-0000-0000-000000000002'::uuid, 'test.event'::text,
             'pgtap'::text, 'entity-1'::text) $$,
  'admin reads the audit entry; actor_id captured from auth.uid()'
);

-- ── Append-only: even admin cannot UPDATE or DELETE ────────────────
select throws_ok(
  $$ update public.audit_log set action = 'tampered' where action = 'test.event' $$,
  '42501',
  null,
  'admin cannot UPDATE audit_log (append-only)'
);
select throws_ok(
  $$ delete from public.audit_log where action = 'test.event' $$,
  '42501',
  null,
  'admin cannot DELETE from audit_log (append-only)'
);
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Write the failing settings test**

Create `/Users/daodilyas/dev/iqra-portal/supabase/tests/04_settings.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- ── Setup: one authenticated user, no roles needed ─────────────────
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'pgtap-settings@test.local',
   '{"provider":"email","providers":["email"]}', '{"full_name":"Innstillinger Bruker"}', now(), now());

select has_table('public'::name, 'settings'::name, 'settings table exists');

-- Baseline row was inserted by the migration itself
select results_eq(
  $$ select school_name, retention_months, purring_fee_ore from public.settings $$,
  $$ values ('IQRA senter'::text, 12, 3800) $$,
  'baseline settings row exists with spec defaults'
);

-- Single-row enforcement
select throws_ok(
  $$ insert into public.settings (id, school_name) values (false, 'Kopi') $$,
  '23514',
  null,
  'id=false violates the check constraint (single-row table)'
);
select throws_ok(
  $$ insert into public.settings (id, school_name) values (true, 'Kopi') $$,
  '23505',
  null,
  'second id=true row violates the primary key (single-row table)'
);

-- Any authenticated user can read settings (school name in the shell)
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.settings), 1::bigint,
  'authenticated user reads the settings row');
select throws_ok(
  $$ update public.settings set school_name = 'Kapret skole' $$,
  '42501',
  null,
  'authenticated user cannot update settings (no policy = deny)'
);
reset role;

-- anon lost ALL grants on settings — even SELECT raises permission denied
set local role anon;
select throws_ok(
  $$ select count(*) from public.settings $$,
  '42501',
  null,
  'anon has no grant on settings at all'
);
reset role;

select * from finish();
rollback;
```

- [ ] **Step 3: Run tests to verify the new ones fail**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase test db
```

Expected: `01_...` and `02_...` still pass; `03_audit_log_rls.sql` and `04_settings.sql` FAIL (`relation "public.audit_log" does not exist` / `relation "public.settings" does not exist`).

- [ ] **Step 4: Create the migration**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase migration new audit_and_settings
```

Open the generated `supabase/migrations/<timestamp>_audit_and_settings.sql` and paste exactly:

```sql
-- Audit log (append-only) and single-row settings.

-- ── audit_log ───────────────────────────────────────────────────────
create table public.audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid references auth.users (id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  text,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table public.audit_log is
  'Append-only. Writes ONLY via private.audit() (security definer) or the service-role admin module. No UPDATE/DELETE grants exist for anyone (spec §4/§6).';

alter table public.audit_log enable row level security;

-- Grant layer (wall 2a, header gotcha 8): never rely on the platform's
-- default ACL — normalize to zero, grant back the narrow set. Append-only:
-- nobody, not even service_role, gets UPDATE or DELETE. authenticated gets
-- SELECT (admin-gated by the policy below); its only write path is
-- private.audit() (security definer). service_role (server-only admin
-- module) inserts and reads directly.
revoke all on table public.audit_log from anon, authenticated, service_role;
grant select on public.audit_log to authenticated;
grant select, insert on public.audit_log to service_role;
-- The identity sequence: the default ACL hands api roles setval/nextval
-- (`w`), and a setval rewind would make future audit inserts collide with
-- existing ids and fail — an audit-suppression vector. Strip it.
-- service_role keeps USAGE as belt and braces (identity inserts do not
-- strictly require sequence privileges).
revoke all on sequence public.audit_log_id_seq from anon, authenticated;
grant usage on sequence public.audit_log_id_seq to service_role;

-- Only admins may read the audit log.
create policy "audit_log_select_admin"
  on public.audit_log for select
  to authenticated
  using (private.has_role((select auth.uid()), 'admin'));

-- No INSERT/UPDATE/DELETE policies: default-deny. The sanctioned write path:
create or replace function private.audit(
  p_action    text,
  p_entity    text,
  p_entity_id text default null,
  p_meta      jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values ((select auth.uid()), p_action, p_entity, p_entity_id, p_meta);
$$;

grant execute on function private.audit(text, text, text, jsonb) to authenticated;

-- ── settings (single row) ───────────────────────────────────────────
create table public.settings (
  id               boolean primary key default true check (id),
  school_name      text not null default 'IQRA senter',
  retention_months integer not null default 12 check (retention_months > 0),
  purring_fee_ore  integer not null default 3800 check (purring_fee_ore >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.settings is
  'Exactly one row (id must be true). Grows in later phases: current term, grade-scale labels (spec §4).';

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function private.set_updated_at();

insert into public.settings (id) values (true);

alter table public.settings enable row level security;

-- Grant layer (wall 2a, header gotcha 8): normalize to zero, grant back the
-- narrow set. Reads for every logged-in user (policy below); writes only via
-- the service-role admin module (Phase 7 UI) — and deliberately NO DELETE
-- even for service_role: the single settings row must never disappear.
-- Denials surface as 42501 at the privilege layer — explicit, easy to test.
revoke all on table public.settings from anon, authenticated, service_role;
grant select on public.settings to authenticated;
grant select, insert, update on public.settings to service_role;

-- Every logged-in user may read school settings (name in the shell header).
create policy "settings_select_authenticated"
  on public.settings for select
  to authenticated
  using (true);
```

- [ ] **Step 5: Apply and verify all tests pass**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase db reset
supabase test db
```

Expected: `Applying migration <timestamp>_audit_and_settings.sql` during reset, then all four test files `ok`, `All tests successful.`

- [ ] **Step 6: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add supabase/tests/03_audit_log_rls.sql supabase/tests/04_settings.sql supabase/migrations/
git commit -m "feat: append-only audit log and single-row settings with RLS"
```

---

### Task 6: Seed — six local test users (LOCAL ONLY)

**Files:**
- Modify: `/Users/daodilyas/dev/iqra-portal/supabase/seed.sql` (replace the empty placeholder)

Seeds run only on `supabase db reset` / `supabase start` against the LOCAL database. `supabase db push` applies migrations only — seeds never reach the cloud. The file also states this in its header. Password for all six: `test-passord-123`. `laererforelder@test.local` holds BOTH `teacher` and `parent` (exercises the role switcher).

- [ ] **Step 1: Write seed.sql**

Replace the contents of `/Users/daodilyas/dev/iqra-portal/supabase/seed.sql` with:

```sql
-- ═══════════════════════════════════════════════════════════════════
-- LOCAL-ONLY SEED. Runs on `supabase db reset` against the local stack.
-- Never applied in the cloud (`supabase db push` only runs migrations).
-- Six test users, password for all: test-passord-123
--   admin@test.local           admin
--   laerer@test.local          teacher
--   forelder@test.local        parent
--   elev@test.local            student
--   okonomi@test.local         economy
--   laererforelder@test.local  teacher + parent (role switcher)
-- ═══════════════════════════════════════════════════════════════════

-- auth.users: the on_auth_user_created trigger auto-creates profiles,
-- copying full_name from raw_user_meta_data. Token columns are set to ''
-- (not null) to avoid GoTrue scan errors on some versions.
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, recovery_token, email_change_token_new, email_change)
select
  '00000000-0000-0000-0000-000000000000',
  u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('test-passord-123', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', u.full_name),
  now(), now(), '', '', '', ''
from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'admin@test.local',          'Amina Hassan'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'laerer@test.local',         'Leila Ahmed'),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'forelder@test.local',       'Omar Farah'),
  ('44444444-4444-4444-4444-444444444444'::uuid, 'elev@test.local',           'Yusuf Farah'),
  ('55555555-5555-5555-5555-555555555555'::uuid, 'okonomi@test.local',        'Khadija Ali'),
  ('66666666-6666-6666-6666-666666666666'::uuid, 'laererforelder@test.local', 'Sara Omar')
) as u(id, email, full_name);

-- auth.identities: required for email+password login with current GoTrue
-- (provider_id = user id for the email provider).
insert into auth.identities
  (id, user_id, provider_id, identity_data, provider,
   last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email like '%@test.local';

-- Roles per the matrix above.
insert into public.user_roles (user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'teacher'),
  ('33333333-3333-3333-3333-333333333333', 'parent'),
  ('44444444-4444-4444-4444-444444444444', 'student'),
  ('55555555-5555-5555-5555-555555555555', 'economy'),
  ('66666666-6666-6666-6666-666666666666', 'teacher'),
  ('66666666-6666-6666-6666-666666666666', 'parent');
```

- [ ] **Step 2: Apply and verify seeds**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase db reset
docker exec supabase_db_iqra-portal psql -U postgres -d postgres -c \
  "select u.email, p.full_name, r.role
   from auth.users u
   join public.profiles p on p.id = u.id
   join public.user_roles r on r.user_id = u.id
   order by u.email, r.role;"
```

(`psql` is not installed on macOS by default, so the query runs inside the Supabase Postgres container. The CLI names it `supabase_db_<project-dir-name>`, here `supabase_db_iqra-portal`; if the exec fails, find the actual name with `docker ps --format '{{.Names}}' | grep supabase_db`.)

Expected: reset prints `Seeding data from supabase/seed.sql...`; the query returns exactly **7 rows** (6 users; `laererforelder@test.local` appears twice — `parent` and `teacher`), each with the Norwegian full name from the seed.

- [ ] **Step 3: Verify a seeded password actually logs in through GoTrue**

```bash
ANON_KEY=$(cd /Users/daodilyas/dev/iqra-portal && supabase status --output json | python3 -c "import sys, json; print(json.load(sys.stdin)['ANON_KEY'])")
curl -s -X POST "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
  -H "apikey: ${ANON_KEY}" -H "Content-Type: application/json" \
  -d '{"email":"forelder@test.local","password":"test-passord-123"}' | head -c 300
```

Expected: JSON containing `"access_token":"eyJ...` (login works). If it returns `invalid_grant`, the identities insert is wrong — fix before continuing. (If `supabase status --output json` uses different key names on your CLI version, run plain `supabase status` and paste the anon key manually.)

- [ ] **Step 4: Confirm the pgTAP suite is still green with seeds present**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase test db
```

Expected: all 4 files pass — the tests were written to be seed-independent (temp-table snapshots, per-user scoped assertions, distinct UUID ranges).

- [ ] **Step 5: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add supabase/seed.sql
git commit -m "feat: seed six local test users covering all roles"
```

---

### Task 7: Design tokens (Tailwind v4 `@theme`), Outfit font, root layout

**Files:**
- Modify: `/Users/daodilyas/dev/iqra-portal/src/app/globals.css` (replace entirely)
- Modify: `/Users/daodilyas/dev/iqra-portal/src/app/layout.tsx` (replace entirely)
- Modify: `/Users/daodilyas/dev/iqra-portal/src/app/page.tsx` (temporary token preview; Task 11 replaces it)
- Delete: create-next-app boilerplate SVGs in `public/`

Direction "C · Familie" (spec §7): light, restrained + warm, one green accent, rounded geometry, Outfit. Tailwind v4 `hover:` variants are already gated behind `@media (hover: hover)` — the spec's hover requirement comes for free.

- [ ] **Step 1: Replace globals.css with the token sheet**

Replace the entire contents of `/Users/daodilyas/dev/iqra-portal/src/app/globals.css` with:

```css
@import "tailwindcss";

/* ── IQRA design tokens — direction "C · Familie" (spec §7) ──────────
   Light theme, restrained + warm, single green accent.
   Never #000/#fff: `ink` and `canvas` carry all neutral duties.
   No purple anywhere. */
@theme {
  /* Color (OKLCH) */
  --color-canvas: oklch(0.99 0.003 150);
  --color-ink: oklch(0.25 0.02 155);
  --color-primary: oklch(0.44 0.09 160);
  --color-primary-strong: oklch(0.38 0.09 160); /* hover/pressed on primary */
  --color-surface-tint: oklch(0.95 0.025 158);
  --color-hairline: oklch(0.93 0.01 155);
  /* Semantic states, tuned to the same warm hue family.
     The `-ink` variants are AA-contrast text colors for tinted chips. */
  --color-success: oklch(0.52 0.11 158);
  --color-success-ink: oklch(0.36 0.1 158);
  --color-warning: oklch(0.68 0.13 80);
  --color-warning-ink: oklch(0.42 0.11 80);
  --color-danger: oklch(0.5 0.16 28);
  --color-danger-ink: oklch(0.4 0.15 28);

  /* Type — fixed rem scale, ratio ~1.2: 13/14/16/18/20/24 px (spec §7).
     Overrides Tailwind's default text-xs…text-2xl steps. */
  --text-xs: 0.8125rem;
  --text-xs--line-height: 1.4;
  --text-sm: 0.875rem;
  --text-sm--line-height: 1.4;
  --text-base: 1rem;
  --text-base--line-height: 1.5;
  --text-lg: 1.125rem;
  --text-lg--line-height: 1.45;
  --text-xl: 1.25rem;
  --text-xl--line-height: 1.3;
  --text-2xl: 1.5rem;
  --text-2xl--line-height: 1.25;

  /* Shape — rounded geometry: radii 10/14/18 + pill (spec §7) */
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 18px;
  --radius-pill: 999px;

  /* Motion — 150–250ms, ease-out, transform/opacity only */
  --ease-brand: cubic-bezier(0.23, 1, 0.32, 1);
}

/* next/font sets --font-outfit on <html>; `inline` maps it into Tailwind */
@theme inline {
  --font-sans: var(--font-outfit), ui-sans-serif, system-ui, sans-serif;
}

@layer base {
  /* All figures line up (spec §7): tabular digits everywhere */
  body {
    font-variant-numeric: tabular-nums;
  }
}

/* Respect prefers-reduced-motion globally (spec §7) */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Replace the root layout (Outfit 400/500/600/700, lang="nb")**

Replace the entire contents of `/Users/daodilyas/dev/iqra-portal/src/app/layout.tsx` with:

```tsx
import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'IQRA portal', template: '%s – IQRA portal' },
  description: 'Skoleportal for IQRA senter — oppmøte, fremdrift og beskjeder.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nb" className={outfit.variable}>
      <body className="bg-canvas font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Replace the boilerplate home page with a temporary token preview**

Replace the entire contents of `/Users/daodilyas/dev/iqra-portal/src/app/page.tsx` with (Task 11 replaces this again with the real role-based redirect):

```tsx
export default function Home() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">IQRA portal</h1>
      <p className="text-ink/70">
        Grunnmuren er på plass. Innlogging kommer i en senere oppgave.
      </p>
      <div className="flex gap-2">
        <span className="size-8 rounded-sm bg-primary" />
        <span className="size-8 rounded-sm bg-surface-tint" />
        <span className="size-8 rounded-sm border border-hairline bg-canvas" />
        <span className="size-8 rounded-sm bg-success" />
        <span className="size-8 rounded-sm bg-warning" />
        <span className="size-8 rounded-sm bg-danger" />
      </div>
    </main>
  );
}
```

Delete the unused create-next-app assets:

```bash
cd /Users/daodilyas/dev/iqra-portal
rm -f public/next.svg public/vercel.svg public/file.svg public/globe.svg public/window.svg
```

- [ ] **Step 4: Verify build + visual check**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run build
grep -c -- '--text-' src/app/globals.css
```

Expected: typecheck and build exit 0; the grep prints `12` (six type sizes + six line-heights — the spec §7 scale is tokenized, not left at Tailwind defaults). Then optionally `npm run dev` and open `http://localhost:3000`: Outfit typeface, warm off-white background (not pure white), the `text-2xl` heading at 24 px with the tighter 1.25 line-height, six swatches — green, pale green tint, hairline-bordered canvas, and the three semantic tones. No purple anywhere.

- [ ] **Step 5: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add src/app/globals.css src/app/layout.tsx src/app/page.tsx public
git commit -m "feat: add Familie design tokens, Outfit font and Norwegian root layout"
```

---

### Task 8: Core UI primitives — Button, Field+Input, Chip, Skeleton, EmptyState (TDD)

**Files:**
- Create: `/Users/daodilyas/dev/iqra-portal/src/lib/cn.ts`
- Test: `/Users/daodilyas/dev/iqra-portal/src/components/ui/Button.test.tsx`
- Test: `/Users/daodilyas/dev/iqra-portal/src/components/ui/Field.test.tsx`
- Test: `/Users/daodilyas/dev/iqra-portal/src/components/ui/primitives.test.tsx`
- Create: `/Users/daodilyas/dev/iqra-portal/src/components/ui/Button.tsx`
- Create: `/Users/daodilyas/dev/iqra-portal/src/components/ui/Input.tsx`
- Create: `/Users/daodilyas/dev/iqra-portal/src/components/ui/Field.tsx`
- Create: `/Users/daodilyas/dev/iqra-portal/src/components/ui/Chip.tsx`
- Create: `/Users/daodilyas/dev/iqra-portal/src/components/ui/Skeleton.tsx`
- Create: `/Users/daodilyas/dev/iqra-portal/src/components/ui/EmptyState.tsx`

Every interactive component ships default/hover/focus-visible/active/disabled/loading states (spec §7). Touch targets ≥44px (`min-h-11`). Press feedback `scale(0.97)`. Motion 200ms with the brand cubic-bezier, transform/opacity/color only. None of these files use `'use client'` — they contain no hooks, so client pages that pass handlers pull them into the client bundle automatically, while server pages can render them statically.

- [ ] **Step 1: Write the failing tests**

Create `/Users/daodilyas/dev/iqra-portal/src/components/ui/Button.test.tsx`:

```tsx
import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders its label and fires onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Logg inn</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Logg inn' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['primary', 'bg-primary'],
    ['secondary', 'border-border-input'],
    ['ghost', 'text-primary'],
  ] as const)('applies the %s variant class', (variant, expectedClass) => {
    render(<Button variant={variant}>Knapp</Button>);
    expect(screen.getByRole('button', { name: 'Knapp' }).className).toContain(
      expectedClass,
    );
  });

  it('is disabled and announced busy while loading, and swallows clicks', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Lagrer
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Lagrer' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('defaults to type="button" so it never submits forms accidentally', () => {
    render(<Button>Knapp</Button>);
    expect(screen.getByRole('button', { name: 'Knapp' })).toHaveAttribute(
      'type',
      'button',
    );
  });

  it('forwards a ref to the underlying button element', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Knapp</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
```

Create `/Users/daodilyas/dev/iqra-portal/src/components/ui/Field.test.tsx`:

```tsx
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from './Field';
import { Input } from './Input';

describe('Field + Input', () => {
  it('associates the label with the control (label above input, spec §7)', () => {
    render(
      <Field label="E-post" htmlFor="epost">
        <Input id="epost" type="email" />
      </Field>,
    );
    expect(screen.getByLabelText('E-post')).toBeInTheDocument();
  });

  it('renders the error below with the "-feil" id convention and marks the input invalid', () => {
    render(
      <Field label="Passord" htmlFor="passord" error="Oppgi passord">
        <Input id="passord" type="password" invalid aria-describedby="passord-feil" />
      </Field>,
    );
    const input = screen.getByLabelText('Passord');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Oppgi passord');
    expect(screen.getByRole('alert')).toHaveTextContent('Oppgi passord');
  });

  it('renders no error node when there is no error', () => {
    render(
      <Field label="E-post" htmlFor="epost">
        <Input id="epost" />
      </Field>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('forwards a ref to the underlying input element', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} id="epost" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
```

Create `/Users/daodilyas/dev/iqra-portal/src/components/ui/primitives.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Chip } from './Chip';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';

describe('Chip', () => {
  it.each([
    ['neutral', 'bg-surface-tint'],
    ['success', 'text-success-ink'],
    ['warning', 'text-warning-ink'],
    ['danger', 'text-danger-ink'],
  ] as const)('maps tone %s to its token class', (tone, expectedClass) => {
    render(<Chip tone={tone}>Til stede</Chip>);
    expect(screen.getByText('Til stede').className).toContain(expectedClass);
  });
});

describe('Skeleton', () => {
  it('is hidden from assistive tech', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('EmptyState', () => {
  it('teaches: heading, explanation and optional action', () => {
    render(
      <EmptyState
        title="Ingen barn registrert ennå"
        description="Når skolen har registrert barna dine, ser du timeplan, oppmøte og fremdrift her."
        action={<a href="/hjelp">Kontakt administrasjonen</a>}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Ingen barn registrert ennå' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/registrert barna dine/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Kontakt administrasjonen' }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm test
```

Expected: FAIL — all three new files cannot resolve `./Button`, `./Field`, etc. (`format.test.ts` still passes.)

- [ ] **Step 3: Implement the primitives**

Create `/Users/daodilyas/dev/iqra-portal/src/lib/cn.ts`:

```ts
/** Joins truthy class fragments. Kept dependency-free on purpose. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
```

Create `/Users/daodilyas/dev/iqra-portal/src/components/ui/Button.tsx`:

```tsx
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  /** Shows a spinner, sets aria-busy and disables the button. */
  loading?: boolean;
}

const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 text-base font-medium ' +
  'transition-[transform,background-color,border-color,opacity] duration-200 ease-brand ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
  'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-strong',
  secondary:
    'border border-border-input bg-surface-tint text-ink hover:border-primary/40',
  ghost: 'bg-transparent text-primary hover:bg-surface-tint',
};

export function Button({
  variant = 'primary',
  loading = false,
  className,
  children,
  disabled,
  type,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={cn(base, variants[variant], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      className="size-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="4"
      />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
```

Create `/Users/daodilyas/dev/iqra-portal/src/components/ui/Input.tsx`:

```tsx
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends ComponentProps<'input'> {
  /** Marks the input invalid; pair with aria-describedby="<id>-feil". */
  invalid?: boolean;
}

export function Input({ invalid = false, className, ...rest }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        'min-h-11 w-full rounded-md border bg-canvas px-4 text-base text-ink placeholder:text-ink/45',
        'transition-colors duration-200 ease-brand',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        invalid ? 'border-danger' : 'border-border-input',
        className,
      )}
      {...rest}
    />
  );
}
```

Create `/Users/daodilyas/dev/iqra-portal/src/components/ui/Field.tsx`:

```tsx
import type { ReactNode } from 'react';

export interface FieldProps {
  label: string;
  htmlFor: string;
  /** Inline error shown below the control with id `${htmlFor}-feil`. */
  error?: string;
  children: ReactNode;
}

/**
 * Label above, control in the middle, inline error below (spec §7).
 * Convention: when passing `error`, also give the child control
 * `invalid` and `aria-describedby={`${htmlFor}-feil`}`.
 */
export function Field({ label, htmlFor, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-feil`} role="alert" className="text-sm text-danger-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
```

Create `/Users/daodilyas/dev/iqra-portal/src/components/ui/Chip.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ChipTone = 'neutral' | 'success' | 'warning' | 'danger';

const tones: Record<ChipTone, string> = {
  neutral: 'bg-surface-tint text-ink',
  success: 'bg-success/15 text-success-ink',
  warning: 'bg-warning/15 text-warning-ink',
  danger: 'bg-danger/15 text-danger-ink',
};

export function Chip({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: ChipTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-3 py-1 text-sm font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
```

Create `/Users/daodilyas/dev/iqra-portal/src/components/ui/Skeleton.tsx`:

```tsx
import { cn } from '@/lib/cn';

/** Loading placeholder. Size it with className (e.g. "h-4 w-24"). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-surface-tint', className)}
    />
  );
}
```

Create `/Users/daodilyas/dev/iqra-portal/src/components/ui/EmptyState.tsx`:

```tsx
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

/** Teaching empty state (spec §7): explains what will appear here and why. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-tint/60 px-6 py-10 text-center">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-base leading-relaxed text-ink/70">
        {description}
      </p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
```

- [ ] **Step 4: Run tests and typecheck to verify green**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm test && npm run typecheck
```

Expected: `Test Files  4 passed` (format + Button + Field + primitives), all tests pass, tsc silent.

- [ ] **Step 5: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add src/lib/cn.ts src/components/ui
git commit -m "feat: core UI primitives with full interaction states"
```

---

### Task 9: Env validation, Supabase clients (server/browser/middleware), generated DB types

**Files:**
- Test: `/Users/daodilyas/dev/iqra-portal/src/lib/env.test.ts`
- Create: `/Users/daodilyas/dev/iqra-portal/src/lib/env.ts`
- Create: `/Users/daodilyas/dev/iqra-portal/src/lib/supabase/database.types.ts` (generated)
- Create: `/Users/daodilyas/dev/iqra-portal/src/lib/supabase/server.ts`
- Create: `/Users/daodilyas/dev/iqra-portal/src/lib/supabase/client.ts`
- Create: `/Users/daodilyas/dev/iqra-portal/src/lib/supabase/middleware.ts`

- [ ] **Step 1: Install runtime dependencies**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm install @supabase/supabase-js @supabase/ssr zod server-only
```

Expected: exit 0. (Zod v4 — note `z.url()` is the v4 spelling used below.)

- [ ] **Step 2: Write the failing env test**

Create `/Users/daodilyas/dev/iqra-portal/src/lib/env.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPublicEnv, getServiceRoleKey } from './env';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getPublicEnv', () => {
  it('returns the values when both public vars are set', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    expect(getPublicEnv()).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    });
  });

  it.each([
    ['NEXT_PUBLIC_SUPABASE_URL missing', '', 'anon-key'],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY missing', 'http://127.0.0.1:54321', ''],
    ['URL not a URL', 'ikke-en-url', 'anon-key'],
  ])('fails fast with a descriptive message when %s', (_case, url, anon) => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', url);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', anon);
    expect(() => getPublicEnv()).toThrow(/env\.local .* \.env\.example/);
  });
});

describe('getServiceRoleKey', () => {
  it('returns the key when set', () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    expect(getServiceRoleKey()).toBe('service-key');
  });

  it('fails fast when missing', () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(() => getServiceRoleKey()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm test
```

Expected: FAIL — cannot resolve `./env`.

- [ ] **Step 4: Implement env.ts**

Create `/Users/daodilyas/dev/iqra-portal/src/lib/env.ts`:

```ts
import { z } from 'zod';

/**
 * Fail-fast env access (never silently run against the wrong backend).
 * NEXT_PUBLIC_* values are inlined at build time, so they must be read as
 * static member expressions — never via dynamic keys.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export type PublicEnv = z.infer<typeof publicSchema>;

export function getPublicEnv(): PublicEnv {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      'Ugyldig Supabase-oppsett: sjekk .env.local mot .env.example ' +
        '(NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_ANON_KEY). ' +
        `Detaljer: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

/** Server secret for the quarantined admin module (src/lib/admin/) ONLY. */
export function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY mangler. Sett den i .env.local (lokalt: `supabase status`). ' +
        'Denne nøkkelen skal ALDRI eksponeres til klienten.',
    );
  }
  return key;
}
```

- [ ] **Step 5: Run env tests to verify they pass**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm test
```

Expected: all test files pass, including `env.test.ts` (6 tests).

- [ ] **Step 6: Generate database types from the local schema**

```bash
cd /Users/daodilyas/dev/iqra-portal
mkdir -p src/lib/supabase
npm run db:types
grep -c 'user_roles\|audit_log\|settings\|profiles' src/lib/supabase/database.types.ts
```

Expected: `db:types` writes `src/lib/supabase/database.types.ts`; grep prints a number ≥ 4 (all four tables present in the generated `Database` type).

- [ ] **Step 7: Create the three Supabase clients**

Create `/Users/daodilyas/dev/iqra-portal/src/lib/supabase/server.ts` (RSC + Server Actions; RLS applies because it carries the user's cookies):

```ts
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getPublicEnv } from '@/lib/env';
import type { Database } from './database.types';

/** Per-request anon-key client with the caller's cookies — RLS applies. */
export async function createClient() {
  const cookieStore = await cookies();
  const env = getPublicEnv();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Next.js forbids cookie writes from Server Components.
            // Intentionally ignored: src/proxy.ts refreshes the session
            // cookies on every matched request instead.
          }
        },
      },
    },
  );
}
```

Create `/Users/daodilyas/dev/iqra-portal/src/lib/supabase/client.ts` (browser; used by the MFA pages):

```ts
import { createBrowserClient } from '@supabase/ssr';
import { getPublicEnv } from '@/lib/env';
import type { Database } from './database.types';

export function createClient() {
  const env = getPublicEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
```

Create `/Users/daodilyas/dev/iqra-portal/src/lib/supabase/middleware.ts` (session refresh for `src/proxy.ts`, Task 13):

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getPublicEnv } from '@/lib/env';
import type { Database } from './database.types';

/**
 * Refreshes the auth session inside the proxy (Next 16 middleware) and keeps
 * request/response cookies in sync. `getResponse()` must be called AFTER all
 * auth work, because setAll may swap the response object during refresh.
 */
export async function loadSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getPublicEnv();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user, getResponse: () => response };
}
```

- [ ] **Step 8: Verify typecheck, tests, build**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm test && npm run build
```

Expected: all green. (The build does not evaluate the Supabase clients yet — nothing imports them until Task 11.)

- [ ] **Step 9: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add package.json package-lock.json src/lib/env.ts src/lib/env.test.ts src/lib/supabase
git commit -m "feat: env validation and typed Supabase clients for server, browser and proxy"
```

---

### Task 10: Pure access logic — roles, portal paths, MFA gate (TDD)

**Files:**
- Test: `/Users/daodilyas/dev/iqra-portal/src/lib/auth/access.test.ts`
- Create: `/Users/daodilyas/dev/iqra-portal/src/lib/auth/access.ts`

This module is deliberately pure (no I/O) so the middleware decision table is unit-testable. The AAL semantics were verified against Supabase docs: `aal1/aal1` = not enrolled, `aal1/aal2` = enrolled but not verified this session, `aal2/*` = verified.

- [ ] **Step 1: Write the failing test**

Create `/Users/daodilyas/dev/iqra-portal/src/lib/auth/access.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  ALL_ROLES,
  defaultPortalPath,
  hasStaffRole,
  isRole,
  isStaffRole,
  mfaGate,
  PORTAL_PATHS,
} from './access';

describe('roles', () => {
  it.each([
    ['admin', true],
    ['teacher', true],
    ['economy', true],
    ['parent', false],
    ['student', false],
    ['superuser', false],
  ])('isStaffRole(%s) -> %s', (role, expected) => {
    expect(isStaffRole(role)).toBe(expected);
  });

  it.each([
    ['admin', true],
    ['teacher', true],
    ['parent', true],
    ['student', true],
    ['economy', true],
    ['root', false],
    ['', false],
  ])('isRole(%s) -> %s', (value, expected) => {
    expect(isRole(value)).toBe(expected);
  });

  it('maps every role to its Norwegian portal path', () => {
    expect(PORTAL_PATHS).toEqual({
      admin: '/admin',
      teacher: '/laerer',
      parent: '/forelder',
      student: '/elev',
      economy: '/okonomi',
    });
  });

  it.each([
    [['parent'], '/forelder'],
    [['student'], '/elev'],
    [['teacher', 'parent'], '/laerer'], // laererforelder lands in the teacher portal
    [['economy', 'admin'], '/admin'], // admin outranks economy
    [[], null],
    [['unknown'], null],
  ])('defaultPortalPath(%j) -> %s', (roles, expected) => {
    expect(defaultPortalPath(roles)).toBe(expected);
  });

  it.each([
    [['parent'], false],
    [['parent', 'teacher'], true],
    [[], false],
  ])('hasStaffRole(%j) -> %s', (roles, expected) => {
    expect(hasStaffRole(roles)).toBe(expected);
  });
});

describe('role classification completeness', () => {
  const NON_STAFF_ROLES = ['parent', 'student'];

  it('classifies every ALL_ROLES entry as staff or an explicitly named non-staff role', () => {
    const actualNonStaff = ALL_ROLES.filter((role) => !isStaffRole(role));

    // Direction 1: every non-staff role actually found in ALL_ROLES must be
    // explicitly named here — a new sixth role fails until classified.
    for (const role of actualNonStaff) {
      expect(NON_STAFF_ROLES).toContain(role);
    }

    // Direction 2: every explicitly named non-staff role must still exist in
    // ALL_ROLES and still be non-staff — catches stale/renamed entries.
    for (const role of NON_STAFF_ROLES) {
      expect(actualNonStaff).toContain(role);
    }
  });
});

describe('mfaGate (spec §6: staff sessions below AAL2 are blocked)', () => {
  it.each([
    // full 3x3 aal1/aal2/null matrix
    ['aal1', 'aal1', 'enroll'], // no factor enrolled -> /mfa/registrer
    ['aal1', 'aal2', 'verify'], // enrolled, not verified -> /mfa/verifiser
    ['aal1', null, 'enroll'],
    ['aal2', 'aal2', 'ok'],
    ['aal2', 'aal1', 'ok'], // stale JWT after unenroll — session already aal2
    ['aal2', null, 'ok'],
    [null, 'aal1', 'enroll'],
    [null, 'aal2', 'verify'],
    [null, null, 'enroll'],
    // garbage rows: fail-closed on unknown strings
    ['AAL2', 'AAL2', 'enroll'],
    ['aal3', 'aal3', 'enroll'],
  ])('current=%s next=%s -> %s', (current, next, expected) => {
    expect(mfaGate({ currentLevel: current, nextLevel: next })).toBe(expected);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm test
```

Expected: FAIL — cannot resolve `./access`.

- [ ] **Step 3: Implement access.ts**

Create `/Users/daodilyas/dev/iqra-portal/src/lib/auth/access.ts`:

```ts
/** Pure role/MFA policy. No I/O — unit-tested decision tables. */

export const ALL_ROLES = [
  'admin',
  'teacher',
  'parent',
  'student',
  'economy',
] as const;

export type Role = (typeof ALL_ROLES)[number];

/** Staff must hold AAL2 sessions (spec §6). */
export const STAFF_ROLES = ['admin', 'teacher', 'economy'] as const;

export function isRole(value: string): value is Role {
  return (ALL_ROLES as readonly string[]).includes(value);
}

export function isStaffRole(value: string): boolean {
  return (STAFF_ROLES as readonly string[]).includes(value);
}

export function hasStaffRole(roles: readonly string[]): boolean {
  return roles.some(isStaffRole);
}

/** DB roles are English; URLs are Norwegian (spec: Norwegian-only UI). */
export const PORTAL_PATHS: Record<Role, string> = {
  admin: '/admin',
  teacher: '/laerer',
  parent: '/forelder',
  student: '/elev',
  economy: '/okonomi',
};

export const PORTAL_LABELS: Record<Role, string> = {
  admin: 'Administrasjon',
  teacher: 'Lærer',
  parent: 'Forelder',
  student: 'Elev',
  economy: 'Økonomi',
};

/** Priority when one person holds several roles (role switcher default). */
const PORTAL_PRIORITY: readonly Role[] = [
  'admin',
  'teacher',
  'economy',
  'parent',
  'student',
];

export function defaultPortalPath(roles: readonly string[]): string | null {
  const first = PORTAL_PRIORITY.find((role) => roles.includes(role));
  return first ? PORTAL_PATHS[first] : null;
}

export type MfaGate = 'ok' | 'verify' | 'enroll';

/**
 * Decides what a STAFF session must do before entering a portal (spec §6).
 * Supabase AAL semantics:
 *   currentLevel aal2            -> verified this session -> ok
 *   aal1 with nextLevel aal2     -> factor enrolled, unverified -> verify
 *   aal1 with nextLevel aal1     -> no factor enrolled -> enroll
 * The table is asymmetric, so call sites must be self-labeling; never accept positional levels.
 */
export function mfaGate(levels: {
  currentLevel: string | null;
  nextLevel: string | null;
}): MfaGate {
  const { currentLevel, nextLevel } = levels;
  if (currentLevel === 'aal2') return 'ok';
  if (nextLevel === 'aal2') return 'verify';
  return 'enroll';
}
```

- [ ] **Step 4: Run tests and typecheck to verify green**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm test && npm run typecheck
```

Expected: `access.test.ts` passes (all decision-table rows), everything else still green.

- [ ] **Step 5: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add src/lib/auth
git commit -m "feat: pure role and MFA gate policy with decision-table tests"
```

---

### Task 11: Server-only DAL, quarantined admin module, login page and access-denied page

**Files:**
- Create: `/Users/daodilyas/dev/iqra-portal/src/lib/dal/session.ts`
- Create: `/Users/daodilyas/dev/iqra-portal/src/lib/dal/settings.ts`
- Create: `/Users/daodilyas/dev/iqra-portal/src/lib/admin/audit-log.ts`
- Create: `/Users/daodilyas/dev/iqra-portal/src/app/logg-inn/actions.ts`
- Create: `/Users/daodilyas/dev/iqra-portal/src/app/logg-inn/LoginForm.tsx`
- Create: `/Users/daodilyas/dev/iqra-portal/src/app/logg-inn/page.tsx`
- Create: `/Users/daodilyas/dev/iqra-portal/src/app/ingen-tilgang/page.tsx`
- Modify: `/Users/daodilyas/dev/iqra-portal/src/app/page.tsx` (replace token preview with role-based redirect)

DAL rules (spec §3/§6, pinned): every DAL file imports `'server-only'`; queries use the per-request anon-key client so RLS applies; `src/lib/admin/` is the ONLY module that touches the service-role key, and each exported function re-verifies admin membership with its own query and writes an audit entry. The DAL layer is exercised end-to-end in this task's browser verification and by the pgTAP suite underneath; its pure logic lives in `access.ts` (already unit-tested).

- [ ] **Step 1: Create the session DAL**

Create `/Users/daodilyas/dev/iqra-portal/src/lib/dal/session.ts`:

```ts
import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { isRole, type Role } from '@/lib/auth/access';
import { createClient } from '@/lib/supabase/server';

/** Session user, deduped per request with React cache. Null = logged out. */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** The caller's roles, read under RLS (policy only exposes own rows). */
export const getSessionRoles = cache(async (): Promise<Role[]> => {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);
  if (error) {
    throw new Error(`Kunne ikke lese roller for innlogget bruker: ${error.message}`);
  }
  return (data ?? []).map((row) => row.role).filter(isRole);
});

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect('/logg-inn');
  return user;
}

/**
 * Layout-level guard — wall 1 of two (wall 2 is RLS, spec §6).
 * Logged out -> /logg-inn. Logged in without the role -> /ingen-tilgang.
 */
export async function requireRole(
  role: Role,
): Promise<{ user: User; roles: Role[] }> {
  const user = await requireUser();
  const roles = await getSessionRoles();
  if (!roles.includes(role)) redirect('/ingen-tilgang');
  return { user, roles };
}

export const getOwnProfile = cache(async () => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, locale')
    .eq('id', user.id)
    .single();
  if (error) {
    throw new Error(`Kunne ikke lese egen profil: ${error.message}`);
  }
  return data;
});
```

Create `/Users/daodilyas/dev/iqra-portal/src/lib/dal/settings.ts`:

```ts
import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

/** School settings (single row). RLS: readable by any authenticated user. */
export const getSettings = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('settings')
    .select('school_name, retention_months, purring_fee_ore')
    .single();
  if (error) {
    throw new Error(`Kunne ikke lese innstillinger: ${error.message}`);
  }
  return data;
});
```

- [ ] **Step 2: Create the quarantined admin module**

Create `/Users/daodilyas/dev/iqra-portal/src/lib/admin/audit-log.ts`:

```ts
import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getPublicEnv, getServiceRoleKey } from '@/lib/env';
import { getSessionUser } from '@/lib/dal/session';
import type { Database } from '@/lib/supabase/database.types';

/**
 * QUARANTINE (spec §3/§6): src/lib/admin/ is the ONLY place allowed to use
 * the service-role key. Contract for every exported function:
 *   1. Re-verify the caller holds the admin role with an independent query.
 *   2. Write an audit entry describing what was done.
 * The raw service client is module-private — never export it.
 */
function createServiceRoleClient() {
  const env = getPublicEnv();
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    getServiceRoleKey(),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** Throws unless the current session user is an admin. Returns their id. */
async function requireAdminActor(): Promise<string> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error('Ikke innlogget.');
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
    throw new Error('Du har ikke tilgang til denne siden.');
  }
  return user.id;
}

export interface AuditLogEntry {
  id: number;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  created_at: string;
}

/**
 * Admin-only: the newest audit entries for the admin dashboard.
 * Reading the audit log is itself audited (spec §6: admin reads are logged).
 */
export async function adminListAuditLog(limit = 5): Promise<AuditLogEntry[]> {
  const actorId = await requireAdminActor();
  const service = createServiceRoleClient();

  const { error: auditError } = await service.from('audit_log').insert({
    actor_id: actorId,
    action: 'audit_log.viewed',
    entity: 'audit_log',
    meta: { limit },
  });
  if (auditError) {
    throw new Error(`Kunne ikke skrive til revisjonsloggen: ${auditError.message}`);
  }

  const { data, error } = await service
    .from('audit_log')
    .select('id, actor_id, action, entity, entity_id, created_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(`Kunne ikke lese revisjonsloggen: ${error.message}`);
  }
  return data ?? [];
}
```

- [ ] **Step 3: Create the login server action**

Create `/Users/daodilyas/dev/iqra-portal/src/app/logg-inn/actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export interface LoginState {
  error: string | null;
}

const loginSchema = z.object({
  epost: z.email('Oppgi en gyldig e-postadresse.'),
  passord: z.string().min(1, 'Oppgi passord.'),
});

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    epost: formData.get('epost'),
    passord: formData.get('passord'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ugyldig innsending.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.epost,
    password: parsed.data.passord,
  });
  if (error) {
    // One generic message — never reveal whether the account exists (spec §6).
    return { error: 'Feil e-post eller passord.' };
  }

  redirect('/');
}
```

- [ ] **Step 4: Create the login form and page**

Create `/Users/daodilyas/dev/iqra-portal/src/app/logg-inn/LoginForm.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { loginAction, type LoginState } from './actions';

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <Field label="E-post" htmlFor="epost">
        <Input
          id="epost"
          name="epost"
          type="email"
          autoComplete="email"
          required
          invalid={Boolean(state.error)}
        />
      </Field>
      <Field label="Passord" htmlFor="passord" error={state.error ?? undefined}>
        <Input
          id="passord"
          name="passord"
          type="password"
          autoComplete="current-password"
          required
          invalid={Boolean(state.error)}
          aria-describedby={state.error ? 'passord-feil' : undefined}
        />
      </Field>
      <Button type="submit" loading={pending}>
        {pending ? 'Logger inn …' : 'Logg inn'}
      </Button>
    </form>
  );
}
```

Create `/Users/daodilyas/dev/iqra-portal/src/app/logg-inn/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/dal/session';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Logg inn' };

export default async function LoggInnPage() {
  const user = await getSessionUser();
  if (user) redirect('/');

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Logg inn</h1>
        <p className="text-ink/70">
          Portalen for elever, foresatte og ansatte ved IQRA senter.
        </p>
      </div>
      <LoginForm />
    </main>
  );
}
```

- [ ] **Step 5: Create the access-denied page and the role-routing root page**

Create `/Users/daodilyas/dev/iqra-portal/src/app/ingen-tilgang/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = { title: 'Ingen tilgang' };

export default function IngenTilgangPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-6">
      <EmptyState
        title="Du har ikke tilgang til denne siden"
        description="Kontoen din mangler rollen som kreves her. Ta kontakt med administrasjonen ved IQRA senter hvis du mener dette er feil."
      />
    </main>
  );
}
```

Replace the entire contents of `/Users/daodilyas/dev/iqra-portal/src/app/page.tsx` with:

```tsx
import { redirect } from 'next/navigation';
import { defaultPortalPath } from '@/lib/auth/access';
import { getSessionRoles, getSessionUser } from '@/lib/dal/session';

/** Routes each login to their portal; the switcher handles multi-role users. */
export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect('/logg-inn');

  const roles = await getSessionRoles();
  redirect(defaultPortalPath(roles) ?? '/ingen-tilgang');
}
```

- [ ] **Step 6: Verify typecheck, tests, build**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm test && npm run build
```

Expected: all green; the build marks `/`, `/logg-inn` as dynamic (ƒ) because they read cookies.

- [ ] **Step 7: Verify the login flow in the browser**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase start
npm run dev
```

In the browser at `http://localhost:3000`:
1. `/` redirects to `/logg-inn` (logged out).
2. Submit `forelder@test.local` + a WRONG password → inline error **«Feil e-post eller passord.»** below the password field; no crash.
3. Submit with the correct password `test-passord-123` → URL becomes `/forelder` and shows Next's 404 — **expected until Task 12** creates the portal pages; the redirect in the URL bar is the assertion.
4. Visit `/logg-inn` again while logged in → bounced to `/` → `/forelder`.

Stop the dev server (Ctrl+C) when done.

- [ ] **Step 8: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add src/lib/dal src/lib/admin src/app/logg-inn src/app/ingen-tilgang src/app/page.tsx
git commit -m "feat: server-only DAL, quarantined admin module and Norwegian login flow"
```

---

### Task 12: Portal shells — five role portals, role switcher, logout, dashboards

**Files:**
- Create: `/Users/daodilyas/dev/iqra-portal/src/app/(portal)/actions.ts`
- Create: `/Users/daodilyas/dev/iqra-portal/src/components/shell/RoleSwitcher.tsx`
- Create: `/Users/daodilyas/dev/iqra-portal/src/components/shell/PortalShell.tsx`
- Create: `/Users/daodilyas/dev/iqra-portal/src/app/(portal)/admin/layout.tsx` + `page.tsx`
- Create: `/Users/daodilyas/dev/iqra-portal/src/app/(portal)/laerer/layout.tsx` + `page.tsx`
- Create: `/Users/daodilyas/dev/iqra-portal/src/app/(portal)/forelder/layout.tsx` + `page.tsx`
- Create: `/Users/daodilyas/dev/iqra-portal/src/app/(portal)/elev/layout.tsx` + `page.tsx`
- Create: `/Users/daodilyas/dev/iqra-portal/src/app/(portal)/okonomi/layout.tsx` + `page.tsx`

Each portal layout calls `requireRole(...)` (wall 1) before rendering anything. Dashboards are honest teaching empty states — no lorem, no fake data. The admin dashboard additionally renders real audit entries through the quarantined admin module, proving the service-role pattern end-to-end. No kickers, no emojis (spec §7 bans).

- [ ] **Step 1: Create the logout action**

Create `/Users/daodilyas/dev/iqra-portal/src/app/(portal)/actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/logg-inn');
}
```

- [ ] **Step 2: Create the shell components**

Create `/Users/daodilyas/dev/iqra-portal/src/components/shell/RoleSwitcher.tsx`:

```tsx
import Link from 'next/link';
import { PORTAL_LABELS, PORTAL_PATHS, type Role } from '@/lib/auth/access';
import { cn } from '@/lib/cn';

/** Rendered only when the user holds more than one role (spec §3). */
export function RoleSwitcher({
  roles,
  activeRole,
}: {
  roles: Role[];
  activeRole: Role;
}) {
  if (roles.length < 2) return null;

  return (
    <nav aria-label="Bytt rolle" className="mx-auto w-full max-w-5xl px-4 pb-3 sm:px-6">
      <ul className="flex flex-wrap gap-2">
        {roles.map((role) => (
          <li key={role}>
            <Link
              href={PORTAL_PATHS[role]}
              aria-current={role === activeRole ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 items-center rounded-pill px-4 text-sm font-medium',
                'transition-colors duration-200 ease-brand',
                role === activeRole
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-tint text-ink hover:bg-hairline',
              )}
            >
              {PORTAL_LABELS[role]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

Create `/Users/daodilyas/dev/iqra-portal/src/components/shell/PortalShell.tsx`:

```tsx
import type { ReactNode } from 'react';
import { logoutAction } from '@/app/(portal)/actions';
import { Button } from '@/components/ui/Button';
import type { Role } from '@/lib/auth/access';
import { RoleSwitcher } from './RoleSwitcher';

export interface PortalShellProps {
  schoolName: string;
  portalLabel: string;
  userName: string;
  roles: Role[];
  activeRole: Role;
  children: ReactNode;
}

export function PortalShell({
  schoolName,
  portalLabel,
  userName,
  roles,
  activeRole,
  children,
}: PortalShellProps) {
  return (
    <div className="min-h-svh">
      <header className="border-b border-hairline bg-canvas">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <p className="text-base font-semibold">{schoolName}</p>
          <p className="text-ink/60">{portalLabel}</p>
          <div className="ms-auto flex items-center gap-3">
            <p className="text-sm text-ink/70">{userName}</p>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost">
                Logg ut
              </Button>
            </form>
          </div>
        </div>
        <RoleSwitcher roles={roles} activeRole={activeRole} />
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Create the five portal layouts**

All five follow the same guard pattern — each is written out in full because executors may work tasks in isolation.

Create `/Users/daodilyas/dev/iqra-portal/src/app/(portal)/admin/layout.tsx`:

```tsx
import type { ReactNode } from 'react';
import { PortalShell } from '@/components/shell/PortalShell';
import { PORTAL_LABELS } from '@/lib/auth/access';
import { getOwnProfile, requireRole } from '@/lib/dal/session';
import { getSettings } from '@/lib/dal/settings';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { roles } = await requireRole('admin');
  const [profile, settings] = await Promise.all([getOwnProfile(), getSettings()]);
  return (
    <PortalShell
      schoolName={settings.school_name}
      portalLabel={PORTAL_LABELS.admin}
      userName={profile.full_name}
      roles={roles}
      activeRole="admin"
    >
      {children}
    </PortalShell>
  );
}
```

Create `/Users/daodilyas/dev/iqra-portal/src/app/(portal)/laerer/layout.tsx`:

```tsx
import type { ReactNode } from 'react';
import { PortalShell } from '@/components/shell/PortalShell';
import { PORTAL_LABELS } from '@/lib/auth/access';
import { getOwnProfile, requireRole } from '@/lib/dal/session';
import { getSettings } from '@/lib/dal/settings';

export default async function LaererLayout({ children }: { children: ReactNode }) {
  const { roles } = await requireRole('teacher');
  const [profile, settings] = await Promise.all([getOwnProfile(), getSettings()]);
  return (
    <PortalShell
      schoolName={settings.school_name}
      portalLabel={PORTAL_LABELS.teacher}
      userName={profile.full_name}
      roles={roles}
      activeRole="teacher"
    >
      {children}
    </PortalShell>
  );
}
```

Create `/Users/daodilyas/dev/iqra-portal/src/app/(portal)/forelder/layout.tsx`:

```tsx
import type { ReactNode } from 'react';
import { PortalShell } from '@/components/shell/PortalShell';
import { PORTAL_LABELS } from '@/lib/auth/access';
import { getOwnProfile, requireRole } from '@/lib/dal/session';
import { getSettings } from '@/lib/dal/settings';

export default async function ForelderLayout({ children }: { children: ReactNode }) {
  const { roles } = await requireRole('parent');
  const [profile, settings] = await Promise.all([getOwnProfile(), getSettings()]);
  return (
    <PortalShell
      schoolName={settings.school_name}
      portalLabel={PORTAL_LABELS.parent}
      userName={profile.full_name}
      roles={roles}
      activeRole="parent"
    >
      {children}
    </PortalShell>
  );
}
```

Create `/Users/daodilyas/dev/iqra-portal/src/app/(portal)/elev/layout.tsx`:

```tsx
import type { ReactNode } from 'react';
import { PortalShell } from '@/components/shell/PortalShell';
import { PORTAL_LABELS } from '@/lib/auth/access';
import { getOwnProfile, requireRole } from '@/lib/dal/session';
import { getSettings } from '@/lib/dal/settings';

export default async function ElevLayout({ children }: { children: ReactNode }) {
  const { roles } = await requireRole('student');
  const [profile, settings] = await Promise.all([getOwnProfile(), getSettings()]);
  return (
    <PortalShell
      schoolName={settings.school_name}
      portalLabel={PORTAL_LABELS.student}
      userName={profile.full_name}
      roles={roles}
      activeRole="student"
    >
      {children}
    </PortalShell>
  );
}
```

Create `/Users/daodilyas/dev/iqra-portal/src/app/(portal)/okonomi/layout.tsx`:

```tsx
import type { ReactNode } from 'react';
import { PortalShell } from '@/components/shell/PortalShell';
import { PORTAL_LABELS } from '@/lib/auth/access';
import { getOwnProfile, requireRole } from '@/lib/dal/session';
import { getSettings } from '@/lib/dal/settings';

export default async function OkonomiLayout({ children }: { children: ReactNode }) {
  const { roles } = await requireRole('economy');
  const [profile, settings] = await Promise.all([getOwnProfile(), getSettings()]);
  return (
    <PortalShell
      schoolName={settings.school_name}
      portalLabel={PORTAL_LABELS.economy}
      userName={profile.full_name}
      roles={roles}
      activeRole="economy"
    >
      {children}
    </PortalShell>
  );
}
```

- [ ] **Step 4: Create the five dashboard pages**

Create `/Users/daodilyas/dev/iqra-portal/src/app/(portal)/admin/page.tsx` (renders real audit entries via the quarantined module):

```tsx
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';
import { adminListAuditLog } from '@/lib/admin/audit-log';

export const metadata: Metadata = { title: 'Administrasjon' };

export default async function AdminDashboard() {
  const entries = await adminListAuditLog(5);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Administrasjon</h1>
      <EmptyState
        title="Ingen elever registrert ennå"
        description="Elevregisteret, klasser og brukerhåndtering kommer i neste fase. Herfra får du full oversikt over skolehverdagen."
      />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Siste hendelser</h2>
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
                })}
              </time>
            </li>
          ))}
        </ul>
        <p className="text-sm text-ink/60">
          Alle sensitive handlinger logges. Full revisjonslogg med filtrering kommer i
          herdingsfasen.
        </p>
      </section>
    </div>
  );
}
```

Create `/Users/daodilyas/dev/iqra-portal/src/app/(portal)/laerer/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = { title: 'Lærer' };

export default function LaererDashboard() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">I dag</h1>
      <EmptyState
        title="Ingen klasser tildelt ennå"
        description="Når administrasjonen har opprettet klassene dine, starter du dagen her: oppmøte med ett trykk, deretter kjapp loggføring per elev."
      />
    </div>
  );
}
```

Create `/Users/daodilyas/dev/iqra-portal/src/app/(portal)/forelder/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = { title: 'Forelder' };

export default function ForelderDashboard() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Mine barn</h1>
      <EmptyState
        title="Ingen barn registrert ennå"
        description="Når skolen har registrert barna dine, ser du timeplan, oppmøte, fremdrift og fakturaer her. Ta kontakt med administrasjonen hvis noe mangler."
      />
    </div>
  );
}
```

Create `/Users/daodilyas/dev/iqra-portal/src/app/(portal)/elev/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = { title: 'Elev' };

export default function ElevDashboard() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Min side</h1>
      <EmptyState
        title="Ingen klasse ennå"
        description="Når du er meldt inn i en klasse, ser du timeplanen, leksene og fremdriften din her."
      />
    </div>
  );
}
```

Create `/Users/daodilyas/dev/iqra-portal/src/app/(portal)/okonomi/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = { title: 'Økonomi' };

export default function OkonomiDashboard() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Økonomi</h1>
      <EmptyState
        title="Ingen fakturaer ennå"
        description="Fakturakjøringer, betalingsregistrering og purreløp kommer i økonomifasen. Oversikten over betalt og utestående per termin vises her."
      />
    </div>
  );
}
```

- [ ] **Step 5: Verify typecheck, tests, build**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm test && npm run build
```

Expected: all green; the build lists `/admin`, `/laerer`, `/forelder`, `/elev`, `/okonomi` as dynamic routes.

- [ ] **Step 6: Verify role isolation and the switcher in the browser**

With `supabase start` running and `npm run dev`:

1. Log in as `forelder@test.local` / `test-passord-123` → lands on `/forelder`: header shows «IQRA senter · Forelder · Omar Farah», teaching empty state «Ingen barn registrert ennå», NO role switcher (single role).
2. Manually visit `/admin` while logged in as forelder → redirected to `/ingen-tilgang` («Du har ikke tilgang til denne siden»). This is wall 1 working.
3. «Logg ut» → back at `/logg-inn`.
4. Log in as `laererforelder@test.local` → lands on `/laerer` (teacher outranks parent); the switcher shows two pills «Lærer» and «Forelder»; clicking «Forelder» navigates to `/forelder`.
5. Log in as `admin@test.local` → `/admin` shows «Siste hendelser» with at least one `audit_log.viewed` row (the module audits its own read — expected and correct). NOTE: no MFA is demanded yet; that is Task 13.

- [ ] **Step 7: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add "src/app/(portal)" src/components/shell
git commit -m "feat: five role portals with layout guards, role switcher and honest empty states"
```

---

### Task 12b: API-wall adversarial harness — wall 1's Vitest twin of the pgTAP suite

**Files:**
- Create: `/Users/daodilyas/dev/iqra-portal/vitest.config.api.ts`
- Create: `/Users/daodilyas/dev/iqra-portal/tests/api/harness.ts`
- Create: `/Users/daodilyas/dev/iqra-portal/tests/api/access-wall.test.ts`
- Modify: `/Users/daodilyas/dev/iqra-portal/package.json` (add the `test:api` script)

Spec §8.1 requires every forbidden cell in §3's matrix to be attempted at BOTH walls, and §9 row 0 ships the harnesses in Phase 0. Wall 2 (RLS, SQL as each role) is the pgTAP suite from Tasks 4–5. This task is wall 1's twin: it executes the real `session.ts` guards and `loginAction` with forged inputs against the running local stack, signed in as the Task 6 seed users (password `test-passord-123`). Only the edges are mocked: `@/lib/supabase/server` is replaced by a factory returning a real anon-key client authenticated through GoTrue (so RLS still applies underneath), and `next/navigation`'s `redirect` throws `NEXT_REDIRECT:<path>`, making a guard's decision observable. **Every later phase adds its forbidden-cell tests to BOTH suites** — `supabase/tests/` and `tests/api/`. The suite needs the local stack with fresh seeds (`supabase start` + `supabase db reset` first); Task 15's README documents this.

- [ ] **Step 1: Create a separate Vitest config for the API suite**

The main `vitest.config.ts` only includes `src/**` and boots jsdom; this suite runs in node against real services and must never run inside plain `npm test` (it would fail whenever the stack is down). Create `/Users/daodilyas/dev/iqra-portal/vitest.config.api.ts`:

```ts
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Config for the wall-1 adversarial suite (tests/api/) ONLY.
 * Runs in node (no jsdom, no vitest.setup.ts) and loads the local-stack
 * keys from .env.local so the harness can talk to GoTrue and PostgREST.
 */
export default defineConfig(({ mode }) => ({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/api/**/*.test.ts'],
    env: loadEnv(mode, process.cwd(), ''),
    testTimeout: 15000,
  },
}));
```

- [ ] **Step 2: Add the npm script**

In `/Users/daodilyas/dev/iqra-portal/package.json`, extend the `"scripts"` object so it contains (keep the existing entries):

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:api": "vitest run --config vitest.config.api.ts",
    "db:types": "supabase gen types typescript --local > src/lib/supabase/database.types.ts"
  }
}
```

(The `--config` flag is what keeps the suites separate: different environment, different include globs — `npm test` never touches `tests/api/`.)

- [ ] **Step 3: Write the harness**

Create `/Users/daodilyas/dev/iqra-portal/tests/api/harness.ts`:

```ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getPublicEnv } from '@/lib/env';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Wall-1 harness (spec §8.1): builds REAL Supabase clients against the
 * local stack, signed in as the Task 6 seed users, and hands them to the
 * code under test through the `@/lib/supabase/server` mock declared in
 * access-wall.test.ts. Wall 2 (SQL) is proven by the pgTAP suite; this
 * harness proves the DAL guards and server actions layered on top.
 */

export const TEST_PASSWORD = 'test-passord-123';

export type SeedEmail =
  | 'admin@test.local'
  | 'laerer@test.local'
  | 'forelder@test.local'
  | 'elev@test.local'
  | 'okonomi@test.local'
  | 'laererforelder@test.local';

let currentEmail: SeedEmail | null = null;

/** Later createClient() calls act as this seed user. */
export function signInAs(email: SeedEmail): void {
  currentEmail = email;
}

/** Later createClient() calls act logged out. */
export function signOut(): void {
  currentEmail = null;
}

/**
 * Drop-in replacement for `createClient` in `@/lib/supabase/server`:
 * a real anon-key client (RLS applies), authenticated as the current
 * seed user via GoTrue instead of via request cookies.
 */
export async function createServerClientMock() {
  const env = getPublicEnv();
  const client = createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  if (currentEmail) {
    const { error } = await client.auth.signInWithPassword({
      email: currentEmail,
      password: TEST_PASSWORD,
    });
    if (error) {
      throw new Error(
        `Harness: innlogging som ${currentEmail} feilet (kjører den lokale ` +
          `stacken med ferske seeds? \`supabase start\` + \`supabase db reset\`): ` +
          error.message,
      );
    }
  }
  return client;
}

/**
 * Drop-in replacement for `redirect` in `next/navigation`: throws so a
 * guard's redirect is observable and halts execution like the real one.
 */
export function redirectMock(path: string): never {
  throw new Error(`NEXT_REDIRECT:${path}`);
}
```

- [ ] **Step 4: Write the adversarial tests**

Create `/Users/daodilyas/dev/iqra-portal/tests/api/access-wall.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock calls are hoisted above the imports below. The factories load the
// harness lazily (dynamic import) because hoisted factories cannot touch
// top-level imports. `server-only` becomes a no-op outside RSC.
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', async () => {
  const { createServerClientMock } = await import('./harness');
  return { createClient: createServerClientMock };
});
vi.mock('next/navigation', async () => {
  const { redirectMock } = await import('./harness');
  return { redirect: redirectMock };
});

import { loginAction } from '@/app/logg-inn/actions';
import { getSessionRoles, requireRole } from '@/lib/dal/session';
import { signInAs, signOut } from './harness';

beforeEach(() => {
  signOut();
});

describe('wall 1: requireRole turns forbidden roles away (spec §8.1)', () => {
  it('redirects a parent who requests the admin portal to /ingen-tilgang', async () => {
    signInAs('forelder@test.local');
    await expect(requireRole('admin')).rejects.toThrow(
      'NEXT_REDIRECT:/ingen-tilgang',
    );
  });

  it('redirects a logged-out visitor to /logg-inn', async () => {
    await expect(requireRole('admin')).rejects.toThrow(
      'NEXT_REDIRECT:/logg-inn',
    );
  });

  it('lets a parent into the parent portal with their roles', async () => {
    signInAs('forelder@test.local');
    const { user, roles } = await requireRole('parent');
    expect(user.email).toBe('forelder@test.local');
    expect(roles).toContain('parent');
  });
});

describe('wall 1: loginAction rejects forged input without throwing', () => {
  it('returns a field error for a forged FormData submission', async () => {
    const forged = new FormData();
    forged.set('epost', 'ikke-en-epost');
    forged.set('passord', '');
    await expect(loginAction({ error: null }, forged)).resolves.toEqual({
      error: 'Oppgi en gyldig e-postadresse.',
    });
  });
});

describe('wall 1: getSessionRoles under RLS', () => {
  it('returns both roles for the dual-role user', async () => {
    signInAs('laererforelder@test.local');
    const roles = await getSessionRoles();
    expect([...roles].sort()).toEqual(['parent', 'teacher']);
  });
});
```

- [ ] **Step 5: Run the suite against the local stack**

```bash
cd /Users/daodilyas/dev/iqra-portal
supabase start
supabase db reset
npm run test:api
npm test && npm run typecheck
```

Expected: the API suite prints `Test Files  1 passed` and `Tests  5 passed` — the two denial tests prove the wall by asserting on the thrown `NEXT_REDIRECT` path that only the guard produces. `npm test` stays green and unchanged (the suites do not overlap), and typecheck is silent.

- [ ] **Step 6: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add vitest.config.api.ts tests/api package.json
git commit -m "test: adversarial API-wall suite proving DAL guards and login validation"
```

---

### Task 13: Staff MFA enforcement in `src/proxy.ts` (Next 16 middleware)

**Files:**
- Create: `/Users/daodilyas/dev/iqra-portal/src/proxy.ts`

Next.js 16 renamed `middleware.ts` to `proxy.ts`; the exported function is named `proxy` (verified against Next 16 docs). Policy (spec §6): every request refreshes the session; logged-out users only reach `/logg-inn`; staff (admin/teacher/economy) below AAL2 are forced to `/mfa/registrer` (no factor) or `/mfa/verifiser` (factor enrolled, unverified). Parents/students are never asked to enroll in v1. The pure decision logic (`mfaGate`, `hasStaffRole`) is already unit-tested in Task 10 — this file only wires it to requests.

- [ ] **Step 1: Create src/proxy.ts**

Create `/Users/daodilyas/dev/iqra-portal/src/proxy.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { hasStaffRole, mfaGate } from '@/lib/auth/access';
import { loadSession } from '@/lib/supabase/middleware';

const LOGIN_PATH = '/logg-inn';
const DENIED_PATH = '/ingen-tilgang';
const MFA_ENROLL_PATH = '/mfa/registrer';
const MFA_VERIFY_PATH = '/mfa/verifiser';

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const { supabase, user, getResponse } = await loadSession(request);
  const path = request.nextUrl.pathname;

  // Informational page — always reachable, so error paths can never loop.
  if (path === DENIED_PATH) return getResponse();

  if (!user) {
    if (path === LOGIN_PATH) return getResponse();
    return redirectTo(request, LOGIN_PATH);
  }

  if (path === LOGIN_PATH) {
    return redirectTo(request, '/');
  }

  // Staff must hold AAL2 sessions (spec §6). Roles are read under RLS
  // (own rows). On read failure we fail CLOSED toward the info page —
  // the DAL wall (requireRole) still blocks portal content independently.
  const { data: roleRows, error: rolesError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);
  if (rolesError) {
    return redirectTo(request, DENIED_PATH);
  }
  const roles = (roleRows ?? []).map((row) => row.role);

  if (hasStaffRole(roles)) {
    const { data: aal, error: aalError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) {
      return redirectTo(request, DENIED_PATH);
    }
    const gate = mfaGate({ currentLevel: aal?.currentLevel ?? null, nextLevel: aal?.nextLevel ?? null });
    if (gate === 'enroll' && path !== MFA_ENROLL_PATH) {
      return redirectTo(request, MFA_ENROLL_PATH);
    }
    if (gate === 'verify' && path !== MFA_VERIFY_PATH) {
      return redirectTo(request, MFA_VERIFY_PATH);
    }
  }

  return getResponse();
}

export const config = {
  // Gate everything except Next internals and static files with extensions.
  // Server Actions POST to page paths, so they are covered too.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
};
```

- [ ] **Step 2: Verify typecheck and build**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run build
```

Expected: both green; the build output lists `Proxy (middleware)` (or an `ƒ Proxy` line, wording varies by minor version).

- [ ] **Step 3: Verify the gate over HTTP (logged out)**

With `supabase start` running, start the dev server, then in a second terminal:

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run dev
```

```bash
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3000/admin
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3000/forelder
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3000/logg-inn
```

Expected:
```
307 http://localhost:3000/logg-inn
307 http://localhost:3000/logg-inn
200
```

- [ ] **Step 4: Verify the staff gate in the browser**

1. Log in as `forelder@test.local` / `test-passord-123` → straight to `/forelder`, NO MFA demanded (parents are exempt in v1).
2. Log out. Log in as `admin@test.local` / `test-passord-123` → immediately redirected to `/mfa/registrer`. The page is a 404 for now — **expected until Task 14**; the redirect is the assertion. Trying to visit `/admin` directly keeps bouncing back to `/mfa/registrer`.
3. Log out (delete the `sb-*` cookies in devtools if needed, since the shell's logout button is unreachable behind the gate: DevTools → Application → Cookies → delete for localhost).

- [ ] **Step 5: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add src/proxy.ts
git commit -m "feat: enforce AAL2 for staff roles in the request proxy"
```

---

### Task 14: MFA pages — TOTP enroll (`/mfa/registrer`) and challenge (`/mfa/verifiser`)

**Files:**
- Create: `/Users/daodilyas/dev/iqra-portal/src/app/mfa/registrer/EnrollForm.tsx`
- Create: `/Users/daodilyas/dev/iqra-portal/src/app/mfa/registrer/page.tsx`
- Create: `/Users/daodilyas/dev/iqra-portal/src/app/mfa/verifiser/VerifyForm.tsx`
- Create: `/Users/daodilyas/dev/iqra-portal/src/app/mfa/verifiser/page.tsx`

Client components using the browser Supabase client (`supabase.auth.mfa.*` — verified API: `enroll` returns `data.id` + `data.totp.qr_code` (SVG data URL) + `data.totp.secret`; `challenge({factorId})` returns `data.id`; `verify({factorId, challengeId, code})` upgrades the session to AAL2). Both pages offer a logout escape hatch so a staff member without their phone is never trapped.

- [ ] **Step 1: Create the enroll form**

Create `/Users/daodilyas/dev/iqra-portal/src/app/mfa/registrer/EnrollForm.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { createClient } from '@/lib/supabase/client';

export function EnrollForm() {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function enroll() {
      // Clean up abandoned unverified factors from earlier visits, so
      // re-opening this page always yields one fresh QR code.
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const stale =
        factors?.all.filter(
          (factor) =>
            factor.factor_type === 'totp' && factor.status === 'unverified',
        ) ?? [];
      for (const factor of stale) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `IQRA portal ${new Date().toISOString()}`,
      });
      if (cancelled) return;
      if (enrollError || !data) {
        setError('Kunne ikke starte oppsettet. Last siden på nytt og prøv igjen.');
        return;
      }
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    }

    void enroll();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId) return;
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      setError('Noe gikk galt. Prøv igjen.');
      setSubmitting(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (verifyError) {
      setError('Ugyldig kode. Prøv igjen.');
      setSubmitting(false);
      return;
    }

    // Session is now AAL2; the proxy lets the portal through.
    router.replace('/');
    router.refresh();
  }

  if (!qrCode) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="mx-auto size-44" />
        <Skeleton className="h-11 w-full" />
        {error ? (
          <p role="alert" className="text-sm text-danger-ink">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {/* Supabase returns the QR code as an SVG data URL. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrCode}
        alt="QR-kode for autentiseringsapp"
        width={176}
        height={176}
        className="mx-auto rounded-md border border-hairline bg-canvas p-2"
      />
      {secret ? (
        <p className="text-sm text-ink/70">
          Kan du ikke skanne? Skriv inn nøkkelen manuelt:{' '}
          <code className="font-medium break-all text-ink">{secret}</code>
        </p>
      ) : null}
      <Field label="Kode fra appen" htmlFor="kode" error={error ?? undefined}>
        <Input
          id="kode"
          name="kode"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
          invalid={Boolean(error)}
          aria-describedby={error ? 'kode-feil' : undefined}
        />
      </Field>
      <Button type="submit" loading={submitting} disabled={code.trim().length !== 6}>
        Bekreft
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Create the enroll page**

Create `/Users/daodilyas/dev/iqra-portal/src/app/mfa/registrer/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { logoutAction } from '@/app/(portal)/actions';
import { Button } from '@/components/ui/Button';
import { EnrollForm } from './EnrollForm';

export const metadata: Metadata = { title: 'Totrinnsbekreftelse' };

export default function MfaRegistrerPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Sett opp totrinnsbekreftelse</h1>
        <p className="text-ink/70">
          Ansattkontoer krever et ekstra trinn ved innlogging. Skann QR-koden med en
          autentiseringsapp, for eksempel Google Authenticator eller 1Password, og
          bekreft med koden fra appen.
        </p>
      </div>
      <EnrollForm />
      <form action={logoutAction} className="flex justify-center">
        <Button type="submit" variant="ghost">
          Avbryt og logg ut
        </Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Create the verify form and page**

Create `/Users/daodilyas/dev/iqra-portal/src/app/mfa/verifiser/VerifyForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';

export function VerifyForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { data: factors, error: factorsError } =
      await supabase.auth.mfa.listFactors();
    const totpFactor = factors?.totp[0];
    if (factorsError || !totpFactor) {
      setError('Fant ingen autentiseringsapp på kontoen. Kontakt administrasjonen.');
      setSubmitting(false);
      return;
    }

    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
    if (challengeError || !challenge) {
      setError('Noe gikk galt. Prøv igjen.');
      setSubmitting(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: totpFactor.id,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (verifyError) {
      setError('Ugyldig kode. Prøv igjen.');
      setSubmitting(false);
      return;
    }

    router.replace('/');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <Field label="Kode fra appen" htmlFor="kode" error={error ?? undefined}>
        <Input
          id="kode"
          name="kode"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          autoFocus
          value={code}
          onChange={(event) => setCode(event.target.value)}
          invalid={Boolean(error)}
          aria-describedby={error ? 'kode-feil' : undefined}
        />
      </Field>
      <Button type="submit" loading={submitting} disabled={code.trim().length !== 6}>
        Bekreft
      </Button>
    </form>
  );
}
```

Create `/Users/daodilyas/dev/iqra-portal/src/app/mfa/verifiser/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { logoutAction } from '@/app/(portal)/actions';
import { Button } from '@/components/ui/Button';
import { VerifyForm } from './VerifyForm';

export const metadata: Metadata = { title: 'Bekreft innlogging' };

export default function MfaVerifiserPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Bekreft innloggingen</h1>
        <p className="text-ink/70">
          Skriv inn koden fra autentiseringsappen din for å fortsette.
        </p>
      </div>
      <VerifyForm />
      <form action={logoutAction} className="flex justify-center">
        <Button type="submit" variant="ghost">
          Logg ut
        </Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Verify typecheck, tests, build**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm test && npm run build
```

Expected: all green.

- [ ] **Step 5: Verify the full staff MFA journey end-to-end**

Install a CLI TOTP generator if no authenticator app is at hand (optional but makes this step scriptable):

```bash
brew list oath-toolkit >/dev/null 2>&1 || brew install oath-toolkit
```

With `supabase start` running and `npm run dev`:

1. Log in as `admin@test.local` / `test-passord-123` → redirected to `/mfa/registrer`; a QR code renders after a short skeleton.
2. Copy the manual key shown under the QR («Kan du ikke skanne? …»), then:
   ```bash
   oathtool --totp -b 'PASTE-THE-SECRET-HERE'
   ```
   (Or scan the QR with any authenticator app.)
3. Enter the 6-digit code → «Bekreft» → you land on `/admin` with the full shell. The gate is satisfied: the session is AAL2.
4. «Logg ut», then log in as `admin@test.local` again → this time redirected to `/mfa/verifiser` (factor exists, session is AAL1). Run `oathtool` again with the same secret, enter the code → `/admin`.
5. Enter a wrong code first and confirm the inline error «Ugyldig kode. Prøv igjen.» appears and the form stays usable.
6. Log in as `forelder@test.local` → still goes straight to `/forelder`; parents are never asked to enroll.

This is the Phase 0 auth acceptance path — all six checks must pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
git add src/app/mfa
git commit -m "feat: TOTP enrollment and challenge pages for staff MFA"
```

---

### Task 15: Security headers, CI + Dependabot, Vercel region pin, README (Skyoppsett + DPA), PRODUCT.md, DESIGN.md, spec copy

**Files:**
- Modify: `/Users/daodilyas/dev/iqra-portal/next.config.ts` (security headers + baseline CSP)
- Create: `/Users/daodilyas/dev/iqra-portal/.github/workflows/ci.yml`
- Create: `/Users/daodilyas/dev/iqra-portal/.github/dependabot.yml`
- Create: `/Users/daodilyas/dev/iqra-portal/vercel.json`
- Create: `/Users/daodilyas/dev/iqra-portal/README.md` (replace CNA boilerplate)
- Create: `/Users/daodilyas/dev/iqra-portal/PRODUCT.md`
- Create: `/Users/daodilyas/dev/iqra-portal/DESIGN.md`
- Create: `/Users/daodilyas/dev/iqra-portal/docs/spec.md` (copied from the marketing repo)

- [ ] **Step 1: Security headers in next.config.ts (spec §6: strict CSP, HSTS, frame-deny)**

Replace the entire contents of `/Users/daodilyas/dev/iqra-portal/next.config.ts` (create-next-app generated it with an empty options object; nothing else in the plan has touched it) with:

```ts
import type { NextConfig } from 'next';

/**
 * Security headers on every route (spec §6): HSTS, frame-deny, nosniff,
 * tight referrer, minimal permissions, and a baseline CSP.
 * Baseline CSP; tightened to nonce-based script-src in Phase 7 hardening
 * (spec §9) — until then 'unsafe-inline' is required by Next.js runtime
 * scripts and next/font inline styles.
 * connect-src must allow the Supabase URL (browser client: auth + MFA).
 * Next.js loads .env.local before evaluating this file, so the value is
 * present in local dev; on Vercel it comes from project env vars.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self' ${supabaseUrl}`.trimEnd(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  { key: 'Content-Security-Policy', value: csp },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
```

Verify:

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run build
```

Expected: both exit 0. Then start `npm run dev` and, in a second terminal:

```bash
curl -sI http://localhost:3000/logg-inn | grep -i -e content-security-policy -e strict-transport-security -e x-frame-options
```

Expected: all three headers print; the CSP line contains `default-src 'self'` and the local Supabase URL (`http://127.0.0.1:54321`) inside `connect-src`. Log in as `forelder@test.local` to confirm auth still works under the CSP, then stop the dev server.

- [ ] **Step 2: Create the CI workflow**

Create `/Users/daodilyas/dev/iqra-portal/.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  app:
    name: Typecheck, lint, unit tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      # Supply-chain gate (spec §6): fail on known high/critical advisories.
      - run: npm audit --audit-level=high

  db:
    name: Database tests (pgTAP)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase db start
      - run: supabase test db
```

- [ ] **Step 3: Create the Dependabot config (spec §6: automated dependency updates)**

Create `/Users/daodilyas/dev/iqra-portal/.github/dependabot.yml`:

```yaml
version: 2
updates:
  # npm: weekly, minor+patch grouped into one PR to keep review load low;
  # majors arrive as individual PRs and get reviewed against changelogs.
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      minor-and-patch:
        update-types:
          - "minor"
          - "patch"

  # GitHub Actions: weekly (checkout/setup-node/setup-cli pins above).
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

(Dependabot activates once the repo is pushed to GitHub — the remaining manual step at the end of this task. Together with `npm audit` in CI this fulfils spec §6's supply-chain line.)

- [ ] **Step 4: Pin Vercel functions to the EU**

Create `/Users/daodilyas/dev/iqra-portal/vercel.json`:

```json
{
  "regions": ["arn1"]
}
```

(`arn1` = Stockholm, matching the Supabase region; `fra1` is the documented fallback if `arn1` is ever unavailable on the chosen plan.)

- [ ] **Step 5: Copy the approved spec into the portal repo**

```bash
mkdir -p /Users/daodilyas/dev/iqra-portal/docs
cp /Users/daodilyas/Desktop/iqra/docs/superpowers/specs/2026-07-15-iqra-skoleportal-design.md /Users/daodilyas/dev/iqra-portal/docs/spec.md
head -3 /Users/daodilyas/dev/iqra-portal/docs/spec.md
```

Expected: first line `# IQRA Skoleportal — Design Specification`.

- [ ] **Step 6: Write PRODUCT.md**

Create `/Users/daodilyas/dev/iqra-portal/PRODUCT.md`:

```markdown
# IQRA portal — produkt

Skoleadministrasjon for IQRA senter (Oslo): en helgeskole med noen hundre
elever, frivillige lærere og ideell økonomi. Full spesifikasjon: `docs/spec.md`.

## Register

**Produkt.** Verktøyet tjener oppgaven — opparbeidet gjenkjennelighet slår
nyhet. Scenen er en forelder på mobil i en gang etter jobb, og en frivillig
lærer i et lyst lørdagsklasserom.

## Prioriteringer (i brukerens rekkefølge)

1. **Sikkerhet** — streng rolleisolasjon; ingen gruppe skal noensinne se en
   annen gruppes data.
2. **Ren, forståelig kode** — problemer skal være lette å finne og fikse.
3. **Vakker design** — foreldre og lærere skal stole på og like portalen.

## Brukere og roller

| Rolle | Ser |
|---|---|
| `admin` | Alt: elevregister, klasser, brukere, revisjonslogg, innstillinger |
| `teacher` | Egne klasser: oppmøte, fremdrift, oppgaver, meldinger |
| `parent` | Egne barn: timeplan, oppmøte, fremdrift, fakturaer, meld fravær |
| `student` | Seg selv (valgfri innlogging, typisk 13+): timeplan, lekser, fremdrift |
| `economy` | Kun økonomi: fakturaer, betalinger, purringer — aldri pedagogikk |

Én person kan ha flere roller (rollebytter i skallet). Autorisasjon er alltid
**rolle + relasjon**, aldri rolle alene.

## Ikke-mål i v1

Ingen nettbetaling (kun registrering), ingen native apper (responsiv PWA),
kun norsk UI, aldri elev↔elev-chat, ingen vedlegg i meldinger, ingen
selvbetjent påmelding, ingen offline-skriving, ingen Feide.
```

- [ ] **Step 7: Write DESIGN.md**

Create `/Users/daodilyas/dev/iqra-portal/DESIGN.md`:

```markdown
# IQRA portal — design («C · Familie»)

Register: **produkt**. Lyst tema. Rolig, varm, ett grønt aksentfarge-spor.
Tokenene under er fasit og ligger i `src/app/globals.css` (`@theme`).

## Farger (OKLCH)

| Token | Verdi | Bruk |
|---|---|---|
| `--color-canvas` | `oklch(0.99 0.003 150)` | Bakgrunn — aldri ren hvit |
| `--color-ink` | `oklch(0.25 0.02 155)` | Tekst — aldri ren svart |
| `--color-primary` | `oklch(0.44 0.09 160)` | IQRA-grønn, eneste aksent |
| `--color-primary-strong` | `oklch(0.38 0.09 160)` | Hover/trykk på primær |
| `--color-surface-tint` | `oklch(0.95 0.025 158)` | Tonet flate |
| `--color-hairline` | `oklch(0.93 0.01 155)` | Delelinjer, rammer |
| `--color-success` / `-ink` | `oklch(0.52 0.11 158)` / `oklch(0.36 0.1 158)` | Bestått, betalt |
| `--color-warning` / `-ink` | `oklch(0.68 0.13 80)` / `oklch(0.42 0.11 80)` | Forfaller, mangler |
| `--color-danger` / `-ink` | `oklch(0.5 0.16 28)` / `oklch(0.4 0.15 28)` | Feil, purring |

`-ink`-variantene er AA-kontrast tekstfarger til bruk på tonede chips/flater.

## Typografi

Outfit 400/500/600/700 via `next/font/google`. Fast rem-skala, ratio ~1,2,
tokenisert i `@theme` som `--text-xs` … `--text-2xl` (overstyrer Tailwinds
standardskala): 13 / 14 / 16 / 18 / 20 / 24 px = `text-xs/sm/base/lg/xl/2xl`,
med faste linjehøyder 1,4 / 1,4 / 1,5 / 1,45 / 1,3 / 1,25. Alle tall settes
med `tabular-nums` (satt globalt på `body`).

## Form og bevegelse

- Radier: 10 / 14 / 18 px (`rounded-sm/md/lg`) + pill (`rounded-pill`).
- Trykkflater ≥ 44 px (`min-h-11`).
- Bevegelse: 150–250 ms, `cubic-bezier(0.23, 1, 0.32, 1)` (`ease-brand`),
  kun `transform`/`opacity`. Trykk-feedback `scale(0.97)`.
  `prefers-reduced-motion` respekteres globalt.
- Ingen sideinnlastings-orkestrering inne i portalen.

## Komponentkrav

Hver interaktiv komponent skipper default/hover/focus-visible/active/
disabled/loading/error-tilstander. Skeleton ved lasting, lærende tomtilstander
(forklar hva som kommer her og hvorfor), inline-feil. Ledetekst over feltet.
Hover er allerede portstyrt bak `(hover: hover)` i Tailwind v4.

## Forbud (håndheves i kodegjennomgang)

Ingen kicker-/eyebrow-etiketter. Ingen side-stripe-rammer. Ingen
gradient-tekst. Ingen emoji som ikoner. Ingen identiske kort-grid.
Ingen lilla. Aldri `#000`/`#fff`.

## Tilgjengelighet

WCAG AA-kontrast, synlige fokusringer (`focus-visible:ring-*` med `ring`-token), fulle
tastaturstier for oppmøte- og vurderingsflytene (fra fase 2/3).
```

- [ ] **Step 8: Write README.md**

Replace the entire contents of `/Users/daodilyas/dev/iqra-portal/README.md` with:

````markdown
# IQRA portal

Skoleportal for IQRA senter — `portal.iqrasenter.no`. Next.js 16 + Supabase
(Postgres med RLS, Auth med TOTP-MFA). Se `PRODUCT.md`, `DESIGN.md` og
`docs/spec.md` for hva som bygges og hvorfor.

## Krav

- **Docker Desktop** (kjører den lokale Supabase-stacken)
- **Node 20+** og npm
- **Supabase CLI** (`brew install supabase/tap/supabase`)

## Kom i gang lokalt

```bash
npm install
supabase start                 # starter Postgres/Auth/Studio i Docker (svak maskin: + --ignore-health-check, vent til alle containere er friske)
cp .env.example .env.local     # fyll inn nøkler fra `supabase status`
npm run dev                    # http://localhost:3000
```

`supabase status` viser `anon key` og `service_role key` — lim dem inn i
`.env.local`. Studio (database-GUI): http://127.0.0.1:54323

## Testbrukere (KUN lokalt)

`supabase/seed.sql` kjøres bare mot den lokale databasen og legger inn seks
brukere. Passord for alle: `test-passord-123`

| E-post | Rolle |
|---|---|
| admin@test.local | admin (krever TOTP ved første innlogging) |
| laerer@test.local | teacher (krever TOTP) |
| forelder@test.local | parent |
| elev@test.local | student |
| okonomi@test.local | economy (krever TOTP) |
| laererforelder@test.local | teacher + parent (viser rollebytteren) |

## Tester

```bash
npm run typecheck      # TypeScript strict, null feil er kravet
npm run lint           # ESLint
npm test               # Vitest (enhets- og komponenttester)
npm run test:api       # Vitest: API-veggen (DAL-vakter og server actions) i tests/api/
supabase test db       # pgTAP: RLS-/sikkerhetstester i supabase/tests/
supabase db reset      # kjør migrasjoner + seed på nytt
```

`npm run test:api` krever at den lokale stacken kjører med ferske seeds:
kjør `supabase start` (på svake maskiner: legg til `--ignore-health-check`
og vent til `docker ps` viser alle supabase-containerne friske) og
`supabase db reset` først. `test:api` og
`supabase test db` er tvillinger — samme forbudte celler testes på begge
vegger (spec §8.1), og hver ny fase legger til sine tester i begge.

CI (`.github/workflows/ci.yml`) kjører alt over pluss `npm audit` og blokkerer
merge ved feil; unntaket er `test:api`, som foreløpig kjøres lokalt fordi den
trenger hele auth-stacken. Dependabot (`.github/dependabot.yml`) åpner ukentlige
oppdaterings-PR-er.

## Skyoppsett (engangs, manuelle steg)

### 1. Supabase (Stockholm)

1. Opprett organisasjon/prosjekt på supabase.com — **region `eu-north-1`
   (Stockholm)**. Ikke velg noe annet: EU-hosting er et krav (spec §3/§6).
2. Koble repoet: `supabase link --project-ref <PROSJEKT-REF>`
3. Send opp skjemaet: `supabase db push` (kjører kun migrasjoner — aldri seed).
4. I dashbordet: **Authentication → Multi-Factor** — bekreft at TOTP er på,
   og sjekk at prosjektets plannivå faktisk støtter TOTP-innrullering
   (CLI-malen hevder «Pro plan»; historisk er det bare telefon-MFA som er
   betalingsgated — verifiser mot gjeldende prisside FØR produksjon lener
   seg på MFA-porten). **Authentication → URL Configuration** — sett
   Site URL til `https://portal.iqrasenter.no`.
5. **Authentication → Sign In / Providers** — slå AV offentlig
   selvregistrering: kontoer opprettes kun ved admin-invitasjon (spec §4),
   og signup-endepunktet er ellers åpent for alle som har anon-nøkkelen
   (som nødvendigvis er offentlig). **Authentication → Policies** — sett
   minimum passordlengde (12+ anbefalt) og krev kompleksitet. NB:
   `supabase/config.toml` sin `[auth]`-blokk gjelder KUN den lokale
   stacken og pushes aldri til skyen — skyprosjektets auth-policy settes
   her i dashbordet.
6. **Authentication → SMTP** — sett opp Brevo som e-postleverandør
   (valgt i fase 0: EU-selskap med EU-prosessering, gratisnivået holder,
   DPA tilgjengelig). Vert `smtp-relay.brevo.com`, port `587`,
   brukernavn/SMTP-nøkkel fra Brevo-dashbordet. Signer Brevos DPA
   (punkt 4 under) FØR nøkkelen tas i bruk. Transaksjons-e-post er
   innholdsfri by design og inneholder aldri persondata (spec §6).

### 2. Vercel (EU)

1. Importer repoet som nytt Vercel-prosjekt (rammeverk: Next.js).
2. Funksjonsregion er pinnet til Stockholm i `vercel.json` (`arn1`;
   bruk `fra1` som reserve om nødvendig).
3. Miljøvariabler (Production + Preview): `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   (verdier fra Supabase-dashbordet → Settings → API).
4. Domene: legg til `portal.iqrasenter.no` under Domains.

### 3. DNS

Hos domeneleverandøren for `iqrasenter.no`: opprett en **CNAME** for
`portal` som peker på `cname.vercel-dns.com`. Vercel utsteder TLS automatisk.

### 4. Databehandleravtaler (DPA) — sjekkliste før reelle persondata

- [ ] Supabase DPA signert (dashbord → Organization → Legal Documents)
- [ ] Vercel DPA signert (dashbord → Settings → Legal)
- [ ] Brevo DPA signert (e-postleverandør, valgt i fase 0 — EU-selskap med
      EU-prosessering; føres inn i personvernerklæringen, spec §6). Signeres
      FØR SMTP-oppsettet i punkt 1.5 tas i bruk
- [ ] Leverandørene ført inn i behandlingsprotokollen (Art. 30 — fase 7)

## Struktur

- `src/app/` — ruter; portaler per rolle under `(portal)/`
- `src/lib/dal/` — server-only datatilgang (RLS gjelder alltid)
- `src/lib/admin/` — ENESTE modul med service-nøkkel; re-verifiserer admin + skriver revisjonslogg
- `src/proxy.ts` — auth-port: ansatte uten AAL2 slipper ikke inn
- `supabase/migrations/` — skjema; `supabase/tests/` — pgTAP-sikkerhetstester
````

- [ ] **Step 9: Full local verification (CI-equivalent) and commit**

```bash
cd /Users/daodilyas/dev/iqra-portal
npm run typecheck && npm run lint && npm test && npm run build
supabase db reset && supabase test db
npm run test:api
npm audit --audit-level=high
```

Expected: every command exits 0 — typecheck silent, lint clean, all Vitest files pass, build succeeds, all four pgTAP files pass, the five API-wall tests pass, audit reports no high/critical advisories. This mirrors what CI runs plus `test:api`, which for now runs locally only (it needs the full auth stack, so `supabase start` must be running).

```bash
cd /Users/daodilyas/dev/iqra-portal
git add next.config.ts .github vercel.json README.md PRODUCT.md DESIGN.md docs/spec.md
git commit -m "feat: security headers, CI with Dependabot, EU region pin and setup docs"
git log --oneline
```

Expected: a clean conventional-commit history, one commit per task.

> **Remaining manual step for the user (not automatable):** create the GitHub repository (e.g. `Iqrasenter/iqra-portal`), `git remote add origin … && git push -u origin main`, then follow README «Skyoppsett» to create the Supabase (eu-north-1) and Vercel projects, set env vars, DNS and sign the DPAs. The plan treats these as documented user actions per spec §9.

---

## Phase 0 acceptance checklist (maps to spec §9, row 0)

Run through this after Task 15. Every line must hold:

- [ ] **Portal repo** — `/Users/daodilyas/dev/iqra-portal` exists on branch `main`, outside iCloud-synced folders, conventional-commit history (Task 1).
- [ ] **CI + Dependabot** — `.github/workflows/ci.yml` runs typecheck, lint, Vitest, `npm audit`, and pgTAP via `supabase db start` + `supabase test db`; the same pipeline passes locally, plus the API-wall suite (Task 15 Step 9); `.github/dependabot.yml` opens weekly grouped npm update PRs and weekly Actions updates (Task 15 Step 3).
- [ ] **Security headers** — every route answers with HSTS (2 years, includeSubDomains, preload), `X-Frame-Options: DENY`, nosniff, `strict-origin-when-cross-origin` referrer policy, a minimal Permissions-Policy, and the baseline CSP with the Supabase URL in `connect-src`, verified with curl against the dev server (Task 15 Step 1); nonce-based script-src is deferred to Phase 7 hardening (spec §9).
- [ ] **Supabase Stockholm + Vercel EU** — region intent pinned in code/docs: `vercel.json` (`arn1`), config.toml comment + README «Skyoppsett» with eu-north-1, link/push commands, env vars, DNS CNAME for `portal.iqrasenter.no`, and the DPA-signing checklist (Tasks 3, 15). Actual account creation is a documented manual user action.
- [ ] **Auth + MFA** — cookie-based email+password login at `/logg-inn` (Norwegian, generic error message); `src/proxy.ts` blocks staff (admin/teacher/economy) below AAL2 and routes them to `/mfa/registrer` or `/mfa/verifiser`; parents/students are exempt; full TOTP journey verified with a real code (Tasks 11, 13, 14).
- [ ] **Roles** — `user_roles` table with the five roles, `private.has_role`/`private.is_staff` helpers, role switcher UI for multi-role users, portal-per-role route groups with `requireRole` layout guards calling the server-only DAL (Tasks 4, 10, 11, 12).
- [ ] **RLS skeleton + adversarial harnesses at both walls** — RLS enabled default-deny on all four tables; explicit narrow policies; the pgTAP harness proves at the SQL wall: anon sees nothing, users see only their own profile/roles, admin sees all profiles, audit_log rejects direct writes and non-admin reads, `private.audit()` is the only write path, settings is single-row and read-only for users (Tasks 4, 5); the Vitest API-wall harness proves the DAL guards and login validation against the same seed users with forged inputs (Task 12b). *Note: the four fine-derived regression tests from spec §6 need student/guardian/notification tables — they join BOTH suites in Phases 1–5; the harness structures and impersonation patterns they will use are in place now.*
- [ ] **Design tokens + core components** — `@theme` tokens exactly per spec §7 (canvas/ink/primary/surface-tint/hairline + semantic family, the 13/14/16/18/20/24 px type scale with fixed line-heights, radii 10/14/18/pill, Outfit 400–700, tabular-nums, 150–250 ms ease-out motion, reduced-motion respected); Button/Input+Field/Chip/Skeleton/EmptyState with full state coverage and component tests; bans honored (Tasks 7, 8).
- [ ] **Seed/demo data** — six local-only test users covering every role incl. one dual-role user; login verified against GoTrue; documented in README (Task 6).
- [ ] **Two-wall proof** — a parent visiting `/admin` is turned away by the DAL wall (`/ingen-tilgang`), verified in the browser (Task 12 Step 6) and asserted automatically by `npm run test:api` (Task 12b); the same isolation holds at the SQL wall in pgTAP (Tasks 4–5).
- [ ] **Service-role quarantine** — the key is read only inside `src/lib/admin/`; its one function re-verifies admin membership and audits its own read, visible as `audit_log.viewed` rows on the admin dashboard (Tasks 11, 12).

**Phase 0 exit:** all boxes ticked, `git log` clean, CI green on the first push. Phase 1 (School core: terms, classes, subjects, students, guardians, enrollment, admin registry) builds directly on this foundation — its student tables plug into the same RLS + pgTAP harness, and the four fine-derived tests get implemented verbatim then.







