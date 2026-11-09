import { addDays } from './dates';
import { comparableKey } from './loads';
import { sessionPRs } from './progression';
import type { ProgrammeExercise, WorkoutSession } from './types';
import { completedSets } from './workout';

/** How long a new best stays highlighted in the note. */
export const NEW_BEST_DAYS = 14;

/**
 * Whether the latest confirmed record of this exercise beat every earlier
 * comparable record (same exercise and loading convention). Uses the same rule
 * as Progress and the weekly review. Only recent bests are highlighted.
 */
export function recentBest(pe: Pick<ProgrammeExercise, 'exerciseId' | 'loadType'>, sessions: readonly WorkoutSession[], today: string): { localDate: string } | null {
  const key = comparableKey(pe.exerciseId, pe.loadType);
  const latest = sessions
    .filter((s) => s.state === 'completed' && s.completedAt && s.completedLocalDate && s.completedLocalDate <= today && s.exercises.some((e) => comparableKey(e.exerciseId, e.loadType) === key && completedSets(e).length))
    .sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1))[0];
  if (!latest || latest.completedLocalDate! < addDays(today, -NEW_BEST_DAYS)) return null;
  return sessionPRs(sessions, latest).includes(key) ? { localDate: latest.completedLocalDate! } : null;
}
