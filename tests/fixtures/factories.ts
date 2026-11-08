/**
 * SYNTHETIC TEST FIXTURES — not real user data. Every value here is invented
 * for automated tests and must never be mixed into a user's database.
 */
import { createDb, setDb, type AdaptFitDB } from '../../src/data/db';
import { addDays } from '../../src/domain/dates';
import type { LegacySessionV2 } from '../../src/domain/legacy';
import { programmeExercise, starterUpperLower } from '../../src/domain/programme';
import { emptyNutritionProfile } from '../../src/domain/nutrition';
import {
  type BodyweightEntry,
  type CheckIn,
  DEFAULT_CHARACTER,
  EMPTY_LIFESTYLE,
  EMPTY_TRAINING_PREFS,
  type LoadType,
  type NutritionProfile,
  type Profile,
  type Programme,
  type SessionExercise,
  type WeightUnit,
  type WorkoutSession,
} from '../../src/domain/types';

export const T0 = new Date('2026-03-10T15:00:00.000Z');
export const TODAY = '2026-03-10';

let counter = 0;
export function seqId(prefix = 'id'): string {
  counter += 1;
  return `${prefix}-${counter}`;
}
export const newIdFn = () => seqId('gen');

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'me',
    goal: 'general',
    experience: 'beginner',
    equipment: ['bodyweight'],
    preferredMinutes: 20,
    weightUnit: 'kg',
    timezone: 'UTC',
    gamification: true,
    lifestyle: structuredClone(EMPTY_LIFESTYLE),
    character: structuredClone(DEFAULT_CHARACTER),
    trainingPrefs: structuredClone(EMPTY_TRAINING_PREFS),
    createdAt: T0.toISOString(),
    updatedAt: T0.toISOString(),
    ...overrides,
  };
}

/** Synthetic experienced hypertrophy lifter, Singapore. */
export const hypertrophyProfile = () =>
  makeProfile({ goal: 'hypertrophy', experience: 'intermediate', equipment: ['bodyweight', 'gym'], preferredMinutes: 60, timezone: 'Asia/Singapore' });

/** Synthetic beginner. */
export const beginnerProfile = () => makeProfile({ goal: 'general', experience: 'beginner' });

export function makeCheckIn(overrides: Partial<CheckIn> = {}): CheckIn {
  return {
    localDate: TODAY,
    availableMinutes: 20,
    energy: 'medium',
    soreness: 'none',
    equipment: ['bodyweight'],
    safetyConcern: null,
    sleepHours: null,
    sleepQuality: null,
    fatigue: null,
    stress: null,
    updatedAt: T0.toISOString(),
    ...overrides,
  };
}

/** Synthetic four-day upper/lower programme. */
export function fourDayProgramme(): Programme {
  return starterUpperLower(() => seqId('p'), new Date('2026-01-01T00:00:00Z'));
}

/** Synthetic two-day programme. */
export function twoDayProgramme(): Programme {
  const p = fourDayProgramme();
  return { ...p, name: 'Two-day (synthetic)', days: p.days.slice(0, 2), daysPerWeek: 2 };
}

export interface SetSpec {
  load: number | null;
  reps: number;
  rir?: number | null;
}

export function sessionExercise(args: { exerciseId: string; name?: string; loadType: LoadType; unit?: WeightUnit; sets: SetSpec[]; targetSets?: number; key?: string; tags?: SessionExercise['tags']; completedAt?: string }): SessionExercise {
  return {
    key: args.key ?? `k-${args.exerciseId}`,
    exerciseId: args.exerciseId,
    name: args.name ?? args.exerciseId,
    loadType: args.loadType,
    unit: args.unit ?? 'kg',
    tags: args.tags ?? ['strength'],
    priority: false,
    target: { sets: args.targetSets ?? args.sets.length, repMin: 6, repMax: 10, durationSec: null, restSec: 90 },
    skipped: false,
    notes: '',
    sets: args.sets.map((s) => ({
      id: seqId('set'),
      load: s.load,
      reps: s.reps,
      durationSec: null,
      rir: s.rir ?? null,
      completed: true,
      completedAt: args.completedAt ?? T0.toISOString(),
      prefill: 'none' as const,
    })),
  };
}

export function completedSession(args: { id?: string; date: string; exercises: SessionExercise[]; name?: string; source?: WorkoutSession['source']; programmeId?: string | null; dayId?: string | null; durationSec?: number | null }): WorkoutSession {
  const completedAt = `${args.date}T10:00:00.000Z`;
  return {
    id: args.id ?? seqId('session'),
    schemaVersion: 3,
    state: 'completed',
    source: args.source ?? 'programme',
    name: args.name ?? 'Upper Body A',
    programmeId: args.programmeId ?? null,
    dayId: args.dayId ?? null,
    planKind: 'programme-day',
    emphasis: null,
    checkIn: null,
    exercises: args.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, completedAt })) })),
    position: 0,
    startedAt: `${args.date}T09:00:00.000Z`,
    updatedAt: completedAt,
    completedAt,
    completedLocalDate: args.date,
    discardedAt: null,
    pausedAt: null,
    pausedMs: 0,
    durationSource: args.durationSec === undefined ? 'timer' : args.durationSec === null ? 'not-recorded' : 'timer',
    durationSec: args.durationSec === undefined ? 3600 : args.durationSec,
    restStartedAt: null,
    restDurationSec: null,
    substitutions: [],
    importHash: null,
    editedAt: null,
  };
}

export const bench = (sets: SetSpec[], extra: Partial<Parameters<typeof sessionExercise>[0]> = {}) =>
  sessionExercise({ exerciseId: 'smith-bench-press', name: 'Smith machine bench press', loadType: 'per-side', sets, ...extra });

/** Synthetic: bench 30 kg/side × 8,8,8 every 7 days — no change. */
export function stableBench(count: number, endDate: string = TODAY, every = 7): WorkoutSession[] {
  return Array.from({ length: count }, (_, i) =>
    completedSession({ date: addDays(endDate, -every * (count - 1 - i)), exercises: [bench([{ load: 30, reps: 8 }, { load: 30, reps: 8 }, { load: 30, reps: 8 }])] }),
  );
}

/** Synthetic: bench gains one rep per session. */
export function improvingBench(count: number, endDate: string = TODAY, every = 7): WorkoutSession[] {
  return Array.from({ length: count }, (_, i) =>
    completedSession({ date: addDays(endDate, -every * (count - 1 - i)), exercises: [bench([{ load: 30, reps: 6 + i }, { load: 30, reps: 6 + i }])] }),
  );
}

/** Synthetic: short sleep for the last week. */
export function reducedSleepCheckIns(endDate: string = TODAY): CheckIn[] {
  return Array.from({ length: 5 }, (_, i) => makeCheckIn({ localDate: addDays(endDate, -i), sleepHours: 5.5, sleepQuality: 'poor', fatigue: 'high' }));
}

/** Synthetic: corrupted backup text (truncated JSON). */
export const CORRUPTED_BACKUP = '{"format":"adaptfit-backup","version":2,"exportedAt":"2026-03-10T00:00:00Z","data":{"profile":';

export const pe = (exerciseId: string, extra: Omit<Parameters<typeof programmeExercise>[1], 'exerciseId'> = {}) =>
  programmeExercise(() => seqId('pe'), { exerciseId, ...extra });

/** Fresh isolated IndexedDB (fake-indexeddb) for each test. */
export function useFreshDb(): AdaptFitDB {
  const db = createDb(`adaptfit-test-${Math.random().toString(36).slice(2)}`);
  setDb(db);
  return db;
}

/** Synthetic V0.1 session (database v2 / backup v1 shape). */
export function legacySession(): LegacySessionV2 {
  const item = { key: 'tpl:0', exerciseId: 'goblet-squat', name: 'Goblet squat', mode: 'reps' as const, tags: ['strength' as const], loadable: true, equipment: ['dumbbells' as const], sets: 3, reps: 10, durationSec: null, restSec: 60, cue: '', substitutedFrom: null };
  const plank = { ...item, key: 'tpl:1', exerciseId: 'plank', name: 'Plank', mode: 'timed' as const, loadable: false, equipment: [], reps: null, durationSec: 30 };
  const plan = { templateId: 'tpl', name: 'Quick dumbbell strength', emphasis: 'full' as const, intensity: 'moderate' as const, warmupSec: 60, estimatedMinutes: 12, equipment: ['dumbbells' as const], optionalEquipment: [], items: [item, plank] };
  return {
    id: 'legacy-1',
    state: 'completed',
    startedAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-01T10:01:00.000Z',
    completedAt: '2026-02-01T10:01:00.000Z',
    completedLocalDate: '2026-02-01',
    discardedAt: null,
    checkIn: { localDate: '2026-02-01', availableMinutes: 20, energy: 'medium', soreness: 'none', equipment: ['bodyweight', 'dumbbells'], safetyConcern: null, updatedAt: '2026-02-01T09:59:00.000Z' },
    recommendedPlan: plan,
    plan,
    substitutions: [],
    sets: [
      { id: 'ls1', itemKey: 'tpl:0', exerciseId: 'goblet-squat', exerciseName: 'Goblet squat', tags: ['strength'], reps: 10, durationSec: null, load: { value: 30, unit: 'kg' }, loggedAt: '2026-02-01T10:00:20.000Z', updatedAt: '2026-02-01T10:00:20.000Z' },
      { id: 'ls2', itemKey: 'tpl:1', exerciseId: 'plank', exerciseName: 'Plank', tags: ['strength'], reps: null, durationSec: 30, load: null, loggedAt: '2026-02-01T10:00:40.000Z', updatedAt: '2026-02-01T10:00:40.000Z' },
    ],
    position: 1,
    restStartedAt: null,
    restDurationSec: null,
  };
}


// ── V0.3 synthetic fixtures ─────────────────────────────────────────

/** Synthetic bodyweight entry (value as entered, in its own unit). */
export function bodyweightEntry(localDate: string, value: number, unit: WeightUnit = 'kg', note = ''): BodyweightEntry {
  return { id: seqId('bw'), localDate, value, unit, note, createdAt: `${localDate}T07:00:00.000Z`, updatedAt: `${localDate}T07:00:00.000Z` };
}

/** Synthetic weekly weigh-ins: one per week, ending on `endDate`, changing by `perWeek`. */
export function weeklyBodyweights(weeks: number, start: number, perWeek: number, endDate: string = TODAY): BodyweightEntry[] {
  return Array.from({ length: weeks }, (_, i) => bodyweightEntry(addDays(endDate, -7 * (weeks - 1 - i)), Math.round((start + perWeek * i) * 10) / 10));
}

/** Synthetic completed AdaptFit Fuel profile (adult, no safety flags). */
export function nutritionProfile(overrides: Partial<NutritionProfile> = {}): NutritionProfile {
  return {
    ...emptyNutritionProfile(T0),
    status: 'complete',
    ageYears: 30,
    heightCm: 175,
    equationSex: 'male',
    activity: 'mostly-seated',
    goal: 'muscle-gain',
    habits: { source: 'mixed', cookedSlots: ['dinner'], mealsPerDay: 3, eatingTimes: '', budgetPerMealSgd: null, cookingMinutes: null, kitchen: [] },
    target: { kcal: 2500, proteinG: [120, 150], carbsG: 300, fatG: 70, source: 'estimate', updatedAt: T0.toISOString() },
    ...overrides,
  };
}
