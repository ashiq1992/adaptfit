# AdaptFit V0.4 — User stories, status and workflow comparison

Status key: ✅ implemented and tested · ◐ implemented with a stated limitation · ✖ not done.
Test IDs refer to Sprint4.MD §20 (see TEST_PLAN.md, V0.4 section).

## Stories

| # | Story | Status | Evidence |
|---|---|---|---|
| S1 | Remove gamification from the app; keep the data | ✅ | RPG screens, XP, missions and achievements removed; character/XP data archived in the profile; code on `legacy/v0.3-rpg`. e2e T44/T60–T62 checks no XP/Journey text. |
| S2 | Meaningful progress instead of game rewards | ✅ | Personal bests, milestones (bests, heavier loads, more reps, consistent weeks counted not streaked, 4-week blocks, goal-matched bodyweight). |
| S3 | Calm, premium, minimal visual design | ◐ | New tokens (brief's palette), system fonts, notes typography. Judged from screenshots by the developer only; no user testing. |
| S4 | Three-tab navigation (Plan, Progress, Coach) + settings icon | ✅ | `App.tsx`; platform e2e. |
| S5 | Notes-first workout view, opened in one tap | ✅ | T01, T02, Target A (1 tap). |
| S6 | Inline editing like Notes; add / remove / reorder / copy / duplicate / notes | ✅ | T03, T04, Target B (2 taps, 1 screen). |
| S7 | Auto-save, save status, draft recovery, undo, safe deletion | ✅ | T05–T08 (unit + e2e: refresh mid-typing restores the draft). |
| S8 | Original text kept; uncertain fields flagged, never invented | ✅ | T04, T25, T26. |
| S9 | Weekly update with Copy previous week | ✅ | T09–T18; Target C (6 taps plus typing two values, 1 screen). |
| S10 | Session status: done unchanged / updated / partial / skipped / not recorded | ✅ | T11–T13; batch "Mark all as done". |
| S11 | Paste from Notes (template, history, this week) with review | ✅ | T19–T28, Target D; duplicate detection; undated history. |
| S12 | Optional live logging, same data model, no duplicates | ✅ | T59; `dedupeSessions`; "Logged in detail" in the weekly sheet. |
| S13 | Automatic performance analysis | ✅ | T29–T36. |
| S14 | Concise coaching; cautious plateau detection; approval required | ✅ | T37–T44 (unit + integration). |
| S15 | Automatic weekly review, dismiss and revisit, reproducible | ✅ | Review card on confirm and in Coach; computed from records. |
| S16 | Routine library and guided recommendations → workout note | ✅ | T58; library filters by days and goal. |
| S17 | Nutrition and lifestyle preserved but secondary | ✅ | Coach → Fuel; Settings; T44, T62. |
| S18 | Installable PWA (icon, splash, standalone, safe areas, offline) | ◐ | T50–T53 in Chromium. Not verified on a physical iPhone/Android or over real HTTPS. |
| S19 | Mobile keyboard behaviour | ◐ | T48 simulates the keyboard by shrinking the viewport; real iOS keyboard not tested. |
| S20 | Data migration, backup and restore | ✅ | T57, T60–T63; v4 → v5 unit test; real-browser v2 → v5 upgrade. |

## Incomplete items and reasons

- **Real-device testing** (iPhone Safari, Android Chrome, installed mode, real
  keyboard, phone lock): not possible in this environment; Chromium emulation only.
- **Human usability timing (Target C < 60 s):** only automated tap counts and
  machine time were measured. A person still needs to time it.
- **Notification preferences** are in-app only (Plan reminder line, Coach dot).
  Push notifications would need a server or native packaging.
- **Parser:** no fuzzy matching, supersets, RPE, or non-English notes (see ARCHITECTURE.md).
- **Standalone display mode** could not be emulated in Playwright; manifest and
  meta tags are verified instead.

## Before / after workflow comparison

Counts for V0.3 are taken from its flow structure (steps the UI required), not
timed. V0.4 counts are measured by the automated tests.

| Task | V0.3 | V0.4 |
|---|---|---|
| See today's workout | Train tab shows the next day; opening the full routine meant Settings → Programmes → editor | **1 tap** from Plan to the note, scrolled to the day |
| Change one weight in the plan | Settings → Programmes → Edit → day → exercise fields → Save (≈ 6 taps, 3 screens) | **2 taps** (line → Done) + typing, 1 screen |
| Record a typical 3-session week (4 exercises × 3 sets) | Per session: Start workout, 12 set confirmations, Finish, duration choice, confirm ≈ 16 taps → **≈ 48 taps over 3 sessions**, during workouts | **6 taps** + typing the changed values, once a week, 1 screen |
| Switch from Apple Notes | Paste into importer, but only as history with a date per line, or a routine editor import | Paste once; choose plan / history / this week; review flagged items only |
| Know whether you're progressing | Progress tab charts per exercise; Journey XP | Weekly review after confirming + status per exercise ("1 more rep in the first set…") |

## New navigation structure

```
Plan (landing)                 Progress                     Coach
├─ Today / Next → Note         ├─ Exercises (status)        ├─ Weekly review
├─ This week → Weekly update   │   └─ Exercise detail       ├─ Suggestions (Accept/Reject/Later)
├─ Workout notes → Note        ├─ Personal bests            ├─ May need attention
├─ Browse programmes → Library ├─ Milestones                ├─ Short on time this week?
├─ Import from Notes           ├─ Training (per week)       ├─ Recovery & nutrition → Fuel
└─ Previous weeks              ├─ Bodyweight (optional)     └─ Tabs: Summary · Fuel · Decisions
                               └─ All recorded workouts
Settings (gear icon): goals · weekly schedule · units & conventions · logging & reminders ·
nutrition · work · sleep · data & backups · install the app · privacy
```
