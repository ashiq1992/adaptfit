# AdaptFit V0.3 — User stories and story-point report

Fibonacci points as relative estimates. Status reflects what was built and tested on 2026-11-06. "Implemented" means real, persisted functionality covered by the tests listed. Limitations are stated, not hidden.

## Story-point completion

| ID | Story | Points | Status |
|---|---|---|---|
| AF-00 | Repository audit and baseline tests | 3 | Done |
| AF-01 | Guided programme onboarding | 8 | Done |
| AF-02 | Starter routine library | 8 | Done |
| AF-03 | Exercise load recording | 5 | Done |
| AF-04 | Personal bodyweight tracking | 5 | Done |
| AF-05 | Scheduling consistency corrections | 5 | Done |
| AF-06 | Character selection and personalisation | 8 | Done (placeholder art) |
| AF-07 | Nutrition opt-in and calorie estimation | 8 | Done |
| AF-08 | Eating habits and cuisine preferences | 5 | Done |
| AF-09 | Singapore nutrition catalogue | 8 | Done, with data limitation |
| AF-10 | Personalised meal recommendations | 8 | Done |
| AF-11 | Training/nutrition coaching integration | 8 | Done |
| AF-12 | UI and mobile experience | 5 | Done (Chromium only) |
| AF-13 | Storage, backup and migration | 5 | Done |
| AF-14 | Automated testing and regression | 8 | Done |
| **Total** | | **97** | **97 / 97 implemented** — see limitations for AF-06, AF-09, and AF-12 |

---

### AF-00 Repository audit and baseline tests (3)
- **Story:** As the team, we need a verified baseline before changing a live app.
- **Acceptance criteria:**
  - Baseline lint, typecheck, and tests are run and recorded.
  - Data models and the database schema are inspected.
  - The source is snapshotted before changes.
- **Dependencies:** none.
- **Status:** Done. Baseline was 130/130 Vitest, lint and typecheck clean. The V0.2 source was snapshotted outside the repo.
- **Tests:** baseline run (docs/TEST_RESULTS.md).
- **Limitations:** the design-references folder still lacks `README_DESIGN_DIRECTION.md`, and filenames differ from the brief (same as V0.2).

### AF-01 Guided programme onboarding (8)
- **Story:** As a busy lifter, I want a short questionnaire that recommends a realistic programme, so I don't have to design one.
- **Acceptance criteria:**
  - Create offers three options: Recommend, Use my existing programme, Build from scratch.
  - The questionnaire covers Q1–Q5, with experience, schedule, and equipment reused from the profile.
  - The result shows routine, frequency, minutes, exercises and muscles, sets, reps, rest, weekly distribution, why, and trade-offs.
  - The user can preview, compare, swap, edit sets and reps, set starting weights, change days, and save.
  - An existing programme is never replaced automatically.
- **Dependencies:** AF-02, AF-03.
- **Status:** Done. Screens: `#/programmes/guide`, onboarding, Train setup card, Settings.
- **Tests:** T01, T02, T06, T07, T67, T68.
- **Limitations:** the free-text restriction note is stored but not interpreted; the "exercises to avoid" list is what changes recommendations.

### AF-02 Starter routine library (8)
- **Story:** As a user, I want sound, original starter templates for 2–5 days a week.
- **Acceptance criteria:**
  - Five templates: Full Body Essentials (2), Full Body Progression (3), Upper/Lower/Full (3), Upper/Lower (4), Five-Day Hypertrophy (5).
  - Each has day structure, muscles, sets, reps, rest, duration, equipment, alternatives, progression, recovery, and sources.
  - Durations are honest.
  - Matching is deterministic, with mismatches explained.
- **Dependencies:** none.
- **Status:** Done. See `src/content/programmeLibrary.ts` and `src/domain/guided.ts`. Every generated day estimates at or under the template's stated minutes, warm-up and rest included; templates are trimmed (priority lifts kept) when the user has less time.
- **Tests:** T03, T04, T05.
- **Limitations:** templates are original and conservative. They use the same time model as V0.2 (5-minute warm-up, 4 s per rep, programmed rest, 60 s changeovers), which can't capture equipment queues.

### AF-03 Exercise load recording (5)
- **Story:** As a lifter, I want to record a planned starting weight and have actual loads logged separately.
- **Acceptance criteria:**
  - Optional "Planned starting weight" for total, per-side, per-dumbbell, added, and assisted loads.
  - Prefill order: previous session → planned → blank.
  - Never auto-completed. Units kept; bar weight never assumed.
- **Dependencies:** none.
- **Status:** Done, in the programme editor and the guided customise step. The logger labels "Planned starting weight — not done yet".
- **Tests:** T08–T13, T73.
- **Limitations:** a planned load in a different unit from the session is converted and rounded (0.25 kg / 0.5 lb) for prefill only; recorded history is never converted.

### AF-04 Personal bodyweight tracking (5)
- **Story:** As a user, I want an optional bodyweight log, separate from lifted weights.
- **Acceptance criteria:**
  - Add, edit, and delete entries with date, value, unit, and note.
  - Chart for 4W, 8W, 12W, or All.
  - Weekly averages and an optional trend.
  - Included in backup.
  - No body-fat inference.
- **Dependencies:** AF-13.
- **Status:** Done (Progress → Bodyweight). V0.2 bodyweight measurements migrate into the log.
- **Tests:** T14–T20, T61, T74.
- **Limitations:** the trend is a simple linear fit of weekly averages (≥ 3 weeks); changes under 0.1 kg/week are called stable.

### AF-05 Scheduling consistency corrections (5)
- **Story:** As a user, I want Coach to show one consistent planned-session count.
- **Acceptance criteria:**
  - The root cause is found.
  - One model distinguishes default frequency, adjusted week, completed, and remaining.
  - Grammar is fixed.
  - Honest progress states: improving, stable, possible plateau, insufficient data.
- **Dependencies:** none.
- **Status:** Done.
  - **Root cause:** the weekly review used `programme.daysPerWeek`, but the planner and `proposeWeek` used `min(daysPerWeek, days.length)`. A programme with 1 distinct day trained 3× a week therefore showed "1 of 3" next to "Normally 1 sessions".
  - **Fix:** `weekSchedule()` is now the single model, `proposeWeek` repeats days to fill the week, and adjusted-week matching counts repeats.
- **Tests:** T43–T46, T76.
- **Limitations:** none known.

### AF-06 Character selection and personalisation (8)
- **Story:** As a user, I want to choose how my character looks without affecting progress.
- **Acceptance criteria:**
  - Four styles, with selection in onboarding and Journey.
  - Preview cards; choice persisted.
  - Switching keeps XP, achievements, and history.
  - Missing assets fall back to the default.
  - Architecture supports future cosmetics.
- **Dependencies:** none.
- **Status:** Done. Warrior, Ranger, Scholar, and Engineer share the 32×32 body and unlock layers. Users can hide unlocked gear. The model has `palette` and `hiddenLayers` slots for future cosmetics.
- **Tests:** T51–T58, T65, T75.
- **Limitations:** **the art is original placeholder pixel art drawn in code, not final commercial artwork.** Alternate palettes are modelled but none ship yet.

### AF-07 Nutrition opt-in and calorie estimation (8)
- **Story:** As a user, I can optionally get calorie and protein targets I understand.
- **Acceptance criteria:**
  - Opt-in prompt (Yes / Not now); resumable and skippable.
  - Inputs reused rather than asked again.
  - Mifflin–St Jeor; no double-counted exercise.
  - Cautious goal targets; protein 1.4–2.0 g/kg.
  - Editable carbs and fat; manual alternative.
  - Safety rules; assumptions explained.
- **Dependencies:** AF-04.
- **Status:** Done (`src/domain/nutrition.ts`, Coach → Fuel).
- **Tests:** T21–T29, T42, T69–T71.
- **Limitations:**
  - Activity factors (1.2–1.5, excluding training) and training METs (3.5–6) are standard approximations.
  - The safety screen is self-reported.

### AF-08 Eating habits and cuisine preferences (5)
- **Story:** As a user, I can say how I usually eat and what I like or must avoid.
- **Acceptance criteria:**
  - Home, out, or mixed (with which meals are cooked); meals per day; times; SGD budget; cooking time; kitchen; dislikes; allergies; intolerances; restrictions; fasting.
  - Multi-cuisine selection; halal never inferred from cuisine.
  - Everything editable.
- **Dependencies:** AF-07.
- **Status:** Done.
- **Tests:** T30–T32, T34, T35.
- **Limitations:** fasting is free text; users set meals per day to match. Fasting windows aren't modelled.

### AF-09 Singapore nutrition catalogue (8)
- **Story:** As a Singapore user, I want suggestions that fit how I actually eat.
- **Acceptance criteria:**
  - A small curated catalogue with provenance, quality, verified date, and allergen and diet metadata.
  - No invented nutrition; no false halal claims.
  - No live lookups or paid APIs.
- **Dependencies:** none.
- **Status:** Done, with a data limitation.
  - 35 meals: 14 home recipes and 21 hawker or food-court dishes across 9 cuisine options.
  - Home-recipe nutrition is computed only from USDA FoodData Central records retrieved this sprint (public domain).
- **Tests:** T33–T36.
- **Limitations:**
  - **HPB SG FoodID states no redistribution licence, so its data isn't bundled. Hawker dishes show "Nutrition estimate unavailable".**
  - The FDC demo key was rate-limited after 9 ingredient records: chicken breast and thigh, egg, white and brown rice, firm tofu, salmon, tilapia, and prawns. Greens, oats, yogurt, legumes, oils, sauces, and bread show as "partial / excluded" until `node scripts/fetch-fdc.mjs` is run with a free API key.
  - Cost bands are rough categories, not prices.

### AF-10 Personalised meal recommendations (8)
- **Story:** As a user, I want a practical daily suggestion I can adjust.
- **Acceptance criteria:**
  - Suggestions follow goal, targets, cook/buy, cuisines, restrictions, budget, meals per day, and fasting.
  - Home recipes include ingredients, quantities, steps, time, substitutions, and nutrition where supported. Eating-out meals include portion, protein additions, modifications, and suitability notes.
  - Users can swap, change portions, switch cook/buy, favourite, ask for another suggestion, and change targets and preferences.
  - Totals are honest.
- **Dependencies:** AF-08, AF-09.
- **Status:** Done. The plan is saved per day, and swaps survive refresh.
- **Tests:** T30–T41, T62, T63, T72.
- **Limitations:** there's no weekly meal plan (not required).

### AF-11 Training/nutrition coaching integration (8)
- **Story:** As a user, I want coaching that connects training, bodyweight, and nutrition without guessing.
- **Acceptance criteria:**
  - Situations A–D are handled; there are no causal claims.
  - Accept, Reject, and Postpone are persisted.
  - Nothing changes without approval.
  - No XP for restriction.
- **Dependencies:** AF-04, AF-07.
- **Status:** Done. Findings appear in Insights; the weekly review shows Fuel and bodyweight context; an accepted target change is applied transactionally.
- **Tests:** T40, T47–T50, T64, T76.
- **Limitations:** AdaptFit records no food intake, so findings are worded as possibilities.

### AF-12 UI and mobile experience (5)
- **Status:** Done. New screens use the existing tokens and components, keep the 44 px touch targets, have no overflow at 375–1280 px, never sit under the bottom nav, and pass axe with 0 violations (including the new guide and Fuel screens).
- **Tests:** T62–T65, T77, T78, platform axe scan, visual captures.
- **Limitations:** verified in Chromium only — not Safari/WebKit, Firefox, or physical phones.

### AF-13 Storage, backup and migration (5)
- **Status:** Done.
  - Database v4 adds `bodyweights`, `nutrition`, and `mealPlans`.
  - The upgrade keeps a snapshot of every record it changes (`meta: snapshot:pre-v0.3`).
  - Backup format 3; formats 1 and 2 are still restorable and migrated identically.
- **Tests:** T19, T20, T41, T58, T66, T80, real-browser T37.
- **Limitations:** a V0.3 backup can't be restored into V0.2. The rollback path is to restore a V0.2 backup into a V0.2 build (see ARCHITECTURE.md).

### AF-14 Automated testing and regression (8)
- **Status:** Done.
  - 182 Vitest tests (130 existing kept, 52 new).
  - 33 Playwright tests (22 V0.2 kept or updated, 11 new); 66/66 across two repeats.
- **Tests:** see docs/TEST_RESULTS.md.
- **Limitations:** the V0.3 test IDs T01–T80 reuse numbers from the V0.2 plan. Files and docs keep them separate (`v3-*` test files; V0.3 section of TEST_PLAN.md).
