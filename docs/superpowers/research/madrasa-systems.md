# Madrasah / Mosque Weekend School Management Systems — Research Report

*Sources: vendor sites and comparison pages scraped July 2026 (uselabbaik.com, ilmify.app, e-maktab.co.uk, madrasahportal.com, alifcloud.com, hifztracker.com, theummah.io, masjidsolutions.net). Western-market focus (UK, US, Scandinavia-relevant).*

## Market map (what actually exists)

| System | Region | Model | Notes |
|---|---|---|---|
| **Labbaik** (uselabbaik.com) | UK | £0/mo + 1.5% on fee collection | Phone-first, newest generation; ICO-registered |
| **Ilmify** (ilmify.app) | Global/UK/US | Free ≤30 students; £19/mo ≤150 | Deepest hifz + tarbiyah pedagogy; offline mode |
| **e-maktab** (e-maktab.co.uk) | UK | "Affordable," quote-based | Longest-established UK maktab SIS; strong Trustpilot |
| **Madrasah Portal** | UK | £59–£279/mo by student count (50–300) | Hifdh charts; parent app; weekend + full-time |
| **Alif Cloud** | US | Free trial, tiered | Built for "madrasah, dugsi, mosque schools" — dugsi = Somali weekend school, dominant term in Scandinavian Somali communities |
| **MadrasaSIMS, Muntazim, SchoolCues, Dugsi (DugsiAutoPAY), IQRA (Masjid Solutions, ~$1.25/student/mo)** | US | Mostly quote-based | Per Ummah's 2026 comparison |
| **IBEAMS, MarkTrack, Raziil, MaktabMate, MadrasahOne** | UK | Varies | Older/narrower tools |
| **HifzTracker** (Sidr Productions, UK) | Global | Free personal; $2.99–3.99/student | Pure hifz-tracking app with school tier, not full SIS |

Note: MyMaktab is not a live product; iMaktab unmaintained; mDeen no product footprint; "Tarbiyah" is a curriculum platform not management; Mosqueapp resolves to generic masjid apps. Category leaders are the table above.

---

## 1. Domain-specific features generic school systems lack

Ummah comparison: PowerSchool/Google Classroom/Brightwheel "completely miss the Islamic school context." Concrete gaps:

**Hifz (memorization) progress by surah/juz/ayah with muraja'ah tracking.** THE differentiator. Canonical model = **three simultaneous streams** (Ilmify documents in depth):
- **Sabak** — today's *new* lesson (e.g. ½–1 page), tested by recitation from memory; recorded pass/repeat, position auto-advances on pass.
- **Sabaq Para / Sabqi** — *recent revision*: last ~7–10 pages, recited daily until teacher "graduates" it to long-term; boundary is teacher-set per student (7 days to 4 weeks).
- **Dhor / Manzil** (Arabic: **muraja'ah**) — *long-term revision* of everything memorized, on a rotation (classically: total memorized ÷ 7, one section per weekday). Software shows "which Dhor section is due today," tracks rotation, flags weak juz.

A teacher with 20 hifz students tracks 60 independent progress points daily — the data-model reason paper registers and generic gradebooks fail. Position stored as **juz + surah + ayah range** (Alif Cloud: surah and ayah start/end ranges per session; HifzTracker: ayah-by-ayah tap-to-mark on built-in mushaf, surah/juz views, "hifz calculator" projecting completion date from pace). Terminology localizes (Sabak/Sabqi/Dhor South Asian; hifz jadid/muraja'ah Arab; ezber/tekrar Turkish) but three-stream structure is universal — labels are skins over one model.

**Pre-hifz reading ladder (Qaidah → Nazirah → Hifz).** Most weekend-school students are learning to *read*, not memorizing. Track named Qaidah curricula (**Noorani, Safar, Iqra**) page-by-page, then **Nazirah** (sight-reading) by juz/page, then hifz. Labbaik: "Qaidah to Alimiyyah. One tracker"; "upload any book — broken into progression milestones automatically."

**Tajweed assessment.** Own subject/skill dimension, not a grade: Labbaik tracks "Tajwid rules" covered; HifzTracker exam mode rates **accuracy, fluency, tajweed** as separate scored dimensions per recitation test.

**Islamic-studies curriculum levels.** Book/level-based syllabi (Safar workbooks, dua books) tracked as "Book 2 · Lesson 4 · 88%", plus **Tarbiyah (character) assessment** and **Salah monitoring** (per-prayer present/absent/late grid) as native, explicitly *qualitative* record types (Ilmify).

**Family-centric enrollment.** One guardian account owns multiple children: **sibling auto-detection at registration** (Labbaik auto-applies 10% sibling discount), family-linked records with one payer (e-maktab links students via parent mobile number), class-specific application forms with admin one-click approval auto-sending payment link, waiting lists.

**Fee models generic SIS can't do.** Very low amounts (£5–£20/month), cash/donation-based recording without a gateway, sibling discounts, scholarships/waivers, admission fee + monthly subscription, failed-payment retry. Software pricing must fit too (flat-rate/freemium; per-student >~£2/mo disqualifying for a 40-student maktab on £400/month).

**Weekend-only timetables.** Session-based, not period-based (one/two sessions Sat/Sun, sometimes different subjects per day); custom closure dates not tied to school terms.

**Ramadan/Eid and Hijri handling.** Hijri calendar support; Ramadan schedule shifts (evening sessions, shorter classes, Tarawih attendance) "without rebuilding the entire timetable"; Eid closures; Ramadan fundraising campaigns tied in (Labbaik).

**Other:** QR-verifiable tamper-proof certificates (Labbaik); incident logging with confidential audit trails (e-maktab — UK safeguarding expectation); multi-branch; multilingual parent comms (Ilmify ~10 languages).

---

## 2. Teacher workflows for weekend-only classes

- **The teacher IS the admin.** No office staff on a Saturday; senior teacher runs attendance, progress, comms alone, from a phone. Everything doable in-session — "record-keeping happens in the moment or not at all."
- **Progress-per-lesson recording, in seconds.** 1–2 lessons/week → one progress datapoint per student per subject per session: sabak position + pass/repeat, Qaidah page, revision quality note. Labbaik attendance UI: one student at a time, two big tap targets — 51 students in ~2 minutes; progress logging "a lesson in seconds," rolled into **monthly snapshots**.
- **The week-long gap is the design problem.** Material decays over 6 days; push **homework/targets to parents between weekends**: HifzTracker teachers "assign tasks & goals" parents tick off at home; Ilmify auto-sends **weekly hifz summary** ("what your child memorised this Saturday — which surah, which ayahs, strong or weak") — the single most valuable communication a weekend maktab sends. Parent-side revision logging closes the loop.
- **Attendance tolerance.** Weekend attendance structurally irregular; auto-notify absences instantly (no admin to phone) but no escalation alerts for one missed Saturday.
- **Volunteer teacher model.** No payroll; rota-based teacher attendance; near-zero onboarding (<20 min training, productive by next Saturday); **cloud continuity** — when a volunteer quits mid-year, class hifz records/notes transfer instantly.
- **Offline-first.** Mosque halls have poor Wi-Fi; log attendance/hifz offline, sync later (Ilmify ships this).
- **Termly reports generated, not written.** Attendance % + hifz position + tajweed + Tarbiyah note; a day of manual work per cohort → minutes.

---

## 3. Best examples and why

**1. Labbaik — best UX and pricing (UK).** Phone-first for volunteer teachers (one-tap attendance, instant absence push), full curriculum ladder in one tracker, monthly progress snapshots auto-notified, **passwordless magic-link parent portal** (no app store, no password — right for diverse parent communities), sibling auto-detection + auto 10% discount + auto payment links, Stripe recurring with retry. £0/mo + 1.5% of collected fees. Gamified parent view (badges, per-subject progress bars).

**2. Ilmify — best pedagogy depth, low-end fit (global).** Only vendor natively modeling **full three-stream hifz** as native fields, plus Nazirah, qualitative **Tarbiyah assessment**, **Salah monitoring**, session-based scheduling, volunteer accounts, **offline mode**, multilingual comms, committee reports. Free ≤30 students; £19/mo flat ≤150.

**3. Madrasah Portal — best premium-SIS packaging (UK).** All-features-included, priced by headcount (£59 ≤50 → £279 ≤300); **Hifdh charts, revision targets, "visualize the journey to Hafidh"**; parent app. Runner-up: **Alif Cloud** for US/dugsi (ayah-range per session, family-linked records, configurable grading scales, two-way SMS).

*(Pure hifz tracking reference: HifzTracker — tap-to-mark mushaf, ayah granularity, revision cycles, completion-date calculator, teacher exam mode.)*

---

## 4. How they model "grades" — progress/mastery, not numbers

1. **Position-as-grade (dominant).** Quran "grade" = *where you are*: "Juz 14 — Al-Hijr," "Qaidah page 23," "Duas · Book 2 · Lesson 4." Progress = movement along a fixed sequence. Rendered as completion bars ("Qur'an · Juz 8 — 74%") and juz-colored charts. Cohort comparison by position, not marks.
2. **Pass/repeat mastery gates.** Sabak is binary: recite with few/no errors → complete, advance; else repeat. Same gate for graduating Sabaq Para → Dhor. Mastery learning: variable pace (sabak length ¼–2 pages per retention), fixed attainment. Milestones = **certificates** (khatam, level completion), not letters.
3. **Quality ratings scoped to a session.** Scores grade *today's recitation*, not the student: accuracy/fluency/tajweed dimensions; revision quality; "flag weak juz" → weak-portions list drives future muraja'ah. Configurable simple bands (Excellent/Good/Needs Revision) on termly Islamic-studies tests (Alif Cloud).
4. **Qualitative-developmental for character (Tarbiyah).** "Tarbiyah: 8/10" is a category error (perverse incentives). Pattern: structured observation categories (Salah, akhlaq, adab, social), 3–4 sentence notes on **direction of change**, positives tracked equally with concerns, termly narrative section. Salah monitoring = per-prayer grid, pastoral not disciplinary.

**Net report card:** attendance % + current position per subject ladder + movement this term + recitation-quality notes + narrative Tarbiyah paragraph — numeric/letter grades only optionally on Islamic-studies exam results.
