import { addDays } from './dates';
import { parsePerformance, performanceText } from './noteFormat';
import { weekStartOf } from './progression';
import type { ExercisePerformance, Programme, ProgrammeDay, WorkoutImportRecord, WorkoutSession } from './types';
import { latestReference, plannedSets, row, sessionsFromWeek } from './weekly';

/**
 * Log a whole workout in one go ("I did Lower today"), without logging set by
 * set. Each exercise starts from what was really done last time, else the
 * plan's values; the user can change any line before saving. Nothing is
 * invented: an exercise with no known values stays blank and is not recorded
 * unless the user types something.
 */
export function logRows(day: ProgrammeDay, sessions: readonly WorkoutSession[], imports: readonly WorkoutImportRecord[], date: string, unit: ExercisePerformance['unit']): ExercisePerformance[] {
  return day.exercises.map((pe) => {
    const ref = latestReference(pe, sessions, imports, addDays(date, 1));
    if (ref) {
      const u = ref.unit === 'lb' ? 'lb' : 'kg';
      return row(pe, u, ref.sets, 'copied', { weekStart: ref.weekStart, text: performanceText(ref.sets, pe.loadType, u), sets: ref.sets });
    }
    const planned = plannedSets(pe);
    return row(pe, pe.plannedLoad?.unit ?? unit, planned, planned.length ? 'planned' : 'blank', null);
  });
}

/** Change one row from its typed text. Empty text means "not done". */
export function editLogRow(r: ExercisePerformance, text: string): ExercisePerformance {
  const t = text.slice(0, 500);
  const parsed = parsePerformance(t, r.loadType, r.unit);
  return { ...r, text: t, sets: parsed.sets, uncertain: parsed.uncertain, source: 'edited' };
}

export function toggleLogRowSkipped(r: ExercisePerformance): ExercisePerformance {
  return { ...r, status: r.status === 'skipped' ? 'done' : 'skipped' };
}

/** Rows that will be recorded. */
export function loggableCount(rows: readonly ExercisePerformance[]): number {
  return rows.filter((r) => r.status === 'done' && r.sets.length > 0).length;
}

/**
 * The completed workout record for a one-go log, or null when nothing was
 * recorded. Same shape as a confirmed weekly session, so history, progress and
 * the weekly update treat it like any other logged workout (it is never
 * double-counted: the weekly update picks it up as already logged).
 */
export function loggedSession(args: { programme: Programme; day: ProgrammeDay; rows: readonly ExercisePerformance[]; localDate: string; id: string; newId: () => string; now: Date }): WorkoutSession | null {
  const { programme, day, rows, localDate, id, newId, now } = args;
  const { upserts } = sessionsFromWeek(
    {
      weekStart: weekStartOf(localDate),
      programmeId: programme.id,
      status: 'draft',
      sessions: [{ id: day.id, dayId: day.id, name: day.name, localDate, status: 'completed', sessionId: id, live: false, exercises: [...rows], note: '' }],
      copiedFrom: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      confirmedAt: null,
      revision: 0,
      reviewDismissed: false,
      history: [],
    },
    programme,
    newId,
    now,
  );
  const s = upserts[0];
  if (!s) return null;
  return { ...s, source: 'manual', planKind: 'programme-day', exercises: s.exercises.map((e) => ({ ...e, key: e.key.replace(/^weekly:/, 'log:') })) };
}

/** Workouts of this programme already logged on a date (to warn before logging twice). */
export function loggedOn(sessions: readonly WorkoutSession[], programmeId: string, localDate: string): WorkoutSession[] {
  return sessions.filter((s) => s.state === 'completed' && s.programmeId === programmeId && s.completedLocalDate === localDate);
}
