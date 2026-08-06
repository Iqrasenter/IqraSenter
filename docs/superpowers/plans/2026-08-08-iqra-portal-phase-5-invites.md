# Phase 5 Plan 4 — Invite / Credential Flow, Document Reconciliation, Exit Gate

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every provisioned account a way to obtain a first password, so all five roles can log in — and then run the Phase 5 exit gate, which until now was unexecutable for three of them.

**Architecture:** A single-outstanding, single-use, hash-stored invite token in `private`, issued by an admin and redeemed at one unauthenticated page (`/sett-passord`). Delivery is split by role: guardians and staff receive a content-free e-mail through plan 3's `SendPing` seam; **a pupil is never mailed** — the admin is shown a one-time link once, on screen, and hands it over. There is no self-serve password reset: re-issuing an invite *is* the reset, and it is admin-initiated.

**Tech Stack:** Next.js 15 App Router (server actions), Supabase Postgres + GoTrue admin API, `SECURITY DEFINER` RPCs granted to `service_role` alone, pgTAP, Vitest.

---

## ▶ Read this before Task 1

Plans 1–3 are code-complete, green and pushed. This plan continues on the **same** branch.

- **Portal:** `~/dev/iqra-portal`, branch `feat/phase-5-meldinger`, baseline **`7f90094`**.
- **Spec:** `docs/phase-5-communication-spec-DRAFT.md` on portal branch `docs/phase-5-decisions`
  (`git show docs/phase-5-decisions:docs/phase-5-communication-spec-DRAFT.md`), **§11 tasks 14, 15, 15b, 16–16d**.
- **This plan document** lives on `docs/phase-5-plan-4` in the `Desktop/iqra` repo.

### ⛔ Commands — measured, do not re-derive

`npm run test:db` and `npm run test:unit` **do not exist**.

| What | Command |
|---|---|
| pgTAP, all | `npx supabase test db` |
| pgTAP, one file | `npx supabase test db supabase/tests/39_invite_tokens.sql` — **positional, there is no `--file` flag** |
| unit | `npm test` |
| api (~21 min, silent) | `npm run test:api` |
| types | `npm run typecheck` |
| lint | `npm run lint` |
| dead code | `npm run knip` |
| regenerate types | `npm run db:types` |

**Two standing instructions:**
1. `npm run db:types` after **every** migration task; commit `src/lib/supabase/database.types.ts` in the same commit.
2. `vi.mock('server-only', () => ({}))` at the top of **every** new unit test.

### Gate baselines carried in from plan 3

pgTAP **913 / 39 files** · unit **636 / 58** · api **377 / 15** ·
`action-guards` counter **83** · fingerprint markers **95** (`plan(2)` is unchanged — it counts markers, not rows) ·
lint 0 errors (5 pre-existing warnings) · knip: only `scripts/fiken-probe.mjs` + 9 unused **types**.

Next free pgTAP file is **39**. Fixture prefixes `c0` and `c1` are taken — **this plan uses `c2`**.

### 🖱 Before any browser click

1. **Re-enrol MFA at `/mfa/registrer`.** Every `db reset` wipes it and staff routes sit behind AAL2. Parent and pupil need no MFA.
2. Open the enrolment window or family lists are empty for the wrong reason:
   ```sql
   update public.class_students set enrolled_on = current_date - 7
    where class_id = 'fc000000-0000-0000-0000-000000000001';
   ```
   **Put it back to `'2026-08-20'` before the next `npm run test:api`.**
3. `db reset` does **not** clear GoTrue session churn. When every login starts failing with
   `innlogging … feilet: {}`, run `docker restart supabase_auth_iqra-portal`.

---

## Decisions taken for this plan

Three questions the spec left open were put to the user on 2026-08-06 and answered. They are **D29–D31** and are not to be re-litigated.

| # | Decision | Why, and what it costs |
|---|---|---|
| **D29** | **A pupil is never mailed an invite.** Guardians and staff receive an e-mail; for a pupil the admin is shown the link **once, on screen**, and hands it over in person or via the guardian. | Keeps plan 3's «pupils are never mailed» rule **absolute** rather than carved-out, and means the school never needs a working address for a 13-year-old. Cost: one extra admin surface, and a link that exists only in one browser render — if the admin loses it they must re-issue. |
| **D30** | **There is no self-serve password reset.** Re-issuing an invite is the reset, and only an admin can do it. | The portal has *no* reset today, so this closes a real dead end with no new unauthenticated surface and no account-enumeration oracle. Cost, and it is real: a parent who forgets their password must phone the school. Revisit if that burden proves untenable — the lever is a `/glemt-passord` page on this same token machinery, not a second mechanism. |
| **D31** | **One admin screen, `/admin/kontoer`,** lists every account that cannot log in yet and offers the invite. | `adminProvisionUser` is called from exactly two places (`admin/elever/actions.ts:218` guardian, `:319` pupil login) and **there is no staff-provisioning UI at all** — a teacher/økonomi/admin account can only be created by hand in the Supabase dashboard. Per-card buttons would therefore have left staff with no path. One screen covers all five roles and makes «who still cannot log in?» a visible work queue instead of a hidden per-record fact. ⛔ This task does **not** add staff *provisioning* — creating a staff account stays a dashboard operation; this screen only invites accounts that already exist. |

---

## ⛔⛔ Resend is the critical path for the exit gate — start it before Task 1

This plan can be **built** with no Resend account: plan 3's `SendPing` type in `src/lib/varsler/resend.ts` is an injected seam (D28), which is how plan 3 reached 22 mutations and a green gate with no provider. **It cannot be exit-gated without one** — Task 16d requires a real parent receiving a real invite and logging in.

Domain verification for `varsler.iqrasenter.no` has **DNS lead time**. The same account visit discharges plan 3's carries:

1. Confirm against a **real delivered message** that link-rewriting and open-tracking are **OFF**. `ping-email.test.ts` and the new `invite-email.test.ts` both assert over the template *before* the provider touches it and structurally cannot catch this.
2. Set **Resend log retention to minimum**. ⚠ Sharper here than for pings: an invite link in a provider-side log is a live credential for its whole TTL.
3. `CRON_SECRET` + `RESEND_API_KEY` into Vercel's project env before the first deploy.

⚠ **The spec's 15-series text says «the Brevo client». That is stale** — Brevo was evaluated and rejected (its free tier stamps «Sent with Brevo» on every message) and the provider is **Resend**. Task 14 removes the last four Brevo references from the repo.

---

## ⛔ Still unverified, and it stays blocking rather than becoming a caveat

- **What Vercel Cron actually sends.** Firecrawl is out of credits (re-checked 2026-08-06) and CLAUDE.md forbids the WebFetch fallback. Mitigations are in the code (scheme compared case-insensitively per RFC 7235, only the token hashed) but **a permanent 401 has no local symptom**. Read the first real cron invocation's status off the Vercel log before trusting the schedule.
- **The 15-minute interval** in `vercel.json` is likewise unverified against Vercel's current minimum, and is recorded as such in its commit.

Neither blocks Tasks 14–15e. Both are Task 16d checklist items.

---

## ★★ Measured findings that changed this plan's design

Both were measured against the running local stack on 2026-08-06, and each would have shipped a broken task.

### 1. `encrypted_password is null` is NOT «has no password»

The obvious predicate for "who cannot log in yet" is wrong. GoTrue's admin `createUser` **without** a password still writes a 60-character bcrypt hash:

```
                    email       | pw_null | pw_empty | pw_len | identities
    probe-invite@test.local     |    f    |    f     |   60   |     1
```

A `/admin/kontoer` screen built on `encrypted_password is null` would be **permanently empty**, and would read as "everyone can log in". Verified as *not* exploitable — an empty, blank and guessed password are all rejected with `invalid_credentials` — so this is a wrong-predicate bug, not a live vulnerability.

**Consequence:** the app owns the fact. `private.account_activation` holds one row per account that has completed the set-password flow; **absence of a row is the "cannot log in" signal**, and no GoTrue internal is consulted.

### 2. The rest of the mechanism does work, end to end

Also measured, so the plan does not rest on assumption:

- `PUT /auth/v1/admin/users/<id>` with `{"password": …}` on a password-less user → **HTTP 200**.
- A subsequent `POST /token?grant_type=password` with that password → **access token returned**.
- `auth.users.last_sign_in_at` goes from null to non-null on that first sign-in — which is what makes the Task 15a **backfill** safe.

The probe user was deleted; `auth.users` and `public.profiles` were confirmed back to 0 leftover rows.

---

## File structure

**New:**

| File | Responsibility |
|---|---|
| `supabase/migrations/20260808120000_invite_tokens.sql` | `private.invite_tokens`, `private.account_activation`, the four token RPCs, TTL tunables, grants |
| `supabase/migrations/20260808121000_invite_rate_limit.sql` | `private.invite_attempts` + `public.invite_attempt_consume` |
| `supabase/migrations/20260808122000_assignment_storage_comment.sql` | Task 14's `comment on` correction — the applied migration is never edited |
| `supabase/tests/39_invite_tokens.sql` | pgTAP for both migrations |
| `src/lib/auth/invite.ts` | Token generation, the issue/redeem/restore wrappers, the invite URL |
| `src/lib/auth/invite.test.ts` | Unit tests for the above |
| `src/lib/varsler/invite-email.ts` | The content-free invite e-mail template |
| `src/lib/varsler/invite-email.test.ts` | T-16-shaped privacy assertions over the template |
| `src/lib/portal-url.ts` | The one production origin, shared by the drain and the invite link |
| `src/app/sett-passord/page.tsx` | The unauthenticated redemption page |
| `src/app/sett-passord/SetPasswordForm.tsx` | Client form |
| `src/app/sett-passord/actions.ts` | `setPasswordAction` — the plan's only PRE_AUTH addition |
| `src/app/sett-passord/actions.test.ts` | Unit tests |
| `src/app/(portal)/admin/kontoer/page.tsx` | «Kontoer uten innlogging» |
| `src/app/(portal)/admin/kontoer/InviteCard.tsx` | Per-account invite control + the one-time link render |
| `src/app/(portal)/admin/kontoer/actions.ts` | `sendInviteAction`, `revealInviteLinkAction` |
| `src/lib/admin/invites.ts` | Quarantined service-role reads/writes for the admin screen |

**Modified:**

| File | Change |
|---|---|
| `src/proxy.ts` | A second exclusion, above the `!user` branch |
| `src/proxy.test.ts` | Its four-test counterpart |
| `src/app/action-guards.test.ts` | Counter 83 → 84; one `PRE_AUTH` + one `PRE_AUTH_REQUIRES` entry |
| `supabase/tests/29_definer_fingerprints.sql` | Five new entries; marker literal 95 → **counted, not predicted** |
| `src/app/(portal)/admin/AdminNav.tsx` + `.test.tsx` | Nav entry |
| `src/app/api/varsler/drain/route.ts` | Uses the extracted `PORTAL_URL` |
| `src/lib/admin/users.ts:19-23` | The doc comment naming Brevo and a flow that now exists |
| `docs/spec.md`, `README.md`, Phase-4 design spec | Task 14 reconciliation |

---

## Task 14: Document reconciliation

Done first because it is the cheapest task and it removes stale facts the rest of the plan reads.

**Files:**
- Modify: `docs/spec.md:20`, `:109`, `:110`, `:149`, `:208` (portal repo)
- Modify: `README.md:119-125`, `:145-147` (portal repo)
- Modify: `docs/superpowers/specs/2026-07-27-iqra-portal-phase-4-oppgaver-design.md:17`, `:18`, `:203` (**Desktop/iqra** repo)
- Modify: `src/lib/admin/users.ts:19-23`
- Create: `supabase/migrations/20260808122000_assignment_storage_comment.sql`

### ⚠ The spec's task 14 undercounts by two

§10.1 names "Phase-4 **D5**" and the migration comment. Reading the actual files found **two more instances of the same stale claim**, and a task that fixes one of three leaves the contradiction in place:

- **D5** (`:17`) — "Phase 5 adds a third bucket reusing it"
- **D6** (`:18`) — "**Three private buckets by audience**; … Phase 5 adds `announcements`" ← not named by §10.1
- **§9 scope boundaries** (`:203`) — "Phase 5 adds `announcements/`" ← not named by §10.1

All three assert a bucket that §12 Q14 = (a) ruled out. Fix all three.

- [ ] **Step 1: Correct the three `docs/spec.md` data-model lines**

`docs/spec.md:109-110` currently reads:

```markdown
- `threads` (id, student_id nullable context, created_by, subject)
- `thread_participants` (thread_id, user_id)
```

Replace those two lines with:

```markdown
- `threads` (id, student_id NOT NULL, staff_id, kind laerer/kontor, created_by, subject) — Phase 5 D1: every thread is anchored to exactly one pupil, so `student_id` is not nullable. §12 Q2 = (a).
- ~~`thread_participants`~~ — **removed, Phase 5 D2.** Participation is DERIVED from the anchored pupil (staff counterpart + all guardians + the pupil's own login), never stored. A stored participant list can drift from the access predicate; a derived one cannot.
```

- [ ] **Step 2: Restate the attachment non-goal at both places**

`docs/spec.md:20` currently reads:

```markdown
- Message attachments (text only in v1; files flow through assignment hand-ins)
```

Replace with:

```markdown
- Message attachments **and announcement attachments** (text only in v1; files flow through assignment hand-ins). ⚠ Phase-4 D5 briefly retired this line and assigned announcement attachments to Phase 5; **§12 Q14 = (a) reinstated it 2026-08-04** and Phase 5 creates no third Storage bucket. `PRODUCT.md:35` holds.
```

`docs/spec.md:208` currently reads:

```markdown
- Later phases (explicitly deferred): online payment (Vipps), self-service enrollment, English/Arabic UI, offline mode, message attachments.
```

Replace with:

```markdown
- Later phases (explicitly deferred): online payment (Vipps), self-service enrollment, English/Arabic UI, offline mode, message **and announcement** attachments (revisit after the pilot — §12 Q14).
```

- [ ] **Step 3: Correct the mail provider and add the invite privacy line**

`docs/spec.md:149` currently reads:

```markdown
- **E-mail:** transactional pings via a provider with signed DPA and EU-compatible processing (decided Phase 0: **Brevo** — EU processing, DPA signed during Skyoppsett). Content-free by design; provider listed in the privacy notice.
```

Replace with:

```markdown
- **E-mail:** transactional mail via a provider with a signed DPA (decided Phase 0: Brevo; **superseded 2026-08-04 — the provider is Resend**, consolidated with the economy module, which had already evaluated and rejected Brevo because its free tier stamps «Sent with Brevo» on every message). US processor with SCCs; sending subdomain `varsler.iqrasenter.no`. Content-free by design; provider listed in the privacy notice.
- **Invite mail (Phase 5, D29–D31):** an account invitation carries a single-use, 7-day, hash-stored token in its URL and **nothing else** — no name, no child, no role, no class. The token is a credential, not an identifier about a data subject, which is why it may appear in a URL where D12 refuses to put an entity id. **A pupil is never sent an invite e-mail** (D29): the admin is shown the link once on screen. The privacy notice must state that an invitation e-mail is sent to guardians and staff at the address the school registered, and that it contains no information about a child. **→ Phase 7 copy deliverable.**
```

- [ ] **Step 4: Replace Brevo in `README.md`**

`README.md:119-125` currently reads:

```markdown
6. **Authentication → SMTP** — sett opp Brevo som e-postleverandør
   (valgt i fase 0: EU-selskap med EU-prosessering, gratisnivået holder,
   DPA tilgjengelig). Vert `smtp-relay.brevo.com`, port `587`,
   brukernavn/SMTP-nøkkel fra Brevo-dashbordet. Signer Brevos DPA
   (punkt 4 under) FØR nøkkelen tas i bruk. Transaksjons-e-post er
   innholdsfri by design og inneholder aldri persondata (spec §6).
```

Replace with:

```markdown
6. **Authentication → SMTP** — sett opp **Resend** som e-postleverandør
   (valgt 2026-08-04, felles med økonomimodulen; Brevo ble vurdert og
   forkastet fordi gratisnivået stempler «Sent with Brevo» på hver
   melding). Vert `smtp.resend.com`, port `587`, brukernavn `resend`,
   passord = API-nøkkelen fra Resend-dashbordet. **Eget sendedomene
   `varsler.iqrasenter.no`** — DNS-verifisering tar tid, start den før
   nøkkelen trengs. Signer Resends DPA (punkt 4 under) FØR nøkkelen tas
   i bruk. Transaksjons-e-post er innholdsfri by design og inneholder
   aldri persondata (spec §6).
   ⚠ **Skru AV link-omskriving og åpningssporing.** Begge gjeninnfører
   nøyaktig den identifikatoren D12 nekter å legge i en URL, og de gjør
   det ETTER at malen er bygget — malfilenes tester kan ikke fange det.
   Sett også loggretensjonen til minimum: en invitasjonslenke i en
   leverandørlogg er et levende passord ut hele gyldighetstiden.
```

`README.md:145-147` currently reads:

```markdown
- [ ] Brevo DPA signert (e-postleverandør, valgt i fase 0 — EU-selskap med
      EU-prosessering; føres inn i personvernerklæringen, spec §6). Signeres
      FØR SMTP-oppsettet i punkt 1.5 tas i bruk
```

Replace with:

```markdown
- [ ] Resend DPA signert (e-postleverandør, valgt 2026-08-04 — amerikansk
      leverandør, SCC-er; føres inn i personvernerklæringen, spec §6).
      Signeres FØR SMTP-oppsettet i punkt 1.6 tas i bruk
```

- [ ] **Step 5: Retire Phase-4 D5, D6 and §9 in the Desktop/iqra repo**

In `docs/superpowers/specs/2026-07-27-iqra-portal-phase-4-oppgaver-design.md`, replace the **rationale cell** of D5 (`:17`) with:

```markdown
⛔ **RETIRED 2026-08-04 by Phase 5 §12 Q14 = (a).** The master spec's non-goal was reinstated: `PRODUCT.md:35` holds, announcements carry no attachments, and **Phase 5 creates no third bucket**. Phase 4's own attachment scope (D4 — assignments and submissions) is unaffected and shipped. Revisit after the pilot.
```

Replace the **decision cell** of D6 (`:18`) with:

```markdown
**Two private buckets by audience** — `assignments` and `submissions`, both created in Phase 4. ⛔ **Corrected 2026-08-04:** this read «Three private buckets … Phase 5 adds `announcements`»; §12 Q14 = (a) ruled that bucket out and Phase 5 shipped without it.
```

Replace `:203` with:

```markdown
- **Announcements/posts** → Phase 5. ⛔ **Their attachments are NOT deferred, they are cancelled** (§12 Q14 = (a), 2026-08-04): Phase 5 built `announcements` as text-only and added no bucket.
```

- [ ] **Step 6: Correct the shipped migration comment with a NEW migration**

⛔ `20260728094000_assignment_storage.sql` is **already applied**. Editing it changes a file whose checksum the migration history has recorded, and the correction never reaches an existing database. Write a new migration instead.

Create `supabase/migrations/20260808122000_assignment_storage_comment.sql`:

```sql
-- Comment-only correction to 20260728094000_assignment_storage.sql.
--
-- ⛔ WHY A NEW MIGRATION AND NOT AN EDIT. That file is applied. Editing an
-- applied migration changes a recorded checksum and — more to the point —
-- never reaches a database that already ran it, so the wrong comment would
-- survive in exactly the place anyone would read it: production.
--
-- WHAT WAS WRONG. Its header promised THREE buckets by audience and said
-- «Phase 5 adds `announcements`» (lines 4-11). Phase-4 D5 and D6 said the
-- same. Phase 5 §12 Q14 = (a), decided 2026-08-04, ruled attachments out of
-- both messaging and announcements: PRODUCT.md:35 holds, and Phase 5 shipped
-- with no third bucket and no `storage.objects` policy of its own.
--
-- The arrangement is TWO buckets, and the audience-separation argument is
-- unchanged and still the reason for it: a policy bug in one bucket cannot
-- leak across audiences, and children's own work stays behind its own policy
-- set. Only the count and the Phase 5 promise were wrong.

comment on table public.assignment_attachments is
  'Binds a Storage object in the `assignments` bucket to an assignment row. ONE OF TWO buckets by audience (Phase-4 D6, corrected 2026-08-04): `assignments` (teacher hands out, whole class reads) and `submissions` (child hands in; child, guardians and teacher read). There is NO third bucket — Phase 5 §12 Q14 = (a) ruled out announcement attachments and Phase 5 shipped announcements as text only.';

comment on table public.submission_attachments is
  'Binds a Storage object in the `submissions` bucket to a hand-in. The tighter of the TWO buckets (Phase-4 D6, corrected 2026-08-04) — children''s own work, isolated behind its own policy set. Phase 5 added no bucket; see the note on public.assignment_attachments.';
```

- [ ] **Step 7: Verify both table names exist before running the migration**

A `comment on table` naming a table that does not exist **aborts the migration**, and `db reset` then fails for every later task in this plan. Check first:

```bash
cd ~/dev/iqra-portal && docker exec supabase_db_iqra-portal psql -U postgres -d postgres -tAc \
  "select to_regclass('public.assignment_attachments'), to_regclass('public.submission_attachments');"
```

Expected: `assignment_attachments|submission_attachments` — two non-null values.
If either is null, find the real name with `\dt public.*attachment*` and correct the migration before proceeding.

- [ ] **Step 8: Correct the provisioning doc comment**

`src/lib/admin/users.ts:19-23` currently reads:

```typescript
/**
 * Creates a CONFIRMED, PASSWORD-LESS auth user + roles + audit entry.
 * Deliberately no credentials: the invite/set-password flow ships with
 * cloud onboarding (content-free e-mail via Brevo) — see the Phase 1 plan
 * header. The profiles row is created by the on_auth_user_created trigger.
 */
```

Replace with:

```typescript
/**
 * Creates a CONFIRMED, PASSWORD-LESS auth user + roles + audit entry.
 * The profiles row is created by the on_auth_user_created trigger.
 *
 * ⚠ "PASSWORD-LESS" IS NOT VISIBLE IN auth.users. Measured 2026-08-06:
 * GoTrue's admin createUser with no password still writes a 60-character
 * bcrypt hash, so `encrypted_password is null` is FALSE here and is not the
 * predicate for "cannot log in yet". Verified not exploitable — an empty,
 * blank or guessed password is rejected with invalid_credentials — but any
 * screen built on that column reads as "everyone can log in".
 *
 * The app owns the fact instead: an account can log in exactly when it has a
 * row in private.account_activation, stamped by the set-password flow
 * (20260808120000_invite_tokens.sql). Until then it is listed on
 * /admin/kontoer and needs an invite.
 */
```

- [ ] **Step 9: Verify nothing still claims Brevo or a third bucket**

```bash
cd ~/dev/iqra-portal && git grep -n -i "brevo" -- . ':!docs/phase-5-communication-spec-DRAFT.md' ':!docs/phase-5-open-decisions.md' ':!docs/phase-5-review-2026-08-04.md' ':!docs/economy-integrations-research.md'
```

Expected: **no output.** The four excluded files are historical records that deliberately retain the old name — the spec §14.3, the decisions log, the review and the economy research all narrate *why* Brevo was rejected, and rewriting them would destroy the reasoning.

```bash
cd ~/dev/iqra-portal && git grep -n "announcements.*bucket\|third bucket\|tredje bucket" -- supabase/ src/
```

Expected: **no output.**

- [ ] **Step 10: Apply and verify the migration**

```bash
cd ~/dev/iqra-portal && npx supabase db reset && npm run db:types
```

Expected: reset completes with no error, and the new migration is listed. Then confirm the comment landed:

```bash
cd ~/dev/iqra-portal && docker exec supabase_db_iqra-portal psql -U postgres -d postgres -tAc \
  "select obj_description('public.assignment_attachments'::regclass) like '%ONE OF TWO buckets%';"
```

Expected: `t`

- [ ] **Step 11: Commit — two repos, two commits**

Portal:

```bash
cd ~/dev/iqra-portal && git add docs/spec.md README.md src/lib/admin/users.ts \
  supabase/migrations/20260808122000_assignment_storage_comment.sql \
  src/lib/supabase/database.types.ts
git commit -m "docs: reconcile the spec, the README and a shipped migration comment with Q14=(a)

Three claims contradicted the schema and one contradicted the provider
decision. The migration comment is corrected by a NEW migration's comment on:
20260728094000 is applied, so editing it would never reach a database that
already ran it.

Also records what encrypted_password actually contains for a provisioned
account (measured, 60-byte bcrypt, not null), because the obvious predicate
for the /admin/kontoer screen is wrong."
```

Desktop/iqra (plan-docs worktree):

```bash
git add docs/superpowers/specs/2026-07-27-iqra-portal-phase-4-oppgaver-design.md
git commit -m "docs(portal): retire Phase-4 D5 — and D6 and §9, which said the same thing

Phase 5 §10.1 named only D5. Two further places asserted the same third
bucket that Q14=(a) ruled out; fixing one of three leaves the contradiction."
```

---

## Task 15a: the token tables, the five RPCs, and the D29 wall

**Files:**
- Create: `supabase/migrations/20260808120000_invite_tokens.sql`
- Create: `supabase/tests/39_invite_tokens.sql`
- Modify: `supabase/seed.sql`
- Modify: `src/lib/supabase/database.types.ts` (generated)

### ⛔ Two measured facts this task is built on

**1. `private.audit()` REFUSES the `admin.` namespace.** Measured from the live definition on 2026-08-06:

```sql
if lower(p_action) ~ '^[[:space:]]*(admin|system)\.' then
  raise exception 'reservert navnerom for revisjonslogg: %', p_action using errcode = '42501';
end if;
```

So `perform private.audit('admin.invite.issued', …)` **raises**, and because it is called inside `invite_issue` the whole issue fails with a 42501 that reads as a permission problem. That is also why `src/lib/admin/users.ts:59` inserts into `public.audit_log` directly for `admin.user.provisioned` rather than going through the helper.

**2. `private.audit()` takes its actor from `auth.uid()`,** which is **null** under `service_role`. An audit row for an admin action would record no admin.

**Both together:** `invite_issue` writes `public.audit_log` with a **direct insert** and an **explicitly passed actor**. Do not "simplify" it back onto `private.audit()` — that is two bugs, not a refactor.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260808120000_invite_tokens.sql`:

```sql
-- The invite / credential flow (spec §11, 15-series; decisions D29–D31).
--
-- ── The hole this closes ────────────────────────────────────────────
-- adminProvisionUser creates a CONFIRMED but password-less auth user, so no
-- guardian and no pupil could ever log in. Three of five roles had never been
-- exercised through the real login path, and the Phase 5 exit gate could not
-- be run for them.
--
-- ── Why the app owns "has a password", measured 2026-08-06 ──────────
-- The obvious source — auth.users.encrypted_password is null — is FALSE for a
-- password-less account: GoTrue writes a 60-character bcrypt placeholder. A
-- screen built on it is permanently empty and reads as "everyone can log in".
-- (Verified not exploitable: empty, blank and guessed passwords are all
-- rejected with invalid_credentials.) So activation is a fact this schema
-- records, not one it infers from a vendor's internals.
--
-- ── Shape ───────────────────────────────────────────────────────────
-- ONE outstanding invite per account: user_id is the PRIMARY KEY, so issuing
-- again REPLACES the row and the previous link dies at that instant. That is
-- the whole reason for the shape — a table keyed by token id would accumulate
-- live credentials, and "send it again" would leave the older one working.
--
-- The token is stored as a sha256 digest, never in clear. A table of live
-- invite links is a table of passwords; the digest answers the only question
-- asked of it. Nothing anywhere can print an outstanding link a second time —
-- for a pupil (D29) the admin gets exactly one on-screen render.
--
-- ── D29 is a WALL here, not a convention in TypeScript ──────────────
-- A pupil is never sent an invite e-mail. Enforced in invite_issue by the
-- same test plan 3's fan-out uses — membership of students.student_user_id,
-- a RELATIONSHIP, never a role — so a pupil who also holds some other role is
-- still covered.

-- ── Tables ──────────────────────────────────────────────────────────
create table private.invite_tokens (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  token_hash  bytea not null,
  issued_at   timestamptz not null default now(),
  expires_at  timestamptz not null,
  issued_by   uuid references public.profiles (id) on delete set null,
  delivery    text not null check (delivery in ('epost', 'skjerm')),
  consumed_at timestamptz
);
comment on table private.invite_tokens is
  'At most ONE outstanding invite per account (user_id is the PK, so re-issuing kills the previous link). Holds a sha256 digest, never the token. private schema: PostgREST never exposes it. Written only by the SECURITY DEFINER functions below, granted to service_role alone.';

-- Redemption looks the token up by digest. UNIQUE so `returning` can never be
-- ambiguous, which is what lets invite_redeem be a single statement.
create unique index invite_tokens_hash_idx on private.invite_tokens (token_hash);

create table private.account_activation (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  password_set_at timestamptz not null default now()
);
comment on table private.account_activation is
  'One row per account that has completed the set-password flow. ABSENCE OF A ROW IS THE "cannot log in yet" SIGNAL — see the migration header on why auth.users.encrypted_password cannot answer that question.';

-- ── Hashing happens HERE, not in Node ───────────────────────────────
-- ⛔ THE RPCs TAKE THE TOKEN AS text AND DIGEST IT IN SQL. The obvious
-- alternative — hash in TypeScript and pass a bytea argument — has to encode
-- that bytea for PostgREST (hex, `\x…`, not base64), and getting it subtly
-- wrong produces a digest that never matches anything, i.e. an invite flow
-- where every single link is silently invalid. private.login_email_hash
-- (20260728182000:54) is the established precedent for exactly this reason.
-- The plaintext reaching Postgres is not a new exposure: it already reached
-- the Node server, and this is the same trust boundary.
create function private.invite_token_hash(p_token text)
returns bytea
language sql
immutable
set search_path = ''
as $$ select extensions.digest(p_token, 'sha256') $$;

-- ── Tunables, in one place so pgTAP and the app agree ───────────────
-- Two TTLs, because the deliveries differ in kind. An e-mailed link has to
-- survive a parent not checking mail for a few days; an on-screen link is
-- handed over in the same minute, so a long life on it is pure exposure.
create function private.invite_ttl(p_delivery text) returns interval
  language sql immutable set search_path = '' as $$
  select case p_delivery when 'skjerm' then interval '24 hours' else interval '7 days' end
$$;

-- How long after consumption a token may be un-consumed. Bounds invite_restore
-- to undoing a failure THAT JUST HAPPENED, so it can never resurrect an old
-- link. Same discipline as login_refund_attempt: give back exactly the one
-- thing that was just spent, never a reset.
create function private.invite_restore_window() returns interval
  language sql immutable set search_path = '' as $$ select interval '5 minutes' $$;

-- ── Issue ───────────────────────────────────────────────────────────
create function public.invite_issue(
  target        uuid,
  p_token       text,
  p_delivery    text,
  p_issued_by   uuid
) returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expires timestamptz;
begin
  -- ⛔ D29. A pupil is never mailed. Keyed on the RELATIONSHIP
  -- (students.student_user_id), never on a role — the same test the ping
  -- fan-out uses, so a pupil who also holds another role is still covered.
  if p_delivery = 'epost'
     and exists (select 1 from public.students s where s.student_user_id = target)
  then
    raise exception 'D29: en elev skal aldri motta invitasjon på e-post'
      using errcode = '42501';
  end if;

  v_expires := now() + private.invite_ttl(p_delivery);

  insert into private.invite_tokens
    (user_id, token_hash, issued_at, expires_at, issued_by, delivery, consumed_at)
  values (target, private.invite_token_hash(p_token), now(), v_expires, p_issued_by, p_delivery, null)
  on conflict (user_id) do update
    set token_hash  = excluded.token_hash,
        issued_at   = excluded.issued_at,
        expires_at  = excluded.expires_at,
        issued_by   = excluded.issued_by,
        delivery    = excluded.delivery,
        -- ⛔ MUST be reset. Without it, re-issuing after a redemption leaves
        -- consumed_at set and the NEW link is dead on arrival.
        consumed_at = null;

  -- ⛔ A DIRECT INSERT, not private.audit(). Measured 2026-08-06: that helper
  -- REJECTS any action in the `admin.`/`system.` namespace (errcode 42501),
  -- and it takes its actor from auth.uid(), which is null under service_role.
  -- Routing this through it would fail the issue outright AND record no actor.
  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values (p_issued_by, 'admin.invite.issued', 'auth.users', target::text,
          jsonb_build_object('delivery', p_delivery, 'expires_at', v_expires));

  return v_expires;
end;
$$;
comment on function public.invite_issue(uuid, text, text, uuid) is
  'Issues (and REPLACES) the single outstanding invite for an account. Refuses delivery=epost for a pupil (D29). service_role only.';

-- ── Redeem ──────────────────────────────────────────────────────────
-- ⛔ ONE STATEMENT. Check-then-consume across two statements is a TOCTOU: two
-- concurrent submissions both read an unconsumed row and both proceed, and
-- the single-use property is "single-use OR one unbounded burst" — the exact
-- defect the login throttle was rewritten to remove (20260728200000).
create function public.invite_redeem(p_token text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  update private.invite_tokens
     set consumed_at = now()
   where token_hash = private.invite_token_hash(p_token)
     and consumed_at is null
     and expires_at > now()
  returning user_id;
$$;
comment on function public.invite_redeem(text) is
  'Consumes the token and returns its account, or null if no live unconsumed token matches. ONE statement, so concurrent submissions cannot both succeed. service_role only.';

-- ── Restore ─────────────────────────────────────────────────────────
-- Consume-before-the-outcome-is-known means a failure that is NOT the user's
-- fault has to give the token back: the password is set through GoTrue AFTER
-- redemption, and a 5xx there would otherwise strand the family with a dead
-- link and no way to ask for another except phoning the school.
create function public.invite_restore(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.invite_tokens
     set consumed_at = null
   where token_hash = private.invite_token_hash(p_token)
     and consumed_at is not null
     and consumed_at > now() - private.invite_restore_window()
     and expires_at > now();
$$;
comment on function public.invite_restore(text) is
  'Un-consumes a token consumed within the last few minutes, for a set-password failure that was not the user''s fault. The window is what stops this being a way to resurrect any old link. service_role only.';

-- ── Mark activated ──────────────────────────────────────────────────
create function public.invite_mark_activated(target uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.account_activation (user_id, password_set_at)
  values (target, now())
  on conflict (user_id) do update set password_set_at = now();
$$;
comment on function public.invite_mark_activated(uuid) is
  'Records that an account has completed the set-password flow. The upsert matters: re-issuing an invite is also the password RESET path (D30), so an already-activated account passes through here again.';

-- ── The admin work queue ────────────────────────────────────────────
create function public.invite_pending_accounts()
returns table (
  user_id          uuid,
  full_name        text,
  email            text,
  roles            text[],
  is_student       boolean,
  invite_issued_at timestamptz,
  invite_expires_at timestamptz,
  invite_delivery  text
)
language sql
security definer
set search_path = ''
as $$
  select p.id,
         p.full_name,
         u.email::text,
         coalesce(array_agg(r.role::text order by r.role)
                    filter (where r.role is not null), '{}'),
         exists (select 1 from public.students s where s.student_user_id = p.id),
         t.issued_at,
         t.expires_at,
         t.delivery
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.user_roles r on r.user_id = p.id
    left join private.invite_tokens t on t.user_id = p.id
   where not exists (
           select 1 from private.account_activation a where a.user_id = p.id)
     -- A soft-deleted account is not a person waiting for a login.
     and u.deleted_at is null
   group by p.id, p.full_name, u.email, t.issued_at, t.expires_at, t.delivery
   -- Never-invited first: that is the actionable end of the queue.
   order by t.issued_at asc nulls first, p.full_name asc;
$$;
comment on function public.invite_pending_accounts() is
  'Every account that cannot log in yet, with its outstanding invite state. Drives /admin/kontoer. service_role only — it returns e-mail addresses across the whole school.';

-- ── Backfill ────────────────────────────────────────────────────────
-- Anyone who has ever signed in demonstrably holds a working password, and
-- that is the only signal available: the placeholder bcrypt is indistinguish-
-- able from a real one (see the header). Anyone who has NOT signed in is
-- either genuinely un-activated or will activate on their first login and
-- stamp themselves — so the false-positive direction is "appears on the admin
-- queue for a while", never "silently unable to log in".
insert into private.account_activation (user_id, password_set_at)
select p.id, coalesce(u.last_sign_in_at, u.created_at)
  from public.profiles p
  join auth.users u on u.id = p.id
 where u.last_sign_in_at is not null
on conflict (user_id) do nothing;

-- ── Grants (the narrow part) ────────────────────────────────────────
revoke all on table private.invite_tokens from anon, authenticated, service_role;
revoke all on table private.account_activation from anon, authenticated, service_role;

revoke execute on function public.invite_issue(uuid, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.invite_redeem(text) from public, anon, authenticated;
revoke execute on function public.invite_restore(text) from public, anon, authenticated;
revoke execute on function public.invite_mark_activated(uuid) from public, anon, authenticated;
revoke execute on function public.invite_pending_accounts() from public, anon, authenticated;

grant execute on function public.invite_issue(uuid, text, text, uuid) to service_role;
grant execute on function public.invite_redeem(text) to service_role;
grant execute on function public.invite_restore(text) to service_role;
grant execute on function public.invite_mark_activated(uuid) to service_role;
grant execute on function public.invite_pending_accounts() to service_role;
```

⚠ `revoke … from public` alone only strips the PUBLIC grant. A migration applied as `supabase_admin` gets different default ACLs that grant `anon`/`authenticated` explicitly, and those survive. The roles are named above for exactly that reason (the lesson from `20260728200000:235-241`).

- [ ] **Step 2: Stamp the seeded accounts as activated**

Without this, `db reset` leaves all seven seeded logins looking un-activated — they have real passwords but have never signed in, and the backfill above (correctly) cannot tell. Every pgTAP fixture and the admin screen would start from a wrong state.

Append to `supabase/seed.sql`:

```sql
-- The seeded logins have real passwords set above, so they are activated by
-- construction. The 20260808120000 backfill keys on last_sign_in_at, which is
-- null for a freshly reset database — correct for production, wrong here — so
-- the seed states the fact it owns.
insert into private.account_activation (user_id, password_set_at)
select id, now() from auth.users where email like '%@test.local'
on conflict (user_id) do nothing;
```

- [ ] **Step 3: Apply and regenerate types**

```bash
cd ~/dev/iqra-portal && npx supabase db reset && npm run db:types
```

Expected: reset completes; `git diff --stat src/lib/supabase/database.types.ts` shows the five new functions.

- [ ] **Step 4: Write the pgTAP file**

Create `supabase/tests/39_invite_tokens.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- Fixture prefix c2 (c0 and c1 are taken by plans 2 and 3).
-- Four actors: an admin who issues, a guardian who may be mailed, a pupil who
-- may not (D29), and a soft-deleted account that must not appear in the queue.
--
-- ⚠ 19, COUNTED BY HAND. Never count plan() by grep — it undercounts
-- multi-line calls, measured at 17 against a correct plan(20) in file 38.
--
-- ⚠ The auth.users shape is the house one (files 35/37/38): full_name goes in
-- raw_user_meta_data, NOT in a later profiles insert. private.handle_new_user
-- (20260716170230:90-107) creates the profile the moment this row lands, so an
-- `insert into public.profiles … on conflict do nothing` afterwards is DEAD
-- CODE and the name never reaches the table — and assertions 13-15 read names.
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data,
                        raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.email, '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', u.full_name), now(), now()
from (values
  ('c2000000-0000-0000-0000-000000000001'::uuid, 'c2-admin@test.no',    'C2 Admin'),
  ('c2000000-0000-0000-0000-000000000002'::uuid, 'c2-forelder@test.no', 'C2 Forelder'),
  ('c2000000-0000-0000-0000-000000000003'::uuid, 'c2-elev@test.no',     'C2 Elev'),
  ('c2000000-0000-0000-0000-000000000004'::uuid, 'c2-slettet@test.no',  'C2 Slettet')
) as u(id, email, full_name)
on conflict (id) do nothing;

update auth.users set deleted_at = now()
 where id = 'c2000000-0000-0000-0000-000000000004';

insert into public.user_roles (user_id, role) values
  ('c2000000-0000-0000-0000-000000000001', 'admin'),
  ('c2000000-0000-0000-0000-000000000002', 'parent'),
  ('c2000000-0000-0000-0000-000000000003', 'student');

-- The pupil's LOGIN LINK is what D29 keys on, not the student role.
-- ⚠ birth_YEAR, a smallint — there is no birth_date column (checked against
-- the live table 2026-08-06; the check constraint is 1900..2100).
insert into public.students (id, first_name, last_name, birth_year, student_user_id)
values ('c2000000-0000-0000-0000-0000000000a1', 'C2', 'Elev', 2012,
        'c2000000-0000-0000-0000-000000000003');

-- ── 1-2: the token is stored hashed, never in clear ─────────────────
select public.invite_issue(
  'c2000000-0000-0000-0000-000000000002',
  'c2-token-a',
  'epost',
  'c2000000-0000-0000-0000-000000000001');

select is(
  (select token_hash from private.invite_tokens
    where user_id = 'c2000000-0000-0000-0000-000000000002'),
  extensions.digest('c2-token-a', 'sha256'),
  'the stored value is the sha256 digest of the token');

select isnt(
  (select token_hash from private.invite_tokens
    where user_id = 'c2000000-0000-0000-0000-000000000002'),
  'c2-token-a'::bytea,
  'the stored value is NOT the token itself — a table of live invite links is a table of passwords');

-- ── 3-4: issuing again REPLACES, and the old link dies ──────────────
select public.invite_issue(
  'c2000000-0000-0000-0000-000000000002',
  'c2-token-b',
  'epost',
  'c2000000-0000-0000-0000-000000000001');

select is(
  (select count(*)::int from private.invite_tokens
    where user_id = 'c2000000-0000-0000-0000-000000000002'),
  1,
  'at most one outstanding invite per account');

select is(
  public.invite_redeem('c2-token-a'),
  null::uuid,
  'the REPLACED token no longer redeems — «send it again» must not leave the older link working');

-- ── 5-6: single use ─────────────────────────────────────────────────
select is(
  public.invite_redeem('c2-token-b'),
  'c2000000-0000-0000-0000-000000000002'::uuid,
  'a live token redeems to its account');

select is(
  public.invite_redeem('c2-token-b'),
  null::uuid,
  'the same token cannot be redeemed twice');

-- ── 7: expiry ───────────────────────────────────────────────────────
update private.invite_tokens
   set consumed_at = null, expires_at = now() - interval '1 second'
 where user_id = 'c2000000-0000-0000-0000-000000000002';

select is(
  public.invite_redeem('c2-token-b'),
  null::uuid,
  'an expired token does not redeem even though it was never consumed');

-- ── 8-10: ★★ D29 — a pupil is never mailed ──────────────────────────
-- The three assertions are one control. The refusal alone could pass because
-- the call is broken for any reason; pairing it with the SAME call succeeding
-- for a different delivery, and for a different person, means only the pupil
-- e-mail arm can explain the failure.
select throws_ok(
  $$ select public.invite_issue(
       'c2000000-0000-0000-0000-000000000003',
       'c2-token-c',
       'epost',
       'c2000000-0000-0000-0000-000000000001') $$,
  '42501',
  null,
  'D29: issuing an e-mail invite for a pupil is refused');

select lives_ok(
  $$ select public.invite_issue(
       'c2000000-0000-0000-0000-000000000003',
       'c2-token-c',
       'skjerm',
       'c2000000-0000-0000-0000-000000000001') $$,
  'D29: the same pupil CAN be invited by on-screen link');

select lives_ok(
  $$ select public.invite_issue(
       'c2000000-0000-0000-0000-000000000002',
       'c2-token-d',
       'epost',
       'c2000000-0000-0000-0000-000000000001') $$,
  'D29: a guardian CAN be invited by e-mail — so the refusal above is about the pupil, not about the call');

-- ── 11-12: restore is bounded to a failure that just happened ───────
select public.invite_redeem('c2-token-d');
select public.invite_restore('c2-token-d');

select is(
  public.invite_redeem('c2-token-d'),
  'c2000000-0000-0000-0000-000000000002'::uuid,
  'a token consumed moments ago can be restored after a downstream failure');

update private.invite_tokens
   set consumed_at = now() - interval '10 minutes'
 where user_id = 'c2000000-0000-0000-0000-000000000002';
select public.invite_restore('c2-token-d');

select is(
  (select consumed_at is not null from private.invite_tokens
    where user_id = 'c2000000-0000-0000-0000-000000000002'),
  true,
  'restore does NOT resurrect a token consumed outside the window — otherwise it is a way to re-open any old link');

-- ── 13-15: the admin work queue ─────────────────────────────────────
select is(
  (select count(*)::int from public.invite_pending_accounts()
    where user_id = 'c2000000-0000-0000-0000-000000000002'),
  1,
  'an account with no activation row is listed as unable to log in');

select public.invite_mark_activated('c2000000-0000-0000-0000-000000000002');

select is(
  (select count(*)::int from public.invite_pending_accounts()
    where user_id = 'c2000000-0000-0000-0000-000000000002'),
  0,
  'an activated account leaves the queue');

select is(
  (select count(*)::int from public.invite_pending_accounts()
    where user_id = 'c2000000-0000-0000-0000-000000000004'),
  0,
  'a soft-deleted account is not a person waiting for a login');

-- ── 16-17: the grants ───────────────────────────────────────────────
select is_empty(
  $$
    select grantee || ' can execute ' || routine_name
      from information_schema.role_routine_grants
     where routine_schema = 'public'
       and routine_name in ('invite_issue', 'invite_redeem', 'invite_restore',
                            'invite_mark_activated', 'invite_pending_accounts')
       and grantee in ('anon', 'authenticated', 'PUBLIC')
  $$,
  'no invite RPC is executable by anon, authenticated or PUBLIC');

select is_empty(
  $$
    select grantee || ' holds ' || privilege_type || ' on ' || table_name
      from information_schema.role_table_grants
     where table_schema = 'private'
       and table_name in ('invite_tokens', 'account_activation')
       and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
  $$,
  'the invite tables carry no table grants at all — reachable only through the definer functions');

-- ── 18-19: the audit trail ──────────────────────────────────────────
-- ONE, not two. The pupil is the subject of two issue ATTEMPTS (assertions 8
-- and 9), but the refused `epost` one raises before reaching the audit insert
-- and the whole statement rolls back. So a refusal leaves no trace here — which
-- is itself the claim being made: the audit log records issues, not attempts.
select is(
  (select count(*)::int from public.audit_log
    where action = 'admin.invite.issued'
      and entity_id = 'c2000000-0000-0000-0000-000000000003'),
  1,
  'only the SUCCESSFUL pupil issue is audited — the refused e-mail attempt raised before the insert');

select is(
  (select actor_id from public.audit_log
    where action = 'admin.invite.issued'
      and entity_id = 'c2000000-0000-0000-0000-000000000002'
    order by id desc limit 1),
  'c2000000-0000-0000-0000-000000000001'::uuid,
  'the audit row names the ADMIN who issued, not null — private.audit() would have recorded auth.uid(), which is null under service_role');

select * from finish();
rollback;
```

⚠ **Assertion 18's count is a claim, not a guess — verify it.** The pupil receives one refused `epost` issue (which raises *before* the audit insert, so it writes nothing) and one successful `skjerm` issue. If the count is not what the assertion says, **read the rows** — do not adjust the literal to match:

```bash
cd ~/dev/iqra-portal && docker exec supabase_db_iqra-portal psql -U postgres -d postgres -c \
  "select action, entity_id, meta from public.audit_log where action = 'admin.invite.issued' order by id;"
```

- [ ] **Step 5: Run the new file alone and read the assertion indices**

```bash
cd ~/dev/iqra-portal && npx supabase test db supabase/tests/39_invite_tokens.sql
```

⚠ **Positional path. There is no `--file` flag** — CLI v2.109.1 rejects it.

Expected: `ok 1` … `ok 19`, no failures. If `plan(19)` disagrees with the number that ran, **count the `select is/isnt/ok/throws_ok/lives_ok/is_empty` calls** and set `plan()` to that; never nudge it to silence a failure.

- [ ] **Step 6: Run the whole suite**

```bash
cd ~/dev/iqra-portal && npx supabase test db
```

Expected: **932** assertions across **40** files (913 + 19). If the total is not 932, the difference is not this file — find it before continuing.

- [ ] **Step 7: Commit**

```bash
cd ~/dev/iqra-portal && git add supabase/migrations/20260808120000_invite_tokens.sql \
  supabase/tests/39_invite_tokens.sql supabase/seed.sql src/lib/supabase/database.types.ts
git commit -m "feat(invitasjon): single-outstanding, single-use invite tokens with a pupil-mail wall

user_id is the PK, so re-issuing kills the previous link — 'send it again'
must not leave the older one working. Redemption is ONE statement, so two
concurrent submissions cannot both consume it.

D29 is enforced in SQL, keyed on students.student_user_id (a relationship, not
a role), the same test the ping fan-out uses.

Activation is recorded rather than inferred: measured 2026-08-06, GoTrue writes
a 60-byte bcrypt placeholder for a password-less account, so
encrypted_password is null is FALSE and any screen built on it is empty.

The audit row is a direct insert with an explicit actor, because private.audit()
rejects the admin. namespace outright and reads its actor from auth.uid(),
which is null under service_role.

pgTAP 913 -> 932."
```

---

## Task 15b: the redemption rate limit, and the definer fingerprints

**Files:**
- Create: `supabase/migrations/20260808121000_invite_rate_limit.sql`
- Modify: `supabase/tests/39_invite_tokens.sql` (`plan(19)` → `plan(22)`)
- Modify: `supabase/tests/29_definer_fingerprints.sql` (marker literal **95** → counted)

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260808121000_invite_rate_limit.sql`:

```sql
-- Rate limit for /sett-passord (spec §11 task 15: "its own rate limit, the
-- private.login_attempts precedent").
--
-- ── What is actually being defended, stated honestly ────────────────
-- NOT the token. The token is 32 bytes from a CSPRNG — 256 bits — so guessing
-- it is not a threat model, it is arithmetic. This limiter exists for the two
-- things that ARE reachable: hammering the endpoint as a denial of service,
-- and burning CPU on bcrypt via the GoTrue call behind it.
--
-- ── Why the bucket is ip ALONE, unlike login_attempts ───────────────
-- login_attempts buckets on (email, ip) because it has an email. Redemption
-- has no identity to key on — the token is opaque and the submitter is
-- anonymous by construction — so ip is all there is. That is a real cost:
-- IQRA's families share the school network, so a burst from inside the
-- building could slow a parent activating an account in the same room. The
-- limit is therefore set well above any honest use (20 in 15 minutes; an
-- honest redemption is ONE) rather than at the strict value login uses.
--
-- ── This one fails OPEN, and the reason differs from login's ────────
-- login_attempt_consume fails open because hook_password_verification_attempt
-- is a non-bypassable backstop. There is NO backstop here. The justification
-- is the entropy above: with the limiter unreachable, an attacker gains the
-- ability to make unlimited guesses against a 256-bit secret, which is no
-- ability at all. Locking every new family out of activation because an RPC
-- had a bad minute is the strictly worse failure.

create table private.invite_attempts (
  id           bigint generated always as identity primary key,
  ip           text not null,
  attempted_at timestamptz not null default now()
);
comment on table private.invite_attempts is
  'Redemption attempts at /sett-passord, bucketed by ip alone — redemption is anonymous, so there is no second dimension to key on. Written only by public.invite_attempt_consume, granted to service_role alone.';

create index invite_attempts_bucket_idx on private.invite_attempts (ip, attempted_at desc);
-- ⚠ The bucket index cannot serve a predicate on attempted_at alone, and the
-- global prune below has exactly that predicate. Without this index the prune
-- is a seq scan on every redemption — the third defect the login throttle
-- hardening had to fix (20260728200000:14-17).
create index invite_attempts_attempted_at_idx on private.invite_attempts (attempted_at);

create function private.invite_attempt_window() returns interval
  language sql immutable set search_path = '' as $$ select interval '15 minutes' $$;
create function private.invite_attempt_limit() returns integer
  language sql immutable set search_path = '' as $$ select 20 $$;

-- Consume-on-check in ONE statement body, like login_attempt_consume. The
-- split read-then-write version it replaced let N concurrent requests all read
-- a stale zero and all pass; there is deliberately no read-only variant here
-- to call by mistake.
create function public.invite_attempt_consume(p_ip text)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window interval := private.invite_attempt_window();
  v_count  integer;
  v_oldest timestamptz;
begin
  -- Bucket-scoped, so it uses invite_attempts_bucket_idx rather than scanning.
  delete from private.invite_attempts
   where ip = p_ip and attempted_at < now() - v_window;

  insert into private.invite_attempts (ip) values (p_ip);

  select count(*), min(attempted_at)
    into v_count, v_oldest
    from private.invite_attempts
   where ip = p_ip and attempted_at >= now() - v_window;

  if v_count > private.invite_attempt_limit() then
    allowed := false;
    retry_after_seconds :=
      greatest(1, ceil(extract(epoch from (v_oldest + v_window - now())))::integer);
  else
    allowed := true;
    retry_after_seconds := 0;
  end if;
  return next;
end;
$$;
comment on function public.invite_attempt_consume(text) is
  'Records a redemption attempt and reports whether the ip bucket still has budget, in ONE statement. Anti-DoS only — the token''s 256 bits are what make guessing infeasible. service_role only.';

revoke all on table private.invite_attempts from anon, authenticated, service_role;
revoke execute on function public.invite_attempt_consume(text) from public, anon, authenticated;
grant execute on function public.invite_attempt_consume(text) to service_role;
```

- [ ] **Step 2: Extend the pgTAP file — `plan(19)` becomes `plan(22)`**

Change the third line of `supabase/tests/39_invite_tokens.sql` from `select plan(19);` to `select plan(22);`, and add the `invite_attempt_consume` name to the grants assertion's list (assertion 16) so the new RPC is covered by the same wall:

```sql
     where routine_schema = 'public'
       and routine_name in ('invite_issue', 'invite_redeem', 'invite_restore',
                            'invite_mark_activated', 'invite_pending_accounts',
                            'invite_attempt_consume')
       and grantee in ('anon', 'authenticated', 'PUBLIC')
```

Then append these three assertions **before** `select * from finish();`:

```sql
-- ── 20-22: the redemption limiter ───────────────────────────────────
select is(
  (select allowed from public.invite_attempt_consume('198.51.100.7')),
  true,
  'the first redemption attempt from an address is allowed');

-- 20 is the limit and one was just spent, so 20 more crosses it.
insert into private.invite_attempts (ip)
select '198.51.100.7' from generate_series(1, 20);

select is(
  (select allowed from public.invite_attempt_consume('198.51.100.7')),
  false,
  'an address past the limit is refused');

select is(
  (select allowed from public.invite_attempt_consume('198.51.100.8')),
  true,
  'a DIFFERENT address is unaffected — the refusal above is the bucket, not a broken function');
```

- [ ] **Step 3: Run the file and read the indices**

```bash
cd ~/dev/iqra-portal && npx supabase db reset && npx supabase test db supabase/tests/39_invite_tokens.sql
```

Expected: `ok 1` … `ok 22`.

⚠ If assertion 21 says `allowed = true`, the arithmetic is off by one, not the limiter: `invite_attempt_consume` inserts **before** counting and refuses when `count > limit`. One consumed + 20 seeded = 21 rows, then the call inserts its own = 22 > 20. Count the rows before adjusting anything:
```bash
docker exec supabase_db_iqra-portal psql -U postgres -d postgres -tAc \
  "select ip, count(*) from private.invite_attempts group by ip;"
```

- [ ] **Step 4: Add the six definer fingerprints**

In `supabase/tests/29_definer_fingerprints.sql`, add these entries to the `definer_markers` VALUES list, immediately before the closing `) as f(sig, markers);`:

```sql
    ,
    -- Stubbed, D29 is gone and a 13-year-old is mailed a credential. The audit
    -- marker is the second control: without it, credential issuance for any
    -- account in the school leaves no trace of who did it.
    (
      'public.invite_issue(uuid,text,text,uuid)',
      array[
        's.student_user_id = target',
        'admin.invite.issued'
      ]
    ),
    -- Drop either marker and the token stops being single-use, or stops
    -- expiring. Both turn one leaked link into a permanent account takeover.
    (
      'public.invite_redeem(text)',
      array[
        'consumed_at is null',
        'expires_at > now()'
      ]
    ),
    -- Without the window this is not a refund, it is a way to re-open ANY
    -- previously used invite link.
    (
      'public.invite_restore(text)',
      array[
        'private.invite_restore_window()',
        'consumed_at is not null'
      ]
    ),
    -- Same marker, same reason, as resolve_ping_address: a soft-deleted
    -- account is not a person waiting for a login, and listing one hands an
    -- admin a live invite path into an erased identity.
    (
      'public.invite_pending_accounts()',
      array[
        'u.deleted_at is null'
      ]
    ),
    -- Stubbed, the limiter is decorative.
    (
      'public.invite_attempt_consume(text)',
      array[
        'private.invite_attempt_limit()'
      ]
    )
```

⛔ **`public.invite_mark_activated(uuid)` is deliberately NOT pinned, and this omission is stated rather than left to be discovered.** It contains no wall: stubbing it to a no-op means accounts never leave the admin queue — visible, annoying, and not an escalation. The file's own header records a reader who audited its scope note *as* a coverage guarantee and was wrong; naming the omission is what stops that happening again.

- [ ] **Step 5: Count the markers — do not predict them**

The five entries above carry **2 + 2 + 2 + 1 + 1 = 8** markers, so the literal goes **95 → 103**. Update the two places in the file:

```sql
select is(
  (select count(*)::int from definer_markers d, lateral unnest(d.markers) as m),
  103,
  'the fingerprint table still covers 103 (function, predicate) pairs'
);
```

and extend the arithmetic comment above it:

```sql
-- 83 → 95. Phase 5 plan 4 then added FIVE entries carrying 2+2+2+1+1 = 8,
-- so 95 → 103. public.invite_mark_activated is deliberately absent — it holds
-- no wall to pin; see the note beside the entries.
```

⛔ **This counter has now been got wrong twice on this file** — once by reading "five new functions" and writing 31, once by a plan step that stated three different numbers for one value. **The arrays are what count.** If assertion 1 is red, count the markers; never reconcile the two numbers by adjusting either one.

- [ ] **Step 6: Run both files, then the whole suite**

```bash
cd ~/dev/iqra-portal && npx supabase test db supabase/tests/29_definer_fingerprints.sql \
  && npx supabase test db
```

Expected: file 29 `ok 1`, `ok 2`. Full suite **935** assertions across **40** files (932 + 3).

- [ ] **Step 7: Regenerate types and commit**

```bash
cd ~/dev/iqra-portal && npm run db:types
git add supabase/migrations/20260808121000_invite_rate_limit.sql \
  supabase/tests/39_invite_tokens.sql supabase/tests/29_definer_fingerprints.sql \
  src/lib/supabase/database.types.ts
git commit -m "feat(invitasjon): the redemption limiter, and six new definer fingerprints

Bucketed on ip alone because redemption is anonymous — there is no second
dimension. Set well above honest use (20/15min against an honest ONE) because
IQRA's families share the school network.

Fails open, and the reason is not login's: there is no backstop here, but the
token is 256 bits, so an unreachable limiter grants unlimited guesses against
a secret that cannot be guessed. Locking families out of activation is worse.

Fingerprint markers 95 -> 103 (2+2+2+1+1, counted from the arrays).
invite_mark_activated is deliberately unpinned — it holds no wall.

pgTAP 932 -> 935."
```

---

## Task 15c: the token library, the invite e-mail, and the shared portal URL

**Files:**
- Create: `src/lib/portal-url.ts`, `src/lib/auth/invite.ts`, `src/lib/auth/invite.test.ts`
- Create: `src/lib/varsler/invite-email.ts`, `src/lib/varsler/invite-email.test.ts`
- Modify: `src/app/api/varsler/drain/route.ts:125`

- [ ] **Step 1: Extract the portal origin**

Create `src/lib/portal-url.ts`:

```typescript
/**
 * The one production origin, in one place.
 *
 * It was a bare literal inside the drain route. A second consumer — the invite
 * link — makes a duplicated production URL a thing that can drift, and the
 * failure mode of drift here is a batch of invitation e-mails pointing at a
 * host that does not serve the portal.
 *
 * ⛔ NOT read from the environment. An origin taken from a request header or a
 * mutable env var is how host-header injection turns a password-set link into
 * a credential harvester: the e-mail would carry whatever host the attacker
 * could get the server to echo. A constant cannot be poisoned.
 */
export const PORTAL_URL = 'https://portal.iqrasenter.no';
```

- [ ] **Step 2: Use it in the drain route**

In `src/app/api/varsler/drain/route.ts`, add the import and replace the literal at line 125:

```typescript
import { PORTAL_URL } from '@/lib/portal-url';
```

```typescript
    portalUrl: PORTAL_URL,
```

- [ ] **Step 3: Write the failing e-mail-template test**

Create `src/lib/varsler/invite-email.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { buildInviteEmail } = await import('./invite-email');

/**
 * T-16's discipline, applied to the invite: distinctive, non-substring tokens,
 * so an assertion cannot pass by accident against a realistic name.
 *
 * ⚠ THIS FILE CANNOT PROTECT THE WHOLE PROMISE, exactly as ping-email.test.ts
 * cannot: a provider that rewrites links through a per-recipient tracking
 * domain reintroduces an identifier AFTER this function has returned. That is
 * a Task 16d check against a real delivered message, not something asserted
 * here.
 */
const URL = 'https://portal.iqrasenter.no/sett-passord?t=ZZTOKENZZ';

describe('buildInviteEmail', () => {
  it('names no person, no child and no role', () => {
    const mail = buildInviteEmail({ inviteUrl: URL, validDays: 7 });
    const whole = `${mail.subject}\n${mail.text}`;
    for (const forbidden of ['ZZPUPILZZ', 'ZZPARENTZZ', 'ZZTEACHERZZ', 'ZZCLASSZZ']) {
      expect(whole).not.toContain(forbidden);
    }
  });

  it('echoes no e-mail address — the recipient is the envelope, never the body', () => {
    const mail = buildInviteEmail({ inviteUrl: URL, validDays: 7 });
    expect(mail.text).not.toMatch(/@/);
  });

  it('never templates the subject — it is what shows on a locked phone', () => {
    const a = buildInviteEmail({ inviteUrl: URL, validDays: 7 });
    const b = buildInviteEmail({ inviteUrl: 'https://x/sett-passord?t=OTHER', validDays: 1 });
    expect(a.subject).toBe(b.subject);
  });

  it('carries the link and the deadline', () => {
    const mail = buildInviteEmail({ inviteUrl: URL, validDays: 7 });
    expect(mail.text).toContain(URL);
    expect(mail.text).toContain('7 dager');
  });

  it('says «1 dag», not «1 dager»', () => {
    const mail = buildInviteEmail({ inviteUrl: URL, validDays: 1 });
    expect(mail.text).toContain('1 dag');
    expect(mail.text).not.toContain('1 dager');
  });

  it('refuses to render a link that is not a set-password link', () => {
    expect(() => buildInviteEmail({ inviteUrl: 'https://evil.example/x', validDays: 7 }))
      .toThrow();
  });
});
```

- [ ] **Step 4: Run it and watch it fail**

```bash
cd ~/dev/iqra-portal && npm test -- invite-email
```

Expected: FAIL — `Cannot find module './invite-email'`.

- [ ] **Step 5: Write the template**

Create `src/lib/varsler/invite-email.ts`:

```typescript
import 'server-only';
import { PORTAL_URL } from '@/lib/portal-url';

/**
 * The invite e-mail (D29–D31). Content-free in the same sense as the ping:
 * the ONLY variables are a link and a number of days, and neither is about a
 * child.
 *
 * ★ THE LINK IS A CREDENTIAL, NOT AN IDENTIFIER — and that is why it may be in
 * a URL when D12 refuses to put an entity id in one. D12's objection is that a
 * thread or pupil id in a URL discloses WHO the message concerns to anything
 * that sees the link. An invite token discloses nothing: it is 256 random bits
 * that name no person, and it dies on first use.
 *
 * ⛔ A PUPIL IS NEVER SENT THIS (D29). The wall is in SQL — invite_issue
 * refuses delivery='epost' for anyone in students.student_user_id — because a
 * wall in TypeScript is one forgotten branch away from a 13-year-old being
 * mailed a credential.
 */
export type InviteEmail = { subject: string; text: string };

/** Fixed. Never templated: this is the part that appears on a lock screen. */
const SUBJECT = 'Aktiver innloggingen din i IQRA skoleportal';

export function buildInviteEmail(input: { inviteUrl: string; validDays: number }): InviteEmail {
  // A link built from anything but PORTAL_URL means a caller has assembled it
  // from a request header, which is how an invitation becomes a credential
  // harvester. Throwing makes that unrepresentable rather than merely unlikely.
  if (!input.inviteUrl.startsWith(`${PORTAL_URL}/sett-passord?`)) {
    throw new Error('Invitasjonslenken må peke på portalens egen sett-passord-side.');
  }
  const days = `${input.validDays} ${input.validDays === 1 ? 'dag' : 'dager'}`;
  return {
    subject: SUBJECT,
    text: [
      'Hei,',
      '',
      'IQRA skoleportal har opprettet en innlogging for denne e-postadressen.',
      'Velg ditt eget passord her:',
      input.inviteUrl,
      '',
      `Lenken er gyldig i ${days} og kan brukes én gang.`,
      '',
      'Har du ikke ventet denne e-posten, kan du se bort fra den — eller ringe',
      'skolen på +47 998 64 331.',
      'Denne e-posten inneholder aldri opplysninger om barnet ditt.',
    ].join('\n'),
  };
}
```

- [ ] **Step 6: Run it and watch it pass**

```bash
cd ~/dev/iqra-portal && npm test -- invite-email
```

Expected: 6 passed.

- [ ] **Step 7: Write the failing library test**

Create `src/lib/auth/invite.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { generateInviteToken, inviteUrl, validDaysUntil } = await import('./invite');

describe('generateInviteToken', () => {
  it('is 256 bits, URL-safe, and never repeats', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const token = generateInviteToken();
      // 32 bytes base64url = 43 characters, no padding.
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(seen.has(token)).toBe(false);
      seen.add(token);
    }
  });
});

describe('inviteUrl', () => {
  it('points at the portal, not at anything a request could influence', () => {
    expect(inviteUrl('abc123')).toBe(
      'https://portal.iqrasenter.no/sett-passord?t=abc123',
    );
  });
});

describe('validDaysUntil', () => {
  const now = new Date('2026-08-08T12:00:00Z');

  it.each([
    ['seven whole days', '2026-08-15T12:00:00Z', 7],
    ['a day and a half rounds UP, never down', '2026-08-09T23:59:00Z', 2],
    ['under a day is still a day, never zero', '2026-08-08T13:00:00Z', 1],
  ])('%s', (_label, expiresAt, expected) => {
    expect(validDaysUntil(new Date(expiresAt), now)).toBe(expected);
  });

  it('never returns zero for an already-expired link', () => {
    expect(validDaysUntil(new Date('2026-08-07T12:00:00Z'), now)).toBe(1);
  });
});
```

⚠ `validDaysUntil` **rounds up and floors at 1**. Rounding down would render «gyldig i 0 dager» on a link that still works, which reads as "do not bother trying" — an instruction to a parent to phone the school about a working link.

- [ ] **Step 8: Run it and watch it fail**

```bash
cd ~/dev/iqra-portal && npm test -- lib/auth/invite
```

Expected: FAIL — `Cannot find module './invite'`.

- [ ] **Step 9: Write the library**

Create `src/lib/auth/invite.ts`:

```typescript
import 'server-only';
import { randomBytes } from 'node:crypto';
import { createServiceRoleClient } from '@/lib/admin/quarantine';
import { PORTAL_URL } from '@/lib/portal-url';

/**
 * The invite token, app side. The DIGEST is computed in SQL, not here —
 * see the migration header: passing a bytea argument through PostgREST needs
 * hex encoding, and getting that subtly wrong yields an invite flow where
 * every link is silently invalid.
 */
export type InviteDelivery = 'epost' | 'skjerm';

/** 32 bytes = 256 bits. base64url so the token survives a URL untouched. */
export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

export function inviteUrl(token: string): string {
  return `${PORTAL_URL}/sett-passord?t=${encodeURIComponent(token)}`;
}

/**
 * Whole days until a link dies, rounded UP and floored at 1. Never 0: a link
 * that still works must never be described as expired.
 */
export function validDaysUntil(expiresAt: Date, now: Date = new Date()): number {
  const ms = expiresAt.getTime() - now.getTime();
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

/** Issues (and replaces) the account's single outstanding invite. */
export async function issueInvite(input: {
  userId: string;
  token: string;
  delivery: InviteDelivery;
  issuedBy: string;
}): Promise<{ expiresAt: Date }> {
  const service = createServiceRoleClient();
  const { data, error } = await service.rpc('invite_issue', {
    target: input.userId,
    p_token: input.token,
    p_delivery: input.delivery,
    p_issued_by: input.issuedBy,
  });
  if (error) {
    // 42501 is D29's wall, not a transient fault. Surfacing it as itself stops
    // a caller retrying forever against a rule that will never relent.
    throw new Error(`Kunne ikke opprette invitasjon: ${error.message}`);
  }
  return { expiresAt: new Date(data as unknown as string) };
}

/** Consumes the token. Returns the account it belonged to, or null. */
export async function redeemInvite(token: string): Promise<string | null> {
  const service = createServiceRoleClient();
  const { data, error } = await service.rpc('invite_redeem', { p_token: token });
  if (error) throw new Error(`Kunne ikke løse inn invitasjon: ${error.message}`);
  return (data as string | null) ?? null;
}

/** Gives the token back after a failure that was not the user's fault. */
export async function restoreInvite(token: string): Promise<void> {
  const service = createServiceRoleClient();
  const { error } = await service.rpc('invite_restore', { p_token: token });
  // Deliberately swallowed after logging: the caller is already handling a
  // failure, and throwing here would replace a recoverable "try again" with a
  // 500 while ALSO losing the original cause.
  if (error) console.error('[invitasjon] invite_restore feilet:', error.message);
}

export async function markActivated(userId: string): Promise<void> {
  const service = createServiceRoleClient();
  const { error } = await service.rpc('invite_mark_activated', { target: userId });
  if (error) throw new Error(`Kunne ikke merke kontoen som aktivert: ${error.message}`);
}
```

- [ ] **Step 10: Run both suites and commit**

```bash
cd ~/dev/iqra-portal && npm test && npm run typecheck && npm run lint && npm run knip
```

Expected: unit **636 → 647** (6 template + 5 library assertions… **count what actually runs** and record it; `it.each` with three cases contributes three). typecheck 0, lint 0 errors, knip at baseline.

⚠ If `knip` reports `PORTAL_URL` or `InviteDelivery` as unused, the drain-route edit in Step 2 was skipped or the type has no consumer yet — `knip` fails unused exports at **error** level. `InviteDelivery` gets its consumer in Task 15e; if it is red here, move the `export` off it until then rather than disabling the check.

```bash
git add src/lib/portal-url.ts src/lib/auth/invite.ts src/lib/auth/invite.test.ts \
  src/lib/varsler/invite-email.ts src/lib/varsler/invite-email.test.ts \
  src/app/api/varsler/drain/route.ts
git commit -m "feat(invitasjon): token library, content-free invite e-mail, shared portal origin

The link is a credential, not an identifier — which is why it may live in a
URL where D12 refuses to put an entity id. It names no person and dies on
first use.

The origin is a CONSTANT, never an env var or a request header: an origin the
request can influence turns a password-set link into a credential harvester.
buildInviteEmail throws on any link that does not start at that origin.

validDaysUntil rounds UP and floors at 1 — «gyldig i 0 dager» on a working
link tells a parent to phone the school about nothing."
```

---

## Task 15d: `/sett-passord` — the app's second unauthenticated surface

**Files:**
- Create: `src/app/sett-passord/page.tsx`, `SetPasswordForm.tsx`, `actions.ts`, `actions.test.ts`
- Modify: `src/lib/admin/rate-limit.ts`, `src/proxy.ts`, `src/proxy.test.ts`, `src/app/action-guards.test.ts`
- Modify: `src/app/logg-inn/page.tsx` (the success banner)

### ⛔ The ordering inside the action is the task

**Validate → rate-limit → redeem → set password → mark activated.** Any other order has a real failure:

- Redeeming **before** validating means a mistyped confirmation field **burns the token**, and the parent's only recourse is to phone the school. This is the single most likely way to ship a flow that works in testing and fails for real families.
- Setting the password **before** marking activated is required — the account is only activated if GoTrue actually accepted it.
- A GoTrue failure **after** redemption must `restoreInvite`, or a 5xx during an incident permanently kills a live invitation.

- [ ] **Step 1: Add the rate-limit wrapper**

Append to `src/lib/admin/rate-limit.ts` (it already documents itself as the quarantine's PRE-AUTH category, and already has `currentIp()` and `logThrottleFailure()`):

```typescript
/**
 * Budget for /sett-passord, bucketed on ip alone — redemption is anonymous,
 * so there is no second dimension to key on (see the migration header).
 *
 * Fails OPEN, and for a different reason than the login gate: there is no
 * backstop here, but the token is 256 bits, so an unreachable limiter grants
 * unlimited guesses against a secret that cannot be guessed. Locking every
 * new family out of activation is the strictly worse failure.
 */
export async function consumeInviteAttempt(): Promise<LoginGate> {
  try {
    const service = createServiceRoleClient();
    const { data, error } = await service
      .rpc('invite_attempt_consume', { p_ip: await currentIp() })
      .maybeSingle();
    if (error) {
      logThrottleFailure('invite_attempt_consume', error);
      return ALLOW;
    }
    if (!data || data.allowed) return ALLOW;
    return { allowed: false, retryAfterSeconds: data.retry_after_seconds ?? 60 };
  } catch (cause) {
    logThrottleFailure('invite_attempt_consume', cause);
    return ALLOW;
  }
}
```

- [ ] **Step 2: Write the failing action test**

Create `src/app/sett-passord/actions.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const redeemInvite = vi.fn();
const restoreInvite = vi.fn();
const markActivated = vi.fn();
const consumeInviteAttempt = vi.fn();
const updateUserById = vi.fn();

vi.mock('@/lib/auth/invite', () => ({ redeemInvite, restoreInvite, markActivated }));
vi.mock('@/lib/admin/rate-limit', () => ({ consumeInviteAttempt }));
vi.mock('@/lib/admin/quarantine', () => ({
  createServiceRoleClient: () => ({ auth: { admin: { updateUserById } } }),
}));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); },
}));

const { setPasswordAction } = await import('./actions');

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.append(k, v);
  return data;
}

const GOOD = { t: 'tok', passord: 'ObskurtPassord123', bekreft: 'ObskurtPassord123' };

beforeEach(() => {
  vi.clearAllMocks();
  consumeInviteAttempt.mockResolvedValue({ allowed: true });
  redeemInvite.mockResolvedValue('user-1');
  updateUserById.mockResolvedValue({ error: null });
  markActivated.mockResolvedValue(undefined);
});

describe('setPasswordAction', () => {
  it('★ does NOT redeem the token when the confirmation does not match', async () => {
    const state = await setPasswordAction({ error: null }, form({ ...GOOD, bekreft: 'noeAnnet' }));
    expect(redeemInvite).not.toHaveBeenCalled();
    expect(state.error).toMatch(/ikke like/i);
  });

  it('★ does NOT redeem the token when the password is too short', async () => {
    const state = await setPasswordAction(
      { error: null },
      form({ ...GOOD, passord: 'kort', bekreft: 'kort' }),
    );
    expect(redeemInvite).not.toHaveBeenCalled();
    expect(state.error).toMatch(/12/);
  });

  it('refuses when the ip is over budget, without touching the token', async () => {
    consumeInviteAttempt.mockResolvedValue({ allowed: false, retryAfterSeconds: 300 });
    const state = await setPasswordAction({ error: null }, form(GOOD));
    expect(redeemInvite).not.toHaveBeenCalled();
    expect(state.error).toMatch(/for mange/i);
  });

  it('reports a dead link without calling GoTrue', async () => {
    redeemInvite.mockResolvedValue(null);
    const state = await setPasswordAction({ error: null }, form(GOOD));
    expect(updateUserById).not.toHaveBeenCalled();
    expect(state.error).toMatch(/ugyldig eller utløpt/i);
  });

  it('★ gives the token back when GoTrue fails, so the family is not stranded', async () => {
    updateUserById.mockResolvedValue({ error: { message: 'boom', status: 500 } });
    const state = await setPasswordAction({ error: null }, form(GOOD));
    expect(restoreInvite).toHaveBeenCalledWith('tok');
    expect(markActivated).not.toHaveBeenCalled();
    expect(state.error).toMatch(/prøv igjen/i);
  });

  it('★ marks the account activated only AFTER GoTrue accepted', async () => {
    await expect(setPasswordAction({ error: null }, form(GOOD)))
      .rejects.toThrow('REDIRECT:/logg-inn?aktivert=1');
    expect(updateUserById).toHaveBeenCalledWith('user-1', { password: GOOD.passord });
    expect(markActivated).toHaveBeenCalledWith('user-1');
    expect(restoreInvite).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

```bash
cd ~/dev/iqra-portal && npm test -- sett-passord
```

Expected: FAIL — `Cannot find module './actions'`.

- [ ] **Step 4: Write the action**

Create `src/app/sett-passord/actions.ts`:

```typescript
'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/admin/quarantine';
import { consumeInviteAttempt } from '@/lib/admin/rate-limit';
import { markActivated, redeemInvite, restoreInvite } from '@/lib/auth/invite';

export interface SetPasswordState {
  error: string | null;
}

/**
 * 12, not the 6 in supabase/config.toml. That block governs the LOCAL stack
 * only and is never pushed to the cloud (README:115-118); the cloud project's
 * policy is set in the dashboard, and this is the wall that actually runs for
 * every user. No composition rules — length beats character classes, and a
 * rule that forces a symbol mostly produces «Passord1!».
 */
const setPasswordSchema = z
  .object({
    t: z.string().min(1).max(200),
    passord: z.string().min(12, 'Passordet må ha minst 12 tegn.').max(200),
    bekreft: z.string().max(200),
  })
  .refine((v) => v.passord === v.bekreft, {
    message: 'Passordene er ikke like.',
    path: ['bekreft'],
  });

function minutesUntilRetry(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 60));
}

export async function setPasswordAction(
  _prev: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  // ⛔ VALIDATE FIRST, BEFORE ANYTHING TOUCHES THE TOKEN. Redeeming ahead of
  // this makes a mistyped confirmation field consume a single-use invitation,
  // and the family's only recourse is to phone the school.
  const parsed = setPasswordSchema.safeParse({
    t: formData.get('t'),
    passord: formData.get('passord'),
    bekreft: formData.get('bekreft'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ugyldig innsending.' };
  }

  const gate = await consumeInviteAttempt();
  if (!gate.allowed) {
    return {
      error:
        `For mange forsøk fra dette nettverket. Prøv igjen om ` +
        `${minutesUntilRetry(gate.retryAfterSeconds)} minutter.`,
    };
  }

  const userId = await redeemInvite(parsed.data.t);
  if (!userId) {
    // One message for "never existed", "already used" and "expired". The token
    // is unguessable, so this reveals nothing — but a split message would tell
    // a holder of a used link that it was once real, and the school gains
    // nothing from that distinction either.
    return { error: 'Lenken er ugyldig eller utløpt. Be skolen sende en ny.' };
  }

  const service = createServiceRoleClient();
  const { error } = await service.auth.admin.updateUserById(userId, {
    password: parsed.data.passord,
  });
  if (error) {
    // The token was already spent on a failure that is not the user's fault.
    // Give it back, or a 5xx during an incident permanently kills a live
    // invitation and the family cannot try again.
    await restoreInvite(parsed.data.t);
    console.error('[sett-passord] GoTrue avviste passordet:', {
      status: error.status,
      message: error.message,
    });
    return { error: 'Kunne ikke lagre passordet. Prøv igjen om et øyeblikk.' };
  }

  // Only now — the account is activated when GoTrue holds the password, not
  // when we asked it to.
  await markActivated(userId);

  // ⛔ No session is minted here. The user goes through the REAL login path,
  // which is both the honest thing for an unauthenticated route to do and the
  // thing Task 16d has to exercise anyway.
  redirect('/logg-inn?aktivert=1');
}
```

- [ ] **Step 5: Run it and watch it pass**

```bash
cd ~/dev/iqra-portal && npm test -- sett-passord
```

Expected: 6 passed.

- [ ] **Step 6: The page and the form**

Create `src/app/sett-passord/page.tsx`:

```typescript
import Link from 'next/link';
import { SetPasswordForm } from './SetPasswordForm';

export const dynamic = 'force-dynamic';

/**
 * Unauthenticated by design — the person arriving here has no session and no
 * way to get one until this page does its job.
 *
 * ⚠ THE TOKEN IS NOT CHECKED ON GET. Checking it would need a peek that does
 * not consume, and a peek is a second, weaker path to the same secret. The
 * cost is honest and small: someone holding a dead link fills the form in
 * before being told, in one clear message.
 */
export default async function SettPassordPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold">Velg passord</h1>
      {t ? (
        <>
          <p className="text-sm text-ink/70">
            Velg et passord på minst 12 tegn. Du bruker e-postadressen skolen
            har registrert som brukernavn.
          </p>
          <SetPasswordForm token={t} />
        </>
      ) : (
        <>
          <p className="text-sm text-ink/70">
            Lenken mangler. Åpne invitasjonen fra e-posten på nytt, eller be
            skolen sende en ny.
          </p>
          <Link href="/logg-inn" className="text-sm underline">
            Til innlogging
          </Link>
        </>
      )}
    </main>
  );
}
```

Create `src/app/sett-passord/SetPasswordForm.tsx`:

```typescript
'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { setPasswordAction, type SetPasswordState } from './actions';

const idle: SetPasswordState = { error: null };

export function SetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(setPasswordAction, idle);

  return (
    <form action={action} className="flex flex-col gap-4">
      {/*
        Hidden, with an explicit value — the repo's established shape (see
        admin/elever/LoginCard.tsx). React 19 resets UNCONTROLLED fields after
        every completed form action, including a failed one, and a token that
        resets leaves the retry posting nothing. The ?t= in the URL is the
        second line of defence: a reload restores it.
      */}
      <input type="hidden" name="t" value={token} />
      <Field label="Nytt passord" htmlFor="passord">
        <Input
          id="passord"
          name="passord"
          type="password"
          required
          minLength={12}
          maxLength={200}
          autoComplete="new-password"
        />
      </Field>
      <Field label="Gjenta passordet" htmlFor="bekreft">
        <Input
          id="bekreft"
          name="bekreft"
          type="password"
          required
          maxLength={200}
          autoComplete="new-password"
        />
      </Field>
      {state.error ? (
        <p role="alert" className="text-sm text-danger-ink">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" loading={pending}>
        Lagre passord
      </Button>
    </form>
  );
}
```

⚠ Check the two component names against the repo before writing: `Button`, `Field` and `Input` are used exactly this way in `admin/elever/LoginCard.tsx:1-16`, and `text-danger-ink` is a real token there (`:92`). **Do not invent tokens** — plan 3 shipped a bell styled with `text-muted-foreground`, shadcn vocabulary with zero usages in this repo, which compiled to nothing and rendered unstyled grey text.

- [ ] **Step 7: The success banner on the login page**

In `src/app/logg-inn/page.tsx`, read the flag and render a confirmation above the form:

```typescript
export default async function LoggInnPage({
  searchParams,
}: {
  searchParams: Promise<{ aktivert?: string }>;
}) {
  const { aktivert } = await searchParams;
  // … existing body, with this above <LoginForm />:
  //
  // {aktivert === '1' ? (
  //   <p role="status" className="rounded-lg border border-hairline px-4 py-3 text-sm">
  //     Passordet er lagret. Logg inn med e-postadressen din.
  //   </p>
  // ) : null}
}
```

⚠ Read the existing file first — if it is not already `async` or does not take `searchParams`, adding the prop is the change; do not restructure the rest of it.

- [ ] **Step 8: The proxy exclusion**

In `src/proxy.ts`, immediately **after** the drain exclusion at `:92` and **before** `if (!user)`:

```typescript
  // ⛔ ALSO BEFORE THE !user BRANCH, and for the same reason as the drain: the
  // whole point of this page is that its visitor has no session, so the
  // matcher would 307 every invited parent to /logg-inn — a login page they
  // cannot use, reached from a link that appears to be broken.
  //
  // ⚠ ONE EXACT PATH, never a prefix, and trailing-slash tolerant. It also
  // deliberately lets a SIGNED-IN user through rather than bouncing them to
  // «/» the way /logg-inn does: an admin testing an invite link, or a parent
  // with a stale session, should reach the form rather than be told nothing.
  if (path.replace(/\/$/, '') === '/sett-passord') return respond();
```

- [ ] **Step 9: The proxy tests**

Add to `src/proxy.test.ts`, alongside the four drain exclusion tests (copy their shape exactly — read them first):

```typescript
  it('lets an unauthenticated GET /sett-passord through instead of 307ing it', async () => {
    const response = await proxy(request('/sett-passord?t=abc', { user: null }));
    expect(response.status).not.toBe(307);
  });

  it('tolerates the trailing slash', async () => {
    const response = await proxy(request('/sett-passord/', { user: null }));
    expect(response.status).not.toBe(307);
  });

  it('★ does not exempt a neighbouring path — the exclusion is exact, not a prefix', async () => {
    const response = await proxy(request('/sett-passord-noe', { user: null }));
    expect(response.status).toBe(307);
  });

  it('lets a signed-in user reach it rather than bouncing to «/»', async () => {
    const response = await proxy(request('/sett-passord?t=abc', { user: { id: 'u1' } }));
    expect(response.status).not.toBe(307);
  });
```

⚠ `request()` here stands for whatever helper the existing drain tests use. **Read `src/proxy.test.ts` and reuse it verbatim** — do not introduce a second harness.

- [ ] **Step 10: The static wall**

`setPasswordAction` calls no authorization guard, because there is no session to authorize. That is legitimate and must be **declared**, not silently tolerated.

In `src/app/action-guards.test.ts`, add to `PRE_AUTH`:

```typescript
  'src/app/sett-passord/actions.ts :: setPasswordAction':
    'redeems a single-use invite for a visitor who has no session; throttled by ip instead',
```

and to `PRE_AUTH_REQUIRES`:

```typescript
  'src/app/sett-passord/actions.ts :: setPasswordAction': 'consumeInviteAttempt(',
```

and bump the counter:

```typescript
    expect(allActions.length).toBe(84);
```

⚠ `PRE_AUTH_REQUIRES` asserts against the **action body**, not against the allowlist's own string — that is deliberate, and it is what makes the exemption a condition rather than a blank cheque. Do not "simplify" it back to comparing the literal declared in that file.

- [ ] **Step 11: Run everything and commit**

```bash
cd ~/dev/iqra-portal && npm test && npm run typecheck && npm run lint && npm run knip && npm run build
```

Expected: unit up by the count from Steps 2 and 9 — **record what actually runs**. `action-guards` reports **84** actions. Build lists `/sett-passord`.

```bash
git add src/app/sett-passord src/lib/admin/rate-limit.ts src/proxy.ts src/proxy.test.ts \
  src/app/action-guards.test.ts src/app/logg-inn/page.tsx
git commit -m "feat(invitasjon): /sett-passord, the app's second unauthenticated surface

Validate BEFORE redeeming. Redeeming first makes a mistyped confirmation field
consume a single-use invitation, and the family's only recourse is to phone the
school — the most likely way to ship a flow that passes testing and fails for
real people.

A GoTrue failure after redemption restores the token, so a 5xx during an
incident does not permanently kill a live invitation.

12-character minimum, not the 6 in config.toml — that block governs the local
stack only and is never pushed to the cloud.

No session is minted here; the user goes through the real login path.

action-guards 83 -> 84, with the exemption declared and conditioned on
consumeInviteAttempt."
```

---

## Task 15e: `/admin/kontoer` — the work queue

**Files:**
- Create: `src/lib/admin/invites.ts`, `src/lib/admin/invites.test.ts`
- Create: `src/app/(portal)/admin/kontoer/page.tsx`, `InviteCard.tsx`, `actions.ts`
- Modify: `src/app/(portal)/admin/AdminNav.tsx` + `AdminNav.test.tsx`, `src/app/action-guards.test.ts`

- [ ] **Step 1: The quarantined reads and writes**

Create `src/lib/admin/invites.ts`:

```typescript
import 'server-only';
import { generateInviteToken, inviteUrl, issueInvite, validDaysUntil } from '@/lib/auth/invite';
import { buildInviteEmail } from '@/lib/varsler/invite-email';
import { sendViaResend } from '@/lib/varsler/resend';
import type { SendPing } from '@/lib/varsler/resend';
import { createServiceRoleClient, requireAdminActor } from './quarantine';

export interface PendingAccount {
  userId: string;
  fullName: string;
  email: string;
  roles: string[];
  isStudent: boolean;
  invitedAt: string | null;
  expiresAt: string | null;
  delivery: string | null;
}

/** Every account that cannot log in yet. Admin-only, via the quarantine. */
export async function listPendingAccounts(): Promise<PendingAccount[]> {
  await requireAdminActor();
  const service = createServiceRoleClient();
  const { data, error } = await service.rpc('invite_pending_accounts');
  if (error) throw new Error(`Kunne ikke hente kontoer: ${error.message}`);
  return (data ?? []).map((row) => ({
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    roles: row.roles ?? [],
    isStudent: row.is_student,
    invitedAt: row.invite_issued_at,
    expiresAt: row.invite_expires_at,
    delivery: row.invite_delivery,
  }));
}

/**
 * Mails an invite. ⛔ Refuses a pupil BEFORE composing anything — D29's real
 * wall is in SQL (invite_issue raises 42501), and this is the second one, so
 * the failure is a clear message rather than a database error surfacing in a
 * form. Both exist on purpose: the SQL one cannot be forgotten, this one
 * cannot be confusing.
 *
 * `send` is injected for the same reason plan 3 injected it (D28): there is no
 * Resend account yet, and a test must not depend on one.
 */
export async function sendInviteEmail(
  userId: string,
  send: SendPing = sendViaResend,
): Promise<{ sent: boolean; reason?: string }> {
  const actorId = await requireAdminActor();
  const pending = await listPendingAccountsOrAll(userId);
  if (!pending) return { sent: false, reason: 'Kontoen finnes ikke.' };
  if (pending.isStudent) {
    return {
      sent: false,
      reason: 'En elev skal aldri få invitasjon på e-post — bruk engangslenken.',
    };
  }

  const token = generateInviteToken();
  const { expiresAt } = await issueInvite({
    userId,
    token,
    delivery: 'epost',
    issuedBy: actorId,
  });
  const mail = buildInviteEmail({
    inviteUrl: inviteUrl(token),
    validDays: validDaysUntil(expiresAt),
  });
  const result = await send(pending.email, mail);
  if (!result.ok) {
    // ⚠ The token stays issued. It is valid and the admin can hand it over by
    // other means or retry the send; revoking it here would turn a provider
    // hiccup into a second problem.
    return { sent: false, reason: `E-posten gikk ikke ut (${result.errorCode}).` };
  }
  return { sent: true };
}

/**
 * D29's path for a pupil: one on-screen link, returned ONCE and never stored.
 * Issuing again replaces it, which is why re-clicking is safe — the previous
 * link dies at that instant.
 */
export async function revealInviteLink(userId: string): Promise<string> {
  const actorId = await requireAdminActor();
  const token = generateInviteToken();
  await issueInvite({ userId, token, delivery: 'skjerm', issuedBy: actorId });
  return inviteUrl(token);
}

async function listPendingAccountsOrAll(userId: string): Promise<PendingAccount | null> {
  const all = await listPendingAccounts();
  return all.find((a) => a.userId === userId) ?? null;
}
```

⚠ `listPendingAccountsOrAll` re-reads the whole queue to resolve one account. At IQRA's scale (a few hundred rows, and shrinking as accounts activate) that is the right trade against a second RPC — but say so in the commit rather than leaving it to look like an oversight. If the queue ever exceeds ~1000 rows, add a single-row RPC.

- [ ] **Step 2: The test**

Create `src/lib/admin/invites.test.ts`. Assert the three things that are decisions rather than plumbing:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const rpc = vi.fn();
const requireAdminActor = vi.fn();
const issueInvite = vi.fn();

vi.mock('./quarantine', () => ({
  requireAdminActor,
  createServiceRoleClient: () => ({ rpc }),
}));
vi.mock('@/lib/auth/invite', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/invite')>('@/lib/auth/invite');
  return { ...actual, issueInvite };
});

const { sendInviteEmail, revealInviteLink } = await import('./invites');

const PUPIL = {
  user_id: 'p1', full_name: 'C2 Elev', email: 'elev@test.no', roles: ['student'],
  is_student: true, invite_issued_at: null, invite_expires_at: null, invite_delivery: null,
};
const GUARDIAN = { ...PUPIL, user_id: 'g1', email: 'forelder@test.no', is_student: false };

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminActor.mockResolvedValue('admin-1');
  issueInvite.mockResolvedValue({ expiresAt: new Date(Date.now() + 7 * 86_400_000) });
});

describe('sendInviteEmail', () => {
  it('★ refuses a pupil before composing or issuing anything (D29)', async () => {
    rpc.mockResolvedValue({ data: [PUPIL], error: null });
    const send = vi.fn();
    const result = await sendInviteEmail('p1', send);
    expect(result.sent).toBe(false);
    expect(issueInvite).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('★ mails a guardian — so the refusal above is about the pupil, not the call', async () => {
    rpc.mockResolvedValue({ data: [GUARDIAN], error: null });
    const send = vi.fn().mockResolvedValue({ ok: true });
    const result = await sendInviteEmail('g1', send);
    expect(result.sent).toBe(true);
    expect(send).toHaveBeenCalledWith('forelder@test.no', expect.objectContaining({
      subject: 'Aktiver innloggingen din i IQRA skoleportal',
    }));
  });

  it('keeps the token issued when the provider fails', async () => {
    rpc.mockResolvedValue({ data: [GUARDIAN], error: null });
    const send = vi.fn().mockResolvedValue({ ok: false, errorCode: '429', retryable: true });
    const result = await sendInviteEmail('g1', send);
    expect(result.sent).toBe(false);
    expect(issueInvite).toHaveBeenCalledOnce();
  });
});

describe('revealInviteLink', () => {
  it('issues a skjerm-delivery link and returns it once', async () => {
    const url = await revealInviteLink('p1');
    expect(issueInvite).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'p1', delivery: 'skjerm', issuedBy: 'admin-1' }),
    );
    expect(url).toMatch(/^https:\/\/portal\.iqrasenter\.no\/sett-passord\?t=[A-Za-z0-9_-]{43}$/);
  });
});
```

- [ ] **Step 3: The actions**

Create `src/app/(portal)/admin/kontoer/actions.ts`:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { requireStaffRole } from '@/lib/dal/session';
import { revealInviteLink, sendInviteEmail } from '@/lib/admin/invites';

export interface InviteState {
  error: string | null;
  sent?: boolean;
  /** Rendered ONCE, never stored. Absent on every other outcome. */
  link?: string;
}

export async function sendInviteAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  await requireStaffRole('admin');
  const userId = String(formData.get('userId') ?? '');
  if (!userId) return { error: 'Mangler konto.' };
  const result = await sendInviteEmail(userId);
  revalidatePath('/admin/kontoer');
  return result.sent ? { error: null, sent: true } : { error: result.reason ?? 'Ukjent feil.' };
}

export async function revealInviteLinkAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  await requireStaffRole('admin');
  const userId = String(formData.get('userId') ?? '');
  if (!userId) return { error: 'Mangler konto.' };
  const link = await revealInviteLink(userId);
  revalidatePath('/admin/kontoer');
  return { error: null, link };
}
```

⚠ Confirm `requireStaffRole` is exported from `@/lib/dal/session` and is on the `GUARDS` list in `action-guards.test.ts` — it is used this way in `admin/elever/actions.ts:205`. Both actions call it, so neither needs a `PRE_AUTH` entry.

- [ ] **Step 4: The screen**

Create `src/app/(portal)/admin/kontoer/page.tsx` and `InviteCard.tsx`. The page:

- calls `requireStaffRole('admin')`, then `listPendingAccounts()`;
- renders an empty state when the list is empty — «Alle kontoer kan logge inn.» — because a blank screen and a finished queue must not look the same;
- renders one `InviteCard` per account with name, e-mail, roles, and the invite state:
  - no token → «Ikke invitert»
  - token, `expiresAt` in the future → «Invitert <dato>, gyldig til <dato>»
  - token, `expiresAt` past → «Invitasjonen er utløpt»
- for a pupil (`isStudent`), shows **only** «Vis engangslenke» — no e-mail button exists to click, which is D29 expressed in the UI as well as in SQL;
- for everyone else, shows «Send invitasjon på e-post», plus «Vis engangslenke» as the fallback for an account whose address is wrong.

`InviteCard.tsx` is a client component using `useActionState` for both actions. When `state.link` is present it renders the link in a `readOnly` `<input>` with a copy button and this warning:

> Lenken vises bare én gang. Kopier den nå — den kan ikke hentes fram igjen, men du kan lage en ny.

⚠ `formatDateNb` **throws on a `timestamptz`** (measured in plan 1). `invite_issued_at` and `invite_expires_at` are timestamptz. Format them with `new Date(value).toLocaleDateString('nb-NO')` or whatever the repo's existing timestamptz-safe helper is — **grep for how `published_at` is rendered in `admin/oppslag` and copy that**, rather than reaching for the date helper whose name looks right.

- [ ] **Step 5: The nav entry**

Add to `src/app/(portal)/admin/AdminNav.tsx` in the same shape as its neighbours, and update `AdminNav.test.tsx` — read it first; it asserts the full set of entries, so it fails until the new one is added there too.

```typescript
  { href: '/admin/kontoer', label: 'Kontoer' },
```

- [ ] **Step 6: Bump the action counter and run everything**

`src/app/action-guards.test.ts`: `expect(allActions.length).toBe(86);` — two new actions on top of Task 15d's 84.

```bash
cd ~/dev/iqra-portal && npm test && npm run typecheck && npm run lint && npm run knip && npm run build
```

Expected: `action-guards` reports **86**. Build lists `/admin/kontoer`.

⚠ If `knip` now flags `PORTAL_URL`, `InviteDelivery` or `PendingAccount`, the consumer is missing — find it rather than deleting the export.

- [ ] **Step 7: Commit**

```bash
cd ~/dev/iqra-portal && git add "src/app/(portal)/admin/kontoer" \
  "src/app/(portal)/admin/AdminNav.tsx" "src/app/(portal)/admin/AdminNav.test.tsx" \
  src/lib/admin/invites.ts src/lib/admin/invites.test.ts src/app/action-guards.test.ts
git commit -m "feat(invitasjon): /admin/kontoer — who cannot log in yet, and the two ways to fix it

One screen rather than per-record buttons, because there is no staff
provisioning UI at all: a teacher account exists only if someone made it in the
Supabase dashboard, so per-card controls would have left three roles with no
path.

D29 is expressed twice on purpose — in SQL, where it cannot be forgotten, and
in the UI, where a pupil simply has no e-mail button to click.

The one-time link is returned and never stored. Re-issuing replaces it, so
clicking again is safe: the previous link dies at that instant.

Resolving one account re-reads the queue rather than adding a second RPC —
right at a few hundred rows, wrong past a thousand.

action-guards 84 -> 86."
```

---

## Task 16: the full suite, from a clean database

- [ ] **Step 1: Reset, and put the enrolment window back first**

If any browser work happened during Tasks 15d–15e, `class_students.enrolled_on` may still be shifted. The api suite asserts against `'2026-08-20'`.

```bash
cd ~/dev/iqra-portal && git status --short && npx supabase db reset && npm run db:types && git diff --stat src/lib/supabase/database.types.ts
```

Expected: `db:types` produces **no diff** — every migration task already committed its regeneration. A diff here means one did not.

- [ ] **Step 2: Run each gate, in this order, and record the number**

```bash
cd ~/dev/iqra-portal && npx supabase test db
```
Expected: **935 assertions / 40 files.**

```bash
cd ~/dev/iqra-portal && npm test
```
Expected: **636 + the counts recorded in Tasks 15c, 15d and 15e.** Write the measured total into the ledger; do not carry forward a predicted one.

```bash
cd ~/dev/iqra-portal && npm run test:api
```
⚠ **~21 minutes, and silent until it finishes.** Do not interrupt it and do not conclude it has hung.
Expected: **377 / 15 files**, unchanged — this plan adds no api test.

⚠ If it fails with GoTrue session churn (`innlogging … feilet: {}` across many tests), that is not a regression: `docker restart supabase_auth_iqra-portal`, then re-run. Measured at 2.1× on this project.

```bash
cd ~/dev/iqra-portal && npm run typecheck && npm run lint && npm run knip && npm run build && npm audit --omit=dev
```
Expected: tsc 0 · lint 0 errors (5 pre-existing warnings) · knip at baseline (`scripts/fiken-probe.mjs` + 9 unused types) · build lists `/sett-passord` and `/admin/kontoer` · audit gate green against the dated allowlist.

- [ ] **Step 3: Run the unit suite under `TZ=UTC`**

```bash
cd ~/dev/iqra-portal && TZ=UTC npm test
```

Expected: identical count. `validDaysUntil` does arithmetic on epoch milliseconds and the invite e-mail formats no dates at all — this run is what proves that claim rather than asserting it.

- [ ] **Step 4: Record the ladder in the ledger below, then commit if anything changed**

---

## Task 16b: the mutation pass

⛔ **§8's binding rule is *every new assertion*, not only the starred ones.** Anything skipped is named here with its reason; an unstated skip is a coverage claim the suite does not support.

### The three ways this has gone wrong before, all on this project

1. **A mutation that reddens something is not proof the file is covered.** Across plan 3's 22 mutations, **seven predictions named the wrong assertion and two named one that could not fire**. Read the assertion **indices**, not the pass/fail line — and when the assertion that moved is not the one predicted, find out what is actually doing the protecting.
2. **Restoring the FILE is half a restore.** The applied schema stays mutated until `db reset`; the next run then reddens something unrelated and reads as a fresh defect.
3. **`psql -f <host path>` inside `docker exec` resolves IN THE CONTAINER.** Three restores silently no-opped this way and later mutations ran on an already-mutated database, with plausible-looking output throughout.

- [ ] **Step 1: Use this harness for every SQL mutation**

```bash
cd ~/dev/iqra-portal
FN="public.invite_redeem(text)"

# 1. Capture the real definition BEFORE touching it.
docker exec supabase_db_iqra-portal psql -U postgres -d postgres -tAc \
  "select pg_get_functiondef('${FN}'::regprocedure);" > /tmp/before.sql

# 2. Apply the mutation by piping SQL IN — never -f with a host path.
docker exec -i supabase_db_iqra-portal psql -U postgres -d postgres <<'SQL'
create or replace function public.invite_redeem(p_token text) …
SQL

# 3. Run the affected file and READ THE INDICES.
npx supabase test db supabase/tests/39_invite_tokens.sql

# 4. Restore by piping the captured definition back in.
docker exec -i supabase_db_iqra-portal psql -U postgres -d postgres < /tmp/before.sql

# 5. ⛔ VERIFY THE RESTORE — diff, do not assume.
docker exec supabase_db_iqra-portal psql -U postgres -d postgres -tAc \
  "select pg_get_functiondef('${FN}'::regprocedure);" > /tmp/after.sql
diff /tmp/before.sql /tmp/after.sql && echo "✓ restored"
```

If the diff is not empty, **`npx supabase db reset` before the next mutation.** Do not proceed on a database you have not re-verified.

- [ ] **Step 2: Work the table**

| # | Mutation | Expected to redden | Measured |
|---|---|---|---|
| 1 | `invite_token_hash` → `select p_token::bytea` | 39: 1, 2 | |
| 2 | `invite_issue` upsert → `on conflict (user_id) do nothing` | 39: 4, 5 | |
| 3 | `invite_redeem`: drop `and consumed_at is null` | 39: 6 | |
| 4 | `invite_redeem`: drop `and expires_at > now()` | 39: 7 | |
| 5 | ★ `invite_issue`: delete the whole D29 `if` block | 39: 8 (9 and 10 stay green — they are the controls) | |
| 6 | ★ `invite_issue`: `s.student_user_id = target` → `true` (**over-revocation**) | 39: 10 (8 stays green) | |
| 7 | `invite_restore`: drop the `invite_restore_window()` clause | 39: 12 | |
| 8 | `invite_pending_accounts`: drop the `account_activation` `not exists` | 39: 14 | |
| 9 | `invite_pending_accounts`: drop `u.deleted_at is null` | 39: 15 | |
| 10 | `grant execute on function public.invite_redeem(text) to authenticated` | 39: 16 | |
| 11 | `grant select on private.invite_tokens to authenticated` | 39: 17 | |
| 12 | `invite_issue`: delete the `audit_log` insert | 39: 18 | |
| 13 | `invite_issue`: audit `actor_id` → `null` | 39: 19 | |
| 14 | `invite_attempt_limit()` → `100000` | 39: 21 | |
| 15 | fingerprints: stub `invite_redeem` body to `select null::uuid` | 29: 2 | |
| 16 | `buildInviteEmail`: delete the `startsWith(PORTAL_URL…)` guard | invite-email: «refuses a link that is not a set-password link» | |
| 17 | `buildInviteEmail`: interpolate the URL into `subject` | invite-email: «never templates the subject» | |
| 18 | `generateInviteToken`: `base64url` → `hex` | invite: «256 bits, URL-safe» | |
| 19 | `validDaysUntil`: `Math.max(1, …)` → the bare `Math.ceil` | invite: «never returns zero» | |
| 20 | `validDaysUntil`: `Math.ceil` → `Math.floor` | invite: «a day and a half rounds UP» | |
| 21 | ★★ `setPasswordAction`: move `redeemInvite` **above** the zod parse | sett-passord: both «does NOT redeem» tests | |
| 22 | ★ `setPasswordAction`: delete `await restoreInvite(...)` | sett-passord: «gives the token back» | |
| 23 | `setPasswordAction`: move `markActivated` before `updateUserById` | sett-passord: «only AFTER GoTrue accepted» | |
| 24 | `setPasswordAction`: delete the `consumeInviteAttempt` call | sett-passord: «over budget»; **and** action-guards `PRE_AUTH_REQUIRES` | |
| 25 | `proxy.ts`: `=== '/sett-passord'` → `.startsWith('/sett-passord')` | proxy: «exact, not a prefix» | |
| 26 | `proxy.ts`: move the `/sett-passord` exclusion **below** `if (!user)` | proxy: the unauthenticated GET test | |
| 27 | ★ `sendInviteEmail`: delete the `pending.isStudent` branch | invites: «refuses a pupil» (the guardian test stays green) | |

⚠ **Mutation 24 is expected to redden in two suites.** If only one moves, the other assertion is weaker than it looks — investigate before writing it off.

⚠ **Mutations 5 and 6 are a pair and both are required.** Deleting the D29 block reddens only the refusal; the guardian and pupil-on-screen controls stay green *by construction*. Only the over-revocation mutation can redden assertion 10. One mutation here would leave two of the three D29 assertions never watched fail — precisely the shape that let plan 3's leaking builder look covered.

- [ ] **Step 3: Fill in the «Measured» column for every row**

For each: the assertion indices that **actually** went red, and — where they differ from the prediction — one line on what is really doing the protecting. A blank cell is an incomplete task.

- [ ] **Step 4: `db reset` and re-run the full pgTAP suite**

```bash
cd ~/dev/iqra-portal && npx supabase db reset && npx supabase test db
```

Expected: **935 / 40**, back to green. Anything else means a mutation survived the restore.

---

## Task 16c: `web-design-guidelines` audit

- [ ] **Step 1: Run the skill over the three new surfaces**

`/sett-passord`, `/admin/kontoer`, and the login page's new banner.

- [ ] **Step 2: Check the things this plan already knows are hazards**

- **Tokens that do not exist in this repo.** Plan 3 shipped a bell styled `text-muted-foreground` — shadcn vocabulary with zero usages under `src/` and no definition in `globals.css`. It compiled to nothing. Grep every class name used in the new components against `src/app/globals.css` and existing usage before accepting them.
- **The focus ring.** Both new interactive surfaces are keyboard-reachable paths for people who may be using a phone in a hurry. Match the repo's existing ring, do not invent one.
- **`role="alert"` on the error, `role="status"` on the banner** — already in the code above; confirm the audit agrees they are the right roles and that the error is announced, not merely coloured.
- **The one-time link must not be announced as permanent.** The warning text is load-bearing copy, not decoration.
- **375 px and 1280 px.** `/admin/kontoer` is a list with actions per row — the shape most likely to overflow on a phone.

- [ ] **Step 3: Fix what it finds, then re-run `npm run lint && npm run build`**

---

## Task 16d: the human walkthrough — all five roles

⛔ **This task needs the user.** Synthetic clicks do not fire this app's React handlers, and staff routes sit behind AAL2 whose enrolment every `db reset` wipes.

- [ ] **Step 1: Prepare**

1. `npx supabase db reset`
2. **Re-enrol MFA at `/mfa/registrer`** (the user, in a browser).
3. Open the enrolment window:
   ```sql
   update public.class_students set enrolled_on = current_date - 7
    where class_id = 'fc000000-0000-0000-0000-000000000001';
   ```
4. If logins start failing with `innlogging … feilet: {}`: `docker restart supabase_auth_iqra-portal`.

- [ ] **Step 2: The invite flow itself — the reason this plan exists**

| # | As | Do | Expect |
|---|---|---|---|
| 1 | admin | Open `/admin/kontoer` | The provisioned guardian and pupil are listed as «Ikke invitert». Seeded logins are **absent** — they are activated by seed. |
| 2 | admin | «Send invitasjon på e-post» on the **guardian** | Success; the row now shows «Invitert <i dag>, gyldig til <+7 dager>». |
| 3 | — | Open the delivered e-mail | ⛔ **Against a real message, not the template:** no name, no child, no class, no address in the body. **Links are NOT rewritten through a tracking domain and there is no open pixel.** This is the check `invite-email.test.ts` structurally cannot make. |
| 4 | guardian | Follow the link, set a password | Redirected to `/logg-inn` with the «Passordet er lagret» banner. |
| 5 | guardian | Log in | ★ **A parent logs into this portal for the first time.** Their children's threads and oppslag are there. |
| 6 | — | Follow the **same** link again | «Lenken er ugyldig eller utløpt.» Single-use, proved by hand. |
| 7 | admin | `/admin/kontoer` | The guardian is gone from the queue. |
| 8 | admin | On the **pupil**, confirm there is **no e-mail button**, then «Vis engangslenke» | The link renders once, with the warning that it cannot be retrieved again. |
| 9 | pupil | Follow it, set a password, log in | ★ **A pupil logs in.** D29 held: no e-mail was ever sent to them. |
| 10 | admin | «Send invitasjon på nytt» for an already-activated guardian, then use the **old** link | The old link is dead; the new one works. This is D30's reset path, exercised. |

- [ ] **Step 3: The three plan-3 leftovers nobody has clicked**

| # | As | Do | Expect |
|---|---|---|---|
| 11 | teacher | Send a message to a family | The parent's bell shows it; **the teacher's own does not**. |
| 12 | teacher | Send ten messages in one thread | **One** bell entry, not ten (asserted in pgTAP, never clicked). |
| 13 | admin | Open **`/admin/varsler`** | ⛔ **Built, builds clean, NOBODY HAS EVER LOOKED AT IT.** Read the numbers and judge whether they mean anything. |

- [ ] **Step 4: The two things that have no local symptom**

- [ ] After the first deploy, read the **first real Vercel Cron invocation's status** off the log. A permanent 401 from a scheme-casing mismatch is invisible locally.
- [ ] Confirm Vercel accepted the **15-minute** interval in `vercel.json` rather than silently coercing it.
- [ ] `CRON_SECRET` and `RESEND_API_KEY` are set in Vercel for Production **and** Preview.
- [ ] Resend **log retention is at minimum** — an invite link in a provider log is a live credential.

- [ ] **Step 5: Record the outcome, then finish the branch**

Once every row above is green, Phase 5 is complete. Use `superpowers:finishing-a-development-branch` to decide how `feat/phase-5-meldinger` is integrated.

---

## Execution ledger

Filled in **during** execution, not after. One row per task: the measured counts, every deviation from this plan, and — for Task 16b — the assertion indices that actually reddened.

| Task | Commit | pgTAP | unit | api | Notes / deviations |
|---|---|---|---|---|---|
| 14 | | 913 | 636 | 377 | |
| 15a | | 932 | 636 | 377 | |
| 15b | | 935 | 636 | 377 | |
| 15c | | 935 | | 377 | |
| 15d | | 935 | | 377 | |
| 15e | | 935 | | 377 | |
| 16 | | | | | |
| 16b | | | | | |
| 16c | | | | | |
| 16d | | | | | |

### Review ledger

Filled in by the review pass **before** execution: what the review changed, and what it left alone with a reason.

---

## Self-review of this plan

Run against the spec with fresh eyes after writing.

**Spec coverage.** §11 task 14 → Task 14 (and it undercounted by two: D6 and §9:203 assert the same retired bucket). Task 15 → 15a + 15b + 15d. Task 15b → 15c + 15e. Task 16 → Task 16. 16b → 16b. 16c → 16c. 16d → 16d. §10.4's "three of five roles cannot log in" is what Tasks 15a–15e close; **it was an undercount too** — staff have no creation path in the app at all, which is why D31 chose one screen over per-card buttons.

**Placeholders.** None: every step carries the actual SQL, TypeScript or command. The two places that deliberately do *not* pin a value are the unit-test totals in Tasks 15c–15e and the «Measured» column in 16b, and both say explicitly that the number is to be **measured, not predicted** — which is the lesson from plan 3's ledger, where seven of twenty-two predictions named the wrong assertion.

**Type consistency.** `InviteDelivery` (`'epost' | 'skjerm'`) is the same in SQL's `check` constraint, `invite.ts` and `invites.ts`. `SetPasswordState` / `InviteState` are each declared once and imported. `issueInvite` returns `{ expiresAt: Date }` and `validDaysUntil` consumes exactly that. `PendingAccount` is camelCase in TypeScript and snake_case at the RPC boundary, mapped in one place.

**Three defects found and fixed during this review**, all in Task 15a:
1. The pgTAP fixture inserted into `auth.users` with four columns; the house shape (files 35/37/38) needs `instance_id`, `raw_app_meta_data`, `raw_user_meta_data` and puts `full_name` in the metadata, because `private.handle_new_user` creates the profile on insert.
2. `public.students` has **`birth_year smallint`**, not `birth_date` — checked against the live table.
3. Assertion 18 claimed **2** audited pupil issues. It is **1**: the refused `epost` attempt raises before the audit insert.

**And one design defect:** the RPCs originally took `bytea` and hashed in TypeScript. Passing a bytea through PostgREST needs hex encoding, and getting it wrong yields an invite flow where every link is silently invalid. Changed to hash in SQL, following `private.login_email_hash`.
