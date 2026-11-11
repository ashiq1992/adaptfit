# Changelog

## 0.8.0 — 2026-11-11 — "Your rest, your way"

### Changed
- **Rest is part of the note text.** Every exercise shows a rest line (“Rest 1:30”) when you edit it, alone or with the whole day. Change it to “Rest 2 min”, “Rest 45 s”, “Rest 1 min 30 s” or “No rest”, and the Rest button follows. Typed exercises start at **1 min 30 s**; deleting the line goes back to that default.
- **Rest for every exercise at once:** note options → **Rest between sets…** (1 min, 1:30, 2 min, 3 min or no rest timer).
- **Countdown for timed exercises.** Planks and other holds get **Time 30 s**, using the same bar (“Timer · Plank”, then “Time”).
- **The screen stays on while a timer counts** (where the browser supports it), so the phone doesn’t lock before the beep.
- **Timer alarm.** When a rest or hold timer ends, a loud beep pattern repeats (with vibration on Android) until you tap anywhere, for at most 30 s; the bar pulses and says “Tap to stop”. Live-logging rest now rings too (it was silent). **Settings → Training → Timer alarm**: sound, vibration, a 5-second test, and an optional **notification when AdaptFit is in the background** (Android; made on the phone by the app itself, nothing is sent anywhere). An iPhone pauses web apps in the background, and its silent switch mutes web-app sound.

### Fixed
- **Editing a long day on a phone.** Typing in the middle of the text no longer makes the screen jump (to the top, or down to Done). Measuring the growing text box briefly shortened the page; the page now holds still. The view only follows Done when you type at the very end. While the keyboard is open, space is added below the text, so the last lines can scroll above the keyboard.

### Not built
- A separate general-purpose timer or stopwatch. The phone’s Clock app does that better (it rings when the phone is locked; a web app can’t). The in-app timers cover the gym case: rest and timed holds, one tap from the exercise.

### Tests
- 6 unit tests (default rest, rest text round trip, ways of writing rest, per-exercise and whole-day edits, hold timer) and 3 browser tests (typing mid-text on a phone keeps the screen still: the old code jumped 565 px; rest changed per exercise, in the day text and for the whole note; plank countdown).

## 0.7.0 — 2026-11-09 — "At the gym"

### Added
- **Rest timer from your note.** Each exercise with a rest time has **Rest 2 min**; the countdown stays above the tab bar on every screen, has +30 s and Stop, keeps time while the phone sleeps (end time, not a countdown), and signals the end with a beep (and vibration on Android).
- **Plate calculator.** **Plates** on plate-loaded lifts (per-side loads, and barbells written as a total) shows the fewest standard plates for each side, starting from the weight in your note or your last record (editable). For a barbell total you pick your bar once (20/15/10 kg or 45/35/25 lb); bar weight is never assumed. If standard plates can’t make the weight exactly, it says by how much.
- **New best** tag on an exercise when its latest confirmed record beat every earlier comparable one (same rule as Progress), for 14 days.
- **Weekly summary on Plan** after a week is confirmed: sessions done, new bests, what improved, the review’s closing advice, with **See review** and **Share**; can be hidden.

### Tests
- 11 unit tests (plates in kg/lb, bar handling, rest timer maths, new-best rules, summary week) and 3 browser tests (rest timer across screens to “Rest over”, plates from the last record, a heavier week giving New best plus the summary with Share and hide).

## 0.6.0 — 2026-11-09 — "Less typing"

### Added
- **Same answer for all.** After answering “Total, per side or per dumbbell?” for one exercise, AdaptFit offers the same answer for the other exercises in the note that are still asking and are loaded the same way (same equipment and usual loading, so a Smith machine answer is never applied to dumbbells). Nothing changes unless you tap Apply.
- **Share a week as text.** A confirmed week has **Share week**: a plain-text summary (sessions, dates for sessions done, what was done, skipped, notes) to copy or send with the phone’s Share sheet. It reads like a note and imports back into AdaptFit.
- **Paste button** on Import (iPhone-friendly: Notes → Copy, then AdaptFit → Paste).
- **Android Share menu.** The installed app accepts text shared from Notes or Keep and opens Import pre-filled (manifest share_target). iPhone home-screen apps can’t receive shares, so iPhone uses Paste.

### Changed
- A unitless “with added 1” now reads “Added 1 (no unit written, so not counted in the weight)” instead of a bare “added 1”.
- Copy dialogs offer **Share…** where the browser supports it.

### Tests
- 7 unit tests (same-for-all grouping, share-text format and round trip through import, shared-text intake) and 6 browser tests (offer and decline, share and copy a confirmed week, shared text opens Import, Paste button, manifest share target).

## 0.5.0 — 2026-11-09 — "Ink & Paper"

A visual identity for the notebook idea. No data or feature changes; nothing to migrate.

### Added
- **Ink & Paper design system** (`src/ui/tokens.css`, `src/ui/app.css`): warm paper background, black ink for the plan and main actions, **blue ink for what you actually did**, a **highlighter only for progress**, pencil amber for "check this", margin red for errors. Brand board: `docs/brand/ink-and-paper.html`.
- **Three typefaces**: Fraunces (titles, day headings in italic), the system font (reading), IBM Plex Mono (every load, rep and date). Fonts are bundled (Latin only, ~180 KB, SIL OFL 1.1) and precached, so the app looks the same offline.
- **Night theme** and **Settings → Appearance** (Paper / Night / Match device), saved on the device and applied before first paint.
- New logo (ruled lines whose last line steps up, over a highlighter stroke), wordmark "Adapt*Fit*", app icons, favicon and 8 iOS splash screens.

### Changed
- **Plan**: today's workout is the hero (exercises, last time's numbers in blue, *Open workout*); the week is a row of day circles ticked as sessions are recorded; links are a plain list.
- **Workout note**: a ruled page with a margin line; serif italic day headings; prescription in mono; "Last" in blue ink.
- One selected state everywhere (solid ink), three button types, statuses written with the highlighter (improving) or pencil amber (possible plateau/decline).
- One date format: "23 Oct" (year only when not this year), independent of device locale.
- Charts drawn in ink; latest value highlighted; sessions per week in blue ink.

### Fixed — phone layout and editing (2026-11-09)
- **Settings**: group contents now line up under the group title at every width; one shape for every option picker app-wide; switch labels and section labels match other labels; long options wrap instead of being cut (“Sometim…”); theme option “Match device” renamed **Auto**; time boxes get explicit styling for iOS Safari.
- **Editing**: text boxes grow with their text, wrapped lines included, instead of hiding lines behind a small inner scroll (note editor, Import paste box, plan editor). Done/Cancel are kept on screen while typing and when the keyboard opens.
- **Tests**: Settings contents aligned and uncut at 7 widths; phone editing never hides text and keeps Done on screen.

### Added — optional anonymous usage count (built, not yet deployed)
- **Settings → Privacy & about → “Help count active users (anonymous)”**, off by default and shown only when the build sets `VITE_PINGS_URL`. When on, at most once a day the app sends a random install ID, the app version and whether it is installed. Never workouts, notes, body data or names. Turning it off deletes this device’s rows on the server.
- **Admin → All users**: today, 7 and 30 days, devices that came back, installs and versions, behind an owner key kept on the owner’s phone.
- **Server** in `server/pings` (Cloudflare Worker + D1, free plan): origin-checked, strict validation, no IP stored, 90-day automatic deletion. Setup: `server/pings/README.md`.
- The CSP allows exactly one extra connection (the counter) and only when configured; default builds still make no outside connections.
- Tests: 9 server tests on real SQLite, 9 client tests, and an end-to-end test against a local counter (passed 3/3).

### Added (later on 2026-11-09)
- **Import reads 35 real-world note styles** (tested as a corpus): per-set weights, `3x8 @ 60kg`, RPE/RIR, lbs, decimal commas, bodyweight and `+10kg`, superset labels, warm-ups and drop sets (kept as notes, never counted), checkboxes and emoji bullets, dates inside headings, cardio. Logged sets keep their own weights in history and in the weekly update; the plan keeps sets × reps.
- **Settings** redesigned as a grouped list (Training · Lifestyle · App · Data & privacy) with aligned rows, one chevron style, equal-width choice rows and consistent type. Other screens audited: steppers no longer clip at 375 px, History and Guided programme use the shared header, all tap targets ≥ 44 px, the highlighter is no longer used for non-progress marks.
- **Admin page** (`#/admin`, linked from Settings → Privacy & about): this device's app/database version, data counts, first use and last activity, storage use and a "Keep my data on this device" button, installed/offline status. It cannot see other people — AdaptFit has no accounts or server; options for an all-users view are in `docs/ADMIN_AND_ANALYTICS.md` (not built).
- **Free hosting ready**: relative base path so the app works on GitHub Pages sub-paths, `.github/workflows/deploy-pages.yml` (not run), and `docs/DEPLOY_FREE.md`.
- **Strategy research**: `docs/STRATEGY.md` (competitors, uniqueness, monetisation, next features, 30-day validation plan).
- **Tests**: brand tests (colours only from tokens, both themes complete, AA contrast), design tests (fonts per role, alignment, touch targets, axe in Paper and Night), admin and sub-path/offline tests. E2E runs can now use their own port and build folder (`E2E_PORT`, `E2E_DIST`).

### Fixed — Import from Notes
- Notes written as **blocks** (a numbered exercise name, then lines such as `27.5kg for 7 reps`, `4 × 6`, `76kg`, `Rest: 2 min`) now become one exercise each, with the lines combined. Previously the extra lines became comments or separate "Rest" exercises, and "Chest supported row" was taken for a day heading.
- Understood now: gym shorthand in names (`db`, `bb`, `lats pull down`, `flat press`), `Did 8 reps`, `45 at 8 reps … x3`, `X3 sets`, `— 8` after a name, rest times (saved to the exercise), `1 RIR` and notes in brackets (kept as text).
- A load without a unit takes the note's unit when every other load agrees, and says so. "Barbell with added 5 kg" is flagged because the bar's weight isn't written; on pull-ups and dips "added" means bodyweight plus load.
- The preview shows the plan (`4 sets × 6 reps — 27.5 kg`) with what you did underneath in blue (`Did 7 reps`), plus rest.

## 0.4.0 — 2026-11-08 — "Intelligent Workout Notebook"

A product pivot: simpler than Notes to keep up to date, with the analysis Notes can't do.

### Added
- **Workout notes.** The plan reads like a note: tap any line to edit it in place; changes save automatically (save status, undo, draft recovery after refresh or a crash). Edit a whole day as text, add, remove, reorder, duplicate, copy as text, free-text notes kept verbatim. Unclear values (e.g. "Bench 30 kg": total or per side?) are flagged with one-tap answers, never guessed.
- **Weekly update.** Copy previous week, change only what differs, mark sessions done / partly done / skipped (or all at once), confirm. Copied values never count until confirmed; blank rows are never treated as unchanged; one record per week; editing a confirmed week keeps its earlier version.
- **Import from Notes.** Paste from Apple Notes / Google Keep; deterministic parser (day and date headings, kg/lb, per side, per dumbbell, total, bodyweight, added load, rep lists, `3x8`, `10x3` flagged, timed work, comments). Preview shows what was recognised, what needs a check and what is kept as text. Import as a plan, as dated (or explicitly undated) history, or into this week's draft. Duplicates are detected.
- **Performance analysis.** Per-exercise status (improving, stable, possible decline, possible plateau, not enough data) with plain explanations such as "1 more rep in the first set at the same recorded load (30 kg/side)"; personal bests; real milestones; charts for working load, reps, volume, sessions per week, bodyweight.
- **Weekly review** after each confirmed week: sessions done of planned, per-exercise change, and a 2–4 sentence coach summary. Dismiss and revisit from Coach.
- **Programme library** with day and goal filters; any programme (recommended, chosen, imported or written) becomes a workout note.
- **Mobile app polish:** new app icon and 8 iOS splash screens, standalone PWA meta, safe areas, keyboard-aware layout (navigation steps aside while typing), 44 px touch targets, reduced-motion support.
- Database v5 (weekly records, note revisions, imports) and backup format 4.

### Changed
- Navigation is **Plan · Progress · Coach**; Settings moved to the top-right icon. History is reached from Plan (Previous weeks) and Progress.
- Set-by-set logging is optional (day menu, or "Log live" when enabled in Settings) and writes the same records as weekly updates; a session entered both ways is counted once.
- New visual design: calm dark palette (#101418 / #2DD4BF), system fonts, notes typography.
- Onboarding is two screens: units and goal, then Paste from Notes / Choose a programme / Write my own.
- Nutrition (Fuel) and lifestyle settings are kept but secondary (Coach → Fuel, Settings).
- Comparison now counts reps across sets at the same load (9,8,8 → 9,9,8 is progress).

### Removed
- RPG layer from the app: characters, XP, levels, stats, missions, achievements, Journey. Records were not deleted; the code is on branch `legacy/v0.3-rpg`.
- Home/readiness quick-workout screen and the V0.2 import screen (replaced by Import from Notes).

## 0.3.0 — 2026-11-06 — "Performance Edition"

### Added
- **Guided programmes.** Creating a programme now offers three options: Recommend, Use my existing programme, or Build from scratch.
  - A 5-question questionnaire reuses your profile answers.
  - A deterministic ranked shortlist explains why each option fits, its trade-offs, its honest session length, and its weekly sets per muscle.
  - You can compare all five templates, then preview and customise: swap exercises, change sets, reps and rest, set starting weights, and choose training days.
  - Saving never replaces your active programme unless you choose to.
- **Starter library:** five original templates — Full Body Essentials (2 days), Full Body Progression (3), Upper/Lower/Full (3), Upper/Lower (4), and Five-Day Hypertrophy (5). Each has equipment alternatives for gym, dumbbell, home, and bodyweight setups.
- **Planned starting weight** per exercise (total, per side, per dumbbell, added, or assisted). The logger prefills from the previous session first, then the plan, then blank, and never marks a set done.
- **Bodyweight tracker** (Progress → Bodyweight): add, edit, delete, chart (4W/8W/12W/All), weekly averages, and an optional trend.
- **AdaptFit Fuel** (Coach → Fuel; optional, resumable, skippable).
  - Mifflin–St Jeor resting energy, with an activity factor that excludes training and training energy added once.
  - Cautious goal targets, protein at 1.4–2.0 g/kg, editable carbs and fat, and manual targets.
  - Safety screening for under-18s, pregnancy or breastfeeding, eating disorders, and specialised medical conditions.
  - Eating habits (cook, buy, or mixed), cuisines, dietary requirements, allergies, intolerances, exclusions, and fasting.
- **Singapore meal ideas:** 35 curated meals (14 home recipes, 21 hawker or food-court dishes).
  - You can swap, switch cook/buy, change portions, favourite, and ask for another suggestion.
  - Nutrition comes only from sourced USDA FoodData Central ingredient data; everything else is labelled unavailable.
  - Halal is never claimed.
- **Training and nutrition coaching:** context for a stable bodyweight on a gain goal, slow or fast change on a loss goal, and busy weeks while eating out. Accept, Reject, and Later are persisted, and an accepted target change is applied only on approval.
- **Characters:** Warrior, Ranger, Scholar, and Engineer (original placeholder pixel art). Selectable in onboarding and Journey → Style, with gear visibility toggles. XP and achievements are unchanged by switching.
- `scripts/fetch-fdc.mjs` (dev-time FoodData Central refresh); source registry in `docs/SOURCES.md`.

### Changed
- Database v4 (bodyweights, nutrition, meal plans), with a pre-upgrade snapshot. Backup format 3; formats 1 and 2 are still restorable.
- Coach tabs are part of the URL (`#/coach/fuel`). Settings → Nutrition preferences now opens AdaptFit Fuel, and V0.2 dietary notes are reused.
- New training goal: Lose fat.

### Fixed
- **Coach scheduling discrepancy** ("1 of 3 planned" alongside "Normally 1 sessions"). There is now one scheduling model, days repeat when a programme has fewer days than weekly sessions, and plurals are correct.
- Insights no longer says "No plateau detected" when there isn't enough data, and adds a **Stable** state.
- The questionnaire now reuses the days-per-week answer from onboarding.

## 0.2.0 — 2026-11-06 — "Premium Pixel Hybrid"

### Added
- **Your own programmes:** multi-day programmes with exercises, loading convention, sets, rep ranges or durations, rest, priority lifts, notes; reorder; duplicate/delete days; custom exercises; multiple programmes with one active; routine import from text; labelled 4-day example.
- **Fast logging:** sets prefilled from the previous comparable session, explicit one-tap confirmation, −/+ steppers with free entry, add/delete/skip, optional RIR, pause/resume timer, draft saved after every change, sticky contextual action.
- **Loading conventions:** total, per side, per dumbbell, bodyweight, bodyweight + load, assisted, timed. Bar weight is never assumed and conventions are never mixed.
- **Honest duration:** timer (excluding pauses), entered, or not recorded. Implausible timer values default to not recorded.
- **Notes import** with review, unresolved-field blocking, ambiguity prompts ("Squat" → which variation?), duplicate detection.
- **History redesign:** summary cards, real-only comparisons, PR badges, expanded set detail with previous performance, date/exercise filters, edit, delete, repeat.
- **Progress:** 4W/8W/12W/All, strength chart, labelled estimated 1RM, key changes, consistency (planned vs completed), exercise frequency, optional bodyweight/waist.
- **Coach:** weekly review, reduced-week planner with trade-offs, plateau detection with evidence, missing data, ≤2 questions, Accept/Reject/Later, decision history with follow-up.
- **Lifestyle profile (optional):** work days/hours/overtime/windows, sleep, nutrition (halal etc., protein/energy, fasting), availability, timezone (Asia/Singapore supported).
- **Journey:** original 32×32 adventurer with level unlocks, STR/END/REC/CONS with explanations, achievements (common/rare), weekly missions, gamification toggle.
- New navigation (Train · Progress · Coach · Journey + Settings), desktop sidebar, Inter font, brand tokens, new app icons.
- `npm run check`, `npm run test:coverage`.

### Changed
- Database v3 and backup format 2 (format 1 still restorable). Original V0.1 sessions are preserved verbatim in `legacySessions`.
- The generic recommendation engine is now an explicit "Quick adaptive workout" option only.
- XP model expanded and levels now use an increasing curve (`100 + 50(n−1)` per level); progress is still derived from history.
- Screens are code-split; main bundle 571 kB → 300 kB.

### Fixed
- V0.1 history showed data-entry time as workout duration.
- Skip no longer discards completed sets.

## 0.1.0 — 2026-11-06
Initial local-first PWA: check-in, generated workout, logging, history, pixel character, offline, backup/restore. See `docs/v0.1-implementation-plan.md`.
