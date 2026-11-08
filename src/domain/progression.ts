import { addDays, localDateOf } from './dates';
import { comparableKey, loadDirection, loadSuffix, toKg, trim, usesLoad } from './loads';
import type { LoadType, SessionExercise, SessionSet, WeightUnit, WorkoutSession } from './types';
import { completedSets } from './workout';

const EPS = 0.01;

export type ChangeKind = 'load-up' | 'reps-up' | 'sets-up' | 'effort-down' | 'stable' | 'mixed' | 'regression' | 'insufficient';

export interface ExerciseSummary {
  key: string;
  exerciseId: string;
  name: string;
  loadType: LoadType;
  unit: WeightUnit;
  sets: number;
  /** Best load (direction-aware) in the exercise's own unit; null when not applicable/recorded. */
  topLoad: number | null;
  topLoadKg: number | null;
  /** Most reps achieved at the top load (or best reps for bodyweight). */
  repsAtTop: number | null;
  setsAtTop: number;
  bestDurationSec: number | null;
  totalReps: number;
  /** Σ load × reps in the exercise's own convention; null if not meaningful. */
  volume: number | null;
  avgRir: number | null;
}

export function summarizeExercise(ex: SessionExercise): ExerciseSummary | null {
  const sets = completedSets(ex);
  if (sets.length === 0) return null;
  const dir = loadDirection(ex.loadType);
  const withLoad = usesLoad(ex.loadType) ? sets.filter((s) => s.load !== null) : [];
  let topLoad: number | null = null;
  for (const s of withLoad) if (topLoad === null || dir * (s.load! - topLoad) > 0) topLoad = s.load!;
  const atTop = topLoad === null ? sets : sets.filter((s) => s.load !== null && Math.abs(s.load - topLoad!) < EPS);
  const repsAtTop = ex.loadType === 'timed' ? null : Math.max(0, ...atTop.map((s) => s.reps ?? 0)) || null;
  const rirs = sets.map((s) => s.rir).filter((r): r is number => r !== null);
  const volume =
    ex.loadType === 'total' || ex.loadType === 'per-side' || ex.loadType === 'per-dumbbell'
      ? sets.every((s) => s.load !== null)
        ? sets.reduce((n, s) => n + s.load! * (s.reps ?? 0), 0)
        : null
      : null;
  return {
    key: comparableKey(ex.exerciseId, ex.loadType),
    exerciseId: ex.exerciseId,
    name: ex.name,
    loadType: ex.loadType,
    unit: ex.unit,
    sets: sets.length,
    topLoad,
    topLoadKg: topLoad === null ? null : toKg(topLoad, ex.unit),
    repsAtTop,
    setsAtTop: atTop.length,
    bestDurationSec: ex.loadType === 'timed' ? Math.max(0, ...sets.map((s) => s.durationSec ?? 0)) || null : null,
    totalReps: sets.reduce((n, s) => n + (s.reps ?? 0), 0),
    volume,
    avgRir: rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null,
  };
}

export interface Comparison {
  kind: ChangeKind;
  /** Short label such as "+1 rep", "+2.5 kg/side", "Stable". */
  label: string;
}

/** Classify current vs previous comparable performance (same exercise and convention). */
export function compare(cur: ExerciseSummary, prev: ExerciseSummary | null): Comparison {
  if (!prev || prev.key !== cur.key) return { kind: 'insufficient', label: 'First record' };
  const dir = loadDirection(cur.loadType);

  if (cur.loadType === 'timed') {
    const d = (cur.bestDurationSec ?? 0) - (prev.bestDurationSec ?? 0);
    if (d > 0) return { kind: 'reps-up', label: `+${d} s` };
    if (d < 0) return { kind: 'regression', label: `${d} s` };
    return { kind: 'stable', label: 'Stable' };
  }

  const bothLoaded = cur.topLoadKg !== null && prev.topLoadKg !== null;
  if (usesLoad(cur.loadType) && !bothLoaded) {
    // One side has no recorded load: only reps are comparable if neither has load.
    if (cur.topLoadKg !== null || prev.topLoadKg !== null) return { kind: 'insufficient', label: 'Load not recorded' };
  }
  const dLoadKg = bothLoaded ? dir * (cur.topLoadKg! - prev.topLoadKg!) : 0;
  const dReps = (cur.repsAtTop ?? 0) - (prev.repsAtTop ?? 0);
  const suffix = loadSuffix(cur.loadType, cur.unit);
  const loadText = () => {
    const raw = cur.unit === prev.unit ? cur.topLoad! - prev.topLoad! : (cur.topLoadKg! - prev.topLoadKg!) * (cur.unit === 'lb' ? 2.2046226218 : 1);
    return `${raw > 0 ? '+' : '−'}${trim(Math.abs(Math.round(raw * 100) / 100))} ${suffix}`;
  };

  if (dLoadKg > EPS) return dReps >= 0 || cur.loadType === 'assisted' ? { kind: 'load-up', label: loadText() } : { kind: 'load-up', label: `${loadText()}, ${dReps} rep${Math.abs(dReps) === 1 ? '' : 's'}` };
  if (dLoadKg < -EPS) return dReps > 0 ? { kind: 'mixed', label: `${loadText()}, +${dReps} reps` } : { kind: 'regression', label: loadText() };
  if (dReps > 0) return { kind: 'reps-up', label: `+${dReps} rep${dReps === 1 ? '' : 's'}` };
  if (dReps < 0) return { kind: 'regression', label: `${dReps} rep${dReps === -1 ? '' : 's'}` };
  if (cur.setsAtTop > prev.setsAtTop) return { kind: 'sets-up', label: `+${cur.setsAtTop - prev.setsAtTop} set${cur.setsAtTop - prev.setsAtTop === 1 ? '' : 's'}` };
  if (cur.avgRir !== null && prev.avgRir !== null && cur.avgRir - prev.avgRir >= 1)
    return { kind: 'effort-down', label: `Easier (RIR +${trim(Math.round((cur.avgRir - prev.avgRir) * 10) / 10)})` };
  return { kind: 'stable', label: 'Stable' };
}

export const IMPROVING: ReadonlySet<ChangeKind> = new Set(['load-up', 'reps-up', 'sets-up', 'effort-down']);

function completedSorted(sessions: readonly WorkoutSession[]): WorkoutSession[] {
  return sessions
    .filter((s) => s.state === 'completed' && s.completedAt)
    .sort((a, b) => (a.completedAt! < b.completedAt! ? -1 : a.completedAt! > b.completedAt! ? 1 : a.id < b.id ? -1 : 1));
}

export interface HistoryPoint {
  sessionId: string;
  completedAt: string;
  localDate: string;
  summary: ExerciseSummary;
  /** Epley estimate; only for loaded conventions with ≤ 12 reps. Clearly an estimate. */
  e1rm: number | null;
}

export function estimated1RM(load: number | null, reps: number | null, loadType: LoadType): number | null {
  if (load === null || reps === null || reps < 1 || reps > 12) return null;
  if (loadType !== 'total' && loadType !== 'per-side' && loadType !== 'per-dumbbell') return null;
  return Math.round(load * (1 + reps / 30) * 10) / 10;
}

/** Chronological performance for one exercise/convention. */
export function exerciseHistory(sessions: readonly WorkoutSession[], key: string): HistoryPoint[] {
  const out: HistoryPoint[] = [];
  for (const s of completedSorted(sessions)) {
    for (const ex of s.exercises) {
      if (comparableKey(ex.exerciseId, ex.loadType) !== key) continue;
      const summary = summarizeExercise(ex);
      if (!summary) continue;
      out.push({ sessionId: s.id, completedAt: s.completedAt!, localDate: s.completedLocalDate ?? s.completedAt!.slice(0, 10), summary, e1rm: estimated1RM(summary.topLoad, summary.repsAtTop, summary.loadType) });
      break;
    }
  }
  return out;
}

/** Previous comparable summary for an exercise within a session's history. */
export function previousSummary(sessions: readonly WorkoutSession[], session: WorkoutSession, ex: SessionExercise): ExerciseSummary | null {
  const key = comparableKey(ex.exerciseId, ex.loadType);
  const before = completedSorted(sessions).filter((s) => s.id !== session.id && session.completedAt && s.completedAt! < session.completedAt);
  for (let i = before.length - 1; i >= 0; i--) {
    const found = before[i]!.exercises.find((e) => comparableKey(e.exerciseId, e.loadType) === key);
    const summary = found ? summarizeExercise(found) : null;
    if (summary) return summary;
  }
  return null;
}

export interface ExerciseChange {
  key: string;
  name: string;
  summary: ExerciseSummary;
  previous: ExerciseSummary | null;
  comparison: Comparison;
  isPR: boolean;
}

/** Per-exercise changes for a completed session against real previous records. */
export function sessionChanges(sessions: readonly WorkoutSession[], session: WorkoutSession): ExerciseChange[] {
  const prs = new Set(sessionPRs(sessions, session));
  return session.exercises
    .map((ex) => {
      const summary = summarizeExercise(ex);
      if (!summary) return null;
      const previous = previousSummary(sessions, session, ex);
      return { key: summary.key, name: ex.name, summary, previous, comparison: compare(summary, previous), isPR: prs.has(summary.key) };
    })
    .filter((x): x is ExerciseChange => x !== null);
}

function dominates(a: SessionSet, b: SessionSet, loadType: LoadType, unitA: WeightUnit, unitB: WeightUnit): boolean {
  if (loadType === 'timed') return (a.durationSec ?? 0) >= (b.durationSec ?? 0);
  const repsOk = (a.reps ?? 0) >= (b.reps ?? 0);
  if (!usesLoad(loadType)) return repsOk;
  if (a.load === null || b.load === null) return false;
  const dir = loadDirection(loadType);
  return repsOk && dir * (toKg(a.load, unitA) - toKg(b.load, unitB)) >= -EPS;
}

/**
 * Personal records in a session: an exercise is a PR when one of its completed
 * sets is not matched or beaten (load and reps) by any earlier set of the same
 * exercise and convention. The first-ever record is a baseline, not a PR.
 */
export function sessionPRs(sessions: readonly WorkoutSession[], session: WorkoutSession): string[] {
  if (session.state !== 'completed' || !session.completedAt) return [];
  const earlier = completedSorted(sessions).filter((s) => s.id !== session.id && s.completedAt! < session.completedAt!);
  const keys: string[] = [];
  for (const ex of session.exercises) {
    const key = comparableKey(ex.exerciseId, ex.loadType);
    const prevSets: { set: SessionSet; unit: WeightUnit }[] = [];
    for (const s of earlier) for (const e of s.exercises) if (comparableKey(e.exerciseId, e.loadType) === key) for (const set of completedSets(e)) prevSets.push({ set, unit: e.unit });
    if (prevSets.length === 0) continue;
    const cur = completedSets(ex);
    if (cur.some((c) => !prevSets.some((p) => dominates(p.set, c, ex.loadType, p.unit, ex.unit)))) keys.push(key);
  }
  return [...new Set(keys)];
}

export type Range = '4w' | '8w' | '12w' | 'all';

export function rangeStart(range: Range, today: string): string | null {
  if (range === 'all') return null;
  const weeks = range === '4w' ? 4 : range === '8w' ? 8 : 12;
  return addDays(today, -weeks * 7 + 1);
}

export function filterRange<T extends { localDate: string }>(points: readonly T[], range: Range, today: string): T[] {
  const start = rangeStart(range, today);
  return points.filter((p) => (start === null || p.localDate >= start) && p.localDate <= today);
}

export interface TrendSummary {
  kind: ChangeKind;
  label: string;
  first: HistoryPoint;
  last: HistoryPoint;
  sessions: number;
}

/** Compare first and last point in a range. Requires at least two sessions. */
export function trend(points: readonly HistoryPoint[]): TrendSummary | null {
  if (points.length < 2) return null;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const c = compare(last.summary, first.summary);
  return { kind: c.kind, label: c.label, first, last, sessions: points.length };
}

/** Distinct comparable exercises the user has completed, most recent first. */
export function trainedExercises(sessions: readonly WorkoutSession[]): { key: string; name: string; loadType: LoadType; sessions: number; lastDate: string }[] {
  const map = new Map<string, { key: string; name: string; loadType: LoadType; sessions: number; lastDate: string }>();
  for (const s of completedSorted(sessions)) {
    for (const ex of s.exercises) {
      if (completedSets(ex).length === 0) continue;
      const key = comparableKey(ex.exerciseId, ex.loadType);
      const cur = map.get(key);
      map.set(key, { key, name: ex.name, loadType: ex.loadType, sessions: (cur?.sessions ?? 0) + 1, lastDate: s.completedLocalDate ?? s.completedAt!.slice(0, 10) });
    }
  }
  return [...map.values()].sort((a, b) => (a.lastDate < b.lastDate ? 1 : a.lastDate > b.lastDate ? -1 : a.name.localeCompare(b.name)));
}

export interface PeriodSummary {
  sessions: number;
  completedSets: number;
  strengthSets: number;
  prs: number;
}

export function periodSummary(sessions: readonly WorkoutSession[], range: Range, today: string): PeriodSummary {
  const start = rangeStart(range, today);
  const inRange = completedSorted(sessions).filter((s) => {
    const d = s.completedLocalDate ?? s.completedAt!.slice(0, 10);
    return (start === null || d >= start) && d <= today;
  });
  let completed = 0;
  let strength = 0;
  let prs = 0;
  for (const s of inRange) {
    for (const e of s.exercises) {
      const n = completedSets(e).length;
      completed += n;
      if (e.tags.includes('strength')) strength += n;
    }
    prs += sessionPRs(sessions, s).length;
  }
  return { sessions: inRange.length, completedSets: completed, strengthSets: strength, prs };
}

/** Monday (YYYY-MM-DD) of the week containing a local date. */
export function weekStartOf(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(localDate, -((dow + 6) % 7));
}

export interface WeekConsistency {
  weekStart: string;
  target: number;
  completed: number;
  met: boolean;
}

/**
 * Planned vs completed sessions per week. `targetFor` returns the planned
 * number of sessions for a week (programme frequency or an approved adjusted
 * week), or 0 when nothing was planned.
 */
export function weeklyConsistency(
  sessions: readonly WorkoutSession[],
  today: string,
  weeks: number,
  targetFor: (weekStart: string) => number,
): WeekConsistency[] {
  const thisWeek = weekStartOf(today);
  const out: WeekConsistency[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addDays(thisWeek, -7 * i);
    const we = addDays(ws, 6);
    const completed = sessions.filter((s) => s.state === 'completed' && s.completedLocalDate && s.completedLocalDate >= ws && s.completedLocalDate <= we).length;
    const target = targetFor(ws);
    out.push({ weekStart: ws, target, completed, met: target > 0 && completed >= target });
  }
  return out;
}

export function todayIn(now: Date, timeZone?: string): string {
  return localDateOf(now, timeZone);
}
