import { EXERCISES_BY_ID } from '../content/exercises';
import type { LoadType, ProgrammeExercise, WeightUnit } from './types';

/**
 * Plate calculator. Standard gym plates, largest first. A bar's weight is never
 * assumed: for a barbell "total", the user picks their bar.
 */
export const PLATES: Record<WeightUnit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
};

export const BARS: Record<WeightUnit, number[]> = {
  kg: [20, 15, 10],
  lb: [45, 35, 25],
};

/** Whether plates make sense: per-side loading, or a barbell written as a total. */
export function plateCalculable(ex: Pick<ProgrammeExercise, 'exerciseId' | 'loadType'>): boolean {
  if (ex.loadType === 'per-side') return true;
  if (ex.loadType === 'total') return EXERCISES_BY_ID.get(ex.exerciseId)?.equipment.includes('barbell') ?? false;
  return false;
}

/** Fewest plates for one side (greedy works for standard plate sets). Works in hundredths to avoid float drift. */
export function platesForSide(perSide: number, unit: WeightUnit): { plates: number[]; remainder: number } {
  let left = Math.round(perSide * 100);
  const plates: number[] = [];
  for (const p of PLATES[unit]) {
    const c = Math.round(p * 100);
    while (left >= c) {
      plates.push(p);
      left -= c;
    }
  }
  return { plates, remainder: left / 100 };
}

export type PlateResult =
  | { ok: true; perSide: number; plates: number[]; remainder: number }
  | { ok: false; reason: 'below-bar' | 'needs-bar' };

export function plateBreakdown(args: { load: number; loadType: LoadType; unit: WeightUnit; bar: number | null }): PlateResult {
  let perSide: number;
  if (args.loadType === 'per-side') perSide = args.load;
  else {
    if (args.bar === null) return { ok: false, reason: 'needs-bar' };
    if (args.load < args.bar) return { ok: false, reason: 'below-bar' };
    perSide = (args.load - args.bar) / 2;
  }
  const { plates, remainder } = platesForSide(perSide, args.unit);
  return { ok: true, perSide, plates, remainder };
}

/** "20 + 5 + 2.5" — or "no plates" for an empty side. */
export function platesText(plates: readonly number[]): string {
  return plates.length ? plates.join(' + ') : 'no plates';
}
