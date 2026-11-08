# AdaptFit V0.2 — User stories

Total planned: **87 points**. Implemented: **87 points** (all stories), with limitations listed per story and in the README.

| ID | Story | Pri | Pts | Status |
|---|---|---|---|---|
| AF01 | Repository audit and baseline tests | P0 | 3 | ✅ Done |
| AF02 | Premium UI design system and navigation | P0 | 5 | ✅ Done |
| AF03 | Existing workout-plan management | P0 | 8 | ✅ Done |
| AF04 | Fast workout logging | P0 | 8 | ✅ Done |
| AF05 | History redesign and data integrity | P0 | 8 | ✅ Done |
| AF06 | Strength progression engine | P0 | 8 | ✅ Done |
| AF07 | Plateau detection and coaching | P0 | 8 | ✅ Done |
| AF08 | Lifestyle profiles and adaptive scheduling | P0 | 8 | ✅ Done (no food database by design) |
| AF09 | Character redesign and RPG progression | P0 | 8 | ✅ Done |
| AF10 | Weekly review and progress dashboard | P0 | 5 | ✅ Done |
| AF11 | Local storage, backup and migrations | P0 | 5 | ✅ Done |
| AF12 | Accessibility, responsiveness and PWA | P0 | 5 | ✅ Done (iOS device not verified) |
| AF13 | End-to-end testing and regression | P0 | 8 | ✅ Done |

## AF01 — Audit and baseline
**Acceptance:** baseline checks run; functionality, schema, tests, and visual components documented; the 26-sets and repeated-30-kg anomalies investigated. **Status:** done — see ARCHITECTURE.md §1. Tests: baseline run recorded in TEST_RESULTS.md.

## AF02 — Design system and navigation
**Acceptance:** brand tokens, Inter, reusable components; Train/Progress/Coach/Journey + Settings icon; no overlapping nav; safe areas; desktop layout intentional. **Status:** done. Tests: T62–T65, axe scans, visual capture.

## AF03 — Existing programmes
**Acceptance:** routines persist after refresh; edit exercises and schedules; duplicate a day; history unchanged when a template changes; generic workouts never silently substituted; restored/imported plans editable. **Status:** done — programme editor (days, exercises, convention, sets, rep range/duration, rest, priority, notes, reorder, duplicate/delete day, custom exercises), routine text import, multiple programmes with one active, starter example clearly labelled. Tests: programme.test.ts, T50, T39, T46.

## AF04 — Fast logging
**Acceptance:** finish a normal workout with minimal interaction; previous values preload accurately; different exercises keep separate weights; drafts survive refresh; explicit set completion; correct history; no duplicate sessions. **Status:** done — one-tap confirm, steppers, arbitrary values, add/delete/skip, pause/resume, honest duration, notes import with review. Tests: T01–T10, T47, T48, T51–T53, T60.

## AF05 — History
**Acceptance:** readable mobile summaries; correct comparisons; expanded set data; edits recalculate trends and achievements; deletions leave no invalid XP. **Status:** done — collapsed cards, real-only comparisons, PR badges, filters (date, exercise), edit, delete, repeat. Tests: T17, T27, T42, T54, T55.

## AF06 — Progression engine
**Acceptance:** repeatable; comparisons match stored records; variation changes don't mislead; missing data handled honestly; no fabricated percentages. **Status:** done. Tests: T11–T17, T56.

## AF07 — Plateau detection
**Acceptance:** genuine stagnation flagged; insufficient history never certain; explanations; approval required; accepted recommendations reviewable. **Status:** done — evidence, missing data, ≤2 questions, recommendation types (continue, recovery, consistency, small progression, planned reduction, seek advice), decision record with follow-up. Tests: T18–T22, T43–T45, T58.

## AF08 — Lifestyle-aware training
**Acceptance:** profile optional; work and sleep updatable; no daily questionnaire; works with incomplete data; changes need approval. **Status:** done — work, sleep, nutrition (halal and others, protein/energy optional, fasting), training availability, Singapore timezone, kg default; reduced-week proposals with trade-offs; optional readiness check-in. Not built (by brief): calorie/food database. Tests: T29–T33, T59.

## AF09 — Character and RPG
**Acceptance:** improved character; XP persists and recalculates; stats reflect recorded achievements; consistent after restore; disabling RPG doesn't impair workouts. **Status:** done. Tests: T23–T28, T41, T46, T57.

## AF10 — Main screens
**Acceptance:** Home/Workout/Progress/Journey/Coach/Settings per brief. **Status:** done. Tests: visual capture, T51–T59.

## AF11 — Storage
**Acceptance:** versioning, validation, export/restore, preview, confirmation, duplicate detection, transactions, data preserved. **Status:** done (Dexie v3; backup v2; v1 accepted). Tests: T34–T38, migration integration test, T67, T68.

## AF12 — Accessibility, responsiveness, PWA
**Status:** done — axe WCAG 2.1 AA scans clean on all main screens and the workout; 44 px targets; keyboard flow; reduced motion; offline including lazy screens. Tests: T61–T66.

## AF13 — E2E and regression
**Status:** done — 18 Playwright tests covering T49–T68, stable over 3 repeats.
