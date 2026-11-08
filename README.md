# AdaptFit — your training partner for real life

A local-first gym companion for experienced lifters:

- **Programmes:** get a recommended programme or bring your own, and set planned starting weights.
- **Logging:** log sets in a tap, prefilled from last session.
- **Progress:** track strength and bodyweight honestly.
- **Nutrition (optional):** calorie and protein estimates with Singapore meal ideas.
- **Character:** level up an original pixel character.

No account, no cloud, no tracking: everything stays in this browser on this device.

Version **0.3.0**. See [`docs/CHANGELOG.md`](docs/CHANGELOG.md).

## ⚠️ Before upgrading — back up first

V0.3 migrates your data automatically (database v3 → v4). It keeps every workout, programme, and check-in, moves V0.2 bodyweight measurements into the new bodyweight log, and stores a copy of every changed record. Take a backup anyway:

1. Open the app at the **same address you normally use** (e.g. `http://127.0.0.1:4173`). Your installed version keeps running from its offline cache until you choose to update.
2. In the current version: **Settings → Export backup (JSON)**. Keep the file somewhere private.
3. Build and run the new version (below). When the app shows "A new version is ready", tap **Refresh**.
4. Rollback: V0.3 **Settings → Restore** accepts V0.1, V0.2, and V0.3 backups. To return to V0.2 itself, see "Rollback" in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Quick start (Windows PowerShell)

Requires **Node.js `^22.22.2 || ^24.15.0 || >=26`** (verified on Node 24.16.0).

```powershell
cd C:\Users\Ashiq\Documents\Claude\FitnessApp
npm ci
npm run build
npm run preview          # → http://127.0.0.1:4173
```

Development with hot reload: `npm run dev` → http://127.0.0.1:5173 (no service worker in dev).

Browser data is per address. `127.0.0.1:4173`, `127.0.0.1:5173`, the test server `:4317`, and `localhost` are all separate, so always use the same address for your real data.

## Commands

| Command | What it does |
|---|---|
| `npm ci` | Install exactly from `package-lock.json` |
| `npx playwright install chromium` | One-time browser download for E2E tests |
| `npm run dev` | Dev server, 127.0.0.1:5173 |
| `npm run build` | Typecheck + production build with service worker |
| `npm run preview` | Serve the production build, 127.0.0.1:4173 |
| `npm run lint` / `npm run typecheck` | ESLint / strict TypeScript |
| `npm run test` | Vitest unit + integration (single run) |
| `npm run test:coverage` | Same, with V8 coverage (text + `coverage/index.html`) |
| `npm run test:e2e` | Fresh build, then Playwright against its own server on 127.0.0.1:4317 |
| `npm run check` | lint → typecheck → test → build |
| `FDC_API_KEY=… node scripts/fetch-fdc.mjs` | Dev-time only: refresh ingredient nutrition from USDA FoodData Central |

No global installs are needed. Downloads happen only during setup; daily use is fully local.

## Using AdaptFit

1. **Set up.** Pick your goal, then choose how to start your programme: **Recommend a programme**, **Use my existing programme** (paste it), or **Build from scratch**. Choose your character (Warrior, Ranger, Scholar, or Engineer) — it's cosmetic only.
2. **Recommended programmes.** Five quick questions, already filled in from what you've told AdaptFit.
   - You get a ranked shortlist with why each fits, its trade-offs, honest session times (warm-up and rest included), and weekly sets per muscle.
   - Compare all five, then preview and customise: swap exercises, change sets and reps, set **planned starting weights**, and pick training days.
   - Your existing programme is never replaced unless you choose to.
3. **Train.** Sets are prefilled from your last comparable session, else your planned starting weight, else left blank. Tap to confirm each set; nothing is marked done for you.
4. **Progress.** Strength trends and consistency. **Bodyweight** has its own optional log, with a chart, weekly averages, and a trend. Weigh in as often as you like.
5. **Coach.**
   - **This Week:** planned, done, and remaining sessions; adjusted weeks; Fuel and bodyweight context.
   - **Insights:** plateaus and training/nutrition context, honest about missing data.
   - **Fuel:** optional nutrition.
   - **History.**

   Nothing changes without Accept.
6. **AdaptFit Fuel** (optional).
   - Answer a few questions and get estimated resting energy, a maintenance range, a calorie target, and a protein range. Every number is editable and explained.
   - Then tell it how you eat (cook, buy, or mixed), your cuisines, dietary requirements, and allergies to get a daily Singapore meal suggestion. You can swap, switch cook/buy, change portions, and save favourites.
   - Hawker dishes show "Nutrition estimate unavailable" rather than a guess, and AdaptFit never claims a dish or outlet is halal-certified.
7. **Journey.** Level, XP, stats, achievements, missions, and **Style** (change character; your XP stays).

## Backup, restore, reset

Find these in **Settings → Data & backups**.

- **Export** downloads `adaptfit-backup-YYYY-MM-DD.json` (format 3). It includes the profile, character, programmes with planned weights, workouts, check-ins, coaching decisions, week plans, measurements, bodyweight log, nutrition profile, meal plans, and legacy copies.
- **Restore** checks size, schema, and consistency, shows a preview, and replaces data in one transaction. Formats 1 and 2 are migrated on restore.
- **Erase all data…** asks for confirmation first.

## Project docs

| Doc | Contents |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Layers, rules, V0.3 data model, migration, rollback, scheduling root cause |
| [`docs/USER_STORIES_V0.3.md`](docs/USER_STORIES_V0.3.md) | AF-00–AF-14 (97 points): acceptance criteria, status, tests, limitations |
| [`docs/STORYBOARD_V0.3.md`](docs/STORYBOARD_V0.3.md) | Journeys 1–8 |
| [`docs/SOURCES.md`](docs/SOURCES.md) | Research and source registry, licensing, FDC retrieval log |
| [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) / [`docs/TEST_RESULTS.md`](docs/TEST_RESULTS.md) | Test mapping and exact results |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Tokens and components |
| [`docs/screenshots/v0.3/`](docs/screenshots/v0.3) | 9 screens at 375/390/430/768/1280 px (V0.2 captures in `v0.2/`) |

## Test status (2026-11-06)

| Check | Result |
|---|---|
| `npm run check` | ✅ |
| Vitest | 182 tests ✅ |
| Playwright | 33 tests ✅ (66/66 over two repeats) |
| axe WCAG 2.1 AA | 0 violations |
| `npm audit --omit=dev` | 0 |

## Known limitations

- **Browsers:** verified in Chromium only (desktop and mobile viewports). Not tested on Firefox, Safari/WebKit, or physical devices.
- **Character art:** original **placeholder** pixel art drawn in code, not final artwork.
- **Food nutrition data:**
  - Only 9 ingredient records were retrieved from USDA FoodData Central before the demo API key's rate limit. Recipes using other ingredients show partial estimates until `scripts/fetch-fdc.mjs` is run with a free key.
  - HPB SG FoodID data isn't bundled (no redistribution licence found), so hawker dishes have no nutrition numbers.
- **Food prices:** cost bands are rough categories, not prices. There are no live restaurant lookups.
- **Estimates:** energy figures are estimates based on standard equations and approximations; revise them from your bodyweight trend. Plateau and nutrition coaching rules are conservative heuristics, not a diagnosis.
- **Research:** the PubMed article named in the brief (41843416) couldn't be retrieved. Literature references not retrieved this sprint are marked "Not accessed" in docs/SOURCES.md.
- **Dev tooling:** the 15 moderate/low `npm audit` advisories in dev-only build tooling remain; runtime dependencies have none.

## Safety

AdaptFit offers general fitness and nutrition guidance for adults. It does not diagnose, give medical clearance, program around injuries, or change your programme or targets without approval. Users under 18, pregnant or breastfeeding users, and anyone with an eating disorder or a condition needing specialised nutrition get no automatic calorie target, and are encouraged to seek professional advice.
