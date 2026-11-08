# ADAPTFIT V0.3 — GUIDED TRAINING, NUTRITION INTELLIGENCE & CHARACTER PERSONALISATION

## ROLE AND EXECUTION MANDATE

You are acting as a senior full-stack engineer, fitness product architect, sports-nutrition research analyst, UI/UX designer, game systems designer and QA automation lead.

You are working on an **EXISTING local application called AdaptFit V0.2**.

**DO NOT rebuild the application from scratch.**

Inspect the existing repository, preserve working features, understand the current data models and implement the improvements specified in this document.

This is a complete implementation sprint, not a request for conceptual advice or static mockups.

You must implement real functionality, persist data, execute automated tests, verify the rendered UI and provide a final delivery report.

---

# 1. PRODUCT VISION

**Product:** AdaptFit

**Release:** V0.3

**Design:** Premium Pixel Hybrid — Performance Edition

**Tagline:** Your training partner for real life.

**Target audience:** Initially experienced Singapore gym-goers with demanding working schedules who want to build muscle, improve strength and body composition.

AdaptFit combines three closely connected systems:

### A. Intelligent Training

Help users select an appropriate gym programme based on their goals, experience, equipment, time availability and preferences.

Track actual workout performance and recommend appropriate adjustments.

### B. AdaptFit Fuel

Offer optional calorie and protein estimation.

Recommend realistic food choices based on training goals, cooking habits, preferred cuisines, budget and dietary restrictions.

Include Singapore-relevant meals.

### C. Character Progression

Motivate users through original pixel-RPG characters, experience points, achievements and meaningful fitness milestones.

Gamification must enhance the training experience without overwhelming it.

## Fundamental design principles

1. Gym functionality remains the primary focus.
2. Minimise repetitive user input.
3. Reuse information already provided.
4. Never force calorie tracking.
5. Preserve the user's existing training plan unless changes are approved.
6. Never fabricate workout or nutritional data.
7. Make every recommendation explainable.
8. Keep all core functionality available without an AI API.
9. Preserve existing records and character progress.
10. Do not introduce paid services without approval.

---

# 2. DESIGN REFERENCES

Before implementing any UI changes, inspect:

`design-references/`

Read:

- `README_DESIGN_DIRECTION.md`
- `01_AdaptFit_Branding_Master.png`
- `02_AdaptFit_Main_UI_Reference.png`
- `03_AdaptFit_Expanded_Screens_UI_Kit.png`

Use the existing Premium Pixel Hybrid identity.

### Colours

- Graphite: `#0F1116`
- Midnight Navy: `#131F2E`
- Primary Teal: `#00D6A3`
- Reward Amber: `#F5B041`
- Achievement Violet: `#9B6DFF`
- Primary Text: `#F4F3EE`

Retain the existing modern typography, dark surfaces, navigation and character aesthetic.

Do not perform a full UI redesign.

Enhance the existing screens and introduce new functionality using reusable components.

---

# 3. REQUIRED USER EXPERIENCE

The new user journey must be seamless.

## Journey A — Create a fitness programme

When the user chooses to create a programme, present three options:

1. **Recommend a programme**
2. **Use my existing programme**
3. **Build from scratch**

If the user requests a recommendation, proceed with a short questionnaire.

### Question 1 — Primary fitness goal

Options:

- Build muscle / hypertrophy.
- Improve strength.
- Lose fat.
- Body recomposition.
- General fitness.
- Improve consistency.

### Question 2 — Training experience

Options:

- Beginner.
- Intermediate.
- Advanced.

Reuse the existing experience setting when available.

### Question 3 — Training availability

Ask:

"How many days can you realistically train each week?"

Allow 1–7 days.

Then:

"How much time do you usually have per session?"

Options:

- 30 minutes.
- 45 minutes.
- 60 minutes.
- 75 minutes.
- 90+ minutes.

Allow preferred training days to be selected.

### Question 4 — Equipment

Options:

- Full commercial gym.
- Dumbbells and bench.
- Basic home equipment.
- Bodyweight.

Reuse existing equipment preferences.

### Question 5 — Training priorities

Allow optional selection of:

- Chest.
- Back.
- Shoulders.
- Arms.
- Legs.
- Glutes.
- Full-body balance.

Also allow exercise restrictions or preferences.

### Recommendation result

Based on the answers, show:

- Recommended routine.
- Weekly frequency.
- Estimated session length.
- Exercises and muscle groups.
- Working sets.
- Repetition ranges.
- Rest periods.
- Expected training distribution.
- Why the routine was recommended.
- Potential trade-offs.

Allow users to:

- Preview the full routine.
- Compare alternatives.
- Swap exercises.
- Modify sets/reps.
- Set starting weights.
- Change training days.
- Save as their active programme.

Never automatically replace an existing programme.

---

# 4. GUIDED WORKOUT LIBRARY

Implement five original AdaptFit starter templates.

| Template | Frequency | Intended audience |
|---|---|---|
| Full Body Essentials | 2 days | Time-constrained lifters |
| Full Body Progression | 3 days | Strength and hypertrophy |
| Upper / Lower / Full | 3 days | Balanced hypertrophy |
| Upper / Lower Split | 4 days | Intermediate/advanced lifters |
| Five-Day Hypertrophy | 5 days | Users with greater availability |

Each programme must be complete and editable.

Include:

- Day structure.
- Exercise names.
- Primary muscle groups.
- Sets.
- Repetition targets.
- Rest recommendations.
- Estimated workout duration.
- Equipment requirements.
- Exercise alternatives.
- Progression method.
- Recovery considerations.
- Evidence/source references.

Use realistic durations that include appropriate rest and a warm-up allowance.

A 45-minute programme must not contain 70 minutes of training merely because its label says 45 minutes.

## Research requirements

Research established resistance-training principles using:

- https://thefitness.wiki/routines/strength-training-muscle-building/
- https://www.boostcamp.app/free-workout-app
- https://www.strengthlog.com/training-programs/
- https://pubmed.ncbi.nlm.nih.gov/41843416/

Use these as research references, not content to copy.

Do not reproduce proprietary programmes, text, logos or copyrighted exercise illustrations without permission.

Check whether redistribution is permitted before importing source material.

Create original AdaptFit templates informed by general exercise science.

Maintain a local source registry containing author, URL, access date, evidence notes and licensing status.

If web access is unavailable, document the unverified sources and continue with conservative original templates based on established principles. Do not claim that external research was completed.

## Programme recommendation rules

Use deterministic matching based on:

- Fitness goal.
- Experience.
- Days available.
- Duration.
- Equipment.
- Muscle priorities.
- Exercise restrictions.
- Existing preferences.

Return a ranked shortlist with explanations.

Do not require a cloud AI call.

Do not prescribe unsupported exercise loading.

When a user has only two available training days, do not recommend a five-day programme without explaining the mismatch.

---

# 5. EXERCISE WEIGHT TRACKING

The current Programme Builder has a loading-type selector but needs an obvious field for working weight.

Add:

**Planned starting weight**

This field must be optional.

Supported loading types:

- Total external load.
- Weight per side.
- Weight per dumbbell.
- Bodyweight.
- Added bodyweight.
- Assisted bodyweight.
- Timed exercise.

Examples:

Smith Bench Press:
30 kg per side

Dumbbell Bench Press:
20 kg per dumbbell

Lat Pulldown:
45 kg total

Pull-ups:
Bodyweight with optional added or assisted load

## Planned versus actual values

The programme should store the intended starting load.

The workout logger must independently record the actual load and repetitions completed for every set.

During active workouts:

1. Prefill from the previous comparable completed session when available.
2. Otherwise use the planned starting load.
3. Otherwise leave the value blank.
4. Permit weight and repetition adjustments.
5. Require explicit completion of each set.
6. Save actual values.

Prefilling does not mean a set has been completed.

Do not assume Smith machine bar weight.

Maintain explicit load units.

Support switching between kg and lb without corrupting historical values.

Never invent missing exercise loads.

---

# 6. PERSONAL BODYWEIGHT TRACKING

Implement a separate bodyweight tracker under Progress.

This is different from the weight lifted during exercise.

## Requirements

Users can record:

- Date.
- Bodyweight.
- Units.
- Optional note.

Provide:

- Add entry.
- Edit entry.
- Delete entry.
- Historical chart.
- Weekly averages when sufficient data exists.
- Optional trend analysis.

Support:

- 4-week view.
- 8-week view.
- 12-week view.
- All history.

Bodyweight recording must remain optional.

Do not require daily weigh-ins.

Do not infer exact body-fat percentage, muscle gain or fat loss from bodyweight alone.

Include bodyweight records in backup and restore.

These records may later inform nutrition and physique-progress recommendations.

---

# 7. NUTRITION ONBOARDING — ADAPTFIT FUEL

After a user selects or creates a training programme, offer an optional nutrition setup.

Display:

**"Would you like AdaptFit to calculate your calorie and protein needs and recommend meals that fit your training?"**

Options:

- Yes, personalise my nutrition.
- Not now.

If the user selects "Not now":

- Finish programme setup.
- Continue to Train.
- Do not request additional nutrition data.
- Make Fuel accessible later under Coach and Settings.

If the user selects "Yes":

Proceed with the nutrition setup.

Reuse information already collected during training onboarding.

Do not repeat questions unnecessarily.

Nutrition onboarding must be resumable and skippable.

---

# 8. CALORIE & MACRONUTRIENT ESTIMATION

## Required information

Collect or reuse:

- Age.
- Height.
- Current bodyweight.
- Relevant sex-specific physiological equation input, with explanation.
- General daily activity.
- Training frequency.
- Primary fitness goal.

Allow a manual calorie-target alternative where an equation input is unsuitable or the user prefers not to provide it.

Optional:

- Average daily steps.
- Physical activity at work.
- Recent weight trend.
- Existing maintenance-calorie estimate.
- Preferred calorie target.
- Current training phase.

## Calculation engine

Implement a transparent energy estimation engine.

For appropriate adults, use the Mifflin–St Jeor resting energy equation with correct units and coefficients.

Use a documented method to estimate total daily energy expenditure.

Avoid double-counting exercise activity.

Based on the chosen goal, suggest a cautious starting target:

- Maintenance.
- Modest muscle-gain surplus.
- Moderate fat-loss deficit.
- Recomposition-oriented starting target.

Do not use extreme calorie adjustments.

Explain all assumptions.

If required information is missing, request it or offer manual targets instead of inventing values.

## Protein

Calculate a goal-appropriate daily protein range using established sports-nutrition guidance.

For general resistance-training users, approximately 1.4–2.0 g/kg/day is an evidence-supported reference range, subject to individual context.

Do not automatically recommend very high protein intakes.

## Carbohydrates and fats

Offer reasonable starting allocations after establishing estimated calories and protein.

Clearly label these as editable starting targets.

## Output screen

Display:

- Estimated resting energy expenditure.
- Estimated maintenance calorie range.
- Suggested daily calorie target.
- Protein target or range.
- Optional carbohydrate target.
- Optional fat target.
- Reasoning and assumptions.

Allow manual adjustments.

Explain that estimates may require revision based on longer-term trends.

Do not present the calculation as a precise measurement of metabolism.

## Safety requirements

For users under 18, pregnant or breastfeeding users, users reporting eating disorders, or users with conditions requiring specialised nutrition management, avoid automatic restrictive calorie prescriptions and provide appropriate professional-guidance messaging.

Never diagnose, treat or make clinical claims.

---

# 9. EATING HABITS & LIFESTYLE

After presenting estimated nutrition targets, ask:

**"How do you usually get your meals?"**

Options:

1. Mostly home-cooked.
2. Mostly eating out.
3. A mixture of both.

If mixed, optionally ask which meals are usually cooked or purchased.

Then collect:

- Usual meals per day.
- Typical eating times, optional.
- Preferred budget per meal in SGD.
- Cooking time available.
- Kitchen equipment, if relevant.
- Foods disliked.
- Food allergies.
- Food intolerances.
- Dietary restrictions.
- Optional fasting schedule.

Make all fields editable.

Do not require users to record every meal.

---

# 10. CUISINE SELECTION

Ask:

**"Which cuisines do you enjoy?"**

Use multi-select options:

- Malay.
- Chinese.
- Indian.
- Mediterranean.
- Western.
- Japanese.
- Korean.
- Thai.
- Other.

Allow users to select multiple cuisines.

Separately ask about:

- Halal requirement.
- Vegetarian.
- Vegan.
- Allergies.
- Religious or ethical food restrictions.
- Ingredient exclusions.

Do not infer halal status from cuisine.

Do not infer a user's religion from food choices.

Food restrictions must be respected when generating meal suggestions.

---

# 11. SINGAPORE FOOD CATALOGUE

Build a small curated, local-first catalogue rather than an enormous food database.

Support common Singapore meal categories and cooking options.

## Research sources

Investigate:

- https://www.hpb.gov.sg/healthy-living/food-and-beverage/sgfoodid/
- https://www.healthhub.sg/
- https://fdc.nal.usda.gov/

Check data licences and commercial reuse permissions.

Do not scrape or redistribute protected nutrition databases without permission.

For each food entry, store:

- ID.
- Food name.
- Cuisine.
- Home-cooked or eating-out category.
- Typical portion.
- Calories, when supported.
- Protein, when supported.
- Carbohydrates, when supported.
- Fat, when supported.
- Data source.
- Data quality indicator.
- Last verified date.
- Allergen and dietary metadata.

When reliable nutritional values are unavailable, keep the meal suggestion but display "Nutrition estimate unavailable."

Do not invent precise nutrition information.

Avoid falsely labelling a dish or establishment halal-certified.

Verified halal certification must come from a suitable authoritative source.

Initial version should not require live restaurant lookups, location permissions or paid APIs.

---

# 12. PERSONALISED MEAL RECOMMENDATIONS

Generate practical meal suggestions based on:

- Fitness goal.
- Calorie target.
- Protein target.
- Home cooking versus eating out.
- Cuisine preferences.
- Dietary restrictions.
- Meal budget.
- Usual number of meals.
- Optional fasting schedule.

## A. Home-cooked meals

Provide:

- Meal name.
- Ingredients.
- Quantities when supported.
- Simple preparation steps.
- Approximate cooking time.
- Estimated nutritional information when supported.
- Ingredient substitutions.

## B. Eating-out meals

Provide:

- Common Singapore hawker or food-court dish.
- Cuisine.
- Portion suggestions.
- Potential protein additions.
- Practical modifications.
- Nutritional estimates where supported.
- Dietary suitability notes.

Do not invent stall names, certifications, prices or opening hours.

## User interactions

Users must be able to:

- Swap meals.
- Change portions.
- Change cuisine.
- Switch between cook and buy.
- Save favourites.
- Request another suggestion.
- Change calorie targets.
- Modify preferences.

Start with a practical daily meal suggestion.

Do not require a mandatory seven-day meal plan.

If the user selects a mixed eating pattern, the daily suggestion should reflect which meals they commonly cook versus purchase.

Only compute daily macro totals when supported by quantified portions and reliable nutrition records.

For incomplete data, clearly identify missing totals rather than presenting false precision.

---

# 13. TRAINING AND NUTRITION INTEGRATION

AdaptFit must connect relevant training and nutrition information.

Examples:

### Situation A — Muscle-gain goal

The user is following a hypertrophy programme but bodyweight trends are stable.

The app may suggest reviewing whether energy intake is adequate, while explaining that more information may be required.

### Situation B — Training plateau

Strength performance remains flat across several comparable sessions.

The app investigates:

- Training effort.
- Recovery.
- Sleep.
- Training consistency.
- Relevant dietary changes.

It must not automatically conclude that insufficient calories caused the plateau.

### Situation C — Busy working week

User has less training time and frequently purchases meals.

AdaptFit may suggest:

- A reduced training schedule.
- Convenient food choices.
- Practical ways to meet protein needs.

### Situation D — Fat-loss goal

The app considers longer-term bodyweight trends alongside performance and recovery.

It should avoid recommending increasingly aggressive calorie restriction solely because bodyweight changes have slowed.

## Recommendation controls

All recommendations must support:

- Accept.
- Reject.
- Postpone.

Persist decisions.

Do not modify training programmes or nutrition targets without approval.

Do not award XP for calorie restriction, skipping meals or reducing food intake.

---

# 14. CHARACTER SELECTION & CUSTOMISATION

The current app has one pixel character.

Expand this to four selectable character styles:

1. Warrior.
2. Ranger.
3. Scholar.
4. Engineer.

## Requirements

All characters must have the same progression rules.

Character selection is cosmetic only.

Do not associate character type with actual physiological ability.

Implement:

- Character selection during onboarding.
- Character selection in Journey.
- Character preview cards.
- Persisted character choice.
- Switching characters without losing XP.
- Character appearance progression.
- Original asset support.
- Missing-asset fallback.

Use consistent pixel-art dimensions and styling.

Use image-rendering settings appropriate for crisp pixel artwork.

## Character assets

Use original assets or appropriately licensed character generators.

Do not download copyrighted commercial-game characters.

If final sprite assets are unavailable, implement the complete selection architecture using clearly marked placeholders.

Do not claim placeholder assets are final commercial artwork.

Design the character system to support later cosmetic unlocks:

- Outfits.
- Armour.
- Scarves.
- Headgear.
- Accessories.
- Alternate palettes.

Do not introduce paid character purchases.

## RPG progression

Preserve existing:

- XP.
- Levels.
- Achievements.
- STR.
- END.
- REC.
- CONS.

Continue tying RPG statistics to recorded actions and achievements.

Ensure recalculation is deterministic and idempotent.

Changing a character must never alter workout history or XP.

---

# 15. COACHING AND SCHEDULING CORRECTIONS

Investigate the current discrepancy in the Coach screen.

Previously observed:

- Weekly review displayed one of three planned workouts.
- Schedule adjustment displayed "Normally 1 sessions."

Find the underlying cause.

Distinguish:

- Default programme frequency.
- Current approved weekly schedule.
- Temporary adjusted schedule.
- Completed workouts.
- Remaining workouts.

Use one consistent scheduling data model.

Fix grammatical output as well.

## Progress interpretation

Distinguish:

1. Improving.
2. Stable with sufficient history.
3. Possible plateau.
4. Insufficient data.

Do not display a confident "No plateau detected" conclusion alongside insufficient comparison data.

Show what additional data is required.

The coaching engine must remain deterministic and explainable.

No paid AI API is needed.

---

# 16. UPDATED NAVIGATION

Preserve the existing four main sections:

- Train.
- Progress.
- Coach.
- Journey.

Do not add unnecessary bottom-navigation items.

### Train

- Today's workout.
- Training programme.
- Guided programme selection.
- Active workout.
- Quick logging.
- History.

### Progress

- Strength progression.
- Exercise trends.
- Bodyweight history.
- Training consistency.

### Coach

- Weekly review.
- Lifestyle-aware recommendations.
- AdaptFit Fuel.
- Nutrition targets.
- Meal suggestions.
- Recommendation history.

### Journey

- Character selection.
- Character progression.
- Attributes.
- Achievements.
- Missions.
- Cosmetic unlocks.

### Settings

- Training goals.
- Programmes.
- Availability.
- Work schedule.
- Sleep.
- Nutrition preferences.
- Units.
- Gamification.
- Backups and data management.

Keep all existing sections usable.

---

# 17. DATA MODEL AND PERSISTENCE

Inspect the current database before changing it.

Extend existing models as needed.

Recommended entities include:

- ProgrammeTemplate
- ProgrammeSource
- ProgrammeRecommendation
- TrainingProgramme
- ExercisePrescription
- PlannedExerciseLoad
- CompletedSet
- BodyweightEntry
- NutritionProfile
- EnergyEstimate
- NutritionTarget
- DietaryPreference
- FoodEntry
- MealSuggestion
- MealPlan
- SavedMeal
- CharacterSelection
- CharacterAppearance
- RecommendationDecision

Use explicit types and schema validation.

Every stored entry must have a stable identifier.

Preserve schema versioning.

Implement safe migrations.

Before migrations:
1. Inspect the current schema.
2. Create or validate a backup.
3. Test migration using copies of data.
4. Preserve current records.
5. Provide rollback instructions.

All nutrition and bodyweight data must be included in JSON backup and restore.

Do not transmit personal data to third parties.

---

# 18. LOW-COST TECHNICAL REQUIREMENTS

Keep AdaptFit:

- Local-first.
- Offline-capable.
- Account-free for V0.3.
- Usable without paid AI.
- Usable without cloud hosting.
- Based on the existing application stack.

Use existing:

- React.
- TypeScript.
- Vite.
- IndexedDB.
- Existing testing framework.
- Existing UI components.

Do not introduce unnecessary packages.

Avoid self-hosted AI infrastructure.

Avoid paid API subscriptions.

Any external research is a development-time task, not a requirement for the app to function at runtime.

Keep future AI integration optional and replaceable.

---

# 19. USER STORIES AND STORY POINTS

Use Fibonacci story points as relative implementation estimates.

| ID | Story | Points |
|---|---|---|
| AF-00 | Repository audit and baseline tests | 3 |
| AF-01 | Guided programme onboarding | 8 |
| AF-02 | Starter routine library | 8 |
| AF-03 | Exercise load recording | 5 |
| AF-04 | Personal bodyweight tracking | 5 |
| AF-05 | Scheduling consistency corrections | 5 |
| AF-06 | Character selection and personalisation | 8 |
| AF-07 | Nutrition opt-in and calorie estimation | 8 |
| AF-08 | Eating habits and cuisine preferences | 5 |
| AF-09 | Singapore nutrition catalogue | 8 |
| AF-10 | Personalised meal recommendations | 8 |
| AF-11 | Training/nutrition coaching integration | 8 |
| AF-12 | UI and mobile experience | 5 |
| AF-13 | Storage, backup and migration | 5 |
| AF-14 | Automated testing and regression | 8 |

**Total: 97 story points.**

This is a substantial release backlog, not a single small sprint.

Prioritise functional vertical slices and preserve a working application throughout development.

For each story, document:
- User story.
- Acceptance criteria.
- Dependencies.
- Implementation status.
- Test cases.
- Known limitations.

---

# 20. REQUIRED STORYBOARD

Create `docs/STORYBOARD_V0.3.md`.

Document the following end-to-end journeys.

## Journey 1 — New user and guided training

Open app
→ Configure fitness goal
→ Set availability
→ Select equipment
→ Select priorities
→ Receive programme recommendations
→ Preview routine
→ Approve and customise
→ Nutrition opt-in

## Journey 2 — Nutrition setup

Nutrition opt-in
→ Age/height/bodyweight
→ Activity information
→ Calculate estimated energy needs
→ Show calorie/protein targets
→ Choose cooking/eating out
→ Select cuisines
→ Set dietary restrictions
→ Review meal suggestions
→ Save nutrition profile

## Journey 3 — Existing user

Open app
→ Use existing training routine
→ Edit available time
→ Optional nutrition setup
→ Continue to dashboard

Do not require existing users to repeat complete onboarding.

## Journey 4 — Workout logging

Start workout
→ Load previous values
→ Confirm/edit sets
→ Complete workout
→ Save history
→ Update progress
→ Award appropriate XP

## Journey 5 — Bodyweight update

Progress
→ Add bodyweight
→ Save entry
→ Update trend chart
→ Provide optional context to Coach

## Journey 6 — Food recommendation

Coach
→ Fuel
→ Select cook/buy
→ View suggestions
→ Swap meal
→ Review estimated nutrition
→ Save favourite

## Journey 7 — Character customisation

Journey
→ Character selection
→ Preview character
→ Confirm choice
→ Preserve XP and achievements
→ Return to Journey

## Journey 8 — Lifestyle-aware coaching

Weekly review
→ Identify relevant trend
→ Check available information
→ Ask targeted question when necessary
→ Generate recommendation
→ User accepts/rejects/postpones
→ Save outcome

For every journey include:
- Entry point.
- Screen states.
- User actions.
- Data requirements.
- Empty states.
- Error states.
- Success criteria.
- Acceptance criteria.

---

# 21. AUTOMATED TESTING

Extend existing automated tests. Do not remove valid tests merely to make the suite pass.

Use existing Vitest, React Testing Library and Playwright setup.

## Training tests

T01 — Guided questionnaire completes.

T02 — Existing preferences are reused.

T03 — Routine suggestions match available days.

T04 — Routine suggestions respect session duration.

T05 — Equipment restrictions are applied.

T06 — Recommended templates are editable.

T07 — Existing programmes are not overwritten.

T08 — Planned working loads save correctly.

T09 — Actual completed loads are recorded separately.

T10 — Per-side and total weights remain distinct.

T11 — Previous session values prefill correctly.

T12 — No prefilled sets are automatically completed.

T13 — Programme modifications preserve historical workouts.

## Bodyweight tests

T14 — New bodyweight entry saves.

T15 — Editing bodyweight works.

T16 — Deleting bodyweight works.

T17 — Weekly averages calculate correctly.

T18 — Missing dates or invalid weights are handled.

T19 — Bodyweight data survives refresh.

T20 — Bodyweight records survive backup/restore.

## Nutrition tests

T21 — Nutrition onboarding can be skipped.

T22 — Users can opt in later.

T23 — Existing bodyweight is reused.

T24 — Mifflin–St Jeor calculations match verified reference examples.

T25 — Invalid inputs are rejected.

T26 — Activity calculations avoid double-counting exercise.

T27 — Manual calorie targets are supported.

T28 — Protein targets use correct units.

T29 — Nutrition targets can be edited.

T30 — Cooking preferences persist.

T31 — Mixed cook/buy behaviour is supported.

T32 — Multiple cuisines can be selected.

T33 — Allergens are filtered correctly.

T34 — Dietary restrictions are respected.

T35 — Halal certification is not fabricated.

T36 — Unsupported macro values remain unavailable.

T37 — Meal swaps preserve dietary restrictions.

T38 — Portion changes recalculate supported values.

T39 — Daily totals are calculated correctly from available data.

T40 — Missing meals do not trigger penalties.

T41 — Nutrition preferences survive backup/restore.

T42 — Existing workouts are unchanged by nutrition onboarding.

## Coaching tests

T43 — Weekly planned-session count is correct.

T44 — Temporary adjusted schedules are represented correctly.

T45 — Insufficient data is not labelled as confirmed progress.

T46 — Potential plateaus use sufficient comparable history.

T47 — Nutrition context does not produce unsupported causal claims.

T48 — Recommendation acceptance requires user confirmation.

T49 — Rejected recommendations do not modify targets.

T50 — Recommendation decisions persist.

## Character tests

T51 — Four characters are available.

T52 — Character selection persists.

T53 — Switching characters preserves XP.

T54 — Switching characters preserves achievements.

T55 — Missing character assets use fallback graphics.

T56 — Cosmetic characters do not alter fitness logic.

T57 — Duplicate XP is prevented.

T58 — Existing achievements survive migration.

## Integration tests

T59 — Select programme, set working loads, log workout.

T60 — Complete workout and update Progress.

T61 — Record bodyweight and display trend.

T62 — Complete nutrition onboarding and show meal suggestions.

T63 — Update food preference and regenerate suggestions.

T64 — Generate a weekly review using available training and nutrition information.

T65 — Switch characters and retain progression.

T66 — Export and restore all new data.

## Playwright E2E tests

T67 — Guided programme onboarding on desktop.

T68 — Guided programme onboarding on mobile.

T69 — Nutrition opt-in flow.

T70 — Nutrition skip flow.

T71 — Calorie calculation and target editing.

T72 — Cook/buy selection and meal swapping.

T73 — Exercise working-load entry.

T74 — Bodyweight recording.

T75 — Character selection and switching.

T76 — Coach weekly summary.

T77 — Navigation across all existing tabs.

T78 — No bottom navigation overlap on mobile.

T79 — Core offline functionality.

T80 — Existing-user regression.

## Viewport testing

Capture screenshots at:

- 375px.
- 390px.
- 430px.
- 768px.
- 1280px.

Test every new major screen.

Use synthetic fixtures for automated tests.

Do not introduce real personal information into test fixtures.

---

# 22. IMPLEMENTATION PHASES

## Phase 0 — Audit and baseline

- Inspect repository.
- Read design references.
- Inspect data models.
- Identify existing features.
- Run baseline tests.
- Create safe backup/migration strategy.

## Phase 1 — Training recommendations

- Guided programme selection.
- Programme library.
- Recommendation matching.
- Exercise load entry.
- Existing-programme preservation.
- Bodyweight tracking.

Run tests.

## Phase 2 — Nutrition foundation

- Optional nutrition onboarding.
- Energy estimation.
- Protein targets.
- Cooking/eating-out preferences.
- Cuisine selection.
- Dietary restrictions.

Run tests.

## Phase 3 — Singapore meals

- Curated local food catalogue.
- Nutrition provenance and uncertainty.
- Cooking suggestions.
- Eating-out suggestions.
- Meal swapping.
- Saved preferences.

Run tests.

## Phase 4 — Integrated coaching

- Connect relevant workout/bodyweight/nutrition context.
- Correct weekly schedule inconsistencies.
- Improve coaching status interpretation.
- Preserve approval workflow.

Run tests.

## Phase 5 — Character personalisation

- Character selection.
- Original sprite integration or placeholders.
- Persisted cosmetic choices.
- Future unlock architecture.
- XP regression testing.

Run tests.

## Phase 6 — Quality and release

- UI refinement.
- Mobile responsiveness.
- Accessibility.
- Offline validation.
- Backup/restore.
- Full regression tests.
- Documentation.
- Visual screenshots.

Do not postpone testing until the end.

If time or context limits prevent completing all phases, preserve a working application and clearly identify unfinished work. Never report unimplemented functionality as complete.

---

# 23. DEFINITION OF DONE

AdaptFit V0.3 is complete when:

1. Users can obtain recommended training programmes.
2. Recommendations respect their realistic time availability.
3. Users can modify recommended routines.
4. Existing routines remain intact.
5. Starting exercise weights can be recorded.
6. Actual lifting loads are independently saved.
7. Users can track personal bodyweight.
8. Calorie estimation is available as an optional feature.
9. Protein targets can be calculated.
10. Cooking versus eating-out preferences are supported.
11. Multiple cuisines can be selected.
12. Dietary restrictions are respected.
13. Singapore-relevant meals can be suggested.
14. Nutritional estimates are sourced or clearly labelled unavailable.
15. Users can swap meals.
16. Nutrition information informs coaching when appropriate.
17. Planned weekly-session counts are consistent.
18. Insufficient data is handled honestly.
19. Four character styles can be selected.
20. Character changes preserve XP and achievements.
21. Existing workout history remains intact.
22. Backup and restore work.
23. Core functionality works offline.
24. No paid AI API is required.
25. All required executed tests pass.
26. Production build succeeds.
27. The final UI remains consistent with Premium Pixel Hybrid branding.
28. All limitations are documented.

---

# 24. REQUIRED FINAL DELIVERABLES

At completion provide:

1. Summary of implemented changes.
2. Implemented and incomplete user stories.
3. Story-point completion report.
4. Updated project documentation.
5. Updated storyboard.
6. Data-model and migration summary.
7. Research and source registry.
8. Automated test report.
9. Playwright screenshots.
10. Known defects.
11. Exact local development commands.
12. Exact production build commands.
13. Backup and restore instructions.
14. Recommended V0.4 priorities.

Do not claim tests passed unless executed.

Do not claim external research was completed if source access was unavailable.

Do not claim production character assets exist if only placeholders were created.

**Begin by auditing the existing AdaptFit V0.2 repository. Then implement V0.3 incrementally, prioritising accurate training data, guided programme recommendations and optional nutrition personalisation. Preserve all existing user data and keep the application runnable throughout development.**
