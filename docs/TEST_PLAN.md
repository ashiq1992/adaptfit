# AdaptFit V0.2 — Test plan

Tools: **Vitest** (unit + integration, jsdom, fake-indexeddb), **React Testing Library**, **Playwright** (Chromium, production preview on 127.0.0.1:4317, timezone Asia/Singapore), **axe-core**.

Fixtures are synthetic and labelled as such (`tests/fixtures/factories.ts`, `tests/e2e/seed.ts`): beginner profile, experienced hypertrophy profile, four-day schedule, two-day reduced schedule, stable bench, improving bench, reduced-sleep period, missing nutrition data, completed and incomplete workouts, corrupted backup, V0.1 legacy session. They are never written to a real user's database; E2E seeds go into fresh browser contexts via the Restore UI.

## Mapping

| ID | Test | Location |
|---|---|---|
| T01–T10 | Workout data: separate loads, per-side vs total, prefill, never auto-complete, weight/rep edits, skip, draft serialisation, duration from timestamps, no fabricated duration | `tests/unit/workout.test.ts` |
| T11–T17 | Progression: reps up, load up (units, assisted), stable/sets/effort/regression/mixed, variations not compared, insufficient data, volume, corrections recalc | `tests/unit/progression.test.ts` |
| T18–T22 | Plateau: sustained stagnation, one bad session, missing RIR, interruption, no automatic programme change | `tests/unit/plateau.test.ts` |
| T23–T28 | Gamification: XP, duplicates/extra sessions, levels, stats from valid events, deletion reconciles, optional layer | `tests/unit/rpg.test.ts` |
| T29–T33 | Lifestyle: missing sleep, work schedule saved, priority-preserving reduced week, approval required, dietary preferences retained | `tests/unit/lifestyle.test.ts` |
| T34–T38 | Storage: valid export data, schema + consistency validation, corrupted backups, migrations, duplicate imports | `tests/unit/storage.test.ts`, `tests/unit/notes-import.test.ts` |
| T37 (real DB) | Dexie v2 → v3 upgrade with fake-indexeddb; real Chromium IndexedDB upgrade | `tests/integration/v2-flows.test.tsx`, `tests/e2e/platform.spec.ts` |
| T39–T48 | Integration: plan→log→History, Progress update, XP, History edit recalculation, plateau alert, reject keeps plan, accept saves change, export/restore incl. character, resume, notes import | `tests/integration/v2-flows.test.tsx` |
| T49–T50 | Onboarding; four-day programme from routine text (ambiguous "Squat" resolved, duplicate/delete day, persists) | `tests/e2e/training.spec.ts` |
| T51–T53 | Start/complete, one-tap prefilled set, edit load (+) and reps (typed) | `tests/e2e/training.spec.ts` |
| T54–T59 | History, details, strength chart, Journey + gamification off, Coach plateau questions, reduced-week apply | `tests/e2e/insights.spec.ts` |
| T60 | Persistence after refresh, add/delete/skip, pause/resume, single active session | `tests/e2e/training.spec.ts` |
| T61 | Offline production use incl. lazy-loaded screens | `tests/e2e/platform.spec.ts` |
| T62–T65 | 375/390/430 px: no overflow, content clears nav/action bar, 44 px targets | `tests/e2e/platform.spec.ts` |
| — | 768/1280 px layouts, keyboard flow, focus trap, axe WCAG 2.1 AA on 6 screens + workout | `tests/e2e/platform.spec.ts` |
| T66 | Reduced motion | `tests/e2e/platform.spec.ts` |
| T67–T68 | Backup round-trip; malformed backup / invalid set / unresolved import | `tests/e2e/platform.spec.ts` |
| Visual | Screens captured at 390 and 1280 px for human review | `tests/e2e/visual.spec.ts` |
| Regression | V0.1 quick-workout engine and catalogue integrity | `tests/unit/recommend.test.ts`, `tests/unit/catalog.test.ts`, `tests/unit/programme.test.ts`, `tests/unit/logging.test.ts` |

## Commands (PowerShell or any shell)

```powershell
npm ci
npx playwright install chromium   # once
npm run check                     # lint + typecheck + unit/integration + build
npm run test:coverage
npm run test:e2e                  # builds, then runs Playwright against its own preview server
```

---

# V0.3 test plan

V0.3 IDs (T01–T80 from the Sprint 3 brief) are separate from the V0.2 IDs above; V0.2 tests are kept and still run. Fixtures are synthetic (`tests/fixtures/factories.ts`, `tests/e2e/seed.ts`: `buildSeedBackup`, `buildSeedBackupV3`).

| IDs | Area | Location |
|---|---|---|
| T01–T13 | Guided questionnaire, matching (days, duration, equipment), editable templates, no overwrite, planned vs actual loads, prefill order, no auto-complete, history preserved | `tests/unit/v3-training.test.ts` |
| T14–T20 | Bodyweight add/edit/delete, weekly averages, validation, refresh, backup | `tests/unit/v3-bodyweight-nutrition.test.ts` |
| T21–T42 | Skip / opt-in later, bodyweight reuse, Mifflin reference examples, invalid input, no double counting, manual targets, protein units, editable targets, cook/buy, mixed, cuisines, allergens, restrictions, halal not fabricated, unavailable macros, swaps keep restrictions, portions, totals, no penalties, backup, workouts unchanged | `tests/unit/v3-bodyweight-nutrition.test.ts` |
| T43–T50 | Weekly count consistency, adjusted weeks, insufficient data, plateau history, no causal claims, confirmation required, rejection, persistence | `tests/unit/v3-coach-character.test.tsx` |
| T51–T58 | Four characters, persistence, XP and achievements preserved, fallback sprite, cosmetic only, duplicate XP, v3 → v4 migration | `tests/unit/v3-coach-character.test.tsx` |
| T59–T66 | Integration flows | Covered end-to-end in Playwright plus unit tests: T59 → T67/T73, T60 → V0.2 T51–T53, T61 → T74, T62 → T69, T63 → T72, T64 → T76, T65 → T75, T66 → backup round-trip (format 3) + T20/T41 |
| T67, T68 | Guided onboarding desktop (1280) and mobile (390) | `tests/e2e/v3.spec.ts` |
| T69–T80 | Nutrition opt-in and skip, calorie calculation and target edit, cook/buy and swaps, working-load entry, bodyweight, characters, Coach weekly summary, navigation, mobile nav overlap, offline Fuel/bodyweight, existing-user regression | `tests/e2e/v3.spec.ts` |
| Accessibility | axe WCAG 2.1 AA now includes `#/coach/fuel` and `#/programmes/guide` | `tests/e2e/platform.spec.ts` |
| Visual | 9 screens × 375/390/430/768/1280 | `tests/e2e/visual.spec.ts` → `docs/screenshots/v0.3/` |
