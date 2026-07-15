# Best-in-Class School Management Systems (SMS/SIS) — 2025/2026 research digest

*Firecrawl research July 2026: vendor pages (PowerSchool, FACTS, Gradelink, Classe365, Teach 'n Go, Teachworks, Additio, ClassDojo, ManageBac), review aggregates (SoftwareAdvice, Capterra, G2, SoftwareConnect), 2025/26 comparisons.*

## 1. Canonical feature contract per role
Modern SMS = SIS (records) + attendance + gradebook + fee billing + parent/student portals + messaging, in one system.

**Admin:** single source of truth per student (demographics, guardians, enrollment status, history, docs, notes); login dashboard (enrollment counts, today's attendance, alerts); class/course setup + scheduling with conflict detection; enrollment pipeline (online form → auto-created profile → yearly re-enrollment); communication hub (mass messages to filtered groups, history logged per student); reporting (attendance registers, grade distribution, report cards "in minutes", CSV export); user & permission management (per-role defaults, per-user overrides).

**Teacher:** GRADEBOOK is the anchor — assignment creation w/ categories+weights, points/percent/letter, grade override, spreadsheet-style entry, per-class summary to spot at-risk students, real-time push to portals (students motivated by instant visibility). Attendance: one screen per class per day, statuses, auto-visible to office/parents; best = seating-chart/roster one-tap flow; anti-pattern = one-student-at-a-time entry. Assignments: post w/ due date + attachments → students see → submit (where supported) → grade/comment/return (Google Classroom = canonical lightweight loop). Lesson notes per session ("lesson card" = attendance + notes + materials + messaging in one place, Teach 'n Go). Message parents without exposing personal phone/email.

**Student:** today's schedule, assignments due, grades, attendance record, calendar, announcements, materials; homework upload where supported; own payment/fee state visible (Teach 'n Go).

**Parent:** everything student sees PLUS multi-child switching under one login, absence/grade alerts, billing view, teacher messaging. Gradelink model canonical: Family account auto-created with student; "Family 1 / Family 2" separate access levels handles split custody. Push notifications expected.

**Finance:** family-level ledger (charges, credits/discounts/scholarships, payments, balance — per family, drillable to student); invoice generation on schedules with batch runs; automated overdue reminders + late-fee rules; dashboards (collected vs outstanding, aging); exports for accountant. Many small schools skip built-in accounting, keep QuickBooks/Fiken.

## 2. Standout UX patterns
- Seating-chart/roster one-tap attendance; historical view to spot chronic absentees
- **One-glance student page** (PowerSchool Quick Lookup): all grades + attendance on one screen, each grade clickable to underlying assignments — the most-quoted killer feature; the "parent call" use case
- Class summary heatmap by grading period (spot students 1-2 points from a goal)
- "Lesson card" — one session's everything on one card
- Real-time save→portal propagation
- ClassDojo parent feed + private chat: class story + private teacher↔parent messages w/ translation; messages retained/printable (districts require documented communication); anti-pattern = aggressive upsells
- Fewer-clicks navigation as explicit goal (ManageBac redesign); counter-example: Sycamore "very click heavy" complaints
- Self-service enrollment (form auto-creates profile)
- Parent self-service payment state: balance, history, upcoming fees always visible
- Color-coded multi-view calendars w/ conflict warnings — table stakes

## 3. Gold standard for small private/supplementary schools
- **Gradelink** — most consistently recommended small private/faith-based school SIS. Praised: user-friendly, excellent support, everything in one place, predictable pricing. Trade-offs: limited advanced features, clunky attendance, weak mobile.
- **Sycamore** — feature-complete + cheap but click-heavy/dated (cautionary tale).
- **Teach 'n Go** — best fit category for supplementary/weekend schools: built around classes/sessions, family billing, parent self-service, per-student flat pricing, intuitive. Teachworks = power-user alternative w/ dated UI.
- FACTS/RenWeb = US faith-school incumbent, strong tuition mgmt, "not teacher friendly".
- Small-school market punishes feature sprawl; support quality + low click-depth beat feature count in every review set.

## 4. Billing patterns
- **Family = billing unit, student = enrollment unit.** Combined family invoices standard; sibling discounts baseline; split-family billing must-handle (each guardian billed a share); financial changes restricted to plan owner.
- Fee schedules: annual/semester tuition (signed at enrollment) vs recurring monthly (supplementary pattern); registration fees + incidentals billed separately.
- **Autopay is the delinquency killer** (most-praised billing capability); automated reminder/dunning flows: invoice email → overdue alerts → late fees.
- Payment-status dashboards: outstanding, aging, collected-vs-projected; parent-side mirror w/ due dates + pay-now.
- Audit-friendliness: one ledger, batch billing runs, year-end statements.

## 5. Security/privacy practices advertised
- Certifications: SOC 2 Type 2, ISO 27001, FERPA/COPPA, PCI L1 (payments), pen tests, WAF.
- **Role isolation advertised as a compliance control**: RBAC ensuring staff access only what role requires; per-guardian access tiers.
- **Audit logs**: every access to student records logged who/what/when/IP — the stated bar (coverage admittedly incomplete in small-school tier = differentiation opportunity).
- Data ownership: school owns data, never sold, full export any time, nightly encrypted backups (Gradelink = small-school gold standard stance).
- Communication compliance: messages encrypted, immutable/retained (documented parent-teacher communication requirement), report/block.
- Infra hygiene: TLS everywhere, segregation, DDoS protection, tested restores.

## Build takeaways
1. Family is the atomic account: one login, many children, one consolidated invoice, per-guardian tiers.
2. Attendance = one-screen whole-class sub-30-second flow.
3. Gradebook: weighted categories, flexible scales, bulk entry, instant portal sync; skip standards-based complexity.
4. Automated reminders before any other finance feature.
5. Low click-depth + support quality > feature count.
6. Advertise trust basics: RBAC, audit logging, encrypted backups, data-ownership/export policy, GDPR posture.
