# AdaptFit — Test results

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
