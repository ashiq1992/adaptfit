# AdaptFit — the intelligent workout notebook

**Train simply. Progress intelligently.**

- **Your workout reads like a note.** Tap any line to change it. No need to start a workout or log every set.
- **Update once a week.** Copy last week, change only what was different, mark what you did, confirm.
- **Paste from Notes.** Bring in workouts you already keep in Apple Notes or Google Keep.
- **Honest analysis.** Progress, personal bests and a short weekly review, from confirmed records only.
- **Optional extras.** Set-by-set live logging, programme recommendations, and AdaptFit Fuel (nutrition).

No account, no cloud, no tracking, no AI service: everything stays in this browser on this device.

Version **0.8.0** (rest in the note text with a 1:30 default, rest for every exercise at once, a countdown for timed exercises, steadier editing on phones; rest timer, plate calculator, new-best highlights, weekly summary; share a week as text, “same for all” answers, Paste and Android Share-menu import; "Ink & Paper": warm paper, black ink for the plan, blue ink for what you did, a highlighter for progress; Night theme in Settings → Appearance). See [`docs/CHANGELOG.md`](docs/CHANGELOG.md) and the brand board [`docs/brand/ink-and-paper.html`](docs/brand/ink-and-paper.html).

## ⚠️ Before upgrading — back up first

V0.4 upgrades your data automatically (database v4 → v5). It only adds fields: workouts, bodyweight, nutrition and coaching history are unchanged, and a copy of your programmes is kept. The game layer (characters, XP) is no longer shown, but its settings stay in your data.

1. Open the app at the address you normally use (e.g. `http://127.0.0.1:4173`).
2. **Settings → Data & backups → Export backup (JSON).** Keep the file private.
3. Build and run the new version (below). When the app shows "A new version is ready", tap **Refresh**.
4. To go back to V0.3, see "Rollback" in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (branch `legacy/v0.3-rpg`).

## Quick start (Windows PowerShell)

Requires **Node.js `^22.22.2 || ^24.15.0 || >=26`** (verified on Node 24.16.0).

```powershell
cd C:\Users\Ashiq\Documents\Claude\FitnessApp
npm ci
npm run build
npm run preview          # → http://127.0.0.1:4173
```

Development with hot reload: `npm run dev` → http://127.0.0.1:5173 (no service worker in dev).

Browser data is per address: `127.0.0.1:4173`, `:5173`, the test server `:4317` and `localhost` are separate.

### On your phone

Installing and offline mode need HTTPS. See [`docs/PWA_AND_NATIVE.md`](docs/PWA_AND_NATIVE.md) for iPhone and Android steps and hosting options. For a quick look on the same Wi-Fi (no install, no offline): `npx vite preview --host 0.0.0.0`, then open `http://<your PC's IP>:4173` in Safari or Chrome.

## Commands

| Command | What it does |
|---|---|
| `npm ci` | Install exactly from `package-lock.json` |
| `npx playwright install chromium` | One-time browser download for E2E tests |
| `npm run dev` | Dev server, 127.0.0.1:5173 |
| `npm run build` | Typecheck + production build with service worker |
| `npm run preview` | Serve the production build, 127.0.0.1:4173 |
| `npm run lint` / `npm run typecheck` | ESLint / strict TypeScript |
| `npm run test` | Vitest unit + integration |
| `npm run test:coverage` | Same, with coverage |
| `npm run test:e2e` | Fresh build, then Playwright on 127.0.0.1:4317 |
| `npm run check` | lint → typecheck → test → build |
| `node scripts/generate-icons.mjs` | Regenerate app icon, favicon and iOS splash screens |
| `FDC_API_KEY=… node scripts/fetch-fdc.mjs` | Dev-time only: refresh Fuel ingredient data |

## Using AdaptFit

1. **Start.** Choose kg or lb and a goal, then **Paste from Notes**, **Choose a programme** (or get a recommendation), or **Write my own**.
2. **Plan** is the main screen: today's (or the next) workout, this week, your workout notes, plus Browse programmes, Import from Notes and Previous weeks.
3. **Workout note.** Read it at the gym. Tap a line to edit it (e.g. `3 sets × 9 reps — 30 kg/side`) and tap Done; it saves itself. Use ⋯ to edit a day as text, duplicate, copy, or log sets live. Amber questions mean AdaptFit isn't sure (for example "total or per side?") and asks rather than guesses. **Undo** reverts the last change.
4. **Weekly update.** Plan → Update this week → **Copy previous week**. Change only what differs, mark sessions **Done / Partly done / Skipped** (or *Mark all as done*), check the day, **Confirm week**. You get a short review straight away.
5. **Progress.** Status per exercise, personal bests, milestones, sessions per week, optional bodyweight; tap an exercise for charts.
6. **Coach.** The latest weekly review, suggestions you can Accept / Reject / Later, possible plateaus, "short on time this week?", and optional nutrition (Fuel). Nothing changes without your approval.

## Backup, restore, reset

**Settings → Data & backups.** Export downloads `adaptfit-backup-YYYY-MM-DD.json` (format 4: everything, including weekly records, note history and imports). Restore validates the file, shows a preview, and replaces data in one transaction; formats 1–3 are upgraded on restore. Erase all data asks first.

## Project docs

| Doc | Contents |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Layers, data model, migrations, V0.4: notes editor, weekly workflow, parser, analysis, coaching, rollback |
| [`docs/USER_STORIES_V0.4.md`](docs/USER_STORIES_V0.4.md) | Stories, status, incomplete items, before/after comparison, navigation map |
| [`docs/PWA_AND_NATIVE.md`](docs/PWA_AND_NATIVE.md) | Install on iPhone and Android, HTTPS, future Capacitor packaging |
| [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) / [`docs/TEST_RESULTS.md`](docs/TEST_RESULTS.md) | Test mapping and exact results |
| [`docs/SOURCES.md`](docs/SOURCES.md) | Research and nutrition data sources |
| [`docs/screenshots/v0.5/`](docs/screenshots/v0.5) | 8 screens at 375/390/430/768/1280 px (Paper) and 390 px (Night) |
| [`docs/brand/ink-and-paper.html`](docs/brand/ink-and-paper.html) | Brand board: logo, colours and their jobs, typography, components, voice |
| [`docs/DEPLOY_FREE.md`](docs/DEPLOY_FREE.md) | Put the app on your phone for free, with offline use (GitHub Pages, Cloudflare Pages, Netlify Drop) |
| [`docs/ADMIN_AND_ANALYTICS.md`](docs/ADMIN_AND_ANALYTICS.md) | What the Admin page shows, and what an all-users view would need (not built) |
| [`docs/STRATEGY.md`](docs/STRATEGY.md) | Competitors, uniqueness, monetisation, next features, 30-day validation plan |

## Test status (2026-11-09)

| Check | Result |
|---|---|
| `npm run check` | ✅ |
| Vitest | 224 tests ✅ |
| Playwright | 31 tests ✅ (62/62 over two repeats) |
| axe WCAG 2.1 AA | 0 violations (Paper and Night) |
| `npm audit --omit=dev` | 0 |

## Known limitations

- **Devices:** verified in Chromium with phone-sized viewports only, not on a physical iPhone/Android, in installed mode, or with a real on-screen keyboard.
- **Usability timing:** tap counts are measured automatically; the "update a week in under 60 seconds" target hasn't been timed with a person.
- **Parser:** common English gym notation only; no fuzzy spelling, supersets or RPE. Anything not understood is kept as text.
- **Notifications:** in-app only (no push).
- **Nutrition data:** unchanged from V0.3 (partial ingredient data; hawker dishes show no numbers).
- **Dev tooling:** 15 moderate/low `npm audit` advisories in build tools; runtime dependencies have none.

## Safety

AdaptFit offers general fitness and nutrition guidance for adults. It does not diagnose, give medical clearance, or change your programme or targets without approval.
