# IQRA Skoleportal — Roadmap & demo→real transition

**Date:** 2026-07-22 · **Status:** Planning decision record (branch strategy + Phases 3–7)
**Inputs:** master spec `2026-07-15-iqra-skoleportal-design.md` (§9 build phases), Phase-2 close state (`feat/phase-2` @ `a0dee22`, gate green, PR #9 closed unmerged), pitch-demo on `main` @ `bc318b5`.

## 1. Where the repo stands (2026-07-22)

Portal repo `/Users/daodilyas/dev/iqra-portal` (`daodiii/iqra-portal`, private):

- **`main` = the full-vision pitch demo** (`bc318b5`, = `feat/pitch-demo`). A clickable fake-data prototype of the entire roadmap, env-gated by `NEXT_PUBLIC_DEMO=1` (`src/lib/demo/flag.ts`); with the flag off it runs as the real Phase-0/1 app. It is the live sales artifact for the IQRA bid (rival Laravel-ERP offer still in play) and deploys to Vercel as-is.
- **`feat/phase-2` = the real line** (`a0dee22`, pushed): Phase 0 + 1 + 2 complete — full gate green (pgTAP 280, test:api 173, unit 119, build), multi-agent panel review done, all fixes committed (off-roster C-1 two-wall fix included).
- **Divergence point:** `merge-base(main, feat/phase-2) = f2d8036` (Phase-1 tip). Everything after that on `main` is demo-only; everything after it on `feat/phase-2` is real Phase 2.
- **[PR #9](https://github.com/daodiii/iqra-portal/pull/9) was closed unmerged** — merging real Phase 2 into demo-main would produce a hybrid (rebuilt pages real, future-phase routes fake) with a conflicting IA (demo splits attendance into `*/oppmote` routes; real Phase 2 integrated it into the role landing pages).
- CI (`ci.yml`): `push: branches: [main]` + `pull_request:` (unfiltered — PRs against **any** base run both jobs). No tags exist. 7 Dependabot PRs open against `main`.

## 2. Decision: keep the demo frozen on `main`; the real product lives on `real`

**The demo and the product are different artifacts with different jobs.** The demo's job is to win the bid — it must stay exactly as pitched, deployable at any moment, until the bid resolves. The product's job is to become the thing IQRA runs — its IA is allowed to beat the demo's (Phase 2 already did). Neither should block the other.

### 2.1 What we do now (execution start of Phase 3)

1. **Pin the demo permanently:** `git tag demo-pitch-2026-07 bc318b5 && git push origin demo-pitch-2026-07`. The demo survives any later branch surgery.
2. **Create the integration branch `real` at the Phase-2 tip:** `git branch real a0dee22 && git push -u origin real`. Phase 2 needs no new merge or re-review — `real` *starts as* reviewed Phase 0+1+2. PR #9's panel verdict + fix commits are its provenance (link it from the branch's first PR).
3. **CI on the real line:** first commit on `real` (Phase-3 plan Task 1) changes `ci.yml` to `push: branches: [main, real]`. PRs already run CI regardless of base, so `feat/phase-3 → real` PRs are gated from day one.
4. **Make `real` the GitHub default branch** (Settings → Branches). PRs then default-target `real`, and Dependabot rebases/reopens against it. `main` stays as the demo pointer; a demo Vercel project (existing or future) pins its production branch to `main` explicitly. *(Optional but recommended — costs nothing in a private solo repo.)*
5. **Phase branches:** `feat/phase-3` is cut from `real`; every phase lands by PR `feat/phase-N → real` (CI + risk-based review per the 2026-07-21 policy: full multi-agent panel only for RLS/auth/payment-heavy PRs — which Phase 3 is).

### 2.2 What we deliberately do NOT do

- **Do not convert `main` now** (revert/reset to the real line): it kills the live sales artifact mid-bid and buys nothing the `real` branch doesn't already provide.
- **Do not merge the demo into the real line** ("absorb"): it would drag `src/lib/demo/**` plus ~15 fake-data route trees through every future typecheck/refactor for months, constrain the real IA toward the demo's pitch-optimized routes, and re-open the exact hybrid problem that closed PR #9. Phase 2 set the working precedent: **rebuild each feature in the real IA, mining the demo as the design reference.** The mining happens at *spec time* (screens, Norwegian vocabulary, data shapes are baked into each phase spec), so execution rarely needs to read the demo branch at all.
- **Do not delete anything.** `feat/pitch-demo`, the tag, and `main` all keep the demo; `feat/phase-0/1/2` stay as safety refs.

### 2.3 Transition day (when the bid resolves — user's call, not automated)

- **Won:** verify `real`'s gate green → `git push origin +real:main` (fast history swap; demo remains at `demo-pitch-2026-07` + `feat/pitch-demo`) → `main` is the product again, `real` retires or becomes the staging branch. Wire production Vercel + cloud Supabase per the deferred Skyoppsett (org transfer first, then branch protection — free on org private repos).
- **Lost / stalls:** nothing to do. The demo stays pinned; the real line keeps its value as the portfolio piece and possible future product.

### 2.4 Housekeeping riders

- **Dependabot:** after the default-branch switch, land the *minor-and-patch* group + GitHub-Actions bumps on `real` early in Phase 3; **defer the majors** (TypeScript 7, ESLint 10) to a dedicated toolchain window between phases — they can break the typecheck/lint gates mid-phase for zero product value.
- **Docs stay in this repo** (`~/Desktop/iqra/docs/superpowers/{specs,plans}`) for now; migrating them into the portal repo happens at org-transfer time (Phase 7) so IQRA inherits the full design record.

## 3. Roadmap — Phases 3–7 (reconciled with master spec §9)

Master spec §9 already fixes the order; the pitch demo prototyped the same five areas, so **the order stands**. Per-phase scope below adds what §9's one-liners left implicit, assigns the accumulated ledger items, and names the demo surfaces each spec must mine.

| # | Phase | Ships (real) | Demo surfaces to mine | Review level |
|---|---|---|---|---|
| **3** | **Vurdering & fremdrift** (assessment) | `curriculum_books`, `progress_entries`, `quran_entries`, `tests` + `test_results`, `term_grades` (+ grade-scale setting); teacher quick-log + per-student page + term-end flow + printable term report; parent/student fremdrift views; admin one-glance blocks + books admin | `laerer/vurdering`, `laerer/elev/[studentId]`, `elev/fremdrift`, `forelder/fremdrift` | **Full panel** (new RLS walls over child data) |
| **4** | **Lekser & oppgaver** (assignments) | `assignments`, `submissions` (Storage private bucket + signed URLs — first Storage use), `assignment_reviews`; teacher create/review; student/parent hand-in | `laerer/oppgaver` (+`[assignmentId]`), `elev/lekser`, `forelder/lekser` | Full panel (Storage policies are a new wall) |
| **5** | **Meldinger** (communication) | `threads`, `thread_participants`, `messages`, `announcements` (+reads), `notifications` (in-app + content-free e-mail pings via Brevo); admin disclosed oversight | `*/meldinger` (all five roles), thread views | Full panel (cross-role reachability matrix) |
| **6** | **Økonomi** | `invoices`, `invoice_lines`, `payments`, `reminders`; fakturakjøring (term runs, sibling discount), payment registration, purring ladder (legal gates), dashboard, CSV export | `okonomi/*` suite (Fakturakjøring hero), `forelder/okonomi` + `faktura` | **Full panel** (payment + bokføringsloven FK rules) |
| **7** | **Herding & pilot** | Audit viewer, retention automation, GDPR pack (DPIA, Art. 30, breach runbook, taushetserklæring), security+design audit, org transfer + branch protection, cloud prod + DPAs, pilot onboarding | `/kit` (component gallery), cockpit polish | Full panel (it *is* the review) |

**Ledger assignments** (standing items now have owners; do not fix ad hoc):

- **Phase 3 T1 (warm-up riders):** pin `created_by = auth.uid()` in the `absence_notices` INSERT policy (defense-in-depth); `generateLessonsForTerm` throws on empty RPC reply instead of reporting 0/0; history DAL null-join guard.
- **Phase 4:** `class_students` PK re-enroll block (schema decision: surrogate key vs PK incl. date) + `status`↔enrollment decoupling (stopped-but-enrolled students on rosters) — must land **before the second enrollment wave**; teacher class-list term scoping (`listMyTeachingClasses` mixes terms once a 2nd term exists).
- **Phase 6:** payer non-exclusivity design (two «Betaler» guardians, no undo path) — resolves when invoices attach to payers; financial FKs `set null`/`restrict`, never cascade (bokføringsloven 5 yr).
- **Phase 7:** controlled-forms retrofit sweep (Phase-1-era forms still revert on validation error); clock-injectable "today" for deterministic cockpit tests; branded-ID convention decision; Phase-0 T14/T15 minors ledger; `.xml/.txt`-extension matcher gap; Supabase CLI pin in CI; **cloud DEV project + `test:api` in CI** (the deferred 8 GB-Mac fix) whenever the user green-lights it — earlier if local Docker pain returns.

**Standing cross-phase rules** (all born from shipped review findings — bake into every phase plan header):

1. **Double-bind writes:** any INSERT/UPDATE carrying a `student_id` must bind *both* the actor to the context (teaches/guards) *and* the student to that same context (roster/relationship) — at **both** walls. (Phase-2 C-1: `teaches_lesson` alone let a teacher write off-roster students.)
2. New forms ship with **controlled fields** (React 19 auto-reset) + render-adjust clears; no `useEffect` state machines.
3. **Write-confirmation pattern:** success-reporting UPDATEs `.select()` and treat 0 rows as a mapped Norwegian error; idempotent DELETEs stay unconfirmed; 23503/23505 get mapped messages.
4. Audit triggers (`private.audit_row_change`) on every table holding student data; audit actions `<table>.<verb>` (namespace guard enforces the reserved prefixes).
5. Grant firewall: revoke-all then narrow grants per table; `anon` gets nothing; every new function revokes `public` execute.
6. Seed UUID scheme continues (`f1` terms, `fa` subjects, `fc` classes, `fe` students, `f6` lessons, `f7` notices — new prefixes per phase, never overlap); pgTAP fixture prefixes continue from `b2`.
7. Fine-derived regressions re-pinned in every new domain (parent A ↛ child B; exports omit `protected`; content-free pings; teacher X ↛ class Y).

## 4. Phase 3 pointer

Phase 3 is specced and planned in this docs set:

- Design spec: `docs/superpowers/specs/2026-07-22-iqra-portal-phase-3-vurdering-design.md`
- Implementation plan: `docs/superpowers/plans/2026-07-22-iqra-portal-phase-3.md`

Execution model per the 2026-07-21 policy: Opus 4.8 session, subagent-driven (fresh implementer per task → spec review → quality review → fix loop → controller live-verify), TDD, one commit per task, security tasks get the focused security lens; the phase PR gets the full panel.
