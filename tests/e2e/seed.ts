/**
 * SYNTHETIC DEMO DATA for automated tests and screenshots only.
 * Builds a version-2 (V0.2) backup: an experienced lifter following a 4-day
 * upper/lower programme for ~8 weeks. Never mix into real user data.
 */
import { addDays, localDateOf } from '../../src/domain/dates';
import { bodyweightFromMeasurement, migrateProgramme } from '../../src/domain/migrate';
import { emptyNutritionProfile } from '../../src/domain/nutrition';
import { starterUpperLower } from '../../src/domain/programme';
import { DEFAULT_CHARACTER, EMPTY_LIFESTYLE, EMPTY_TRAINING_PREFS, type CheckIn, type Measurement, type NutritionProfile, type Profile, type SessionExercise, type WorkoutSession } from '../../src/domain/types';

let n = 0;
const id = (p: string) => `${p}-${++n}`;

export const SEED_TZ = 'Asia/Singapore';

export function buildSeedBackup(now = new Date(), weeks = 8) {
  n = 0;
  const today = localDateOf(now, SEED_TZ);
  const start = addDays(today, -weeks * 7 + 1);
  const programme = starterUpperLower(() => id('p'), new Date(`${addDays(start, -3)}T08:00:00Z`));
  // A V0.2-shaped profile: this seed deliberately exercises the V0.2 → V0.3 restore migration.
  const profile: Omit<Profile, 'character' | 'trainingPrefs' | 'loggingMode' | 'notifications'> = {
    id: 'me',
    goal: 'hypertrophy',
    experience: 'intermediate',
    equipment: ['bodyweight', 'gym'],
    preferredMinutes: 60,
    weightUnit: 'kg',
    timezone: SEED_TZ,
    gamification: true,
    lifestyle: {
      ...EMPTY_LIFESTYLE,
      work: { days: [1, 2, 3, 4, 5], start: '09:00', end: '19:00', overtime: 'sometimes', trainingWindows: ['evening'] },
      sleep: { bedtime: '00:00', wake: '07:00', quality: 'fair' },
      nutrition: { pattern: 'Hawker lunch on workdays', objective: 'lean-gain', restrictions: ['halal'], proteinTargetG: 140, energyKcal: null, fasting: null },
      training: { minDays: 2, preferredDays: [1, 2, 4, 5] },
    },
    createdAt: `${addDays(start, -3)}T08:00:00.000Z`,
    updatedAt: `${addDays(start, -3)}T08:00:00.000Z`,
  };

  // Per-exercise progression rules (load, reps by session index).
  const perf: Record<string, (i: number) => { load: number | null; reps: number }> = {
    'smith-bench-press': (i) => ({ load: 25 + Math.floor(i / 3) * 2.5, reps: 7 + (i % 3) }),
    'lat-pulldown': () => ({ load: 55, reps: 10 }), // stalled — plateau candidate
    'cable-row': (i) => ({ load: 45 + Math.floor(i / 2) * 2.5, reps: 10 }),
    'lateral-raise': (i) => ({ load: 8 + Math.floor(i / 4), reps: 12 + (i % 2) }),
    'smith-squat': (i) => ({ load: 30 + i * 1.25, reps: 8 }),
    'db-rdl': (i) => ({ load: 20 + Math.floor(i / 2) * 2, reps: 10 }),
    'leg-curl': (i) => ({ load: 35 + Math.floor(i / 3) * 5, reps: 12 }),
    'calf-raise': () => ({ load: 60, reps: 12 }),
    'incline-db-press': (i) => ({ load: 18 + Math.floor(i / 3) * 2, reps: 9 + (i % 2) }),
    'db-row': (i) => ({ load: 24 + Math.floor(i / 3) * 2, reps: 10 }),
    'db-shoulder-press': (i) => ({ load: 16 + Math.floor(i / 4) * 2, reps: 10 }),
    'triceps-pushdown': () => ({ load: 25, reps: 12 }),
    'db-curl': (i) => ({ load: 10 + Math.floor(i / 4), reps: 12 }),
    'leg-press': (i) => ({ load: 120 + i * 5, reps: 10 }),
    'hip-thrust': (i) => ({ load: 60 + i * 5, reps: 10 }),
    'leg-extension': () => ({ load: 40, reps: 12 }),
  };

  const sessions: WorkoutSession[] = [];
  const counts: Record<string, number> = {};
  const trainingDays = [1, 2, 4, 5]; // Mon, Tue, Thu, Fri
  let dayIdx = 0;
  for (let d = 0; d < weeks * 7; d++) {
    const date = addDays(start, d);
    if (date >= today) break;
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (!trainingDays.includes(dow)) continue;
    if (d > weeks * 7 - 22 && d < weeks * 7 - 18 && dow === 4) continue; // one missed session for realism
    const day = programme.days[dayIdx % programme.days.length]!;
    dayIdx++;
    const startedAt = `${date}T11:00:00.000Z`;
    const exercises: SessionExercise[] = day.exercises.map((pe, k) => {
      const i = (counts[pe.exerciseId] = (counts[pe.exerciseId] ?? -1) + 1);
      const p = (perf[pe.exerciseId] ?? (() => ({ load: 20, reps: 10 })))(i);
      return {
        key: `${day.id}:${k}:${pe.id}`,
        exerciseId: pe.exerciseId,
        name: pe.name,
        loadType: pe.loadType,
        unit: 'kg',
        tags: ['strength'],
        priority: pe.priority,
        target: { sets: pe.sets, repMin: pe.repMin, repMax: pe.repMax, durationSec: null, restSec: pe.restSec },
        skipped: false,
        notes: '',
        sets: Array.from({ length: pe.sets }, (_, s) => ({
          id: id('set'),
          load: p.load,
          reps: Math.max(1, p.reps - (s === pe.sets - 1 ? 1 : 0)),
          durationSec: null,
          rir: null,
          completed: true,
          completedAt: `${date}T11:${String(5 + k * 10 + s * 3).padStart(2, '0')}:00.000Z`,
          prefill: 'previous' as const,
        })),
      };
    });
    sessions.push({
      id: id('session'),
      schemaVersion: 3,
      state: 'completed',
      source: 'programme',
      name: day.name,
      programmeId: programme.id,
      dayId: day.id,
      planKind: 'programme-day',
      emphasis: null,
      checkIn: null,
      exercises,
      position: 0,
      startedAt,
      updatedAt: `${date}T12:00:00.000Z`,
      completedAt: `${date}T12:00:00.000Z`,
      completedLocalDate: date,
      discardedAt: null,
      pausedAt: null,
      pausedMs: 0,
      durationSource: 'timer',
      durationSec: 46 * 60 + (dayIdx % 5) * 60,
      restStartedAt: null,
      restDurationSec: null,
      substitutions: [],
      importHash: null,
      editedAt: null,
    });
  }

  const checkIns: CheckIn[] = [0, 1, 2, 4, 6].map((back) => ({
    localDate: addDays(today, -back - 1),
    availableMinutes: 60,
    energy: 'medium',
    soreness: 'mild',
    equipment: ['bodyweight', 'gym'],
    safetyConcern: null,
    sleepHours: [7.5, 6.5, 7, 6, 7.5][back % 5]!,
    sleepQuality: 'fair',
    fatigue: null,
    stress: null,
    updatedAt: `${addDays(today, -back - 1)}T00:00:00.000Z`,
  }));

  const measurements: Measurement[] = [0, 2, 4, 6, 8].map((w, i) => ({
    id: id('m'),
    localDate: addDays(start, w * 7 > weeks * 7 - 1 ? weeks * 7 - 1 : w * 7),
    bodyweightKg: 74 + i * 0.3,
    waistCm: 81,
    note: '',
    createdAt: `${start}T00:00:00.000Z`,
  }));

  return {
    format: 'adaptfit-backup',
    version: 2,
    exportedAt: now.toISOString(),
    data: {
      profile,
      checkIns,
      sessions,
      programmes: [programme],
      customExercises: [],
      recommendations: [],
      weekPlans: [],
      measurements,
      reviewedWeeks: [],
      legacySessions: [],
    },
  };
}

/**
 * The same synthetic history as a version-3 (V0.3) backup, with a bodyweight
 * log and a completed AdaptFit Fuel profile. SYNTHETIC — tests and screenshots only.
 */
export function buildSeedBackupV3(now = new Date(), weeks = 8) {
  const v2 = buildSeedBackup(now, weeks);
  const iso = now.toISOString();
  const bodyweights = v2.data.measurements.map(bodyweightFromMeasurement).filter((b): b is NonNullable<typeof b> => b !== null);
  const nutrition: NutritionProfile = {
    ...emptyNutritionProfile(now),
    status: 'complete',
    step: 5,
    ageYears: 32,
    heightCm: 176,
    equationSex: 'male',
    activity: 'mostly-seated',
    goal: 'muscle-gain',
    target: { kcal: 2600, proteinG: [120, 150], carbsG: 320, fatG: 70, source: 'estimate', updatedAt: iso },
    habits: { source: 'mixed', cookedSlots: ['dinner'], mealsPerDay: 3, eatingTimes: '', budgetPerMealSgd: 8, cookingMinutes: 30, kitchen: ['Stove', 'Rice cooker'] },
    cuisines: ['malay', 'chinese', 'indian'],
    diet: ['halal'],
    allergens: [],
    intolerances: [],
    updatedAt: iso,
  };
  return {
    ...v2,
    version: 3,
    data: {
      ...v2.data,
      profile: { ...v2.data.profile, character: { ...DEFAULT_CHARACTER }, trainingPrefs: { ...EMPTY_TRAINING_PREFS } },
      programmes: v2.data.programmes.map(migrateProgramme),
      measurements: v2.data.measurements.map((m) => ({ ...m, bodyweightKg: null })),
      bodyweights,
      nutrition,
      mealPlans: [] as unknown[],
    },
  };
}
