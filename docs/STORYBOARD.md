# AdaptFit V0.2 — Storyboard

## Journey A — First-time setup
- **Trigger:** no profile on this device.
- **Screens:** Welcome → Goal & experience → Routine (example / paste / build / skip) → Schedule (sessions/week, weekdays, length, unit) → Lifestyle (optional: work days/hours, sleep, diet, timezone) → Meet your adventurer (gamification on/off) → Train (or the programme editor if something needs choosing).
- **Data:** Profile, Programme (optional).
- **Success:** Train shows the programme's first day with Start workout.
- **Empty:** "Skip for now" → Train shows *Bring your own routine* with Create / Example / Import and an explicit Quick adaptive workout.
- **Error:** storage failure shown inline; nothing half-saved. Pasted routines with unknown or ambiguous names (e.g. "Squat") open the editor to choose the variation.
- **Acceptance:** T49, T50.

## Journey B — Normal gym session
- **Trigger:** Start workout on Train.
- **Screens:** Train → Workout (prefilled from last comparable session) → confirm/edit sets → Finish dialog (duration: timer / entered / not recorded) → Workout complete (comparisons, PRs, +XP) → History / Progress / Train.
- **Data:** WorkoutSession (draft saved after every change), derived progression and XP.
- **Success:** history card with real comparisons; XP awarded once.
- **Empty:** no previous record → target reps prefilled, load blank, "No record yet — today sets your baseline".
- **Error:** invalid value → inline error, not saved; storage failure → banner with Retry, last committed state kept; finishing with no completed set is blocked.
- **Acceptance:** T01–T10, T39–T41, T47, T51–T53, T60.

## Journey C — Interrupted week
- **Trigger:** Coach → This Week → fewer sessions available (optionally hinted by lifestyle data).
- **Screens:** Plan this week → Proposed sessions (kept days, carried priority lifts at 2 sets) + trade-offs → Apply plan / Not now → Train follows the adjusted week → Weekly review.
- **Data:** WeekPlan (pending → approved/rejected).
- **Success:** approved plan shown; Train's next session follows it; mission "Follow your adjusted plan".
- **Empty:** no programme → "Create programme".
- **Error:** proposal never exceeds preferred session length; anything that won't fit is listed as a trade-off, not crammed in.
- **Acceptance:** T31, T32, T59.

## Journey D — Strength plateau
- **Trigger:** ≥4 comparable sessions over ≥14 days with no improvement on a priority lift.
- **Screens:** Coach → Insights → "Possible plateau — additional context needed" → evidence + missing data → ≤2 questions → suggestion (+ proposed change) → Accept / Reject / Later → History (decision, follow-up outcome).
- **Data:** CoachRecommendation record (trigger, evidence, missing data, answers, recommendation, status, applied change, follow-up).
- **Success:** accepted change applied to the programme; follow-up reports improvement or not.
- **Empty:** "No plateau detected"; "Not enough data to judge" list.
- **Error:** interrupted training → "interrupted", not plateau; repeated pain reports → "Consider professional advice".
- **Acceptance:** T18–T22, T43–T45, T58.

## Journey E — Character milestone
- **Trigger:** workout completed.
- **Screens:** Workout complete (+XP breakdown, level-up text, dismissible cheer) → Journey (stats, next unlock, achievements) → Train.
- **Data:** derived RPG state from records.
- **Success:** XP/stat/achievement changes visible; animation only if motion allowed.
- **Empty:** gamification off → hidden, workouts unaffected.
- **Error:** duplicate records or repeat imports never double-count.
- **Acceptance:** T23–T28, T41, T57, T66.

## Journey F — Historical correction
- **Trigger:** History → expand → Edit.
- **Screens:** Edit dialog (date, per-set load/reps, add/remove set, duration) → Save correction → History/Progress/Journey recalculated.
- **Data:** session marked `editedAt`; all derived values recomputed.
- **Success:** comparisons, PRs, XP updated; backup includes the corrected record.
- **Empty:** a correction that removes all sets is refused ("Delete it instead").
- **Error:** invalid values listed per exercise/set; nothing saved.
- **Acceptance:** T17, T27, T42, T46.
