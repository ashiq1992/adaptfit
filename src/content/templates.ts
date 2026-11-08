import type { TemplateBlock, WorkoutTemplate } from '../domain/types';

function reps(exerciseId: string, sets: number, count: number, restSec: number): TemplateBlock {
  return { exerciseId, sets, reps: count, restSec };
}
function timed(exerciseId: string, sets: number, durationSec: number, restSec: number): TemplateBlock {
  return { exerciseId, sets, durationSec, restSec };
}

const STRENGTH = { strength: 3, consistency: 1, general: 2 };
const CONDITIONING = { strength: 1, consistency: 2, general: 3 };
const QUICK = { strength: 1, consistency: 3, general: 2 };
const GENTLE = { strength: 1, consistency: 2, general: 2 };
const BALANCED = { strength: 2, consistency: 2, general: 3 };

/**
 * Vetted templates. IDs are stable; estimates are computed (not authored) by
 * the domain so the catalog test can verify coverage of every equipment mode,
 * time band, and readiness level.
 */
export const TEMPLATES: readonly WorkoutTemplate[] = [
  // ── Bodyweight ────────────────────────────────────────────────
  {
    id: 'bw-quick-starter', name: 'Quick starter circuit', mode: 'bodyweight', emphasis: 'full', intensity: 'moderate',
    minExperience: 'beginner', goalFit: QUICK, warmupSec: 60, optionalEquipment: [],
    blocks: [reps('bw-squat', 1, 12, 0), reps('bw-pushup', 1, 8, 0), timed('jumping-jacks', 1, 30, 0), timed('plank', 1, 20, 0)],
  },
  {
    id: 'bw-mobility-reset', name: 'Mobility reset', mode: 'bodyweight', emphasis: 'full', intensity: 'gentle',
    minExperience: 'beginner', goalFit: GENTLE, warmupSec: 0, optionalEquipment: [],
    blocks: [timed('mobility-flow', 1, 90, 0), timed('march-in-place', 1, 60, 0), reps('glute-bridge', 1, 12, 0), reps('bird-dog', 1, 8, 0)],
  },
  {
    id: 'bw-express', name: 'Express full-body', mode: 'bodyweight', emphasis: 'full', intensity: 'moderate',
    minExperience: 'beginner', goalFit: QUICK, warmupSec: 60, optionalEquipment: [],
    blocks: [reps('bw-squat', 2, 10, 30), reps('bw-pushup', 2, 8, 30), timed('mountain-climber', 2, 30, 20), timed('plank', 1, 30, 0)],
  },
  {
    id: 'bw-gentle-express', name: 'Gentle express', mode: 'bodyweight', emphasis: 'full', intensity: 'gentle',
    minExperience: 'beginner', goalFit: GENTLE, warmupSec: 60, optionalEquipment: [],
    blocks: [timed('march-in-place', 1, 90, 0), reps('glute-bridge', 2, 10, 30), reps('bird-dog', 2, 6, 30), timed('mobility-flow', 1, 120, 0)],
  },
  {
    id: 'bw-full-circuit', name: 'Full-body circuit', mode: 'bodyweight', emphasis: 'full', intensity: 'moderate',
    minExperience: 'beginner', goalFit: BALANCED, warmupSec: 120, optionalEquipment: [],
    blocks: [reps('bw-squat', 2, 12, 45), reps('bw-pushup', 2, 8, 45), reps('bw-reverse-lunge', 2, 8, 45), timed('mountain-climber', 2, 30, 30), timed('plank', 2, 30, 30)],
  },
  {
    id: 'bw-gentle-full', name: 'Gentle full-body', mode: 'bodyweight', emphasis: 'full', intensity: 'gentle',
    minExperience: 'beginner', goalFit: GENTLE, warmupSec: 120, optionalEquipment: [],
    blocks: [timed('march-in-place', 2, 60, 30), reps('glute-bridge', 2, 10, 45), reps('incline-pushup', 2, 8, 45), reps('dead-bug', 2, 8, 45), timed('mobility-flow', 1, 120, 0)],
  },
  {
    id: 'bw-upper-builder', name: 'Upper-body builder', mode: 'bodyweight', emphasis: 'upper', intensity: 'moderate',
    minExperience: 'beginner', goalFit: STRENGTH, warmupSec: 180, optionalEquipment: [],
    blocks: [reps('bw-pushup', 3, 8, 60), reps('prone-yt-raise', 3, 10, 45), reps('pike-pushup', 3, 6, 60), timed('plank', 3, 30, 30), reps('incline-pushup', 2, 10, 45)],
  },
  {
    id: 'bw-lower-builder', name: 'Lower-body builder', mode: 'bodyweight', emphasis: 'lower', intensity: 'moderate',
    minExperience: 'beginner', goalFit: STRENGTH, warmupSec: 180, optionalEquipment: [],
    blocks: [reps('bw-squat', 3, 12, 60), reps('bw-reverse-lunge', 3, 8, 60), reps('glute-bridge', 3, 12, 45), timed('wall-sit', 2, 40, 45), reps('dead-bug', 2, 8, 45)],
  },
  {
    id: 'bw-gentle-flow', name: 'Easy movement flow', mode: 'bodyweight', emphasis: 'full', intensity: 'gentle',
    minExperience: 'beginner', goalFit: GENTLE, warmupSec: 180, optionalEquipment: [],
    blocks: [timed('march-in-place', 2, 90, 30), reps('bw-squat', 2, 10, 60), reps('incline-pushup', 2, 8, 60), reps('glute-bridge', 2, 12, 45), reps('bird-dog', 2, 8, 45), timed('mobility-flow', 1, 180, 0)],
  },
  {
    id: 'bw-conditioning', name: 'Bodyweight conditioning', mode: 'bodyweight', emphasis: 'conditioning', intensity: 'moderate',
    minExperience: 'beginner', goalFit: CONDITIONING, warmupSec: 180, optionalEquipment: [],
    blocks: [timed('jumping-jacks', 4, 40, 20), timed('mountain-climber', 4, 30, 30), reps('bw-squat', 3, 15, 30), timed('high-knees', 3, 30, 30), reps('burpee', 3, 6, 45)],
  },
  {
    id: 'bw-strength-30', name: 'Bodyweight strength session', mode: 'bodyweight', emphasis: 'full', intensity: 'moderate',
    minExperience: 'beginner', goalFit: STRENGTH, warmupSec: 240, optionalEquipment: [],
    blocks: [reps('bw-squat', 4, 12, 60), reps('bw-pushup', 4, 8, 60), reps('bw-reverse-lunge', 3, 10, 60), reps('prone-yt-raise', 3, 12, 45), reps('glute-bridge', 3, 15, 45), timed('plank', 3, 30, 30)],
  },
  {
    id: 'bw-gentle-long', name: 'Long gentle session', mode: 'bodyweight', emphasis: 'full', intensity: 'gentle',
    minExperience: 'beginner', goalFit: GENTLE, warmupSec: 360, optionalEquipment: [],
    blocks: [timed('march-in-place', 2, 120, 30), timed('mobility-flow', 2, 120, 30), reps('bw-squat', 3, 10, 60), reps('incline-pushup', 3, 8, 60), reps('glute-bridge', 3, 12, 45), reps('bird-dog', 3, 8, 45)],
  },
  {
    id: 'bw-endurance-long', name: 'Bodyweight endurance builder', mode: 'bodyweight', emphasis: 'conditioning', intensity: 'moderate',
    minExperience: 'beginner', goalFit: CONDITIONING, warmupSec: 300, optionalEquipment: [],
    blocks: [timed('jumping-jacks', 5, 45, 30), reps('bw-squat', 4, 15, 45), timed('mountain-climber', 5, 30, 30), reps('bw-pushup', 4, 10, 60), reps('bw-reverse-lunge', 4, 10, 60), timed('high-knees', 4, 30, 30), timed('plank', 3, 45, 30), timed('mobility-flow', 1, 180, 0)],
  },

  // ── Dumbbells ─────────────────────────────────────────────────
  {
    id: 'db-quick-strength', name: 'Quick dumbbell strength', mode: 'dumbbells', emphasis: 'full', intensity: 'moderate',
    minExperience: 'beginner', goalFit: STRENGTH, warmupSec: 120, optionalEquipment: ['bench'],
    blocks: [reps('goblet-squat', 3, 10, 60), reps('db-row', 3, 10, 45), reps('db-floor-press', 2, 10, 60)],
  },
  {
    id: 'db-gentle-full', name: 'Gentle dumbbell full-body', mode: 'dumbbells', emphasis: 'full', intensity: 'gentle',
    minExperience: 'beginner', goalFit: GENTLE, warmupSec: 120, optionalEquipment: [],
    blocks: [timed('march-in-place', 1, 60, 0), reps('goblet-squat', 2, 8, 60), reps('db-row', 2, 8, 60), reps('db-rdl', 2, 8, 60), timed('mobility-flow', 1, 120, 0)],
  },
  {
    id: 'db-upper', name: 'Dumbbell upper body', mode: 'dumbbells', emphasis: 'upper', intensity: 'moderate',
    minExperience: 'beginner', goalFit: STRENGTH, warmupSec: 180, optionalEquipment: ['bench'],
    blocks: [reps('db-floor-press', 3, 10, 75), reps('db-row', 3, 10, 60), reps('db-shoulder-press', 3, 10, 60), reps('prone-yt-raise', 2, 12, 45), timed('plank', 2, 30, 30)],
  },
  {
    id: 'db-lower', name: 'Dumbbell lower body', mode: 'dumbbells', emphasis: 'lower', intensity: 'moderate',
    minExperience: 'beginner', goalFit: STRENGTH, warmupSec: 180, optionalEquipment: [],
    blocks: [reps('goblet-squat', 3, 10, 75), reps('db-rdl', 3, 10, 75), reps('db-reverse-lunge', 3, 8, 60), reps('glute-bridge', 2, 15, 45), reps('dead-bug', 2, 8, 45)],
  },
  {
    id: 'db-full-25', name: 'Dumbbell full-body', mode: 'dumbbells', emphasis: 'full', intensity: 'moderate',
    minExperience: 'beginner', goalFit: BALANCED, warmupSec: 180, optionalEquipment: ['bench'],
    blocks: [reps('goblet-squat', 3, 10, 60), reps('db-floor-press', 3, 10, 60), reps('db-rdl', 3, 10, 60), reps('db-row', 3, 10, 60), timed('mountain-climber', 3, 30, 30)],
  },
  {
    id: 'db-gentle-25', name: 'Easy dumbbell session', mode: 'dumbbells', emphasis: 'full', intensity: 'gentle',
    minExperience: 'beginner', goalFit: GENTLE, warmupSec: 240, optionalEquipment: [],
    blocks: [timed('march-in-place', 2, 60, 30), reps('goblet-squat', 2, 10, 60), reps('db-row', 2, 10, 60), reps('db-floor-press', 2, 10, 60), reps('glute-bridge', 2, 12, 45), timed('mobility-flow', 1, 150, 0)],
  },
  {
    id: 'db-strength-30', name: 'Dumbbell strength session', mode: 'dumbbells', emphasis: 'full', intensity: 'moderate',
    minExperience: 'beginner', goalFit: STRENGTH, warmupSec: 240, optionalEquipment: ['bench'],
    blocks: [reps('goblet-squat', 3, 10, 75), reps('db-floor-press', 3, 10, 75), reps('db-rdl', 3, 10, 75), reps('db-row', 3, 10, 60), reps('db-shoulder-press', 3, 10, 60), reps('db-reverse-lunge', 2, 8, 60), timed('plank', 2, 30, 30)],
  },
  {
    id: 'db-full-long', name: 'Dumbbell full-body (long)', mode: 'dumbbells', emphasis: 'full', intensity: 'moderate',
    minExperience: 'beginner', goalFit: BALANCED, warmupSec: 300, optionalEquipment: ['bench'],
    blocks: [reps('goblet-squat', 4, 10, 90), reps('db-floor-press', 4, 10, 90), reps('db-rdl', 4, 10, 90), reps('db-row', 4, 10, 75), reps('db-shoulder-press', 3, 10, 75), reps('db-reverse-lunge', 3, 8, 60), timed('plank', 3, 40, 30)],
  },
  {
    id: 'db-strength-hard', name: 'Heavy dumbbell strength', mode: 'dumbbells', emphasis: 'full', intensity: 'hard',
    minExperience: 'intermediate', goalFit: STRENGTH, warmupSec: 300, optionalEquipment: ['bench'],
    blocks: [reps('goblet-squat', 5, 8, 120), reps('db-rdl', 5, 8, 120), reps('db-floor-press', 4, 8, 90), reps('db-row', 4, 8, 90), reps('db-shoulder-press', 3, 8, 90)],
  },
  {
    id: 'db-gentle-long', name: 'Long easy dumbbell session', mode: 'dumbbells', emphasis: 'full', intensity: 'gentle',
    minExperience: 'beginner', goalFit: GENTLE, warmupSec: 300, optionalEquipment: [],
    blocks: [timed('march-in-place', 2, 120, 30), reps('goblet-squat', 3, 8, 75), reps('db-row', 3, 8, 75), reps('db-rdl', 3, 8, 75), reps('db-floor-press', 3, 8, 75), reps('glute-bridge', 2, 12, 45), timed('mobility-flow', 1, 180, 0)],
  },

  // ── Gym ───────────────────────────────────────────────────────
  {
    id: 'gym-quick-machines', name: 'Quick machine circuit', mode: 'gym', emphasis: 'full', intensity: 'moderate',
    minExperience: 'beginner', goalFit: QUICK, warmupSec: 120, optionalEquipment: [],
    blocks: [reps('leg-press', 2, 10, 60), reps('chest-press-machine', 2, 10, 60), reps('lat-pulldown', 2, 10, 60), timed('bike-intervals', 2, 45, 30)],
  },
  {
    id: 'gym-gentle-short', name: 'Easy gym reset', mode: 'gym', emphasis: 'full', intensity: 'gentle',
    minExperience: 'beginner', goalFit: GENTLE, warmupSec: 60, optionalEquipment: [],
    blocks: [timed('rower-steady', 1, 300, 0), timed('mobility-flow', 1, 120, 0), reps('cable-row', 2, 10, 60)],
  },
  {
    id: 'gym-upper', name: 'Gym upper body', mode: 'gym', emphasis: 'upper', intensity: 'moderate',
    minExperience: 'beginner', goalFit: STRENGTH, warmupSec: 180, optionalEquipment: [],
    blocks: [reps('chest-press-machine', 3, 10, 75), reps('lat-pulldown', 3, 10, 75), reps('cable-row', 3, 10, 60), reps('db-shoulder-press', 3, 10, 60), timed('plank', 2, 30, 30)],
  },
  {
    id: 'gym-lower', name: 'Gym lower body', mode: 'gym', emphasis: 'lower', intensity: 'moderate',
    minExperience: 'beginner', goalFit: STRENGTH, warmupSec: 180, optionalEquipment: ['barbell'],
    blocks: [reps('leg-press', 3, 10, 90), reps('barbell-rdl', 3, 8, 90), reps('goblet-squat', 3, 10, 60), reps('glute-bridge', 2, 15, 45), timed('bike-intervals', 3, 45, 45)],
  },
  {
    id: 'gym-gentle-25', name: 'Easy gym full-body', mode: 'gym', emphasis: 'full', intensity: 'gentle',
    minExperience: 'beginner', goalFit: GENTLE, warmupSec: 180, optionalEquipment: [],
    blocks: [timed('rower-steady', 1, 240, 0), reps('leg-press', 2, 10, 75), reps('chest-press-machine', 2, 10, 75), reps('cable-row', 2, 10, 75), timed('mobility-flow', 1, 150, 0)],
  },
  {
    id: 'gym-conditioning', name: 'Gym conditioning', mode: 'gym', emphasis: 'conditioning', intensity: 'moderate',
    minExperience: 'beginner', goalFit: CONDITIONING, warmupSec: 180, optionalEquipment: [],
    blocks: [timed('bike-intervals', 6, 45, 45), timed('rower-steady', 1, 300, 0), reps('goblet-squat', 3, 12, 45), timed('mountain-climber', 3, 30, 30)],
  },
  {
    id: 'gym-full-30', name: 'Gym full-body express', mode: 'gym', emphasis: 'full', intensity: 'moderate',
    minExperience: 'beginner', goalFit: BALANCED, warmupSec: 300, optionalEquipment: [],
    blocks: [reps('leg-press', 3, 10, 75), reps('chest-press-machine', 3, 10, 75), reps('lat-pulldown', 3, 10, 75), reps('db-rdl', 3, 10, 75), reps('cable-row', 3, 10, 60), timed('bike-intervals', 3, 45, 45)],
  },
  {
    id: 'gym-full-long', name: 'Gym full-body', mode: 'gym', emphasis: 'full', intensity: 'moderate',
    minExperience: 'beginner', goalFit: BALANCED, warmupSec: 300, optionalEquipment: [],
    blocks: [reps('leg-press', 4, 10, 90), reps('chest-press-machine', 4, 10, 90), reps('lat-pulldown', 4, 10, 90), reps('db-rdl', 3, 10, 90), reps('cable-row', 3, 10, 75), timed('bike-intervals', 4, 45, 45)],
  },
  {
    id: 'gym-strength-long', name: 'Barbell strength day', mode: 'gym', emphasis: 'full', intensity: 'hard',
    minExperience: 'intermediate', goalFit: STRENGTH, warmupSec: 360, optionalEquipment: [],
    blocks: [reps('barbell-back-squat', 5, 5, 150), reps('chest-press-machine', 4, 8, 90), reps('barbell-rdl', 4, 6, 120), reps('lat-pulldown', 4, 8, 90), reps('cable-row', 3, 10, 75)],
  },
  {
    id: 'gym-gentle-long', name: 'Long easy gym session', mode: 'gym', emphasis: 'full', intensity: 'gentle',
    minExperience: 'beginner', goalFit: GENTLE, warmupSec: 300, optionalEquipment: [],
    blocks: [timed('rower-steady', 1, 360, 0), reps('leg-press', 3, 10, 75), reps('chest-press-machine', 3, 10, 75), reps('cable-row', 3, 10, 75), reps('glute-bridge', 2, 12, 45), timed('mobility-flow', 1, 240, 0)],
  },
];

export const TEMPLATES_BY_ID: ReadonlyMap<string, WorkoutTemplate> = new Map(TEMPLATES.map((t) => [t.id, t]));
