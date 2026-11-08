import { applyChange, decide, type Decision, isProgrammeEdit } from '../domain/coach';
import { WorkoutError } from '../domain/workout';
import * as W from '../domain/workout';
import { applyNutritionChange } from '../domain/integration';
import type {
  BodyweightEntry,
  CheckIn,
  CoachRecommendation,
  CustomExercise,
  Measurement,
  MealPlan,
  NutritionProfile,
  Profile,
  Programme,
  WeekPlan,
  WorkoutSession,
} from '../domain/types';
import { getDb, personalTables } from './db';

/** A browser storage failure. The message is safe to show to users. */
export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageError';
  }
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function guard<T>(what: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof WorkoutError || err instanceof StorageError) throw err;
    throw new StorageError(`Couldn't ${what}. Your browser storage may be full or unavailable — please try again.`, { cause: err });
  }
}

// ── Profile & check-ins ────────────────────────────────────────────

export const getProfile = () => guard('load your profile', () => getDb().profile.get('me'));
export const saveProfile = (p: Profile) => guard('save your profile', async () => void (await getDb().profile.put(p)));
export const getCheckIn = (localDate: string) => guard('load your check-in', () => getDb().checkIns.get(localDate));
export const saveCheckIn = (c: CheckIn) => guard('save your check-in', async () => void (await getDb().checkIns.put(c)));
export const listCheckIns = () => guard('load check-ins', () => getDb().checkIns.orderBy('localDate').toArray());

// ── Sessions ───────────────────────────────────────────────────────

export const getActiveSession = () => guard('load your workout', () => getDb().sessions.where('state').equals('active').first());
export const getSession = (id: string) => guard('load the workout', () => getDb().sessions.get(id));
export const listAllSessions = () => guard('load your history', () => getDb().sessions.toArray());

/** Completed sessions, newest first. */
export function listCompletedSessions(): Promise<WorkoutSession[]> {
  return guard('load your history', async () => {
    const rows = await getDb().sessions.where('state').equals('completed').toArray();
    return rows.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '') || a.id.localeCompare(b.id));
  });
}

/**
 * Start a workout inside one read-write transaction so double taps or two tabs
 * can never create two active sessions: later callers get the existing one.
 */
export function startSession(build: () => WorkoutSession): Promise<{ session: WorkoutSession; created: boolean }> {
  return guard('start your workout', () => {
    const db = getDb();
    return db.transaction('rw', db.sessions, async () => {
      const existing = await db.sessions.where('state').equals('active').first();
      if (existing) return { session: existing, created: false };
      const session = build();
      await db.sessions.add(session);
      return { session, created: true };
    });
  });
}

/** Apply a pure transition to a session atomically and persist it. */
export function updateActiveSession(id: string, change: (s: WorkoutSession) => WorkoutSession): Promise<WorkoutSession> {
  return guard('save your workout', () => {
    const db = getDb();
    return db.transaction('rw', db.sessions, async () => {
      const current = await db.sessions.get(id);
      if (!current) throw new WorkoutError('not-active', 'This workout no longer exists.');
      const next = change(current);
      await db.sessions.put(next);
      return next;
    });
  });
}

/** Finish exactly once; repeated calls return the completed session. */
export function finishSession(id: string, now: Date, duration: W.DurationChoice, timeZone?: string): Promise<{ session: WorkoutSession; alreadyCompleted: boolean }> {
  return guard('finish your workout', () => {
    const db = getDb();
    return db.transaction('rw', db.sessions, async () => {
      const current = await db.sessions.get(id);
      if (!current) throw new WorkoutError('not-active', 'This workout no longer exists.');
      if (current.state === 'completed') return { session: current, alreadyCompleted: true };
      const next = W.finish(current, now, duration, timeZone);
      await db.sessions.put(next);
      return { session: next, alreadyCompleted: false };
    });
  });
}

export function discardSession(id: string, now: Date): Promise<WorkoutSession> {
  return guard('discard your workout', () => {
    const db = getDb();
    return db.transaction('rw', db.sessions, async () => {
      const current = await db.sessions.get(id);
      if (!current) throw new WorkoutError('not-active', 'This workout no longer exists.');
      if (current.state === 'discarded') return current;
      const next = W.discard(current, now);
      await db.sessions.put(next);
      return next;
    });
  });
}

/** Correct a completed session. Progress, PRs, XP, and achievements are derived, so they recalculate. */
export function correctSession(id: string, edit: W.HistoryEdit, now: Date): Promise<WorkoutSession> {
  return guard('save your correction', () => {
    const db = getDb();
    return db.transaction('rw', db.sessions, async () => {
      const current = await db.sessions.get(id);
      if (!current) throw new WorkoutError('not-completed', 'This workout no longer exists.');
      const next = W.editCompleted(current, edit, now);
      await db.sessions.put(next);
      return next;
    });
  });
}

/** Delete a completed or discarded session. Derived rewards reconcile automatically. */
export function deleteSession(id: string): Promise<void> {
  return guard('delete the workout', async () => {
    const db = getDb();
    await db.transaction('rw', db.sessions, async () => {
      const current = await db.sessions.get(id);
      if (current?.state === 'active') throw new WorkoutError('not-completed', 'Finish or discard an active workout instead of deleting it.');
      await db.sessions.delete(id);
    });
  });
}

/** Save imported sessions; rejects any whose import hash already exists. */
export function saveImportedSessions(sessions: WorkoutSession[]): Promise<{ saved: number; duplicates: number }> {
  return guard('save the imported workouts', () => {
    const db = getDb();
    return db.transaction('rw', db.sessions, async () => {
      let saved = 0;
      let duplicates = 0;
      for (const s of sessions) {
        if (s.importHash && (await db.sessions.where('importHash').equals(s.importHash).count()) > 0) {
          duplicates += 1;
          continue;
        }
        await db.sessions.add(s);
        saved += 1;
      }
      return { saved, duplicates };
    });
  });
}

// ── Programmes & exercises ─────────────────────────────────────────

export const listProgrammes = () => guard('load your programmes', () => getDb().programmes.toArray());

export function getActiveProgramme(): Promise<Programme | undefined> {
  return guard('load your programme', async () => (await getDb().programmes.toArray()).find((p) => p.isActive));
}

/** Save a programme; activating it deactivates the others in the same transaction. */
export function saveProgramme(p: Programme, opts: { activate?: boolean } = {}): Promise<void> {
  return guard('save your programme', async () => {
    const db = getDb();
    await db.transaction('rw', db.programmes, async () => {
      if (opts.activate) {
        const others = await db.programmes.toArray();
        for (const o of others) if (o.id !== p.id && o.isActive) await db.programmes.put({ ...o, isActive: false });
      }
      await db.programmes.put(opts.activate ? { ...p, isActive: true } : p);
    });
  });
}

export const deleteProgramme = (id: string) => guard('delete the programme', async () => void (await getDb().programmes.delete(id)));
export const listCustomExercises = () => guard('load your exercises', () => getDb().customExercises.toArray());
export const saveCustomExercise = (e: CustomExercise) => guard('save the exercise', async () => void (await getDb().customExercises.put(e)));

// ── Coaching ───────────────────────────────────────────────────────

export const listRecommendations = () => guard('load recommendations', async () => (await getDb().recommendations.toArray()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

/** Insert a recommendation unless one with the same dedupe key already exists. */
export function addRecommendation(rec: CoachRecommendation): Promise<CoachRecommendation> {
  return guard('save the recommendation', () => {
    const db = getDb();
    return db.transaction('rw', db.recommendations, async () => {
      const existing = await db.recommendations.where('dedupeKey').equals(rec.dedupeKey).first();
      if (existing) return existing;
      await db.recommendations.add(rec);
      return rec;
    });
  });
}

export const saveRecommendation = (rec: CoachRecommendation) => guard('save the recommendation', async () => void (await getDb().recommendations.put(rec)));

/**
 * Record the user's decision. Only an accepted recommendation with a concrete
 * programme change modifies the programme, in the same transaction.
 */
export function decideRecommendation(id: string, decision: Decision, now: Date, today: string): Promise<CoachRecommendation> {
  return guard('save your decision', () => {
    const db = getDb();
    return db.transaction('rw', [db.recommendations, db.programmes, db.nutrition], async () => {
      const rec = await db.recommendations.get(id);
      if (!rec) throw new StorageError('That recommendation no longer exists.');
      const next = decide(rec, decision, now, today);
      if (decision === 'accepted' && isProgrammeEdit(next.appliedChange)) {
        const programme = await db.programmes.get(next.appliedChange.programmeId);
        if (programme) await db.programmes.put(applyChange(programme, next.appliedChange, now));
      }
      if (decision === 'accepted' && next.appliedChange?.type === 'nutrition-target') {
        const nutrition = await db.nutrition.get('me');
        if (nutrition) await db.nutrition.put(applyNutritionChange(nutrition, next.appliedChange, now));
      }
      await db.recommendations.put(next);
      return next;
    });
  });
}

export const getWeekPlan = (weekStart: string) => guard('load the week plan', () => getDb().weekPlans.get(weekStart));
export const listWeekPlans = () => guard('load week plans', () => getDb().weekPlans.toArray());
export const saveWeekPlan = (w: WeekPlan) => guard('save the week plan', async () => void (await getDb().weekPlans.put(w)));

// ── Bodyweight (V0.3) ──────────────────────────────────────────────

export const listBodyweights = () => guard('load bodyweight entries', () => getDb().bodyweights.orderBy('localDate').toArray());
export const saveBodyweight = (b: BodyweightEntry) => guard('save the bodyweight entry', async () => void (await getDb().bodyweights.put(b)));
export const deleteBodyweight = (id: string) => guard('delete the bodyweight entry', async () => void (await getDb().bodyweights.delete(id)));

// ── AdaptFit Fuel (V0.3) ───────────────────────────────────────────

export const getNutrition = () => guard('load your nutrition settings', () => getDb().nutrition.get('me'));
export const saveNutrition = (n: NutritionProfile) => guard('save your nutrition settings', async () => void (await getDb().nutrition.put(n)));
export const getMealPlan = (localDate: string) => guard('load meal suggestions', () => getDb().mealPlans.get(localDate));
export const saveMealPlan = (m: MealPlan) => guard('save meal suggestions', async () => void (await getDb().mealPlans.put(m)));

// ── Measurements & meta ────────────────────────────────────────────

export const listMeasurements = () => guard('load measurements', () => getDb().measurements.orderBy('localDate').toArray());
export const saveMeasurement = (m: Measurement) => guard('save the measurement', async () => void (await getDb().measurements.put(m)));
export const deleteMeasurement = (id: string) => guard('delete the measurement', async () => void (await getDb().measurements.delete(id)));

export function getReviewedWeeks(): Promise<string[]> {
  return guard('load your reviews', async () => ((await getDb().meta.get('reviewedWeeks'))?.value as string[] | undefined) ?? []);
}

export function markWeekReviewed(weekStart: string): Promise<void> {
  return guard('save your review', async () => {
    const db = getDb();
    await db.transaction('rw', db.meta, async () => {
      const weeks = ((await db.meta.get('reviewedWeeks'))?.value as string[] | undefined) ?? [];
      if (!weeks.includes(weekStart)) await db.meta.put({ key: 'reviewedWeeks', value: [...weeks, weekStart] });
    });
  });
}

// ── Reset ──────────────────────────────────────────────────────────

/** Remove every personal record from this device. */
export function resetAllData(): Promise<void> {
  return guard('reset your data', async () => {
    const db = getDb();
    const tables = personalTables(db);
    await db.transaction('rw', tables, async () => {
      await Promise.all(tables.map((t) => t.clear()));
    });
  });
}
