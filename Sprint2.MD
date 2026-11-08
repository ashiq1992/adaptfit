IMPORTANT: READ BEFORE DEVELOPMENT

Before planning, modifying or implementing any code, you MUST inspect the following directory in the existing AdaptFit project:

design-references/

Read and analyse these four files:

README_DESIGN_DIRECTION.md

01_AdaptFit_Branding_Master.png

02_AdaptFit_Main_UI_Reference.png

03_AdaptFit_Expanded_Screens_UI_Kit.png

These files represent the approved visual direction for AdaptFit V0.2.

Do not ignore these design references or replace them with a generic dark-themed fitness dashboard.

1. Design reference priorities

Primary branding reference

01_AdaptFit_Branding_Master.png

Use for:

AdaptFit logo and visual identity.

Colour palette and typography.

Pixel-art character design.

XP, achievements and RPG statistics.

Component styling and brand consistency.

Primary layout reference

02_AdaptFit_Main_UI_Reference.png

Use for:

Home and Today dashboard.

Active workout screen.

Progress dashboard.

AI Coach screen.

Journey and Character progression.

Additional component reference

03_AdaptFit_Expanded_Screens_UI_Kit.png

Use for:

History and Settings layouts.

Workout logging controls.

Progress charts and cards.

Buttons, badges and component states.

Detailed character progression elements.

2. Non-negotiable UI principles

AdaptFit must look and feel like a premium fitness application with pixel-RPG progression.

Fitness functionality takes priority.

The character, XP system, achievements and RPG stats must remain visible and motivating, but they must not overwhelm the workout experience.

Preserve:

Detailed pixel adventurer character.

RPG attributes: STR, END, REC and CONS.

Level progression and XP bar.

Premium graphite and midnight backgrounds.

Teal primary actions.

Amber achievement rewards.

Violet rare achievements.

Clean typography and readable fitness data.

The design should feel professional, polished, distinctive and suitable for experienced adult gym-goers.

3. Design fidelity requirements

Do not simply display the reference images as backgrounds or recreate them as non-functional static mockups.

Translate the designs into reusable, responsive React components.

All displayed workout data, character statistics, charts, buttons and interactions must connect to the application's actual state and business logic.

Use original pixel artwork and do not assume assets in the mockups can be extracted as production sprites.

Use the written design tokens as exact colour specifications where the artistic mockups differ slightly.

Prioritise mobile usability and keep workout logging fast and intuitive.

4. Mandatory visual testing

After implementing each major screen:

Run the application locally.

Capture screenshots using Playwright.

Compare the rendered screen with the relevant design reference.

Review layout, colours, typography, visual hierarchy and character appearance.

Check navigation and touch controls.

Test at mobile viewport widths of 375px, 390px and 430px.

Fix visible issues before considering the screen complete.

Do not claim visual fidelity without reviewing the rendered result.

5. Required output

Before implementation, summarise the design requirements understood from the reference files.

Then implement the V0.2 sprint below while preserving existing application features and personal data.

The final application should balance:

Gym-first functionality + intelligent lifestyle coaching + motivating pixel-RPG progression.

# ADAPTFIT V0.2 — UNIFIED PRODUCT IMPROVEMENT SPRINT

## ROLE AND EXECUTION MANDATE

Act as a senior full-stack engineer, fitness product architect, UI/UX designer, game systems designer, QA automation lead and technical delivery manager.

You are working on an **EXISTING local application called AdaptFit**.

**Do not rebuild the application from scratch.**

Inspect the current repository, identify existing functionality, preserve working features and implement the improvements specified below.

This is an implementation sprint, not a design consultation.

The objective is to deliver a working, tested application that the owner can use personally before offering it to other users.

Do not stop after producing documentation, mockups or a plan. Implement the required changes.

---

# 1. PRODUCT VISION

## Product name
AdaptFit

## Design identity
Premium Pixel Hybrid — Performance Edition

## Tagline
Your training partner for real life.

## Target audience
Experienced gym-goers aged approximately 25–40, initially in Singapore, who face demanding work schedules and want to improve strength, hypertrophy and body composition.

## Core philosophy

AdaptFit is NOT a generic workout generator.

It is a fitness companion that:

1. Preserves the user's existing training programme.
2. Makes recording workouts fast and effortless.
3. Measures actual training progress.
4. Identifies potential plateaus.
5. Considers sleep, work, nutrition, fatigue and training availability.
6. Suggests appropriate training adjustments.
7. Rewards meaningful progress through a pixel-RPG character system.

**Fitness is the primary function. Gamification enhances motivation without becoming the main product.**

A user should be able to open the application, understand the next workout and log completed sets with very little interaction.

---

# 2. CRITICAL PROBLEMS IDENTIFIED IN CURRENT BUILD

The existing screens have been reviewed.

### Current Today page

Issues:
- Displays a generic bodyweight endurance workout.
- Does not clearly prioritise the user's existing hypertrophy or strength plan.
- Contains a long list of exercises.
- Character is separated into a small basic card.
- No prominent recent strength-performance comparison.
- Lacks the approved premium design identity.

### Current History page

Issues:
- Displays exercises and individual sets as a very long text list.
- Does not show useful previous-session comparisons.
- No strength progression indicators are visible.
- One recorded session displays 26 sets completed in 1 minute.
- Multiple exercises display identical 30 kg loads; determine whether this is test data or a data-integrity issue.
- No meaningful progress dashboard is visible.

### Current Character page

Issues:
- Character artwork is too basic.
- Character progression lacks visual excitement.
- Stats mainly represent session counts.
- Strength progression is not meaningfully connected to RPG progress.
- Achievement system is visually underdeveloped.
- Large unused areas make the screen feel unfinished.

### Current Settings page

Issues:
- Limited training-goal configuration.
- No clearly visible established-routine editor.
- No clearly visible work-schedule or sleep-profile setup.
- No detailed lifestyle preferences.
- Settings layout is basic.
- Bottom navigation overlaps content in the screenshots.

### Overall application

The design currently resembles a basic fitness utility rather than the approved Premium Pixel Hybrid concept.

**Fix functionality and reliability first, while delivering the visual redesign as part of the same development programme.**

Do not assume a feature is absent solely because it is not visible in the screenshots. Inspect the existing implementation.

---

# 3. SPRINT MANAGEMENT AND STORY POINTS

Use Fibonacci story points: 1, 2, 3, 5, 8.

| ID | Story | Priority | Points |
|---|---|---|---|
| AF01 | Repository audit and baseline tests | P0 | 3 |
| AF02 | Premium UI design system and navigation | P0 | 5 |
| AF03 | Existing workout-plan management | P0 | 8 |
| AF04 | Fast workout logging | P0 | 8 |
| AF05 | History redesign and data integrity | P0 | 8 |
| AF06 | Strength progression engine | P0 | 8 |
| AF07 | Plateau detection and coaching | P0 | 8 |
| AF08 | Lifestyle profiles and adaptive scheduling | P0 | 8 |
| AF09 | Character redesign and RPG progression | P0 | 8 |
| AF10 | Weekly review and progress dashboard | P0 | 5 |
| AF11 | Local storage, backup and migrations | P0 | 5 |
| AF12 | Accessibility, responsiveness and PWA | P0 | 5 |
| AF13 | End-to-end testing and regression | P0 | 8 |

**Total: 87 story points.**

This is a unified release backlog, not a claim that all work fits into a conventional short sprint.

Implement in logical increments. Maintain a working application after each phase.

Create or update:
- USER_STORIES.md
- STORYBOARD.md
- ARCHITECTURE.md
- DESIGN_SYSTEM.md
- TEST_PLAN.md
- TEST_RESULTS.md
- CHANGELOG.md
- README.md

Include acceptance criteria and implementation status for every story.

---

# 4. APPROVED VISUAL DESIGN

## Design direction

Premium Pixel Hybrid.

Main interface:
- Clean and modern.
- Premium dark aesthetic.
- Gym-first.
- Comfortable typography.
- High-contrast buttons and charts.
- Minimal clutter.

Gamification:
- Detailed pixel character.
- XP progression.
- Character statistics.
- Achievements.
- Optional missions.
- Occasional animations.

Do not build a fully pixelated interface.

Keep modern typography and conventional UI controls for training data.

## Colour system

Use:

- Graphite: #0F1116
- Midnight Navy: #131F2E
- Primary Teal: #00D6A3
- Reward Amber: #F5B041
- Rare Achievement Violet: #9B6DFF
- Primary Text: #F4F3EE
- Secondary Text: accessible muted grey

Follow WCAG AA contrast requirements where applicable.

## Typography

Use a readable modern sans-serif.

Pixel fonts, if any, should appear only in decorative achievement labels.

Do not use pixel typography for exercise names, values, training instructions or coaching explanations.

## Motion

Implement:
- Smooth progress indicators.
- Subtle XP animations.
- Lightweight achievement effects.
- Small character progression effects.
- Smooth navigation transitions where appropriate.

Respect reduced-motion settings.

Avoid constant animation.

## Responsive design

Test at:
- 375px
- 390px
- 430px
- 768px
- 1280px

Ensure:
- No horizontal overflow.
- No overlapping bottom navigation.
- Correct iPhone safe-area padding.
- Large touch targets.
- Readable typography.

The desktop layout should be intentional, not merely a stretched mobile screen.

---

# 5. APPLICATION NAVIGATION

Replace the limited three-tab navigation with:

### TRAIN
Next workout, active session and workout history.

### PROGRESS
Strength trends, physique measurements, character and achievements.

### COACH
Weekly reviews, progress alerts and adaptive recommendations.

### JOURNEY
Detailed RPG character, achievements and optional missions.

The character must also remain visible in a compact form on Home and Progress.

Settings should be accessible via a profile/settings icon.

Do not create excessive nested navigation.

---

# 6. AF03 — EXISTING TRAINING PROGRAMMES

## User story

As an experienced lifter, I want to use my own training programme so AdaptFit helps me improve my existing routine instead of replacing it with generic workouts.

## Requirements

Users must be able to:
- Create training programmes.
- Edit existing programmes.
- Import an existing routine.
- Define workout days.
- Define exercises.
- Define working sets.
- Define target repetition ranges.
- Define rest durations.
- Set priority exercises.
- Configure weekly training availability.
- Save multiple training templates.

Example workout:

Upper Body A:
- Smith Machine Bench Press
- Lat Pulldown
- Seated Cable Row
- Lateral Raises

This is example data only.

Do not assume it represents the user's entire actual programme.

## Existing-plan priority rule

If the user already has a valid training programme, use that programme by default.

Do not automatically replace it with a generic full-body, endurance or bodyweight session.

If a user has less time, propose a shortened version of the existing session.

Preserve priority exercises when reasonable.

All modifications must require approval.

## Acceptance criteria

- Existing routines persist after refresh.
- Users can edit exercises and schedules.
- Users can duplicate a training day.
- Workout history remains unchanged when a template changes.
- Generic workouts are never silently substituted.
- Restored/imported plans remain editable.

---

# 7. AF04 — FAST WORKOUT LOGGING

## Objective

Make this the easiest and most frequently used part of the application.

Users should not repeatedly type their entire workout.

## Workout screen

Display:
- Workout name.
- Exercises.
- Previous-session performance.
- Current planned sets.
- Current load.
- Current repetitions.
- Completion controls.

## Required interaction

When a workout begins:

1. Load exercises from the saved plan.
2. Prefill the previous comparable workout's values.
3. Show suggested targets when justified.
4. Allow individual sets to be confirmed.
5. Save confirmed performance immediately.

An unchanged set should be confirmable in one tap.

Users must be able to:
- Increment/decrement weight.
- Increment/decrement repetitions.
- Enter arbitrary values.
- Add sets.
- Delete sets.
- Skip exercises.
- Pause/resume the workout.
- Save a draft.
- Finish the workout.
- Correct mistakes afterward.

Do not mark prefilled values as completed.

## Important weight handling

Support:
- Total weight.
- Weight per side.
- Weight per dumbbell.
- Bodyweight.
- Added bodyweight load.
- Assisted bodyweight.
- Timed exercises.

Do not assume Smith machine bar weight.

Store load units and interpretation explicitly.

Do not combine incompatible loading conventions.

## Duration

Record real start and completion timestamps.

Distinguish:
- Actual elapsed session time.
- Active timer duration.
- Manually entered historical duration.
- Time spent entering workout data.

Do not represent 26 logged sets entered in one minute as a one-minute workout unless the user explicitly recorded that as the real session duration.

Use "Duration unavailable" when appropriate.

## Notes import

Support importing existing text records.

Examples:

Smith Bench 30 kg/side 3x8

Squat 35 kg/side 4x6

Pull-ups BW 10, 9, 8

RDL 20 kg each hand 3x10

Provide a review screen before saving.

If a record lacks a date, exercise variation or loading interpretation, request clarification or leave it unresolved.

Never invent missing values.

Allow manual corrections.

## Acceptance criteria

- Users can finish a normal workout with minimal interaction.
- Previous values preload accurately.
- Different exercises retain separate weights.
- Drafts survive refresh.
- Set completion is explicit.
- Historical records can be corrected.
- No accidental duplicate sessions.

---

# 8. AF05 — HISTORY REDESIGN

The current History page is not sufficiently useful.

## New history listing

Display collapsed workout cards by default.

Each card includes:
- Date.
- Workout name.
- Completion status.
- Actual duration, if known.
- Exercises completed.
- Strength sets completed.
- Important performance changes.

For example:

FULL BODY
6 November 2026

6 exercises
18 completed strength sets
Duration: not recorded

Chest Press: +2 reps
Lat Pulldown: stable
Leg Press: stable

These example comparisons must only be shown when actual comparable previous data exists.

## Expanded workout view

Show:
- Exercise name.
- All completed sets.
- Weights and repetitions.
- Previous comparable performance.
- Load/repetition differences.
- Relevant personal records.

Support:
- Expand/collapse.
- Edit historical session.
- Delete session with confirmation.
- Filter by date.
- Filter by exercise.
- Repeat a saved workout template.

## Data audit

Investigate:
- The screenshot showing 26 sets in one minute.
- Repeated 30 kg values across exercises.
- Whether completed sets are generated automatically.
- Whether all recorded sets were actually confirmed.

Do not assume the values are wrong merely because they look unusual.

Determine their source and document findings.

## Acceptance criteria

- History summaries are readable on mobile.
- Previous performance comparisons are correct.
- Expanded set data remains accessible.
- Historical edits trigger recalculation of trends and achievements.
- Deleted workouts do not leave invalid XP or progression data.

---

# 9. AF06 — PROGRESSION INTELLIGENCE ENGINE

Create pure, deterministic and unit-testable calculation functions.

## Track

- Working load.
- Repetitions.
- Completed sets.
- Training volume.
- Performance trends.
- Exercise frequency.
- Training consistency.
- Optional RIR.

Support charts over:
- 4 weeks.
- 8 weeks.
- 12 weeks.
- All available data.

## Important calculation rules

Compare identical exercise variations with compatible units.

Do not infer improvements from incompatible loading conditions.

Distinguish:
- Increased load.
- Increased reps.
- More completed sets.
- Reduced effort at comparable performance.
- Stable performance.
- Performance regression.
- Insufficient data.

Estimated 1RM is optional and must be clearly labelled as an estimate.

Avoid presenting one combined strength score if it aggregates incompatible exercises or units.

Charts must use actual saved data.

Empty or insufficient history must produce informative empty states.

## Acceptance criteria

- Calculations are repeatable.
- Previous-session comparisons match stored records.
- Exercise changes do not create misleading progression.
- Missing information is handled honestly.
- No fabricated percentages appear.

---

# 10. AF07 — POTENTIAL PLATEAU DETECTION

This is a core product differentiator.

## User story

As a gym-goer, I want AdaptFit to identify possible stagnation and help me understand what might be contributing before recommending programme changes.

## Detection requirements

Use several comparable training sessions and configurable observation periods.

Consider:
- Load changes.
- Repetition changes.
- Completed sets.
- Training frequency.
- Effort where available.
- Exercise variations.
- Recent training consistency.

Do not classify a single bad session as a plateau.

Do not assume four unchanged workouts automatically require a programme change.

When appropriate, flag:

"Possible plateau — additional context needed."

## Coach follow-up

Ask one or two relevant questions, not a lengthy questionnaire.

Possible questions:
- Has your sleep changed?
- Have recent sets felt harder?
- Has your food intake changed?
- Have you missed training sessions?
- Are you experiencing unusual fatigue?

Use only questions relevant to the current analysis.

## Recommendation options

- Continue current plan.
- Review recovery.
- Check training consistency.
- Consider a small progression adjustment.
- Reorganise training schedule.
- Consider an appropriate planned reduction in workload.
- Seek professional advice where symptoms warrant it.

Do not provide diagnosis or treatment.

Do not automatically modify programmes.

## Recommendation record

Save:
- Trigger.
- Supporting data.
- Missing data.
- Recommendation.
- User response.
- Accepted changes.
- Follow-up outcome.

## Acceptance criteria

- Genuine possible stagnation can be flagged.
- Insufficient history does not produce false certainty.
- Recommendations have explanations.
- User approval is required for changes.
- Accepted recommendations can be reviewed later.

---

# 11. AF08 — LIFESTYLE-AWARE TRAINING

AdaptFit must understand that work, nutrition, sleep and personal commitments influence training.

However, information collection must remain minimal.

## Optional lifestyle profile

Include:

### Work
- Typical working days.
- Normal work hours.
- Unusual overtime.
- Available training windows.

### Sleep
- Normal sleep schedule.
- Optional recent sleep information.
- Perceived sleep quality.

### Nutrition
- General meal pattern.
- Fitness objective.
- Dietary restrictions.
- Optional protein target.
- Optional energy-intake information.

### Wellbeing
- General fatigue.
- Stress.
- Muscle soreness.
- Optional recovery check-ins.

### Training
- Preferred gym days.
- Minimum available days.
- Preferred session length.
- Priority exercises.

### Localisation
- Singapore timezone.
- Kilograms by default.
- Local food examples where supported.
- Optional halal and other dietary preferences.
- Optional fasting schedule.

Do not build a full calorie database yet.

Do not claim exact nutrition information for hawker meals unless supported by reliable data.

## Smart scheduling

Example:

Original plan:
4 sessions per week.

Available this week:
2 sessions.

The application should propose a revised schedule that preserves training priorities where feasible.

Show the trade-offs.

Do not automatically cram four sessions into two or prescribe excessive volume.

## Acceptance criteria

- Lifestyle profile is optional.
- Work and sleep patterns can be updated.
- No daily questionnaire is required.
- Adaptive recommendations work without complete data.
- All changes require approval.

---

# 12. AF09 — CHARACTER AND RPG REDESIGN

The pixel character must be retained and substantially improved.

The current basic sprite does not match the approved premium visual direction.

## Character art

Create an original detailed pixel adventurer.

Style:
- Premium RPG pixel art.
- Recognisable silhouette.
- Expressive but not childish.
- Consistent palette.
- Compatible with dark UI.
- Lightweight enough for mobile use.

The character should appear:
- Compactly on Home.
- Prominently on Journey.
- As an optional small illustration on Weekly Review.

Avoid full-screen game scenes.

## RPG statistics

Implement four primary character attributes.

### STR — Strength
Based on verified performance milestones.

### END — Endurance
Based on relevant training-capacity achievements.

### REC — Recovery
Based on explicitly recorded recovery-related behaviours, not physiological diagnoses.

### CONS — Consistency
Based on progress against realistic planned training commitments.

These are game statistics, not medical measurements.

Explain what contributes to each statistic.

## Levels and XP

Create a deterministic XP system.

Award XP for:
- Completing planned workouts.
- Completing approved adjusted schedules.
- Verified performance milestones.
- Appropriate consistency achievements.
- Optional recovery-related goals.

Do not award duplicate XP.

Do not award XP for repeated imports of the same session.

Do not penalise missed workouts.

Do not reward unnecessary extra exercise.

## Character progression

Add:
- Level badge.
- XP progress bar.
- Improved pixel avatar frame.
- Small visual unlocks.
- Achievement badges.
- Optional progression animations.

Avoid monetisation mechanics, loot boxes or manipulative streak pressure.

## Optional missions

Examples:
- Complete planned workouts.
- Review weekly progress.
- Reach a personal milestone.
- Follow a reasonable adjusted training plan.

Users may disable gamification.

## Acceptance criteria

- Character appearance is improved.
- XP persists and recalculates correctly.
- Character statistics reflect recorded achievements.
- Progression is consistent after backup restore.
- Disabling RPG elements does not impair workout functionality.

---

# 13. AF10 — REDESIGN THE MAIN SCREENS

## SCREEN 1 — HOME / TODAY

Purpose:
Help the user immediately understand the next workout.

Layout order:

1. Compact greeting.
2. Pixel character, level and XP.
3. Next workout card.
4. Previous performance on the main exercise.
5. Clear Start Workout button.
6. One relevant coaching insight.
7. Compact weekly mission indicator.

Do not display a huge exercise list on the homepage.

Do not overwhelm the user with multiple charts.

The primary action should be visually unmistakable.

## SCREEN 2 — ACTIVE WORKOUT

Purpose:
Fast logging.

Layout:
- Workout header.
- Elapsed timer.
- Exercise cards.
- Previous-session values.
- Set completion controls.
- Weight/repetition adjustments.
- Sticky finish/save controls.

RPG elements:
Only a subtle XP or milestone indicator.

Avoid large character animations during active logging.

## SCREEN 3 — PROGRESS

Purpose:
Explain whether training is improving.

Display:
- Main lift trends.
- Exercise selection.
- Training consistency.
- Performance changes.
- Optional physique data.
- Relevant milestones.

Include access to Character/Journey.

Use clear charts and metrics.

## SCREEN 4 — JOURNEY

Purpose:
Make authentic progress rewarding.

Display:
- Detailed pixel character.
- Level and XP.
- RPG statistics.
- Character progression.
- Achievements.
- Optional quests.

Keep actual gym achievements visible alongside the RPG values.

## SCREEN 5 — COACH

Purpose:
Give intelligent, practical recommendations.

Display:
- Weekly summary.
- Recent training trend.
- Available lifestyle context.
- Potential plateau alerts.
- Suggested adaptations.
- Recommendation history.

Provide:
- Accept.
- Reject.
- Postpone.

Do not overstate what the data proves.

## SCREEN 6 — SETTINGS

Purpose:
Configure the experience without unnecessary complexity.

Sections:
- Training goals.
- Training experience.
- Existing programmes.
- Training availability.
- Work schedule.
- Sleep habits.
- Nutrition preferences.
- Units.
- Gamification preferences.
- Data and backups.
- Privacy information.

Use collapsible sections where appropriate.

---

# 14. DATA STORAGE AND SAFETY

Maintain the existing local-first architecture.

Use IndexedDB if already implemented or migrate safely if required.

Do not delete existing user data.

Before data-model changes:
1. Inspect the current schema.
2. Create a migration plan.
3. Validate data preservation.
4. Test with a copy of existing data.
5. Provide rollback/backup instructions.

Implement:
- Schema versioning.
- Data validation.
- Export to JSON.
- Restore from JSON.
- Import preview.
- Confirmation before overwrite.
- Duplicate detection.
- Transactional updates where necessary.

No external AI API is needed.

No cloud storage is required.

No paid tools or subscriptions should be introduced without approval.

The application must not transmit personal training or lifestyle data to third parties.

---

# 15. REQUIRED STORYBOARD

Create a detailed STORYBOARD.md covering these journeys.

## Journey A — First-time setup

Welcome
→ Set goal
→ Import/create routine
→ Set schedule
→ Optional lifestyle preferences
→ Character introduction
→ Home

## Journey B — Normal gym session

Home
→ Start Workout
→ Previous performance prefilled
→ Confirm or edit sets
→ Finish workout
→ History updated
→ Progress calculated
→ XP awarded
→ Home

## Journey C — Interrupted week

Normal plan
→ Schedule reduced
→ Adaptation suggested
→ User reviews proposed sessions
→ User approves or rejects
→ Updated schedule
→ Weekly review

## Journey D — Strength plateau

Training records accumulate
→ Potential stagnation identified
→ Context questions
→ Evidence displayed
→ Recommendation proposed
→ User decision
→ Follow-up monitoring

## Journey E — Character milestone

Workout completed
→ Verified achievement
→ XP awarded
→ Character progression updated
→ Optional animation
→ Return to training

## Journey F — Historical correction

Open History
→ Edit workout
→ Save correction
→ Progress recalculated
→ Achievements reconciled
→ Backup remains valid

For each journey document:
- Trigger.
- Screens.
- Actions.
- Data requirements.
- Success state.
- Empty state.
- Error state.
- Acceptance criteria.

---

# 16. TESTING REQUIREMENTS

Do not claim success without executing tests.

Use Vitest, React Testing Library and Playwright where appropriate.

## Unit testing

### Workout data

T01 — Different exercises preserve different loads.

T02 — Per-side loads are not confused with total loads.

T03 — Previous-session values prefill correctly.

T04 — Prefilled values are not automatically completed.

T05 — Weight changes save accurately.

T06 — Repetition changes save accurately.

T07 — Skipped exercises are handled correctly.

T08 — Draft sessions survive refresh.

T09 — Historical session duration is calculated correctly.

T10 — Unavailable duration is not fabricated.

### Progression

T11 — Increased repetitions are identified.

T12 — Increased loads are identified.

T13 — Stable performance is correctly classified.

T14 — Different exercise variations are not compared incorrectly.

T15 — Insufficient data does not produce false progression.

T16 — Training volume calculations are correct.

T17 — Historical corrections recalculate trends.

### Plateau detection

T18 — Sustained comparable stagnation may trigger a check-in.

T19 — One bad workout does not trigger a plateau.

T20 — Missing RIR is handled honestly.

T21 — Training interruption is considered.

T22 — Recommendations do not automatically modify programmes.

### Gamification

T23 — XP is awarded correctly.

T24 — Duplicate XP is prevented.

T25 — Level calculation is correct.

T26 — Character stats use valid recorded events.

T27 — Deleted sessions reconcile related rewards.

T28 — Gamification can be disabled.

### Lifestyle

T29 — Missing sleep data is supported.

T30 — Work schedule changes are saved.

T31 — Weekly adaptation preserves priority exercises.

T32 — Recommendations require user approval.

T33 — Optional dietary preferences are retained.

### Storage

T34 — Backup exports valid data.

T35 — Restore validates schema.

T36 — Corrupted backup is rejected safely.

T37 — Schema migrations preserve valid records.

T38 — Duplicate imports are handled.

## Integration tests

T39 — Create plan, log session, view History.

T40 — Complete workout, update Progress.

T41 — Complete workout, award appropriate XP.

T42 — Edit History, recalculate statistics.

T43 — Generate a plateau alert from sufficient history.

T44 — Reject recommendation and preserve existing plan.

T45 — Accept recommendation and save approved plan.

T46 — Export and restore training and character data.

T47 — Resume unfinished workout.

T48 — Import Notes and confirm correct values.

## Playwright E2E tests

T49 — First-time onboarding.

T50 — Create a four-day hypertrophy programme.

T51 — Start and complete a workout.

T52 — Confirm a prefilled set with one tap.

T53 — Edit a load or repetition value.

T54 — Navigate to History.

T55 — Expand workout details.

T56 — View strength progression.

T57 — View character progression.

T58 — Review adaptive coaching.

T59 — Apply a schedule adjustment.

T60 — Verify local persistence after refresh.

T61 — Verify offline production functionality after initial load.

T62 — Verify 375px mobile layout.

T63 — Verify 390px mobile layout.

T64 — Verify 430px mobile layout.

T65 — Verify navigation does not overlap content.

T66 — Verify reduced-motion behaviour.

T67 — Verify backup and restore.

T68 — Verify malformed input handling.

## Test fixtures

Use clearly labelled synthetic data:

- Beginner profile.
- Experienced hypertrophy profile.
- Four-day training schedule.
- Two-day reduced schedule.
- Stable bench performance.
- Improving bench performance.
- Reduced sleep period.
- Missing nutrition data.
- Completed and incomplete workouts.
- Corrupted backup.

Do not mix demo fixtures with real user data without explicit approval.

---

# 17. UI VISUAL REGRESSION TESTING

Use Playwright screenshots to compare the implementation with the approved Premium Pixel Hybrid direction.

Capture:
- Home desktop.
- Home mobile.
- Active workout.
- History.
- Progress.
- Journey/Character.
- Coach.
- Settings.

Review:
- Layout hierarchy.
- Character visual quality.
- Text clipping.
- Contrast.
- Touch-target sizing.
- Navigation placement.
- Card spacing.
- Chart readability.
- Keyboard accessibility.

Fix visible defects.

Do not consider a screenshot sufficient evidence that the underlying feature works.

---

# 18. REQUIRED LOCAL COMMANDS

Maintain scripts for:

npm run dev

npm run build

npm run preview

npm run lint

npm run typecheck

npm run test

npm run test:coverage

npm run test:e2e

npm run check

The check command must execute lint, type checking, automated unit/integration tests and production build.

Document how to install Playwright browsers.

Provide Windows PowerShell instructions.

Do not introduce global dependencies unnecessarily.

---

# 19. IMPLEMENTATION SEQUENCE

## Phase 0 — Audit

Inspect current repository.

Identify:
- Existing working functionality.
- Missing requirements.
- Broken logic.
- Existing database schema.
- Existing tests.
- Existing visual components.

Run baseline tests.

Document findings.

Do not discard functioning code without justification.

## Phase 1 — Training foundation

Implement:
- Existing-plan management.
- Workout logging improvements.
- Historical data integrity.
- Workout duration correction.
- Notes import.

Run tests.

## Phase 2 — Progress intelligence

Implement:
- Historical comparisons.
- Strength charts.
- Plateau detection.
- Recommendation engine.
- Lifestyle-aware scheduling.

Run tests.

## Phase 3 — Premium UI redesign

Implement:
- New navigation.
- Home redesign.
- Workout screen refinement.
- History redesign.
- Progress dashboard.
- Coach interface.
- Settings improvements.

Run visual checks.

## Phase 4 — RPG progression

Implement:
- Improved pixel character.
- XP and levels.
- Four character stats.
- Achievements.
- Optional missions.
- Lightweight animations.

Run tests.

## Phase 5 — Final quality

Implement:
- Backup/migration verification.
- Accessibility fixes.
- Offline testing.
- Mobile visual testing.
- Full regression suite.
- Documentation.

Do not sacrifice essential workout reliability to complete decorative features.

If resources or execution limits prevent completion, preserve a working build and report exact remaining stories.

---

# 20. DEFINITION OF DONE

AdaptFit V0.2 is accepted only when:

- Existing user data is preserved.
- Users can manage their own gym routines.
- Generic programmes are not silently substituted.
- Workout logging is fast and reliable.
- Weights and repetitions persist accurately.
- Session-duration handling is trustworthy.
- History displays useful summaries and comparisons.
- Strength progress uses actual records.
- Potential plateau alerts work with sufficient data.
- Lifestyle-aware recommendations are explainable.
- Plan changes require approval.
- Character design matches the premium pixel direction.
- XP and character stats function correctly.
- Game elements do not overwhelm training.
- Mobile navigation is usable.
- No important content is obscured.
- Backup and restore work.
- Offline core workflows work.
- Required automated tests pass.
- Production build succeeds.
- No paid AI API is needed.
- All known limitations are documented.

---

# 21. FINAL DELIVERY REPORT

At completion provide:

1. Summary of changes.
2. Implemented stories and story points.
3. Incomplete stories and reasons.
4. Files created or modified.
5. Database migrations performed.
6. Exact test commands executed.
7. Test results with pass/fail counts.
8. Remaining known defects.
9. Screenshots of the updated interface.
10. Instructions to run the application locally.
11. Instructions to back up existing data.
12. Recommended next development phase.

Never claim a test passed unless it actually ran.

Never claim a feature is implemented if it is only mocked.

The primary objective is a genuinely usable personal fitness application, not a visually impressive prototype with unreliable workout logic.

**Begin by auditing the existing AdaptFit repository. Then implement the upgrade incrementally, preserving existing functionality and testing after every phase.**
