# AdaptFit — Test results

## V0.5 update: import corpus, Settings redesign, admin, free hosting (2026-11-09, later)

Run after the last code change (Windows 11, Node 24.16.0, Chromium via Playwright 1.65.0).

| Command | Result |
|---|---|
| `npm run check` (lint → typecheck → tests → build) | ✅ |
| `npx vitest run` | ✅ **426 passed** (22 files). New: 35-note import corpus with the "no line lost / nothing invented / every guess visible" invariants, the owner's own note in all three import modes, 35 brand tests (colours only from tokens, both themes complete, WCAG AA contrast), 6 admin tests |
| `npx playwright test --repeat-each=2` | ✅ **90/90** (45 tests × 2), then ✅ 45/45 after the last edit |
| Design tests (`tests/e2e/design.spec.ts`) | ✅ fonts per role, ink primary buttons, no old palette, highlighter only on progress, Settings rows aligned (≤2 px) at 5 widths × 2 themes, all targets ≥ 44 px, inputs ≥ 16 px, axe 0 violations with every Settings group open (Paper and Night) |
| Sub-path + offline (`tests/e2e/subpath.spec.ts`) | ✅ app served only under `/adaptfit/`: assets, manifest and service worker resolve there; after one visit it reopens offline |
| Admin (`tests/e2e/admin.spec.ts`) | ✅ renders with seeded data; no request to any other origin |
| `npm audit --omit=dev` | ✅ 0 |

**Not covered:** a real iPhone/Android, Safari/WebKit, a real GitHub Pages deployment (the workflow was added but not run), human usability timing.

---

## V0.5 "Ink & Paper" (2026-11-09)

Windows 11 Pro, Node 24.16.0, Chromium (Playwright 1.65.0). Run after the last code change.

| Command | Result |
|---|---|
| `npm run check` (lint → typecheck → tests → build) | ✅ |
| `npm test` | ✅ **224 passed** (18 files; +5 in `v5-brand.test.ts`: date format, theme default/storage/browser-bar colour) |
| `npx playwright test --repeat-each=2` | ✅ **62/62** (31 tests × 2) |
| axe WCAG 2.1 AA, Paper (11 screens + note, editor, weekly review, import preview) | ✅ 0 violations |
| axe WCAG 2.1 AA, Night (7 screens + note) — new test | ✅ 0 violations |
| `npm audit --omit=dev` | ✅ 0 (fonts add no runtime code) |
| `npm audit` (all) | 15 (2 low, 13 moderate), dev tooling only — unchanged |

**Defects found by the tests and fixed:** the theme bootstrap was first written as an inline script, which the app's Content Security Policy blocks (it now loads `/theme-init.js`); segmented controls were 42 px tall (now 44 px).

**Screenshots:** `docs/screenshots/v0.5/` — 8 screens × 5 widths in Paper, plus the 8 screens at 390 px in Night.

**Not covered:** physical devices, Safari/WebKit (font rendering and `color-mix()` need Safari 16.2+), human review of the new look on a phone.

---

## V0.4 (2026-11-08)

Windows 11 Pro, Node 24.16.0, Chromium (Playwright 1.65.0). All commands were run on this date, after the last code change.

| Command | Result |
|---|---|
| Baseline before changes (lint, typecheck, Vitest) | ✅ clean, 182/182 (V0.3) |
| `npm run check` (lint → typecheck → tests → build) | ✅ all steps passed |
| `npm test` | ✅ **219 passed** (17 files) |
| `npm run test:coverage` | Statements 62.4%, Branches 52.7%, Functions 51.7%, Lines 65.0% (unit + integration; E2E not instrumented) |
| `npx playwright test --repeat-each=2` | ✅ **58/58** (29 tests × 2: platform 11, V0.4 journeys 13, visual 5) |
| axe WCAG 2.1 AA (11 screens + note editor + weekly draft/review + import preview) | ✅ 0 violations |
| `npm audit --omit=dev` | ✅ 0 vulnerabilities |
| `npm audit` (all) | 15 (2 low, 13 moderate), dev-only build tooling — unchanged from V0.3 |

**Usability targets (automated, Chromium; machine time, not human time):**

| Target | Measured |
|---|---|
| A — read the workout | 1 tap from Plan, 1 screen |
| B — change one value | 2 taps (line, Done) + typing, 1 screen |
| C — 3-session week, 2 changed values | 6 taps + typing two values, 1 screen (≈ 1 s automated). A human time under 60 s is **not yet measured**. |
| D — import a Notes workout | paste, 3 one-tap choices for ambiguous names, save |

**Tests removed or changed** (no valid check dropped):
- Removed with the RPG layer: `tests/unit/rpg.test.ts`; character tests T51–T56 and T57 (duplicate XP) in `v3-coach-character.test.tsx` (replaced by legacy-character-data checks). Code is on `legacy/v0.3-rpg`.
- `tests/e2e/training.spec.ts`, `insights.spec.ts`, `v3.spec.ts` targeted the removed Train/Journey screens; their live-logging, plateau, guided-programme, Fuel and regression checks now run in `v4.spec.ts`, `platform.spec.ts` and `v2-flows.test.tsx`.
- `v2-flows.test.tsx` now drives the same flows through the V0.4 UI; T41 "XP once" became "a live log is recorded exactly once"; T48 uses the new importer.
- Version expectations updated: database v5, backup versions "1, 2, 3 and 4".

**Defects found by the new tests and fixed:**
- A blank line before free text didn't end the exercise block, so day notes were attached to the last exercise (T04).
- Choosing a library variation whose load is always total (e.g. barbell bench) didn't clear the "total or per side?" question (import unit test).
- `scrollIntoView` was called unguarded (crashed in jsdom; would also on very old browsers).
- Note lines had accessible names that didn't include their visible "Last…" text (axe).
- Status buttons were truncated at 390 px ("Partly do…"); now a 2×2 grid on narrow phones.
- Weekly sheet: 9,8,8 → 9,9,8 at the same load was reported as "Stable"; comparison now counts reps across sets.

**Not covered:** physical iPhone/Android devices, installed standalone mode, real on-screen keyboards, Safari/WebKit and Firefox engines, real HTTPS hosting, real (non-synthetic) user data, human timing of Target C.

---

## V0.3 (2026-11-06)

Windows 11 Pro, Node 24.16.0, Chromium (Playwright 1.65.0). All commands were run on this date.

| Command | Result |
|---|---|
| Baseline before changes (lint, typecheck, vitest) | ✅ clean, 130/130 |
| `npm run check` (lint → typecheck → tests → build) | ✅ all steps passed |
| `npm test` | ✅ **182 passed** (15 files: 130 existing + 52 new V0.3) |
| `npm run test:coverage` | Statements 63.5%, Branches 51.1%, Functions 54.6%, Lines 65.0% (unit + integration only; E2E not instrumented) |
| `npm run test:e2e` | ✅ **33 passed** (22 V0.2, some updated for renamed UI text; 11 new) |
| `npx playwright test --repeat-each=2` | ✅ 66/66 |
| `npm audit --omit=dev` | ✅ 0 vulnerabilities |
| axe WCAG 2.1 AA (Train, History, Progress, Coach, Fuel, Journey, Settings, Guided programme, active workout) | ✅ 0 violations |

**V0.2 tests that changed** (no valid test was removed):
- T49: onboarding no longer offers "Start from an example". It now checks the three programme options.
- T50: option renamed to "Use my existing programme".
- T57: sprite label is now "Your warrior at level N".
- T67: export is backup format 3, with bodyweights.
- T35 storage: the version message now lists 1, 2 and 3.

**Defects found by the new tests and fixed:**
- The questionnaire ignored the days-per-week chosen in onboarding (found by T67). It's now saved in `trainingPrefs.daysPerWeek`.
- Halal advice text "ingredients are halal-certified" read like a claim (found by T35). It was reworded.
- The fifth Journey tab was clipped at 390 px (visual review); "Change look" was renamed "Style".

**Not covered:** Firefox, Safari/WebKit, physical phones; real (non-synthetic) user data; the FDC ingredients listed as not retrieved in docs/SOURCES.md.

---

# AdaptFit V0.2 — Test results

Environment: Windows 11 Pro, Node 24.16.0, npm 11.13.0, Chromium headless shell (Playwright 1.65.0). Run on 2026-11-06 from a clean `dist/`.

## Baseline (V0.1, before changes)

| Command | Result |
|---|---|
| `npm run lint` / `npm run typecheck` | ✅ clean |
| `npm test` | ✅ 132 passed (10 files) |
| `npm run test:e2e` | ✅ 10 passed |

## Final (V0.2)

| Command | Result |
|---|---|
| `npm run check` (lint → typecheck → tests → build) | ✅ all steps passed |
| `npm test` | ✅ **130 passed** (12 files: 11 unit, 1 integration with 11 tests) |
| `npm run test:coverage` | Statements 64.3%, Branches 52.4%, Functions 55.8%, Lines 67.2% (unit + integration only; E2E not instrumented) |
| `npm run build` | ✅ main JS 300 kB (92 kB gzip) + lazy screen chunks; 36 precached entries (768 KiB) incl. Inter font |
| `npm run test:e2e` | ✅ **19 passed** |
| `npx playwright test --repeat-each=2` | ✅ 38/38 (earlier `--repeat-each=3` on 18 tests: 54/54) |
| `npm audit --omit=dev` | ✅ 0 vulnerabilities (full audit: 15 moderate/low in dev-only `workbox-build` chain; no forced upgrades) |

V0.1 tests that targeted removed V0.1 modules/screens were replaced by V0.2 equivalents; the V0.1 rules-engine and catalogue tests are retained and passing.

## Accessibility and visual review

- axe-core (WCAG 2 A/AA, 2.1 A/AA): **0 violations** on Train, History, Progress, Coach, Journey, Settings, and the active workout at 1280 px.
- Issues found and fixed during testing: label/visible-text mismatch on the missions link and the edit-set buttons; set "done" buttons lacking their values in the accessible name.
- Layout checks: no horizontal overflow and content never hidden under the nav or action bar at 375, 390, 430, 768, 1280 px; 44 px minimum targets.
- Screenshots reviewed against the design references: `docs/screenshots/` (mobile 390 px and desktop 1280 px).

## Defects found by tests and fixed

| Found by | Defect | Fix |
|---|---|---|
| T60 | Skipping an exercise discarded sets already completed in it | `completedSets` no longer depends on the skip flag |
| Visual review | Coach raised 5 plateau cards at once | Automatic recommendations limited to priority lifts, max 2/week; others "Worth watching" |
| Visual review | History filter panel visible while "hidden" | Global `[hidden]{display:none!important}` |
| Visual review | Weekly review sprite used session count as level | Uses real level |
| axe | Accessible-name mismatches | Labels fixed |
| Plateau unit tests | Fixture issues (window boundaries) | Fixtures corrected; logic unchanged |

## Not covered

- Firefox and WebKit engines; physical Android or iOS devices (no device available); PWA install prompt.
- The owner's real V0.1 records (not accessible to the build). The migration is verified with synthetic V0.1 data in fake-indexeddb **and** in real Chromium IndexedDB.
