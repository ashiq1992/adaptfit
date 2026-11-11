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
  TrainingWeek,
  WeekPlan,
  WorkoutImportRecord,
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

/** Save a workout logged in one go (already completed). */
export const saveLoggedSession = (s: WorkoutSession) => guard('save the workout', async () => void (await getDb().sessions.put(s)));

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

// ── Workout notes (V0.4) ───────────────────────────────────────────

/** Revisions kept per note for undo and recovery. */
export const MAX_NOTE_REVISIONS = 50;

/**
 * Save an edited note. The version being replaced is kept as a revision in
 * the same transaction, so every edit can be undone.
 */
export function saveNote(next: Programme, reason: string, now: Date, opts: { activate?: boolean; created?: CustomExercise[] } = {}): Promise<void> {
  return guard('save your note', async () => {
    const db = getDb();
    await db.transaction('rw', [db.programmes, db.noteRevisions, db.customExercises], async () => {
      const current = await db.programmes.get(next.id);
      if (current) {
        await db.noteRevisions.add({ id: newId(), programmeId: next.id, at: now.toISOString(), reason: reason.slice(0, 200), snapshot: current });
        const revs = await db.noteRevisions.where('programmeId').equals(next.id).sortBy('at');
        for (const r of revs.slice(0, Math.max(0, revs.length - MAX_NOTE_REVISIONS))) await db.noteRevisions.delete(r.id);
      }
      for (const c of opts.created ?? []) if (!(await db.customExercises.get(c.id))) await db.customExercises.add(c);
      if (opts.activate) {
        for (const o of await db.programmes.toArray()) if (o.id !== next.id && o.isActive) await db.programmes.put({ ...o, isActive: false });
      }
      await db.programmes.put({ ...next, isActive: opts.activate ? true : next.isActive, updatedAt: now.toISOString() });
    });
  });
}

/** Restore the most recent revision of a note. Returns the restored note, or null if there is nothing to undo. */
export function undoNote(programmeId: string): Promise<Programme | null> {
  return guard('undo your edit', async () => {
    const db = getDb();
    return db.transaction('rw', [db.programmes, db.noteRevisions], async () => {
      const revs = await db.noteRevisions.where('programmeId').equals(programmeId).sortBy('at');
      const last = revs[revs.length - 1];
      if (!last) return null;
      const current = await db.programmes.get(programmeId);
      // Undo restores content only; which note is active stays as it is.
      const restored = { ...last.snapshot, isActive: current?.isActive ?? last.snapshot.isActive };
      await db.programmes.put(restored);
      await db.noteRevisions.delete(last.id);
      return restored;
    });
  });
}

export const countNoteRevisions = (programmeId: string) => guard('load note history', () => getDb().noteRevisions.where('programmeId').equals(programmeId).count());

/** Delete a note. A final revision is kept (and exported in backups) so it can be recovered. */
export function deleteNote(id: string, now: Date): Promise<void> {
  return guard('delete the note', async () => {
    const db = getDb();
    await db.transaction('rw', [db.programmes, db.noteRevisions], async () => {
      const current = await db.programmes.get(id);
      if (!current) return;
      await db.noteRevisions.add({ id: newId(), programmeId: id, at: now.toISOString(), reason: 'Deleted', snapshot: current });
      await db.programmes.delete(id);
    });
  });
}

// ── Weekly updates (V0.4) ──────────────────────────────────────────

export const getTrainingWeek = (weekStart: string) => guard('load the week', () => getDb().trainingWeeks.get(weekStart));
export const listTrainingWeeks = () => guard('load your weeks', () => getDb().trainingWeeks.orderBy('weekStart').toArray());

/** Save a draft. A confirmed week is never overwritten by a draft save. */
export function saveWeekDraft(week: TrainingWeek): Promise<TrainingWeek> {
  return guard('save your draft', () => {
    const db = getDb();
    return db.transaction('rw', db.trainingWeeks, async () => {
      const current = await db.trainingWeeks.get(week.weekStart);
      if (current?.status === 'confirmed' && week.status === 'draft') throw new StorageError('This week is already confirmed. Edit it from Previous weeks.');
      await db.trainingWeeks.put(week);
      return week;
    });
  });
}

/** In-progress edits to an already confirmed week are kept apart until re-confirmed. */
export const saveWeekEdit = (week: TrainingWeek) => guard('save your changes', async () => void (await getDb().meta.put({ key: `week-edit:${week.weekStart}`, value: week })));
export const getWeekEdit = (weekStart: string) => guard('load your changes', async () => ((await getDb().meta.get(`week-edit:${weekStart}`))?.value as TrainingWeek | undefined) ?? null);
export const clearWeekEdit = (weekStart: string) => guard('clear your changes', async () => void (await getDb().meta.delete(`week-edit:${weekStart}`)));

/**
 * Confirm a week: write its workout records, remove generated ones that no
 * longer apply, store the week, and optionally update the note's reference
 * weights — all in one transaction.
 */
export function confirmWeek(week: TrainingWeek, upserts: readonly WorkoutSession[], removeIds: readonly string[], programmeUpdate: Programme | null, now: Date = new Date()): Promise<void> {
  return guard('confirm your week', async () => {
    const db = getDb();
    await db.transaction('rw', [db.trainingWeeks, db.sessions, db.programmes, db.noteRevisions, db.meta], async () => {
      for (const id of removeIds) {
        const s = await db.sessions.get(id);
        if (s && s.source === 'weekly') await db.sessions.delete(id);
      }
      for (const s of upserts) await db.sessions.put(s);
      await db.trainingWeeks.put(week);
      await db.meta.delete(`week-edit:${week.weekStart}`);
      if (programmeUpdate) {
        const current = await db.programmes.get(programmeUpdate.id);
        if (current) await db.noteRevisions.add({ id: newId(), programmeId: current.id, at: now.toISOString(), reason: `Weights from the week of ${week.weekStart}`, snapshot: current });
        await db.programmes.put(programmeUpdate);
      }
    });
  });
}

export function setReviewDismissed(weekStart: string, dismissed: boolean): Promise<void> {
  return guard('save your review', async () => {
    const db = getDb();
    await db.transaction('rw', db.trainingWeeks, async () => {
      const w = await db.trainingWeeks.get(weekStart);
      if (w) await db.trainingWeeks.put({ ...w, reviewDismissed: dismissed });
    });
  });
}

/** Discard an unconfirmed draft (confirmed weeks are never deleted here). */
export function discardWeekDraft(weekStart: string): Promise<void> {
  return guard('discard the draft', async () => {
    const db = getDb();
    await db.transaction('rw', db.trainingWeeks, async () => {
      const w = await db.trainingWeeks.get(weekStart);
      if (w?.status === 'draft') await db.trainingWeeks.delete(weekStart);
    });
  });
}

// ── Note imports (V0.4) ────────────────────────────────────────────

export const findImportByHash = (hash: string) => guard('check for duplicates', () => getDb().imports.where('hash').equals(hash).first());
export const listImports = () => guard('load imports', () => getDb().imports.toArray());

/** Record an import and what it created in one transaction, rejecting an identical earlier import. */
export function saveImportRecord(record: WorkoutImportRecord, write: () => Promise<void>): Promise<{ saved: boolean }> {
  return guard('save the import', async () => {
    const db = getDb();
    return db.transaction('rw', [db.imports, db.programmes, db.sessions, db.customExercises, db.trainingWeeks, db.noteRevisions], async () => {
      const dup = await db.imports.where('hash').equals(record.hash).first();
      if (dup) return { saved: false };
      await write();
      await db.imports.add(record);
      return { saved: true };
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
