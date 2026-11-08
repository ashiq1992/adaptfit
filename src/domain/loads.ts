import type { LoadType, WeightUnit } from './types';

export const LB_PER_KG = 2.2046226218;

export const LOAD_TYPE_LABEL: Record<LoadType, string> = {
  total: 'Total weight',
  'per-side': 'Per side',
  'per-dumbbell': 'Per dumbbell',
  bodyweight: 'Bodyweight',
  'bodyweight-plus': 'Bodyweight + added load',
  assisted: 'Assisted (assistance amount)',
  timed: 'Timed',
  unspecified: 'Not specified',
};

/** Short unit suffix shown next to a value, e.g. "kg/side". */
export function loadSuffix(loadType: LoadType, unit: WeightUnit): string {
  switch (loadType) {
    case 'per-side':
      return `${unit}/side`;
    case 'per-dumbbell':
      return `${unit} each`;
    case 'bodyweight-plus':
      return `${unit} added`;
    case 'assisted':
      return `${unit} assist`;
    default:
      return unit;
  }
}

/** Whether a set for this load type records an external load at all. */
export function usesLoad(loadType: LoadType): boolean {
  return loadType !== 'bodyweight' && loadType !== 'timed';
}

export function usesReps(loadType: LoadType): boolean {
  return loadType !== 'timed';
}

/** Default stepper increment for the −/+ controls. */
export function loadStep(loadType: LoadType, unit: WeightUnit): number {
  if (unit === 'lb') return loadType === 'per-side' ? 2.5 : 5;
  if (loadType === 'per-side') return 1.25;
  if (loadType === 'per-dumbbell') return 1;
  return 2.5;
}

export function toKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : value / LB_PER_KG;
}

/** Display a load with its interpretation, e.g. "30 kg/side", "BW", "BW + 10 kg". */
export function formatLoad(load: number | null, loadType: LoadType, unit: WeightUnit): string {
  if (loadType === 'bodyweight') return 'BW';
  if (loadType === 'timed') return load === null ? '' : `${trim(load)} ${unit}`;
  if (load === null) return '—';
  if (loadType === 'bodyweight-plus') return `BW + ${trim(load)} ${unit}`;
  if (loadType === 'assisted') return `BW − ${trim(load)} ${unit} assist`;
  return `${trim(load)} ${loadSuffix(loadType, unit)}`;
}

export function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/**
 * Comparison direction: for assisted exercises less assistance is harder, so a
 * lower number is an improvement.
 */
export function loadDirection(loadType: LoadType): 1 | -1 {
  return loadType === 'assisted' ? -1 : 1;
}

/**
 * Key under which performances are comparable: the same exercise recorded
 * with the same loading convention. Units are converted, conventions are not.
 */
export function comparableKey(exerciseId: string, loadType: LoadType): string {
  return `${exerciseId}|${loadType}`;
}

/** Load types where a planned starting weight makes sense (added/assist amount for bodyweight variants). */
export function usesPlannedLoad(loadType: LoadType): boolean {
  return loadType !== 'bodyweight' && loadType !== 'timed' && loadType !== 'unspecified';
}

/**
 * Convert a load between units, rounded to a practical increment (0.25 kg /
 * 0.5 lb). Only used for planned loads; recorded history is never converted.
 */
export function convertLoad(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  const raw = to === 'kg' ? value / LB_PER_KG : value * LB_PER_KG;
  const step = to === 'kg' ? 0.25 : 0.5;
  return Math.round(raw / step) * step;
}

/** e.g. "30 kg per side", "20 kg per dumbbell", "45 kg total", "BW + 10 kg added". */
export function describePlannedLoad(value: number, loadType: LoadType, unit: WeightUnit): string {
  switch (loadType) {
    case 'per-side':
      return `${trim(value)} ${unit} per side`;
    case 'per-dumbbell':
      return `${trim(value)} ${unit} per dumbbell`;
    case 'bodyweight-plus':
      return `Bodyweight + ${trim(value)} ${unit}`;
    case 'assisted':
      return `Bodyweight, ${trim(value)} ${unit} assistance`;
    default:
      return `${trim(value)} ${unit} total`;
  }
}
