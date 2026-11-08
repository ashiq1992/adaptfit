# Changelog

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
