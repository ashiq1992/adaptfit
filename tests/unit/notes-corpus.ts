/**
 * Real-world workout-note styles, as people paste them from Apple Notes,
 * Google Keep and chat apps (all values synthetic). Used by
 * v5-notes-corpus.test.ts; each note has its expectations there.
 */
export const CORPUS = {
  /** The user's own note (2026-11-09): numbered blocks — name, what was done, the plan, rest. */
  userBlocks: `1. db flat press
27.5kg for 7 reps
4 × 6
Rest: 2–3 min

2. lats pull down (Weighted if possible)
Did 8 reps  with 1 rir with added 1
4 × 6
76kg
Rest: 2 min

Chest Supported Row — 8
Did 45 at 8 reps with 1 rir x3 , 90 sec rest`,

  perSetLoads: `Push day
1. Barbell bench 60x8, 65x6, 70x5
2. Incline db press 22.5kg x 10, 10, 8
3. Cable fly 15kg 3x12`,

  setLinesInBlock: `Monday – Pull
Deadlift
Set 1: 100kg x 5
Set 2: 110kg x 5
Set 3: 120kg x 3
Lat pd
50 x 12
55 x 10`,

  atLoad: `Leg day
Leg press 3x8 @ 60kg
Leg extension 3 x 12 @ 40
Leg curl 3x12 @ 35kg`,

  rpe: `Squat day
Back squat 100kg 3x5 RPE 8
RDL 80kg 3x8 @7 RPE`,

  slashLoads: `Shoulders
OHP 40/42.5/45kg x 8/6/5
Lateral raises 10/12/12 x 15/12/10`,

  pounds: `Chest
Bench press (barbell) 135 lbs x 10, 155 lbs x 8, 185 lbs x 5
DB fly 25lb 3x12`,

  bodyweight: `Calisthenics
Pull-ups BW x 12, 10, 8
Dips BW 3x10
Push ups 20, 18, 15`,

  addedLoad: `Back
Pull ups +10kg 3x6
Chin-ups 3x8 (+5kg)`,

  supersetLabels: `Arms
A1. DB curl 12kg 3x12
A2. Triceps pushdown 25kg 3x12
B1. Hammer curls 10kg 3x10
B2. Overhead triceps extension 15kg 3x10`,

  supersetSS: `Upper
Superset:
Lateral raise 8kg x 15, 15, 12
Face pulls 20kg x 15, 15, 15
SS: Cable fly 10kg 3x15`,

  warmUps: `Tuesday
BB squat
warmup 40x10
warm-up 60x5
100kg x 5
105kg x 5
105kg x 4`,

  dropSets: `Shoulders and arms
Lateral raise 12kg x 12, 10, 9 + drop 6kg x 15
Triceps pushdown 30kg 3x12
Drop set: 15kg x 20`,

  trailingComments: `Legs
Leg extension 50kg 3x12 felt easy
Leg curl 40kg 3x10 - go heavier next time
Calf raises 60kg 4x15 (knee a bit sore)`,

  dateHeadings: `Monday 12 Oct
Smith squat 40kg/side 3x8

Wednesday 14 Oct 2026
Smith bench 30kg/side 3x8`,

  dateInHeading: `Push – 2 Nov 2026
Smith bench 30kg/side 3x8

2026-11-04 Legs
Leg press 100kg 3x10`,

  weekDay: `Week 3 Day 2 - Pull
Lat pulldown 55kg 3x10
Seated row 50kg 3x10`,

  tabsAndSpaces: 'UPPER A\nSmith bench\t\t30kg/side\t3x8\nLat pulldown     45kg     10   10   9',

  uppercase: `PUSH DAY
BENCH PRESS 80KG 5X5
OHP 50KG 3X8
TRICEP PUSHDOWN 30KG 3X12`,

  shorthand: `Pull
BB row 60kg 4x8
Lat pd 50kg 3x12
DB RDL 22kg each hand 3x10
inc db press 24kg 3x10`,

  timedHolds: `Core
Plank 3 x 60s
Side plank 45s, 40s, 30s
Dead hang 3x30 sec`,

  cardio: `Cardio
Treadmill 20 min
Bike 10 min
Rower 2000m 8:05`,

  checklist: `☐ Smith squat 40kg/side 3x8
☑ Leg press 100kg 3x10
- [ ] Leg curl 35kg 3x12
- [x] Calf raise 50kg 4x15`,

  bullets: `Push
• Smith bench 30kg/side 3x8
◦ Cable fly 15kg 3x12
* Lateral raise 8kg 3x15
– Triceps pushdown 25kg 3x12`,

  emoji: `💪 Arms day
🔥 Hammer curls 12kg 3x10
✅ Triceps pushdown 25kg 3x12`,

  chatMessage: `Gym today
Squat 5x5 100
Bench 3x8 60
Pullups 3x10`,

  setsOf: `Lower body
Goblet squat 3 sets of 10 with 24kg
Walking lunges 3 sets of 12 each leg
Hip thrust 3 sets of 10 @ 80kg`,

  didLog: `Thursday
Bench press machine - did 3 sets of 10 at 50kg
Chest press 45kg 12, 10, 9 felt heavy`,

  triple: `Strength
Deadlift 3x5x140kg
Squat 100x5x3`,

  plates: `Legs
Smith squat 20 a side 3x8
Leg press 2 plates a side 10 10 8`,

  hashHeadings: `# Upper
Smith bench 30kg/side 3x8
Lat pulldown 45kg 3x10

# Lower
Smith squat 40kg/side 3x8
Leg curl 35kg 3x12`,

  titleAndNotes: `My PPL plan
Notes: progress weekly

Push:
Smith bench 30kg/side 3x8
keep elbows tucked

Bring water`,

  forPairs: `Friday
Hack squat 80kg for 10, 90kg for 8, 100kg for 6`,

  junkLines: `Upper
Smith bench 30kg/side 3x8
???
12/
Lat pulldown 45kg 3x10`,

  didWithRir: `Incline DB press
Did 24kg for 10, 9, 8 with 2 RIR`,

  commaDecimal: `Arms
Curl 12,5 kg 3x10
Hammer curl 10 kilos x 12, 12, 10`,
} as const;

export type CorpusKey = keyof typeof CORPUS;
