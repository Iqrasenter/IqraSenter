# Plan 3 (varsler) — independent review panel, 2026-08-05

Six read-only lenses over `2026-08-07-iqra-portal-phase-5-notifications.md`, each told to verify claims against the tree rather than against the plan's own consistency. This file is the adjudicated ledger; the plan itself carries the fixes.

**Panel status:** claims-vs-tree ✅ · concurrency ✅ · RLS ⏳ · pgTAP ⏳ · route/secret ⏳ · privacy ⏳

⚠ Findings are **not** taken at face value. Each is marked with how it was settled. The precedent: on the Phase-5 spec panel one lens cleared a multi-enrolment case another had correctly flagged as critical, and the flag was right.

---

## Lens A — claims about the repo (14 findings, all adjudicated REAL)

Verified by me directly unless noted.

| # | Finding | Settled |
|---|---|---|
| A1 | `npm run test:db` / `test:unit` **do not exist** (9 + 2 uses) | ✅ measured — `Missing script`. Already fixed as R7 before this lens reported. pgTAP is `npx supabase test db`; unit is `npm test` |
| A2 | `@/lib/auth/guards` **does not exist** — `requireRole` is `src/lib/dal/session.ts:47`, `requireAdminActor` is `src/lib/admin/quarantine.ts:55` | ✅ measured |
| A3 | ★ `requireRole(role: Role)` takes **one** role and returns `{user, roles}` — plan passed an array and destructured a bare user | ✅ measured. `.eq('id', undefined)` would make the opt-out toggle **silently save nothing** — the exact failure Task 2's grant exists to prevent |
| A4 | ★ fixture prefix `c0` is **taken** — file 37 carries 200 `c0…` ids incl. the exact 001–014 this plan claimed | ✅ measured. Moved to **`c1`**, verified free across `tests/*` + `seed.sql` |
| A5 | ★ Task 4's reset omits `delete from public.assignments` — `assignments.class_id` is an ON DELETE RESTRICT edge; the seed holds every class alive | ✅ file 37:25-31 documents this verbatim. 23503 would abort the file **including the 27 assertions already green** |
| A6 | `students.birth_year` is `not null` with no default — plan's insert omits it | ✅ measured, `20260717164230:15` |
| A7 | ★ `announcements_not_backdated check (published_at >= created_at)` forbids Task 5's assertion-32 setup — in one pgTAP transaction `now()` is frozen, so `now() - 1 min < created_at` | ✅ reasoned + constraint read. 23514 |
| A8 | Task 1 assertion 7's insert runs as `authenticated`, which assertion 3 proves has no INSERT grant | ✅ 42501 aborts the file. Needs `reset role` around it |
| A9 | No existing "unread-dot anatomy" to reuse — zero `size-2` / `rounded-full bg-` under `src/` | ✅ the instruction resolved to "invent a badge", which the same sentence forbids |
| A10 | `forelder/oppslag/actions.ts` does not exist — the pointer that would have caught A2/A3 | ✅ only `admin/` and `laerer/` have one |
| A11 | `okonomi/` has **no Nav file** — the plan's conditional silently resolved to "økonomi gets no bell" | ✅ resolved better: all five layouts share `@/components/shell/PortalShell`, so the bell and «Min profil» belong there, not in per-role navs |
| A12 | `reads_announcement_row` citation `:~400` wrong (clause at `:301`, fn at `:294`) | ✅ cosmetic, but it is the citation supporting the headline finding R6 |
| A13 | Fingerprint counter said **88** in three places against **93** in two | ✅ 2+2+3+1+2 = 10 new markers. The file's own comment warns this reconciliation error has been made twice |
| A14 | ★ `formatDateNb(isoDate)` builds `` `${isoDate}T12:00:00Z` `` → **Invalid Date** on a timestamptz; `formatDateTimeNb` is the instant helper | ✅ `dates.ts:19-23` says so explicitly. The bell would throw at render on every row |

**Verified TRUE and not to be re-checked:** `allActions.length === 79` · fingerprint literal `83` over 21 entries with `plan(2)` · **pgTAP 842 across 38 files** (I re-measured: `Files=38, Tests=842, PASS`) · running totals 857→859→871→885→897 all add up · zero `route.ts` · `vercel.json` has no crons · no mail dependency · `profiles` column-grant idiom · proxy matcher covers `/api`, `DENIED_PATH` at `:79`, `!user` at `:81` · `createServiceRoleClient` at `quarantine.ts:45` behind `server-only` · exactly two publish actions · every table/column shape and every `private.*` predicate signature the plan's SQL calls · the `or private.has_role(uid,'admin')` clause · knip errors on unused exports.

---

## Lens B — concurrency and idempotence (12 findings; 4 verified empirically against the live stack)

This lens ran experiments in rolled-back transactions. The measured ones are marked ⚗.

### The severe cluster — a drain that dies strands rows **forever**

| # | Finding | Settled |
|---|---|---|
| B1 | ★★ **Stranded rows are unrecoverable.** The claim requires `claimed_at is null`; only `record_email_ping_outcome` and `reset_failed_ping` clear it, and the latter is `where … and failed` — a stranded row has `failed = false`. The admin screen lists only `failed`, so it never appears. Those users never get a ping again, for the life of the row | ✅ REAL. Trigger is the **first busy drain**: 100 sequential provider round trips, no `maxDuration` anywhere in the repo, no wall-clock budget |
| B2 | ★★ **And it permanently poisons the dead-cron detector.** `oldest_pending_minutes` is `max(now() - next_attempt_at)` over `pending and not failed` — a stranded row qualifies forever, so the number grows without bound and never returns. After the first strand, the admin page's «check the cron log» instruction is permanently wrong | ✅ REAL — this is the number Task 13 exists for, and B1 kills it |
| B3 | ★ The `catch` block's own `await deps.recordOutcome(…)` is **unguarded**; the route has no try/catch. A DB blip throws out of the loop and strands the whole remaining batch. The comment above it states the invariant the code does not enforce | ✅ REAL. `drain.test.ts` tests `send` rejecting but **never `recordOutcome` rejecting** |
| B4 | ⚗ `attempts` **can reach 6 → 23514**, measured. A committed RPC whose response is lost → `catch` → second `recordOutcome` → 6. Also silently double-increments below 4, so the real ceiling is variable | ✅ REAL, measured. No guard that the row is still claimed |

### The operational cluster

| # | Finding | Settled |
|---|---|---|
| B5 | ★★ **D28 guarantees a mass poisoning on day one.** All error classes are equal, so `NO_API_KEY` burns the ceiling: cron at `*/15` × 5 = **75 minutes** to `failed = true` for every pending user, each needing an individual manual reset. Same shape for Resend's 2 req/s free-tier limit against 100 unpaced sequential sends | ✅ REAL, and it directly defeats D28's stated intent |
| B6 | ★ Opting out **manufactures false failed entries and is one-way.** `setEmailPingsAction` never touches `email_pings`; a pending row then fails `NO_ADDRESS` ×5 → listed to admin as «kom ikke fram» for someone who asked not to be mailed. Opting back in does nothing — `failed` still true | ✅ REAL. A preference toggle must not need an administrator to undo |
| B7 | ★ **The count is about the one entity kind mail is forbidden to be about.** `unread_count` counts *all* notifications, but announcements never queue mail (D12). A stale unread class notice keeps the skip path from firing, so an e-mail goes out about something already read — after any school-wide notice, every pending ping ships an inflated count | ✅ REAL. Also: the skip path stamps `sent_at = now()` for a send that never happened |
| B8 | `claim_due_announcements` has **no batch bound** and runs *first* in the route. A backlog → oversized transaction → timeout → rollback → next tick attempts the identical batch. A poison batch stops **all** school e-mail, because the ping drain never runs | ✅ REAL |

### The correctness cluster

| # | Finding | Settled |
|---|---|---|
| B9 | ⚗ `thread_recipients` is called **twice under two different snapshots** (measured: call-1 = 2, call-2 = 3 with a concurrent commit between). Sets can diverge → a ping with no bell entry, or the mirror. Also doubles predicate cost on the hottest write | ✅ REAL, measured |
| B10 | ★ **The mail queue has a veto over the source of truth.** Both inserts are in the message's transaction, so a lock-wait, statement timeout, deadlock between overlapping recipient sets, or any constraint violation **rolls back the teacher's message**. D29 records this shape for BYPASSRLS as a one-off; it is structural | ✅ REAL |
| B11 | A fan-out that reached **nobody** is indistinguishable from success — both call sites `perform` and discard the count, and `fanned_out_at` is already burned. ⚗ Measured: `row_count` after `on conflict do update` is 2 for two rows that changed nothing. Related: on a late claim, the carve-out's `ann.published_at` excludes a guardian added since, who can open the notice but is never belled and can never be re-fanned | ✅ REAL |
| B12 | Duplicate sends are reachable **via retry**, not via double-claim: a provider that accepted then timed out yields `attempts++` and a re-send, up to 5×. No `Idempotency-Key`. `record_email_ping_outcome` takes no fencing token and does not check the row is still claimed | ✅ REAL |

### Attacked and found SOUND (do not re-litigate)

- `for update skip locked` in both claims — two overlapping drains genuinely cannot claim the same row. `LIMIT` sits above `LockRows`; a competitor re-checks the qual under EPQ.
- ⚗ The watermark's old-value semantics: `pending = (queued_seq <> claimed_seq)` in the SET list reads **pre-UPDATE** values, so a message arriving between claim and outcome keeps `pending`. Assertion 16 tests the right thing.
- ⚗ **R4's rewrite is correct and fixed a real defect.** `FOR rec IN WITH c AS (UPDATE … RETURNING …) SELECT * FROM c LOOP` is accepted in plpgsql (the DECLARE CURSOR restriction does not apply), the side effect fires exactly once per row, and the portal is `PORTAL_ONE_MOD_WITH` — all rows are stamped before the first loop body.
- Neither fan-out can produce duplicate recipients (UNION dedupes; `select distinct`), so no 21000 for a user holding two roles.
- No OUT-parameter shadowing in `claim_email_pings`.

---

## Lens C — RLS / privilege escalation (6 findings; all executed against the live stack)

| # | Finding | Settled |
|---|---|---|
| C-F1 | ★★★ **CRITICAL, measured. `thread_recipients` launders bare oversight through the `teachers` arm.** `reads_thread_row`'s FIRST arm is a bare `private.has_role(uid,'admin')` (`20260805123000:49`), so `substantive` means "candidate ∩ reads-for-**any**-reason", not "reads for a substantive reason". A **teaching rektor** (`teacher`+`admin` — the repo says this is a real person here, `20260805120000:22-26`) is a candidate via `teachers` and passes via the admin arm → **gets a bell and an e-mail telling them a `kontor` thread about their pupil exists.** That is drift #1 the design claims to have eliminated. **Compounding:** they also land in `staff_substantive`, so the rollover fallback never fires and the family's office message reaches only the teacher `kontor` exists to exclude | ✅ VERIFIED by me at `20260805123000:49-52`. Assertion 26 is structurally blind — its teacher holds no admin role. **Fix: `and t.kind = 'laerer'` on the `teachers` CTE** (narrowing-only, cannot admit anyone), plus a fixture actor holding both roles |
| C-F2 | ★★ The `notified ⊆ readers` invariant is **write-time only**. A deleted announcement or an erased pupil leaves a permanent phantom badge count **that gets mailed** | ✅ REAL. Merges with B7 and D2 — one fix: predicate-filter the count |
| C-F3 | ★ `fan_out_announcement`'s candidate set is `user_roles`, which is **narrower** than the read predicate — the direction the plan explicitly forbids. Measured: a guardian with a live enrolment and no `user_roles` row **can read** and is notified of nothing. Latent today; plan 4's offboarding makes it live | ✅ REAL, and silent in the worst way — the notice is visible, so nobody reports it |
| C-F4 | Task 13's two new RPCs have **no grant assertion and no fingerprint**. A later migration re-creating either without the revokes leaves it **authenticated-callable in cloud only**; `reset_failed_ping` mutates state | ✅ REAL. Fix: extend assertion 11's list from three names to five |
| C-F5 | `students.birth_year` — duplicate of A6 | ✅ measured, same fix |
| C-F6 | fingerprint 88 vs 93 — duplicate of A13 | ✅ already fixed |

**Cleared:** every revoke/grant ordering · role naming on all four `public` RPC revokes (and confirmed `private` needs only `from public`, since `pg_default_acl` has no `private` entry) · `set search_path = ''` complete on all ten functions · the `notifications` policies · D29's BYPASSRLS claim · **the admin carve-out in `fan_out_announcement` is correct** — measured: an admin who is also a guardian **is** notified, because it keys on `guardian_in_class_asof`, not the role.

---

## Lens D — privacy (10 findings; two measured)

| # | Finding | Settled |
|---|---|---|
| D-1 | ★★★ **The content-free promise has no working test. MEASURED.** `it.each` spreads `{ [_label]: secret }` where `_label` is the **human description** (`'a pupil name'`), not a field name. The lens copied the test verbatim, wrote a deliberately leaking builder — subject *"…fra Leila"*, body *"…om Yusuf"* — and got **6/6 green**. Task 7 is the one task with **no mutation step**, and this is the only assertion anywhere that the mail carries no child data | ✅ REAL. ⛔ This repo has already shipped *"a privacy wall whose test could not fail"* once. My own comment stated the false reasoning aloud: *"proves the TYPE cannot carry it by proving the OUTPUT never does"* — it proves neither |
| D-2 | ★★ **The unfiltered badge count is an exact count of what you may not see** — and it is the number the school e-mails you. Five ordinary events falsify it (guardianship removed, `class_teachers` removed, term rollover, pupil erased, login disabled). A parent who loses guardianship of one child learns by subtraction that **three** conversations about that child had new activity | ✅ REAL. The lens ties it to `20260803001000_protected_mate_omission.sql`'s own words — omission recoverable by arithmetic — and concludes **"Plan 3 ships only the first half."** Correct |
| D-3 | The T-12 fixture deletes `notifications` **one line after** removing `class_teachers`, so the invariant only ever scans rows created after the relationship change — it cannot observe the failure that actually occurs | ✅ REAL. Removing that delete makes assertion 28 go red against correct-per-the-plan code, which is the point |
| D-4 | The count is not "new messages" (announcements inflate it), **and the stated reason for freezing the subject is factually wrong** — mail clients render subject **plus a body snippet**, and the body's first line carries the count anyway | ✅ REAL. Keeping the count is settled; believing it is *hidden* is a false rationale that would let a future engineer think the lock-screen surface is handled |
| D-5 | ★★ **No pupil carve-out on the mail path.** A `laerer` thread admits the pupil's own login; pupil accounts are real auth users with real addresses; `email_pings_enabled` defaults **true**. So a 13-year-old is e-mailed about parent–teacher exchanges concerning themselves, and their address goes to Resend. «Ingen alarmstrøm til barn» is enforced in the bell and **nowhere else** | ✅ REAL — **needs a user decision, not a fix** |
| D-6 | `resetFailedPingAction` breaks the quarantine's stated contract **twice**: service-role imported outside `src/lib/admin/`, and **no audit entry** — where every existing consumer writes one and throws if the audit write fails | ✅ REAL. It re-queues school e-mail to a named family with no trace of who did it. **Answers Q7:** `notifications` itself needs no audit trigger, on the `announcement_reads` precedent (*"the row IS the record"*) — say so in the header |
| D-7 | The drain imports the quarantine for **the wrong stated reason** — I justified it with `server-only`, which is `env.server.ts`'s job; the quarantine's actual contract is *"the SOLE wall if the proxy ever fails"*, which re-verifies a **human** caller the drain does not have | ✅ REAL. Merges with route-lens LOW 9 |
| D-8 | ★ **Task 13 specifies a screen that cannot be built** — nothing returns the failed **user_ids**, and `private` is not PostgREST-exposed. Execution will improvise an RPC under time pressure, and the obvious improvisation returns the name or address — exactly what the health RPC's comment forbids, on a per-family communications-failure ledger | ✅ REAL |
| D-9 | Retention names the tables but not the **data**, and misses two items: what an orphan row *is* (a durable record that the school corresponded with this adult about a child, N times, ending at T — surviving the erasure meant to remove it, since `user_id` cascades from `profiles`, not from the pupil); and **Resend's own US-held logs** (`databehandleravtale-iqra.md:150`), which receive a `(recipient address, timestamp)` pair per ping — **including pupil addresses** | ✅ REAL. Add "set Resend log retention to minimum" beside the D28 account visit |
| D-10 | The deep-link assertion `/portal\.iqrasenter\.no\/[a-z]/` misses a UUID starting with a **digit**, or any uppercase path | ✅ REAL. Anchor on any path: `/portal\.iqrasenter\.no\/./` |

**Cleared:** default-ACL escalation on the five new `private` functions (measured — `pg_default_acl`'s anon/authenticated function grants are scoped to `public`/`storage`/`graphql`, **not** `private`) · address handling, every `console.error` traced, one recipient per request, no BCC · the `from` address · **no *direct* protected-pupil disclosure** — the exposure is indirect and lives entirely in D-2 · `email_ping_health` returns only school-wide aggregates · the admin page is gated by `AdminLayout`'s `requireStaffRole('admin')`.

---

## Lens E — the public endpoint, its gate, and the static wall (9 findings)

⚠ This lens could not verify Vercel's runtime behaviour: **firecrawl is out of credits** and CLAUDE.md forbids the fallback. Everything Vercel-specific below is flagged UNVERIFIED, and per the standing rule *"treat could-not-verify as blocking, not as a caveat."*

| # | Finding | Settled |
|---|---|---|
| E-1 | ★★★ **BLOCKER. `database.types.ts` is never regenerated.** `createServiceRoleClient` returns `SupabaseClient<Database>`, and postgrest-js constrains `.rpc()` and `.from()` to `keyof Schema['Functions'] / ['Tables']`. The committed types list none of the five new RPCs nor `notifications`. **The plan mentions `db:types` zero times in 3069 lines** | ✅ REAL. `tsc` goes red at Task 8 and **stays** red, so Task 10's own `npm run build` gate cannot pass and CI is red from that commit on — violating "each commit compiles and passes tests". Fix: `npm run db:types` as an explicit step, and add the file to those `git add` lists |
| E-2 | ★★★ **BLOCKER. No `vi.mock('server-only')`.** The repo has this in **ten** files with three explanatory comments; the plan puts `import 'server-only'` at the head of four new modules and mocks it **zero** times | ✅ REAL. Both new unit suites fail to import, and the red-first step gets a *different* error than documented — which is how a fixture bug gets "fixed" by editing the assertion |
| E-3 | ★★ **The static wall has six evasions, confirmed by executing its parser** — and it is strictly weaker than `action-guards.test.ts` sitting beside it: `async` required (vs optional), no `^`/`m` anchoring, non-global `exec` (**first match only**), naive brace counter that skips neither strings nor comments. A commented-out gated handler above a live ungated one **passes**. So does calling the gate and ignoring its return value | ✅ REAL. Fix: **copy `parseActions`/`takeBalancedBody` verbatim** rather than write a second weaker parser; scan `src/app` not `src/app/api`; match `route.(ts\|tsx\|js\|jsx)`; make `assertCronSecret` **throw** so its result cannot be ignored. Also: Step 2b says 9 tests, the file declares 10 |
| E-4 | Stranded rows — duplicate of B1/B2, independently derived | ✅ confirms. Adds: set an explicit `export const maxDuration` and cap `batch_size` to fit inside it |
| E-5 | ★ **The proxy exclusion — the plan's most-emphasised hazard — has no automated test**, though `src/proxy.test.ts` exists and already mocks `loadSession`. Placement is **correct** (verified: after `respond()` is defined, exact match, fail-closed on case/encoding variants), but a later reorder or a widening to `startsWith('/api')` stays green through typecheck, lint, build and CI | ✅ REAL. Two assertions close it. Also: `path === '/api/varsler/drain'` will not match a trailing slash |
| E-6 | ⚠ **UNVERIFIED: what Vercel Cron actually sends.** The crypto is sound (two fixed 32-byte digests; constant-time w.r.t. the secret; cannot throw). The risk is the literal `` `Bearer ${secret}` `` — **RFC 7235 makes the scheme token case-insensitive**, so `bearer `, extra whitespace, or an edge proxy re-normalising produces a permanent 401 with no local symptom. Step 9 proves the handler agrees with itself, not with Vercel | ⚠ BLOCKING per the standing rule. Fix: normalise the scheme and hash only the token; add a post-deploy probe of a real cron invocation |
| E-7 | `getCronSecret()` throws → **500, not 401**. `.env.local` currently has **no `CRON_SECRET`**, so Step 9 as written produces `500, 500, 500` — not the documented `401, 401, 200` — and the instruction to set it is a trailing note *after* the command block | ✅ REAL. Also a 500-vs-401 oracle. Fix: a named `503` for misconfiguration, and set the secret in a step that runs *before* the curl |
| E-8 | ★ **A permanently failing `claim_due_announcements` reports as a healthy 200.** The route logs and continues. Vercel's cron dashboard keys on status, so a grant regression stops every scheduled fan-out and reads green forever — and neither health number sees it, because an announcement that never fanned out never queued a ping | ✅ REAL |
| E-9 | The quarantine boundary is **convention only** — no eslint rule, no knip rule, no test asserts the importer set | ✅ merges with D-6/D-7. Fix: amend the header with a contract C for unauthenticated scheduled infrastructure, **and** add the import-boundary assertion |

**Cleared:** secrets cannot reach the client (`server-only` first in every new module; neither var is `NEXT_PUBLIC_`) · the gate's cryptography · the proxy exclusion's mechanics and position · knip's `types: warn` means the type-only exports will not fail the gate.

---

## Lens F — pgTAP correctness (~20 findings)

★ **First, the good news it verified independently:** the `plan()` arithmetic is **correct**. It hand-counted off the raw file — 15 · +12 = 27 · +14 = 41 · +12 = 53, file 31 at 33 — and summed all 38 live `plan()` literals to confirm the 842 baseline and the 857→859→871→885→897 progression. Task 6's markers-not-rows analysis (`2+2+3+1+2 = 10`, `83 → 93`, `plan(2)` unchanged) also checks out.

### F-A · Transaction-killers — the file never reaches `finish()`

| # | Finding | Settled |
|---|---|---|
| F-A1 | Section 7's fixture INSERT runs as `authenticated` — duplicate of A8, but the lens names the real cost: it is **not one red assertion, it is all 53**, because 42501 aborts and every later statement is 25P02. ★ And perversely, under Task 1 Step 5's mutation the insert *succeeds*, so the **mutated** run gets further than the clean one | ✅ REAL |
| F-A2 | `birth_year` — duplicate of A6/C-F5 | ✅ |
| F-A3 | Missing `delete from public.assignments` — duplicate of A5. Adds: 37 also deletes `announcement_reads` + `announcements` here, because `announcements.class_id` is a **second** RESTRICT edge; latent today only because the seed creates none | ✅ |
| F-A4 | `published_at` back-date → 23514 — duplicate of A7. Adds the house fix: insert `a6` with `created_at = now() - interval '1 day'`, since 37's own precedent is *«created_at is a WHOLE TEN DAYS earlier than published_at»* | ✅ |
| F-A5 | ★★ **Task 4's mutation 3 aborts the file instead of reddening its assertion.** `og det er forelderen` is a **scalar subquery**; remove the sender-exclusion and it returns two rows → `21000: more than one row returned by a subquery used as an expression` → transaction aborted, and the declared victim (assertion 21) is never reached | ✅ REAL. `37_announcements_rls.sql` documents this exact trap: *«array_agg, NOT a scalar subquery … That error is not a red assertion: it ABORTS»*. Fix: `array_agg(user_id order by user_id)` |

### F-B · Declared mutations that redden nothing — ★ the most valuable finding set

| # | Finding | Settled |
|---|---|---|
| F-B1 | **Task 5 mutation 1 is dead.** Drop the `fanned_out_at is not null` guard and `fan_out_announcement(a6)` runs — but returns **zero rows**: the author is excluded, admins are cut by the new carve-out, and every third-arm reader needs `pub <= now()` which `now() + 2h` fails. The count stays 0 and the assertion stays green | ✅ REAL. It was testing `published_at` gating, which file 37:380 already covers |
| F-B2 | **Task 5 mutation 2 is dead.** Replace `reads_announcement` with `true` and the surviving carve-out **alone** still yields exactly `{012}` — byte-identical recipient set. The one announcement that would expose it (school-wide `a7`, where `class_id is null` opens the carve-out to every role-holder) is inserted **two assertions later** | ✅ REAL. Fix: move the invariant to the end of the section, after `a7` |
| F-B3 | **Task 6's fingerprint mutation is dead.** `private.reads_thread` appears **twice** in `thread_recipients` — in `substantive` and in the admin fallback — and file 29 tests `position(m in pg_get_functiondef(…)) = 0`, so deleting one leaves the other and the marker still matches. My own warning applied to my own step | ✅ REAL. Fix: make the marker unique to the filter, `'private.reads_thread(c.uid, tid)'`. Same for the `staff_substantive` marker — Task 4's mutation 2 rewrites the `not exists` body but leaves the CTE **definition** intact |
| F-B4 | Task 1 Step 5 names *"assertions 3 and 9"*; under that mutation the insert is refused by **RLS** instead, so `throws_ok`'s message mismatch reddens, plus section 8's first grant-shape assertion. There is no red "9" under either numbering | ✅ REAL |

### F-C · Vacuous and over-determined assertions

| # | Finding | Settled |
|---|---|---|
| F-C1 | `en failed rad plukkes aldri igjen` is passed by the **backoff**, not by `failed` — the preceding outcome set `next_attempt_at = now() + 32 min`, so deleting `and not q.failed` from the claim leaves it green | ✅ REAL |
| F-C2 | `resolve_ping_address` negative has **no positive control**. `null` is equally what a wholly broken body returns — absent row, wrong join, mis-spelled `deleted_at` | ✅ REAL. Assert the real address for an opted-in user first, over the same user |
| F-C3 | `admin belles ikke på et klasseoppslag` has **no entitled-reader control** — the whole claim is *"admin **can read** it and is still not belled"*, and nothing establishes the first half. Task 4 does this correctly two sections earlier | ✅ REAL — my own file violates its own header rule |
| F-C4 | ★ The T-12 invariant **scans one row**, and its comment claims otherwise (*"a scan over EVERY notification row this file produced"*). Section 27's `delete from public.notifications` five statements earlier wiped everything from assertions 19–26 | ✅ REAL. Merges with D-3 |
| F-C5 | The announcement invariant never covers the **school-wide arm** — same shape as F-C4/F-B2 | ✅ REAL |

### F-D · Minor but real

- ★ **House convention is `select * from finish();`** — 38 of 38 files use it; the plan uses `select finish();`, which also means the "append before `select finish();`" instructions **will not match the target line** in files 31 and 38.
- Task 6's paste block ends **every** entry with a trailing comma, including the last; the existing final entry has none and the block closes `) as f(sig, markers);` → syntax error on verbatim paste.
- File-structure table line 98 still says `83 → 88` (stale "five new functions" arithmetic).
- Task 5 Step 5 is headed *"Two named mutations"* and lists three.
- ★ The `insert into public.profiles … on conflict do nothing` blocks are **dead code**: `private.handle_new_user` already created each profile when the `auth.users` row landed, with `full_name = ''` because the fixture passes `'{}'::jsonb`. Files 35/37 pass `jsonb_build_object('full_name', …)` on the `auth.users` insert instead. Harmless today; it will silently defeat the first assertion that reads a name.

### Cleared

Fixture prefix `c1` free · no cross-file UUID hazard (pg_prove is serial, every file rolls back) · `26_rls_force.sql` and `00_grant_firewall.sql` satisfied by the notifications migration as written · the seed creates no threads/messages/announcements, so nothing perturbs Task 3's `→ 0` claims · `claim_due_announcements`'s `create or replace` is signature-compatible and both existing fingerprint markers survive the rewrite, so files 29 and 37 stay green · **the other four Task 3/4 mutations do redden what they name**, and Task 5's mutation 3 correctly reddens the admin carve-out.

---

# Adjudicated totals

| Source | Findings | Blockers |
|---|---|---|
| My own pass (R1–R7) | 7 | 1 |
| A — claims vs tree | 14 | 3 |
| B — concurrency | 12 | 2 |
| C — RLS | 6 | 1 |
| D — privacy | 10 | 1 |
| E — route/secret | 9 | 2 |
| F — pgTAP | ~20 | 5 |

**~78 findings, essentially all real, with very little overlap between lenses.** The three that matter most, none of which my own pass found:

1. **D-1** — the content-free-e-mail test is vacuous, *measured* 6/6 green against a deliberately leaking builder. The one privacy promise of the whole design, and the one task with no mutation step.
2. **C-F1** — `reads_thread_row`'s first arm is a bare admin check, so a teaching rektor is belled and **mailed** that a `kontor` thread about their own pupil exists, while simultaneously suppressing the rollover fallback.
3. **F-B1/B2/B3** — three declared mutations redden nothing. A mutation table is the evidence this project's whole test discipline rests on; three of its entries were predictions, not measurements.

★ **The generalisation worth keeping:** my own review pass found seven defects and thought it had been thorough. It found **none** of the three above. The lenses that caught them are the ones that *ran things* — the privacy lens copied my test and executed it, the RLS lens built fixtures on the live stack, the pgTAP lens traced each mutation's actual recipient set. Reading a plan carefully is not the same activity as running it, and on this project the gap between the two is where every serious defect has lived.
