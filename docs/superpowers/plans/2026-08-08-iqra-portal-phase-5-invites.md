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
| pgTAP, one file | `npx supabase test db supabase/tests/40_invite_tokens.sql` — **positional, there is no `--file` flag** |
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

pgTAP **913 / 39 files** · unit **636 / 57** · api **377 / 15** ·
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
| **D29** | **A pupil is never mailed an invite.** Guardians and staff receive an e-mail; for a pupil the admin is shown the link **once, on screen**, and hands it over in person or via the guardian. | Keeps plan 3's «pupils are never mailed» rule **absolute** rather than carved-out. ⚠ An earlier draft justified it as «the school never needs a working address for a 13-year-old» — **that is false**: `provisionStudentLoginAction` requires one and `LoginCard.tsx:128` renders it `required`. The school already collects the address; D29 stops it being **used**. The real reason is plan 3's, recorded at `20260807123000:1289` — a pupil's address in a mail path puts it into **Resend's US-held logs**. Cost: one extra admin surface, and a link that exists only in one browser render — if the admin loses it they must re-issue. |
| **D30** | **There is no self-serve password reset.** Re-issuing an invite is the reset, and only an admin can do it. | The portal has *no* reset today, so this closes a real dead end with no new unauthenticated surface and no account-enumeration oracle. Cost, and it is real: a parent who forgets their password must phone the school — so **`/logg-inn` gains the line that makes that payable** («Glemt passordet? Ring skolen på +47 998 64 331 — vi sender deg en ny aktiveringslenke.»). Without it the recovery instruction exists only inside this document. ⚠ **For staff this resets the password only**: a lost second factor still needs the Supabase dashboard, and Phase 5 adds no in-app MFA recovery. ⚠ **The admin is subject to D30 too** — if the only admin loses their password, nobody can re-invite anyone, including themselves; the recovery is the dashboard. ⛔ **And an admin can mint a live credential for ANY account, including another admin's or økonomi's.** For an *activated* staff account the attacker still faces AAL2; for a **never-activated** one — which is exactly what `/admin/kontoer` lists — `mfaGate` returns `enroll` and they enrol their own factor. Accepted because IQRA's one or two admins already hold the service-role blast radius, but it is stated here rather than left implicit. Revisit the phoning burden if it proves untenable — the lever is a `/glemt-passord` page on this same token machinery, not a second mechanism. |
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
| `supabase/migrations/20260808120000_invite_tokens.sql` | `private.invite_tokens`, `private.account_activation`, **seven** public RPCs (issue · redeem · restore · mark_activated · revoke · pending_accounts · find_account), three `private` helpers, TTL tunables, grants |
| `supabase/migrations/20260808121000_invite_rate_limit.sql` | `private.invite_attempts`, `public.invite_attempt_consume`, `invite_attempts_prune`, `invite_attempts_clear` |
| `supabase/migrations/20260808111000_guardian_suppression.sql` | **Task 14b / D32** — `guardian_student.suppressed`, the `is_guardian_of` clause, `public.guardian_set_suppressed` |
| `supabase/tests/39_guardian_suppression.sql` | pgTAP for D32 (8 assertions) |
| `src/lib/admin/guardians.ts` + `.test.ts` | `setGuardianSuppressed` — quarantine **category B** |
| `supabase/migrations/20260808110000_assignment_storage_comment.sql` | Task 14's `comment on` correction — the applied migration is never edited |
| `supabase/tests/40_invite_tokens.sql` | pgTAP for both migrations |
| `src/lib/auth/invite.ts` | PURE helpers only — token generation, the URL, the day arithmetic. **No service-role import** (quarantine; see 15c step 9) |
| `src/lib/admin/invite-tokens.ts` | The service-role wrappers — quarantine **category B**, beside `rate-limit.ts` |
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
| `src/app/action-guards.test.ts` | Counter **83 → 87** across the plan (14b→84, 15d→85, 15e→87); one `PRE_AUTH` + one `PRE_AUTH_REQUIRES` entry |
| `supabase/tests/29_definer_fingerprints.sql` | Task 14b's entry (+1) and Task 15b's five (+10, H2 and M7 included); marker literal 95 → 96 → 106, **counted, not predicted** |
| `src/app/(portal)/admin/AdminNav.tsx` + `.test.tsx` | Nav entry — ⚠ the test does **not** assert the entry set; add the assertion (Task 15e Step 5) |
| `src/app/(portal)/admin/elever/GuardianCard.tsx` + `actions.ts` | **Task 14b / D32** — the «Sperret innsyn» control and its action |
| `src/app/api/varsler/drain/route.ts` | Uses the extracted `PORTAL_URL` |
| `src/lib/admin/users.ts:19-24` | The doc comment naming Brevo and a flow that now exists |
| `docs/spec.md`, `README.md`, Phase-4 design spec | Task 14 reconciliation |

---

## Task 14: Document reconciliation

Done first because it is the cheapest task and it removes stale facts the rest of the plan reads.

**Files:**
- Modify: `docs/spec.md:20`, `:109`, `:110`, `:149`, `:208` (portal repo)
- Modify: `README.md:119-124`, `:145-147` (portal repo)
- Modify: `docs/superpowers/specs/2026-07-27-iqra-portal-phase-4-oppgaver-design.md:17`, `:18`, `:203` (**Desktop/iqra** repo)
- Modify: `src/lib/admin/users.ts:19-24`
- Create: `supabase/migrations/20260808110000_assignment_storage_comment.sql`

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

`README.md:119-124` currently reads:

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

Create `supabase/migrations/20260808110000_assignment_storage_comment.sql`:

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

`src/lib/admin/users.ts:19-24` currently reads:

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
  supabase/migrations/20260808110000_assignment_storage_comment.sql \
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
---

## Task 14b: D32 — the guardian suppression flag

**Files:**
- Create: `supabase/migrations/20260808111000_guardian_suppression.sql`
- Create: `supabase/tests/39_guardian_suppression.sql`
- Create: `src/lib/admin/guardians.ts`, `src/lib/admin/guardians.test.ts`
- Modify: `src/app/(portal)/admin/elever/GuardianCard.tsx`, `src/app/(portal)/admin/elever/actions.ts`
- Modify: `supabase/tests/29_definer_fingerprints.sql`

### Why this is in this plan and not a later one

Spec **§10.7**, recorded by the 2026-08-04 review and never acted on:

> There is no custody or protection concept between guardians. `is_guardian_of` is a bare `exists` over `guardian_student` with no status, date or exclusion column, so **every registered guardian is an unconditional, permanent, unrevokable reader of every message about that child** … In a shared-custody family, or one where a parent holds adressesperre against the other, this is the most dangerous property of the system. §4.2 now **discloses** it; nothing yet **fixes** it. **Decide before pilot whether a suppression flag is owed.**

Until this plan it was latent: no guardian held credentials, so no guardian could actually read anything. **This is the plan that hands out the logins**, so §10.7's "decide before pilot" moment is this one. The user ruled on 2026-08-06 that the flag ships here (**D32**).

⚠ §10.7 says the property is "structural rather than patchable by a later policy" because D1+D2 derive participation rather than storing it. That is true of the *participant list* and **not** of the predicate: `private.is_guardian_of` is one `SECURITY DEFINER` function used **35 times across 17 migrations** — attendance, grades, progress, submissions, tests, absence notices, threads, announcements. Suppression therefore lands in exactly one place and takes effect across every surface at once. That property is the whole reason this is affordable now.

### The shape, and two deliberate omissions

- **Per (guardian, student) pair, not per person.** The column lives on `guardian_student`, whose PK is exactly that pair. A parent suppressed for one child keeps full access to their other children — which is the actual shape of a shared-custody or adressesperre situation, and a per-person flag would be wrong.
- **No `suppressed_reason` column.** The reason is a court order or a police-issued adressesperre — a legal document in the school's own file. Duplicating it into the database creates a second copy of the most sensitive fact about a family, inside a table every admin can read, subject to §10.8's rotation problem. `suppressed_at` records **when**; the school's paperwork records **why**. State this in the migration or someone will add the column as an obvious improvement.
- **The write goes through a definer RPC, not an UPDATE policy.** `guardian_student` today has admin-only INSERT and DELETE policies and deliberately **no UPDATE policy at all**. Adding one to carry a single column would widen the table's write surface; the RPC keeps it shut and gets the audit row for free.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260808111000_guardian_suppression.sql`:

```sql
-- D32 — guardian suppression (spec §10.7's "decide before pilot", decided
-- 2026-08-06 as part of the invite flow).
--
-- ── What this fixes ─────────────────────────────────────────────────
-- private.is_guardian_of was a bare exists() over guardian_student, so every
-- registered guardian was an unconditional, permanent, UNREVOKABLE reader of
-- everything about a child: messages, attendance, grades, progress, hand-ins.
-- The only way to remove one was to delete the link row, which also removes
-- them from the child's record entirely — so the school's real choice was
-- "full access" or "pretend they are not a parent". In a shared-custody family,
-- or one where one parent holds adressesperre against the other, neither is a
-- usable answer.
--
-- ── Why one column is enough ────────────────────────────────────────
-- §10.7 calls the property "structural rather than patchable by a later
-- policy", and that is right about the PARTICIPANT LIST (D1+D2 derive it) but
-- not about the PREDICATE. private.is_guardian_of is one SECURITY DEFINER
-- function, referenced 35 times across 17 migrations. Changing it here
-- suppresses a guardian on every surface simultaneously, and no policy
-- anywhere needs editing.
--
-- ── Per PAIR, never per person ──────────────────────────────────────
-- The column is on guardian_student, whose primary key is (guardian_id,
-- student_id). A parent suppressed for one child keeps full access to their
-- other children. A per-person flag would punish siblings for a court order
-- that names one of them.
--
-- ⛔ THERE IS DELIBERATELY NO `suppressed_reason`. The reason is a court order
-- or a police adressesperre — a legal document that lives in the school's own
-- file. Copying it into a table every admin can read creates a second, worse
-- copy of the most sensitive fact about a family, in a database whose audit
-- rotation (§10.8) is not built. suppressed_at records WHEN; the paperwork
-- records WHY. Do not add the column.

alter table public.guardian_student
  add column suppressed    boolean not null default false,
  add column suppressed_at timestamptz;

comment on column public.guardian_student.suppressed is
  'D32 (spec §10.7). When true this guardian reads NOTHING about this child on any surface — private.is_guardian_of returns false for the pair. Per (guardian, student), so the guardian keeps access to their other children. Written only by public.guardian_set_suppressed. See the migration header on why there is no reason column.';

-- Suppression is rare and the flag is false for almost every row, so a partial
-- index keeps the common lookup on the PK path untouched.
create index guardian_student_suppressed_idx
  on public.guardian_student (student_id) where suppressed;

-- ── The predicate, now the only place suppression is expressed ──────
create or replace function private.is_guardian_of(uid uuid, sid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.guardian_student
    where guardian_id = uid and student_id = sid
      -- ⛔ D32. Dropping this one clause silently restores a suppressed
      -- parent's access to every message, mark and absence about a child a
      -- court has kept them away from. It is pinned in
      -- 29_definer_fingerprints.sql for exactly that reason.
      and not suppressed
  );
$$;

-- ── The write path ──────────────────────────────────────────────────
-- A definer RPC rather than an UPDATE policy: guardian_student has admin-only
-- INSERT and DELETE policies and NO update policy at all, and adding one to
-- carry a single column would widen the table's write surface permanently.
-- This also makes the audit row unforgettable.
create function public.guardian_set_suppressed(
  p_guardian   uuid,
  p_student    uuid,
  p_suppressed boolean,
  p_actor      uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hit integer;
begin
  update public.guardian_student
     set suppressed    = p_suppressed,
         suppressed_at = case when p_suppressed then now() else null end
   where guardian_id = p_guardian and student_id = p_student;

  get diagnostics v_hit = row_count;
  if v_hit = 0 then
    raise exception 'ingen slik foresatt-kobling' using errcode = '42501';
  end if;

  -- ⛔ Direct insert, explicit actor — private.audit() rejects the `admin.`
  -- namespace outright and reads its actor from auth.uid(), which is null
  -- under service_role. Same reasoning as invite_issue.
  --
  -- ⚠ meta carries the pair and the direction, and NOTHING ELSE. §10.8 asks
  -- for minimisation here specifically, and a free-text reason in an
  -- unrotatable log is the single worst field this table could gain.
  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values (p_actor,
          case when p_suppressed then 'admin.guardian.suppressed'
                                 else 'admin.guardian.unsuppressed' end,
          'guardian_student', p_student::text,
          jsonb_build_object('guardian_id', p_guardian));
end;
$$;
comment on function public.guardian_set_suppressed(uuid, uuid, boolean, uuid) is
  'Sets or clears D32 suppression for one (guardian, student) pair and audits it. service_role only. p_actor MUST come from requireAdminActor() — it is written verbatim to audit_log.actor_id.';

revoke execute on function public.guardian_set_suppressed(uuid, uuid, boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.guardian_set_suppressed(uuid, uuid, boolean, uuid)
  to service_role;
```

- [ ] **Step 2: Apply and regenerate types**

```bash
cd ~/dev/iqra-portal && npx supabase db reset && npm run db:types
```

⚠ **Watch the existing suite here, not just the migration.** This changes a predicate 35 call sites depend on. Run the full pgTAP suite immediately:

```bash
cd ~/dev/iqra-portal && npx supabase test db
```

Expected: **913 / 39**, unchanged — every existing fixture has `suppressed = false` by default, so no existing assertion should move. **If anything reddens, stop.** It means either a fixture depended on the old shape or the `create or replace` dropped something; do not proceed until the baseline is back.

- [ ] **Step 3: Write the pgTAP file**

Create `supabase/tests/39_guardian_suppression.sql` with `select plan(8);` and the `c3` fixture prefix (⚠ **verify `c3` is free first**: `grep -rn "c3000000-" supabase/tests/ supabase/seed.sql` must return nothing).

Build: two guardians (`c3…001` suppressed, `c3…002` not) both linked to pupil `c3…0a1`; guardian `c3…001` **also** linked to a second pupil `c3…0a2` and **not** suppressed there; one thread on each pupil; one attendance row and one class announcement for `c3…0a1`.

The eight assertions, in pairs so no refusal stands alone:

1. ★ the suppressed guardian reads **0** rows of the child's thread
2. ★ **the same guardian reads their OTHER child's thread** — proves suppression is per-pair, not a broken session
3. ★ **the co-guardian reads the SAME thread** — proves it is the suppression, not the thread
4. the suppressed guardian reads **0** attendance rows for that child — a second surface, proving the one predicate reaches everywhere
5. …and **0** announcements for that child's class
6. un-suppressing restores the thread read (same actor, same row, opposite outcome)
7. `guardian_set_suppressed` writes exactly one `admin.guardian.suppressed` row naming the actor
8. `guardian_set_suppressed` is executable by neither `anon` nor `authenticated`, and **is** by `service_role` (one `has_function_privilege` assertion carrying both the negative and the positive control)

⚠ Assertions 2 and 3 are what make 1 mean anything. A lone "returns 0 rows" passes when the fixture is wrong, the session is missing, or the thread does not exist — the shape that let four Phase-4 assertions survive `select true`.

- [ ] **Step 4: Pin the clause**

`private.is_guardian_of` is **already** in `29_definer_fingerprints.sql` as a *marker on other functions* (8 sites), but it has no entry of its own. Add one:

```sql
    ,
    -- Stubbed or with the clause dropped, a parent a court has kept away from
    -- a child silently regains every message, mark and absence about them —
    -- across all 35 call sites at once, which is also what makes the single
    -- clause worth pinning.
    (
      'private.is_guardian_of(uuid,uuid)',
      array[
        'not suppressed'
      ]
    )
```

**+1 marker: 95 → 96.** Recount the total from the arrays at execution rather than trusting that number — this task and Task 15b both touch the literal (15b then takes it 96 → 106), and the file's own header records it being got wrong twice already.

- [ ] **Step 5: The admin control**

Create `src/lib/admin/guardians.ts` — quarantine **category B**, documented as such:

```typescript
import 'server-only';
import { createServiceRoleClient, requireAdminActor } from './quarantine';

/**
 * D32 suppression (spec §10.7). Sets or clears the flag for ONE
 * (guardian, student) pair.
 *
 * ⛔ The actor comes from requireAdminActor(), never from a form field — it is
 * written verbatim to audit_log.actor_id, and this is the audit trail for a
 * decision that follows a court order.
 */
export async function setGuardianSuppressed(input: {
  guardianId: string;
  studentId: string;
  suppressed: boolean;
}): Promise<void> {
  const actorId = await requireAdminActor();
  const service = createServiceRoleClient();
  const { error } = await service.rpc('guardian_set_suppressed', {
    p_guardian: input.guardianId,
    p_student: input.studentId,
    p_suppressed: input.suppressed,
    p_actor: actorId,
  });
  if (error) throw new Error(`Kunne ikke endre tilgangen: ${error.message}`);
}
```

Add `setGuardianSuppressedAction` to `src/app/(portal)/admin/elever/actions.ts` (it calls `requireStaffRole('admin')`, so it needs no `PRE_AUTH` entry) and a control on `GuardianCard.tsx` behind a confirm step — reuse `useConfirmFocus`, which that directory already imports for the unlink flow.

The copy has to be usable by an office volunteer, so it says what happens rather than naming the flag:

> **Sperret innsyn** — denne foresatte ser ingenting om dette barnet: ingen meldinger, fravær, karakterer eller innleveringer. Tilgangen til eventuelle søsken påvirkes ikke. Brukes ved adressesperre eller pålegg fra retten. Skolen oppbevarer dokumentasjonen selv — ikke skriv begrunnelsen inn her.

⚠ **The action counter moves.** `expect(allActions.length).toBe(83)` → **84** here, and Tasks 15d and 15e then take it to 85 and 87. Update the numbers in those tasks too — the ledger's original 84/86 predated this task.

- [ ] **Step 6: Run everything**

```bash
cd ~/dev/iqra-portal && npx supabase test db && npm test && npm run typecheck && npm run lint && npm run knip && npm run build
```

Expected: pgTAP **921 / 40** (913 + 8). `action-guards` reports **84**. Record the measured unit total.

- [ ] **Step 7: Commit**

```bash
cd ~/dev/iqra-portal && git add supabase/migrations/20260808111000_guardian_suppression.sql \
  supabase/tests/39_guardian_suppression.sql supabase/tests/29_definer_fingerprints.sql \
  src/lib/admin/guardians.ts src/lib/admin/guardians.test.ts \
  "src/app/(portal)/admin/elever" src/app/action-guards.test.ts src/lib/supabase/database.types.ts
git commit -m "feat(foresatte): D32 — suppression, so a court order has somewhere to land

Spec §10.7 recorded that every registered guardian was an unconditional,
permanent, unrevokable reader of everything about a child, called it the most
dangerous property of the system, and said to decide before pilot. It was
latent only because no guardian had credentials. This plan hands out the
logins, so the decision is now.

§10.7 called it structural and unpatchable. That is true of the participant
list and not of the predicate: private.is_guardian_of is ONE definer function
behind 35 call sites, so suppression lands in one clause and takes effect on
messages, attendance, grades, progress and hand-ins simultaneously.

Per (guardian, student), never per person — a parent suppressed for one child
keeps access to their siblings.

Deliberately NO reason column. The reason is a court order in the school's own
file; copying it into a table every admin can read, with no audit rotation
built, would be the worst field this table could gain.

pgTAP 913 -> 921. action-guards 83 -> 84."
```

## Task 15a: the token tables, the seven RPCs, and the D29 wall

**Files:**
- Create: `supabase/migrations/20260808120000_invite_tokens.sql`
- Create: `supabase/tests/40_invite_tokens.sql`
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
  -- ⛔ THE ACCOUNT MUST STILL EXIST. Measured 2026-08-06: without this, an
  -- invite issued before a soft-delete still redeems for the whole TTL, so
  -- updateUserById runs against an erased identity and account_activation
  -- gains a fresh row for it. The read side alone is not a wall.
  if not exists (
        select 1 from auth.users u where u.id = target and u.deleted_at is null)
  then
    raise exception 'kontoen finnes ikke eller er slettet' using errcode = '42501';
  end if;

  -- ⛔ D29. A pupil is never mailed.
  --
  -- ★ RELATIONSHIP **OR** ROLE, and the disjunction is the whole finding.
  -- The relationship alone was the first draft, on the reasoning that it
  -- mirrors the ping fan-out. It does not hold here, because two shipped admin
  -- buttons produce a pupil the relationship cannot see:
  --   · unlinkStudentLoginAction (elever/actions.ts:373) clears
  --     students.student_user_id and its own comment says it DELIBERATELY does
  --     not revoke the student role;
  --   · deleting the students row does the same, via `on delete set null`.
  -- Either leaves a live auth account holding role 'student' with no link — so
  -- the relationship test goes false, /admin/kontoer renders an e-mail button
  -- next to a card that still says «student», and a 13-year-old is mailed a
  -- credential with every test green. The fixture only ever used a LINKED
  -- pupil, which is why nothing caught it.
  --
  -- The fan-out can key on the relationship alone because it asks "who is the
  -- pupil in THIS thread"; this asks "is this account a child", and a child
  -- whose login was unlinked is still a child.
  if p_delivery = 'epost'
     and (exists (select 1 from public.students s where s.student_user_id = target)
          or private.has_role(target, 'student'))
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
  -- ⚠ meta carries `delivery` and NOTHING ELSE. §10.8 asks for minimisation in
  -- this table specifically, and expires_at is derivable from created_at plus
  -- private.invite_ttl(delivery) — both already on the row. audit_log has NO
  -- DELETE grant for anyone (20260716184149:24-26) and docs/spec.md requires
  -- ~3-month rotation of access events, so every redundant field here is
  -- permanent by construction.
  --
  -- The action distinguishes a first issue from a RESET, because they are
  -- different events: one is onboarding, the other is someone changing the
  -- credentials of an account that already worked.
  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values (p_issued_by,
          case when exists (select 1 from private.account_activation a
                             where a.user_id = target)
               then 'admin.invite.reset' else 'admin.invite.issued' end,
          'auth.users', target::text,
          jsonb_build_object('delivery', p_delivery));

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
     -- ⛔ THE ERASURE CHECK, and it belongs on BOTH sides. Measured 2026-08-06:
     -- with it only on the read side (invite_pending_accounts), an invite
     -- issued BEFORE a soft-delete still redeemed for the whole TTL — so
     -- updateUserById ran against an erased identity and invite_mark_activated
     -- wrote a fresh activation row for it. The fingerprint comment claimed
     -- this function was protected against "a live invite path into an erased
     -- identity"; until now only the listing was.
     and exists (
           select 1 from auth.users u
            where u.id = private.invite_tokens.user_id and u.deleted_at is null)
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
-- ── Revoke ──────────────────────────────────────────────────────────
-- ⛔ THE MISSING KILL SWITCH. adminProvisionUser sets email_confirm: true on an
-- address an admin TYPED; nothing verifies it belongs to the person. A single
-- mistyped character sends a live 7-day credential to a stranger, who can
-- redeem it and then read a named child's messages, attendance and hand-ins.
--
-- The privacy framing does not help here: «the e-mail contains no information
-- about a child» is true of the BODY and irrelevant to the risk, because the
-- credential is the disclosure.
--
-- Without this function the admin's only way to kill a misdirected link is to
-- click «Vis engangslenke», which destroys the old link by MINTING A NEW ONE —
-- not an obvious move under pressure, and it leaves a second live credential
-- behind.
create function public.invite_revoke(target uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.invite_tokens where user_id = target;
  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values (p_actor, 'admin.invite.revoked', 'auth.users', target::text, '{}'::jsonb);
end;
$$;
comment on function public.invite_revoke(uuid, uuid) is
  'Kills the outstanding invite for an account without issuing another. The recovery path for a credential sent to the wrong address. service_role only.';

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
         -- ⛔ THE SAME DISJUNCTION AS invite_issue, and it must stay identical.
         -- This column is what /admin/kontoer renders the e-mail button off,
         -- so if it disagrees with the RPC the UI offers an action the database
         -- will refuse with a raw 42501.
         (exists (select 1 from public.students s where s.student_user_id = p.id)
          or private.has_role(p.id, 'student')),
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

-- ── The single-account lookup (S1) ──────────────────────────────────
-- Deliberately does NOT filter on activation: this is the resolver the RESET
-- path uses (D30), and a reset is by definition for someone who can already
-- log in. invite_pending_accounts is the work QUEUE; this is the LOOKUP.
-- Keeping them separate is what stops the queue's filter from silently
-- becoming a precondition for issuing — which is exactly the bug that would
-- have shipped Phase 5 with no password reset of any kind.
create function public.invite_find_account(target uuid)
returns table (
  user_id uuid, full_name text, email text, roles text[], is_student boolean,
  activated boolean,
  invite_issued_at timestamptz, invite_expires_at timestamptz, invite_delivery text
)
language sql
security definer
set search_path = ''
as $$
  select p.id, p.full_name, u.email::text,
         coalesce(array_agg(r.role::text order by r.role)
                    filter (where r.role is not null), '{}'),
         (exists (select 1 from public.students s where s.student_user_id = p.id)
          or private.has_role(p.id, 'student')),
         exists (select 1 from private.account_activation a where a.user_id = p.id),
         t.issued_at, t.expires_at, t.delivery
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.user_roles r on r.user_id = p.id
    left join private.invite_tokens t on t.user_id = p.id
   where p.id = target and u.deleted_at is null
   group by p.id, p.full_name, u.email, t.issued_at, t.expires_at, t.delivery;
$$;
comment on function public.invite_find_account(target uuid) is
  'Single-account resolver for /admin/kontoer, including ACTIVATED accounts — the D30 password-reset path. service_role only.';

-- ── Backfill ────────────────────────────────────────────────────────
-- Anyone who has ever signed in demonstrably holds a working password, and
-- that is the only signal available: the placeholder bcrypt is indistinguish-
-- able from a real one (see the header). Anyone who has NOT signed in is
-- either genuinely un-activated or will activate on their first login and
-- stamp themselves — so the false-positive direction is "appears on the admin
-- queue for a while", never "silently unable to log in".
insert into private.account_activation (user_id, password_set_at)
-- ⚠ No coalesce: the predicate below already excludes null last_sign_in_at,
-- so a fallback here could never fire and would only suggest it might.
select p.id, u.last_sign_in_at
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
revoke execute on function public.invite_revoke(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.invite_find_account(uuid) from public, anon, authenticated;
revoke execute on function public.invite_pending_accounts() from public, anon, authenticated;

grant execute on function public.invite_issue(uuid, text, text, uuid) to service_role;
grant execute on function public.invite_redeem(text) to service_role;
grant execute on function public.invite_restore(text) to service_role;
grant execute on function public.invite_mark_activated(uuid) to service_role;
grant execute on function public.invite_revoke(uuid, uuid) to service_role;
grant execute on function public.invite_find_account(uuid) to service_role;

-- ⚠ The private helpers too — a `private` function with no explicit ACL is
-- EXECUTE TO PUBLIC, and `authenticated` holds USAGE on the schema. Measured:
-- `set role authenticated; select private.invite_attempt_limit();` returns 20.
-- Not exploitable, but private.audit and private.has_role both revoke this.
revoke execute on function private.invite_ttl(text) from public;
revoke execute on function private.invite_restore_window() from public;
revoke execute on function private.invite_token_hash(text) from public;
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

Create `supabase/tests/40_invite_tokens.sql`:

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
  'skjerm',
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
  'skjerm',
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
       and table_name in ('invite_tokens', 'account_activation', 'invite_attempts')
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

- [ ] **Step 4b: The six assertions the review ledger requires and the block above does NOT contain**

⛔ **The 19 assertions written above are the pre-review set.** The review panel added SQL to this migration — `invite_revoke`, the `deleted_at` check on redeem, `invite_find_account`, the prune and clear functions, the window clause — and specified the assertions that cover them, but the block above was never extended. Its mutation rows (6c, 14b, 14c, 14d, 28) all point at *"the new …"* assertions. **Write them, or those mutations have nothing to redden and five ledger fixes ship unwatched.**

| # | Covers | Assert | Ledger |
|---|---|---|---|
| a | S2 — the D29 hole | An **unlinked** pupil (role `student`, `student_user_id` null) is still refused `epost`. This is the `or private.has_role(…)` arm; without it a pupil whose link was cleared gets an e-mail button. | S2 / mutation 6c |
| b | M7 | `is_student` is **true** for a pupil and **false** for a guardian, read directly off `invite_pending_accounts` — two assertions, because the projection mutating to a constant must redden in both directions. | M7 / mutation 14c |
| c | M8 | `private.invite_ttl('skjerm') < private.invite_ttl('epost')` — the 24 h / 7 d ordering. Swapping the arms currently reddens nothing. | M8 / mutation 14d |
| d | rate limit | The window is **respected**: an attempt older than `private.invite_attempt_window()` does not count toward the cap. Without it a 15-minute limiter is a permanent per-IP ban on a school behind one NAT. | mutation 14b |
| e | H2 | `invite_redeem` returns **null** for a token whose user is soft-deleted. Assertion 15 covers the *listing*; this covers the *redemption*, and they are different code paths. | H2 |
| f | S1 | An **activated** account can be re-issued, and the **old link dies** at that instant. This is the whole D30 reset path; nothing currently asserts it in SQL. | S1 |

⚠ **b is two assertions, so this block is 7, not 6.** Count what you write.

⚠ Assertion **f needs `invite_find_account`**, which is defined in this same migration — resolve through it, not through `invite_pending_accounts`, or the assertion reproduces the S1 bug it exists to prevent.

- [ ] **Step 5: Set `plan()` from the count, then run the file alone and read the indices**

⛔ **`select plan(19);` on line 3 is now wrong** — Step 4b adds ~7. Count the `select is/isnt/ok/throws_ok/lives_ok/is_empty` calls in the finished file and set `plan()` to **that number**:

```bash
cd ~/dev/iqra-portal && grep -cE '^select (is|isnt|ok|throws_ok|lives_ok|is_empty)\(' supabase/tests/40_invite_tokens.sql
```

```bash
cd ~/dev/iqra-portal && npx supabase test db supabase/tests/40_invite_tokens.sql
```

⚠ **Positional path. There is no `--file` flag** — CLI v2.109.1 rejects it.

Expected: `ok 1` … `ok <N>`, no failures, where `<N>` is the counted value (**≈26**: 19 + 7). If `plan()` disagrees with the number that ran, **count again** and set `plan()` to that; never nudge it to silence a failure.

⛔ **This is the number every downstream total depends on.** Task 15a's suite total is `921 + <N>`, and the 940 quoted below assumes the stale 19. **Recompute it from `<N>` and correct Step 6, Step 7's commit message, Task 15b, Task 16 and Task 16b** — they all inherit this. Record the real figure in the execution ledger; the plan's numbers are expectations and this one is known to be low.

- [ ] **Step 6: Run the whole suite**

```bash
cd ~/dev/iqra-portal && npx supabase test db
```

Expected: **921 + `<N>`** assertions across **41** files, where `<N>` is Step 5's counted plan — **≈940 if `<N>`=19, ≈947 if `<N>`=26.** ⛔ Do not treat 940 as the target: it assumes the pre-review 19, and Step 4b adds about seven. If the total is not `921 + <N>`, the difference is not this file — find it before continuing.

⚠ **The baseline is Task 14b's 921 / 40, not plan 3's 913 / 39.** 14b adds `39_guardian_suppression.sql`, so this file is the **41st** and the 19 land on top of 921. Every count from here to the exit gate carries that +8/+1-file shift; an earlier draft of this plan predated 14b and said 932 / 40.

- [ ] **Step 7: Commit**

```bash
cd ~/dev/iqra-portal && git add supabase/migrations/20260808120000_invite_tokens.sql \
  supabase/tests/40_invite_tokens.sql supabase/seed.sql src/lib/supabase/database.types.ts
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

pgTAP 921 -> <the measured total>. (≈947 with Step 4b's assertions.)"
```

---

## Task 15b: the redemption rate limit, and the definer fingerprints

**Files:**
- Create: `supabase/migrations/20260808121000_invite_rate_limit.sql`
- Modify: `supabase/tests/40_invite_tokens.sql` (`plan(19)` → `plan(22)`)
- Modify: `supabase/tests/29_definer_fingerprints.sql` (marker literal **96** after Task 14b → counted, not predicted)

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260808121000_invite_rate_limit.sql`:

```sql
-- Rate limit for /sett-passord (spec §11 task 15: "its own rate limit, the
-- private.login_attempts precedent").
--
-- ── What is actually being defended, stated honestly ────────────────
-- NOT the token. The token is 32 bytes from a CSPRNG — 256 bits — so guessing
-- it is not a threat model, it is arithmetic.
--
-- ⚠ NOR IS IT BCRYPT CPU, though an earlier draft of this header said so.
-- updateUserById is reached only AFTER a successful redeem, so a bogus token
-- never touches GoTrue and never costs a hash. Stating a threat the code makes
-- unreachable is how a control ends up defended by the wrong argument.
--
-- What it actually defends: flooding the endpoint, and this function's OWN
-- write amplification — the delete+insert+select below is the most expensive
-- thing on the anonymous path.
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

-- ── The global prune ────────────────────────────────────────────────
-- ⛔ WITHOUT THIS THE TABLE GROWS FOREVER. The delete inside
-- invite_attempt_consume is bucket-scoped, so a row is removed only if that
-- same ip comes back inside the window — and an internet-facing, unauthen-
-- ticated, fail-open endpoint is precisely where addresses arrive once and
-- never return. Measured during review: 5 000 rows inserted, none reachable by
-- any prune path. These are IP addresses, on a project with a retention module.
--
-- Kept out of the hot path, exactly like login_attempts_prune(): any call
-- prunes its own bucket, this mops up the buckets nobody revisits. It is what
-- the attempted_at index above exists for.
create function public.invite_attempts_prune()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.invite_attempts
   where attempted_at < now() - private.invite_attempt_window();
$$;

-- ── Clear on success ────────────────────────────────────────────────
-- The clearLoginAttempts sibling, and it is not cosmetic here. The bucket is
-- ip ALONE and IQRA's families share the school network: an admin walking
-- families through activation at a parents' evening would hit the cap at the
-- 21st family. A completed redemption is proof the traffic was honest.
create function public.invite_attempts_clear(p_ip text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.invite_attempts where ip = p_ip;
$$;

revoke all on table private.invite_attempts from anon, authenticated, service_role;
revoke execute on function public.invite_attempt_consume(text) from public, anon, authenticated;
revoke execute on function public.invite_attempts_prune() from public, anon, authenticated;
revoke execute on function public.invite_attempts_clear(text) from public, anon, authenticated;
grant execute on function public.invite_attempt_consume(text) to service_role;
grant execute on function public.invite_attempts_prune() to service_role;
grant execute on function public.invite_attempts_clear(text) to service_role;

-- ── The private helpers are not for anyone else ─────────────────────
-- ⚠ A function in `private` with no explicit ACL is EXECUTE TO PUBLIC, and
-- `authenticated` holds USAGE on the schema — measured, `set role
-- authenticated; select private.invite_attempt_limit();` returns 20. Not
-- exploitable (the schema is not exposed through PostgREST and the tokens
-- themselves are unreadable) but it leaks the tunables, and private.audit /
-- private.has_role both revoke this. Match them.
revoke execute on function private.invite_attempt_window() from public;
revoke execute on function private.invite_attempt_limit() from public;
```

⚠ **The same revoke is owed by Task 15a's helpers** — `private.invite_ttl(text)`, `private.invite_restore_window()` and `private.invite_token_hash(text)` are all `EXECUTE TO PUBLIC` as written. Add the three `revoke execute … from public` lines to that migration too; they were missed because the plan followed `private.login_email_hash`, which has the same gap.

- [ ] **Step 2: Extend the pgTAP file — `plan(19)` becomes `plan(22)`**

Change the third line of `supabase/tests/40_invite_tokens.sql` from `select plan(19);` to `select plan(22);`, and add the `invite_attempt_consume` name to the grants assertion's list (assertion 16) so the new RPC is covered by the same wall:

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
cd ~/dev/iqra-portal && npx supabase db reset && npx supabase test db supabase/tests/40_invite_tokens.sql
```

Expected: `ok 1` … `ok 22`.

⚠ If assertion 21 says `allowed = true`, the arithmetic is off by one, not the limiter: `invite_attempt_consume` inserts **before** counting and refuses when `count > limit`. One consumed + 20 seeded = 21 rows, then the call inserts its own = 22 > 20. Count the rows before adjusting anything:
```bash
docker exec supabase_db_iqra-portal psql -U postgres -d postgres -tAc \
  "select ip, count(*) from private.invite_attempts group by ip;"
```

- [ ] **Step 4: Add the five definer fingerprints**

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
    -- Drop either of the first two and the token stops being single-use, or
    -- stops expiring. Both turn one leaked link into a permanent account
    -- takeover. The third is H2: without it an invite issued before a
    -- soft-delete still redeems, so GoTrue is driven against an erased
    -- identity — which is the exact property the pending_accounts entry below
    -- already claims to protect, on the read side only.
    (
      'public.invite_redeem(text)',
      array[
        'consumed_at is null',
        'expires_at > now()',
        'u.deleted_at is null'
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
    -- First marker: same one, same reason, as resolve_ping_address — a
    -- soft-deleted account is not a person waiting for a login, and listing
    -- one hands an admin a live invite path into an erased identity.
    -- Second is M7. Measured: replacing the is_student projection with `false`
    -- reddens nothing, and every pupil card then gains an e-mail button whose
    -- click returns a raw 42501 — D29 defeated through the UI rather than
    -- through the wall.
    (
      'public.invite_pending_accounts()',
      array[
        'u.deleted_at is null',
        's.student_user_id = p.id'
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

The five entries above carry **2 + 3 + 2 + 2 + 1 = 10** markers, and the baseline is **96**, not 95 — Task 14b already added `not suppressed` on `private.is_guardian_of`. So the literal goes **96 → 106**.

⛔ **Do not copy that number in. Run the count and use what it prints:**

```bash
cd ~/dev/iqra-portal && docker exec supabase_db_iqra-portal psql -U postgres -d postgres -tAc \
  "select count(*) from (select unnest(markers) from definer_markers) x;" 2>/dev/null \
  || echo "definer_markers is a CTE local to the test file — count from the arrays by hand instead"
```

Then update the two places in the file, substituting the counted value for `<N>`:

```sql
select is(
  (select count(*)::int from definer_markers d, lateral unnest(d.markers) as m),
  <N>,
  'the fingerprint table still covers <N> (function, predicate) pairs'
);
```

and extend the arithmetic comment above it:

```sql
-- 83 → 95. Phase 5 plan 4 then added D32's `not suppressed` on
-- private.is_guardian_of (95 → 96, Task 14b), then FIVE invite entries
-- carrying 2+3+2+2+1 = 10, so 96 → <N>. public.invite_mark_activated is
-- deliberately absent — it holds no wall to pin; see the note beside the
-- entries.
```

⚠ **106 assumes M8's TTL ordering is pinned by an assertion and not by a marker.** If you pin `private.invite_ttl(text)` as a **sixth** entry instead, the total is 107 and the "five entries" wording above is wrong too. Decide when you write the TTL assertion, then make the entry list, the comment and the literal agree with each other — the point is that all three are counted from the same arrays, not that any particular number is right.

⛔ **This counter has now been got wrong twice on this file** — once by reading "five new functions" and writing 31, once by a plan step that stated three different numbers for one value. **The arrays are what count.** If assertion 1 is red, count the markers; never reconcile the two numbers by adjusting either one.

- [ ] **Step 6: Run both files, then the whole suite**

```bash
cd ~/dev/iqra-portal && npx supabase test db supabase/tests/29_definer_fingerprints.sql \
  && npx supabase test db
```

Expected: file 29 `ok 1`, `ok 2`. Full suite **Task 15a's total + 3** across **41** files (file 29's `plan(2)` is unchanged — it counts markers, not rows). ⚠ **≈946 if Task 15a landed at 943, ≈950 if it landed at 947.** Carry forward the number 15a actually measured, not the one this plan predicted.

- [ ] **Step 7: Regenerate types and commit**

```bash
cd ~/dev/iqra-portal && npm run db:types
git add supabase/migrations/20260808121000_invite_rate_limit.sql \
  supabase/tests/40_invite_tokens.sql supabase/tests/29_definer_fingerprints.sql \
  src/lib/supabase/database.types.ts
git commit -m "feat(invitasjon): the redemption limiter, and five new definer fingerprints

Bucketed on ip alone because redemption is anonymous — there is no second
dimension. Set well above honest use (20/15min against an honest ONE) because
IQRA's families share the school network.

Fails open, and the reason is not login's: there is no backstop here, but the
token is 256 bits, so an unreachable limiter grants unlimited guesses against
a secret that cannot be guessed. Locking families out of activation is worse.

Fingerprint markers 96 -> 106 (2+3+2+2+1, counted from the arrays).
invite_mark_activated is deliberately unpinned — it holds no wall.

pgTAP <15a's measured total> -> <that + 3>."
```

---

## Task 15c: the token library, the invite e-mail, and the shared portal URL

**Files:**
- Create: `src/lib/portal-url.ts`, `src/lib/auth/invite.ts`, `src/lib/auth/invite.test.ts`, `src/lib/admin/invite-tokens.ts`, `src/lib/admin/invite-tokens.test.ts`
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
  /**
   * ⛔ THE SENTINEL MUST TRAVEL THROUGH THE PARAMETER. Asserting that a body
   * built from `{inviteUrl, validDays}` does not contain 'ZZPUPILZZ' is
   * VACUOUS — there is no input channel through which any implementation could
   * emit it, so the assertion passes for every possible body, including one
   * that reads `(input as any).pupilName` and prints it. The only way to
   * redden it would be to hard-code the literal into the template.
   *
   * This is not hypothetical on this project. ping-email.test.ts's own comment
   * records that its earlier version — which keyed on the human description
   * instead of feeding the field through — scored 6/6 GREEN against a builder
   * that put a pupil's name in the body. Distinctiveness was never the
   * mechanism; the parameter is.
   */
  it.each([
    ['pupilName', 'ZZPUPILZZ'],
    ['recipientName', 'ZZPARENTZZ'],
    ['teacherName', 'ZZTEACHERZZ'],
    ['className', 'ZZCLASSZZ'],
    ['email', 'zz@zz.invalid'],
    ['userId', 'c2000000-0000-0000-0000-000000000002'],
  ])('never carries %s even when the caller passes one', (field, secret) => {
    const mail = buildInviteEmail({
      inviteUrl: URL,
      validDays: 7,
      ...({ [field]: secret } as Record<string, unknown>),
    } as Parameters<typeof buildInviteEmail>[0]);
    expect(mail.text).not.toContain(secret);
    expect(mail.subject).not.toContain(secret);
  });

  // ⚠ Kept, but it is NOT the privacy wall it reads as: with no address-shaped
  // input, it can only catch an address hard-coded into the footer. The
  // it.each above is what actually guards the promise.
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

- [ ] **Step 9: Write the library — as TWO files, on opposite sides of the quarantine**

⛔ **The obvious single file breaches the quarantine.** `src/lib/admin/quarantine.ts:13-15` says:

> `createServiceRoleClient` is exported for **SIBLING FILES IN THIS DIRECTORY ONLY** — never import it outside `src/lib/admin/`.

**No lint rule enforces that** (`eslint.config.mjs` is the bare `next` preset), so a `src/lib/auth/invite.ts` that imports it compiles, passes CI, and becomes the first `src/lib/` module to cross the line — with nothing to stop the next one. The house already has the answer for exactly this case: `src/lib/admin/rate-limit.ts` is the quarantine's **category B (pre-auth infrastructure)**, and the invite RPC wrappers satisfy its contract verbatim — they take no input that widens their own authority, reach nothing but their own narrowly-granted functions, and mutate no school data.

So: **pure helpers in `src/lib/auth/invite.ts`, service-role wrappers in `src/lib/admin/invite-tokens.ts`.** This also fixes the knip failure — `invite.test.ts` no longer needs the whole quarantine graph in its import chain — and it is why the test file at Step 7 imports only the three pure functions.

Create `src/lib/auth/invite.ts` — **no service-role import, no `@/lib/admin/*` import at all**:

```typescript
import 'server-only';
import { randomBytes } from 'node:crypto';
import { PORTAL_URL } from '@/lib/portal-url';

/**
 * The invite token's PURE half: generation, the URL, and the day arithmetic.
 *
 * ⛔ Nothing here touches the database. The service-role wrappers live in
 * src/lib/admin/invite-tokens.ts because createServiceRoleClient is quarantined
 * to that directory (quarantine.ts:13-15) — a rule no lint rule enforces, which
 * is exactly why it has to be kept by hand.
 *
 * The DIGEST is computed in SQL, not here — see the migration header: passing a
 * bytea argument through PostgREST needs hex encoding, and getting that subtly
 * wrong yields an invite flow where every link is silently invalid.
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

```

- [ ] **Step 9b: The service-role half**

Create `src/lib/admin/invite-tokens.ts`. The header states its quarantine category, the way `rate-limit.ts` does — a file in this directory without one is the next reviewer's problem:

```typescript
import 'server-only';
import type { InviteDelivery } from '@/lib/auth/invite';
import { createServiceRoleClient } from './quarantine';

/**
 * Invite tokens — the quarantine's PRE-AUTH category (see quarantine.ts).
 *
 * These run before any session exists (redemption is anonymous by
 * construction), so the admin contract — AAL2, admin role, audit entry —
 * cannot apply to all of them. What replaces it, and what puts them in
 * category B alongside rate-limit.ts: they take no input that can widen their
 * own authority, they reach nothing but their own service_role-granted RPCs,
 * and they mutate no school data.
 *
 * ⚠ issueInvite is the exception that DOES carry an actor, and its `issuedBy`
 * MUST come from requireAdminActor(). It is written verbatim to
 * audit_log.actor_id, so a value taken from a request forges the only record
 * of who minted a credential.
 */

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
  src/lib/admin/invite-tokens.ts src/lib/admin/invite-tokens.test.ts \
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
      // ⚠ logThrottleFailure hard-codes «GoTrue-hooken gjelder fortsatt»
      // (rate-limit.ts:120-129), which is FALSE on this path — the doc comment
      // above says there is no backstop here. Parameterise the backstop clause
      // and pass nothing for the invite path, or the only record that a
      // security control stopped working claims another one is still holding.
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

vi.mock('@/lib/admin/invite-tokens', () => ({ redeemInvite, restoreInvite, markActivated }));
vi.mock('@/lib/admin/rate-limit', () => ({ consumeInviteAttempt }));
vi.mock('@/lib/admin/quarantine', () => ({
  createServiceRoleClient: () => ({ auth: { admin: { updateUserById } } }),
}));
vi.mock('next/navigation', () => ({
  // `NEXT_REDIRECT:` matches the repo's existing precedent at
  // src/app/logg-inn/actions.test.ts:7-11 — do not invent a second prefix.
  redirect: (to: string) => { throw new Error(`NEXT_REDIRECT:${to}`); },
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

  /**
   * ⛔ THE BOUNDARY, not a short string. Asserting that 'kort' is rejected with
   * a message matching /12/ pins the MESSAGE, not the threshold: mutate
   * `min(12)` to `min(6)` and leave the message text alone, and this stays
   * green while 8-character passwords are accepted portal-wide. The plan
   * spends a paragraph on why 12 rather than config.toml's 6; this is what
   * makes that paragraph true.
   */
  it.each([
    [11, false],
    [12, true],
  ])('a %i-character password is accepted: %s', async (len, ok) => {
    const pw = 'a'.repeat(len);
    const run = setPasswordAction(
      { error: null },
      form({ t: 'tok', passord: pw, bekreft: pw }),
    );
    if (ok) {
      // The accepted case redirects, and redirect() throws.
      await expect(run).rejects.toThrow('NEXT_REDIRECT:/logg-inn?aktivert=1');
    } else {
      expect((await run).error).toMatch(/12/);
      expect(redeemInvite).not.toHaveBeenCalled();
    }
  });

  it('★ reports a rejected password as rejected, not as a system hiccup', async () => {
    updateUserById.mockResolvedValue({ error: { message: 'weak', status: 422 } });
    const state = await setPasswordAction({ error: null }, form(GOOD));
    expect(restoreInvite).toHaveBeenCalledWith('tok');
    expect(state.error).toMatch(/avvist/i);
    expect(state.error).not.toMatch(/øyeblikk/i);
  });

  it('still redirects when the activation row cannot be written', async () => {
    markActivated.mockRejectedValue(new Error('rpc nede'));
    await expect(setPasswordAction({ error: null }, form(GOOD)))
      .rejects.toThrow('NEXT_REDIRECT:/logg-inn?aktivert=1');
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

  /**
   * ⛔ AN EXPLICIT CALL ORDER, because `toHaveBeenCalledWith` is order-blind.
   * The first draft asserted both calls happened and called that an ordering
   * test — so mutation 23 (move markActivated above updateUserById) left it
   * GREEN, and the test whose title claimed the ordering property was the one
   * test that could not see it. The assertion that actually moved was in the
   * failure-path test below. Measured by the review panel.
   */
  it('★ marks the account activated only AFTER GoTrue accepted', async () => {
    const order: string[] = [];
    updateUserById.mockImplementation(async () => { order.push('gotrue'); return { error: null }; });
    markActivated.mockImplementation(async () => { order.push('activated'); });
    await expect(setPasswordAction({ error: null }, form(GOOD)))
      .rejects.toThrow('NEXT_REDIRECT:/logg-inn?aktivert=1');
    expect(order).toEqual(['gotrue', 'activated']);
    expect(updateUserById).toHaveBeenCalledWith('user-1', { password: GOOD.passord });
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
import { markActivated, redeemInvite, restoreInvite } from '@/lib/admin/invite-tokens';

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
    // The token was spent before the outcome was known, so give it back —
    // in BOTH branches below. A 5xx during an incident, or a rejected
    // password, must not permanently kill a live invitation.
    await restoreInvite(parsed.data.t);
    console.error('[sett-passord] GoTrue avviste passordet:', {
      status: error.status,
      message: error.message,
    });
    // ⛔ CLASSIFY, don't lump. This mirrors isCredentialFailure in
    // logg-inn/actions.ts:33, and it exists for a concrete reason: the CLOUD
    // project's password policy is set in the dashboard and is unknown to this
    // code (supabase/config.toml governs the LOCAL stack only). If it enforces
    // a character class, or Supabase's leaked-password check is on, a parent
    // typing a perfectly good 14-character passphrase gets a 422 — and the
    // undifferentiated message tells them the system had a hiccup and to try
    // again shortly. They retry the same passphrase, forever, then phone the
    // school. That is exactly the "passes testing, fails for real families"
    // outcome this task opens by trying to avoid.
    const permanent =
      error.status !== undefined && error.status >= 400 && error.status < 500 &&
      error.status !== 429;
    return {
      error: permanent
        ? 'Passordet ble avvist. Velg et annet passord på minst 12 tegn.'
        : 'Kunne ikke lagre passordet. Prøv igjen om et øyeblikk.',
    };
  }

  // Only now — the account is activated when GoTrue holds the password, not
  // when we asked it to.
  //
  // ⛔ NON-FATAL, and that is not laziness. markActivated throws on RPC error,
  // and an uncaught throw here 500s the user AFTER the password is already set
  // and the token already consumed. They go back to the mail, click again, and
  // get «Lenken er ugyldig eller utløpt» — so they phone the school about a
  // password that works, and the admin mints another credential for no reason.
  // The activation row is bookkeeping: nothing authorizes on it, and its only
  // consequence is that the account lingers on /admin/kontoer.
  try {
    await markActivated(userId);
  } catch (cause) {
    console.error('[sett-passord] aktivering ikke registrert (passordet ER satt):', cause);
  }

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
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
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
  // ⛔ BEFORE THE !user BRANCH, and for the same reason as the drain: the whole
  // point of this page is that its visitor has no session, so the matcher would
  // 307 every invited parent to /logg-inn — a login page they cannot use,
  // reached from a link that appears to be broken.
  //
  // ⚠ ONE EXACT PATH, never a prefix, and trailing-slash tolerant.
  //
  // ★ GUARDED ON `!user`, and that guard is load-bearing. An unguarded
  // exclusion returns BEFORE the user_roles read (:106) and the AAL2 block
  // (:115-128), making this the first path in the app where an authenticated
  // STAFF session at AAL1 skips the MFA gate — and Server Actions POST to page
  // paths, so that is a real reachable surface, not a theoretical one.
  //
  // Nothing is lost by guarding it. A signed-in PARENT still reaches the page:
  // they hold no staff role, so they fall through the role check to respond()
  // at :130. Only /logg-inn bounces a signed-in user to «/», and this is not
  // that path. (An earlier draft of this plan claimed the opposite and wrote a
  // test around it; the test could not fail.)
  if (!user && path.replace(/\/$/, '') === '/sett-passord') {
    const response = respond();
    // The token is in the query string, and Referrer-Policy is
    // strict-origin-when-cross-origin globally (next.config.ts:22) — which
    // sends the FULL URL on same-origin requests. Every chunk, stylesheet and
    // RSC fetch this page makes would carry a live credential in Referer.
    response.headers.set('referrer-policy', 'no-referrer');
    return response;
  }
```

- [ ] **Step 9: The proxy tests**

Add to `src/proxy.test.ts`, alongside the four drain exclusion tests (copy their shape exactly — read them first):

```typescript
  it('lets an unauthenticated GET /sett-passord through instead of 307ing it', async () => {
    expect((await proxy(request('/sett-passord?t=abc'))).status).not.toBe(307);
  });

  it('tolerates the trailing slash', async () => {
    expect((await proxy(request('/sett-passord/'))).status).not.toBe(307);
  });

  it('★ does not exempt a neighbouring path — the exclusion is exact, not a prefix', async () => {
    expect((await proxy(request('/sett-passord-noe'))).status).toBe(307);
  });

  it('sends no Referer — the token is in the query string', async () => {
    const response = await proxy(request('/sett-passord?t=abc'));
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });

  // ★ THE GUARD, not the exclusion. Staff at AAL1 must STILL be MFA-gated
  // here; without the `!user &&` this is the one path in the app where they
  // are not. A signed-in non-staff user proves nothing — they reach respond()
  // at proxy.ts:130 with or without this line.
  it('★ still MFA-gates a signed-in staff session below AAL2', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    from.mockReturnValue({
      select: () => ({ eq: async () => ({ data: [{ role: 'admin' }], error: null }) }),
    });
    expect((await proxy(request('/sett-passord?t=abc'))).status).toBe(307);
  });
```

⛔ **`request()` takes ONE argument.** `src/proxy.test.ts:45` is `function request(path: string)`; the session user comes from the module-level `getUser` mock, which `beforeEach` pins to `null`. An earlier draft of this plan called it as `request(path, { user: null })` — that is TS2554, so it fails `npm run typecheck`, and under vitest's transpile-only esbuild the extra argument is silently **dropped**, so the "signed-in" test would have run against `user: null` and passed for the wrong reason. Reuse the helper verbatim; do not introduce a second one.

⚠ The last test needs `getUser` and `from` to be able to *hold* a signed-in staff session. Their current inferred types are `user: null` and `data: never[]`, so widen the two mock declarations at `src/proxy.test.ts:13-16` first, and reset both in `beforeEach`:

```typescript
const getUser = vi.fn<() => Promise<{ data: { user: { id: string } | null } }>>(
  async () => ({ data: { user: null } }),
);
const from = vi.fn<
  () => { select: () => { eq: () => Promise<{ data: { role: string }[]; error: null }> } }
>(() => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }));
```

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
    expect(allActions.length).toBe(85);
```

⚠ `PRE_AUTH_REQUIRES` asserts against the **action body**, not against the allowlist's own string — that is deliberate, and it is what makes the exemption a condition rather than a blank cheque. Do not "simplify" it back to comparing the literal declared in that file.

- [ ] **Step 11: Run everything and commit**

```bash
cd ~/dev/iqra-portal && npm test && npm run typecheck && npm run lint && npm run knip && npm run build
```

Expected: unit up by the count from Steps 2 and 9 — **record what actually runs**. `action-guards` reports **85** actions (Task 14b took it 83 → 84). Build lists `/sett-passord`.

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

action-guards 84 -> 85, with the exemption declared and conditioned on
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
import { generateInviteToken, inviteUrl, validDaysUntil } from '@/lib/auth/invite';
import { issueInvite } from '@/lib/admin/invite-tokens';
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
  const pending = await findAccount(userId);
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

/**
 * ⛔ RESOLVES THROUGH invite_find_account, NOT THROUGH THE QUEUE.
 *
 * An earlier draft resolved by scanning listPendingAccounts(). That queue
 * filters `not exists (… account_activation …)`, so an ACTIVATED account is
 * never in it — and every caller below then answered «Kontoen finnes ikke» for
 * exactly the people D30 exists to serve. The result was a plan in which
 * re-issuing an invite was the documented password reset, had SQL written for
 * it (invite_mark_activated's upsert), had a walkthrough step exercising it,
 * and had NO REACHABLE UI. Phase 5 would have shipped with no password reset
 * of any kind. The draft's own note defended the queue scan as a scale
 * trade-off and never noticed it was a correctness bug.
 */
async function findAccount(userId: string): Promise<PendingAccount | null> {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .rpc('invite_find_account', { target: userId })
    .maybeSingle();
  if (error) throw new Error(`Kunne ikke hente kontoen: ${error.message}`);
  return data ? mapAccount(data) : null;
}
```

⚠ `sendInviteEmail` and `revealInviteLink` both call `findAccount`, never `listPendingAccounts`. Extract the row→`PendingAccount` mapping as `mapAccount` so the queue and the single-row lookup cannot drift.

- [ ] **Step 1b: The single-row resolver, and the reset path it unblocks**

✅ **Nothing to write here — `public.invite_find_account(uuid)` ships in Task 15a's migration**, defined beside `invite_pending_accounts` with its own `revoke`/`grant` pair. This step is the explanation of *why* it exists; the SQL is at Task 15a.

⛔ **It must stay in 15a and must not be moved back here.** An earlier revision defined it in this task while 15a's grant block already named it — so `revoke execute on function public.invite_find_account(uuid)` ran against a function that did not exist yet, and Task 15a's `npx supabase db reset` **aborted on its own migration**. Under `--single-transaction … ON_ERROR_STOP=1` that is not a warning, it is a dead stack three tasks before anything here runs. Same defect class as plan 3's 4-arg-function-called-with-3.

`/admin/kontoer` therefore has **two** sections, and the second is D30:

1. **«Kan ikke logge inn ennå»** — `listPendingAccounts()`, the work queue, which shrinks to empty.
2. **«Finn en konto»** — a search field resolving to `invite_find_account`, rendering the same `InviteCard` with the button labelled **«Send invitasjon på nytt»** when `activated` is true. This is the whole of the password-reset flow, and it is the only way a family who forgot a password gets back in.

⚠ Add the pgTAP assertion that pins it, because nothing else does: issue → redeem → `invite_mark_activated` → issue again → the **old** token is dead and the **new** one redeems. That is D30's only mechanical claim.

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
vi.mock('@/lib/admin/invite-tokens', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/admin/invite-tokens')
  >('@/lib/admin/invite-tokens');
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
  // ⛔ NO revalidatePath HERE. invite_pending_accounts orders by
  // `issued_at asc nulls first`, so issuing gives this row the largest
  // issued_at in the table and re-sorting moves it to the BOTTOM of the page —
  // at the exact moment the card is displaying a link that cannot be retrieved
  // again. The queue metadata is stale for one card until the next navigation;
  // that is the cheaper of the two.
  return { error: null, link: await revealInviteLink(userId) };
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

`InviteCard.tsx` is a client component holding **two** `useActionState` hooks. That shape needs state adjustment, and the repo has the worked answer at `LoginCard.tsx:49-76` — without it, a failed send's error renders **beneath** the one-time link produced by the other action. That is not a corner case: `NO_API_KEY` is the *expected* send failure until IQRA's Resend account exists, so it is the default experience for the whole build.

```tsx
const [sendState, sendAction, sendPending] = useActionState<InviteState, FormData>(sendInviteAction, idle);
const [linkState, linkAction, linkPending] = useActionState<InviteState, FormData>(revealInviteLinkAction, idle);

// Whichever action last produced a result owns the message area. Adjusted
// during render, not in an effect — the repo's lint rules forbid synchronous
// setState inside effects (LoginCard.tsx:44-46).
const [prevSend, setPrevSend] = useState(sendState);
const [prevLink, setPrevLink] = useState(linkState);
const [latest, setLatest] = useState<'send' | 'link'>('send');
if (prevSend !== sendState) { setPrevSend(sendState); setLatest('send'); }
if (prevLink !== linkState) { setPrevLink(linkState); setLatest('link'); }
const state = latest === 'send' ? sendState : linkState;
```

When `state.link` is present it renders the link in a `readOnly` `<input>` with a copy button and this warning:

> Lenken vises bare én gang. Kopier den nå — den kan ikke hentes fram igjen, men du kan lage en ny.

⚠ **That copy guards the wrong direction, and the code must not.** `useActionState` state is *not* cleared by `revalidatePath` or by an RSC re-render, so the link persists in client state until the admin navigates away — a live credential left on an unattended screen. Clear it on unmount, and do not rely on the warning to be the whole control.

⛔ **Two rules for the list, both measured by the review panel.**

**Key on the account, never the index.** `invite_pending_accounts` orders `issued_at asc nulls first`, so issuing an invite moves that row from the never-invited block to the very end. With an index key, `useActionState` state stays bound to the *position* — and the one-time link for one pupil renders inside the card labelled with another pupil's name and e-mail.

```tsx
{accounts.map((account) => (
  <InviteCard key={account.userId} account={account} />
))}
```

**Use the repo's date helpers, and use the right one.** `formatDateNb` **throws** on a timestamptz — it builds `` new Date(`${v}T12:00:00Z`) `` (`dates.ts:8-13`), so a timestamptz yields `…+00:00T12:00:00Z` → Invalid Date → `Intl` throws. But the fallback an earlier draft suggested, `toLocaleDateString('nb-NO')`, is documented as a bug in this repo at `dates.ts:26`:

> `timeZone` is NOT optional. The server runs UTC in production, so omitting it would stamp every message with the runner's clock…

An invite issued at 00:30 Oslo time would render as the previous day. The real pair is at `src/components/announcements/AnnouncementList.tsx:48-49`:

```tsx
import { formatDateNb, formatDateTimeNb, osloDateOf } from '@/lib/dates';
// date only:      formatDateNb(osloDateOf(account.invitedAt))
// date and time:  formatDateTimeNb(account.invitedAt)
```

Use `formatDateTimeNb` here — an admin re-issuing an invite needs to tell two of them apart on the same day.

- [ ] **Step 5: The nav entry**

Add to `src/app/(portal)/admin/AdminNav.tsx` in the same shape as its neighbours. **Every one of the 8 existing entries carries `exact`**, and although TypeScript normalises the array-literal union so an omitted `exact` compiles and behaves as `false`, write it out — the correct behaviour should be stated, not inherited from an implicit `undefined`:

```typescript
  { href: '/admin/kontoer', label: 'Kontoer', exact: false },
```

⛔ **`AdminNav.test.tsx` does NOT assert the entry set.** An earlier draft of this plan claimed it did, and that "it fails until the new one is added there too" — false. The file has exactly two `it()` blocks, both about `Meldinger` and `Oversikt`; adding `Kontoer` leaves it green, and an executor reading the old instruction would hunt for an assertion that does not exist. So the nav entry ships **untested unless you add the assertion** — which is precisely how `/admin/varsler` shipped green and unlooked-at. Add it:

```tsx
it('links to the accounts queue', () => {
  render(<AdminNav pathname="/admin" />);
  expect(screen.getByRole('link', { name: 'Kontoer' }))
    .toHaveAttribute('href', '/admin/kontoer');
});
```

⚠ Match the existing tests' render signature — read them first; the two current blocks show how `pathname` is passed.

- [ ] **Step 6: Bump the action counter and run everything**

`src/app/action-guards.test.ts`: `expect(allActions.length).toBe(87);` — two new actions on top of Task 15d's 85. ⚠ The ladder is **83 → 84 (14b) → 85 (15d) → 87 (15e)**; an earlier draft said 83 → 84 → 86, before Task 14b existed.

```bash
cd ~/dev/iqra-portal && npm test && npm run typecheck && npm run lint && npm run knip && npm run build
```

Expected: `action-guards` reports **87**. Build lists `/admin/kontoer`.

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

action-guards 85 -> 87."
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
Expected: **the total recorded in the execution ledger for Task 15b / 41 files** (≈950). ⚠ If you are reading a hard number here instead of the ledger's, the ledger was not filled in — go back and fill it.

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
npx supabase test db supabase/tests/40_invite_tokens.sql

# 4. Restore by piping the captured definition back in.
docker exec -i supabase_db_iqra-portal psql -U postgres -d postgres < /tmp/before.sql

# 5. ⛔ VERIFY THE RESTORE — diff, do not assume.
docker exec supabase_db_iqra-portal psql -U postgres -d postgres -tAc \
  "select pg_get_functiondef('${FN}'::regprocedure);" > /tmp/after.sql
diff /tmp/before.sql /tmp/after.sql && echo "✓ restored"
```

If the diff is not empty, **`npx supabase db reset` before the next mutation.** Do not proceed on a database you have not re-verified.

- [ ] **Step 1b: A SECOND restore idiom, for the grant mutations (rows 10, 11, 11b)**

⛔ **The harness above cannot restore a grant, and it will tell you it did.** `create or replace function` **preserves the existing ACL**, and `pg_get_functiondef` never renders a grant — so after row 10 the re-applied definition changes nothing about the privilege, `diff` is empty, and the harness prints **`✓ restored`** while `authenticated` still holds EXECUTE. Assertion 16 is then red for every remaining mutation and reads as a fresh defect. Row 11 is worse: it is a *table* grant that `pg_get_functiondef` cannot see at all.

This is failure modes 2 and 3 of this task's own preamble, reproduced inside the harness written to prevent them. For those rows the restore is the matching `REVOKE`, and the verification is **re-running the assertion**, not diffing a definition:

```bash
cd ~/dev/iqra-portal
# mutate
docker exec -i supabase_db_iqra-portal psql -U postgres -d postgres <<'SQL'
grant execute on function public.invite_redeem(text) to authenticated;
SQL
npx supabase test db supabase/tests/40_invite_tokens.sql   # assertion 16 must be RED

# restore — the inverse statement, never a definition replay
docker exec -i supabase_db_iqra-portal psql -U postgres -d postgres <<'SQL'
revoke execute on function public.invite_redeem(text) from authenticated;
SQL
npx supabase test db supabase/tests/40_invite_tokens.sql   # 16 AND 17 must be green
```

⚠ Two further harness corrections measured by the panel: row 14 needs `FN="private.invite_attempt_limit()"`, and row 15's affected file is **29**, not the 39 the Step 1 harness runs.

- [ ] **Step 2: Work the table**

| # | Mutation | Expected to redden | Measured |
|---|---|---|---|
⛔ **Six of the original predictions were wrong, and the review panel measured every SQL row against the live database.** The «Expected» column below is corrected; the rows marked ✔measured were run one at a time with capture → mutate → run → restore → diff. Where a mutation reddens *more* than its target, that is stated — an executor who sees an unexpected red and starts debugging a defect that is not there has lost the afternoon.

⚠ The file numbers changed: the invite pgTAP file is **40**, and **39** is now D32's suppression file.

| 1 | `invite_token_hash` → `select p_token::bytea` | 40: 1, 2 ✔measured | |
| 2 | `invite_issue` upsert → `on conflict (user_id) do nothing` | 40: 4, 5 **and 11** ✔measured — and it makes assertion 7 pass for the wrong reason | |
| 3 | `invite_redeem`: drop `and consumed_at is null` | 40: 6 ✔measured | |
| 4 | `invite_redeem`: drop `and expires_at > now()` | 40: 7 ✔measured | |
| 5 | ★ `invite_issue`: delete the whole D29 `if` block | 40: 8 **and 18** ✔measured. ★ Assertion 18 is a **second D29 control** and the plan did not know it: with the wall gone the refused `epost` attempt succeeds and writes a second audit row | |
| 6 | ★ `invite_issue`: over-revoke — `(exists(…) or private.has_role(…))` → `true` | 40: 10, and 11 as a knock-on (8 stays green) | |
| 6b | ★ `invite_issue`: drop the `p_delivery = 'epost' and` conjunct (refuse a pupil on **any** delivery) | 40: 9 (8 and 10 stay green). ⛔ Without this row assertion 9 is watched by NOTHING — the original «two mutations are enough» note was off by one, and 9 is the assertion stopping D29 from being over-applied and locking pupils out of their only path | |
| 6c | ★ `invite_issue`: drop the `or private.has_role(target,'student')` arm | 40: the new unlinked-pupil assertion. ⛔ This is the S2 hole itself — without this row the disjunction that fixes it is untested | |
| 7 | `invite_restore`: drop the `invite_restore_window()` clause | 40: 12 ✔measured | |
| 8 | `invite_pending_accounts`: drop the `account_activation` `not exists` | 40: 14 ✔measured | |
| 9 | `invite_pending_accounts`: drop `u.deleted_at is null` | 40: 15 ✔measured | |
| 10 | `grant execute on function public.invite_redeem(text) to authenticated` | 40: 16 ✔measured. ⛔ **Restore with Step 1b's REVOKE idiom, not the definition harness** | |
| 11 | `grant select on private.invite_tokens to authenticated` | 40: 17 ✔measured. ⛔ Step 1b idiom | |
| 11b | `grant select on private.invite_attempts to authenticated` | 40: 17. ⛔ Measured on the ORIGINAL draft: this reddened **nothing** — the table was in no assertion at all, while `authenticated` already holds `USAGE` on schema `private` and the table stores IP addresses | |
| 12 | `invite_issue`: delete the `audit_log` insert | 40: 18 **and 19** ✔measured (no row → no actor to read) | |
| 13 | `invite_issue`: audit `actor_id` → `null` | 40: 19 ✔measured | |
| 14 | `invite_attempt_limit()` → `100000` | 40: 21 ✔measured. ⚠ `FN="private.invite_attempt_limit()"` | |
| 14b | `invite_attempt_consume`: drop `and attempted_at >= now() - v_window` from the count | 40: the new window assertion. Without it a 15-minute limiter is a **permanent per-IP ban** on a school that shares one NAT | |
| 14c | `invite_pending_accounts`: `is_student` projection → `false` | 40: the new `is_student` assertions. ⛔ Measured on the original draft: reddened **nothing**, and every pupil card gains an e-mail button whose click returns a raw 42501 | |
| 14d | `private.invite_ttl`: swap the two arms | 40: the new TTL-ordering assertion | |
| 14e | ★ `private.is_guardian_of`: drop `and not suppressed` | 39: 1, 4, 5 (D32 — one clause, three surfaces) | |
| 15 | fingerprints: stub `invite_redeem` body to `select null::uuid` | 29: 2 ✔measured. ⚠ Run **file 29**, not 40 | |
| 16 | `buildInviteEmail`: delete the `startsWith(PORTAL_URL…)` guard | invite-email: «refuses a link that is not a set-password link» | |
| 17 | `buildInviteEmail`: interpolate the URL into `subject` | invite-email: «never templates the subject» | |
| 18 | `generateInviteToken`: `base64url` → `hex` | invite: «256 bits, URL-safe» | |
| 19 | `validDaysUntil`: `Math.max(1, …)` → the bare `Math.ceil` | invite: «never returns zero» | |
| 20 | `validDaysUntil`: `Math.ceil` → `Math.floor` | invite: «a day and a half rounds UP» | |
| 21 | ★★ `setPasswordAction`: move `redeemInvite` **above** the zod parse | sett-passord: both «does NOT redeem» tests | |
| 22 | ★ `setPasswordAction`: delete `await restoreInvite(...)` | sett-passord: «gives the token back» | |
| 23 | `setPasswordAction`: move `markActivated` before `updateUserById` | sett-passord: «only AFTER GoTrue accepted» — **only after that test was rewritten to record call order**. Against the original, order-blind `toHaveBeenCalledWith` version it stayed GREEN and the assertion that moved was «gives the token back»'s `expect(markActivated).not.toHaveBeenCalled()` | |
| 23b | `setPasswordAction`: `min(12)` → `min(6)`, message unchanged | sett-passord: the 11-character boundary case. The original short-password test pinned the MESSAGE, not the threshold | |
| 23c | `setPasswordAction`: delete the `permanent` classifier, return the transient message always | sett-passord: «reports a rejected password as rejected» | |
| 23d | `setPasswordAction`: let `markActivated` throw uncaught | sett-passord: «still redirects when the activation row cannot be written» | |
| 24 | `setPasswordAction`: delete the `consumeInviteAttempt` call | sett-passord: «over budget»; **and** action-guards `PRE_AUTH_REQUIRES` | |
| 25 | `proxy.ts`: `=== '/sett-passord'` → `.startsWith('/sett-passord')` | proxy: «exact, not a prefix» | |
| 26 | `proxy.ts`: move the `/sett-passord` exclusion **below** `if (!user)` | proxy: the unauthenticated GET test | |
| 27 | ★ `sendInviteEmail`: delete the `pending.isStudent` branch | invites: «refuses a pupil» (guardian stays green). ⚠ It reddens via an unhandled `TypeError` on `result.ok` — the injected `send` has no `mockResolvedValue` — not via any of the three `expect`s. Record it as such | |
| 28 | `sendInviteEmail`/`revealInviteLink`: resolve through `listPendingAccounts` instead of `invite_find_account` | invites: the new activated-account re-issue test. ⛔ This is S1, the stopper that would have shipped Phase 5 with no password reset at all | |
| 29 | `buildInviteEmail`: read and print an extra input field | invite-email: the `it.each` omission cases. ⛔ Against the ORIGINAL test — sentinels never passed in — this reddened nothing, which is why the test was rewritten | |
| 30 | `proxy.ts`: drop the `referrer-policy` header from the exclusion branch | proxy: «sends no Referer» | |
| 31 | `guardian_set_suppressed`: delete the `audit_log` insert | 39: 7 (D32) | |

⚠ **Mutation 24 is expected to redden in two suites.** If only one moves, the other assertion is weaker than it looks — investigate before writing it off.

⛔ **D29 needs FOUR mutations, not the two an earlier draft claimed.** That claim was arithmetically wrong and the review panel measured it:

| Mutation | 8 | 9 | 10 | unlinked |
|---|---|---|---|---|
| 5 — delete the `if` | **red** | green | green | green |
| 6 — over-revoke the whole condition | green | green | **red** | green |
| 6b — drop the `p_delivery = 'epost' and` conjunct | green | **red** | green | green |
| 6c — drop the `or private.has_role(…)` arm | green | green | green | **red** |

With only 5 and 6, assertions 9 and the unlinked-pupil case are watched by nothing — and 9 is the one that stops D29 being over-applied and locking every pupil out of their only activation path. "Two mutations are enough" was exactly the shape that let plan 3's leaking builder look covered.

⛔ **Mutation 6 could not run at all as originally written.** The over-revocation makes the two `'epost'` fixture calls at the top of the file raise; they were bare `select` statements, so the transaction aborted and the measured result was **zero TAP output** — not "assertion 10 red". Fixed by making those fixture issues `'skjerm'`. If you see the file die before `ok 1`, that is this, not a defect in the wall.

- [ ] **Step 3: Fill in the «Measured» column for every row**

For each: the assertion indices that **actually** went red, and — where they differ from the prediction — one line on what is really doing the protecting. A blank cell is an incomplete task.

- [ ] **Step 4: `db reset` and re-run the full pgTAP suite**

```bash
cd ~/dev/iqra-portal && npx supabase db reset && npx supabase test db
```

Expected: **the Task 15b ledger total / 41**, back to green. Anything else means a mutation survived the restore.

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

- [ ] **Step 2b: D32 — suppression, before the guardian rows above are undone**

| # | As | Do | Expect |
|---|---|---|---|
| 10b | admin | On a pupil with **two** guardians, set «Sperret innsyn» on one | The confirm step fires; the card shows the state. |
| 10c | suppressed guardian | Log in | Their **other** child is fully there; the suppressed child is **gone** — no thread, no oppslag, no fravær, no karakterer. ★ One clause, five surfaces. |
| 10d | the co-guardian | Open the same child | Unchanged. The suppression is about the person, not the child's record. |
| 10e | admin | Clear it | Access returns. A suppression that cannot be lifted is a different bug. |

⚠ 10c is the assertion that matters and it is easy to fake: check a surface **other** than messages, because `is_guardian_of` reaching attendance and grades is the claim, not just threads.

- [ ] **Step 3: The rest of Phase 5 — this is the gate for the PHASE, not for this plan**

⛔ Added after the review panel found the exit gate was thinner than the phase it gates. Økonomi had never logged in, no announcement had ever been published by anyone, the scheduled-publish path §5.1 calls **"the single most likely thing to be got wrong"** had never been exercised, and the disclosure block — the phase's own legal mitigation for D3/D4/D5 — had never been rendered on a screen.

| # | As | Do | Expect |
|---|---|---|---|
| 11 | teacher | Send a message to a family | The parent's bell shows it; **the teacher's own does not**. |
| 12 | teacher | Send ten messages in one thread | **One** bell entry, not ten (asserted in pgTAP, never clicked). |
| 13 | admin | Open **`/admin/varsler`** | ⛔ Built, builds clean, **nobody has ever looked at it**. Read the numbers and judge whether they mean anything. |
| 14 | **økonomi** | Log in | ★ The fifth role, never once exercised. Bell present; **no meldinger nav**; school-wide oppslag visible (D17 bans them from threads, §5.1 puts them in the announcement fan-out). |
| 15 | teacher | Publish a **class** announcement | Appears for the class's families and nobody else. |
| 16 | admin | Publish a **school-wide** announcement | Reaches every role in row 14's list. No e-mail is sent (D12). |
| 17 | teacher | Schedule an announcement for ~2 minutes ahead, then wait for the drain | ★ It fans out **at** `published_at`, not at creation. §5.1's most-likely-to-be-wrong path. |
| 18 | teacher | Open the read-tracking list on a class containing a **protected** pupil | The pupil is **omitted** *and* the denominator is reduced. §7 calls both "security controls, not polish". |
| 19 | admin | Open one thread via `admin/meldinger/[threadId]` | Exactly **one** `admin.threads.viewed` audit row. Then the teacher opens the same thread → **no** new row. |
| 20 | parent, pupil, teacher | Read the disclosure block on a thread screen | All **three** versions render, and each says what §4.2's copy says. ⚠ §12 Q3 lists that copy as **still open** — see Step 5. |
| 21 | parent | «Min profil» → turn the e-mail ping off | It persists; the in-app varsel still arrives (opting out stops the mail, never the varsel). |
| 22 | pupil | Try to reach a `kontor` thread | Refused (D19). |

- [ ] **Step 4: The things that have no local symptom**

- [ ] After the first deploy, read the **first real Vercel Cron invocation's status** off the log. A permanent 401 from a scheme-casing mismatch is invisible locally.
- [ ] Confirm Vercel accepted the **15-minute** interval in `vercel.json` rather than silently coercing it.
- [ ] `CRON_SECRET` and `RESEND_API_KEY` are set in Vercel for Production **and** Preview.
- [ ] Resend **log retention is at minimum** — an invite link in a provider log is a live credential.
- [ ] **Vercel's own log retention / log drains.** Sharper than Resend's: the token is in the request line and the query string of every `/sett-passord` request, so the platform log sees it on *every* hit, not once per send. The review panel found the plan hardened the provider's logs and ignored its own.
- [ ] **Supabase log settings.** The plaintext token is an RPC bind parameter. Locally `pg_stat_statements` captured zero rows matching a test token and `log_statement = ddl`, but the cloud settings are unverified.
- [ ] ★ **Does the reset end the victim's session?** D30 sells re-invitation as the password reset, and a reset's one job in an incident is ending the attacker's access. Leave a second browser signed in as the guardian, re-invite them, complete it, then refresh that second browser. **Expect: signed out.** If it is still signed in, `setPasswordAction` must also revoke the user's sessions — or D30 is not a reset. (PLAUSIBLE only; GoTrue's behaviour here was not tested.)

- [ ] **Step 5: The gate item that is not a click**

- [ ] ⛔ **§12 Q3 — the user's own edit of the three disclosure drafts, and the board's sign-off before pilot.** The spec lists it as *"still open, and still on the critical path for tasks 10–12"*, and §4.2 insists the copy and the policies are **one change, never two**. Row 20 renders whatever copy is in the code; this item is whether that copy is the copy IQRA has agreed to. **Phase 5 should not be declared complete with its own DPIA mitigation unreviewed.**

- [ ] **Step 6: Record the outcome, then finish the branch**

Once every row above is green, Phase 5 is complete. Use `superpowers:finishing-a-development-branch` to decide how `feat/phase-5-meldinger` is integrated.

---

## Execution ledger

Filled in **during** execution, not after. One row per task: the measured counts, every deviation from this plan, and — for Task 16b — the assertion indices that actually reddened.

⚠ The pgTAP/unit/api columns below are **expectations, not results** — overwrite each with what the run actually printed. Where they differ, the measured number is the true one and the difference is the finding. The unit column is left blank from 15c on because the plan does not predict it: Task 15c says «count what runs».

| Task | Commit | pgTAP (exp.) | unit (exp.) | api (exp.) | Notes / deviations |
|---|---|---|---|---|---|
| 14 | | 913 / 39 | 636 | 377 | comment-only migration; no assertion moves |
| 14b | | 921 / 40 | 636 | 377 | D32. +8 in the new `39_guardian_suppression.sql`; +1 marker (95 → 96); action-guards 83 → 84 |
| 15a | | 921 + `<N>` / 41 | 636 | 377 | `<N>` = counted plan of `40_invite_tokens.sql`; **≈26** (19 pre-review + Step 4b's ~7), so ≈947 — **not** the 940 an earlier draft predicted |
| 15b | | 15a + 3 / 41 | 636 | 377 | `plan(<N>)` → `plan(<N>+3)`; markers 96 → 106 |
| 15c | | = 15b | | 377 | |
| 15d | | = 15b | | 377 | action-guards 84 → 85 |
| 15e | | = 15b | | 377 | action-guards 85 → 87 |
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

---

# ★★ REVIEW PANEL LEDGER — 2026-08-06

Six lenses, run in parallel over the plan **before** any execution: SQL/schema, security threat model, test quality, Next.js/React, repo fidelity, spec intent + GDPR. Each was required to **execute** rather than read, and to label every finding CONFIRMED (ran it) or PLAUSIBLE (reasoned).

**~70 findings. My own self-review had found three.** That ratio is the argument for the panel, and it is the second time it has held on this project — plan 3's panel found ~78 after a careful self-review found 7.

Only the SQL lens was permitted to touch the database; the other five were read-only, so its measurements could not be contaminated. It left the stack at the plan-3 baseline (`913 / 39`, `max(version) = 20260807125000`, HEAD `7f90094`) — verified.

## What the panel confirmed as SOUND, by running it

Recorded so no later session re-litigates it:

- Every migration applies clean under `--single-transaction … ON_ERROR_STOP=1`. All 11 functions create. No argument-count error, no `search_path = ''` qualification error, and `extensions.digest` **is** reachable that way.
- `plan(19)` runs exactly 19 and `plan(22)` exactly 22, all green. `throws_ok(…, '42501', …)` matches the errcode actually raised. No polymorphic-`is()` type failure.
- Full suite after all three migrations: **935 assertions / 40 files** — the predicted number, exactly.
- Fingerprint arithmetic **95 → 103** is right; all 8 markers appear verbatim in `pg_get_functiondef`, each dot-qualified or carrying an operator, none duplicated within its body.

⚠ **Those two figures are measurements of a tree without Task 14b, and they stay as measured.** D32 was decided *after* this lens ran, and it adds a test file (+8 assertions, +1 file) and one fingerprint marker ahead of every invite migration. The numbers the executor should see are therefore **≈950 / 41** and **96 → 106**; 935 / 40 and 95 → 103 remain the correct record of what was actually run on 2026-08-06. Nothing about the measurement was invalidated — the offset is the whole difference.

⚠ **≈, not =.** Beyond D32's +8, Task 15a Step 4b adds about seven assertions that this lens never saw, because they cover SQL the review itself introduced. The exact total is whatever `plan()` counts at execution.

⛔ **Three of the ten markers are NOT covered by the "appear verbatim in `pg_get_functiondef`" verification above**, and this is the one place that gap matters: the fingerprint assertion compares against the *generated* definition, not against the migration source. Unverified:

| Marker | On | From | Present in the plan's SQL at |
|---|---|---|---|
| `u.deleted_at is null` | `public.invite_redeem(text)` | H2 | line ~969 |
| `s.student_user_id = p.id` | `public.invite_pending_accounts()` | M7 | line ~1064 |
| `not suppressed` | `private.is_guardian_of(uuid,uuid)` | D32 / Task 14b | Task 14b Step 1 |

Each is present verbatim in the SQL this plan tells you to write, so the expected outcome is that all three survive round-tripping. **Confirm it rather than assume it** — `pg_get_functiondef` re-emits the body as stored, and a marker that gets re-wrapped across a line break fails the `like` test while the wall it pins is perfectly intact. That failure mode reads exactly like a broken control and is not one:

```bash
cd ~/dev/iqra-portal && docker exec supabase_db_iqra-portal psql -U postgres -d postgres -tAc \
  "select pg_get_functiondef('public.invite_redeem(text)'::regprocedure)" | grep -c 'u.deleted_at is null'
```
- ★ **The concurrency claim HOLDS.** Two live sessions: A held `begin; invite_redeem('race-token')` open for 3 s, B called concurrently. A → the user id, B → `NULL`, one `consumed_at`. B blocked on the row lock and EvalPlanQual rejected it. The one-statement form does what the header says.
- `npm run db:types` generates exactly the six functions with the shapes the TypeScript consumes. `.maybeSingle()` is valid on `invite_attempt_consume`.
- Task 14 Step 7's precondition holds (`to_regclass` returns both tables) and Step 10's `obj_description … like '%ONE OF TWO buckets%'` returns `t`.
- The `audit_log` direct insert works through `FORCE ROW LEVEL SECURITY` (owner `postgres` has `rolbypassrls`), and `private.audit()` really does reject `admin.*` with 42501.
- `/sett-passord` under `src/app` needs **no** layout of its own — `src/app/layout.tsx` supplies the font, `globals.css`, `lang="nb"` and the base classes, exactly as for `logg-inn` and `mfa/*`. `/admin/kontoer` does get `PortalShell` via the admin layout.
- `export const dynamic = 'force-dynamic'` is **required**, not redundant: `scripts/check-csp-nonce.mjs` fails the build on a prerendered page shipping un-nonced inline scripts, and `/mfa/registrer` once shipped as a dead skeleton for exactly that reason.
- The hidden-token-input reasoning holds against the installed `react-dom@19.2.8`: `hasReadOnlyValue` includes `hidden`, so there is no controlled-field warning, and `initInput` sets `defaultValue` from `value`, so React's post-action `form.reset()` restores the same token.
- `redirect()` outside try/catch, and testing it via a throwing mock, are the repo's own precedent (`logg-inn/actions.ts:85`, `logg-inn/actions.test.ts:7-11`).
- Action counts **83 → 84 → 86** are right; `parseExports` matches only function/arrow-const forms, so the exported interfaces are invisible to it.
- `invites.test.ts`'s `vi.importActual` spread genuinely works — the override lands after the spread and the real `inviteUrl`/`generateInviteToken` stay live, which is what makes the `{43}` regex a real assertion.
- No existing pgTAP file is disturbed: `26_rls_force.sql` and `00_grant_firewall.sql` sweep **public** only, and this plan adds no public table.
- The `PRE_AUTH` exemption is genuinely load-bearing — `action-guards.test.ts:132` asserts against the action **body**, not the allowlist literal.
- All five `docs/spec.md` anchors, `README:145-147`, `PRODUCT.md:35`, all three Phase-4 spec anchors, `20260728182000:54`, `20260728200000:14-17` and `:235-241`, `20260728094000:4-11`, `drain/route.ts:125`, `proxy.ts:92` and `users.ts:59` are **verbatim exact**. The `c2` fixture prefix is genuinely free.

## ⛔ EXECUTION-STOPPERS — fix before Task 14 starts

| # | Lens | Finding | Disposition |
|---|---|---|---|
| **S1** | spec/GDPR | **D30's reset path has no button.** `invite_pending_accounts` excludes activated accounts; `sendInviteEmail` resolves *through that queue*, so an activated account gets «Kontoen finnes ikke». Task 16d row 10 is unexecutable and the phase would ship with **no password reset of any kind** — while `invite_mark_activated`'s own comment says re-issuing *is* the reset. | **FIXED** — Task 15e gains `public.invite_find_account(uuid)` (single-row, includes activated) which `sendInviteEmail`/`revealInviteLink` use instead of the queue; `/admin/kontoer` gains a «Finn en konto» lookup section for the reset path. pgTAP gains an assertion that an **activated** account can be re-issued and the old link dies. |
| **S2** | security | **D29's wall has a hole.** `unlinkStudentLoginAction` (`elever/actions.ts:373`) deliberately keeps the `student` role while clearing `student_user_id`, and deleting a `students` row does the same via `on delete set null`. My predicate then goes false → the account appears with an **e-mail button** and `invite_issue` permits `epost`. Every test stays green; the fixture only ever uses a linked pupil. | **FIXED** — predicate becomes relationship **OR** role, using the existing `private.has_role`, in **both** `invite_issue` and `invite_pending_accounts.is_student`. New pgTAP assertion for the unlinked pupil + its own mutation row. |
| **S3** | SQL | **Migration versions are ordered against task order.** Task 14 creates `…122000` and executes *first*; 15a/15b create `…120000`/`…121000`. Measured: `supabase migration up` → `LegacyMigrationMissingRemoteError`. Any database receiving Task 14's commit first — i.e. the cloud project being provisioned — refuses the later push. Invisible locally because every task does a full reset. | **FIXED** — Task 14's migration renumbered to `20260808110000`; D32 takes `20260808111000`. Versions are now monotonic with execution order. |
| **S4** | test + SQL | **The privacy test cannot fail, and its mutation aborts the file.** `buildInviteEmail` takes `{inviteUrl, validDays}`, so the `ZZ…` sentinels are never passed in — the loop passes for any body. And mutation 6 makes the bare `'epost'` fixture calls raise, aborting the transaction before `ok 1`: measured as *zero TAP output*, not "assertion 10 red". **Assertions 9 and 10 have no mutation that reddens them.** | **FIXED** — the omission test spreads sentinels **through the parameter** with a cast (the `ping-email.test.ts` mechanic, whose own comment records that the version without it scored 6/6 green against a leaking builder); the two fixture issues become `'skjerm'`; mutation **5b** added for assertion 9. |
| **S5** | Next + repo + test | **Two proxy tests are broken in a way that passes.** `request()` at `proxy.test.ts:45` takes **one** argument — session state comes from the module-level `getUser` mock. The two-arg form is TS2554 (fails `npm run typecheck`) and, under vitest's transpile-only esbuild, the extra argument is *dropped*, so the "signed-in" test runs against `user: null`. It also **cannot fail even when correct**: a signed-in non-staff user reaches `respond()` regardless. | **FIXED** — one-argument calls throughout; the fourth test becomes staff-at-AAL1, the only case the exclusion changes. |
| **S6** | test | **The mutation harness cannot restore grant mutations.** Rows 10/11 are grants; `create or replace function` preserves the ACL and `pg_get_functiondef` never renders one, so the diff is empty and the harness prints **`✓ restored`** while `authenticated` still holds EXECUTE. Failure modes 2 and 3 from the plan's own preamble, reproduced inside the harness written to prevent them. | **FIXED** — Task 16b Step 1 gains a second, explicit restore idiom for DDL/grant mutations (the matching `REVOKE`, verified by re-running the assertion rather than by diffing a definition). |

## HIGH — fixed in this revision

| # | Lens | Finding | Fix |
|---|---|---|---|
| H1 | security + SQL | **The "global prune" does not exist.** The `attempted_at` index comment claims one; the only `delete` is bucket-scoped, so an IP that never returns leaves a permanent row — on an unauthenticated endpoint that fails open, storing IP addresses. 5 000 rows inserted, none reachable by any prune path. | Adds `public.invite_attempts_prune()` mirroring `login_attempts_prune()`, with the same revoke/grant pair. |
| H2 | SQL | **`invite_redeem` has no `deleted_at` check.** Measured: an invite issued before a soft-delete still redeems, so `updateUserById` runs on an erased account and `invite_mark_activated` writes a fresh row for it. The wall exists only on the read side, while the fingerprint comment claims it protects against "a live invite path into an erased identity". | Add the check to **both** `invite_redeem` and `invite_issue`; pin `deleted_at` as a marker on redeem; assertion + mutation row. |
| H3 | SQL | **`private.invite_attempts` is in no grant assertion.** Assertion 17's table list stops at `invite_tokens`/`account_activation`. Measured: `grant select on private.invite_attempts to authenticated` reddens **nothing**, and `authenticated` already holds `USAGE` on schema `private`. The table stores IP addresses. | Add it to assertion 17 and add the mutation row. |
| H4 | repo | **`src/lib/auth/invite.ts` breaches the quarantine.** `quarantine.ts:13-15` says `createServiceRoleClient` is for siblings in `src/lib/admin/` only; no lint rule enforces it, so this would compile and pass CI as the first `src/lib/` module to cross it. | Move the four RPC wrappers to `src/lib/admin/invite-tokens.ts` as quarantine **category B** (the `rate-limit.ts` contract, which they satisfy verbatim). `src/lib/auth/invite.ts` keeps only the pure helpers. Also resolves K1. |
| H5 | Next | **knip fails Task 15c at error level** on four *function* exports (`issueInvite`, `redeemInvite`, `restoreInvite`, `markActivated`) with no consumer until 15d/15e. My warning named `PORTAL_URL` and `InviteDelivery` — and per `knip.json`, **types are warn-only**, so it targeted the two symbols that cannot fail the gate. | Cover all four in the library test (they need tests regardless: nothing currently asserts `issueInvite` passes all four RPC args, or that `restoreInvite` swallows rather than throws). |
| H6 | Next | **The one-time link can render in the wrong pupil's card.** `invite_pending_accounts` orders `issued_at asc nulls first`, so issuing moves that row to the **bottom**; `revealInviteLinkAction` then calls `revalidatePath`, re-sorting the list while a non-recoverable credential is on screen. Keyed by index, hook state stays bound to the position. | Key on `account.userId`, stated explicitly in the code. Drop `revalidatePath` from the reveal action. |
| H7 | security | **Every GoTrue failure is treated as "not the user's fault".** No classifier, against the `isCredentialFailure` precedent. If the cloud project's password policy rejects a passphrase (422), the parent is told the system had a hiccup and to try again — forever. | Classify permanent 4xx vs transient; restore the token in **both** cases; add the 422 unit test. |
| H8 | security | **A `markActivated` failure tells the user their link is dead when their password already works.** It throws → 500 → they click the link again → «Lenken er ugyldig eller utløpt». They phone the school about a working password, and the admin mints another credential. | Make it non-fatal (log and continue); the activation row is bookkeeping, nothing authorizes on it. Unit test. |
| H9 | security | **No way to revoke an invitation, and no cap on issuance.** A mistyped address sends a live 7-day credential to a stranger whose only kill switch is minting *another* one. A hijacked admin session can blast the school from IQRA's verified sending domain. | Add `public.invite_revoke(target)` + «Trekk tilbake invitasjonen» + `admin.invite.revoked` audit. Cap issuance per actor using the `invite_attempts` construct pointed at `p_issued_by`. |
| H10 | spec/GDPR | **Two new permanent stores the pupil-erasure unit cannot reach**, plus an un-rotatable per-child audit row in a table with no DELETE grant for anyone. `students.student_user_id` is `on delete set null`, so deleting a `students` row never touches `profiles`. This is §10.11's exact failure mode, twice more, and §10.8's minimisation instruction ignored. | Drop `expires_at` from `meta` (derivable from the row). Extend §10.11's list from three to five with the explicit Phase-7 instruction. State a retention rule for consumed/expired tokens. |

## MEDIUM — fixed in this revision

| # | Finding | Fix |
|---|---|---|
| M1 | The proxy exclusion sits above the role/AAL2 read, making `/sett-passord` the first path where an authenticated staff session at AAL1 skips the MFA gate. | Scope to `!user &&`. A signed-in parent still falls through to `respond()`. |
| M2 | The token leaks via same-origin `Referer` on every subresource — `strict-origin-when-cross-origin` sends the **full URL** same-origin. The plan hardens the provider's logs and ignores its own. | `Referrer-Policy: no-referrer` on the exclusion branch; `history.replaceState` after hydration; Vercel log retention added to 16d. |
| M3 | The 12-character minimum — the plan's headline password decision — is pinned by nothing. The test asserts `/12/` against the *message*, so `min(12)` → `min(6)` stays green. | Boundary test at 11 and 12 characters. |
| M4 | `formatDateNb` throws on timestamptz (correct), but the prescribed fallback `toLocaleDateString('nb-NO')` is documented as a bug at `dates.ts:26` — no `timeZone`, server runs UTC. The grep I prescribed returns nothing usable. | Name the real pair: `formatDateNb(osloDateOf(v))` for a date, `formatDateTimeNb(v)` for date+time — the `AnnouncementList.tsx:48` precedent. |
| M5 | Two `useActionState` hooks in `InviteCard` with no state adjustment: a failed send's error renders **beneath** the one-time link from the other action. `NO_API_KEY` is the expected state until Resend exists, so this is the default experience. | Apply `LoginCard.tsx:49-76`'s adjust-during-render idiom; write `InviteCard` out as code rather than prose. |
| M6 | `logThrottleFailure` hard-codes «GoTrue-hooken gjelder fortsatt» — false for the invite path, which the plan itself says has no backstop. | Parameterise the backstop clause. |
| M7 | `invite_pending_accounts.is_student` is uncovered in both suites. Measured: replacing the projection with `false` reddens **nothing**, and every pupil gets an e-mail button. | Assert `is_student` directly for pupil and guardian; add `s.student_user_id = p.id` as a marker; mutation row. |
| M8 | The two TTLs (24 h vs 7 days) are unasserted and unpinned — swapping the arms reddens nothing. | Ordering assertion + marker. |
| M9 | The limiter's *window* is unasserted: deleting `attempted_at >= now() - v_window` turns a 15-minute limiter into a permanent per-IP ban on a school that shares one NAT. | Assertion with rows aged 20 minutes. |
| M10 | No clear-on-success, against the `clearLoginAttempts` precedent. An admin walking families through activation on school wifi hits the cap at the 21st family. | `public.invite_attempts_clear(p_ip)` called after a successful redemption. |
| M11 | The limiter header claims it defends bcrypt CPU. It cannot: `updateUserById` is only reached **after** a successful redeem, so a bogus token never touches GoTrue. | Correct the header — it defends against endpoint flooding and its own write amplification. |
| M12 | `invite_issue`'s `p_issued_by` is caller-supplied and written verbatim to `audit_log.actor_id`; nothing says it must come from `requireAdminActor()`. | State it in both the SQL comment and the wrapper's doc. |
| M13 | D30 is not a full reset for staff: a lost second factor still needs the dashboard, and there is no in-app MFA recovery. | One sentence in D30's cost column; a 16d row. |
| M14 | `/logg-inn` has no recovery instruction, so D30's stated cost is unpayable by the person paying it. | Add the line with the school's number. Also record the **admin lockout** case: if the only admin loses their password, nobody can re-invite anyone. |
| M15 | The privacy copy handed to Phase 7 says "7-day" (wrong for `skjerm`), "and nothing else" (the body also carries the phone number and validity), omits the on-screen pupil link as a processing disclosure, omits retention, and asserts "US processor **with SCCs**" as fact when §5.2 records the Resend DPA is **not signed**. | Correct all five; write the transfer mechanism as undetermined until the DPA exists. |
| M16 | D29's rationale claims the school "never needs a working address for a 13-year-old". False — `provisionStudentLoginAction` **requires** one and `LoginCard.tsx:128` renders it `required`. The school collects it; D29 stops it being *used*. | Correct the rationale. Also copy plan 3's actual reason into the SQL header: a pupil's address in **Resend's US-held logs** (`20260807123000:1289`). |
| M17 | `AdminNav.test.tsx` does **not** assert the entry set — my claim was false, and an executor would hunt for an assertion that does not exist. | Correct the claim; specify the assertion to add. |
| M18 | The fingerprint file's **header** goes stale: "TWENTY-ONE functions", "live SECURITY DEFINER count is 60". The plan adds 5 entries and 6 definers and updates neither — on the file whose own header records a reader auditing its scope note as a coverage guarantee. | Step 5b: update both numbers from the header's own query. |
| M19 | Task 15b says "**six** definer fingerprints" for **five** entries — the third occurrence of this defect class on this file. | «five». |
| M20 | The five new `private.*` helpers are `EXECUTE TO PUBLIC`, and `authenticated` holds `USAGE` on `private`. Inconsistent with `private.audit` / `private.has_role`, which revoke from PUBLIC. | `revoke execute on function private.invite_* from public;` |

## Counts corrected

| Claim | Was | Measured | Source |
|---|---|---|---|
| unit baseline files | 58 | **57** | ran `vitest run` → 636 passed / 57 files |
| unit after 15c | 636 → 647 | **648** (`invite.test.ts` has 6 `it`s, not 5) | counted |
| unit after all tasks | not stated | **665** before the new assertions this ledger adds | counted |
| fingerprint entries | "six" | **five** | counted |
| fingerprint markers | 95 → 103 | **96 → 106** — Task 14b's `not suppressed` moves the baseline, and H2 + M7 add a marker each | counted, then recount at execution |
| `users.ts` comment | :19-23 | **:19-24** | grep |
| `LoginCard` `text-danger-ink` | :92 | **:93** | grep |
| `README.md` SMTP block | :119-125 | **:119-124** | grep |

## Mutation-table corrections (Task 16b)

Measured by the SQL lens, one at a time, with capture → mutate → run → restore → diff:

- **Row 2** also reddens **39: 11**, and makes assertion 7 pass for the wrong reason.
- **Row 5** also reddens **39: 18** — ★ **assertion 18 is a second D29 control**, which the plan did not know.
- **Row 6** produces **no TAP output at all** (see S4). Fixed by the `'skjerm'` fixture change.
- **Row 12** also reddens **39: 19**.
- **Row 23** is wrong: the happy-path test is order-blind (`toHaveBeenCalledWith` does not observe order), so it stays green. The assertion that moves is test 5's `expect(markActivated).not.toHaveBeenCalled()`. **The test whose title claims the ordering property is the one test that cannot see it.** Replaced with an explicit call-order array.
- **Row 27** reddens via an unhandled `TypeError` on `result.ok`, not via any of its three `expect`s.
- **Row 14** needs `FN="private.invite_attempt_limit()"`; **row 15**'s file is **29**, not 39.
- Rows 1, 3, 4, 7, 8, 9, 10, 11, 13, 16–22, 24, 25 verified correct as predicted.

**~20 of ~45 new assertions had no mutation row and no named skip**, in a task that opens by forbidding exactly that. The revised table closes the gap or names each skip.

## Grant assertions — rewritten in the house idiom

Assertions 16/17 use `information_schema.role_routine_grants`, which has **zero precedent** in this repo; `00_grant_firewall.sql` uses `pg_class` + `aclexplode` and `31_column_locks.sql:224-232` documents why. The SQL lens confirmed they are non-vacuous *as written*, but two lenses independently recommended the safer form. Rewritten as `has_function_privilege('anon', …, 'execute')` negatives **plus a `service_role` positive control**, so the assertion cannot go vacuous through a typo'd grantee.

Also corrected: the ⚠ justifying the `revoke` lines blames `supabase_admin`'s default ACLs. Migrations run as **`postgres`**, whose defaults this project already narrowed — so the revokes are defence-in-depth against those defaults changing, not against a different applying role. Measured: the assertions pass with the revokes deleted, and redden under an added grant.

## Accepted without change, with the reason

- **The rate limiter degrades under true concurrency** — 30 simultaneous calls against `limit 20` gave 22 `t` / 8 `f`, because each call's uncommitted insert is invisible under READ COMMITTED. Identical to the `login_attempt_consume` precedent and acceptable for an anti-DoS limiter. Only the migration comment overclaimed; softened.
- **`invite_restore`'s `expires_at > now()` is unpinned and untested.** Harmless — redeem re-checks expiry. Recorded as defence-in-depth rather than claimed as covered.
- **pgTAP assertion 3 (`count(*) = 1`) is near-tautological** with `user_id` as PK. Kept as a tripwire, named as one.
- **Plaintext token as an RPC bind parameter.** `pg_stat_statements` captured 0 rows matching any test token locally. Cloud log settings unverified → added to the 16d checklist rather than asserted either way.
- **D30 lets an admin mint a credential for any account, including another admin's**, and a never-activated staff account has no second factor to stop the takeover. Not fixed — IQRA has one or two admins who already hold the service-role blast radius. **Now stated in D30 rather than left implicit**, with `admin.invite.reset` distinguished from `admin.invite.issued` in the audit, and a content-free "your login was reset" ping to already-activated accounts.

## Decisions taken from the panel — D32, and the exit gate

- **D32 — a guardian suppression flag ships in this plan.** §10.7's "decide before pilot" decision point is this plan, because this is what turns every registered guardian into an actual reader. New **Task 14b**: `guardian_student.suppressed`, consulted by `private.is_guardian_of` **and** by the invite queue, with pgTAP and an admin control. The user chose this over deferring with a recorded risk.
- **Task 16d widens to the whole phase.** As written it gated the invite flow plus three leftovers while økonomi never logged in, no announcement was ever published, the scheduled-publish path §5.1 calls "the single most likely thing to be got wrong" was never exercised, and the disclosure block — the phase's legal mitigation, whose copy §12 Q3 still lists as open — was never rendered by anyone.

## Still open, and deliberately so

- **§12 Q3** — the user's own edit of the three disclosure drafts and the board's sign-off. On the critical path for tasks 10–12 of the *phase*, and now an explicit unchecked item in the exit gate.
- **The phase spec still carries its `⛔ THIS DRAFT HAS NOT BEEN REVIEWED … Nothing here may be implemented yet` header**, after three code-complete plans. Task 14 is the reconciliation task and should clear it, and append D29–D32 to §1's decision table with the exception note under D12/§5.3.
- **Vercel Cron's actual request** and the **15-minute interval** — unchanged, still blocking, still 16d items.

---

## Consistency pass — 2026-08-06, after the ledger was applied

The review panel's ~70 findings were applied to the plan body in the preceding session. This pass re-read the **result** rather than the findings, and found that applying them had left the document internally inconsistent in five ways. None of these were in the panel's output; all five are artefacts of the edit itself.

| # | What was wrong | Why it mattered | Fix |
|---|---|---|---|
| **C1** | ⛔ **`public.invite_find_account(uuid)` was granted in Task 15a's migration and defined in Task 15e's.** | Task 15a's `npx supabase db reset` **aborts on its own migration** — `revoke execute on function` against a function that does not exist, under `--single-transaction … ON_ERROR_STOP=1`. A dead stack three tasks before 15e runs. Same class as plan 3's 4-arg-called-with-3. | Definition moved into 15a beside `invite_pending_accounts`; 15e Step 1b keeps the rationale and states why it must not move back. |
| **C2** | ⛔ **Task 15a's `plan(19)` is the pre-review count.** The panel added `invite_revoke`, redeem's `deleted_at` check, `invite_find_account`, prune/clear and the window clause, and specified assertions for each — none were written. Five mutation rows point at *"the new …"* assertions that do not exist. | Five ledger fixes ship with nothing watching them, and the mutation pass at 16b silently has no target. | New **Step 4b** enumerates the seven; Step 5 sets `plan()` from a count, not a literal. |
| **C3** | Inserting Task 14b (D32) shifted every downstream count by **+8 assertions and +1 file**, and none moved: 932/40, 935/40, markers 95→103. | Every "if the total is not X, find the difference" instruction sends the executor hunting a phantom 8. | pgTAP chain → 913/39 → **921/40** → `921+<N>`/41; markers → **96 → 106**. |
| **C4** | H2's and M7's markers were specified in the ledger but absent from Task 15b's arrays, while the ledger's own total (`103 → 105`) counted them. | The literal and the arrays disagree by two — on the file whose header records this exact defect **twice**. | Both folded into the arrays; total restated as 2+3+2+2+1 = 10. |
| **C5** | The manifest still read "the four token RPCs", "Counter 83 → 84", and listed none of D32's six files. | The manifest is what an executor reads to know what they are building. | Seven RPCs, 83 → 87, D32's files added. |

**What this pass did not do:** it did not re-verify the panel's measurements, and it deliberately left them as recorded — `935 / 40` and `95 → 103` are correct for the tree they were run against, annotated rather than overwritten. Three of the ten fingerprint markers (`u.deleted_at is null`, `s.student_user_id = p.id`, `not suppressed`) are confirmed present in the plan's SQL but **not** against `pg_get_functiondef`; that check is now an explicit instruction rather than an assumption.

★ **The lesson, and it is the same one twice now.** The panel found ~70 defects the author's self-review found 3 of. This pass found 5 more that the panel could not have found — because they did not exist until its own fixes were applied. **Applying a review is an edit, and an edit needs a review.** C1 alone would have stopped execution at the first `db reset`, and it was created by the fix for S1.
