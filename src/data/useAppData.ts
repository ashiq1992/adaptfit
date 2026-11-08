import { useMemo } from 'react';
import { localDateOf } from '../domain/dates';
import { comparableKey } from '../domain/loads';
import { computeRpg, type RpgState } from '../domain/rpg';
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
import { clock } from '../ui/clock';
import { useLive, useNow } from '../ui/hooks';
import { getDb } from './db';

export interface AppData {
  profile: Profile | undefined;
  programmes: Programme[];
  activeProgramme: Programme | null;
  sessions: WorkoutSession[];
  completed: WorkoutSession[];
  active: WorkoutSession | undefined;
  checkIns: CheckIn[];
  recommendations: CoachRecommendation[];
  weekPlans: WeekPlan[];
  measurements: Measurement[];
  customExercises: CustomExercise[];
  reviewedWeeks: string[];
  bodyweights: BodyweightEntry[];
  nutrition: NutritionProfile | null;
  mealPlans: MealPlan[];
}

async function loadAll(): Promise<AppData> {
  const db = getDb();
  const [profile, programmes, sessions, checkIns, recommendations, weekPlans, measurements, customExercises, reviewed, bodyweights, nutrition, mealPlans] = await Promise.all([
    db.profile.get('me'),
    db.programmes.toArray(),
    db.sessions.toArray(),
    db.checkIns.toArray(),
    db.recommendations.toArray(),
    db.weekPlans.toArray(),
    db.measurements.toArray(),
    db.customExercises.toArray(),
    db.meta.get('reviewedWeeks'),
    db.bodyweights.toArray(),
    db.nutrition.get('me'),
    db.mealPlans.toArray(),
  ]);
  const completed = sessions
    .filter((s) => s.state === 'completed')
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '') || a.id.localeCompare(b.id));
  return {
    profile,
    programmes: programmes.sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)),
    activeProgramme: programmes.find((p) => p.isActive) ?? null,
    sessions,
    completed,
    active: sessions.find((s) => s.state === 'active'),
    checkIns: checkIns.sort((a, b) => a.localDate.localeCompare(b.localDate)),
    recommendations: recommendations.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    weekPlans,
    measurements: measurements.sort((a, b) => a.localDate.localeCompare(b.localDate)),
    customExercises,
    reviewedWeeks: (reviewed?.value as string[] | undefined) ?? [],
    bodyweights: bodyweights.sort((a, b) => a.localDate.localeCompare(b.localDate) || a.createdAt.localeCompare(b.createdAt)),
    nutrition: nutrition ?? null,
    mealPlans,
  };
}

/**
 * Every screen reads from this single live snapshot. Dexie re-runs the query
 * on any change (including from other tabs), so all derived numbers — trends,
 * PRs, XP, achievements — recalculate from the stored records.
 */
export function useAppData() {
  return useLive(loadAll, []);
}

export function useToday(profile: Profile | undefined): string {
  const now = useNow(30_000);
  return localDateOf(now, profile?.timezone);
}

export function useRpg(data: AppData | undefined, today: string): RpgState | null {
  return useMemo(() => {
    if (!data) return null;
    return computeRpg({
      sessions: data.sessions,
      checkIns: data.checkIns,
      recommendations: data.recommendations,
      weekPlans: data.weekPlans,
      programme: data.activeProgramme,
      reviewedWeeks: data.reviewedWeeks,
      today,
    });
  }, [data, today]);
}

export function priorityKeys(programme: Programme | null): Set<string> {
  const keys = new Set<string>();
  programme?.days.forEach((d) => d.exercises.forEach((e) => e.priority && keys.add(comparableKey(e.exerciseId, e.loadType))));
  return keys;
}

export const nowDate = () => clock.now();
