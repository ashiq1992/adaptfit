# AdaptFit MVP — Claude Code master prompt

Build, run, and test **AdaptFit**, a local-first fitness progressive web app. Its core loop is simple. Tell AdaptFit how much time and energy you have today, get a realistic workout, log what you did, and see your progress. Make workout logging fast enough to use between sets.

The visual direction is **Premium Pixel Hybrid**. The gym experience leads. The character and its stats stay visible as a second layer of motivation, with pixel art reserved for the character, badges, and small moments of celebration.

## 1. Start here and deliver working software

1. Inspect the current folder, repository status, project instructions, installed runtime, and available package manager. If the folder is empty, scaffold there. If it contains an unrelated project, create an `adaptfit/` subfolder. Preserve existing user changes and avoid destructive commands.
2. Add `docs/implementation-plan.md` with the scope, architecture decisions, storyboard, backlog, and acceptance-to-test mapping from this brief. Then implement. Use this document to track progress through the full build.
3. Build in vertical slices. First get check-in → recommendation → session → history working, then complete offline support, character progress, data controls, and polish.
4. Run the automated checks and verify the production build in a real browser. Fix failures you can reproduce. If an environment restriction blocks a check, record the actual blocker and the exact command to retry.
5. Deliver working source, committed-to-the-project lockfile, seed data, tests, and a README. Do not publish, deploy, or push changes. Report actual test results and provide the local URL and commands.

Make reversible decisions yourself. Ask only when the environment prevents safe progress or a choice would materially change the product. If the full scope cannot be finished, preserve the working core loop and list the unfinished stories explicitly.

## 2. Scope and cost

- **Audience:** Adults who want to train consistently even when their schedule, equipment, or energy changes.
- **Supported goals:** Build strength, build consistency, and improve general fitness.
- **Equipment choices:** Bodyweight, dumbbells, and gym. Treat selections as available equipment, not permission to substitute inaccessible equipment.
- **Core features:** Short onboarding, daily check-in, workout recommendation with explanation, editable workout logging, workout history, pixel character and stats, offline installation and use, export/import, and data reset.
- **Operating target:** Zero required service spend. No accounts, cloud database, external AI, telemetry, ads, payments, wearable integrations, or remote assets. The normal app flow must require no internet after a successful first load and offline setup.
- **Platforms:** Mobile-first responsive web. Support the normal browser experience when installation is unavailable. Verify Chromium on desktop and a mobile viewport. Verify iOS behavior on a physical device only if one is available, and document actual coverage.
- **Fitness boundaries:** General fitness guidance for adults. Avoid diagnosis, medical clearance, injury-specific programming, calorie prescriptions, and automatic load increases. If someone reports pain, illness, or feeling unsafe to train, offer rest and general guidance to seek qualified help when appropriate. Keep that screen free of workout or XP pressure.

## 3. Architecture and setup

Use React, TypeScript in strict mode, Vite, and npm. Use IndexedDB through Dexie, Zod for runtime validation, and a Vite-compatible Workbox PWA integration. Prefer plain CSS with design tokens and a small number of reusable components. Use Vitest and React Testing Library for unit and integration tests, and Playwright for browser tests. Check local runtime compatibility before choosing package versions and pin the resolved tree in the lockfile. Avoid unnecessary dependencies.

Keep these responsibilities distinct:

| Area | Responsibility |
|---|---|
| `src/domain/` | Types, recommendation rules, session transitions, progression calculations, and validation helpers. Pass time into pure functions. |
| `src/data/` | IndexedDB schema, versioning, transactions, repositories, and validated backup and restore. |
| `src/features/` | Onboarding, Today, active workout, History, Character, and Settings. |
| `src/ui/` | Navigation, forms, accessible dialogs, design tokens, and shared components. |
| `src/content/` | Local exercise catalog and workout templates with stable IDs. |
| `public/` | Local icons, manifest assets, and original character artwork where appropriate. |
| `tests/` | Unit, integration, fixtures, and Playwright scenarios. |

Model the following explicitly:

- `Profile` with goal, experience, equipment, preferred session length, and preferred weight unit.
- `CheckIn` with local calendar date, available minutes, energy, ordinary soreness, equipment, and a separate safety flag. Store the latest check-in per local date. Editing it can regenerate today's suggestion without changing an active or completed workout.
- `Exercise` and `WorkoutTemplate` with stable IDs, equipment requirements, difficulty, exercise blocks, safe substitutions, and time estimates.
- `WorkoutSession` with ID, state, timestamps, check-in and plan snapshots, and actual set entries. Snapshot exercise names and prescribed work so old history stays readable if seed data changes. Store timestamps as UTC instants and persist the local completion date for historical day grouping. Use stable session and set IDs.
- Progress derived from completed sessions. Avoid maintaining a separate XP balance that can drift from history.

Use one active workout per database. Starting, completing, discarding, restoring, and resetting must have explicit state transitions. Persist edits after each confirmed change. Use IndexedDB transactions for state changes that must succeed together. Ensure simultaneous tabs and repeated clicks cannot create duplicate active sessions or duplicate completions. Treat browser storage failures as visible errors and preserve editable input for retry where possible.

Use an app manifest, local icons, and an offline-ready indicator tied to successful service-worker setup. Cache the production shell and required assets. Verify offline reloads and navigation. Surface updates with a user-controlled refresh and avoid interrupting an active workout. Document that `localhost` is suitable for service-worker testing and that physical-phone testing generally needs a secure origin. Keep all personal records in IndexedDB and out of service-worker caches.

## 4. Recommendation and progression rules

Implement recommendations as a deterministic, tested rules engine. Include the inputs that mattered and concise reason codes suitable for display. Seed at least 12 exercises and enough vetted templates to cover every supported equipment mode and time band, including bodyweight fallbacks. For gym templates, distinguish equipment actually required from optional equipment. If the user only has partial equipment, offer a supported substitution or a suitable fallback.

Apply these rules in order:

1. **Safety flag:** Pain, illness, or feeling unsafe returns a rest state. It offers neither exercise nor workout start. Ordinary muscle soreness is a separate input.
2. **Time:** Use bands of 5–14, 15–29, and 30–60 minutes. Fewer than five minutes returns rest or a suggestion to check in later. The estimate must fit available time and include warm-up, work, rest, and transitions.
3. **Energy and soreness:** Low energy or high ordinary soreness selects a gentle, reduced-volume option. If no appropriate option fits, offer rest. Never increase intensity because of a missed day.
4. **Equipment and experience:** Filter for available equipment and supported experience level. Bodyweight is the fallback where appropriate. Omit exercises with unavailable requirements.
5. **Recent training:** When two otherwise suitable workouts fit, prefer a different emphasis if the same emphasis was trained in the previous 24 hours. If a suitable alternative is unavailable, use a gentle full-body option or rest.
6. **Goal and tie-break:** Rank by goal fit, then time fit, then stable template ID. Same inputs, history, and clock produce the same result.

Display the recommendation as duration, effort, equipment, exercise list, and a sentence such as “You have 20 minutes and low energy today, so this plan uses fewer sets.” Allow safe substitutions with recalculated duration. Preserve the original recommendation snapshot once a session begins and record actual substitutions separately in the session.

The character reflects behavior in the app. It makes no claim about measured physical fitness.

- **XP:** +20 per completed workout with at least one valid logged work set, once per session. Completion requires at least one valid set. Rest and abandoned sessions earn no XP and incur no penalty.
- **Level:** `1 + floor(totalXP / 100)`.
- **Strength:** Count completed sessions with at least one logged set tagged `strength`.
- **Endurance:** Count completed sessions with at least one logged work block tagged `endurance`.
- **Consistency:** Count distinct completion dates in the trailing seven local calendar days, including today.
- Show the unit and meaning of each stat. A simple pixel character with locally drawn sprite states is enough. Keep all workout actions reachable with reduced motion enabled.

## 5. UI and storyboard

Use a polished, high-contrast fitness interface. Use a dark charcoal base, restrained accent color, clear numerical typography, and comfortable spacing. Start with a single mobile column and bottom navigation for **Today**, **History**, and **Character**, with Settings reachable from a labeled control. Give the active workout its own focused view with a sticky action area. On larger screens, use a restrained two-column layout where it helps, with the workout in the primary column.

Use readable text and labels, visible focus states, semantic form controls, keyboard access, screen-reader status announcements for meaningful updates, and large touch targets. Aim for at least 44 × 44 CSS pixels for primary touch controls. Keep the UI usable at 320 CSS pixels wide and respect `prefers-reduced-motion`. No flashing, blocking celebrations, or sound by default.

| Frame | User action | Screen and next state |
|---|---|---|
| 1. Welcome | Picks goal, experience, equipment, preferred minutes, and weight unit | Short setup with sensible defaults and editable settings. Continue to Today. |
| 2. Today | Enters today's time, energy, soreness, equipment, and optional safety flag | Check-in panel above a compact character preview. Submission shows the plan or rest state. |
| 3. Plan | Reviews the suggested workout or swaps an exercise | Primary card shows title, time, effort, equipment, rationale, and exercises. **Start workout** is the main action. Rest states show an appropriate explanation and no start action. |
| 4. Active session | Logs or edits reps, load, or timed work and advances through exercises | Large controls, clear save status, optional rest timer, and exercise progress. On reload, offer to resume at the saved position. |
| 5. Finish | Reviews what was logged and confirms completion | Show work completed and XP earned. An incomplete plan can be finished after confirmation if at least one valid set exists. Use brief, dismissible character feedback. |
| 6. History | Opens a previous session | Show local date, exercises and actual results. Include an empty state that leads to Today. |
| 7. Character | Checks level and stats | Show pixel character, XP to next level, and labeled stats with definitions. Include a direct route back to Today. |
| 8. Settings and recovery | Edits profile, exports or restores a backup, or resets app data | Confirm destructive operations, validate backups before changing data, and report success or failure in place. |

The logging form must distinguish a blank optional load from a load of zero. Reject invalid or nonfinite numbers. Use positive whole numbers for reps and timed work, and nonnegative load. Make units explicit. Store load with its unit and keep historical values understandable after unit changes. Use elapsed time calculated from timestamps for the rest timer so it stays accurate after reload or a backgrounded tab.

## 6. Prioritized stories and acceptance criteria

Points are relative estimates on a Fibonacci scale. Total planned scope is **40 points**. Deliver all stories in order of dependency, with P0 as the release gate.

| ID | Priority / points | User story | Acceptance criteria |
|---|---|---|---|
| AF-01 | P0 / 3 | As a new user, I want to set my training preferences quickly. | Valid setup reaches Today. Profile persists across refresh. Settings changes affect future recommendations. |
| AF-02 | P0 / 5 | As a busy user, I want a workout that fits how I feel today. | A plan respects time, equipment, and experience. Low energy changes the plan. Safety flags produce rest with no start action. A new local day presents a fresh check-in. |
| AF-03 | P0 / 8 | As a lifter, I want fast logging that survives an interruption. | Starting creates one active session. Valid entries and substitutions persist across reload. Invalid entries show errors. Finish requires valid work. Early finish requires confirmation. Discard is explicit and awards no XP. |
| AF-04 | P0 / 3 | As a returning user, I want to see what I actually trained. | Completed sessions appear newest first and show actual work with units. Active and discarded sessions are excluded. Older sessions remain readable after catalog changes. |
| AF-05 | P0 / 5 | As a motivated user, I want my character to reflect my training. | Completing a workout updates XP and stats exactly once. Five qualifying completions yield level 2. The seven-day calculation counts distinct local dates. Rest leaves progression unchanged. |
| AF-06 | P0 / 5 | As a gym user with weak reception, I want the app to work offline. | After one successful online load and offline setup, the production app reopens offline, generates a plan, logs and completes a session, and shows history and stats. The manifest and icons are valid. |
| AF-07 | P0 / 5 | As the owner of my records, I want to back up, restore, or erase them. | Export creates a versioned JSON backup. A valid restore replaces data only after explicit confirmation. Invalid or unsupported backups leave current data intact. Confirmed reset returns to onboarding. |
| AF-08 | P1 / 3 | As a user logging between sets, I want a focused interface. | Primary controls work with touch and keyboard. The UI fits 320 px and a representative desktop width. Reduced-motion mode preserves all feedback. Rest timer remains correct after interruption. |
| AF-09 | P1 / 3 | As someone whose equipment changes, I want to swap exercises without restarting. | Supported substitutions respect equipment, experience, and time. Swaps update the visible plan and persist in the active session or final history as appropriate. |

## 7. Required tests

Map test names to story IDs in `docs/implementation-plan.md`. Use deterministic fixtures, isolated databases or browser contexts, explicit dates and clocks, and no arbitrary sleeps.

**Unit — Vitest**

- Recommendation rules at 4/5, 14/15, 29/30, and 60 minutes. Include estimates with rest and transitions, no fitting template, equipment fallback, low energy, high soreness, safety precedence, recent emphasis, and deterministic ties.
- Seed catalog integrity. Every referenced exercise exists, every published template has a valid estimate, and supported equipment and time bands have appropriate coverage.
- Logging validation for blank and zero load, valid reps and timed work, negative and fractional values, and nonfinite numbers. Test valid and invalid substitutions.
- Progression for empty history, first completion, exactly 100 XP, duplicate completion input, discarded sessions, same-day sessions, and seven-day window boundaries around local midnight. Include a timezone fixture where UTC date and local date differ.
- Backup validation for malformed input, unsupported versions, duplicate IDs, invalid references, and invalid session state.

**Integration — Vitest, React Testing Library, and IndexedDB fixtures**

- Check-in submission generates the correct plan or rest UI and reports errors accessibly.
- Session creation, entry updates, reload from persisted storage, finish, and history projection.
- Concurrent starts and completions are idempotent. Verify results by querying persisted state.
- Simulated write failure leaves the last committed session intact and shows a retryable error.
- Versioned database upgrade preserves existing records. Export → reset → restore reproduces profile, history, active draft if present, and derived progression. Failed restore rolls back fully. Verify reset clears personal records.

**End-to-end — Playwright against the production preview**

1. Onboard → check in → start → log sets → finish → inspect history and character stats.
2. Start → log → reload → resume → edit → finish. Double-submit finish and assert one history row and one XP award.
3. Check in with a safety flag. Verify rest copy, absence of start action, and no progression change.
4. Wait for service-worker control and offline readiness. Turn the browser context offline, reload, then create and finish a workout and inspect history. Verify the test actually performed the flow offline.
5. Export a backup, reset, restore, and verify the original history. Try an invalid backup and verify existing records remain.
6. At a mobile viewport and at 320 px, verify no horizontal overflow and primary logging controls remain accessible. At desktop width, verify keyboard navigation and reduced-motion behavior. Run a focused automated accessibility scan on Today and the active session if the test environment supports it.
7. Substitute an exercise and verify the final history shows the actual exercise. Background or reload during a rest timer and verify elapsed time against a controlled clock.

## 8. Privacy, security, and data ownership

- Keep personal data on the device. Use no external scripts, fonts, trackers, runtime APIs, or secrets. No environment file should be needed for normal operation.
- Treat backup files as untrusted. Apply a documented size limit before reading, validate and normalize a versioned schema, and reject invalid or inconsistent records before any mutation. Restore transactionally. Render imported text as text, never raw HTML.
- Explain that exports contain fitness history and that browser storage is device- and origin-specific and can be cleared. Provide export from Settings without requiring an account. Reset needs an explicit confirmation and a visible result.
- Use safe defaults for local servers, bind to loopback, and document the difference between the development and preview origins. Browser data saved on one origin does not appear on another.
- Review the direct dependency list and any available audit findings. Do not apply forced upgrades. Report if an audit could not run.

## 9. Local commands and definition of done

Support these commands in the project. If tooling forces a deviation, document it and provide the working equivalent.

```sh
# Initial installation with the project lockfile
npm ci

# Install the browser used by the E2E suite once
npx playwright install chromium

# Development server
npm run dev

# Verification
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e

# Manual production and offline verification
npm run preview
```

Configure `npm test` to run once and exit. Configure `npm run test:e2e` to build or ensure a fresh production build and start its own loopback preview server. Print the development and preview URLs in the README and verify the ports match the actual configuration. Keep preview and automated test server ports distinct if needed.

The README must include the compatible Node range, install and run instructions, first-use walkthrough, how to verify offline readiness, backup and restore instructions, how to reset data, what was tested, and known browser or install limitations. Explain that downloads may be required for setup and that day-to-day operation is local.

Before handing back, exercise the core loop in the running app and inspect Today, Active Workout, History, and Character at mobile and desktop widths. Check for layout overflow, failed asset requests, and runtime errors. Report implemented stories, exact commands and pass/fail results, test counts where available, actual visual and browser coverage, and any remaining limitations. Provide the shortest working command sequence to try the app locally.