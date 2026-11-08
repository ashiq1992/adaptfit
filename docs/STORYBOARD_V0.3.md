# AdaptFit V0.3 — Storyboard

Journeys added or changed in V0.3. V0.2 journeys (docs/STORYBOARD.md) still apply. Test IDs refer to docs/TEST_PLAN.md (V0.3 section).

---

## Journey 1 — New user and guided training

**Entry point:** first launch (no profile) → Welcome → Get started.

| Step | Screen state | User action | Data |
|---|---|---|---|
| 1 | Goal & experience | Pick goal (Build muscle, Improve strength, Lose fat, Body recomposition, General fitness, Improve consistency) and experience | Draft profile |
| 2 | Your training programme | Choose **Recommend a programme** / Use my existing programme / Build from scratch / Skip | Routine choice |
| 3 | Schedule | Sessions per week, preferred days, session length, unit | Saved to profile and `trainingPrefs.daysPerWeek` |
| 4 | Lifestyle (optional) | Skip or fill | Profile lifestyle |
| 5 | Meet your adventurer | Pick Warrior, Ranger, Scholar, or Engineer; gamification on/off | `profile.character` |
| 6 | Recommend a programme (Q1–Q5) | Answers are prefilled from steps 1 and 3; confirm, then set equipment, priorities, and exercises to avoid | `GuidedAnswers` (in memory) |
| 7 | Recommended programmes | Ranked top 3 with why, trade-offs, and ~minutes; Compare all 5; preview full routine and weekly distribution | `TemplateRecommendation[]` (derived) |
| 8 | Preview and customise | Swap exercises, edit sets/reps/rest, set **planned starting weights**, change training days, choose whether to make it active | Draft `Programme` |
| 9 | Programme saved | Fuel opt-in: “Would you like AdaptFit to calculate…?” → Yes / Not now | `Programme`, profile `trainingPrefs`, `NutritionProfile.status` |

- **Empty states:** with no matching template for the chosen days, every option is shown with its mismatch explained. Bodyweight-only users see which slots couldn't be filled.
- **Error states:**
  - Invalid sets or reps on save list the problems; nothing is saved.
  - A storage failure shows an inline error.
- **Success criteria:** Train shows the new programme's first day with Start workout. An existing programme is untouched unless the user chose "make active".
- **Acceptance:** T01–T07, T67, T68, T73.

## Journey 2 — Nutrition setup (AdaptFit Fuel)

**Entry point:** the Fuel opt-in after saving a programme, or the prompt on Train, Coach → Fuel, or Settings → Nutrition preferences.

| Step | Screen state | User action | Data |
|---|---|---|---|
| 1 | About you | Age, height, equation input (male / female / prefer not → manual), safety questions | `NutritionProfile` (saved each step) |
| 2 | Activity | Bodyweight reused from the log (asked only if missing, then saved to the log); daily activity, optional steps, physical work, known maintenance; nutrition goal | Training frequency and minutes reused from the programme and profile |
| 3 | Targets | Shows resting energy, maintenance range, suggested target, protein range, carbs, fat, and assumptions; edit any value | `NutritionTarget` (`estimate` or `manual`) |
| 4 | Eating habits | Home / out / mixed (+ which meals are cooked), meals per day, eating times, budget (SGD), cooking time, kitchen | `habits` |
| 5 | Food preferences | Cuisines (multi), dietary requirements, allergies, intolerances, dislikes, exclusions, fasting | Hard filters |
| 6 | Meal ideas | Preview a sample day → Save nutrition profile | `status: complete` |

- **Empty states:** if no meals match every requirement, a message suggests relaxing a non-allergy preference.
- **Error states:**
  - Out-of-range age, height, steps, or calories show an inline message and the step doesn't advance.
  - Under 18, pregnant or breastfeeding, an eating disorder, or a specialised medical condition gives no automatic target, a professional-guidance message, and manual entry.
  - A missing equation input switches to manual targets.
- **Success criteria:** the Fuel dashboard shows targets and today's meals. "Finish later" resumes at the same step.
- **Acceptance:** T21–T29, T69, T71.

## Journey 3 — Existing user

**Entry point:** a V0.2 user opens V0.3 (database v3 → v4), or restores a V0.2 backup.

1. **Data migration.** Profile gains a character (Warrior) and empty questionnaire prefs. Programmes gain `plannedLoad: null`. Bodyweight moves from measurements into the bodyweight log. A pre-upgrade copy is kept.
2. **Train.** Continues the same programme. A one-time Fuel prompt appears; "Not now" never asks again.
3. **Edit available time.** Settings → Training availability, or Recommend a programme (answers prefilled).
4. **Optional nutrition setup.** V0.2 dietary notes (halal, lactose-free, …) and protein or energy targets are reused.
5. **Dashboard.** The user continues as before. Onboarding isn't repeated.

- **Error state:** an upgrade failure aborts the transaction, leaving the old data intact.
- **Acceptance:** T58, T80, real-browser T37.

## Journey 4 — Workout logging

**Flow:** Start workout → values load (previous comparable session → planned starting weight → blank) → confirm or edit each set (never auto-completed) → finish (duration: timer / entered / not recorded) → history saved → Progress updates → XP awarded once.

- **Data:** `WorkoutSession` with each set's `prefill` source (`previous`, `planned`, `target`, `none`). The programme's planned load is never overwritten by what was lifted.
- **Empty state:** no history and no plan → load blank, labelled "Target reps — not done yet".
- **Error states:** invalid values aren't saved; finishing with no completed sets is blocked.
- **Acceptance:** T08–T13, T59, T60, T73.

## Journey 5 — Bodyweight update

**Flow:** Progress → Bodyweight → enter date, value, unit, and optional note → Save entry → list, chart (4W/8W/12W/All), and weekly averages update → optional trend → used as context by Fuel and Coach.

- **Empty states:**
  - No entries: "Weighing in once a week is plenty."
  - Fewer than 2 entries in range: no chart.
  - Fewer than 3 weeks: "Not enough data for a trend yet", with what's needed.
- **Error states:** missing or invalid date, future date, non-numeric value, out-of-range value, or a note over 200 characters gives an alert and nothing is saved.
- **Success criteria:** the entry survives refresh and backup/restore. Values are stored exactly as entered (kg or lb). Body fat or muscle is never inferred.
- **Acceptance:** T14–T20, T61, T74.

## Journey 6 — Food recommendation

**Flow:** Coach → Fuel → today's meal ideas (cook vs buy follows the eating pattern) → switch Cook/Buy → Swap → change portion (0.5–2×) → review nutrition → Favourite.

- **Data:** a `MealPlan` per date (persisted), and `NutritionProfile.favourites`.
- **Empty or unavailable states:**
  - Eating-out dishes show "Nutrition estimate unavailable".
  - Home recipes with unsourced ingredients show "partial: excludes …".
  - Daily totals cover only meals with complete sourced data and list the others.
- **Error state:** if preferences change so a stored plan breaks a restriction, the plan regenerates.
- **Success criteria:** swaps never break diet, allergy, or exclusion filters. Halal is never claimed; the user is told to choose certified outlets or ingredients.
- **Acceptance:** T30–T41, T62, T63, T72.

## Journey 7 — Character customisation

**Flow:** Journey → Style → pick a style (preview at the current level) → optionally hide unlocked gear → Use <style> → back to the Character tab.

- **Data:** `profile.character` (style, hiddenLayers). XP, level, stats, and achievements are derived from records, so they're unchanged.
- **Error state:** an unknown or invalid style renders the default sprite (`data-fallback`).
- **Acceptance:** T51–T58, T65, T75.

## Journey 8 — Lifestyle-aware coaching

**Flow:** Coach → This Week (weekly review: planned / completed / remaining, adjusted-week flag, Fuel target, bodyweight trend) → Insights shows relevant findings → targeted question where useful (≤ 2) → recommendation → Accept / Reject / Later → History.

The findings are:
- muscle-gain goal with stable bodyweight;
- fat-loss goal with a slow trend (keep the target; never cut further automatically);
- fast loss;
- busy week while eating out;
- plateau, with sleep, effort, consistency, and food questions.

- **Data:** `CoachRecommendation` (kind `nutrition` or `plateau`). An accepted nutrition-target change is applied in the same transaction.
- **Empty states:**
  - "Not enough data yet" or "Not enough data to judge" with what's needed. "No plateau detected" is shown only when some lifts have enough history.
  - Nutrition not set up → "Nutrition: not set up (optional)".
- **Acceptance:** T43–T50, T64, T76.
