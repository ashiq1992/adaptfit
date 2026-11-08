# ADAPTFIT V0.4 — THE INTELLIGENT WORKOUT NOTEBOOK

## COMPLETE PRODUCT PIVOT, MOBILE APP REDESIGN & IMPLEMENTATION SPRINT

# 1. YOUR ROLE

You are acting as:

- Senior mobile application architect.
- Senior React/TypeScript engineer.
- Product designer specialising in mobile UX.
- Strength and hypertrophy training specialist.
- Fitness data and analytics engineer.
- QA automation and accessibility specialist.

You are working on an **EXISTING AdaptFit application**.

Your objective is to transform it from a conventional fitness tracker with gamification into a **minimalist, intelligent, Notes-first fitness companion**.

This is an implementation task, not a request for a proposal.

Inspect the existing repository, preserve valuable functionality and user data, implement the new experience, and verify it on mobile.

Do not rebuild from scratch unless a specific part of the existing architecture cannot reasonably support the required functionality.

---

# 2. IMPORTANT PRODUCT DIRECTION CHANGE

AdaptFit's previous approach introduced:

- Detailed workout logging.
- Individual set completion.
- RPG characters.
- XP and levels.
- Missions.
- Achievements.
- Multiple dashboards.
- Nutrition recommendations.
- Training programmes.

While these features were individually useful, the overall experience became complicated.

The owner has tested the application on an actual phone and found it more difficult to use than simply maintaining workouts in Apple Notes.

**This must be corrected.**

The central product problem is:

"How can we make following and updating a workout easier than using Notes, while automatically providing performance analysis and useful coaching?"

The answer must not be another complicated tracker.

## New product identity

**Product:** AdaptFit

**Version:** V0.4

**Positioning:** Intelligent Workout Notebook

**Tagline:** Train simply. Progress intelligently.

**Primary audience:** Busy adults who have limited time to manage workout records, particularly experienced lifters who already follow established routines.

## New core principles

1. Notes-first interaction.
2. Mobile-first design.
3. Minimal user input.
4. No mandatory live workout logging.
5. No mandatory individual set completion.
6. Update only what changes.
7. Automatically preserve historical performance.
8. Give useful feedback only when supported by actual data.
9. Keep existing training programmes.
10. Make every feature optional unless essential.
11. No unnecessary gamification.
12. No mandatory cloud AI service.

**The application must be easier than Notes to maintain, while doing the analysis that Notes cannot.**

---

# 3. REMOVE GAMIFICATION FROM THE USER EXPERIENCE

Remove all RPG-related interfaces from the active application.

This includes:

- Character screen.
- Character selection.
- RPG avatar on Home.
- XP bars.
- Character levels.
- STR/END/REC/CONS character attributes.
- Missions.
- Quests.
- Artificial achievement points.
- Game notifications.
- RPG-specific navigation.

Do not delete existing user records unnecessarily.

Preserve legacy character and XP data through a safe archival or migration approach where appropriate.

Remove game-related calculations from normal workout completion workflows.

Do not make gameplay dependencies a requirement for saving workouts.

If possible, retain legacy code in a separate Git branch or archived implementation so it can be revisited later.

## Replace gamification with meaningful progress

Show genuine achievements such as:

- Increased lifting weight.
- Additional repetitions.
- Improved training volume.
- New personal records.
- Consistent training completion.
- Improvements in bodyweight trends where relevant.
- Completion of planned training blocks.

These are real training milestones, not arbitrary rewards.

Avoid manipulative streaks or penalties for missed sessions.

---

# 4. NEW VISUAL DESIGN — PREMIUM MINIMALIST FITNESS APP

The existing Premium Pixel Hybrid references are now superseded for the primary application.

Do not follow the old RPG screen designs.

Create a new visual identity based on the concept:

**Apple Notes simplicity + premium fitness analytics + subtle intelligent coaching.**

Use these as inspiration for interaction quality, not as UI designs to copy.

## Visual characteristics

- Premium.
- Calm.
- Minimal.
- Professional.
- Readable.
- Fast.
- Native mobile-app feel.
- Designed for one-handed operation.

Keep the existing dark aesthetic where practical.

### Proposed colour system

Background: `#101418`

Secondary surface: `#192128`

Elevated surface: `#222D34`

Primary accent: `#2DD4BF`

Primary text: `#F5F7F7`

Secondary text: `#A4B4BA`

Border: `#34434A`

Positive progress: muted teal.

Warning/attention: muted amber.

Destructive actions: restrained red.

Avoid excessive gradients, glowing elements or bright decorative cards.

Use system fonts or a similarly readable modern sans-serif.

## UI philosophy

The application should look like a polished native fitness productivity app.

Prioritise:

- Large readable workout titles.
- Comfortable text spacing.
- Clear exercise formatting.
- Small, purposeful icons.
- Subtle dividers.
- Minimal forms.
- Clean charts.
- Easy text editing.

Do not make users navigate through several screens just to update one weight.

---

# 5. MOBILE APP REQUIREMENTS

This is a mobile-first product.

Prioritise:

- iPhone.
- Android phones.
- Mobile Safari.
- Mobile Chrome.
- Installed application experience.

The immediate implementation should be a fully installable Progressive Web App using the existing React/TypeScript stack.

The architecture should also remain compatible with future Capacitor packaging for native iOS and Android applications.

Do not rewrite the existing application in Swift, Kotlin or React Native simply to achieve a native appearance.

## App experience

Implement:

- App icon.
- Splash screen assets.
- Appropriate application name.
- PWA manifest.
- Offline functionality.
- Safe-area support.
- Full-screen standalone layout when installed.
- Smooth, lightweight transitions.
- Native-style bottom navigation.
- Correct keyboard behaviour.
- Responsive text inputs.
- Persistent local data.
- Reliable browser refresh and app reopening.

Test on realistic mobile viewports.

Ensure the interface works correctly when the mobile keyboard is open.

Avoid controls hidden behind the bottom navigation.

Use touch-friendly targets.

Do not require an App Store or Google Play developer account for V0.4.

Document how the PWA can later be packaged for app-store distribution without duplicating business logic.

---

# 6. NEW NAVIGATION

Simplify the application to three primary sections.

## PLAN

This is the main screen.

Contains:

- My workout notes.
- Current weekly training plan.
- Saved workout routines.
- Quick editing.
- Weekly update.
- Programme selection.

## PROGRESS

Contains:

- Strength progression.
- Exercise performance trends.
- Personal bests.
- Bodyweight tracking.
- Weekly/monthly training summaries.

## COACH

Contains:

- Weekly analysis.
- Potential plateau notifications.
- Recovery and lifestyle recommendations.
- Training adjustments.
- Optional nutrition/Fuel access.

Settings should be accessible from a small top-right settings/profile icon.

Avoid adding a separate Home, History, Journey or Achievements tab.

Historical workout data should remain available from Plan and Progress.

---

# 7. THE MOST IMPORTANT FEATURE — NOTES-FIRST WORKOUT VIEW

## User story

"As a gym-goer, I want to open AdaptFit and immediately see my workout in a simple readable format, just like Notes, without needing to start a workout or complete individual sets."

This is the primary application experience.

## Example display

MY TRAINING PLAN

TUESDAY — UPPER BODY

Smith Bench Press  
3 sets × 8 reps — 30 kg/side

Lat Pulldown  
3 sets × 10 reps — 45 kg

Seated Cable Row  
3 sets × 10 reps — 40 kg

Lateral Raises  
3 sets × 12 reps — 8 kg/dumbbell

SATURDAY — LOWER BODY

Squat  
4 sets × 6 reps — 35 kg/side

Romanian Deadlift  
3 sets × 10 reps — 20 kg/dumbbell

Leg Press  
3 sets × 12 reps — 100 kg

This is illustrative data, not actual user history.

## Interaction requirements

Users should be able to:

- Open a workout note.
- Read the full routine.
- Scroll naturally.
- Tap an exercise to edit.
- Edit text directly.
- Copy a workout.
- Duplicate a training week.
- Rearrange exercises.
- Add an exercise.
- Remove an exercise.
- Add optional notes.
- Save changes automatically.

No mandatory Start Workout action.

No mandatory Finish Workout action.

No mandatory set-by-set logging.

No timers unless the user explicitly enables them.

## Editing experience

Use a Notes-like editing interface.

The user should be able to tap a line, edit a value and continue.

Avoid separate multi-field forms for ordinary updates.

Examples:

Changing:

Smith Bench Press — 30 kg/side × 8

To:

Smith Bench Press — 30 kg/side × 9

Should require minimal effort.

Support changing several values within one editing session.

## Technical design

Maintain the user's original editable note text.

Also maintain validated structured exercise information for analysis.

Do not require all user notes to follow a rigid format.

When the parser cannot understand an entry:

- Preserve the original text.
- Do not discard it.
- Mark the uncertain field.
- Ask for clarification only when needed for analysis.

Never silently fabricate structured workout data.

---

# 8. WEEKLY UPDATE MODE — CORE DIFFERENTIATOR

This should be the application's primary progress-recording workflow.

## User story

"As a lifter, I want to update my training once a week by changing only the values that have changed, instead of recording every set during workouts."

## Proposed workflow

1. Open AdaptFit.
2. View the current training week.
3. Tap "Update This Week".
4. See the previous confirmed values.
5. Change only the weights or repetitions that differ.
6. Confirm completed, skipped or unrecorded sessions.
7. Save the week's results.
8. Receive a short performance summary.

## Critical user experience

The app must not require the user to re-enter all previous values.

Provide a prominent:

**Copy Previous Week**

action.

Users can update only changed exercises.

## Required status handling

Distinguish:

- Completed with unchanged performance.
- Completed with updated performance.
- Partially completed.
- Skipped.
- Not recorded.

Never assume that copying last week's results proves this week's workout was completed.

A session must be explicitly confirmed before it counts as completed in the historical training analysis.

Provide batch actions so users do not need to confirm every exercise individually.

## Weekly sheet example

WEEK OF 9 NOVEMBER

TUESDAY — UPPER BODY

Smith Bench Press  
30 kg/side × 9, 8, 8

Lat Pulldown  
45 kg × 10, 10, 9

Seated Cable Row  
40 kg × 10, 10, 10

SATURDAY — LOWER BODY

Squat  
35 kg/side × 6, 6, 6

Romanian Deadlift  
20 kg/dumbbell × 10, 10, 10

SUNDAY — FULL BODY

Not completed

This is example data.

## Save behaviour

Store:

- Actual week and dates.
- Confirmed session status.
- Exercise identity.
- Actual recorded load.
- Repetition information.
- Optional per-set detail.
- Loading convention.
- User notes.
- Source of imported/copied values.
- Previous reference.
- Confirmation timestamp.

Preserve previous weeks as historical records.

Do not overwrite earlier confirmed weeks.

## Primary usability target

A typical three-session training week with only a few changed exercise values should be updateable in under 60 seconds.

This is a target to validate, not an assumed achieved result.

Measure the number of taps, screens and time required during automated/manual usability tests.

---

# 9. PASTE FROM NOTES — ESSENTIAL FEATURE

Users may already maintain workouts in Apple Notes, Google Keep or other note-taking applications.

AdaptFit should make switching effortless.

## Requirements

Provide:

**Import or Paste Workout Note**

Allow users to paste free-form text.

Example:

Tuesday Upper  
Bench 30kg/side 8 8 7  
Pulldown 45kg 10 10 9  
Rows 40kg 10x3

Saturday Lower  
Squat 35kg/side 6x4  
RDL 20kg each hand 10x3

Parse the note into a structured draft where possible.

Support:

- Exercise headings.
- Day headings.
- Weights.
- Kg and lb.
- Weight per side.
- Weight per dumbbell.
- Sets and repetitions.
- Repetition lists.
- Bodyweight exercises.
- Timed exercises.
- Free-form comments.

## Import preview

After parsing, show:

- Exercises recognised.
- Loading conventions recognised.
- Values recognised.
- Uncertain values.
- Text preserved but not understood.

Require user review before committing imported workout records.

Never silently interpret ambiguous inputs.

For example, "30 kg bench" should not automatically be interpreted as kg/side.

## Import modes

Support:

1. Import as workout template.
2. Import as historical performance record.
3. Update an existing weekly record.

Historical imports must require a date or an explicit undated state.

Do not invent a workout date.

## Progressive implementation

For V0.4, implement a deterministic parser supporting common workout notation.

The parser should use structured rules and validation, not a paid AI API.

Keep the parser modular so a future optional AI interpretation layer can be added.

The essential workflow must function without AI.

---

# 10. OPTIONAL LIVE WORKOUT LOGGING

Do not remove existing functional set-by-set logging if it can be retained safely.

Instead:

- Make it optional.
- Move it behind a secondary action.
- Do not make it the default.
- Do not require live logging to receive progression feedback.

Users who enjoy detailed logging can continue using it.

Users who prefer weekly updates must receive the same core analytical benefits when their data supports them.

Both modes must write to a compatible exercise-performance data model.

Prevent duplicated records when the same session is entered through both methods.

---

# 11. AUTOMATIC PERFORMANCE ANALYSIS

This is the main advantage over Apple Notes.

AdaptFit should analyse confirmed workout records automatically.

## Track

- Exercise-specific performance.
- Working weight.
- Repetitions.
- Completed sets.
- Estimated training volume where meaningful.
- Training frequency.
- Personal records.
- Longer-term trends.
- Optional bodyweight.
- Optional RIR/effort.

## Example

Previous week:

Bench: 30 kg/side × 8, 8, 8

Current week:

Bench: 30 kg/side × 9, 8, 8

AdaptFit should recognise:

"Your bench press improved by one repetition in the first set at the same recorded load."

Do not claim overall strength improved by an exact percentage without adequate supporting information.

## Exercise comparisons

Only compare:

- The same exercise variation.
- Compatible loading conventions.
- Comparable performance records.

Do not automatically compare Smith bench press to dumbbell bench press.

Do not assume machine loads are equivalent across equipment.

Do not assume all Smith machines have the same bar weight.

## Progress states

Distinguish:

- Improving.
- Stable.
- Possible performance decline.
- Possible plateau.
- Insufficient data.

No fabricated progress scores.

No generic positive messages unrelated to actual performance.

## Chart requirements

Provide simple charts for:

- Working load over time.
- Repetition progression.
- Training volume, when meaningful.
- Bodyweight trend.
- Training frequency.

Avoid overwhelming the user with charts.

Show meaningful summaries first.

Allow detailed charts through an optional expanded view.

---

# 12. INTELLIGENT FEEDBACK AND COACHING

The coaching system should be useful without becoming noisy.

## User story

"As a gym-goer, I want AdaptFit to tell me when I am progressing, when I may be stuck and what I should consider changing."

## Coach behaviour

Do not generate long generic reports every week.

Default to a concise summary containing:

1. What improved.
2. What stayed stable.
3. What may need attention.
4. Whether an adjustment is actually justified.

Example:

"Your bench press improved slightly this week.

Your squat performance remains stable.

You completed two of your three planned sessions.

There isn't enough evidence to recommend changing your programme yet."

## Plateau detection

Use several comparable sessions and configurable observation windows.

Do not label a single poor session as a plateau.

Consider:

- Recent performance.
- Attendance.
- Training volume.
- Exercise changes.
- User-reported effort.
- Available recovery context.

If a possible plateau is identified, ask a relevant follow-up question.

Examples:

"Have you been sleeping less recently?"

"Have your working sets felt harder than usual?"

"Have you reduced your usual food intake?"

Do not require all users to complete daily recovery questionnaires.

## Recommendations

Depending on the available evidence, suggest:

- Continue current programme.
- Adjust repetitions.
- Consider a small load increase.
- Review rest periods.
- Reduce or reorganise training volume.
- Adapt to reduced weekly availability.
- Review sleep or nutrition.
- Consider a planned easier training period when appropriate.

All programme modifications require user approval.

Never make medical diagnoses.

Clearly communicate when data is insufficient.

---

# 13. AUTOMATIC WEEKLY REVIEW

After the user confirms a weekly update, generate a short review.

Example:

YOUR WEEKLY REVIEW

Training: 2 of 3 planned sessions

Bench Press: +1 repetition

Lat Pulldown: Stable

Squat: Stable

Coach:

"Your upper-body training shows some progress. Since one session was missed, continue the programme before considering a change."

Keep this readable on a mobile screen without excessive scrolling.

Allow the user to dismiss or revisit the review.

Store historical reviews or make them reliably reproducible from confirmed records.

Do not let reviews contradict underlying data.

---

# 14. ROUTINE LIBRARY & PROGRAMME PLANNING

Preserve guided programme recommendations from V0.3.

Users should still be able to:

- Choose a predefined routine.
- Import an existing routine.
- Create a routine manually.
- Adjust days available.
- Adjust session duration.
- Set training goals.
- Select equipment.
- Choose training priorities.
- Swap exercises.

However, once a programme has been selected, convert it into a clean Notes-style workout plan.

Do not force users to interact with a complex programme editor every week.

## Recommended programme journey

1. Choose fitness goal.
2. Choose training days.
3. Choose session duration.
4. Choose available equipment.
5. Preview recommended routine.
6. Accept or customise.
7. Open the completed workout note.

The user should immediately see a readable routine.

## Important

Programme creation is an occasional activity.

Following the programme is a frequent activity.

Weekly updates are periodic activities.

Design the interface accordingly.

Do not give occasional setup features more visual prominence than the everyday workout note.

---

# 15. NUTRITION & LIFESTYLE FEATURES

Preserve working nutrition and lifestyle features from V0.3.

These include:

- Optional calorie estimation.
- Protein targets.
- Eating-out preferences.
- Cooking preferences.
- Singapore cuisine selection.
- Dietary restrictions.
- Optional meal recommendations.
- Sleep and work-schedule context.

However, nutrition should no longer compete with the core training interface.

Place it within Coach or secondary settings.

Do not require nutrition onboarding to use workout notes.

Do not require daily food logging.

Only use nutrition information to support coaching when relevant and adequately supported.

Avoid creating another complex calorie-tracking application inside AdaptFit.

---

# 16. NEW MOBILE SCREEN DESIGNS

Design and implement the following screens.

## SCREEN A — PLAN

This is the main landing screen.

Top:

AdaptFit

Subtitle:
"Your training, simplified."

Main content:

- Current training week.
- Saved workout note cards.
- Quick access to today's planned routine.
- One prominent "Update This Week" action.

Secondary actions:

- Browse programmes.
- Import Notes.
- View previous weeks.

No RPG artwork.

No large dashboards.

No unnecessary greeting cards.

## SCREEN B — WORKOUT NOTE

This is the most important screen.

The interface should resemble an elegant, editable training note.

Show:

- Workout title.
- Training day.
- Exercise names.
- Planned sets and reps.
- Current reference weights.
- Notes.
- Clear edit controls.

Support immediate inline editing.

Use clean text layout rather than a stack of oversized exercise cards.

Provide a small optional action to open detailed set logging.

Ensure the entire workout remains readable during gym sessions.

## SCREEN C — WEEKLY UPDATE

Display a copy of the previous week's confirmed performance as editable reference data.

Highlight only values changed during editing.

Let users update multiple exercises in one screen.

Provide simple session status controls.

Include:

- Save Draft.
- Review Changes.
- Confirm Week.

Avoid repetitive confirmation dialogs.

Keep data integrity explicit.

## SCREEN D — PROGRESS

Show:

- Important exercise performance.
- Personal bests.
- Recent changes.
- Simple line charts.
- Optional bodyweight trend.

Default to concise information.

Avoid displaying every possible metric.

## SCREEN E — COACH

Show:

- Latest weekly review.
- Relevant progress findings.
- Potential issues.
- Suggested adjustments.
- Optional lifestyle and nutrition tools.

Use evidence-backed and understandable wording.

## SCREEN F — PROGRAMME LIBRARY

Allow users to:

- Browse suitable routines.
- Filter by schedule.
- Filter by goal.
- Review training structure.
- Preview and customise.
- Convert selected programmes into workout notes.

## SCREEN G — SETTINGS

Keep settings compact.

Include:

- Training preferences.
- Weekly schedule.
- Units.
- Weight conventions.
- Optional logging mode.
- Notification preferences.
- Nutrition preferences.
- Data export.
- Restore.
- Privacy.
- PWA installation information.

---

# 17. WORKOUT DATA ARCHITECTURE

The existing application may already store:

- Training programmes.
- Planned exercises.
- Completed workouts.
- Completed sets.
- Progress calculations.
- Lifestyle profiles.

Do not discard these records.

Implement a data architecture that supports both free-form workout notes and structured performance analysis.

## Suggested entities

WorkoutNote

WorkoutTemplate

TrainingWeek

WeeklySessionRecord

ExercisePerformance

PerformanceSet

WorkoutNoteRevision

WorkoutImport

ProgressSnapshot

CoachingInsight

RecommendationDecision

Maintain explicit references between the note, parsed exercise identities, weekly records and historical sessions.

## Essential rules

- Free-form notes remain editable.
- The original text is never lost during parsing.
- Historical performance is only recorded when confirmed.
- Copying a week does not fabricate completed workouts.
- Unchanged confirmed performance is valid performance.
- Unknown performance must not be treated as unchanged.
- Historical records are not overwritten by template edits.
- Deleting or editing a record updates dependent analytics.
- Duplicate imports must be detected.
- All mutations must be recoverable where practical.
- Offline edits must persist reliably.

Use schema validation and versioned database migrations.

Preserve existing IndexedDB data.

---

# 18. AUTO-SAVE AND EDITING RELIABILITY

The workout note must feel like a reliable note-taking application.

Implement:

- Auto-save.
- Save status indicator.
- Draft persistence.
- Safe navigation away.
- Data preservation after refresh.
- Conflict-safe updates within the local application.
- Undo for recent edits where practical.
- Confirmation for destructive deletion.

Test behaviour when:

- The browser refreshes.
- The phone locks.
- The application is backgrounded.
- The user changes tabs.
- The keyboard closes.
- The app is reopened offline.

Do not claim permanent background execution on iOS or Android.

Use normal browser lifecycle events and local persistence.

Avoid losing typed workout notes.

---

# 19. PERFORMANCE & USABILITY TARGETS

Establish measurable product requirements.

## Target A — Reading a workout

Open the app and reach the current workout note with minimal navigation.

Aim for one tap from the main Plan screen.

## Target B — Single exercise edit

Changing one recorded load or repetition should require minimal interaction.

No multi-screen editing flow.

## Target C — Weekly update

A user with a typical three-session training week and only a few changed values should be able to update the week in under 60 seconds.

## Target D — Existing Notes import

A user should be able to paste a recognisable workout note and confirm the structured interpretation without manually recreating the entire programme.

## Target E — Analysis

After confirmation, the user should immediately see a meaningful summary based on actual stored information.

These are usability targets to test, not claims about the current implementation.

Compare task time and interaction count with the previous interface.

Do not sacrifice data correctness merely to achieve a fast update time.

---

# 20. REQUIRED TESTING

Use the existing automated testing stack.

Extend unit, integration and Playwright tests.

## Notes and editing tests

T01 — Workout note opens correctly.

T02 — Existing workout programmes display as readable notes.

T03 — Inline editing updates the correct exercise.

T04 — Free-form text remains intact.

T05 — Auto-save persists changes.

T06 — Refresh does not erase draft edits.

T07 — Undo works where supported.

T08 — Deleting notes requires confirmation.

## Weekly update tests

T09 — Previous week can be copied into a draft.

T10 — Copied values remain unconfirmed until explicitly confirmed.

T11 — Unchanged completed performance is recorded correctly.

T12 — Skipped sessions do not receive completed status.

T13 — Unrecorded sessions do not receive completed status.

T14 — Multiple exercise values can be edited in one screen.

T15 — Week confirmation saves the correct dates.

T16 — Existing historical weeks remain unchanged.

T17 — Duplicate weekly records are prevented.

T18 — Editing a confirmed week recalculates analytics.

## Notes import tests

T19 — Day headings are recognised.

T20 — Exercise names are recognised.

T21 — Kg total is handled correctly.

T22 — Kg per side is handled correctly.

T23 — Kg per dumbbell is handled correctly.

T24 — Different rep formats are interpreted correctly.

T25 — Ambiguous entries require user review.

T26 — Unrecognised text is preserved.

T27 — Historical imports do not invent dates.

T28 — Duplicate imports are detected.

## Progress tests

T29 — Increased repetitions are identified.

T30 — Increased loads are identified.

T31 — Stable performance is identified correctly.

T32 — Missing records do not create false progression.

T33 — Incompatible exercise variations are not compared.

T34 — Incompatible loading conventions are not compared.

T35 — Bodyweight trends are calculated correctly.

T36 — Historical corrections update trends.

## Coaching tests

T37 — Weekly reviews use confirmed data.

T38 — Insufficient data produces an appropriate message.

T39 — One bad session does not automatically indicate a plateau.

T40 — Relevant stagnation may trigger follow-up questions.

T41 — Programme adjustments require user approval.

T42 — Missed sessions are treated appropriately.

T43 — Weekly review numbers match actual records.

T44 — Nutrition context is optional.

## Mobile app tests

T45 — Main Plan view renders at 375px.

T46 — Main Plan view renders at 390px.

T47 — Main Plan view renders at 430px.

T48 — Keyboard does not obscure active inputs.

T49 — Bottom navigation does not overlap content.

T50 — Offline editing works.

T51 — Drafts persist after application reopening.

T52 — PWA manifest is valid.

T53 — Standalone mobile layout functions correctly.

T54 — Screen transitions preserve data.

T55 — Reduced-motion settings are respected.

T56 — Important touch controls are accessible.

## Regression tests

T57 — Existing user data survives migration.

T58 — Existing programme creation still works.

T59 — Optional live logging still works.

T60 — Existing strength-history data is preserved.

T61 — Existing bodyweight history remains available.

T62 — Existing nutrition preferences remain available.

T63 — JSON backup and restore work.

T64 — Full production build succeeds.

Execute the tests and report actual results.

Do not report tests as passed unless they were run.

---

# 21. MANDATORY MOBILE VISUAL TESTING

Capture screenshots using Playwright.

Required screens:

- Plan.
- Workout Note.
- Weekly Update.
- Notes Import.
- Progress.
- Coach.
- Programme Library.
- Settings.

Required widths:

- 375px.
- 390px.
- 430px.
- 768px.
- 1280px.

Check:

- Typography.
- Readability.
- Input sizing.
- Spacing.
- Navigation.
- Safe areas.
- Keyboard interactions.
- Tap targets.
- Scrolling.
- Empty states.
- Error states.

The finished application should visually feel like a premium mobile productivity app, not a desktop web form.

---

# 22. REQUIRED DEVELOPMENT PROCESS

## PHASE 0 — Preserve and audit

1. Inspect existing repository.
2. Run current tests.
3. Identify existing data models.
4. Create a backup or Git checkpoint.
5. Determine safe migrations.
6. Document current user workflows.

## PHASE 1 — Notes-first foundation

Implement:

- Simplified navigation.
- Notes-style workout viewing.
- Inline editing.
- Auto-save.
- Readable programme presentation.

Complete tests before proceeding.

## PHASE 2 — Weekly updates

Implement:

- Copy Previous Week.
- Bulk editing.
- Session confirmation.
- Draft persistence.
- Historical records.

Complete tests.

## PHASE 3 — Notes import

Implement:

- Paste text.
- Deterministic parsing.
- Preview.
- Correction.
- Import as programme or history.

Complete tests.

## PHASE 4 — Performance intelligence

Implement:

- Comparisons.
- Trends.
- Personal records.
- Simple charts.
- Weekly reviews.
- Plateau detection.

Complete tests.

## PHASE 5 — Coaching integration

Implement:

- Concise feedback.
- Context-aware questions.
- Approved adjustments.
- Optional nutrition integration.

Complete tests.

## PHASE 6 — Mobile app polish

Implement:

- Native-app-like UI.
- PWA installation.
- Offline support.
- App icon.
- Safe-area handling.
- Mobile keyboard improvements.
- Responsive layouts.

Complete tests.

## PHASE 7 — Final verification

Run:

- TypeScript checks.
- Lint.
- Unit tests.
- Integration tests.
- Playwright tests.
- Production build.
- Offline checks.
- Data migration tests.
- Backup/restore tests.

Review all required screenshots.

Fix blocking problems.

---

# 23. DEFINITION OF DONE

AdaptFit V0.4 is complete when:

1. The application opens to a simple training plan.
2. Workouts are displayed like editable notes.
3. Users do not need to start a workout to follow it.
4. Users do not need to log every set.
5. Users can update only changed values.
6. Weekly updates are supported.
7. Previous results can be copied.
8. Completion is never falsely inferred.
9. Existing workout Notes can be pasted.
10. Unrecognised text is preserved.
11. Recorded performance can be analysed.
12. Progression insights use actual confirmed data.
13. Plateau detection is cautious and explainable.
14. Coaching gives concise, useful feedback.
15. Users retain access to predefined programmes.
16. Existing nutrition features remain accessible but secondary.
17. RPG features are removed from active navigation.
18. Existing user data is preserved.
19. The interface feels like a mobile application.
20. The PWA can be installed on supported phones.
21. Core functionality remains available offline.
22. Backup and restore work.
23. No paid AI API is required.
24. Required automated tests pass.
25. Production build succeeds.
26. Known limitations are documented.

---

# 24. FINAL DELIVERABLES

At completion provide:

1. Summary of the product redesign.
2. Implemented user stories.
3. Incomplete items and reasons.
4. Before/after workflow comparison.
5. New navigation structure.
6. Data migration summary.
7. Updated architecture documentation.
8. Notes editor implementation details.
9. Weekly update workflow explanation.
10. Notes import parser capabilities and limitations.
11. Performance analysis logic.
12. Coaching logic.
13. PWA installation instructions for iPhone.
14. PWA installation instructions for Android.
15. Future native packaging recommendation.
16. Playwright screenshots.
17. Test results.
18. Known defects.
19. Exact commands to run the application.
20. Recommended next release priorities.

## FINAL INSTRUCTION

The existing application has become more complicated than the problem it was meant to solve.

Your responsibility is to simplify it.

Do not respond by adding more menus, dashboards or configuration screens.

Do not solve simple editing problems by introducing complicated forms.

Do not force users to record information that isn't required for useful analysis.

Use the existing working code wherever practical.

**AdaptFit must become an intelligent extension of Notes: effortless workout planning and updating, with automatic performance analysis and genuinely useful coaching.**

Prioritise the everyday user experience over feature count.

Begin with repository inspection and baseline testing, then implement the redesign incrementally.
