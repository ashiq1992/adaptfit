import type { Exercise, LoadType } from '../domain/types';

type ExerciseSeed = Omit<Exercise, 'secondsPerRep' | 'defaultReps' | 'defaultDurationSec' | 'substitutions' | 'loadable' | 'loadType'> &
  Partial<Pick<Exercise, 'secondsPerRep' | 'defaultReps' | 'defaultDurationSec' | 'substitutions' | 'loadable' | 'loadType'>>;

function ex(seed: ExerciseSeed): Exercise {
  const defaultLoadType: LoadType = seed.mode === 'timed' ? 'timed' : seed.equipment.length === 0 ? 'bodyweight' : 'total';
  return {
    secondsPerRep: 3,
    defaultReps: 10,
    defaultDurationSec: 30,
    substitutions: [],
    loadable: seed.equipment.length > 0,
    loadType: defaultLoadType,
    ...seed,
  };
}

/**
 * Local exercise catalog. IDs are stable and referenced by templates, sessions,
 * and backups — never rename an ID; add a new one instead.
 */
export const EXERCISES: readonly Exercise[] = [
  // ── Bodyweight ────────────────────────────────────────────────
  ex({ id: 'bw-squat', name: 'Bodyweight squat', tags: ['strength'], equipment: [], minExperience: 'beginner', difficulty: 1, mode: 'reps', defaultReps: 12, cue: 'Sit back and down, chest tall, knees track over toes.', substitutions: ['wall-sit', 'glute-bridge'] }),
  ex({ id: 'bw-reverse-lunge', name: 'Reverse lunge', tags: ['strength'], equipment: [], minExperience: 'beginner', difficulty: 2, mode: 'reps', secondsPerRep: 5, defaultReps: 8, cue: 'Step back softly, both knees bend to about 90°. Reps per side.', substitutions: ['bw-squat', 'glute-bridge'] }),
  ex({ id: 'glute-bridge', name: 'Glute bridge', tags: ['strength'], equipment: [], minExperience: 'beginner', difficulty: 1, mode: 'reps', defaultReps: 12, cue: 'Drive through heels, squeeze glutes at the top.', substitutions: ['bw-squat'] }),
  ex({ id: 'wall-sit', name: 'Wall sit', tags: ['strength'], equipment: [], minExperience: 'beginner', difficulty: 1, mode: 'timed', defaultDurationSec: 30, cue: 'Back flat on the wall, thighs as close to parallel as comfortable.', substitutions: ['bw-squat', 'glute-bridge'] }),
  ex({ id: 'bw-pushup', aliases: ['push-up', 'push-ups', 'pushups', 'push ups', 'pushup'], name: 'Push-up', tags: ['strength'], equipment: [], minExperience: 'beginner', difficulty: 2, mode: 'reps', defaultReps: 8, cue: 'Body in one line, lower with control.', substitutions: ['incline-pushup', 'db-floor-press'] }),
  ex({ id: 'incline-pushup', name: 'Incline push-up', tags: ['strength'], equipment: [], minExperience: 'beginner', difficulty: 1, mode: 'reps', defaultReps: 10, cue: 'Hands on a sturdy surface; higher is easier.', substitutions: ['bw-pushup'] }),
  ex({ id: 'pike-pushup', name: 'Pike push-up', tags: ['strength'], equipment: [], minExperience: 'intermediate', difficulty: 3, mode: 'reps', defaultReps: 6, cue: 'Hips high, lower the crown of the head toward the floor.', substitutions: ['incline-pushup', 'prone-yt-raise'] }),
  ex({ id: 'prone-yt-raise', name: 'Prone Y-T raise', tags: ['strength'], equipment: [], minExperience: 'beginner', difficulty: 1, mode: 'reps', defaultReps: 10, cue: 'Lie face down, lift arms into a Y then a T, squeeze shoulder blades.', substitutions: ['bird-dog'] }),
  ex({ id: 'plank', aliases: ['plank', 'planks'], name: 'Plank', tags: ['strength'], equipment: [], minExperience: 'beginner', difficulty: 1, mode: 'timed', defaultDurationSec: 30, cue: 'Forearms down, ribs down, steady breathing.', substitutions: ['dead-bug'] }),
  ex({ id: 'dead-bug', name: 'Dead bug', tags: ['strength'], equipment: [], minExperience: 'beginner', difficulty: 1, mode: 'reps', defaultReps: 8, cue: 'Low back stays heavy on the floor. Reps per side.', substitutions: ['bird-dog'] }),
  ex({ id: 'bird-dog', name: 'Bird dog', tags: ['strength'], equipment: [], minExperience: 'beginner', difficulty: 1, mode: 'reps', secondsPerRep: 4, defaultReps: 8, cue: 'Reach long, keep hips level. Reps per side.', substitutions: ['dead-bug'] }),
  ex({ id: 'jumping-jacks', name: 'Jumping jacks', tags: ['endurance'], equipment: [], minExperience: 'beginner', difficulty: 1, mode: 'timed', defaultDurationSec: 30, cue: 'Light on the feet. Step-jacks are a fine low-impact option.', substitutions: ['march-in-place'] }),
  ex({ id: 'mountain-climber', name: 'Mountain climbers', tags: ['endurance'], equipment: [], minExperience: 'beginner', difficulty: 2, mode: 'timed', defaultDurationSec: 30, cue: 'Hands under shoulders, drive knees at a steady rhythm.', substitutions: ['jumping-jacks', 'march-in-place'] }),
  ex({ id: 'high-knees', name: 'High knees', tags: ['endurance'], equipment: [], minExperience: 'intermediate', difficulty: 2, mode: 'timed', defaultDurationSec: 30, cue: 'Tall posture, quick light steps.', substitutions: ['jumping-jacks', 'march-in-place'] }),
  ex({ id: 'burpee', name: 'Burpee', tags: ['endurance'], equipment: [], minExperience: 'intermediate', difficulty: 3, mode: 'reps', secondsPerRep: 5, defaultReps: 8, cue: 'Smooth, not rushed. Step back instead of jumping if needed.', substitutions: ['mountain-climber', 'jumping-jacks'] }),
  ex({ id: 'march-in-place', name: 'Marching in place', tags: ['endurance'], equipment: [], minExperience: 'beginner', difficulty: 1, mode: 'timed', defaultDurationSec: 60, cue: 'Easy pace, swing the arms, breathe comfortably.', substitutions: ['jumping-jacks'] }),
  ex({ id: 'mobility-flow', name: 'Mobility flow', tags: ['mobility'], equipment: [], minExperience: 'beginner', difficulty: 1, mode: 'timed', defaultDurationSec: 120, cue: 'Slow cat-cow, hip openers, and arm circles. Move within comfort.', substitutions: ['march-in-place'] }),

  // ── Dumbbells ─────────────────────────────────────────────────
  ex({ id: 'goblet-squat', aliases: ['goblet squat', 'goblet squats'], name: 'Goblet squat', tags: ['strength'], equipment: ['dumbbells'], minExperience: 'beginner', difficulty: 2, mode: 'reps', defaultReps: 10, cue: 'Hold one dumbbell at the chest, sit between the hips.', substitutions: ['leg-press', 'bw-squat'] }),
  ex({ id: 'db-reverse-lunge', loadType: 'per-dumbbell', name: 'Dumbbell reverse lunge', tags: ['strength'], equipment: ['dumbbells'], minExperience: 'beginner', difficulty: 2, mode: 'reps', secondsPerRep: 5, defaultReps: 8, cue: 'Dumbbells at the sides, step back softly. Reps per side.', substitutions: ['bw-reverse-lunge'] }),
  ex({ id: 'db-rdl', aliases: ['db rdl', 'dumbbell rdl', 'dumbbell romanian deadlift'], loadType: 'per-dumbbell', name: 'Dumbbell Romanian deadlift', tags: ['strength'], equipment: ['dumbbells'], minExperience: 'beginner', difficulty: 2, mode: 'reps', defaultReps: 10, cue: 'Soft knees, hinge at the hips, flat back.', substitutions: ['barbell-rdl', 'glute-bridge'] }),
  ex({ id: 'db-row', aliases: ['db row', 'dumbbell row', 'one arm row', 'one-arm dumbbell row'], loadType: 'per-dumbbell', name: 'One-arm dumbbell row', tags: ['strength'], equipment: ['dumbbells'], minExperience: 'beginner', difficulty: 1, mode: 'reps', secondsPerRep: 4, defaultReps: 10, cue: 'Brace on a bench or knee, pull the elbow to the hip. Reps per side.', substitutions: ['cable-row', 'prone-yt-raise'] }),
  ex({ id: 'db-floor-press', loadType: 'per-dumbbell', name: 'Dumbbell floor press', tags: ['strength'], equipment: ['dumbbells'], minExperience: 'beginner', difficulty: 1, mode: 'reps', defaultReps: 10, cue: 'Lie on the floor, elbows touch down lightly each rep.', substitutions: ['db-bench-press', 'bw-pushup', 'incline-pushup'] }),
  ex({ id: 'db-bench-press', aliases: ['db bench', 'dumbbell bench', 'db bench press', 'dumbbell bench press'], loadType: 'per-dumbbell', name: 'Dumbbell bench press', tags: ['strength'], equipment: ['dumbbells', 'bench'], minExperience: 'beginner', difficulty: 2, mode: 'reps', defaultReps: 10, cue: 'Feet planted, shoulder blades set, press up and slightly in.', substitutions: ['db-floor-press', 'bw-pushup'] }),
  ex({ id: 'db-shoulder-press', aliases: ['db shoulder press', 'dumbbell shoulder press', 'seated db press'], loadType: 'per-dumbbell', name: 'Dumbbell shoulder press', tags: ['strength'], equipment: ['dumbbells'], minExperience: 'beginner', difficulty: 2, mode: 'reps', defaultReps: 10, cue: 'Ribs down, press overhead without arching.', substitutions: ['pike-pushup', 'prone-yt-raise'] }),

  // ── Gym ───────────────────────────────────────────────────────
  ex({ id: 'barbell-back-squat', aliases: ['back squat', 'bb squat', 'barbell squat'], name: 'Barbell back squat', tags: ['strength'], equipment: ['barbell', 'rack'], minExperience: 'intermediate', difficulty: 3, mode: 'reps', secondsPerRep: 4, defaultReps: 6, cue: 'Bar on upper back, brace, sit down between the hips.', substitutions: ['leg-press', 'goblet-squat', 'bw-squat'] }),
  ex({ id: 'barbell-rdl', aliases: ['bb rdl', 'barbell rdl'], name: 'Barbell Romanian deadlift', tags: ['strength'], equipment: ['barbell'], minExperience: 'intermediate', difficulty: 3, mode: 'reps', secondsPerRep: 4, defaultReps: 8, cue: 'Bar close to the legs, hinge until hamstrings are loaded.', substitutions: ['db-rdl', 'glute-bridge'] }),
  ex({ id: 'leg-press', aliases: ['leg press'], name: 'Leg press', tags: ['strength'], equipment: ['machine'], minExperience: 'beginner', difficulty: 1, mode: 'reps', defaultReps: 10, cue: 'Lower until hips start to tuck, press through mid-foot.', substitutions: ['goblet-squat', 'bw-squat'] }),
  ex({ id: 'lat-pulldown', aliases: ['lat pulldown', 'pulldown', 'lat pull down', 'lat pulldowns'], name: 'Lat pulldown', tags: ['strength'], equipment: ['cable'], minExperience: 'beginner', difficulty: 1, mode: 'reps', defaultReps: 10, cue: 'Pull the bar to the upper chest, elbows down and back.', substitutions: ['db-row', 'prone-yt-raise'] }),
  ex({ id: 'cable-row', aliases: ['seated cable row', 'cable row', 'seated row'], name: 'Seated cable row', tags: ['strength'], equipment: ['cable'], minExperience: 'beginner', difficulty: 1, mode: 'reps', defaultReps: 10, cue: 'Tall torso, pull handle to the stomach.', substitutions: ['db-row', 'prone-yt-raise'] }),
  ex({ id: 'chest-press-machine', aliases: ['chest press', 'machine chest press'], name: 'Machine chest press', tags: ['strength'], equipment: ['machine'], minExperience: 'beginner', difficulty: 1, mode: 'reps', defaultReps: 10, cue: 'Handles at mid-chest, press smoothly.', substitutions: ['db-bench-press', 'db-floor-press', 'bw-pushup'] }),
  ex({ id: 'bike-intervals', name: 'Bike intervals', tags: ['endurance'], equipment: ['cardio-machine'], minExperience: 'beginner', difficulty: 2, mode: 'timed', defaultDurationSec: 60, cue: 'Hard but controlled effort for the interval, easy spin during rest.', substitutions: ['mountain-climber', 'jumping-jacks', 'march-in-place'], loadable: false }),
  ex({ id: 'rower-steady', name: 'Rowing machine (steady)', tags: ['endurance'], equipment: ['cardio-machine'], minExperience: 'beginner', difficulty: 1, mode: 'timed', defaultDurationSec: 180, cue: 'Legs, body, arms — smooth and conversational pace.', substitutions: ['march-in-place', 'jumping-jacks'], loadable: false }),

  // ── Gym staples for user programmes (V0.2) ────────────────────
  ex({ id: 'smith-bench-press', name: 'Smith machine bench press', loadType: 'per-side', aliases: ['smith bench', 'smith bench press', 'smith press'], tags: ['strength'], equipment: ['machine', 'bench'], minExperience: 'beginner', difficulty: 2, mode: 'reps', defaultReps: 8, cue: 'Bar to mid-chest, elbows about 45°. Record plates per side; bar weight is not assumed.', substitutions: ['barbell-bench-press', 'db-bench-press'] }),
  ex({ id: 'barbell-bench-press', name: 'Barbell bench press', aliases: ['bb bench', 'barbell bench', 'flat barbell bench'], tags: ['strength'], equipment: ['barbell', 'bench', 'rack'], minExperience: 'intermediate', difficulty: 3, mode: 'reps', defaultReps: 8, cue: 'Shoulder blades set, bar to lower chest, press back over the shoulders.', substitutions: ['smith-bench-press', 'db-bench-press'] }),
  ex({ id: 'incline-db-press', name: 'Incline dumbbell press', loadType: 'per-dumbbell', aliases: ['incline db press', 'incline dumbbell press', 'incline press'], tags: ['strength'], equipment: ['dumbbells', 'bench'], minExperience: 'beginner', difficulty: 2, mode: 'reps', defaultReps: 10, cue: 'Bench at 30–45°, press up and slightly in.', substitutions: ['db-bench-press', 'incline-pushup'] }),
  ex({ id: 'overhead-press', name: 'Barbell overhead press', aliases: ['ohp', 'overhead press', 'military press'], tags: ['strength'], equipment: ['barbell', 'rack'], minExperience: 'intermediate', difficulty: 3, mode: 'reps', defaultReps: 6, cue: 'Glutes tight, press straight up, head through at the top.', substitutions: ['db-shoulder-press'] }),
  ex({ id: 'lateral-raise', name: 'Lateral raise', loadType: 'per-dumbbell', aliases: ['lateral raises', 'side raise', 'lat raise', 'db lateral raise'], tags: ['strength'], equipment: ['dumbbells'], minExperience: 'beginner', difficulty: 1, mode: 'reps', defaultReps: 12, cue: 'Lead with the elbows, stop at shoulder height.', substitutions: ['prone-yt-raise'] }),
  ex({ id: 'pull-up', name: 'Pull-up', aliases: ['pull-ups', 'pullups', 'pull ups', 'pullup'], tags: ['strength'], equipment: [], minExperience: 'intermediate', difficulty: 3, mode: 'reps', defaultReps: 8, loadable: true, cue: 'Full hang to chin over bar. Added load and assistance are recorded separately.', substitutions: ['lat-pulldown'] }),
  ex({ id: 'chin-up', name: 'Chin-up', aliases: ['chin-ups', 'chinups', 'chin ups'], tags: ['strength'], equipment: [], minExperience: 'intermediate', difficulty: 3, mode: 'reps', defaultReps: 8, loadable: true, cue: 'Palms facing you, drive the elbows down.', substitutions: ['lat-pulldown'] }),
  ex({ id: 'smith-squat', name: 'Smith machine squat', loadType: 'per-side', aliases: ['smith squat'], tags: ['strength'], equipment: ['machine'], minExperience: 'beginner', difficulty: 2, mode: 'reps', defaultReps: 8, cue: 'Feet slightly forward, sit down between the hips. Record plates per side.', substitutions: ['leg-press', 'goblet-squat'] }),
  ex({ id: 'deadlift', name: 'Barbell deadlift', aliases: ['deadlift', 'deadlifts', 'conventional deadlift'], tags: ['strength'], equipment: ['barbell'], minExperience: 'intermediate', difficulty: 3, mode: 'reps', secondsPerRep: 4, defaultReps: 5, cue: 'Bar over mid-foot, brace, push the floor away.', substitutions: ['barbell-rdl', 'db-rdl'] }),
  ex({ id: 'hip-thrust', name: 'Hip thrust', aliases: ['hip thrusts', 'barbell hip thrust'], tags: ['strength'], equipment: ['barbell', 'bench'], minExperience: 'beginner', difficulty: 2, mode: 'reps', defaultReps: 10, cue: 'Upper back on the bench, drive hips up, ribs down.', substitutions: ['glute-bridge'] }),
  ex({ id: 'leg-curl', name: 'Leg curl', aliases: ['leg curls', 'hamstring curl', 'lying leg curl', 'seated leg curl'], tags: ['strength'], equipment: ['machine'], minExperience: 'beginner', difficulty: 1, mode: 'reps', defaultReps: 12, cue: 'Control the lowering through the full range.', substitutions: ['db-rdl', 'glute-bridge'] }),
  ex({ id: 'leg-extension', name: 'Leg extension', aliases: ['leg extensions', 'quad extension'], tags: ['strength'], equipment: ['machine'], minExperience: 'beginner', difficulty: 1, mode: 'reps', defaultReps: 12, cue: 'Pause briefly at the top, lower slowly.', substitutions: ['goblet-squat', 'bw-squat'] }),
  ex({ id: 'calf-raise', name: 'Standing calf raise', aliases: ['calf raises', 'calf raise'], tags: ['strength'], equipment: ['machine'], minExperience: 'beginner', difficulty: 1, mode: 'reps', defaultReps: 12, cue: 'Full stretch at the bottom, pause at the top.', substitutions: ['bw-squat'] }),
  ex({ id: 'db-curl', name: 'Dumbbell biceps curl', loadType: 'per-dumbbell', aliases: ['bicep curl', 'biceps curl', 'db curl', 'curls', 'dumbbell curl'], tags: ['strength'], equipment: ['dumbbells'], minExperience: 'beginner', difficulty: 1, mode: 'reps', defaultReps: 12, cue: 'Elbows still, squeeze at the top.', substitutions: ['cable-row'] }),
  ex({ id: 'triceps-pushdown', name: 'Triceps pushdown', aliases: ['tricep pushdown', 'triceps pushdown', 'pushdown', 'rope pushdown'], tags: ['strength'], equipment: ['cable'], minExperience: 'beginner', difficulty: 1, mode: 'reps', defaultReps: 12, cue: 'Elbows pinned, extend fully.', substitutions: ['bw-pushup'] }),
  ex({ id: 'cable-fly', name: 'Cable fly', aliases: ['cable flyes', 'cable flys', 'pec fly'], tags: ['strength'], equipment: ['cable'], minExperience: 'beginner', difficulty: 1, mode: 'reps', defaultReps: 12, cue: 'Soft elbows, wide arc, squeeze in front of the chest.', substitutions: ['db-floor-press'] }),
  ex({ id: 'face-pull', name: 'Face pull', aliases: ['face pulls'], tags: ['strength'], equipment: ['cable'], minExperience: 'beginner', difficulty: 1, mode: 'reps', defaultReps: 15, cue: 'Pull to the forehead, thumbs back.', substitutions: ['prone-yt-raise'] }),
  // ── V0.3 additions for the starter library (home and dumbbell options) ──
  ex({ id: 'db-split-squat', name: 'Dumbbell split squat', loadType: 'per-dumbbell', aliases: ['split squat', 'bulgarian split squat', 'db split squat'], tags: ['strength'], equipment: ['dumbbells'], minExperience: 'beginner', difficulty: 2, mode: 'reps', secondsPerRep: 4, defaultReps: 10, cue: 'Long stance, drop the back knee straight down. Reps per side.', substitutions: ['bw-split-squat', 'goblet-squat'] }),
  ex({ id: 'bw-split-squat', name: 'Split squat', tags: ['strength'], equipment: [], minExperience: 'beginner', difficulty: 1, mode: 'reps', secondsPerRep: 4, defaultReps: 10, cue: 'Long stance, drop the back knee straight down. Reps per side.', substitutions: ['bw-reverse-lunge', 'bw-squat'] }),
  ex({ id: 'db-hammer-curl', name: 'Hammer curl', loadType: 'per-dumbbell', aliases: ['hammer curl', 'hammer curls'], tags: ['strength'], equipment: ['dumbbells'], minExperience: 'beginner', difficulty: 1, mode: 'reps', defaultReps: 12, cue: 'Palms facing in, elbows still.', substitutions: ['db-curl'] }),
  ex({ id: 'db-overhead-triceps', name: 'Overhead dumbbell triceps extension', aliases: ['overhead triceps extension', 'overhead tricep extension'], tags: ['strength'], equipment: ['dumbbells'], minExperience: 'beginner', difficulty: 1, mode: 'reps', defaultReps: 12, cue: 'One dumbbell held in both hands, elbows pointing up, lower behind the head.', substitutions: ['triceps-pushdown'] }),
  ex({ id: 'db-calf-raise', name: 'Dumbbell calf raise', loadType: 'per-dumbbell', tags: ['strength'], equipment: ['dumbbells'], minExperience: 'beginner', difficulty: 1, mode: 'reps', defaultReps: 15, cue: 'Full stretch at the bottom, pause at the top.', substitutions: ['bw-calf-raise'] }),
  ex({ id: 'bw-calf-raise', name: 'Bodyweight calf raise', tags: ['strength'], equipment: [], minExperience: 'beginner', difficulty: 1, mode: 'reps', defaultReps: 15, cue: 'On a step if available; slow lowering.', substitutions: ['db-calf-raise'] }),
  ex({ id: 'reverse-fly', name: 'Dumbbell reverse fly', loadType: 'per-dumbbell', aliases: ['rear delt fly', 'reverse fly'], tags: ['strength'], equipment: ['dumbbells'], minExperience: 'beginner', difficulty: 1, mode: 'reps', defaultReps: 15, cue: 'Hinge forward, lead with the elbows, squeeze the upper back.', substitutions: ['face-pull', 'prone-yt-raise'] }),
  ex({ id: 'db-fly', name: 'Dumbbell fly', loadType: 'per-dumbbell', aliases: ['db fly', 'dumbbell flyes'], tags: ['strength'], equipment: ['dumbbells', 'bench'], minExperience: 'beginner', difficulty: 1, mode: 'reps', defaultReps: 12, cue: 'Soft elbows, wide arc, stop when the chest is stretched.', substitutions: ['cable-fly'] }),
];

/**
 * Names that don't say which variation was used. Importing these asks the user
 * to choose rather than guessing.
 */
export const AMBIGUOUS_NAMES: Readonly<Record<string, readonly string[]>> = {
  squat: ['barbell-back-squat', 'smith-squat', 'goblet-squat'],
  squats: ['barbell-back-squat', 'smith-squat', 'goblet-squat'],
  rdl: ['barbell-rdl', 'db-rdl'],
  'romanian deadlift': ['barbell-rdl', 'db-rdl'],
  bench: ['barbell-bench-press', 'smith-bench-press', 'db-bench-press'],
  'bench press': ['barbell-bench-press', 'smith-bench-press', 'db-bench-press'],
  'shoulder press': ['db-shoulder-press', 'overhead-press'],
  row: ['db-row', 'cable-row'],
  rows: ['db-row', 'cable-row'],
};

export const EXERCISES_BY_ID: ReadonlyMap<string, Exercise> = new Map(EXERCISES.map((e) => [e.id, e]));
