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
