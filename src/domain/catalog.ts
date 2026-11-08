import type { EquipmentItem, EquipmentMode, Experience, Exercise, Plan, PlanItem, TimeBand } from './types';

/** Equipment items each mode provides. Bodyweight needs nothing. */
export const MODE_ITEMS: Record<EquipmentMode, readonly EquipmentItem[]> = {
  bodyweight: [],
  dumbbells: ['dumbbells'],
  gym: ['dumbbells', 'bench', 'barbell', 'rack', 'cable', 'machine', 'cardio-machine'],
};

export const EXPERIENCE_RANK: Record<Experience, number> = { beginner: 0, intermediate: 1, advanced: 2 };

/** Seconds between exercises (moving, setting up). */
export const TRANSITION_SEC = 20;

export function availableItems(modes: readonly EquipmentMode[]): Set<EquipmentItem> {
  const set = new Set<EquipmentItem>();
  for (const m of modes) for (const item of MODE_ITEMS[m]) set.add(item);
  return set;
}

export function hasEquipment(exercise: Pick<Exercise, 'equipment'>, available: ReadonlySet<EquipmentItem>): boolean {
  return exercise.equipment.every((item) => available.has(item));
}

export function experienceAllows(required: Experience, user: Experience): boolean {
  return EXPERIENCE_RANK[required] <= EXPERIENCE_RANK[user];
}

export function timeBandOf(minutes: number): TimeBand | null {
  if (!Number.isFinite(minutes) || minutes < 5) return null;
  if (minutes < 15) return '5-14';
  if (minutes < 30) return '15-29';
  return '30-60';
}

export const TIME_BANDS: readonly TimeBand[] = ['5-14', '15-29', '30-60'];

/** Seconds of work for one set of a plan item. */
export function workSecondsPerSet(item: Pick<PlanItem, 'mode' | 'reps' | 'durationSec'>, secondsPerRep: number): number {
  if (item.mode === 'timed') return item.durationSec ?? 0;
  return (item.reps ?? 0) * secondsPerRep;
}

/**
 * Total estimated minutes: warm-up + work + rest between sets + transitions
 * between exercises, rounded up to the next whole minute.
 */
export function estimatePlanSeconds(
  warmupSec: number,
  items: readonly Pick<PlanItem, 'mode' | 'reps' | 'durationSec' | 'sets' | 'restSec' | 'exerciseId'>[],
  secondsPerRep: (exerciseId: string) => number,
): number {
  let total = warmupSec;
  items.forEach((item, i) => {
    const work = workSecondsPerSet(item, secondsPerRep(item.exerciseId));
    total += item.sets * work + Math.max(0, item.sets - 1) * item.restSec;
    if (i > 0) total += TRANSITION_SEC;
  });
  return total;
}

export function secondsToMinutesCeil(sec: number): number {
  return Math.ceil(sec / 60);
}

export function planEquipment(items: readonly Pick<PlanItem, 'equipment'>[]): EquipmentItem[] {
  const set = new Set<EquipmentItem>();
  for (const it of items) for (const e of it.equipment) set.add(e);
  return [...set].sort();
}

export const EQUIPMENT_LABEL: Record<EquipmentItem, string> = {
  dumbbells: 'Dumbbells',
  bench: 'Bench',
  barbell: 'Barbell',
  rack: 'Squat rack',
  cable: 'Cable station',
  machine: 'Machines',
  'cardio-machine': 'Cardio machine',
};

export const MODE_LABEL: Record<EquipmentMode, string> = {
  bodyweight: 'Bodyweight',
  dumbbells: 'Dumbbells',
  gym: 'Gym',
};

export function describeEquipment(plan: Pick<Plan, 'equipment'>): string {
  if (plan.equipment.length === 0) return 'No equipment';
  return plan.equipment.map((e) => EQUIPMENT_LABEL[e]).join(', ');
}
