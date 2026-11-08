import type { EquipmentAccess, EquipmentItem, Experience, MusclePriority, TrainingGoal } from '../domain/types';

/**
 * AdaptFit starter programme library (V0.3).
 *
 * ORIGINAL templates written for AdaptFit from general, widely taught
 * resistance-training principles (see docs/SOURCES.md). They do not reproduce
 * any proprietary programme, text, or illustration. Every template is a
 * starting point: the user previews it, edits it, and saves it themselves.
 */

export type Muscle = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core';

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  core: 'Core',
};

/** Which muscles each questionnaire priority refers to. */
export const PRIORITY_MUSCLES: Record<Exclude<MusclePriority, 'full-body'>, Muscle[]> = {
  chest: ['chest'],
  back: ['back'],
  shoulders: ['shoulders'],
  arms: ['biceps', 'triceps'],
  legs: ['quads', 'hamstrings', 'calves'],
  glutes: ['glutes'],
};

/** Primary muscles trained by each library exercise (used for weekly set counts). */
export const EXERCISE_MUSCLES: Readonly<Record<string, readonly Muscle[]>> = {
  'barbell-back-squat': ['quads', 'glutes'],
  'smith-squat': ['quads', 'glutes'],
  'leg-press': ['quads', 'glutes'],
  'goblet-squat': ['quads', 'glutes'],
  'bw-squat': ['quads', 'glutes'],
  'db-split-squat': ['quads', 'glutes'],
  'bw-split-squat': ['quads', 'glutes'],
  'db-reverse-lunge': ['quads', 'glutes'],
  'bw-reverse-lunge': ['quads', 'glutes'],
  'leg-extension': ['quads'],
  'barbell-rdl': ['hamstrings', 'glutes'],
  'db-rdl': ['hamstrings', 'glutes'],
  deadlift: ['hamstrings', 'glutes', 'back'],
  'leg-curl': ['hamstrings'],
  'hip-thrust': ['glutes'],
  'glute-bridge': ['glutes'],
  'calf-raise': ['calves'],
  'db-calf-raise': ['calves'],
  'bw-calf-raise': ['calves'],
  'barbell-bench-press': ['chest', 'triceps'],
  'smith-bench-press': ['chest', 'triceps'],
  'db-bench-press': ['chest', 'triceps'],
  'db-floor-press': ['chest', 'triceps'],
  'incline-db-press': ['chest', 'shoulders'],
  'chest-press-machine': ['chest', 'triceps'],
  'bw-pushup': ['chest', 'triceps'],
  'incline-pushup': ['chest', 'triceps'],
  'cable-fly': ['chest'],
  'db-fly': ['chest'],
  'lat-pulldown': ['back', 'biceps'],
  'pull-up': ['back', 'biceps'],
  'chin-up': ['back', 'biceps'],
  'cable-row': ['back'],
  'db-row': ['back'],
  'prone-yt-raise': ['back', 'shoulders'],
  'face-pull': ['shoulders', 'back'],
  'reverse-fly': ['shoulders', 'back'],
  'overhead-press': ['shoulders', 'triceps'],
  'db-shoulder-press': ['shoulders', 'triceps'],
  'pike-pushup': ['shoulders', 'triceps'],
  'lateral-raise': ['shoulders'],
  'db-curl': ['biceps'],
  'db-hammer-curl': ['biceps'],
  'triceps-pushdown': ['triceps'],
  'db-overhead-triceps': ['triceps'],
  plank: ['core'],
  'dead-bug': ['core'],
  'bird-dog': ['core'],
};

/** Equipment available for each questionnaire option. */
export const ACCESS_EQUIPMENT: Record<EquipmentAccess, readonly EquipmentItem[]> = {
  'full-gym': ['dumbbells', 'bench', 'barbell', 'rack', 'cable', 'machine', 'cardio-machine'],
  'dumbbells-bench': ['dumbbells', 'bench'],
  'basic-home': ['dumbbells'],
  bodyweight: [],
};

/** Bodyweight exercises that still need a bar (not available at home by default). */
export const NEEDS_PULLUP_BAR = new Set(['pull-up', 'chin-up']);

export const EQUIPMENT_ACCESS_LABEL: Record<EquipmentAccess, string> = {
  'full-gym': 'Full commercial gym',
  'dumbbells-bench': 'Dumbbells and bench',
  'basic-home': 'Basic home equipment',
  bodyweight: 'Bodyweight only',
};

/**
 * One exercise slot. `options` is ordered by preference; the first option the
 * user's equipment, experience, and restrictions allow is used, and the rest
 * are offered as swaps.
 */
export interface TemplateSlot {
  pattern: string;
  options: string[];
  sets: number;
  repMin: number | null;
  repMax: number | null;
  durationSec?: number;
  restSec: number;
  priority?: boolean;
}

export interface TemplateDay {
  name: string;
  slots: TemplateSlot[];
}

export interface ProgrammeTemplate {
  id: string;
  name: string;
  daysPerWeek: number;
  audience: string;
  summary: string;
  /** Nominal session length; every generated day must estimate at or under this. */
  sessionMinutes: number;
  minExperience: Experience;
  /** Experience levels for which this template is a natural fit. */
  suitedExperience: Experience[];
  /** 0–3 fit for each training goal. */
  goalFit: Record<TrainingGoal, number>;
  days: TemplateDay[];
  equipmentNote: string;
  progression: string;
  recovery: string;
  /** IDs in SOURCE_REGISTRY. */
  sources: string[];
}

const COMPOUND_REST = 150;
const MAIN_REST = 120;
const ACCESSORY_REST = 90;
const ISO_REST = 60;

// Slot shorthands.
const squat = (sets = 3, priority = true): TemplateSlot => ({ pattern: 'Squat pattern', options: ['barbell-back-squat', 'smith-squat', 'leg-press', 'goblet-squat', 'db-split-squat', 'bw-squat'], sets, repMin: 6, repMax: 10, restSec: COMPOUND_REST, priority });
const legPress = (sets = 3): TemplateSlot => ({ pattern: 'Squat pattern (machine)', options: ['leg-press', 'smith-squat', 'goblet-squat', 'db-split-squat', 'bw-split-squat'], sets, repMin: 8, repMax: 12, restSec: MAIN_REST });
const hinge = (sets = 3, priority = false): TemplateSlot => ({ pattern: 'Hip hinge', options: ['barbell-rdl', 'db-rdl', 'glute-bridge'], sets, repMin: 8, repMax: 12, restSec: MAIN_REST, priority });
const hPress = (sets = 3, priority = true): TemplateSlot => ({ pattern: 'Horizontal press', options: ['barbell-bench-press', 'smith-bench-press', 'db-bench-press', 'db-floor-press', 'bw-pushup'], sets, repMin: 6, repMax: 10, restSec: COMPOUND_REST, priority });
const incline = (sets = 3, priority = false): TemplateSlot => ({ pattern: 'Incline press', options: ['incline-db-press', 'chest-press-machine', 'db-bench-press', 'db-floor-press', 'incline-pushup'], sets, repMin: 8, repMax: 12, restSec: MAIN_REST, priority });
const vPress = (sets = 3): TemplateSlot => ({ pattern: 'Overhead press', options: ['db-shoulder-press', 'overhead-press', 'pike-pushup'], sets, repMin: 8, repMax: 12, restSec: MAIN_REST });
const vPull = (sets = 3, priority = true): TemplateSlot => ({ pattern: 'Vertical pull', options: ['lat-pulldown', 'pull-up', 'db-row', 'prone-yt-raise'], sets, repMin: 8, repMax: 12, restSec: MAIN_REST, priority });
const row = (sets = 3): TemplateSlot => ({ pattern: 'Row', options: ['cable-row', 'db-row', 'prone-yt-raise'], sets, repMin: 8, repMax: 12, restSec: ACCESSORY_REST });
const lateral = (sets = 3): TemplateSlot => ({ pattern: 'Lateral raise', options: ['lateral-raise', 'prone-yt-raise'], sets, repMin: 12, repMax: 15, restSec: ISO_REST });
const rearDelt = (sets = 2): TemplateSlot => ({ pattern: 'Rear delts', options: ['face-pull', 'reverse-fly', 'prone-yt-raise'], sets, repMin: 12, repMax: 15, restSec: ISO_REST });
const curl = (sets = 2): TemplateSlot => ({ pattern: 'Biceps', options: ['db-curl', 'db-hammer-curl'], sets, repMin: 10, repMax: 15, restSec: ISO_REST });
const triceps = (sets = 2): TemplateSlot => ({ pattern: 'Triceps', options: ['triceps-pushdown', 'db-overhead-triceps'], sets, repMin: 10, repMax: 15, restSec: ISO_REST });
const legCurl = (sets = 3): TemplateSlot => ({ pattern: 'Hamstring curl', options: ['leg-curl', 'db-rdl', 'glute-bridge'], sets, repMin: 10, repMax: 15, restSec: ACCESSORY_REST });
const legExt = (sets = 3): TemplateSlot => ({ pattern: 'Quad isolation', options: ['leg-extension', 'db-split-squat', 'bw-split-squat'], sets, repMin: 10, repMax: 15, restSec: ACCESSORY_REST });
const glute = (sets = 3): TemplateSlot => ({ pattern: 'Glutes', options: ['hip-thrust', 'glute-bridge'], sets, repMin: 8, repMax: 12, restSec: ACCESSORY_REST });
const lunge = (sets = 2): TemplateSlot => ({ pattern: 'Single-leg', options: ['db-split-squat', 'db-reverse-lunge', 'bw-split-squat', 'bw-reverse-lunge'], sets, repMin: 8, repMax: 12, restSec: ACCESSORY_REST });
const calf = (sets = 3): TemplateSlot => ({ pattern: 'Calves', options: ['calf-raise', 'db-calf-raise', 'bw-calf-raise'], sets, repMin: 10, repMax: 15, restSec: ISO_REST });
const fly = (sets = 2): TemplateSlot => ({ pattern: 'Chest fly', options: ['cable-fly', 'db-fly', 'incline-pushup'], sets, repMin: 12, repMax: 15, restSec: ISO_REST });
const core = (sets = 2): TemplateSlot => ({ pattern: 'Core', options: ['plank', 'dead-bug'], sets, repMin: null, repMax: null, durationSec: 30, restSec: ISO_REST });

const COMMON_SOURCES = ['schoenfeld-volume-2017', 'schoenfeld-frequency-2016', 'acsm-progression-2009', 'thefitness-wiki', 'strengthlog-programs'];

export const PROGRAMME_TEMPLATES: readonly ProgrammeTemplate[] = [
  {
    id: 'af-full-body-essentials',
    name: 'Full Body Essentials',
    daysPerWeek: 2,
    audience: 'Time-constrained lifters',
    summary: 'Two full-body sessions that cover every major movement pattern. A practical minimum for busy weeks.',
    sessionMinutes: 45,
    minExperience: 'beginner',
    suitedExperience: ['beginner', 'intermediate', 'advanced'],
    goalFit: { hypertrophy: 2, strength: 2, 'fat-loss': 2, recomposition: 2, general: 3, consistency: 3 },
    days: [
      { name: 'Full Body A', slots: [squat(3), hPress(3), vPull(3), hinge(2), row(2), lateral(2)] },
      { name: 'Full Body B', slots: [hinge(3, true), incline(3, true), row(3), legPress(2), vPress(2), curl(2)] },
    ],
    equipmentNote: 'Works with any equipment level; each slot lists home alternatives.',
    progression: 'Double progression: stay at a weight until every set reaches the top of the rep range, then add the smallest available increment.',
    recovery: 'Leave at least one rest day between the two sessions. Each muscle is trained twice a week.',
    sources: COMMON_SOURCES,
  },
  {
    id: 'af-full-body-progression',
    name: 'Full Body Progression',
    daysPerWeek: 3,
    audience: 'Strength and hypertrophy',
    summary: 'Three full-body days built around one main lift each, trained three times a week for steady progress.',
    sessionMinutes: 45,
    minExperience: 'beginner',
    suitedExperience: ['beginner', 'intermediate'],
    goalFit: { hypertrophy: 3, strength: 3, 'fat-loss': 2, recomposition: 3, general: 3, consistency: 2 },
    days: [
      { name: 'Full Body A', slots: [squat(3), hPress(3), row(3), hinge(2), lateral(2), curl(2)] },
      { name: 'Full Body B', slots: [hinge(3, true), vPress(3), vPull(3), lunge(2), fly(2), triceps(2)] },
      { name: 'Full Body C', slots: [legPress(3), incline(3, true), row(3), legCurl(2), rearDelt(2), calf(2)] },
    ],
    equipmentNote: 'Best with a commercial gym; dumbbell and bodyweight alternatives are provided.',
    progression: 'Double progression on every exercise. Main lifts use 6–10 reps; accessories 10–15.',
    recovery: 'Train on non-consecutive days (e.g. Mon/Wed/Fri). Keep 1–3 reps in reserve on most sets.',
    sources: COMMON_SOURCES,
  },
  {
    id: 'af-upper-lower-full',
    name: 'Upper / Lower / Full',
    daysPerWeek: 3,
    audience: 'Balanced hypertrophy',
    summary: 'An upper day, a lower day, and a full-body day: more exercise variety per muscle than full-body only.',
    sessionMinutes: 50,
    minExperience: 'beginner',
    suitedExperience: ['intermediate', 'advanced'],
    goalFit: { hypertrophy: 3, strength: 2, 'fat-loss': 2, recomposition: 3, general: 2, consistency: 2 },
    days: [
      { name: 'Upper', slots: [hPress(3), vPull(3), incline(3), row(3), lateral(2), curl(2), triceps(2)] },
      { name: 'Lower', slots: [squat(3), hinge(3, true), legCurl(3), legExt(2), calf(3)] },
      { name: 'Full Body', slots: [legPress(3), vPress(3), row(3), glute(2), fly(2), rearDelt(2)] },
    ],
    equipmentNote: 'Designed for a commercial gym; dumbbell alternatives are provided.',
    progression: 'Double progression. Add a set to a lagging muscle only after a few weeks of steady progress.',
    recovery: 'Place the Full Body day after a rest day where possible.',
    sources: COMMON_SOURCES,
  },
  {
    id: 'af-upper-lower-4',
    name: 'Upper / Lower Split',
    daysPerWeek: 4,
    audience: 'Intermediate and advanced lifters',
    summary: 'Two upper and two lower days a week. Each muscle is trained twice with more weekly volume.',
    sessionMinutes: 45,
    minExperience: 'intermediate',
    suitedExperience: ['intermediate', 'advanced'],
    goalFit: { hypertrophy: 3, strength: 3, 'fat-loss': 2, recomposition: 3, general: 2, consistency: 1 },
    days: [
      { name: 'Upper A', slots: [hPress(3), vPull(3), row(3), vPress(2), lateral(3), triceps(2)] },
      { name: 'Lower A', slots: [squat(3), hinge(3), legCurl(3), calf(3), core(2)] },
      { name: 'Upper B', slots: [incline(3, true), row(3), vPull(3, false), fly(2), rearDelt(2), curl(3)] },
      { name: 'Lower B', slots: [legPress(3), glute(3), lunge(2), legExt(3), calf(3)] },
    ],
    equipmentNote: 'Designed for a commercial gym.',
    progression: 'Double progression; main lifts may use small weekly load increases once reps are consistent.',
    recovery: 'A common layout is Mon/Tue upper/lower, rest Wednesday, Thu/Fri upper/lower.',
    sources: COMMON_SOURCES,
  },
  {
    id: 'af-five-day-hypertrophy',
    name: 'Five-Day Hypertrophy',
    daysPerWeek: 5,
    audience: 'Lifters with more time available',
    summary: 'Push, pull, legs, then upper and lower: the highest weekly volume in the library.',
    sessionMinutes: 45,
    minExperience: 'intermediate',
    suitedExperience: ['intermediate', 'advanced'],
    goalFit: { hypertrophy: 3, strength: 2, 'fat-loss': 1, recomposition: 2, general: 1, consistency: 1 },
    days: [
      { name: 'Push', slots: [hPress(3), incline(3), vPress(3), lateral(3), triceps(3)] },
      { name: 'Pull', slots: [vPull(3), row(3), rearDelt(3), curl(3), { ...curl(2), options: ['db-hammer-curl', 'db-curl'] }] },
      { name: 'Legs', slots: [squat(3), hinge(3), legCurl(3), legExt(2), calf(3)] },
      { name: 'Upper', slots: [incline(3, true), row(3), fly(2), lateral(3), triceps(2), curl(2)] },
      { name: 'Lower', slots: [legPress(3), glute(3), lunge(2), legCurl(2), calf(3)] },
    ],
    equipmentNote: 'Designed for a commercial gym.',
    progression: 'Double progression. Five days is demanding: reduce sets before adding more.',
    recovery: 'Needs consistent sleep and two rest days. If recovery slips, a 3- or 4-day template may suit better.',
    sources: COMMON_SOURCES,
  },
];

export const TEMPLATES_BY_ID: ReadonlyMap<string, ProgrammeTemplate> = new Map(PROGRAMME_TEMPLATES.map((t) => [t.id, t]));
