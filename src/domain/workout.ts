import { EXERCISES_BY_ID } from '../content/exercises';
import { localDateOf } from './dates';
import { comparableKey, convertLoad, usesLoad, usesPlannedLoad } from './loads';
import { MAX_DURATION_SEC, MAX_LOAD, MAX_REPS } from './logging';
import type {
  CheckIn,
  ExerciseTag,
  LoadType,
  Plan,
  PlannedLoad,
  Programme,
  ProgrammeDay,
  SessionExercise,
  SessionSet,
  WeightUnit,
  WorkoutSession,
} from './types';

type IdFn = () => string;

export class WorkoutError extends Error {
  constructor(
    public readonly code: 'not-active' | 'not-completed' | 'no-valid-work' | 'unknown-exercise' | 'unknown-set' | 'invalid-set' | 'last-set',
    message: string,
  ) {
    super(message);
    this.name = 'WorkoutError';
  }
}

// ── Validity ───────────────────────────────────────────────────────

const posInt = (n: number | null, max: number) => n !== null && Number.isSafeInteger(n) && n >= 1 && n <= max;

/** Values are well-formed for the exercise's loading convention (independent of completion). */
export function setValuesValid(set: Pick<SessionSet, 'load' | 'reps' | 'durationSec' | 'rir'>, loadType: LoadType): boolean {
  const measureOk = loadType === 'timed' ? posInt(set.durationSec, MAX_DURATION_SEC) : posInt(set.reps, MAX_REPS);
  const loadOk = !usesLoad(loadType)
    ? set.load === null
    : set.load === null || (Number.isFinite(set.load) && set.load >= 0 && set.load <= MAX_LOAD);
  const rirOk = set.rir === null || (Number.isInteger(set.rir) && set.rir >= 0 && set.rir <= 10);
  return measureOk && loadOk && rirOk;
}

/** A set counts as performed work only when explicitly completed and valid. */
export function isCompletedSet(set: SessionSet, loadType: LoadType): boolean {
  return set.completed && setValuesValid(set, loadType);
}

/** Completed sets count even if the rest of the exercise was skipped. */
export function completedSets(ex: SessionExercise): SessionSet[] {
  return ex.sets.filter((s) => isCompletedSet(s, ex.loadType));
}

export function completedSetCount(session: Pick<WorkoutSession, 'exercises'>): number {
  return session.exercises.reduce((n, e) => n + completedSets(e).length, 0);
}

export function plannedSetCount(session: Pick<WorkoutSession, 'exercises'>): number {
  return session.exercises.reduce((n, e) => n + e.target.sets, 0);
}

/** Exercises with at least one completed set. */
export function completedExerciseCount(session: Pick<WorkoutSession, 'exercises'>): number {
  return session.exercises.filter((e) => completedSets(e).length > 0).length;
}

export function isIncomplete(session: Pick<WorkoutSession, 'exercises'>): boolean {
  return session.exercises.some((e) => !e.skipped && completedSets(e).length < e.target.sets) || session.exercises.some((e) => e.skipped);
}

// ── Prefill from history ──────────────────────────────────────────

export interface PreviousPerformance {
  sessionId: string;
  completedAt: string;
  localDate: string | null;
  unit: WeightUnit;
  sets: SessionSet[];
}

/**
 * Most recent completed session (before `beforeIso`) containing completed sets
 * for the same exercise recorded with the same loading convention.
 */
export function previousPerformance(
  history: readonly WorkoutSession[],
  exerciseId: string,
  loadType: LoadType,
  opts: { beforeIso?: string; excludeSessionId?: string } = {},
): PreviousPerformance | null {
  const key = comparableKey(exerciseId, loadType);
  let best: PreviousPerformance | null = null;
  for (const s of history) {
    if (s.state !== 'completed' || !s.completedAt || s.id === opts.excludeSessionId) continue;
    if (opts.beforeIso && s.completedAt >= opts.beforeIso) continue;
    for (const ex of s.exercises) {
      if (comparableKey(ex.exerciseId, ex.loadType) !== key) continue;
      const sets = completedSets(ex);
      if (sets.length === 0) continue;
      if (!best || s.completedAt > best.completedAt) best = { sessionId: s.id, completedAt: s.completedAt, localDate: s.completedLocalDate, unit: ex.unit, sets };
    }
  }
  return best;
}

export interface TargetSuggestion {
  kind: 'add-rep' | 'consider-load' | 'repeat' | 'none';
  text: string;
  reps: number | null;
  load: number | null;
}

/**
 * Suggested target, shown only when justified by the previous session.
 * Never changes prefilled values and never raises load automatically.
 */
export function suggestTarget(target: SessionExercise['target'], prev: PreviousPerformance | null, loadType: LoadType): TargetSuggestion {
  if (!prev || loadType === 'timed' || target.repMax === null) return { kind: 'none', text: '', reps: null, load: null };
  const top = prev.sets[0]!;
  const allAtTop = prev.sets.length >= target.sets && prev.sets.every((s) => (s.reps ?? 0) >= target.repMax!);
  if (allAtTop) {
    return { kind: 'consider-load', text: `All sets reached ${target.repMax} reps last time — consider a small load increase if technique allows.`, reps: target.repMax, load: top.load };
  }
  const bestReps = Math.max(...prev.sets.map((s) => s.reps ?? 0));
  if (bestReps > 0 && bestReps < target.repMax) {
    return { kind: 'add-rep', text: `Aim for ${bestReps + 1} reps if technique and effort allow.`, reps: bestReps + 1, load: top.load };
  }
  return { kind: 'repeat', text: 'Match last session before progressing.', reps: bestReps || null, load: top.load };
}

function emptySet(newId: IdFn, values: Partial<SessionSet>): SessionSet {
  return { id: newId(), load: null, reps: null, durationSec: null, rir: null, completed: false, completedAt: null, prefill: 'none', ...values };
}

/**
 * Build session sets. Order of precedence for values:
 * 1. the previous comparable completed session;
 * 2. the programme's planned starting load (with target reps);
 * 3. blank load with target reps.
 * Prefilled sets are never completed — the user confirms each one.
 */
export function prefillSets(
  newId: IdFn,
  target: SessionExercise['target'],
  loadType: LoadType,
  unit: WeightUnit,
  prev: PreviousPerformance | null,
  planned: PlannedLoad | null = null,
): SessionSet[] {
  return Array.from({ length: target.sets }, (_, i) => {
    const p = prev ? (prev.sets[i] ?? prev.sets[prev.sets.length - 1]) : undefined;
    if (p && prev!.unit === unit) {
      return emptySet(newId, { load: usesLoad(loadType) ? p.load : null, reps: p.reps, durationSec: p.durationSec, prefill: 'previous' });
    }
    if (p) {
      // Unit changed since last time: keep reps, leave load for the user rather than converting silently.
      return emptySet(newId, { reps: p.reps, durationSec: p.durationSec, prefill: 'previous' });
    }
    const targetReps = loadType === 'timed' ? null : (target.repMin ?? target.repMax);
    if (planned && usesPlannedLoad(loadType)) {
      return emptySet(newId, { load: convertLoad(planned.value, planned.unit, unit), reps: targetReps, prefill: 'planned' });
    }
    return emptySet(newId, {
      reps: targetReps,
      durationSec: loadType === 'timed' ? target.durationSec : null,
      prefill: 'target',
    });
  });
}

function tagsFor(exerciseId: string): ExerciseTag[] {
  return [...(EXERCISES_BY_ID.get(exerciseId)?.tags ?? ['strength'])];
}

export function exercisesFromDay(newId: IdFn, day: ProgrammeDay, history: readonly WorkoutSession[], unit: WeightUnit): SessionExercise[] {
  return day.exercises.map((pe, i) => {
    const target = { sets: pe.sets, repMin: pe.repMin, repMax: pe.repMax, durationSec: pe.durationSec, restSec: pe.restSec };
    const prev = previousPerformance(history, pe.exerciseId, pe.loadType);
    return {
      key: `${day.id}:${i}:${pe.id}`,
      exerciseId: pe.exerciseId,
      name: pe.name,
      loadType: pe.loadType,
      unit,
      tags: tagsFor(pe.exerciseId),
      priority: pe.priority,
      target,
      skipped: false,
      notes: pe.notes,
      sets: prefillSets(newId, target, pe.loadType, unit, prev, pe.plannedLoad ?? null),
    };
  });
}

/** Convert a quick-workout plan (V0.1 rules engine) into session exercises. */
export function exercisesFromPlan(newId: IdFn, plan: Plan, history: readonly WorkoutSession[], unit: WeightUnit): SessionExercise[] {
  return plan.items.map((item) => {
    const lib = EXERCISES_BY_ID.get(item.exerciseId);
    const loadType: LoadType = item.mode === 'timed' ? 'timed' : (lib?.loadType ?? (item.loadable ? 'total' : 'bodyweight'));
    const target = { sets: item.sets, repMin: item.reps, repMax: item.reps, durationSec: item.durationSec, restSec: item.restSec };
    const prev = previousPerformance(history, item.exerciseId, loadType);
    return {
      key: item.key,
      exerciseId: item.exerciseId,
      name: item.name,
      loadType,
      unit,
      tags: [...item.tags],
      priority: false,
      target,
      skipped: false,
      notes: '',
      sets: prefillSets(newId, target, loadType, unit, prev),
    };
  });
}

function baseSession(args: { id: string; now: Date; checkIn: CheckIn | null }): Omit<WorkoutSession, 'source' | 'name' | 'programmeId' | 'dayId' | 'planKind' | 'emphasis' | 'exercises'> {
  const iso = args.now.toISOString();
  return {
    id: args.id,
    schemaVersion: 3,
    state: 'active',
    checkIn: args.checkIn ? structuredClone(args.checkIn) : null,
    position: 0,
    startedAt: iso,
    updatedAt: iso,
    completedAt: null,
    completedLocalDate: null,
    discardedAt: null,
    pausedAt: null,
    pausedMs: 0,
    durationSource: 'timer',
    durationSec: null,
    restStartedAt: null,
    restDurationSec: null,
    substitutions: [],
    importHash: null,
    editedAt: null,
  };
}

export function sessionFromDay(args: {
  id: string;
  now: Date;
  newId: IdFn;
  programme: Programme;
  day: ProgrammeDay;
  planKind?: WorkoutSession['planKind'];
  history: readonly WorkoutSession[];
  unit: WeightUnit;
  checkIn: CheckIn | null;
}): WorkoutSession {
  return {
    ...baseSession(args),
    source: 'programme',
    name: args.day.name,
    programmeId: args.programme.id,
    dayId: args.day.id,
    planKind: args.planKind ?? 'programme-day',
    emphasis: null,
    exercises: exercisesFromDay(args.newId, args.day, args.history, args.unit),
  };
}

export function sessionFromPlan(args: { id: string; now: Date; newId: IdFn; plan: Plan; history: readonly WorkoutSession[]; unit: WeightUnit; checkIn: CheckIn | null }): WorkoutSession {
  return {
    ...baseSession(args),
    source: 'quick',
    name: args.plan.name,
    programmeId: null,
    dayId: null,
    planKind: 'quick',
    emphasis: args.plan.emphasis,
    exercises: exercisesFromPlan(args.newId, args.plan, args.history, args.unit),
  };
}

// ── Transitions (pure; every function returns a new session) ──────

function requireActive(s: WorkoutSession) {
  if (s.state !== 'active') throw new WorkoutError('not-active', 'This workout is no longer active.');
}

function mapExercise(s: WorkoutSession, key: string, fn: (e: SessionExercise) => SessionExercise, now: Date): WorkoutSession {
  if (!s.exercises.some((e) => e.key === key)) throw new WorkoutError('unknown-exercise', 'That exercise is not in this workout.');
  return { ...s, exercises: s.exercises.map((e) => (e.key === key ? fn(e) : e)), updatedAt: now.toISOString() };
}

function mapSet(e: SessionExercise, setId: string, fn: (set: SessionSet) => SessionSet): SessionExercise {
  if (!e.sets.some((x) => x.id === setId)) throw new WorkoutError('unknown-set', 'That set no longer exists.');
  return { ...e, sets: e.sets.map((x) => (x.id === setId ? fn(x) : x)) };
}

export type SetPatch = Partial<Pick<SessionSet, 'load' | 'reps' | 'durationSec' | 'rir'>>;

/** Edit a set's values. A completed set stays completed only if its new values are valid. */
export function updateSetValues(s: WorkoutSession, key: string, setId: string, patch: SetPatch, now: Date): WorkoutSession {
  requireActive(s);
  return mapExercise(
    s,
    key,
    (e) =>
      mapSet(e, setId, (set) => {
        const next = { ...set, ...patch };
        if (next.completed && !setValuesValid(next, e.loadType)) throw new WorkoutError('invalid-set', 'That value is not valid.');
        return next;
      }),
    now,
  );
}

/** Explicitly confirm a set (one tap for unchanged prefilled values). Starts the rest timer. */
export function completeSet(s: WorkoutSession, key: string, setId: string, now: Date): WorkoutSession {
  requireActive(s);
  const ex = s.exercises.find((e) => e.key === key);
  const set = ex?.sets.find((x) => x.id === setId);
  if (!ex || !set) throw new WorkoutError('unknown-set', 'That set no longer exists.');
  if (!setValuesValid(set, ex.loadType)) throw new WorkoutError('invalid-set', 'Enter valid values before completing the set.');
  const iso = now.toISOString();
  const next = mapExercise(s, key, (e) => mapSet({ ...e, skipped: false }, setId, (x) => ({ ...x, completed: true, completedAt: iso })), now);
  return ex.target.restSec > 0 ? { ...next, restStartedAt: iso, restDurationSec: ex.target.restSec } : next;
}

export function uncompleteSet(s: WorkoutSession, key: string, setId: string, now: Date): WorkoutSession {
  requireActive(s);
  return mapExercise(s, key, (e) => mapSet(e, setId, (x) => ({ ...x, completed: false, completedAt: null })), now);
}

/** Add a set, copying the last set's values (not completed). */
export function addSet(s: WorkoutSession, key: string, newId: IdFn, now: Date): WorkoutSession {
  requireActive(s);
  return mapExercise(
    s,
    key,
    (e) => {
      const last = e.sets[e.sets.length - 1];
      const set = emptySet(newId, last ? { load: last.load, reps: last.reps, durationSec: last.durationSec, prefill: last.prefill } : {});
      return { ...e, sets: [...e.sets, set] };
    },
    now,
  );
}

export function deleteSet(s: WorkoutSession, key: string, setId: string, now: Date): WorkoutSession {
  requireActive(s);
  return mapExercise(
    s,
    key,
    (e) => {
      if (!e.sets.some((x) => x.id === setId)) throw new WorkoutError('unknown-set', 'That set no longer exists.');
      return { ...e, sets: e.sets.filter((x) => x.id !== setId) };
    },
    now,
  );
}

export function setSkipped(s: WorkoutSession, key: string, skipped: boolean, now: Date): WorkoutSession {
  requireActive(s);
  return mapExercise(s, key, (e) => ({ ...e, skipped }), now);
}

export function setNotes(s: WorkoutSession, key: string, notes: string, now: Date): WorkoutSession {
  requireActive(s);
  return mapExercise(s, key, (e) => ({ ...e, notes: notes.slice(0, 500) }), now);
}

export function setPosition(s: WorkoutSession, position: number, now: Date): WorkoutSession {
  requireActive(s);
  const p = Math.max(0, Math.min(s.exercises.length - 1, Math.floor(position)));
  return { ...s, position: p, updatedAt: now.toISOString() };
}

export function clearRest(s: WorkoutSession, now: Date): WorkoutSession {
  requireActive(s);
  return { ...s, restStartedAt: null, restDurationSec: null, updatedAt: now.toISOString() };
}

export function restRemainingSec(s: Pick<WorkoutSession, 'restStartedAt' | 'restDurationSec'>, now: Date): number | null {
  if (!s.restStartedAt || s.restDurationSec === null) return null;
  const elapsed = (now.getTime() - Date.parse(s.restStartedAt)) / 1000;
  return Math.max(0, Math.ceil(s.restDurationSec - elapsed));
}

export function pause(s: WorkoutSession, now: Date): WorkoutSession {
  requireActive(s);
  if (s.pausedAt) return s;
  return { ...s, pausedAt: now.toISOString(), updatedAt: now.toISOString() };
}

export function resume(s: WorkoutSession, now: Date): WorkoutSession {
  requireActive(s);
  if (!s.pausedAt) return s;
  const pausedFor = Math.max(0, now.getTime() - Date.parse(s.pausedAt));
  return { ...s, pausedAt: null, pausedMs: s.pausedMs + pausedFor, updatedAt: now.toISOString() };
}

/** Active (unpaused) seconds since start, computed from timestamps. */
export function activeElapsedSec(s: Pick<WorkoutSession, 'startedAt' | 'pausedAt' | 'pausedMs'>, now: Date): number {
  const end = s.pausedAt ? Date.parse(s.pausedAt) : now.getTime();
  return Math.max(0, Math.floor((end - Date.parse(s.startedAt) - s.pausedMs) / 1000));
}

/** Minimum believable seconds per completed set for a live-timed session. */
export const MIN_PLAUSIBLE_SEC_PER_SET = 30;

/**
 * Whether the live timer plausibly reflects training time. Rapid retrospective
 * entry (e.g. 26 sets in one minute) is not treated as a real duration.
 */
export function timerIsPlausible(s: WorkoutSession, now: Date): boolean {
  const sets = completedSetCount(s);
  return sets === 0 || activeElapsedSec(s, now) >= sets * MIN_PLAUSIBLE_SEC_PER_SET;
}

export type DurationChoice = { source: 'timer' } | { source: 'manual'; minutes: number } | { source: 'not-recorded' };

/**
 * Finish a workout. Requires at least one explicitly completed, valid set.
 * Unconfirmed sets are dropped so history contains only performed work.
 */
export function finish(s: WorkoutSession, now: Date, duration: DurationChoice, timeZone?: string): WorkoutSession {
  requireActive(s);
  if (completedSetCount(s) === 0) throw new WorkoutError('no-valid-work', 'Complete at least one set before finishing.');
  const resumed = s.pausedAt ? resume(s, now) : s;
  let durationSec: number | null;
  if (duration.source === 'timer') durationSec = activeElapsedSec(resumed, now);
  else if (duration.source === 'manual') {
    if (!Number.isInteger(duration.minutes) || duration.minutes < 1 || duration.minutes > 600) throw new WorkoutError('invalid-set', 'Enter a duration between 1 and 600 minutes.');
    durationSec = duration.minutes * 60;
  } else durationSec = null;
  const iso = now.toISOString();
  return {
    ...resumed,
    state: 'completed',
    exercises: resumed.exercises.map((e) => ({ ...e, sets: e.sets.filter((x) => isCompletedSet(x, e.loadType)) })),
    completedAt: iso,
    completedLocalDate: localDateOf(now, timeZone),
    updatedAt: iso,
    durationSource: duration.source,
    durationSec,
    restStartedAt: null,
    restDurationSec: null,
  };
}

export function discard(s: WorkoutSession, now: Date): WorkoutSession {
  requireActive(s);
  const iso = now.toISOString();
  return { ...s, state: 'discarded', discardedAt: iso, updatedAt: iso, restStartedAt: null, restDurationSec: null };
}

// ── Historical corrections ────────────────────────────────────────

export interface HistoryEdit {
  exercises: SessionExercise[];
  duration?: DurationChoice | { source: 'keep' };
  localDate?: string;
}

/**
 * Correct a completed session. Every remaining set must be completed and valid,
 * and at least one must remain (otherwise delete the session instead).
 */
export function editCompleted(s: WorkoutSession, edit: HistoryEdit, now: Date): WorkoutSession {
  if (s.state !== 'completed') throw new WorkoutError('not-completed', 'Only completed workouts can be corrected.');
  for (const e of edit.exercises) {
    for (const set of e.sets) {
      if (!set.completed || !setValuesValid(set, e.loadType)) throw new WorkoutError('invalid-set', `${e.name}: every set needs valid values.`);
    }
  }
  if (edit.exercises.every((e) => e.sets.length === 0)) throw new WorkoutError('no-valid-work', 'A workout needs at least one set. Delete it instead.');
  let durationSource = s.durationSource;
  let durationSec = s.durationSec;
  const d = edit.duration;
  if (d && d.source !== 'keep') {
    if (d.source === 'manual') {
      if (!Number.isInteger(d.minutes) || d.minutes < 1 || d.minutes > 600) throw new WorkoutError('invalid-set', 'Enter a duration between 1 and 600 minutes.');
      durationSource = 'manual';
      durationSec = d.minutes * 60;
    } else if (d.source === 'not-recorded') {
      durationSource = 'not-recorded';
      durationSec = null;
    }
  }
  return {
    ...s,
    exercises: edit.exercises.map((e) => ({ ...e, skipped: e.sets.length === 0 ? e.skipped : false })),
    completedLocalDate: edit.localDate ?? s.completedLocalDate,
    durationSource,
    durationSec,
    editedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/** Human-readable duration that never invents time. */
export function describeDuration(s: Pick<WorkoutSession, 'durationSource' | 'durationSec'>): string {
  if (s.durationSec === null || s.durationSource === 'not-recorded' || s.durationSource === 'legacy-entry-time') return 'Duration not recorded';
  const min = Math.max(1, Math.round(s.durationSec / 60));
  return s.durationSource === 'manual' ? `${min} min (entered)` : `${min} min`;
}
