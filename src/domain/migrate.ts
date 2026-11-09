import { EXERCISES_BY_ID } from '../content/exercises';
import { LB_PER_KG } from './loads';
import type { LegacyCheckIn, LegacyProfile, LegacySessionV2 } from './legacy';
import {
  type BodyweightEntry,
  type CheckIn,
  DEFAULT_CHARACTER,
  DEFAULT_NOTIFICATIONS,
  EMPTY_LIFESTYLE,
  EMPTY_TRAINING_PREFS,
  type LoadType,
  type Measurement,
  type Profile,
  type Programme,
  type SessionExercise,
  type WeightUnit,
  type WorkoutSession,
} from './types';

/**
 * Pure V0.1 → V0.2 conversions used by the database upgrade (v2 → v3) and by
 * restoring version-1 backups. They add fields; they never drop recorded work.
 */

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function migrateProfile(p: LegacyProfile | Profile): Profile {
  const v3 = p as Partial<Profile>;
  return {
    ...(p as Profile),
    timezone: v3.timezone ?? deviceTimeZone(),
    gamification: v3.gamification ?? true,
    lifestyle: v3.lifestyle ?? structuredClone(EMPTY_LIFESTYLE),
    character: v3.character ?? structuredClone(DEFAULT_CHARACTER),
    trainingPrefs: v3.trainingPrefs ?? structuredClone(EMPTY_TRAINING_PREFS),
    loggingMode: v3.loggingMode ?? 'weekly',
    notifications: v3.notifications ?? { ...DEFAULT_NOTIFICATIONS },
  };
}

/**
 * V0.2 → V0.4 programme: adds the optional planned load and template link
 * (V0.3) and the note fields (V0.4). Nothing is removed or reinterpreted.
 */
export function migrateProgramme(p: Programme): Programme {
  const raw = p as Partial<Programme>;
  return {
    ...p,
    templateId: raw.templateId ?? null,
    notes: raw.notes ?? '',
    days: p.days.map((d) => ({
      ...d,
      notes: (d as Partial<typeof d>).notes ?? '',
      exercises: d.exercises.map((e) => {
        const x = e as Partial<typeof e>;
        return { ...e, plannedLoad: x.plannedLoad ?? null, uncertain: x.uncertain ?? [] };
      }),
    })),
  };
}

/**
 * V0.2 stored bodyweight inside measurements (always kg). V0.3 keeps a
 * separate bodyweight log; the value is copied exactly, in kg, so nothing is
 * re-rounded. The measurement keeps its waist value (if any).
 */
export function bodyweightFromMeasurement(m: Measurement): BodyweightEntry | null {
  if (m.bodyweightKg === null) return null;
  return { id: `bw-${m.id}`, localDate: m.localDate, value: m.bodyweightKg, unit: 'kg', note: m.note, createdAt: m.createdAt, updatedAt: m.createdAt };
}

export function migrateCheckIn(c: LegacyCheckIn | CheckIn): CheckIn {
  const v3 = c as Partial<CheckIn>;
  return {
    ...(c as CheckIn),
    sleepHours: v3.sleepHours ?? null,
    sleepQuality: v3.sleepQuality ?? null,
    fatigue: v3.fatigue ?? null,
    stress: v3.stress ?? null,
  };
}

export function isV3Session(s: unknown): s is WorkoutSession {
  return typeof s === 'object' && s !== null && (s as { schemaVersion?: unknown }).schemaVersion === 3;
}

/**
 * Convert a V0.1 session. V0.1 recorded a load value without saying how it was
 * loaded, so loaded exercises become `unspecified` (only compared with other
 * unspecified records of the same exercise). V0.1 sets were explicitly logged,
 * so they are kept as completed. V0.1 start→finish time measured data entry,
 * not training, so it is not presented as a workout duration.
 */
export function migrateSession(legacy: LegacySessionV2, fallbackUnit: WeightUnit = 'kg'): WorkoutSession {
  const exercises: SessionExercise[] = legacy.plan.items.map((item) => {
    const sets = legacy.sets.filter((s) => s.itemKey === item.key);
    const loadType: LoadType = item.mode === 'timed' ? 'timed' : item.loadable ? 'unspecified' : 'bodyweight';
    const unit: WeightUnit = sets.find((s) => s.load)?.load?.unit ?? fallbackUnit;
    return {
      key: item.key,
      exerciseId: item.exerciseId,
      name: sets[0]?.exerciseName ?? item.name,
      loadType,
      unit,
      tags: [...(item.tags.length ? item.tags : (EXERCISES_BY_ID.get(item.exerciseId)?.tags ?? ['strength']))],
      priority: false,
      target: { sets: item.sets, repMin: item.reps, repMax: item.reps, durationSec: item.durationSec, restSec: item.restSec },
      skipped: false,
      notes: '',
      sets: sets.map((s) => {
        let load: number | null = null;
        if (s.load && loadType !== 'bodyweight' && loadType !== 'timed') {
          load = s.load.unit === unit ? s.load.value : Math.round((s.load.unit === 'lb' ? s.load.value / LB_PER_KG : s.load.value * LB_PER_KG) * 100) / 100;
        }
        return {
          id: s.id,
          load,
          reps: loadType === 'timed' ? null : s.reps,
          durationSec: loadType === 'timed' ? (s.durationSec ?? null) : null,
          rir: null,
          completed: true,
          completedAt: s.loggedAt,
          prefill: 'none' as const,
        };
      }),
    };
  });
  return {
    id: legacy.id,
    schemaVersion: 3,
    state: legacy.state,
    source: 'legacy',
    name: legacy.plan.name,
    programmeId: null,
    dayId: null,
    planKind: 'legacy',
    emphasis: legacy.plan.emphasis,
    checkIn: legacy.checkIn ? migrateCheckIn(legacy.checkIn) : null,
    exercises,
    position: Math.min(legacy.position, Math.max(0, exercises.length - 1)),
    startedAt: legacy.startedAt,
    updatedAt: legacy.updatedAt,
    completedAt: legacy.completedAt,
    completedLocalDate: legacy.completedLocalDate,
    discardedAt: legacy.discardedAt,
    pausedAt: null,
    pausedMs: 0,
    durationSource: legacy.state === 'active' ? 'timer' : 'legacy-entry-time',
    durationSec: null,
    restStartedAt: legacy.restStartedAt ?? null,
    restDurationSec: legacy.restDurationSec ?? null,
    substitutions: legacy.substitutions ?? [],
    importHash: null,
    editedAt: null,
  };
}

/** Migrate any stored session record (already-V3 records pass through). */
export function toV3Session(record: unknown, fallbackUnit: WeightUnit = 'kg'): WorkoutSession {
  return isV3Session(record) ? record : migrateSession(record as LegacySessionV2, fallbackUnit);
}
