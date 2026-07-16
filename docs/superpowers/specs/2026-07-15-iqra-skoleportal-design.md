# IQRA Skoleportal — Design Specification

**Date:** 2026-07-15 · **Status:** Approved by user (all sections reviewed interactively)
**Lives here temporarily:** this spec moves into the new portal repository when it is created (Phase 0). The marketing site repo is NOT where the portal is built.

## 1. What this is

A school management portal for IQRA senter (Oslo) — a supplementary school teaching several subjects including Arabic (reading and writing) and Quran. A few hundred students, weekend-based teaching, volunteer teachers, nonprofit economics.

**Priorities, in the user's order:**
1. **Security** — strict role isolation; no group may ever access another group's data
2. **Clean, understandable code** — problems must be easy to locate and fix
3. **Beautiful design** — parents and teachers should trust and enjoy it

**Non-goals for v1** (explicitly out of scope):
- Online payment collection (tracking only; Vipps/bank happen outside the system) — data model leaves room for a later phase
- Native mobile apps (the portal is a phone-first responsive web app, installable as PWA)
- English/Arabic UI (Norwegian only)
- Student↔student chat (deliberately never)
- Message attachments (text only in v1; files flow through assignment hand-ins)
- Public self-service enrollment (admissions continue via the existing website form; admin registers students)
- Offline-first writes (v1 assumes flaky-but-present network: optimistic UI + retry; full offline sync is a possible later phase)
- Feide login

## 2. Decisions log (all confirmed by user 2026-07-15)

| Decision | Choice |
|---|---|
| Payments | Track only — economy registers invoices + payments manually |
| Parent accounts | Yes — own login, sees all own children |
| Codebase | New separate app + repo, target `portal.iqrasenter.no` |
| Language | Norwegian only |
| Assessment | Test scores + Quran progress + term grades + written feedback (all four) |
| Assignments | Teacher chooses per assignment: digital hand-in or view-only |
| Absence | Teacher marks per lesson + parents pre-report |
| Messaging | Two-way threads + announcements; admin has disclosed oversight |
| Class model | **One group per student** ("Klasse 3"); attendance once per lesson day; subjects are dimensions within the class |
| Backend | Supabase (EU/Stockholm) — user explicitly approved over hand-rolled |
| Design direction | **C · Familie** (picked from 3 visual mockups) |
| Student logins | Optional per student (typically 13+; parental consent below that) |

## 3. Architecture

- **One Next.js (App Router) application** on Vercel, functions pinned to an EU region (arn1/fra1). TypeScript strict everywhere.
- **Supabase project in eu-north-1 (Stockholm):** Postgres (with Row Level Security), Supabase Auth (email/password, TOTP MFA), Storage (private buckets for assignment files).
- **Server-first data access:** all reads/writes go through a server-only data-access layer (DAL) using the requesting user's session, so RLS applies to every query. No browser→database access. Server Components for reads, Server Actions for writes, Zod validation on every input.
- **Service-role usage is quarantined** to one small, isolated admin module (user provisioning, retention jobs); every function in it re-verifies the caller's admin role and writes an audit entry.
- **No third-party analytics/trackers.** Error tracking (if added) EU-hosted with PII scrubbing.

### Roles

`admin`, `teacher`, `parent`, `student`, `economy` — via a `user_roles` table (one person can hold several roles; UI offers a role switcher). Authorization is always **role + relationship**, never role alone.

### Permission matrix (enforced twice: DAL + RLS)

| Data | Admin | Teacher | Parent | Student | Economy |
|---|---|---|---|---|---|
| Student records | RW all | R own classes | R own children | R self | R names+payer only |
| Attendance | RW all | RW own classes | R own children + pre-report | R self | — |
| Progress/tests/grades | RW all | RW own classes | R own children | R self | — |
| Assignments/submissions | R all | RW own classes | R own children (+submit for child) | R self + submit | — |
| Threads/messages | R (disclosed oversight) + broadcasts | RW own-class relations | RW child's teachers | RW own teachers | — |
| Invoices/payments | RW | — | R own family | — | RW |
| Audit log | R | — | — | — | — |
| Users/roles | RW | — | — | — | — |

**Golden rules:**
- No code path lists other families' children to a parent/student. Class rosters exist only in teacher (own class) and admin views. (Bergen fine, designed out.)
- Notifications (e-mail/push) are content-free pings. (Oslo fine, designed out.)
- `protected` flag on student ("skjermet"): excluded from every export and every surface beyond own teacher's roster + admin.
- Economy sees no pedagogy; teachers see no money; least privilege everywhere.

## 4. Data model (Postgres)

Money is stored as **integer øre**. All tables have `created_at`; mutating tables have `updated_at`. RLS: default deny on every table.

**People & families**
- `profiles` (id = auth.users.id, full_name, phone, locale)
- `user_roles` (user_id, role enum) — unique(user_id, role)
- `students` (id, first_name, last_name, birth_year, protected bool default false, status enum active/stopped, student_user_id nullable → set when login enabled, note text nullable — minimal by policy)
- `guardian_student` (guardian_id → profiles, student_id, relationship, is_payer bool)

**School structure**
- `terms` (id, name "Høst 2026", starts_on, ends_on, is_current)
- `classes` (id, term_id, name, room nullable)
- `class_teachers` (class_id, teacher_id)
- `class_students` (class_id, student_id, enrolled_on, left_on nullable)
- `subjects` (id, name, quran_tracking bool, sort) — e.g. Arabisk, Koran, Islamkunnskap
- `class_subjects` (class_id, subject_id)
- `class_schedule` (class_id, weekday, starts_at, ends_at)
- `lessons` (id, class_id, date, starts_at, ends_at, status scheduled/cancelled, note) — generated from schedule per term; individually editable (Eid, Ramadan)

**Attendance**
- `attendance` (lesson_id, student_id, status present/absent/late/excused, note nullable, recorded_by, recorded_at) — unique(lesson_id, student_id)
- `absence_notices` (id, student_id, date_from, date_to, note nullable, created_by, seen_by_teacher bool) — parent pre-report, incl. future dates

**Learning & assessment**
- `curriculum_books` (id, subject_id, title, unit_label "side"/"leksjon", total_units)
- `progress_entries` (id, student_id, subject_id, book_id nullable, lesson_id nullable, unit_reached int, note nullable, recorded_by, recorded_at) — append-only; latest entry per student+book = current position
- `quran_entries` (id, student_id, lesson_id nullable, date, kind new/recent/longterm, surah smallint, ayah_from, ayah_to, result pass/repeat, note nullable, recorded_by) — position + weak-spot flags derive from history
- `tests` (id, class_id, subject_id, title, held_on, max_points)
- `test_results` (test_id, student_id, points, feedback nullable) — unique(test_id, student_id)
- `assignments` (id, class_id, subject_id, title, instructions, due_on, submission_type digital/none, attachment_paths text[])
- `submissions` (id, assignment_id, student_id, body text nullable, file_paths text[], submitted_by, submitted_at) — `submitted_by` may be the guardian (young children)
- `assignment_reviews` (assignment_id, student_id, status approved/redo, points nullable, feedback, reviewed_by, reviewed_at)
- `term_grades` (student_id, term_id, subject_id, grade text, feedback text, set_by, set_at) — unique(student_id, term_id, subject_id); grade scale is a school setting (labels, not hardcoded numbers)

**Communication**
- `threads` (id, student_id nullable context, created_by, subject)
- `thread_participants` (thread_id, user_id)
- `messages` (id, thread_id, sender_id, body, created_at) — no attachments v1
- `announcements` (id, class_id nullable → null = whole school, title, body, published_at, created_by)
- `announcement_reads` (announcement_id, user_id, read_at)
- `notifications` (id, user_id, kind, entity, entity_id, created_at, read_at) — in-app; e-mail ping mirrors it content-free

**Economy**
- `invoices` (id, payer_id → profiles, term_id, number serial-per-year, issued_on, due_on, status draft/sent/paid/partial/overdue/cancelled, note)
- `invoice_lines` (invoice_id, student_id nullable, description, amount_ore int) — sibling discount = negative line
- `payments` (id, invoice_id, amount_ore, paid_on, method vipps/bank/cash/other, registered_by, note)
- `reminders` (id, invoice_id, level nudge/purring, sent_on, fee_ore default 0) — app enforces: purring ≥14 days after due + new 14-day deadline; max 2 fee-bearing reminders; default fee 38 kr (setting)

**Compliance & ops**
- `consents` (id, student_id, type photo/trip/other, status granted/revoked, decided_by, decided_at)
- `audit_log` (id, actor_id, action, entity, entity_id, meta jsonb, created_at) — append-only; no UPDATE/DELETE grants to anyone; written by DB triggers on sensitive writes + DAL for exports/admin reads
- `settings` (single row: school name, current term, grade scale labels, purring fee, retention months)

## 5. Portals (screens per role)

**Teacher (phone-first):** Today → one-tap attendance (pre-reported absences shown) → per-student quick log (book position stepper; Quran entry: surah/ayah + pass/repeat; short note). Class page: roster, assignments (create/review), tests, messages. Term-end flow: grades + feedback per subject → report preview.

**Parent:** child switcher; per child: next lesson, assignments due, progress ladders (book % and Quran position), attendance history; **Meld fravær** (future-dated); threads with child's teachers; family invoices with status; announcements; consents.

**Student (optional login):** own schedule, assignments (+digital hand-in), progress, test results, thread with teacher. No financials.

**Economy:** dashboard (paid vs outstanding per term, aging list); term invoice runs (per family, sibling-discount line auto-suggested, individual adjustments); fast payment registration; reminder ladder with legal gates; CSV export. No pedagogy visible.

**Admin:** cockpit dashboard (today's lessons, absence picture, unpaid summary); student registry + **one-glance student page** (info, guardians, attendance, progress, grades, invoices, consents, protected flag); class management incl. lesson cancellations; user management (invites, student-login enablement, role assignment); school-wide announcements; audit log viewer; settings.

## 6. Security engineering

- **Auth:** Supabase Auth, email+password; **TOTP MFA enforced for admin/teacher/economy** (middleware blocks staff sessions below AAL2); parents password + optional magic link; sensible session longevity on trusted devices (login friction drives users to insecure channels); rate-limited auth endpoints.
- **Two walls:** (1) DAL authorization per request (role + relationship), (2) RLS default-deny policies mirroring §3's matrix. Either alone must be sufficient; both are mandatory.
- **Storage:** private buckets; per-object policies (`submissions/{assignment}/{student}/…`); downloads via short-lived signed URLs after DAL check.
- **Headers/CSP:** strict CSP, no third-party origins; HSTS; frame-deny.
- **Secrets:** service key never in client bundles; envs via Vercel; no secrets in repo.
- **Audit:** triggers on writes to students/grades/invoices/roles + explicit logging of exports and admin impersonation-style reads. Append-only.
- **Logs:** no PII in application logs; content-free notification e-mails.
- **Supply chain:** lockfile, automated dependency updates, `npm audit` in CI.
- **E-mail:** transactional pings via a provider with signed DPA and EU-compatible processing (decided Phase 0: **Brevo** — EU processing, DPA signed during Skyoppsett). Content-free by design; provider listed in the privacy notice.
- **Backups:** Supabase automated daily backups (PITR if plan allows); restore procedure tested and documented in Phase 7.

### GDPR posture (register = Art. 9 special-category data by context)

- Legal basis: Art. 6(1)(b) contract (enrollment agreement) + **Art. 9(2)(d)** (religious nonprofit, members/regular contacts, no disclosure outside org) with explicit consent (9(2)(a)) collected at enrollment as belt-and-braces; photo/marketing consents separate and granular.
- **Deliverables written as part of Phase 7:** DPIA; Art. 30 behandlingsprotokoll; retention schedule; 72h breach runbook; taushetserklæring template (staff + volunteers sign before access); DPA-signing checklist (Supabase, Vercel); privacy notice (Norwegian) listing processors.
- **Retention automation:** student stops → pedagogical records (progress, attendance, messages, submissions) deleted/anonymized after `retention_months` (default 12, documented); invoices + payments retained 5 years (bokføringsloven) — student display name on old invoice lines survives via description text only after anonymization; audit log rotated per documented schedule (~3 months for access events).
- Enrollment paperwork supports **two-guardian signature** (children <15 in faith-community context with shared custody); documented sole-custody path.
- Under-13 student logins require recorded parental consent (§ 5 personopplysningsloven; watch the pending 13→15 proposal).

### Fine-derived regression tests (never remove)
1. Parent A requests child of parent B → 403/empty, audit-logged (Bergen).
2. Any export omits `protected` students unless admin (Bergen).
3. Notification payloads contain zero student data (Oslo).
4. Teacher of class X reads roster of class Y → denied (both).

## 7. Design direction — "C · Familie"

Register: **product** (tool serves the task; earned familiarity over novelty). Theme: light. Scene: a parent on a phone in a hallway after work; a volunteer teacher in a bright Saturday classroom.

- **Type:** Outfit (400/500/600/700), fixed rem scale, ratio ~1.2 (13/14/16/18/20/24); `tabular-nums` for all figures.
- **Color (OKLCH, restrained + warm):** canvas `oklch(0.99 0.003 150)`, ink `oklch(0.25 0.02 155)`, primary IQRA-green `oklch(0.44 0.09 160)`, tinted surface `oklch(0.95 0.025 158)`, hairline `oklch(0.93 0.01 155)`; semantic success/warning/danger tuned to the same hue family. No pure black/white; single accent. Companion tokens: on-primary (text on primary surfaces), border-input (>=3:1 interactive boundaries), ring (focus). hairline is decorative only; warning never carries text directly (use warning-ink).
- **Shape:** rounded geometry (radii 10/14/18, pill chips), thick rounded progress bars, generous touch targets (≥44px).
- **Components:** shadcn/ui-style primitives, restyled to these tokens (never default look). Every interactive component ships default/hover/focus/active/disabled/loading/error states. Skeleton loading, teaching empty states, inline errors. Labels above inputs.
- **Motion:** 150–250ms, `cubic-bezier(0.23, 1, 0.32, 1)` ease-out, transform/opacity only, `scale(0.97)` press feedback, `prefers-reduced-motion` respected. No page-load orchestration inside the portal.
- **Bans honored:** no kicker/eyebrow labels, no side-stripe borders, no gradient text, no emoji-as-icons, no identical-card grids, no purple.
- Accessibility: WCAG AA contrast, visible focus rings, hover gated by `(hover:hover)`, full keyboard paths for attendance and grading flows.
- The portal repo gets PRODUCT.md + DESIGN.md generated from this section (impeccable pipeline context).

## 8. Testing strategy

TDD per project standards (tests first, committed separately). CI blocks merge on any failure.

1. **Adversarial access suite** — every denied cell in §3's matrix attempted at both walls: RLS level (SQL as each role) and API level (server actions with forged inputs). Includes the four fine-derived tests.
2. **Unit** — invoice/discount/purring math (øre precision, date gates), progress derivations (current position, weak spots), report assembly.
3. **E2E (Playwright)** — one happy path per role: teacher attendance+logging; parent meld-fravær+reads progress; economy invoice-run→register payment→reminder; student submits assignment; admin creates class/enrolls.
4. **Static** — TypeScript strict, ESLint, zero-error policy.

## 9. Build phases (each ends usable)

| # | Phase | Ships |
|---|---|---|
| 0 | Foundation | Portal repo, CI, Supabase Stockholm + Vercel EU, auth + MFA, roles, RLS skeleton + adversarial suite harness, design tokens + core components, seed/demo data |
| 1 | School core | Terms, classes, subjects, students, guardians, enrollment; admin registry + one-glance page |
| 2 | Attendance | Lesson generation, teacher flow, parent pre-report, history views |
| 3 | Assessment | Books + progress, Quran tracker, tests + results, term grades + feedback, generated term report |
| 4 | Assignments | Create, digital hand-in (storage), review/feedback |
| 5 | Communication | Threads, announcements, in-app + e-mail-ping notifications |
| 6 | Economy | Invoice runs, payments, reminder ladder, dashboard, CSV export |
| 7 | Hardening | Audit viewer, retention automation, GDPR document pack, security review, design audit (web-interface-guidelines), pilot onboarding |

**User actions needed along the way (guided):** create Supabase/Vercel accounts + sign DPAs (Phase 0); DNS record for `portal.iqrasenter.no` (Phase 0); supply real subject list, books, fee amounts, grade-scale labels (Phase 1–3); appoint pilot teachers (Phase 7).

## 10. Open items (non-blocking)

- Real content: subject list, curriculum books, semester fee amounts, sibling discount %, grade scale labels — collected from IQRA admin during Phases 1–3 (seed data unblocks development).
- Logo/wordmark handoff from the marketing site.
- Whether staff also sign taushetserklæring digitally in-portal (nice-to-have, Phase 7 decision).
- Later phases (explicitly deferred): online payment (Vipps), self-service enrollment, English/Arabic UI, offline mode, message attachments.

## 11. Research grounding

Full reports committed under `docs/superpowers/research/` (same commit as this spec):
- `international-sms.md` — best-in-class systems: family-as-atomic-unit, sub-30s attendance, one-glance student page, low click-depth beats features, reminder automation.
- `norway-gdpr.md` — Art. 9 analysis, 9(2)(d) conditions, Oslo/Bergen fines, Norwegian platform UX norms (meld fravær, content-free pings), hosting posture, invoicing/purring rules.
- `madrasa-systems.md` — Quran-progress model (three streams, position-as-grade, pass/repeat), weekend-school teacher workflows, family-centric billing.
