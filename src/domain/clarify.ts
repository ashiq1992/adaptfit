import { EXERCISES_BY_ID } from '../content/exercises';
import type { LoadType, Programme, ProgrammeExercise } from './types';

/**
 * "Same for all": after the user answers "Total, per side or per dumbbell?" for
 * one exercise, offer the same answer for the other exercises in the note that
 * are still asking — but only those using the same kind of equipment, because
 * "per side" makes sense for a barbell and not for a dumbbell. Nothing changes
 * until the user accepts.
 */

/** Equipment family used to describe the group ("barbell", "dumbbell"…). Custom exercises have none. */
export function equipmentFamily(ex: Pick<ProgrammeExercise, 'exerciseId'>): string | null {
  const lib = EXERCISES_BY_ID.get(ex.exerciseId);
  if (!lib) return null;
  return lib.equipment[0] ?? 'bodyweight';
}

/**
 * Exercises that load the same way: same equipment family and the same usual
 * convention in the library (a plate-loaded Smith machine and a weight-stack
 * machine are both "machine" but are loaded differently).
 */
function loadingGroup(ex: Pick<ProgrammeExercise, 'exerciseId'>): string | null {
  const lib = EXERCISES_BY_ID.get(ex.exerciseId);
  if (!lib) return null;
  return `${lib.equipment[0] ?? 'bodyweight'}|${lib.loadType}`;
}

const FAMILY_WORD: Record<string, string> = { barbell: 'barbell', dumbbells: 'dumbbell', machine: 'machine', cable: 'cable', bodyweight: 'bodyweight', 'cardio-machine': 'cardio' };

export function familyWord(family: string): string {
  return FAMILY_WORD[family] ?? family;
}

export interface SameAnswerOffer {
  loadType: LoadType;
  family: string;
  /** Exercise ids (ProgrammeExercise.id) still asking the same question. */
  targets: string[];
}

/** Other exercises in the note still unsure about loading, with the same equipment as `answered`. */
export function sameAnswerOffer(programme: Programme, answered: ProgrammeExercise, loadType: LoadType): SameAnswerOffer | null {
  const family = equipmentFamily(answered);
  const group = loadingGroup(answered);
  if (!family || !group) return null;
  const targets = programme.days
    .flatMap((d) => d.exercises)
    .filter((x) => x.id !== answered.id && x.uncertain.includes('loadType') && loadingGroup(x) === group)
    .map((x) => x.id);
  return targets.length ? { loadType, family, targets } : null;
}

/** Apply the accepted answer to exactly the offered exercises. */
export function applySameAnswer(programme: Programme, offer: SameAnswerOffer): Programme {
  const ids = new Set(offer.targets);
  return {
    ...programme,
    days: programme.days.map((d) => ({
      ...d,
      exercises: d.exercises.map((x) => (ids.has(x.id) && x.uncertain.includes('loadType') ? { ...x, loadType: offer.loadType, uncertain: x.uncertain.filter((u) => u !== 'loadType') } : x)),
    })),
  };
}
